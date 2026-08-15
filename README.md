# 8-Bit Satoshi (terminal)

Same Bitcoin platformer as the browser game, running in your terminal. No
timers, no leaderboard — just the run.

## Play

From this directory:

```bash
npx 8bit
```

or:

```bash
npx .
```

Needs Node.js 22.6+ and a real TTY. Truecolor terminals look best (Kitty,
Ghostty, iTerm, WezTerm, Windows Terminal).

## Controls

| Key | Action |
|-----|--------|
| A / D or ← / → | Run |
| W / S or ↑ / ↓ | Overworld walk; ↑/↓ also pick a level |
| Space / Z / K | Jump |
| X / F / J | Sat cannon (ICO Tower) |
| Enter | Start / confirm |
| Esc / P | Pause |
| R | Restart |
| M | Level select |
| 1–4 | Jump to that level |
| Q | Quit (title) or pause (in-run) |

Hold a direction to run. Kitty-protocol terminals send key-up, so movement
feels closest to the browser game.

## Levels

1. **THE WHITEPAPER RUN** — stomps, pits, BTC, whitepaper pages
2. **RUNNING BITCOIN** — confirmation blocks over the mining-race gap
3. **THE INTERNET OF MONEY** — crowd-surge pads
4. **SHITCOIN CITY** — top-down city, four venues, sat cannon in ICO Tower

Reach the goal (or the vault, after every venue is cleared) to finish.
Checkpoints save your spot. Three lives.

## Graphics

The renderer paints a true pixel framebuffer using half-block glyphs —
every terminal cell is two vertically stacked truecolor pixels. That
doubles the vertical resolution, so you get real pixel-art sprites
(a hooded Satoshi with run/jump frames, per-type enemy skins, spinning
gold coins), parallax skylines with lit windows, star fields, animated
crowds, and waving checkpoint flags. On a modern GPU terminal (Ghostty,
Kitty, WezTerm, iTerm) it looks like a proper 8-bit console, not ASCII.

## Why it stays fast

Physics stay in the original pixel space at 60 Hz. The framebuffer is a
flat Uint32Array (~0.3 ms a frame), and the terminal layer diffs against
the last flush and writes changed cells only.
