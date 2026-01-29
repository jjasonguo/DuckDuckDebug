const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const config = require('../config/config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const FLASK_BASE_URL = config.flaskBaseUrl;

// Text-to-speech
router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;
    const response = await axios.post(`${FLASK_BASE_URL}/tts`, { text });
    res.json(response.data);
  } catch (error) {
    console.error('Error in TTS route:', error.message);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// Serve audio files
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const response = await axios.get(`${FLASK_BASE_URL}/audio/${filename}`, {
      responseType: 'stream'
    });
    
    res.set('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch (error) {
    console.error('Error in audio route:', error.message);
    res.status(500).json({ error: 'Failed to fetch audio file' });
  }
});

// Process audio (speech-to-text)
router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const formData = new FormData();
    formData.append('audio', req.file.buffer, {
      filename: req.file.originalname || 'recording.webm',
      contentType: req.file.mimetype
    });

    const response = await axios.post(`${FLASK_BASE_URL}/process_audio`, formData, {
      headers: formData.getHeaders()
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in process-audio route:', error.message);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

module.exports = router;
