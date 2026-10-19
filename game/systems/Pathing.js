import { TILE, FLOOR, ROOM, ROOM_SIZES } from '../constants.js';

// The floor is a grid of tiles (13x7 in a one-screen room; bigger rooms have more). Obstacles
// fill whole tiles, so enemies can find their way around them with a simple flow field toward
// the player. Functions that work on the current room read its size from ROOM.

const key = (col, row) => `${col},${row}`;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function tileOf(x, y) {
  return { col: Math.floor((x - FLOOR.left) / TILE), row: Math.floor((y - FLOOR.top) / TILE) };
}

export function tileCenter(col, row) {
  return { x: FLOOR.left + col * TILE + TILE / 2, y: FLOOR.top + row * TILE + TILE / 2 };
}

const inGrid = (col, row, cols = ROOM.cols, rows = ROOM.rows) => col >= 0 && row >= 0 && col < cols && row < rows;

// Steps from every free tile to the target tile (Map of "col,row" -> steps).
export function flowField(blocked, target, cols = ROOM.cols, rows = ROOM.rows) {
  const dist = new Map([[key(target.col, target.row), 0]]);
  const queue = [target];
  while (queue.length) {
    const { col, row } = queue.shift();
    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc;
      const r = row + dr;
      const k = key(c, r);
      if (!inGrid(c, r, cols, rows) || blocked.has(k) || dist.has(k)) continue;
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
function doorTiles(cols, rows) {
  const midC = (cols - 1) / 2;
  const midR = (rows - 1) / 2;
  const tiles = [
    [midC, 0], [midC, 1], [midC - 1, 0], [midC + 1, 0],
    [midC, rows - 1], [midC, rows - 2], [midC - 1, rows - 1], [midC + 1, rows - 1],
    [0, midR], [1, midR], [0, midR - 1], [0, midR + 1],
    [cols - 1, midR], [cols - 2, midR], [cols - 1, midR - 1], [cols - 1, midR + 1],
  ];
  return new Set(tiles.map(([c, r]) => key(c, r)));
}

// Hand-made shapes for one-screen rooms, written for the left half and mirrored.
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

// Picks a layout for a fight room of the given size: a named shape (one-screen rooms) or a
// random mirrored scatter. Returns [{ col, row }], always leaving every free tile reachable.
export function makeLayout(rng, style = 'any', { cols, rows } = ROOM_SIZES.normal) {
  const keepClear = doorTiles(cols, rows);
  const oneScreen = cols === ROOM_SIZES.normal.cols && rows === ROOM_SIZES.normal.rows;
  for (let attempt = 0; attempt < 10; attempt++) {
    let half;
    if (style === 'boss') half = BOSS_SHAPES[rng.pick(Object.keys(BOSS_SHAPES))];
    else if (oneScreen && rng.chance(0.4)) half = SHAPES[rng.pick(Object.keys(SHAPES))];
    else half = scatter(rng, cols, rows);
    const tiles = new Map();
    for (const [col, row] of half) {
      for (const [c, r] of [[col, row], [cols - 1 - col, row]]) {
        if (!keepClear.has(key(c, r))) tiles.set(key(c, r), { col: c, row: r });
      }
    }
    if (allConnected(new Set(tiles.keys()), cols, rows)) return [...tiles.values()];
  }
  return [];
}

// Random obstacles on the left half (mirrored left/right later, sometimes top/bottom too).
// Bigger rooms get more of them.
function scatter(rng, cols, rows) {
  const half = [];
  const area = (cols * rows) / (ROOM_SIZES.normal.cols * ROOM_SIZES.normal.rows);
  const count = Math.round(rng.int(2, 4) * area);
  const mirrorY = rng.chance(0.5);
  const lastCol = (cols - 1) / 2 - 1;
  for (let i = 0; i < count; i++) {
    const col = rng.int(1, lastCol);
    const row = rng.int(1, mirrorY ? (rows - 1) / 2 - 1 : rows - 2);
    half.push([col, row]);
    if (mirrorY) half.push([col, rows - 1 - row]);
  }
  return half;
}

function allConnected(blocked, cols, rows) {
  const free = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (!blocked.has(key(c, r))) free.push({ col: c, row: r });
  const field = flowField(blocked, { col: (cols - 1) / 2, row: 0 }, cols, rows);
  return free.every((t) => field.has(key(t.col, t.row)));
}
