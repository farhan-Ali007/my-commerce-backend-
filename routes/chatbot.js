const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST /api/v1/chatbot
router.post('/', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const response = await axios({
      method: 'post',
      url: 'http://127.0.0.1:11434/api/generate',
      data: {
        model: 'phi',
        prompt: prompt
      },
      responseType: 'stream'
    });

    let result = '';
    response.data.on('data', (chunk) => {
      // Each chunk is a JSON line
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) result += data.response;
        } catch (e) {
          // Ignore parse errors for incomplete lines
        }
      }
    });

    response.data.on('end', () => {
      res.json({ response: result });
    });

    response.data.on('error', (err) => {
      res.status(500).json({ error: 'Error streaming from Ollama', details: err.message });
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to connect to Ollama', details: error.message });
  }
});

module.exports = router;