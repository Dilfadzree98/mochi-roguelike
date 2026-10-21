import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, FLOOR, DEPTH, TILE, UI, ROOM_X, ROOM_Y, setRoomSize } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { Rng, newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { Audio } from '../systems/Audio.js';
import { bossIds, generateDungeon } from '../systems/DungeonGen.js';
import { TIER_WEIGHTS, drawItem, makeItemPool } from '../systems/Items.js';
import { buildRoom } from '../systems/Room.js';
import { areaFree, flowField, lineClear, nearestFree, nextStep, tileOf } from '../systems/Pathing.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';
import { EnemyBullet } from '../entities/EnemyBullet.js';
import { Skills } from '../systems/Skills.js';

const ROOM_START_DELAY_MS = 500;
const WAVE_BREAK_MS = 900;
const SPAWN_MIN_PLAYER_DISTANCE = 128;
const SPAWN_MIN_ENEMY_DISTANCE = 40;
const PICKUP_RADIUS = 18;
const TOOLTIP_RADIUS = 48;
// Walking up to an unbeaten mini boss room's door warns you first.
const DOOR_WARNING_RADIUS = 72;
const MINI_BOSS_WARNING = { name: 'Danger: mini bosses!', description: 'Two waves, no way out until they are beaten. Enter at your own risk' };
const FADE_MS = 150;
const FADE_COLOR = [18, 14, 22];
const GAME_OVER_DELAY_MS = 1600;
const WIN_DELAY_MS = 3000;
const HINT_COOLDOWN_MS = 1200;
const ENEMY_HP_PER_FLOOR = 0.2; // regular enemies get 20% more health per floor
const BOSS_HP_BY_FLOOR = [1, 1.5, 2.1, 2.8]; // bosses get tougher the deeper they're met

// Drops. Each point of luck raises the chances.
const ROOM_DROP_CHANCE = 0.5;
const ROOM_DROP_LUCK_BONUS = 0.15;
const ROOM_DROP_WEIGHTS = { coin: 35, heart: 25, bomb: 15, key: 15, chest: 10 };
const CHEST = { min: 2, max: 4, spread: 26, weights: { coin: 45, heart: 20, bomb: 18, key: 17 } }; // what a chest spills
const COIN_DROP_CHANCE = 0.1;        // a regular enemy drops a coin
const COIN_DROP_LUCK_BONUS = 0.03;
const BOSS_DOUBLE_HEART_CHANCE = 0.4; // a boss always drops a heart, sometimes two

const BOMB_FUSE_MS = 2000;
const BOMB_RADIUS = 60;
const BOMB_DAMAGE = 5;
const BOMB_SIZE = 14;          // the bomb's hitbox
const BOMB_DRAG = 450;         // how fast a moving bomb slows down (px/s per second)
const BOMB_KICK_DISTANCE = 100; // px a bomb slides when Mochi walks into it
const BOMB_SHOT_DISTANCE = 50;  // px a bomb slides when Mochi shoots it
// Starting speed that slides exactly that far before drag stops it: v^2 = 2 * drag * distance.
const slideSpeed = (distance) => Math.sqrt(2 * BOMB_DRAG * distance);
const BOMB_BOUNCE = 0.6;       // speed kept after bouncing off a wall or obstacle

const ROOT_WARNING_MS = 700;
const ROOT_RADIUS = 22;
const MARK_RADIUS = 20; // boss attacks that land on a target mark

const SPLIT_SPREAD = 0.6;      // radians between split fragments
const SPLIT_RANGE = 100;
const MULTISHOT_SPACING = 8;   // px between side-by-side seeds
const SPREAD_ANGLE = 0.26;     // radians between fanned seeds (about 15 degrees)
const SPRINKLER_SEEDS = 8;
const SPRINKLER_RANGE = 140;
const CHAIN_RANGE = 100;       // px a zap can jump
const CHAIN_DAMAGE = 0.6;      // times the shot's damage

const TREASURE_SPACING = 88;   // px between the three treasure pedestals
const BURST_GAP_MS = 80;       // Pea Pod: time between the seeds of a burst
const BIG_SHOT = { scale: 2, damage: 3 }; // Watermelon Seed: every Nth shot
const MINE = { armMs: 400, lifeMs: 8000, trigger: 30, radius: 56, damage: 3 }; // Burr Mine (damage x player damage)
const RICOCHET_RANGE = 160;    // Pinball Pea: how far a shot looks for its next enemy
const FIREWORK_RANGE = 80;     // Firework Seed: range of the small seeds
const UPGRADE_SPACING = 80;    // px between the two skill upgrades after a boss

const SHOP_PRICES = { item: 5, heart: 3, bomb: 3, key: 3 };
const RESTOCK_PRICES = [[3, 6], [5, 9], [7, 12], [9, 15]]; // random price range for a shop restock, by floor

// Sacrifice altar: costs a full heart a try (even your last one: it can kill you); the chance
// of an item grows with each try.
const SACRIFICE = { cost: 2, chance: 0.35, chanceStep: 0.2, maxChance: 0.9, maxItems: 2, itemOffset: 72 };
const SECRET_ITEM_CHANCE = 0.4; // otherwise a secret room holds a pile of drops
const SECRET_DROPS = { min: 3, max: 5, weights: { coin: 40, heart: 20, bomb: 15, key: 15, chest: 10 } };
const SECRET_BLAST_REACH = 28; // px beyond the blast radius that still cracks a secret wall open
const PICKUP_TEXTURES = { heart: 'heart_full', coin: 'coin', bomb: 'bomb', key: 'key', chest: 'chest' };
const PICKUP_INFO = {
  heart: { name: 'Heart', description: 'Heals one heart' },
  bomb: { name: 'Bomb', description: 'E to drop, walk into it or shoot it to push' },
  key: { name: 'Key', description: 'Opens locked gates' },
};

// The middle of the current room's floor (rooms come in several sizes).
const CENTER = {
  get x() {
    return (FLOOR.left + FLOOR.right) / 2;
  },
  get y() {
    return (FLOOR.top + FLOOR.bottom) / 2;
  },
};

// Where Mochi appears after walking through a door in direction `dir`.
function entryPoint(dir) {
  if (dir === 'up') return { x: CENTER.x, y: FLOOR.bottom - 20 };
  if (dir === 'down') return { x: CENTER.x, y: FLOOR.top + 20 };
  if (dir === 'left') return { x: FLOOR.right - 20, y: CENTER.y };
  if (dir === 'right') return { x: FLOOR.left + 20, y: CENTER.y };
  return { x: CENTER.x, y: CENTER.y };
}

// The camera scrolls over rooms bigger than the screen (the top and bottom 8px of the walls stay hidden).
const CAMERA_LERP = 0.15;

// A run: four floors of rooms. Fight rooms have 2 waves and stay locked until both are cleared;
// each floor's boss opens a trapdoor to the next floor, and the last boss wins the run.
export class Game extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create(data) {
    this.seed = data?.seed ?? newSeed();
    this.rng = new Rng(this.seed);
    // Cosmetic randomness gets its own stream so visuals never shift gameplay rolls.
    this.fxRng = new Rng(this.seed ^ 0x5eed);
    this.enemyDefs = this.cache.json.get('enemies');
    this.itemDefs = this.cache.json.get('items');
    this.floors = this.cache.json.get('floors');
    const characters = this.cache.json.get('characters');
    this.character = characters.find((c) => c.id === data?.character) ?? characters[0];
    this.itemPool = makeItemPool(this.itemDefs);
    this.bossOrder = this.rng.shuffle(bossIds(this.enemyDefs)); // a different boss on every floor

    this.shots = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.enemyBodies = this.physics.add.group();
    this.slime = this.add.group();
    this.enemies = [];
    this.pickups = [];     // things taken by walking over them
    this.bombs = [];
    this.mines = [];
    this.hitCount = 0;
    this.bombBodies = this.physics.add.group(); // hitboxes of placed bombs, so they can be kicked
    this.roomObjects = []; // extra objects owned by the current room, destroyed on leaving
    this.roomColliders = [];

    this.player = new Player(this, CENTER.x, CENTER.y, this.character);
    this.skills = new Skills(this, this.player);

    this.physics.add.collider(this.enemyBodies, this.enemyBodies);
    this.physics.add.overlap(this.shots, this.enemyBodies, (shot, body) => this.onShotHitEnemy(shot, body.owner));
    this.physics.add.overlap(this.player.hitbox, this.enemyBodies, (_, body) => this.onPlayerTouchEnemy(body.owner));
    this.physics.add.overlap(this.player.hitbox, this.enemyShots, (_, bullet) => this.onPlayerShot(bullet));
    this.physics.add.overlap(this.player.hitbox, this.bombBodies, (_, zone) => this.kickBomb(zone.bomb));
    this.physics.add.overlap(this.shots, this.bombBodies, (shot, zone) => this.shootBomb(shot, zone.bomb));
    // A kicked bomb stops when it reaches an enemy, so the blast catches it.
    this.physics.add.overlap(this.enemyBodies, this.bombBodies, (_, zone) => zone.body.setVelocity(0, 0));

    this.roomsCleared = 0;
    this.kills = 0;
    this.waveIndex = 0;
    this.waveActive = false;
    this.over = false;
    this.transitioning = false;
    this.nextHintAt = 0;
    this.tooltip = null;

    this.startFloor(0);
    this.scene.launch('HUD');
    this.enterRoom(this.dungeon.start, null);
    this.banner(this.dungeon.floor.name, UI.peach, 'Floor 1');
    this.setupPause();
  }

  startFloor(index) {
    this.floorIndex = index;
    this.dungeon = generateDungeon(this.rng, this.floors[index], index, this.enemyDefs, this.bossOrder[index % this.bossOrder.length]);
    Audio.startMusic(index);
    this.events.emit('floor', index, this.floors[index]);
  }

  // Esc or P opens the pause menu; leaving the window or tab pauses automatically.
  setupPause() {
    this.input.keyboard.on('keydown-ESC', () => this.pause());
    this.input.keyboard.on('keydown-P', () => this.pause());
    this.input.keyboard.on('keydown-I', () => this.toggleStats());
    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this.over && !this.transitioning) this.skills.tryCast();
    });

    // Keys released while paused never reached this scene, so forget held keys on resume.
    const onResume = () => {
      this.input.keyboard.resetKeys();
      Audio.setMusicPaused(false);
    };
    const onBlur = () => this.pause();
    this.events.on('resume', onResume);
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
    this.events.once('shutdown', () => {
      this.events.off('resume', onResume);
      this.game.events.off(Phaser.Core.Events.BLUR, onBlur);
    });
  }

  // Show or hide the stats panel (I, or the pause menu). Remembered between sessions.
  toggleStats() {
    const on = !Save.showStats();
    Save.setShowStats(on);
    this.events.emit('statsVisible', on);
    return on;
  }

  pause() {
    if (this.over || this.transitioning || !this.sys.isActive()) return;
    Audio.setMusicPaused(true);
    this.scene.pause();
    this.scene.launch('Pause');
  }

  playSfx(name) {
    Audio.play(name);
  }

  update(time, delta) {
    if (this.transitioning) return;

    this.player.speedMultiplier = this.slowAt(this.player.feet);
    this.skills.update(time);
    this.player.update(time, delta);

    for (const enemy of this.enemies) enemy.update(time, delta, this.player);
    this.enemies = this.enemies.filter((enemy) => !enemy.destroyed);

    for (const shot of this.shots.getChildren().slice()) shot.update(time, delta);
    for (const bullet of this.enemyShots.getChildren().slice()) bullet.update(time);
    this.updateBombs(delta);
    this.updateMines(time);

    this.collectPickups();
    this.updateTooltip();

    if (this.waveActive && this.enemies.every((enemy) => enemy.state === 'dead')) this.onWaveCleared();

    if (this.room.cleared && this.player.alive && !this.over) {
      const dir = this.doorwayReached();
      if (dir) this.goThroughDoor(dir);
    }
  }

  // ---------- Rooms ----------

  enterRoom(room, fromDir) {
    this.room = room;
    room.visited = true;
    setRoomSize(room.size);
    this.view = buildRoom(this, room, this.dungeon);

    const hitbox = this.player.hitbox;
    this.roomColliders = [
      this.physics.add.collider(hitbox, this.view.playerWalls),
      this.physics.add.collider(hitbox, this.view.doorBlockers, (_, blocker) => this.onDoorBump(blocker.door)),
      this.physics.add.collider(this.enemyBodies, this.view.solidWalls),
      this.physics.add.overlap(this.shots, this.view.solidWalls, (shot) => shot.hitWall()),
      this.physics.add.overlap(this.enemyShots, this.view.solidWalls, (bullet) => bullet.pop()),
      // Obstacles block everyone and every bullet, so Mochi can hide behind them.
      this.physics.add.collider(hitbox, this.view.obstacleBodies, (_, zone) => this.onObstacleTouch(zone.obstacle)),
      this.physics.add.collider(this.enemyBodies, this.view.obstacleBodies, null, (body) => !body.owner?.passesObstacles),
      this.physics.add.overlap(this.shots, this.view.obstacleBodies, (shot, zone) => !shot.stats.phase && shot.hitObstacle(zone)),
      this.physics.add.overlap(this.enemyShots, this.view.obstacleBodies, (bullet) => bullet.pop()),
      this.physics.add.collider(this.bombBodies, this.view.solidWalls),
      this.physics.add.collider(this.bombBodies, this.view.obstacleBodies),
    ];
    this.flowCache = new Map();
    this.shieldsLeft = this.player.stats.roomShield;

    const entry = entryPoint(fromDir);
    this.player.placeAt(entry.x, entry.y);

    const camera = this.cameras.main;
    const width = (room.size.cols + 2) * TILE;
    const height = (room.size.rows + 2) * TILE;
    camera.setBounds(ROOM_X, ROOM_Y + 8, width, height - 16);
    camera.startFollow(this.player.hitbox, true, CAMERA_LERP, CAMERA_LERP);
    camera.centerOn(entry.x, entry.y);

    if (room.type === 'start') this.addStartHint();
    if (room.type === 'treasure') this.setUpTreasure(room);
    if (room.type === 'shop') this.setUpShop(room);
    if (room.type === 'boss' && room.cleared) this.setUpBossReward(room);
    if (room.type === 'miniboss' && room.cleared) this.setUpMiniBossReward(room);
    if (room.type === 'sacrifice') this.setUpSacrifice(room);
    if (room.type === 'secret') this.setUpSecret(room);
    room.pickups.forEach((pickup) => this.spawnPickup(pickup));
    this.doorWarnings = this.view.doors
      .filter((door) => door.neighbor.type === 'miniboss' && !door.neighbor.cleared)
      .map((door) => ({ x: door.x, y: door.y, radius: DOOR_WARNING_RADIUS, warning: true, info: MINI_BOSS_WARNING }));

    this.events.emit('room', this.dungeon, room);
    this.events.emit('wave', 0, 0);

    this.view.setOpen(room.cleared);
    if (!room.cleared) {
      this.waveIndex = 0;
      this.time.delayedCall(ROOM_START_DELAY_MS, () => this.startWave());
    }
  }

  // Finish every effect, then remove everything that belongs to the room.
  leaveRoom() {
    this.skills.stop();
    this.tweens.getTweens().forEach((tween) => tween.complete());
    this.bombs.forEach((bomb) => bomb.timer.remove());
    this.bombs = [];
    this.mines = [];
    this.enemies.forEach((enemy) => enemy.destroy());
    this.enemies = [];
    this.shots.clear(true, true);
    this.enemyShots.clear(true, true);
    this.slime.clear(true, true);
    this.hideTooltip();
    this.roomObjects.forEach((obj) => obj.destroy());
    this.roomObjects = [];
    this.pickups = [];
    this.roomColliders.forEach((collider) => this.physics.world.removeCollider(collider));
    this.roomColliders = [];
    this.view.destroy();
  }

  // Doors are the only gaps in the walls, so being past the floor edge means being in a doorway.
  doorwayReached() {
    const { x, y } = this.player.hitbox;
    if (y < FLOOR.top) return 'up';
    if (y > FLOOR.bottom) return 'down';
    if (x < FLOOR.left) return 'left';
    if (x > FLOOR.right) return 'right';
    return null;
  }

  goThroughDoor(dir) {
    const next = this.dungeon.neighbor(this.room, dir);
    this.fadeTo(() => this.enterRoom(next, dir));
  }

  // Fade out, swap rooms (or floors), fade back in.
  fadeTo(change) {
    this.transitioning = true;
    this.player.stop();
    const camera = this.cameras.main;
    camera.fadeOut(FADE_MS, ...FADE_COLOR);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.leaveRoom();
      change();
      camera.fadeIn(FADE_MS, ...FADE_COLOR);
      this.transitioning = false;
    });
  }

  // Drop through the trapdoor to the next floor.
  descend() {
    Audio.play('descend');
    this.fadeTo(() => {
      this.startFloor(this.floorIndex + 1);
      this.enterRoom(this.dungeon.start, null);
      this.banner(this.dungeon.floor.name, UI.peach, `Floor ${this.floorIndex + 1}`);
    });
  }

  // Walking into a locked door uses a key.
  onDoorBump(door) {
    if (!this.room.cleared || !door.neighbor.locked) return;
    if (this.player.inventory.keys <= 0) {
      this.hint('Needs a key');
      return;
    }
    this.player.addToInventory('keys', -1);
    door.neighbor.locked = false;
    this.view.unlock(door);
    Audio.play('unlock');
    this.burst(door.x, door.y, 'spark', 8, { distance: 24 });
  }

  // Bombs and the Burger Beam break obstacles; the room remembers.
  breakObstacle(obstacle) {
    this.burst(obstacle.x, obstacle.y, 'smoke', 6, { distance: 20 });
    this.burst(obstacle.x, obstacle.y, 'husk', 6, { distance: 24 });
    this.cameras.main.shake(80, 0.006);
    this.view.breakObstacle(obstacle);
  }

  // Thorn clusters hurt on touch.
  onObstacleTouch(obstacle) {
    if (obstacle.data.hurts) this.damagePlayer(1, obstacle.x, obstacle.y);
  }

  // ---------- Pathfinding (used by enemy behaviours) ----------

  // Direction for an enemy to walk toward Mochi.
  chaseAngle(enemy) {
    const target = this.player.hitbox;
    return this.pathAngle(enemy.x, enemy.y, target.x, target.y, enemy.def.hitbox.w / 2);
  }

  // Direction to walk from one point to another: straight when nothing is in the way,
  // otherwise toward the next tile of a path around the obstacles.
  pathAngle(fromX, fromY, toX, toY, halfWidth) {
    const direct = Math.atan2(toY - fromY, toX - fromX);
    const blocked = this.view.blocked;
    if (blocked.size === 0 || lineClear(blocked, fromX, fromY, toX, toY, halfWidth)) return direct;

    // Flow fields are cached per target tile (Mochi, Chinggu's target...) until obstacles change.
    const targetTile = tileOf(toX, toY);
    const key = `${targetTile.col},${targetTile.row},${blocked.size}`;
    if (!this.flowCache.has(key)) {
      if (this.flowCache.size > 30) this.flowCache.clear();
      this.flowCache.set(key, flowField(blocked, targetTile));
    }
    const step = nextStep(this.flowCache.get(key), tileOf(fromX, fromY));
    return step ? Math.atan2(step.y - fromY, step.x - fromX) : direct;
  }

  // Free floor point near (x, y): not inside an obstacle.
  freeSpot(x, y, half = 12) {
    return areaFree(this.view.blocked, x, y, half) ? { x, y } : nearestFree(this.view.blocked, x, y);
  }

  addStartHint() {
    if (this.floorIndex > 0) return;
    const lines = ['[WASD] move, [Arrows] shoot, [E] bomb', '[Space] skill, [Tab] map, [I] stats, [Esc] pause'];
    lines.forEach((line, i) => {
      const hint = addText(this, CENTER.x, FLOOR.bottom - 34 + i * 14, line, { tint: UI.muted })
        .setDepth(DEPTH.shadow)
        .setAlpha(0.7);
      this.roomObjects.push(hint);
    });
  }

  // ---------- Treasure room, shop and boss reward ----------

  // A glowing pedestal, with an item on it if `itemId` is set. `onTake` runs when Mochi
  // takes it. Returns the pickup spot (or null for an empty pedestal).
  addItemPedestal(x, y, itemId, onTake) {
    const def = itemId ? this.itemDefs[itemId] : null;
    const glow = this.add.image(x, y, 'glow').setDepth(DEPTH.decor);
    const pedestal = this.add.image(x, y + 8, 'pedestal').setOrigin(0.5, 1).setDepth(DEPTH.actors + y + 8);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(glow, pedestal);
    if (!itemId) return null;

    const icon = this.floatingImage(x, y - 24, def.icon);
    return this.addPickupSpot(x, y - 8, [icon], () => {
      onTake();
      this.giveItem(itemId);
      return true;
    }, def);
  }

  // Three items on pedestals; taking one makes the others vanish back into the item pool.
  setUpTreasure(room) {
    room.contents ??= { itemIds: [this.drawItem(), this.drawItem(), this.drawItem()].filter(Boolean) };
    const { itemIds } = room.contents;
    const xs = [CENTER.x - TREASURE_SPACING, CENTER.x, CENTER.x + TREASURE_SPACING];

    const note = itemIds.length > 1 ? addText(this, CENTER.x, CENTER.y + 34, 'Take one', { tint: UI.muted }).setDepth(DEPTH.shadow) : null;
    if (note) this.roomObjects.push(note);

    const spots = [];
    xs.forEach((x, i) => {
      const itemId = itemIds[i];
      spots.push(this.addItemPedestal(x, CENTER.y, itemId, () => {
        const others = itemIds.filter((id) => id !== itemId);
        room.contents.itemIds = [];
        this.itemPool.push(...others); // back into the pool
        note?.destroy();
        for (const spot of spots) {
          if (!spot || spot.itemId === itemId) continue;
          this.burst(spot.x, spot.y - 12, 'smoke', 6, { distance: 16 });
          this.removePickupSpot(spot);
        }
      }));
      if (spots[i]) spots[i].itemId = itemId;
    });
  }

  // After a boss: an item, and a trapdoor down (unless this was the last floor).
  setUpBossReward(room) {
    if (this.floorIndex >= this.floors.length - 1) return;
    // A skill upgrade is the prize for beating the boss without losing any health.
    room.contents ??= { itemId: this.drawItem(TIER_WEIGHTS.boss), upgradeEarned: this.bossNoHit, upgradeTaken: false };
    this.addItemPedestal(CENTER.x - 64, CENTER.y, room.contents.itemId, () => (room.contents.itemId = null));
    if (room.contents.upgradeEarned && !room.contents.upgradeTaken) this.offerSkillUpgrades(room);

    const x = CENTER.x + 64;
    const trapdoor = this.add.image(x, CENTER.y, 'trapdoor').setDepth(DEPTH.decor);
    this.roomObjects.push(trapdoor);
    this.addPickupSpot(x, CENTER.y, [], () => {
      this.descend();
      return true;
    }, { name: 'Trapdoor', description: `Down to ${this.floors[this.floorIndex + 1].name}` });
  }

  drawItem(weights = TIER_WEIGHTS.normal) {
    return drawItem(this.rng, this.itemPool, this.itemDefs, weights);
  }

  // After a boss: the character's two skill upgrades on glowing orbs. Taking one makes the other vanish.
  offerSkillUpgrades(room) {
    const upgrades = this.character.skill.upgrades ?? [];
    const y = CENTER.y - 64;
    const label = addText(this, CENTER.x, y + 30, 'Upgrade your skill', { tint: UI.gold }).setDepth(DEPTH.shadow);
    this.roomObjects.push(label);
    const spots = upgrades.map((upgrade, i) => {
      const x = CENTER.x + (i - (upgrades.length - 1) / 2) * UPGRADE_SPACING;
      const glow = this.add.image(x, y, 'glow_white').setTint(0xb57bff).setScale(0.6).setDepth(DEPTH.decor);
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.roomObjects.push(glow);
      const icon = this.floatingImage(x, y, upgrade.icon);
      return this.addPickupSpot(x, y, [icon, glow], () => {
        room.contents.upgradeTaken = true;
        this.skills.applyUpgrade(upgrade);
        this.banner(upgrade.name, 0xb57bff, upgrade.description);
        Audio.play('item');
        label.destroy();
        for (const other of spots) {
          if (other.upgrade === upgrade) continue;
          this.burst(other.x, other.y, 'smoke', 6, { distance: 16 });
          this.removePickupSpot(other);
        }
        return true;
      }, upgrade);
    });
    spots.forEach((spot, i) => (spot.upgrade = upgrades[i]));
  }

  // A fresh set of goods: an item (if the pool has one left) plus a heart, a bomb and a key.
  stockShop(room) {
    const kinds = ['heart', 'bomb', 'key'];
    const itemId = this.drawItem();
    const wares = itemId ? [{ kind: 'item', itemId }, ...kinds.map((kind) => ({ kind }))] : kinds.map((kind) => ({ kind }));
    const spacing = 64;
    const startX = CENTER.x - ((wares.length - 1) * spacing) / 2;
    wares.forEach((ware, i) => Object.assign(ware, { price: SHOP_PRICES[ware.kind], x: startX + i * spacing, y: CENTER.y + 20 }));
    return wares;
  }

  restockPrice() {
    const [low, high] = RESTOCK_PRICES[Math.min(this.floorIndex, RESTOCK_PRICES.length - 1)];
    return this.rng.int(low, high);
  }

  setUpShop(room) {
    room.contents ??= { wares: this.stockShop(room), restockPrice: this.restockPrice() };

    const worm = this.add.image(CENTER.x, FLOOR.top + 50, 'worm').setOrigin(0.5, 1).setDepth(DEPTH.actors + FLOOR.top + 50);
    const greeting = addText(this, CENTER.x, FLOOR.top + 62, 'Coins for goodies!', { tint: UI.muted }).setDepth(DEPTH.shadow);
    this.tweens.add({ targets: worm, scaleY: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(worm, greeting);

    // Bump into the worm to pay for a restock: new goods (the unsold item goes back into the pool).
    const restockInfo = { name: 'Restock', description: `New goods for ${room.contents.restockPrice} coins` };
    this.addPickupSpot(CENTER.x, FLOOR.top + 36, [], () => {
      const price = room.contents.restockPrice;
      if (this.player.inventory.coins < price) {
        this.hint(`Restock costs ${price} coins`);
        return false;
      }
      this.player.addToInventory('coins', -price);
      for (const ware of room.contents.wares) if (ware.kind === 'item') this.itemPool.push(ware.itemId);
      room.contents.wares = this.stockShop(room);
      room.contents.restockPrice = this.restockPrice();
      restockInfo.description = `New goods for ${room.contents.restockPrice} coins`;
      Audio.play('coin');
      this.burst(CENTER.x, FLOOR.top + 30, 'spark', 10, { distance: 24 });
      this.hint('Fresh stock!');
      this.drawShopWares(room);
      this.hideTooltip();
      return false;
    }, restockInfo).rearm = true;

    this.drawShopWares(room);
  }

  drawShopWares(room) {
    (this.shopSpots ?? []).forEach((spot) => this.pickups.includes(spot) && this.removePickupSpot(spot));
    this.shopSpots = [];
    for (const ware of room.contents.wares) {
      const def = ware.kind === 'item' ? this.itemDefs[ware.itemId] : null;
      const image = this.floatingImage(ware.x, ware.y, def ? def.icon : PICKUP_TEXTURES[ware.kind]);
      const coin = this.add.image(ware.x - 8, ware.y + 24, 'coin').setDepth(DEPTH.shadow);
      const price = addText(this, ware.x + 2, ware.y + 24, ware.price, { originX: 0, tint: UI.gold }).setDepth(DEPTH.shadow);
      this.roomObjects.push(coin, price);

      const info = def ?? PICKUP_INFO[ware.kind];
      const spot = this.addPickupSpot(ware.x, ware.y, [image, coin, price], () => {
        const player = this.player;
        if (ware.kind === 'heart' && player.hp >= player.stats.maxHp) return false;
        if (player.inventory.coins < ware.price) {
          this.hint(`Needs ${ware.price} coins`);
          return false;
        }
        player.addToInventory('coins', -ware.price);
        room.contents.wares = room.contents.wares.filter((w) => w !== ware);
        if (ware.kind === 'item') this.giveItem(ware.itemId);
        else this.takePickup(ware.kind);
        return true;
      }, { name: info.name, description: `${info.description} - ${ware.price} coins` });
      this.shopSpots.push(spot);
    }
  }

  // ---------- Sacrifice room ----------

  // An altar of spikes: each go costs a full heart and may give an item (better odds every try).
  // It will take your last heart too, which ends the run. Gives at most two items.
  setUpSacrifice(room) {
    room.contents ??= { tries: 0, items: 0, pedestals: [] };
    const c = room.contents;
    const altar = this.add.image(CENTER.x, CENTER.y + 12, 'altar').setOrigin(0.5, 1).setDepth(DEPTH.actors + CENTER.y + 12);
    const note = addText(this, CENTER.x, CENTER.y + 30, 'Give a heart?', { tint: 0xe25c4b }).setDepth(DEPTH.shadow);
    this.roomObjects.push(altar, note);
    for (const pedestal of c.pedestals) this.placeSacrificeItem(room, pedestal);

    this.addPickupSpot(CENTER.x, CENTER.y, [], () => {
      const player = this.player;
      if (c.items >= SACRIFICE.maxItems) {
        this.hint('The altar is quiet');
        return false;
      }
      player.hp = Math.max(0, player.hp - SACRIFICE.cost);
      player.emitHp();
      player.hurtUntil = this.time.now + 200;
      Audio.play('hurt');
      this.cameras.main.shake(120, 0.01);
      this.burst(CENTER.x, CENTER.y - 4, 'cap_bit', 10, { distance: 22 });
      if (player.hp === 0) {
        // The altar took the last heart.
        player.die();
        this.onPlayerDied();
        return false;
      }
      const chance = Math.min(SACRIFICE.maxChance, SACRIFICE.chance + SACRIFICE.chanceStep * c.tries);
      if (this.rng.chance(chance)) {
        const itemId = this.drawItem();
        if (itemId) {
          const pedestal = { x: CENTER.x + (c.items % 2 === 0 ? -1 : 1) * SACRIFICE.itemOffset, itemId };
          c.pedestals.push(pedestal);
          this.placeSacrificeItem(room, pedestal);
          this.banner('The altar answers', 0xe25c4b);
        }
        c.items += 1;
        c.tries = 0;
      } else {
        c.tries += 1;
        this.hint('Nothing... yet');
      }
      return false;
    }, { name: 'Sacrifice', description: 'Give a heart for a chance at an item' }).rearm = true;
  }

  placeSacrificeItem(room, pedestal) {
    this.addItemPedestal(pedestal.x, CENTER.y, pedestal.itemId, () => (pedestal.itemId = null));
  }

  // ---------- Secret room ----------

  // A bomb found the cracked wall: open the secret door for good.
  revealSecret() {
    const walls = this.view.revealSecret();
    this.physics.world.removeCollider(this.roomColliders[0]);
    this.roomColliders[0] = this.physics.add.collider(this.player.hitbox, walls);
    Audio.play('unlock');
    this.cameras.main.shake(150, 0.01);
    this.hint('A secret room!');
    this.events.emit('room', this.dungeon, this.room);
  }

  // Inside: either an item, or a pile of drops (maybe a chest).
  setUpSecret(room) {
    if (!room.contents) {
      room.contents = this.rng.chance(SECRET_ITEM_CHANCE) ? { itemId: this.drawItem() } : { itemId: null };
      if (!room.contents.itemId) {
        const count = this.rng.int(SECRET_DROPS.min, SECRET_DROPS.max);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          room.pickups.push({ kind: this.rng.weighted(SECRET_DROPS.weights), x: Math.round(CENTER.x + Math.cos(a) * 50), y: Math.round(CENTER.y + Math.sin(a) * 34) });
        }
      }
      this.banner('Secret room!', UI.gold);
    }
    if (room.contents.itemId) this.addItemPedestal(CENTER.x, CENTER.y, room.contents.itemId, () => (room.contents.itemId = null));
  }

  // After both mini bosses: an item in the middle of the room.
  setUpMiniBossReward(room) {
    room.contents ??= { itemId: this.drawItem() };
    this.addItemPedestal(CENTER.x, CENTER.y, room.contents.itemId, () => (room.contents.itemId = null));
  }

  giveItem(itemId) {
    const def = this.itemDefs[itemId];
    this.player.addItem({ id: itemId, ...def });
    this.banner(def.name, UI.gold, def.description);
    Audio.play('item');
    this.burst(this.player.hitbox.x, this.player.hitbox.y - 12, 'spark', 10, { distance: 28 });
  }

  // ---------- Waves ----------

  startWave() {
    if (this.over) return;
    this.waveIndex += 1;
    const total = this.room.waves.length;
    const types = this.room.waves[this.waveIndex - 1];
    const boss = types.map((type) => this.enemyDefs[type]).find((def) => def.boss);
    this.events.emit('wave', boss ? 0 : this.waveIndex, total); // boss rooms have no waves

    if (boss) {
      this.bossNoHit = true; // until Mochi loses health in this fight
      this.banner(boss.name, 0xb57bff, boss.subtitle);
      Audio.play('bossIntro');
    } else {
      this.banner(`Wave ${this.waveIndex}/${total}`, UI.peach);
    }

    const taken = [];
    for (const type of types) {
      const def = this.enemyDefs[type];
      let pos;
      if (def.spawn === 'top') pos = { x: CENTER.x, y: FLOOR.top + 78 };
      else if (def.boss) pos = this.freeSpot(CENTER.x, CENTER.y - 16, 24);
      else pos = this.findSpawnPoint(taken);
      taken.push(pos);
      this.enemies.push(new Enemy(this, def, pos.x, pos.y, this.hpScale(def)));
    }
    this.waveActive = true;
  }

  hpScale(def) {
    const curse = this.player.stats.enemyHp;
    if (def.boss) return BOSS_HP_BY_FLOOR[Math.min(this.floorIndex, BOSS_HP_BY_FLOOR.length - 1)] * curse;
    return (1 + ENEMY_HP_PER_FLOOR * this.floorIndex) * curse;
  }

  // Extra enemies mid-fight (a boss's summons).
  spawnEnemyAt(type, x, y) {
    const def = this.enemyDefs[type];
    const pos = this.freeSpot(Phaser.Math.Clamp(x, FLOOR.left + 24, FLOOR.right - 24), Phaser.Math.Clamp(y, FLOOR.top + 24, FLOOR.bottom - 20), 16);
    this.enemies.push(new Enemy(this, def, pos.x, pos.y, this.hpScale(def)));
  }

  onWaveCleared() {
    this.waveActive = false;
    this.enemyShots.getChildren().slice().forEach((bullet) => bullet.pop());
    if (this.waveIndex < this.room.waves.length) {
      this.time.delayedCall(WAVE_BREAK_MS, () => this.startWave());
    } else {
      this.onRoomCleared();
    }
  }

  onRoomCleared() {
    const room = this.room;
    room.cleared = true;
    this.roomsCleared += 1;
    this.events.emit('wave', 0, 0);
    this.view.setOpen(true);
    Audio.play('door');
    for (const door of this.view.doors) this.burst(door.x, door.y, 'leaf', 4, { distance: 20 });

    if (room.type === 'boss') {
      if (this.floorIndex >= this.floors.length - 1) {
        this.over = true;
        this.cameras.main.flash(800, 140, 220, 120); // the garden turns green again
        const boss = this.enemyDefs[room.waves[0][0]];
        this.banner('Garden saved!', UI.gold, `${boss.name} is beaten`);
        this.endRun(true, WIN_DELAY_MS);
      } else {
        this.banner('Boss defeated!', UI.gold, this.bossNoHit ? 'Not a scratch! Upgrade your skill' : 'A trapdoor opens...');
        this.setUpBossReward(room);
        // Hearts below the item and trapdoor, so picking them up never means stepping on the trapdoor.
        const hearts = this.rng.chance(BOSS_DOUBLE_HEART_CHANCE) ? [-16, 16] : [0];
        for (const dx of hearts) this.dropPickup('heart', CENTER.x + dx, CENTER.y + 56);
      }
      return;
    }

    if (room.type === 'miniboss') {
      this.banner('Mini bosses beaten!', UI.gold, 'A prize for the brave');
      this.setUpMiniBossReward(room);
      return;
    }

    this.banner('Clear!', UI.leaf);
    const chance = ROOM_DROP_CHANCE + ROOM_DROP_LUCK_BONUS * this.player.stats.luck;
    if (this.rng.chance(chance)) this.dropPickup(this.rng.weighted(ROOM_DROP_WEIGHTS), CENTER.x, CENTER.y);
  }

  onEnemyKilled(enemy) {
    Audio.play('enemyDie');
    if (this.over) return;
    if (enemy.def.boss) {
      // A boss takes its minions with it.
      this.events.emit('boss', null);
      this.clearingMinions = true; // no death tricks (splitting, spore bursts) from these
      for (const other of this.enemies) if (other !== enemy && other.state === 'active') other.die();
      this.clearingMinions = false;
      this.enemyShots.getChildren().slice().forEach((bullet) => bullet.pop());
      this.cameras.main.shake(300, 0.015);
      return;
    }
    const chance = COIN_DROP_CHANCE + COIN_DROP_LUCK_BONUS * this.player.stats.luck;
    if (this.rng.chance(chance)) this.dropPickup('coin', enemy.x, enemy.y);

    const blast = this.player.stats.killBlast;
    if (blast) {
      const { x, y } = enemy;
      this.time.delayedCall(0, () => {
        this.burst(x, y, 'spark', 8, { distance: blast.radius * 0.6 });
        this.burst(x, y, 'smoke', 6, { distance: blast.radius * 0.5 });
        this.blastEnemies(x, y, blast.radius, blast.damage, enemy);
      });
    }

    this.kills += 1;
    const every = this.player.stats.healEvery;
    if (every > 0 && this.kills % every === 0 && this.player.hp < this.player.stats.maxHp) {
      this.player.heal(1);
      this.burst(this.player.hitbox.x, this.player.hitbox.y - 12, 'leaf', 6, { distance: 16 });
    }
  }

  onBossHp(enemy) {
    this.events.emit('boss', { name: enemy.def.name, hp: Math.max(0, enemy.hp), maxHp: enemy.maxHp });
  }

  // Random floor spot away from the player and other new spawns.
  findSpawnPoint(taken = [], minPlayerDistance = SPAWN_MIN_PLAYER_DISTANCE) {
    const player = this.player.hitbox;
    const distance = Phaser.Math.Distance.Between;
    let pos;
    for (let tries = 0; tries < 30; tries++) {
      pos = {
        x: Math.round(this.rng.range(FLOOR.left + 28, FLOOR.right - 28)),
        y: Math.round(this.rng.range(FLOOR.top + 28, FLOOR.bottom - 20)),
      };
      const nearPlayer = distance(pos.x, pos.y, player.x, player.y) < minPlayerDistance;
      const crowded = taken.some((other) => distance(pos.x, pos.y, other.x, other.y) < SPAWN_MIN_ENEMY_DISTANCE);
      const inObstacle = !areaFree(this.view.blocked, pos.x, pos.y, 18);
      if (!nearPlayer && !crowded && !inObstacle) return pos;
    }
    return this.freeSpot(pos.x, pos.y, 18);
  }

  findTeleportSpot() {
    return this.findSpawnPoint([], 96);
  }

  // ---------- Pickups and tooltips ----------

  floatingImage(x, y, texture) {
    const image = this.add.image(x, y, texture).setDepth(DEPTH.actors + y + 16);
    this.tweens.add({ targets: image, y: y - 4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(image);
    return image;
  }

  // Something taken by walking over it. tryTake returns false to leave it there.
  // `info` ({ name, description }) shows a tooltip when Mochi is close.
  addPickupSpot(x, y, objects, tryTake, info = null) {
    const spot = { x, y, objects, tryTake, info };
    this.pickups.push(spot);
    return spot;
  }

  removePickupSpot(spot) {
    spot.objects.forEach((obj) => obj.destroy());
    this.pickups = this.pickups.filter((p) => p !== spot);
    if (this.tooltip?.spot === spot) this.hideTooltip();
  }

  // A new drop on the floor, remembered by the room until picked up.
  dropPickup(kind, x, y) {
    const spot = this.freeSpot(
      Phaser.Math.Clamp(Math.round(x), FLOOR.left + 12, FLOOR.right - 12),
      Phaser.Math.Clamp(Math.round(y), FLOOR.top + 12, FLOOR.bottom - 12),
    );
    const pickup = { kind, x: spot.x, y: spot.y };
    this.room.pickups.push(pickup);
    this.spawnPickup(pickup);
  }

  spawnPickup(pickup) {
    const image = this.floatingImage(pickup.x, pickup.y, PICKUP_TEXTURES[pickup.kind]);
    this.addPickupSpot(pickup.x, pickup.y, [image], () => {
      if (pickup.kind === 'chest') this.openChest(pickup);
      else if (!this.takePickup(pickup.kind)) return false;
      this.room.pickups = this.room.pickups.filter((p) => p !== pickup);
      return true;
    });
  }

  // A chest pops open and spills a mix of coins, hearts, bombs and keys around it.
  openChest({ x, y }) {
    const lid = this.add.image(x, y, 'chest_open').setDepth(DEPTH.actors + y);
    this.roomObjects.push(lid);
    this.tweens.add({ targets: lid, alpha: 0, delay: 1500, duration: 600 });
    Audio.play('unlock');
    const count = this.rng.int(CHEST.min, CHEST.max);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rng.range(0, 1);
      this.dropPickup(this.rng.weighted(CHEST.weights), x + Math.cos(a) * CHEST.spread, y + Math.sin(a) * CHEST.spread);
    }
  }

  // Returns false if it can't be used right now (hearts at full health).
  takePickup(kind) {
    const player = this.player;
    if (kind === 'heart') {
      if (player.hp >= player.stats.maxHp) return false;
      player.heal(2);
    } else {
      player.addToInventory(`${kind}s`, 1);
    }
    Audio.play(kind === 'coin' ? 'coin' : 'pickup');
    return true;
  }

  collectPickups() {
    if (!this.player.alive) return;
    const { x, y } = this.player.hitbox;
    for (const spot of this.pickups) {
      const near = Phaser.Math.Distance.Between(spot.x, spot.y, x, y) <= PICKUP_RADIUS;
      if (spot.rearm) {
        // Used again only after Mochi steps away (the altar, the shop restock).
        if (!near) spot.waiting = false;
        if (!near || spot.waiting) continue;
        spot.waiting = true;
        spot.tryTake();
        continue;
      }
      if (!near) continue;
      if (!spot.tryTake()) continue;
      this.burst(spot.x, spot.y, 'spark', 4);
      this.removePickupSpot(spot);
      return;
    }
  }

  // Name and description of the nearest item (or shop ware) when Mochi is close to it.
  updateTooltip() {
    const { x, y } = this.player.hitbox;
    let nearest = null;
    let nearestDistance = Infinity;
    // Items and wares, plus the warning by a mini boss door (which shows from further away).
    for (const spot of [...this.pickups, ...(this.doorWarnings ?? [])]) {
      if (!spot.info) continue;
      const d = Phaser.Math.Distance.Between(spot.x, spot.y, x, y);
      if (d < (spot.radius ?? TOOLTIP_RADIUS) && d < nearestDistance) {
        nearest = spot;
        nearestDistance = d;
      }
    }
    if (nearest === (this.tooltip?.spot ?? null)) return;
    this.hideTooltip();
    if (nearest) this.showTooltip(nearest);
  }

  // A small panel in the bottom-left corner of the room: name, and the description at half size.
  showTooltip(spot) {
    const left = TILE + 4;
    const top = GAME_HEIGHT - HUD_HEIGHT - 26;
    if (spot.warning) Audio.play('warn');
    const name = addText(this, left + 5, top + 8, spot.info.name, { tint: spot.warning ? 0xe25c4b : UI.gold, originX: 0 });
    const parts = [name];
    const description = addText(this, left + 5, top + 18, spot.info.description, { scale: 1, originX: 0 });
    parts.push(description);
    const right = Math.max(...parts.map((part) => part.x + part.width));
    const width = right - left + 5;
    const box = this.add.rectangle(left, top, width, 23, 0x120e16, 0.8).setOrigin(0).setStrokeStyle(2, 0x4a4058).setDepth(DEPTH.ui);
    parts.forEach((part) => part.setDepth(DEPTH.ui + 1));
    [box, ...parts].forEach((part) => part.setScrollFactor(0)); // fixed on screen
    this.tooltip = { spot, parts: [box, ...parts] };
  }

  hideTooltip() {
    this.tooltip?.parts.forEach((part) => part.destroy());
    this.tooltip = null;
  }

  // ---------- Bombs ----------

  placeBomb() {
    const player = this.player;
    if (this.over || player.inventory.bombs <= 0) return;
    player.addToInventory('bombs', -1);

    // Like enemies, a bomb is an invisible hitbox (which slides when kicked) plus an image that follows it.
    const { x, y } = player.feet;
    const zone = this.add.zone(x, y - 6, BOMB_SIZE, BOMB_SIZE);
    this.bombBodies.add(zone);
    zone.body.setBounce(BOMB_BOUNCE, BOMB_BOUNCE);
    const image = this.add.image(x, y - 6, 'bomb');
    this.tweens.add({ targets: image, scale: 1.25, duration: 150, yoyo: true, repeat: -1 });
    // Not kickable until Mochi has stepped off it (it's dropped at Mochi's feet).
    const bomb = { zone, image, kickable: false };
    zone.bomb = bomb;
    bomb.timer = this.time.delayedCall(BOMB_FUSE_MS, () => this.explode(bomb));
    this.bombs.push(bomb);
    this.roomObjects.push(image, zone);
    this.updateBombs(0);
  }

  updateBombs(delta) {
    const mochi = this.player.hitbox;
    for (const bomb of this.bombs) {
      // Slow down evenly in every direction (Arcade drag works per axis, so diagonal slides came up short).
      const v = bomb.zone.body.velocity;
      const speed = v.length();
      if (speed > 0) v.scale(Math.max(0, speed - (BOMB_DRAG * delta) / 1000) / speed);
      const { x, y } = bomb.zone;
      bomb.image.setPosition(x, y).setDepth(DEPTH.actors + y + 4);
      if (!bomb.kickable && Phaser.Math.Distance.Between(x, y, mochi.x, mochi.y) > BOMB_SIZE + 6) bomb.kickable = true;
    }
  }

  // Walking into a bomb kicks it the way Mochi is moving (or straight away from Mochi).
  kickBomb(bomb) {
    if (!bomb?.kickable || !this.player.alive) return;
    bomb.kickable = false;
    const mochi = this.player.hitbox;
    const v = mochi.body.velocity;
    const angle = v.length() > 20 ? Math.atan2(v.y, v.x) : Math.atan2(bomb.zone.y - mochi.y, bomb.zone.x - mochi.x);
    bomb.zone.body.velocity.setToPolar(angle, slideSpeed(BOMB_KICK_DISTANCE));
    Audio.play('select');
  }

  // A shot nudges a bomb a short way in the shot's direction (a piercing shot only once).
  shootBomb(shot, bomb) {
    if (!shot.active || !bomb) return;
    shot.pushedBombs ??= new Set();
    if (shot.pushedBombs.has(bomb)) return;
    shot.pushedBombs.add(bomb);
    bomb.zone.body.velocity.setToPolar(Math.atan2(shot.dir.y, shot.dir.x), slideSpeed(BOMB_SHOT_DISTANCE));
    if (!shot.pierce) shot.impact();
  }

  // Hurts every enemy nearby, and Mochi too if too close.
  explode(bomb) {
    this.bombs = this.bombs.filter((b) => b !== bomb);
    const { x, y } = bomb.zone;
    const power = this.player.stats.bombPower;
    const radius = BOMB_RADIUS * power;
    bomb.image.destroy();
    bomb.zone.destroy();
    Audio.play('bomb');
    this.burst(x, y, 'spark', 12, { distance: radius * 0.7, duration: 350 });
    this.burst(x, y, 'smoke', 10, { distance: radius * 0.6, duration: 500 });
    this.cameras.main.shake(200, 0.02);

    const now = this.time.now;
    const distance = Phaser.Math.Distance.Between;
    for (const enemy of this.enemies) {
      if (enemy.state !== 'active' || distance(x, y, enemy.x, enemy.y) > radius) continue;
      const angle = Math.atan2(enemy.y - y, enemy.x - x);
      enemy.hit(BOMB_DAMAGE * power, { x: Math.cos(angle), y: Math.sin(angle) }, now);
    }
    for (const obstacle of this.view.obstacles.slice()) {
      if (distance(x, y, obstacle.x, obstacle.y) <= radius + 12) this.breakObstacle(obstacle);
    }
    this.hurtPlayerNear(x, y, radius);

    const crack = this.view.secretCrack;
    if (crack && distance(x, y, crack.x, crack.y) <= radius + SECRET_BLAST_REACH) this.revealSecret();
  }

  // ---------- Player shots ----------

  firePlayerShot(x, y, dir, stats, inBurst = false) {
    // Pea Pod: more seeds follow one after another.
    if (stats.burst > 1 && !inBurst) {
      for (let i = 1; i < stats.burst; i++) {
        this.time.delayedCall(i * BURST_GAP_MS, () => {
          if (!this.player.alive || this.transitioning) return;
          const p = this.player.hitbox;
          this.firePlayerShot(p.x + dir.x * 12, p.y - 2 + dir.y * 12, dir, stats, true);
        });
      }
    }
    // Watermelon Seed: every Nth shot is huge and hits much harder.
    this.shotCount = (this.shotCount ?? 0) + 1;
    if (stats.bigEvery && this.shotCount % stats.bigEvery === 0) {
      stats = { ...stats, shotScale: stats.shotScale * BIG_SHOT.scale, damage: stats.damage * BIG_SHOT.damage };
    }
    // Burr Mine: every Nth shot also drops a mine at Mochi's feet.
    if (stats.mineEvery && !inBurst && this.shotCount % stats.mineEvery === 0) this.placeMine(this.player.feet.x, this.player.feet.y - 4);

    // Side-by-side seeds (Twin Sprout).
    const count = stats.multishot;
    const side = { x: -dir.y, y: dir.x };
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * MULTISHOT_SPACING;
      this.spawnShot(x + side.x * offset, y + side.y * offset, dir, stats);
    }

    // A fan of angled seeds (Dandelion Puff) and seeds fired backwards (Hedgehog Seed).
    const angle = Math.atan2(dir.y, dir.x);
    const fromAngle = (a) => ({ x: Math.cos(a), y: Math.sin(a) });
    for (let pair = 1; pair <= stats.spread / 2; pair++) {
      this.spawnShot(x, y, fromAngle(angle + pair * SPREAD_ANGLE), stats);
      this.spawnShot(x, y, fromAngle(angle - pair * SPREAD_ANGLE), stats);
    }
    for (let i = 0; i < stats.backShot; i++) {
      this.spawnShot(x, y, fromAngle(angle + Math.PI + (i - (stats.backShot - 1) / 2) * SPREAD_ANGLE), stats);
    }

    // Every Nth shot also sprays a ring (Sprinkler Head).
    if (stats.sprinkler && this.shotCount % stats.sprinkler === 0) {
      for (let i = 0; i < SPRINKLER_SEEDS; i++) {
        this.spawnShot(x, y, fromAngle(angle + (i / SPRINKLER_SEEDS) * Math.PI * 2), { ...stats, range: SPRINKLER_RANGE });
      }
    }
    Audio.play('shoot');
  }

  // Every shot charges the character's skill.
  onShotFired() {
    this.skills.onShotFired();
  }

  spawnShot(x, y, dir, stats, options) {
    const shot = new Projectile(this, x, y, stats.shotTexture);
    this.shots.add(shot, true);
    shot.launch(dir, stats, this.time.now, options);
    return shot;
  }

  onShotHitEnemy(shot, enemy) {
    if (!shot.active || enemy.state !== 'active' || enemy.untouchable || shot.hitEnemies.has(enemy)) return;
    shot.hitEnemies.add(enemy);

    // Golden Kernel: a chance of triple damage.
    let damage = shot.damage;
    if (shot.stats.crit > 0 && this.rng.chance(shot.stats.crit)) {
      damage *= 3;
      this.burst(enemy.x, enemy.y - 12, 'spark', 6, { distance: 20 });
      Audio.play('crit');
    }
    enemy.hit(damage, shot.dir, this.time.now, shot.effects);
    if (shot.stats.chain > 0) this.chainZap(enemy, shot.stats.chain, shot.damage * CHAIN_DAMAGE);
    if (shot.canSplit) this.splitShot(shot, enemy);

    // Vampire Beet: heal every N hits.
    this.hitCount += 1;
    const leech = shot.stats.leechEvery;
    if (leech && this.hitCount % leech === 0 && this.player.hp < this.player.stats.maxHp) {
      this.player.heal(1);
      this.burst(this.player.hitbox.x, this.player.hitbox.y - 12, 'cap_bit', 5, { distance: 14 });
    }
    // Pinball Pea: bounce on to the next enemy instead of breaking.
    if (shot.ricochetsLeft > 0 && this.ricochet(shot, enemy)) return;
    if (!shot.pierce) shot.impact();
  }

  // Turns a shot toward the nearest enemy it hasn't hit yet. Returns false if there's none in range.
  ricochet(shot, from) {
    let next = null;
    let best = RICOCHET_RANGE;
    for (const enemy of this.enemies) {
      if (enemy === from || shot.hitEnemies.has(enemy) || enemy.state !== 'active' || enemy.untouchable) continue;
      const d = Phaser.Math.Distance.Between(shot.x, shot.y, enemy.x, enemy.y);
      if (d < best) {
        best = d;
        next = enemy;
      }
    }
    if (!next) return false;
    shot.ricochetsLeft -= 1;
    shot.angleRad = Math.atan2(next.y - shot.y, next.x - shot.x);
    shot.expiresAt = Math.max(shot.expiresAt, this.time.now + 700);
    shot.steer(this.time.now, 0);
    return true;
  }

  // Firework Seed: a shot that reaches the end of its range bursts into a ring of small seeds.
  fireworkBurst(shot) {
    const { x, y, stats } = shot;
    const count = stats.expireBurst;
    this.burst(x, y, 'spark', 6, { distance: 14 });
    this.time.delayedCall(0, () => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        this.spawnShot(x, y, { x: Math.cos(a), y: Math.sin(a) }, { ...stats, range: FIREWORK_RANGE }, { damageScale: 0.5, isFragment: true });
      }
    });
  }

  // ---------- Burr mines ----------

  placeMine(x, y) {
    const image = this.add.image(x, y, 'burr_mine').setDepth(DEPTH.slime + 1).setAlpha(0.6);
    this.roomObjects.push(image);
    this.mines.push({ x, y, image, armedAt: this.time.now + MINE.armMs, until: this.time.now + MINE.lifeMs });
  }

  // A mine bursts when an enemy steps close, hurting every enemy nearby (never Mochi).
  updateMines(time) {
    for (const mine of this.mines.slice()) {
      if (time >= mine.armedAt && mine.image.alpha < 1) mine.image.setAlpha(1);
      const near = time >= mine.armedAt && this.enemies.some((e) => e.state === 'active' && !e.untouchable && Phaser.Math.Distance.Between(mine.x, mine.y, e.x, e.y) < MINE.trigger + e.def.hitbox.w / 2);
      if (!near && time < mine.until) continue;
      this.mines = this.mines.filter((m) => m !== mine);
      mine.image.destroy();
      if (!near) continue; // fizzled out
      this.burst(mine.x, mine.y, 'husk', 10, { distance: MINE.radius * 0.7 });
      this.burst(mine.x, mine.y, 'spark', 6, { distance: MINE.radius * 0.5 });
      Audio.play('bomb');
      this.blastEnemies(mine.x, mine.y, MINE.radius, this.player.stats.damage * MINE.damage);
    }
  }

  // Hurts every active enemy within `radius` (mines, Blast Berry).
  blastEnemies(x, y, radius, damage, except = null) {
    for (const enemy of this.enemies) {
      if (enemy === except || enemy.state !== 'active') continue;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius + enemy.def.hitbox.w / 2) continue;
      const angle = Math.atan2(enemy.y - y, enemy.x - x);
      enemy.hit(damage, { x: Math.cos(angle), y: Math.sin(angle) }, this.time.now);
    }
  }

  // Static Thistle: lightning jumps from enemy to enemy.
  chainZap(from, jumps, damage) {
    const hit = new Set([from]);
    let source = from;
    for (let i = 0; i < jumps; i++) {
      let next = null;
      let best = CHAIN_RANGE;
      for (const enemy of this.enemies) {
        if (hit.has(enemy) || enemy.state !== 'active' || !enemy.hitbox.body.enable) continue;
        const d = Phaser.Math.Distance.Between(source.x, source.y, enemy.x, enemy.y);
        if (d < best) {
          best = d;
          next = enemy;
        }
      }
      if (!next) return;
      const zap = this.add.graphics().setDepth(DEPTH.ui - 1);
      zap.lineStyle(2, 0xffe45c, 1).lineBetween(source.x, source.y - 8, next.x, next.y - 8);
      this.time.delayedCall(90, () => zap.destroy());
      this.roomObjects.push(zap);
      const angle = Math.atan2(next.y - source.y, next.x - source.x);
      next.hit(damage, { x: Math.cos(angle), y: Math.sin(angle) }, this.time.now);
      hit.add(next);
      source = next;
    }
  }

  // Popcorn Kernel: shots splash nearby enemies when they pop.
  shotSplash(x, y, radius, damage) {
    this.burst(x, y, 'shot_popcorn', 4, { distance: radius * 0.7, duration: 250 });
    for (const enemy of this.enemies) {
      if (enemy.state !== 'active' || !enemy.hitbox.body.enable) continue;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > radius + enemy.def.hitbox.w / 2) continue;
      const angle = Math.atan2(enemy.y - y, enemy.x - x);
      enemy.hit(damage, { x: Math.cos(angle), y: Math.sin(angle) }, this.time.now);
    }
  }

  // Thorn Seed: smaller seeds fan out from the hit, skipping the enemy that was hit.
  splitShot(shot, enemy) {
    const { x, y, stats } = shot;
    const base = Math.atan2(shot.dir.y, shot.dir.x);
    const count = stats.split;
    // Added next frame so the physics step isn't changed while it runs.
    this.time.delayedCall(0, () => {
      for (let i = 0; i < count; i++) {
        const angle = base + (i - (count - 1) / 2) * SPLIT_SPREAD;
        this.spawnShot(x, y, { x: Math.cos(angle), y: Math.sin(angle) }, { ...stats, range: SPLIT_RANGE }, {
          damageScale: 0.5,
          isFragment: true,
          alreadyHit: [enemy],
        });
      }
    });
  }

  // ---------- Enemy bullets (used by enemy behaviours) ----------

  // `range` (px) is how far the bullet flies; regular enemies set one, bosses don't.
  fireEnemyBullet(x, y, angle, speed, type, range = null) {
    if (this.over) return;
    const bullet = new EnemyBullet(this, x, y, type);
    this.enemyShots.add(bullet, true);
    bullet.launch(angle, speed, this.time.now, range);
    Audio.play('enemyShot');
  }

  fireRing(x, y, count, speed, type, offset = 0, range = null) {
    for (let i = 0; i < count; i++) this.fireEnemyBullet(x, y, offset + (i / count) * Math.PI * 2, speed, type, range);
  }

  fireSpread(x, y, angle, count, spreadDeg, speed, type, range = null) {
    const step = (spreadDeg * Math.PI) / 180;
    for (let i = 0; i < count; i++) this.fireEnemyBullet(x, y, angle + (i - (count - 1) / 2) * step, speed, type, range);
  }

  // Bullets one after another, turning as they go.
  fireSpiral(x, y, count, speed, type, durationMs) {
    for (let i = 0; i < count; i++) {
      this.time.delayedCall((i / count) * durationMs, () => {
        if (this.waveActive) this.fireEnemyBullet(x, y, i * 0.45, speed, type);
      });
    }
  }

  // A fan of bullets fired from one side to the other, like a vine sweeping the room.
  fireSweep(x, y, fromAngle, toAngle, count, speed, type, durationMs) {
    for (let i = 0; i < count; i++) {
      this.time.delayedCall((i / count) * durationMs, () => {
        if (this.waveActive) this.fireEnemyBullet(x, y, fromAngle + ((toAngle - fromAngle) * i) / (count - 1), speed, type);
      });
    }
  }

  // A warning crack under the target, then roots burst up.
  rootStrike(x, y) {
    Audio.play('warn');
    const crack = this.add.image(x, y + 8, 'crack').setDepth(DEPTH.slime);
    this.roomObjects.push(crack);
    this.tweens.add({ targets: crack, alpha: { from: 1, to: 0.4 }, duration: 120, yoyo: true, repeat: -1 });
    this.time.delayedCall(ROOT_WARNING_MS, () => {
      crack.destroy();
      if (!this.waveActive) return;
      const roots = this.add.image(x, y + 12, 'roots').setOrigin(0.5, 1).setDepth(DEPTH.actors + y + 12);
      this.roomObjects.push(roots);
      this.tweens.add({ targets: roots, scaleY: { from: 0.2, to: 1 }, duration: 120, yoyo: true, hold: 300, onComplete: () => roots.destroy() });
      this.burst(x, y + 8, 'smoke', 5, { distance: 16 });
      this.hurtPlayerNear(x, y, ROOT_RADIUS);
    });
  }

  // A blinking target mark, then `land` runs and anything on the mark gets hurt.
  markStrike(x, y, delayMs, land) {
    Audio.play('warn');
    const mark = this.add.image(x, y + 4, 'target').setDepth(DEPTH.slime);
    this.roomObjects.push(mark);
    this.tweens.add({ targets: mark, alpha: { from: 1, to: 0.35 }, duration: 110, yoyo: true, repeat: -1 });
    this.time.delayedCall(delayMs, () => {
      mark.destroy();
      if (!this.waveActive) return;
      this.burst(x, y, 'smoke', 4, { distance: 14 });
      this.hurtPlayerNear(x, y, MARK_RADIUS);
      land();
    });
  }

  // ---------- Damage to Mochi ----------

  onPlayerTouchEnemy(enemy) {
    if (this.over || enemy.state !== 'active' || !enemy.hitbox.body.enable || enemy.untouchable) return;
    const thorns = this.player.stats.thorns;
    if (thorns > 0 && this.time.now >= (enemy.thornsAt ?? 0)) {
      enemy.thornsAt = this.time.now + 500;
      const angle = Math.atan2(enemy.y - this.player.hitbox.y, enemy.x - this.player.hitbox.x);
      enemy.hit(thorns, { x: Math.cos(angle), y: Math.sin(angle) }, this.time.now);
      if (enemy.state !== 'active') return;
    }
    this.damagePlayer(enemy.def.contactDamage, enemy.x, enemy.y);
  }

  onPlayerShot(bullet) {
    if (!bullet.active) return;
    const { x, y } = bullet;
    bullet.pop();
    if (!this.over) this.damagePlayer(1, x, y);
  }

  hurtPlayerNear(x, y, radius) {
    const hitbox = this.player.hitbox;
    if (Phaser.Math.Distance.Between(x, y, hitbox.x, hitbox.y) <= radius) this.damagePlayer(1, x, y);
  }

  damagePlayer(amount, fromX, fromY) {
    if (this.over) return;
    if (this.shieldsLeft > 0 && this.player.alive && this.time.now >= this.player.invulnUntil) {
      this.shieldsLeft -= 1;
      this.player.invulnUntil = this.time.now + 600;
      this.burst(this.player.hitbox.x, this.player.hitbox.y - 8, 'spark', 10, { distance: 22 });
      this.hint('Blocked!');
      Audio.play('crit');
      return;
    }
    if (!this.player.takeDamage(amount, this.time.now)) return;
    this.bossNoHit = false;
    Audio.play('hurt');
    this.cameras.main.shake(120, 0.012);
    if (this.player.alive) this.player.knockbackFrom(fromX, fromY);
    else this.onPlayerDied();
  }

  onPlayerDied() {
    if (this.over) return;
    this.over = true;
    this.waveActive = false;
    this.skills.stop();
    for (const enemy of this.enemies) enemy.freeze();
    this.endRun(false, GAME_OVER_DELAY_MS);
  }

  endRun(won, delay) {
    const floorReached = this.floorIndex + 1;
    const newBest = Save.recordRun({ roomsCleared: this.roomsCleared, floor: floorReached, won });
    this.time.delayedCall(delay, () => {
      this.scene.stop('HUD');
      this.scene.start('GameOver', {
        won,
        roomsCleared: this.roomsCleared,
        floor: floorReached,
        floorName: this.dungeon.floor.name,
        bossName: this.enemyDefs[this.dungeon.rooms.find((r) => r.type === 'boss').waves[0][0]].name,
        seed: this.seed,
        character: this.character,
        newBest,
        items: this.player.items.map((item) => item.icon),
      });
    });
  }

  // ---------- Slime trails ----------

  dropSlime(x, y, trail) {
    const blob = this.add.image(x, y, 'slime').setDepth(DEPTH.slime).setAlpha(0.6).setData('slow', trail.slow);
    this.slime.add(blob);
    this.tweens.add({ targets: blob, alpha: 0, duration: trail.lifetime, onComplete: () => blob.destroy() });
  }

  // Speed multiplier for whoever stands at this point (1 = no slime).
  slowAt({ x, y }) {
    let multiplier = 1;
    for (const blob of this.slime.getChildren()) {
      if (blob.alpha > 0.15 && Math.abs(blob.x - x) < 12 && Math.abs(blob.y - y) < 8) {
        multiplier = Math.min(multiplier, blob.getData('slow'));
      }
    }
    return multiplier;
  }

  // ---------- Effects ----------

  burst(x, y, texture, count, { distance = 16, duration = 300 } = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.fxRng.range(-0.5, 0.5);
      const reach = distance * this.fxRng.range(0.6, 1.2);
      const bit = this.add.image(x, y, texture).setDepth(DEPTH.actors + y + 1);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(angle) * reach,
        y: y + Math.sin(angle) * reach,
        alpha: 0,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => bit.destroy(),
      });
    }
  }

  banner(text, tint, subtitle) {
    const y = HUD_HEIGHT + 44;
    const labels = [addText(this, GAME_WIDTH / 2, y, text, { scale: 4, tint })];
    if (subtitle) labels.push(addText(this, GAME_WIDTH / 2, y + 26, subtitle, { tint: UI.muted }));
    labels.forEach((label) => label.setDepth(DEPTH.ui).setAlpha(0).setScrollFactor(0));
    this.tweens.add({
      targets: labels,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: subtitle ? 1600 : 900,
      onComplete: () => labels.forEach((label) => label.destroy()),
    });
  }

  // Bigger floating callout above Mochi (skill names).
  shout(text, tint) {
    const { x, y } = this.player.hitbox;
    const label = addText(this, Phaser.Math.Clamp(x, FLOOR.left + 80, FLOOR.right - 80), y - 40, text, { tint }).setDepth(DEPTH.ui);
    this.tweens.add({ targets: label, y: y - 60, alpha: 0, duration: 900, delay: 400, onComplete: () => label.destroy() });
  }

  // Small floating message above Mochi, at most once per cooldown.
  hint(text) {
    if (this.time.now < this.nextHintAt) return;
    this.nextHintAt = this.time.now + HINT_COOLDOWN_MS;
    const { x, y } = this.player.hitbox;
    const label = addText(this, Phaser.Math.Clamp(x, FLOOR.left + 80, FLOOR.right - 80), y - 32, text, { tint: UI.muted }).setDepth(DEPTH.ui);
    this.tweens.add({ targets: label, y: y - 48, alpha: 0, duration: 1000, delay: 300, onComplete: () => label.destroy() });
  }
}
