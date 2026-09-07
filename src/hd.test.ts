import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { get } from "node:http";
import { runInNewContext } from "node:vm";
import { Game } from "./game.ts";
import { HdRenderer, pngBytes, rgbBytes } from "./hd-render.ts";
import { startHdWindow } from "./hd-window.ts";
import { TerminalGraphics } from "./terminal-graphics.ts";
import { consumeEdges, feedKeys, Keys, resetHeld } from "./input.ts";

const ESC = "\x1b";

test("fragmented terminal probes cannot become game keys; frames round-trip at full resolution", () => {
  resetHeld();
  consumeEdges();
  const graphics = new TerminalGraphics();
  const replies = `${ESC}_Gi=${graphics.queryId};OK${ESC}\\${ESC}[6;20;10t${ESC}[?62;c`;
  let pending = "";
  for (const byte of replies)
    pending = feedKeys(byte, pending, (response) => graphics.accept(response));
  assert.equal(pending, "");
  assert.equal(graphics.supported, true);
  assert.equal(graphics.answered, true);
  assert.equal(Keys.jump, false, "OK must not press K (jump)");
  assert.equal(Keys.digit, 0);
  assert.equal(Keys.special, false);
  feedKeys("d", "");
  assert.equal(Keys.right, true);
  resetHeld();
  consumeEdges();

  const game = new Game();
  game.levelIndex = 5;
  game.start();
  game.setViewWidth(169); // A narrow terminal must retain its classic-level camera width.
  const frame = new HdRenderer().draw(game);
  assert.equal(
    game.viewW,
    169,
    "native HD drawing must not alter the camera for later classic levels",
  );
  assert.equal(frame.w, 960);
  assert.equal(frame.h, 600);
  assert.ok(
    new Set(frame.px.subarray(37 * 960, 577 * 960)).size > 10000,
    "city art retains its full palette and detail",
  );
  const encoded = graphics.encode(frame, 160, 48);
  const chunks = encoded
    .split(`${ESC}_G`)
    .slice(1)
    .map((part) => part.split(`${ESC}\\`)[0]);
  assert.match(chunks[0], /s=960,v=600/);
  assert.match(chunks[0], /c=154,r=48/);
  const payloads = chunks.map((part) => part.slice(part.indexOf(";") + 1));
  assert.ok(payloads.every((part) => part.length <= 4096));
  assert.deepEqual(
    inflateSync(Buffer.from(payloads.join(""), "base64")),
    rgbBytes(frame),
  );
  const second = graphics.encode(frame, 80, 24);
  assert.ok(second.includes(`a=d,d=I,i=${graphics.queryId + 1},q=2`));
  assert.ok(!second.includes("d=A"), "never clear another app's images");

  const png = pngBytes(frame);
  assert.equal(png.readUInt32BE(16), 960);
  assert.equal(png.readUInt32BE(20), 600);
  let offset = 8;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT")
      idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scan = inflateSync(Buffer.concat(idat));
  const rgb = rgbBytes(frame);
  for (let y = 0; y < frame.h; y++)
    assert.deepEqual(
      scan.subarray(y * (960 * 3 + 1) + 1, (y + 1) * (960 * 3 + 1)),
      rgb.subarray(y * 960 * 3, (y + 1) * 960 * 3),
    );
});

test("local HD window starts combat, accepts controls, pauses on blur, and rejects foreign input", async () => {
  const game = new Game();
  game.levelIndex = 5;
  const viewer = await startHdWindow(game, false),
    origin = new URL(viewer.url).origin;
  const input = (value: unknown, from = origin) =>
    fetch(`${viewer.url}/input`, {
      method: "POST",
      headers: { Origin: from, "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  const frame = async () => {
    const response = await fetch(`${viewer.url}/frame.png`);
    await response.arrayBuffer();
    return response.status;
  };
  try {
    const page = await fetch(viewer.url);
    assert.equal(page.status, 200);
    await checkBrowserKeyReleases(await page.text());
    assert.equal((await fetch(origin)).status, 404);
    const foreignHost = await new Promise<number | undefined>(
      (resolve, reject) => {
        get(viewer.url, { headers: { Host: "example.com" } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        }).on("error", reject);
      },
    );
    assert.equal(foreignHost, 403);
    assert.equal(
      (await input({ code: 13, event: 1 }, "https://example.com")).status,
      404,
    );
    assert.equal((await input({ code: 13, event: "1" })).status, 400);
    assert.equal((await input({ code: 13, event: 1 })).status, 204);
    assert.equal(await frame(), 200);
    assert.equal(game.phase, "playing");
    assert.ok(game.brawler);
    await input({ code: 100, event: 1 });
    assert.equal(Keys.right, true);
    const before = game.brawler.state.player.x;
    await frame();
    await frame();
    assert.ok(game.brawler.state.player.x > before);
    await input({ code: 100, event: 3 });
    assert.equal(Keys.right, false);
    await input({ code: 120, event: 1 });
    await input({ code: 120, event: 3 });
    await frame();
    assert.ok(
      game.brawler.state.player.attack > 0,
      "quick punch survives key release before the next frame",
    );
    await input({ blur: true });
    assert.equal(game.phase, "paused");
    assert.equal(Keys.fire, false);
    await input({ action: "pause" });
    assert.equal(game.phase, "playing");
    await input({ action: "levels" });
    assert.equal(game.phase, "title");
    await input({ code: 113, event: 1 });
    assert.equal(await frame(), 410);
  } finally {
    viewer.close();
    consumeEdges();
  }
});

// Exercise the shipped page's event handlers without requiring a browser in npm test.
async function checkBrowserKeyReleases(html: string): Promise<void> {
  type KeyEvent = {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    target: { tagName: string };
    preventDefault: () => void;
  };
  const listeners = new Map<string, (event: KeyEvent) => void>();
  const delivered: unknown[] = [];
  const canvas = {
    focus() {},
    getContext() {
      return {};
    },
  };
  runInNewContext(html.split("<script>")[1].split("</script>")[0], {
    document: {
      querySelector: (selector: string) =>
        selector === "canvas" ? canvas : {},
      addEventListener() {},
    },
    window: {
      addEventListener: (name: string, listener: (event: KeyEvent) => void) =>
        listeners.set(name, listener),
    },
    performance: { now: () => 0 },
    fetch: (_url: string, options?: { body: string }) => {
      if (options) {
        delivered.push(JSON.parse(options.body));
        return Promise.resolve({ ok: true });
      }
      return new Promise(() => {}); // No animation frames needed for input verification.
    },
  });
  const event = {
    key: "d",
    target: { tagName: "CANVAS" },
    preventDefault() {},
  };
  listeners.get("keydown")?.(event);
  listeners.get("keyup")?.({ ...event, ctrlKey: true });
  listeners.get("keydown")?.({ ...event, key: " ", altKey: true }); // Browser shortcut: ignore the press.
  listeners.get("keydown")?.({ ...event, key: " " });
  let canceledButtonActivation = false;
  listeners.get("keyup")?.({
    ...event,
    key: " ",
    metaKey: true,
    target: { tagName: "BUTTON" },
    preventDefault() {
      canceledButtonActivation = true;
    },
  });
  assert.equal(
    canceledButtonActivation,
    false,
    "Space still activates a focused button",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(delivered, [
    { code: 100, event: 1 },
    { code: 100, event: 3 },
    { code: 32, event: 1 },
    { code: 32, event: 3 },
  ]);
}
