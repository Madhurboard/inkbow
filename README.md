# Inkbow: The Last Guardian

A watercolor archer defense game for phone and PC. Every picture is painted in code on a canvas and every sound is synthesised, so the whole game ships as a few small files.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Add `?debug` to the URL to expose `window.__dbg` for testing.

## Controls

| Action | Touch | PC |
| --- | --- | --- |
| Aim and shoot | Drag, pull back, release | Click and drag, release |
| Power Shot | Hold a full draw briefly | Same |
| Shield (tap late to deflect) | Shield button | Space or right-click |
| Spirit arrows (Ember, Storm, Gale) | Buttons, bottom left | 1 / 2 / 3 |
| Starfall | Star button | E |
| Pause and settings | Pause button | Esc |

## Project layout

| Path | What it holds |
| --- | --- |
| `index.html` | Markup for the canvas, HUD and menus |
| `src/main.js` | Entry: fonts, styles, loader, error bar, service worker |
| `src/game.js` | State, scene painting, simulation, rendering, input |
| `src/paint.js` | Watercolour primitives (washes, strokes, blooms) |
| `src/data.js` | Palettes, enemies, arrows, bow tiers, skill tree, bosses |
| `src/audio.js` | Sound effects and generative music (Web Audio) |
| `src/utils.js` | Maths and colour helpers |
| `public/` | Web app manifest, icons, share image, service worker |

## Features

- Five realms with a boss each, plus Endless mode
- Enemy archers with eight arrow types, walkers and sky riders
- In-run perks, a permanent skill tree, a bow that evolves with lifetime kills
- Installable (PWA) and playable offline after the first visit
- Progress saved in the browser's local storage

## Deploy

Hosted on Vercel; every push to `main` redeploys.
