import React, { useCallback, useState, useRef, useEffect } from "react";
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

export default function SoundPlayer({ participantId, soundscapeId }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(10); // For testing, use a shorter time
  const audioRef = useRef(null);
  const sessionIdRef = useRef(createSessionId());
  const sessionStartedAtRef = useRef(null);
  const playStartedAtRef = useRef(null);
  const totalPlayedSecondsRef = useRef(0);
  const hasPlayedRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const soundscape = getSoundscapeById(soundscapeId);

  // Function to format the time to hh:mm:ss
  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  }

  const getAudioTimeSeconds = useCallback(function getAudioTimeSeconds() {
    return Number((audioRef.current?.currentTime || 0).toFixed(2));
  }, []);

  const getTotalPlayedSeconds = useCallback(function getTotalPlayedSeconds() {
    let totalPlayedSeconds = totalPlayedSecondsRef.current;

    if (playStartedAtRef.current) {
      totalPlayedSeconds += (Date.now() - playStartedAtRef.current) / 1000;
    }

    return Number(totalPlayedSeconds.toFixed(2));
  }, []);

  const trackEvent = useCallback(function trackEvent(eventType, extraData = {}) {
    const event = {
      sessionId: sessionIdRef.current,
      participantId,
      soundscapeId,
      eventType,
      audioTimeSeconds: getAudioTimeSeconds(),
      totalPlayedSeconds: getTotalPlayedSeconds(),
      timestamp: new Date().toISOString(),
      ...extraData,
    };

    console.log("Playback event:", event);
    postPlaybackEvent(event);
  }, [getAudioTimeSeconds, getTotalPlayedSeconds, participantId, soundscapeId]);

  const ensureSessionStarted = useCallback(function ensureSessionStarted() {
    if (sessionStartedAtRef.current) {
      return;
    }

    sessionStartedAtRef.current = new Date().toISOString();
    trackEvent("session_started", {
      sessionStartedAt: sessionStartedAtRef.current,
    });
  }, [trackEvent]);

  const addCurrentPlaySegment = useCallback(function addCurrentPlaySegment() {
    if (!playStartedAtRef.current) {
      return;
    }

    totalPlayedSecondsRef.current +=
      (Date.now() - playStartedAtRef.current) / 1000;
    playStartedAtRef.current = null;
  }, []);

  const endSession = useCallback(function endSession(reason) {
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
  }, [addCurrentPlaySegment, trackEvent]);

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
    if (isPlaying) {
      const interval = setInterval(() => {
        setRemainingTime((prevTime) => {
          if (prevTime > 0) {
            return prevTime - 1; // Decrease by 1 second
          } else {
            clearInterval(interval); // Stop the countdown when it reaches 0
            if (audioRef.current) {
              audioRef.current.pause(); // Pause the audio
            }
            addCurrentPlaySegment();
            trackEvent("timer_complete");
            endSession("timer_complete");
            if (audioRef.current) {
              audioRef.current.currentTime = 0; // Reset audio to the beginning
            }
            setRemainingTime(10)
            setIsPlaying(false)
            return 0;
          }
        });
      }, 1000); // Update every second

      // Cleanup the interval on component unmount or pause
      return () => clearInterval(interval);
    }
  }, [addCurrentPlaySegment, endSession, isPlaying, trackEvent]);

  // Set the audio to loop, but remove loop when the countdown reaches 0
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = true; // This makes the audio loop automatically
    }
  }, []);

  useEffect(() => {
    return () => {
      endSession("left_player");
    };
  }, [endSession]);

  // Toggle play/pause
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

  // Stop the countdown when the audio finishes
  const onAudioEnded = () => {
    addCurrentPlaySegment();
    trackEvent("ended");
    endSession("audio_ended");
    setIsPlaying(false);
    setRemainingTime(7200); // Reset time to 2 hours when the audio finishes
  };

  if (!soundscape) {
    return <p className="error">Selected soundscape could not be found.</p>;
  }

  return (
    <div onClick={onToggle} className="soundPlayer">
      <div className="texts">
        <p>{isPlaying ? "Playing" : "Paused"}</p>
        <h3>{soundscape.title}</h3>
        <p>{formatTime(remainingTime)}</p> {/* Display remaining time */}
      </div>
      <FontAwesomeIcon
        size="3x"
        className="icon"
        icon={isPlaying ? faPauseCircle : faPlayCircle}
      />
      <audio
        ref={audioRef}
        src={soundscape.audioUrl}
        onEnded={onAudioEnded} // Handle when audio ends
      />
    </div>
  );
}
