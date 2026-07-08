import axios from "axios";

const DEVELOPMENT_API_URL = "http://localhost:3000";
const EVENT_QUEUE_KEY = "soundasleep_pending_events";

function normalizeApiUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.replace(/^(https?:\/\/)(?:https?:\/\/)+/i, "$1");
}

export function getApiUrl() {
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

  return import.meta.env.DEV ? DEVELOPMENT_API_URL : "/api";
}

const API_URL = getApiUrl();

function readQueuedEvents() {
  try {
    const storedEvents = localStorage.getItem(EVENT_QUEUE_KEY);
    return storedEvents ? JSON.parse(storedEvents) : [];
  } catch {
    return [];
  }
}

function writeQueuedEvents(events) {
  try {
    localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(events));
  } catch (error) {
    console.error("Failed to persist playback event queue:", error);
  }
}

function queueEvent(event) {
  writeQueuedEvents([...readQueuedEvents(), event]);
}

function sendEventInBackground(event) {
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(event)], {
      type: "application/json",
    });

    if (navigator.sendBeacon(`${API_URL}/playback-events`, blob)) {
      return true;
    }
  }

  try {
    fetch(`${API_URL}/playback-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function sendEvent(event) {
  const response = await axios.post(`${API_URL}/playback-events`, event);
  return response.data;
}

export async function flushQueuedPlaybackEvents() {
  const queuedEvents = readQueuedEvents();

  if (queuedEvents.length === 0) {
    return;
  }

  const failedEvents = [];

  for (const event of queuedEvents) {
    try {
      await sendEvent(event);
    } catch (error) {
      failedEvents.push(event);
      console.error("Error flushing queued playback event:", error.message);
    }
  }

  writeQueuedEvents(failedEvents);
}

export async function postPlaybackEvent(event, options = {}) {
  const useBackgroundDelivery =
    options.preferBeacon || document.visibilityState === "hidden";

  if (useBackgroundDelivery) {
    const delivered = sendEventInBackground(event);
    if (delivered) {
      return { delivered: true, method: "background" };
    }

    queueEvent(event);
    return null;
  }

  try {
    const data = await sendEvent(event);
    await flushQueuedPlaybackEvents();
    return data;
  } catch (error) {
    queueEvent(event);

    if (sendEventInBackground(event)) {
      return { delivered: true, method: "background-fallback" };
    }

    console.error("Error saving playback event:", {
      apiUrl: `${API_URL}/playback-events`,
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    });
    return null;
  }
}

export function setupPlaybackEventSync() {
  const flush = () => {
    flushQueuedPlaybackEvents();
  };

  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      flush();
    }
  });

  flush();
}
