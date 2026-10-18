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
  bestWave() {
    return load().bestWave ?? 0;
  },

  // Returns true when this is a new best.
  recordWave(wave) {
    const data = load();
    if (wave <= (data.bestWave ?? 0)) return false;
    data.bestWave = wave;
    write(data);
    return true;
  },
};
