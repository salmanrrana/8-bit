import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, overlap } from "./game.ts";
import { Keys, consumeEdges, feedKeys, resetHeld, setTime } from "./input.ts";

test("AABB overlap", () => {
  assert.equal(
    overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }),
    true,
  );
  assert.equal(
    overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }),
    false,
  );
});

test("level 1 loads and the player lands on the ground", () => {
  const game = new Game();
  game.start();
  assert.equal(game.currentLevel().title, "THE WHITEPAPER RUN");
  assert.ok(game.solids.length > 0);
  let t = 0;
  for (let i = 0; i < 90; i += 1) {
    t += 16.67;
    game.tick(t);
  }
  assert.equal(game.player.onGround, true);
  assert.equal(Math.round(game.player.y), 180);
});

test("confirmation blocks toggle on the run clock", () => {
  const game = new Game();
  game.levelIndex = 1;
  game.start();
  const block = game.solids.find((s) => s.kind === "confirm");
  assert.ok(block);
  game.time = 0;
  assert.equal(game.isConfirmed(block), true);
  game.time = 1.4;
  assert.equal(game.isConfirmed(block), false);
});

test("arrow keys and kitty key-up parse", () => {
  resetHeld();
  feedKeys("\x1b[D", "");
  assert.equal(Keys.left, true);
  setTime(0);
  feedKeys("\x1b[57350;1:3u", "");
  assert.equal(Keys.left, false);
});

test("side-view camera resets when entering a venue", () => {
  const game = new Game();
  game.levelIndex = 3;
  game.start();
  game.cameraY = 80;
  const door = game.ow.doors[0];
  assert.ok(door);
  game.owPlayer.x = door.tx * 16 + 3;
  game.owPlayer.y = door.ty * 16 + 2;
  let t = 0;
  for (let i = 0; i < 8; i += 1) {
    t += 16.67;
    game.tick(t);
  }
  assert.equal(game.subMode, "venue");
  assert.equal(game.cameraY, 0);
});

const frameTimes = new WeakMap<Game, number>();

function frames(game: Game, count: number): void {
  let t = frameTimes.get(game) ?? 0;
  for (let i = 0; i < count; i += 1) {
    t += 16.67;
    game.tick(t);
  }
  frameTimes.set(game, t);
}

/** Drop the player onto every living enemy from above — a clean stomp each time.
 * Invincibility stays high so stray contact can't damage-reset the building
 * (it blocks hurtPlayer but never blocks stomps). Each enemy is first moved to
 * a street column free of overhead solids so the drop lands clean. */
function stompEverything(game: Game, limit = Infinity): void {
  game.player.invincible = 2;
  let kills = 0;
  for (const enemy of game.enemies) {
    if (!enemy.alive || kills >= limit) continue;
    let spot: number | undefined;
    for (let cx = 8; cx < game.worldW - 24 && spot === undefined; cx += 4) {
      const blocked = game.solids.some(
        (s) => s.y < enemy.y - 6 && cx + 14 > s.x && cx < s.x + s.w,
      );
      if (!blocked) spot = cx;
    }
    assert.ok(spot !== undefined, "no clear column found");
    enemy.vx = 0;
    enemy.minX = spot;
    enemy.maxX = spot + 20;
    enemy.x = spot;
    game.player.x = spot;
    game.player.y = enemy.y - 30;
    game.player.vx = 0;
    game.player.vy = 240;
    frames(game, 8);
    kills += 1;
  }
}

test("level 5 loads as WALL STREET with taxis and four multi-floor venues", () => {
  const game = new Game();
  game.levelIndex = 4;
  game.start();
  const level = game.currentLevel();
  assert.equal(level.title, "WALL STREET");
  assert.equal(level.mode, "overworld");
  if (level.mode !== "overworld")
    throw new Error("expected an overworld level");
  assert.equal(game.subMode, "overworld");
  assert.equal(game.ow.taxis.length, 3);
  assert.equal(Object.keys(level.venues).length, 4);
  assert.equal(game.pageTotal(), 4);
});

test("multi-floor venue chains stairwells and clears only on a full sweep", () => {
  const game = new Game();
  game.levelIndex = 4;
  game.start();
  const door = game.ow.doors.find((d) => d.key === "1");
  assert.ok(door);
  game.owPlayer.x = door.tx * 16 + 3;
  game.owPlayer.y = door.ty * 16 + 2;
  frames(game, 6);
  assert.equal(game.subMode, "venue");
  assert.equal(game.floorIndex, 0);
  assert.equal(game.visitTotal, 12);

  stompEverything(game);
  assert.equal(game.visitKills, 4);

  // Lobby stairwell leads up to the trading floor.
  Object.assign(game.goal, { x: 742, y: 140, w: 30, h: 64 });
  game.player.x = 750;
  game.player.y = 150;
  game.player.vy = 0;
  frames(game, 3);
  assert.equal(game.floorIndex, 1);

  stompEverything(game);
  game.player.x = 860;
  game.player.y = 150;
  game.player.vy = 0;
  frames(game, 3);
  assert.equal(game.floorIndex, 2);

  stompEverything(game);
  assert.equal(game.visitKills, 12);
  game.player.x = 800;
  game.player.y = 150;
  game.player.vy = 0;
  frames(game, 3);
  assert.equal(game.subMode, "overworld");
  assert.deepEqual(game.venuesCleared, ["1"]);
});

test("dying inside a half-cleared tower resets the building", () => {
  const game = new Game();
  game.levelIndex = 4;
  game.start();
  const door = game.ow.doors.find((d) => d.key === "2");
  assert.ok(door);
  game.owPlayer.x = door.tx * 16 + 3;
  game.owPlayer.y = door.ty * 16 + 2;
  frames(game, 6);
  assert.equal(game.visitTotal, 14);
  stompEverything(game, 2);
  assert.equal(game.visitKills, 2);

  // Take a hit without stomping: the whole visit is forfeit.
  game.player.invincible = 0;
  game.player.vy = 0;
  game.player.y = 178;
  const thug = game.enemies.find((e) => e.alive);
  assert.ok(thug);
  game.player.x = thug.x;
  frames(game, 3);
  assert.equal(game.lives, 2);
  assert.equal(game.floorIndex, 0);
  assert.equal(game.visitKills, 0);
  assert.equal(game.enemies.filter((e) => e.alive).length, 4);
  assert.deepEqual(game.venuesCleared, []);
});

test("taxi contact costs a life and respawns the walker at the curb", () => {
  const game = new Game();
  game.levelIndex = 4;
  game.start();
  frames(game, 4);
  const cab = game.ow.taxis[0];
  assert.ok(cab);
  game.owPlayer.x = cab.x;
  game.owPlayer.y = cab.y;
  game.owPlayer.invincible = 0;
  frames(game, 2);
  assert.equal(game.lives, 2);
  assert.ok(game.owPlayer.invincible > 0);
});

test("Level 6 keyboard selection, fighter cycling, pause and restart work", () => {
  resetHeld();
  consumeEdges();
  const game = new Game();
  feedKeys("5", "");
  game.handleUi();
  assert.equal(game.currentLevel().title, "WALL STREET");
  consumeEdges();
  feedKeys("6]", "");
  game.handleUi();
  assert.equal(game.currentLevel().title, "FOR THE PEOPLE");
  assert.equal(game.selectedFighter, "satoshi");
  consumeEdges();
  feedKeys("\r", "");
  game.handleUi();
  consumeEdges();
  assert.equal(game.subMode, "brawler");
  assert.equal(game.brawler?.state.characterId, "satoshi");
  assert.equal(game.brawler?.state.player.hp, 110);
  assert.equal(game.pageTotal(), 8);
  frames(game, 5);
  feedKeys("p", "");
  game.handleUi();
  consumeEdges();
  const time = game.brawler?.state.time;
  frames(game, 20);
  assert.equal(game.brawler?.state.time, time);
  assert.equal(game.phase, "paused");
  feedKeys("r", "");
  game.handleUi();
  consumeEdges();
  assert.equal(game.phase, "playing");
  assert.equal(game.brawler?.state.stage, 0);
  assert.equal(game.brawler?.state.time, 0);
  assert.equal(game.lives, 3);
  game.pause();
  feedKeys("m", "");
  game.handleUi();
  consumeEdges();
  feedKeys("1\r", "");
  game.handleUi();
  consumeEdges();
  assert.equal(game.subMode, "side");
  assert.equal(game.brawler, null);
  resetHeld();
});

test("fast terminal taps survive frames with no physics step and run once during catch-up", () => {
  resetHeld();
  consumeEdges();
  const game = new Game();
  game.levelIndex = 5;
  game.start();
  const fight = game.brawler;
  assert.ok(fight);
  game.tick(100);
  feedKeys("\x1b[101;1:1u\x1b[101;1:3u\x1b[32;1:1u\x1b[32;1:3u", "");
  game.tick(104);
  consumeEdges();
  assert.equal(fight.state.throws, 0);
  game.tick(167);
  assert.equal(fight.state.throws, 1);
  assert.ok(fight.state.player.z > 0);
  for (let time = 184; time < 1800; time += 17) game.tick(time);
  assert.equal(fight.state.throws, 1);
  assert.equal(fight.state.player.z, 0);
  resetHeld();
  consumeEdges();
});

test("the terminal game reaches victory with real combat rewards and district progress", () => {
  resetHeld();
  consumeEdges();
  const game = new Game();
  game.levelIndex = 5;
  game.start();
  const fight = game.brawler;
  assert.ok(fight);
  for (let frame = 0; frame < 60 * 480 && game.phase === "playing"; frame++) {
    const p = fight.state.player;
    const enemy = fight.state.enemies
      .filter((e) => e.hp > 0)
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    Keys.fire = true;
    Keys.special = fight.state.special === 100;
    Keys.throw = frame % 42 === 0;
    Keys.jumpPressed = frame % 45 === 0;
    Keys.right = enemy
      ? enemy.x - p.x > 48 || (enemy.x > p.x && p.facing < 0)
      : true;
    Keys.left =
      !!enemy && (enemy.x - p.x < -48 || (enemy.x < p.x && p.facing > 0));
    Keys.up = !!enemy && enemy.y < p.y - 6;
    Keys.down = !!enemy && enemy.y > p.y + 6;
    game.tick(100 + (frame * 1000) / 60);
    consumeEdges();
  }
  assert.equal(game.phase, "complete");
  assert.equal(game.pages, 8);
  assert.ok(game.coins > 0);
  assert.ok(game.score > 0);
  assert.ok(game.lives > 0);
  resetHeld();
  consumeEdges();
});

test("the brawler spends terminal lives and reaches game over without resetting a district", () => {
  resetHeld();
  consumeEdges();
  const game = new Game();
  game.levelIndex = 5;
  game.start();
  const fight = game.brawler;
  assert.ok(fight);
  for (let life = 2; life >= 0; life--) {
    const p = fight.state.player,
      enemy = fight.state.enemies[0];
    p.hp = 1;
    p.invincible = 0;
    enemy.x = p.x + 30;
    enemy.y = p.y;
    enemy.wind = 0.01;
    enemy.attackFacing = -1;
    frames(game, 65);
    assert.equal(game.lives, life);
  }
  assert.equal(game.phase, "gameover");
  assert.equal(game.deaths, 3);
  assert.equal(fight.state.stopped, true);
  resetHeld();
  consumeEdges();
});

test("quick punch taps survive an empty tick, hitstop and attack cooldown exactly once", () => {
  resetHeld();
  consumeEdges();
  const game = new Game();
  game.levelIndex = 5;
  game.start();
  const fight = game.brawler;
  assert.ok(fight);
  const p = fight.state.player,
    enemy = fight.state.enemies[0];
  enemy.x = p.x + 20;
  enemy.y = p.y;
  enemy.speed = 0;
  enemy.cooldown = 10;
  enemy.throwCooldown = 10;
  game.tick(100);
  feedKeys("\x1b[120;1:1u\x1b[120;1:3u", "");
  assert.equal(Keys.fire, false);
  game.tick(104);
  consumeEdges();
  assert.equal(enemy.hp, enemy.maxHp);
  game.tick(167);
  assert.equal(enemy.hp, enemy.maxHp - 18);
  feedKeys("\x1b[120;1:1u\x1b[120;1:3u", "");
  game.tick(171);
  consumeEdges();
  for (let time = 188; time < 1300; time += 17) game.tick(time);
  assert.equal(enemy.hp, enemy.maxHp - 18 - 24);
  assert.equal(fight.state.bestCombo, 2);
  assert.equal(fight.state.pendingFire, false);
  resetHeld();
  consumeEdges();
});
