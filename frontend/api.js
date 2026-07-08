import axios from "axios";

const DEVELOPMENT_API_URL = "http://localhost:3000";

function normalizeApiUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.replace(/^(https?:\/\/)(?:https?:\/\/)+/i, "$1");
}

function getApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();

  if (configuredUrl) {
    const normalizedUrl = normalizeApiUrl(configuredUrl);
    const isLocalhost = /localhost|127\.0\.0\.1/i.test(normalizedUrl);

    if (!import.meta.env.DEV && isLocalhost) {
      console.warn(
        "Ignoring localhost VITE_API_URL in production. Using /api proxy instead."
      );
      return "/api";
    }

    return normalizedUrl;
  }

  // Dev hits the backend directly; production uses Vercel rewrite (vercel.json).
  return import.meta.env.DEV ? DEVELOPMENT_API_URL : "/api";
}

const API_URL = getApiUrl();

export async function postPlaybackEvent(event) {
  try {
    const response = await axios.post(`${API_URL}/playback-events`, event);
    return response.data;
  } catch (error) {
    console.error("Error saving playback event:", {
      apiUrl: `${API_URL}/playback-events`,
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    });
    return null;
  }
}
