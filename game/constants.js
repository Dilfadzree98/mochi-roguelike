// The screen is 480x272. All sprites are drawn at this resolution with 2px outlines,
// and every distance and speed in the game is in these screen pixels.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 272;

export const TILE = 32;
export const ROOM_COLS = 15; // 13 floor tiles + a 1-tile wall on each side
export const ROOM_ROWS = 9;  // 7 floor tiles + a 1-tile wall on each side

// The room (480x288) is a little taller than the screen, so the top and bottom walls
// are cut by 8px each. The HUD sits over the top wall.
export const ROOM_X = 0;
export const ROOM_Y = (GAME_HEIGHT - TILE * ROOM_ROWS) / 2; // -8
export const HUD_HEIGHT = TILE + ROOM_Y;                    // 24: the visible part of the top wall

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
