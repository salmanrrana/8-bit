import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, overlap } from "./game.ts";
import { Keys, feedKeys, resetHeld, setTime } from "./input.ts";

test("AABB overlap", () => {
  assert.equal(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
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

function frames(game: Game, count: number): void {
  let t = game.lastNow || 0;
  for (let i = 0; i < count; i += 1) {
    t += 16.67;
    game.tick(t);
  }
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
        (s) => s.y < enemy.y - 6 && cx + 14 > s.x && cx < s.x + s.w
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
  assert.equal(game.currentLevel().title, "WALL STREET");
  assert.equal(game.subMode, "overworld");
  assert.equal(game.ow.taxis.length, 3);
  assert.equal(Object.keys(game.currentLevel().venues).length, 4);
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
