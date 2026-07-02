const express = require("express");
const cors = require("cors");
const connect = require("./connect.js");
const posts = require("./postRoutes");

const app = express();
const PORT = 3000;
const url = "http://localhost:5173";

const corsOptions = {
  origin: [url, "https://sound-asleep-app.vercel.app/"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(posts);

async function startServer() {
  await connect.connectToServer(); // Ensure database is connected before starting server
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

startServer();
