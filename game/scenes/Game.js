import { GAME_WIDTH, FLOOR, DEPTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { Rng, newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { buildRoom } from '../systems/Room.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';

const FIRST_WAVE_DELAY_MS = 600;
const WAVE_BREAK_MS = 1500;
const MAX_ENEMIES_PER_WAVE = 8;
const SPAWN_MIN_PLAYER_DISTANCE = 64;
const SPAWN_MIN_ENEMY_DISTANCE = 20;
const GAME_OVER_DELAY_MS = 1600;

// Stage 1: a single room with endless waves of enemies.
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

    const room = buildRoom(this, this.rng);
    this.shots = this.physics.add.group();
    this.enemyBodies = this.physics.add.group();
    this.slime = this.add.group();
    this.enemies = [];

    this.player = new Player(this, (FLOOR.left + FLOOR.right) / 2, (FLOOR.top + FLOOR.bottom) / 2);

    this.physics.add.collider(this.player.hitbox, room.walls);
    this.physics.add.collider(this.enemyBodies, room.walls);
    this.physics.add.collider(this.enemyBodies, this.enemyBodies);
    this.physics.add.overlap(this.shots, room.walls, (shot) => shot.impact());
    this.physics.add.overlap(this.shots, this.enemyBodies, (shot, body) => this.onShotHitEnemy(shot, body.owner));
    this.physics.add.overlap(this.player.hitbox, this.enemyBodies, (_, body) => this.onPlayerTouchEnemy(body.owner));

    this.wave = 0;
    this.waveActive = false;
    this.over = false;

    this.scene.launch('HUD');
    this.time.delayedCall(FIRST_WAVE_DELAY_MS, () => this.startNextWave());
  }

  update(time, delta) {
    this.player.speedMultiplier = this.slowAt(this.player.feet);
    this.player.update(time, delta);

    for (const enemy of this.enemies) enemy.update(time, delta, this.player);
    this.enemies = this.enemies.filter((enemy) => !enemy.destroyed);

    for (const shot of this.shots.getChildren().slice()) shot.update(time);

    if (this.waveActive && this.enemies.every((enemy) => enemy.state === 'dead')) this.clearWave();
  }

  // ---------- Waves ----------

  startNextWave() {
    this.wave += 1;
    this.events.emit('wave', this.wave);
    this.banner(`Wave ${this.wave}`, UI.peach);

    const types = Object.keys(this.enemyDefs);
    const count = Math.min(1 + this.wave, MAX_ENEMIES_PER_WAVE);
    const taken = [];
    for (let i = 0; i < count; i++) {
      const pos = this.findSpawnPoint(taken);
      taken.push(pos);
      this.enemies.push(new Enemy(this, this.enemyDefs[this.rng.pick(types)], pos.x, pos.y));
    }
    this.waveActive = true;
  }

  clearWave() {
    this.waveActive = false;
    this.banner('Clear!', UI.leaf);
    this.time.delayedCall(WAVE_BREAK_MS, () => {
      if (!this.over) this.startNextWave();
    });
  }

  // Random floor spot away from the player and other new spawns.
  findSpawnPoint(taken) {
    const player = this.player.hitbox;
    const distance = Phaser.Math.Distance.Between;
    let pos;
    for (let tries = 0; tries < 30; tries++) {
      pos = {
        x: Math.round(this.rng.range(FLOOR.left + 12, FLOOR.right - 12)),
        y: Math.round(this.rng.range(FLOOR.top + 10, FLOOR.bottom - 8)),
      };
      const nearPlayer = distance(pos.x, pos.y, player.x, player.y) < SPAWN_MIN_PLAYER_DISTANCE;
      const crowded = taken.some((other) => distance(pos.x, pos.y, other.x, other.y) < SPAWN_MIN_ENEMY_DISTANCE);
      if (!nearPlayer && !crowded) break;
    }
    return pos;
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

    const newBest = Save.recordWave(this.wave);
    this.time.delayedCall(GAME_OVER_DELAY_MS, () => {
      this.scene.stop('HUD');
      this.scene.start('GameOver', { wave: this.wave, seed: this.seed, newBest });
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
