/** Fixed colours shared by the renderer and the effects system. */
import type { Rgb } from '../core/color';

/** The dark indigo ink used for enemies and outlines. */
export const INK: Rgb = [26, 20, 46];

export const HERO_COLORS = {
  tunic: [243, 231, 204],
  hood: [43, 42, 94],
  boot: [59, 42, 51],
  skin: [234, 181, 140],
  cloak: [214, 58, 49],
  gold: [242, 194, 76],
  wood: [122, 75, 44],
} as const satisfies Record<string, Rgb>;

export const GOLD_GLOW: Rgb = [255, 215, 120];
