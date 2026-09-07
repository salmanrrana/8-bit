import { constants, deflateSync } from "node:zlib";
import { Fb } from "./fb.ts";
import { Screen, type Rgb } from "./screen.ts";
import { drawGame, layoutScale } from "./draw.ts";
import { ArcadeCanvas } from "./arcade-canvas.ts";
import { createArt } from "./brawler-art.ts";
import type { Game } from "./game.ts";
import { pixelText } from "./pixel-font.ts";

const CELL_W = 8,
  CELL_H = 15;
const pack = (c: Rgb) => (c.r << 16) | (c.g << 8) | c.b;

/** The existing menus/HUD paint into the same full-resolution image as combat. */
class ImageScreen extends Screen {
  readonly image: Fb;
  constructor(image: Fb) {
    super(120, 40);
    this.image = image;
    image.ensure(960, 600);
  }
  override clear(bg: Rgb): void {
    this.image.clear(pack(bg));
  }
  override put(x: number, y: number, glyph: string, fg: Rgb, bg: Rgb): void {
    this.putPacked(x, y, glyph, pack(fg), pack(bg));
  }
  override putPacked(
    x: number,
    y: number,
    glyph: string,
    fg: number,
    bg: number,
  ): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    this.image.rect(x * CELL_W, y * CELL_H, CELL_W, CELL_H, bg);
    if (glyph === "▀")
      this.image.rect(x * CELL_W, y * CELL_H, CELL_W, CELL_H / 2, fg);
    else if (glyph !== " ")
      pixelText(
        this.image,
        glyph,
        x * CELL_W + 1,
        y * CELL_H + 3,
        9,
        fg,
        CELL_W,
      );
  }
  override fill(
    x: number,
    y: number,
    w: number,
    h: number,
    glyph: string,
    fg: Rgb,
    bg: Rgb,
  ): void {
    this.image.rect(x * CELL_W, y * CELL_H, w * CELL_W, h * CELL_H, pack(bg));
    if (glyph !== " ")
      for (let row = y; row < y + h; row++)
        for (let col = x; col < x + w; col++) this.put(col, row, glyph, fg, bg);
  }
  override stamp(x: number, y: number, glyph: string, fg: Rgb): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    pixelText(
      this.image,
      glyph,
      x * CELL_W + 1,
      y * CELL_H + 3,
      9,
      pack(fg),
      CELL_W,
    );
  }
}

export class HdRenderer {
  readonly frame = new Fb();
  private screen = new ImageScreen(this.frame);
  private scene = new Fb();
  readonly scale = layoutScale(this.screen.cols, this.screen.rows);

  draw(game: Game): Fb {
    drawGame(this.screen, game, this.scale, () => {
      if (!game.brawler) return;
      this.scene.ensure(960, 540);
      createArt(new ArcadeCanvas(this.scene, true)).draw(game.brawler.state);
      // Preserve the arcade's 16:9 scene; the HUD and controls occupy the margins.
      const offset = 37 * this.frame.w;
      this.frame.px.set(this.scene.px, offset);
    });
    return this.frame;
  }
}

export function rgbBytes(fb: Fb): Buffer {
  const rgb = Buffer.allocUnsafe(fb.px.length * 3);
  for (let i = 0; i < fb.px.length; i++) {
    const c = fb.px[i];
    rgb[i * 3] = c >> 16;
    rgb[i * 3 + 1] = (c >> 8) & 255;
    rgb[i * 3 + 2] = c & 255;
  }
  return rgb;
}

// PNG is also the local viewer transport. No image package or native dependency.
export function pngBytes(fb: Fb): Buffer {
  const stride = fb.w * 3,
    rgb = rgbBytes(fb),
    scan = Buffer.alloc((stride + 1) * fb.h);
  for (let y = 0; y < fb.h; y++)
    rgb.copy(scan, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(fb.w, 0);
  header.writeUInt32BE(fb.h, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scan, { level: 1, strategy: constants.Z_RLE })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit++)
    crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]),
    result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  let crc = 0xffffffff;
  for (let i = 0; i < body.length; i++)
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ body[i]) & 255];
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
