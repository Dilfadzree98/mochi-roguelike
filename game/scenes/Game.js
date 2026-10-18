import { GAME_WIDTH, FLOOR, DEPTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { Rng, newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { generateDungeon } from '../systems/DungeonGen.js';
import { makeItemPool } from '../systems/Items.js';
import { buildRoom } from '../systems/Room.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';

const ROOM_START_DELAY_MS = 500;
const WAVE_BREAK_MS = 900;
const SPAWN_MIN_PLAYER_DISTANCE = 64;
const SPAWN_MIN_ENEMY_DISTANCE = 20;
const PICKUP_RADIUS = 9;
const FADE_MS = 150;
const FADE_COLOR = [18, 14, 22];
const GAME_OVER_DELAY_MS = 1600;
const WIN_DELAY_MS = 2500;
const HINT_COOLDOWN_MS = 1200;

// Drops. Each point of luck raises the chances.
const ROOM_DROP_CHANCE = 0.5;
const ROOM_DROP_LUCK_BONUS = 0.15;
const ROOM_DROP_WEIGHTS = { coin: 40, heart: 30, bomb: 15, key: 15 };
const COIN_DROP_CHANCE = 0.12;
const COIN_DROP_LUCK_BONUS = 0.08;

const BOMB_FUSE_MS = 1500;
const BOMB_RADIUS = 30;
const BOMB_DAMAGE = 5;

const SPLIT_SPREAD = 0.6;      // radians between split fragments
const SPLIT_RANGE = 50;
const MULTISHOT_SPACING = 4;   // px between side-by-side seeds

const SHOP_PRICES = { item: 5, heart: 3, bomb: 3, key: 3 };
const PICKUP_TEXTURES = { heart: 'heart_full', coin: 'coin', bomb: 'bomb', key: 'key' };

const CENTER = { x: (FLOOR.left + FLOOR.right) / 2, y: (FLOOR.top + FLOOR.bottom) / 2 };

// Where Mochi appears after walking through a door in direction `dir`.
const ENTRY_POINTS = {
  up: { x: CENTER.x, y: FLOOR.bottom - 10 },
  down: { x: CENTER.x, y: FLOOR.top + 10 },
  left: { x: FLOOR.right - 10, y: CENTER.y },
  right: { x: FLOOR.left + 10, y: CENTER.y },
};

function weightedPick(rng, weights) {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [key, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return Object.keys(weights)[0];
}

// One random floor of rooms. Fight rooms have 2 waves and stay locked until both are cleared.
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
    this.dungeon = generateDungeon(this.rng, this.enemyDefs);
    this.itemPool = makeItemPool(this.rng, this.itemDefs);

    this.shots = this.physics.add.group();
    this.enemyBodies = this.physics.add.group();
    this.slime = this.add.group();
    this.enemies = [];
    this.pickups = [];     // things on the floor that are taken by walking over them
    this.bombs = [];
    this.roomObjects = []; // extra objects owned by the current room, destroyed on leaving
    this.roomColliders = [];

    this.player = new Player(this, CENTER.x, CENTER.y);

    this.physics.add.collider(this.enemyBodies, this.enemyBodies);
    this.physics.add.overlap(this.shots, this.enemyBodies, (shot, body) => this.onShotHitEnemy(shot, body.owner));
    this.physics.add.overlap(this.player.hitbox, this.enemyBodies, (_, body) => this.onPlayerTouchEnemy(body.owner));

    this.roomsCleared = 0;
    this.waveIndex = 0;
    this.waveActive = false;
    this.over = false;
    this.transitioning = false;
    this.nextHintAt = 0;

    this.scene.launch('HUD');
    this.enterRoom(this.dungeon.start, null);
    this.setupPause();
  }

  // Esc or P opens the pause menu; leaving the window or tab pauses automatically.
  setupPause() {
    this.input.keyboard.on('keydown-ESC', () => this.pause());
    this.input.keyboard.on('keydown-P', () => this.pause());

    // Keys released while paused never reached this scene, so forget held keys on resume.
    const onResume = () => this.input.keyboard.resetKeys();
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
    this.scene.pause();
    this.scene.launch('Pause');
  }

  update(time, delta) {
    if (this.transitioning) return;

    this.player.speedMultiplier = this.slowAt(this.player.feet);
    this.player.update(time, delta);

    for (const enemy of this.enemies) enemy.update(time, delta, this.player);
    this.enemies = this.enemies.filter((enemy) => !enemy.destroyed);

    for (const shot of this.shots.getChildren().slice()) shot.update(time);

    this.collectPickups();

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
    ];

    const entry = fromDir ? ENTRY_POINTS[fromDir] : CENTER;
    this.player.placeAt(entry.x, entry.y);

    if (room.type === 'start') this.addStartHint();
    if (room.type === 'treasure') this.setUpTreasure(room);
    if (room.type === 'shop') this.setUpShop(room);
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
    this.tweens.getTweens().forEach((tween) => tween.complete());
    this.bombs.forEach((bomb) => bomb.timer.remove());
    this.bombs = [];
    this.enemies.forEach((enemy) => enemy.destroy());
    this.enemies = [];
    this.shots.clear(true, true);
    this.slime.clear(true, true);
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
    this.transitioning = true;
    this.player.stop();

    const camera = this.cameras.main;
    camera.fadeOut(FADE_MS, ...FADE_COLOR);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.leaveRoom();
      this.enterRoom(next, dir);
      camera.fadeIn(FADE_MS, ...FADE_COLOR);
      this.transitioning = false;
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
    this.burst(door.x, door.y, 'spark', 8, { distance: 12 });
  }

  addStartHint() {
    const hint = addText(this, CENTER.x, FLOOR.bottom - 14, 'WASD move  Arrows shoot  E bomb  Esc pause', { tint: UI.muted })
      .setDepth(DEPTH.decor)
      .setAlpha(0.7);
    this.roomObjects.push(hint);
  }

  // ---------- Treasure room and shop ----------

  setUpTreasure(room) {
    room.contents ??= { itemId: this.itemPool.pop() ?? null };

    const glow = this.add.image(CENTER.x, CENTER.y, 'glow').setDepth(DEPTH.decor);
    const pedestal = this.add
      .image(CENTER.x, CENTER.y + 4, 'pedestal')
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.actors + CENTER.y + 4);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(glow, pedestal);

    const { itemId } = room.contents;
    if (!itemId) return;
    const icon = this.floatingImage(CENTER.x, CENTER.y - 10, this.itemDefs[itemId].icon);
    this.addPickupSpot(CENTER.x, CENTER.y - 4, [icon], () => {
      room.contents.itemId = null;
      this.giveItem(itemId);
      return true;
    });
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
      const texture = ware.kind === 'item' ? this.itemDefs[ware.itemId].icon : PICKUP_TEXTURES[ware.kind];
      const image = this.floatingImage(ware.x, ware.y, texture);
      const coin = this.add.image(ware.x - 4, ware.y + 11, 'coin').setDepth(DEPTH.shadow);
      const price = addText(this, ware.x + 1, ware.y + 11, ware.price, { originX: 0, tint: UI.gold }).setDepth(DEPTH.shadow);
      this.roomObjects.push(coin, price);

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
      });
    }
  }

  giveItem(itemId) {
    const def = this.itemDefs[itemId];
    this.player.addItem({ id: itemId, ...def });
    this.banner(def.name, UI.gold, def.description);
    this.burst(this.player.hitbox.x, this.player.hitbox.y - 6, 'spark', 10, { distance: 14 });
  }

  // ---------- Waves ----------

  startWave() {
    if (this.over) return;
    this.waveIndex += 1;
    const total = this.room.waves.length;
    this.events.emit('wave', this.waveIndex, total);
    this.banner(`Wave ${this.waveIndex}/${total}`, UI.peach);

    const taken = [];
    for (const type of this.room.waves[this.waveIndex - 1]) {
      const pos = this.findSpawnPoint(taken);
      taken.push(pos);
      this.enemies.push(new Enemy(this, this.enemyDefs[type], pos.x, pos.y));
    }
    this.waveActive = true;
  }

  onWaveCleared() {
    this.waveActive = false;
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
    for (const door of this.view.doors) this.burst(door.x, door.y, 'leaf', 4, { distance: 10 });

    if (room.type === 'boss') {
      this.over = true;
      this.banner('Garden cleared!', UI.gold);
      this.endRun(true, WIN_DELAY_MS);
      return;
    }

    this.banner('Clear!', UI.leaf);
    const chance = ROOM_DROP_CHANCE + ROOM_DROP_LUCK_BONUS * this.player.stats.luck;
    if (this.rng.chance(chance)) this.dropPickup(weightedPick(this.rng, ROOM_DROP_WEIGHTS), CENTER.x, CENTER.y);
  }

  onEnemyKilled(enemy) {
    if (this.over || enemy.def.boss) return;
    const chance = COIN_DROP_CHANCE + COIN_DROP_LUCK_BONUS * this.player.stats.luck;
    if (this.rng.chance(chance)) this.dropPickup('coin', enemy.x, enemy.y);
  }

  // Random floor spot away from the player and other new spawns.
  findSpawnPoint(taken) {
    const player = this.player.hitbox;
    const distance = Phaser.Math.Distance.Between;
    let pos;
    for (let tries = 0; tries < 30; tries++) {
      pos = {
        x: Math.round(this.rng.range(FLOOR.left + 14, FLOOR.right - 14)),
        y: Math.round(this.rng.range(FLOOR.top + 12, FLOOR.bottom - 10)),
      };
      const nearPlayer = distance(pos.x, pos.y, player.x, player.y) < SPAWN_MIN_PLAYER_DISTANCE;
      const crowded = taken.some((other) => distance(pos.x, pos.y, other.x, other.y) < SPAWN_MIN_ENEMY_DISTANCE);
      if (!nearPlayer && !crowded) break;
    }
    return pos;
  }

  // ---------- Pickups ----------

  floatingImage(x, y, texture) {
    const image = this.add.image(x, y, texture).setDepth(DEPTH.actors + y + 8);
    this.tweens.add({ targets: image, y: y - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(image);
    return image;
  }

  // Something taken by walking over it. tryTake returns false to leave it there.
  addPickupSpot(x, y, objects, tryTake) {
    this.pickups.push({ x, y, objects, tryTake });
  }

  // A new drop on the floor, remembered by the room until picked up.
  dropPickup(kind, x, y) {
    const pickup = {
      kind,
      x: Phaser.Math.Clamp(Math.round(x), FLOOR.left + 6, FLOOR.right - 6),
      y: Phaser.Math.Clamp(Math.round(y), FLOOR.top + 6, FLOOR.bottom - 6),
    };
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
      return;
    }
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

    const player = this.player;
    if (distance(bomb.x, bomb.y, player.hitbox.x, player.hitbox.y) <= BOMB_RADIUS && player.takeDamage(1, now)) {
      if (player.alive) player.knockbackFrom(bomb.x, bomb.y);
      else this.onPlayerDied();
    }
  }

  // ---------- Combat ----------

  firePlayerShot(x, y, dir, stats) {
    const count = stats.multishot;
    const side = { x: -dir.y, y: dir.x };
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * MULTISHOT_SPACING;
      this.spawnShot(x + side.x * offset, y + side.y * offset, dir, stats);
    }
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

  onPlayerTouchEnemy(enemy) {
    if (this.over || enemy.state !== 'active') return;
    if (!this.player.takeDamage(enemy.def.contactDamage, this.time.now)) return;

    this.cameras.main.shake(120, 0.012);
    if (this.player.alive) this.player.knockbackFrom(enemy.x, enemy.y);
    else this.onPlayerDied();
  }

  onPlayerDied() {
    if (this.over) return;
    this.over = true;
    this.waveActive = false;
    for (const enemy of this.enemies) enemy.freeze();
    this.endRun(false, GAME_OVER_DELAY_MS);
  }

  endRun(won, delay) {
    const newBest = Save.recordRun(this.roomsCleared, won);
    this.time.delayedCall(delay, () => {
      this.scene.stop('HUD');
      this.scene.start('GameOver', {
        won,
        roomsCleared: this.roomsCleared,
        totalRooms: this.dungeon.combatRoomCount,
        seed: this.seed,
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

  // Small floating message above Mochi, at most once per cooldown.
  hint(text) {
    if (this.time.now < this.nextHintAt) return;
    this.nextHintAt = this.time.now + HINT_COOLDOWN_MS;
    const { x, y } = this.player.hitbox;
    const label = addText(this, x, y - 16, text, { tint: UI.muted }).setDepth(DEPTH.ui);
    this.tweens.add({ targets: label, y: y - 24, alpha: 0, duration: 1000, delay: 300, onComplete: () => label.destroy() });
  }
}
