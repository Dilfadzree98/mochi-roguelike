import { GAME_WIDTH, UI } from '../constants.js';
import { addText } from '../art/PixelFont.js';
import { newSeed, seedFromUrl } from '../systems/Rng.js';
import { Save } from '../systems/Save.js';
import { Audio } from '../systems/Audio.js';
import { computeStats } from '../systems/Items.js';
import { BASE_STATS } from '../entities/Player.js';

const SPACING = 224;
const MAX_PIPS = 5;

// Stats shown as 1-5 pips; 3 is the base Mochi. `step` is how much one pip is worth.
const STAT_ROWS = [
  { label: 'Damage', rating: (s) => 3 + (s.damage - BASE_STATS.damage) / 0.25 },
  { label: 'Speed', rating: (s) => 3 + (s.speed - BASE_STATS.speed) / 14 },
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

    addText(this, cx, 14, 'Choose your Mochi', { scale: 4, tint: UI.peach });
    this.cards = this.characters.map((character, i) => this.makeCard(character, cx + (i - (this.characters.length - 1) / 2) * SPACING));
    this.cursor = addText(this, 0, 82, '>', { scale: 4, tint: UI.gold });
    addText(this, cx, 262, '[A/D] choose, [Space] start, [Esc] back', { tint: UI.dim });
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
    const left = x - 92;
    const pipsX = x + 12;

    const shadow = add(this.add.image(x, 118, 'shadow').setScale(3).setAlpha(0.3));
    const sprite = add(this.add.image(x, 120, character.texture).setOrigin(0.5, 1).setScale(2));
    const name = add(addText(this, x, 132, character.name));
    add(addText(this, x, 146, character.description, { tint: UI.muted }));

    add(addText(this, left, 162, 'Hearts', { originX: 0, tint: UI.muted }));
    for (let i = 0; i < stats.maxHp / 2; i++) add(this.add.image(pipsX + 8 + i * 18, 162, 'heart_full'));

    const pips = add(this.add.graphics());
    STAT_ROWS.forEach((row, r) => {
      const y = 178 + r * 14;
      add(addText(this, left, y, row.label, { originX: 0, tint: UI.muted }));
      const filled = Phaser.Math.Clamp(Math.round(row.rating(stats)), 1, MAX_PIPS);
      for (let p = 0; p < MAX_PIPS; p++) {
        pips.fillStyle(p < filled ? 0xa6d987 : 0x3b2b33, 1).fillRect(pipsX + p * 14, y - 4, 12, 8);
      }
    });

    const { skill } = character;
    add(this.add.image(left + 8, 224, skill.icon));
    add(addText(this, left + 20, 224, skill.name, { originX: 0, tint: UI.gold }));
    add(addText(this, left, 240, skill.description, { originX: 0, tint: UI.muted }));

    return { x, sprite, shadow, name, parts };
  }

  // The chosen one hops and its name turns gold; the other waits, faded.
  refresh() {
    this.cards.forEach((card, i) => {
      const chosen = i === this.selected;
      this.tweens.killTweensOf(card.sprite);
      card.sprite.setY(120);
      card.parts.forEach((part) => part.setAlpha(chosen ? 1 : 0.4));
      card.shadow.setAlpha(chosen ? 0.3 : 0.12);
      card.name.setTint(chosen ? UI.gold : 0xffffff);
      if (chosen) this.tweens.add({ targets: card.sprite, y: 114, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.cursor.setX(this.cards[this.selected].x - 104);
  }

  start() {
    const character = this.characters[this.selected];
    Save.setLastCharacter(character.id);
    Audio.play('select');
    this.scene.start('Game', { seed: seedFromUrl() ?? newSeed(), character: character.id });
  }
}
