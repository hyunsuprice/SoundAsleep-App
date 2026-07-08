import { useCallback, useEffect, useRef, useState } from "react";
import { postPlaybackEvent } from "../../api.js";
import { getSoundscapeById } from "../variables.js";

function createSessionId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createTrackingState() {
  return {
    sessionId: createSessionId(),
    sessionStartedAt: null,
    sessionEnded: false,
    segmentStart: null,
    totalPlayed: 0,
    hasStarted: false,
    wantPlaying: false,
    isProbing: false,
    isProgrammatic: false,
  };
}

function getValidDuration(audio) {
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
    return null;
  }

  return audio.duration;
}

function getRemainingSeconds(audio) {
  const duration = getValidDuration(audio);
  if (duration == null) {
    return null;
  }

  return Math.max(0, duration - audio.currentTime);
}

function setMediaSessionState(state) {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = state;
  }
}

function probeAudioDuration(audio, tracking) {
  if (getValidDuration(audio) != null) {
    return Promise.resolve(getValidDuration(audio));
  }

  return new Promise((resolve) => {
    let settled = false;
    tracking.isProbing = true;

    const finish = () => {
      if (settled) {
        return;
      }

      const duration = getValidDuration(audio);
      if (duration == null) {
        return;
      }

      settled = true;
      cleanup();
      audio.pause();
      audio.currentTime = 0;
      tracking.isProbing = false;
      resolve(duration);
    };

    const cleanup = () => {
      audio.removeEventListener("durationchange", finish);
      audio.removeEventListener("timeupdate", finish);
      audio.removeEventListener("loadedmetadata", finish);
    };

    audio.addEventListener("durationchange", finish);
    audio.addEventListener("timeupdate", finish);
    audio.addEventListener("loadedmetadata", finish);

    audio.load();
    audio.currentTime = Number.MAX_SAFE_INTEGER;

    window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        audio.pause();
        audio.currentTime = 0;
        tracking.isProbing = false;
        resolve(getValidDuration(audio));
      }
    }, 3000);
  });
}

const REMAINING_TIME_EVENTS = [
  "loadedmetadata",
  "durationchange",
  "loadeddata",
  "canplay",
  "timeupdate",
];

export function useSoundPlayer(participantId, soundscapeId) {
  const soundscape = getSoundscapeById(soundscapeId);
  const audioRef = useRef(null);
  const trackingRef = useRef(createTrackingState());
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);

  const syncRemainingTime = useCallback(() => {
    setRemainingTime(getRemainingSeconds(audioRef.current));
  }, []);

  const getMetrics = useCallback(() => {
    const audio = audioRef.current;
    const tracking = trackingRef.current;
    let totalPlayed = tracking.totalPlayed;

    if (audio && tracking.segmentStart != null) {
      totalPlayed += Math.max(0, audio.currentTime - tracking.segmentStart);
    }

    return {
      audioTimeSeconds: Number((audio?.currentTime || 0).toFixed(2)),
      totalPlayedSeconds: Number(totalPlayed.toFixed(2)),
    };
  }, []);

  const trackEvent = useCallback(
    (eventType, extraData = {}, options = {}) => {
      postPlaybackEvent(
        {
          sessionId: trackingRef.current.sessionId,
          participantId,
          soundscapeId,
          eventType,
          timestamp: new Date().toISOString(),
          ...getMetrics(),
          ...extraData,
        },
        options
      );
    },
    [getMetrics, participantId, soundscapeId]
  );

  const finalizeSegment = useCallback(() => {
    const audio = audioRef.current;
    const tracking = trackingRef.current;

    if (audio && tracking.segmentStart != null) {
      tracking.totalPlayed += Math.max(
        0,
        audio.currentTime - tracking.segmentStart
      );
      tracking.segmentStart = null;
    }
  }, []);

  const trackPause = useCallback(
    (source) => {
      const tracking = trackingRef.current;
      if (!tracking.hasStarted) {
        return;
      }

      finalizeSegment();
      trackEvent("pause", { source });
    },
    [finalizeSegment, trackEvent]
  );

  const endSession = useCallback(
    (reason) => {
      const tracking = trackingRef.current;
      if (!tracking.sessionStartedAt || tracking.sessionEnded) {
        return;
      }

      tracking.sessionEnded = true;
      finalizeSegment();
      trackEvent(
        "session_ended",
        {
          sessionStartedAt: tracking.sessionStartedAt,
          sessionEndedAt: new Date().toISOString(),
          reason,
        },
        { preferBeacon: true }
      );
    },
    [finalizeSegment, trackEvent]
  );

  const resetPlayer = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    trackingRef.current.segmentStart = null;
    trackingRef.current.wantPlaying = false;
    syncRemainingTime();
    setIsPlaying(false);
    setMediaSessionState("none");
  }, [syncRemainingTime]);

  const setPlayback = useCallback(
    (wantPlaying, source = "ui") => {
      const audio = audioRef.current;
      const tracking = trackingRef.current;

      if (wantPlaying) {
        if (tracking.wantPlaying || !audio) {
          return;
        }

        tracking.wantPlaying = true;
        setIsPlaying(true);
        tracking.isProgrammatic = true;

        audio
          .play()
          .then(syncRemainingTime)
          .catch(() => {
            tracking.wantPlaying = false;
            setIsPlaying(false);
          })
          .finally(() => {
            tracking.isProgrammatic = false;
          });
        return;
      }

      if (!tracking.wantPlaying) {
        return;
      }

      trackPause(source);
      tracking.wantPlaying = false;
      setIsPlaying(false);

      if (audio && !audio.paused) {
        tracking.isProgrammatic = true;
        audio.pause();
        tracking.isProgrammatic = false;
      }

      setMediaSessionState("paused");
    },
    [syncRemainingTime, trackPause]
  );

  const onAudioPlaying = useCallback(() => {
    const audio = audioRef.current;
    const tracking = trackingRef.current;

    if (!audio || tracking.isProbing || !tracking.wantPlaying) {
      return;
    }

    if (!tracking.sessionStartedAt) {
      tracking.sessionStartedAt = new Date().toISOString();
      trackEvent("session_started", {
        sessionStartedAt: tracking.sessionStartedAt,
      });
    }

    tracking.segmentStart = audio.currentTime;
    trackEvent(tracking.hasStarted ? "resume" : "play");
    tracking.hasStarted = true;
    setMediaSessionState("playing");
  }, [trackEvent]);

  const onAudioPause = useCallback(() => {
    const audio = audioRef.current;
    const tracking = trackingRef.current;

    if (
      tracking.isProgrammatic ||
      tracking.isProbing ||
      !audio ||
      audio.ended ||
      !tracking.wantPlaying ||
      !tracking.hasStarted ||
      tracking.segmentStart == null
    ) {
      return;
    }

    setPlayback(false, "lock_screen");
  }, [setPlayback]);

  const onToggle = useCallback(() => {
    setPlayback(!trackingRef.current.wantPlaying, "ui");
  }, [setPlayback]);

  const onAudioEnded = useCallback(() => {
    trackPause("completed");
    resetPlayer();
  }, [resetPlayer, trackPause]);

  useEffect(() => {
    return () => {
      endSession("soundscape_change");
    };
  }, [endSession, soundscapeId]);

  useEffect(() => {
    trackingRef.current = createTrackingState();
    setIsPlaying(false);
    setRemainingTime(null);
  }, [soundscapeId]);

  useEffect(() => {
    if (!soundscape || !("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: soundscape.title,
      artist: "SoundAsleep",
      album: "Sleep Soundscape",
      artwork: soundscape.imageUrl
        ? [{ src: soundscape.imageUrl, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });

    navigator.mediaSession.setActionHandler("play", () => setPlayback(true));
    navigator.mediaSession.setActionHandler("pause", () =>
      setPlayback(false, "lock_screen")
    );

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [setPlayback, soundscape]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!trackingRef.current.sessionStartedAt) {
        return;
      }

      if (document.hidden) {
        trackEvent("page_hidden");
        return;
      }

      syncRemainingTime();
      trackEvent("page_visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncRemainingTime, trackEvent]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !soundscape?.audioUrl) {
      return;
    }

    const updateRemainingTime = () => {
      setRemainingTime(getRemainingSeconds(audio));
    };

    REMAINING_TIME_EVENTS.forEach((eventName) => {
      audio.addEventListener(eventName, updateRemainingTime);
    });
    audio.addEventListener("playing", onAudioPlaying);
    audio.addEventListener("pause", onAudioPause);

    audio.load();
    updateRemainingTime();

    let cancelled = false;
    probeAudioDuration(audio, trackingRef.current).then(() => {
      if (!cancelled) {
        updateRemainingTime();
      }
    });

    return () => {
      cancelled = true;
      REMAINING_TIME_EVENTS.forEach((eventName) => {
        audio.removeEventListener(eventName, updateRemainingTime);
      });
      audio.removeEventListener("playing", onAudioPlaying);
      audio.removeEventListener("pause", onAudioPause);
    };
  }, [onAudioPause, onAudioPlaying, soundscape?.audioUrl]);

  useEffect(() => {
    return () => {
      endSession("left_player");
    };
  }, [endSession]);

  return {
    soundscape,
    isPlaying,
    remainingTime,
    audioRef,
    onToggle,
    onAudioEnded,
  };
}
