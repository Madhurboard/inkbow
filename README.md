# Inkbow: The Last Guardian

A watercolor archer defense game for phone and PC. Every picture is painted in code on a canvas and every
sound is synthesised, so the game ships as a few small files and plays offline once loaded.

Live: https://inkbow.vercel.app

## Develop

```bash
npm install
npm run dev          # local dev server with hot reload
npm run check        # types, lint, formatting and unit tests
npm run test:e2e     # browser tests (builds first); needs `npx playwright install chromium`
npm run build        # production build in dist/
```

Add `?debug` to the URL to expose `window.__inkbow` (game state, spawn helpers) for testing.

## How the code is organised

The game logic is plain TypeScript with no browser access, so it runs and is tested in Node. The renderer
only reads game state, and the game talks to the screen through a small `UiPort` interface.

| Path            | What it holds                                                        |
| --------------- | -------------------------------------------------------------------- |
| `src/config.ts` | Every balance number: damage, health, timings, rewards               |
| `src/data/`     | Content tables: realms, enemies, arrows, bosses, skills, perks       |
| `src/state/`    | Types, run setup, screen layout, versioned save data                 |
| `src/systems/`  | Simulation: waves, enemies, projectiles, combat, rewards, rules      |
| `src/render/`   | Watercolour painting, sprites, background scenes, the frame renderer |
| `src/ui/`       | HUD, menus, skill tree, settings, perk cards                         |
| `src/audio/`    | Synthesised sound effects and generative music                       |
| `src/app.ts`    | Wires it together: input, frame loop, UI hooks                       |
| `tests/`        | Unit and headless simulation tests (Vitest)                          |
| `e2e/`          | Browser tests on desktop and phone viewports (Playwright)            |

## Saves

Progress lives in the browser's local storage under `inkbow.save`. Every load goes through `migrateSave`
(`src/state/save.ts`), which upgrades older formats and repairs bad values, so updates never wipe progress.
When the save format changes, bump `SAVE_VERSION` and extend `migrateSave` with a test.

## Controls

| Action                             | Touch                    | PC                      |
| ---------------------------------- | ------------------------ | ----------------------- |
| Aim and shoot                      | Drag, pull back, release | Click and drag, release |
| Power Shot                         | Hold a full draw briefly | Same                    |
| Shield (tap late to deflect)       | Shield button            | Space, Q or right-click |
| Spirit arrows (Ember, Storm, Gale) | Buttons, bottom left     | 1 / 2 / 3               |
| Starfall                           | Star button              | E                       |
| Pause and settings                 | Pause button             | Esc                     |

## Releases

CI (`.github/workflows/ci.yml`) runs type checks, lint, formatting, unit tests and browser tests on every
pull request and push to `main`. Vercel builds a preview for every branch and deploys `main` to production.
