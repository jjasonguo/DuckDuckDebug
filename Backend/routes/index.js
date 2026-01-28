const express = require("express");
const openAIRoutes = require("./openai");
const codeRoutes = require("./code");
const ragRoutes = require("./rag");


const router = express.Router()

router.use("/openai", openAIRoutes);
router.use("/code", codeRoutes);
router.use("/rag", ragRoutes);

module.exports = router;