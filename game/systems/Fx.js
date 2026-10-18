// Hit feedback: turn a sprite solid white for a moment.
export function flashWhite(scene, image, ms = 60) {
  image.setTintFill(0xffffff);
  scene.time.delayedCall(ms, () => {
    if (image.active) image.clearTint();
  });
}
