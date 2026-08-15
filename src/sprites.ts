import type { Fb } from "./fb.ts";
import type { EnemyType } from "./types.ts";

/**
 * Pixel art authored in world space (NES-ish scale). Rows are strings,
 * "." is transparent, every other char is a palette key.
 */
export type Art = string[];
export type Palette = Record<string, number>;

export function drawSprite(fb: Fb, x: number, y: number, rows: Art, pal: Palette, flip = false): void {
  const xi = x | 0;
  const yi = y | 0;
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[flip ? row.length - 1 - c : c];
      if (ch === ".") continue;
      const color = pal[ch];
      if (color === undefined) continue;
      fb.set(xi + c, yi + r, color);
    }
  }
}

// --- Player: 14x24, hooded Satoshi -----------------------------------------

const PLAYER_HEAD: Art = [
  "....hhhhhh....",
  "..hhhhhhhhhh..",
  ".hhhhhhhhhhhh.",
  ".hhffffffffhh.",
  ".hhfKffffKfhh.",
  ".hhffffffffhh.",
  ".hhfbbbbbbfhh.",
  "..hbbbbbbbbh..",
  "..oooooooooo..",
  ".oooooOOooooo.",
  ".oooooOOooooo.",
  ".sooooOOoooos.",
  ".soooooooooos.",
  "..oooooooooo..",
  "..ssppppppss..",
  "..pppppppppp..",
  "..pppppppppp..",
  "..pppppppppp.."
];

const LEGS_IDLE: Art = [
  "..ppp....ppp..",
  "..ppp....ppp..",
  "..ppp....ppp..",
  "..pPp....pPp..",
  ".KKKK....KKKK.",
  ".KKKK....KKKK."
];

const LEGS_RUN1: Art = [
  "..ppp...ppp...",
  ".ppp.....ppp..",
  ".ppp......ppp.",
  ".pPp......pPp.",
  "KKKK......KKKK",
  "KKK........KKK"
];

const LEGS_RUN2: Art = [
  "...ppp..ppp...",
  "...ppp..ppp...",
  "....ppp.ppp...",
  "....pPp.pPp...",
  "...KKKK.KKKK..",
  "....KKK.KKK..."
];

const LEGS_JUMP: Art = [
  "..pppp..pppp..",
  "..pppp..pppp..",
  "..KKKK..KKKK..",
  "..KKKK..KKKK..",
  "..............",
  ".............."
];

export const PLAYER_IDLE: Art = [...PLAYER_HEAD, ...LEGS_IDLE];
export const PLAYER_RUN1: Art = [...PLAYER_HEAD, ...LEGS_RUN1];
export const PLAYER_RUN2: Art = [...PLAYER_HEAD, ...LEGS_RUN2];
export const PLAYER_JUMP: Art = [...PLAYER_HEAD, ...LEGS_JUMP];

export const PLAYER_PAL: Palette = {
  h: 0xe07f10,
  o: 0xf7931a,
  O: 0xffb35c,
  s: 0xc06f0a,
  f: 0xf0c8a0,
  b: 0x6b4a2f,
  K: 0x191c26,
  p: 0x2e3a55,
  P: 0x1f2940
};

// --- Enemies: 16x18 walker + 16x18 turret ----------------------------------

const WALKER_BODY: Art = [
  "....aaaaaaaa....",
  "..aaaaaaaaaaaa..",
  ".aaaaaaaaaaaaaa.",
  ".aaeeKaaaaeeKaa.",
  ".aaeeKaaaaeeKaa.",
  ".aaaaaaaaaaaaaa.",
  ".aaaaaaaaaaaaaa.",
  ".aadKKKKKKKKdaa.",
  ".aaaaaaaaaaaaaa.",
  ".adaaaaaaaaaada.",
  ".adaaaaaaaaaada.",
  ".aaaaaaaaaaaaaa.",
  ".dddddddddddddd.",
  "..dddddddddddd..",
  "..dddddddddddd.."
];

const WALKER_FEET_A: Art = [
  "..KKK......KKK..",
  ".KKK......KKK...",
  ".KKK......KKK..."
];

const WALKER_FEET_B: Art = [
  "..KKK......KKK..",
  "...KKK....KKK...",
  "...KKK....KKK..."
];

export const WALKER_A: Art = [...WALKER_BODY, ...WALKER_FEET_A];
export const WALKER_B: Art = [...WALKER_BODY, ...WALKER_FEET_B];

export const TURRET: Art = [
  "................",
  "................",
  "................",
  "......KKKK......",
  "....KKaaaaKK....",
  "...KaaaaaaaaK...",
  "...KaaeeeeaaK...",
  "...KaaaaaaaaK...",
  "ddddKaaaaaaKdddd",
  "ddddKaaaaaaKdddd",
  "...KKaaaaaaKK...",
  "....KaaaaaaK....",
  "....dddddddd....",
  "...dddddddddd...",
  "..dddddddddddd..",
  ".KKKKKKKKKKKKKK.",
  ".KKKKKKKKKKKKKK.",
  "KKKKKKKKKKKKKKKK"
];

export const ENEMY_SKINS: Record<EnemyType, { a: number; d: number; eye?: number }> = {
  banker: { a: 0x3a4a72, d: 0x232c48 },
  printer: { a: 0x6e7a6a, d: 0x48513f },
  miner: { a: 0x8a6a3e, d: 0x5c4527 },
  fud: { a: 0xb04030, d: 0x702820 },
  chargeback: { a: 0x7a4a8a, d: 0x4c2c58 },
  exploit: { a: 0x3f8a52, d: 0x265634 },
  suit: { a: 0x4a525e, d: 0x2c323c },
  agent: { a: 0x32323c, d: 0x1c1c24, eye: 0x101014 },
  wiretap: { a: 0x5a6a7a, d: 0x38444f },
  shiller: { a: 0xc05a9a, d: 0x7c3763 },
  rugpull: { a: 0x8a5a3a, d: 0x573823 },
  degen: { a: 0x50a060, d: 0x30663c },
  shitgun: { a: 0x6a5a2a, d: 0x3d3418 }
};

// --- NPCs / allies: 12x16 --------------------------------------------------

export const NPC: Art = [
  "...hhhhhh...",
  "..hhhhhhhh..",
  "..hffffffh..",
  "..hfKffKfh..",
  "..hffffffh..",
  "...ffffff...",
  "..cccccccc..",
  ".cccccccccc.",
  ".cccccccccc.",
  ".ccdccccdcc.",
  ".cccccccccc.",
  "..cccccccc..",
  "..cc....cc..",
  "..cc....cc..",
  ".KKK....KKK.",
  ".KKK....KKK."
];

export function npcPal(hair: number, cloak: number): Palette {
  return {
    h: hair,
    c: cloak,
    d: darken(cloak, 0.35),
    f: 0xf0c8a0,
    K: 0x14161e
  };
}

export const NPC_SKINS: Record<string, Palette> = {
  dokwon: npcPal(0x1c1c22, 0x3a6ea8),
  sbf: npcPal(0x2a2a30, 0x2a6a5a),
  vitalik: npcPal(0x8a6a3e, 0x7a5ac8),
  influencer: npcPal(0xd8b040, 0xc8508a),
  maxi: npcPal(0x4a3626, 0xf7931a),
  warner: npcPal(0x9aa0a8, 0x5a626e),
  hal: npcPal(0x9aa0a8, 0x36bd63),
  nodes: npcPal(0x4a3626, 0x36bd63),
  mallers: npcPal(0x2a2a30, 0x4aa8f0),
  crowd: npcPal(0x4a3626, 0xffd166)
};

export const DEFAULT_NPC_PAL: Palette = npcPal(0x4a3626, 0x8d6de8);

// --- Overworld player: 10x12 -----------------------------------------------

export const OW_HERO: Art = [
  "..hhhhhh..",
  ".hhhhhhhh.",
  ".hffffffh.",
  ".hfKffKfh.",
  ".hffffffh.",
  "..oooooo..",
  ".oooooooo.",
  ".oooooooo.",
  "..pppppp..",
  "..pp..pp..",
  ".KKK..KKK.",
  ".KKK..KKK."
];

// --- Whitepaper page: 11x14 ------------------------------------------------

export const PAGE: Art = [
  "wwwwwwwwwG.",
  "wwwwwwwwwGG",
  "wwwwwwwwwww",
  "wwggggggwww",
  "wwwwwwwwwww",
  "wwggggggwww",
  "wwwwwwwwwww",
  "wwggggggwww",
  "wwwwwwwwwww",
  "wwggggwwwww",
  "wwwwwwwwwww",
  "wwggggggwww",
  "wwwwwwwwwww",
  "wwwwwwwwwww"
];

export const PAGE_PAL: Palette = {
  w: 0xf6f1e0,
  g: 0x9aa0a8,
  G: 0xc9c4b4
};

// --- Tiny 3x5 font (scaled up for signs, blocks, logo) ----------------------

const TINY: Record<string, Art> = {
  "0": ["ooo", "o.o", "o.o", "o.o", "ooo"],
  "1": [".o.", "oo.", ".o.", ".o.", "ooo"],
  "2": ["ooo", "..o", "ooo", "o..", "ooo"],
  "3": ["ooo", "..o", ".oo", "..o", "ooo"],
  "4": ["o.o", "o.o", "ooo", "..o", "..o"],
  "5": ["ooo", "o..", "ooo", "..o", "ooo"],
  "6": ["ooo", "o..", "ooo", "o.o", "ooo"],
  "7": ["ooo", "..o", "..o", ".o.", ".o."],
  "8": ["ooo", "o.o", "ooo", "o.o", "ooo"],
  "9": ["ooo", "o.o", "ooo", "..o", "ooo"],
  B: ["oo.", "o.o", "oo.", "o.o", "oo."],
  X: ["o.o", "o.o", ".o.", "o.o", "o.o"],
  "?": ["ooo", "..o", ".o.", "...", ".o."]
};

export function drawTiny(fb: Fb, x: number, y: number, text: string, scale: number, color: number): void {
  let cx = x | 0;
  for (const ch of text) {
    const art = TINY[ch];
    if (!art) {
      cx += 4 * scale;
      continue;
    }
    for (let r = 0; r < art.length; r += 1) {
      for (let c = 0; c < art[r].length; c += 1) {
        if (art[r][c] === ".") continue;
        fb.rect(cx + c * scale, y + r * scale, scale, scale, color);
      }
    }
    cx += 4 * scale;
  }
}

function darken(color: number, t: number): number {
  const r = ((color >> 16) * (1 - t)) | 0;
  const g = (((color >> 8) & 255) * (1 - t)) | 0;
  const b = ((color & 255) * (1 - t)) | 0;
  return (r << 16) | (g << 8) | b;
}
