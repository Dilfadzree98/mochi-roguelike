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
  best() {
    const data = load();
    return { floor: data.bestFloor ?? 0, rooms: data.bestRooms ?? 0, wins: data.wins ?? 0 };
  },

  // Returns true when this run went deeper (or cleared more rooms on the same floor) than ever before.
  recordRun({ roomsCleared, floor, won }) {
    const data = load();
    const bestFloor = data.bestFloor ?? 0;
    const bestRooms = data.bestRooms ?? 0;
    const newBest = floor > bestFloor || (floor === bestFloor && roomsCleared > bestRooms);
    if (newBest) {
      data.bestFloor = floor;
      data.bestRooms = roomsCleared;
    }
    if (won) data.wins = (data.wins ?? 0) + 1;
    write(data);
    return newBest;
  },
};
