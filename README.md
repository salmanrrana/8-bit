# 8-bit

Six levels of Bitcoin arcade action, with a detailed city brawler and classic
terminal platforming. Three lives, checkpoints, four brawler fighters.

## Play

```bash
npx eightbit
```

Needs Node.js 18+. Level 6 renders its city and fighters at **960 × 540**, with
a separate HUD, using full-color images in terminals that support the
[Kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/).
The game checks actual support, including inside multiplexers such as Herdr.
If images cannot get through, it opens a local HD game window automatically.
Levels 1–5 keep their classic terminal appearance.

```bash
npx eightbit --window # open the local HD viewer directly, with Level 6 selected
npx eightbit --text   # keep all play inside the terminal using text pixels
```

The window runs entirely on your computer; keep its terminal open and press
Ctrl+C there to stop it. Use `--no-open` to print its local URL without launching
a browser. A real TTY is required unless using `--window`.

Building from source and running the TypeScript tests requires Node.js 22.18+
(or newer) because the development suite executes `.ts` files directly.

```bash
npm install
npm run check:fast # lint, strict types, and game tests
npm run build
npm start -- --window # play this checkout locally; no publishing needed
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
and combat. Full-resolution rendering preserves the city detail independently
of your terminal font size. The window supports fullscreen and pauses when it
loses focus. With `--text`, use at least **80 columns × 24 rows**; **160 × 48**
or larger shows more detail. Set `EIGHTBIT_REDUCED_MOTION=1` to disable screen
shake.

## Publishing

After signing in with `npm login --registry=https://registry.npmjs.org/`, run
`npm publish --access public`. The publish hook runs tests and builds the
package first. Each published release needs a new version in `package.json`.
