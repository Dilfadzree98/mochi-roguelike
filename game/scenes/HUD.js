import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { GRID_W, GRID_H } from '../systems/DungeonGen.js';

const HEART_KEYS = ['heart_empty', 'heart_half', 'heart_full'];
// No backing bar: hearts, counters and the meter sit straight on the wall. The middle stays
// clear so the top door is visible.
const SKILL_METER = { x: 310, w: 60, h: 6 };
// Boss name and health bar on one dark strip along the bottom wall.
const BOSS_BAR = { left: 64, right: 416, barX: 216, h: 6, y: GAME_HEIGHT - 12 };

// Minimap: one 12x8 cell per room, in the top-right corner of the room, faded so it
// doesn't hide the fight. Holding Tab shows a big map in the middle of the screen.
const MINIMAP = { x: GAME_WIDTH - 8 - (GRID_W * 14 - 2), y: HUD_HEIGHT + 8, w: 12, h: 8, stepX: 14, stepY: 10 };
const MINIMAP_ALPHA = 0.4;
const BIG_MAP = { w: 40, h: 26, stepX: 46, stepY: 32 };
BIG_MAP.x = Math.round((GAME_WIDTH - (GRID_W * BIG_MAP.stepX - 6)) / 2);
BIG_MAP.y = Math.round((GAME_HEIGHT - (GRID_H * BIG_MAP.stepY - 6)) / 2);
const MAP_COLORS = {
  background: 0x120e16,
  current: 0xffffff,
  visited: 0x9a8fb0,
  seen: 0x4a4058, // next to a visited room, not entered yet
  // Room-type marks
  boss: 0xb57bff,
  treasure: 0xf2c94c,
  shop: 0xf2a0a8,
};

// Top bar over the top wall (hearts on the left; skill and wave/floor on the right), coin/bomb/key
// counters under the hearts, minimap (Tab for a big one) and boss health bar. Runs on top of the Game scene and listens to its events.
export class HUD extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    const game = this.scene.get('Game');
    this.hearts = [];
    this.waveText = addText(this, GAME_WIDTH - 8, HUD_HEIGHT / 2, '', { originX: 1, tint: UI.muted });
    this.map = this.add.graphics().setAlpha(MINIMAP_ALPHA);

    // Coin, bomb and key counters stacked under the hearts, over the left wall.
    this.counters = {};
    ['coins', 'bombs', 'keys'].forEach((kind, i) => {
      const y = HUD_HEIGHT + 11 + i * 18;
      this.add.image(14, y, kind.slice(0, -1));
      this.counters[kind] = addText(this, 26, y, '', { originX: 0, tint: UI.muted });
    });

    // The big map, shown while Tab is held.
    this.bigMap = this.add.container(0, 0).setVisible(false).setDepth(100);
    this.bigMap.add([
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x120e16, 0.8).setOrigin(0),
      addText(this, GAME_WIDTH / 2, 36, 'Map', { scale: 4, tint: UI.peach }),
    ]);
    this.bigMapRooms = this.add.graphics();
    this.bigMap.add(this.bigMapRooms);
    const legend = [['You', MAP_COLORS.current], ['Boss', MAP_COLORS.boss], ['Treasure', MAP_COLORS.treasure], ['Shop', MAP_COLORS.shop]];
    let lx = GAME_WIDTH / 2 - 150;
    for (const [label, color] of legend) {
      this.bigMap.add(this.add.rectangle(lx, GAME_HEIGHT - 30, 10, 10, color).setOrigin(0, 0.5));
      const text = addText(this, lx + 16, GAME_HEIGHT - 30, label, { originX: 0, tint: UI.muted });
      this.bigMap.add(text);
      lx += 16 + text.width + 24;
    }
    this.tabKey = this.input.keyboard.addKey('TAB'); // also stops Tab moving focus off the game

    // Skill meter: fills with each shot, blinks when ready (Space), then drains while the skill runs.
    this.add.image(SKILL_METER.x - 14, HUD_HEIGHT / 2, game.character.skill.icon);
    this.skillBar = this.add.graphics();

    // Boss health bar along the bottom wall.
    this.bossBar = this.add.graphics();
    this.bossName = addText(this, BOSS_BAR.left + 8, BOSS_BAR.y + 1, '', { originX: 0, tint: 0xd9b8ff }).setVisible(false);

    const listeners = {
      hp: (hp, maxHp) => this.drawHearts(hp, maxHp),
      wave: (wave) => {
        this.wave = wave;
        this.drawRightLabel(game);
        if (wave === 0) this.drawBossBar(null);
      },
      room: (dungeon, room) => {
        this.drawMap(this.map, dungeon, room, MINIMAP, true);
        this.drawMap(this.bigMapRooms, dungeon, room, BIG_MAP, false);
      },
      inventory: (inventory) => this.drawCounters(inventory),
      floor: () => this.drawRightLabel(game),
      boss: (boss) => this.drawBossBar(boss),
      skill: (skill) => this.drawSkillMeter(skill),
    };
    for (const [event, fn] of Object.entries(listeners)) game.events.on(event, fn);
    this.events.once('shutdown', () => {
      for (const [event, fn] of Object.entries(listeners)) game.events.off(event, fn);
    });

    listeners.hp(game.player.hp, game.player.stats.maxHp);
    listeners.wave(game.waveActive ? game.waveIndex : 0);
    listeners.room(game.dungeon, game.room);
    listeners.inventory(game.player.inventory);
    game.skills.emit();
  }

  // "WAVE 1/2" during a fight, otherwise the floor number.
  drawRightLabel(game) {
    const text = this.wave > 0 ? `WAVE ${this.wave}/${game.room.waves.length}` : `FLOOR ${game.floorIndex + 1}`;
    this.waveText.setText(text);
  }

  update(time) {
    this.bigMap.setVisible(this.tabKey.isDown);

    // Blink the full meter while the skill waits for Space.
    if (!this.skillState?.ready) return;
    const lit = Math.floor(time / 250) % 2 === 0;
    if (lit !== this.skillLit) {
      this.skillLit = lit;
      this.drawSkillMeter(this.skillState);
    }
  }

  drawSkillMeter(skill) {
    this.skillState = skill;
    const { progress, active, ready } = skill;
    const { x, w, h } = SKILL_METER;
    const y = HUD_HEIGHT / 2 - 3;
    const g = this.skillBar.clear();
    g.fillStyle(0x120e16, 1).fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(0x3b2b33, 1).fillRect(x, y, w, h);
    const color = active ? UI.gold : ready ? (this.skillLit ? 0xffffff : UI.gold) : 0xa6d987;
    g.fillStyle(color, 1).fillRect(x, y, Math.round(w * progress), h);
  }

  drawBossBar(boss) {
    const g = this.bossBar.clear();
    this.bossName.setVisible(!!boss);
    if (!boss) return;
    this.bossName.setText(boss.name.toUpperCase()); // the pixel font only has capitals
    const { left, right, barX, h, y } = BOSS_BAR;
    const barW = right - 8 - barX;
    g.fillStyle(0x120e16, 0.9).fillRect(left, y - 8, right - left, 20);
    g.fillStyle(0x4a2e5a, 1).fillRect(barX, y, barW, h);
    g.fillStyle(0xb57bff, 1).fillRect(barX, y, Math.round((barW * boss.hp) / boss.maxHp), h);
  }

  drawCounters(inventory) {
    for (const [kind, text] of Object.entries(this.counters)) text.setText(String(inventory[kind]).padStart(2, '0'));
  }

  drawHearts(hp, maxHp) {
    this.hearts.forEach((heart) => heart.destroy());
    this.hearts = Array.from({ length: Math.ceil(maxHp / 2) }, (_, i) => {
      const fill = Phaser.Math.Clamp(hp - i * 2, 0, 2);
      return this.add.image(8 + i * 18, HUD_HEIGHT / 2, HEART_KEYS[fill]).setOrigin(0, 0.5);
    });
  }

  // Shows visited rooms and the rooms next to them, like a map filled in while exploring.
  // `layout` is MINIMAP or BIG_MAP (position and cell sizes).
  drawMap(g, dungeon, current, layout, backing) {
    g.clear();
    const seen = dungeon.rooms.filter((room) => room.visited || dungeon.neighbors(room).some((n) => n.visited));
    const { x: mapX, y: mapY, w, h, stepX, stepY } = layout;

    if (backing) {
      // Backing box only around the rooms shown so far.
      const xs = seen.map((room) => room.x);
      const ys = seen.map((room) => room.y);
      const left = mapX + Math.min(...xs) * stepX - 4;
      const top = mapY + Math.min(...ys) * stepY - 4;
      const right = mapX + Math.max(...xs) * stepX + w + 4;
      const bottom = mapY + Math.max(...ys) * stepY + h + 4;
      g.fillStyle(MAP_COLORS.background, 0.6).fillRect(left, top, right - left, bottom - top);
    }

    // Corridors between rooms you can walk between (big map only; the minimap is too small).
    if (!backing) {
      g.fillStyle(MAP_COLORS.seen, 1);
      for (const room of seen) {
        const cx = mapX + room.x * stepX + w / 2;
        const cy = mapY + room.y * stepY + h / 2;
        if (room.doors.right && seen.includes(dungeon.neighbor(room, 'right'))) g.fillRect(cx, cy - 2, stepX, 4);
        if (room.doors.down && seen.includes(dungeon.neighbor(room, 'down'))) g.fillRect(cx - 2, cy, 4, stepY);
      }
    }

    const iconSize = Math.round(h / 2);
    for (const room of seen) {
      const x = mapX + room.x * stepX;
      const y = mapY + room.y * stepY;
      const color = room === current ? MAP_COLORS.current : room.visited ? MAP_COLORS.visited : MAP_COLORS.seen;
      g.fillStyle(color, 1).fillRect(x, y, w, h);

      const icon = MAP_COLORS[room.type];
      if (icon) g.fillStyle(icon, 1).fillRect(x + (w - iconSize) / 2, y + (h - iconSize) / 2, iconSize, iconSize);
    }
  }
}
