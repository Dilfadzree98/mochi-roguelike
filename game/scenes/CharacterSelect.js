import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed, seedFromUrl } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { Audio } from '../systems/Audio.js';

const SPACING = 96;

// Pick who to play as. A/D or Left/Right to choose, Space/Enter to start, Esc to go back.
export class CharacterSelect extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.characters = this.cache.json.get('characters');
    this.selected = Math.max(0, this.characters.findIndex((c) => c.id === Save.lastCharacter()));

    addText(this, cx, 20, 'Choose your Mochi', { scale: 2, tint: UI.peach });

    this.cards = this.characters.map((character, i) => {
      const x = cx + (i - (this.characters.length - 1) / 2) * SPACING;
      const shadow = this.add.image(x, 98, 'shadow').setScale(3).setAlpha(0.3);
      const sprite = this.add.image(x, 100, character.texture).setOrigin(0.5, 1).setScale(4);
      const name = addText(this, x, 112, character.name);
      const description = addText(this, x, 122, character.description, { tint: UI.muted });
      return { x, shadow, sprite, name, description };
    });
    this.cursor = addText(this, 0, 60, '>', { scale: 2, tint: UI.gold });

    addText(this, cx, 150, 'A/D choose   Space start   Esc back', { tint: UI.dim });
    this.refresh();

    const keyboard = this.input.keyboard;
    const move = (step) => {
      this.selected = (this.selected + step + this.characters.length) % this.characters.length;
      Audio.play('select');
      this.refresh();
    };
    for (const key of ['A', 'LEFT']) keyboard.on(`keydown-${key}`, () => move(-1));
    for (const key of ['D', 'RIGHT']) keyboard.on(`keydown-${key}`, () => move(1));
    keyboard.once('keydown-SPACE', () => this.start());
    keyboard.once('keydown-ENTER', () => this.start());
    keyboard.once('keydown-ESC', () => this.scene.start('Menu'));
  }

  // The chosen one hops and its name turns gold; the other waits, faded.
  refresh() {
    this.cards.forEach((card, i) => {
      const chosen = i === this.selected;
      this.tweens.killTweensOf(card.sprite);
      card.sprite.setY(100).setAlpha(chosen ? 1 : 0.45);
      card.shadow.setAlpha(chosen ? 0.3 : 0.15);
      card.name.setTint(chosen ? UI.gold : 0xffffff).setAlpha(chosen ? 1 : 0.6);
      card.description.setAlpha(chosen ? 1 : 0.5);
      if (chosen) this.tweens.add({ targets: card.sprite, y: 94, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.cursor.setX(this.cards[this.selected].x - 40);
  }

  start() {
    const character = this.characters[this.selected];
    Save.setLastCharacter(character.id);
    Audio.play('select');
    this.scene.start('Game', { seed: seedFromUrl() ?? newSeed(), character: character.id });
  }
}
