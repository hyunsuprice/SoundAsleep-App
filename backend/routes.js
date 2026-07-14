const express = require("express");
const database = require("./connect.js");

const routes = express.Router();

routes.post("/playback-events", async (request, response) => {
  try {
    const db = database.getDb();

    const playbackEvent = {
      clientEventId: request.body.clientEventId || null,
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
      source: request.body.source || null,
      serverTimestamp: new Date(),
    };

    let data;

    // Idempotent write so queued retries / beacon+flush do not duplicate rows.
    if (playbackEvent.clientEventId) {
      data = await db.collection("playbackEvents").updateOne(
        { clientEventId: playbackEvent.clientEventId },
        { $setOnInsert: playbackEvent },
        { upsert: true }
      );
    } else {
      data = await db.collection("playbackEvents").insertOne(playbackEvent);
    }

    response.json(data);
  } catch (error) {
    console.error("Error saving playback event:", error);
    response.status(500).json({ error: "Failed to save playback event" });
  }
});

module.exports = routes;
