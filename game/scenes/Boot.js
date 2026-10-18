import { makeTextures } from '../art/Sprites.js';
import { makeFont } from '../art/PixelFont.js';

// Loads data and builds textures once, then hands over to the menu.
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.json('enemies', 'data/enemies.json');
  }

  create() {
    makeTextures(this);
    makeFont(this);
    this.scene.start('Menu');
  }
}
