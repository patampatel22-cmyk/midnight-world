require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { AccessToken } = require("livekit-server-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, liveConfigured: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET) });
});

app.post("/api/token", async (req, res) => {
  try {
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: "Live voice is not configured yet. Add the LiveKit values to server/.env." });
    }

    const { roomName, participantName } = req.body || {};
    const cleanRoom = String(roomName || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    const cleanName = String(participantName || "").trim().replace(/[<>]/g, "").slice(0, 24);

    if (!cleanRoom || !cleanName) {
      return res.status(400).json({ error: "Enter a room name and display name." });
    }

    const identity = `${cleanName}-${Math.random().toString(36).slice(2, 8)}`;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: cleanName,
      ttl: "2h"
    });

    token.addGrant({
      roomJoin: true,
      room: cleanRoom,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const jwt = await token.toJwt();
    res.json({ token: jwt, serverUrl: LIVEKIT_URL, roomName: cleanRoom, identity });
  } catch (error) {
    console.error("Token error:", error);
    res.status(500).json({ error: "Could not create a room connection. Please try again." });
  }
});

app.listen(PORT, () => console.log(`Midnight World server running on http://localhost:${PORT}`));
