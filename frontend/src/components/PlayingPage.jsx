import { useState, useEffect } from "react";
import "../App.css";
import SoundPlayer from "./SoundPlayer.jsx";

const QUOTES = [
  "Adjust the volume to your comfort level",
  "Enjoy the sound",
  "Sweet dreams",
];

export default function PlayingPage({ participantId, soundscapeId }) {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setCurrentQuoteIndex((index) => (index + 1) % QUOTES.length);
    }, 5000);

    return () => clearInterval(quoteInterval);
  }, []);

  return (
    <>
      <div className="quotes">
        {QUOTES.map((quote, index) => (
          <h2
            key={quote}
            className={index === currentQuoteIndex ? "quote-active" : ""}
          >
            {quote}
          </h2>
        ))}
      </div>
      <SoundPlayer
        participantId={participantId}
        soundscapeId={soundscapeId}
      />
    </>
  );
}
