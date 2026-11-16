/** Ambient weather and birds for the current realm. Purely decorative. */
import { TAU, random } from '../core/math';
import { realmAt } from '../data/realms';
import type { Game } from '../state/types';

export function initWeather(game: Game): void {
  const { layout } = game;
  const kind = realmAt(game.run.realm).weather;
  const count = kind === 'rain' ? 90 : 46;
  game.weather.kind = kind;
  game.weather.drops = Array.from({ length: count }, () => ({
    x: random(layout.width),
    y: random(layout.height),
    size: random(0.6, 1.5),
    phase: random(TAU),
  }));
  game.weather.birds =
    kind === 'rain' || kind === 'wisp'
      ? []
      : Array.from({ length: 4 }, () => ({
          x: random(layout.width),
          y: random(layout.groundY * 0.15, layout.groundY * 0.5),
          speed: random(14, 30) * layout.scale,
          phase: random(TAU),
          size: random(0.7, 1.2),
        }));
  game.weather.lightningTimer = random(4, 9);
  game.weather.lightningFlash = 0;
}

export function updateWeather(game: Game, dt: number): void {
  const { layout, weather, time } = game;
  const s = layout.scale;
  const { width: w, height: h } = layout;
  for (const d of weather.drops) {
    switch (weather.kind) {
      case 'ember':
        d.y -= 22 * d.size * s * dt;
        d.x += Math.sin(time + d.phase) * 10 * dt;
        break;
      case 'snow':
        d.y += 34 * d.size * s * dt;
        d.x += Math.sin(time * 0.8 + d.phase) * 14 * dt - 6 * dt;
        break;
      case 'leaf':
        d.y += 30 * d.size * s * dt;
        d.x -= (26 + Math.sin(time * 1.5 + d.phase) * 22) * s * dt;
        break;
      case 'rain':
        d.y += 620 * d.size * s * dt;
        d.x -= 150 * s * dt;
        break;
      case 'wisp':
        d.y -= 12 * d.size * s * dt;
        d.x += Math.sin(time * 0.6 + d.phase) * 8 * dt;
        break;
    }
    if (d.y < -10) {
      d.y = h + 5;
      d.x = random(w);
    }
    if (d.y > h + 10) {
      d.y = -5;
      d.x = random(w + 60);
    }
    if (d.x < -20) d.x = w + 10;
  }
  for (const b of weather.birds) {
    b.x -= b.speed * dt;
    if (b.x < -30) {
      b.x = w + 30;
      b.y = random(layout.groundY * 0.15, layout.groundY * 0.5);
    }
  }
  if (weather.kind === 'rain') {
    weather.lightningTimer -= dt;
    if (weather.lightningTimer <= 0) {
      weather.lightningTimer = random(5, 11);
      weather.lightningFlash = 0.3;
    }
  }
  if (weather.lightningFlash > 0) weather.lightningFlash -= dt;
}
