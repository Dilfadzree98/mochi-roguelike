// Which keys are physically held right now. Tracked on the window rather than in a scene,
// so it stays right while the Game scene is paused (a paused scene misses key-up events).
const held = new Set();

window.addEventListener('keydown', (event) => held.add(event.keyCode));
window.addEventListener('keyup', (event) => held.delete(event.keyCode));
// Key-ups go to another window while this one is in the background, so start fresh.
window.addEventListener('blur', () => held.clear());

export const isHeld = (keyCode) => held.has(keyCode);
