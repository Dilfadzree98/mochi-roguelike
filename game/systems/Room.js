import { TILE, ROOM_X, ROOM_Y, FLOOR, DEPTH } from '../constants.js';
import { roomVignette } from '../art/World.js';
import { Rng } from './Rng.js';
import { tileCenter } from './Pathing.js';

// Door positions in wall tiles, for a room `width` x `height` tiles including its walls.
// Doors are always in the middle of each wall.
function doorSlots(width, height) {
  const midC = (width - 1) / 2;
  const midR = (height - 1) / 2;
  return {
    up: { col: midC, row: 0, angle: 0 },
    down: { col: midC, row: height - 1, angle: 180 },
    left: { col: 0, row: midR, angle: -90 },
    right: { col: width - 1, row: midR, angle: 90 },
  };
}

// Decorations that give off a soft light.
const DECOR_GLOW = { glow_mushroom: 'glow_blue', purple_sprout: 'glow_purple' };

// A door to or from a special room uses that room's gate.
function closedDoorTexture(room, neighbor) {
  const types = [room.type, neighbor.type];
  if (types.includes('secret')) return 'door_secret';
  if (types.includes('boss')) return 'door_boss';
  if (types.includes('miniboss')) return 'door_miniboss';
  if (types.includes('treasure')) return 'door_treasure';
  if (types.includes('shop')) return 'door_shop';
  if (types.includes('sacrifice')) return 'door_sacrifice';
  return 'door';
}

// A secret door stays a plain (cracked) wall until it's bombed open.
const isHiddenDoor = (room, dungeon, dir) => room.secretDoor === dir && !dungeon.neighbor(room, dir).revealed;

// Wall colliders for a room `w` x `h` tiles (walls included), leaving a 1-tile gap wherever a door is.
function wallRects(w, h, doors = {}) {
  const width = w * TILE;
  const height = h * TILE;
  const midC = (w - 1) / 2;
  const midR = (h - 1) / 2;
  const horizontal = (y, gap) =>
    gap ? [[ROOM_X, y, midC * TILE, TILE], [ROOM_X + (midC + 1) * TILE, y, midC * TILE, TILE]] : [[ROOM_X, y, width, TILE]];
  const vertical = (x, gap) =>
    gap ? [[x, ROOM_Y, TILE, midR * TILE], [x, ROOM_Y + (midR + 1) * TILE, TILE, midR * TILE]] : [[x, ROOM_Y, TILE, height]];
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
  const { cols, rows } = room.size;
  const width = cols + 2; // tiles, walls included
  const height = rows + 2;
  const objects = [];
  const add = (obj) => {
    objects.push(obj);
    return obj;
  };

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const x = ROOM_X + col * TILE;
      const y = ROOM_Y + row * TILE;
      const isWall = row === 0 || col === 0 || row === height - 1 || col === width - 1;
      if (isWall) {
        const key = row === 0 ? `${floor.id}_wall_top` : `${floor.id}_wall${rng.int(0, 2)}`;
        add(scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.wall));
      } else {
        const key = `${floor.id}_floor${rng.chance(0.1) ? 3 : rng.int(0, 2)}`;
        add(scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.floor));
      }
    }
  }

  const decorationCount = Math.round((rng.int(8, 12) * cols * rows) / (13 * 7)); // more in bigger rooms
  for (let i = 0; i < decorationCount; i++) {
    const x = rng.int(FLOOR.left + 8, FLOOR.right - 8);
    const y = rng.int(FLOOR.top + 8, FLOOR.bottom - 8);
    const key = rng.pick(floor.decorations);
    if (DECOR_GLOW[key]) add(scene.add.image(x, y, DECOR_GLOW[key]).setDepth(DEPTH.decor).setAlpha(0.8));
    add(scene.add.image(x, y, key).setDepth(DEPTH.decor));
  }

  add(scene.add.image(ROOM_X, ROOM_Y, roomVignette(scene, floor, cols, rows)).setOrigin(0).setDepth(DEPTH.overlay));

  const solidWalls = staticZones(scene, wallRects(width, height));
  const openDoors = () => Object.fromEntries(Object.keys(room.doors).map((dir) => [dir, room.doors[dir] && !isHiddenDoor(room, dungeon, dir)]));
  let playerWalls = staticZones(scene, wallRects(width, height, openDoors()));
  const slots = doorSlots(width, height);
  const doorBlockers = scene.physics.add.staticGroup();
  const slotCenter = (dir) => ({ x: ROOM_X + slots[dir].col * TILE + TILE / 2, y: ROOM_Y + slots[dir].row * TILE + TILE / 2 });

  const makeDoor = (dir) => {
    const { x, y } = slotCenter(dir);
    const neighbor = dungeon.neighbor(room, dir);
    const closedTexture = closedDoorTexture(room, neighbor);
    const image = add(scene.add.image(x, y, closedTexture).setAngle(slots[dir].angle).setDepth(DEPTH.wall));
    const blocker = scene.add.zone(x, y, TILE, TILE);
    doorBlockers.add(blocker);
    // A secret door is just a hole: it looks the same open or shut.
    const door = { dir, x, y, image, blocker, closedTexture, openTexture: closedTexture === 'door_secret' ? 'door_secret' : 'door_open', neighbor };
    blocker.door = door;
    return door;
  };
  const doors = Object.keys(slots)
    .filter((dir) => room.doors[dir] && !isHiddenDoor(room, dungeon, dir))
    .map(makeDoor);

  // The cracked wall over a hidden secret door.
  let secretCrack = null;
  if (room.secretDoor && isHiddenDoor(room, dungeon, room.secretDoor)) {
    const { x, y } = slotCenter(room.secretDoor);
    secretCrack = { dir: room.secretDoor, x, y, image: add(scene.add.image(x, y, 'wall_crack').setAngle(slots[room.secretDoor].angle).setDepth(DEPTH.wall + 0.5)) };
  }

  const setDoorOpen = (door, open) => {
    door.image.setTexture(open ? door.openTexture : door.closedTexture);
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
    get playerWalls() {
      return playerWalls;
    },
    get secretCrack() {
      return secretCrack;
    },
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

    // A bomb found the secret door: the wall gets a hole. Returns the new player walls
    // (Game swaps its collider over to them).
    revealSecret() {
      const neighbor = dungeon.neighbor(room, secretCrack.dir);
      neighbor.revealed = true;
      secretCrack.image.destroy();
      const door = makeDoor(secretCrack.dir);
      doors.push(door);
      setDoorOpen(door, room.cleared);
      secretCrack = null;
      playerWalls.destroy(true);
      playerWalls = staticZones(scene, wallRects(width, height, openDoors()));
      return playerWalls;
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
