const KEY = 'mochi-roguelike-save';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked (private mode); the game still works without saving.
  }
}

export const Save = {
  bestRooms() {
    return load().bestRooms ?? 0;
  },

  wins() {
    return load().wins ?? 0;
  },

  // Returns true when roomsCleared is a new best.
  recordRun(roomsCleared, won) {
    const data = load();
    const newBest = roomsCleared > (data.bestRooms ?? 0);
    if (newBest) data.bestRooms = roomsCleared;
    if (won) data.wins = (data.wins ?? 0) + 1;
    write(data);
    return newBest;
  },
};
