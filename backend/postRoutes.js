const express = require("express")
const database = require("./connect.js")
const {ObjectId} = require("mongodb")

let postRoutes = express.Router()

postRoutes.route("/playback-events").post(async (request, response) => {
  try {
    let db = database.getDb();

    const playbackEvent = {
      sessionId: request.body.sessionId || null,
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

    let data = await db
      .collection("playbackEvents")
      .insertOne(playbackEvent)

    response.json(data)
  } catch (error) {
    console.error("Error saving playback event:", error);
    response.status(500).json({ error: "Failed to save playback event" });
  }
});

postRoutes.route("/:collectionName/posts").post(async (request, response) => {
  let db = database.getDb();
  const collectionName = request.params.collectionName

  let mongoObject = {
    day: request.body.day,
    relaxation: request.body.relaxation,
    mood: request.body.mood,
    selectedSound: request.body.selectedSound,
    timestamp: new Date(),
  };
  let data = await db
    .collection(collectionName)
    .insertOne(mongoObject)
  response.json(data)
});


module.exports = postRoutes;
