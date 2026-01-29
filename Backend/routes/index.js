const express = require("express");
const codeRoutes = require("./code");
const ragRoutes = require("./rag");
const audioRoutes = require("./audio");

const router = express.Router();

router.use("/code", codeRoutes);
router.use("/rag", ragRoutes);
router.use("/audio", audioRoutes);

module.exports = router;