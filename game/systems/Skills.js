import { FLOOR, DEPTH } from '../constants.js';
import { Audio } from './Audio.js';
import { tileOf } from './Pathing.js';

// Character skills. Every `skill.every` shots the character's skill casts by itself
// for `skill.durationMs`: Burger Beam (Mangkok) or Spawn Chinggu (Lilo).
// The HUD meter listens to the 'skill' event.

const BEAM = {
  width: 6,
  tickMs: 100,         // damage is dealt in ticks
  damagePerTick: 0.6,  // times the player's damage stat
  moveSlow: 0.6,       // Mangkok moves slower while beaming
  ticksToBreak: 2,     // obstacles in the way break after this many ticks (0.2 s)
};

const CAT = {
  speed: 95,
  reach: 6,             // extra px beyond touching the target
  scratchMs: 450,       // time between scratches
  damage: 1.5,          // times the player's damage stat
  followDistance: 18,   // with no enemies she trots after Lilo and sits this close
  footOffset: 4,
};

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
    this.scene.shout(`${this.skill.name}!`, this.skill.id === 'burger_beam' ? 0xffd23f : 0xe8903c);
    if (this.skill.id === 'burger_beam') this.startBeam(until);
    if (this.skill.id === 'chinggu') this.startCat(until);
  }

  update(time) {
    if (!this.active) return;
    if (time >= this.active.until || !this.player.alive) {
      this.stop();
      return;
    }
    if (this.active.kind === 'beam') this.updateBeam(time);
    if (this.active.kind === 'cat') this.updateCat(time);
    this.emit();
  }

  // Ends whatever is running (also called when leaving a room or dying).
  stop() {
    if (!this.active) return;
    if (this.active.kind === 'cat') this.scene.burst(this.active.zone.x, this.active.zone.y, 'smoke', 6, { distance: 8 });
    (this.active.colliders ?? []).forEach((collider) => this.scene.physics.world.removeCollider(collider));
    this.active.objects.forEach((obj) => obj.destroy());
    this.player.beamUntil = 0;
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

  // A straight beam in the facing direction. It reaches the wall, or the first obstacle
  // in its way (`blockedBy`, "col,row"), which it then burns through.
  beamRect() {
    const { x: px, y: py } = this.player.hitbox;
    const dir = this.player.facing;
    const startX = px + dir.x * 6;
    const startY = py - 2 + dir.y * 6;
    let length = 0;
    let blockedBy = null;
    const blocked = this.scene.view.blocked;
    while (length < 260) {
      const x = startX + dir.x * (length + 2);
      const y = startY + dir.y * (length + 2);
      if (x < FLOOR.left || x > FLOOR.right || y < FLOOR.top || y > FLOOR.bottom) break;
      const t = tileOf(x, y);
      if (blocked.has(`${t.col},${t.row}`)) {
        blockedBy = `${t.col},${t.row}`;
        break;
      }
      length += 2;
    }
    const half = BEAM.width / 2;
    if (dir.x !== 0) {
      const x0 = dir.x > 0 ? startX : startX - length;
      return { x: x0, y: startY - half, w: length, h: BEAM.width, endX: startX + dir.x * length, endY: startY, blockedBy };
    }
    const y0 = dir.y > 0 ? startY : startY - length;
    return { x: startX - half, y: y0, w: BEAM.width, h: length, endX: startX, endY: startY + dir.y * length, blockedBy };
  }

  // Each tick on the same obstacle cracks it a little; it breaks after a few.
  burnObstacle(key) {
    const obstacle = this.scene.view.obstacles.find((o) => `${o.data.col},${o.data.row}` === key);
    if (!obstacle) return;
    obstacle.beamTicks = (obstacle.beamTicks ?? 0) + 1;
    if (obstacle.beamTicks >= BEAM.ticksToBreak) {
      this.scene.breakObstacle(obstacle);
      return;
    }
    obstacle.image.setTintFill(0xffd23f);
    this.scene.time.delayedCall(50, () => obstacle.image.active && obstacle.image.clearTint());
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
    if (beam.blockedBy) this.burnObstacle(beam.blockedBy);

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

  // ---------- Spawn Chinggu (Lilo) ----------

  // Chinggu, a calico cat, appears next to Lilo. Enemies ignore her and she can't be hurt.
  startCat(until) {
    const scene = this.scene;
    const { x: px, y: py } = this.player.hitbox;
    const spot = scene.freeSpot(Phaser.Math.Clamp(px + 14, FLOOR.left + 8, FLOOR.right - 8), py, 5);

    const zone = scene.add.zone(spot.x, spot.y, 8, 6);
    scene.physics.add.existing(zone);
    const shadow = scene.add.image(spot.x, spot.y, 'shadow').setAlpha(0.3).setDepth(DEPTH.shadow);
    const sprite = scene.add.image(spot.x, spot.y, 'chinggu').setOrigin(0.5, 1);
    const colliders = [
      scene.physics.add.collider(zone, scene.view.solidWalls),
      scene.physics.add.collider(zone, scene.view.obstacleBodies),
    ];
    this.active = { kind: 'cat', until, zone, sprite, shadow, colliders, nextScratchAt: 0, objects: [sprite, shadow, zone] };

    scene.burst(spot.x, spot.y - 6, 'spark', 8, { distance: 12 });
    scene.burst(spot.x, spot.y - 4, 'smoke', 6, { distance: 10 });
    Audio.play('meow');
    this.updateCat(scene.time.now);
  }

  // Run to the nearest enemy and scratch it; with none left, follow Lilo.
  updateCat(time) {
    const scene = this.scene;
    const cat = this.active;
    const { zone, sprite, shadow } = cat;
    const body = zone.body;
    const distance = Phaser.Math.Distance.Between;

    let target = null;
    let best = Infinity;
    for (const enemy of scene.enemies) {
      if (enemy.state !== 'active' || !enemy.hitbox.body.enable) continue;
      const d = distance(zone.x, zone.y, enemy.x, enemy.y);
      if (d < best) {
        best = d;
        target = enemy;
      }
    }

    let moving = false;
    if (target) {
      const reach = target.def.hitbox.w / 2 + CAT.reach;
      if (best > reach) {
        body.velocity.setToPolar(scene.pathAngle(zone.x, zone.y, target.x, target.y, 4), CAT.speed);
        moving = true;
      } else {
        body.setVelocity(0, 0);
        if (time >= cat.nextScratchAt) this.scratch(target, time);
      }
      sprite.setFlipX(target.x < zone.x);
    } else {
      const lilo = this.player.hitbox;
      if (distance(zone.x, zone.y, lilo.x, lilo.y) > CAT.followDistance) {
        body.velocity.setToPolar(scene.pathAngle(zone.x, zone.y, lilo.x, lilo.y, 4), CAT.speed * 0.8);
        moving = true;
      } else {
        body.setVelocity(0, 0);
      }
      if (Math.abs(body.velocity.x) > 1) sprite.setFlipX(body.velocity.x < 0);
    }

    // Little hops while running; blinks in the last second before she leaves.
    const hop = moving ? Math.round(Math.abs(Math.sin(time * 0.025)) * 2) : 0;
    const feetY = zone.y + CAT.footOffset;
    sprite.setPosition(zone.x, feetY - hop).setDepth(DEPTH.actors + feetY);
    sprite.setVisible(cat.until - time > 1000 || Math.floor(time / 100) % 2 === 0);
    shadow.setPosition(zone.x, feetY - 1);
  }

  scratch(target, time) {
    const scene = this.scene;
    const cat = this.active;
    cat.nextScratchAt = time + CAT.scratchMs;
    const angle = Math.atan2(target.y - cat.zone.y, target.x - cat.zone.x);
    target.hit(this.player.stats.damage * CAT.damage, { x: Math.cos(angle), y: Math.sin(angle) }, time);
    Audio.play('scratch');

    // Pounce squish and claw marks on the target.
    cat.sprite.setScale(1.25, 0.8);
    scene.tweens.add({ targets: cat.sprite, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.easeOut' });
    const marks = scene.add.image(target.x, target.y - 6, 'scratch').setFlipX(target.x < cat.zone.x).setDepth(DEPTH.ui - 1);
    scene.tweens.add({ targets: marks, alpha: 0, duration: 250, delay: 80, onComplete: () => marks.destroy() });
  }
}
