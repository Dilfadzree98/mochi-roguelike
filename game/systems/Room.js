import { TILE, ROOM_COLS, ROOM_ROWS, ROOM_X, ROOM_Y, FLOOR, DEPTH } from '../constants.js';
import { Rng } from './Rng.js';
import { tileCenter } from './Pathing.js';

const DOOR_SLOTS = {
  up: { col: 7, row: 0, angle: 0 },
  down: { col: 7, row: ROOM_ROWS - 1, angle: 180 },
  left: { col: 0, row: 4, angle: -90 },
  right: { col: ROOM_COLS - 1, row: 4, angle: 90 },
};

// Decorations that give off a soft light.
const DECOR_GLOW = { glow_mushroom: 'glow_blue', purple_sprout: 'glow_purple' };

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

// Draws one room, in its floor's theme, and its colliders.
//  - solidWalls: full ring with no gaps (enemies and shots)
//  - playerWalls + doorBlockers: walls with door gaps, and a blocker per door while it's closed
export function buildRoom(scene, room, dungeon) {
  const rng = new Rng(room.seed);
  const floor = dungeon.floor;
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
        const key = row === 0 ? `${floor.id}_wall_top` : `${floor.id}_wall${rng.int(0, 2)}`;
        add(scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.wall));
      } else {
        const key = `${floor.id}_floor${rng.chance(0.1) ? 3 : rng.int(0, 2)}`;
        add(scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.floor));
      }
    }
  }

  const decorationCount = rng.int(8, 12);
  for (let i = 0; i < decorationCount; i++) {
    const x = rng.int(FLOOR.left + 8, FLOOR.right - 8);
    const y = rng.int(FLOOR.top + 8, FLOOR.bottom - 8);
    const key = rng.pick(floor.decorations);
    if (DECOR_GLOW[key]) add(scene.add.image(x, y, DECOR_GLOW[key]).setDepth(DEPTH.decor).setAlpha(0.8));
    add(scene.add.image(x, y, key).setDepth(DEPTH.decor));
  }

  add(scene.add.image(ROOM_X, ROOM_Y, `vignette_${floor.id}`).setOrigin(0).setDepth(DEPTH.overlay));

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

  // Obstacles: one tile each, solid to everything. Drawn by their bottom edge so
  // Mochi can stand "behind" them.
  const obstacleBodies = scene.physics.add.staticGroup();
  const blocked = new Set(); // "col,row" of every standing obstacle, for pathfinding
  const obstacles = room.obstacles
    .filter((ob) => !ob.broken)
    .map((ob) => {
      const { x, y } = tileCenter(ob.col, ob.row);
      const image = scene.add.image(x, y + TILE / 2, ob.texture).setOrigin(0.5, 1).setDepth(DEPTH.actors + y + TILE / 2);
      const zone = scene.add.zone(x, y, TILE, TILE);
      obstacleBodies.add(zone);
      const obstacle = { data: ob, x, y, image, zone };
      zone.obstacle = obstacle;
      blocked.add(`${ob.col},${ob.row}`);
      return obstacle;
    });

  return {
    solidWalls,
    playerWalls,
    doorBlockers,
    doors,
    obstacleBodies,
    obstacles,
    blocked,

    // Bombs break obstacles; the room remembers it.
    breakObstacle(obstacle) {
      obstacle.data.broken = true;
      blocked.delete(`${obstacle.data.col},${obstacle.data.row}`);
      obstacle.image.destroy();
      obstacle.zone.destroy();
      obstacles.splice(obstacles.indexOf(obstacle), 1);
    },

    // Doors into a locked room stay shut until unlocked with a key.
    setOpen(open) {
      for (const door of doors) setDoorOpen(door, open && !door.neighbor.locked);
    },

    unlock(door) {
      setDoorOpen(door, true);
    },

    destroy() {
      objects.forEach((obj) => obj.destroy());
      obstacles.forEach((obstacle) => obstacle.image.destroy());
      obstacleBodies.destroy(true);
      solidWalls.destroy(true);
      playerWalls.destroy(true);
      doorBlockers.destroy(true);
    },
  };
}
