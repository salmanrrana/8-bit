# 8-bit

A retro platformer that runs in your terminal, with truecolor pixel
graphics. Six levels, three lives, checkpoints.

## Play

```bash
npx eightbit
```

Needs Node.js 18+ and a real TTY. Looks best in a truecolor terminal
(Ghostty, Kitty, iTerm, WezTerm, Windows Terminal).

Building from source and running the TypeScript tests requires Node.js 22.18+
(or newer) because the development suite executes `.ts` files directly.

```bash
npm install
npm run check:fast # lint, strict types, and game tests
npm run build
```

`npm install` configures an executable pre-commit hook. It checks an isolated
snapshot of staged code/configuration with Oxlint and Prettier, then runs the
project typecheck and tests for changes that can affect them. Source deletions
trigger project checks, and unstaged edits are left alone.

## Controls

| Key            | Action                                                |
| -------------- | ----------------------------------------------------- |
| A / D or ← / → | Run                                                   |
| W / S or ↑ / ↓ | Walk (city/brawler); pick a level on the title screen |
| Space / Z / K  | Jump                                                  |
| X / F / J      | Punch (brawler); fire (when armed)                    |
| Enter          | Start / confirm                                       |
| Esc / P        | Pause                                                 |
| R              | Restart                                               |
| M              | Level select                                          |
| 1–6            | Jump to that level                                    |
| Q              | Quit (title) or pause (in-run)                        |

## Level 6: For the People

Choose **6** on the title screen, use **[ / ]** to choose Jack Mallers, Satoshi,
CryptoWizzardd, or Random Coder, then press **Enter**. Fight through eight
districts and sixteen waves to break the Bullshit Machine.

- **WASD / arrows** move along the street and between fighting lanes.
- **X / F / J** punch; hold to chain combos. **Space / Z / K** jump and kick.
- **E** picks up a nearby object; press again to throw it. With empty hands,
  throw your fighter's signature projectile.
- **C** uses your special when the meter reaches 100%. Hits recharge it.
- Clear each wave and move right. Pizza restores health, and district clears
  save progress. Losing all health costs one life; losing three ends the run.

This adapts the original `8bit-satoshi` level's city artwork, fighters, objects,
and combat to truecolor terminal pixels. Use at least **80 columns × 24 rows**;
**160 × 48 or larger** shows more detail. Signs and instructions use readable
terminal text. Set `EIGHTBIT_REDUCED_MOTION=1` to disable screen shake.
