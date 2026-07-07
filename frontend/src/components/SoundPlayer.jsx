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

function probeAudioDuration(audio) {
  if (getValidDuration(audio) != null) {
    return Promise.resolve(getValidDuration(audio));
  }

  return new Promise((resolve) => {
    let settled = false;

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
  const playStartedAtRef = useRef(null);
  const totalPlayedSecondsRef = useRef(0);
  const hasPlayedRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const soundscape = getSoundscapeById(soundscapeId);

  const syncRemainingTime = useCallback(() => {
    setRemainingTime(getRemainingSeconds(audioRef.current));
  }, []);

  const getAudioTimeSeconds = useCallback(() => {
    return Number((audioRef.current?.currentTime || 0).toFixed(2));
  }, []);

  const getTotalPlayedSeconds = useCallback(() => {
    let totalPlayedSeconds = totalPlayedSecondsRef.current;

    if (playStartedAtRef.current) {
      totalPlayedSeconds += (Date.now() - playStartedAtRef.current) / 1000;
    }

    return Number(totalPlayedSeconds.toFixed(2));
  }, []);

  const trackEvent = useCallback(
    (eventType, extraData = {}) => {
      postPlaybackEvent({
        sessionId: sessionIdRef.current,
        participantId,
        soundscapeId,
        eventType,
        audioTimeSeconds: getAudioTimeSeconds(),
        totalPlayedSeconds: getTotalPlayedSeconds(),
        timestamp: new Date().toISOString(),
        ...extraData,
      });
    },
    [getAudioTimeSeconds, getTotalPlayedSeconds, participantId, soundscapeId]
  );

  const ensureSessionStarted = useCallback(() => {
    if (sessionStartedAtRef.current) {
      return;
    }

    sessionStartedAtRef.current = new Date().toISOString();
    trackEvent("session_started", {
      sessionStartedAt: sessionStartedAtRef.current,
    });
  }, [trackEvent]);

  const addCurrentPlaySegment = useCallback(() => {
    if (!playStartedAtRef.current) {
      return;
    }

    totalPlayedSecondsRef.current +=
      (Date.now() - playStartedAtRef.current) / 1000;
    playStartedAtRef.current = null;
  }, []);

  const endSession = useCallback(
    (reason) => {
      if (!sessionStartedAtRef.current || sessionEndedRef.current) {
        return;
      }

      addCurrentPlaySegment();
      sessionEndedRef.current = true;
      trackEvent("session_ended", {
        reason,
        sessionStartedAt: sessionStartedAtRef.current,
        sessionEndedAt: new Date().toISOString(),
      });
    },
    [addCurrentPlaySegment, trackEvent]
  );

  const resetPlayer = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    syncRemainingTime();
    setIsPlaying(false);
  }, [syncRemainingTime]);

  useEffect(() => {
    sessionIdRef.current = createSessionId();
    sessionStartedAtRef.current = null;
    playStartedAtRef.current = null;
    totalPlayedSecondsRef.current = 0;
    hasPlayedRef.current = false;
    sessionEndedRef.current = false;
    setIsPlaying(false);
    setRemainingTime(null);
  }, [soundscapeId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !soundscape?.audioUrl) {
      return;
    }

    const updateRemainingTime = () => {
      setRemainingTime(getRemainingSeconds(audio));
    };

    const events = [
      "loadedmetadata",
      "durationchange",
      "loadeddata",
      "canplay",
      "timeupdate",
    ];

    events.forEach((eventName) => {
      audio.addEventListener(eventName, updateRemainingTime);
    });

    audio.load();
    updateRemainingTime();

    let cancelled = false;

    probeAudioDuration(audio).then(() => {
      if (!cancelled) {
        updateRemainingTime();
      }
    });

    return () => {
      cancelled = true;
      events.forEach((eventName) => {
        audio.removeEventListener(eventName, updateRemainingTime);
      });
    };
  }, [soundscape?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.play().then(() => {
        syncRemainingTime();
      }).catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, syncRemainingTime]);

  useEffect(() => {
    return () => {
      endSession("left_player");
    };
  }, [endSession]);

  function onToggle() {
    if (isPlaying) {
      addCurrentPlaySegment();
      trackEvent("pause");
      setIsPlaying(false);
      return;
    }

    ensureSessionStarted();
    playStartedAtRef.current = Date.now();
    trackEvent(hasPlayedRef.current ? "resume" : "play");
    hasPlayedRef.current = true;
    setIsPlaying(true);
  }

  function onAudioEnded() {
    addCurrentPlaySegment();
    trackEvent("timer_complete");
    trackEvent("ended");
    endSession("audio_ended");
    resetPlayer();
  }

  if (!soundscape) {
    return <p className="error">Selected soundscape could not be found.</p>;
  }

  return (
    <div onClick={onToggle} className="soundPlayer">
      <div className="texts">
        <p>{isPlaying ? "Playing" : "Paused"}</p>
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
        onEnded={onAudioEnded}
      />
    </div>
  );
}
