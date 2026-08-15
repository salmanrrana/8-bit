const ESC = "\x1b[";

export type Rgb = { r: number; g: number; b: number };

export function hexRgb(hex: string): Rgb {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function pack(rgb: Rgb): number {
  return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
}

export class Screen {
  cols: number;
  rows: number;
  private ch: string[];
  private fg: Uint32Array;
  private bg: Uint32Array;
  private prevCh: string[];
  private prevFg: Uint32Array;
  private prevBg: Uint32Array;
  private first = true;
  private parts: string[] = [];

  constructor(cols: number, rows: number) {
    this.cols = Math.max(40, cols);
    this.rows = Math.max(16, rows);
    const n = this.cols * this.rows;
    this.ch = new Array(n).fill(" ");
    this.fg = new Uint32Array(n);
    this.bg = new Uint32Array(n);
    this.prevCh = new Array(n).fill("");
    this.prevFg = new Uint32Array(n);
    this.prevBg = new Uint32Array(n);
  }

  resize(cols: number, rows: number): void {
    const nextCols = Math.max(40, cols);
    const nextRows = Math.max(16, rows);
    if (nextCols === this.cols && nextRows === this.rows) return;
    this.cols = nextCols;
    this.rows = nextRows;
    const n = nextCols * nextRows;
    this.ch = new Array(n).fill(" ");
    this.fg = new Uint32Array(n);
    this.bg = new Uint32Array(n);
    this.prevCh = new Array(n).fill("");
    this.prevFg = new Uint32Array(n);
    this.prevBg = new Uint32Array(n);
    this.first = true;
  }

  clear(bg: Rgb): void {
    const packed = pack(bg);
    const n = this.ch.length;
    for (let i = 0; i < n; i += 1) {
      this.ch[i] = " ";
      this.fg[i] = 0xffffff;
      this.bg[i] = packed;
    }
  }

  put(x: number, y: number, glyph: string, fg: Rgb, bg: Rgb): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = glyph[0] ?? " ";
    this.fg[i] = pack(fg);
    this.bg[i] = pack(bg);
  }

  /** Same as put, but with pre-packed 0xRRGGBB colors (framebuffer fast path). */
  putPacked(x: number, y: number, glyph: string, fg: number, bg: number): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = glyph;
    this.fg[i] = fg;
    this.bg[i] = bg;
  }

  fill(x: number, y: number, w: number, h: number, glyph: string, fg: Rgb, bg: Rgb): void {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.cols, x + w);
    const y1 = Math.min(this.rows, y + h);
    const packedFg = pack(fg);
    const packedBg = pack(bg);
    const g = glyph[0] ?? " ";
    for (let yy = y0; yy < y1; yy += 1) {
      const row = yy * this.cols;
      for (let xx = x0; xx < x1; xx += 1) {
        const i = row + xx;
        this.ch[i] = g;
        this.fg[i] = packedFg;
        this.bg[i] = packedBg;
      }
    }
  }

  write(x: number, y: number, text: string, fg: Rgb, bg: Rgb): void {
    for (let i = 0; i < text.length; i += 1) this.put(x + i, y, text[i], fg, bg);
  }

  /** Draw a glyph without punching a background rectangle through the sky. */
  stamp(x: number, y: number, glyph: string, fg: Rgb): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = glyph[0] ?? " ";
    this.fg[i] = pack(fg);
  }

  /** Diff against the last flush and write only changed runs. */
  flush(out: NodeJS.WriteStream): void {
    const { cols, rows } = this;
    const parts = this.parts;
    parts.length = 0;
    if (this.first) {
      parts.push(`${ESC}2J${ESC}H`);
      this.first = false;
    }

    let lastFg = -1;
    let lastBg = -1;
    let pendingX = -1;
    let pendingY = -1;

    for (let y = 0; y < rows; y += 1) {
      const row = y * cols;
      for (let x = 0; x < cols; x += 1) {
        const i = row + x;
        const glyph = this.ch[i];
        const fg = this.fg[i];
        const bg = this.bg[i];
        if (this.prevCh[i] === glyph && this.prevFg[i] === fg && this.prevBg[i] === bg) {
          pendingX = -1;
          continue;
        }
        this.prevCh[i] = glyph;
        this.prevFg[i] = fg;
        this.prevBg[i] = bg;

        if (pendingX !== x || pendingY !== y) {
          parts.push(`${ESC}${y + 1};${x + 1}H`);
          pendingX = x;
          pendingY = y;
        }
        if (fg !== lastFg) {
          parts.push(`${ESC}38;2;${fg >> 16};${(fg >> 8) & 255};${fg & 255}m`);
          lastFg = fg;
        }
        if (bg !== lastBg) {
          parts.push(`${ESC}48;2;${bg >> 16};${(bg >> 8) & 255};${bg & 255}m`);
          lastBg = bg;
        }
        parts.push(glyph);
        pendingX = x + 1;
      }
      pendingX = -1;
    }

    if (parts.length > 0) {
      parts.push(`${ESC}0m`);
      out.write(parts.join(""));
    }
  }
}

export function enterAlt(out: NodeJS.WriteStream): void {
  out.write(`${ESC}?1049h${ESC}?25l${ESC}0m`);
}

export function leaveAlt(out: NodeJS.WriteStream): void {
  out.write(`${ESC}?25h${ESC}0m${ESC}?1049l`);
}
