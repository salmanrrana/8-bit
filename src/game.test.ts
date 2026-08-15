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
