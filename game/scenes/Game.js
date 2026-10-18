import { GAME_WIDTH, ROOM_Y, FLOOR, DEPTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { Rng, newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { Audio } from '../systems/Audio.js';
import { generateDungeon } from '../systems/DungeonGen.js';
import { makeItemPool } from '../systems/Items.js';
import { buildRoom } from '../systems/Room.js';
import { areaFree, flowField, lineClear, nearestFree, nextStep, tileOf } from '../systems/Pathing.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';
import { EnemyBullet } from '../entities/EnemyBullet.js';
import { Skills } from '../systems/Skills.js';

const ROOM_START_DELAY_MS = 500;
const WAVE_BREAK_MS = 900;
const SPAWN_MIN_PLAYER_DISTANCE = 64;
const SPAWN_MIN_ENEMY_DISTANCE = 20;
const PICKUP_RADIUS = 9;
const TOOLTIP_RADIUS = 24;
const FADE_MS = 150;
const FADE_COLOR = [18, 14, 22];
const GAME_OVER_DELAY_MS = 1600;
const WIN_DELAY_MS = 3000;
const HINT_COOLDOWN_MS = 1200;
const ENEMY_HP_PER_FLOOR = 0.2; // regular enemies get 20% more health per floor

// Drops. Each point of luck raises the chances.
const ROOM_DROP_CHANCE = 0.5;
const ROOM_DROP_LUCK_BONUS = 0.15;
const ROOM_DROP_WEIGHTS = { coin: 40, heart: 30, bomb: 15, key: 15 };
const COIN_DROP_CHANCE = 0.12;
const COIN_DROP_LUCK_BONUS = 0.08;

const BOMB_FUSE_MS = 1500;
const BOMB_RADIUS = 30;
const BOMB_DAMAGE = 5;

const ROOT_WARNING_MS = 700;
const ROOT_RADIUS = 11;

const SPLIT_SPREAD = 0.6;      // radians between split fragments
const SPLIT_RANGE = 50;
const MULTISHOT_SPACING = 4;   // px between side-by-side seeds

const SHOP_PRICES = { item: 5, heart: 3, bomb: 3, key: 3 };
const PICKUP_TEXTURES = { heart: 'heart_full', coin: 'coin', bomb: 'bomb', key: 'key' };
const PICKUP_INFO = {
  heart: { name: 'Heart', description: 'Heals one heart' },
  bomb: { name: 'Bomb', description: 'Press E to drop it' },
  key: { name: 'Key', description: 'Opens locked gates' },
};

const CENTER = { x: (FLOOR.left + FLOOR.right) / 2, y: (FLOOR.top + FLOOR.bottom) / 2 };

// Where Mochi appears after walking through a door in direction `dir`.
const ENTRY_POINTS = {
  up: { x: CENTER.x, y: FLOOR.bottom - 10 },
  down: { x: CENTER.x, y: FLOOR.top + 10 },
  left: { x: FLOOR.right - 10, y: CENTER.y },
  right: { x: FLOOR.left + 10, y: CENTER.y },
};

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
    this.itemPool = makeItemPool(this.rng, this.itemDefs);

    this.shots = this.physics.add.group();
    this.enemyShots = this.physics.add.group();
    this.enemyBodies = this.physics.add.group();
    this.slime = this.add.group();
    this.enemies = [];
    this.pickups = [];     // things taken by walking over them
    this.bombs = [];
    this.roomObjects = []; // extra objects owned by the current room, destroyed on leaving
    this.roomColliders = [];

    this.player = new Player(this, CENTER.x, CENTER.y, this.character);
    this.skills = new Skills(this, this.player);

    this.physics.add.collider(this.enemyBodies, this.enemyBodies);
    this.physics.add.overlap(this.shots, this.enemyBodies, (shot, body) => this.onShotHitEnemy(shot, body.owner));
    this.physics.add.overlap(this.player.hitbox, this.enemyBodies, (_, body) => this.onPlayerTouchEnemy(body.owner));
    this.physics.add.overlap(this.player.hitbox, this.enemyShots, (_, bullet) => this.onPlayerShot(bullet));

    this.roomsCleared = 0;
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
    this.dungeon = generateDungeon(this.rng, this.floors[index], index, this.enemyDefs);
    Audio.startMusic(index);
    this.events.emit('floor', index, this.floors[index]);
  }

  // Esc or P opens the pause menu; leaving the window or tab pauses automatically.
  setupPause() {
    this.input.keyboard.on('keydown-ESC', () => this.pause());
    this.input.keyboard.on('keydown-P', () => this.pause());

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

    for (const shot of this.shots.getChildren().slice()) shot.update(time);
    for (const bullet of this.enemyShots.getChildren().slice()) bullet.update(time);

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
      this.physics.add.collider(this.enemyBodies, this.view.obstacleBodies),
      this.physics.add.overlap(this.shots, this.view.obstacleBodies, (shot) => shot.impact()),
      this.physics.add.overlap(this.enemyShots, this.view.obstacleBodies, (bullet) => bullet.pop()),
    ];
    this.flowCache = new Map();

    const entry = fromDir ? ENTRY_POINTS[fromDir] : CENTER;
    this.player.placeAt(entry.x, entry.y);

    if (room.type === 'start') this.addStartHint();
    if (room.type === 'treasure') this.setUpTreasure(room);
    if (room.type === 'shop') this.setUpShop(room);
    if (room.type === 'boss' && room.cleared) this.setUpBossReward(room);
    room.pickups.forEach((pickup) => this.spawnPickup(pickup));

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
    this.burst(door.x, door.y, 'spark', 8, { distance: 12 });
  }

  // Bombs and the Burger Beam break obstacles; the room remembers.
  breakObstacle(obstacle) {
    this.burst(obstacle.x, obstacle.y, 'smoke', 6, { distance: 10 });
    this.burst(obstacle.x, obstacle.y, 'husk', 6, { distance: 12 });
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
  freeSpot(x, y, half = 6) {
    return areaFree(this.view.blocked, x, y, half) ? { x, y } : nearestFree(this.view.blocked, x, y);
  }

  addStartHint() {
    if (this.floorIndex > 0) return;
    const hint = addText(this, CENTER.x, FLOOR.bottom - 14, 'WASD move  Arrows shoot  E bomb  Esc pause', { tint: UI.muted })
      .setDepth(DEPTH.shadow)
      .setAlpha(0.7);
    this.roomObjects.push(hint);
  }

  // ---------- Treasure room, shop and boss reward ----------

  // An item on a glowing pedestal. `holder.itemId` is cleared when it's taken.
  addItemPedestal(x, y, holder) {
    const glow = this.add.image(x, y, 'glow').setDepth(DEPTH.decor);
    const pedestal = this.add.image(x, y + 4, 'pedestal').setOrigin(0.5, 1).setDepth(DEPTH.actors + y + 4);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(glow, pedestal);

    const { itemId } = holder;
    if (!itemId) return;
    const def = this.itemDefs[itemId];
    const icon = this.floatingImage(x, y - 10, def.icon);
    this.addPickupSpot(x, y - 4, [icon], () => {
      holder.itemId = null;
      this.giveItem(itemId);
      return true;
    }, def);
  }

  setUpTreasure(room) {
    room.contents ??= { itemId: this.itemPool.pop() ?? null };
    this.addItemPedestal(CENTER.x, CENTER.y, room.contents);
  }

  // After a boss: an item, and a trapdoor down (unless this was the last floor).
  setUpBossReward(room) {
    if (this.floorIndex >= this.floors.length - 1) return;
    room.contents ??= { itemId: this.itemPool.pop() ?? null };
    this.addItemPedestal(CENTER.x - 32, CENTER.y, room.contents);

    const x = CENTER.x + 32;
    const trapdoor = this.add.image(x, CENTER.y, 'trapdoor').setDepth(DEPTH.decor);
    this.roomObjects.push(trapdoor);
    this.addPickupSpot(x, CENTER.y, [], () => {
      this.descend();
      return true;
    }, { name: 'Trapdoor', description: `Down to ${this.floors[this.floorIndex + 1].name}` });
  }

  setUpShop(room) {
    if (!room.contents) {
      const kinds = ['heart', 'bomb', 'key'];
      const itemId = this.itemPool.pop();
      const wares = itemId ? [{ kind: 'item', itemId }, ...kinds.map((kind) => ({ kind }))] : kinds.map((kind) => ({ kind }));
      const spacing = 32;
      const startX = CENTER.x - ((wares.length - 1) * spacing) / 2;
      wares.forEach((ware, i) => Object.assign(ware, { price: SHOP_PRICES[ware.kind], x: startX + i * spacing, y: CENTER.y + 10 }));
      room.contents = { wares };
    }

    const worm = this.add.image(CENTER.x, FLOOR.top + 26, 'worm').setOrigin(0.5, 1).setDepth(DEPTH.actors + FLOOR.top + 26);
    const greeting = addText(this, CENTER.x, FLOOR.top + 32, 'Coins for goodies!', { tint: UI.muted }).setDepth(DEPTH.shadow);
    this.tweens.add({ targets: worm, scaleY: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(worm, greeting);

    for (const ware of room.contents.wares) {
      const def = ware.kind === 'item' ? this.itemDefs[ware.itemId] : null;
      const image = this.floatingImage(ware.x, ware.y, def ? def.icon : PICKUP_TEXTURES[ware.kind]);
      const coin = this.add.image(ware.x - 4, ware.y + 11, 'coin').setDepth(DEPTH.shadow);
      const price = addText(this, ware.x + 1, ware.y + 11, ware.price, { originX: 0, tint: UI.gold }).setDepth(DEPTH.shadow);
      this.roomObjects.push(coin, price);

      const info = def ?? PICKUP_INFO[ware.kind];
      this.addPickupSpot(ware.x, ware.y, [image, coin, price], () => {
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
    }
  }

  giveItem(itemId) {
    const def = this.itemDefs[itemId];
    this.player.addItem({ id: itemId, ...def });
    this.banner(def.name, UI.gold, def.description);
    Audio.play('item');
    this.burst(this.player.hitbox.x, this.player.hitbox.y - 6, 'spark', 10, { distance: 14 });
  }

  // ---------- Waves ----------

  startWave() {
    if (this.over) return;
    this.waveIndex += 1;
    const total = this.room.waves.length;
    this.events.emit('wave', this.waveIndex, total);

    const types = this.room.waves[this.waveIndex - 1];
    const boss = types.map((type) => this.enemyDefs[type]).find((def) => def.boss);
    if (boss) {
      this.banner(boss.name, 0xb57bff, boss.subtitle);
      Audio.play('bossIntro');
    } else {
      this.banner(`Wave ${this.waveIndex}/${total}`, UI.peach);
    }

    const taken = [];
    for (const type of types) {
      const def = this.enemyDefs[type];
      const pos = def.spawn === 'top' ? { x: CENTER.x, y: FLOOR.top + 26 } : this.findSpawnPoint(taken);
      taken.push(pos);
      this.enemies.push(new Enemy(this, def, pos.x, pos.y, 1 + ENEMY_HP_PER_FLOOR * this.floorIndex));
    }
    this.waveActive = true;
  }

  // Extra enemies mid-fight (the Weed Queen's summons).
  spawnEnemyAt(type, x, y) {
    const pos = this.freeSpot(Phaser.Math.Clamp(x, FLOOR.left + 12, FLOOR.right - 12), Phaser.Math.Clamp(y, FLOOR.top + 12, FLOOR.bottom - 10), 8);
    this.enemies.push(new Enemy(this, this.enemyDefs[type], pos.x, pos.y));
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
    for (const door of this.view.doors) this.burst(door.x, door.y, 'leaf', 4, { distance: 10 });

    if (room.type === 'boss') {
      if (this.floorIndex >= this.floors.length - 1) {
        this.over = true;
        this.cameras.main.flash(800, 140, 220, 120); // the garden turns green again
        this.banner('Garden saved!', UI.gold, 'The Weed Queen has wilted');
        this.endRun(true, WIN_DELAY_MS);
      } else {
        this.banner('Boss defeated!', UI.gold, 'A trapdoor opens...');
        this.setUpBossReward(room);
      }
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
      for (const other of this.enemies) if (other !== enemy && other.state === 'active') other.die();
      this.enemyShots.getChildren().slice().forEach((bullet) => bullet.pop());
      this.cameras.main.shake(300, 0.015);
      return;
    }
    const chance = COIN_DROP_CHANCE + COIN_DROP_LUCK_BONUS * this.player.stats.luck;
    if (this.rng.chance(chance)) this.dropPickup('coin', enemy.x, enemy.y);
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
        x: Math.round(this.rng.range(FLOOR.left + 14, FLOOR.right - 14)),
        y: Math.round(this.rng.range(FLOOR.top + 14, FLOOR.bottom - 10)),
      };
      const nearPlayer = distance(pos.x, pos.y, player.x, player.y) < minPlayerDistance;
      const crowded = taken.some((other) => distance(pos.x, pos.y, other.x, other.y) < SPAWN_MIN_ENEMY_DISTANCE);
      const inObstacle = !areaFree(this.view.blocked, pos.x, pos.y, 9);
      if (!nearPlayer && !crowded && !inObstacle) return pos;
    }
    return this.freeSpot(pos.x, pos.y, 9);
  }

  findTeleportSpot() {
    return this.findSpawnPoint([], 48);
  }

  // ---------- Pickups and tooltips ----------

  floatingImage(x, y, texture) {
    const image = this.add.image(x, y, texture).setDepth(DEPTH.actors + y + 8);
    this.tweens.add({ targets: image, y: y - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(image);
    return image;
  }

  // Something taken by walking over it. tryTake returns false to leave it there.
  // `info` ({ name, description }) shows a tooltip when Mochi is close.
  addPickupSpot(x, y, objects, tryTake, info = null) {
    this.pickups.push({ x, y, objects, tryTake, info });
  }

  // A new drop on the floor, remembered by the room until picked up.
  dropPickup(kind, x, y) {
    const spot = this.freeSpot(
      Phaser.Math.Clamp(Math.round(x), FLOOR.left + 6, FLOOR.right - 6),
      Phaser.Math.Clamp(Math.round(y), FLOOR.top + 6, FLOOR.bottom - 6),
    );
    const pickup = { kind, x: spot.x, y: spot.y };
    this.room.pickups.push(pickup);
    this.spawnPickup(pickup);
  }

  spawnPickup(pickup) {
    const image = this.floatingImage(pickup.x, pickup.y, PICKUP_TEXTURES[pickup.kind]);
    this.addPickupSpot(pickup.x, pickup.y, [image], () => {
      if (!this.takePickup(pickup.kind)) return false;
      this.room.pickups = this.room.pickups.filter((p) => p !== pickup);
      return true;
    });
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
      if (Phaser.Math.Distance.Between(spot.x, spot.y, x, y) > PICKUP_RADIUS) continue;
      if (!spot.tryTake()) continue;
      this.burst(spot.x, spot.y, 'spark', 4);
      spot.objects.forEach((obj) => obj.destroy());
      this.pickups = this.pickups.filter((p) => p !== spot);
      if (this.tooltip?.spot === spot) this.hideTooltip();
      return;
    }
  }

  // Name and description of the nearest item (or shop ware) when Mochi is close to it.
  updateTooltip() {
    const { x, y } = this.player.hitbox;
    let nearest = null;
    let nearestDistance = TOOLTIP_RADIUS;
    for (const spot of this.pickups) {
      if (!spot.info) continue;
      const d = Phaser.Math.Distance.Between(spot.x, spot.y, x, y);
      if (d < nearestDistance) {
        nearest = spot;
        nearestDistance = d;
      }
    }
    if (nearest === (this.tooltip?.spot ?? null)) return;
    this.hideTooltip();
    if (nearest) this.showTooltip(nearest);
  }

  showTooltip(spot) {
    const top = Math.max(ROOM_Y + 4, spot.y - 30);
    const name = addText(this, 0, top + 4, spot.info.name, { tint: UI.gold });
    const description = addText(this, 0, top + 12, spot.info.description);
    const width = Math.max(name.width, description.width) + 8;
    const cx = Math.round(Phaser.Math.Clamp(spot.x, FLOOR.left + width / 2, FLOOR.right - width / 2));
    name.setX(cx);
    description.setX(cx);
    const box = this.add.rectangle(cx, top + 8, width, 18, 0x120e16, 0.85).setStrokeStyle(1, 0x4a4058).setDepth(DEPTH.ui);
    name.setDepth(DEPTH.ui + 1);
    description.setDepth(DEPTH.ui + 1);
    this.tooltip = { spot, parts: [box, name, description] };
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

    const { x, y } = player.feet;
    const image = this.add.image(x, y - 3, 'bomb').setDepth(DEPTH.actors + y - 1);
    this.tweens.add({ targets: image, scale: 1.25, duration: 150, yoyo: true, repeat: -1 });
    const bomb = { x, y: y - 3, image };
    bomb.timer = this.time.delayedCall(BOMB_FUSE_MS, () => this.explode(bomb));
    this.bombs.push(bomb);
    this.roomObjects.push(image);
  }

  // Hurts every enemy nearby, and Mochi too if too close.
  explode(bomb) {
    this.bombs = this.bombs.filter((b) => b !== bomb);
    bomb.image.destroy();
    Audio.play('bomb');
    this.burst(bomb.x, bomb.y, 'spark', 12, { distance: BOMB_RADIUS * 0.7, duration: 350 });
    this.burst(bomb.x, bomb.y, 'smoke', 10, { distance: BOMB_RADIUS * 0.6, duration: 500 });
    this.cameras.main.shake(200, 0.02);

    const now = this.time.now;
    const distance = Phaser.Math.Distance.Between;
    for (const enemy of this.enemies) {
      if (enemy.state !== 'active' || distance(bomb.x, bomb.y, enemy.x, enemy.y) > BOMB_RADIUS) continue;
      const angle = Math.atan2(enemy.y - bomb.y, enemy.x - bomb.x);
      enemy.hit(BOMB_DAMAGE, { x: Math.cos(angle), y: Math.sin(angle) }, now);
    }
    for (const obstacle of this.view.obstacles.slice()) {
      if (distance(bomb.x, bomb.y, obstacle.x, obstacle.y) <= BOMB_RADIUS + 6) this.breakObstacle(obstacle);
    }
    this.hurtPlayerNear(bomb.x, bomb.y, BOMB_RADIUS);
  }

  // ---------- Player shots ----------

  firePlayerShot(x, y, dir, stats) {
    const count = stats.multishot;
    const side = { x: -dir.y, y: dir.x };
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * MULTISHOT_SPACING;
      this.spawnShot(x + side.x * offset, y + side.y * offset, dir, stats);
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
    if (!shot.active || enemy.state !== 'active' || shot.hitEnemies.has(enemy)) return;
    shot.hitEnemies.add(enemy);
    enemy.hit(shot.damage, shot.dir, this.time.now, shot.effects);
    if (shot.canSplit) this.splitShot(shot, enemy);
    if (!shot.pierce) shot.impact();
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

  fireEnemyBullet(x, y, angle, speed, type) {
    if (this.over) return;
    const bullet = new EnemyBullet(this, x, y, type);
    this.enemyShots.add(bullet, true);
    bullet.launch(angle, speed, this.time.now);
    Audio.play('enemyShot');
  }

  fireRing(x, y, count, speed, type, offset = 0) {
    for (let i = 0; i < count; i++) this.fireEnemyBullet(x, y, offset + (i / count) * Math.PI * 2, speed, type);
  }

  fireSpread(x, y, angle, count, spreadDeg, speed, type) {
    const step = (spreadDeg * Math.PI) / 180;
    for (let i = 0; i < count; i++) this.fireEnemyBullet(x, y, angle + (i - (count - 1) / 2) * step, speed, type);
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
    const crack = this.add.image(x, y + 4, 'crack').setDepth(DEPTH.slime);
    this.roomObjects.push(crack);
    this.tweens.add({ targets: crack, alpha: { from: 1, to: 0.4 }, duration: 120, yoyo: true, repeat: -1 });
    this.time.delayedCall(ROOT_WARNING_MS, () => {
      crack.destroy();
      if (!this.waveActive) return;
      const roots = this.add.image(x, y + 6, 'roots').setOrigin(0.5, 1).setDepth(DEPTH.actors + y + 6);
      this.roomObjects.push(roots);
      this.tweens.add({ targets: roots, scaleY: { from: 0.2, to: 1 }, duration: 120, yoyo: true, hold: 300, onComplete: () => roots.destroy() });
      this.burst(x, y + 4, 'smoke', 5, { distance: 8 });
      this.hurtPlayerNear(x, y, ROOT_RADIUS);
    });
  }

  // ---------- Damage to Mochi ----------

  onPlayerTouchEnemy(enemy) {
    if (this.over || enemy.state !== 'active' || !enemy.hitbox.body.enable) return;
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
    if (this.over || !this.player.takeDamage(amount, this.time.now)) return;
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
      if (blob.alpha > 0.15 && Math.abs(blob.x - x) < 6 && Math.abs(blob.y - y) < 4) {
        multiplier = Math.min(multiplier, blob.getData('slow'));
      }
    }
    return multiplier;
  }

  // ---------- Effects ----------

  burst(x, y, texture, count, { distance = 8, duration = 300 } = {}) {
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
    const y = FLOOR.top + 22;
    const labels = [addText(this, GAME_WIDTH / 2, y, text, { scale: 2, tint })];
    if (subtitle) labels.push(addText(this, GAME_WIDTH / 2, y + 13, subtitle, { tint: UI.muted }));
    labels.forEach((label) => label.setDepth(DEPTH.ui).setAlpha(0));
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
    const label = addText(this, Phaser.Math.Clamp(x, FLOOR.left + 40, FLOOR.right - 40), y - 20, text, { tint }).setDepth(DEPTH.ui);
    this.tweens.add({ targets: label, y: y - 30, alpha: 0, duration: 900, delay: 400, onComplete: () => label.destroy() });
  }

  // Small floating message above Mochi, at most once per cooldown.
  hint(text) {
    if (this.time.now < this.nextHintAt) return;
    this.nextHintAt = this.time.now + HINT_COOLDOWN_MS;
    const { x, y } = this.player.hitbox;
    const label = addText(this, x, y - 16, text, { tint: UI.muted }).setDepth(DEPTH.ui);
    this.tweens.add({ targets: label, y: y - 24, alpha: 0, duration: 1000, delay: 300, onComplete: () => label.destroy() });
  }
}
