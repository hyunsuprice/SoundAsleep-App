import axios from "axios";

const EVENT_QUEUE_KEY = "soundasleep_pending_events";
const FLUSH_INTERVAL_MS = 30_000;

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

  // Same-origin /api so sendBeacon works in both Vite (proxied) and Vercel.
  return "/api";
}

const API_URL = getApiUrl();

let flushPromise = null;

function createClientEventId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  const queuedEvents = readQueuedEvents();
  if (queuedEvents.some((item) => item.clientEventId === event.clientEventId)) {
    return;
  }

  writeQueuedEvents([...queuedEvents, event]);
}

function removeQueuedEvent(clientEventId) {
  writeQueuedEvents(
    readQueuedEvents().filter((event) => event.clientEventId !== clientEventId)
  );
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
  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
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
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

export async function postPlaybackEvent(event, options = {}) {
  const enrichedEvent = {
    ...event,
    clientEventId: event.clientEventId || createClientEventId(),
  };

  // Persist first. Beacon/fetch keepalive are best-effort only and must
  // never be treated as confirmed delivery (common overnight phone failure).
  queueEvent(enrichedEvent);

  const useBackgroundDelivery =
    options.preferBeacon ||
    options.onUnload ||
    document.visibilityState === "hidden";

  if (useBackgroundDelivery) {
    sendEventInBackground(enrichedEvent);
    return {
      delivered: false,
      method: "queued-background",
      clientEventId: enrichedEvent.clientEventId,
    };
  }

  try {
    await sendEvent(enrichedEvent);
    removeQueuedEvent(enrichedEvent.clientEventId);
    await flushQueuedPlaybackEvents();
    return {
      delivered: true,
      method: "axios",
      clientEventId: enrichedEvent.clientEventId,
    };
  } catch (error) {
    sendEventInBackground(enrichedEvent);
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
  window.setInterval(flush, FLUSH_INTERVAL_MS);

  flush();
}
