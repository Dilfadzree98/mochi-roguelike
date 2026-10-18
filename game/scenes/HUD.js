import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { GRID_W, GRID_H } from '../systems/DungeonGen.js';

const HEART_KEYS = ['heart_empty', 'heart_half', 'heart_full'];
// Boss name and health bar on one dark strip along the bottom wall.
const BOSS_BAR = { left: 36, right: 204, barX: 100, h: 3, y: GAME_HEIGHT - 8 };

// Minimap: one 6x4 cell per room, in the top-right corner of the room.
const CELL = { w: 6, h: 4, stepX: 7, stepY: 5 };
const MAP_X = GAME_WIDTH - 4 - (GRID_W * CELL.stepX - 1);
const MAP_Y = HUD_HEIGHT + 4;
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

// Top bar (hearts, counters, wave/floor), minimap and boss health bar. Runs on top of the Game scene and listens to its events.
export class HUD extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    const game = this.scene.get('Game');
    this.add.rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x1f1a24).setOrigin(0);
    this.hearts = [];
    this.waveText = addText(this, GAME_WIDTH - 5, HUD_HEIGHT / 2, '', { originX: 1, tint: UI.muted });
    this.map = this.add.graphics();

    // Coin, bomb and key counters after the hearts (room for 6 hearts).
    this.counters = {};
    ['coins', 'bombs', 'keys'].forEach((kind, i) => {
      const x = 66 + i * 24;
      this.add.image(x, HUD_HEIGHT / 2, kind.slice(0, -1));
      this.counters[kind] = addText(this, x + 6, HUD_HEIGHT / 2, '', { originX: 0, tint: UI.muted });
    });

    // Boss health bar along the bottom wall.
    this.bossBar = this.add.graphics();
    this.bossName = addText(this, BOSS_BAR.left + 4, BOSS_BAR.y + 1, '', { originX: 0, tint: 0xd9b8ff }).setVisible(false);

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
    };
    for (const [event, fn] of Object.entries(listeners)) game.events.on(event, fn);
    this.events.once('shutdown', () => {
      for (const [event, fn] of Object.entries(listeners)) game.events.off(event, fn);
    });

    listeners.hp(game.player.hp, game.player.stats.maxHp);
    listeners.wave(game.waveActive ? game.waveIndex : 0);
    listeners.room(game.dungeon, game.room);
    listeners.inventory(game.player.inventory);
  }

  // "WAVE 1/2" during a fight, otherwise the floor number.
  drawRightLabel(game) {
    const text = this.wave > 0 ? `WAVE ${this.wave}/${game.room.waves.length}` : `FLOOR ${game.floorIndex + 1}`;
    this.waveText.setText(text);
  }

  drawBossBar(boss) {
    const g = this.bossBar.clear();
    this.bossName.setVisible(!!boss);
    if (!boss) return;
    this.bossName.setText(boss.name.toUpperCase()); // the pixel font only has capitals
    const { left, right, barX, h, y } = BOSS_BAR;
    const barW = right - 4 - barX;
    g.fillStyle(0x120e16, 0.9).fillRect(left, y - 4, right - left, 10);
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
      return this.add.image(5 + i * 9, 5, HEART_KEYS[fill]).setOrigin(0);
    });
  }

  // Shows visited rooms and the rooms next to them, like a map filled in while exploring.
  drawMap(dungeon, current) {
    const g = this.map.clear();
    const seen = dungeon.rooms.filter((room) => room.visited || dungeon.neighbors(room).some((n) => n.visited));

    // Backing box only around the rooms shown so far.
    const xs = seen.map((room) => room.x);
    const ys = seen.map((room) => room.y);
    const left = MAP_X + Math.min(...xs) * CELL.stepX - 2;
    const top = MAP_Y + Math.min(...ys) * CELL.stepY - 2;
    const right = MAP_X + Math.max(...xs) * CELL.stepX + CELL.w + 2;
    const bottom = MAP_Y + Math.max(...ys) * CELL.stepY + CELL.h + 2;
    g.fillStyle(MAP_COLORS.background, 0.6).fillRect(left, top, right - left, bottom - top);

    for (const room of seen) {
      const x = MAP_X + room.x * CELL.stepX;
      const y = MAP_Y + room.y * CELL.stepY;
      const color = room === current ? MAP_COLORS.current : room.visited ? MAP_COLORS.visited : MAP_COLORS.seen;
      g.fillStyle(color, 1).fillRect(x, y, CELL.w, CELL.h);

      const icon = MAP_COLORS[room.type];
      if (icon) g.fillStyle(icon, 1).fillRect(x + 2, y + 1, 2, 2);
    }
  }
}
