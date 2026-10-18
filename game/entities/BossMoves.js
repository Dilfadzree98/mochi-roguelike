import { FLOOR } from '../constants.js';

// Boss attacks. Every boss has three moves (listed in data/enemies.json) and picks
// a different one from last time whenever its cooldown ends.
//
// A move is a generator: `yield ms` waits that long, a bare `yield` waits one frame.
// The boss stands still between yields unless the move sets its velocity.
// Below half health a boss is enraged (`e.ai.enraged`) and its moves get nastier.

const DEG = Math.PI / 180;

export const angleTo = (e, target) => Math.atan2(target.hitbox.y - e.y, target.hitbox.x - e.x);

const now = (e) => e.scene.time.now;
const rage = (e, calm, angry) => (e.ai.enraged ? angry : calm);

// True when the boss is pressed against the given side of the room.
function touchingWall(e) {
  const { w, h } = e.def.hitbox;
  return {
    left: e.x - w / 2 <= FLOOR.left + 1,
    right: e.x + w / 2 >= FLOOR.right - 1,
    top: e.y - h / 2 <= FLOOR.top + 1,
    bottom: e.y + h / 2 >= FLOOR.bottom - 1,
  };
}

// True when something (a wall, an obstacle, another enemy) blocks movement along (vx, vy).
// Uses the physics engine's contact flags. Comparing positions between frames doesn't work:
// physics runs at a fixed 60 steps a second, so on faster screens some frames have no movement.
export function bumped(e, vx, vy) {
  const body = e.hitbox.body;
  const wall = touchingWall(e);
  const hit = (side, edge) => wall[edge] || body.touching[side] || body.blocked[side];
  // Grazing something while moving mostly the other way doesn't count.
  const len = Math.hypot(vx, vy) || 1;
  const x = vx / len;
  const y = vy / len;
  return (x < -0.3 && hit('left', 'left')) || (x > 0.3 && hit('right', 'right')) || (y < -0.3 && hit('up', 'top')) || (y > 0.3 && hit('down', 'bottom'));
}

// Glow, then wait: the warning before most attacks.
function* windup(e, ms) {
  e.stop();
  e.windup(ms);
  yield ms;
}

// Shake in place, then wait (the warning before a charge).
function* rumble(e, ms) {
  e.stop();
  e.shakeUntil = now(e) + ms;
  yield ms;
}

// Charge in a straight line until a wall or obstacle stops it. `eachFrame` runs every frame.
function* dash(e, angle, speed, maxMs, eachFrame = () => {}) {
  const started = now(e);
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);
  while (now(e) - started < maxMs) {
    const s = speed * (e.slow ? e.slow.multiplier : 1);
    e.hitbox.body.velocity.set(vx * s, vy * s);
    eachFrame();
    yield;
    if (bumped(e, vx, vy)) break;
  }
  e.stop();
}

// Fade out, reappear somewhere else. Can't be hit while away.
function* blink(e) {
  const scene = e.scene;
  scene.tweens.add({ targets: [e.sprite, e.shadow], alpha: 0, duration: 250 });
  yield 250;
  scene.burst(e.x, e.y - 6, 'hex_spark', 8, { distance: 12 });
  e.hitbox.body.enable = false;
  const spot = scene.findTeleportSpot();
  e.hitbox.body.reset(spot.x, spot.y);
  e.syncVisuals();
  scene.burst(spot.x, spot.y - 6, 'hex_spark', 8, { distance: 12 });
  scene.tweens.add({ targets: e.sprite, alpha: 1, duration: 250 });
  scene.tweens.add({ targets: e.shadow, alpha: 0.3, duration: 250 });
  yield 250;
  if (e.state === 'active') e.hitbox.body.enable = true;
}

// Minions summoned by a boss, never more than `cap` at once.
function summon(e, type, count, cap) {
  const scene = e.scene;
  const alive = scene.enemies.filter((o) => o !== e && o.state !== 'dead').length;
  for (let i = 0; i < Math.min(count, cap - alive); i++) {
    const a = (i / count) * Math.PI * 2 + scene.rng.range(0, 1);
    scene.spawnEnemyAt(type, e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 18);
  }
}

// Spots on the floor near Mochi: one right under them, the rest scattered around.
function spotsNearPlayer(e, player, count, spread) {
  const rng = e.scene.rng;
  const clampX = (x) => Phaser.Math.Clamp(x, FLOOR.left + 10, FLOOR.right - 10);
  const clampY = (y) => Phaser.Math.Clamp(y, FLOOR.top + 10, FLOOR.bottom - 8);
  const spots = [{ x: player.hitbox.x, y: player.hitbox.y }];
  while (spots.length < count) {
    spots.push({ x: clampX(player.hitbox.x + rng.range(-spread, spread)), y: clampY(player.hitbox.y + rng.range(-spread, spread)) });
  }
  return spots;
}

export const BOSS_MOVES = {
  // ---------- Mother Gloom Slug ----------

  // Rears up, then slides fast at Mochi, leaving thick slime.
  *slime_dash(e, player) {
    yield* rumble(e, 600);
    let nextBlob = 0;
    yield* dash(e, angleTo(e, player), rage(e, 120, 150), 1500, () => {
      if (now(e) < nextBlob) return;
      nextBlob = now(e) + 50;
      e.scene.dropSlime(e.x, e.y + e.footOffset - 2, e.def.trail);
    });
    e.squish();
    yield 500;
  },

  // Squeezes out baby slugs.
  *brood(e) {
    yield* windup(e, 500);
    e.squish();
    e.scene.burst(e.x, e.y, 'slime_bit', 10, { distance: 16 });
    summon(e, 'gloom_slug', rage(e, 2, 3), 4);
    yield 500;
  },

  // Spits goo blobs into the air; they land where the targets show and splash.
  *goo_rain(e, player) {
    yield* windup(e, 400);
    e.squish();
    for (const spot of spotsNearPlayer(e, player, rage(e, 3, 5), 40)) {
      e.scene.markStrike(spot.x, spot.y, 850, () => {
        e.scene.fireRing(spot.x, spot.y, 6, 45, 'spore', e.scene.rng.range(0, 1));
        for (let i = 0; i < 3; i++) e.scene.dropSlime(spot.x + (i - 1) * 6, spot.y + 2, e.def.trail);
      });
    }
    yield 900;
  },

  // ---------- Grandshroom ----------

  // Hops at Mochi; every landing puffs a ring of spores.
  *hop_slam(e, player) {
    const p = e.def.params;
    for (let i = 0; i < rage(e, 2, 3); i++) {
      yield* windup(e, 300);
      e.hitbox.body.velocity.setToPolar(angleTo(e, player), p.hopSpeed);
      yield p.hopMs;
      e.stop();
      e.squish();
      e.scene.fireRing(e.x, e.y, rage(e, 8, 10), 66, 'spore', i * 0.2);
      e.scene.cameras.main.shake(120, 0.008);
      yield 250;
    }
  },

  // Rings of spores with the gaps shifting each time.
  *spore_rings(e) {
    yield* windup(e, 400);
    for (let i = 0; i < rage(e, 3, 4); i++) {
      e.squish();
      e.scene.fireRing(e.x, e.y - 8, 12, 52, 'spore', (i % 2) * (Math.PI / 12));
      yield 450;
    }
  },

  // A long spiral of spores.
  *spore_spiral(e) {
    yield* windup(e, 500);
    e.scene.fireSpiral(e.x, e.y - 8, rage(e, 24, 36), 55, 'spore', 1300);
    yield 1400;
  },

  // ---------- The Gnome King ----------

  // Vanishes, reappears, fires an aimed fan of hex orbs. Twice (three times when enraged).
  *blink_volley(e, player) {
    for (let i = 0; i < rage(e, 2, 3); i++) {
      yield* blink(e);
      e.windup(250);
      yield 250;
      e.scene.fireSpread(e.x, e.y - 12, angleTo(e, player), 7, 14, 72, 'hex_orb');
      yield 400;
    }
  },

  // Three rings of hex orbs, each a little faster.
  *hex_nova(e) {
    yield* windup(e, 500);
    for (let i = 0; i < 3; i++) {
      e.scene.fireRing(e.x, e.y - 8, rage(e, 12, 16), 45 + i * 12, 'hex_orb', i * 0.15);
      yield 300;
    }
  },

  // Curses the floor around Mochi; each mark bursts into hex orbs.
  *hex_curse(e, player) {
    yield* windup(e, 400);
    for (const spot of spotsNearPlayer(e, player, rage(e, 3, 4), 45)) {
      e.scene.markStrike(spot.x, spot.y, 900, () => {
        e.scene.burst(spot.x, spot.y, 'hex_spark', 8, { distance: 10 });
        e.scene.fireRing(spot.x, spot.y, 6, 50, 'hex_orb', e.scene.rng.range(0, 1));
      });
    }
    yield 1000;
  },

  // ---------- The Weed Queen ----------

  // A vine sweeps the room with thorns (and back again when enraged).
  *vine_sweep(e) {
    yield* windup(e, 500);
    e.scene.fireSweep(e.x, e.y + 4, 15 * DEG, 165 * DEG, rage(e, 12, 16), rage(e, 70, 90), 'thorn', 600);
    yield 700;
    if (e.ai.enraged) {
      e.scene.fireSweep(e.x, e.y + 4, 165 * DEG, 15 * DEG, 16, 90, 'thorn', 600);
      yield 700;
    }
  },

  // Roots burst up under Mochi, one after another.
  *root_strike(e, player) {
    yield* windup(e, 400);
    for (let i = 0; i < rage(e, 3, 5); i++) {
      e.scene.rootStrike(player.hitbox.x, player.hitbox.y);
      yield 450;
    }
  },

  // Three quick fans of thorns aimed at Mochi.
  *thorn_volley(e, player) {
    yield* windup(e, 450);
    for (let i = 0; i < 3; i++) {
      e.scene.fireSpread(e.x, e.y, angleTo(e, player), rage(e, 5, 7), 12, 80, 'thorn');
      yield 220;
    }
    yield 300;
  },

  // ---------- Beetle Baron ----------

  // Charges at Mochi three times in a row, then needs a rest.
  *triple_charge(e, player) {
    for (let i = 0; i < rage(e, 3, 4); i++) {
      yield* rumble(e, 350);
      yield* dash(e, angleTo(e, player), 170, 1200);
      e.scene.cameras.main.shake(80, 0.006);
      yield 200;
    }
    yield 700; // dizzy after all that
  },

  // Rattles its shell and throws two rings of shell shards.
  *shell_shrapnel(e) {
    yield* windup(e, 450);
    e.squish();
    e.scene.fireRing(e.x, e.y - 6, 10, 60, 'thorn', 0);
    yield 300;
    e.squish();
    e.scene.fireRing(e.x, e.y - 6, 10, 60, 'thorn', Math.PI / 10);
    yield 400;
  },

  // Digs underground, follows Mochi as a moving crack, then bursts out.
  *burrow(e, player) {
    const scene = e.scene;
    yield* rumble(e, 300);
    scene.burst(e.x, e.y + 4, 'smoke', 8, { distance: 12 });
    e.hitbox.body.enable = false;
    scene.tweens.add({ targets: [e.sprite, e.shadow], alpha: 0, duration: 200 });
    yield 200;

    const crack = scene.add.image(e.x, e.y + 4, 'crack').setDepth(e.shadow.depth);
    scene.roomObjects.push(crack);
    const followUntil = now(e) + rage(e, 1400, 1000);
    while (now(e) < followUntil) {
      const step = (80 * scene.game.loop.delta) / 1000;
      const a = Math.atan2(player.hitbox.y - crack.y, player.hitbox.x - crack.x);
      crack.setPosition(crack.x + Math.cos(a) * step, crack.y + Math.sin(a) * step);
      yield;
    }
    scene.tweens.add({ targets: crack, alpha: { from: 1, to: 0.3 }, duration: 80, yoyo: true, repeat: 2 });
    yield 400;

    const spot = scene.freeSpot(crack.x, crack.y - 4, 10);
    crack.destroy();
    e.hitbox.body.reset(spot.x, spot.y);
    e.syncVisuals();
    e.sprite.setAlpha(1);
    e.shadow.setAlpha(0.3);
    if (e.state === 'active') e.hitbox.body.enable = true;
    e.squish();
    scene.burst(spot.x, spot.y + 4, 'smoke', 8, { distance: 14 });
    scene.cameras.main.shake(150, 0.01);
    scene.hurtPlayerNear(spot.x, spot.y, 14);
    scene.fireRing(spot.x, spot.y, rage(e, 10, 14), 60, 'spore', 0);
    yield 500;
  },

  // ---------- Bramble Hydra ----------

  // Each head spits a fan of thorns in turn.
  *triple_spit(e, player) {
    yield* windup(e, 300);
    for (let round = 0; round < rage(e, 1, 2); round++) {
      for (const head of e.def.heads) {
        const x = e.x + head.x;
        const y = e.y + e.footOffset + head.y;
        e.squish();
        e.scene.fireSpread(x, y, Math.atan2(player.hitbox.y - y, player.hitbox.x - x), 3, 16, 75, 'thorn');
        yield 280;
      }
    }
  },

  // A wall of thorns crosses the room from one side, with one gap to slip through.
  *bramble_wall(e) {
    yield* windup(e, 500);
    const rng = e.scene.rng;
    const walls = rage(e, 1, 2);
    let fromLeft = rng.chance(0.5);
    for (let w = 0; w < walls; w++) {
      const rows = [];
      for (let y = FLOOR.top + 6; y <= FLOOR.bottom - 4; y += 9) rows.push(y);
      const gap = rng.int(1, rows.length - 3);
      rows.forEach((y, i) => {
        if (i === gap || i === gap + 1) return;
        e.scene.fireEnemyBullet(fromLeft ? FLOOR.left + 4 : FLOOR.right - 4, y, fromLeft ? 0 : Math.PI, 48, 'thorn');
      });
      fromLeft = !fromLeft;
      yield 1100;
    }
  },

  // Thorns rain down from the top of the room.
  *thorn_rain(e) {
    yield* windup(e, 400);
    const rng = e.scene.rng;
    for (let i = 0; i < rage(e, 14, 20); i++) {
      e.scene.fireEnemyBullet(rng.range(FLOOR.left + 8, FLOOR.right - 8), FLOOR.top + 4, Math.PI / 2 + rng.range(-0.15, 0.15), rng.range(55, 80), 'thorn');
      yield 90;
    }
    yield 300;
  },

  // ---------- Pumpkin King ----------

  // Rolls around the room, bouncing off the walls.
  *rolling_bounce(e, player) {
    yield* rumble(e, 500);
    const a = angleTo(e, player);
    const speed = rage(e, 115, 140);
    let vx = Math.cos(a) * speed;
    let vy = Math.sin(a) * speed;
    const body = e.hitbox.body;
    let nextDust = 0;
    const until = now(e) + 2500;
    while (now(e) < until) {
      // Bounce off the room's edges and off obstacles.
      if (bumped(e, vx, 0)) vx = -vx;
      if (bumped(e, 0, vy)) vy = -vy;
      body.velocity.set(vx, vy);
      if (now(e) >= nextDust) {
        nextDust = now(e) + 120;
        e.scene.burst(e.x, e.y + e.footOffset, 'smoke', 2, { distance: 5 });
      }
      yield;
    }
    e.stop();
    e.squish();
    yield 500;
  },

  // A rapid stream of pumpkin seeds at Mochi.
  *seed_stream(e, player) {
    yield* windup(e, 400);
    const rng = e.scene.rng;
    for (let i = 0; i < rage(e, 12, 18); i++) {
      e.scene.fireEnemyBullet(e.x, e.y - 10, angleTo(e, player) + rng.range(-0.15, 0.15), 88, 'pip');
      yield 70;
    }
    yield 300;
  },

  // His face flares and seeds burst out in a star.
  *star_burst(e) {
    yield* windup(e, 500);
    for (let k = 0; k < 3; k++) {
      e.squish();
      const twist = e.ai.enraged ? k * 0.2 : 0;
      for (let d = 0; d < 8; d++) e.scene.fireEnemyBullet(e.x, e.y - 10, (d * Math.PI) / 4 + twist, 45 + k * 15, 'pip');
      yield 140;
    }
    yield 500;
  },
};

// What a boss does between moves.
export const BOSS_IDLE = {
  still: (e) => e.stop(),
  chase: (e) => e.hitbox.body.velocity.setToPolar(e.scene.chaseAngle(e), e.speed),
  // Ambles in random directions.
  wander(e, player, time) {
    if (!e.ai.wanderDir || time >= e.ai.wanderTurnAt) {
      const a = e.scene.rng.range(0, Math.PI * 2);
      e.ai.wanderDir = a;
      e.ai.wanderTurnAt = time + 700;
    }
    e.hitbox.body.velocity.setToPolar(e.ai.wanderDir, e.speed);
  },
};
