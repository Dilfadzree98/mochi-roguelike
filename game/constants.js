export const TILE = 16;
export const ROOM_COLS = 15; // 13 floor tiles + a 1-tile wall on each side
export const ROOM_ROWS = 9;  // 7 floor tiles + a 1-tile wall on each side
export const HUD_HEIGHT = 16;

export const GAME_WIDTH = TILE * ROOM_COLS;               // 240
export const GAME_HEIGHT = HUD_HEIGHT + TILE * ROOM_ROWS; // 160

// The room sits under the HUD bar.
export const ROOM_X = 0;
export const ROOM_Y = HUD_HEIGHT;

// Walkable floor area inside the walls, in world pixels.
export const FLOOR = {
  left: ROOM_X + TILE,
  top: ROOM_Y + TILE,
  right: ROOM_X + TILE * (ROOM_COLS - 1),
  bottom: ROOM_Y + TILE * (ROOM_ROWS - 1),
};

// Draw order. Actors use DEPTH.actors + their y so lower things draw in front.
export const DEPTH = {
  floor: 0,
  decor: 1,
  slime: 2,
  shadow: 3,
  wall: 4,
  actors: 10,
  overlay: 1000,
  ui: 1001,
};

// Text tints (the font is drawn white).
export const UI = {
  peach: 0xffd8c2,
  leaf: 0xa6d987,
  gold: 0xf2c94c,
  muted: 0xc9c3a1,
  dim: 0x7a6a8f,
};
