import { DEPTH, FLOOR } from '../constants.js';

const SPIN_STEP_MS = 90;
const HOMING_RANGE = 220;      // px: only enemies this close are chased
const WAVE_SPEED = 14;         // radians per second of the wiggle
const ACCEL = { from: 0.4, to: 1.8, rampMs: 600 };
const BOOMERANG_RETURN_MS = 2000;

// A player shot. It flies at `angle` and the player's stats shape how:
// homing, wave, acceleration, boomerang, bounces, pierce, split, splash, burn/slow/poison...
export class Projectile extends Phaser.Physics.Arcade.Image {
  // Call after adding the shot to a physics group (adding resets velocity).
  // `isFragment` marks the small seeds made by a split (they don't split again).
  launch(dir, stats, time, { damageScale = 1, isFragment = false, alreadyHit = [] } = {}) {
    this.stats = stats;
    this.angleRad = Math.atan2(dir.y, dir.x);
    this.baseSpeed = stats.shotSpeed;
    this.damage = stats.damage * damageScale;
    this.pierce = stats.pierce;
    this.bouncesLeft = stats.bounces;
    this.canSplit = !isFragment && stats.split > 0;
    this.hitEnemies = new Set(alreadyHit);
    this.bornAt = time;
    this.expiresAt = time + (stats.range / stats.shotSpeed) * 1000;
    this.returning = false;
    const scale = stats.shotScale * (isFragment ? 0.6 : 1);
    this.setScale(scale);
    this.body.setSize(8 * Math.max(1, scale), 8 * Math.max(1, scale));
    if (stats.phase) this.setAlpha(0.75);
    this.steer(time, 0);
  }

  // Unit vector of the current direction (used for knockback and splits).
  get dir() {
    return { x: Math.cos(this.angleRad), y: Math.sin(this.angleRad) };
  }

  // Status effects passed to an enemy on hit.
  get effects() {
    const s = this.stats;
    return { burn: s.burn, slow: s.slow, poison: s.poison, confuse: s.confuse, knockback: s.knockback };
  }

  update(time, delta) {
    if (!this.active) return;
    this.setDepth(DEPTH.actors + this.y);
    // Spin in quarter turns so the pixels stay crisp.
    this.setAngle((Math.floor(time / SPIN_STEP_MS) % 4) * 90);

    if (time >= this.expiresAt) {
      if (this.stats.boomerang && !this.returning) {
        // Turn around and fly back to Mochi; it can hit everything again on the way.
        this.returning = true;
        this.hitEnemies.clear();
        this.expiresAt = time + BOOMERANG_RETURN_MS;
      } else {
        this.impact();
        return;
      }
    }
    this.steer(time, delta);
  }

  steer(time, delta) {
    const scene = this.scene;
    const stats = this.stats;
    const age = time - this.bornAt;
    const dt = delta / 1000;

    if (this.returning) {
      const mochi = scene.player.hitbox;
      this.angleRad = Math.atan2(mochi.y - this.y, mochi.x - this.x);
      if (Phaser.Math.Distance.Between(this.x, this.y, mochi.x, mochi.y) < 16) {
        this.destroy(); // caught
        return;
      }
    } else if (stats.homing > 0) {
      const target = this.nearestEnemy();
      if (target) {
        const wanted = Math.atan2(target.y - this.y, target.x - this.x);
        this.angleRad = Phaser.Math.Angle.RotateTo(this.angleRad, wanted, stats.homing * dt);
      }
    }

    let speed = this.baseSpeed;
    if (stats.accelerate) speed *= Math.min(ACCEL.to, ACCEL.from + ((ACCEL.to - ACCEL.from) * age) / ACCEL.rampMs);

    let vx = Math.cos(this.angleRad) * speed;
    let vy = Math.sin(this.angleRad) * speed;
    if (stats.wave > 0) {
      // Side-to-side velocity that makes the shot weave around its path.
      const side = stats.wave * WAVE_SPEED * Math.cos((WAVE_SPEED * age) / 1000);
      vx += -Math.sin(this.angleRad) * side;
      vy += Math.cos(this.angleRad) * side;
    }
    this.setVelocity(vx, vy);
  }

  nearestEnemy() {
    let best = null;
    let bestDistance = HOMING_RANGE;
    for (const enemy of this.scene.enemies) {
      if (enemy.state !== 'active' || !enemy.hitbox.body.enable || this.hitEnemies.has(enemy)) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (d < bestDistance) {
        best = enemy;
        bestDistance = d;
      }
    }
    return best;
  }

  // Bounce off the floor edge it crossed, or break. Returning boomerangs fly through.
  hitWall() {
    if (!this.active || this.returning) return;
    if (this.bouncesLeft <= 0) {
      this.impact();
      return;
    }
    this.bouncesLeft -= 1;
    if (this.x - 4 < FLOOR.left || this.x + 4 > FLOOR.right) {
      this.angleRad = Math.PI - this.angleRad;
      this.x = Phaser.Math.Clamp(this.x, FLOOR.left + 6, FLOOR.right - 6);
    }
    if (this.y - 4 < FLOOR.top || this.y + 4 > FLOOR.bottom) {
      this.angleRad = -this.angleRad;
      this.y = Phaser.Math.Clamp(this.y, FLOOR.top + 6, FLOOR.bottom - 6);
    }
  }

  // Cracks open into tiny husk pieces (and splashes, with Popcorn Kernel).
  impact() {
    if (!this.active) return;
    this.scene.burst(this.x, this.y, 'husk', 3, { distance: 12, duration: 250 });
    if (this.stats.explode > 0) this.scene.shotSplash(this.x, this.y, this.stats.explode, this.damage * 0.5);
    this.destroy();
  }
}
