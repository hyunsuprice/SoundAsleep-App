import { useEffect, useState } from "react";
import "../App.css";
import { getSoundscapesForParticipant } from "../variables.js";
import SoundCard from "./SoundCard.jsx";

export default function SoundSelector({ participantId, onSelectSoundscape }) {
  const [availableSoundscapes, setAvailableSoundscapes] = useState(() =>
    getSoundscapesForParticipant(participantId)
  );

  useEffect(() => {
    setAvailableSoundscapes(getSoundscapesForParticipant(participantId));
  }, [participantId]);

  function handleToggle(targetSound) {
    setAvailableSoundscapes((currentSounds) =>
      currentSounds.map((sound) =>
        sound.id === targetSound.id
          ? { ...sound, isPlaying: !sound.isPlaying }
          : { ...sound, isPlaying: false }
      )
    );
    onSelectSoundscape(targetSound.id);
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
