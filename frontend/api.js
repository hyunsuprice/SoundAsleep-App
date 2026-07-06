import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://soundasleep-app.onrender.com");

export async function postPlaybackEvent(event) {
  try {
    const response = await axios.post(`${API_URL}/playback-events`, event);
    return response.data;
  } catch (error) {
    console.error("Error saving playback event:", {
      apiUrl: `${API_URL}/playback-events`,
      message: error.message,
      status: error.response?.status,
      response: error.response?.data,
    });
    return null;
  }
}
