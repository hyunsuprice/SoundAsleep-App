const express = require("express");
const cors = require("cors");
const connect = require("./connect.js");
const routes = require("./routes.js");

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTION_ORIGIN = "https://sound-asleep-app.vercel.app";

const corsOptions = {
  origin: (origin, callback) => {
    const isLocalhost =
      !origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

    if (isLocalhost || origin === PRODUCTION_ORIGIN) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
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
