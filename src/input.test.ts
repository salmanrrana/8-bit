import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "./game.ts";
import { Keys, consumeEdges, feedKeys, resetHeld, setTime } from "./input.ts";

test("legacy terminal rapid grab/throw works while release-reporting terminals keep repeats held", () => {
  resetHeld();
  consumeEdges();
  const game = new Game();
  game.levelIndex = 5;
  game.start();
  const fight = game.brawler;
  assert.ok(fight);
  fight.state.items[0].x = fight.state.player.x;
  fight.state.items[0].y = fight.state.player.y;
  game.tick(100);
  setTime(100);
  feedKeys("e", "");
  game.tick(117);
  consumeEdges();
  assert.equal(fight.state.player.held?.kind, "chair");
  for (let now = 134; now <= 338; now += 17) {
    setTime(now);
    game.tick(now);
    consumeEdges();
  }
  setTime(350);
  assert.equal(Keys.throw, true, "the first press still appears held");
  feedKeys("e", "");
  game.tick(367);
  consumeEdges();
  assert.equal(fight.state.player.held, null);
  assert.equal(fight.state.throws, 1);
  assert.equal(fight.state.projectiles[0].kind, "chair");

  // A terminal with explicit releases can distinguish taps and auto-repeat.
  resetHeld();
  feedKeys("\x1b[101;1:1u", "");
  assert.equal(Keys.throwPressed, true);
  consumeEdges();
  feedKeys("\x1b[101;1:2u", "");
  assert.equal(Keys.throwPressed, false);
  feedKeys("\x1b[101;1:3u\x1b[101;1:1u", "");
  assert.equal(Keys.throwPressed, true);
  resetHeld();
  consumeEdges();
});
