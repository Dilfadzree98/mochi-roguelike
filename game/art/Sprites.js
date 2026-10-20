import { Rng } from '../systems/Rng.js';
import { makeCharacterTextures } from './Characters.js';
import { makeEnemyTextures } from './Enemies.js';
import { makeCritterTextures, makeMiniBossTextures } from './Critters.js';
import { makeItemTextures } from './Items.js';
import { makeWorldTextures } from './World.js';

// Placeholder pixel art drawn in code (see Pixels.js), so the game runs without image files.
// Sprites follow one style: built at the game's 480x272 resolution, characters about 40x40,
// with a 2px dark outline. To use real art later, load PNGs in Boot.preload under the same
// texture keys; anything already loaded is skipped here.
export function makeTextures(scene, { floors, items }) {
  makeCharacterTextures(scene);
  makeEnemyTextures(scene);
  makeCritterTextures(scene);
  makeMiniBossTextures(scene);
  makeItemTextures(scene, items);
  // Fixed seed: tiles look the same every run. Run randomness only decides placement.
  makeWorldTextures(scene, floors, new Rng(20261018));
}
