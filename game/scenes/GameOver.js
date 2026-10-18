import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { drawItemRow } from './Pause.js';

// End of a run, won (boss room cleared) or lost.
export class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ won, roomsCleared, totalRooms, seed, newBest, items = [] }) {
    const cx = GAME_WIDTH / 2;

    addText(this, cx, 28, won ? 'Garden cleared!' : 'Mochi wilted...', { scale: 2, tint: won ? UI.gold : UI.peach });
    this.add.image(cx, 80, won ? 'mochi' : 'mochi_wilt').setOrigin(0.5, 1).setScale(2);

    addText(this, cx, 94, `Rooms cleared ${roomsCleared}/${totalRooms}`);
    if (newBest) addText(this, cx, 104, 'New best!', { tint: UI.gold });
    else addText(this, cx, 104, `Best ${Save.bestRooms()} rooms`, { tint: UI.dim });
    addText(this, cx, 116, `Seed ${seed}`, { tint: UI.dim });
    drawItemRow(this, cx, 128, items);

    addText(this, cx, 140, 'Space new run   R same seed   Esc menu', { tint: UI.muted });

    const keyboard = this.input.keyboard;
    keyboard.once('keydown-SPACE', () => this.scene.start('Game', { seed: newSeed() }));
    keyboard.once('keydown-R', () => this.scene.start('Game', { seed }));
    keyboard.once('keydown-ESC', () => this.scene.start('Menu'));
  }
}
