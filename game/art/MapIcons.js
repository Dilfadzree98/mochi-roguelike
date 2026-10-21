import { paint } from './Pixels.js';

// Map icons for the special rooms: 7x7 pixel drawings (one character per pixel, '.' is empty)
// with a 1px dark outline. The minimap shows them at 1x, the big map (Tab) at 2x.
const MAP_ICONS = {
  // Boss: a horned purple skull.
  map_boss: {
    colors: { H: '#B57BFF', W: '#E6D9FF', D: '#2A1A3A' },
    rows: [
      'H.....H',
      'HWWWWWH',
      'WWWWWWW',
      'WDDWDDW',
      'WWWDWWW',
      '.WWWWW.',
      '.W.W.W.',
    ],
  },
  // Mini boss: a small skull with red eyes.
  map_miniboss: {
    colors: { W: '#E8E4DA', R: '#E25C4B', D: '#3A1A1E' },
    rows: [
      '.......',
      '.WWWWW.',
      'WWWWWWW',
      'WRRWRRW',
      'WWWDWWW',
      '.WDWDW.',
      '.......',
    ],
  },
  // Treasure: a gold crown with red gems.
  map_treasure: {
    colors: { Y: '#F2C94C', O: '#C98A2E', R: '#E25C4B' },
    rows: [
      '.......',
      'Y..Y..Y',
      'YY.Y.YY',
      'YYYYYYY',
      'YRYRYRY',
      'OOOOOOO',
      '.......',
    ],
  },
  // Shop: a pink coin purse with a gold coin on it.
  map_shop: {
    colors: { P: '#F2A0A8', K: '#C96E7A', Y: '#F2C94C' },
    rows: [
      '..K.K..',
      '...K...',
      '.PPPPP.',
      'PPPYPPP',
      'PPYYYPP',
      'PPPYPPP',
      '.KKKKK.',
    ],
  },
  // Sacrifice: a drop of blood.
  map_sacrifice: {
    colors: { R: '#C8323F', L: '#F28A8A', D: '#7A1A24' },
    rows: [
      '...R...',
      '..RRR..',
      '.RRRRR.',
      'RLRRRRR',
      'RLRRRRD',
      '.RRRRD.',
      '..DDD..',
    ],
  },
  // Secret: a question mark.
  map_secret: {
    colors: { S: '#C9C3A1' },
    rows: [
      '.SSSS..',
      'SS..SS.',
      '....SS.',
      '...SS..',
      '..SS...',
      '.......',
      '..SS...',
    ],
  },
};

export function makeMapIconTextures(scene) {
  for (const [key, { colors, rows }] of Object.entries(MAP_ICONS)) {
    paint(scene, key, 7, 7, (c) => {
      rows.forEach((row, y) => [...row].forEach((ch, x) => colors[ch] && c.px(x, y, colors[ch])));
    }, { outline: '#120E16', outlineWidth: 1 });
  }
}
