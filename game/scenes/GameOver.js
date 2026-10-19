import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { Audio } from '../systems/Audio.js';
import { drawItemRow } from './Pause.js';

// End of a run, won (last floor's boss defeated) or lost.
export class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ won, roomsCleared, floor, floorName, bossName, seed, character, newBest, items = [] }) {
    const cx = GAME_WIDTH / 2;
    Audio.stopMusic();

    const firstName = character.name.split(' ')[0];
    addText(this, cx, 24, won ? 'Garden saved!' : `${firstName} wilted...`, { scale: 4, tint: won ? UI.gold : UI.peach });
    this.add.image(cx, 120, won ? character.texture : `${character.texture}_wilt`).setOrigin(0.5, 1).setScale(2);

    addText(this, cx, 134, won ? `${bossName} is beaten` : `Floor ${floor}: ${floorName}`);
    addText(this, cx, 148, `Rooms cleared ${roomsCleared}`, { tint: UI.muted });
    if (newBest) addText(this, cx, 162, 'New best!', { tint: UI.gold });
    else addText(this, cx, 162, `Best: floor ${Save.best().floor}`, { tint: UI.dim });
    drawItemRow(this, cx, 186, items, { rowGap: 24 });
    addText(this, cx, 250, `Seed ${seed}`, { tint: UI.dim });

    addText(this, cx, 264, '[Space] new run, [R] same seed, [Esc] menu', { tint: UI.muted });

    const keyboard = this.input.keyboard;
    keyboard.once('keydown-SPACE', () => this.scene.start('Game', { seed: newSeed(), character: character.id }));
    keyboard.once('keydown-R', () => this.scene.start('Game', { seed, character: character.id }));
    keyboard.once('keydown-ESC', () => this.scene.start('Menu'));
  }
}
