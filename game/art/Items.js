import { paint } from './Pixels.js';

// Player shots, item icons, pickups, hearts and skill icons.
//
// Shot designs are drawn in a 10x10 unit box scaled by `u`: u = 1 makes the 10px shot,
// u = 2.4 makes the 24px icon for the item that gives that shot.

function pen(c, u) {
  const s = (v) => v * u;
  return {
    e: (x, y, rx, ry, col) => c.ellipse(s(x), s(y), s(rx), s(ry), col),
    o: (x, y, r, col) => c.circle(s(x), s(y), s(r), col),
    r: (x, y, w, h, col) => c.rect(Math.round(s(x)), Math.round(s(y)), Math.max(1, Math.round(s(w))), Math.max(1, Math.round(s(h))), col),
    p: (pts, col) => c.poly(pts.map(([x, y]) => [s(x), s(y)]), col),
    l: (x0, y0, x1, y1, col, w = 1) => c.line(s(x0), s(y0), s(x1), s(y1), col, Math.max(1, Math.round(w * u))),
    path: (pts, col, w = 1) => c.path(pts.map(([x, y]) => [s(x), s(y)]), col, Math.max(1, Math.round(w * u))),
    in: (fn) => c.inside(fn),
    blob: (x, y, rx, ry, colors) => c.blob(s(x), s(y), s(rx), s(ry), colors),
  };
}

// A plain seed in the given colours.
const seed = (colors) => (P) => {
  P.blob(5, 5.5, 3.4, 4.3, colors);
  P.r(3.5, 3, 1, 1, '#FFFFFF');
};

const SHOTS = {
  seed: seed({ base: '#8BC86A', dark: '#3F7A2A' }),
  seed_fire: (P) => {
    P.p([[2.5, 4], [3.5, 0.8], [4.6, 3], [5.5, 0.3], [6.5, 3], [7.5, 1], [7.6, 4.5]], '#FFD23F');
    P.blob(5, 6, 3.4, 3.8, { base: '#FF8A3D', dark: '#B5501F' });
    P.e(5, 6.5, 1.5, 2, '#FFD23F');
  },
  seed_frost: (P) => {
    P.blob(5, 5.5, 3.4, 4.3, { base: '#A8E0FF', dark: '#4A90C2' });
    P.l(5, 3, 5, 8, '#FFFFFF', 0.8);
    P.l(2.8, 5.5, 7.2, 5.5, '#FFFFFF', 0.8);
  },
  pollen: (P) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      P.o(5 + Math.cos(a) * 3.8, 5 + Math.sin(a) * 3.8, 1, '#FFF4B8');
    }
    P.blob(5, 5, 3, 3, { base: '#FFE45C', dark: '#E0A030' });
  },
  dewdrop: (P) => {
    P.p([[5, 0.5], [2, 5.5], [8, 5.5]], '#2E7FA8');
    P.o(5, 6.3, 3.2, '#2E7FA8');
    P.in(() => {
      P.p([[5, 1.5], [2.6, 5.5], [7.2, 5.5]], '#5EC8F2');
      P.o(4.8, 6.1, 2.7, '#5EC8F2');
    });
    P.r(3.5, 5, 1, 1.5, '#FFFFFF');
  },
  seed_thorn: (P) => {
    for (const [x0, y0, x1, y1] of [[5, 1, 5, -0.2], [5, 9, 5, 10.2], [1.4, 5.5, 0, 5.5], [8.6, 5.5, 10, 5.5]]) P.l(x0, y0, x1, y1, '#C9C3A1', 1);
    P.blob(5, 5.5, 3.4, 4.1, { base: '#2E5A2A', dark: '#1F3D1C' });
    P.r(3.5, 3, 1, 1, '#7FB060');
  },
  seed_homing: (P) => {
    P.blob(5, 5.5, 3.4, 4.3, { base: '#9B7BD8', dark: '#4A2E6A' });
    P.o(5, 5.5, 1.6, '#FFFFFF');
    P.o(5.3, 5.5, 0.8, '#2C2C2A');
  },
  seed_pumpkin: (P) => {
    P.r(4.5, 0.8, 1.3, 2.2, '#3F7A2A');
    P.blob(5, 6, 4.2, 3.6, { base: '#E8903C', dark: '#8A4A1C' });
    P.in(() => {
      P.e(3.3, 6, 0.5, 3.4, '#C2652A');
      P.e(6.7, 6, 0.5, 3.4, '#C2652A');
    });
  },
  shot_wave: (P) => {
    P.path([[1, 7], [3, 3], [5, 5], [7, 7], [9, 3]], '#6CC24A', 1.6);
    P.e(9, 2.5, 1.3, 1, '#C9F2A0');
    P.e(1, 7.5, 1.3, 1, '#C9F2A0');
  },
  shot_golden: (P) => {
    P.blob(5, 5.5, 3.4, 4.3, { base: '#F2C94C', dark: '#8A6A1C' });
    P.l(3.5, 3, 3.5, 6, '#FFF4B8', 0.8);
    P.r(3, 4, 1.8, 0.8, '#FFF4B8');
  },
  shot_nightshade: (P) => {
    P.blob(5, 6, 3.8, 3.8, { base: '#3E2A5E', dark: '#150A22', light: '#9B7BD8' });
    P.p([[3, 2], [5, 3.2], [7, 2], [5, 1]], '#3F7A2A');
  },
  shot_sprinkler: (P) => {
    for (const [x, y] of [[2.5, 6], [5, 3.5], [7.5, 6]]) {
      P.p([[x, y - 2.4], [x - 1.4, y], [x + 1.4, y]], '#2E5E7A');
      P.o(x, y + 0.4, 1.5, '#8FD3F2');
    }
  },
  shot_leaf: (P) => {
    P.p([[0.8, 9.2], [1.5, 5], [4.5, 1.8], [9, 0.8], [8.4, 5], [5, 8.4]], '#A6D987');
    P.in(() => P.p([[0.8, 9.2], [5, 5], [9, 0.8], [8.4, 5], [5, 8.4]], '#6CA850'));
    P.l(1.2, 8.8, 8.2, 1.6, '#3F7A2A', 0.7);
  },
  shot_fluff: (P) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      P.l(5, 5, 5 + Math.cos(a) * 4.4, 5 + Math.sin(a) * 4.4, '#F5F0E8', 0.7);
      P.o(5 + Math.cos(a) * 4.2, 5 + Math.sin(a) * 4.2, 0.8, '#FFFFFF');
    }
    P.o(5, 5, 1.6, '#E8D9A0');
  },
  shot_spike: (P) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      P.p([[5 + Math.cos(a - 0.35) * 3, 5 + Math.sin(a - 0.35) * 3], [5 + Math.cos(a) * 5, 5 + Math.sin(a) * 5], [5 + Math.cos(a + 0.35) * 3, 5 + Math.sin(a + 0.35) * 3]], '#5A3A22');
    }
    P.blob(5, 5, 3.4, 3.4, { base: '#A0703C', dark: '#6E4A26' });
  },
  shot_popcorn: (P) => {
    for (const [x, y, r] of [[3.3, 4, 2.4], [6.8, 3.6, 2.3], [5, 6.8, 2.6], [2.6, 7, 1.7], [7.6, 6.8, 1.8]]) P.o(x, y, r, '#FFF8E8');
    P.in(() => {
      P.o(5, 7.4, 1.2, '#F2E2B0');
      P.o(4.6, 5.2, 0.8, '#FFD23F');
      P.o(7.2, 4.4, 0.7, '#FFD23F');
    });
  },
  shot_thistle: (P) => {
    P.e(5, 7.5, 2.4, 2, '#5E9C3A');
    P.e(5, 4, 3, 2.6, '#7A5AB8');
    P.in(() => P.e(4.3, 3.2, 1.4, 1.1, '#B8A0E8'));
    for (const [x, y] of [[0.8, 1.5], [9.2, 1.5], [0.8, 8.5], [9.2, 8.5]]) P.r(x - 0.5, y - 0.5, 1, 1, '#FFE45C');
  },
  shot_acorn: (P) => {
    P.blob(5, 6.4, 3.1, 3.4, { base: '#C98A4A', dark: '#8A5A2A' });
    P.e(5, 3.4, 3.9, 2.1, '#5A3A22');
    P.in(() => P.e(4.4, 2.8, 2.6, 1.1, '#7A5232'));
    P.r(4.6, 0.6, 0.9, 1.3, '#5A3A22');
  },
  shot_radish: (P) => {
    P.p([[3.6, 3.6], [2, 0.5], [4.6, 2.6], [5, 0.2], [5.6, 2.6], [8, 0.5], [6.4, 3.6]], '#5E9C3A');
    P.blob(5, 5.6, 3.2, 3, { base: '#E05A2A', dark: '#A03A1A', light: '#FF9A6A' });
    P.p([[4, 8], [6, 8], [5, 10]], '#F3E9DC');
  },
  shot_catnip: (P) => {
    P.l(5, 9.5, 5, 4, '#3F7A2A', 0.8);
    P.e(3, 5, 2.4, 1.4, '#7FCF5A');
    P.e(7, 4.2, 2.4, 1.4, '#7FCF5A');
    P.e(5, 2, 1.8, 1.8, '#9BE070');
    P.in(() => P.e(5, 1.6, 0.8, 0.8, '#C9F2A0'));
  },
  shot_ghost: (P) => {
    P.o(5, 4.5, 3.6, '#E8F0FF');
    P.p([[1.4, 4.5], [8.6, 4.5], [8.6, 9], [7.2, 8], [5.8, 9], [4.4, 8], [3, 9], [1.4, 8]], '#E8F0FF');
    P.r(3.3, 3.8, 1, 1.6, '#4A4A6A');
    P.r(5.8, 3.8, 1, 1.6, '#4A4A6A');
  },
};

// Items that change your shots use their shot's design as the icon.
const SHOT_ITEM_ICONS = {
  fire_seed: 'seed_fire',
  frost_seed: 'seed_frost',
  bouncing_pollen: 'pollen',
  dewdrop: 'dewdrop',
  thorn_seed: 'seed_thorn',
  homing_spore: 'seed_homing',
  pumpkin_seed: 'seed_pumpkin',
  wiggle_vine: 'shot_wave',
  boomerang_leaf: 'shot_leaf',
  dandelion_puff: 'shot_fluff',
  hedgehog_seed: 'shot_spike',
  popcorn_kernel: 'shot_popcorn',
  nightshade_berry: 'shot_nightshade',
  static_thistle: 'shot_thistle',
  acorn: 'shot_acorn',
  sprinkler_head: 'shot_sprinkler',
  rocket_radish: 'shot_radish',
  catnip: 'shot_catnip',
  golden_kernel: 'shot_golden',
  ghost_pepper: 'shot_ghost',
};

// Icons for the stat items, in the same 10x10 unit box.
const ICONS = {
  icon_bone_meal: (P) => {
    P.l(2.6, 7.4, 7.4, 2.6, '#F3E9DC', 2);
    for (const [x, y] of [[1.6, 7], [3, 8.4], [7, 1.6], [8.4, 3]]) P.o(x, y, 1.4, '#F3E9DC');
    P.in(() => P.l(3, 7.6, 7.6, 3, '#C9B89A', 0.6));
  },
  icon_sun_drop: (P) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      P.l(5 + Math.cos(a) * 3.2, 5 + Math.sin(a) * 3.2, 5 + Math.cos(a) * 4.7, 5 + Math.sin(a) * 4.7, '#F2C94C', 0.9);
    }
    P.blob(5, 5, 2.7, 2.7, { base: '#FFD23F', dark: '#C98A2E', light: '#FFF4B8' });
  },
  icon_watering_can: (P) => {
    P.path([[2.4, 4.4], [3.2, 2], [5.6, 2], [6.4, 4.4]], '#2E5E7A', 0.8);
    P.p([[7, 6.4], [9.4, 3], [9.9, 3.6], [7.6, 7.6]], '#4A8CAA');
    P.blob(4.4, 6.6, 3, 2.8, { base: '#5EA8C8', dark: '#2E5E7A', light: '#A8DCEE' });
    P.r(9.3, 4.4, 0.7, 0.7, '#A8DCEE');
  },
  icon_bee_wings: (P) => {
    P.e(3, 3.4, 2.6, 1.9, '#D6F2EA');
    P.e(7, 3.4, 2.6, 1.9, '#D6F2EA');
    P.blob(5, 6.6, 2.2, 3, { base: '#FFE45C', dark: '#E0A030' });
    P.in(() => {
      P.r(2.5, 5.6, 5, 0.8, '#2C2C2A');
      P.r(2.5, 7.4, 5, 0.8, '#2C2C2A');
    });
  },
  icon_big_leaf: (P) => {
    P.p([[0.6, 9.4], [1.4, 4.6], [4.4, 1.4], [9.4, 0.6], [8.8, 5], [5.4, 8.6]], '#8BC86A');
    P.in(() => P.p([[0.6, 9.4], [5, 5], [9.4, 0.6], [8.8, 5], [5.4, 8.6]], '#6CA850'));
    P.l(1, 9, 8.6, 1.4, '#3F7A2A', 0.6);
    P.l(4, 6, 2.6, 3.4, '#3F7A2A', 0.5);
    P.l(6, 4, 8, 4.6, '#3F7A2A', 0.5);
  },
  icon_twin_sprout: (P) => {
    P.l(3.4, 6, 3.4, 2.6, '#3F7A2A', 0.7);
    P.l(6.6, 6, 6.6, 2.6, '#3F7A2A', 0.7);
    P.e(2.2, 2.4, 1.6, 1, '#8BC86A');
    P.e(7.8, 2.4, 1.6, 1, '#A6D987');
    P.p([[2, 6], [8, 6], [7.2, 9.6], [2.8, 9.6]], '#B8643C');
    P.in(() => P.r(2, 6, 6, 1, '#D88A5C'));
  },
  icon_lucky_clover: (P) => {
    P.l(5, 5, 6.6, 9.4, '#3F7A2A', 0.7);
    for (const [x, y] of [[3.2, 3.2], [6.8, 3.2], [3.2, 6.8], [6.8, 6.8]]) P.o(x, y, 2.1, '#5FAF4A');
    P.in(() => {
      for (const [x, y] of [[2.6, 2.6], [6.2, 2.6]]) P.o(x, y, 0.9, '#8BD86A');
    });
  },
  icon_honey_pot: (P) => {
    P.blob(5, 6.4, 3.8, 3.3, { base: '#C98A4A', dark: '#8A5A2A', light: '#E0A86A' });
    P.r(2, 2.4, 6, 1.6, '#6E4A1E');
    P.e(5, 2.4, 3, 1, '#FFD23F');
    P.e(6.6, 4.4, 0.7, 1.2, '#FFD23F');
    P.in(() => P.r(3.4, 5.6, 3.2, 2, '#F3E9DC'));
  },
  icon_morning_dew: (P) => {
    for (const [x, y, k] of [[3, 3.4, 1], [7, 4.2, 0.8], [4.6, 7.2, 0.9]]) {
      P.p([[x, y - 2.4 * k], [x - 1.6 * k, y + 0.2], [x + 1.6 * k, y + 0.2]], '#5EC8F2');
      P.o(x, y + 0.6 * k, 1.7 * k, '#5EC8F2');
      P.r(x - 0.8 * k, y, 0.6, 0.8, '#C9F2FF');
    }
  },
  icon_gloves: (P) => {
    for (const x of [2.6, 4.2, 5.8]) P.e(x + 0.4, 2.6, 0.8, 1.8, '#6CC24A');
    P.e(8, 4.6, 1.8, 0.9, '#6CC24A');
    P.blob(5, 5.2, 3, 2.6, { base: '#6CC24A', dark: '#3F7A2A' });
    P.r(2.4, 7, 5.2, 2.4, '#C9C3A1');
  },
  icon_snail_shell: (P) => {
    P.blob(5, 5, 4, 4, { base: '#C98A4A', dark: '#8A5A2A' });
    P.path([[5, 5], [6, 4.6], [6.2, 6], [4.6, 6.6], [3.6, 5], [4.6, 3.2], [7, 3.2], [8, 5.4]], '#5A3A22', 0.6);
  },
  icon_grasshopper: (P) => {
    P.path([[3.4, 6], [2, 8.6], [1, 9.4]], '#3F7A2A', 0.7);
    P.path([[6, 6.2], [7.6, 3.6], [9.2, 9]], '#3F7A2A', 0.8);
    P.blob(4.6, 5, 3.4, 1.8, { base: '#6CC24A', dark: '#3F7A2A' });
    P.o(8.2, 4.2, 1.4, '#6CC24A');
    P.r(8.3, 3.7, 0.7, 0.7, '#2C2C2A');
    P.l(8.6, 3, 9.6, 0.6, '#3F7A2A', 0.4);
  },
  icon_fertilizer: (P) => {
    P.p([[2.2, 2.2], [7.8, 2.2], [8.6, 9.4], [1.4, 9.4]], '#A88A5E');
    P.in(() => {
      P.p([[6.4, 2.2], [7.8, 2.2], [8.6, 9.4], [7, 9.4]], '#8A6E44');
      P.e(5, 6.2, 1.8, 1, '#5E9C3A');
      P.l(5, 7.6, 5, 5.4, '#3F7A2A', 0.5);
    });
    P.r(2.6, 1.2, 4.8, 1.2, '#6E5A3A');
  },
  icon_scarecrow_hat: (P) => {
    P.e(5, 7.4, 4.6, 1.6, '#C9A25A');
    P.p([[3, 7.4], [3.6, 2.4], [6.4, 2.4], [7, 7.4]], '#D9B46A');
    P.in(() => P.r(3, 5.4, 4, 1.2, '#B8402A'));
    P.l(2.4, 2, 3.4, 3.6, '#E8D08A', 0.5);
  },
  icon_piggy_bank: (P) => {
    P.e(3.6, 3.2, 1.2, 1.2, '#E07A8A');
    P.blob(5, 5.6, 4, 3, { base: '#F2A0A8', dark: '#D07080', light: '#FFD0D4' });
    for (const x of [2.6, 6.6]) P.r(x, 8, 1.2, 1.6, '#D07080');
    P.e(8.6, 5.6, 1, 1.2, '#E07A8A');
    P.r(4, 2.6, 2.4, 0.6, '#5A1E2A');
    P.r(6.4, 4.6, 0.7, 0.7, '#2C2C2A');
  },
  icon_sweet_nectar: (P) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      P.o(4 + Math.cos(a) * 2, 4 + Math.sin(a) * 2, 1.6, '#FFA040');
    }
    P.o(4, 4, 1.3, '#FFE45C');
    P.p([[8, 5.2], [6.8, 8], [9.2, 8]], '#FFD23F');
    P.o(8, 8.2, 1.2, '#FFD23F');
  },
  icon_cactus_water: (P) => {
    P.p([[5, 4.6], [2.6, 8.4], [7.4, 8.4]], '#5EC8F2');
    P.o(5, 8.2, 2.4, '#5EC8F2');
    P.in(() => P.r(3.4, 7.2, 0.8, 1, '#C9F2FF'));
    P.r(4.2, 0.6, 1.6, 4.4, '#5E9C3A');
    P.r(2.6, 1.8, 1.2, 1.8, '#5E9C3A');
    P.r(6.2, 1.4, 1.2, 1.8, '#5E9C3A');
  },
};

const SHOT_OUTLINE = '#1E1418';

function paintShotsAndIcons(scene, itemDefs) {
  for (const [key, design] of Object.entries(SHOTS)) paint(scene, key, 10, 10, (c) => design(pen(c, 1)), { outline: SHOT_OUTLINE });
  for (const [key, design] of Object.entries(ICONS)) paint(scene, key, 24, 24, (c) => design(pen(c, 2.4)));
  for (const [itemId, shot] of Object.entries(SHOT_ITEM_ICONS)) {
    if (itemDefs[itemId]) paint(scene, itemDefs[itemId].icon, 24, 24, (c) => SHOTS[shot](pen(c, 2.4)));
  }
}

// ---------- Pickups ----------

function heart(c, fill) {
  const red = '#E25C4B';
  const empty = '#3B2B33';
  const shape = (col) => {
    c.circle(4.5, 4.5, 4, col);
    c.circle(11.5, 4.5, 4, col);
    c.poly([[0.6, 5.5], [15.4, 5.5], [8, 13.5]], col);
  };
  shape(empty);
  if (fill === 0) return;
  c.inside(() => {
    if (fill === 2) shape(red);
    else c.rect(0, 0, 8, 14, red);
    c.rect(3, 3, 2, 2, '#FFB3A3');
  });
}

function paintPickups(scene) {
  paint(scene, 'heart_full', 16, 14, (c) => heart(c, 2), { outline: '#5A1E2A' });
  paint(scene, 'heart_half', 16, 14, (c) => heart(c, 1), { outline: '#5A1E2A' });
  paint(scene, 'heart_empty', 16, 14, (c) => heart(c, 0), { outline: '#5A1E2A' });

  paint(scene, 'coin', 12, 12, (c) => {
    c.circle(6, 6, 6, '#C98A2E');
    c.circle(5.5, 5.5, 4.6, '#F2C94C');
    c.rect(4, 3, 2, 4, '#FFF4B8');
  }, { outline: '#5C3A12' });
  paint(scene, 'bomb', 18, 20, (c) => {
    c.path([[9, 5], [11, 2], [14, 2]], '#C9A27A', 2);
    c.circle(15, 1.5, 2, '#FFD23F');
    c.px(15, 1, '#FF8A3D');
    c.rect(7, 3, 5, 3, '#2A2430');
    c.blob(9, 12, 8, 8, { base: '#3B3340', dark: '#1F1A24', light: '#7A6A8F' });
  });
  paint(scene, 'key', 20, 12, (c) => {
    c.circle(5, 6, 5, '#F2C94C');
    c.circle(5, 6, 2, '#C98A2E');
    c.rect(9, 4.5, 11, 3, '#F2C94C');
    c.rect(14, 7, 2, 3, '#F2C94C');
    c.rect(18, 7, 2, 4, '#F2C94C');
    c.rect(3, 2, 2, 2, '#FFF4B8');
  }, { outline: '#5C3A12' });

  // The shopkeeper: a pink worm poking out of a hole.
  paint(scene, 'worm', 26, 30, (c) => {
    c.ellipse(13, 27, 13, 3, '#1A140F');
    c.ellipse(13, 18, 7, 9, '#E07A8A');
    c.inside(() => {
      c.ellipse(12, 17, 6, 8, '#F2A0A8');
      for (const y of [16, 20, 24]) c.rect(5, y, 16, 1, '#E07A8A');
    });
    c.circle(13, 9, 7, '#F2A0A8');
    c.rect(9, 7, 2, 3, '#2C2C2A');
    c.rect(15, 7, 2, 3, '#2C2C2A');
    c.ellipse(8, 11.5, 1.6, 1, '#E07A8A');
    c.ellipse(18, 11.5, 1.6, 1, '#E07A8A');
    c.path([[10, 12], [13, 14], [16, 12]], '#8A3B4A', 1);
  }, { outline: '#5A2A34' });
}

// ---------- Skill icons ----------

function paintSkillIcons(scene) {
  paint(scene, 'icon_burger', 16, 13, (c) => {
    c.ellipse(8, 4, 8, 4, '#E0A040', { bottom: 4 });
    c.rect(1, 3, 2, 1, '#FFF4B8');
    c.rect(5, 2, 2, 1, '#FFF4B8');
    c.rect(0, 5, 16, 2, '#6CC24A');
    c.rect(0, 7, 16, 3, '#7A3E20');
    c.rect(0, 10, 16, 3, '#E0A040');
  }, { outline: '#3A1E10' });
  paint(scene, 'icon_cat', 16, 14, (c) => {
    c.poly([[1, 6], [2, 0], [6, 4]], '#E8903C');
    c.poly([[10, 4], [14, 0], [15, 6]], '#2C2C2A');
    c.ellipse(8, 8.5, 7.5, 5.5, '#F5F0E8');
    c.rect(4, 7, 2, 2, '#7FCF5A');
    c.rect(10, 7, 2, 2, '#7FCF5A');
    c.rect(7, 10, 2, 1, '#F7AEC0');
  }, { outline: '#3A2E2A' });
}

export function makeItemTextures(scene, itemDefs) {
  paintShotsAndIcons(scene, itemDefs);
  paintPickups(scene);
  paintSkillIcons(scene);
}
