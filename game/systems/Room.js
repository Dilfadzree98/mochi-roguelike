import { TILE, ROOM_COLS, ROOM_ROWS, ROOM_X, ROOM_Y, FLOOR, DEPTH } from '../constants.js';

// One door slot centred on each wall. Stage 1 has a single room, so they stay locked.
const DOORS = [
  { col: 7, row: 0, angle: 0 },
  { col: 7, row: ROOM_ROWS - 1, angle: 180 },
  { col: 0, row: 4, angle: -90 },
  { col: ROOM_COLS - 1, row: 4, angle: 90 },
];

const DECORATIONS = ['flower', 'flower', 'clover', 'clover', 'pebble'];

// Draws a Sunny Garden room and returns its wall colliders.
export function buildRoom(scene, rng) {
  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLS; col++) {
      const x = ROOM_X + col * TILE;
      const y = ROOM_Y + row * TILE;
      const isWall = row === 0 || col === 0 || row === ROOM_ROWS - 1 || col === ROOM_COLS - 1;
      if (isWall) {
        const key = row === 0 ? 'wall_top' : `hedge${rng.int(0, 2)}`;
        scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.wall);
      } else {
        const key = rng.chance(0.1) ? 'grass3' : `grass${rng.int(0, 2)}`;
        scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.floor);
      }
    }
  }

  const decorationCount = rng.int(8, 12);
  for (let i = 0; i < decorationCount; i++) {
    const x = rng.int(FLOOR.left + 4, FLOOR.right - 4);
    const y = rng.int(FLOOR.top + 4, FLOOR.bottom - 4);
    scene.add.image(x, y, rng.pick(DECORATIONS)).setDepth(DEPTH.decor);
  }

  for (const door of DOORS) {
    scene.add
      .image(ROOM_X + door.col * TILE + TILE / 2, ROOM_Y + door.row * TILE + TILE / 2, 'door')
      .setAngle(door.angle)
      .setDepth(DEPTH.wall);
  }

  scene.add.image(ROOM_X, ROOM_Y, 'vignette').setOrigin(0).setDepth(DEPTH.overlay);

  const walls = scene.physics.add.staticGroup();
  const width = ROOM_COLS * TILE;
  const height = ROOM_ROWS * TILE;
  const rects = [
    [ROOM_X, ROOM_Y, width, TILE],
    [ROOM_X, ROOM_Y + height - TILE, width, TILE],
    [ROOM_X, ROOM_Y, TILE, height],
    [ROOM_X + width - TILE, ROOM_Y, TILE, height],
  ];
  for (const [x, y, w, h] of rects) walls.add(scene.add.zone(x + w / 2, y + h / 2, w, h));

  return { walls };
}
