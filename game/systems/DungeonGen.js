// Builds a random floor: a tree of rooms on a small grid.
// Room types: start (empty), normal (2 waves), treasure (item pedestal, locked with a key),
// shop (worm shopkeeper), boss (one boss fight, no waves).

import { ROOM_SIZES } from '../constants.js';
import { makeLayout } from './Pathing.js';

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

// Wave rules: 1-6 enemies made of 1, 2 or 3 different types.
const WAVE_SIZE = { min: 1, max: 6 };
const TYPES_PER_WAVE = { 1: 5, 2: 4, 3: 2 }; // weights: one type is most common
const EMPTY_ROOM_CHANCE = 0.2;              // fight rooms with no obstacles
const EMPTY_BOSS_ROOM_CHANCE = 0.25;        // boss rooms with no obstacles
const ROOM_TYPES = { min: 2, max: 4 };      // enemy types a fight room picks from

// Some fight rooms are bigger than the screen, with bigger waves.
const BIG_ROOM_CHANCE = 0.35;
const BIG_ROOM_WEIGHTS = { wide: 4, tall: 3, big: 2 };
const WAVE_BONUS = { normal: { min: 0, max: 6 }, wide: { min: 1, max: 8 }, tall: { min: 1, max: 8 }, big: { min: 2, max: 9 } };

const key = (x, y) => `${x},${y}`;

export class Dungeon {
  constructor(rooms, start, floor, floorIndex, pool) {
    this.rooms = rooms;
    this.start = start;
    this.floor = floor; // entry from data/floors.json
    this.floorIndex = floorIndex;
    this.pool = pool; // { enemyType: weight }: every enemy that can appear on this floor
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
// `bossId` is the boss waiting in the boss room; any boss can turn up on any floor.
export function generateDungeon(rng, floor, floorIndex, enemyDefs, bossId = pickBoss(rng, enemyDefs)) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const dungeon = tryGenerate(rng, floor, floorIndex, enemyDefs, bossId);
    if (dungeon) return dungeon;
  }
  throw new Error('Could not generate a dungeon');
}

export function bossIds(enemyDefs) {
  return Object.keys(enemyDefs).filter((id) => enemyDefs[id].boss);
}

// Every enemy has a `difficulty` (1-4). Floor N may use difficulties N-2 to N, weighted toward
// N, so deeper floors get harder enemies and leave the easiest behind. Returns { type: weight }.
export function floorPool(floorIndex, enemyDefs) {
  const level = floorIndex + 1;
  const closeness = { 0: 3, 1: 2, 2: 1 }; // weight multiplier by how far below the floor's level
  const pool = {};
  for (const [id, def] of Object.entries(enemyDefs)) {
    const gap = level - (def.difficulty ?? 1);
    if (!def.boss && gap >= 0 && gap <= 2) pool[id] = (def.weight ?? 1) * closeness[gap];
  }
  return pool;
}

// The enemy types for one fight room: a random handful from the floor's pool, always with at
// least one of the floor's own difficulty. Every room picks its own, so rooms differ from each other.
export function pickRoomTypes(rng, pool, floorIndex, enemyDefs) {
  const remaining = { ...pool };
  const types = {};
  const take = (from) => {
    const id = rng.weighted(from);
    types[id] = remaining[id];
    delete remaining[id];
  };
  const top = Object.fromEntries(Object.entries(remaining).filter(([id]) => (enemyDefs[id].difficulty ?? 1) === floorIndex + 1));
  if (Object.keys(top).length) take(top);
  const count = Math.min(Object.keys(pool).length, rng.int(ROOM_TYPES.min, ROOM_TYPES.max));
  while (Object.keys(types).length < count) take(remaining);
  return types;
}

function pickBoss(rng, enemyDefs) {
  return rng.pick(bossIds(enemyDefs));
}

function tryGenerate(rng, floor, floorIndex, enemyDefs, bossId) {
  const pool = floorPool(floorIndex, enemyDefs);
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

    // Some fight rooms are bigger than the screen (the camera scrolls).
    const shape = type === 'normal' && rng.chance(BIG_ROOM_CHANCE) ? rng.weighted(BIG_ROOM_WEIGHTS) : 'normal';

    let waves = [];
    if (type === 'normal') waves = normalWaves(rng, pickRoomTypes(rng, pool, floorIndex, enemyDefs), enemyDefs, dist + floorIndex, WAVE_BONUS[shape]);
    if (type === 'boss') waves = [[bossId]]; // no waves: just the boss

    const doors = {};
    for (const [dir, d] of Object.entries(DIRS)) doors[dir] = cells.has(key(c.x + d.x, c.y + d.y));

    return {
      x: c.x,
      y: c.y,
      type,
      shape, // 'normal' (one screen), 'wide', 'tall' or 'big'
      size: ROOM_SIZES[shape], // floor size in tiles
      dist,
      doors,
      waves, // list of waves; each wave is a list of enemy type keys
      seed: rng.int(0, 2 ** 31 - 1), // decides this room's look
      cleared: waves.length === 0,
      visited: false,
      locked: type === 'treasure', // its door needs a key
      pickups: [], // { kind, x, y } left on the floor
      contents: null, // treasure item / shop wares, filled in on first visit
      obstacles: makeObstacles(rng, floor, type, ROOM_SIZES[shape]), // { col, row, texture, hurts, broken }
    };
  });

  return new Dungeon(rooms, rooms.find((room) => room.type === 'start'), floor, floorIndex, pool);
}

// Fight rooms usually get a layout of the floor's obstacles; boss rooms one of a few cover
// patterns (or none); start, treasure and shop rooms stay open.
function makeObstacles(rng, floor, type, size) {
  if (type === 'boss') return rng.chance(EMPTY_BOSS_ROOM_CHANCE) ? [] : withKinds(rng, floor, makeLayout(rng, 'boss'));
  if (type !== 'normal' || rng.chance(EMPTY_ROOM_CHANCE)) return [];
  return withKinds(rng, floor, makeLayout(rng, 'any', size));
}

// Each room uses one or two of its floor's obstacle kinds.
function withKinds(rng, floor, tiles) {
  const kinds = [rng.pick(floor.obstacles), rng.pick(floor.obstacles)];
  return tiles.map(({ col, row }) => {
    const kind = rng.pick(kinds);
    return { col, row, texture: kind.texture, hurts: !!kind.hurts, broken: false };
  });
}

// Two independent waves. Rooms further from the start (and on deeper floors) lean toward
// bigger waves, and big rooms hold more (`bonus`). `weights` is the room's enemy types.
function normalWaves(rng, weights, enemyDefs, difficulty, bonus = WAVE_BONUS.normal) {
  return Array.from({ length: WAVES_PER_ROOM }, () => makeWave(rng, weights, enemyDefs, difficulty, bonus));
}

// 1-6 enemies (more in big rooms) of 1-3 different types. Strong enemies have a per-wave cap (maxPerWave).
function makeWave(rng, weights, enemyDefs, difficulty, bonus = WAVE_BONUS.normal) {
  const min = Math.min(WAVE_SIZE.min + Math.floor(difficulty / 3), 4) + bonus.min;
  const size = rng.int(min, bonus.max);
  const typeCount = Math.min(Number(rng.weighted(TYPES_PER_WAVE)), size, Object.keys(weights).length);

  // Choose the types (no repeats), weighted by the floor's mix.
  const remaining = { ...weights };
  const types = [];
  while (types.length < typeCount) {
    const type = rng.weighted(remaining);
    types.push(type);
    delete remaining[type];
  }

  // One of each, then fill up to the size without breaking any cap.
  const wave = [...types];
  const count = (type) => wave.filter((t) => t === type).length;
  const open = () => types.filter((t) => count(t) < (enemyDefs[t].maxPerWave ?? bonus.max));
  while (wave.length < size && open().length > 0) wave.push(rng.pick(open()));
  return wave;
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
