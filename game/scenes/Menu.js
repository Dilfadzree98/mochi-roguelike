import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed, seedFromUrl } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { Audio } from '../systems/Audio.js';

export class Menu extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    Audio.startMusic(0);

    addText(this, cx, 20, 'Mochi', { scale: 4, tint: UI.peach });
    addText(this, cx, 40, 'A sprout bun in a haunted garden', { tint: UI.leaf });

    const mochi = this.add.image(cx, 92, 'mochi').setOrigin(0.5, 1).setScale(3);
    this.tweens.add({ targets: mochi, y: 88, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    addText(this, cx, 104, 'WASD move  Arrows shoot  E bomb  Esc pause', { tint: UI.muted });
    const prompt = addText(this, cx, 120, 'Press space', { scale: 2, tint: UI.gold });
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const best = Save.best();
    if (best.floor > 0) addText(this, cx, 138, `Best: floor ${best.floor}   Wins ${best.wins}`, { tint: UI.dim });
    addText(this, cx, 150, 'M mute sound', { tint: UI.dim });

    const start = () => {
      Audio.play('select');
      this.scene.start('Game', { seed: seedFromUrl() ?? newSeed() });
    };
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.keyboard.once('keydown-ENTER', start);
  }
}
