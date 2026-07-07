export const soundscapeLibrary = [
  {
    id: "alex_01",
    title: "Alex Emil Soundscape",
    imageUrl: "/rain_umbrella.jpg",
    audioUrl: "/alex_emil.mp3",
  },
  {
    id: "alex_02",
    title: "Alex Hyun Su Soundscape",
    imageUrl: "/underwater.jpg",
    audioUrl: "/alex_hyunsu.mp3",
  },
  {
    id: "anya_01",
    title: "Anya Hyun Su Soundscape",
    imageUrl: "/singingBowls.jpeg",
    audioUrl: "/anya_hyunsu.mp3",
  },
  {
    id: "raphael_01",
    title: "Raphael Emil Soundscape",
    imageUrl: "/birds.jpg",
    audioUrl: "/raphael_emil.mp3",
  },
];

const participantSoundscapeAssignments = {
  "001": ["alex_01", "alex_02"],
  "002": ["anya_01"],
  "003": ["raphael_01"],
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
