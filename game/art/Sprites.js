import { Rng } from '../systems/Rng.js';
import { TILE, ROOM_COLS, ROOM_ROWS } from '../constants.js';

// Placeholder pixel art drawn in code, so the game runs without image files.
// Each map is a list of rows; each character is one pixel looked up in the
// palette, and '.' is transparent. Swap these for Aseprite PNGs later by
// loading images under the same texture keys.

// ---------- Mochi ----------

const MOCHI_PALETTE = {
  o: '#D99579', // outline
  b: '#FFD8C2', // body
  h: '#FFF3EA', // highlight
  d: '#F2BFA5', // shadow
  e: '#F7AEC0', // inner ear
  k: '#2C2C2A', // eyes
  w: '#FFFFFF', // eye shine
  p: '#F9B0B6', // blush (#F59AB0 at 65% over the body)
  m: '#8A4B3C', // mouth
  g: '#8BC86A', // left leaf
  G: '#A6D987', // right leaf
  s: '#5E9C3A', // stem and leaf outline
};

const LEAVES_PERKY = [
  '.....ss.ss......',
  '....sggssGGs....',
  '.....sgsGs......',
  '.......s........',
];

const LEAVES_WILT = [
  '................',
  '.......s........',
  '..sggssssGGs....',
  '...ss..s...ss...',
];

const LEAVES_NONE = [
  '................',
  '................',
  '................',
  '.......s........',
];

// Rows 4-15.
const MOCHI_BODY = [
  '..oo..oooo..oo..',
  '..oeoobbbbooeo..',
  '..obbbbbbbbbbo..',
  '.obhhbbbbbbbbbo.',
  '.obhbbbbbbbbbbo.',
  'obbkwbbbbbbkwbbo',
  'obbkkbbbbbbkkbbo',
  'obppbbmbbmbbppbo',
  'obbbbbbmmbbbbbbo',
  '.obddddddddddbo.',
  '..oooooooooooo..',
  '...obo....obo...',
];

// Eyes squeezed shut, replacing rows 9 and 10.
const HURT_EYES = {
  9: 'obbkbbbbbbbbkbbo',
  10: 'obbbkkbbbbkkbbbo',
};

function mochi(leaves, faceRows = {}) {
  return [...leaves, ...MOCHI_BODY.map((row, i) => faceRows[i + 4] ?? row)];
}

// ---------- Enemies ----------

const GLOOM_SLUG = {
  palette: {
    o: '#4E4260',
    b: '#7A6A8F',
    h: '#C9BEDA', // glossy slime highlight
    L: '#A99BBD', // belly
    y: '#FFE45C', // glowing eyes
    k: '#2C2C2A',
    w: '#FFFFFF',
  },
  // Faces right; flipped in code to face left.
  rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........y..y..',
    '..........o..o..',
    '..........o..o..',
    '.....ooooooooo..',
    '...oobbhhbbbbbo.',
    '..obbbhbbbbbbbbo',
    '.obbbbbbbbbbbbbo',
    'obbbbbbbbbbbbkwo',
    'oLLLLLLLLLLLLLLo',
    '.oooooooooooooo.',
  ],
};

// ---------- Small sprites ----------

const SMALL = {
  seed: {
    palette: { o: '#3F7A2A', g: '#8BC86A', w: '#FFFFFF' },
    rows: ['..oo..', '.ogwo.', 'oggggo', 'oggggo', '.oggo.', '..oo..'],
  },
  husk: {
    palette: { a: '#8BC86A', b: '#3F7A2A' },
    rows: ['ab', 'ba'],
  },
  leaf: {
    palette: { g: '#8BC86A', G: '#A6D987', s: '#5E9C3A' },
    rows: ['.gG', 'gGG', 's..'],
  },
  shadow: {
    palette: { o: '#000000' },
    rows: ['..oooooo..', '.oooooooo.', '..oooooo..'],
  },
  slime: {
    palette: { c: '#9FD8C8', w: '#D6F2EA' },
    rows: ['.cccccc.', 'ccwccccc', 'cccccccc', '.cccccc.'],
  },
  slime_bit: {
    palette: { L: '#A99BBD' },
    rows: ['LL', 'LL'],
  },
  flower: {
    palette: { y: '#F2C94C', c: '#C98A2E' },
    rows: ['.y.', 'ycy', '.y.'],
  },
  clover: {
    palette: { d: '#4C733B', D: '#3F6531' },
    rows: ['d.d', '.D.'],
  },
  pebble: {
    palette: { p: '#8C8A78', q: '#6B6A5C' },
    rows: ['.pp', 'ppq'],
  },
  pedestal: {
    palette: { o: '#4A4A40', t: '#A8A694', s: '#8C8A78', d: '#6B6A5C' },
    rows: [
      '.oooooooooo.',
      'otttttttttto',
      'osssssssssso',
      'oddddddddddo',
      '..osssssdo..',
      '..osssssdo..',
      '.oossssddoo.',
      '.oddddddddo.',
      '.oooooooooo.',
    ],
  },
};

// ---------- Shots (player seeds; one per shot item) ----------

const SEED_ROWS = ['..oo..', '.ogwo.', 'oggggo', 'oggggo', '.oggo.', '..oo..'];
const SHOTS = {
  seed_fire: { rows: SEED_ROWS, palette: { o: '#B5501F', g: '#FF8A3D', w: '#FFD23F' } },
  seed_frost: { rows: SEED_ROWS, palette: { o: '#4A90C2', g: '#A8E0FF', w: '#FFFFFF' } },
  pollen: {
    rows: ['.d..d.', '..yy..', 'dyyyyd', '.yyyy.', '..yy..', '.d..d.'],
    palette: { y: '#FFE45C', d: '#FFF4B8' },
  },
  dewdrop: {
    rows: ['..o...', '..oo..', '.owdo.', 'oddddo', 'oddddo', '.oooo.'],
    palette: { o: '#2E7FA8', d: '#5EC8F2', w: '#FFFFFF' },
  },
  seed_thorn: {
    rows: ['s.oo.s', '.oggo.', 'oggggo', 'oggggo', '.oggo.', 's.oo.s'],
    palette: { o: '#1F3D1C', g: '#2E5A2A', s: '#C9C3A1' },
  },
};

// ---------- Item icons (8x8) ----------

const ICONS = {
  icon_bone_meal: {
    palette: { o: '#5C4B34', b: '#A88A5E', w: '#F3E9DC' },
    rows: ['...oo...', '..obbo..', '.obbbbo.', 'obbwwbbo', 'obwwwwbo', 'obbwwbbo', '.obbbbo.', '..oooo..'],
  },
  icon_sun_drop: {
    palette: { y: '#F2C94C', o: '#C98A2E', Y: '#FFF4B8' },
    rows: ['y..yy..y', '.y.yy.y.', '..oooo..', 'yyoYYoyy', 'yyoYYoyy', '..oooo..', '.y.yy.y.', 'y..yy..y'],
  },
  icon_watering_can: {
    palette: { o: '#2E5E7A', b: '#5EA8C8' },
    rows: ['........', '..ooo...', '.o...o..', 'oooooooo', 'obbbbboo', 'obbbbbo.', 'obbbbbo.', '.ooooo..'],
  },
  icon_bee_wings: {
    palette: { w: '#D6F2EA', y: '#FFE45C', k: '#2C2C2A' },
    rows: ['.ww..ww.', 'wwww.www', '.wwyyww.', '..ykky..', '..yyyy..', '..kkkk..', '..yyyy..', '...kk...'],
  },
  icon_big_leaf: {
    palette: { g: '#8BC86A', G: '#A6D987', s: '#5E9C3A' },
    rows: ['......gg', '....gggs', '..ggggsg', '.gggGsgg', '.ggGsggg', '.gGsgggg', 'gGsgggg.', 's.gggg..'],
  },
  icon_twin_sprout: {
    palette: { g: '#8BC86A', G: '#A6D987', s: '#5E9C3A', o: '#8A4B3C', b: '#C2734F' },
    rows: ['.g....G.', 'ggs..sGG', '..s..s..', '..s..s..', '.oooooo.', 'obbbbbbo', 'obbbbbbo', '.oooooo.'],
  },
  icon_lucky_clover: {
    palette: { g: '#5FAF4A', G: '#8BD86A', s: '#3F7A2A' },
    rows: ['.gg..gg.', 'gGggggGg', '.gggggg.', '...ss...', '.gggggg.', 'gGggggGg', '.gg..gg.', '...s....'],
  },
};

// ---------- Pickups, bombs, shop ----------

const PICKUPS = {
  coin: {
    palette: { o: '#C98A2E', y: '#F2C94C', Y: '#FFF4B8' },
    rows: ['.ooo.', 'oyYyo', 'oyyyo', 'oyyyo', '.ooo.'],
  },
  bomb: {
    palette: { o: '#1A1418', k: '#3B3340', b: '#7A6A8F', f: '#FFD23F', s: '#FF8A3D' },
    rows: ['....fs.', '...o...', '.ooooo.', 'oobkkko', 'okkkkko', 'okkkkko', '.ooooo.'],
  },
  key: {
    palette: { y: '#F2C94C', o: '#C98A2E' },
    rows: ['.yy....', 'y..yyyy', '.yy.o.o'],
  },
  spark: { palette: { y: '#FFD23F' }, rows: ['yy', 'yy'] },
  smoke: { palette: { s: '#5A5060' }, rows: ['ss', 'ss'] },
  worm: {
    palette: { o: '#8A4B5A', p: '#F2A0A8', k: '#2C2C2A', B: '#E07A8A', m: '#8A3B4A', h: '#2A2219', H: '#1A140F' },
    rows: [
      '...oooooo...',
      '..oppppppo..',
      '.opkpppkppo.',
      '.oppppppppo.',
      '.opBppppBpo.',
      '.oppmmmmppo.',
      '..oppppppo..',
      '..oppppppo..',
      '.hhhhhhhhhh.',
      'hHHHHHHHHHHh',
    ],
  },
};

const HEART_PALETTE ={ o: '#5A1E2A', r: '#E25C4B', h: '#FFB3A3', e: '#3B2B33' };
const HEARTS = {
  heart_full: ['.oo.oo.', 'orrorro', 'ohrrrro', '.orrro.', '..oro..', '...o...'],
  heart_half: ['.oo.oo.', 'orroeeo', 'ohrreeo', '.orreo.', '..oro..', '...o...'],
  heart_empty: ['.oo.oo.', 'oeeoeeo', 'oeeeeeo', '.oeeeo.', '..oeo..', '...o...'],
};

// ---------- Drawing helpers ----------

function fromMap(scene, key, rows, palette) {
  paint(scene, key, rows[0].length, rows.length, ({ px }) => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== '.') px(x, y, palette[ch]);
      });
    });
  });
}

function paint(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  const ctx = texture.getContext();
  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  draw({ ctx, rect, px: (x, y, color) => rect(x, y, 1, 1, color) });
  texture.refresh();
}

// ---------- Tiles (Sunny Garden) ----------

const GRASS = { base: '#5F8A4A', dark: '#4C733B', light: '#6B9653', dirt: '#6E5B3F', dirtDark: '#5C4B34' };
const HEDGE = { base: '#3A5A2C', dark: '#2E4A23', light: '#4C733B' };
const FENCE = { gap: '#2A2219', picket: '#8A7050', shade: '#6E5840' };
const GATES = {
  door: { frame: '#2A2219', wood: '#7A5C3A', dark: '#5E4630', lock: '#F2C94C' },
  door_boss: { frame: '#1F1A24', wood: '#4E3A5E', dark: '#2E2238', lock: '#B57BFF' },
  door_treasure: { frame: '#5C4520', wood: '#8A6A3A', dark: '#6E5234', lock: '#FFE45C' },
  door_shop: { frame: '#2A2219', wood: '#5E7A3A', dark: '#3E5A2A', lock: '#F2A0A8' },
};

function makeTiles(scene) {
  // Fixed seed: tiles look the same every run. Run randomness only decides placement.
  const rng = new Rng(20261018);

  for (let v = 0; v < 4; v++) {
    paint(scene, `grass${v}`, TILE, TILE, ({ rect, px }) => {
      rect(0, 0, TILE, TILE, GRASS.base);
      for (let i = 0; i < 10; i++) px(rng.int(0, 15), rng.int(0, 15), GRASS.dark);
      for (let i = 0; i < 4; i++) {
        const x = rng.int(0, 15);
        const y = rng.int(1, 15);
        rect(x, y - 1, 1, 2, GRASS.light);
      }
      if (v === 3) {
        rect(5, 6, 6, 4, GRASS.dirt);
        rect(4, 7, 8, 2, GRASS.dirt);
        rect(5, 9, 6, 1, GRASS.dirtDark);
      }
    });
  }

  const drawHedge = ({ rect, px }, height) => {
    rect(0, 0, TILE, height, HEDGE.base);
    for (let i = 0; i < 6; i++) rect(rng.int(0, 13), rng.int(0, height - 2), 3, 2, HEDGE.dark);
    for (let i = 0; i < 6; i++) px(rng.int(0, 15), rng.int(0, height - 1), HEDGE.light);
  };

  for (let v = 0; v < 3; v++) {
    paint(scene, `hedge${v}`, TILE, TILE, (p) => drawHedge(p, TILE));
  }

  // Top wall: hedge seen from above, with the front face of a picket fence.
  paint(scene, 'wall_top', TILE, TILE, (p) => {
    drawHedge(p, 10);
    p.rect(0, 10, TILE, 6, FENCE.gap);
    for (const x of [0, 4, 8, 12]) {
      p.rect(x, 10, 3, 6, FENCE.picket);
      p.px(x + 1, 9, FENCE.picket);
      p.rect(x + 2, 11, 1, 5, FENCE.shade);
    }
  });

  // Closed wooden garden gates, drawn for the top wall and rotated for the others.
  for (const [key, gate] of Object.entries(GATES)) {
    paint(scene, key, TILE, TILE, ({ rect }) => {
      rect(0, 0, TILE, TILE, gate.frame);
      rect(1, 1, 14, 15, gate.wood);
      for (const x of [4, 8, 12]) rect(x, 1, 1, 15, gate.dark);
      rect(1, 4, 14, 2, gate.dark);
      rect(1, 11, 14, 2, gate.dark);
      rect(7, 7, 2, 3, gate.lock);
    });
  }

  // Open gateway: a dirt path between two posts.
  paint(scene, 'door_open', TILE, TILE, ({ rect }) => {
    rect(0, 0, TILE, TILE, GRASS.dark);
    rect(4, 0, 8, TILE, GRASS.dirt);
    rect(5, 0, 1, TILE, GRASS.dirtDark);
    rect(0, 0, 2, TILE, GATES.door.dark);
    rect(14, 0, 2, TILE, GATES.door.dark);
  });

  // Soft golden glow behind the treasure pedestal.
  paint(scene, 'glow', 40, 40, ({ ctx }) => {
    const gradient = ctx.createRadialGradient(20, 20, 2, 20, 20, 20);
    gradient.addColorStop(0, 'rgba(242, 201, 76, 0.5)');
    gradient.addColorStop(1, 'rgba(242, 201, 76, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 40, 40);
  });

  // Soft dark vignette around the room edges.
  const width = TILE * ROOM_COLS;
  const height = TILE * ROOM_ROWS;
  paint(scene, 'vignette', width, height, ({ ctx }) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.62);
    gradient.addColorStop(0, 'rgba(10, 6, 14, 0)');
    gradient.addColorStop(1, 'rgba(10, 6, 14, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

export function makeTextures(scene) {
  fromMap(scene, 'mochi', mochi(LEAVES_PERKY), MOCHI_PALETTE);
  fromMap(scene, 'mochi_hurt', mochi(LEAVES_PERKY, HURT_EYES), MOCHI_PALETTE);
  fromMap(scene, 'mochi_wilt', mochi(LEAVES_WILT), MOCHI_PALETTE);
  fromMap(scene, 'mochi_wilt_hurt', mochi(LEAVES_WILT, HURT_EYES), MOCHI_PALETTE);
  fromMap(scene, 'mochi_bare', mochi(LEAVES_NONE, HURT_EYES), MOCHI_PALETTE);

  fromMap(scene, 'gloom_slug', GLOOM_SLUG.rows, GLOOM_SLUG.palette);

  for (const group of [SMALL, SHOTS, ICONS, PICKUPS]) {
    for (const [key, sprite] of Object.entries(group)) fromMap(scene, key, sprite.rows, sprite.palette);
  }
  for (const [key, rows] of Object.entries(HEARTS)) fromMap(scene, key, rows, HEART_PALETTE);

  makeTiles(scene);
}
