import { ArcadeCanvas } from "./arcade-canvas.ts";
import { createArt } from "./brawler-art.ts";
import { CHARACTERS, STAGES, ITEMS } from "./brawler.ts";
import { TILE, VIEW_H, type Game, type Solid, type Taxi } from "./game.ts";
import { Fb, hash2, lerpC } from "./fb.ts";
import {
  BULL,
  DEFAULT_NPC_PAL,
  drawTiny,
  ENEMY_SKINS,
  NPC,
  NPC_SKINS,
  OW_HERO,
  PAGE,
  PAGE_PAL,
  PLAYER_IDLE,
  PLAYER_JUMP,
  PLAYER_PAL,
  PLAYER_RUN1,
  PLAYER_RUN2,
  TURRET,
  WALKER_A,
  WALKER_B,
  type Art,
  type Palette,
} from "./sprites.ts";
import { type Rgb, type Screen } from "./screen.ts";

const INK: Rgb = { r: 16, g: 16, b: 24 };
const PAPER: Rgb = { r: 244, g: 234, b: 210 };
const ORANGE: Rgb = { r: 247, g: 147, b: 26 };
const RED: Rgb = { r: 214, g: 69, b: 51 };
const YELLOW: Rgb = { r: 255, g: 209, b: 102 };
const GRAY: Rgb = { r: 132, g: 140, b: 142 };

const HUD = 2;

const C_INK = 0x101018;
const C_GOLD = 0xffd166;
const C_GOLD_DEEP = 0xc8860a;
const C_WHITE = 0xf6f1e0;
const C_SKIN = 0xf0c8a0;
const CROWD_SHIRTS = [
  0xf7931a, 0x8d6de8, 0x36bd63, 0x4aa8f0, 0xffd166, 0xd64533,
];

export type Scale = {
  playX: number;
  playY: number;
  playCols: number;
  playRows: number;
  pixW: number;
  pixH: number;
  unit: number;
  viewW: number;
};

type View = { s: number; camX: number; camY: number };

const fb = new Fb();

export function layoutScale(cols: number, rows: number): Scale {
  const playRows = Math.max(12, rows - HUD - 1);
  const playCols = cols;
  const pixW = playCols;
  const pixH = playRows * 2;
  // World units per half-block pixel. Show ~190 of the 240-unit view height —
  // jump arcs still fit and everything renders noticeably larger. Clamped so
  // tiny terminals stay playable and huge ones just see a wider view.
  const unit = clamp(190 / pixH, 1.3, 4);
  return {
    playX: 0,
    playY: HUD,
    playCols,
    playRows,
    pixW,
    pixH,
    unit,
    viewW: pixW * unit,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function packHex(hex: string): number {
  return parseInt(hex.startsWith("#") ? hex.slice(1) : hex, 16) | 0;
}

function darken(c: number, t: number): number {
  return lerpC(c, 0x000000, t);
}

function lighten(c: number, t: number): number {
  return lerpC(c, 0xffffff, t);
}

function luminance(c: number): number {
  return 0.3 * (c >> 16) + 0.6 * ((c >> 8) & 255) + 0.1 * (c & 255);
}

export function drawGame(screen: Screen, game: Game, scale: Scale): void {
  const zone = game.activeZone();
  const sky = packHex(zone.sky);
  const sky2 = packHex(zone.sky2);
  const ground = packHex(zone.ground);
  const accent = packHex(zone.accent);

  screen.clear(INK);
  if (game.phase === "title") {
    drawTitle(screen, game);
    return;
  }

  fb.ensure(scale.pixW, scale.pixH);

  let arcadeCanvas: ArcadeCanvas | undefined;
  if (game.subMode === "brawler" && game.brawler) {
    arcadeCanvas = new ArcadeCanvas(fb);
    createArt(arcadeCanvas).draw(game.brawler.state);
  } else if (game.subMode === "overworld")
    drawOverworld(game, scale, sky, sky2, accent);
  else drawSide(game, scale, sky, sky2, ground, accent);

  fb.blit(screen, scale.playX, scale.playY);
  arcadeCanvas?.blitLabels(screen, scale.playX, scale.playY);

  if (game.subMode === "brawler" && game.brawler)
    drawBrawlerHud(screen, game, scale);
  else drawHud(screen, game, scale);
  if (game.phase === "paused")
    drawBanner(
      screen,
      "PAUSED",
      "ENTER continue   R restart   M levels   Q quit",
    );
  else if (game.phase === "complete") {
    drawBanner(
      screen,
      game.subMode === "brawler" ? "THE PEOPLE WIN" : "BITCOIN LIVES",
      `${game.levelLabel("coin", "BTC")} ${pad2(game.coins)}  ${game.levelLabel("pageStat", "PAGES")} ${game.pages}/${game.pageTotal()}  SCORE ${game.score}   ENTER again   M levels`,
    );
  } else if (game.phase === "gameover") {
    drawBanner(screen, "REKT", "Fiat got you.  ENTER try again   M levels");
  }
}

// --- Framebuffer helpers ----------------------------------------------------

/** Fill a world-space box, sampling tex(worldX, worldY); return -1 to skip. */
function texRect(
  v: View,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  tex: (wx: number, wy: number) => number,
): void {
  const x0 = Math.max(0, Math.floor((bx - v.camX) / v.s));
  const y0 = Math.max(0, Math.floor((by - v.camY) / v.s));
  const x1 = Math.min(fb.w, Math.ceil((bx + bw - v.camX) / v.s));
  const y1 = Math.min(fb.h, Math.ceil((by + bh - v.camY) / v.s));
  for (let py = y0; py < y1; py += 1) {
    const wy = v.camY + (py + 0.5) * v.s;
    const row = py * fb.w;
    for (let px = x0; px < x1; px += 1) {
      const wx = v.camX + (px + 0.5) * v.s;
      const c = tex(wx, wy);
      if (c >= 0) fb.px[row + px] = c;
    }
  }
}

/** Scale a sprite into a world-space box, nearest-neighbor. */
function spriteBox(
  v: View,
  art: Art,
  pal: Palette,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  flip = false,
): void {
  const artH = art.length;
  const artW = art[0]?.length ?? 0;
  if (artW === 0 || bw <= 0 || bh <= 0) return;
  const x0 = Math.max(0, Math.floor((bx - v.camX) / v.s));
  const y0 = Math.max(0, Math.floor((by - v.camY) / v.s));
  const x1 = Math.min(fb.w, Math.ceil((bx + bw - v.camX) / v.s));
  const y1 = Math.min(fb.h, Math.ceil((by + bh - v.camY) / v.s));
  for (let py = y0; py < y1; py += 1) {
    const wy = v.camY + (py + 0.5) * v.s;
    const sy = clamp(Math.floor(((wy - by) / bh) * artH), 0, artH - 1) | 0;
    const rowArt = art[sy];
    const row = py * fb.w;
    for (let px = x0; px < x1; px += 1) {
      const wx = v.camX + (px + 0.5) * v.s;
      const sx = clamp(Math.floor(((wx - bx) / bw) * artW), 0, artW - 1) | 0;
      const ch = rowArt[flip ? artW - 1 - sx : sx];
      if (ch === ".") continue;
      const c = pal[ch];
      if (c === undefined) continue;
      fb.px[row + px] = c;
    }
  }
}

/** Spinning gold coin centered at world (wx, wy). */
function coinAt(
  v: View,
  wx: number,
  wy: number,
  r: number,
  time: number,
): void {
  const spin = Math.cos(time * 5 + wx * 0.11);
  const halfW = Math.max(0.28, Math.abs(spin)) * r;
  texRect(v, wx - r, wy - r, r * 2, r * 2, (px, py) => {
    const dx = (px - wx) / halfW;
    const dy = (py - wy) / r;
    const d = dx * dx + dy * dy;
    if (d > 1) return -1;
    if (d > 0.55) return C_GOLD_DEEP;
    if (dx + dy < -0.5) return lighten(C_GOLD, 0.45);
    return C_GOLD;
  });
}

// --- Side-scroller ----------------------------------------------------------

/** True inside an overworld venue: no sky, just the room's back wall. */
function isInterior(game: Game): boolean {
  const level = game.currentLevel();
  return game.subMode === "venue" && level.mode === "overworld";
}

/** Venues with the dressed-up "16-bit" pass: marble floors, bevels, wall TVs. */
function hasDressedInteriors(game: Game): boolean {
  const level = game.currentLevel();
  return (
    level.mode === "overworld" &&
    (level.theme === "mania" || level.theme === "wallstreet")
  );
}

function drawSide(
  game: Game,
  scale: Scale,
  sky: number,
  sky2: number,
  ground: number,
  accent: number,
): void {
  const s = scale.unit;
  const visH = scale.pixH * s;
  const v: View = { s, camX: game.cameraX, camY: VIEW_H - visH };
  const dark = luminance(sky) < 64;

  if (isInterior(game))
    drawInteriorWalls(v, packHex(game.activeZone().ground), game);
  else {
    for (let py = 0; py < fb.h; py += 1) {
      const wy = v.camY + py * s;
      const t = clamp(wy / VIEW_H, 0, 1);
      fb.px.fill(lerpC(sky, sky2, t), py * fb.w, (py + 1) * fb.w);
    }
    drawBackdrop(v, sky, sky2, ground, dark);
  }

  for (const solid of game.solids)
    drawSolid(game, v, solid, sky2, ground, accent);

  for (const hazard of game.hazards) {
    texRect(v, hazard.x, hazard.y, hazard.w, hazard.h, (wx, wy) => {
      const lx = (((wx - hazard.x) % 8) + 8) % 8;
      const rise = 1 - Math.abs(lx - 4) / 4;
      const top = hazard.y + hazard.h * (1 - rise);
      if (wy < top) return -1;
      if (wy < top + 3) return C_WHITE;
      return lerpC(0xd64533, 0x7a2018, (wy - hazard.y) / hazard.h);
    });
  }

  for (const coin of game.coinsList) {
    if (!coin.taken)
      coinAt(
        v,
        coin.x + coin.w / 2,
        coin.y + coin.h / 2,
        coin.w / 2 + 1,
        game.time,
      );
  }

  for (const page of game.pagesList) {
    if (page.taken) continue;
    const bob = Math.sin(game.time * 3 + page.x * 0.05) * 2;
    if (game.levelLabel("pageNote", "Page") === "Key")
      drawKey(v, page.x, page.y + bob, page.w, page.h, game.time);
    else spriteBox(v, PAGE, PAGE_PAL, page.x, page.y + bob, page.w, page.h);
  }

  for (const cp of game.checkpoints)
    drawCheckpoint(v, cp.x, cp.y, cp.taken, game.time);

  for (const ally of game.allies) {
    const pal = NPC_SKINS[ally.kind] ?? DEFAULT_NPC_PAL;
    spriteBox(v, NPC, pal, ally.x, ally.y, ally.w ?? 18, ally.h ?? 22);
  }

  const walkFrame = Math.floor(game.time * 8) % 2 === 0;
  for (const enemy of game.enemies) {
    const skin = ENEMY_SKINS[enemy.type];
    const pal: Palette = {
      a: skin.a,
      d: skin.d,
      K: 0x14161e,
      e: skin.eye ?? 0xf6f1e0,
    };
    if (!enemy.alive) {
      if (enemy.squashed > 0)
        texRect(v, enemy.x, enemy.y + enemy.h - 5, enemy.w, 5, () => skin.d);
      continue;
    }
    if (enemy.type === "shitgun") {
      spriteBox(v, TURRET, pal, enemy.x, enemy.y, enemy.w, enemy.h);
    } else {
      spriteBox(
        v,
        walkFrame ? WALKER_A : WALKER_B,
        pal,
        enemy.x,
        enemy.y,
        enemy.w,
        enemy.h,
        enemy.vx < 0,
      );
    }
  }

  for (const shot of game.shots) {
    if (shot.alive) coinAt(v, shot.x + 4, shot.y + 4, 4, game.time * 2);
  }
  for (const shot of game.satShots) {
    if (!shot.alive) continue;
    texRect(v, shot.x, shot.y, 6, 4, (wx, wy) => {
      void wx;
      return wy < shot.y + 2 ? 0xfff2c0 : 0xf7931a;
    });
  }

  drawGoal(v, game, accent);

  const blink =
    game.player.invincible > 0 && Math.floor(game.time * 12) % 2 === 0;
  if (!blink) drawPlayer(v, game);

  for (const p of game.particles) {
    if (p.alive)
      texRect(v, p.x - 1.2, p.y - 1.2, 2.4, 2.4, () =>
        p.life > 0.2 ? 0xffd166 : 0xfff2c0,
      );
  }
}

function drawBackdrop(
  v: View,
  sky: number,
  sky2: number,
  ground: number,
  dark: boolean,
): void {
  // Sun or moon pinned near the top-right of the frame.
  const cx = fb.w * 0.76;
  const cy = (74 - v.camY) / v.s;
  const r = 11 / v.s;
  const disc = dark ? 0xd8d8e4 : 0xffe9a0;
  const halo = dark ? lerpC(sky, 0xd8d8e4, 0.18) : lerpC(sky, 0xffd166, 0.3);
  const py0 = Math.max(0, Math.floor(cy - r - 2));
  const py1 = Math.min(fb.h, Math.ceil(cy + r + 3));
  const px0 = Math.max(0, Math.floor(cx - r - 2));
  const px1 = Math.min(fb.w, Math.ceil(cx + r + 3));
  for (let py = py0; py < py1; py += 1) {
    const row = py * fb.w;
    for (let px = px0; px < px1; px += 1) {
      const d = Math.hypot(px - cx, py - cy);
      if (d < r) fb.px[row + px] = disc;
      else if (d < r + 1.8) fb.px[row + px] = halo;
    }
  }

  if (dark) {
    for (let py = 0; py < fb.h; py += 1) {
      const wy = v.camY + py * v.s;
      if (wy > 150) break;
      const row = py * fb.w;
      for (let px = 0; px < fb.w; px += 1) {
        const wx = v.camX * 0.05 + px * v.s;
        if (hash2(Math.floor(wx / 3), Math.floor(wy / 3)) > 0.988)
          fb.px[row + px] = 0xd8dce8;
      }
    }
  }

  // Far skyline with lit windows, then rolling hills in front of it.
  const skyline = lerpC(sky2, C_INK, 0.45);
  const winLit = lerpC(skyline, 0xffd166, 0.5);
  const hill = lerpC(ground, sky2, 0.5);
  const hillTop = lighten(hill, 0.12);
  for (let px = 0; px < fb.w; px += 1) {
    const wxFar = v.camX * 0.3 + px * v.s;
    const seg = Math.floor(wxFar / 26);
    const topFar = 204 - (22 + hash2(seg, 7) * 72);

    const wxMid = v.camX * 0.6 + px * v.s;
    const topMid =
      204 -
      (8 +
        (Math.sin(wxMid * 0.014) * 0.5 + 0.5) * 26 +
        (Math.sin(wxMid * 0.041) * 0.5 + 0.5) * 6);

    for (let py = 0; py < fb.h; py += 1) {
      const wy = v.camY + (py + 0.5) * v.s;
      if (wy >= 204) break;
      const i = py * fb.w + px;
      if (wy >= topMid) {
        fb.px[i] = wy < topMid + 2.5 ? hillTop : hill;
      } else if (wy >= topFar) {
        fb.px[i] =
          wy > topFar + 4 &&
          hash2(Math.floor(wxFar / 5), Math.floor(wy / 7)) > 0.9
            ? winLit
            : skyline;
      }
    }
  }
}

/** Venue back wall: beveled brick with a faint picture rail, plus wall TVs. */
function drawInteriorWalls(v: View, groundHex: number, game: Game): void {
  const wall = darken(groundHex, 0.42);
  const wallLit = lighten(wall, 0.12);
  const mortar = darken(wall, 0.5);
  texRect(
    v,
    v.camX - 4,
    v.camY - 4,
    fb.w * v.s + 8,
    206 - v.camY + 8,
    (wx, wy) => {
      if (wy > 202) return -1;
      const brickRow = Math.floor(wy / 9);
      const inRow = ((wy % 9) + 9) % 9;
      const joint = (((wx + (brickRow % 2) * 9 + 100000) % 18) + 18) % 18;
      if (inRow < v.s || joint < v.s * 1.2) return mortar;
      if (inRow < 2.6) return wallLit;
      if (inRow > 7.4) return darken(wall, 0.14);
      return hash2(Math.floor(wx / 5), Math.floor(wy / 5)) > 0.88
        ? darken(wall, 0.12)
        : wall;
    },
  );
  // Picture-rail trim where wall meets floor.
  texRect(v, v.camX - 4, 200 - 3, fb.w * v.s + 8, 3, () => darken(wall, 0.32));

  const spacing = 190;
  const first = Math.floor((v.camX - 60) / spacing);
  const last = Math.ceil((v.camX + fb.w * v.s + 60) / spacing);
  for (let i = first; i <= last; i += 1) {
    if (i === 0 && hash2(i, 91) > 0.25) continue; // not every room bay has one
    const tx = i * spacing + (hash2(i, 31) * 50 - 25);
    const ty = 40 + hash2(i, 57) * 30;
    drawWallTv(v, tx, ty, i, game.time);
  }
}

/** Wall-mounted TV running a live candle chart, flickering like a dying tube. */
function drawWallTv(
  v: View,
  x: number,
  y: number,
  id: number,
  time: number,
): void {
  const w = 36;
  const h = 24;
  const flicker = hash2(id * 7 + 1, Math.floor(time * 11)) > 0.92 ? 0.55 : 1;
  texRect(v, x - 2, y - 2, w + 4, h + 4, () => 0x14161e);
  texRect(v, x, y, w, h, (wx, wy) => {
    void wx;
    const t = (wy - y) / h;
    return lerpC(lerpC(0x0e1812, 0x16241a, t), 0x000000, 1 - flicker);
  });
  const cols = Math.floor((w - 4) / 4);
  for (let c = 0; c < cols; c += 1) {
    const seed = c + Math.floor(time * 3) + id * 97;
    const up = hash2(seed, 13) > 0.45;
    const colBase = up
      ? lerpC(0x36bd63, 0x6fe08a, flicker)
      : lerpC(0xd64533, 0xf07a6a, flicker);
    const bodyH = 4 + hash2(seed, 23) * (h * 0.45);
    let top = y + 3 + hash2(seed, 17) * (h - bodyH - 6);
    top = clamp(top, y + 2, y + h - bodyH - 2);
    const cx = x + 2 + c * 4;
    texRect(v, cx + 1, top, 2, bodyH, () => colBase);
    texRect(v, cx + 1.6, top - 2, 0.9, bodyH + 4, () => darken(colBase, 0.3));
  }
}

/** Golden vault KEY pickup used by Level 5 venues (labels.pageNote === "Key"). */
function drawKey(
  v: View,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
): void {
  const glow = (Math.sin(time * 4 + x * 0.11) * 0.5 + 0.5) * 0.28;
  const gold = lighten(C_GOLD, glow);
  texRect(v, x, y, w, h, (wx, wy) => {
    const lx = (wx - x) / w;
    const ly = (wy - y) / h;
    const rx = (lx - 0.24) / 0.21;
    const ry = (ly - 0.34) / 0.34;
    const ring = rx * rx + ry * ry;
    if (ring <= 0.62) return gold;
    if (ring <= 1.7) return C_GOLD_DEEP;
    if (ly > 0.44 && ly < 0.58 && lx > 0.36 && lx < 0.94) return gold;
    if (ly >= 0.58 && ly < 0.8 && ((lx > 0.64 && lx < 0.76) || lx > 0.82))
      return C_GOLD_DEEP;
    return -1;
  });
}

function drawSolid(
  game: Game,
  v: View,
  solid: Solid,
  sky2: number,
  ground: number,
  accent: number,
): void {
  const { x, y, w, h, kind } = solid;
  const dressed = isInterior(game) && hasDressedInteriors(game);

  if (kind === "ground") {
    if (dressed) {
      // Checkered marble (wallstreet) / casino carpet (mania) with grout and
      // flecks, plus a polished highlight along the walkable top edge.
      const tileA =
        game.currentLevel().theme === "wallstreet"
          ? lerpC(ground, 0xf6f1e0, 0.34)
          : lerpC(accent, 0xf6f1e0, 0.22);
      const tileB = darken(lerpC(ground, C_INK, 0.3), 0.08);
      texRect(v, x, y, w, h, (wx, wy) => {
        if (wy < y + 2) return lighten(tileA, 0.3);
        const cx = Math.floor(wx / 8);
        const cy = Math.floor((wy - y) / 8);
        const checker = (cx + cy) % 2 === 0 ? tileA : tileB;
        const gx = ((wx % 8) + 8) % 8;
        const gy = (((wy - y) % 8) + 8) % 8;
        if (gx < 0.9 || gy < 0.9) return darken(checker, 0.38);
        return hash2(cx * 5 + cy, cy * 3) > 0.93
          ? lighten(checker, 0.2)
          : checker;
      });
      return;
    }
    const grass = lerpC(ground, 0x9be070, 0.28);
    const soil = darken(ground, 0.18);
    const mortar = darken(ground, 0.45);
    texRect(v, x, y, w, h, (wx, wy) => {
      if (wy < y + 3) return lighten(grass, 0.18);
      if (wy < y + 6) return grass;
      const brickRow = Math.floor(wy / 10);
      const inRow = ((wy % 10) + 10) % 10;
      const joint = (wx + (brickRow % 2) * 9 + 100000) % 18;
      if (inRow < v.s || joint < v.s) return mortar;
      return hash2(Math.floor(wx / 4), Math.floor(wy / 4)) > 0.82
        ? darken(soil, 0.12)
        : soil;
    });
    return;
  }

  if (kind === "question") {
    const hit = solid.hit;
    const pulse = hit
      ? 0
      : (Math.sin(game.time * 5 + x * 0.1) * 0.5 + 0.5) * 0.18;
    const face = hit ? 0x6e6252 : lighten(0xe8a020, pulse);
    const edge = hit ? 0x4a4238 : 0x8a5c0a;
    const rivet = hit ? 0x7e7260 : lighten(0xffd166, pulse + 0.15);
    texRect(v, x, y, w, h, (wx, wy) => {
      const bx = wx - x;
      const by = wy - y;
      if (bx < 1.6 || by < 1.6 || bx > w - 1.6 || by > h - 1.6) return edge;
      const nearX = bx < 3.6 || bx > w - 3.6;
      const nearY = by < 3.6 || by > h - 3.6;
      if (nearX && nearY) return rivet;
      return face;
    });
    if (!hit) {
      const hp = Math.floor(h / v.s);
      if (hp >= 7) {
        const k = Math.max(1, Math.floor(hp / 7));
        const gx = Math.floor((x + w / 2 - v.camX) / v.s) - Math.floor(1.5 * k);
        const gy = Math.floor((y + h / 2 - v.camY) / v.s) - Math.floor(2.5 * k);
        drawTiny(fb, gx, gy, "?", k, C_WHITE);
      }
    }
    return;
  }

  if (kind === "confirm") {
    if (game.isConfirmed(solid)) {
      const face = lerpC(accent, 0x4aa8f0, 0.4);
      texRect(v, x, y, w, h, (wx, wy) => {
        const by = wy - y;
        if (by < 1.8) return lighten(face, 0.35);
        if (by > h - 1.8) return darken(face, 0.35);
        return (wx - x + 100000) % 11 < 1.6 ? darken(face, 0.25) : face;
      });
    } else {
      // Marching-ants ghost outline while unconfirmed.
      const ants = Math.floor(game.time * 6);
      const ghost = lerpC(accent, sky2, 0.35);
      texRect(v, x, y, w, h, (wx, wy) => {
        const bx = wx - x;
        const by = wy - y;
        if (bx > 1.6 && by > 1.6 && bx < w - 1.6 && by < h - 1.6) return -1;
        return (Math.floor(bx / 3) + Math.floor(by / 3) + ants) % 2 === 0
          ? ghost
          : -1;
      });
    }
    return;
  }

  if (kind === "crowd") {
    texRect(v, x, y - 4, w, h + 4, (wx, wy) => {
      const person = Math.floor((wx - x) / 5);
      const bob = Math.sin(game.time * 7 + person * 1.7) * 1.6;
      const top = y + bob - 2;
      if (wy < top) return -1;
      if (wy < top + 3.4) return C_SKIN;
      const shirt =
        CROWD_SHIRTS[Math.floor(hash2(person, 11) * CROWD_SHIRTS.length)];
      const lx = (((wx - x) % 5) + 5) % 5;
      return lx < 0.8 ? darken(shirt, 0.4) : shirt;
    });
    return;
  }

  if (kind === "barricade") {
    const barricade = game.barricades.find((b) => b.solid === solid);
    const hp = barricade?.hp ?? 3;
    const base = 0x6a4ab0;
    texRect(v, x, y, w, h, (wx, wy) => {
      const brickRow = Math.floor((wy - y) / 8);
      const inRow = (((wy - y) % 8) + 8) % 8;
      const joint = (wx - x + brickRow * 8 + 100000) % 12;
      let c = inRow < v.s || joint < v.s ? darken(base, 0.45) : base;
      if (
        hp < 3 &&
        hash2(Math.floor(wx / 2), Math.floor(wy / 2)) > (hp === 2 ? 0.85 : 0.6)
      ) {
        c = darken(c, 0.55);
      }
      return c;
    });
    return;
  }

  // "ledger" platforms and "block" stacks: warm brick with seams; dressed
  // interiors get beveled crate/desk faces instead.
  const base =
    kind === "block"
      ? lerpC(0x8a5a30, accent, 0.25)
      : lerpC(0x7a4c28, accent, 0.35);
  texRect(v, x, y, w, h, (wx, wy) => {
    const by = wy - y;
    if (dressed) {
      const bx = wx - x;
      const edge = 2;
      if (by < edge) return lighten(base, 0.38);
      if (bx < edge) return lighten(base, 0.16);
      if (by > h - edge) return darken(base, 0.42);
      if (bx > w - edge) return darken(base, 0.24);
      return hash2(Math.floor(wx / 6), Math.floor(by / 6)) > 0.9
        ? darken(base, 0.08)
        : base;
    }
    if (by < 2) return lighten(base, 0.3);
    if (by > h - 2) return darken(base, 0.35);
    const seg = (wx - x + 100000) % 14;
    if (seg < 1.4) return darken(base, 0.3);
    if (seg > 6 && seg < 7.6 && by > 4 && by < 7) return darken(base, 0.2);
    return base;
  });
}

function drawCheckpoint(
  v: View,
  x: number,
  y: number,
  taken: boolean,
  time: number,
): void {
  const poleTop = y - 22;
  texRect(v, x, poleTop, 2, y - poleTop + 8, () => 0x9aa0a8);
  const flag = taken ? 0x36bd63 : 0x4aa8f0;
  texRect(v, x + 2, poleTop, 12, 8, (wx, wy) => {
    const fx = wx - x - 2;
    const fy = wy - poleTop + Math.sin(time * 5 + fx * 0.5) * 1.2;
    if (fy < 0 || fy > 8) return -1;
    if (fx > 12 - fy * 0.4) return -1;
    return fx < 1.5 ? darken(flag, 0.3) : flag;
  });
}

function drawGoal(v: View, game: Game, accent: number): void {
  const g = game.goal;
  if (g.w <= 0 || g.h <= 0) return;
  const glow = (Math.sin(game.time * 3) * 0.5 + 0.5) * 0.25;
  texRect(v, g.x - 2, g.y - 2, g.w + 4, g.h + 2, (wx, wy) => {
    const bx = wx - g.x;
    const by = wy - g.y;
    if (bx < 0 || by < 0 || bx > g.w || by > g.h)
      return lerpC(accent, 0xffffff, glow);
    if (bx < 1.8 || by < 1.8 || bx > g.w - 1.8) return 0xc9c4b4;
    return C_WHITE;
  });
  const k = Math.max(1, Math.floor(g.w / v.s / 5));
  if (Math.floor(g.h / v.s) >= 10) {
    const gx = Math.floor((g.x + g.w / 2 - v.camX) / v.s) - Math.floor(1.5 * k);
    const gy = Math.floor((g.y + g.h / 2 - v.camY) / v.s) - Math.floor(2.5 * k);
    drawTiny(fb, gx, gy, "B", k, 0xf7931a);
  }
}

function drawPlayer(v: View, game: Game): void {
  const p = game.player;
  let art = PLAYER_IDLE;
  if (!p.onGround) art = PLAYER_JUMP;
  else if (Math.abs(p.vx) > 12)
    art = Math.floor(game.time * 10) % 2 === 0 ? PLAYER_RUN1 : PLAYER_RUN2;
  spriteBox(v, art, PLAYER_PAL, p.x, p.y, p.w, p.h, p.facing < 0);
  if (game.hasSatCannon()) {
    const bx = p.facing > 0 ? p.x + p.w - 2 : p.x - 5;
    texRect(v, bx, p.y + 8, 7, 3, () => 0x4a525e);
  }
}

// --- Overworld --------------------------------------------------------------

function drawOverworld(
  game: Game,
  scale: Scale,
  sky: number,
  sky2: number,
  accent: number,
): void {
  const s = scale.unit;
  const visW = scale.pixW * s;
  const visH = scale.pixH * s;
  const mapW = game.ow.cols * TILE;
  const mapH = game.ow.rows * TILE;
  const pcx = game.owPlayer.x + game.owPlayer.w / 2;
  const pcy = game.owPlayer.y + game.owPlayer.h / 2;
  const camX =
    mapW <= visW ? (mapW - visW) / 2 : clamp(pcx - visW / 2, 0, mapW - visW);
  const camY =
    mapH <= visH ? (mapH - visH) / 2 : clamp(pcy - visH / 2, 0, mapH - visH);
  const v: View = { s, camX, camY };

  fb.clear(darken(sky2, 0.3));

  const road = lerpC(0x2e2a3a, sky2, 0.25);
  const roadLite = lighten(road, 0.08);
  const building = lerpC(0x1c1826, sky, 0.15);
  const roof = lighten(building, 0.14);
  const winLit = 0x9a8440;
  const winDark = darken(building, 0.3);
  const water = lerpC(0x142644, sky2, 0.2);
  const wavePhase = Math.floor(game.time * 2.5);
  const level = game.currentLevel();
  const venueTotal =
    level.mode === "overworld" ? Object.keys(level.venues).length : 4;
  const wallstreet = level.mode === "overworld" && level.theme === "wallstreet";

  // Facade texture shared by plain buildings and venue-door blocks.
  const buildingTex =
    (tx: number, ty: number) =>
    (wx: number, wy: number): number => {
      const bx = wx - tx * TILE;
      const by = wy - ty * TILE;
      if (by < 2.4) return roof;
      const inWx = (bx >= 3 && bx <= 6) || (bx >= 10 && bx <= 13);
      const inWy = (by >= 4 && by <= 7) || (by >= 10 && by <= 13);
      if (inWx && inWy) {
        return hash2(
          tx * 13 + Math.floor(bx / 7),
          ty * 7 + Math.floor(by / 6),
        ) > 0.5
          ? winLit
          : winDark;
      }
      return building;
    };

  const startTx = Math.max(0, Math.floor(camX / TILE));
  const startTy = Math.max(0, Math.floor(camY / TILE));
  const endTx = Math.min(game.ow.cols, Math.ceil((camX + visW) / TILE) + 1);
  const endTy = Math.min(game.ow.rows, Math.ceil((camY + visH) / TILE) + 1);

  const tallAt = (tx: number, ty: number): boolean => {
    const c = game.ow.grid[ty]?.[tx] ?? "#";
    return c === "#" || c === "t";
  };

  for (let ty = startTy; ty < endTy; ty += 1) {
    const rowStr = game.ow.grid[ty] ?? "";
    for (let tx = startTx; tx < endTx; tx += 1) {
      const t = rowStr[tx] ?? "#";
      const wx0 = tx * TILE;
      const wy0 = ty * TILE;

      if (t === "#") {
        texRect(v, wx0, wy0, TILE, TILE, buildingTex(tx, ty));
        continue;
      }

      if (t === "~") {
        const foam = ty > 0 && (game.ow.grid[ty - 1]?.[tx] ?? "#") !== "~";
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          if (foam && wy - wy0 < 1.8) return lighten(water, 0.35);
          if (hash2(Math.floor(wx / 7), Math.floor(wy / 4) + wavePhase) > 0.87)
            return lighten(water, 0.22);
          return water;
        });
        continue;
      }

      if (t >= "1" && t <= "9") {
        const cleared = game.venuesCleared.includes(t);
        const flash =
          !cleared && Math.floor(game.time * 3 + tx * 1.7) % 7 === 0;
        const neon = cleared
          ? 0x36bd63
          : flash
            ? 0xffd166
            : lerpC(accent, 0xf7931a, 0.4);
        texRect(v, wx0, wy0, TILE, TILE, buildingTex(tx, ty));
        // Neon entrance sign: soft glow halo behind a bright board.
        texRect(v, wx0 + 2, wy0 + 4, TILE - 4, TILE - 5, () =>
          lerpC(neon, building, 0.55),
        );
        texRect(v, wx0 + 4, wy0 + 6, TILE - 8, TILE - 9, (wx, wy) => {
          const bx = wx - wx0 - 4;
          const by = wy - wy0 - 6;
          const bw = TILE - 8;
          const bh = TILE - 9;
          if (bx < 1 || by < 1 || bx > bw - 1 || by > bh - 1)
            return darken(neon, 0.45);
          return neon;
        });
        const px = Math.floor((wx0 + TILE / 2 - camX) / s) - 1;
        const py = Math.floor((wy0 + 9 - camY) / s) - 2;
        drawTiny(fb, px, py, t, 1, cleared ? 0xeaffea : C_WHITE);
        continue;
      }

      if (t === "X") {
        const open = game.venuesCleared.length >= venueTotal;
        if (wallstreet) {
          drawBullExit(v, wx0, wy0, open, game.time);
          continue;
        }
        const vaultGlow = open
          ? (Math.sin(game.time * 4) * 0.5 + 0.5) * 0.3
          : 0;
        const gold = open ? lighten(0xf7931a, vaultGlow) : 0x5a5248;
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          const bx = wx - wx0;
          const by = wy - wy0;
          if (bx < 1.8 || by < 1.8 || bx > TILE - 1.8 || by > TILE - 1.8)
            return gold;
          return 0x241c12;
        });
        const px = Math.floor((wx0 + TILE / 2 - camX) / s) - 1;
        const py = Math.floor((wy0 + TILE / 2 - camY) / s) - 2;
        drawTiny(fb, px, py, "X", 1, gold);
        continue;
      }

      // Street base (also under doors, crosswalks, manholes, sats, trees).
      texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
        const seamX = ((wx % TILE) + TILE) % TILE;
        const seamY = ((wy % TILE) + TILE) % TILE;
        if (seamX < 0.9 || seamY < 0.9) return darken(road, 0.2);
        return hash2(Math.floor(wx / 3), Math.floor(wy / 3)) > 0.85
          ? roadLite
          : road;
      });

      // Cast shadows off anything tall onto the street below/right of it.
      if (t !== "g") {
        if (tallAt(tx - 1, ty))
          texRect(v, wx0, wy0, 3, TILE, () => darken(road, 0.26));
        if (tallAt(tx, ty - 1))
          texRect(v, wx0, wy0, TILE, 3, () => darken(road, 0.2));
      }

      if (t === "g" || t === "t") {
        // Dithered park grass, offset by tile parity so the checker flows.
        const parity = (tx + ty) % 2 === 0;
        const gA = lerpC(0x2f8d50, sky2, 0.12);
        const gB = lerpC(0x25703f, sky2, 0.12);
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          const even = (Math.floor(wx / 4) + Math.floor(wy / 4)) % 2 === 0;
          return even === parity ? gA : gB;
        });
      }

      if (t === "z") {
        // Crosswalk: worn pedestrian stripes across the road.
        const pale = lerpC(road, 0xf6f1e0, 0.55);
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          const band = (((wy - wy0) % 6) + 6) % 6;
          if (band >= 2.4) return -1;
          return hash2(Math.floor(wx / 2), Math.floor(wy / 2)) > 0.86
            ? darken(pale, 0.14)
            : pale;
        });
      }

      if (t === "t") drawTree(v, wx0, wy0, tx, game.time);

      if (t === "o") {
        if (wallstreet) drawManhole(v, wx0, wy0, tx, ty, game.time, road);
        else {
          const cx = wx0 + TILE / 2;
          const cy = wy0 + TILE / 2;
          texRect(v, wx0 + 2, wy0 + 2, TILE - 4, TILE - 4, (wx, wy) => {
            const d = Math.hypot(wx - cx, wy - cy);
            if (d > 6) return -1;
            if (d > 5) return 0x3a3026;
            return hash2(Math.floor(wx / 2), Math.floor(wy / 2)) > 0.6
              ? 0x2f8d50
              : 0x25703f;
          });
        }
      } else if (t === "c") {
        const taken = game.ow.coins.some(
          (c) => c.tx === tx && c.ty === ty && c.taken,
        );
        if (!taken) coinAt(v, wx0 + TILE / 2, wy0 + TILE / 2, 5, game.time);
      }
    }
  }

  // Taxis above street furniture, below the walker.
  for (const taxi of game.ow.taxis) drawTaxi(v, taxi);

  for (const npc of game.ow.npcs) {
    const pal = NPC_SKINS[npc.kind] ?? DEFAULT_NPC_PAL;
    spriteBox(v, NPC, pal, npc.tx * TILE + 2, npc.ty * TILE, 12, 16);
  }

  const bob = game.owPlayer.moving ? Math.sin(game.time * 12) * 1.2 : 0;
  spriteBox(
    v,
    OW_HERO,
    PLAYER_PAL,
    game.owPlayer.x,
    game.owPlayer.y + bob,
    game.owPlayer.w,
    game.owPlayer.h,
    game.owPlayer.facing === "left",
  );
}

/** Park tree: shaded trunk plus a three-tone canopy that sways slightly. */
function drawTree(
  v: View,
  wx0: number,
  wy0: number,
  tx: number,
  time: number,
): void {
  const sway = Math.sin(time * 1.6 + tx * 1.3) * 1.1;
  const cx = wx0 + TILE / 2 + sway;
  const cy = wy0 + 6;
  texRect(v, wx0 - 2, wy0 - 3, TILE + 4, TILE + 4, (wx, wy) => {
    const dx = (wx - cx) / 8.5;
    const dy = (wy - cy) / 8.5;
    const d = dx * dx + dy * dy;
    if (d < 1) {
      if (dx + dy < -0.5) return lighten(0x33944a, 0.22);
      if (d > 0.6) return 0x256e35;
      return 0x33944a;
    }
    if (Math.abs(wx - (wx0 + TILE / 2)) < 1.6 && wy > cy + 4.5) return 0x5a4028;
    return -1;
  });
}

/** Steaming manhole: iron grate disc plus wisps of steam drifting upward. */
function drawManhole(
  v: View,
  wx0: number,
  wy0: number,
  tx: number,
  ty: number,
  time: number,
  road: number,
): void {
  const cx = wx0 + TILE / 2;
  const cy = wy0 + TILE / 2;
  texRect(v, wx0 + 2, wy0 + 2, TILE - 4, TILE - 4, (wx, wy) => {
    const d = Math.hypot(wx - cx, wy - cy);
    if (d > 5.4) return -1;
    if (d > 4.4) return 0x35302a;
    return hash2(Math.floor(wx / 1.6), Math.floor(wy / 1.6)) > 0.72
      ? 0x26221d
      : 0x1c1915;
  });
  for (let wisp = 0; wisp < 3; wisp += 1) {
    const phase = hash2(tx * 3 + wisp, ty * 7);
    const rise = (time * 10 + phase * 18) % 18;
    const alpha = 0.32 * (1 - rise / 18);
    const sx = wx0 + 5 + phase * 6 + Math.sin(time * 2 + phase * 9) * 1.2;
    const sy = wy0 + 8 - rise;
    fb.rect(
      Math.floor((sx - v.camX) / v.s),
      Math.floor((sy - v.camY) / v.s),
      2,
      2,
      lerpC(road, 0xe8ecf4, alpha),
    );
  }
}

/** Yellow cab with glass band and checker skirt; collision box == body. */
function drawTaxi(v: View, taxi: Taxi): void {
  const body = 0xf7c520;
  texRect(v, taxi.x, taxi.y, taxi.w, taxi.h, (wx, wy) => {
    const lx = wx - taxi.x;
    const ly = wy - taxi.y;
    if (ly < 2.2) return lighten(body, 0.24);
    if (ly > taxi.h - 2.4) return 0x1c1c22;
    const front = taxi.dir > 0 ? lx > taxi.w - 3.6 : lx < 3.6;
    if (front) return lerpC(body, 0xfff2c0, 0.4);
    const glassFront = taxi.dir > 0 ? lx > taxi.w * 0.42 : lx < taxi.w * 0.58;
    if (ly > 3.4 && ly < 7 && glassFront && lx > 2.2 && lx < taxi.w - 2.2)
      return 0x27303c;
    if (ly > taxi.h - 4.4 && Math.floor(lx / 2.4) % 2 === 0)
      return darken(body, 0.5);
    return body;
  });
}

/** The CHARGING BULL: stone statue while locked, glowing gold once woken. */
function drawBullExit(
  v: View,
  wx0: number,
  wy0: number,
  awake: boolean,
  time: number,
): void {
  texRect(v, wx0 + 1, wy0 + 11, TILE - 2, 5, (wx, wy) => {
    void wx;
    const by = wy - wy0 - 11;
    const stone = awake ? 0x8a8578 : 0x565349;
    if (by < 1.2) return lighten(stone, 0.24);
    if (by > 3.6) return darken(stone, 0.22);
    return stone;
  });
  const glow = (Math.sin(time * 4) * 0.5 + 0.5) * 0.22;
  const pal: Palette = awake
    ? {
        g: lighten(0xf7931a, glow),
        h: 0xffd166,
        f: 0xc8860a,
        t: 0xc8860a,
        K: 0x8a5c0a,
      }
    : { g: 0x8a8578, h: 0xa8a498, f: 0x6f6b60, t: 0x6f6b60, K: 0x54514a };
  spriteBox(v, BULL, pal, wx0, wy0 - 1, TILE, 12);
  if (awake) {
    const px = Math.floor((wx0 + TILE / 2 - v.camX) / v.s);
    const py = Math.floor((wy0 + 6 - v.camY) / v.s);
    drawTiny(fb, px - 1, py - 8, "B", 1, 0xffd166);
  }
}

// --- HUD and overlays -------------------------------------------------------

function drawHud(screen: Screen, game: Game, scale: Scale): void {
  const bg = INK;
  const coin = game.levelLabel("coin", "BTC");
  const page = game.levelLabel("pageStat", "PAGES");
  const zone = game.activeZone();
  screen.fill(0, 0, screen.cols, HUD, " ", PAPER, bg);

  let x = 1;
  const put = (text: string, fg: Rgb) => {
    screen.write(x, 0, clip(text, Math.max(0, screen.cols - 1 - x)), fg, bg);
    x += text.length;
  };
  put(`${coin} ${pad2(game.coins)}`, ORANGE);
  put("  ", PAPER);
  put("♥".repeat(clamp(game.lives, 0, 8)), RED);
  put("♡".repeat(clamp(3 - game.lives, 0, 3)), GRAY);
  put("  ", PAPER);
  put(`${page} ${game.pages}/${game.pageTotal()}`, PAPER);
  const score = `SCORE ${game.score}`;
  screen.write(
    Math.max(x + 2, screen.cols - score.length - 1),
    0,
    score,
    YELLOW,
    bg,
  );

  const line2 = game.toastTime > 0 ? game.toast : zone.name;
  screen.write(
    1,
    1,
    clip(line2, screen.cols - 2),
    game.toastTime > 0 ? YELLOW : PAPER,
    bg,
  );

  const help = scale.playY + scale.playRows;
  if (help < screen.rows) {
    screen.fill(0, help, screen.cols, screen.rows - help, " ", GRAY, bg);
    const cannon = game.hasSatCannon() ? "  X/F fire" : "";
    screen.write(
      1,
      help,
      clip(
        `WASD/ARROWS move  SPACE jump${cannon}  ESC pause  Q quit`,
        screen.cols - 2,
      ),
      GRAY,
      bg,
    );
  }
}

function frame(
  screen: Screen,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  for (let i = 0; i < w; i += 1) {
    screen.put(x + i, y, i === 0 ? "╭" : i === w - 1 ? "╮" : "─", ORANGE, INK);
    screen.put(
      x + i,
      y + h - 1,
      i === 0 ? "╰" : i === w - 1 ? "╯" : "─",
      ORANGE,
      INK,
    );
  }
  for (let i = 1; i < h - 1; i += 1) {
    screen.put(x, y + i, "│", ORANGE, INK);
    screen.put(x + w - 1, y + i, "│", ORANGE, INK);
  }
}

function drawTitle(screen: Screen, game: Game): void {
  const arcade = game.currentLevel().mode === "brawler";
  // Compact rows keep all six choices and fighter controls visible at 40x16.
  const w = Math.min(64, screen.cols - 2);
  const h = Math.min(arcade ? 23 : 19, screen.rows);
  const x = Math.floor((screen.cols - w) / 2);
  const y = Math.max(0, Math.floor((screen.rows - h) / 2));
  screen.fill(x, y, w, h, " ", PAPER, INK);
  frame(screen, x, y, w, h);
  centerAt(screen, x, w, y + 1, "8-BIT SATOSHI", ORANGE, INK);
  for (const [i, level] of game.levels().entries()) {
    const line = `${i === game.levelIndex ? ">" : " "} ${i + 1}. ${level.title}`;
    screen.write(
      x + 2,
      y + 3 + i,
      clip(line, w - 4),
      i === game.levelIndex ? ORANGE : PAPER,
      INK,
    );
  }
  if (arcade) {
    const character = CHARACTERS[game.selectedFighter];
    centerAt(
      screen,
      x,
      w,
      y + 10,
      `[ / ] FIGHTER: ${character.name}`,
      ORANGE,
      INK,
    );
    centerAt(
      screen,
      x,
      w,
      y + 11,
      `${character.move} / ${character.special}`,
      PAPER,
      INK,
    );
    if (h >= 19) {
      centerAt(
        screen,
        x,
        w,
        y + 13,
        "X punch  E grab/throw  C special",
        PAPER,
        INK,
      );
      centerAt(screen, x, w, y + 14, "WASD/ARROWS move  SPACE jump", GRAY, INK);
    }
  } else if (h >= 19) {
    centerAt(screen, x, w, y + 10, game.currentLevel().description, GRAY, INK);
    centerAt(screen, x, w, y + 12, "WASD/ARROWS move  SPACE jump", GRAY, INK);
  }
  centerAt(
    screen,
    x,
    w,
    y + h - 3,
    "ENTER start  UP/DOWN or 1-6 select",
    PAPER,
    INK,
  );
  centerAt(screen, x, w, y + h - 2, "Q quit", GRAY, INK);
}

function drawBrawlerHud(screen: Screen, game: Game, scale: Scale): void {
  const fight = game.brawler;
  if (!fight) return;
  const s = fight.state,
    p = s.player,
    character = CHARACTERS[s.characterId];
  const status = `${character.short} HP ${Math.ceil(p.hp)}/${p.maxHp}  LIVES ${game.lives}  SPECIAL ${Math.floor(s.special)}%  SATS ${game.coins}  SCORE ${game.score}`;
  const compactStatus = `HP ${Math.ceil(p.hp)}/${p.maxHp} LIVES ${game.lives} POWER ${Math.floor(s.special)}%`;
  screen.write(
    0,
    0,
    clip(screen.cols < 65 ? compactStatus : status, screen.cols),
    PAPER,
    INK,
  );
  const progress = `${s.stage + 1}/8 ${STAGES[s.stage].name}  WAVE ${s.wave + 1}/2`;
  const target = s.enemies.find((e) => e.kind === "boss" && e.hp > 0);
  const action = target
    ? `  BOSS ${target.hp}/${target.maxHp}`
    : s.waveClear
      ? "  GO RIGHT!"
      : `  ${s.combo} HIT COMBO`;
  screen.write(0, 1, clip(progress + action, screen.cols), ORANGE, INK);
  const held = p.held ?? fight.nearbyItem();
  const item = held ? ITEMS[held.kind].name : character.special;
  const help =
    screen.cols < 100
      ? `WASD move X hit E grab/throw C power SPACE jump P pause`
      : `WASD/ARROWS move  X punch  E grab/throw  C special  SPACE jump  P pause  ${item}`;
  screen.write(
    0,
    scale.playY + scale.playRows,
    clip(help, screen.cols),
    PAPER,
    INK,
  );
  // Story and pickup instructions use terminal text so they remain readable.
  if (s.messageTime > 0 || p.held) {
    const message = p.held
      ? `${ITEMS[p.held.kind].name} in hand. E to throw.`
      : s.message;
    const width = screen.cols - 2;
    const lines = wrap(message, width);
    const row = scale.playY + scale.playRows - lines.length;
    for (const [i, line] of lines.entries()) {
      screen.fill(0, row + i, screen.cols, 1, " ", PAPER, INK);
      screen.write(1, row + i, line, PAPER, INK);
    }
  }
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines;
}

function drawBanner(screen: Screen, title: string, copy: string): void {
  const w = Math.min(screen.cols - 6, Math.max(40, copy.length + 4));
  const h = 7;
  const x = Math.max(1, Math.floor((screen.cols - w) / 2));
  const y = Math.max(3, Math.floor(screen.rows / 2) - 3);
  screen.fill(x, y, w, h, " ", PAPER, INK);
  frame(screen, x, y, w, h);
  centerAt(screen, x, w, y + 2, title, ORANGE, INK);
  centerAt(screen, x, w, y + 4, copy, PAPER, INK);
}

function centerAt(
  screen: Screen,
  x: number,
  w: number,
  y: number,
  text: string,
  fg: Rgb,
  bg: Rgb,
): void {
  const t = clip(text, w - 2);
  screen.write(x + Math.max(1, Math.floor((w - t.length) / 2)), y, t, fg, bg);
}

function pad2(n: number): string {
  return String(Math.max(0, n | 0)).padStart(2, "0");
}

function clip(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.slice(0, Math.max(0, width));
}
