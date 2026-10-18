import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
import { Audio } from './systems/Audio.js';
import { Boot } from './scenes/Boot.js';
import { Menu } from './scenes/Menu.js';
import { Game } from './scenes/Game.js';
import { HUD } from './scenes/HUD.js';
import { GameOver } from './scenes/GameOver.js';
import { Pause } from './scenes/Pause.js';

// Scale the 240x160 canvas by a whole number so every pixel stays square.
function integerZoom() {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1f1a24',
  pixelArt: true,
  scale: { mode: Phaser.Scale.NONE, zoom: integerZoom() },
  physics: {
    default: 'arcade',
    // Add ?debug to the URL to see hitboxes.
    arcade: { debug: new URLSearchParams(location.search).has('debug') },
  },
  // Later scenes draw on top: HUD over Game, Pause over both.
  scene: [Boot, Menu, Game, HUD, Pause, GameOver],
});

window.addEventListener('resize', () => game.scale.setZoom(integerZoom()));

// Browsers only allow sound after the player presses something. M toggles mute anywhere.
window.addEventListener('keydown', (event) => {
  Audio.unlock();
  if (event.code === 'KeyM' && !event.repeat) Audio.toggleMute();
});
window.addEventListener('pointerdown', () => Audio.unlock());
