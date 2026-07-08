import { useCallback, useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlayCircle, faPauseCircle } from "@fortawesome/free-solid-svg-icons";
import { postPlaybackEvent } from "../../api.js";
import { getSoundscapeById } from "../variables.js";

function createSessionId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) {
    return "--:--:--";
  }

  const wholeSeconds = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
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

function probeAudioDuration(audio, isProbingRef) {
  if (getValidDuration(audio) != null) {
    return Promise.resolve(getValidDuration(audio));
  }

  return new Promise((resolve) => {
    let settled = false;
    isProbingRef.current = true;

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
      isProbingRef.current = false;
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
        isProbingRef.current = false;
        resolve(getValidDuration(audio));
      }
    }, 3000);
  });
}

export default function SoundPlayer({ participantId, soundscapeId }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);
  const audioRef = useRef(null);
  const sessionIdRef = useRef(createSessionId());
  const sessionStartedAtRef = useRef(null);
  const segmentStartAudioTimeRef = useRef(null);
  const totalPlayedSecondsRef = useRef(0);
  const hasStartedPlaybackRef = useRef(false);
  const isProbingRef = useRef(false);
  const isPlayingIntentRef = useRef(false);
  const isProgrammaticControlRef = useRef(false);
  const playerApiRef = useRef({});
  const soundscape = getSoundscapeById(soundscapeId);

  const syncRemainingTime = useCallback(() => {
    setRemainingTime(getRemainingSeconds(audioRef.current));
  }, []);

  const getAudioTimeSeconds = useCallback(() => {
    return Number((audioRef.current?.currentTime || 0).toFixed(2));
  }, []);

  const getTotalPlayedSeconds = useCallback(() => {
    let totalPlayedSeconds = totalPlayedSecondsRef.current;
    const audio = audioRef.current;

    if (audio && segmentStartAudioTimeRef.current != null) {
      totalPlayedSeconds += Math.max(
        0,
        audio.currentTime - segmentStartAudioTimeRef.current
      );
    }

    return Number(totalPlayedSeconds.toFixed(2));
  }, []);

  const trackEvent = useCallback(
    (eventType, extraData = {}, options = {}) => {
      postPlaybackEvent(
        {
          sessionId: sessionIdRef.current,
          participantId,
          soundscapeId,
          eventType,
          audioTimeSeconds: getAudioTimeSeconds(),
          totalPlayedSeconds: getTotalPlayedSeconds(),
          timestamp: new Date().toISOString(),
          ...extraData,
        },
        options
      );
    },
    [getAudioTimeSeconds, getTotalPlayedSeconds, participantId, soundscapeId]
  );

  const finalizeCurrentSegment = useCallback(() => {
    const audio = audioRef.current;

    if (audio && segmentStartAudioTimeRef.current != null) {
      totalPlayedSecondsRef.current += Math.max(
        0,
        audio.currentTime - segmentStartAudioTimeRef.current
      );
      segmentStartAudioTimeRef.current = null;
    }
  }, []);

  const ensureSessionStarted = useCallback(() => {
    if (sessionStartedAtRef.current) {
      return;
    }

    const sessionStartedAt = new Date().toISOString();
    sessionStartedAtRef.current = sessionStartedAt;
    trackEvent("session_started", {
      sessionStartedAt,
    });
  }, [trackEvent]);

  const resetSessionTracking = useCallback(() => {
    sessionIdRef.current = createSessionId();
    sessionStartedAtRef.current = null;
    segmentStartAudioTimeRef.current = null;
    totalPlayedSecondsRef.current = 0;
    hasStartedPlaybackRef.current = false;
  }, []);

  const trackPause = useCallback(
    (source = "ui") => {
      if (!hasStartedPlaybackRef.current) {
        return;
      }

      finalizeCurrentSegment();
      trackEvent("pause", { source });
    },
    [finalizeCurrentSegment, trackEvent]
  );

  const resetPlayer = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    segmentStartAudioTimeRef.current = null;
    isPlayingIntentRef.current = false;
    syncRemainingTime();
    setIsPlaying(false);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }, [syncRemainingTime]);

  const pausePlayback = useCallback(
    (source = "ui") => {
      if (!isPlayingIntentRef.current) {
        return;
      }

      trackPause(source);

      isPlayingIntentRef.current = false;
      setIsPlaying(false);

      const audio = audioRef.current;
      if (audio && !audio.paused) {
        isProgrammaticControlRef.current = true;
        audio.pause();
        isProgrammaticControlRef.current = false;
      }

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    },
    [trackPause]
  );

  const startPlayback = useCallback(() => {
    if (isPlayingIntentRef.current) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    isPlayingIntentRef.current = true;
    setIsPlaying(true);

    isProgrammaticControlRef.current = true;
    audio
      .play()
      .then(() => {
        syncRemainingTime();
      })
      .catch(() => {
        isPlayingIntentRef.current = false;
        setIsPlaying(false);
      })
      .finally(() => {
        isProgrammaticControlRef.current = false;
      });
  }, [syncRemainingTime]);

  const handlePlaybackStarted = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isProbingRef.current || !isPlayingIntentRef.current) {
      return;
    }

    ensureSessionStarted();
    segmentStartAudioTimeRef.current = audio.currentTime;
    trackEvent(hasStartedPlaybackRef.current ? "resume" : "play");
    hasStartedPlaybackRef.current = true;

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  }, [ensureSessionStarted, trackEvent]);

  const handleNativePause = useCallback(() => {
    const audio = audioRef.current;

    if (
      isProgrammaticControlRef.current ||
      isProbingRef.current ||
      !audio ||
      audio.ended ||
      !isPlayingIntentRef.current ||
      !hasStartedPlaybackRef.current ||
      segmentStartAudioTimeRef.current == null
    ) {
      return;
    }

    pausePlayback("lock_screen");
  }, [pausePlayback]);

  const onToggle = useCallback(() => {
    if (isPlayingIntentRef.current) {
      pausePlayback("ui");
      return;
    }

    startPlayback();
  }, [pausePlayback, startPlayback]);

  useEffect(() => {
    playerApiRef.current = {
      startPlayback,
      pausePlayback,
    };
  }, [pausePlayback, startPlayback]);

  useEffect(() => {
    resetSessionTracking();
    isPlayingIntentRef.current = false;
    setIsPlaying(false);
    setRemainingTime(null);
  }, [resetSessionTracking, soundscapeId]);

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

    navigator.mediaSession.setActionHandler("play", () => {
      playerApiRef.current.startPlayback?.();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      playerApiRef.current.pausePlayback?.("lock_screen");
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [soundscape]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!sessionStartedAtRef.current) {
        return;
      }

      if (document.hidden) {
        trackEvent("phone_off");
        return;
      }

      syncRemainingTime();
      trackEvent("phone_on");
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

    const metadataEvents = [
      "loadedmetadata",
      "durationchange",
      "loadeddata",
      "canplay",
      "timeupdate",
    ];

    metadataEvents.forEach((eventName) => {
      audio.addEventListener(eventName, updateRemainingTime);
    });

    audio.addEventListener("playing", handlePlaybackStarted);
    audio.addEventListener("pause", handleNativePause);

    audio.load();
    updateRemainingTime();

    let cancelled = false;

    probeAudioDuration(audio, isProbingRef).then(() => {
      if (!cancelled) {
        updateRemainingTime();
      }
    });

    return () => {
      cancelled = true;
      metadataEvents.forEach((eventName) => {
        audio.removeEventListener(eventName, updateRemainingTime);
      });
      audio.removeEventListener("playing", handlePlaybackStarted);
      audio.removeEventListener("pause", handleNativePause);
    };
  }, [handleNativePause, handlePlaybackStarted, soundscape?.audioUrl]);

  useEffect(() => {
    return () => {
      if (isPlayingIntentRef.current) {
        trackPause("left_player");
      }
    };
  }, [trackPause]);

  function onAudioEnded() {
    trackPause("completed");
    resetPlayer();
  }

  function getStatusLabel() {
    return isPlaying ? "Playing" : "Paused";
  }

  if (!soundscape) {
    return <p className="error">Selected soundscape could not be found.</p>;
  }

  return (
    <div onClick={onToggle} className="soundPlayer">
      <div className="texts">
        <p>{getStatusLabel()}</p>
        <h3>{soundscape.title}</h3>
        <p>{formatTime(remainingTime)}</p>
      </div>
      <FontAwesomeIcon
        size="3x"
        className="icon"
        icon={isPlaying ? faPauseCircle : faPlayCircle}
      />
      <audio
        key={soundscape.audioUrl}
        ref={audioRef}
        src={soundscape.audioUrl}
        preload="metadata"
        playsInline
        onEnded={onAudioEnded}
      />
    </div>
  );
}
