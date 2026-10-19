// The screen is 480x272. All sprites are drawn at this resolution with 2px outlines,
// and every distance and speed in the game is in these screen pixels.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 272;

export const TILE = 32;

// Room sizes in floor tiles (always odd, so doors sit in the middle of each wall). Most rooms are
// one screen; some fight rooms are bigger and the camera scrolls to follow Mochi.
export const ROOM_SIZES = {
  normal: { cols: 13, rows: 7 },
  wide: { cols: 21, rows: 7 },
  tall: { cols: 13, rows: 11 },
  big: { cols: 21, rows: 11 },
};

// A one-screen room with its walls (480x288) is a little taller than the screen, so the top and
// bottom walls are cut by 8px each. The HUD sits over the top wall.
export const ROOM_X = 0;
export const ROOM_Y = (GAME_HEIGHT - TILE * (ROOM_SIZES.normal.rows + 2)) / 2; // -8
export const HUD_HEIGHT = TILE + ROOM_Y;                                       // 24: the visible part of the top wall

// The room Mochi is in now: its floor size in tiles (`ROOM`) and its walkable floor area in
// world pixels (`FLOOR`). Both change when entering a room (`setRoomSize`).
export const ROOM = { ...ROOM_SIZES.normal };
export const FLOOR = { left: 0, top: 0, right: 0, bottom: 0 };

export function setRoomSize({ cols, rows }) {
  ROOM.cols = cols;
  ROOM.rows = rows;
  FLOOR.left = ROOM_X + TILE;
  FLOOR.top = ROOM_Y + TILE;
  FLOOR.right = FLOOR.left + cols * TILE;
  FLOOR.bottom = FLOOR.top + rows * TILE;
}
setRoomSize(ROOM_SIZES.normal);

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
