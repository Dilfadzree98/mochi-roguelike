import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed, seedFromUrl } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';

export class Menu extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = GAME_WIDTH / 2;

    addText(this, cx, 22, 'Mochi', { scale: 4, tint: UI.peach });
    addText(this, cx, 42, 'A sprout bun in a haunted garden', { tint: UI.leaf });

    const mochi = this.add.image(cx, 96, 'mochi').setOrigin(0.5, 1).setScale(3);
    this.tweens.add({ targets: mochi, y: 92, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    addText(this, cx, 110, 'WASD move   Arrows shoot', { tint: UI.muted });
    const prompt = addText(this, cx, 126, 'Press space', { scale: 2, tint: UI.gold });
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const best = Save.bestRooms();
    const wins = Save.wins();
    if (best > 0) addText(this, cx, 148, `Best ${best} rooms   Wins ${wins}`, { tint: UI.dim });

    const start = () => this.scene.start('Game', { seed: seedFromUrl() ?? newSeed() });
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.keyboard.once('keydown-ENTER', start);
  }
}
