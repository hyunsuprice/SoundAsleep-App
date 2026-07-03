import { useState } from "react";
import "./App.css";
import CodeField from "./components/CodeField.jsx";
import SoundSelector from "./components/SoundSelector.jsx";
import PlayingPage from "./components/PlayingPage.jsx";

function App() {
  const [screen, setScreen] = useState("enter-id");
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [selectedSound, setSelectedSound] = useState(null);

  const handleChange = (key, value) => {
    if (key === "selectedSound") {
      setSelectedSound(value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (screen === "enter-id") {
      handleNext();
      return;
    }

    if (!selectedSound) {
      setError(true);
      return;
    }

    setScreen("listen");
    setError(false);
  };

  const handleNext = () => {
    if (code.trim() === "") {
      setError(true);
    } else {
      setScreen("select-sound");
      setError(false);
    }
  };

  const handleBack = () => {
    if (screen === "select-sound") {
      setScreen("enter-id");
      setError(false);
    }
  };

  return (
    <div className="App">
      <div className="container mt-5">
        <form onSubmit={handleSubmit}>
          {screen === "enter-id" && (
            <>
              {error && <p className="error">Please Enter a code</p>}
              <CodeField code={code} setCode={setCode} />
            </>
          )}

          {screen === "select-sound" && (
            <div>
              {error && (
                <p className="error">Please select a sound before submitting</p>
              )}

              <SoundSelector handleChange={handleChange} />
            </div>
          )}

          {screen === "listen" && (
            <div>
              <PlayingPage sound={selectedSound} />
              <button
                className="btn-change"
                type="button"
                onClick={() => setScreen("select-sound")}
              >
                Change Sound
              </button>
            </div>
          )}
          {screen !== "listen" && (
            <div className="btn-container">
              {screen === "select-sound" && (
                <button className="btn-back" type="button" onClick={handleBack}>
                  Back
                </button>
              )}
              {screen === "enter-id" && (
                <button className="btn-next" type="button" onClick={handleNext}>
                  Next
                </button>
              )}
              {screen === "select-sound" && (
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
