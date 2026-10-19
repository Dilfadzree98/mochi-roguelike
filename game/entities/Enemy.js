import { DEPTH } from '../constants.js';
import { flashWhite } from '../systems/Fx.js';
import { BOSS_IDLE, BOSS_MOVES, angleTo, bumped } from './BossMoves.js';

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
    e.scene.fireRing(e.x, e.y - 8 * e.size, p.bullets, p.bulletSpeed, p.bullet, ai.offset, p.range);
  },

  // Wanders, wiggles as a warning, then charges in a straight line until it hits something.
  charger(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    const body = e.hitbox.body;
    ai.state ??= 'wander';
    ai.until ??= time + p.wanderMs;

    if (ai.state === 'wander') {
      if (!ai.dir || time >= ai.turnAt || bumped(e, ai.dir.x, ai.dir.y)) {
        const a = e.scene.rng.range(0, Math.PI * 2);
        ai.dir = { x: Math.cos(a), y: Math.sin(a) };
        ai.turnAt = time + 600;
      }
      body.velocity.set(ai.dir.x * e.speed, ai.dir.y * e.speed);
      if (time >= ai.until) Object.assign(ai, { state: 'windup', until: time + p.windupMs });
    } else if (ai.state === 'windup') {
      e.stop();
      e.shakeUntil = ai.until;
      if (time >= ai.until) {
        const a = e.scene.chaseAngle(e); // straight at Mochi, or around the obstacle Mochi hides behind
        Object.assign(ai, { state: 'charge', until: time + p.maxChargeMs, started: time, charge: { x: Math.cos(a), y: Math.sin(a) } });
      }
    } else if (ai.state === 'charge') {
      const speed = p.chargeSpeed * (e.slow ? e.slow.multiplier : 1);
      body.velocity.set(ai.charge.x * speed, ai.charge.y * speed);
      if ((time - ai.started > 60 && bumped(e, ai.charge.x, ai.charge.y)) || time >= ai.until) {
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
      e.scene.fireSpread(e.x, e.y - 16, angleTo(e, player), p.bullets, p.spreadDeg, p.bulletSpeed, p.bullet, p.range);
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
      e.scene.fireSpread(e.x, e.y - 12 * e.size, angleTo(e, player), p.bullets, p.spreadDeg, p.bulletSpeed, p.bullet, p.range);
      ai.cycle = (ai.cycle ?? 0) + 1;
      if (p.ringEvery && ai.cycle % p.ringEvery === 0) e.scene.fireRing(e.x, e.y, p.ringBullets, p.bulletSpeed * 0.8, p.bullet, 0, p.range);
      e.scene.tweens.add({ targets: e.sprite, alpha: 0, delay: 350, duration: p.fadeMs });
      Object.assign(ai, { phase: 'leaving', until: time + 350 + p.fadeMs });
    } else if (ai.phase === 'leaving') {
      e.scene.burst(e.x, e.y - 12, 'hex_spark', 8, { distance: 20 });
      e.hitbox.body.enable = false;
      const spot = e.scene.findTeleportSpot();
      e.hitbox.body.reset(spot.x, spot.y);
      e.syncVisuals();
      e.scene.burst(spot.x, spot.y - 12, 'hex_spark', 8, { distance: 20 });
      e.scene.tweens.add({ targets: e.sprite, alpha: 1, duration: p.fadeMs });
      Object.assign(ai, { phase: 'arriving', until: time + p.fadeMs });
    } else if (ai.phase === 'arriving') {
      e.hitbox.body.enable = true;
      Object.assign(ai, { phase: 'shown', until: time + p.shownMs });
    }
  },

  // Drifts about slowly, changing direction now and then.
  wander(e, player, time) {
    const ai = e.ai;
    if (!ai.dir || time >= ai.turnAt || bumped(e, ai.dir.x, ai.dir.y)) {
      const a = e.scene.rng.range(0, Math.PI * 2);
      ai.dir = { x: Math.cos(a), y: Math.sin(a) };
      ai.turnAt = time + e.scene.rng.range(800, 1600);
    }
    e.hitbox.body.velocity.set(ai.dir.x * e.speed, ai.dir.y * e.speed);
  },

  // Keeps its distance from Mochi, sidestepping, and stops to fire single fast shots.
  kiter(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    const distance = Phaser.Math.Distance.Between(e.x, e.y, player.hitbox.x, player.hitbox.y);
    const toward = angleTo(e, player);
    ai.side ??= e.scene.rng.chance(0.5) ? 1 : -1;
    if (time >= (ai.sideAt ?? 0)) {
      ai.side = -ai.side;
      ai.sideAt = time + 1400;
    }
    ai.nextAt ??= time + e.scene.rng.range(800, p.interval);
    if (!ai.aimUntil && time >= ai.nextAt) {
      ai.aimUntil = time + p.windupMs;
      e.windup(p.windupMs);
    }
    if (ai.aimUntil) {
      e.stop();
      if (time < ai.aimUntil) return;
      ai.aimUntil = 0;
      ai.nextAt = time + p.interval;
      e.squish();
      e.scene.fireEnemyBullet(e.x, e.y - 8, angleTo(e, player), p.bulletSpeed, p.bullet, p.range);
      return;
    }
    let angle = toward + (ai.side * Math.PI) / 2; // circle around
    if (distance < p.near) angle = toward + Math.PI; // back off
    else if (distance > p.far) angle = e.scene.chaseAngle(e); // close in
    e.hitbox.body.velocity.setToPolar(angle, e.speed);
  },

  // Flies in a wobbly line toward Mochi (over obstacles), dropping a small ring of spores now and then.
  flutter(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    const angle = angleTo(e, player) + Math.sin((time + e.animOffset) / 260) * 1.3;
    e.hitbox.body.velocity.setToPolar(angle, e.speed);
    ai.nextAt ??= time + e.scene.rng.range(800, p.interval);
    if (time < ai.nextAt) return;
    ai.nextAt = time + p.interval;
    e.scene.fireRing(e.x, e.y - 10, p.bullets, p.bulletSpeed, p.bullet, e.scene.rng.range(0, 1), p.range);
  },

  // Tunnels toward Mochi as a moving mound (can't be hit, passes under obstacles), shakes,
  // pops up and fires a ring, then digs back down.
  burrower(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.phase ??= 'under';
    ai.until ??= time + p.underMs;
    if (ai.phase === 'under') {
      ai.underground = true;
      ai.untouchable = true;
      e.sprite.setTexture(e.def.underTexture);
      const distance = Phaser.Math.Distance.Between(e.x, e.y, player.hitbox.x, player.hitbox.y);
      if (distance > 30) e.hitbox.body.velocity.setToPolar(angleTo(e, player), e.speed);
      else e.stop();
      if (time >= ai.until) {
        e.stop();
        Object.assign(ai, { phase: 'rising', until: time + p.windupMs });
        e.shakeUntil = ai.until;
      }
    } else if (ai.phase === 'rising') {
      e.stop();
      if (time < ai.until) return;
      // Surfacing under an obstacle? Come up next to it instead.
      const spot = e.scene.freeSpot(e.x, e.y, 12);
      if (spot.x !== e.x || spot.y !== e.y) e.hitbox.body.reset(spot.x, spot.y);
      ai.underground = false;
      ai.untouchable = false;
      e.sprite.setTexture(e.def.texture);
      e.squish();
      e.scene.burst(e.x, e.y + 8, 'smoke', 6, { distance: 16 });
      e.scene.fireRing(e.x, e.y - 8, p.bullets, p.bulletSpeed, p.bullet, e.scene.rng.range(0, 1), p.range);
      Object.assign(ai, { phase: 'up', until: time + p.upMs });
    } else {
      e.stop();
      if (time >= ai.until) Object.assign(ai, { phase: 'under', until: time + p.underMs });
    }
  },

  // Crouches, then leaps at Mochi. With `landRing`, every landing puffs a ring of bullets.
  hopper(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    const body = e.hitbox.body;
    ai.phase ??= 'rest';
    ai.until ??= time + e.scene.rng.range(300, p.restMs);
    if (ai.phase === 'rest') {
      e.stop();
      if (time >= ai.until) {
        Object.assign(ai, { phase: 'crouch', until: time + p.windupMs });
        e.windup(p.windupMs);
      }
    } else if (ai.phase === 'crouch') {
      e.stop();
      if (time >= ai.until) {
        body.velocity.setToPolar(e.scene.chaseAngle(e), p.leapSpeed * (e.slow ? e.slow.multiplier : 1));
        Object.assign(ai, { phase: 'leap', until: time + p.leapMs });
      }
    } else if (time >= ai.until || bumped(e, body.velocity.x, body.velocity.y)) {
      e.stop();
      e.squish();
      if (p.landRing) e.scene.fireRing(e.x, e.y - 6, p.landRing, p.bulletSpeed, p.bullet, e.scene.rng.range(0, 1), p.range);
      Object.assign(ai, { phase: 'rest', until: time + p.restMs });
    }
  },

  // Crawls after Mochi; every so often pulls into its shell, where shots just bounce off.
  shell(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.until ??= time + p.outMs;
    if (time >= ai.until) {
      ai.armored = !ai.armored;
      ai.until = time + (ai.armored ? p.hideMs : p.outMs);
      e.sprite.setTexture(ai.armored ? e.def.hideTexture : e.def.texture);
      e.squish();
    }
    if (ai.armored) e.stop();
    else e.hitbox.body.velocity.setToPolar(e.scene.chaseAngle(e), e.speed);
  },

  // Circles Mochi at a distance (flying), then darts straight at them.
  dasher(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    const body = e.hitbox.body;
    ai.phase ??= 'hover';
    ai.until ??= time + p.hoverMs;
    ai.orbit ??= e.scene.rng.range(0, Math.PI * 2);
    if (ai.phase === 'hover') {
      const a = ai.orbit + time / 700;
      const tx = player.hitbox.x + Math.cos(a) * p.orbit;
      const ty = player.hitbox.y + Math.sin(a) * p.orbit;
      body.velocity.setToPolar(Math.atan2(ty - e.y, tx - e.x), e.speed);
      if (time >= ai.until) {
        Object.assign(ai, { phase: 'aim', until: time + p.windupMs });
        e.shakeUntil = ai.until;
      }
    } else if (ai.phase === 'aim') {
      e.stop();
      if (time >= ai.until) {
        body.velocity.setToPolar(angleTo(e, player), p.dashSpeed * (e.slow ? e.slow.multiplier : 1));
        Object.assign(ai, { phase: 'dash', until: time + p.dashMs });
      }
    } else if (time >= ai.until || bumped(e, body.velocity.x, body.velocity.y)) {
      e.stop();
      Object.assign(ai, { phase: 'hover', until: time + p.hoverMs });
    }
  },

  // Rooted; sprays a turning stream of bullets from its arms, then rests.
  spinner(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.angle ??= e.scene.rng.range(0, Math.PI * 2);
    ai.nextAt ??= time + e.scene.rng.range(600, p.restMs);
    if (!ai.sprayUntil && time >= ai.nextAt) {
      ai.sprayUntil = time + 300 + p.sprayMs;
      ai.nextShotAt = time + 300;
      e.windup(300);
    }
    if (!ai.sprayUntil) return;
    if (time >= ai.nextShotAt) {
      ai.nextShotAt = time + p.shotMs;
      ai.angle += p.turn;
      for (let k = 0; k < p.arms; k++) e.scene.fireEnemyBullet(e.x, e.y - 20, ai.angle + (k / p.arms) * Math.PI * 2, p.bulletSpeed, p.bullet, p.range);
    }
    if (time >= ai.sprayUntil) {
      ai.sprayUntil = 0;
      ai.nextAt = time + p.restMs;
    }
  },

  // Floats toward Mochi through obstacles, fading in and out. While faded it can't hurt or be hurt.
  wisp(e, player, time) {
    const p = e.def.params;
    const ai = e.ai;
    ai.until ??= time + p.shownMs;
    if (time >= ai.until) {
      ai.untouchable = !ai.untouchable;
      ai.until = time + (ai.untouchable ? p.fadedMs : p.shownMs);
      e.scene.tweens.add({ targets: e.sprite, alpha: ai.untouchable ? 0.25 : 1, duration: 250 });
    }
    e.hitbox.body.velocity.setToPolar(angleTo(e, player), e.speed * (ai.untouchable ? 1.5 : 1));
  },

  // Every boss: idles, then runs one of its three moves (see BossMoves.js).
  // Below half health it becomes enraged: faster moves and shorter rests.
  boss(e, player, time) {
    const ai = e.ai;
    const p = e.def.params ?? {};
    if (!ai.enraged && e.hp < e.maxHp * ENRAGE_AT) {
      ai.enraged = true;
      e.scene.banner(`${e.def.name} is furious!`, 0xb57bff);
    }

    if (ai.move) {
      if (time < ai.waitUntil) return;
      const { value, done } = ai.move.next();
      if (!done) {
        ai.waitUntil = value ? time + value : 0;
        return;
      }
      ai.move = null;
      ai.nextAt = time + (p.cooldownMs ?? 900) * (ai.enraged ? ENRAGED_COOLDOWN : 1);
    }

    BOSS_IDLE[e.def.idle ?? 'still'](e, player, time);
    ai.nextAt ??= time + FIRST_MOVE_MS;
    if (time < ai.nextAt) return;
    const others = e.def.moves.filter((m) => m !== ai.lastMove);
    const choices = others.length > 0 ? others : e.def.moves;
    ai.lastMove = e.scene.rng.pick(choices);
    ai.move = BOSS_MOVES[ai.lastMove](e, player);
    ai.waitUntil = 0;
  },
};

const SPAWN_MS = 500;
const KNOCKBACK_MS = 100;
const KNOCKBACK_SPEED = 140;
const ANIM_FRAME_MS = 250;
const FLASH_MS = 60;
const BURN_TINT = 0xff8a3d;
const SLOW_TINT = 0xa8e0ff;
const POISON_TINT = 0x9bd86a;
const DIZZY_TINT = 0xfff0a0;
const WINDUP_TINT = 0xd9b8ff;
const ENRAGED_TINT = 0xffb3d0;
const ENRAGE_AT = 0.5;          // bosses get angry below half health
const ENRAGED_COOLDOWN = 0.65;  // and rest this much less between moves
const FIRST_MOVE_MS = 1200;
const SHADOW_WIDTH = 24; // the 'shadow' texture, stretched to each enemy's width

// States: spawning -> active -> dead (or frozen when the run ends).
export class Enemy {
  constructor(scene, def, x, y, hpScale = 1) {
    if (!BEHAVIOURS[def.behaviour]) throw new Error(`Unknown enemy behaviour "${def.behaviour}"`);
    this.scene = scene;
    this.def = def;
    this.maxHp = def.hp * hpScale;
    this.hp = this.maxHp;
    this.state = 'spawning';
    this.destroyed = false;
    this.ai = {};
    this.knockbackUntil = 0;
    this.nextTrailAt = 0;
    this.flashUntil = 0;
    this.windupUntil = 0;
    this.shakeUntil = 0;
    this.burn = null;   // { ticksLeft, damage, interval, nextAt }
    this.poison = null; // same shape as burn
    this.slow = null;   // { multiplier, until }
    this.dizzyUntil = 0; // Catnip: wanders around and doesn't attack
    this.animOffset = scene.fxRng.range(0, ANIM_FRAME_MS * 2);
    this.footOffset = def.hitbox.h / 2 + 2;
    this.size = def.scale ?? 1;
    this.squashAmount = def.squash ?? 0.1;

    this.hitbox = scene.add.zone(x, y, def.hitbox.w, def.hitbox.h);
    scene.enemyBodies.add(this.hitbox);
    this.hitbox.owner = this;
    this.hitbox.body.enable = false;
    if (def.stationary) this.hitbox.body.setImmovable(true);

    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setAlpha(0).setScale((def.hitbox.w + 8) / SHADOW_WIDTH);
    this.sprite = scene.add.image(x, y, def.texture).setOrigin(0.5, 1).setAlpha(0).setScale(this.size, 0.2 * this.size);
    this.syncVisuals();

    // Pop up out of the ground; harmless until fully spawned.
    scene.tweens.add({ targets: this.sprite, alpha: 1, scaleY: this.size, duration: SPAWN_MS, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: this.shadow, alpha: 0.3, duration: SPAWN_MS });
    scene.time.delayedCall(SPAWN_MS, () => {
      if (this.destroyed || this.state !== 'spawning') return; // removed while popping up
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

  // Flying enemies (and burrowers while underground) go over/under obstacles.
  get passesObstacles() {
    return !!this.def.flying || !!this.ai.underground;
  }

  // Underground or faded out: shots pass through and touching it doesn't hurt.
  get untouchable() {
    return !!this.ai.untouchable;
  }

  update(time, delta, player) {
    if (this.state !== 'active') return;

    this.updateStatus(time);
    if (this.state !== 'active') return; // burned to death

    const body = this.hitbox.body;
    if (this.def.stationary) this.stop();
    if (time < this.knockbackUntil) {
      // knocked back: not moving by itself
    } else if (time < this.dizzyUntil) {
      this.stumble(time);
    } else {
      BEHAVIOURS[this.def.behaviour](this, player, time, delta);
    }
    if (this.state !== 'active') return;
    if (Math.abs(body.velocity.x) > 1) this.sprite.setFlipX(body.velocity.x < 0);

    if (this.def.trail && time >= this.nextTrailAt) {
      this.scene.dropSlime(this.x, this.y + this.footOffset - 2, this.def.trail);
      this.nextTrailAt = time + this.def.trail.interval;
    }

    // 2-frame squash-and-stretch idle/move animation, unless a squish tween is playing.
    if (!this.squishing) {
      const stretched = Math.floor((time + this.animOffset) / ANIM_FRAME_MS) % 2 === 1;
      const s = this.squashAmount;
      this.sprite.setScale(this.size * (stretched ? 1 + s : 1), this.size * (stretched ? 1 - s : 1));
    }
    this.syncVisuals(time < this.shakeUntil ? (Math.floor(time / 40) % 2 ? 2 : -2) : 0);
  }

  // Dizzy: wander in random directions and don't attack.
  stumble(time) {
    if (this.def.stationary) return;
    if (!this.ai.dizzyDir || time >= this.ai.dizzyTurnAt) {
      const a = this.scene.rng.range(0, Math.PI * 2);
      this.ai.dizzyDir = { x: Math.cos(a), y: Math.sin(a) };
      this.ai.dizzyTurnAt = time + 400;
    }
    this.hitbox.body.velocity.set(this.ai.dizzyDir.x * this.def.speed * 0.6, this.ai.dizzyDir.y * this.def.speed * 0.6);
  }

  // Damage-over-time ticks (burn, poison), slow expiry, and the tint that shows them.
  updateStatus(time) {
    if (this.slow && time >= this.slow.until) this.slow = null;
    for (const kind of ['burn', 'poison']) {
      const dot = this[kind];
      if (!dot || time < dot.nextAt) continue;
      dot.ticksLeft -= 1;
      dot.nextAt = time + dot.interval;
      this.flashUntil = time + FLASH_MS;
      if (dot.ticksLeft <= 0) this[kind] = null;
      this.damage(dot.damage);
      if (this.state !== 'active') return;
    }

    if (time < this.flashUntil) this.sprite.setTintFill(0xffffff);
    else if (time < this.windupUntil) this.sprite.setTint(WINDUP_TINT);
    else if (this.burn) this.sprite.setTint(BURN_TINT);
    else if (this.poison) this.sprite.setTint(POISON_TINT);
    else if (this.slow) this.sprite.setTint(SLOW_TINT);
    else if (time < this.dizzyUntil) this.sprite.setTint(DIZZY_TINT);
    else if (this.ai.enraged) this.sprite.setTint(ENRAGED_TINT);
    else this.sprite.clearTint();
  }

  syncVisuals(shakeX = 0) {
    const feetY = this.y + this.footOffset;
    this.sprite.setPosition(this.x + shakeX, feetY).setDepth(DEPTH.actors + feetY);
    this.shadow.setPosition(this.x, feetY - 2);
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
    if (this.state !== 'active' || !this.hitbox.body.enable || this.untouchable) return;
    if (this.ai.armored) {
      // Hiding in its shell: the hit just glances off.
      this.scene.burst(this.x, this.y - 8, 'spark', 3, { distance: 10, duration: 150 });
      return;
    }
    this.flashUntil = time + FLASH_MS;
    this.sprite.setTintFill(0xffffff);
    if (!this.def.stationary && !this.def.boss) {
      const push = KNOCKBACK_SPEED * (effects.knockback ?? 1);
      this.knockbackUntil = time + KNOCKBACK_MS;
      this.hitbox.body.velocity.set(dir.x * push, dir.y * push);
    }
    if (effects.burn) this.burn = { ...effects.burn, ticksLeft: effects.burn.ticks, nextAt: time + effects.burn.interval };
    if (effects.poison) this.poison = { ...effects.poison, ticksLeft: effects.poison.ticks, nextAt: time + effects.poison.interval };
    if (effects.slow) this.slow = { multiplier: effects.slow.multiplier, until: time + effects.slow.ms };
    // Bosses shake off dizziness.
    if (effects.confuse && !this.def.boss) this.dizzyUntil = Math.max(this.dizzyUntil, time + effects.confuse);
    this.scene.playSfx('enemyHit');
    this.damage(this.def.boss ? damage * this.scene.player.stats.bossDamage : damage);
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
    this.poison = null;
    this.stop();
    this.hitbox.body.enable = false;
    flashWhite(this.scene, this.sprite);
    const w = this.def.hitbox.w; // bigger enemies burst into more pieces
    if (this.def.deathParticle) this.scene.burst(this.x, this.y - 8, this.def.deathParticle, Math.max(6, Math.round(w / 4)), { distance: w * 0.8 });
    if (this.def.trail) this.scene.dropSlime(this.x, this.y + this.footOffset - 2, this.def.trail);
    this.scene.onEnemyKilled(this);
    if (this.def.onDeath && !this.scene.clearingMinions) this.deathEffect(this.def.onDeath);

    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 450 });
    this.scene.tweens.add({ targets: this.sprite, ...DEATHS[this.def.death ?? 'melt'](this), onComplete: () => this.destroy() });
  }

  // A last trick when it dies: burst into a ring of bullets, or split into smaller enemies.
  deathEffect({ ring, spawn }) {
    const { x, y, scene } = this;
    if (ring) scene.fireRing(x, y - 8, ring.bullets, ring.bulletSpeed, ring.bullet, scene.rng.range(0, 1), ring.range);
    if (spawn) {
      // Next frame, so new enemies aren't added in the middle of a physics step.
      scene.time.delayedCall(0, () => {
        for (let i = 0; i < spawn.count; i++) scene.spawnEnemyAt(spawn.type, x + (i - (spawn.count - 1) / 2) * 18, y);
      });
    }
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
  pop: (e) => ({ x: e.sprite.x + 24 * e.size, y: e.sprite.y - 8, angle: 200, alpha: 0, duration: 550, ease: 'Quad.easeOut' }),
  // Flips onto its back, legs wiggling.
  flip: (e) => {
    e.sprite.setFlipY(true).setOrigin(0.5, 0.5).setY(e.sprite.y - 16);
    return { angle: { from: -8, to: 8 }, alpha: 0, duration: 700, ease: 'Sine.easeInOut' };
  },
  // Withers and shrinks into the ground.
  wither: (e) => ({ scaleY: 0, scaleX: 0.6 * e.size, duration: 500, ease: 'Quad.easeIn' }),
  // Shatters into ceramic pieces.
  shatter: () => ({ alpha: 0, duration: 120 }),
  // The Weed Queen wilts.
  wilt: (e) => ({ scaleY: 0.3 * e.size, scaleX: 1.2 * e.size, alpha: 0, duration: 1200, ease: 'Quad.easeIn' }),
};
