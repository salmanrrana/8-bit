import { glyph } from "./pixel-font.ts";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import type { Screen } from "./screen.ts";
import { Fb, lerpC } from "./fb.ts";

export type Point = [number, number];
type Matrix = [number, number, number, number, number, number];
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];

// The source artwork uses a small subset of Canvas 2D. Rasterize its original
// paths at either full image or terminal-cell resolution, using only Node.js.
export class ArcadeCanvas {
  readonly canvas: { width: number; height: number };
  fillStyle = "#000000";
  strokeStyle = "#000000";
  globalAlpha = 1;
  lineWidth = 1;
  lineJoin = "round";
  font = "11px";
  textAlign = "left";
  private labels: Array<{
    value: string;
    x: number;
    y: number;
    color: number;
    behind: number[];
  }> = [];
  private matrix = identity();
  private path: Point[] = [];
  private stack: Array<{
    matrix: Matrix;
    fill: string;
    stroke: string;
    alpha: number;
    width: number;
    font: string;
    align: string;
  }> = [];

  readonly fb: Fb;
  readonly imageText: boolean;
  constructor(fb: Fb, imageText = false) {
    this.fb = fb;
    this.imageText = imageText;
    this.canvas = { width: fb.w, height: fb.h };
  }
  save(): void {
    this.stack.push({
      matrix: [...this.matrix],
      fill: this.fillStyle,
      stroke: this.strokeStyle,
      alpha: this.globalAlpha,
      width: this.lineWidth,
      font: this.font,
      align: this.textAlign,
    });
  }
  restore(): void {
    const s = this.stack.pop();
    if (!s) return;
    this.matrix = s.matrix;
    this.fillStyle = s.fill;
    this.strokeStyle = s.stroke;
    this.globalAlpha = s.alpha;
    this.lineWidth = s.width;
    this.font = s.font;
    this.textAlign = s.align;
  }
  setTransform(...m: Matrix): void {
    this.matrix = m;
  }
  translate(x: number, y: number): void {
    const m = this.matrix;
    m[4] += m[0] * x + m[2] * y;
    m[5] += m[1] * x + m[3] * y;
  }
  scale(x: number, y: number): void {
    const m = this.matrix;
    m[0] *= x;
    m[1] *= x;
    m[2] *= y;
    m[3] *= y;
  }
  rotate(angle: number): void {
    const [a, b, c, d, e, f] = this.matrix,
      co = Math.cos(angle),
      si = Math.sin(angle);
    this.matrix = [
      a * co + c * si,
      b * co + d * si,
      c * co - a * si,
      d * co - b * si,
      e,
      f,
    ];
  }
  private point(x: number, y: number): Point {
    const [a, b, c, d, e, f] = this.matrix;
    return [a * x + c * y + e, b * x + d * y + f];
  }
  beginPath(): void {
    this.path = [];
  }
  moveTo(x: number, y: number): void {
    this.path.push(this.point(x, y));
  }
  lineTo(x: number, y: number): void {
    this.path.push(this.point(x, y));
  }
  closePath(): void {
    /* Fill and stroke close the authored polygons. */
  }
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ): void {
    for (let i = 0; i <= 32; i++) {
      const a = start + ((end - start) * i) / 32,
        dx = Math.cos(a) * rx,
        dy = Math.sin(a) * ry;
      this.lineTo(
        x + dx * Math.cos(rotation) - dy * Math.sin(rotation),
        y + dx * Math.sin(rotation) + dy * Math.cos(rotation),
      );
    }
  }
  arc(x: number, y: number, r: number, start: number, end: number): void {
    this.ellipse(x, y, r, r, 0, start, end);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.paint(
      [
        this.point(x, y),
        this.point(x + w, y),
        this.point(x + w, y + h),
        this.point(x, y + h),
      ],
      this.fillStyle,
    );
  }
  clearRect(_x: number, _y: number, _w: number, _h: number): void {
    this.fb.clear(0x141922);
  }
  fill(): void {
    this.paint(this.path, this.fillStyle);
  }
  stroke(): void {
    const [a, b, c, d] = this.matrix;
    const radius = (this.lineWidth * (Math.hypot(a, b) + Math.hypot(c, d))) / 4;
    for (let i = 0; i < this.path.length; i++) {
      const p = this.path[i],
        q = this.path[(i + 1) % this.path.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
        dx = ((q[1] - p[1]) / len) * radius,
        dy = ((p[0] - q[0]) / len) * radius;
      this.paint(
        [
          [p[0] + dx, p[1] + dy],
          [q[0] + dx, q[1] + dy],
          [q[0] - dx, q[1] - dy],
          [p[0] - dx, p[1] - dy],
        ],
        this.strokeStyle,
      );
    }
  }
  private paint(points: Point[], style: string): void {
    if (points.length < 3) return;
    const color = parseInt(style.slice(1, 7), 16),
      alpha =
        this.globalAlpha *
        (style.length === 9 ? parseInt(style.slice(7), 16) / 255 : 1);
    const y0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1])))),
      y1 = Math.min(this.fb.h, Math.ceil(Math.max(...points.map((p) => p[1]))));
    for (let y = y0; y < y1; y++) {
      const crossings: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const p = points[i],
          q = points[(i + 1) % points.length],
          sy = y + 0.5;
        if ((p[1] <= sy && q[1] > sy) || (q[1] <= sy && p[1] > sy))
          crossings.push(p[0] + ((sy - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const x0 = Math.max(0, Math.ceil(crossings[i] - 0.5)),
          x1 = Math.min(this.fb.w, Math.ceil(crossings[i + 1] - 0.5));
        for (let x = x0; x < x1; x++)
          this.fb.set(
            x,
            y,
            alpha >= 1 ? color : lerpC(this.fb.get(x, y), color, alpha),
          );
      }
    }
  }
  drawImage(
    image: CityImage,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const origin = this.point(x, y),
      end = this.point(x + w, y + h);
    const x0 = Math.max(0, Math.floor(origin[0])),
      x1 = Math.min(this.fb.w, Math.ceil(end[0]));
    const y0 = Math.max(0, Math.floor(origin[1])),
      y1 = Math.min(this.fb.h, Math.ceil(end[1]));
    for (let py = y0; py < y1; py++)
      for (let px = x0; px < x1; px++) {
        const sx = Math.max(
          0,
          Math.min(
            image.naturalWidth - 1,
            Math.floor(
              ((px + 0.5 - origin[0]) / (end[0] - origin[0])) *
                image.naturalWidth,
            ),
          ),
        );
        const sy = Math.max(
          0,
          Math.min(
            image.naturalHeight - 1,
            Math.floor(
              ((py + 0.5 - origin[1]) / (end[1] - origin[1])) *
                image.naturalHeight,
            ),
          ),
        );
        const i = (sy * image.naturalWidth + sx) * 3;
        this.fb.set(
          px,
          py,
          (image.data[i] << 16) | (image.data[i + 1] << 8) | image.data[i + 2],
        );
      }
  }
  fillText(value: string, x: number, y: number, maxWidth = Infinity): void {
    if (this.imageText) {
      this.drawImageText(value, x, y, maxWidth);
      return;
    }
    // Terminal glyphs retain the source signs and hit feedback at low resolution.
    // Remember their backdrop so later actors can still occlude the lettering.
    const [px, py] = this.point(x, y);
    const width = Math.min(
      this.fb.w,
      Math.floor(maxWidth * Math.abs(this.matrix[0])),
    );
    const text = value.slice(0, width);
    const left = Math.round(
      px -
        (this.textAlign === "center"
          ? text.length / 2
          : this.textAlign === "right"
            ? text.length
            : 0),
    );
    const row = Math.floor(py / 2) - 1;
    const behind = Array.from({ length: text.length * 2 }, (_, i) =>
      this.fb.get(left + Math.floor(i / 2), row * 2 + (i % 2)),
    );
    this.labels.push({
      value: text,
      x: left,
      y: row,
      color: parseInt(this.fillStyle.slice(1, 7), 16),
      behind,
    });
  }
  private drawImageText(
    value: string,
    x: number,
    y: number,
    maxWidth = Infinity,
    outline = false,
  ): void {
    const height = Number(this.font.match(/[\d.]+/)?.[0] ?? 11);
    const unit = Math.min(height / 7, maxWidth / Math.max(1, value.length * 6));
    const width = value.length * 6 * unit;
    const left =
      x -
      (this.textAlign === "center"
        ? width / 2
        : this.textAlign === "right"
          ? width
          : 0);
    const previous = this.fillStyle;
    if (outline) this.fillStyle = this.strokeStyle;
    for (const [i, ch] of [...value].entries())
      for (const [row, bits] of glyph(ch).entries())
        for (let col = 0; col < 5; col++) {
          if (bits & (1 << (4 - col))) {
            const pad = outline ? this.lineWidth / 2 : 0;
            this.fillRect(
              left + i * 6 * unit + col * unit - pad,
              y - 7 * unit + row * unit - pad,
              unit + pad * 2,
              unit + pad * 2,
            );
          }
        }
    this.fillStyle = previous;
  }
  strokeText(value: string, x: number, y: number): void {
    if (this.imageText) this.drawImageText(value, x, y, Infinity, true);
  }
  blitLabels(screen: Screen, x: number, y: number): void {
    for (const label of this.labels) {
      for (let i = 0; i < label.value.length; i++) {
        const px = label.x + i,
          py = label.y * 2;
        if (px < 0 || px >= this.fb.w || py < 0 || py + 1 >= this.fb.h)
          continue;
        if (
          this.fb.get(px, py) !== label.behind[i * 2] ||
          this.fb.get(px, py + 1) !== label.behind[i * 2 + 1]
        )
          continue;
        screen.stamp(x + px, y + label.y, label.value[i], {
          r: label.color >> 16,
          g: (label.color >> 8) & 255,
          b: label.color & 255,
        });
      }
    }
  }
}

type CityImage = {
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  data: Buffer;
};
let cachedCity: CityImage | undefined;
/** Load only when Level 6 first draws; the original RGB pixels are lossless. */
export function loadCity(): CityImage {
  if (!cachedCity) {
    const raw = inflateSync(
      readFileSync(
        new URL("../assets/brawler/city.rgb.deflate", import.meta.url),
      ),
    );
    cachedCity = {
      complete: true,
      naturalWidth: raw.readUInt32BE(0),
      naturalHeight: raw.readUInt32BE(4),
      data: raw.subarray(8),
    };
  }
  return cachedCity;
}
