import { GAME_WIDTH, GAME_HEIGHT, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed } from '../systems/Rng.js';

// A centred row of item icons (used on the pause and game over screens).
export function drawItemRow(scene, cx, y, icons) {
  const spacing = 10;
  const startX = cx - ((icons.length - 1) * spacing) / 2;
  icons.forEach((icon, i) => scene.add.image(Math.round(startX + i * spacing), y, icon));
}

const OPTIONS = [
  { label: 'Resume', action: (scene) => scene.resumeGame() },
  { label: 'Restart', action: (scene) => scene.restart() },
  { label: 'Quit to menu', action: (scene) => scene.quit() },
];

// Overlay shown while the Game scene is paused. W/S or Up/Down to choose, Space/Enter to pick.
export class Pause extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    const game = this.scene.get('Game');

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x120e16, 0.75).setOrigin(0);
    addText(this, cx, 34, 'Paused', { scale: 3, tint: UI.peach });

    this.selected = 0;
    this.items = OPTIONS.map((option, i) => addText(this, cx, 66 + i * 14, option.label, { scale: 2 }));
    this.cursor = addText(this, 0, 0, '>', { scale: 2, tint: UI.gold });
    this.refresh();

    drawItemRow(this, cx, 114, game.player.items.map((item) => item.icon));
    addText(this, cx, 126, `Rooms cleared ${game.roomsCleared}/${game.dungeon.combatRoomCount}`, { tint: UI.muted });
    addText(this, cx, 136, `Seed ${game.seed}`, { tint: UI.dim });
    addText(this, cx, 150, 'WASD move  Arrows shoot  E bomb  Esc resume', { tint: UI.dim });

    const keyboard = this.input.keyboard;
    const move = (step) => {
      this.selected = (this.selected + step + OPTIONS.length) % OPTIONS.length;
      this.refresh();
    };
    keyboard.on('keydown-W', () => move(-1));
    keyboard.on('keydown-UP', () => move(-1));
    keyboard.on('keydown-S', () => move(1));
    keyboard.on('keydown-DOWN', () => move(1));
    keyboard.on('keydown-ESC', () => this.resumeGame());
    keyboard.on('keydown-P', () => this.resumeGame());
    const choose = () => OPTIONS[this.selected].action(this);
    keyboard.on('keydown-SPACE', choose);
    keyboard.on('keydown-ENTER', choose);
  }

  refresh() {
    this.items.forEach((item, i) => item.setTint(i === this.selected ? UI.gold : 0xffffff));
    const item = this.items[this.selected];
    this.cursor.setPosition(Math.round(item.x - item.width / 2 - 10), item.y);
  }

  resumeGame() {
    this.scene.resume('Game');
    this.scene.stop();
  }

  restart() {
    this.scene.stop('HUD');
    this.scene.start('Game', { seed: newSeed() });
  }

  quit() {
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.start('Menu');
  }
}
