const express = require("express");
const router = express.Router();
const Meeting = require("../models/Meeting");
const User = require("../models/User");
const crypto = require("crypto");

const APP_ID = 1636277379; // Replace with your actual App ID
const SERVER_SECRET = "5aee9818133828e154ff100b3fec5661"; // Replace with your actual Server Secret

function generateToken(appId, userId, serverSecret, effectiveTimeInSeconds, payload) {
  const version = 0x04;
  const expiredTime = Math.floor(Date.now() / 1000) + effectiveTimeInSeconds;

  const nonce = crypto.randomBytes(16).toString("hex");
  const data = {
    app_id: appId,
    user_id: userId,
    nonce,
    ctime: Math.floor(Date.now() / 1000),
    expire: expiredTime,
    payload
  };

  const base64Data = Buffer.from(JSON.stringify(data)).toString("base64");
  const hmac = crypto.createHmac("sha256", serverSecret);
  hmac.update(base64Data);
  const signature = hmac.digest("hex");

  const token = Buffer.from(`${version}${signature}${base64Data}`).toString("base64");
  return token;
}
router.post("/create", async (req, res) => {
  const { creatorId, partnerId, roomName } = req.body;

  try {
    // Check if any meeting with same roomName exists (regardless of status)
    let existing = await Meeting.findOne({ roomName });

    if (existing) {
      if (existing.status === "active") {
        // Meeting is already running, return it
        return res.status(200).json(existing);
      }
    }

    // If no meeting exists with same roomName, create it
    const newMeeting = new Meeting({
      creatorId,
      partnerId,
      roomName,
      status: "active",
    });

    await newMeeting.save();

    res.status(201).json(newMeeting);
  } catch (error) {
    console.error("Error creating meeting:", error.message);
    res.status(500).json({ message: "Error creating meeting" });
  }
});

router.post("/token", (req, res) => {
  const { userId, roomName } = req.body;

  if (!userId || !roomName) {
    return res.status(400).json({ error: "userId and roomName are required" });
  }

  try {
    const effectiveTimeInSeconds = 3600; 
    const payload = "";
    const token = generateToken(APP_ID, userId, SERVER_SECRET, effectiveTimeInSeconds, payload);
    res.json({ token });
  } catch (err) {
    console.error("Error generating Zego token:", err);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

router.get("/active/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const activeMeeting = await Meeting.findOne({
      $or: [{ creatorId: userId }, { partnerId: userId }],
      status: "active",
    });

    if (!activeMeeting)
      return res.status(404).json({ message: "No active meeting" });

    res.status(200).json(activeMeeting);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving meeting" });
  }
});

router.post("/end", async (req, res) => {
  const { roomName } = req.body;

  try {
    await Meeting.findOneAndUpdate({ roomName }, { status: "ended" });
    res.status(200).json({ message: "Meeting ended" });
  } catch (error) {
    res.status(500).json({ message: "Error ending meeting" });
  }
});

module.exports = router;
