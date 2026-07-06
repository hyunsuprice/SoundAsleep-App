import axios from "axios";

const url =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000"
    : "https://soundasleep-app.onrender.com");

export default async function postData(collection, formData) {
  try {
    const response = await axios.post(`${url}/${collection}/posts`, formData);
    console.log("Successfully posted:", response.data);
  } catch (error) {
    console.error("Error posting data:", error.message);
  }
}

export async function postPlaybackEvent(event) {
  try {
    const response = await axios.post(`${url}/playback-events`, event);
    console.log("Successfully saved playback event:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error saving playback event:", error.message);
    return null;
  }
}
