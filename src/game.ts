import { Keys } from "./input.ts";
import { LEVELS } from "./levels.ts";
import type {
  AllyDef,
  Box,
  ConfirmCycle,
  EnemyType,
  Level,
  OverworldLevel,
  Phase,
  PlatformKind,
  SubMode,
  Venue,
  Zone
} from "./types.ts";

export const VIEW_H = 240;
export const TILE = 16;
const STEP = 1 / 60;
const MAX_FRAME = 1 / 15;
const GRAVITY = 1220;
const RUN_ACCEL = 980;
const AIR_ACCEL = 720;
const FRICTION = 760;
const MAX_RUN = 148;
const JUMP = -396;
const JUMP_PER_BTC = 1.2;
const MAX_BTC_JUMP_BOOST = 72;
const STOMP = -280;
const CROWD_BOUNCE = -520;
const COYOTE = 0.085;
const JUMP_BUFFER = 0.11;
const OW_SPEED = 92;
const OW_PW = 10;
const OW_PH = 12;
const SHITGUN_RANGE = 210;
const SHITGUN_PERIOD = 1.7;
const SHITCOIN_SPEED = 120;
const SAT_SHOT_SPEED = 300;
const FIRE_COOLDOWN = 0.35;

export const ENEMY_TYPES: Record<EnemyType, { speed: number; score: number; stompToast: string; glyph: string }> = {
  banker: { speed: 28, score: 200, stompToast: "Threat cleared.", glyph: "B" },
  printer: { speed: 28, score: 200, stompToast: "Printer jammed.", glyph: "$" },
  miner: { speed: 36, score: 350, stompToast: "Threat cleared.", glyph: "m" },
  fud: { speed: 30, score: 200, stompToast: "FUD debunked.", glyph: "F" },
  chargeback: { speed: 26, score: 200, stompToast: "Reversal blocked.", glyph: "C" },
  exploit: { speed: 40, score: 350, stompToast: "Exploit patched.", glyph: "e" },
  suit: { speed: 30, score: 200, stompToast: "Lobbyist bounced.", glyph: "U" },
  agent: { speed: 26, score: 200, stompToast: "Tail shaken.", glyph: "A" },
  wiretap: { speed: 44, score: 350, stompToast: "Wiretap crushed.", glyph: "w" },
  shiller: { speed: 32, score: 200, stompToast: "Shill silenced.", glyph: "S" },
  rugpull: { speed: 26, score: 200, stompToast: "Rug pinned down.", glyph: "R" },
  degen: { speed: 42, score: 350, stompToast: "Position liquidated.", glyph: "D" },
  shitgun: { speed: 0, score: 400, stompToast: "Shooter scrapped.", glyph: "T" }
};

export type Solid = Box & { kind: PlatformKind; hit: boolean; cycle: ConfirmCycle | null };
export type Pickup = Box & { taken: boolean };
export type Enemy = Box & {
  vx: number;
  minX: number;
  maxX: number;
  type: EnemyType;
  alive: boolean;
  squashed: number;
  fireTimer: number;
};
export type Shot = { alive: boolean; x: number; y: number; vx: number };
export type Particle = { alive: boolean; x: number; y: number; vx: number; vy: number; life: number };
export type Ally = AllyDef & { greeted: boolean };
export type Barricade = Box & { hp: number; solid: Solid };
export type Checkpoint = { x: number; y: number; index: number; name: string; taken: boolean };

export type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: number;
  onGround: boolean;
  coyote: number;
  jumpBuffer: number;
  invincible: number;
  fireCooldown: number;
};

export type OwPlayer = {
  x: number;
  y: number;
  w: number;
  h: number;
  facing: "up" | "down" | "left" | "right";
  moving: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function enemyConfig(type: EnemyType) {
  return ENEMY_TYPES[type] ?? ENEMY_TYPES.banker;
}

export class Game {
  phase: Phase = "title";
  paused = false;
  levelIndex = 0;
  subMode: SubMode = "side";
  venueKey: string | null = null;
  venuesCleared: string[] = [];
  stashesTaken: string[] = [];
  owReturn: { tx: number; ty: number } | null = null;
  toastQueue: string[] = [];
  cameraX = 0;
  cameraY = 0;
  viewW = 256;
  time = 0;
  coins = 0;
  pages = 0;
  lives = 3;
  score = 0;
  checkpointX = 30;
  currentZone = 0;
  toast = "";
  toastTime = 0;
  crowdSurfed = false;
  deaths = 0;

  worldW = 0;
  zones: Zone[] = [];
  venueZone: Zone | null = null;
  goal: Box = { x: 0, y: 0, w: 0, h: 0 };

  player: Player = {
    x: 32, y: 160, w: 14, h: 24, vx: 0, vy: 0, facing: 1,
    onGround: false, coyote: 0, jumpBuffer: 0, invincible: 0, fireCooldown: 0
  };
  owPlayer: OwPlayer = { x: 0, y: 0, w: OW_PW, h: OW_PH, facing: "down", moving: false };

  solids: Solid[] = [];
  coinsList: Pickup[] = [];
  pagesList: Pickup[] = [];
  enemies: Enemy[] = [];
  hazards: Box[] = [];
  checkpoints: Checkpoint[] = [];
  allies: Ally[] = [];
  barricades: Barricade[] = [];
  shots: Shot[] = Array.from({ length: 12 }, () => ({ alive: false, x: 0, y: 0, vx: 0 }));
  satShots: Shot[] = Array.from({ length: 6 }, () => ({ alive: false, x: 0, y: 0, vx: 0 }));
  particles: Particle[] = Array.from({ length: 48 }, () => ({
    alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0
  }));

  ow = {
    grid: [] as string[],
    cols: 0,
    rows: 0,
    coins: [] as Array<{ tx: number; ty: number; taken: boolean }>,
    doors: [] as Array<{ tx: number; ty: number; key: string }>,
    exit: null as { tx: number; ty: number } | null,
    npcs: [] as Array<{ kind: string; tx: number; ty: number; name: string; lines: string[]; greeted: boolean }>
  };

  private accumulator = 0;
  private lastNow = 0;

  levels(): Level[] {
    return LEVELS;
  }

  currentLevel(): Level {
    const level = LEVELS[this.levelIndex];
    if (!level) throw new Error(`No level at index ${this.levelIndex}`);
    return level;
  }

  isOverworldLevel(): boolean {
    return this.currentLevel().mode === "overworld";
  }

  levelLabel(key: "coin" | "pageStat" | "pageNote", fallback: string): string {
    const labels = this.currentLevel().labels;
    return labels && labels[key] != null ? labels[key] : fallback;
  }

  pageTotal(): number {
    const level = this.currentLevel();
    if (level.mode === "overworld") {
      return Object.values(level.venues).reduce((sum, venue) => sum + (venue.layout.pages?.length ?? 0), 0);
    }
    return level.layout.pages.length;
  }

  activeZone(): Zone {
    if (this.subMode === "venue" && this.venueZone) return this.venueZone;
    if (this.isOverworldLevel()) return this.zones[0] ?? fallbackZone();
    return this.zones[this.currentZone] ?? fallbackZone();
  }

  hasSatCannon(): boolean {
    if (this.subMode !== "venue" || !this.venueKey) return false;
    const level = this.currentLevel();
    if (level.mode !== "overworld") return false;
    return level.venues[this.venueKey]?.weapon === "satcannon";
  }

  isConfirmed(solid: Solid): boolean {
    const cycle = solid.cycle;
    if (!cycle || !(cycle.periodMs > 0) || !(cycle.onMs > 0)) return true;
    return ((this.time * 1000 + (cycle.phaseMs || 0)) % cycle.periodMs) < cycle.onMs;
  }

  handleUi(): "quit" | null {
    if (Keys.quitPressed && this.phase === "title") return "quit";
    if (this.phase === "title") {
      if (Keys.selectUp) this.levelIndex = (this.levelIndex + LEVELS.length - 1) % LEVELS.length;
      if (Keys.selectDown) this.levelIndex = (this.levelIndex + 1) % LEVELS.length;
      if (Keys.digit >= 1 && Keys.digit <= LEVELS.length) this.levelIndex = Keys.digit - 1;
      if (Keys.enterPressed || Keys.jumpPressed) this.start();
      return null;
    }
    if (this.phase === "paused") {
      if (Keys.enterPressed || Keys.escPressed) this.resume();
      else if (Keys.restartPressed || Keys.jumpPressed) this.start();
      else if (Keys.menuPressed) this.toTitle();
      else if (Keys.quitPressed) return "quit";
      return null;
    }
    if (this.phase === "complete" || this.phase === "gameover") {
      if (Keys.enterPressed || Keys.restartPressed || Keys.jumpPressed) this.start();
      else if (Keys.menuPressed || Keys.escPressed) this.toTitle();
      else if (Keys.quitPressed) return "quit";
      return null;
    }
    if (this.phase === "playing" && Keys.escPressed) this.pause();
    if (this.phase === "playing" && Keys.quitPressed) this.pause();
    return null;
  }

  start(): void {
    this.phase = "playing";
    this.paused = false;
    this.lastNow = 0;
    this.accumulator = 0;
    Keys.jumpPressed = false;
    Keys.firePressed = false;
    this.resetRun(true);
  }

  pause(): void {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.paused = true;
  }

  resume(): void {
    this.phase = "playing";
    this.paused = false;
  }

  toTitle(): void {
    this.phase = "title";
    this.paused = false;
  }

  setViewWidth(px: number): void {
    this.viewW = Math.max(160, px);
  }

  tick(now: number): void {
    if (!this.lastNow) this.lastNow = now;
    const dt = Math.min((now - this.lastNow) / 1000, MAX_FRAME);
    this.lastNow = now;
    this.accumulator += dt;
    while (this.accumulator >= STEP) {
      this.update(STEP);
      this.accumulator -= STEP;
    }
  }

  private update(dt: number): void {
    if (this.phase !== "playing") return;

    this.time += dt;
    this.toastTime = Math.max(0, this.toastTime - dt);
    if (this.toastTime <= 0 && this.toastQueue.length > 0) {
      this.toast = this.toastQueue.shift() ?? "";
      this.toastTime = 2.4;
    }
    this.player.invincible = Math.max(0, this.player.invincible - dt);

    if (this.subMode === "overworld") {
      this.updateOverworld(dt);
      this.updateParticles(dt);
      return;
    }

    this.updateZone();
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateCollectibles();
    this.updateCheckpoints();
    this.updateAllies();
    this.updateParticles(dt);

    if (overlap(this.player, this.goal)) {
      if (this.subMode === "venue") {
        this.exitVenue();
        return;
      }
      this.completeGame();
    }

    this.cameraX = clamp(this.player.x - this.viewW * 0.37, 0, Math.max(0, this.worldW - this.viewW));
    this.cameraY = 0;
  }

  private completeGame(): void {
    this.phase = "complete";
  }

  private gameOver(): void {
    this.phase = "gameover";
  }

  private resetRun(full: boolean): void {
    if (full) {
      this.coins = 0;
      this.pages = 0;
      this.lives = 3;
      this.score = 0;
      this.checkpointX = 30;
      this.currentZone = 0;
      this.time = 0;
      this.deaths = 0;
      this.crowdSurfed = false;
      this.initLevel();
    }

    this.player.x = this.checkpointX;
    this.player.y = 150;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.facing = 1;
    this.player.onGround = false;
    this.player.coyote = 0;
    this.player.jumpBuffer = 0;
    this.player.invincible = 1.1;
    this.player.fireCooldown = 0;
    if (this.subMode !== "overworld") this.cameraX = Math.max(0, this.player.x - 80);
    if (full) this.toastQueue = [];
    this.toast = full
      ? (this.isOverworldLevel()
        ? "Walk the city. Enter every venue. Ignore the shills."
        : `Run, jump, collect ${this.levelLabel("coin", "BTC")}.`)
      : "Back to checkpoint.";
    this.toastTime = 2.2;
  }

  private initLevel(): void {
    const level = this.currentLevel();
    if (level.mode === "overworld") {
      this.subMode = "overworld";
      this.venueKey = null;
      this.venuesCleared = [];
      this.stashesTaken = [];
      this.owReturn = null;
      this.toastQueue = [];
      this.worldW = level.worldW;
      this.zones = [{ x: 0, ...level.zone }];
      Object.assign(this.goal, { x: -100, y: -100, w: 0, h: 0 });
      this.clearSide();
      this.initOverworld(level);
      return;
    }

    this.subMode = "side";
    this.worldW = level.worldW;
    this.zones = level.zones.map((zone) => ({ ...zone }));
    Object.assign(this.goal, level.goal);
    this.clearSide();
    const layout = level.layout;
    for (const [x, w] of layout.ground) this.addGround(x, w);
    for (const [x, y, w, h, kind, cycle] of layout.platforms) this.addPlatform(x, y, w, h, kind, cycle);
    for (const [x, count] of layout.blockStacks ?? []) this.addBlockStack(x, count);
    for (const [x, y, count] of layout.coinArcs) this.addCoinArc(x, y, count);
    for (const [x, y] of layout.pages) this.addPage(x, y);
    for (const [x, y, minX, maxX, type] of layout.enemies) this.addEnemy(x, y, minX, maxX, type);
    for (const [x, y, w, h] of layout.hazards) this.hazards.push({ x, y, w, h });
    for (const cp of layout.checkpoints ?? []) this.checkpoints.push({ ...cp, taken: false });
    for (const ally of layout.allies ?? []) this.addAlly(ally);
  }

  private clearSide(): void {
    this.solids.length = 0;
    this.coinsList.length = 0;
    this.pagesList.length = 0;
    this.enemies.length = 0;
    this.hazards.length = 0;
    this.checkpoints.length = 0;
    this.allies.length = 0;
    this.barricades.length = 0;
    for (const s of this.shots) s.alive = false;
    for (const s of this.satShots) s.alive = false;
  }

  private initOverworld(level: OverworldLevel): void {
    const width = level.map[0]?.length ?? 0;
    this.ow.grid = level.map;
    this.ow.cols = width;
    this.ow.rows = level.map.length;
    this.ow.coins = [];
    this.ow.doors = [];
    this.ow.exit = null;
    this.ow.npcs = [];

    for (let ty = 0; ty < this.ow.rows; ty += 1) {
      for (let tx = 0; tx < this.ow.cols; tx += 1) {
        const t = this.ow.grid[ty][tx];
        if (t === "c") this.ow.coins.push({ tx, ty, taken: false });
        else if (t >= "1" && t <= "9" && level.venues[t]) this.ow.doors.push({ tx, ty, key: t });
        else if (t === "X") this.ow.exit = { tx, ty };
      }
    }
    for (const npc of level.npcs) this.ow.npcs.push({ ...npc, greeted: false });

    this.owPlayer.x = level.spawn.tx * TILE + (TILE - OW_PW) / 2;
    this.owPlayer.y = level.spawn.ty * TILE + (TILE - OW_PH) / 2;
    this.owPlayer.facing = "down";
    this.owPlayer.moving = false;
    const mapW = this.ow.cols * TILE;
    const mapH = this.ow.rows * TILE;
    this.cameraX = clamp(this.owPlayer.x - this.viewW / 2, 0, Math.max(0, mapW - this.viewW));
    this.cameraY = clamp(this.owPlayer.y - VIEW_H / 2, 0, Math.max(0, mapH - VIEW_H));
  }

  private addGround(x: number, w: number): void {
    this.solids.push({ x, y: 204, w, h: 36, kind: "ground", hit: false, cycle: null });
  }

  private addPlatform(x: number, y: number, w: number, h: number, kind: PlatformKind, cycle?: ConfirmCycle): void {
    this.solids.push({ x, y, w, h, kind, hit: false, cycle: cycle ?? null });
  }

  private addBlockStack(x: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.solids.push({ x, y: 188 - i * TILE, w: TILE, h: TILE, kind: "block", hit: false, cycle: null });
    }
  }

  private addCoinArc(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.coinsList.push({
        x: x + i * 22,
        y: y - Math.abs(i - Math.floor(count / 2)) * 8,
        w: 8, h: 8, taken: false
      });
    }
  }

  private addPage(x: number, y: number): void {
    this.pagesList.push({ x, y, w: 11, h: 14, taken: false });
  }

  private addEnemy(x: number, y: number, minX: number, maxX: number, type: EnemyType): void {
    this.enemies.push({
      x, y, w: 16, h: 18, vx: enemyConfig(type).speed, minX, maxX, type,
      alive: true, squashed: 0, fireTimer: (x % 100) / 100 * SHITGUN_PERIOD
    });
  }

  private addAlly(spec: AllyDef): void {
    this.allies.push({
      ...spec,
      w: spec.w ?? 18,
      h: spec.h ?? 22,
      triggerX: typeof spec.triggerX === "number" ? spec.triggerX : spec.x,
      greeted: false
    });
  }

  private addBarricade(x: number, count: number): void {
    const h = count * TILE;
    const solid: Solid = { x, y: 204 - h, w: TILE, h, kind: "barricade", hit: false, cycle: null };
    this.solids.push(solid);
    this.barricades.push({ x, y: 204 - h, w: TILE, h, hp: 3, solid });
  }

  private enterVenue(key: string): void {
    const level = this.currentLevel();
    if (level.mode !== "overworld") return;
    const venue = level.venues[key];
    if (!venue) return;

    this.subMode = "venue";
    this.venueKey = key;
    this.venueZone = { x: 0, ...venue.zone };
    const door = this.ow.doors.find((d) => d.key === key);
    if (door) this.owReturn = { tx: door.tx, ty: door.ty + 1 };

    this.worldW = venue.worldW;
    Object.assign(this.goal, venue.goal);
    this.clearSide();
    this.player.fireCooldown = 0;

    const layout = venue.layout;
    for (const [x, w] of layout.ground) this.addGround(x, w);
    for (const [x, y, w, h, kind, cycle] of layout.platforms ?? []) this.addPlatform(x, y, w, h, kind, cycle);
    for (const [x, count] of layout.barricades ?? []) this.addBarricade(x, count);
    for (const [x, y, count] of layout.coinArcs ?? []) this.addCoinArc(x, y, count);
    if (!this.stashesTaken.includes(key)) {
      for (const [x, y] of layout.pages ?? []) this.addPage(x, y);
    }
    if (!this.venuesCleared.includes(key)) {
      for (const [x, y, minX, maxX, type] of layout.enemies ?? []) this.addEnemy(x, y, minX, maxX, type);
    }
    for (const [x, y, w, h] of layout.hazards ?? []) this.hazards.push({ x, y, w, h });

    this.player.x = venue.spawnX;
    this.player.y = 150;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.facing = 1;
    this.player.onGround = false;
    this.player.coyote = 0;
    this.player.jumpBuffer = 0;
    this.player.invincible = 1.1;
    this.cameraX = 0;
    this.cameraY = 0;
    this.toast = venue.weapon === "satcannon"
      ? "SAT CANNON armed! X/F shoots. Break the token walls."
      : `${venue.name} — clear the room.`;
    this.toastTime = 2.4;
  }

  private exitVenue(): void {
    const level = this.currentLevel();
    if (level.mode !== "overworld") return;
    const key = this.venueKey;
    const venue: Venue | undefined = key ? level.venues[key] : undefined;
    const alreadyCleared = key ? this.venuesCleared.includes(key) : true;
    const clearedNow = !alreadyCleared && this.enemies.length > 0 && this.enemies.every((e) => !e.alive);
    if (clearedNow && key && venue) {
      this.venuesCleared.push(key);
      const total = Object.keys(level.venues).length;
      this.toast = this.venuesCleared.length >= total
        ? "All venues cleared! The vault is open."
        : `${venue.name} cleared. ${this.venuesCleared.length}/${total} venues.`;
      this.toastTime = 2.6;
    } else {
      this.toast = alreadyCleared ? "Back to the streets." : "Shills remain — come back to clear it.";
      this.toastTime = 2.2;
    }

    this.subMode = "overworld";
    this.venueKey = null;
    this.venueZone = null;
    this.clearSide();
    if (this.owReturn) {
      this.owPlayer.x = this.owReturn.tx * TILE + (TILE - OW_PW) / 2;
      this.owPlayer.y = this.owReturn.ty * TILE + (TILE - OW_PH) / 2;
    }
    this.owPlayer.facing = "down";
  }

  private owSolidAt(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.ow.cols || ty >= this.ow.rows) return true;
    const t = this.ow.grid[ty][tx];
    return t === "#" || t === "~";
  }

  private owMoveAxis(dx: number, dy: number): void {
    const p = this.owPlayer;
    p.x += dx;
    p.y += dy;
    const minTx = Math.floor(p.x / TILE);
    const maxTx = Math.floor((p.x + p.w - 1) / TILE);
    const minTy = Math.floor(p.y / TILE);
    const maxTy = Math.floor((p.y + p.h - 1) / TILE);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (!this.owSolidAt(tx, ty)) continue;
        if (dx > 0) p.x = tx * TILE - p.w;
        else if (dx < 0) p.x = (tx + 1) * TILE;
        else if (dy > 0) p.y = ty * TILE - p.h;
        else if (dy < 0) p.y = (ty + 1) * TILE;
      }
    }
  }

  private updateOverworld(dt: number): void {
    const level = this.currentLevel();
    if (level.mode !== "overworld") return;
    const mx = (Keys.right ? 1 : 0) - (Keys.left ? 1 : 0);
    const my = (Keys.down ? 1 : 0) - (Keys.up ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    if (mx !== 0) this.owMoveAxis((mx / len) * OW_SPEED * dt, 0);
    if (my !== 0) this.owMoveAxis(0, (my / len) * OW_SPEED * dt);
    this.owPlayer.moving = mx !== 0 || my !== 0;
    if (mx < 0) this.owPlayer.facing = "left";
    else if (mx > 0) this.owPlayer.facing = "right";
    else if (my < 0) this.owPlayer.facing = "up";
    else if (my > 0) this.owPlayer.facing = "down";

    const cx = this.owPlayer.x + this.owPlayer.w / 2;
    const cy = this.owPlayer.y + this.owPlayer.h / 2;
    const ptx = Math.floor(cx / TILE);
    const pty = Math.floor(cy / TILE);

    for (const coin of this.ow.coins) {
      if (coin.taken || coin.tx !== ptx || coin.ty !== pty) continue;
      coin.taken = true;
      this.coins += 1;
      this.score += 50;
      this.burst(cx, cy, 5);
    }

    for (const npc of this.ow.npcs) {
      if (npc.greeted) continue;
      const nx = npc.tx * TILE + TILE / 2;
      const ny = npc.ty * TILE + TILE / 2;
      if (Math.abs(nx - cx) < 22 && Math.abs(ny - cy) < 22) {
        npc.greeted = true;
        const [first, ...rest] = npc.lines;
        this.toast = first ?? "";
        this.toastTime = 2.4;
        this.toastQueue.push(...rest);
      }
    }

    for (const door of this.ow.doors) {
      if (door.tx === ptx && door.ty === pty) {
        this.enterVenue(door.key);
        return;
      }
    }

    if (this.ow.exit && this.ow.exit.tx === ptx && this.ow.exit.ty === pty) {
      const total = Object.keys(level.venues).length;
      if (this.venuesCleared.length >= total) this.completeGame();
      else if (this.toastTime <= 0) {
        const left = total - this.venuesCleared.length;
        this.toast = `Vault locked — clear ${left} more venue${left === 1 ? "" : "s"}.`;
        this.toastTime = 2;
      }
    }

    const mapW = this.ow.cols * TILE;
    const mapH = this.ow.rows * TILE;
    this.cameraX = clamp(cx - this.viewW / 2, 0, Math.max(0, mapW - this.viewW));
    this.cameraY = clamp(cy - VIEW_H / 2, 0, Math.max(0, mapH - VIEW_H));
  }

  private updateZone(): void {
    if (this.subMode === "venue") return;
    let zoneIndex = 0;
    for (let i = this.zones.length - 1; i >= 0; i -= 1) {
      if (this.player.x >= this.zones[i].x) {
        zoneIndex = i;
        break;
      }
    }
    if (zoneIndex !== this.currentZone) {
      this.currentZone = zoneIndex;
      this.toast = this.zones[zoneIndex].text;
      this.toastTime = 3.2;
    }
  }

  private jumpImpulse(): number {
    return JUMP - Math.min(this.coins * JUMP_PER_BTC, MAX_BTC_JUMP_BOOST);
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    const move = (Keys.right ? 1 : 0) - (Keys.left ? 1 : 0);
    const accel = p.onGround ? RUN_ACCEL : AIR_ACCEL;
    if (move !== 0) {
      p.vx += move * accel * dt;
      p.facing = move;
    } else if (p.onGround) {
      const drop = FRICTION * dt;
      if (Math.abs(p.vx) <= drop) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * drop;
    }
    p.vx = clamp(p.vx, -MAX_RUN, MAX_RUN);

    if (Keys.jumpPressed) p.jumpBuffer = JUMP_BUFFER;
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);

    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = this.jumpImpulse();
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this.burst(p.x + p.w * 0.5, p.y + p.h, 4);
    }
    if (Keys.jumpReleased && p.vy < -120) p.vy *= 0.58;

    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (Keys.firePressed && this.hasSatCannon() && p.fireCooldown <= 0) {
      p.fireCooldown = FIRE_COOLDOWN;
      this.spawnSatShot();
    }

    p.vy = Math.min(p.vy + GRAVITY * dt, 560);
    this.moveAxis(p, p.vx * dt, 0);
    p.onGround = false;
    this.moveAxis(p, 0, p.vy * dt);

    if (p.y > VIEW_H + 40) this.hurtPlayer(true);
    for (const hazard of this.hazards) {
      if (overlap(p, hazard)) {
        this.hurtPlayer(false);
        break;
      }
    }
  }

  private moveAxis(body: Player, dx: number, dy: number): void {
    if (dx !== 0) body.x += dx;
    if (dy !== 0) body.y += dy;
    for (const solid of this.solids) {
      if (!overlap(body, solid)) continue;
      if (!this.isConfirmed(solid)) continue;
      if (dx > 0) {
        body.x = solid.x - body.w;
        body.vx = 0;
      } else if (dx < 0) {
        body.x = solid.x + solid.w;
        body.vx = 0;
      } else if (dy > 0) {
        body.y = solid.y - body.h;
        if (solid.kind === "crowd") {
          body.vy = CROWD_BOUNCE;
          this.burst(body.x + body.w * 0.5, solid.y, 8);
          if (!this.crowdSurfed) {
            this.crowdSurfed = true;
            this.toast = "Crowd surge! The people carry you.";
            this.toastTime = 1.8;
          }
        } else {
          body.vy = 0;
          body.onGround = true;
        }
      } else if (dy < 0) {
        body.y = solid.y + solid.h;
        body.vy = 20;
        this.bumpBlock(solid);
      }
    }
    body.x = clamp(body.x, 0, this.worldW - body.w);
  }

  private bumpBlock(solid: Solid): void {
    if (solid.kind !== "question" || solid.hit) return;
    solid.hit = true;
    this.coins += 3;
    this.score += 300;
    this.toast = `+3 ${this.levelLabel("coin", "BTC")}`;
    this.toastTime = 1.2;
    this.burst(solid.x + solid.w * 0.5, solid.y, 10);
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        enemy.squashed -= dt;
        continue;
      }
      if (enemy.type === "shitgun") {
        enemy.fireTimer -= dt;
        const dx = (p.x + p.w / 2) - (enemy.x + enemy.w / 2);
        if (enemy.fireTimer <= 0 && Math.abs(dx) < SHITGUN_RANGE && Math.abs(dx) > 18) {
          enemy.fireTimer = SHITGUN_PERIOD;
          this.spawnShot(enemy.x + (dx > 0 ? enemy.w : -6), enemy.y + 5, Math.sign(dx) * SHITCOIN_SPEED);
        }
      } else {
        enemy.x += enemy.vx * dt;
        if (enemy.x <= enemy.minX || enemy.x + enemy.w >= enemy.maxX) {
          enemy.vx *= -1;
          enemy.x = clamp(enemy.x, enemy.minX, enemy.maxX - enemy.w);
        }
      }
      if (!overlap(p, enemy)) continue;
      const stomped = p.vy > 90 && p.y + p.h - enemy.y < 12;
      if (stomped) {
        const cfg = enemyConfig(enemy.type);
        enemy.alive = false;
        enemy.squashed = 0.3;
        p.vy = STOMP;
        this.score += cfg.score;
        this.toast = cfg.stompToast;
        this.toastTime = 1.1;
        this.burst(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.5, 8);
      } else {
        this.hurtPlayer(false);
      }
    }
  }

  private spawnShot(x: number, y: number, vx: number): void {
    for (const s of this.shots) {
      if (s.alive) continue;
      s.alive = true;
      s.x = x;
      s.y = y;
      s.vx = vx;
      return;
    }
  }

  private spawnSatShot(): void {
    const p = this.player;
    for (const s of this.satShots) {
      if (s.alive) continue;
      s.alive = true;
      s.x = p.facing > 0 ? p.x + p.w : p.x - 6;
      s.y = p.y + 9;
      s.vx = p.facing * SAT_SHOT_SPEED;
      return;
    }
  }

  private shotHitsSolid(box: Box): Solid | null {
    for (const solid of this.solids) {
      if (!this.isConfirmed(solid)) continue;
      if (overlap(box, solid)) return solid;
    }
    return null;
  }

  private updateShots(dt: number): void {
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.x += s.vx * dt;
      const box = { x: s.x, y: s.y, w: 8, h: 8 };
      if (s.x < -12 || s.x > this.worldW + 12 || this.shotHitsSolid(box)) {
        s.alive = false;
        continue;
      }
      if (overlap(box, this.player)) {
        s.alive = false;
        this.hurtPlayer(false);
      }
    }
    for (const s of this.satShots) {
      if (!s.alive) continue;
      s.x += s.vx * dt;
      const box = { x: s.x, y: s.y, w: 6, h: 4 };
      if (s.x < -12 || s.x > this.worldW + 12) {
        s.alive = false;
        continue;
      }
      const solid = this.shotHitsSolid(box);
      if (solid) {
        s.alive = false;
        if (solid.kind === "barricade") this.damageBarricade(solid);
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive || !overlap(box, enemy)) continue;
        const cfg = enemyConfig(enemy.type);
        s.alive = false;
        enemy.alive = false;
        enemy.squashed = 0.3;
        this.score += cfg.score;
        this.toast = cfg.stompToast;
        this.toastTime = 1.1;
        this.burst(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.5, 8);
        break;
      }
    }
  }

  private damageBarricade(solid: Solid): void {
    const barricade = this.barricades.find((b) => b.solid === solid);
    if (!barricade) return;
    barricade.hp -= 1;
    if (barricade.hp <= 0) {
      const index = this.solids.indexOf(solid);
      if (index >= 0) this.solids.splice(index, 1);
      this.barricades.splice(this.barricades.indexOf(barricade), 1);
      this.score += 150;
      this.toast = "Token wall down!";
      this.toastTime = 1.2;
    }
  }

  private updateCollectibles(): void {
    const p = this.player;
    for (const coin of this.coinsList) {
      if (!coin.taken && overlap(p, coin)) {
        coin.taken = true;
        this.coins += 1;
        this.score += 50;
      }
    }
    for (const page of this.pagesList) {
      if (!page.taken && overlap(p, page)) {
        page.taken = true;
        if (this.subMode === "venue" && this.venueKey && !this.stashesTaken.includes(this.venueKey)) {
          this.stashesTaken.push(this.venueKey);
        }
        this.pages += 1;
        this.score += 250;
        this.toast = `${this.levelLabel("pageNote", "Whitepaper page")} ${this.pages}/${this.pageTotal()}`;
        this.toastTime = 1.7;
      }
    }
  }

  private updateCheckpoints(): void {
    for (const checkpoint of this.checkpoints) {
      if (!checkpoint.taken && this.player.x > checkpoint.x) {
        checkpoint.taken = true;
        this.checkpointX = checkpoint.x;
        this.toast = `Checkpoint: ${checkpoint.name}`;
        this.toastTime = 1.6;
      }
    }
  }

  private updateAllies(): void {
    for (const ally of this.allies) {
      if (ally.greeted || !ally.line) continue;
      if (this.player.x > ally.triggerX) {
        ally.greeted = true;
        this.toast = ally.line;
        this.toastTime = 2.4;
      }
    }
  }

  private hurtPlayer(fell: boolean): void {
    if (this.player.invincible > 0 && !fell) return;
    this.lives -= 1;
    this.deaths += 1;
    if (this.lives <= 0) {
      this.gameOver();
      return;
    }
    this.burst(this.player.x + this.player.w * 0.5, this.player.y + this.player.h * 0.5, 14);
    this.resetRun(false);
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += 460 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private burst(x: number, y: number, count: number): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.alive) continue;
      const angle = (spawned / Math.max(1, count)) * Math.PI * 2 + this.time;
      const speed = 38 + spawned * 6;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 80;
      p.life = 0.38 + spawned * 0.012;
      spawned += 1;
      if (spawned >= count) break;
    }
  }
}

function fallbackZone(): Zone {
  return {
    x: 0, name: "", sky: "#101018", sky2: "#101018", ground: "#343b3b",
    accent: "#f7931a", text: ""
  };
}
