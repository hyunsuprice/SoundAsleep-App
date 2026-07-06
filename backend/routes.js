const express = require("express");
const database = require("./connect.js");

const routes = express.Router();

routes.post("/playback-events", async (request, response) => {
  try {
    const db = database.getDb();

    const playbackEvent = {
      sessionId: request.body.sessionId,
      participantId: request.body.participantId,
      soundscapeId: request.body.soundscapeId,
      eventType: request.body.eventType,
      audioTimeSeconds: request.body.audioTimeSeconds,
      totalPlayedSeconds: request.body.totalPlayedSeconds,
      timestamp: request.body.timestamp
        ? new Date(request.body.timestamp)
        : new Date(),
      sessionStartedAt: request.body.sessionStartedAt
        ? new Date(request.body.sessionStartedAt)
        : null,
      sessionEndedAt: request.body.sessionEndedAt
        ? new Date(request.body.sessionEndedAt)
        : null,
      reason: request.body.reason || null,
      serverTimestamp: new Date(),
    };

    const data = await db
      .collection("playbackEvents")
      .insertOne(playbackEvent);

    response.json(data);
  } catch (error) {
    console.error("Error saving playback event:", error);
    response.status(500).json({ error: "Failed to save playback event" });
  }
});

module.exports = routes;
