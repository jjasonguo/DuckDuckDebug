require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8000,
  mongodbUri: process.env.MONGO_URI,
  openaiApiKey: process.env.OPENAI_API_KEY,
  langChainApiKey: process.env.LANGCHAIN_API_KEY,
  flaskBaseUrl: process.env.FLASK_BASE_URL
};
