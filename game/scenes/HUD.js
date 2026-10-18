import { GAME_WIDTH, HUD_HEIGHT, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';

const HEART_KEYS = ['heart_empty', 'heart_half', 'heart_full'];

// Top bar: hearts and wave number. Runs on top of the Game scene and listens to its events.
export class HUD extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    const game = this.scene.get('Game');
    this.add.rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x1f1a24).setOrigin(0);
    this.hearts = [];
    this.waveText = addText(this, GAME_WIDTH - 5, HUD_HEIGHT / 2, '', { originX: 1, tint: UI.muted });

    const onHp = (hp, maxHp) => this.drawHearts(hp, maxHp);
    const onWave = (wave) => this.waveText.setText(wave > 0 ? `WAVE ${wave}` : '');
    game.events.on('hp', onHp);
    game.events.on('wave', onWave);
    this.events.once('shutdown', () => {
      game.events.off('hp', onHp);
      game.events.off('wave', onWave);
    });

    onHp(game.player.hp, game.player.stats.maxHp);
    onWave(game.wave);
  }

  drawHearts(hp, maxHp) {
    this.hearts.forEach((heart) => heart.destroy());
    this.hearts = Array.from({ length: Math.ceil(maxHp / 2) }, (_, i) => {
      const fill = Phaser.Math.Clamp(hp - i * 2, 0, 2);
      return this.add.image(5 + i * 9, 5, HEART_KEYS[fill]).setOrigin(0);
    });
  }
}
