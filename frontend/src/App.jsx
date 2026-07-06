import { useState } from "react";
import "./App.css";
import CodeField from "./components/CodeField.jsx";
import SoundSelector from "./components/SoundSelector.jsx";
import PlayingPage from "./components/PlayingPage.jsx";

const SCREENS = {
  ENTER_ID: "enter-id",
  SELECT_SOUND: "select-sound",
  LISTEN: "listen",
};

function App() {
  const [screen, setScreen] = useState(SCREENS.ENTER_ID);
  const [participantId, setParticipantId] = useState("");
  const [selectedSoundscapeId, setSelectedSoundscapeId] = useState(null);
  const [error, setError] = useState("");

  const goToEnterId = () => {
    setScreen(SCREENS.ENTER_ID);
    setError("");
  };

  const goToSelectSound = () => {
    if (!participantId.trim()) {
      setError("Please enter a code");
      return;
    }

    setSelectedSoundscapeId(null);
    setScreen(SCREENS.SELECT_SOUND);
    setError("");
  };

  const goToListen = () => {
    if (!selectedSoundscapeId) {
      setError("Please select a sound before continuing");
      return;
    }

    setScreen(SCREENS.LISTEN);
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (screen === SCREENS.SELECT_SOUND) {
      goToListen();
    }
  };

  return (
    <div className="App">
      <div className="container">
        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}

          {screen === SCREENS.ENTER_ID && (
            <CodeField
              code={participantId}
              onCodeChange={setParticipantId}
            />
          )}

          {screen === SCREENS.SELECT_SOUND && (
            <SoundSelector
              participantId={participantId.trim()}
              onSelectSoundscape={setSelectedSoundscapeId}
            />
          )}

          {screen === SCREENS.LISTEN && (
            <div>
              <PlayingPage
                participantId={participantId.trim()}
                soundscapeId={selectedSoundscapeId}
              />
              <button
                className="btn-change"
                type="button"
                onClick={() => setScreen(SCREENS.SELECT_SOUND)}
              >
                Change Sound
              </button>
            </div>
          )}

          {screen !== SCREENS.LISTEN && (
            <div className="btn-container">
              {screen === SCREENS.SELECT_SOUND && (
                <button
                  className="btn-back"
                  type="button"
                  onClick={goToEnterId}
                >
                  Back
                </button>
              )}

              {screen === SCREENS.ENTER_ID && (
                <button
                  className="btn-next"
                  type="button"
                  onClick={goToSelectSound}
                >
                  Next
                </button>
              )}

              {screen === SCREENS.SELECT_SOUND && (
                <button className="btn-next" type="submit">
                  Continue
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;
