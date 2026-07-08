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
  const [isBuffering, setIsBuffering] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);
  const audioRef = useRef(null);
  const sessionIdRef = useRef(createSessionId());
  const sessionStartedAtRef = useRef(null);
  const segmentStartAudioTimeRef = useRef(null);
  const totalPlayedSecondsRef = useRef(0);
  const hasStartedPlaybackRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const isProbingRef = useRef(false);
  const isBufferingRef = useRef(false);
  const isPlayingIntentRef = useRef(false);
  const isHandlingNativeControlRef = useRef(false);
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

    sessionStartedAtRef.current = new Date().toISOString();
    trackEvent("session_started", {
      sessionStartedAt: sessionStartedAtRef.current,
    });
  }, [trackEvent]);

  const endSession = useCallback(
    (reason, options = {}) => {
      if (!sessionStartedAtRef.current || sessionEndedRef.current) {
        return;
      }

      finalizeCurrentSegment();
      sessionEndedRef.current = true;
      trackEvent(
        "session_ended",
        {
          reason,
          sessionStartedAt: sessionStartedAtRef.current,
          sessionEndedAt: new Date().toISOString(),
        },
        options
      );
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
    isBufferingRef.current = false;
    isPlayingIntentRef.current = false;
    setIsBuffering(false);
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

      if (hasStartedPlaybackRef.current) {
        finalizeCurrentSegment();
        trackEvent("pause", { source });
      } else {
        trackEvent("play_cancelled", { source });
      }

      isBufferingRef.current = false;
      isPlayingIntentRef.current = false;
      setIsBuffering(false);
      setIsPlaying(false);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "paused";
      }
    },
    [finalizeCurrentSegment, trackEvent]
  );

  const startPlayback = useCallback(
    (source = "ui") => {
      if (isPlayingIntentRef.current) {
        return;
      }

      isPlayingIntentRef.current = true;
      setIsPlaying(true);
      trackEvent("play_requested", { source });
    },
    [trackEvent]
  );

  const handlePlaybackStarted = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isProbingRef.current || !isPlayingIntentRef.current) {
      return;
    }

    if (isBufferingRef.current) {
      isBufferingRef.current = false;
      setIsBuffering(false);
      trackEvent("buffering_end");
    }

    ensureSessionStarted();
    segmentStartAudioTimeRef.current = audio.currentTime;
    trackEvent(hasStartedPlaybackRef.current ? "resume" : "play");
    hasStartedPlaybackRef.current = true;

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  }, [ensureSessionStarted, trackEvent]);

  const handleBuffering = useCallback(() => {
    if (isProbingRef.current || !isPlayingIntentRef.current) {
      return;
    }

    if (!isBufferingRef.current) {
      isBufferingRef.current = true;
      setIsBuffering(true);
      trackEvent("buffering");
    }
  }, [trackEvent]);

  const handleNativePause = useCallback(() => {
    const audio = audioRef.current;

    if (
      isHandlingNativeControlRef.current ||
      isProbingRef.current ||
      !audio ||
      audio.ended
    ) {
      return;
    }

    if (!isPlayingIntentRef.current) {
      return;
    }

    isHandlingNativeControlRef.current = true;
    pausePlayback("system");
    isHandlingNativeControlRef.current = false;
  }, [pausePlayback]);

  const handleNativePlay = useCallback(() => {
    if (isHandlingNativeControlRef.current || isProbingRef.current) {
      return;
    }

    if (isPlayingIntentRef.current) {
      return;
    }

    isHandlingNativeControlRef.current = true;
    startPlayback("system");
    isHandlingNativeControlRef.current = false;
  }, [startPlayback]);

  const onToggle = useCallback(() => {
    if (isPlayingIntentRef.current) {
      pausePlayback("ui");
      return;
    }

    startPlayback("ui");
  }, [pausePlayback, startPlayback]);

  useEffect(() => {
    playerApiRef.current = {
      startPlayback,
      pausePlayback,
    };
  }, [pausePlayback, startPlayback]);

  useEffect(() => {
    sessionIdRef.current = createSessionId();
    sessionStartedAtRef.current = null;
    segmentStartAudioTimeRef.current = null;
    totalPlayedSecondsRef.current = 0;
    hasStartedPlaybackRef.current = false;
    sessionEndedRef.current = false;
    isBufferingRef.current = false;
    isPlayingIntentRef.current = false;
    setIsBuffering(false);
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

    navigator.mediaSession.setActionHandler("play", () => {
      playerApiRef.current.startPlayback?.("lock_screen");
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
      if (document.hidden) {
        if (isPlayingIntentRef.current) {
          trackEvent("page_hidden");
        }
        return;
      }

      syncRemainingTime();

      if (hasStartedPlaybackRef.current) {
        trackEvent("page_visible", {
          reconciledAudioTimeSeconds: getAudioTimeSeconds(),
          reconciledTotalPlayedSeconds: getTotalPlayedSeconds(),
        });
      }
    };

    const handlePageHide = (event) => {
      if (event.persisted || !isPlayingIntentRef.current) {
        return;
      }

      endSession("page_closed");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [
    endSession,
    getAudioTimeSeconds,
    getTotalPlayedSeconds,
    syncRemainingTime,
    trackEvent,
  ]);

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
    audio.addEventListener("waiting", handleBuffering);
    audio.addEventListener("stalled", handleBuffering);
    audio.addEventListener("pause", handleNativePause);
    audio.addEventListener("play", handleNativePlay);

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
      audio.removeEventListener("waiting", handleBuffering);
      audio.removeEventListener("stalled", handleBuffering);
      audio.removeEventListener("pause", handleNativePause);
      audio.removeEventListener("play", handleNativePlay);
    };
  }, [
    handleBuffering,
    handleNativePause,
    handleNativePlay,
    handlePlaybackStarted,
    soundscape?.audioUrl,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio
        .play()
        .then(() => {
          syncRemainingTime();
        })
        .catch(() => {
          trackEvent("play_failed");
          isBufferingRef.current = false;
          isPlayingIntentRef.current = false;
          setIsBuffering(false);
          setIsPlaying(false);
        });
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [isPlaying, syncRemainingTime, trackEvent]);

  useEffect(() => {
    return () => {
      endSession("left_player");
    };
  }, [endSession]);

  function onAudioEnded() {
    finalizeCurrentSegment();
    trackEvent("timer_complete");
    trackEvent("ended");
    endSession("audio_ended");
    resetPlayer();
  }

  function getStatusLabel() {
    if (isBuffering) {
      return "Buffering...";
    }

    if (isPlaying) {
      return "Playing";
    }

    return "Paused";
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
