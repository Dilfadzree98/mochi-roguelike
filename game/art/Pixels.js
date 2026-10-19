// A tiny software canvas for drawing sprites in code, pixel by pixel, with hard edges
// (no anti-aliasing). Sprites are built from simple shapes, shaded with `inside`, and
// finished with a 2px dark outline, so they all share one chunky look.

export const OUTLINE = '#1E1418';

export class Pixels {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.pixels = new Array(width * height).fill(null);
    this.clipped = false;
    this.ox = 0; // drawing offset: `paint` draws on a padded canvas
    this.oy = 0;
  }

  set(x, y, color) {
    x = Math.floor(x) + this.ox;
    y = Math.floor(y) + this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.clipped && this.pixels[i] === null) return;
    this.pixels[i] = color;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.pixels[y * this.w + x];
  }

  px(x, y, color) {
    this.set(x, y, color);
  }

  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }

  // Filled ellipse; a pixel is in if its centre is. `clip` limits it to part of the canvas.
  ellipse(cx, cy, rx, ry, color, clip = {}) {
    const { top = -Infinity, bottom = Infinity, left = -Infinity, right = Infinity } = clip;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      if (y < top || y > bottom) continue;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (x < left || x > right) continue;
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color);
      }
    }
  }

  circle(cx, cy, r, color, clip) {
    this.ellipse(cx, cy, r, r, color, clip);
  }

  // Filled polygon from [[x, y], ...] corner points.
  poly(points, color) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const sy = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, color);
      }
    }
  }

  // A line `width` pixels thick.
  line(x0, y0, x1, y1, color, width = 2) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    const half = Math.floor(width / 2);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      this.rect(x - half, y - half, width, width, color);
    }
  }

  // A line through several points.
  path(points, color, width = 2) {
    for (let i = 0; i + 1 < points.length; i++) this.line(...points[i], ...points[i + 1], color, width);
  }

  // Draw only over pixels that are already painted (for shading and details inside a shape).
  inside(draw) {
    this.clipped = true;
    draw();
    this.clipped = false;
  }

  // An ellipse with a darker lower-right edge and a small light spot at the top-left.
  blob(cx, cy, rx, ry, { base, dark, light }, clip) {
    this.ellipse(cx, cy, rx, ry, dark, clip);
    this.inside(() => {
      this.ellipse(cx - rx * 0.12, cy - ry * 0.16, rx * 0.9, ry * 0.82, base, clip);
      if (light) this.ellipse(cx - rx * 0.42, cy - ry * 0.45, rx * 0.28, ry * 0.22, light, clip);
    });
  }

  erase(x, y, w = 1, h = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (px >= 0 && py >= 0 && px < this.w && py < this.h) this.pixels[py * this.w + px] = null;
    }
  }

  // A rounded outline around everything painted so far.
  outline(color = OUTLINE, width = 2) {
    const source = this.pixels.slice();
    const reach = [];
    for (let dy = -width; dy <= width; dy++) {
      for (let dx = -width; dx <= width; dx++) if (dx * dx + dy * dy <= width * width + 1) reach.push([dx, dy]);
    }
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (source[y * this.w + x] !== null) continue;
        for (const [dx, dy] of reach) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && source[ny * this.w + nx] !== null) {
            this.pixels[y * this.w + x] = color;
            break;
          }
        }
      }
    }
  }

  // Smallest box around everything painted.
  bounds() {
    let left = this.w;
    let top = this.h;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.pixels[y * this.w + x] === null) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    return right < 0 ? { left: 0, top: 0, width: 1, height: 1 } : { left, top, width: right - left + 1, height: bottom - top + 1 };
  }

  toTexture(scene, key, box = { left: 0, top: 0, width: this.w, height: this.h }) {
    const texture = scene.textures.createCanvas(key, box.width, box.height);
    const ctx = texture.getContext();
    const image = ctx.createImageData(box.width, box.height);
    for (let y = 0; y < box.height; y++) {
      for (let x = 0; x < box.width; x++) {
        const color = this.pixels[(y + box.top) * this.w + x + box.left];
        if (color !== null) image.data.set(parseColor(color), (y * box.width + x) * 4);
      }
    }
    ctx.putImageData(image, 0, 0);
    texture.refresh();
  }
}

const colorCache = new Map();
function parseColor(color) {
  if (!colorCache.has(color)) {
    const hex = color.replace('#', '');
    const n = parseInt(hex.slice(0, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
    colorCache.set(color, [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]);
  }
  return colorCache.get(color);
}

const PAD = 8;

// Draws a sprite into a new texture (skipped if the key already exists, e.g. a loaded PNG).
// Designs use coordinates in a width x height box; the canvas has room around it for
// the outline, and the texture is cropped to what was painted, so a sprite's feet are
// always on its bottom edge. `outline: null` leaves it without an outline (particles,
// floor details); `crop: false` keeps the exact size (tiles).
export function paint(scene, key, width, height, draw, { outline = OUTLINE, outlineWidth = 2, crop = true } = {}) {
  if (scene.textures.exists(key)) return;
  const pad = crop ? PAD : 0;
  const canvas = new Pixels(width + pad * 2, height + pad * 2);
  canvas.ox = pad;
  canvas.oy = pad;
  draw(canvas);
  if (outline) canvas.outline(outline, outlineWidth);
  canvas.toTexture(scene, key, crop ? canvas.bounds() : undefined);
}
