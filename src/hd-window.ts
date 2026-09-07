import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { HdRenderer, pngBytes } from "./hd-render.ts";
import type { Game } from "./game.ts";
import { consumeEdges, feedKeys, resetHeld, setTime } from "./input.ts";

/** Local-only viewer for terminals/multiplexers that cannot carry image frames. */
export async function startHdWindow(game: Game, open = true) {
  resetHeld();
  consumeEdges();
  game.pause();
  const token = randomBytes(18).toString("hex"),
    base = `/${token}`;
  const renderer = new HdRenderer();
  game.setViewWidth(renderer.scale.viewW);
  let origin = "",
    pending = "",
    closed = false;
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.headers.host !== new URL(origin).host) {
      res.writeHead(403).end();
      return;
    }
    if (req.method === "GET" && req.url === base) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(page(base));
      return;
    }
    if (req.method === "GET" && req.url === `${base}/frame.png`) {
      if (game.handleUi() === "quit") {
        res.writeHead(410).end();
        close();
        return;
      }
      game.tick(performance.now());
      consumeEdges();
      res.setHeader("Content-Type", "image/png");
      res.end(pngBytes(renderer.draw(game)));
      return;
    }
    if (
      req.method === "POST" &&
      req.url === `${base}/input` &&
      req.headers.origin === origin &&
      req.headers["content-type"] === "application/json"
    ) {
      try {
        let body = "";
        for await (const part of req) {
          body += String(part);
          if (body.length > 512) {
            res.writeHead(413).end();
            return;
          }
        }
        const value: unknown = JSON.parse(body);
        if (!value || typeof value !== "object")
          throw new Error("Invalid input");
        if (
          "action" in value &&
          ["levels", "arcade", "pause"].includes(String(value.action))
        ) {
          resetHeld();
          consumeEdges();
          if (value.action === "pause") {
            if (game.phase === "paused") game.resume();
            else game.pause();
          } else {
            game.toTitle();
            if (value.action === "arcade") game.levelIndex = 5;
          }
        } else if ("blur" in value && value.blur === true) {
          resetHeld();
          consumeEdges();
          game.pause();
        } else if (
          "code" in value &&
          "event" in value &&
          typeof value.code === "number" &&
          Number.isInteger(value.code) &&
          ((value.code >= 32 && value.code <= 126) ||
            [13, 27, 57350, 57351, 57352, 57353].includes(value.code)) &&
          typeof value.event === "number" &&
          [1, 2, 3].includes(value.event)
        ) {
          setTime(performance.now());
          pending = feedKeys(`\x1b[${value.code};1:${value.event}u`, pending);
        } else throw new Error("Invalid input");
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
      return;
    }
    res.writeHead(404).end();
  });
  function close(): void {
    if (closed) return;
    closed = true;
    resetHeld();
    server.close();
    server.closeIdleConnections?.();
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Could not open the local game window");
  origin = `http://127.0.0.1:${address.port}`;
  const url = origin + base;
  if (open) {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "cmd"
          : "xdg-open";
    const args =
      process.platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => {
      process.stderr.write(`Open the game in your browser: ${url}\n`);
    });
    child.unref();
  }
  return { url, close };
}

function page(base: string): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>8-Bit Satoshi — HD Arcade</title>
<style>html{background:#0c1019;color:#fff0c2;font-family:system-ui,sans-serif;color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-content:center;gap:12px}main{width:min(96vw,calc((100vh - 84px)*1.6));margin:auto}canvas{display:block;width:100%;height:auto;outline:none;background:#101018}canvas:focus-visible{outline:2px solid #ffb34c}nav{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:0 10px}button{font:inherit;color:#fff0c2;background:#1b2635;border:1px solid #42516a;padding:8px 16px;cursor:pointer;border-radius:4px}button:hover{background:#30425a}button:focus-visible{outline:2px solid #ffb34c}p{margin:0;text-align:center;font-size:13px;color:#c8bfad}::selection{background:#ffb34c;color:#141922}</style>
<main><canvas width="960" height="600" tabindex="0" aria-label="8-Bit Satoshi HD game. Use arrow keys to select a level, Enter to start."></canvas></main><nav><button id="arcade">Level 6</button><button id="pause">Pause / resume</button><button id="levels">Levels</button><button id="full">Fullscreen</button></nav><p id="status">Local HD arcade · WASD move · X punch · E grab/throw · C special · Space jump</p>
<script>
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),status=document.querySelector('#status');
let queue=Promise.resolve(),stopped=false;
function send(value){queue=queue.then(()=>fetch('${base}/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})).catch(()=>{});}
const codes={ArrowLeft:57350,ArrowRight:57351,ArrowUp:57352,ArrowDown:57353,Enter:13,Escape:27};
function key(event,release){if(!release&&(event.ctrlKey||event.metaKey||event.altKey))return;const code=codes[event.key]??(event.key.length===1?event.key.toLowerCase().charCodeAt(0):0);if(!code)return;const buttonActivation=event.target.tagName==='BUTTON'&&(event.key===' '||event.key==='Enter');if(!release&&buttonActivation)return;if(!buttonActivation)event.preventDefault();send({code,event:release?3:event.repeat?2:1});}
window.addEventListener('keydown',e=>key(e,false));window.addEventListener('keyup',e=>key(e,true));
window.addEventListener('blur',()=>send({blur:true}));document.addEventListener('visibilitychange',()=>{if(document.hidden)send({blur:true});});
for(const action of ['pause','levels','arcade'])document.querySelector('#'+action).onclick=()=>{send({action});canvas.focus();};
document.querySelector('#full').onclick=()=>{document.documentElement.requestFullscreen?.();canvas.focus();};
async function frame(){const began=performance.now();try{const response=await fetch('${base}/frame.png');if(response.status===410)throw new Error('closed');if(!response.ok)throw new Error('unavailable');const bitmap=await createImageBitmap(await response.blob());ctx.drawImage(bitmap,0,0);bitmap.close();}catch{stopped=true;status.textContent='Game closed. Return to your terminal to start it again.';}if(!stopped)setTimeout(frame,Math.max(0,33-(performance.now()-began)));}
canvas.focus();frame();
</script></html>`;
}
