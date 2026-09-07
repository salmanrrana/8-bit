import { startHdWindow } from "./hd-window.ts";
import { HdRenderer } from "./hd-render.ts";
import { TerminalGraphics } from "./terminal-graphics.ts";
import { stdin, stdout } from "node:process";
import {
  consumeEdges,
  disableKeyUp,
  enableKeyUp,
  feedKeys,
  Keys,
  setTime,
} from "./input.ts";
import { Game } from "./game.ts";
import { drawGame, layoutScale } from "./draw.ts";
import { enterAlt, leaveAlt, Screen } from "./screen.ts";

const args = new Set(process.argv.slice(2));
if (args.has("--help")) {
  console.log(
    "eightbit [--window | --text] [--no-open]\n\nLevel 6 uses full-resolution terminal images when supported.\nOtherwise it opens a local HD window. --window opens it directly;\n--text keeps the classic terminal renderer. --no-open prints the window URL.",
  );
  process.exit(0);
}
for (const arg of args)
  if (!["--window", "--text", "--no-open"].includes(arg)) {
    console.error(`Unknown option: ${arg}. Use --help.`);
    process.exit(1);
  }
if (args.has("--window") && args.has("--text")) {
  console.error("Choose either --window or --text. Use --help.");
  process.exit(1);
}
const game = new Game();
let windowClose: (() => void) | undefined;
if (args.has("--window")) {
  game.levelIndex = 5;
  const viewer = await startHdWindow(game, !args.has("--no-open"));
  console.log(
    `HD arcade: ${viewer.url}\nKeep this terminal open. Ctrl+C stops the game.`,
  );
  process.once("SIGINT", () => {
    viewer.close();
    process.exit(0);
  });
} else {
  if (!stdin.isTTY || !stdout.isTTY) {
    console.error("8bit needs an interactive terminal.");
    process.exit(1);
  }

  const graphics = new TerminalGraphics();
  const hd = new HdRenderer();
  const probingSince = performance.now();
  let imageVisible = false;
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
    stdout.off("resize", sizeView);
    if (imageVisible) stdout.write(graphics.clear());
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
    pending = feedKeys(chunk, pending, (response) => graphics.accept(response));
    if (Keys.quitPressed && game.phase === "title") {
      shutdown();
      process.exit(0);
    }
  });

  stdout.on("resize", sizeView);
  process.on("SIGINT", () => {
    shutdown();
    windowClose?.();
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
    const arcade = game.subMode === "brawler" && game.phase !== "title";
    if (arcade && !args.has("--text")) {
      if (graphics.supported) {
        const output = graphics.encode(hd.draw(game), screen.cols, screen.rows);
        if (!imageVisible) stdout.write("\x1b[2J");
        imageVisible = true;
        const ready = stdout.write(output);
        const schedule = () =>
          setTimeout(frame, Math.max(0, 33 - (performance.now() - now)));
        if (ready) schedule();
        else stdout.once("drain", schedule);
        return;
      }
      if (graphics.answered || now - probingSince > 600) {
        shutdown();
        void startHdWindow(game, !args.has("--no-open"))
          .then((viewer) => {
            windowClose = viewer.close;
            console.log(
              `HD arcade: ${viewer.url}\nThis terminal cannot display full-resolution images. The game runs locally in the window.\nKeep this terminal open. Ctrl+C stops the game.`,
            );
          })
          .catch((error) => {
            console.error(error);
            process.exitCode = 1;
          });
        return;
      }
    }
    if (imageVisible) {
      stdout.write(graphics.clear() + "\x1b[2J");
      imageVisible = false;
      screen.invalidate();
    }
    const scale = layoutScale(screen.cols, screen.rows);
    drawGame(screen, game, scale);
    screen.flush(stdout);
    setTimeout(frame, Math.max(0, 16 - (performance.now() - now)));
  }

  if (!args.has("--text")) stdout.write(graphics.query());
  frame();
}
