# 8-bit

A retro platformer that runs in your terminal, with truecolor pixel
graphics. Five levels, three lives, checkpoints.

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

| Key            | Action                                                  |
| -------------- | ------------------------------------------------------- |
| A / D or ← / → | Run                                                     |
| W / S or ↑ / ↓ | Walk (top-down level); pick a level on the title screen |
| Space / Z / K  | Jump                                                    |
| X / F / J      | Fire (when armed)                                       |
| Enter          | Start / confirm                                         |
| Esc / P        | Pause                                                   |
| R              | Restart                                                 |
| M              | Level select                                            |
| 1–5            | Jump to that level                                      |
| Q              | Quit (title) or pause (in-run)                          |
