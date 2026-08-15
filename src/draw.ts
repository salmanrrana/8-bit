import { TILE, VIEW_H, type Game, type Solid } from "./game.ts";
import { Fb, hash2, lerpC } from "./fb.ts";
import {
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
  type Palette
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
const CROWD_SHIRTS = [0xf7931a, 0x8d6de8, 0x36bd63, 0x4aa8f0, 0xffd166, 0xd64533];

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
  return { playX: 0, playY: HUD, playCols, playRows, pixW, pixH, unit, viewW: pixW * unit };
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

  if (game.subMode === "overworld") drawOverworld(game, scale, sky, sky2, accent);
  else drawSide(game, scale, sky, sky2, ground, accent);

  fb.blit(screen, scale.playX, scale.playY);

  drawHud(screen, game, scale);
  if (game.phase === "paused") drawBanner(screen, "PAUSED", "ENTER continue   R restart   M levels   Q quit");
  else if (game.phase === "complete") {
    drawBanner(
      screen,
      "BITCOIN LIVES",
      `${game.levelLabel("coin", "BTC")} ${pad2(game.coins)}  ${game.levelLabel("pageStat", "PAGES")} ${game.pages}/${game.pageTotal()}  SCORE ${game.score}   ENTER again   M levels`
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
  tex: (wx: number, wy: number) => number
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
  flip = false
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
function coinAt(v: View, wx: number, wy: number, r: number, time: number): void {
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

function drawSide(game: Game, scale: Scale, sky: number, sky2: number, ground: number, accent: number): void {
  const s = scale.unit;
  const visH = scale.pixH * s;
  const v: View = { s, camX: game.cameraX, camY: VIEW_H - visH };
  const dark = luminance(sky) < 64;

  for (let py = 0; py < fb.h; py += 1) {
    const wy = v.camY + py * s;
    const t = clamp(wy / VIEW_H, 0, 1);
    fb.px.fill(lerpC(sky, sky2, t), py * fb.w, (py + 1) * fb.w);
  }

  drawBackdrop(v, sky, sky2, ground, dark);

  for (const solid of game.solids) drawSolid(game, v, solid, sky2, ground, accent);

  for (const hazard of game.hazards) {
    texRect(v, hazard.x, hazard.y, hazard.w, hazard.h, (wx, wy) => {
      const lx = ((wx - hazard.x) % 8 + 8) % 8;
      const rise = 1 - Math.abs(lx - 4) / 4;
      const top = hazard.y + hazard.h * (1 - rise);
      if (wy < top) return -1;
      if (wy < top + 3) return C_WHITE;
      return lerpC(0xd64533, 0x7a2018, (wy - hazard.y) / hazard.h);
    });
  }

  for (const coin of game.coinsList) {
    if (!coin.taken) coinAt(v, coin.x + coin.w / 2, coin.y + coin.h / 2, coin.w / 2 + 1, game.time);
  }

  for (const page of game.pagesList) {
    if (page.taken) continue;
    const bob = Math.sin(game.time * 3 + page.x * 0.05) * 2;
    spriteBox(v, PAGE, PAGE_PAL, page.x, page.y + bob, page.w, page.h);
  }

  for (const cp of game.checkpoints) drawCheckpoint(v, cp.x, cp.y, cp.taken, game.time);

  for (const ally of game.allies) {
    const pal = NPC_SKINS[ally.kind] ?? DEFAULT_NPC_PAL;
    spriteBox(v, NPC, pal, ally.x, ally.y, ally.w ?? 18, ally.h ?? 22);
  }

  const walkFrame = Math.floor(game.time * 8) % 2 === 0;
  for (const enemy of game.enemies) {
    const skin = ENEMY_SKINS[enemy.type];
    const pal: Palette = { a: skin.a, d: skin.d, K: 0x14161e, e: skin.eye ?? 0xf6f1e0 };
    if (!enemy.alive) {
      if (enemy.squashed > 0) texRect(v, enemy.x, enemy.y + enemy.h - 5, enemy.w, 5, () => skin.d);
      continue;
    }
    if (enemy.type === "shitgun") {
      spriteBox(v, TURRET, pal, enemy.x, enemy.y, enemy.w, enemy.h);
    } else {
      spriteBox(v, walkFrame ? WALKER_A : WALKER_B, pal, enemy.x, enemy.y, enemy.w, enemy.h, enemy.vx < 0);
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

  const blink = game.player.invincible > 0 && Math.floor(game.time * 12) % 2 === 0;
  if (!blink) drawPlayer(v, game);

  for (const p of game.particles) {
    if (p.alive) texRect(v, p.x - 1.2, p.y - 1.2, 2.4, 2.4, () => (p.life > 0.2 ? 0xffd166 : 0xfff2c0));
  }
}

function drawBackdrop(v: View, sky: number, sky2: number, ground: number, dark: boolean): void {
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
        if (hash2(Math.floor(wx / 3), Math.floor(wy / 3)) > 0.988) fb.px[row + px] = 0xd8dce8;
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
    const topMid = 204 - (8 + (Math.sin(wxMid * 0.014) * 0.5 + 0.5) * 26 + (Math.sin(wxMid * 0.041) * 0.5 + 0.5) * 6);

    for (let py = 0; py < fb.h; py += 1) {
      const wy = v.camY + (py + 0.5) * v.s;
      if (wy >= 204) break;
      const i = py * fb.w + px;
      if (wy >= topMid) {
        fb.px[i] = wy < topMid + 2.5 ? hillTop : hill;
      } else if (wy >= topFar) {
        fb.px[i] =
          wy > topFar + 4 && hash2(Math.floor(wxFar / 5), Math.floor(wy / 7)) > 0.9
            ? winLit
            : skyline;
      }
    }
  }
}

function drawSolid(game: Game, v: View, solid: Solid, sky2: number, ground: number, accent: number): void {
  const { x, y, w, h, kind } = solid;

  if (kind === "ground") {
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
      return hash2(Math.floor(wx / 4), Math.floor(wy / 4)) > 0.82 ? darken(soil, 0.12) : soil;
    });
    return;
  }

  if (kind === "question") {
    const hit = solid.hit;
    const pulse = hit ? 0 : (Math.sin(game.time * 5 + x * 0.1) * 0.5 + 0.5) * 0.18;
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
        return (Math.floor(bx / 3) + Math.floor(by / 3) + ants) % 2 === 0 ? ghost : -1;
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
      const shirt = CROWD_SHIRTS[Math.floor(hash2(person, 11) * CROWD_SHIRTS.length)];
      const lx = ((wx - x) % 5 + 5) % 5;
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
      const inRow = ((wy - y) % 8 + 8) % 8;
      const joint = (wx - x + brickRow * 8 + 100000) % 12;
      let c = inRow < v.s || joint < v.s ? darken(base, 0.45) : base;
      if (hp < 3 && hash2(Math.floor(wx / 2), Math.floor(wy / 2)) > (hp === 2 ? 0.85 : 0.6)) {
        c = darken(c, 0.55);
      }
      return c;
    });
    return;
  }

  // "ledger" platforms and "block" stacks: warm brick with seams.
  const base = kind === "block" ? lerpC(0x8a5a30, accent, 0.25) : lerpC(0x7a4c28, accent, 0.35);
  texRect(v, x, y, w, h, (wx, wy) => {
    const by = wy - y;
    if (by < 2) return lighten(base, 0.3);
    if (by > h - 2) return darken(base, 0.35);
    const seg = (wx - x + 100000) % 14;
    if (seg < 1.4) return darken(base, 0.3);
    if (seg > 6 && seg < 7.6 && by > 4 && by < 7) return darken(base, 0.2);
    return base;
  });
}

function drawCheckpoint(v: View, x: number, y: number, taken: boolean, time: number): void {
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
    if (bx < 0 || by < 0 || bx > g.w || by > g.h) return lerpC(accent, 0xffffff, glow);
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
  else if (Math.abs(p.vx) > 12) art = Math.floor(game.time * 10) % 2 === 0 ? PLAYER_RUN1 : PLAYER_RUN2;
  spriteBox(v, art, PLAYER_PAL, p.x, p.y, p.w, p.h, p.facing < 0);
  if (game.hasSatCannon()) {
    const bx = p.facing > 0 ? p.x + p.w - 2 : p.x - 5;
    texRect(v, bx, p.y + 8, 7, 3, () => 0x4a525e);
  }
}

// --- Overworld --------------------------------------------------------------

function drawOverworld(game: Game, scale: Scale, sky: number, sky2: number, accent: number): void {
  const s = scale.unit;
  const visW = scale.pixW * s;
  const visH = scale.pixH * s;
  const mapW = game.ow.cols * TILE;
  const mapH = game.ow.rows * TILE;
  const pcx = game.owPlayer.x + game.owPlayer.w / 2;
  const pcy = game.owPlayer.y + game.owPlayer.h / 2;
  const camX = mapW <= visW ? (mapW - visW) / 2 : clamp(pcx - visW / 2, 0, mapW - visW);
  const camY = mapH <= visH ? (mapH - visH) / 2 : clamp(pcy - visH / 2, 0, mapH - visH);
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

  const startTx = Math.max(0, Math.floor(camX / TILE));
  const startTy = Math.max(0, Math.floor(camY / TILE));
  const endTx = Math.min(game.ow.cols, Math.ceil((camX + visW) / TILE) + 1);
  const endTy = Math.min(game.ow.rows, Math.ceil((camY + visH) / TILE) + 1);
  const level = game.currentLevel();
  const venueTotal = level.mode === "overworld" ? Object.keys(level.venues).length : 4;

  for (let ty = startTy; ty < endTy; ty += 1) {
    const rowStr = game.ow.grid[ty] ?? "";
    for (let tx = startTx; tx < endTx; tx += 1) {
      const t = rowStr[tx] ?? "#";
      const wx0 = tx * TILE;
      const wy0 = ty * TILE;

      if (t === "#") {
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          const bx = wx - wx0;
          const by = wy - wy0;
          if (by < 2.4) return roof;
          const inWx = (bx >= 3 && bx <= 6) || (bx >= 10 && bx <= 13);
          const inWy = (by >= 4 && by <= 7) || (by >= 10 && by <= 13);
          if (inWx && inWy) {
            return hash2(tx * 13 + Math.floor(bx / 7), ty * 7 + Math.floor(by / 6)) > 0.5 ? winLit : winDark;
          }
          return building;
        });
        continue;
      }

      if (t === "~") {
        const foam = ty > 0 && (game.ow.grid[ty - 1]?.[tx] ?? "#") !== "~";
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          if (foam && wy - wy0 < 1.8) return lighten(water, 0.35);
          if (hash2(Math.floor(wx / 7), Math.floor(wy / 4) + wavePhase) > 0.87) return lighten(water, 0.22);
          return water;
        });
        continue;
      }

      if (t >= "1" && t <= "9") {
        const cleared = game.venuesCleared.includes(t);
        const doorC = cleared ? 0x36bd63 : lerpC(accent, 0xf7931a, 0.4);
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          const bx = wx - wx0;
          const by = wy - wy0;
          if (by < 2.4) return roof;
          if (bx >= 4 && bx <= 12 && by >= 5) {
            if (bx < 5.2 || bx > 10.8 || by < 6.2) return lighten(doorC, 0.25);
            return doorC;
          }
          return building;
        });
        const px = Math.floor((wx0 + TILE / 2 - camX) / s) - 1;
        const py = Math.floor((wy0 + 8 - camY) / s) - 2;
        drawTiny(fb, px, py, t, 1, C_WHITE);
        continue;
      }

      if (t === "X") {
        const open = game.venuesCleared.length >= venueTotal;
        const vaultGlow = open ? (Math.sin(game.time * 4) * 0.5 + 0.5) * 0.3 : 0;
        const gold = open ? lighten(0xf7931a, vaultGlow) : 0x5a5248;
        texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
          const bx = wx - wx0;
          const by = wy - wy0;
          if (bx < 1.8 || by < 1.8 || bx > TILE - 1.8 || by > TILE - 1.8) return gold;
          return 0x241c12;
        });
        const px = Math.floor((wx0 + TILE / 2 - camX) / s) - 1;
        const py = Math.floor((wy0 + TILE / 2 - camY) / s) - 2;
        drawTiny(fb, px, py, "X", 1, gold);
        continue;
      }

      // Pavement, with planter "o" and coin "c" variants on top.
      texRect(v, wx0, wy0, TILE, TILE, (wx, wy) => {
        const seamX = ((wx % TILE) + TILE) % TILE;
        const seamY = ((wy % TILE) + TILE) % TILE;
        if (seamX < 0.9 || seamY < 0.9) return darken(road, 0.2);
        return hash2(Math.floor(wx / 3), Math.floor(wy / 3)) > 0.85 ? roadLite : road;
      });

      if (t === "o") {
        const cx = wx0 + TILE / 2;
        const cy = wy0 + TILE / 2;
        texRect(v, wx0 + 2, wy0 + 2, TILE - 4, TILE - 4, (wx, wy) => {
          const d = Math.hypot(wx - cx, wy - cy);
          if (d > 6) return -1;
          if (d > 5) return 0x3a3026;
          return hash2(Math.floor(wx / 2), Math.floor(wy / 2)) > 0.6 ? 0x2f8d50 : 0x25703f;
        });
      } else if (t === "c") {
        const taken = game.ow.coins.some((c) => c.tx === tx && c.ty === ty && c.taken);
        if (!taken) coinAt(v, wx0 + TILE / 2, wy0 + TILE / 2, 5, game.time);
      }
    }
  }

  for (const npc of game.ow.npcs) {
    const pal = NPC_SKINS[npc.kind] ?? DEFAULT_NPC_PAL;
    spriteBox(v, NPC, pal, npc.tx * TILE + 2, npc.ty * TILE, 12, 16);
  }

  const bob = game.owPlayer.moving ? Math.sin(game.time * 12) * 1.2 : 0;
  spriteBox(
    v, OW_HERO, PLAYER_PAL,
    game.owPlayer.x, game.owPlayer.y + bob, game.owPlayer.w, game.owPlayer.h,
    game.owPlayer.facing === "left"
  );
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
  screen.write(Math.max(x + 2, screen.cols - score.length - 1), 0, score, YELLOW, bg);

  const line2 = game.toastTime > 0 ? game.toast : zone.name;
  screen.write(1, 1, clip(line2, screen.cols - 2), game.toastTime > 0 ? YELLOW : PAPER, bg);

  const help = scale.playY + scale.playRows;
  if (help < screen.rows) {
    screen.fill(0, help, screen.cols, screen.rows - help, " ", GRAY, bg);
    const cannon = game.hasSatCannon() ? "  X/F fire" : "";
    screen.write(1, help, clip(`WASD/ARROWS move  SPACE jump${cannon}  ESC pause  Q quit`, screen.cols - 2), GRAY, bg);
  }
}

function frame(screen: Screen, x: number, y: number, w: number, h: number): void {
  for (let i = 0; i < w; i += 1) {
    screen.put(x + i, y, i === 0 ? "╭" : i === w - 1 ? "╮" : "─", ORANGE, INK);
    screen.put(x + i, y + h - 1, i === 0 ? "╰" : i === w - 1 ? "╯" : "─", ORANGE, INK);
  }
  for (let i = 1; i < h - 1; i += 1) {
    screen.put(x, y + i, "│", ORANGE, INK);
    screen.put(x + w - 1, y + i, "│", ORANGE, INK);
  }
}

function drawTitle(screen: Screen, game: Game): void {
  const cx = Math.floor(screen.cols / 2);
  const top = Math.max(3, Math.floor(screen.rows / 2) - 8);
  const boxW = Math.min(52, screen.cols - 4);
  const boxX = Math.max(2, cx - Math.floor(boxW / 2));
  screen.fill(boxX, top, boxW, 16, " ", PAPER, INK);
  frame(screen, boxX, top, boxW, 16);
  center(screen, top + 1, "8-BIT SATOSHI", ORANGE, INK);
  center(screen, top + 2, "Build Bitcoin. Beat fiat. Reach the whitepaper.", PAPER, INK);
  const levels = game.levels();
  for (let i = 0; i < levels.length; i += 1) {
    const mark = i === game.levelIndex ? ">" : " ";
    const line = `${mark} ${i + 1}. ${levels[i].title}`;
    screen.write(boxX + 4, top + 4 + i, clip(line, boxW - 8), i === game.levelIndex ? ORANGE : PAPER, INK);
  }
  screen.write(boxX + 4, top + 9, clip(game.levels()[game.levelIndex]?.description ?? "", boxW - 8), GRAY, INK);
  center(screen, top + 12, "ENTER start   UP/DOWN select   1-4 jump   Q quit", GRAY, INK);
  center(screen, top + 13, "WASD or arrows to move, SPACE to jump", GRAY, INK);
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

function center(screen: Screen, y: number, text: string, fg: Rgb, bg: Rgb): void {
  const x = Math.max(0, Math.floor((screen.cols - text.length) / 2));
  screen.write(x, y, clip(text, screen.cols), fg, bg);
}

function centerAt(screen: Screen, x: number, w: number, y: number, text: string, fg: Rgb, bg: Rgb): void {
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
