/**
 * Watercolour primitives. A "wash" is many translucent, slightly wobbled copies of a shape,
 * which builds soft edges and pooled pigment. A "brush stroke" is a bundle of thin bristle lines.
 */
import { type Rgb, rgba, shade } from '../core/color';
import { TAU, gaussian, lerp, random } from '../core/math';

export type Point = [number, number];
type Ctx = CanvasRenderingContext2D;

/** Subdivide each edge and push the new midpoint off-line, `rounds` times. */
export function wobble(points: Point[], rounds: number, variance: number): Point[] {
  let current = points;
  for (let r = 0; r < rounds; r++) {
    const next: Point[] = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i] as Point;
      const b = current[(i + 1) % current.length] as Point;
      next.push(a);
      const length = Math.min(Math.hypot(b[0] - a[0], b[1] - a[1]), 60);
      const offset = length * variance * gaussian();
      const angle = Math.random() * TAU;
      next.push([(a[0] + b[0]) / 2 + Math.cos(angle) * offset, (a[1] + b[1]) / 2 + Math.sin(angle) * offset]);
    }
    current = next;
  }
  return current;
}

export function tracePolygon(c: Ctx, points: Point[]): void {
  const first = points[0];
  if (!first) return;
  c.beginPath();
  c.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as Point;
    c.lineTo(p[0], p[1]);
  }
  c.closePath();
}

export interface WashOptions {
  /** Number of translucent layers (default 7). */
  layers?: number;
  /** Opacity of each layer (default 0.14). */
  alpha?: number;
  /** How far edges wander (default 0.3). */
  variance?: number;
  /** Wobble rounds applied to the base shape (default 1). */
  baseRounds?: number;
  /** Opacity of the darker pigment edge; 0 for none (default 0.2). */
  edge?: number;
  edgeWidth?: number;
  /** Per-layer random lightening/darkening. */
  colorJitter?: number;
}

export function wash(c: Ctx, points: Point[], color: Rgb, options: WashOptions = {}): void {
  const layers = options.layers || 7;
  const alpha = options.alpha || 0.14;
  const variance = options.variance ?? 0.3;
  const base = wobble(points, options.baseRounds ?? 1, variance * 0.6);
  for (let i = 0; i < layers; i++) {
    const tint = options.colorJitter ? shade(color, gaussian() * options.colorJitter) : color;
    c.fillStyle = rgba(tint, alpha);
    tracePolygon(c, wobble(base, 2, variance));
    c.fill();
  }
  if (options.edge !== 0) {
    c.strokeStyle = rgba(shade(color, -0.4), options.edge || 0.2);
    c.lineWidth = options.edgeWidth || 1;
    c.lineJoin = 'round';
    tracePolygon(c, wobble(base, 2, variance * 0.3));
    c.stroke();
  }
}

/** A dry-brush stroke made of `bristles` slightly curved lines. */
export function brushStroke(
  c: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: Rgb,
  alpha = 0.5,
  bristles = Math.max(3, Math.floor(width * 0.9)),
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const bend = gaussian() * length * 0.07;
  c.lineCap = 'round';
  for (let i = 0; i < bristles; i++) {
    const across = (i / (bristles - 1 || 1) - 0.5) * width + gaussian() * width * 0.07;
    const start = random(0, 0.14);
    const end = 1 - random(0, 0.14);
    const ax = x1 + dx * start + nx * across;
    const ay = y1 + dy * start + ny * across;
    const bx = x1 + dx * end + nx * across;
    const by = y1 + dy * end + ny * across;
    c.strokeStyle = rgba(color, alpha * random(0.3, 1));
    c.lineWidth = random(0.5, 1.7) * (width / bristles) * 1.25;
    c.beginPath();
    c.moveTo(ax, ay);
    c.quadraticCurveTo((ax + bx) / 2 + nx * bend, (ay + by) / 2 + ny * bend, bx, by);
    c.stroke();
  }
}

/** Soft radial glow. */
export function bloom(c: Ctx, x: number, y: number, radius: number, color: Rgb, alpha: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Flicked droplets, denser towards the centre. */
export function splatter(
  c: Ctx,
  x: number,
  y: number,
  radius: number,
  color: Rgb,
  count: number,
  alpha = 0.4,
  size = 1.8,
): void {
  for (let i = 0; i < count; i++) {
    const angle = random(TAU);
    const d = Math.pow(Math.random(), 0.6) * radius;
    c.fillStyle = rgba(color, alpha * random(0.3, 1));
    c.beginPath();
    c.arc(x + Math.cos(angle) * d, y + Math.sin(angle) * d, random(0.3, size), 0, TAU);
    c.fill();
  }
}

export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, count = 14): Point[] {
  return Array.from({ length: count }, (_, i): Point => {
    const a = (i / count) * TAU;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

/** Add points along each edge so a wash wobbles evenly along long sides. */
export function densify(points: Point[], step: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i] as Point;
    const b = points[(i + 1) % points.length] as Point;
    const n = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j++) out.push([lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)]);
  }
  return out;
}

export function createCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return [canvas, ctx];
}
