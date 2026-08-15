import { stdin, stdout } from "node:process";
import {
  consumeEdges,
  disableKeyUp,
  enableKeyUp,
  feedKeys,
  Keys,
  setTime
} from "./input.ts";
import { Game } from "./game.ts";
import { drawGame, layoutScale } from "./draw.ts";
import { enterAlt, leaveAlt, Screen } from "./screen.ts";

if (!stdin.isTTY || !stdout.isTTY) {
  console.error("8bit needs an interactive terminal.");
  process.exit(1);
}

const game = new Game();
const screen = new Screen(stdout.columns || 80, stdout.rows || 24);
let pending = "";
let running = true;

function sizeView(): void {
  const cols = stdout.columns || 80;
  const rows = stdout.rows || 24;
  screen.resize(cols, rows);
  const scale = layoutScale(screen.cols, screen.rows);
  game.setViewWidth(scale.viewW);
}

function shutdown(): void {
  if (!running) return;
  running = false;
  disableKeyUp(stdout);
  if (stdin.isTTY) stdin.setRawMode(false);
  leaveAlt(stdout);
  stdin.pause();
}

stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding("utf8");
enterAlt(stdout);
enableKeyUp(stdout);
sizeView();

stdin.on("data", (chunk: string) => {
  setTime(performance.now());
  pending = feedKeys(chunk, pending);
  if (Keys.quitPressed && game.phase === "title") {
    shutdown();
    process.exit(0);
  }
});

stdout.on("resize", sizeView);
process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("exit", shutdown);

function frame(): void {
  if (!running) return;
  const now = performance.now();
  setTime(now);
  const action = game.handleUi();
  if (action === "quit") {
    shutdown();
    process.exit(0);
  }
  game.tick(now);
  consumeEdges();
  const scale = layoutScale(screen.cols, screen.rows);
  drawGame(screen, game, scale);
  screen.flush(stdout);
  setTimeout(frame, Math.max(0, 16 - (performance.now() - now)));
}

frame();
