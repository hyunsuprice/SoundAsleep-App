import { useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlayCircle, faPauseCircle } from "@fortawesome/free-solid-svg-icons";

export default function SoundCard({ sound, onToggle }) {
  const audioRef = useRef(null);
  const styling = sound.isPlaying
    ? "sound-container playing"
    : "sound-container";

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (sound.isPlaying) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [sound.isPlaying]);

  return (
    <div className={styling} onClick={onToggle}>
      <img src={sound.imageUrl} className="sound-img" alt={sound.title} />
      <div>
        <h5 className="sound-title">{sound.title}</h5>
        <audio ref={audioRef} src={sound.audioUrl} />
      </div>
      <FontAwesomeIcon
        size="4x"
        className="card-icon"
        icon={sound.isPlaying ? faPauseCircle : faPlayCircle}
      />
    </div>
  );
}
