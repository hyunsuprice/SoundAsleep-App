import React, { useState } from "react";
import "../App.css";
import { sounds as initialSounds } from "../variables.js";
import SoundCard from "./SoundCard.jsx";

export default function SoundSelector({ handleChange }) {
  const [availableSounds, setAvailableSounds] = useState(initialSounds);

  function handleToggle(targetSound) {
    const updatedSounds = availableSounds.map((sound) =>
      sound.id === targetSound.id
        ? { ...sound, isPlaying: !sound.isPlaying }
        : { ...sound, isPlaying: false }
    );
    setAvailableSounds(updatedSounds);
    handleChange("selectedSound", targetSound.title);
  }

  return (
    <div className="step-container">
      <h4>Choose your soundscape:</h4>

      {availableSounds.map((sound) => (
        <SoundCard
          key={sound.id}
          sound={sound}
          onToggle={() => handleToggle(sound)}
        />
      ))}
    </div>
  );
}
