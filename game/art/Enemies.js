import { paint } from './Pixels.js';

// Enemies and bosses: cool, muted colours with glowing eyes or tiny teeth. Side-on enemies face
// right (flipped in code). Most bosses are a bigger, fancier version of a regular enemy: each
// design takes a size factor `k`, and is drawn at that size so the outline stays 2px.

const ENEMY_OUTLINE = '#1A1420';

const crown = (c, cx, top, k, gem = '#E0457B') => {
  const w = 7 * k;
  c.poly([[cx - w, top + 5 * k], [cx - w, top + 1 * k], [cx - w / 2, top + 3 * k], [cx, top], [cx + w / 2, top + 3 * k], [cx + w, top + 1 * k], [cx + w, top + 5 * k]], '#F2C94C');
  c.inside(() => c.rect(cx - w, top + 4 * k, w * 2, 1.2 * k, '#C98A2E'));
  c.circle(cx, top + 3 * k, 1.1 * k, gem);
};

// ---------- Gloom Slug (and Mother Gloom Slug) ----------

function slug(c, k, { mother = false } = {}) {
  const C = { base: '#7A6A8F', dark: '#4E4260', light: '#C9BEDA', foot: '#A99BBD', eye: '#FFE45C', stalk: '#4E4260' };
  const y0 = mother ? 4 * k : 0;
  // Eye stalks behind the head.
  c.line(28 * k, y0 + 12 * k, 27 * k, y0 + 5 * k, C.stalk, Math.max(2, Math.round(1.5 * k)));
  c.line(32 * k, y0 + 12 * k, 34 * k, y0 + 5 * k, C.stalk, Math.max(2, Math.round(1.5 * k)));
  c.circle(27 * k, y0 + 4.5 * k, 2.2 * k, C.eye);
  c.circle(34 * k, y0 + 4.5 * k, 2.2 * k, C.eye);
  c.circle(27.5 * k, y0 + 4.5 * k, 0.8 * k, '#7A5A10');
  c.circle(34.5 * k, y0 + 4.5 * k, 0.8 * k, '#7A5A10');
  // Body: a long low blob with a raised head.
  c.ellipse(18 * k, y0 + 18 * k, 16 * k, 6.5 * k, C.dark);
  c.ellipse(30 * k, y0 + 15 * k, 7 * k, 6 * k, C.dark);
  c.inside(() => {
    c.ellipse(17.5 * k, y0 + 17 * k, 15.5 * k, 5.5 * k, C.base);
    c.ellipse(29.5 * k, y0 + 14 * k, 6.5 * k, 5 * k, C.base);
    c.ellipse(14 * k, y0 + 14 * k, 6 * k, 1.8 * k, C.light);
    c.rect(2 * k, y0 + 21.5 * k, 34 * k, 4 * k, C.foot);
  });
  c.rect(33 * k, y0 + 17 * k, 2 * k, Math.max(2, k), '#2C2C2A');
  if (mother) crown(c, 20 * k, y0 + 7.5 * k, k * 0.8);
}

// ---------- Grumpshroom (and Grandshroom) ----------

function shroom(c, k, { grand = false } = {}) {
  const red = { base: '#C2413B', dark: '#7A2420', light: '#E86A5E' };
  const stem = { base: '#F3E9DC', dark: '#D9C4A6' };
  const cx = 16 * k;
  // Stem with an angry face.
  c.ellipse(cx, 22 * k, 9 * k, 9 * k, stem.dark);
  c.inside(() => c.ellipse(cx - 1 * k, 21 * k, 8 * k, 8 * k, stem.base));
  c.rect(7.5 * k, 28 * k, 5 * k, 3.5 * k, '#A8916E');
  c.rect(19.5 * k, 28 * k, 5 * k, 3.5 * k, '#A8916E');
  c.line(9 * k, 17 * k, 13.5 * k, 19 * k, '#2C2C2A', Math.max(2, Math.round(k)));
  c.line(23 * k, 17 * k, 18.5 * k, 19 * k, '#2C2C2A', Math.max(2, Math.round(k)));
  c.rect(10.5 * k, 20 * k, 2 * k, 2.5 * k, '#2C2C2A');
  c.rect(19.5 * k, 20 * k, 2 * k, 2.5 * k, '#2C2C2A');
  c.path([[12 * k, 26.5 * k], [14 * k, 25 * k], [18 * k, 25 * k], [20 * k, 26.5 * k]], '#6B2F2E', Math.max(2, Math.round(k)));
  if (grand) {
    // A big grey moustache.
    c.ellipse(13 * k, 24 * k, 3.5 * k, 1.6 * k, '#C9C3B8');
    c.ellipse(19 * k, 24 * k, 3.5 * k, 1.6 * k, '#C9C3B8');
  }
  // Cap over the top of the stem.
  c.ellipse(cx, 12 * k, 15 * k, 10 * k, red.dark, { bottom: 14 * k });
  c.inside(() => {
    c.ellipse(cx - 1 * k, 11 * k, 14 * k, 9 * k, red.base);
    c.ellipse(9 * k, 5 * k, 4 * k, 2 * k, red.light);
    c.circle(8 * k, 9 * k, 2.4 * k, '#F3E9DC');
    c.circle(19 * k, 5 * k, 2 * k, '#F3E9DC');
    c.circle(24 * k, 10 * k, 2 * k, '#F3E9DC');
    c.circle(14 * k, 11 * k, 1.4 * k, '#F3E9DC');
  });
  c.rect(1.5 * k, 13 * k, 29 * k, 1.6 * k, red.dark);
}

// ---------- Click Beetle (and Beetle Baron) ----------

function beetle(c, k, { baron = false } = {}) {
  const shell = baron ? { base: '#4A2E6A', dark: '#2A1A40', light: '#8E6AC8' } : { base: '#1F5C5C', dark: '#0F3333', light: '#4FA3A3' };
  const y0 = baron ? 3 * k : 0;
  // Legs, then the shell and head over them.
  const legW = Math.max(2, Math.round(k));
  for (const [x, dx] of [[8, -3], [14, -1], [20, 2]]) c.line(x * k, y0 + 15 * k, (x + dx) * k, y0 + 20 * k, '#2C2C2A', legW);
  c.ellipse(28 * k, y0 + 12 * k, 5.5 * k, 4.5 * k, shell.dark);
  c.inside(() => c.ellipse(27.5 * k, y0 + 11.5 * k, 4.5 * k, 3.5 * k, shell.base));
  c.circle(30 * k, y0 + 11 * k, 1.5 * k, '#FF6B6B');
  if (baron) {
    // A big curved horn.
    c.poly([[31 * k, y0 + 9 * k], [37 * k, y0 + 2 * k], [35 * k, y0 + 10 * k]], '#C9C3A1');
  } else {
    c.rect(32 * k, y0 + 13 * k, 2 * k, 1.5 * k, '#2C2C2A');
  }
  c.ellipse(15 * k, y0 + 11 * k, 13 * k, 7 * k, shell.dark);
  c.inside(() => {
    c.ellipse(14.5 * k, y0 + 10 * k, 12.5 * k, 6 * k, shell.base);
    c.ellipse(11 * k, y0 + 6.5 * k, 6 * k, 1.8 * k, shell.light);
    c.line(4 * k, y0 + 11 * k, 26 * k, y0 + 11 * k, shell.dark, Math.max(2, Math.round(k)));
  });
  if (baron) crown(c, 27 * k, y0 + 3 * k, k * 0.6, '#7FCF5A');
}

// ---------- Thornvine (closed and open) ----------

// A twisting vine with thorns, a bud on top and a mound of dirt at the base.
function vine(c, x, top, bottom, k = 1) {
  const green = '#2E5A2A';
  const light = '#4C7A3A';
  const pts = [];
  for (let y = bottom; y >= top; y -= 2) pts.push([x + Math.sin((y - top) * 0.25) * 3 * k, y]);
  c.path(pts, green, Math.round(4 * k));
  c.path(pts.map(([px, py]) => [px - 1, py]), light, Math.max(1, Math.round(k)));
  for (let i = 3; i < pts.length - 1; i += 3) {
    const [px, py] = pts[i];
    const side = i % 2 ? 1 : -1;
    c.poly([[px + side * 2 * k, py - 1], [px + side * 5 * k, py - 2 * k], [px + side * 2 * k, py + 1 * k]], '#C9C3A1');
  }
}

function bud(c, cx, cy, k, open) {
  const C = { base: '#6B2F4E', dark: '#4A1E36', light: '#8A4064' };
  if (!open) {
    c.ellipse(cx, cy, 6 * k, 6.5 * k, C.dark);
    c.inside(() => {
      c.ellipse(cx - 0.5 * k, cy - 0.5 * k, 5.2 * k, 5.8 * k, C.base);
      c.line(cx, cy - 6 * k, cx, cy + 6 * k, C.dark, Math.max(1, Math.round(k)));
      c.ellipse(cx - 2.5 * k, cy - 3 * k, 1.6 * k, 2 * k, C.light);
    });
    return;
  }
  // Open: two petals peeled back around a pink, toothy mouth.
  c.ellipse(cx - 5 * k, cy - 1 * k, 3.5 * k, 6 * k, C.base);
  c.ellipse(cx + 5 * k, cy - 1 * k, 3.5 * k, 6 * k, C.base);
  c.ellipse(cx, cy, 5 * k, 4.5 * k, '#E0457B');
  c.inside(() => c.ellipse(cx, cy + 1 * k, 3 * k, 2.5 * k, '#8A1E47'));
  for (const dx of [-3, 0, 3]) c.rect(cx + dx * k - 0.5 * k, cy - 4 * k, Math.max(1, k), 2 * k, '#FFFFFF');
}

function thornvine(c, open) {
  c.ellipse(13, 33, 11, 3.5, '#1F1A14');
  vine(c, 13, 12, 32);
  bud(c, 13, 8, 1, open);
}

// ---------- Hexed Gnome (and the Gnome King) ----------

function gnome(c, k, { king = false } = {}) {
  const hat = { base: '#4A5F8C', dark: '#2E3B5C', light: '#7A8FBC' };
  const cx = 14 * k;
  const y0 = 0;
  // Coat and boots.
  c.rect(cx - 7 * k, y0 + 40 * k, 6 * k, 4 * k, '#3B3B3B');
  c.rect(cx + 1 * k, y0 + 40 * k, 6 * k, 4 * k, '#3B3B3B');
  c.ellipse(cx, y0 + 34 * k, 10 * k, 8 * k, '#5E3A34');
  c.inside(() => {
    c.ellipse(cx - 1 * k, y0 + 33 * k, 9 * k, 7 * k, '#8C5A50');
    c.rect(cx - 10 * k, y0 + 37 * k, 20 * k, 1.6 * k, '#3B3B3B');
  });
  // Face, white beard, glowing purple eyes.
  c.ellipse(cx, y0 + 23 * k, 7.5 * k, 5.5 * k, '#D9A88A');
  c.poly([[cx - 8 * k, y0 + 24 * k], [cx + 8 * k, y0 + 24 * k], [cx + 5 * k, y0 + 34 * k], [cx, y0 + 38 * k], [cx - 5 * k, y0 + 34 * k]], '#E8E4DA');
  c.inside(() => c.poly([[cx + 2 * k, y0 + 26 * k], [cx + 8 * k, y0 + 24 * k], [cx + 5 * k, y0 + 34 * k], [cx, y0 + 38 * k]], '#C9C3B8'));
  c.circle(cx, y0 + 25 * k, 2.2 * k, '#C98A70');
  c.rect(cx - 5 * k, y0 + 21 * k, 2.5 * k, 2 * k, '#B57BFF');
  c.rect(cx + 2.5 * k, y0 + 21 * k, 2.5 * k, 2 * k, '#B57BFF');
  // Pointy hat with a crack in the ceramic.
  c.poly([[cx, y0 + 1 * k], [cx - 9 * k, y0 + 19 * k], [cx + 9 * k, y0 + 19 * k]], hat.dark);
  c.inside(() => {
    c.poly([[cx - 0.5 * k, y0 + 2 * k], [cx - 8 * k, y0 + 18 * k], [cx + 6 * k, y0 + 18 * k]], hat.base);
    c.poly([[cx - 1 * k, y0 + 5 * k], [cx - 4 * k, y0 + 13 * k], [cx - 2.5 * k, y0 + 13 * k]], hat.light);
    c.path([[cx + 1 * k, y0 + 8 * k], [cx + 3 * k, y0 + 11 * k], [cx + 1.5 * k, y0 + 14 * k]], hat.dark, Math.max(1, Math.round(k)));
  });
  c.rect(cx - 10 * k, y0 + 18 * k, 20 * k, 2.5 * k, hat.dark);
  if (king) {
    crown(c, cx, 6 * k, k * 0.75, '#B57BFF');
    // A purple cape behind the coat.
    c.inside(() => c.rect(cx - 10 * k, y0 + 30 * k, 3 * k, 8 * k, '#6A3E8A'));
  }
}

// ---------- Bramble Hydra ----------

function brambleHydra(c) {
  // Three vines rising from one tangled root, each with a toothy open bud.
  c.ellipse(32, 60, 30, 6, '#1F1A14');
  vine(c, 14, 14, 58, 1.2);
  vine(c, 32, 8, 58, 1.3);
  vine(c, 50, 14, 58, 1.2);
  c.ellipse(32, 54, 18, 7, '#2E5A2A');
  c.inside(() => c.ellipse(30, 52, 14, 4, '#4C7A3A'));
  bud(c, 10, 10, 1.3, true);
  bud(c, 32, 6, 1.4, true);
  bud(c, 54, 10, 1.3, true);
  for (const [x, y] of [[4, 40], [60, 38], [22, 46], [44, 44]]) c.poly([[x, y], [x + 3, y - 5], [x + 6, y]], '#C9C3A1');
}

// ---------- Pumpkin King ----------

function pumpkinKing(c) {
  const P = { base: '#E8903C', dark: '#B5501F', light: '#FFB870', rib: '#C2652A' };
  // Ribbed pumpkin body.
  c.ellipse(32, 38, 28, 21, P.dark);
  c.inside(() => {
    c.ellipse(31, 36, 27, 19, P.base);
    for (const dx of [-17, -6, 6, 17]) c.ellipse(32 + dx, 38, 2, 20, P.rib);
    c.ellipse(18, 26, 6, 3, P.light);
  });
  // Glowing carved face.
  const glow = '#FFD23F';
  c.poly([[15, 30], [24, 30], [19.5, 23]], glow);
  c.poly([[40, 30], [49, 30], [44.5, 23]], glow);
  c.poly([[29, 37], [35, 37], [32, 32]], glow);
  c.poly([[12, 42], [52, 42], [48, 50], [16, 50]], glow);
  c.inside(() => {
    for (const x of [20, 30, 40]) c.rect(x, 42, 4, 3, P.base);
    for (const x of [25, 35]) c.rect(x, 47, 4, 3, P.base);
  });
  // Stem with a crown hung on it.
  c.rect(29, 12, 6, 8, '#3F7A2A');
  c.ellipse(38, 16, 6, 2.5, '#5E9C3A');
  crown(c, 32, 3, 1.4);
}

// ---------- The Weed Queen (96x96) ----------

function weedQueen(c) {
  const C = {
    stalk: '#2E3F2A',
    gownShadow: '#1F2A1C',
    leaf: '#3F5A34',
    leafLight: '#5E8050',
    petals: '#C9C3A1',
    petalEdge: '#8C866A',
    face: '#E8E4DA',
    faceEdge: '#A8A494',
    eyes: '#B57BFF',
    mouth: '#6B2F4E',
    thorns: '#6B2F4E',
    buds: '#9B5CFF',
  };
  // Gown: a widening stalk rooted into the floor.
  for (let y = 44; y < 94; y++) {
    const half = Math.round(10 + (y - 44) * 0.6);
    c.rect(48 - half, y, half * 2, 1, C.stalk);
    c.rect(48 + Math.round(half / 3), y, Math.round((half * 2) / 3), 1, C.gownShadow);
  }
  for (const [x, y] of [[40, 56], [54, 64], [34, 76], [60, 80], [46, 88], [26, 88], [68, 90]]) c.ellipse(x, y, 2, 4, C.leafLight);
  // Vine arms ending in leaf hands.
  c.path([[36, 50], [24, 58], [12, 72], [8, 78]], C.stalk, 3);
  c.path([[60, 50], [72, 58], [84, 72], [88, 78]], C.stalk, 3);
  c.ellipse(8, 80, 5, 4, C.leaf);
  c.ellipse(88, 80, 5, 4, C.leaf);
  // Dandelion head with jagged petals.
  for (let y = 4; y < 58; y++) {
    for (let x = 16; x < 80; x++) {
      const angle = Math.atan2(y - 30, x - 48);
      const r = 23 + (Math.cos(angle * 12) > 0 ? 3 : 0);
      const d = Math.hypot(x - 48, y - 30);
      if (d <= r) c.px(x, y, d > r - 2.5 ? C.petalEdge : C.petals);
    }
  }
  // Pale face, narrow glowing eyes, thin smug smile.
  c.circle(48, 30, 14, C.faceEdge);
  c.circle(47, 29, 12, C.face);
  c.rect(39, 27, 6, 2, C.eyes);
  c.rect(51, 27, 6, 2, C.eyes);
  c.rect(43, 36, 10, 2, C.mouth);
  c.rect(41, 34, 2, 2, C.mouth);
  c.rect(53, 34, 2, 2, C.mouth);
  // Crown of thorns with three purple buds.
  for (const x of [34, 48, 62]) {
    c.rect(x - 1, 6, 2, 6, C.thorns);
    c.rect(x - 3, 10, 6, 2, C.thorns);
    c.ellipse(x, 4, 3, 3, C.buds);
  }
}

// ---------- Enemy bullets: all hot pink so danger is easy to read ----------

const PINK = { base: '#E0457B', light: '#FFC2D6', dark: '#8A1E47', purple: '#B57BFF' };

function paintBullets(scene) {
  const opts = { outline: PINK.dark };
  paint(scene, 'spore', 12, 12, (c) => {
    c.circle(6, 6, 4, PINK.base);
    c.rect(4, 4, 2, 2, PINK.light);
  }, opts);
  paint(scene, 'thorn', 14, 10, (c) => {
    c.poly([[2, 2], [12, 5], [2, 8]], PINK.base);
    c.rect(3, 4, 4, 1, PINK.light);
  }, opts);
  paint(scene, 'hex_orb', 14, 14, (c) => {
    c.circle(7, 7, 5, PINK.purple);
    c.circle(7, 7, 3, PINK.base);
    c.rect(6, 6, 2, 2, PINK.light);
  }, { outline: '#4A1E5A' });
  paint(scene, 'pip', 10, 10, (c) => {
    c.ellipse(5, 5, 3, 2.5, PINK.base);
    c.rect(4, 4, 1, 1, PINK.light);
  }, opts);
}

export function makeEnemyTextures(scene) {
  const o = { outline: ENEMY_OUTLINE };
  paint(scene, 'gloom_slug', 40, 28, (c) => slug(c, 1), o);
  paint(scene, 'grumpshroom', 34, 36, (c) => shroom(c, 1), o);
  paint(scene, 'click_beetle', 38, 24, (c) => beetle(c, 1), o);
  paint(scene, 'thornvine', 28, 38, (c) => thornvine(c, false), o);
  paint(scene, 'thornvine_open', 28, 38, (c) => thornvine(c, true), o);
  paint(scene, 'hexed_gnome', 30, 48, (c) => gnome(c, 1), o);

  paint(scene, 'mother_slug', 78, 72, (c) => slug(c, 2, { mother: true }), o);
  paint(scene, 'grandshroom', 74, 80, (c) => shroom(c, 2.25, { grand: true }), o);
  paint(scene, 'gnome_king', 56, 98, (c) => gnome(c, 1.9, { king: true }), o);
  paint(scene, 'beetle_baron', 76, 58, (c) => beetle(c, 1.9, { baron: true }), o);
  paint(scene, 'bramble_hydra', 66, 68, (c) => brambleHydra(c), o);
  paint(scene, 'pumpkin_king', 66, 64, (c) => pumpkinKing(c), o);
  paint(scene, 'weed_queen', 98, 98, (c) => weedQueen(c), o);

  paintBullets(scene);
}
