export const soundscapes = [
  {
    id: "001-rain",
    participantId: "001",
    title: "Rain Soundscape",
    imageUrl: "./rain_umbrella.jpg",
    audioUrl: "./rain sound.mp3",
    isPlaying: false,
  },
  {
    id: "001-underwater",
    participantId: "001",
    title: "Underwater Soundscape",
    imageUrl: "/underwater.jpg",
    audioUrl: "./underwater.mp3",
    isPlaying: false,
  },
  {
    id: "002-bowls",
    participantId: "002",
    title: "Singing Bowls Soundscape",
    imageUrl: "/singingBowls.jpeg",
    audioUrl: "./singing bowls.mp3",
    isPlaying: false,
  },
  {
    id: "002-birds",
    participantId: "002",
    title: "Birds Soundscape",
    imageUrl: "/birds.jpg",
    audioUrl: "./birds.mp3",
    isPlaying: false,
  },
  {
    id: "demo-crickets",
    participantId: "demo",
    title: "Crickets Soundscape",
    imageUrl: "/crickets.jpg",
    audioUrl: "./crickets.mp3",
    isPlaying: false,
  },
];

export function getSoundscapesForParticipant(participantId) {
  const normalizedParticipantId = participantId.trim().toLowerCase();

  return soundscapes.filter(
    (soundscape) =>
      soundscape.participantId.toLowerCase() === normalizedParticipantId
  );
}

export function getSoundscapeById(soundscapeId) {
  return soundscapes.find((soundscape) => soundscape.id === soundscapeId);
}
