import { DEPTH } from '../constants.js';
import { flashWhite } from '../systems/Fx.js';

// Starting stats. Items will change a copy of these (player.stats), never this object.
const BASE_STATS = {
  maxHp: 6,        // half-hearts
  speed: 72,       // px per second
  fireDelay: 320,  // ms between shots
  shotSpeed: 150,  // px per second
  range: 120,      // px a shot travels
  damage: 1,
};

const FIRE_DIRS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const HITBOX = { w: 10, h: 10 };
const FOOT_OFFSET = HITBOX.h / 2 + 1; // from hitbox centre down to the sprite's feet
const ACCEL = 14;                     // how fast velocity eases toward the input (per second)
const INVULN_MS = 1000;
const HURT_FACE_MS = 200;
const WILT_AT_HP = 2;                 // leaf droops at one heart or less
const KNOCKBACK_SPEED = 140;

// Physics uses an invisible hitbox; the sprite just follows it, so squash and
// stretch never changes the collision size.
export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.stats = { ...BASE_STATS };
    this.hp = this.stats.maxHp;
    this.alive = true;
    this.speedMultiplier = 1; // set each frame by slowing hazards
    this.nextFireAt = 0;
    this.invulnUntil = 0;
    this.hurtUntil = 0;
    this.recoil = 0;
    this.moving = false;

    this.hitbox = scene.add.zone(x, y, HITBOX.w, HITBOX.h);
    scene.physics.add.existing(this.hitbox);
    this.hitbox.owner = this;

    this.shadow = scene.add.image(x, y, 'shadow').setAlpha(0.3).setDepth(DEPTH.shadow);
    this.sprite = scene.add.image(x, y, 'mochi').setOrigin(0.5, 1);
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');

    this.syncVisuals(0);
  }

  get feet() {
    return { x: this.hitbox.x, y: this.hitbox.y + FOOT_OFFSET };
  }

  update(time, delta) {
    if (!this.alive) return;
    this.move(delta);
    this.tryFire(time);
    this.animate(time, delta);
  }

  move(delta) {
    const k = this.keys;
    const ix = (k.D.isDown ? 1 : 0) - (k.A.isDown ? 1 : 0);
    const iy = (k.S.isDown ? 1 : 0) - (k.W.isDown ? 1 : 0);
    const length = Math.hypot(ix, iy) || 1;
    const speed = this.stats.speed * this.speedMultiplier;
    const t = Math.min(1, (ACCEL * delta) / 1000);
    const velocity = this.hitbox.body.velocity;
    velocity.x += ((ix / length) * speed - velocity.x) * t;
    velocity.y += ((iy / length) * speed - velocity.y) * t;
    this.moving = ix !== 0 || iy !== 0;
  }

  // The most recently pressed arrow key wins when several are held.
  tryFire(time) {
    let held = null;
    for (const name of Object.keys(FIRE_DIRS)) {
      const key = this.keys[name];
      if (key.isDown && (!held || key.timeDown > this.keys[held].timeDown)) held = name;
    }
    if (!held || time < this.nextFireAt) return;

    const dir = FIRE_DIRS[held];
    this.nextFireAt = time + this.stats.fireDelay;
    this.recoil = 1;
    this.scene.firePlayerShot(this.hitbox.x + dir.x * 6, this.hitbox.y - 1 + dir.y * 6, dir, this.stats);
  }

  animate(time, delta) {
    this.recoil = Math.max(0, this.recoil - delta / 120);

    let scaleX = 1;
    let scaleY = 1;
    let hop = 0;
    if (this.moving) {
      // Hop with squash and stretch.
      const phase = Math.sin(time * 0.02);
      scaleX += 0.08 * phase;
      scaleY -= 0.08 * phase;
      hop = Math.round(Math.max(0, -phase) * 2);
    } else {
      // 2-frame breathing bounce.
      const breathing = Math.floor(time / 500) % 2;
      scaleX -= 0.04 * breathing;
      scaleY += 0.06 * breathing;
    }
    // Recoil squish after each shot.
    scaleX += 0.2 * this.recoil;
    scaleY -= 0.2 * this.recoil;
    this.sprite.setScale(scaleX, scaleY);

    const base = this.hp <= WILT_AT_HP ? 'mochi_wilt' : 'mochi';
    this.sprite.setTexture(time < this.hurtUntil ? `${base}_hurt` : base);

    // Blink while invulnerable.
    this.sprite.setVisible(time >= this.invulnUntil || Math.floor(time / 80) % 2 === 0);

    this.syncVisuals(hop);
  }

  syncVisuals(hop) {
    const { x, y } = this.feet;
    this.sprite.setPosition(x, y - hop).setDepth(DEPTH.actors + y);
    this.shadow.setPosition(x, y - 1);
  }

  // Returns true if the hit landed (not blocked by invulnerability).
  takeDamage(amount, time) {
    if (!this.alive || time < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = time + INVULN_MS;
    this.hurtUntil = time + HURT_FACE_MS;
    flashWhite(this.scene, this.sprite, 80);
    this.scene.events.emit('hp', this.hp, this.stats.maxHp);
    if (this.hp === 0) this.die();
    return true;
  }

  knockbackFrom(x, y) {
    const angle = Math.atan2(this.hitbox.y - y, this.hitbox.x - x);
    this.hitbox.body.velocity.set(Math.cos(angle) * KNOCKBACK_SPEED, Math.sin(angle) * KNOCKBACK_SPEED);
  }

  // Deflates flat and the leaf falls off.
  die() {
    this.alive = false;
    this.hitbox.body.setVelocity(0, 0);
    this.hitbox.body.enable = false;
    this.sprite.setVisible(true).setTexture('mochi_bare').setScale(1);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1.5, scaleY: 0.3, duration: 600, ease: 'Quad.easeIn' });

    const leaf = this.scene.add.image(this.sprite.x, this.sprite.y - 14, 'leaf').setDepth(DEPTH.overlay - 1);
    this.scene.tweens.add({
      targets: leaf,
      x: leaf.x + 12,
      y: this.sprite.y - 2,
      angle: 160,
      duration: 900,
      ease: 'Sine.easeInOut',
    });
  }
}
