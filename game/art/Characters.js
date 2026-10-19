import { paint } from './Pixels.js';

// Mochi and the playable characters (40x40; the sprout may poke a little above), plus Chinggu the cat.

const MOCHI = {
  outline: '#4A2A22',
  body: '#FFD8C2',
  dark: '#F2B496',
  light: '#FFF3EA',
  ear: '#F7AEC0',
  eye: '#2C2C2A',
  shine: '#FFFFFF',
  blush: '#F59AB0',
  mouth: '#8A4B3C',
  leaf: '#8BC86A',
  leafLight: '#B5E092',
  stem: '#4E8A30',
};

// The sprout on Mochi's head. It shows health: perky, wilting (one heart or less) or gone.
function drawLeaves(c, kind, top) {
  const C = MOCHI;
  if (kind === 'none') {
    c.line(20, top, 20, top - 2, C.stem, 2);
    return;
  }
  if (kind === 'perky') {
    c.line(20, top, 20, top - 6, C.stem, 2);
    c.ellipse(14, top - 8, 6, 3.2, C.leaf);
    c.ellipse(26.5, top - 9, 6, 3.2, C.leafLight);
    c.line(10, top - 8, 18, top - 7, C.stem, 1);
    c.line(22, top - 8, 30, top - 10, C.stem, 1);
  } else {
    c.line(20, top, 20, top - 4, C.stem, 2);
    c.ellipse(13.5, top - 2, 6, 2.6, C.leaf);
    c.ellipse(26.5, top - 2, 6, 2.6, C.leaf);
    c.line(9, top - 1, 18, top - 3, C.stem, 1);
    c.line(22, top - 3, 31, top - 1, C.stem, 1);
  }
}

function drawEyes(c, hurt) {
  const C = MOCHI;
  if (hurt) {
    // Squeezed shut: > <
    c.path([[11, 23], [14, 25], [11, 27]], C.eye, 2);
    c.path([[29, 23], [26, 25], [29, 27]], C.eye, 2);
    return;
  }
  c.rect(11, 22, 4, 6, C.eye);
  c.rect(25, 22, 4, 6, C.eye);
  c.rect(12, 23, 2, 2, C.shine);
  c.rect(26, 23, 2, 2, C.shine);
}

// The round body with ears, face and little feet. `outfit` draws hats and accessories on top.
function drawMochi(c, { leaves = 'perky', hurt = false, outfit = null }) {
  const C = MOCHI;
  // Ears, then the body over their lower half.
  c.ellipse(9, 17, 4.5, 4.5, C.body);
  c.ellipse(31, 17, 4.5, 4.5, C.body);
  c.ellipse(9, 16, 2.2, 2.2, C.ear);
  c.ellipse(31, 16, 2.2, 2.2, C.ear);
  c.ellipse(14, 36, 3.5, 2.5, C.dark);
  c.ellipse(26, 36, 3.5, 2.5, C.dark);
  c.ellipse(20, 26, 16, 11, C.dark);
  c.inside(() => {
    c.ellipse(19.5, 25, 15, 10, C.body);
    c.ellipse(12, 19.5, 4.5, 2.5, C.light);
  });

  drawEyes(c, hurt);
  c.ellipse(8.5, 30.5, 3, 1.6, C.blush);
  c.ellipse(31.5, 30.5, 3, 1.6, C.blush);
  c.path([[17, 30], [18.5, 31.5], [20, 30], [21.5, 31.5], [23, 30]], C.mouth, 1);

  if (outfit) outfit(c, leaves, hurt);
  else drawLeaves(c, leaves, 15);
}

const OUTFITS = {
  // Boy: blue cap with a little burger on the front. The sprout pokes out of the top.
  mangkok(c, leaves) {
    const cap = { base: '#3A6FC2', dark: '#24488A', light: '#7EA8EE' };
    c.ellipse(20, 19, 14, 10, cap.dark, { bottom: 18 });
    c.inside(() => {
      c.ellipse(19, 18, 13, 9, cap.base, { bottom: 17 });
      c.ellipse(13, 12, 4, 2, cap.light);
    });
    c.rect(5, 18, 30, 3, '#1E3A70');
    // Burger badge.
    c.ellipse(20, 12, 4.5, 2.5, '#E0A040');
    c.rect(16, 14, 9, 1, '#6CC24A');
    c.rect(16, 15, 9, 2, '#7A3E20');
    c.rect(16, 17, 9, 1, '#E0A040');
    drawLeaves(c, leaves, 9);
  },
  // Girl: a pink flower on her right ear, and eyelashes.
  lilo(c, leaves, hurt) {
    drawLeaves(c, leaves, 15);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      c.circle(32 + Math.cos(a) * 3, 13 + Math.sin(a) * 3, 2.3, '#FFB3D1');
    }
    c.circle(32, 13, 1.7, '#FFE45C');
    if (!hurt) {
      c.line(10, 22, 8, 20, MOCHI.eye, 1);
      c.line(11, 21, 10, 19, MOCHI.eye, 1);
      c.line(29, 22, 31, 20, MOCHI.eye, 1);
      c.line(28, 21, 29, 19, MOCHI.eye, 1);
    }
  },
};

// Every look a character needs: normal, hurt, wilting (low health), and leafless (death).
function makeCharacter(scene, key, outfit) {
  const variants = {
    '': { leaves: 'perky' },
    _hurt: { leaves: 'perky', hurt: true },
    _wilt: { leaves: 'wilt' },
    _wilt_hurt: { leaves: 'wilt', hurt: true },
    _bare: { leaves: 'none', hurt: true },
  };
  for (const [suffix, look] of Object.entries(variants)) {
    paint(scene, key + suffix, 40, 40, (c) => drawMochi(c, { ...look, outfit }), { outline: MOCHI.outline });
  }
}

// Chinggu, Lilo's calico cat: white with orange and black patches, a pink bow. Faces right.
function paintChinggu(scene) {
  paint(scene, 'chinggu', 34, 30, (c) => {
    const white = '#F5F0E8';
    const shade = '#D9D2C6';
    const orange = '#E8903C';
    const black = '#2C2C2A';
    // Tail curling up behind her.
    c.path([[8, 20], [4, 16], [3, 10], [5, 6]], orange, 3);
    // Body and legs.
    c.ellipse(15, 19, 10, 6.5, shade);
    c.inside(() => c.ellipse(14.5, 18, 9.5, 5.5, white));
    for (const x of [8, 13, 19, 23]) c.rect(x, 22, 3, 6, white);
    c.inside(() => {
      c.ellipse(11, 16, 5, 3.5, orange);
      c.ellipse(18, 21, 3.5, 2.5, black);
    });
    // Head and ears.
    c.poly([[19, 9], [21, 2], [24, 8]], orange);
    c.poly([[26, 8], [30, 2], [31, 10]], black);
    c.circle(25, 13, 7, white);
    c.inside(() => c.ellipse(21, 10, 3, 2.5, orange));
    // Face: green eyes, pink nose; a pink bow by the ear.
    c.rect(22, 12, 2, 3, '#7FCF5A');
    c.rect(27, 12, 2, 3, '#7FCF5A');
    c.px(22, 13, black);
    c.px(27, 13, black);
    c.rect(25, 15, 2, 1, '#F7AEC0');
    c.rect(17, 6, 3, 3, '#FF8FB8');
    c.rect(21, 6, 3, 3, '#FF8FB8');
    c.rect(20, 7, 1, 1, '#E0457B');
  }, { outline: '#3A2E2A' });
}

export function makeCharacterTextures(scene) {
  makeCharacter(scene, 'mochi', null);
  for (const [key, outfit] of Object.entries(OUTFITS)) makeCharacter(scene, key, outfit);
  paintChinggu(scene);
}
