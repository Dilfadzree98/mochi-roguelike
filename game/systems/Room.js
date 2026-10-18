import { TILE, ROOM_COLS, ROOM_ROWS, ROOM_X, ROOM_Y, FLOOR, DEPTH } from '../constants.js';
import { Rng } from './Rng.js';

const DOOR_SLOTS = {
  up: { col: 7, row: 0, angle: 0 },
  down: { col: 7, row: ROOM_ROWS - 1, angle: 180 },
  left: { col: 0, row: 4, angle: -90 },
  right: { col: ROOM_COLS - 1, row: 4, angle: 90 },
};

const DECORATIONS = ['flower', 'flower', 'clover', 'clover', 'pebble'];

// A door to or from a special room uses that room's gate.
function closedDoorTexture(room, neighbor) {
  const types = [room.type, neighbor.type];
  if (types.includes('boss')) return 'door_boss';
  if (types.includes('treasure')) return 'door_treasure';
  if (types.includes('shop')) return 'door_shop';
  return 'door';
}

// Wall colliders, leaving a 1-tile gap wherever a door is.
function wallRects(doors = {}) {
  const width = ROOM_COLS * TILE;
  const height = ROOM_ROWS * TILE;
  const horizontal = (y, gap) =>
    gap ? [[ROOM_X, y, 7 * TILE, TILE], [ROOM_X + 8 * TILE, y, 7 * TILE, TILE]] : [[ROOM_X, y, width, TILE]];
  const vertical = (x, gap) =>
    gap ? [[x, ROOM_Y, TILE, 4 * TILE], [x, ROOM_Y + 5 * TILE, TILE, 4 * TILE]] : [[x, ROOM_Y, TILE, height]];
  return [
    ...horizontal(ROOM_Y, doors.up),
    ...horizontal(ROOM_Y + height - TILE, doors.down),
    ...vertical(ROOM_X, doors.left),
    ...vertical(ROOM_X + width - TILE, doors.right),
  ];
}

function staticZones(scene, rects) {
  const group = scene.physics.add.staticGroup();
  for (const [x, y, w, h] of rects) group.add(scene.add.zone(x + w / 2, y + h / 2, w, h));
  return group;
}

// Draws one Sunny Garden room and its colliders.
//  - solidWalls: full ring with no gaps (enemies and shots)
//  - playerWalls + doorBlockers: walls with door gaps, and a blocker per door while it's closed
export function buildRoom(scene, room, dungeon) {
  const rng = new Rng(room.seed);
  const objects = [];
  const add = (obj) => {
    objects.push(obj);
    return obj;
  };

  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLS; col++) {
      const x = ROOM_X + col * TILE;
      const y = ROOM_Y + row * TILE;
      const isWall = row === 0 || col === 0 || row === ROOM_ROWS - 1 || col === ROOM_COLS - 1;
      if (isWall) {
        const key = row === 0 ? 'wall_top' : `hedge${rng.int(0, 2)}`;
        add(scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.wall));
      } else {
        const key = rng.chance(0.1) ? 'grass3' : `grass${rng.int(0, 2)}`;
        add(scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.floor));
      }
    }
  }

  const decorationCount = rng.int(8, 12);
  for (let i = 0; i < decorationCount; i++) {
    const x = rng.int(FLOOR.left + 4, FLOOR.right - 4);
    const y = rng.int(FLOOR.top + 4, FLOOR.bottom - 4);
    add(scene.add.image(x, y, rng.pick(DECORATIONS)).setDepth(DEPTH.decor));
  }

  add(scene.add.image(ROOM_X, ROOM_Y, 'vignette').setOrigin(0).setDepth(DEPTH.overlay));

  const solidWalls = staticZones(scene, wallRects());
  const playerWalls = staticZones(scene, wallRects(room.doors));
  const doorBlockers = scene.physics.add.staticGroup();

  const doors = Object.keys(DOOR_SLOTS)
    .filter((dir) => room.doors[dir])
    .map((dir) => {
      const slot = DOOR_SLOTS[dir];
      const x = ROOM_X + slot.col * TILE + TILE / 2;
      const y = ROOM_Y + slot.row * TILE + TILE / 2;
      const neighbor = dungeon.neighbor(room, dir);
      const closedTexture = closedDoorTexture(room, neighbor);
      const image = add(scene.add.image(x, y, closedTexture).setAngle(slot.angle).setDepth(DEPTH.wall));
      const blocker = scene.add.zone(x, y, TILE, TILE);
      doorBlockers.add(blocker);
      const door = { dir, x, y, image, blocker, closedTexture, neighbor };
      blocker.door = door;
      return door;
    });

  const setDoorOpen = (door, open) => {
    door.image.setTexture(open ? 'door_open' : door.closedTexture);
    door.blocker.body.enable = !open;
  };

  return {
    solidWalls,
    playerWalls,
    doorBlockers,
    doors,

    // Doors into a locked room stay shut until unlocked with a key.
    setOpen(open) {
      for (const door of doors) setDoorOpen(door, open && !door.neighbor.locked);
    },

    unlock(door) {
      setDoorOpen(door, true);
    },

    destroy() {
      objects.forEach((obj) => obj.destroy());
      solidWalls.destroy(true);
      playerWalls.destroy(true);
      doorBlockers.destroy(true);
    },
  };
}
