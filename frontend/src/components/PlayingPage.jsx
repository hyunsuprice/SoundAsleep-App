import React, {useState, useEffect} from "react";
import "../App.css";
import SoundPlayer from "./SoundPlayer"

const quotes = [
  "Adjust the volume to your comfort level",
  "Enjoy the sound",
  "Sweet dreams",
];

export default function PlayingPage({sound}){
  const [currentQuote, setCurrentQuote] = useState(0);

    useEffect(() => {
      const quoteInterval = setInterval(() => {
        setCurrentQuote((prevQuote) => (prevQuote + 1) % quotes.length);
      }, 5000);

      return () => clearInterval(quoteInterval);
    }, []);

    return (
      <>
        <div className="quotes">
          {quotes.map((quote, index) => (
            <h2
              key={index}
              className={index === currentQuote ? "quote-active" : ""}
            >
              {quote}
            </h2>
          ))}
        </div>
        <SoundPlayer selectedsound={sound} />
      </>
    );
}
