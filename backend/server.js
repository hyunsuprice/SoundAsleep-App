const express = require("express");
const cors = require("cors");
const connect = require("./connect.js");
const routes = require("./routes.js");

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTION_ORIGIN = "https://sound-asleep-app.vercel.app";

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    return true;
  }

  if (origin === PRODUCTION_ORIGIN) {
    return true;
  }

  // Allow Vercel preview deployments, e.g. sound-asleep-app-git-main-*.vercel.app
  if (/^https:\/\/[\w-]+\.vercel\.app$/i.test(origin)) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    console.warn("Blocked CORS origin:", origin);
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
