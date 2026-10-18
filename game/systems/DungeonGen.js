// Builds a random floor: a tree of rooms on a small grid.
// Room types: start (empty), normal (2 waves), treasure (item pedestal, locked with a key),
// shop (worm shopkeeper), boss.

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const GRID_W = 7;
export const GRID_H = 5;

const START = { x: 3, y: 2 };
const ROOM_COUNT = { min: 8, max: 12 };
const MIN_BOSS_DISTANCE = 3;
const MAX_ATTEMPTS = 200;
const WAVES_PER_ROOM = 2;
const MAX_WAVE_SIZE = 6;

const key = (x, y) => `${x},${y}`;

export class Dungeon {
  constructor(rooms, start, floor, floorIndex) {
    this.rooms = rooms;
    this.start = start;
    this.floor = floor; // entry from data/floors.json
    this.floorIndex = floorIndex;
    this.byKey = new Map(rooms.map((room) => [key(room.x, room.y), room]));
    this.combatRoomCount = rooms.filter((room) => room.waves.length > 0).length;
  }

  neighbor(room, dir) {
    return this.byKey.get(key(room.x + DIRS[dir].x, room.y + DIRS[dir].y));
  }

  neighbors(room) {
    return Object.keys(DIRS)
      .filter((dir) => room.doors[dir])
      .map((dir) => this.neighbor(room, dir));
  }
}

// Deeper floors (floorIndex 0-3) have one more room and bigger waves.
export function generateDungeon(rng, floor, floorIndex) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const dungeon = tryGenerate(rng, floor, floorIndex);
    if (dungeon) return dungeon;
  }
  throw new Error('Could not generate a dungeon');
}

function tryGenerate(rng, floor, floorIndex) {
  const target = rng.int(ROOM_COUNT.min + floorIndex, ROOM_COUNT.max + floorIndex);
  const cells = new Map([[key(START.x, START.y), { ...START }]]);
  const neighborCount = (x, y) => Object.values(DIRS).filter((d) => cells.has(key(x + d.x, y + d.y))).length;

  // Grow from random existing rooms. A new room may touch only its parent,
  // so the layout is a tree with no loops or 2x2 clumps.
  for (let tries = 0; cells.size < target && tries < 1000; tries++) {
    const from = rng.pick([...cells.values()]);
    const dir = rng.pick(Object.values(DIRS));
    const x = from.x + dir.x;
    const y = from.y + dir.y;
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) continue;
    if (cells.has(key(x, y)) || neighborCount(x, y) > 1) continue;
    cells.set(key(x, y), { x, y });
  }
  if (cells.size < target) return null;

  const distance = distancesFrom(START, cells);
  const deadEnds = [...cells.values()]
    .filter((c) => !(c.x === START.x && c.y === START.y) && neighborCount(c.x, c.y) === 1)
    .sort((a, b) => distance.get(key(b.x, b.y)) - distance.get(key(a.x, a.y)));
  if (deadEnds.length < 3) return null;

  const boss = deadEnds[0];
  if (distance.get(key(boss.x, boss.y)) < MIN_BOSS_DISTANCE) return null;
  const others = deadEnds.slice(1);
  const treasure = others.splice(Math.floor(rng.next() * others.length), 1)[0];
  const shop = rng.pick(others);

  const rooms = [...cells.values()].map((c) => {
    const dist = distance.get(key(c.x, c.y));
    let type = 'normal';
    if (c.x === START.x && c.y === START.y) type = 'start';
    else if (c === boss) type = 'boss';
    else if (c === treasure) type = 'treasure';
    else if (c === shop) type = 'shop';

    let waves = [];
    if (type === 'normal') waves = normalWaves(rng, floor.enemies, dist + floorIndex);
    if (type === 'boss') waves = bossWaves(rng, floor, floorIndex);

    const doors = {};
    for (const [dir, d] of Object.entries(DIRS)) doors[dir] = cells.has(key(c.x + d.x, c.y + d.y));

    return {
      x: c.x,
      y: c.y,
      type,
      dist,
      doors,
      waves, // list of waves; each wave is a list of enemy type keys
      seed: rng.int(0, 2 ** 31 - 1), // decides this room's look
      cleared: waves.length === 0,
      visited: false,
      locked: type === 'treasure', // its door needs a key
      pickups: [], // { kind, x, y } left on the floor
      contents: null, // treasure item / shop wares, filled in on first visit
    };
  });

  return new Dungeon(rooms, rooms.find((room) => room.type === 'start'), floor, floorIndex);
}

// Rooms further from the start (and on deeper floors) get bigger waves; the second wave is one bigger.
// `weights` is the floor's enemy mix, e.g. { "gloom_slug": 4, "grumpshroom": 1 }.
function normalWaves(rng, weights, difficulty) {
  const first = Math.min(2 + Math.floor(difficulty / 2), MAX_WAVE_SIZE - 1);
  return Array.from({ length: WAVES_PER_ROOM }, (_, i) =>
    Array.from({ length: first + i }, () => rng.weighted(weights)),
  );
}

// Wave 1: the floor's regular enemies. Wave 2: the boss (the Weed Queen summons her own help).
function bossWaves(rng, floor, floorIndex) {
  const minions = (n) => Array.from({ length: n }, () => rng.weighted(floor.enemies));
  const helpers = floor.boss === 'weed_queen' ? 0 : 2;
  return [minions(3 + floorIndex), [floor.boss, ...minions(helpers)]];
}

function distancesFrom(start, cells) {
  const distance = new Map([[key(start.x, start.y), 0]]);
  const queue = [start];
  while (queue.length) {
    const cell = queue.shift();
    for (const d of Object.values(DIRS)) {
      const next = key(cell.x + d.x, cell.y + d.y);
      if (!cells.has(next) || distance.has(next)) continue;
      distance.set(next, distance.get(key(cell.x, cell.y)) + 1);
      queue.push(cells.get(next));
    }
  }
  return distance;
}
