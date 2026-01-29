const express = require('express');
const axios = require('axios');
const config = require('../config/config');

const router = express.Router();

const FLASK_BASE_URL = config.flaskBaseUrl;

// RAG query
router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    const response = await axios.post(`${FLASK_BASE_URL}/query`, { question });
    
    res.set('Content-Type', 'text/plain');
    res.send(response.data.answer);
  } catch (error) {
    console.error('Error in RAG route:', error.message);
    res.status(500).send('Failed to get RAG response');
  }
});

// Get retrieved code documents
router.post('/retrieved-code', async (req, res) => {
  try {
    const { question } = req.body;
    const response = await axios.post(`${FLASK_BASE_URL}/get_retrieved_code`, { question });
    res.json(response.data);
  } catch (error) {
    console.error('Error in get-retrieved-code route:', error.message);
    res.status(500).json({ error: 'Failed to get retrieved code' });
  }
});

module.exports = router;