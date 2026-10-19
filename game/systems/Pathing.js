import { TILE, FLOOR } from '../constants.js';

// The floor is a 13x7 grid of tiles. Obstacles fill whole tiles, so enemies can
// find their way around them with a simple flow field toward the player.

export const GRID_COLS = 13;
export const GRID_ROWS = 7;

const key = (col, row) => `${col},${row}`;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function tileOf(x, y) {
  return { col: Math.floor((x - FLOOR.left) / TILE), row: Math.floor((y - FLOOR.top) / TILE) };
}

export function tileCenter(col, row) {
  return { x: FLOOR.left + col * TILE + TILE / 2, y: FLOOR.top + row * TILE + TILE / 2 };
}

const inGrid = (col, row) => col >= 0 && row >= 0 && col < GRID_COLS && row < GRID_ROWS;

// Steps from every free tile to the target tile (Map of "col,row" -> steps).
export function flowField(blocked, target) {
  const dist = new Map([[key(target.col, target.row), 0]]);
  const queue = [target];
  while (queue.length) {
    const { col, row } = queue.shift();
    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc;
      const r = row + dr;
      const k = key(c, r);
      if (!inGrid(c, r) || blocked.has(k) || dist.has(k)) continue;
      dist.set(k, dist.get(key(col, row)) + 1);
      queue.push({ col: c, row: r });
    }
  }
  return dist;
}

// The centre of the neighbouring tile that is one step closer to the target, or null.
export function nextStep(field, from) {
  let best = null;
  let bestDist = field.get(key(from.col, from.row)) ?? Infinity;
  for (const [dc, dr] of NEIGHBOURS) {
    const d = field.get(key(from.col + dc, from.row + dr));
    if (d !== undefined && d < bestDist) {
      bestDist = d;
      best = tileCenter(from.col + dc, from.row + dr);
    }
  }
  return best;
}

// True if a straight line between two points (with some width) crosses no obstacle.
export function lineClear(blocked, x0, y0, x1, y1, halfWidth = 0) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    if (!areaFree(blocked, x, y, halfWidth)) return false;
  }
  return true;
}

// True if a square of the given half-size around (x, y) touches no obstacle.
export function areaFree(blocked, x, y, half = 0) {
  for (const [dx, dy] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
    const { col, row } = tileOf(x + dx, y + dy);
    if (blocked.has(key(col, row))) return false;
  }
  return true;
}

// Nearest free tile centre to a point (used to place drops that land on an obstacle).
export function nearestFree(blocked, x, y) {
  const start = tileOf(x, y);
  const seen = new Set([key(start.col, start.row)]);
  const queue = [start];
  while (queue.length) {
    const t = queue.shift();
    if (inGrid(t.col, t.row) && !blocked.has(key(t.col, t.row))) return tileCenter(t.col, t.row);
    for (const [dc, dr] of NEIGHBOURS) {
      const k = key(t.col + dc, t.row + dr);
      if (!seen.has(k) && inGrid(t.col + dc, t.row + dr)) {
        seen.add(k);
        queue.push({ col: t.col + dc, row: t.row + dr });
      }
    }
  }
  return { x, y };
}

// ---------- Obstacle layouts ----------

// Tiles next to each door (and where Mochi enters) always stay free.
const KEEP_CLEAR = new Set(['6,0', '6,1', '6,6', '6,5', '0,3', '1,3', '12,3', '11,3', '5,0', '7,0', '5,6', '7,6', '0,2', '0,4', '12,2', '12,4']);

// Hand-made shapes, written for the left half of the room and mirrored.
const SHAPES = {
  corners: [[2, 1], [2, 5]],
  pillars: [[3, 1], [3, 5], [5, 3]],
  walls: [[3, 2], [3, 3], [3, 4]],
  brackets: [[2, 1], [3, 1], [2, 5], [3, 5]],
  lanes: [[3, 1], [4, 1], [3, 5], [4, 5]],
  checker: [[2, 2], [4, 4], [4, 2], [2, 4]],
  center: [[5, 2], [5, 4], [6, 2], [6, 4]],
};

// Boss rooms: open in the middle, with cover around the edges.
const BOSS_SHAPES = {
  corners: [[2, 1], [2, 5]],
  pillars: [[2, 2], [2, 4], [4, 1], [4, 5]],
  walls: [[2, 2], [2, 3], [2, 4]],
  ring: [[1, 1], [1, 5], [3, 1], [3, 5]],
  scatter: [[2, 1], [4, 2], [2, 5], [4, 4]],
  bunkers: [[3, 2], [3, 4]],
};

// Picks a layout for a fight room: a named shape or a random mirrored scatter.
// Returns [{ col, row }], always leaving every free tile reachable.
export function makeLayout(rng, style = 'any') {
  for (let attempt = 0; attempt < 10; attempt++) {
    const half = style === 'boss' ? BOSS_SHAPES[rng.pick(Object.keys(BOSS_SHAPES))] : chooseHalf(rng);
    const tiles = new Map();
    for (const [col, row] of half) {
      for (const [c, r] of [[col, row], [GRID_COLS - 1 - col, row]]) {
        if (!KEEP_CLEAR.has(key(c, r))) tiles.set(key(c, r), { col: c, row: r });
      }
    }
    if (allConnected(new Set(tiles.keys()))) return [...tiles.values()];
  }
  return [];
}

function chooseHalf(rng) {
  if (rng.chance(0.4)) return SHAPES[rng.pick(Object.keys(SHAPES))];
  // Random scatter, mirrored left/right and sometimes top/bottom too.
  const half = [];
  const count = rng.int(2, 4);
  const mirrorY = rng.chance(0.5);
  for (let i = 0; i < count; i++) {
    const col = rng.int(1, 5);
    const row = rng.int(1, mirrorY ? 2 : 5);
    half.push([col, row]);
    if (mirrorY) half.push([col, GRID_ROWS - 1 - row]);
  }
  return half;
}

function allConnected(blocked) {
  const free = [];
  for (let c = 0; c < GRID_COLS; c++) for (let r = 0; r < GRID_ROWS; r++) if (!blocked.has(key(c, r))) free.push({ col: c, row: r });
  const field = flowField(blocked, { col: 6, row: 0 });
  return free.every((t) => field.has(key(t.col, t.row)));
}
