import os
import re
import sys

import torch
from dotenv import load_dotenv
from operator import itemgetter
from pymongo import MongoClient

from langchain.load import dumps, loads
from langchain.prompts import ChatPromptTemplate
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI
from models.custom_bert_embedder import CustomBertEmbeddings

# Dynamically add the project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(project_root)

load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
langsmith_key = os.getenv("LANGCHAIN_API_KEY")
langsmith_endpoint = os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
langsmith_tracing = os.getenv("LANGCHAIN_TRACING_V2", "true")
mongo_URI = os.getenv("MONGO_URI")

# Set environment variables for LangChain
os.environ['OPENAI_API_KEY'] = openai_key
os.environ['LANGCHAIN_API_KEY'] = langsmith_key
os.environ['LANGCHAIN_ENDPOINT'] = langsmith_endpoint
os.environ['LANGCHAIN_TRACING_V2'] = langsmith_tracing

device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

# Text splitter and retriever configuration
CHUNK_SIZE = 300
CHUNK_OVERLAP = 50
RETRIEVER_K = 5

client = MongoClient(mongo_URI)
db = client["test"]
collection = db["codes"]

vectorstore = None
retriever = None
embedding_fn = CustomBertEmbeddings()
splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    chunk_size=CHUNK_SIZE, 
    chunk_overlap=CHUNK_OVERLAP
)


def clean_metadata(entry, function_name=None):
    """
    Clean and normalize metadata from a MongoDB entry.
    
    Args:
        entry: MongoDB document containing code metadata
        function_name: Optional function name to include in metadata
        
    Returns:
        dict: Cleaned metadata dictionary
    """
    def safe(val):
        return str(val) if val is not None else ""

    return {
        "class_name": safe(entry.get("class_name")),
        "file_name": safe(entry.get("file_name")),
        "file_path": safe(entry.get("file_path")),
        "language": safe(entry.get("language")),
        "function_name": safe(function_name) if function_name else ""
    }


def extract_python_functions(content):
    """
    Extract individual functions from Python code with their content.
    
    Args:
        content: String containing Python source code
        
    Returns:
        list: List of dicts with 'name' and 'content' keys for each function
    """
    functions = []
    lines = content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i]
        # Match function definition
        match = re.match(r'^(\s*)def\s+(\w+)\s*\([^)]*\)\s*(?:->.*?)?:', line)
        if match:
            indent = len(match.group(1))
            func_name = match.group(2)
            func_lines = [line]
            i += 1
            
            # Collect all lines that are part of this function (indented more or blank)
            while i < len(lines):
                next_line = lines[i]
                # Empty line or more indented = part of function
                if next_line.strip() == '':
                    func_lines.append(next_line)
                    i += 1
                elif len(next_line) - len(next_line.lstrip()) > indent:
                    func_lines.append(next_line)
                    i += 1
                else:
                    break
            
            # Remove trailing empty lines
            while func_lines and func_lines[-1].strip() == '':
                func_lines.pop()
            
            func_content = '\n'.join(func_lines)
            functions.append({"name": func_name, "content": func_content})
        else:
            i += 1
    
    return functions

def load_code_docs():
    """
    Load code documents from MongoDB, split by function.
    
    Returns:
        list: List of LangChain Document objects
    """
    code_docs = []
    for entry in collection.find({"language": "Python"}):
        content = entry.get("content")
        
        if not content:
            continue
        
        # Extract functions from Python code
        functions = extract_python_functions(content)
        
        # Create a document for each function
        if functions:
            for func in functions:
                metadata = clean_metadata(entry, function_name=func["name"])
                code_docs.append(Document(page_content=func["content"], metadata=metadata))
        else:
            # Fallback: use entire file if no functions found
            metadata = clean_metadata(entry)
            code_docs.append(Document(page_content=content, metadata=metadata))
    
    print("Document count:", collection.count_documents({}))
    print("Loaded", len(code_docs), "function documents from MongoDB")
    return code_docs

def refresh_vectorstore():
    """
    Refresh the vectorstore with current MongoDB documents.
    
    Call this after code upload to update the RAG context.
    
    Returns:
        bool: True if successful, False if no documents found
    """
    global vectorstore, retriever
    
    code_docs = load_code_docs()
    
    if not code_docs:
        print("No documents found in MongoDB. Vectorstore not initialized.")
        vectorstore = None
        retriever = None
        return False
    
    splits = splitter.split_documents(code_docs)
    vectorstore = Chroma.from_documents(splits, embedding=embedding_fn)
    retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVER_K})
    print("Vectorstore refreshed successfully with", len(splits), "chunks.")
    return True


def get_context(x):
    """
    Get relevant documents for a query.
    
    Handles the case where the retriever is not yet initialized.
    
    Args:
        x: Dict containing 'question' key
        
    Returns:
        list or str: Retrieved documents or error message
    """
    global retriever
    if retriever is None:
        return "No code documents loaded yet."
    return retriever.get_relevant_documents(x["question"])

# =============================================================================
# PROMPT TEMPLATES
# =============================================================================

FILTERING_TEMPLATE = """Determine whether or not it seems like this person has solved their issue. If so, output a 1, otherwise output a 0.
User Query: {question}
"""

DEBUGGING_TEMPLATE = """I want you to act as a rubber duck debugger. Your job is to help the user work through 
a bug in their codebase by asking a follow-up question that guides them to explain and reflect on their code. 
Ask questions that encourage the user to clarify their assumptions, walk through their logic, and examine 
specific parts of their code. Never reveal the bug or the fix — your role is to guide, not solve. 

The user's input may contain irrelevant information, so focus your questions on the parts most likely 
related to the issue.

Do not start your ouput with your questions. Start with a statement about the bug or trying to comfort the user.
Additionally, your responses should sound human and curious, helping the user think aloud and debug by talking it through. 
Follow this format:

[Statement about bug]
Here is a question to start you off: 
1. [Question]

Context: {context}

User Query: {question}
"""

CONGRATULATION_TEMPLATE = """Write out a congratulation message for the user they just solved a very difficult bug.
User Query: {question}"""

# =============================================================================
# LLM CHAINS
# =============================================================================

# Initialize LLM (shared across chains)
llm = ChatOpenAI(temperature=0)

# Filtering chain - determines if user has solved their issue
filtering_prompt = ChatPromptTemplate.from_template(FILTERING_TEMPLATE)
filtering_chain = (
    itemgetter("question")
    | filtering_prompt
    | llm
    | StrOutputParser()
)

# Debugging chain - provides rubber duck debugging assistance
debugging_prompt = ChatPromptTemplate.from_template(DEBUGGING_TEMPLATE)
final_rag_chain1 = (
    {"context": get_context, "question": itemgetter("question")}
    | debugging_prompt
    | llm
    | StrOutputParser()
)

# Congratulation chain - celebrates when user solves the bug
congratulation_prompt = ChatPromptTemplate.from_template(CONGRATULATION_TEMPLATE)
final_rag_chain2 = (
    itemgetter("question")
    | congratulation_prompt
    | llm
    | StrOutputParser()
)

# =============================================================================
# INITIALIZATION
# =============================================================================

# Initialize vectorstore on module load (handles empty DB gracefully)
refresh_vectorstore()
