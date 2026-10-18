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

// Draws extra rows over a sprite; '.' keeps the pixel underneath.
function overlay(rows, overrides) {
  return rows.map((row, y) => (overrides[y] ? [...overrides[y]].map((ch, x) => (ch === '.' ? row[x] : ch)).join('') : row));
}

// Playable characters: Mochi plus an outfit drawn on top. Keys are row numbers.
const CHARACTERS = {
  // Boy: blue cap with a little burger on the front; ear tips poke out at the sides.
  mangkok: {
    palette: { n: '#24488A', c: '#3A6FC2', C: '#6E9BE8', M: '#1E3A70', u: '#E0A040', P: '#7A3E20', L: '#6CC24A' },
    rows: {
      3: '....nnnnnnnn....',
      4: '...nCcuuuuccn...',
      5: '..onCLPPPPLcno..',
      6: '.oenCcuuuuccneo.',
      7: '.oMMMMMMMMMMMMo.',
    },
  },
  // Girl: a pink flower on her right ear, and eyelashes.
  lilo: {
    palette: { F: '#FFB3D1', Y: '#FFE45C' },
    rows: {
      3: '............F...',
      4: '...........FYF..',
      5: '............F...',
      8: '..kk........kk..',
    },
  },
};

// Every look Mochi needs: normal, hurt, wilting (low health), and leafless (death).
function makeMochiTextures(scene, key, outfit = { rows: {}, palette: {} }) {
  const variants = {
    '': mochi(LEAVES_PERKY),
    _hurt: mochi(LEAVES_PERKY, HURT_EYES),
    _wilt: mochi(LEAVES_WILT),
    _wilt_hurt: mochi(LEAVES_WILT, HURT_EYES),
    _bare: mochi(LEAVES_NONE, HURT_EYES),
  };
  for (const [suffix, rows] of Object.entries(variants)) {
    fromMap(scene, key + suffix, overlay(rows, outfit.rows), { ...MOCHI_PALETTE, ...outfit.palette });
  }
}

// ---------- Enemies (cool, muted colours; glowing eyes or tiny teeth) ----------

const ENEMIES = {
  // Faces right; flipped in code to face left.
  gloom_slug: {
    palette: { o: '#4E4260', b: '#7A6A8F', h: '#C9BEDA', L: '#A99BBD', y: '#FFE45C', k: '#2C2C2A', w: '#FFFFFF' },
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
  },
  grumpshroom: {
    palette: { o: '#7A2420', r: '#C2413B', s: '#F3E9DC', S: '#E6D2B5', b: '#2C2C2A', k: '#2C2C2A', m: '#6B2F2E', f: '#A8916E' },
    rows: [
      '.....oooooo.....',
      '...oorrrrrroo...',
      '..orrsrrrrrsrro.',
      '.orsssrrrrrrrrro',
      '.orrsrrrrrrssrro',
      'orrrrrrrrrrssrro',
      'oooooooooooooooo',
      '..oSSSSSSSSSSo..',
      '..obbSSSSSSbbo..',
      '..oSSbSSSSbSSo..',
      '..oSkkSSSSkkSo..',
      '..oSSSSmmSSSSo..',
      '..oSSSmSSmSSSo..',
      '...oSSSSSSSSo...',
      '...ofo....ofo...',
      '...ooo....ooo...',
    ],
  },
  // Faces right.
  click_beetle: {
    palette: { o: '#0F3333', s: '#1F5C5C', h: '#4FA3A3', e: '#FF6B6B', K: '#2C2C2A', l: '#2C2C2A' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....ooooooo.....',
      '..oosshhsssoo...',
      '.ossshhssssssoo.',
      '.osssssssssssoeo',
      '.ossssssssssooo.',
      '..oooooooooooKK.',
      '..l.l..l.l..l...',
      '.l.l..l.l..l....',
      '................',
    ],
  },
  thornvine: {
    palette: { o: '#1A3318', v: '#2E5A2A', V: '#4C7A3A', t: '#C9C3A1', b: '#6B2F4E', B: '#8A4064', c: '#1F1A14' },
    rows: [
      '................',
      '......obbo......',
      '.....obBbbo.....',
      '.....obbbbo.....',
      '......obbo......',
      '.......vv.......',
      '.....t.vv.......',
      '......vVv.t.....',
      '.....vVv........',
      '...t.vVv........',
      '.......vVv......',
      '......t.vVv.....',
      '........vVv.t...',
      '.......vVv......',
      '.....cccvvccc...',
      '....cccccccccc..',
    ],
  },
  hexed_gnome: {
    palette: {
      o: '#2E3B5C', h: '#4A5F8C', H: '#6A7FAC', k: '#3B3B3B', f: '#D9A88A', g: '#B57BFF',
      w: '#E8E4DA', W: '#C9C3B8', c: '#8C5A50', C: '#3B3B3B',
    },
    rows: [
      '.......oo.......',
      '......ohho......',
      '......ohho......',
      '.....ohhHho.....',
      '.....ohhhho.....',
      '....ohhHhhho....',
      '....ohhhhkho....',
      '...ohhhhhhhho...',
      '..oooooooooooo..',
      '...offffffffo...',
      '...ofgfffgffo...',
      '...offkffffffo..',
      '..owwwfffwwwo...',
      '..owwwwwwwwwo...',
      '.oowwwwWwwwwoo..',
      '.occwwwWwwwcco..',
      '.occcwwwwwccco..',
      '.occccwwwcccco..',
      '..occcccccccco..',
      '..occcccccccco..',
      '..oCCCCCCCCCCo..',
      '...occcccccco...',
      '...okko..okko...',
      '...oooo..oooo...',
    ],
  },
};

// Thornvine with its bud open (shown while it attacks).
const THORNVINE_OPEN_TOP = [
  '....ob....bo....',
  '...obBw..wBbo...',
  '...obmmmmmmbo...',
  '....obwmmwbo....',
  '......obbo......',
];

// ---------- Enemy bullets: always the same hot pink so danger is easy to read ----------

const PINK = { f: '#E0457B', o: '#8A1E47', c: '#FFC2D6', p: '#B57BFF' };
const BULLETS = {
  spore: ['..oo..', '.offo.', 'ofccfo', 'ofccfo', '.offo.', '..oo..'],
  thorn: ['oo....', 'offo..', 'ofccoo', 'offo..', 'oo....'],
  hex_orb: ['.pppp.', 'poffop', 'pfccfp', 'pfccfp', 'poffop', '.pppp.'],
};

// ---------- Small sprites ----------

const SMALL = {
  seed: {
    palette: { o: '#3F7A2A', g: '#8BC86A', w: '#FFFFFF' },
    rows: ['..oo..', '.ogwo.', 'oggggo', 'oggggo', '.oggo.', '..oo..'],
  },
  husk: { palette: { a: '#8BC86A', b: '#3F7A2A' }, rows: ['ab', 'ba'] },
  leaf: { palette: { g: '#8BC86A', G: '#A6D987', s: '#5E9C3A' }, rows: ['.gG', 'gGG', 's..'] },
  shadow: { palette: { o: '#000000' }, rows: ['..oooooo..', '.oooooooo.', '..oooooo..'] },
  slime: { palette: { c: '#9FD8C8', w: '#D6F2EA' }, rows: ['.cccccc.', 'ccwccccc', 'cccccccc', '.cccccc.'] },
  slime_bit: { palette: { L: '#A99BBD' }, rows: ['LL', 'LL'] },
  cap_bit: { palette: { r: '#C2413B', s: '#F3E9DC' }, rows: ['rs', 'rr'] },
  ceramic: { palette: { w: '#E8E4DA', h: '#4A5F8C' }, rows: ['wh', 'ww'] },
  hex_spark: { palette: { p: '#B57BFF' }, rows: ['p.', '.p'] },
  petal: { palette: { p: '#C9C3A1', d: '#8C866A' }, rows: ['pp', 'pd'] },
  pink_bit: { palette: { f: '#E0457B' }, rows: ['ff'] },
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
  // Weed Queen's root attack: a warning crack, then roots burst up.
  crack: {
    palette: { c: '#1A140F' },
    rows: ['...cc.......', '.....c..cc..', '..ccccccc...', '.c....c..c..', '....cc...cc.'],
  },
  roots: {
    palette: { o: '#1A3318', v: '#2E5A2A', V: '#4C7A3A' },
    rows: ['..o.....o...', '.ovo...ovo..', '.ovo.o.ovo..', 'ovVvovoovVo.', 'ovVvovoovVvo', 'oooooooooooo'],
  },
};

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

// ---------- Obstacles (16x16, fill one floor tile; block movement and bullets) ----------

const OBSTACLES = {
  flower_pot: {
    palette: { o: '#5A2E1E', t: '#B8643C', T: '#D88A5C', d: '#8A4A2C', g: '#5E9C3A', G: '#8BC86A', s: '#3E6A2A', y: '#F2C94C' },
    rows: [
      '.......y........',
      '.....gGyGg......',
      '....gGGsGGg.....',
      '...sgGgsgGgs....',
      '....sgssgs......',
      '..oooooooooooo..',
      '..oTTTttttttdo..',
      '..otttttttttdo..',
      '...oTttttttdo...',
      '...otttttttdo...',
      '...oTttttttdo...',
      '....otttttdo....',
      '....otttttdo....',
      '....oddddddo....',
      '.....oooooo.....',
      '................',
    ],
  },
  stump: {
    palette: { o: '#3A2618', b: '#6E4A2E', B: '#8A6040', r: '#C9A27A', R: '#A8805A', d: '#4A3020' },
    rows: [
      '................',
      '................',
      '....oooooooo....',
      '...orrrrrrrro...',
      '..orrRRRRRRrro..',
      '..orRrrrrrrRro..',
      '..orRrRRRRrRro..',
      '..orRrrrrrrRro..',
      '..orrRRRRRRrro..',
      '..oorrrrrrrroo..',
      '..obboooooobbo..',
      '..obBbbbbbBbbo..',
      '..obBbbbbbBbbo..',
      '.oobBbbbbbBbboo.',
      'odbbdbbbbdbbdbdo',
      '.oo.oo....oo.oo.',
    ],
  },
  planter: {
    palette: { o: '#2E3B3A', c: '#7F9A94', C: '#A8C4BE', d: '#5E7570', s: '#3E3020', p: '#6A5A3A' },
    rows: [
      '......p..p......',
      '.....p.pp.p.....',
      '......pp.p......',
      '.......pp.......',
      '.oooooooooooooo.',
      'oCCcccccccccccdo',
      'osssssssssssssso',
      '.oCccccccccccdo.',
      '.oCccccccccccdo.',
      '.oCccccccccccdo.',
      '..oCccccccccdo..',
      '..oCccccccccdo..',
      '..oCccccccccdo..',
      '..oddddddddddo..',
      '...oooooooooo...',
      '................',
    ],
  },
  bench: {
    palette: { o: '#3A2A1C', w: '#8A6A44', W: '#A8885E', d: '#5E4630', t: '#B8643C', g: '#5E9C3A' },
    rows: [
      '................',
      '...g.......g....',
      '..ttt.....ttt...',
      '..ttt..g..ttt...',
      'oooooooooooooooo',
      'oWWWWWWWWWWWWWWo',
      'owwwwwwwwwwwwwwo',
      'oddddddddddddddo',
      'oooooooooooooooo',
      '.od..........do.',
      '.od..........do.',
      '.od.oooooooo.do.',
      '.od.owwwwwwo.do.',
      '.od.oooooooo.do.',
      '.od..........do.',
      '.oo..........oo.',
    ],
  },
  barrel: {
    palette: { o: '#2A1C12', b: '#7A5232', B: '#9A6E46', h: '#4A4A50', H: '#6A6A72', d: '#5A3A22' },
    rows: [
      '................',
      '....oooooooo....',
      '...oBBbbbbbdo...',
      '..oHhhhhhhhhho..',
      '..oBbbbbbbbbdo..',
      '.oBBbbbbbbbbddo.',
      '.oBBbbbbbbbbddo.',
      '.oHHhhhhhhhhhho.',
      '.oBBbbbbbbbbddo.',
      '.oBBbbbbbbbbddo.',
      '..oBbbbbbbbbdo..',
      '..oHhhhhhhhhho..',
      '...oBbbbbbbdo...',
      '....oooooooo....',
      '................',
      '................',
    ],
  },
  crate: {
    palette: { o: '#2A1C12', w: '#8A6A44', W: '#A8885E', d: '#5E4630' },
    rows: [
      '................',
      'oooooooooooooooo',
      'oWWWWWWWWWWWWWWo',
      'oWwwwwwwwwwwwwdo',
      'oWwdwwwwwwwwdwdo',
      'oWwwdwwwwwwdwwdo',
      'oWwwwdwwwwdwwwdo',
      'oWwwwwdwwdwwwwdo',
      'oWwwwwwddwwwwwdo',
      'oWwwwwwddwwwwwdo',
      'oWwwwwdwwdwwwwdo',
      'oWwwwdwwwwdwwwdo',
      'oWwwdwwwwwwdwwdo',
      'oWwdwwwwwwwwdwdo',
      'oddddddddddddddo',
      'oooooooooooooooo',
    ],
  },
  big_mushroom: {
    palette: { o: '#1E3A4A', c: '#3E8AB0', C: '#6FD3FF', w: '#C9F2FF', s: '#C9C3B8', S: '#9A948A' },
    rows: [
      '................',
      '................',
      '....oooooooo....',
      '..ooCCcccccCoo..',
      '.oCCwcccccwccCo.',
      'oCcccccwccccccco',
      'occcccccccccccco',
      'oooooooooooooooo',
      '.....ossso......',
      '.....osSso......',
      '.....osSso......',
      '.....osSso......',
      '....ossSsso.....',
      '...ooooooooo....',
      '................',
      '................',
    ],
  },
  root_knot: {
    palette: { o: '#16121A', r: '#3E2E36', R: '#5A4450' },
    rows: [
      '................',
      '................',
      '......oo........',
      '.....orro..oo...',
      '...oorRroorro...',
      '..orRRrrrRRrro..',
      '.orRrrRRrrrRRro.',
      '.orrRRrrRRRrrro.',
      'orRRrrrRrrrRRrro',
      'orrrRRRrrRRrrRro',
      '.orRrrrRRrrrRro.',
      '.oorrRRrrrRRroo.',
      '..oorrrrrrrroo..',
      '....oooooooo....',
      '................',
      '................',
    ],
  },
  // Hurts Mochi on touch.
  thorn_cluster: {
    palette: { o: '#1A3318', v: '#2E5A2A', V: '#4C7A3A', t: '#E8C9D6' },
    rows: [
      '................',
      '................',
      '...t.....t......',
      '....v...v...t...',
      '.t..vV.vV..v....',
      '..vvVvvVvv.Vv.t.',
      '.tvVvvVvvVvvVv..',
      '..vvVvtvVvvVvvt.',
      '.vVvvVvvVvtvVv..',
      't.vvVvvVvvVvvv.t',
      '..vVvtvVvvVvVv..',
      '.t.vvVvvVvvVv.t.',
      '...ooooooooooo..',
      '................',
      '................',
      '................',
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
  coin: { palette: { o: '#C98A2E', y: '#F2C94C', Y: '#FFF4B8' }, rows: ['.ooo.', 'oyYyo', 'oyyyo', 'oyyyo', '.ooo.'] },
  bomb: {
    palette: { o: '#1A1418', k: '#3B3340', b: '#7A6A8F', f: '#FFD23F', s: '#FF8A3D' },
    rows: ['....fs.', '...o...', '.ooooo.', 'oobkkko', 'okkkkko', 'okkkkko', '.ooooo.'],
  },
  key: { palette: { y: '#F2C94C', o: '#C98A2E' }, rows: ['.yy....', 'y..yyyy', '.yy.o.o'] },
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

// Character skill icons and effects.
const SKILLS = {
  icon_burger: {
    palette: { u: '#E0A040', L: '#6CC24A', P: '#7A3E20' },
    rows: ['.uuuuu.', 'uuuuuuu', 'LLLLLLL', 'PPPPPPP', 'uuuuuuu', '.uuuuu.'],
  },
  icon_flower: {
    palette: { F: '#FFB3D1', Y: '#FFE45C' },
    rows: ['..F..', '.FFF.', 'FFYFF', '.FFF.', '..F..'],
  },
  shield_petal: { palette: { F: '#FFB3D1', W: '#FFE6F0' }, rows: ['.F.', 'FWF', '.F.'] },
  crumb: { palette: { u: '#E0A040', L: '#6CC24A' }, rows: ['uL'] },
};

const HEART_PALETTE ={ o: '#5A1E2A', r: '#E25C4B', h: '#FFB3A3', e: '#3B2B33' };
const HEARTS = {
  heart_full: ['.oo.oo.', 'orrorro', 'ohrrrro', '.orrro.', '..oro..', '...o...'],
  heart_half: ['.oo.oo.', 'orroeeo', 'ohrreeo', '.orreo.', '..oro..', '...o...'],
  heart_empty: ['.oo.oo.', 'oeeoeeo', 'oeeeeeo', '.oeeeo.', '..oeo..', '...o...'],
};

const GATES = {
  door: { frame: '#2A2219', wood: '#7A5C3A', dark: '#5E4630', lock: '#F2C94C' },
  door_boss: { frame: '#1F1A24', wood: '#4E3A5E', dark: '#2E2238', lock: '#B57BFF' },
  door_treasure: { frame: '#5C4520', wood: '#8A6A3A', dark: '#6E5234', lock: '#FFE45C' },
  door_shop: { frame: '#2A2219', wood: '#5E7A3A', dark: '#3E5A2A', lock: '#F2A0A8' },
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
  const px = (x, y, color) => rect(x, y, 1, 1, color);
  // Hard-edged filled circle (no anti-aliasing).
  const disc = (cx, cy, r, color) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(x, y, color);
      }
    }
  };
  draw({ ctx, rect, px, disc });
  texture.refresh();
}

function paintGlow(scene, key, rgb, size = 40) {
  paint(scene, key, size, size, ({ ctx }) => {
    const r = size / 2;
    const gradient = ctx.createRadialGradient(r, r, 2, r, r, r);
    gradient.addColorStop(0, `rgba(${rgb}, 0.5)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

// ---------- The Weed Queen (48x48, drawn from shapes) ----------

function paintWeedQueen(scene) {
  const C = {
    outline: '#141C12',
    stalk: '#2E3F2A',
    gownShadow: '#1F2A1C',
    leaf: '#3F5A34',
    petals: '#C9C3A1',
    petalEdge: '#8C866A',
    face: '#E8E4DA',
    faceEdge: '#A8A494',
    eyes: '#B57BFF',
    mouth: '#6B2F4E',
    thorns: '#6B2F4E',
    buds: '#9B5CFF',
  };
  paint(scene, 'weed_queen', 48, 48, ({ rect, px, disc }) => {
    // Gown: a widening stalk rooted into the floor.
    for (let y = 22; y < 48; y++) {
      const half = Math.round(5 + (y - 22) * 0.6);
      rect(24 - half - 1, y, half * 2 + 2, 1, C.outline);
      rect(24 - half, y, half * 2, 1, C.stalk);
      rect(24 + Math.round(half / 3), y, Math.round((half * 2) / 3), 1, C.gownShadow);
    }
    for (const [x, y] of [[20, 28], [27, 32], [17, 38], [30, 40], [23, 44], [13, 44], [34, 45]]) rect(x, y, 1, 3, C.leaf);

    // Vine arms ending in leaf hands.
    for (let i = 0; i <= 13; i++) {
      const dy = Math.round(i * 0.9);
      px(18 - i, 25 + dy, C.stalk);
      px(18 - i, 26 + dy, C.outline);
      px(29 + i, 25 + dy, C.stalk);
      px(29 + i, 26 + dy, C.outline);
    }
    disc(4, 39, 2.5, C.leaf);
    disc(43, 39, 2.5, C.leaf);

    // Dandelion head with jagged petals.
    for (let y = 0; y < 32; y++) {
      for (let x = 8; x < 40; x++) {
        const angle = Math.atan2(y - 15, x - 24);
        const r = 12.5 + (Math.cos(angle * 12) > 0 ? 1.5 : 0);
        const d = Math.hypot(x - 24, y - 15);
        if (d <= r) px(x, y, d > r - 1.2 ? C.petalEdge : C.petals);
      }
    }

    // Pale face, narrow glowing eyes, thin smug smile.
    disc(24, 15, 7, C.faceEdge);
    disc(24, 15, 6, C.face);
    rect(20, 14, 3, 1, C.eyes);
    rect(26, 14, 3, 1, C.eyes);
    rect(22, 18, 5, 1, C.mouth);
    px(21, 17, C.mouth);
    px(27, 17, C.mouth);

    // Crown of thorns with three purple buds.
    for (const x of [17, 24, 31]) {
      rect(x, 3, 1, 3, C.thorns);
      px(x - 1, 5, C.thorns);
      px(x + 1, 5, C.thorns);
      rect(x - 1, 1, 3, 2, C.buds);
    }
  });
}

// ---------- Tiles, one set per floor ----------

// The front face of the top wall, different on each floor.
const FACES = {
  fence: (p) => {
    p.rect(0, 10, TILE, 6, '#2A2219');
    for (const x of [0, 4, 8, 12]) {
      p.rect(x, 10, 3, 6, '#8A7050');
      p.px(x + 1, 9, '#8A7050');
      p.rect(x + 2, 11, 1, 5, '#6E5840');
    }
  },
  glass: (p) => {
    p.rect(0, 10, TILE, 6, '#4A3A30');
    for (const x of [1, 9]) {
      p.rect(x, 11, 6, 4, '#6F8A86');
      p.px(x + 1, 11, '#A8C4BE');
    }
    p.px(4, 13, '#C9E6E0');
    p.px(5, 12, '#C9E6E0');
  },
  brick: (p) => {
    p.rect(0, 10, TILE, 6, '#1A1212');
    p.rect(0, 10, TILE, 1, '#5E4630');
    for (const [x, y, w] of [[0, 11, 7], [8, 11, 7], [0, 14, 3], [4, 14, 7], [12, 14, 4]]) p.rect(x, y, w, 2, '#4A3030');
  },
  roots: (p) => {
    p.rect(0, 10, TILE, 6, '#16121A');
    for (const [x, y] of [[1, 11], [2, 12], [3, 12], [4, 13], [8, 11], [9, 11], [10, 12], [11, 13], [12, 13], [14, 11]]) p.px(x, y, '#3E2E36');
    for (const [x, y] of [[3, 11], [10, 14], [6, 13]]) p.px(x, y, '#6B2F4E');
  },
};

function makeFloorTiles(scene, floor, rng) {
  const c = floor.palette;

  for (let v = 0; v < 4; v++) {
    paint(scene, `${floor.id}_floor${v}`, TILE, TILE, ({ rect, px }) => {
      rect(0, 0, TILE, TILE, c.floor);
      for (let i = 0; i < 10; i++) px(rng.int(0, 15), rng.int(0, 15), c.floorDark);
      for (let i = 0; i < 4; i++) rect(rng.int(0, 15), rng.int(0, 14), 1, 2, c.floorLight);
      if (floor.pattern === 'stone') {
        // Cracked stone tiles with moss in the gaps.
        rect(0, 15, TILE, 1, c.floorDark);
        rect(15, 0, 1, TILE, c.floorDark);
        for (let i = 0; i < 3; i++) px(rng.int(0, 14), 15, c.patch);
      }
      if (v === 3) {
        // A patch: dirt, moss, planks or rotting leaves depending on the floor.
        if (floor.pattern === 'earth') {
          rect(0, 6, TILE, 4, c.patch);
          rect(0, 9, TILE, 1, c.patchDark);
          rect(7, 6, 1, 4, c.patchDark);
        } else {
          rect(5, 6, 6, 4, c.patch);
          rect(4, 7, 8, 2, c.patch);
          rect(5, 9, 6, 1, c.patchDark);
        }
      }
    });
  }

  const drawWall = ({ rect, px }, height) => {
    rect(0, 0, TILE, height, c.wall);
    for (let i = 0; i < 6; i++) rect(rng.int(0, 13), rng.int(0, height - 2), 3, 2, c.wallDark);
    for (let i = 0; i < 6; i++) px(rng.int(0, 15), rng.int(0, height - 1), c.wallLight);
  };
  for (let v = 0; v < 3; v++) paint(scene, `${floor.id}_wall${v}`, TILE, TILE, (p) => drawWall(p, TILE));
  paint(scene, `${floor.id}_wall_top`, TILE, TILE, (p) => {
    drawWall(p, 10);
    FACES[floor.face](p);
  });

  // Soft dark vignette, heavier on deeper floors.
  const width = TILE * ROOM_COLS;
  const height = TILE * ROOM_ROWS;
  paint(scene, `vignette_${floor.id}`, width, height, ({ ctx }) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.62);
    gradient.addColorStop(0, 'rgba(10, 6, 14, 0)');
    gradient.addColorStop(1, `rgba(10, 6, 14, ${floor.vignette})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

function makeSharedTiles(scene) {
  // Closed gates, drawn for the top wall and rotated for the others.
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

  // Open gateway: a dark path between two posts.
  paint(scene, 'door_open', TILE, TILE, ({ rect }) => {
    rect(0, 0, TILE, TILE, '#2A2219');
    rect(4, 0, 8, TILE, '#4A3A2C');
    rect(5, 0, 1, TILE, '#3A2C20');
    rect(0, 0, 2, TILE, GATES.door.dark);
    rect(14, 0, 2, TILE, GATES.door.dark);
  });

  // Trapdoor to the next floor.
  paint(scene, 'trapdoor', TILE, TILE, ({ rect }) => {
    rect(1, 1, 14, 14, '#5E4630');
    rect(2, 2, 12, 12, '#2A2219');
    rect(3, 3, 10, 10, '#0A0608');
    rect(3, 3, 10, 1, '#1A140F');
  });

  paintGlow(scene, 'glow', '242, 201, 76');
  paintGlow(scene, 'glow_blue', '111, 211, 255', 24);
  paintGlow(scene, 'glow_purple', '181, 123, 255', 20);
  paintGlow(scene, 'glow_pink', '255, 179, 209', 36);
}

export function makeTextures(scene, floors) {
  makeMochiTextures(scene, 'mochi');
  for (const [key, outfit] of Object.entries(CHARACTERS)) makeMochiTextures(scene, key, outfit);

  for (const [key, sprite] of Object.entries(ENEMIES)) fromMap(scene, key, sprite.rows, sprite.palette);
  const vine = ENEMIES.thornvine;
  fromMap(scene, 'thornvine_open', [...THORNVINE_OPEN_TOP, ...vine.rows.slice(THORNVINE_OPEN_TOP.length)], {
    ...vine.palette,
    m: '#E0457B',
    w: '#FFFFFF',
  });
  paintWeedQueen(scene);

  for (const [key, rows] of Object.entries(BULLETS)) fromMap(scene, key, rows, PINK);
  for (const group of [SMALL, DECOR, OBSTACLES, SHOTS, ICONS, PICKUPS, SKILLS]) {
    for (const [key, sprite] of Object.entries(group)) fromMap(scene, key, sprite.rows, sprite.palette);
  }
  for (const [key, rows] of Object.entries(HEARTS)) fromMap(scene, key, rows, HEART_PALETTE);

  // Fixed seed: tiles look the same every run. Run randomness only decides placement.
  const rng = new Rng(20261018);
  for (const floor of floors) makeFloorTiles(scene, floor, rng);
  makeSharedTiles(scene);
}
