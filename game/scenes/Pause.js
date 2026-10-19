import { GAME_WIDTH, GAME_HEIGHT, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed } from '../systems/Rng.js';
import { Audio } from '../systems/Audio.js';

// Centred rows of item icons (used on the pause and game over screens).
// Long lists wrap onto extra rows, stacked upward from `y`.
export function drawItemRow(scene, cx, y, icons, perRow = 22) {
  const spacing = 9;
  const rows = Math.ceil(icons.length / perRow);
  for (let r = 0; r < rows; r++) {
    const rowIcons = icons.slice(r * perRow, (r + 1) * perRow);
    const startX = cx - ((rowIcons.length - 1) * spacing) / 2;
    const rowY = y - (rows - 1 - r) * 10;
    rowIcons.forEach((icon, i) => scene.add.image(Math.round(startX + i * spacing), rowY, icon));
  }
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
    addText(this, cx, 126, `Floor ${game.floorIndex + 1}: ${game.dungeon.floor.name}   Rooms cleared ${game.roomsCleared}`, { tint: UI.muted });
    addText(this, cx, 136, `Seed ${game.seed}   M mute`, { tint: UI.dim });
    addText(this, cx, 146, '[WASD] move, [Arrows] shoot, [E] bomb', { tint: UI.dim });
    addText(this, cx, 154, '[Space] skill, [Esc] resume', { tint: UI.dim });

    const keyboard = this.input.keyboard;
    const move = (step) => {
      this.selected = (this.selected + step + OPTIONS.length) % OPTIONS.length;
      Audio.play('select');
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
    Audio.setMusicPaused(false);
    this.scene.stop('HUD');
    this.scene.start('Game', { seed: newSeed(), character: this.scene.get('Game').character.id });
  }

  quit() {
    Audio.setMusicPaused(false);
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.start('Menu');
  }
}
