import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { GRID_W, GRID_H } from '../systems/DungeonGen.js';

const HEART_KEYS = ['heart_empty', 'heart_half', 'heart_full'];
// Boss name and health bar on one dark strip along the bottom wall.
const SKILL_METER = { x: 322, w: 60, h: 6 };
const BOSS_BAR = { left: 64, right: 416, barX: 216, h: 6, y: GAME_HEIGHT - 12 };

// Minimap: one 12x8 cell per room, in the top-right corner of the room.
const CELL = { w: 12, h: 8, stepX: 14, stepY: 10 };
const MAP_X = GAME_WIDTH - 8 - (GRID_W * CELL.stepX - 2);
const MAP_Y = HUD_HEIGHT + 8;
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

// Top bar over the top wall (hearts, counters, skill, wave/floor), minimap and boss health bar. Runs on top of the Game scene and listens to its events.
export class HUD extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    const game = this.scene.get('Game');
    this.add.rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x120e16, 0.75).setOrigin(0);
    this.hearts = [];
    this.waveText = addText(this, GAME_WIDTH - 8, HUD_HEIGHT / 2, '', { originX: 1, tint: UI.muted });
    this.map = this.add.graphics();

    // Coin, bomb and key counters after the hearts (room for 8 hearts).
    this.counters = {};
    ['coins', 'bombs', 'keys'].forEach((kind, i) => {
      const x = 166 + i * 50;
      this.add.image(x, HUD_HEIGHT / 2, kind.slice(0, -1));
      this.counters[kind] = addText(this, x + 12, HUD_HEIGHT / 2, '', { originX: 0, tint: UI.muted });
    });

    // Skill meter: fills with each shot, blinks when ready (Space), then drains while the skill runs.
    this.add.image(SKILL_METER.x - 12, HUD_HEIGHT / 2, game.character.skill.icon);
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
      room: (dungeon, room) => this.drawMap(dungeon, room),
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

  // Blink the full meter while the skill waits for Space.
  update(time) {
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
  drawMap(dungeon, current) {
    const g = this.map.clear();
    const seen = dungeon.rooms.filter((room) => room.visited || dungeon.neighbors(room).some((n) => n.visited));

    // Backing box only around the rooms shown so far.
    const xs = seen.map((room) => room.x);
    const ys = seen.map((room) => room.y);
    const left = MAP_X + Math.min(...xs) * CELL.stepX - 4;
    const top = MAP_Y + Math.min(...ys) * CELL.stepY - 4;
    const right = MAP_X + Math.max(...xs) * CELL.stepX + CELL.w + 4;
    const bottom = MAP_Y + Math.max(...ys) * CELL.stepY + CELL.h + 4;
    g.fillStyle(MAP_COLORS.background, 0.6).fillRect(left, top, right - left, bottom - top);

    for (const room of seen) {
      const x = MAP_X + room.x * CELL.stepX;
      const y = MAP_Y + room.y * CELL.stepY;
      const color = room === current ? MAP_COLORS.current : room.visited ? MAP_COLORS.visited : MAP_COLORS.seen;
      g.fillStyle(color, 1).fillRect(x, y, CELL.w, CELL.h);

      const icon = MAP_COLORS[room.type];
      if (icon) g.fillStyle(icon, 1).fillRect(x + 4, y + 2, 4, 4);
    }
  }
}
