import { DEPTH, FLOOR } from '../constants.js';

const SPIN_STEP_MS = 90;

// A player shot: flies straight until its range runs out or it hits something.
// Its behaviour comes from the player's stats (pierce, bounces, split, burn, slow).
export class Projectile extends Phaser.Physics.Arcade.Image {
  // Call after adding the shot to a physics group (adding resets velocity).
  // `options.isFragment` marks the small seeds made by a split, which don't split again.
  launch(dir, stats, time, { damageScale = 1, isFragment = false, alreadyHit = [] } = {}) {
    this.dir = dir;
    this.stats = stats;
    this.damage = stats.damage * damageScale;
    this.pierce = stats.pierce;
    this.bouncesLeft = stats.bounces;
    this.canSplit = !isFragment && stats.split > 0;
    this.hitEnemies = new Set(alreadyHit);
    this.expiresAt = time + (stats.range / stats.shotSpeed) * 1000;
    this.body.setSize(4, 4);
    if (isFragment) this.setScale(0.6);
    this.setVelocity(dir.x * stats.shotSpeed, dir.y * stats.shotSpeed);
  }

  // Status effects passed to an enemy on hit.
  get effects() {
    return { burn: this.stats.burn, slow: this.stats.slow };
  }

  update(time) {
    if (!this.active) return;
    this.setDepth(DEPTH.actors + this.y);
    // Spin in quarter turns so the pixels stay crisp.
    this.setAngle((Math.floor(time / SPIN_STEP_MS) % 4) * 90);
    if (time >= this.expiresAt) this.impact();
  }

  // Bounce off the floor edge it crossed, or break.
  hitWall() {
    if (!this.active) return;
    if (this.bouncesLeft <= 0) {
      this.impact();
      return;
    }
    this.bouncesLeft -= 1;
    const v = this.body.velocity;
    if (this.x - 2 < FLOOR.left || this.x + 2 > FLOOR.right) {
      v.x = -v.x;
      this.x = Phaser.Math.Clamp(this.x, FLOOR.left + 3, FLOOR.right - 3);
    }
    if (this.y - 2 < FLOOR.top || this.y + 2 > FLOOR.bottom) {
      v.y = -v.y;
      this.y = Phaser.Math.Clamp(this.y, FLOOR.top + 3, FLOOR.bottom - 3);
    }
    this.dir = { x: Math.sign(v.x), y: Math.sign(v.y) };
  }

  // Cracks open into tiny husk pieces.
  impact() {
    if (!this.active) return;
    this.scene.burst(this.x, this.y, 'husk', 3, { distance: 6, duration: 250 });
    this.destroy();
  }
}
