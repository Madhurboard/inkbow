/** Screen layout: where the ground, the archer and the enemy perches sit for a given window size. */
import { clamp } from '../core/math';
import type { Layout, Perch } from './types';

/** Perch positions as fractions of the screen: [x, portrait y, landscape y, measured from]. */
const PERCH_SPOTS: readonly { x: number; portrait: number; landscape: number; fromGround: boolean }[] = [
  { x: 0.83, portrait: 0.15, landscape: 0.2, fromGround: true }, // low cliff ledge
  { x: 0.93, portrait: 0.33, landscape: 0.42, fromGround: true }, // high cliff ledge (boss perch)
  { x: 0.6, portrait: 0.1, landscape: 0.14, fromGround: true }, // ruined tower
  { x: 0.7, portrait: 0.37, landscape: 0.34, fromGround: false }, // floating island
  { x: 0.43, portrait: 0.27, landscape: 0.26, fromGround: false }, // far floating island
  { x: 0.87, portrait: 0.21, landscape: 0.2, fromGround: false }, // high floating island
];

export const BOSS_PERCH = 1;

/** Reference phone width that `scale` 1 is designed for. */
const DESIGN_WIDTH = 390;

export function computeLayout(width: number, height: number, devicePixelRatio: number): Layout {
  const portrait = height > width;
  const scale = clamp(Math.min(width, height) / DESIGN_WIDTH, 0.75, 1.7);
  const groundY = height * (portrait ? 0.77 : 0.8);
  const platformHeight = 46 * scale;
  const archerX = Math.max(width * 0.14, 50 * scale);
  const perches: Perch[] = PERCH_SPOTS.map((spot) => {
    const fraction = portrait ? spot.portrait : spot.landscape;
    return {
      x: width * spot.x,
      y: spot.fromGround ? groundY - height * fraction : height * fraction,
      occupant: null,
    };
  });
  return {
    width,
    height,
    dpr: Math.min(devicePixelRatio || 1, 2),
    scale,
    portrait,
    groundY,
    platformHeight,
    archerX,
    archerY: groundY - platformHeight - 40 * scale,
    perches,
  };
}
