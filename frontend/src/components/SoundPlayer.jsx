import { useCallback, useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlayCircle, faPauseCircle } from "@fortawesome/free-solid-svg-icons";
import { postPlaybackEvent } from "../../api.js";
import {
  getSoundscapeById,
  SESSION_DURATION_SECONDS,
} from "../variables.js";

function createSessionId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
}

export default function SoundPlayer({ participantId, soundscapeId }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(SESSION_DURATION_SECONDS);
  const audioRef = useRef(null);
  const sessionIdRef = useRef(createSessionId());
  const sessionStartedAtRef = useRef(null);
  const playStartedAtRef = useRef(null);
  const totalPlayedSecondsRef = useRef(0);
  const hasPlayedRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const soundscape = getSoundscapeById(soundscapeId);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setRemainingTime(SESSION_DURATION_SECONDS);
    setIsPlaying(false);
  }, []);

  const handleTimerComplete = useCallback(() => {
    addCurrentPlaySegment();
    trackEvent("timer_complete");
    endSession("timer_complete");
    resetPlayer();
  }, [addCurrentPlaySegment, endSession, resetPlayer, trackEvent]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      setRemainingTime((prevTime) => {
        if (prevTime > 1) {
          return prevTime - 1;
        }

        clearInterval(interval);
        handleTimerComplete();
        return 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [handleTimerComplete, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = true;
    }
  }, []);

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
        ref={audioRef}
        src={soundscape.audioUrl}
        onEnded={onAudioEnded}
      />
    </div>
  );
}
