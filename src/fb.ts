import type { Screen } from "./screen.ts";

/**
 * Truecolor pixel framebuffer. Each terminal cell renders two vertically
 * stacked pixels via the upper-half-block glyph (fg = top px, bg = bottom px),
 * so a cols x rows play area becomes a cols x rows*2 pixel display.
 */
export class Fb {
  w = 0;
  h = 0;
  px = new Uint32Array(0);

  ensure(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.px = new Uint32Array(w * h);
  }

  clear(c: number): void {
    this.px.fill(c);
  }

  set(x: number, y: number, c: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy += 1) {
      const row = yy * this.w;
      for (let xx = x0; xx < x1; xx += 1) this.px[row + xx] = c;
    }
  }

  blit(screen: Screen, cellX: number, cellY: number): void {
    const cw = this.w;
    const cellRows = this.h >> 1;
    for (let cy = 0; cy < cellRows; cy += 1) {
      const top = cy * 2 * cw;
      const bottom = top + cw;
      for (let x = 0; x < cw; x += 1) {
        const a = this.px[top + x];
        const b = this.px[bottom + x];
        // Solid cells as plain spaces: fewer SGR changes, same look.
        if (a === b) screen.putPacked(cellX + x, cellY + cy, " ", a, a);
        else screen.putPacked(cellX + x, cellY + cy, "▀", a, b);
      }
    }
  }
}

export function lerpC(a: number, b: number, t: number): number {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (((ar + (br - ar) * t) | 0) << 16) |
    (((ag + (bg - ag) * t) | 0) << 8) |
    ((ab + (bb - ab) * t) | 0)
  );
}

/** Deterministic 2D hash in [0, 1) — stable textures anchored to world space. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
