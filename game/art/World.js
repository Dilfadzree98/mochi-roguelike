import { TILE } from '../constants.js';
import { paint } from './Pixels.js';

// Floor and wall tiles, doors, obstacles, floor decorations and small effects.

// Draws a tiny row map with every character as a 2x2 block (decorations and particles,
// which are too small for an outline but should still look like 2px pixel art).
function blocks(scene, key, rows, palette) {
  paint(scene, key, rows[0].length * 2, rows.length * 2, (c) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && c.rect(x * 2, y * 2, 2, 2, palette[ch])));
  }, { outline: null });
}

// ---------- Floor decorations (never shaped like enemies or bullets) ----------

const DECOR = {
  flower: { palette: { y: '#F2C94C', c: '#C98A2E' }, rows: ['.y.', 'ycy', '.y.'] },
  clover: { palette: { d: '#4C733B', D: '#3F6531' }, rows: ['d.d', '.D.'] },
  pebble: { palette: { p: '#8C8A78', q: '#6B6A5C' }, rows: ['.pp', 'ppq'] },
  puddle: { palette: { p: '#4E6A66', w: '#7FA8A0' }, rows: ['.pppp.', 'ppwppp', '.pppp.'] },
  broken_pot: { palette: { o: '#6E3A22', b: '#A0603C' }, rows: ['.o.o.', 'obbo.', 'obbbo', '.ooo.'] },
  moss: { palette: { m: '#4C6A44', M: '#5E8050' }, rows: ['mMmm', '.mm.'] },
  glow_mushroom: { palette: { c: '#6FD3FF', C: '#C9F2FF', s: '#C9E6F0' }, rows: ['.ccc.', 'cCccc', '..s..', '..s..', '.sss.'] },
  jar: { palette: { o: '#5E6A6E', g: '#8C9A9E', G: '#C9D6DA' }, rows: ['.oo.', 'oggo', 'oGgo', 'oggo', 'oooo'] },
  root: { palette: { r: '#5E4A38' }, rows: ['r....r', '.rr.r.', '...rr.'] },
  rot_leaf: { palette: { l: '#4A3E22', L: '#5E5030' }, rows: ['.ll..', 'lLlll', '..ll.'] },
  purple_sprout: { palette: { p: '#9B5CFF', P: '#B57BFF', s: '#4A2E5A' }, rows: ['p.p', 'PpP', '.s.', '.s.'] },
  murky_puddle: { palette: { m: '#4A3A50', M: '#5E4A66', b: '#7A6A8F' }, rows: ['.mmmmm.', 'mmMmmbm', '.mmmmm.'] },
};

// ---------- Particles and small effects ----------

const BITS = {
  husk: { palette: { a: '#8BC86A', b: '#3F7A2A' }, rows: ['ab', 'ba'] },
  leaf: { palette: { g: '#8BC86A', G: '#A6D987', s: '#5E9C3A' }, rows: ['.gG', 'gGG', 's..'] },
  slime_bit: { palette: { L: '#A99BBD' }, rows: ['LL', 'LL'] },
  cap_bit: { palette: { r: '#C2413B', s: '#F3E9DC' }, rows: ['rs', 'rr'] },
  ceramic: { palette: { w: '#E8E4DA', h: '#4A5F8C' }, rows: ['wh', 'ww'] },
  hex_spark: { palette: { p: '#B57BFF' }, rows: ['p.', '.p'] },
  petal: { palette: { p: '#C9C3A1', d: '#8C866A' }, rows: ['pp', 'pd'] },
  pink_bit: { palette: { f: '#E0457B' }, rows: ['ff'] },
  pumpkin_bit: { palette: { P: '#E8903C', p: '#B5501F' }, rows: ['Pp', 'PP'] },
  spark: { palette: { y: '#FFD23F' }, rows: ['yy', 'yy'] },
  smoke: { palette: { s: '#5A5060' }, rows: ['ss', 'ss'] },
  crumb: { palette: { u: '#E0A040', L: '#6CC24A' }, rows: ['uL'] },
  // Claw marks where Chinggu scratches.
  scratch: { palette: { w: '#FFFFFF' }, rows: ['w.w.w...', '.w.w.w..', '..w.w.w.', '...w.w.w'] },
  // A warning crack in the floor before roots burst up (or the Beetle Baron's tunnel).
  crack: { palette: { c: '#1A140F' }, rows: ['...cc.......', '.....c..cc..', '..ccccccc...', '.c....c..c..', '....cc...cc.'] },
  // Where a boss attack is about to land.
  target: { palette: { f: '#E0457B', c: '#FFC2D6' }, rows: ['...fffff...', '.ff.....ff.', 'f....c....f', '.ff.....ff.', '...fffff...'] },
  slime: { palette: { c: '#9FD8C8', w: '#D6F2EA' }, rows: ['.cccccc.', 'ccwccccc', 'cccccccc', '.cccccc.'] },
};

function paintEffects(scene) {
  for (const [key, { rows, palette }] of Object.entries({ ...DECOR, ...BITS })) blocks(scene, key, rows, palette);

  paint(scene, 'shadow', 24, 8, (c) => c.ellipse(12, 4, 12, 4, '#000000'), { outline: null });
  paint(scene, 'roots', 24, 14, (c) => {
    for (const [x, h] of [[4, 10], [10, 14], [16, 9], [21, 12]]) {
      c.poly([[x - 3, 14], [x, 14 - h], [x + 3, 14]], '#2E5A2A');
      c.inside(() => c.line(x - 1, 13, x, 15 - h, '#4C7A3A', 1));
    }
  }, { outline: '#1A3318' });
  paint(scene, 'pedestal', 24, 18, (c) => {
    c.rect(0, 0, 24, 4, '#A8A694');
    c.rect(0, 4, 24, 2, '#6B6A5C');
    c.rect(5, 6, 14, 8, '#8C8A78');
    c.rect(15, 6, 4, 8, '#6B6A5C');
    c.rect(2, 14, 20, 4, '#6B6A5C');
  }, { outline: '#3A3A32' });
}

// Soft round light (behind item pedestals and glowing decorations).
function paintGlow(scene, key, rgb, size) {
  paint(scene, key, size, size, (c) => {
    const r = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
        if (d < 1) c.px(x, y, `${rgb}${Math.round((1 - d) * (1 - d) * 0.55 * 255).toString(16).padStart(2, '0')}`);
      }
    }
  }, { outline: null, crop: false });
}

// ---------- Obstacles (fill one 32x32 floor tile; block movement and bullets) ----------

const OBSTACLES = {
  flower_pot(c) {
    c.ellipse(12, 6, 5, 4, '#5E9C3A');
    c.ellipse(20, 7, 5, 4, '#8BC86A');
    c.ellipse(16, 3, 4, 3, '#6CA850');
    c.circle(16, 2, 2.2, '#F2C94C');
    c.poly([[5, 11], [27, 11], [24, 29], [8, 29]], '#8A4A2C');
    c.inside(() => {
      c.poly([[5, 11], [23, 11], [20, 29], [8, 29]], '#B8643C');
      c.rect(7, 13, 3, 12, '#D88A5C');
    });
    c.rect(4, 10, 24, 4, '#D88A5C');
    c.rect(4, 13, 24, 1, '#8A4A2C');
  },
  stump(c) {
    c.rect(5, 10, 22, 17, '#6E4A2E');
    c.inside(() => {
      c.rect(5, 10, 6, 17, '#8A6040');
      for (const x of [14, 20]) c.rect(x, 12, 2, 13, '#4A3020');
    });
    c.ellipse(4, 28, 4, 2, '#6E4A2E');
    c.ellipse(28, 28, 4, 2, '#6E4A2E');
    c.ellipse(16, 27, 12, 3, '#6E4A2E');
    c.ellipse(16, 10, 11, 5, '#A8805A');
    c.inside(() => {
      c.ellipse(16, 10, 8, 3.4, '#C9A27A');
      c.ellipse(16, 10, 5, 2, '#A8805A');
      c.ellipse(16, 10, 2, 1, '#C9A27A');
    });
  },
  planter(c) {
    c.path([[11, 8], [9, 2]], '#6A5A3A', 2);
    c.path([[16, 8], [17, 1]], '#6A5A3A', 2);
    c.path([[21, 8], [23, 3]], '#6A5A3A', 2);
    c.poly([[2, 9], [30, 9], [27, 29], [5, 29]], '#5E7570');
    c.inside(() => {
      c.poly([[2, 9], [26, 9], [23, 29], [5, 29]], '#7F9A94');
      c.rect(4, 12, 3, 14, '#A8C4BE');
    });
    c.rect(1, 8, 30, 3, '#A8C4BE');
    c.rect(3, 11, 26, 2, '#3E3020');
  },
  bench(c) {
    for (const x of [3, 25]) c.rect(x, 16, 4, 13, '#5E4630');
    c.rect(0, 10, 32, 6, '#8A6A44');
    c.inside(() => {
      c.rect(0, 10, 32, 2, '#A8885E');
      c.rect(0, 15, 32, 1, '#5E4630');
    });
    c.rect(7, 22, 18, 3, '#8A6A44');
    for (const x of [6, 22]) {
      c.poly([[x - 3, 4], [x + 3, 4], [x + 2, 10], [x - 2, 10]], '#B8643C');
      c.circle(x, 2, 2, '#5E9C3A');
    }
  },
  barrel(c) {
    c.ellipse(16, 17, 12, 13, '#5A3A22');
    c.inside(() => {
      c.ellipse(15, 16, 11, 13, '#7A5232');
      c.rect(6, 6, 4, 22, '#9A6E46');
      for (const y of [7, 16, 25]) c.rect(0, y, 32, 3, '#6A6A72');
      for (const y of [7, 16, 25]) c.rect(0, y, 32, 1, '#9A9AA4');
    });
  },
  crate(c) {
    c.rect(2, 3, 28, 26, '#5E4630');
    c.inside(() => {
      c.rect(2, 3, 26, 24, '#8A6A44');
      c.rect(4, 5, 22, 20, '#A8885E');
      c.line(5, 6, 25, 24, '#8A6A44', 3);
      c.line(25, 6, 5, 24, '#8A6A44', 3);
      c.rect(2, 3, 28, 2, '#C9A87A');
    });
  },
  big_mushroom(c) {
    c.rect(12, 14, 8, 15, '#9A948A');
    c.inside(() => c.rect(12, 14, 4, 15, '#C9C3B8'));
    c.ellipse(16, 28, 9, 2.5, '#9A948A');
    c.ellipse(16, 11, 15, 9, '#3E8AB0', { bottom: 14 });
    c.inside(() => {
      c.ellipse(15, 10, 14, 8, '#6FD3FF', { bottom: 13 });
      c.circle(9, 6, 2, '#C9F2FF');
      c.circle(20, 4, 1.6, '#C9F2FF');
      c.circle(24, 9, 1.4, '#C9F2FF');
    });
  },
  root_knot(c) {
    c.ellipse(16, 20, 14, 9, '#3E2E36');
    c.inside(() => {
      c.ellipse(15, 19, 13, 8, '#5A4450');
      c.path([[3, 18], [9, 14], [15, 20], [22, 14], [29, 19]], '#3E2E36', 2);
      c.path([[5, 24], [12, 22], [19, 26], [26, 22]], '#3E2E36', 2);
    });
    c.path([[10, 12], [8, 6], [11, 3]], '#5A4450', 3);
    c.path([[21, 12], [24, 7]], '#5A4450', 3);
  },
  // Hurts Mochi on touch.
  thorn_cluster(c) {
    c.ellipse(16, 20, 14, 9, '#2E5A2A');
    c.inside(() => {
      c.ellipse(15, 19, 13, 8, '#4C7A3A');
      c.path([[3, 22], [9, 15], [16, 22], [23, 15], [29, 21]], '#2E5A2A', 2);
    });
    for (const [x, y, dx, dy] of [[2, 18, -3, -2], [30, 18, 3, -2], [8, 11, -1, -4], [16, 10, 0, -5], [24, 11, 1, -4], [10, 28, -2, 2], [22, 28, 2, 2]]) {
      c.poly([[x - 2, y], [x + dx, y + dy], [x + 2, y]], '#E8C9D6');
    }
  },
};

const OBSTACLE_OUTLINES = { thorn_cluster: '#10200E', root_knot: '#0E0A10' };

// ---------- Tiles, one set per floor ----------

// The front face of the top wall (its lowest 12px), different on each floor.
const FACE_TOP = 20;
const FACES = {
  fence(c) {
    c.rect(0, FACE_TOP, TILE, 12, '#2A2219');
    for (const x of [1, 9, 17, 25]) {
      c.rect(x, FACE_TOP + 2, 6, 10, '#8A7050');
      c.rect(x + 2, FACE_TOP, 2, 2, '#8A7050');
      c.rect(x + 4, FACE_TOP + 4, 2, 8, '#6E5840');
    }
    c.rect(0, FACE_TOP + 5, TILE, 2, '#6E5840');
  },
  glass(c) {
    c.rect(0, FACE_TOP, TILE, 12, '#4A3A30');
    for (const x of [2, 18]) {
      c.rect(x, FACE_TOP + 2, 12, 8, '#6F8A86');
      c.rect(x + 2, FACE_TOP + 2, 2, 2, '#A8C4BE');
    }
    c.rect(8, FACE_TOP + 6, 2, 2, '#C9E6E0');
    c.rect(10, FACE_TOP + 4, 2, 2, '#C9E6E0');
  },
  brick(c) {
    c.rect(0, FACE_TOP, TILE, 12, '#1A1212');
    c.rect(0, FACE_TOP, TILE, 2, '#5E4630');
    for (const [x, y, w] of [[0, 2, 14], [16, 2, 14], [0, 7, 6], [8, 7, 14], [24, 7, 8]]) c.rect(x, FACE_TOP + y, w, 4, '#4A3030');
  },
  roots(c) {
    c.rect(0, FACE_TOP, TILE, 12, '#16121A');
    c.path([[2, FACE_TOP + 2], [6, FACE_TOP + 5], [10, FACE_TOP + 8], [14, FACE_TOP + 10]], '#3E2E36', 2);
    c.path([[16, FACE_TOP + 2], [20, FACE_TOP + 4], [24, FACE_TOP + 7], [28, FACE_TOP + 10]], '#3E2E36', 2);
    for (const [x, y] of [[6, 2], [20, 8], [12, 6]]) c.rect(x, FACE_TOP + y, 2, 2, '#6B2F4E');
  },
};

function makeFloorTiles(scene, floor, rng) {
  const p = floor.palette;
  const tile = (key, draw) => paint(scene, key, TILE, TILE, draw, { outline: null, crop: false });
  const speck = (c, color, w = 2, h = 2) => c.rect(rng.int(0, 15) * 2, rng.int(0, 15) * 2, w, h, color);

  for (let v = 0; v < 4; v++) {
    tile(`${floor.id}_floor${v}`, (c) => {
      c.rect(0, 0, TILE, TILE, p.floor);
      for (let i = 0; i < 10; i++) speck(c, p.floorDark);
      for (let i = 0; i < 4; i++) speck(c, p.floorLight, 2, 4);
      if (floor.pattern === 'stone') {
        // Cracked stone tiles with moss in the gaps.
        c.rect(0, 30, TILE, 2, p.floorDark);
        c.rect(30, 0, 2, TILE, p.floorDark);
        for (let i = 0; i < 3; i++) c.rect(rng.int(0, 14) * 2, 30, 2, 2, p.patch);
      }
      if (v === 3) {
        // A patch: dirt, moss, planks or rotting leaves depending on the floor.
        if (floor.pattern === 'earth') {
          c.rect(0, 12, TILE, 8, p.patch);
          c.rect(0, 18, TILE, 2, p.patchDark);
          c.rect(14, 12, 2, 8, p.patchDark);
        } else {
          c.rect(10, 12, 12, 8, p.patch);
          c.rect(8, 14, 16, 4, p.patch);
          c.rect(10, 18, 12, 2, p.patchDark);
        }
      }
    });
  }

  const wall = (c, height) => {
    c.rect(0, 0, TILE, height, p.wall);
    for (let i = 0; i < 6; i++) c.rect(rng.int(0, 13) * 2, rng.int(0, height / 2 - 2) * 2, 6, 4, p.wallDark);
    for (let i = 0; i < 6; i++) c.rect(rng.int(0, 15) * 2, rng.int(0, height / 2 - 1) * 2, 2, 2, p.wallLight);
  };
  for (let v = 0; v < 3; v++) tile(`${floor.id}_wall${v}`, (c) => wall(c, TILE));
  tile(`${floor.id}_wall_top`, (c) => {
    wall(c, FACE_TOP);
    FACES[floor.face](c);
  });

}

// Soft dark vignette over a whole room (walls included), heavier on deeper floors.
// Made the first time a room of that size is entered on that floor; returns the texture key.
export function roomVignette(scene, floor, cols, rows) {
  const key = `vignette_${floor.id}_${cols}x${rows}`;
  if (scene.textures.exists(key)) return key;
  const width = TILE * (cols + 2);
  const height = TILE * (rows + 2);
  const texture = scene.textures.createCanvas(key, width, height);
  const ctx = texture.getContext();
  const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.62);
  gradient.addColorStop(0, 'rgba(10, 6, 14, 0)');
  gradient.addColorStop(1, `rgba(10, 6, 14, ${floor.vignette})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  texture.refresh();
  return key;
}

// ---------- Doors and the trapdoor ----------

const GATES = {
  door: { frame: '#2A2219', wood: '#7A5C3A', dark: '#5E4630', lock: '#F2C94C' },
  door_boss: { frame: '#1F1A24', wood: '#4E3A5E', dark: '#2E2238', lock: '#B57BFF' },
  door_treasure: { frame: '#5C4520', wood: '#8A6A3A', dark: '#6E5234', lock: '#FFE45C' },
  door_shop: { frame: '#2A2219', wood: '#5E7A3A', dark: '#3E5A2A', lock: '#F2A0A8' },
};

function makeDoors(scene) {
  const tile = (key, draw) => paint(scene, key, TILE, TILE, draw, { outline: null, crop: false });
  // Closed gates, drawn for the top wall and rotated for the others.
  for (const [key, gate] of Object.entries(GATES)) {
    tile(key, (c) => {
      c.rect(0, 0, TILE, TILE, gate.frame);
      c.rect(2, 2, 28, 30, gate.wood);
      for (const x of [8, 16, 24]) c.rect(x, 2, 2, 30, gate.dark);
      c.rect(2, 8, 28, 4, gate.dark);
      c.rect(2, 22, 28, 4, gate.dark);
      c.rect(13, 13, 6, 7, gate.lock);
      c.rect(15, 16, 2, 3, gate.frame);
    });
  }
  // Open gateway: a dark path between two posts.
  tile('door_open', (c) => {
    c.rect(0, 0, TILE, TILE, '#2A2219');
    c.rect(8, 0, 16, TILE, '#4A3A2C');
    c.rect(10, 0, 2, TILE, '#3A2C20');
    c.rect(0, 0, 4, TILE, GATES.door.dark);
    c.rect(28, 0, 4, TILE, GATES.door.dark);
  });
  // Trapdoor to the next floor.
  tile('trapdoor', (c) => {
    c.rect(2, 2, 28, 28, '#5E4630');
    c.rect(4, 4, 24, 24, '#2A2219');
    c.rect(6, 6, 20, 20, '#0A0608');
    c.rect(6, 6, 20, 2, '#1A140F');
  });
}

export function makeWorldTextures(scene, floors, rng) {
  paintEffects(scene);
  paintGlow(scene, 'glow', '#F2C94C', 80);
  paintGlow(scene, 'glow_white', '#FFFFFF', 80);
  paintGlow(scene, 'glow_blue', '#6FD3FF', 48);
  paintGlow(scene, 'glow_purple', '#B57BFF', 40);
  for (const [key, draw] of Object.entries(OBSTACLES)) paint(scene, key, TILE, TILE, draw, { outline: OBSTACLE_OUTLINES[key] ?? '#1E1418' });
  for (const floor of floors) makeFloorTiles(scene, floor, rng);
  makeDoors(scene);
}
