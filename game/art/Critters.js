import { paint, paintScaled } from './Pixels.js';

// The regular enemies added after the first five (the 12 pests, then 16 more). Same rules as
// Enemies.js: cool or muted colours, no hot pink, side-on ones face right.

const OUTLINE = '#1A1420';

function brambleMite(c) {
  for (const [x, dx] of [[5, -3], [9, -1], [13, 1]]) c.line(x, 9, x + dx, 13, '#2C2C2A', 2);
  c.blob(10, 7, 8, 5, { base: '#6A3E3A', dark: '#4A2A28', light: '#9A6A5A' });
  c.inside(() => c.line(4, 7, 15, 7, '#4A2A28', 1));
  c.rect(15, 5, 2, 2, '#FF6B6B');
  c.poly([[17, 8], [21, 7], [18, 10]], '#C9C3A1');
}

function puffball(c) {
  c.rect(11, 20, 6, 4, '#8A8070');
  c.blob(14, 13, 12, 10, { base: '#9A8FB0', dark: '#6A5F80', light: '#C9BEDA' });
  c.inside(() => {
    for (const [x, y, r] of [[7, 9, 2], [19, 7, 1.6], [21, 15, 2], [9, 17, 1.4]]) c.circle(x, y, r, '#7A6F92');
  });
  c.rect(10, 12, 2, 3, '#2C2C2A');
  c.rect(16, 12, 2, 3, '#2C2C2A');
  c.rect(12, 17, 4, 1, '#4A3F60');
}

function acornWeevil(c) {
  for (const [x, dx] of [[6, -2], [11, 0], [16, 2]]) c.line(x, 16, x + dx, 21, '#2C2C2A', 2);
  c.blob(12, 13, 10, 7, { base: '#7A5232', dark: '#4A3020', light: '#A8805A' });
  c.inside(() => c.ellipse(9, 9, 6, 3, '#5A3A22'));
  c.circle(22, 11, 5, '#5A3A22');
  c.line(25, 11, 32, 15, '#5A3A22', 2);
  c.rect(22, 8, 2, 2, '#FFE45C');
  c.line(24, 7, 27, 3, '#5A3A22', 1);
}

function duskMoth(c) {
  const wing = '#5A4A6E';
  c.ellipse(9, 9, 8, 7, wing);
  c.ellipse(23, 9, 8, 7, wing);
  c.ellipse(10, 17, 6, 4, wing);
  c.ellipse(22, 17, 6, 4, wing);
  c.inside(() => {
    for (const x of [9, 23]) {
      c.circle(x, 9, 3.5, '#8A7AA8');
      c.circle(x, 9, 1.6, '#C9BEDA');
    }
  });
  c.ellipse(16, 12, 3, 8, '#3A2E46');
  c.line(15, 5, 12, 0, '#3A2E46', 1);
  c.line(17, 5, 20, 0, '#3A2E46', 1);
  c.rect(14, 6, 1, 2, '#FFE45C');
  c.rect(17, 6, 1, 2, '#FFE45C');
}

function mole(c) {
  c.ellipse(15, 21, 15, 3, '#4A3A2A');
  c.blob(14, 14, 13, 9, { base: '#6E6070', dark: '#4A3E4E', light: '#9A8CA0' });
  c.ellipse(26, 15, 5, 3.5, '#D9A88A');
  c.circle(30, 15, 1.8, '#8A4B5A');
  c.rect(21, 11, 2, 2, '#1A1420');
  for (const x of [20, 23, 26]) c.rect(x, 20, 2, 3, '#E8E4DA');
}

function moleMound(c) {
  c.blob(14, 8, 14, 6, { base: '#6E5A3E', dark: '#4A3A2A', light: '#8A7454' });
  c.inside(() => {
    for (const [x, y] of [[6, 7], [13, 4], [20, 6], [10, 10], [18, 10]]) c.rect(x, y, 3, 2, '#4A3A2A');
  });
}

function gardenSpider(c) {
  const leg = '#2A2234';
  for (const [x0, y0, x1, y1, x2, y2] of [[10, 10, 4, 4, 1, 14], [12, 11, 7, 7, 5, 16], [18, 11, 22, 6, 25, 16], [20, 10, 27, 3, 31, 14]]) {
    c.path([[x0, y0], [x1, y1], [x2, y2]], leg, 2);
  }
  c.blob(11, 11, 9, 7, { base: '#3A2E46', dark: '#241C2E', light: '#5A4A6E' });
  c.inside(() => {
    c.circle(10, 9, 2, '#6A5A80');
    c.circle(10, 14, 1.4, '#6A5A80');
  });
  c.circle(21, 12, 4.5, '#2A2234');
  for (const [x, y] of [[22, 10], [24, 11], [22, 13], [24, 13]]) c.rect(x, y, 1, 1, '#FF6B6B');
}

function shellBody(c) {
  c.ellipse(17, 20, 16, 3.5, '#A8A090');
  c.ellipse(28, 14, 4, 6, '#A8A090');
  c.line(28, 9, 30, 3, '#A8A090', 2);
  c.line(30, 9, 33, 4, '#A8A090', 2);
  c.rect(30, 2, 2, 2, '#2C2C2A');
  c.rect(33, 3, 2, 2, '#2C2C2A');
}

function snailShell(c, cx, cy) {
  c.blob(cx, cy, 10, 9.5, { base: '#4F7A8A', dark: '#2E4F5E', light: '#7FA8B8' });
  c.inside(() => c.path([[cx, cy], [cx + 2, cy - 1], [cx + 2, cy + 2], [cx - 2, cy + 3], [cx - 4, cy], [cx - 2, cy - 4], [cx + 3, cy - 5], [cx + 6, cy - 1]], '#2E4F5E', 2));
}

function shellSnail(c) {
  shellBody(c);
  snailShell(c, 13, 11);
}

function waspBug(c) {
  c.ellipse(15, 4, 6, 3.5, '#C9D6DA');
  c.ellipse(20, 5, 5, 3, '#E0EAEE');
  c.poly([[0, 14], [4, 12], [4, 16]], '#2C2C2A');
  c.ellipse(9, 13, 7, 5, '#B89A3A');
  c.inside(() => {
    for (const x of [6, 10]) c.rect(x, 7, 2, 12, '#2C2C2A');
  });
  c.circle(17, 11, 4, '#3A3430');
  c.circle(23, 10, 3.5, '#3A3430');
  c.rect(24, 9, 2, 2, '#FF6B6B');
  for (const x of [15, 18]) c.line(x, 15, x - 1, 19, '#2C2C2A', 1);
}

function toad(c) {
  c.ellipse(6, 21, 5, 2.5, '#3E5A32');
  c.ellipse(26, 21, 5, 2.5, '#3E5A32');
  c.blob(16, 15, 14, 8, { base: '#5E7A4A', dark: '#3E5A32', light: '#8AA070' });
  c.inside(() => {
    for (const [x, y] of [[8, 14], [13, 18], [20, 12], [24, 17], [17, 15]]) c.rect(x, y, 2, 2, '#3E5A32');
    c.rect(8, 19, 16, 1, '#2E4226');
  });
  for (const x of [10, 22]) {
    c.circle(x, 7, 3.6, '#5E7A4A');
    c.circle(x, 7, 2.2, '#E8D060');
    c.rect(x - 0.5, 6, 1, 3, '#1A1420');
  }
}

function sunflowerSentry(c) {
  c.line(15, 40, 15, 20, '#4A5A3A', 3);
  c.ellipse(9, 30, 5, 2.5, '#5E7050');
  c.ellipse(21, 26, 5, 2.5, '#5E7050');
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    c.circle(15 + Math.cos(a) * 9, 13 + Math.sin(a) * 9, 3.2, i % 2 ? '#9A948A' : '#B8B0A0');
  }
  c.circle(15, 13, 7, '#3A2E2A');
  c.inside(() => {
    for (const [x, y] of [[11, 9], [18, 10], [13, 17], [19, 16]]) c.rect(x, y, 1, 1, '#5A4A3A');
  });
  c.rect(11, 11, 3, 2, '#B57BFF');
  c.rect(17, 11, 3, 2, '#B57BFF');
  c.rect(12, 16, 7, 1, '#1A1420');
}

function wisp(c) {
  c.poly([[11, 0], [5, 12], [17, 12]], '#6FB8D8');
  c.poly([[5, 4], [3, 14], [9, 12]], '#6FB8D8');
  c.poly([[17, 3], [19, 14], [13, 12]], '#6FB8D8');
  c.circle(11, 17, 8, '#6FB8D8');
  c.inside(() => {
    c.circle(11, 18, 5, '#A8DCEE');
    c.poly([[11, 5], [8, 14], [14, 14]], '#A8DCEE');
    c.circle(10, 19, 2.5, '#E8F8FF');
  });
  c.rect(7, 16, 2, 3, '#1E3A50');
  c.rect(13, 16, 2, 3, '#1E3A50');
}

function rotWorm(c) {
  for (const [x, r] of [[5, 4.5], [11, 5.5], [17, 6], [23, 6]]) c.circle(x, 9, r, '#7A5A6A');
  c.inside(() => {
    for (const x of [8, 14, 20]) c.rect(x, 3, 2, 12, '#5A3E4E');
    c.rect(2, 6, 22, 2, '#9A7A8A');
  });
  c.circle(29, 9, 6, '#7A5A6A');
  c.inside(() => c.circle(28, 7, 2, '#9A7A8A'));
  c.rect(30, 6, 2, 2, '#1A1420');
  c.rect(32, 11, 3, 2, '#3A2430');
}


// ---------- The fourth batch: four more at each difficulty ----------

function aphid(c) {
  for (const x of [3, 7]) c.line(x, 7, x - 1, 10, '#2C2C2A', 1);
  c.blob(6, 5, 5.5, 4, { base: '#8AB070', dark: '#5E7A4A', light: '#B8D89A' });
  c.rect(9, 3, 2, 2, '#1A1420');
}

function fluffDrifter(c) {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.circle(11 + Math.cos(a) * 8, 11 + Math.sin(a) * 8, 2.4, '#E8E4DA');
  }
  c.circle(11, 11, 7, '#C9C3B8');
  c.inside(() => c.circle(10, 10, 4, '#E8E4DA'));
  c.rect(7, 10, 2, 3, '#3A2E46');
  c.rect(13, 10, 2, 3, '#3A2E46');
}

function pillBug(c) {
  for (const x of [5, 9, 13, 17]) c.line(x, 10, x - 1, 13, '#2C2C2A', 1);
  c.ellipse(12, 8, 11, 6, '#4A5A6A');
  c.inside(() => {
    c.ellipse(11, 7, 10, 5, '#6E7E8E');
    for (const x of [5, 9, 13, 17]) c.rect(x, 2, 1, 12, '#4A5A6A');
    c.ellipse(8, 4, 4, 1.4, '#9AAABA');
  });
  c.rect(21, 7, 2, 2, '#1A1420');
}

function pillBugBall(c) {
  c.blob(8, 8, 8, 8, { base: '#6E7E8E', dark: '#4A5A6A', light: '#9AAABA' });
  c.inside(() => {
    c.path([[2, 4], [8, 7], [14, 4]], '#4A5A6A', 1);
    c.path([[1, 9], [8, 12], [15, 9]], '#4A5A6A', 1);
  });
}

function sproutSpitter(c) {
  c.ellipse(10, 20, 8, 2.5, '#4A3A2A');
  c.line(10, 19, 10, 10, '#3F7A2A', 2);
  c.ellipse(5, 13, 4, 2, '#6CA850');
  c.ellipse(15, 12, 4, 2, '#5E9C3A');
  c.blob(10, 7, 5, 4.5, { base: '#7A9A5A', dark: '#4E6A3A' });
  c.circle(10, 6, 2, '#2A1E22');
}

function firefly(c) {
  c.ellipse(9, 4, 5, 3, '#C9D6DA');
  c.ellipse(14, 4, 4, 2.6, '#E0EAEE');
  c.circle(6, 11, 5.5, '#CFE86A');
  c.inside(() => c.circle(5, 11, 3, '#F0FFB0'));
  c.ellipse(13, 10, 5, 3.6, '#3A3430');
  c.circle(19, 9, 3, '#2C2622');
  c.rect(20, 8, 1, 1, '#FF6B6B');
  c.line(20, 6, 22, 2, '#2C2622', 1);
}

function mantis(c) {
  c.line(9, 30, 11, 22, '#4E7A3A', 2);
  c.line(15, 30, 13, 22, '#4E7A3A', 2);
  c.ellipse(12, 20, 4, 7, '#6CA850');
  c.inside(() => c.ellipse(11, 18, 2, 5, '#8BC86A'));
  c.line(12, 14, 15, 8, '#6CA850', 3);
  c.poly([[15, 4], [21, 6], [15, 10]], '#7FB060');
  c.rect(18, 5, 2, 2, '#1A1420');
  // Scythe arms raised in front.
  c.path([[13, 13], [20, 11], [24, 16]], '#4E7A3A', 2);
  c.path([[13, 15], [19, 15], [22, 20]], '#4E7A3A', 2);
}

function grasshopper(c) {
  c.path([[10, 10], [16, 2], [24, 14]], '#5E7A2A', 2);
  c.line(6, 11, 3, 15, '#5E7A2A', 1);
  c.line(10, 11, 9, 15, '#5E7A2A', 1);
  c.blob(10, 9, 9, 4, { base: '#8A9A3A', dark: '#5E6A2A', light: '#B8C870' });
  c.circle(20, 8, 3.5, '#8A9A3A');
  c.rect(21, 7, 1, 2, '#1A1420');
  c.line(22, 5, 27, 1, '#5E6A2A', 1);
}

function tulipMortar(c) {
  c.ellipse(11, 33, 9, 2.5, '#4A3A2A');
  c.line(11, 32, 11, 16, '#3F6A2A', 2);
  c.ellipse(6, 26, 5, 2, '#4E7A3A');
  c.ellipse(16, 22, 5, 2, '#5E8A4A');
  c.poly([[4, 6], [7, 0], [11, 5], [15, 0], [18, 6], [17, 15], [5, 15]], '#5A3A7A');
  c.inside(() => {
    c.poly([[11, 5], [15, 0], [18, 6], [17, 15], [12, 15]], '#3E2858');
    c.rect(7, 4, 2, 6, '#7A5A9A');
  });
  c.ellipse(11, 2, 2.5, 1.2, '#1A1420');
}

function stagBeetle(c) {
  for (const [x, dx] of [[8, -3], [14, -1], [20, 2]]) c.line(x, 16, x + dx, 21, '#2C2C2A', 2);
  c.blob(14, 11, 13, 7, { base: '#5A3A22', dark: '#3A2414', light: '#8A6040' });
  c.inside(() => c.line(3, 11, 26, 11, '#3A2414', 2));
  c.circle(28, 11, 4.5, '#3A2414');
  c.path([[30, 8], [35, 5], [36, 9]], '#7A5232', 2);
  c.path([[30, 14], [35, 17], [36, 13]], '#7A5232', 2);
  c.rect(28, 9, 2, 2, '#FF6B6B');
}

function gardenBat(c) {
  c.poly([[15, 8], [2, 2], [0, 12], [5, 9], [8, 14], [12, 10]], '#4A3A5A');
  c.poly([[15, 8], [28, 2], [30, 12], [25, 9], [22, 14], [18, 10]], '#4A3A5A');
  c.ellipse(15, 10, 4, 5, '#3A2E46');
  c.poly([[12, 5], [13, 1], [14, 5]], '#3A2E46');
  c.poly([[16, 5], [17, 1], [18, 5]], '#3A2E46');
  c.rect(13, 8, 1, 2, '#FFE45C');
  c.rect(16, 8, 1, 2, '#FFE45C');
}

function scarecrow(c) {
  c.line(15, 44, 15, 14, '#6E5032', 3);
  c.line(2, 22, 28, 22, '#6E5032', 3);
  c.poly([[8, 20], [22, 20], [24, 36], [6, 36]], '#5A4A7A');
  c.inside(() => {
    c.rect(6, 28, 18, 2, '#3E2E5A');
    c.rect(13, 20, 4, 16, '#7A6A9A');
  });
  for (const x of [1, 27]) c.poly([[x, 21], [x + 2, 26], [x + 4, 21]], '#D9B46A');
  c.circle(15, 13, 6, '#C9A87A');
  c.inside(() => {
    c.rect(11, 12, 2, 2, '#1A1420');
    c.rect(17, 12, 2, 2, '#1A1420');
    c.path([[11, 16], [13, 17], [15, 16], [17, 17], [19, 16]], '#5A3A22', 1);
  });
  c.ellipse(15, 7, 10, 2.5, '#B8904A');
  c.ellipse(15, 4, 5, 4, '#C9A25A', { bottom: 6 });
}

function turtleShell(c, cx, cy) {
  c.blob(cx, cy, 12, 8, { base: '#5E7A5A', dark: '#3E5A3A', light: '#8AA080' });
  c.inside(() => {
    c.path([[cx - 8, cy], [cx - 3, cy - 4], [cx + 3, cy - 4], [cx + 8, cy]], '#3E5A3A', 1);
    c.path([[cx - 3, cy - 4], [cx - 3, cy + 6]], '#3E5A3A', 1);
    c.path([[cx + 3, cy - 4], [cx + 3, cy + 6]], '#3E5A3A', 1);
  });
  for (const [x, y] of [[cx - 8, cy - 6], [cx, cy - 9], [cx + 8, cy - 6]]) c.poly([[x - 2, y + 2], [x, y - 3], [x + 2, y + 2]], '#C9C3A1');
}

function thornTurtle(c) {
  for (const x of [8, 22]) c.rect(x, 17, 4, 4, '#7A8A6A');
  c.ellipse(30, 13, 4, 3.5, '#7A8A6A');
  c.rect(31, 12, 1, 1, '#1A1420');
  turtleShell(c, 15, 12);
}

function venusFlytrap(c, open) {
  c.ellipse(15, 33, 10, 2.5, '#4A3A2A');
  c.line(15, 32, 15, 20, '#3F6A2A', 3);
  c.ellipse(8, 28, 6, 2.2, '#4E7A3A');
  c.ellipse(22, 27, 6, 2.2, '#4E7A3A');
  if (open) {
    // Jaws wide open, teeth showing.
    c.poly([[2, 4], [15, 16], [6, 18]], '#5E9C3A');
    c.poly([[28, 4], [15, 16], [24, 18]], '#5E9C3A');
    c.inside(() => {
      c.poly([[4, 7], [14, 15], [8, 16]], '#A8402A');
      c.poly([[26, 7], [16, 15], [22, 16]], '#A8402A');
    });
    for (const [x, y] of [[3, 3], [6, 6], [27, 3], [24, 6]]) c.rect(x, y - 3, 1, 3, '#E8E4DA');
    return;
  }
  c.ellipse(15, 12, 10, 8, '#5E9C3A');
  c.inside(() => {
    c.ellipse(15, 13, 8, 3, '#A8402A');
    c.line(5, 12, 25, 12, '#2E5A2A', 1);
  });
  for (const x of [6, 10, 14, 18, 22]) c.rect(x, 3, 1, 3, '#E8E4DA');
}

function lanternSpirit(c) {
  c.rect(9, 0, 4, 3, '#3A3430');
  c.rect(4, 3, 14, 3, '#5A4A3A');
  c.rect(5, 6, 12, 18, '#2E3B4A');
  c.inside(() => {
    c.rect(7, 8, 8, 14, '#6FB8D8');
    c.ellipse(11, 16, 3, 5, '#C9F2FF');
    c.rect(8, 13, 2, 2, '#1E3A50');
    c.rect(12, 13, 2, 2, '#1E3A50');
  });
  c.rect(4, 24, 14, 3, '#5A4A3A');
}

function shadowFox(c) {
  c.path([[2, 8], [0, 3], [3, 0]], '#2A2440', 3);
  c.blob(14, 12, 12, 6, { base: '#3A3458', dark: '#241E3A', light: '#5A5478' });
  for (const x of [8, 12, 18, 22]) c.rect(x, 16, 2, 5, '#241E3A');
  c.circle(27, 9, 5, '#3A3458');
  c.poly([[24, 5], [25, 0], [28, 4]], '#3A3458');
  c.poly([[28, 4], [31, 0], [31, 6]], '#3A3458');
  c.poly([[30, 10], [35, 11], [30, 13]], '#3A3458');
  c.rect(27, 8, 2, 2, '#B57BFF');
}

function waspNest(c) {
  c.ellipse(15, 29, 13, 2.5, '#4A3A2A');
  c.blob(15, 16, 12, 13, { base: '#9A948A', dark: '#6E6A60', light: '#C9C3B8' });
  c.inside(() => {
    for (const y of [8, 14, 20, 26]) c.path([[3, y], [15, y + 2], [27, y]], '#7A766C', 1);
    c.ellipse(15, 20, 3.5, 3, '#1A1420');
    c.circle(9, 12, 1.5, '#1A1420');
    c.circle(21, 13, 1.5, '#1A1420');
  });
  c.rect(14, 0, 2, 4, '#5A4A3A');
}

// Mini bosses: a regular enemy drawn bigger, with a small crown on top.
const MINI_BOSSES = {
  mini_aphid_queen: { draw: aphid, w: 12, h: 10, k: 3.2 },
  mini_puffball_elder: { draw: puffball, w: 28, h: 24, k: 2 },
  mini_mantis_duelist: { draw: mantis, w: 25, h: 31, k: 1.7 },
  mini_bullfrog: { draw: toad, w: 32, h: 24, k: 1.9 },
  mini_stag_lord: { draw: stagBeetle, w: 37, h: 22, k: 1.7 },
  mini_moth_matriarch: { draw: duskMoth, w: 32, h: 22, k: 1.9 },
  mini_turtle_elder: { draw: thornTurtle, w: 34, h: 21, k: 1.7 },
  mini_scarecrow_lord: { draw: scarecrow, w: 30, h: 45, k: 1.5 },
  mini_lantern_wraith: { draw: lanternSpirit, w: 22, h: 27, k: 1.8, outline: '#1E2A36' },
  mini_shadow_alpha: { draw: shadowFox, w: 35, h: 21, k: 1.7 },
};

function smallCrown(c, { width }) {
  const cx = Math.round(width / 2);
  c.poly([[cx - 8, 2], [cx - 8, -5], [cx - 4, -2], [cx, -7], [cx + 4, -2], [cx + 8, -5], [cx + 8, 2]], '#F2C94C');
  c.rect(cx - 8, 0, 16, 2, '#C98A2E');
  c.circle(cx, -2, 1.4, '#E25C4B');
}

export function makeMiniBossTextures(scene) {
  for (const [key, { draw, w, h, k, outline = OUTLINE }] of Object.entries(MINI_BOSSES)) {
    paintScaled(scene, key, w, h, draw, k, { outline, after: smallCrown });
  }
}

export function makeCritterTextures(scene) {
  const o = { outline: OUTLINE };
  paint(scene, 'bramble_mite', 22, 14, brambleMite, o);
  paint(scene, 'puffball', 28, 24, puffball, o);
  paint(scene, 'acorn_weevil', 33, 22, acornWeevil, o);
  paint(scene, 'dusk_moth', 32, 22, duskMoth, o);
  paint(scene, 'mole', 32, 24, mole, o);
  paint(scene, 'mole_mound', 28, 14, moleMound, o);
  paint(scene, 'garden_spider', 32, 18, gardenSpider, o);
  paint(scene, 'shell_snail', 36, 24, shellSnail, o);
  paint(scene, 'shell_snail_hide', 24, 22, (c) => {
    c.ellipse(12, 20, 11, 2.5, '#A8A090');
    snailShell(c, 12, 11);
  }, o);
  paint(scene, 'wasp', 27, 20, waspBug, o);
  paint(scene, 'toad', 32, 24, toad, o);
  paint(scene, 'sunflower_sentry', 30, 41, sunflowerSentry, o);
  paint(scene, 'wisp', 22, 26, wisp, { outline: '#1E3A50' });
  paint(scene, 'rot_worm', 36, 16, rotWorm, o);

  paint(scene, 'aphid', 12, 10, aphid, o);
  paint(scene, 'fluff_drifter', 22, 22, fluffDrifter, o);
  paint(scene, 'pill_bug', 24, 14, pillBug, o);
  paint(scene, 'pill_bug_ball', 16, 16, pillBugBall, o);
  paint(scene, 'sprout_spitter', 20, 22, sproutSpitter, o);
  paint(scene, 'firefly', 23, 17, firefly, o);
  paint(scene, 'mantis', 25, 31, mantis, o);
  paint(scene, 'grasshopper', 28, 16, grasshopper, o);
  paint(scene, 'tulip_mortar', 20, 35, tulipMortar, o);
  paint(scene, 'stag_beetle', 37, 22, stagBeetle, o);
  paint(scene, 'garden_bat', 30, 15, gardenBat, o);
  paint(scene, 'scarecrow', 30, 45, scarecrow, o);
  paint(scene, 'thorn_turtle', 34, 21, thornTurtle, o);
  paint(scene, 'thorn_turtle_hide', 28, 20, (c) => turtleShell(c, 14, 12), o);
  paint(scene, 'venus_flytrap', 30, 35, (c) => venusFlytrap(c, false), o);
  paint(scene, 'venus_flytrap_open', 30, 35, (c) => venusFlytrap(c, true), o);
  paint(scene, 'lantern_spirit', 22, 27, lanternSpirit, { outline: '#1E2A36' });
  paint(scene, 'shadow_fox', 35, 21, shadowFox, o);
  paint(scene, 'wasp_nest', 30, 31, waspNest, o);
}
