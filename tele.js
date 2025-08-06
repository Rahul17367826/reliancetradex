const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/", async (req, res) => {
  const { address } = req.body;
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!address) return res.status(400).send("Missing address");

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: `Wallet: ${address}`
    });
    res.status(200).send("Sent");
  } catch (err) {
    console.log("Telegram error:", err.message);
    res.status(500).send("Telegram failed");
  }
});

module.exports = router;
