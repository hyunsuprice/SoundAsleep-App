const express = require("express");
const cors = require("cors");
const connect = require("./connect.js");
const routes = require("./routes.js");

const app = express();
const PORT = process.env.PORT || 3000;

// Public study API: allow frontend origins including Vercel previews.
// Vercel's /api proxy forwards the browser Origin header to Render.
const corsOptions = {
  origin: true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(routes);

async function startServer() {
  await connect.connectToServer();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
