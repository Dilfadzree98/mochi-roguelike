import { paint } from './Pixels.js';

// The smaller garden pests (regular enemies added after the first five). Same rules as
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
}
