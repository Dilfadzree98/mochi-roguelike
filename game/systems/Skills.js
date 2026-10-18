import { FLOOR, DEPTH } from '../constants.js';
import { Audio } from './Audio.js';
import { tileOf } from './Pathing.js';

// Character skills. Every `skill.every` shots the character's skill casts by itself
// for `skill.durationMs`. The HUD meter listens to the 'skill' event.

const BEAM = {
  width: 6,
  tickMs: 100,         // damage is dealt in ticks
  damagePerTick: 0.6,  // times the player's damage stat
  moveSlow: 0.6,       // Mangkok moves slower while beaming
};

const SHIELD = { petals: 6, radius: 13, spin: 0.006 };

export class Skills {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.skill = player.character.skill;
    this.shots = 0;
    this.active = null; // { until, ... } while a skill is running
  }

  // Called for every shot Mochi fires (one press, however many seeds).
  onShotFired() {
    if (this.active) return;
    this.shots += 1;
    if (this.shots >= this.skill.every) {
      this.shots = 0;
      this.cast();
    }
    this.emit();
  }

  emit() {
    const now = this.scene.time.now;
    const progress = this.active ? (this.active.until - now) / this.skill.durationMs : this.shots / this.skill.every;
    this.scene.events.emit('skill', { progress: Math.max(0, progress), active: !!this.active, icon: this.skill.icon });
  }

  cast() {
    const now = this.scene.time.now;
    const until = now + this.skill.durationMs;
    this.scene.shout(`${this.skill.name}!`, this.skill.id === 'burger_beam' ? 0xffd23f : 0xffb3d1);
    if (this.skill.id === 'burger_beam') this.startBeam(until);
    if (this.skill.id === 'petal_shield') this.startShield(until);
  }

  update(time) {
    if (!this.active) return;
    if (time >= this.active.until || !this.player.alive) {
      this.stop();
      return;
    }
    if (this.active.kind === 'beam') this.updateBeam(time);
    if (this.active.kind === 'shield') this.updateShield(time);
    this.emit();
  }

  // Ends whatever is running (also called when leaving a room or dying).
  stop() {
    if (!this.active) return;
    this.active.objects.forEach((obj) => obj.destroy());
    this.player.beamUntil = 0;
    this.player.shieldUntil = 0;
    this.active = null;
    this.emit();
  }

  // ---------- Burger Beam (Mangkok) ----------

  startBeam(until) {
    const graphics = this.scene.add.graphics();
    this.active = { kind: 'beam', until, nextTickAt: 0, objects: [graphics], graphics };
    this.player.beamUntil = until;
    Audio.play('beam');
  }

  // A straight beam in the facing direction, stopped by walls and obstacles.
  beamRect() {
    const { x: px, y: py } = this.player.hitbox;
    const dir = this.player.facing;
    const startX = px + dir.x * 6;
    const startY = py - 2 + dir.y * 6;
    let length = 0;
    const blocked = this.scene.view.blocked;
    while (length < 260) {
      const x = startX + dir.x * (length + 2);
      const y = startY + dir.y * (length + 2);
      if (x < FLOOR.left || x > FLOOR.right || y < FLOOR.top || y > FLOOR.bottom) break;
      const t = tileOf(x, y);
      if (blocked.has(`${t.col},${t.row}`)) break;
      length += 2;
    }
    const half = BEAM.width / 2;
    if (dir.x !== 0) {
      const x0 = dir.x > 0 ? startX : startX - length;
      return { x: x0, y: startY - half, w: length, h: BEAM.width, endX: startX + dir.x * length, endY: startY };
    }
    const y0 = dir.y > 0 ? startY : startY - length;
    return { x: startX - half, y: y0, w: BEAM.width, h: length, endX: startX, endY: startY + dir.y * length };
  }

  updateBeam(time) {
    const scene = this.scene;
    const beam = this.beamRect();
    this.player.speedMultiplier *= BEAM.moveSlow;

    // Ketchup edge (flickering), mustard middle, pale hot core.
    const g = this.active.graphics.clear().setDepth(DEPTH.actors + this.player.hitbox.y + 1);
    const horizontal = this.player.facing.x !== 0;
    const layer = (inset, color) => {
      g.fillStyle(color, 1);
      if (horizontal) g.fillRect(beam.x, beam.y + inset, beam.w, beam.h - inset * 2);
      else g.fillRect(beam.x + inset, beam.y, beam.w - inset * 2, beam.h);
    };
    layer(-(Math.floor(time / 50) % 2), 0xd94a2a);
    layer(1, 0xffd23f);
    layer(2, 0xfff4b8);

    if (time < this.active.nextTickAt) return;
    this.active.nextTickAt = time + BEAM.tickMs;
    scene.burst(beam.endX, beam.endY, 'crumb', 3, { distance: 8, duration: 250 });

    const overlaps = (x, y, w, h) => x < beam.x + beam.w && x + w > beam.x && y < beam.y + beam.h && y + h > beam.y;
    const damage = this.player.stats.damage * BEAM.damagePerTick;
    for (const enemy of scene.enemies) {
      if (enemy.state !== 'active' || !enemy.hitbox.body.enable) continue;
      const { w, h } = enemy.def.hitbox;
      if (overlaps(enemy.x - w / 2, enemy.y - h / 2, w, h)) enemy.hit(damage, this.player.facing, time);
    }
    // The beam burns through enemy bullets too.
    for (const bullet of scene.enemyShots.getChildren().slice()) {
      if (overlaps(bullet.x - 2, bullet.y - 2, 4, 4)) bullet.pop();
    }
  }

  // ---------- Petal Shield (Lilo) ----------

  startShield(until) {
    const scene = this.scene;
    const glow = scene.add.image(0, 0, 'glow_pink');
    const petals = Array.from({ length: SHIELD.petals }, () => scene.add.image(0, 0, 'shield_petal'));
    this.active = { kind: 'shield', until, objects: [glow, ...petals], glow, petals };
    this.player.shieldUntil = until;
    Audio.play('shield');
    this.updateShield(scene.time.now);
  }

  updateShield(time) {
    const { x, y } = this.player.hitbox;
    const cy = y - 3;
    const { glow, petals, until } = this.active;
    // Flicker in the last half second so the player knows it's ending.
    const ending = until - time < 500 && Math.floor(time / 80) % 2 === 0;
    glow.setPosition(x, cy).setDepth(DEPTH.actors + y - 1).setAlpha(ending ? 0.3 : 0.8);
    petals.forEach((petal, i) => {
      const angle = time * SHIELD.spin + (i / petals.length) * Math.PI * 2;
      const px = x + Math.cos(angle) * SHIELD.radius;
      const py = cy + Math.sin(angle) * SHIELD.radius * 0.8;
      petal.setPosition(px, py).setDepth(DEPTH.actors + py + 6).setAlpha(ending ? 0.4 : 1);
    });

    // Bullets that reach the petal ring are knocked away.
    for (const bullet of this.scene.enemyShots.getChildren().slice()) {
      if (Phaser.Math.Distance.Between(bullet.x, bullet.y, x, cy) <= SHIELD.radius + 3) {
        this.scene.burst(bullet.x, bullet.y, 'shield_petal', 2, { distance: 5, duration: 200 });
        bullet.pop();
      }
    }
  }
}
