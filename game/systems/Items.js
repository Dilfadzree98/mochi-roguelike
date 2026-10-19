// Items are lists of small stat modifiers from data/items.json. Stats are always
// rebuilt from the base stats plus every held item, in pickup order, so items
// stack without knowing about each other.
//
// A modifier is one of: { "add": n }, { "mul": n } or { "set": value }.

const LIMITS = {
  fireDelay: { min: 110 },
  speed: { min: 80, max: 260 },
  shotSpeed: { max: 600 },
  multishot: { max: 4 },
  shotScale: { max: 2.5 },
  homing: { max: 8 },
  spread: { max: 6 },
  backShot: { max: 3 },
  explode: { max: 80 },
  chain: { max: 4 },
  knockback: { max: 7 },
  crit: { max: 0.75 },
};

export function computeStats(base, items) {
  const stats = structuredClone(base);
  for (const item of items) {
    for (const [stat, change] of Object.entries(item.modifiers ?? {})) {
      if ('add' in change) stats[stat] = (stats[stat] ?? 0) + change.add;
      if ('mul' in change) stats[stat] = (stats[stat] ?? 0) * change.mul;
      if ('set' in change) stats[stat] = structuredClone(change.set);
    }
  }
  for (const [stat, { min = -Infinity, max = Infinity }] of Object.entries(LIMITS)) {
    stats[stat] = Math.min(max, Math.max(min, stats[stat]));
  }
  return stats;
}

// A fresh shuffled pool per run; each item can appear once.
export function makeItemPool(rng, itemDefs) {
  const pool = Object.keys(itemDefs);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}
