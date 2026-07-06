const { MongoClient, ServerApiVersion } = require("mongodb");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "config.env") });

const client = new MongoClient(process.env.ATLAS_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let database;

module.exports = {
  connectToServer: async () => {
    try {
      await client.connect();
      database = client.db("participants");
      console.log("Connected to MongoDB successfully");
    } catch (err) {
      console.error("MongoDB connection error:", err);
      process.exit(1); // Stop server if database connection fails
    }
  },
  getDb: () => {
    if (!database) {
      throw new Error("Database not initialized.");
    }
    return database;
  },
};
