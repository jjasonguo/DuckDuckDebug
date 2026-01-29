import os
from dotenv import load_dotenv
import sys

# Dynamically add the project root to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(project_root)

load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
langsmith_key = os.getenv("LANGCHAIN_API_KEY")
langsmith_endpoint = os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")
langsmith_tracing = os.getenv("LANGCHAIN_TRACING_V2", "true")
mongo_URI = os.getenv("MONGO_URI")

# Set them into os.environ (if LangChain needs them this way)
os.environ['OPENAI_API_KEY'] = openai_key
os.environ['LANGCHAIN_API_KEY'] = langsmith_key
os.environ['LANGCHAIN_ENDPOINT'] = langsmith_endpoint
os.environ['LANGCHAIN_TRACING_V2'] = langsmith_tracing

import torch
from models.custom_bert_embedder import CustomBertEmbeddings
from pymongo import MongoClient
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.load import dumps, loads
from langchain_openai import ChatOpenAI
from operator import itemgetter

device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

# Connect to your MongoDB
client = MongoClient(mongo_URI)
db = client["test"]
collection = db["codes"]

import re

# Load code documents from MongoDB
def clean_metadata(entry, function_name=None):
    def safe(val):
        return str(val) if val is not None else ""

    return {
        "class_name": safe(entry.get("class_name")),
        "file_name": safe(entry.get("file_name")),
        "file_path": safe(entry.get("file_path")),
        "language": safe(entry.get("language")),
        "function_name": safe(function_name) if function_name else ""
    }

def extract_java_functions(content):
    """Extract individual functions from Java code with their content."""
    functions = []
    # Match method definitions - handles public/private/protected, static, return types
    pattern = r'((?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{)'
    
    matches = list(re.finditer(pattern, content))
    
    for i, match in enumerate(matches):
        func_name = match.group(2)
        start = match.start()
        
        # Find the matching closing brace
        brace_count = 0
        end = match.end() - 1  # Start from the opening brace
        for j in range(match.end() - 1, len(content)):
            if content[j] == '{':
                brace_count += 1
            elif content[j] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end = j + 1
                    break
        
        func_content = content[start:end]
        functions.append({"name": func_name, "content": func_content})
    
    return functions

def extract_python_functions(content):
    """Extract individual functions from Python code with their content."""
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

# Global variables for lazy initialization
vectorstore = None
retriever = None
embedding_fn = CustomBertEmbeddings()
splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(chunk_size=300, chunk_overlap=50)

def load_code_docs():
    """Load code documents from MongoDB, split by function."""
    code_docs = []
    for entry in collection.find({"language": {"$in": ["Java", "Python"]}}):
        content = entry.get("content")
        language = entry.get("language")
        
        if not content:
            continue
        
        # Extract functions based on language
        if language == "Java":
            functions = extract_java_functions(content)
        elif language == "Python":
            functions = extract_python_functions(content)
        else:
            functions = []
        
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
    """Refresh the vectorstore with current MongoDB documents. Call this after code upload."""
    global vectorstore, retriever
    
    code_docs = load_code_docs()
    
    if not code_docs:
        print("No documents found in MongoDB. Vectorstore not initialized.")
        vectorstore = None
        retriever = None
        return False
    
    splits = splitter.split_documents(code_docs)
    vectorstore = Chroma.from_documents(splits, embedding=embedding_fn)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    print("Vectorstore refreshed successfully with", len(splits), "chunks.")
    return True

# Try to initialize on startup (will gracefully handle empty DB)
refresh_vectorstore() 

# Final RAG chain
template1 = """Determine whether or not it seems like this person has solved their issue. If so, output a 1, otherwise output a 0.
User Query: {question}
"""
final_prompt1 = ChatPromptTemplate.from_template(template1)
llm = ChatOpenAI(temperature=0)

filtering_chain = (
    itemgetter("question")
    | final_prompt1
    | llm
    | StrOutputParser()
)
template2 = """I want you to act as a rubber duck debugger. Your job is to help the user work through 
a bug in their codebase by asking 1 follow-up question that guide them to explain and reflect on their code. 
Ask questions that encourage the user to clarify their assumptions, walk through their logic, and examine 
specific parts of their code. Never reveal the bug or the fix — your role is to guide, not solve. 

The user’s input may contain irrelevant information, so focus your questions on the parts most likely 
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
final_prompt2 = ChatPromptTemplate.from_template(template2)
llm = ChatOpenAI(temperature=0)

def get_context(x):
    """Get relevant documents, handling case where retriever is not initialized."""
    global retriever
    if retriever is None:
        return "No code documents loaded yet."
    return retriever.get_relevant_documents(x["question"])

final_rag_chain1 = (
    # {"context": retrieval_chain, "question": itemgetter("question")}
    {"context": get_context, "question": itemgetter("question")}
    | final_prompt2
    | llm
    | StrOutputParser()
)

template3 = """Write out a congratulation message for the user as he as just solved a very difficult bug.
User Query: {question}"""
final_prompt3 = ChatPromptTemplate.from_template(template3)
llm = ChatOpenAI(temperature=0)

final_rag_chain2 = (
    # {"context": retrieval_chain, "question": itemgetter("question")}
    itemgetter("question")
    | final_prompt3
    | llm
    | StrOutputParser()
)
