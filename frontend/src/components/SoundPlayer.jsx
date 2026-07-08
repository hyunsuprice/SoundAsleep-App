import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlayCircle, faPauseCircle } from "@fortawesome/free-solid-svg-icons";
import { useSoundPlayer } from "../hooks/useSoundPlayer.js";

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

export default function SoundPlayer({ participantId, soundscapeId }) {
  const { soundscape, isPlaying, remainingTime, audioRef, onToggle, onAudioEnded } =
    useSoundPlayer(participantId, soundscapeId);

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
        playsInline
        onEnded={onAudioEnded}
      />
    </div>
  );
}
