/** Maths helpers shared by every module. */

export const TAU = Math.PI * 2;

/** A random number in [0, max), or in [min, max) when given two arguments. */
export function random(minOrMax = 1, max?: number): number {
  return max === undefined ? Math.random() * minOrMax : minOrMax + Math.random() * (max - minOrMax);
}

/** Roughly normal noise centred on 0, mostly within ±1. */
export function gaussian(): number {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** A random element of a non-empty list. */
export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() needs a non-empty list');
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
