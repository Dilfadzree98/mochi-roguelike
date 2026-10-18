import { DEPTH } from '../constants.js';

const SPIN_STEP_MS = 90;

// A player shot: flies straight until it reaches its range or hits something.
export class Projectile extends Phaser.Physics.Arcade.Image {
  // Call after adding the shot to a physics group (adding resets velocity).
  launch(dir, { shotSpeed, range, damage }) {
    this.dir = dir;
    this.damage = damage;
    this.range = range;
    this.startX = this.x;
    this.startY = this.y;
    this.body.setSize(4, 4);
    this.setVelocity(dir.x * shotSpeed, dir.y * shotSpeed);
  }

  update(time) {
    if (!this.active) return;
    this.setDepth(DEPTH.actors + this.y);
    // Spin in quarter turns so the pixels stay crisp.
    this.setAngle((Math.floor(time / SPIN_STEP_MS) % 4) * 90);
    if (Phaser.Math.Distance.Between(this.startX, this.startY, this.x, this.y) >= this.range) this.impact();
  }

  // Cracks open into tiny husk pieces.
  impact() {
    if (!this.active) return;
    this.scene.burst(this.x, this.y, 'husk', 3, { distance: 6, duration: 250 });
    this.destroy();
  }
}
