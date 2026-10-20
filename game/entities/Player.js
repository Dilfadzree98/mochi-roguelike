import { DEPTH } from '../constants.js';
import { flashWhite } from '../systems/Fx.js';
import { computeStats } from '../systems/Items.js';

// Starting stats. player.stats is rebuilt from these, the character's modifiers and every held item.
export const BASE_STATS = {
  maxHp: 6,        // half-hearts
  speed: 144,      // px per second
  fireDelay: 320,  // ms between shots
  shotSpeed: 300,  // px per second
  range: 240,      // px a shot travels
  damage: 1,
  multishot: 1,    // seeds per shot
  pierce: false,
  bounces: 0,
  split: 0,        // seeds a shot splits into on hit
  burn: null,      // { ticks, damage, interval }
  slow: null,      // { multiplier, ms }
  luck: 0,
  shotTexture: 'seed',
  // Shot behaviours added by items (see data/items.json and Projectile.js).
  shotScale: 1,
  homing: 0,         // turn rate toward enemies, radians per second
  wave: 0,           // side-to-side wiggle, px
  boomerang: false,
  spread: 0,         // extra seeds fanned out at angles (pairs)
  backShot: 0,       // seeds fired backwards
  explode: 0,        // splash radius on impact, px
  poison: null,      // { ticks, damage, interval }
  chain: 0,          // extra enemies zapped on hit
  knockback: 1,      // knockback multiplier
  sprinkler: 0,      // every Nth shot also sprays a ring
  accelerate: false,
  confuse: 0,        // ms enemies stay dizzy
  crit: 0,           // chance of triple damage
  phase: false,      // shots pass through obstacles
  // Effects from the newer items.
  enemyHp: 1,        // enemy health multiplier (a downside)
  roomShield: 0,     // hits blocked in each room
  healEvery: 0,      // heal half a heart every N kills
  bombPower: 1,      // bomb blast size and damage multiplier
  thorns: 0,         // damage to enemies that touch Mochi
  invulnBonus: 0,    // extra ms of invincibility after a hit
  bossDamage: 1,     // damage multiplier against bosses
  // Shot behaviours from the third batch of shot items.
  expireBurst: 0,    // seeds a shot bursts into at the end of its range
  growing: false,    // shots grow bigger and stronger as they fly
  zigzag: 0,         // sharp zigzag, radians either side
  spiral: false,     // shots curl outward in a spiral
  stun: null,        // { chance, ms }: freeze the enemy hit
  leechEvery: 0,     // heal half a heart every N hits
  ricochet: 0,       // times a shot bounces on to another enemy
  mineEvery: 0,      // every Nth shot also drops a burr mine
  lurk: false,       // shots pause, then dart at the nearest enemy
  bigEvery: 0,       // every Nth shot is huge
  burst: 1,          // seeds fired one after another per shot
  killBlast: null,   // { radius, damage }: killed enemies explode
};

const START_INVENTORY = { coins: 0, bombs: 1, keys: 1 };
const MAX_COUNT = 99;

const FIRE_DIRS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const HITBOX = { w: 20, h: 20 };
const FOOT_OFFSET = HITBOX.h / 2 + 2; // from hitbox centre down to the sprite's feet
const ACCEL = 14;                     // how fast velocity eases toward the input (per second)
const INVULN_MS = 2000;               // invincible for 2 seconds after a hit
const HURT_FACE_MS = 200;
const WILT_AT_HP = 2;                 // leaf droops at one heart or less
const KNOCKBACK_SPEED = 280;

// Physics uses an invisible hitbox; the sprite just follows it, so squash and
// stretch never changes the collision size.
export class Player {
  // `character` is an entry from data/characters.json. Its texture key (e.g. 'mangkok') has
  // variants _hurt, _wilt and _bare; its modifiers adjust the base stats like an item would.
  constructor(scene, x, y, character) {
    this.scene = scene;
    this.character = character;
    this.skin = character.texture;
    this.items = [];
    this.stats = computeStats(BASE_STATS, [character, ...this.items]);
    this.hp = this.stats.maxHp;
    this.inventory = { ...START_INVENTORY };
    this.alive = true;
    this.speedMultiplier = 1; // set each frame by slowing hazards
    this.nextFireAt = 0;
    this.invulnUntil = 0;
    this.hurtUntil = 0;
    this.recoil = 0;
    this.moving = false;
    this.facing = FIRE_DIRS.DOWN; // last shooting direction (the Burger Beam follows it)
    this.beamUntil = 0;           // no seeds while the beam is firing

    this.hitbox = scene.add.zone(x, y, HITBOX.w, HITBOX.h);
    scene.physics.add.existing(this.hitbox);
    this.hitbox.owner = this;

    this.shadow = scene.add.image(x, y, 'shadow').setAlpha(0.3).setDepth(DEPTH.shadow);
    this.sprite = scene.add.image(x, y, this.skin).setOrigin(0.5, 1);
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,E,UP,DOWN,LEFT,RIGHT');

    this.syncVisuals(0);
  }

  get feet() {
    return { x: this.hitbox.x, y: this.hitbox.y + FOOT_OFFSET };
  }

  update(time, delta) {
    if (!this.alive) return;
    this.move(delta);
    this.tryFire(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.scene.placeBomb();
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
    if (held) this.facing = FIRE_DIRS[held];
    if (!held || time < this.nextFireAt || time < this.beamUntil) return;

    const dir = FIRE_DIRS[held];
    this.nextFireAt = time + this.stats.fireDelay;
    this.recoil = 1;
    this.scene.firePlayerShot(this.hitbox.x + dir.x * 12, this.hitbox.y - 2 + dir.y * 12, dir, this.stats);
    this.scene.onShotFired();
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
      hop = Math.round(Math.max(0, -phase) * 2) * 2;
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

    const base = this.hp <= WILT_AT_HP ? `${this.skin}_wilt` : this.skin;
    this.sprite.setTexture(time < this.hurtUntil ? `${base}_hurt` : base);

    // Blink while invulnerable.
    this.sprite.setVisible(time >= this.invulnUntil || Math.floor(time / 80) % 2 === 0);

    this.syncVisuals(hop);
  }

  syncVisuals(hop) {
    const { x, y } = this.feet;
    this.sprite.setPosition(x, y - hop).setDepth(DEPTH.actors + y);
    this.shadow.setPosition(x, y - 2);
  }

  // ---------- Items and inventory ----------

  addItem(item) {
    this.items.push(item);
    this.stats = computeStats(BASE_STATS, [this.character, ...this.items]);
    const bonus = item.onPickup ?? {};
    if (bonus.heal) this.hp += bonus.heal;
    if (bonus.healFull) this.hp = this.stats.maxHp;
    for (const kind of ['coins', 'bombs', 'keys']) if (bonus[kind]) this.addToInventory(kind, bonus[kind]);
    this.hp = Math.min(this.hp, this.stats.maxHp);
    this.emitHp();
  }

  // kind is 'coins', 'bombs' or 'keys'; amount may be negative.
  addToInventory(kind, amount) {
    this.inventory[kind] = Phaser.Math.Clamp(this.inventory[kind] + amount, 0, MAX_COUNT);
    this.scene.events.emit('inventory', this.inventory);
  }

  // ---------- Health ----------

  emitHp() {
    this.scene.events.emit('hp', this.hp, this.stats.maxHp);
  }

  heal(amount) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    this.emitHp();
  }

  // Returns true if the hit landed (not blocked by invulnerability).
  takeDamage(amount, time) {
    if (!this.alive || time < this.invulnUntil) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = time + INVULN_MS + this.stats.invulnBonus;
    this.hurtUntil = time + HURT_FACE_MS;
    flashWhite(this.scene, this.sprite, 80);
    this.emitHp();
    if (this.hp === 0) this.die();
    return true;
  }

  // ---------- Movement helpers ----------

  // Teleport (used when entering a room) and stop moving.
  placeAt(x, y) {
    this.hitbox.body.reset(x, y);
    this.syncVisuals(0);
  }

  stop() {
    this.hitbox.body.setVelocity(0, 0);
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
    this.sprite.setVisible(true).setTexture(`${this.skin}_bare`).setScale(1);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1.5, scaleY: 0.3, duration: 600, ease: 'Quad.easeIn' });

    const leaf = this.scene.add.image(this.sprite.x, this.sprite.y - 30, 'leaf').setDepth(DEPTH.overlay - 1);
    this.scene.tweens.add({
      targets: leaf,
      x: leaf.x + 24,
      y: this.sprite.y - 4,
      angle: 160,
      duration: 900,
      ease: 'Sine.easeInOut',
    });
  }
}
