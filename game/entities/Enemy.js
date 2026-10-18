import { DEPTH, FLOOR } from '../constants.js';
import { flashWhite } from '../systems/Fx.js';

const DEG = Math.PI / 180;

const angleTo = (enemy, target) => Math.atan2(target.hitbox.y - enemy.y, target.hitbox.x - enemy.x);

// True when the enemy's hitbox is pressed against a wall.
function againstWall(enemy) {
  const { x, y } = enemy;
  const { w, h } = enemy.def.hitbox;
  return x - w / 2 <= FLOOR.left + 1 || x + w / 2 >= FLOOR.right - 1 || y - h / 2 <= FLOOR.top + 1 || y + h / 2 >= FLOOR.bottom - 1;
}

// Movement and attack patterns, referenced by name from data/enemies.json.
// Each runs every frame with (enemy, player, time); per-enemy state lives in enemy.ai,
// tuning numbers in enemy.def.params.
const BEHAVIOURS = {
  // Crawls toward the player, finding a way around obstacles.
  chase(e) {
    e.hitbox.body.velocity.setToPolar(e.scene.chaseAngle(e), e.speed);
  },

  // Stays put and puffs a ring of bullets.
  ring_shooter(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.nextAt ??= time + e.scene.rng.range(600, p.interval);
    if (time < ai.nextAt) return;
    ai.nextAt = time + p.interval;
    ai.offset = (ai.offset ?? 0) + Math.PI / p.bullets; // alternate the gaps
    e.squish();
    e.scene.fireRing(e.x, e.y - 4 * e.size, p.bullets, p.bulletSpeed, p.bullet, ai.offset);
  },

  // Wanders, wiggles as a warning, then charges in a straight line until it hits a wall.
  charger(e, player, time, delta) {
    const p = e.def.params;
    const ai = e.ai;
    const body = e.hitbox.body;
    ai.state ??= 'wander';
    ai.until ??= time + p.wanderMs;

    // Moved much less than its speed allows since last frame: something is in the way.
    const moved = Math.hypot(e.x - (ai.lastX ?? e.x), e.y - (ai.lastY ?? e.y));
    const expected = ((ai.lastSpeed ?? 0) * delta) / 1000;
    const stuck = expected > 0.2 && moved < expected * 0.3;
    ai.lastX = e.x;
    ai.lastY = e.y;
    ai.lastSpeed = 0;

    if (ai.state === 'wander') {
      if (!ai.dir || time >= ai.turnAt || stuck) {
        const a = e.scene.rng.range(0, Math.PI * 2);
        ai.dir = { x: Math.cos(a), y: Math.sin(a) };
        ai.turnAt = time + 600;
      }
      body.velocity.set(ai.dir.x * e.speed, ai.dir.y * e.speed);
      ai.lastSpeed = e.speed;
      if (time >= ai.until) Object.assign(ai, { state: 'windup', until: time + p.windupMs });
    } else if (ai.state === 'windup') {
      e.stop();
      e.shakeUntil = ai.until;
      if (time >= ai.until) {
        const a = angleTo(e, player);
        Object.assign(ai, { state: 'charge', until: time + p.maxChargeMs, started: time, charge: { x: Math.cos(a), y: Math.sin(a) } });
      }
    } else if (ai.state === 'charge') {
      const speed = p.chargeSpeed * (e.slow ? e.slow.multiplier : 1);
      body.velocity.set(ai.charge.x * speed, ai.charge.y * speed);
      ai.lastSpeed = speed;
      if ((time - ai.started > 120 && (againstWall(e) || stuck)) || time >= ai.until) {
        e.stop();
        Object.assign(ai, { state: 'stunned', until: time + p.stunMs });
      }
    } else if (ai.state === 'stunned') {
      e.stop();
      if (time >= ai.until) Object.assign(ai, { state: 'wander', until: time + p.wanderMs, dir: null });
    }
  },

  // Opens its bud as a warning, then fires a small aimed spread.
  aimed_shooter(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.nextAt ??= time + e.scene.rng.range(800, p.interval);
    if (ai.fireAt && time >= ai.fireAt) {
      e.scene.fireSpread(e.x, e.y - 8, angleTo(e, player), p.bullets, p.spreadDeg, p.bulletSpeed, p.bullet);
      ai.fireAt = null;
      ai.closeAt = time + 300;
    }
    if (ai.closeAt && time >= ai.closeAt) {
      e.sprite.setTexture(e.def.texture);
      ai.closeAt = null;
    }
    if (time >= ai.nextAt) {
      ai.nextAt = time + p.interval;
      ai.fireAt = time + p.windupMs;
      if (e.def.openTexture) e.sprite.setTexture(e.def.openTexture);
    }
  },

  // Stands still, fires a spread, fades out in sparkles and reappears somewhere else.
  // Can't be hit while it's away.
  teleporter(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.phase ??= 'shown';
    ai.until ??= time + p.shownMs;
    if (time < ai.until) return;

    if (ai.phase === 'shown') {
      e.scene.fireSpread(e.x, e.y - 6 * e.size, angleTo(e, player), p.bullets, p.spreadDeg, p.bulletSpeed, p.bullet);
      ai.cycle = (ai.cycle ?? 0) + 1;
      if (p.ringEvery && ai.cycle % p.ringEvery === 0) e.scene.fireRing(e.x, e.y, p.ringBullets, p.bulletSpeed * 0.8, p.bullet, 0);
      e.scene.tweens.add({ targets: e.sprite, alpha: 0, delay: 350, duration: p.fadeMs });
      Object.assign(ai, { phase: 'leaving', until: time + 350 + p.fadeMs });
    } else if (ai.phase === 'leaving') {
      e.scene.burst(e.x, e.y - 6, 'hex_spark', 8, { distance: 10 });
      e.hitbox.body.enable = false;
      const spot = e.scene.findTeleportSpot();
      e.hitbox.body.reset(spot.x, spot.y);
      e.syncVisuals();
      e.scene.burst(spot.x, spot.y - 6, 'hex_spark', 8, { distance: 10 });
      e.scene.tweens.add({ targets: e.sprite, alpha: 1, duration: p.fadeMs });
      Object.assign(ai, { phase: 'arriving', until: time + p.fadeMs });
    } else if (ai.phase === 'arriving') {
      e.hitbox.body.enable = true;
      Object.assign(ai, { phase: 'shown', until: time + p.shownMs });
    }
  },

  // Boss: rings of spores, hops at the player, spirals when below half health.
  boss_shroom(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.nextAt ??= time + 1000;
    ai.step ??= 0;

    if (ai.hopUntil) {
      if (time < ai.hopUntil) return;
      ai.hopUntil = null;
      e.stop();
      e.squish();
      e.scene.fireRing(e.x, e.y, 8, p.bulletSpeed * 1.2, 'spore', 0);
      e.scene.cameras.main.shake(120, 0.008);
    }
    e.stop();
    if (time < ai.nextAt) return;
    ai.nextAt = time + p.interval;
    ai.step += 1;

    const move = ai.step % 3;
    if (move === 0) {
      e.hitbox.body.velocity.setToPolar(angleTo(e, player), p.hopSpeed);
      ai.hopUntil = time + p.hopMs;
    } else if (move === 1) {
      e.squish();
      e.scene.fireRing(e.x, e.y - 8, p.ringBullets, p.bulletSpeed, 'spore', ai.step * 0.3);
    } else if (e.hp < e.maxHp / 2) {
      e.scene.fireSpiral(e.x, e.y - 8, 24, p.bulletSpeed, 'spore', 1000);
    } else {
      e.scene.fireSpread(e.x, e.y - 8, angleTo(e, player), 5, 16, p.bulletSpeed * 1.2, 'spore');
    }
  },

  // Final boss. Rooted in place; three phases by health. Glows for a moment before every attack.
  weed_queen(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    const scene = e.scene;
    const ratio = e.hp / e.maxHp;
    const phase = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
    if (phase !== ai.phase) {
      ai.phase = phase;
      if (phase > 0) {
        scene.banner(phase === 1 ? 'Her buds open!' : 'She is furious!', 0xb57bff);
        e.sprite.setTint(phase === 1 ? 0xe0c8ff : 0xffb3d0);
      }
    }
    ai.nextAt ??= time + 1200;

    if (ai.attack && time >= ai.attackAt) {
      const attack = ai.attack;
      ai.attack = null;
      const faster = phase === 2;
      if (attack === 'sweep') scene.fireSweep(e.x, e.y + 4, 15 * DEG, 165 * DEG, faster ? 16 : 12, faster ? 95 : 70, 'thorn', 600);
      if (attack === 'ring') scene.fireRing(e.x, e.y, 14, 50, 'spore', scene.rng.range(0, Math.PI));
      if (attack === 'spiral') scene.fireSpiral(e.x, e.y, 36, 60, 'spore', 1500);
      if (attack === 'roots') {
        scene.rootStrike(player.hitbox.x, player.hitbox.y);
        if (faster) scene.rootStrike(scene.rng.range(FLOOR.left + 20, FLOOR.right - 20), scene.rng.range(FLOOR.top + 50, FLOOR.bottom - 10));
      }
      if (attack === 'summon') {
        scene.spawnEnemyAt('gloom_slug', e.x - 30, e.y + 24);
        scene.spawnEnemyAt('gloom_slug', e.x + 30, e.y + 24);
      }
      ai.nextAt = time + p.cooldownMs[phase];
    }

    if (!ai.attack && time >= ai.nextAt) {
      const attacks = [['sweep', 'ring'], ['summon', 'roots', 'ring', 'roots'], ['spiral', 'sweep', 'roots']][phase];
      ai.turn = (ai.turn ?? -1) + 1;
      ai.attack = attacks[ai.turn % attacks.length];
      ai.attackAt = time + p.windupMs;
      e.windup(p.windupMs);
    }
  },
};

const SPAWN_MS = 500;
const KNOCKBACK_MS = 100;
const KNOCKBACK_SPEED = 70;
const ANIM_FRAME_MS = 250;
const FLASH_MS = 60;
const BURN_TINT = 0xff8a3d;
const SLOW_TINT = 0xa8e0ff;
const WINDUP_TINT = 0xd9b8ff;

// States: spawning -> active -> dead (or frozen when the run ends).
export class Enemy {
  constructor(scene, def, x, y, hpScale = 1) {
    if (!BEHAVIOURS[def.behaviour]) throw new Error(`Unknown enemy behaviour "${def.behaviour}"`);
    this.scene = scene;
    this.def = def;
    this.maxHp = def.boss ? def.hp : def.hp * hpScale;
    this.hp = this.maxHp;
    this.state = 'spawning';
    this.destroyed = false;
    this.ai = {};
    this.knockbackUntil = 0;
    this.nextTrailAt = 0;
    this.flashUntil = 0;
    this.windupUntil = 0;
    this.shakeUntil = 0;
    this.burn = null; // { ticksLeft, damage, interval, nextAt }
    this.slow = null; // { multiplier, until }
    this.animOffset = scene.fxRng.range(0, ANIM_FRAME_MS * 2);
    this.footOffset = def.hitbox.h / 2 + 1;
    this.size = def.scale ?? 1;
    this.squashAmount = def.squash ?? 0.1;

    this.hitbox = scene.add.zone(x, y, def.hitbox.w, def.hitbox.h);
    scene.enemyBodies.add(this.hitbox);
    this.hitbox.owner = this;
    this.hitbox.body.enable = false;
    if (def.stationary) this.hitbox.body.setImmovable(true);

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
      if (def.boss) scene.onBossHp(this);
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
    if (this.def.stationary) this.stop();
    if (time >= this.knockbackUntil) BEHAVIOURS[this.def.behaviour](this, player, time, delta);
    else this.ai.lastSpeed = 0; // knocked back: not trying to move by itself
    if (this.state !== 'active') return;
    if (Math.abs(body.velocity.x) > 1) this.sprite.setFlipX(body.velocity.x < 0);

    if (this.def.trail && time >= this.nextTrailAt) {
      this.scene.dropSlime(this.x, this.y + this.footOffset - 1, this.def.trail);
      this.nextTrailAt = time + this.def.trail.interval;
    }

    // 2-frame squash-and-stretch idle/move animation, unless a squish tween is playing.
    if (!this.squishing) {
      const stretched = Math.floor((time + this.animOffset) / ANIM_FRAME_MS) % 2 === 1;
      const s = this.squashAmount;
      this.sprite.setScale(this.size * (stretched ? 1 + s : 1), this.size * (stretched ? 1 - s : 1));
    }
    this.syncVisuals(time < this.shakeUntil ? (Math.floor(time / 40) % 2 ? 1 : -1) : 0);
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
    else if (time < this.windupUntil) this.sprite.setTint(WINDUP_TINT);
    else if (this.burn) this.sprite.setTint(BURN_TINT);
    else if (this.slow) this.sprite.setTint(SLOW_TINT);
    else if (this.def.behaviour !== 'weed_queen' || this.ai.phase === 0) this.sprite.clearTint();
    else this.sprite.setTint(this.ai.phase === 1 ? 0xe0c8ff : 0xffb3d0);
  }

  syncVisuals(shakeX = 0) {
    const feetY = this.y + this.footOffset;
    this.sprite.setPosition(this.x + shakeX, feetY).setDepth(DEPTH.actors + feetY);
    this.shadow.setPosition(this.x, feetY - 1);
  }

  // ---------- Helpers used by behaviours ----------

  stop() {
    this.hitbox.body.setVelocity(0, 0);
  }

  // Quick squash used when attacking.
  squish() {
    this.squishing = true;
    this.sprite.setScale(this.size * 1.2, this.size * 0.75);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.size,
      scaleY: this.size,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => (this.squishing = false),
    });
  }

  // Glow before an attack so the player can react.
  windup(ms) {
    this.windupUntil = this.scene.time.now + ms;
  }

  // ---------- Damage ----------

  // A hit from a shot or bomb. `effects` may carry burn and slow from the player's items.
  hit(damage, dir, time, effects = {}) {
    if (this.state !== 'active' || !this.hitbox.body.enable) return;
    this.flashUntil = time + FLASH_MS;
    this.sprite.setTintFill(0xffffff);
    if (!this.def.stationary && !this.def.boss) {
      this.knockbackUntil = time + KNOCKBACK_MS;
      this.hitbox.body.velocity.set(dir.x * KNOCKBACK_SPEED, dir.y * KNOCKBACK_SPEED);
    }
    if (effects.burn) this.burn = { ...effects.burn, ticksLeft: effects.burn.ticks, nextAt: time + effects.burn.interval };
    if (effects.slow) this.slow = { multiplier: effects.slow.multiplier, until: time + effects.slow.ms };
    this.scene.playSfx('enemyHit');
    this.damage(damage);
  }

  damage(amount) {
    this.hp -= amount;
    if (this.def.boss) this.scene.onBossHp(this);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.burn = null;
    this.stop();
    this.hitbox.body.enable = false;
    flashWhite(this.scene, this.sprite);
    const s = this.size;
    if (this.def.deathParticle) this.scene.burst(this.x, this.y - 4 * s, this.def.deathParticle, Math.round(6 * s), { distance: 10 * s });
    if (this.def.trail) this.scene.dropSlime(this.x, this.y + this.footOffset - 1, this.def.trail);
    this.scene.onEnemyKilled(this);

    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 450 });
    this.scene.tweens.add({ targets: this.sprite, ...DEATHS[this.def.death ?? 'melt'](this), onComplete: () => this.destroy() });
  }

  freeze() {
    if (this.state === 'dead') return;
    this.state = 'frozen';
    this.stop();
  }

  destroy() {
    if (this.destroyed) return;
    this.sprite.destroy();
    this.shadow.destroy();
    this.hitbox.destroy();
    this.destroyed = true;
  }
}

// Death animations (tween settings for the sprite).
const DEATHS = {
  // Melts into a puddle.
  melt: (e) => ({ scaleX: 1.5 * e.size, scaleY: 0.15 * e.size, alpha: 0, duration: 450, ease: 'Quad.easeIn' }),
  // Cap pops off and rolls away.
  pop: (e) => ({ x: e.sprite.x + 12 * e.size, y: e.sprite.y - 4, angle: 200, alpha: 0, duration: 550, ease: 'Quad.easeOut' }),
  // Flips onto its back, legs wiggling.
  flip: (e) => {
    e.sprite.setFlipY(true).setOrigin(0.5, 0.5).setY(e.sprite.y - 8);
    return { angle: { from: -8, to: 8 }, alpha: 0, duration: 700, ease: 'Sine.easeInOut' };
  },
  // Withers and shrinks into the ground.
  wither: (e) => ({ scaleY: 0, scaleX: 0.6 * e.size, duration: 500, ease: 'Quad.easeIn' }),
  // Shatters into ceramic pieces.
  shatter: () => ({ alpha: 0, duration: 120 }),
  // The Weed Queen wilts.
  wilt: (e) => ({ scaleY: 0.3 * e.size, scaleX: 1.2 * e.size, alpha: 0, duration: 1200, ease: 'Quad.easeIn' }),
};
