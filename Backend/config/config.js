require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8000,
  mongodbUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  openaiApiKey: process.env.OPENAI_API_KEY,
  langChainApiKey: process.env.LANGCHAIN_API_KEY
};
