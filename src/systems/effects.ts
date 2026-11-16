/** Visual feedback that lives in the world: particles, floating numbers and ink splats. */
import { type Rgb, hexToRgb, shade } from '../core/color';
import { TAU, gaussian, lerp, random } from '../core/math';
import { INK } from '../render/palette';
import type { Game, Particle, ParticleKind } from '../state/types';
import { addSpirit } from './rewards';

const MAX_PARTICLES = 420;
const TEXT_LIFE = 0.9;
const DECAL_LIFE = 1.3;

export function particle(kind: ParticleKind, x: number, y: number, color: Rgb): Particle {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    size: 1,
    color,
    rotation: 0,
    spin: 0,
    spiritValue: 0,
    points: [],
  };
}

export function floatText(
  game: Game,
  text: string | number,
  x: number,
  y: number,
  color: string,
  size = 18,
): void {
  const s = game.layout.scale;
  game.texts.push({ text: String(text), x, y, color, size: size * s, age: 0, vx: gaussian() * 14 * s });
}

/** A spray of petals (or rising dots) in the given colour, with a few ink flecks mixed in. */
export function burst(
  game: Game,
  x: number,
  y: number,
  color: string | Rgb,
  count: number,
  speed = 1,
  kind: 'petal' | 'dot' = 'petal',
): void {
  const s = game.layout.scale;
  const base = typeof color === 'string' ? hexToRgb(color) : color;
  for (let i = 0; i < count && game.particles.length < MAX_PARTICLES; i++) {
    const angle = random(TAU);
    const velocity = random(30, 190) * s * speed;
    const p = particle(kind, x, y, Math.random() < 0.25 ? INK : shade(base, gaussian() * 0.2));
    p.vx = Math.cos(angle) * velocity;
    p.vy = Math.sin(angle) * velocity - 50 * s * speed;
    p.life = random(0.5, 1.2);
    p.size = random(2, 5.5) * s;
    p.rotation = random(TAU);
    p.spin = gaussian() * 8;
    game.particles.push(p);
  }
}

export function ring(game: Game, x: number, y: number, radius: number, color: Rgb): void {
  const p = particle('ring', x, y, color);
  p.life = 0.4;
  p.size = radius;
  game.particles.push(p);
}

/** Spirit wisps that drift up from a kill, then fly into the bow and add spirit. */
export function wisps(
  game: Game,
  x: number,
  y: number,
  color: Rgb,
  count: number,
  totalSpirit: number,
): void {
  const s = game.layout.scale;
  for (let i = 0; i < count; i++) {
    const p = particle('wisp', x + gaussian() * 14 * s, y + gaussian() * 14 * s, color);
    p.vx = gaussian() * 130 * s;
    p.vy = -random(40, 170) * s;
    p.life = 1.5;
    p.size = random(2.5, 4.5) * s;
    p.spiritValue = totalSpirit / count;
    game.particles.push(p);
  }
}

export function addDecal(game: Game, x: number, y: number, accent: string, size = 1): void {
  game.decals.push({ x, y, accent, age: 0, scale: random(0.8, 1.15) * size, rotation: random(TAU) });
}

export function updateParticles(game: Game, dt: number): void {
  const s = game.layout.scale;
  const { archerX, archerY } = game.layout;
  for (const p of game.particles) {
    p.age += dt;
    if (p.kind === 'ring' || p.kind === 'bolt') continue;
    if (p.kind === 'wisp') {
      if (p.age > 0.35) {
        const dx = archerX - p.x;
        const dy = archerY - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx = lerp(p.vx, (dx / d) * 620 * s, 0.12);
        p.vy = lerp(p.vy, (dy / d) * 620 * s, 0.12);
        if (d < 16 * s) {
          p.age = p.life;
          if (game.phase === 'play') addSpirit(game, p.spiritValue);
        }
      } else {
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
    } else {
      p.vy += (p.kind === 'dot' ? -40 : 240) * s * dt;
      p.vx *= 0.985;
      p.rotation += p.spin * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  game.particles = game.particles.filter((p) => p.age < p.life);
}

export function updateTextsAndDecals(game: Game, dt: number): void {
  const s = game.layout.scale;
  for (const t of game.texts) {
    t.age += dt;
    t.y -= 38 * s * dt;
    t.x += t.vx * dt;
  }
  game.texts = game.texts.filter((t) => t.age < TEXT_LIFE);
  for (const d of game.decals) d.age += dt;
  game.decals = game.decals.filter((d) => d.age < DECAL_LIFE);
}

export { TEXT_LIFE, DECAL_LIFE };
