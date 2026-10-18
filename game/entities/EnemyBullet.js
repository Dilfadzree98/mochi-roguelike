import { DEPTH } from '../constants.js';

const LIFETIME_MS = 5000;

// An enemy bullet. All of them share one hot-pink colour family (see BULLETS in Sprites.js).
// `range` (px) pops it after that distance; without one it flies until it hits something.
export class EnemyBullet extends Phaser.Physics.Arcade.Image {
  // Call after adding the bullet to a physics group (adding resets velocity).
  launch(angle, speed, time, range = null) {
    this.body.setSize(4, 4);
    this.setRotation(angle); // only the thorn has a direction; round bullets look the same
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.expiresAt = time + LIFETIME_MS;
    this.range = range;
    this.startX = this.x;
    this.startY = this.y;
  }

  update(time) {
    if (!this.active) return;
    this.setDepth(DEPTH.actors + this.y);
    if (time >= this.expiresAt) this.pop();
    else if (this.range && Math.hypot(this.x - this.startX, this.y - this.startY) >= this.range) this.pop();
  }

  pop() {
    if (!this.active) return;
    this.scene.burst(this.x, this.y, 'pink_bit', 3, { distance: 4, duration: 200 });
    this.destroy();
  }
}
