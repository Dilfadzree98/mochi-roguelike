import { DEPTH } from '../constants.js';
import { flashWhite } from '../systems/Fx.js';

// Movement patterns, referenced by name from data/enemies.json.
// Each one sets the enemy's velocity for this frame.
const BEHAVIOURS = {
  chase(enemy, player) {
    const angle = Math.atan2(player.hitbox.y - enemy.y, player.hitbox.x - enemy.x);
    enemy.hitbox.body.velocity.setToPolar(angle, enemy.speed);
  },
};

const SPAWN_MS = 500;
const KNOCKBACK_MS = 100;
const KNOCKBACK_SPEED = 70;
const CRAWL_FRAME_MS = 250;
const FLASH_MS = 60;
const BURN_TINT = 0xff8a3d;
const SLOW_TINT = 0xa8e0ff;

// States: spawning -> active -> dead (or frozen when the run ends).
export class Enemy {
  constructor(scene, def, x, y) {
    if (!BEHAVIOURS[def.behaviour]) throw new Error(`Unknown enemy behaviour "${def.behaviour}"`);
    this.scene = scene;
    this.def = def;
    this.hp = def.hp;
    this.state = 'spawning';
    this.destroyed = false;
    this.knockbackUntil = 0;
    this.nextTrailAt = 0;
    this.flashUntil = 0;
    this.burn = null; // { ticksLeft, damage, interval, nextAt }
    this.slow = null; // { multiplier, until }
    this.animOffset = scene.fxRng.range(0, CRAWL_FRAME_MS * 2);
    this.footOffset = def.hitbox.h / 2 + 1;
    this.size = def.scale ?? 1; // sprite scale, e.g. 2 for big variants

    this.hitbox = scene.add.zone(x, y, def.hitbox.w, def.hitbox.h);
    scene.enemyBodies.add(this.hitbox);
    this.hitbox.owner = this;
    this.hitbox.body.enable = false;

    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setAlpha(0).setScale(this.size);
    this.sprite = scene.add.image(x, y, def.texture).setOrigin(0.5, 1).setAlpha(0).setScale(this.size, 0.2 * this.size);
    this.syncVisuals();

    // Pop up out of the ground; harmless until fully spawned.
    scene.tweens.add({ targets: this.sprite, alpha: 1, scaleY: this.size, duration: SPAWN_MS, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: this.shadow, alpha: 0.3, duration: SPAWN_MS });
    scene.time.delayedCall(SPAWN_MS, () => {
      if (this.state !== 'spawning') return;
      this.state = 'active';
      this.hitbox.body.enable = true;
    });
  }

  get x() {
    return this.hitbox.x;
  }

  get y() {
    return this.hitbox.y;
  }

  get speed() {
    return this.def.speed * (this.slow ? this.slow.multiplier : 1);
  }

  update(time, delta, player) {
    if (this.state !== 'active') return;

    this.updateStatus(time);
    if (this.state !== 'active') return; // burned to death

    const body = this.hitbox.body;
    if (time >= this.knockbackUntil) BEHAVIOURS[this.def.behaviour](this, player, time, delta);
    if (Math.abs(body.velocity.x) > 1) this.sprite.setFlipX(body.velocity.x < 0);

    if (this.def.trail && time >= this.nextTrailAt) {
      this.scene.dropSlime(this.x, this.y + this.footOffset - 1, this.def.trail);
      this.nextTrailAt = time + this.def.trail.interval;
    }

    // 2-frame stretch-and-squash crawl.
    const stretched = Math.floor((time + this.animOffset) / CRAWL_FRAME_MS) % 2 === 1;
    this.sprite.setScale(this.size * (stretched ? 1.15 : 1), this.size * (stretched ? 0.85 : 1));
    this.syncVisuals();
  }

  // Burn ticks, slow expiry, and the tint that shows them.
  updateStatus(time) {
    if (this.slow && time >= this.slow.until) this.slow = null;
    if (this.burn && time >= this.burn.nextAt) {
      this.burn.ticksLeft -= 1;
      this.burn.nextAt = time + this.burn.interval;
      this.flashUntil = time + FLASH_MS;
      this.damage(this.burn.damage);
      if (this.burn?.ticksLeft <= 0) this.burn = null;
    }

    if (time < this.flashUntil) this.sprite.setTintFill(0xffffff);
    else if (this.burn) this.sprite.setTint(BURN_TINT);
    else if (this.slow) this.sprite.setTint(SLOW_TINT);
    else this.sprite.clearTint();
  }

  syncVisuals() {
    const feetY = this.y + this.footOffset;
    this.sprite.setPosition(this.x, feetY).setDepth(DEPTH.actors + feetY);
    this.shadow.setPosition(this.x, feetY - 1);
  }

  // A hit from a shot or bomb. `effects` may carry burn and slow from the player's items.
  hit(damage, dir, time, effects = {}) {
    if (this.state !== 'active') return;
    this.flashUntil = time + FLASH_MS;
    this.sprite.setTintFill(0xffffff);
    this.knockbackUntil = time + KNOCKBACK_MS;
    this.hitbox.body.velocity.set(dir.x * KNOCKBACK_SPEED, dir.y * KNOCKBACK_SPEED);
    if (effects.burn) this.burn = { ...effects.burn, ticksLeft: effects.burn.ticks, nextAt: time + effects.burn.interval };
    if (effects.slow) this.slow = { multiplier: effects.slow.multiplier, until: time + effects.slow.ms };
    this.damage(damage);
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.die();
  }

  // Melts into a puddle.
  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.burn = null;
    this.hitbox.body.setVelocity(0, 0);
    this.hitbox.body.enable = false;
    flashWhite(this.scene, this.sprite);
    if (this.def.deathParticle) this.scene.burst(this.x, this.y, this.def.deathParticle, 6 * this.size, { distance: 10 * this.size });
    if (this.def.trail) this.scene.dropSlime(this.x, this.y + this.footOffset - 1, this.def.trail);
    this.scene.onEnemyKilled(this);

    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 450 });
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.5 * this.size,
      scaleY: 0.15 * this.size,
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  freeze() {
    if (this.state === 'dead') return;
    this.state = 'frozen';
    this.hitbox.body.setVelocity(0, 0);
  }

  destroy() {
    if (this.destroyed) return;
    this.sprite.destroy();
    this.shadow.destroy();
    this.hitbox.destroy();
    this.destroyed = true;
  }
}
