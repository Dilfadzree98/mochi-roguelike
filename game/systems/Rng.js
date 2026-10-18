// Seeded random numbers (mulberry32). All run randomness goes through an Rng
// so the same seed always rebuilds the same run. Don't use Math.random() in gameplay.
export class Rng {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  // Float in [0, 1).
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Whole number from min to max, both included.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  // A shuffled copy of the list.
  shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  chance(probability) {
    return this.next() < probability;
  }

  // Picks a key from { key: weight, ... }.
  weighted(weights) {
    const entries = Object.entries(weights);
    let roll = this.next() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return entries[0][0];
  }
}

export function newSeed() {
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

// ?seed=12345 in the URL replays a specific run.
export function seedFromUrl() {
  const value = Number.parseInt(new URLSearchParams(location.search).get('seed'), 10);
  return Number.isFinite(value) ? value >>> 0 : null;
}
