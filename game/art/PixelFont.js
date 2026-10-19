// A tiny 3x5 pixel font, so text stays crisp at the game's real resolution.
// Each glyph is 5 rows of 3 pixels, written as 15 bits, top row first.
// Kept as an array (not an object) so the character order is guaranteed.
const GLYPHS = [
  [' ', '000000000000000'],
  ['A', '010101111101101'],
  ['B', '110101110101110'],
  ['C', '011100100100011'],
  ['D', '110101101101110'],
  ['E', '111100110100111'],
  ['F', '111100110100100'],
  ['G', '011100101101011'],
  ['H', '101101111101101'],
  ['I', '111010010010111'],
  ['J', '001001001101010'],
  ['K', '101101110101101'],
  ['L', '100100100100111'],
  ['M', '101111111101101'],
  ['N', '110101101101101'],
  ['O', '010101101101010'],
  ['P', '110101110100100'],
  ['Q', '010101101110011'],
  ['R', '110101110101101'],
  ['S', '011100010001110'],
  ['T', '111010010010010'],
  ['U', '101101101101111'],
  ['V', '101101101101010'],
  ['W', '101101111111101'],
  ['X', '101101010101101'],
  ['Y', '101101010010010'],
  ['Z', '111001010100111'],
  ['0', '111101101101111'],
  ['1', '010110010010111'],
  ['2', '110001010100111'],
  ['3', '110001010001110'],
  ['4', '101101111001001'],
  ['5', '111100110001110'],
  ['6', '011100110101010'],
  ['7', '111001010010010'],
  ['8', '010101010101010'],
  ['9', '010101011001110'],
  ['!', '010010010000010'],
  ['.', '000000000000010'],
  [':', '000010000010000'],
  ['-', '000000111000000'],
  ['/', '001001010100100'],
  ['?', '110001010000010'],
  ["'", '010010000000000'],
  [',', '000000000010100'],
  ['>', '100010001010100'],
  ['<', '001010100010001'],
  ['[', '110100100100110'],
  [']', '011001001001011'],
];

const FONT_KEY = 'pixel';
const CELL_W = 4; // 3px glyph + 1px gap
const CELL_H = 6; // 5px glyph + 1px gap

export function makeFont(scene) {
  if (scene.cache.bitmapFont.exists(FONT_KEY)) return;

  const texture = scene.textures.createCanvas('pixelfont', CELL_W * GLYPHS.length, CELL_H);
  const ctx = texture.getContext();
  ctx.fillStyle = '#ffffff';
  GLYPHS.forEach(([, bits], index) => {
    [...bits].forEach((bit, i) => {
      if (bit === '1') ctx.fillRect(index * CELL_W + (i % 3), Math.floor(i / 3), 1, 1);
    });
  });
  texture.refresh();

  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'pixelfont',
    width: CELL_W,
    height: CELL_H,
    chars: GLYPHS.map(([ch]) => ch).join(''),
    charsPerRow: GLYPHS.length,
  });
  scene.cache.bitmapFont.add(FONT_KEY, data);
}

export function addText(scene, x, y, text, { scale = 1, tint = 0xffffff, originX = 0.5, originY = 0.5 } = {}) {
  return scene.add
    .bitmapText(Math.round(x), Math.round(y), FONT_KEY, String(text).toUpperCase())
    .setScale(scale)
    .setTint(tint)
    .setOrigin(originX, originY);
}
