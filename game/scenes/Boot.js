import { makeTextures } from '../art/Sprites.js';
import { makeFont } from '../art/PixelFont.js';

// Loads data and builds textures once, then hands over to the menu.
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('enemies', 'data/enemies.json');
    this.load.json('items', 'data/items.json');
    this.load.json('floors', 'data/floors.json');
    this.load.json('characters', 'data/characters.json');
  }

  create() {
    makeTextures(this, { floors: this.cache.json.get('floors'), items: this.cache.json.get('items') });
    makeFont(this);
    this.scene.start('Menu');
  }
}
