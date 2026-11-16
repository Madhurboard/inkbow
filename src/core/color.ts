/** Colour helpers. Colours are stored as RGB triples so they can be mixed and shaded. */
import { lerp } from './math';

export type Rgb = readonly [number, number, number];

export const WHITE: Rgb = [255, 255, 255];
export const BLACK: Rgb = [0, 0, 0];

/** Parse '#rrggbb'. */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

export function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha})`;
}

export function mixColor(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Darken (negative amount) or lighten (positive amount) by mixing towards black or white. */
export function shade(color: Rgb, amount: number): Rgb {
  return amount < 0 ? mixColor(color, BLACK, -amount) : mixColor(color, WHITE, amount);
}
