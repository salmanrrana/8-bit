export const Keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,
  jumpReleased: false,
  fire: false,
  firePressed: false,
  enterPressed: false,
  escPressed: false,
  restartPressed: false,
  menuPressed: false,
  quitPressed: false,
  selectUp: false,
  selectDown: false,
  digit: 0
};

type Button = "left" | "right" | "up" | "down" | "jump" | "fire";

const held = new Set<Button>();
const lastSeen = new Map<Button, number>();
const repeating = new Set<Button>();
let nowMs = 0;
let hasKeyUp = false;
/** First press must cover OS key-repeat delay; later repeats can be short. */
const INITIAL_HOLD_MS = 420;
const REPEAT_HOLD_MS = 80;

export function consumeEdges(): void {
  Keys.jumpPressed = false;
  Keys.jumpReleased = false;
  Keys.firePressed = false;
  Keys.enterPressed = false;
  Keys.escPressed = false;
  Keys.restartPressed = false;
  Keys.menuPressed = false;
  Keys.quitPressed = false;
  Keys.selectUp = false;
  Keys.selectDown = false;
  Keys.digit = 0;
}

export function resetHeld(): void {
  held.clear();
  lastSeen.clear();
  repeating.clear();
  sync();
}

export function setTime(ms: number): void {
  nowMs = ms;
  if (!hasKeyUp) {
    for (const btn of [...held]) {
      const hold = repeating.has(btn) ? REPEAT_HOLD_MS : INITIAL_HOLD_MS;
      if (ms - (lastSeen.get(btn) ?? 0) > hold) {
        if (btn === "jump") Keys.jumpReleased = true;
        held.delete(btn);
        repeating.delete(btn);
      }
    }
  }
  sync();
}

function sync(): void {
  Keys.left = held.has("left");
  Keys.right = held.has("right");
  Keys.up = held.has("up");
  Keys.down = held.has("down");
  Keys.jump = held.has("jump");
  Keys.fire = held.has("fire");
}

function down(btn: Button): void {
  if (!held.has(btn)) {
    if (btn === "jump") Keys.jumpPressed = true;
    if (btn === "fire") Keys.firePressed = true;
  } else {
    repeating.add(btn);
  }
  held.add(btn);
  lastSeen.set(btn, nowMs);
  sync();
}

function up(btn: Button): void {
  if (btn === "jump" && held.has("jump")) Keys.jumpReleased = true;
  held.delete(btn);
  lastSeen.delete(btn);
  repeating.delete(btn);
  sync();
}

function pulseSelect(dir: "up" | "down"): void {
  if (dir === "up") Keys.selectUp = true;
  else Keys.selectDown = true;
}

function mapChar(ch: string, releasing: boolean): void {
  const c = ch.length === 1 ? ch.toLowerCase() : ch;
  if (c === "a") return releasing ? up("left") : down("left");
  if (c === "d") return releasing ? up("right") : down("right");
  if (c === "w") {
    if (!releasing) pulseSelect("up");
    return releasing ? up("up") : down("up");
  }
  if (c === "s") {
    if (!releasing) pulseSelect("down");
    return releasing ? up("down") : down("down");
  }
  if (c === " " || c === "z" || c === "k") return releasing ? up("jump") : down("jump");
  if (c === "x" || c === "f" || c === "j") return releasing ? up("fire") : down("fire");
  if (releasing) return;
  if (c === "\r" || c === "\n") Keys.enterPressed = true;
  else if (c === "p") Keys.escPressed = true;
  else if (c === "r") Keys.restartPressed = true;
  else if (c === "m") Keys.menuPressed = true;
  else if (c === "q") Keys.quitPressed = true;
  else if (c === "1" || c === "2" || c === "3" || c === "4") Keys.digit = Number(c);
}

function mapArrow(code: string, releasing: boolean): void {
  if (code === "D") {
    if (releasing) up("left");
    else down("left");
    return;
  }
  if (code === "C") {
    if (releasing) up("right");
    else down("right");
    return;
  }
  if (code === "A") {
    if (releasing) up("up");
    else {
      down("up");
      pulseSelect("up");
    }
    return;
  }
  if (code === "B") {
    if (releasing) up("down");
    else {
      down("down");
      pulseSelect("down");
    }
  }
}

function applyKitty(code: number, eventType: number): void {
  const releasing = eventType === 3;
  if (eventType === 2 && releasing) return;
  if (code === 27) {
    if (!releasing) Keys.escPressed = true;
    return;
  }
  if (code === 13) {
    if (!releasing) Keys.enterPressed = true;
    return;
  }
  if (code === 32) return releasing ? up("jump") : down("jump");
  if (code === 57350) return mapArrow("D", releasing); // left
  if (code === 57351) return mapArrow("C", releasing); // right
  if (code === 57352) return mapArrow("A", releasing); // up
  if (code === 57353) return mapArrow("B", releasing); // down
  if (code >= 1 && code <= 127) mapChar(String.fromCharCode(code), releasing);
}

export function feedKeys(chunk: string, pending: string): string {
  const data = pending + chunk;
  let i = 0;
  while (i < data.length) {
    const c = data[i];
    if (c === "\x03" || c === "\x04") {
      Keys.quitPressed = true;
      i += 1;
      continue;
    }
    if (c === "\x1b") {
      if (i + 1 >= data.length) return data.slice(i);
      if (data[i + 1] !== "[") {
        Keys.escPressed = true;
        i += 1;
        continue;
      }
      const end = findCsiEnd(data, i + 2);
      if (end < 0) return data.slice(i);
      const body = data.slice(i + 2, end);
      const final = data[end];
      parseCsi(body, final);
      i = end + 1;
      continue;
    }
    mapChar(c, false);
    i += 1;
  }
  return "";
}

function findCsiEnd(data: string, from: number): number {
  for (let i = from; i < data.length; i += 1) {
    const code = data.charCodeAt(i);
    if (code >= 0x40 && code <= 0x7e) return i;
  }
  return -1;
}

function parseCsi(body: string, final: string): void {
  if (final === "A" || final === "B" || final === "C" || final === "D") {
    const eventType = csiEventType(body);
    mapArrow(final, eventType === 3);
    return;
  }
  if (final === "u") {
    hasKeyUp = true;
    const { code, eventType } = parseKittyU(body);
    if (code > 0) applyKitty(code, eventType);
    return;
  }
  if (final === "~" && body.startsWith("?")) {
    // keyboard protocol query reply — already have key-up if we pushed flags
    hasKeyUp = true;
  }
}

function csiEventType(body: string): number {
  const colon = body.lastIndexOf(":");
  if (colon < 0) return 1;
  const n = Number(body.slice(colon + 1));
  return Number.isFinite(n) ? n : 1;
}

function parseKittyU(body: string): { code: number; eventType: number } {
  // keycode[:shifted[:base]][;mods[:event]][;text]
  const semi = body.split(";");
  const code = Number((semi[0] ?? "0").split(":")[0]);
  let eventType = 1;
  if (semi[1]) {
    const mods = semi[1].split(":");
    if (mods[1]) eventType = Number(mods[1]) || 1;
  }
  return { code: Number.isFinite(code) ? code : 0, eventType };
}

export function enableKeyUp(stdout: NodeJS.WriteStream): void {
  stdout.write("\x1b[>3u");
}

export function disableKeyUp(stdout: NodeJS.WriteStream): void {
  stdout.write("\x1b[<u");
}
