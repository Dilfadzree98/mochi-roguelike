import { GAME_WIDTH, FLOOR, DEPTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { Rng, newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { generateDungeon } from '../systems/DungeonGen.js';
import { buildRoom } from '../systems/Room.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';

const ROOM_START_DELAY_MS = 500;
const WAVE_BREAK_MS = 900;
const SPAWN_MIN_PLAYER_DISTANCE = 64;
const SPAWN_MIN_ENEMY_DISTANCE = 20;
const HEART_DROP_CHANCE = 0.4;
const PICKUP_RADIUS = 9;
const FADE_MS = 150;
const FADE_COLOR = [18, 14, 22];
const GAME_OVER_DELAY_MS = 1600;
const WIN_DELAY_MS = 2500;

const CENTER = { x: (FLOOR.left + FLOOR.right) / 2, y: (FLOOR.top + FLOOR.bottom) / 2 };

// Where Mochi appears after walking through a door in direction `dir`.
const ENTRY_POINTS = {
  up: { x: CENTER.x, y: FLOOR.bottom - 10 },
  down: { x: CENTER.x, y: FLOOR.top + 10 },
  left: { x: FLOOR.right - 10, y: CENTER.y },
  right: { x: FLOOR.left + 10, y: CENTER.y },
};

// Stage 2: one random floor of rooms. Fight rooms have 2 waves and stay locked until both are cleared.
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
    this.dungeon = generateDungeon(this.rng, this.enemyDefs);

    this.shots = this.physics.add.group();
    this.enemyBodies = this.physics.add.group();
    this.slime = this.add.group();
    this.enemies = [];
    this.pickups = [];
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

    this.scene.launch('HUD');
    this.enterRoom(this.dungeon.start, null);
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
      this.physics.add.collider(hitbox, this.view.doorBlockers),
      this.physics.add.collider(this.enemyBodies, this.view.solidWalls),
      this.physics.add.overlap(this.shots, this.view.solidWalls, (shot) => shot.impact()),
    ];

    const entry = fromDir ? ENTRY_POINTS[fromDir] : CENTER;
    this.player.placeAt(entry.x, entry.y);

    if (room.type === 'start') this.addStartHint();
    if (room.type === 'treasure') this.addPedestal();
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

  addStartHint() {
    const hint = addText(this, CENTER.x, FLOOR.bottom - 14, 'WASD move   Arrows shoot', { tint: UI.muted })
      .setDepth(DEPTH.decor)
      .setAlpha(0.7);
    this.roomObjects.push(hint);
  }

  addPedestal() {
    const glow = this.add.image(CENTER.x, CENTER.y, 'glow').setDepth(DEPTH.decor);
    const pedestal = this.add.image(CENTER.x, CENTER.y + 4, 'pedestal').setOrigin(0.5, 1).setDepth(DEPTH.actors + CENTER.y + 4);
    const note = addText(this, CENTER.x, CENTER.y + 16, 'Empty... for now', { tint: UI.gold }).setDepth(DEPTH.decor);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(glow, pedestal, note);
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
    if (this.rng.chance(HEART_DROP_CHANCE)) {
      const pickup = { kind: 'heart', x: CENTER.x, y: CENTER.y };
      room.pickups.push(pickup);
      this.spawnPickup(pickup);
    }
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

  // `pickup` is the saved record on room.pickups, so uncollected drops stay in the room.
  spawnPickup(pickup) {
    const image = this.add.image(pickup.x, pickup.y, 'heart_full').setDepth(DEPTH.actors + pickup.y);
    this.tweens.add({ targets: image, y: pickup.y - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.roomObjects.push(image);
    this.pickups.push({ pickup, image });
  }

  // Hearts are only picked up when Mochi is hurt, so they can be saved for later.
  collectPickups() {
    const player = this.player;
    if (!player.alive || player.hp >= player.stats.maxHp) return;
    for (const entry of this.pickups) {
      const { pickup, image } = entry;
      if (Phaser.Math.Distance.Between(pickup.x, pickup.y, player.hitbox.x, player.hitbox.y) > PICKUP_RADIUS) continue;
      player.heal(2);
      this.burst(pickup.x, pickup.y, 'husk', 4);
      image.destroy();
      this.room.pickups = this.room.pickups.filter((p) => p !== pickup);
      this.pickups = this.pickups.filter((p) => p !== entry);
      return;
    }
  }

  // ---------- Combat ----------

  firePlayerShot(x, y, dir, stats) {
    const shot = new Projectile(this, x, y, 'seed');
    this.shots.add(shot, true);
    shot.launch(dir, stats);
  }

  onShotHitEnemy(shot, enemy) {
    if (!shot.active || enemy.state !== 'active') return;
    shot.impact();
    enemy.hit(shot.damage, shot.dir, this.time.now);
  }

  onPlayerTouchEnemy(enemy) {
    if (this.over || enemy.state !== 'active') return;
    if (!this.player.takeDamage(enemy.def.contactDamage, this.time.now)) return;

    this.cameras.main.shake(120, 0.012);
    if (this.player.alive) this.player.knockbackFrom(enemy.x, enemy.y);
    else this.onPlayerDied();
  }

  onPlayerDied() {
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

  banner(text, tint) {
    const label = addText(this, GAME_WIDTH / 2, FLOOR.top + 22, text, { scale: 2, tint })
      .setDepth(DEPTH.ui)
      .setAlpha(0);
    this.tweens.add({
      targets: label,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 900,
      onComplete: () => label.destroy(),
    });
  }
}
