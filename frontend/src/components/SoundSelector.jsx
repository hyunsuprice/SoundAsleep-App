import React, { useEffect, useState } from "react";
import "../App.css";
import { getSoundscapesForParticipant } from "../variables.js";
import SoundCard from "./SoundCard.jsx";

export default function SoundSelector({ participantId, handleChange }) {
  const [availableSoundscapes, setAvailableSoundscapes] = useState(() =>
    getSoundscapesForParticipant(participantId)
  );

  useEffect(() => {
    setAvailableSoundscapes(getSoundscapesForParticipant(participantId));
  }, [participantId]);

  function handleToggle(targetSound) {
    const updatedSounds = availableSoundscapes.map((sound) =>
      sound.id === targetSound.id
        ? { ...sound, isPlaying: !sound.isPlaying }
        : { ...sound, isPlaying: false }
    );
    setAvailableSoundscapes(updatedSounds);
    handleChange("selectedSoundscapeId", targetSound.id);
  }

  return (
    <div className="step-container">
      <h4>Choose your soundscape:</h4>

      {availableSoundscapes.length === 0 && (
        <p className="error">No soundscapes found for this participant ID.</p>
      )}

      {availableSoundscapes.map((sound) => (
        <SoundCard
          key={sound.id}
          sound={sound}
          onToggle={() => handleToggle(sound)}
        />
      ))}
    </div>
  );
}
