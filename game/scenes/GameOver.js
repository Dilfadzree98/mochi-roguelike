import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';

export class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ wave, seed, newBest }) {
    const cx = GAME_WIDTH / 2;

    addText(this, cx, 28, 'Mochi wilted...', { scale: 2, tint: UI.peach });
    this.add.image(cx, 80, 'mochi_wilt').setOrigin(0.5, 1).setScale(2);

    addText(this, cx, 94, `Reached wave ${wave}`);
    if (newBest) addText(this, cx, 104, 'New best!', { tint: UI.gold });
    else addText(this, cx, 104, `Best wave ${Save.bestWave()}`, { tint: UI.dim });
    addText(this, cx, 116, `Seed ${seed}`, { tint: UI.dim });

    addText(this, cx, 140, 'Space new run   R same seed   Esc menu', { tint: UI.muted });

    const keyboard = this.input.keyboard;
    keyboard.once('keydown-SPACE', () => this.scene.start('Game', { seed: newSeed() }));
    keyboard.once('keydown-R', () => this.scene.start('Game', { seed }));
    keyboard.once('keydown-ESC', () => this.scene.start('Menu'));
  }
}
