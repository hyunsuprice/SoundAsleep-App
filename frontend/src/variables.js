export const SESSION_DURATION_SECONDS = 7200;

export const soundscapeLibrary = [
  {
    id: "rain",
    title: "Rain Soundscape",
    imageUrl: "/rain_umbrella.jpg",
    audioUrl: "/rain sound.mp3",
  },
  {
    id: "underwater",
    title: "Underwater Soundscape",
    imageUrl: "/underwater.jpg",
    audioUrl: "/underwater.mp3",
  },
  {
    id: "singing-bowls",
    title: "Singing Bowls Soundscape",
    imageUrl: "/singingBowls.jpeg",
    audioUrl: "/singing bowls.mp3",
  },
  {
    id: "birds",
    title: "Birds Soundscape",
    imageUrl: "/birds.jpg",
    audioUrl: "/birds.mp3",
  },
  {
    id: "crickets",
    title: "Crickets Soundscape",
    imageUrl: "/crickets.jpg",
    audioUrl: "/crickets.mp3",
  },
];

const participantSoundscapeAssignments = {
  "001": ["rain", "underwater"],
  "002": ["singing-bowls", "birds"],
  "003": ["crickets"],
};

export function getSoundscapeById(soundscapeId) {
  return soundscapeLibrary.find((soundscape) => soundscape.id === soundscapeId);
}

export function getSoundscapesForParticipant(participantId) {
  const normalizedParticipantId = participantId.trim().toLowerCase();
  const assignedSoundscapeIds =
    participantSoundscapeAssignments[normalizedParticipantId] || [];

  return assignedSoundscapeIds
    .map((soundscapeId) => getSoundscapeById(soundscapeId))
    .filter(Boolean)
    .map((soundscape) => ({
      ...soundscape,
      isPlaying: false,
    }));
}
