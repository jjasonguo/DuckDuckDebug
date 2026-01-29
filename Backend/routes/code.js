const express = require('express');
const fs = require('fs');
const path = require('path');
const Code = require('../schemas/code');
const multer = require("multer");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Recursively retrieve all Python files in a directory.
 * @param {string} dir - The starting directory to search.
 * @param {string[]} fileList - The list of Python file paths (accumulator).
 * @returns {string[]} - Array of Python file paths.
 */
function getPythonFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getPythonFiles(filePath, fileList);
        } else if (path.extname(file) === '.py') {
            fileList.push(filePath);
        }
    });
    return fileList;
}

/**
 * Extract class name and function signatures from Python file content.
 * @param {string} content - The content of the Python file.
 * @returns {object} - Object containing className and functions array.
 */
function extractPythonDetails(content) {
    // Match Python class definitions (e.g., "class MyClass:" or "class MyClass(Base):")
    const classMatch = content.match(/class\s+(\w+)\s*(?:\([^)]*\))?\s*:/);
    const className = classMatch ? classMatch[1] : null;

    // Match Python function definitions (e.g., "def my_function(arg1, arg2):")
    const functionRegex = /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->.*?)?:/g;
    const functions = [];
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
        functions.push({
            name: match[1],
            signature: `${match[1]}(${match[2]})`,
        });
    }

    return { className, functions };
}

const config = require('../config/config');

// Helper function to refresh the RAG vectorstore
async function refreshVectorstore() {
    try {
        const response = await fetch(`${config.flaskBaseUrl}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log('Vectorstore refresh:', data.message || data.error);
        return data;
    } catch (error) {
        console.error('Failed to refresh vectorstore:', error.message);
        return { error: error.message };
    }
}

router.post("/scrape-python", upload.array("files"), async (req, res) => {
    try {
      for (const file of req.files) {
        const filePath = file.originalname; // will be like "src/utils/helper.py"
        const content = file.buffer.toString("utf8");
  
        const { className, functions } = extractPythonDetails(content);
  
        const codeEntry = {
          file_path: filePath,
          file_name: path.basename(filePath),
          file_extension: '.py',
          language: 'Python',
          class_name: className,
          functions,
          content,
          last_modified: new Date(),
        };
  
        await Code.findOneAndUpdate(
          { file_path: filePath },
          codeEntry,
          { upsert: true, new: true }
        );
      }
  
      // Refresh the RAG vectorstore after uploading new code
      await refreshVectorstore();
  
      res.json({ message: `${req.files.length} Python files scraped and saved.` });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to scrape Python files." });
    }
  });

module.exports = router;
