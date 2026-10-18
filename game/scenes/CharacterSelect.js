import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed, seedFromUrl } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { Audio } from '../systems/Audio.js';
import { computeStats } from '../systems/Items.js';
import { BASE_STATS } from '../entities/Player.js';

const SPACING = 112;
const MAX_PIPS = 5;

// Stats shown as 1-5 pips; 3 is the base Mochi. `step` is how much one pip is worth.
const STAT_ROWS = [
  { label: 'Damage', rating: (s) => 3 + (s.damage - BASE_STATS.damage) / 0.25 },
  { label: 'Speed', rating: (s) => 3 + (s.speed - BASE_STATS.speed) / 7 },
  { label: 'Fire rate', rating: (s) => 3 + (BASE_STATS.fireDelay - s.fireDelay) / 32 },
];

// Pick who to play as. A/D or Left/Right to choose, Space/Enter to start, Esc to go back.
export class CharacterSelect extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.characters = this.cache.json.get('characters');
    this.selected = Math.max(0, this.characters.findIndex((c) => c.id === Save.lastCharacter()));

    addText(this, cx, 10, 'Choose your Mochi', { scale: 2, tint: UI.peach });
    this.cards = this.characters.map((character, i) => this.makeCard(character, cx + (i - (this.characters.length - 1) / 2) * SPACING));
    this.cursor = addText(this, 0, 44, '>', { scale: 2, tint: UI.gold });
    addText(this, cx, 152, 'A/D choose   Space start   Esc back', { tint: UI.dim });
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

  // Portrait, name, description, stats and skill for one character.
  makeCard(character, x) {
    const stats = computeStats(BASE_STATS, [character]);
    const parts = [];
    const add = (obj) => {
      parts.push(obj);
      return obj;
    };
    const left = x - 46;
    const pipsX = x + 6;

    const shadow = add(this.add.image(x, 64, 'shadow').setScale(3).setAlpha(0.3));
    const sprite = add(this.add.image(x, 66, character.texture).setOrigin(0.5, 1).setScale(3));
    const name = add(addText(this, x, 74, character.name));
    add(addText(this, x, 83, character.description, { tint: UI.muted }));

    add(addText(this, left, 94, 'Hearts', { originX: 0, tint: UI.muted }));
    for (let i = 0; i < stats.maxHp / 2; i++) add(this.add.image(pipsX + 3 + i * 8, 94, 'heart_full'));

    const pips = add(this.add.graphics());
    STAT_ROWS.forEach((row, r) => {
      const y = 102 + r * 8;
      add(addText(this, left, y, row.label, { originX: 0, tint: UI.muted }));
      const filled = Phaser.Math.Clamp(Math.round(row.rating(stats)), 1, MAX_PIPS);
      for (let p = 0; p < MAX_PIPS; p++) {
        pips.fillStyle(p < filled ? 0xa6d987 : 0x3b2b33, 1).fillRect(pipsX + p * 6, y - 2, 5, 4);
      }
    });

    const { skill } = character;
    add(this.add.image(left + 3, 129, skill.icon));
    add(addText(this, left + 9, 129, skill.name, { originX: 0, tint: UI.gold }));
    add(addText(this, left, 138, skill.description, { originX: 0, tint: UI.muted }));

    return { x, sprite, shadow, name, parts };
  }

  // The chosen one hops and its name turns gold; the other waits, faded.
  refresh() {
    this.cards.forEach((card, i) => {
      const chosen = i === this.selected;
      this.tweens.killTweensOf(card.sprite);
      card.sprite.setY(66);
      card.parts.forEach((part) => part.setAlpha(chosen ? 1 : 0.4));
      card.shadow.setAlpha(chosen ? 0.3 : 0.12);
      card.name.setTint(chosen ? UI.gold : 0xffffff);
      if (chosen) this.tweens.add({ targets: card.sprite, y: 61, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.cursor.setX(this.cards[this.selected].x - 54);
  }

  start() {
    const character = this.characters[this.selected];
    Save.setLastCharacter(character.id);
    Audio.play('select');
    this.scene.start('Game', { seed: seedFromUrl() ?? newSeed(), character: character.id });
  }
}
