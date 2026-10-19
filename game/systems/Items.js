// Items are lists of small stat modifiers from data/items.json. Stats are always
// rebuilt from the base stats plus every held item, in pickup order, so items
// stack without knowing about each other.
//
// A modifier is one of: { "add": n }, { "mul": n } or { "set": value }.

const LIMITS = {
  maxHp: { min: 2 },
  luck: { min: -3 },
  range: { min: 80 },
  shotSpeed: { min: 120, max: 600 },
  fireDelay: { min: 110 },
  speed: { min: 80, max: 260 },
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

// A fresh pool per run; each item can appear once.
export function makeItemPool(itemDefs) {
  return Object.keys(itemDefs);
}

// How likely each tier is: 1 = weak or with a downside ... 4 = best.
export const TIER_WEIGHTS = {
  normal: { 1: 30, 2: 35, 3: 25, 4: 10 }, // treasure rooms and the shop
  boss: { 1: 0, 2: 20, 3: 50, 4: 30 },    // the item a boss leaves
};

// Takes a random item out of the pool: first a tier (by `weights`), then an item of that tier.
// If that tier has run out it falls back to any item left.
export function drawItem(rng, pool, itemDefs, weights = TIER_WEIGHTS.normal) {
  if (pool.length === 0) return null;
  const available = {};
  for (const [tier, weight] of Object.entries(weights)) {
    if (weight > 0 && pool.some((id) => String(itemDefs[id].tier) === tier)) available[tier] = weight;
  }
  const tier = Object.keys(available).length ? rng.weighted(available) : null;
  const choices = tier ? pool.filter((id) => String(itemDefs[id].tier) === tier) : pool;
  const id = rng.pick(choices);
  pool.splice(pool.indexOf(id), 1);
  return id;
}
