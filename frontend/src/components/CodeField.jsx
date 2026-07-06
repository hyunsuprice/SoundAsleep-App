import "../App.css";

export default function CodeField({ code, onCodeChange }) {
  return (
    <div className="step-container">
      <label htmlFor="participant-code">
        Enter your code: (You received the code in the first email)
      </label>
      <input
        type="text"
        className="input-code"
        id="participant-code"
        name="participant-code"
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        autoComplete="off"
        placeholder="Enter your code..."
      />
    </div>
  );
}
