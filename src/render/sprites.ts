/** Hero, enemy and ink-splat sprites, painted once into offscreen canvases and cached. */
import { type Rgb, WHITE, hexToRgb, rgba, shade } from '../core/color';
import { TAU, random } from '../core/math';
import { BODY_SIZES } from '../data/enemies';
import type { BodyKey } from '../state/types';
import { HERO_COLORS, INK } from './palette';
import { type Point, bloom, brushStroke, createCanvas, ellipsePoints, splatter, wash } from './paint';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Size and anchor in layout units (before `scale`). */
  width: number;
  height: number;
  originX: number;
  originY: number;
}

type Ctx = CanvasRenderingContext2D;

function paintSprite(
  scale: number,
  width: number,
  height: number,
  originX: number,
  originY: number,
  paint: (c: Ctx) => void,
): Sprite {
  const resolution = scale * 2;
  const [canvas, c] = createCanvas(width * resolution, height * resolution);
  c.scale(resolution, resolution);
  c.translate(originX, originY);
  paint(c);
  return { canvas, width, height, originX, originY };
}

function paintHero(scale: number): Sprite {
  const h = HERO_COLORS;
  return paintSprite(scale, 64, 86, 32, 80, (c) => {
    const opts = { layers: 7, alpha: 0.3, variance: 0.16 };
    bloom(c, 0, -34, 34, [255, 240, 200], 0.22);
    // legs and boots
    wash(
      c,
      [
        [-8, -30],
        [-1, -31],
        [-2, -14],
        [-3, 0],
        [-10, 0],
        [-8, -14],
      ],
      h.hood,
      opts,
    );
    wash(
      c,
      [
        [0, -31],
        [7, -30],
        [8, -14],
        [10, 0],
        [3, 0],
        [2, -14],
      ],
      h.hood,
      opts,
    );
    wash(
      c,
      [
        [-11, -3],
        [-2, -3],
        [-1, 0],
        [-11, 0],
      ],
      h.boot,
      opts,
    );
    wash(
      c,
      [
        [2, -3],
        [11, -3],
        [13, 0],
        [2, 0],
      ],
      h.boot,
      opts,
    );
    // quiver
    brushStroke(c, -13, -34, -7, -56, 5, h.wood, 0.85, 5);
    for (let i = 0; i < 3; i++) brushStroke(c, -8 + i * 1.5, -56, -9 + i * 2.5, -63, 1.4, WHITE, 0.9, 2);
    // tunic, sash and belt
    const tunic: Point[] = [
      [-9, -54],
      [-2, -56],
      [7, -54],
      [9, -42],
      [10, -28],
      [4, -23],
      [-4, -23],
      [-11, -28],
      [-10, -42],
    ];
    wash(c, tunic, h.tunic, { layers: 8, alpha: 0.3, variance: 0.14 });
    brushStroke(c, -7, -50, 6, -30, 2.2, h.cloak, 0.8, 3);
    brushStroke(c, -10, -30, 10, -30, 3, h.gold, 0.9, 3);
    for (let i = 0; i < 4; i++)
      brushStroke(c, random(-6, 6), -50, random(-7, 7), -26, 1.4, shade(h.tunic, -0.3), 0.25, 2);
    // head and hood
    wash(c, ellipsePoints(2, -61, 5.6, 5.8, 11), h.skin, { layers: 7, alpha: 0.34, variance: 0.08 });
    const hood: Point[] = [
      [-6, -58],
      [-5, -66],
      [1, -70],
      [8, -67],
      [9, -63],
      [4, -65],
      [-1, -63],
      [-2, -56],
    ];
    wash(c, hood, h.hood, { layers: 8, alpha: 0.3, variance: 0.12 });
    c.fillStyle = rgba(INK, 0.9);
    c.beginPath();
    c.arc(5, -61, 0.8, 0, TAU);
    c.fill();
  });
}

const BONE: Rgb = [236, 226, 200];

function paintEnemy(scale: number, body: BodyKey, accentHex: string): Sprite {
  const { width: bw, height: h, headRadius: hr } = BODY_SIZES[body];
  const accent = hexToRgb(accentHex);
  const opts = { layers: 8, alpha: 0.27, variance: 0.16, edge: 0.3 };
  return paintSprite(scale, bw * 4 + 44, h + 40, bw * 2 + 22, h + 30, (c) => {
    const top = -h + 12;
    const headY = -h + 5;
    bloom(c, 0, -h * 0.5, h * 0.62, accent, 0.26);

    // Robe or torso
    if (body === 'archer' || body === 'boss') {
      const robe: Point[] = [
        [-bw * 0.7, top],
        [bw * 0.7, top],
        [bw * 1.05, -h * 0.4],
        [bw * 1.3, -2],
        [bw * 0.5, -5],
        [0, -1],
        [-bw * 0.6, -5],
        [-bw * 1.25, -2],
        [-bw, -h * 0.4],
      ];
      wash(c, robe, INK, opts);
      for (let i = 0; i < 5; i++)
        brushStroke(c, random(-bw, bw), -3, random(-bw, bw) * 1.3, random(2, 6), 1.6, INK, 0.5, 2);
    } else if (body === 'rider') {
      wash(
        c,
        [
          [-bw * 0.7, top],
          [bw * 0.7, top],
          [bw * 0.8, -4],
          [-bw * 0.8, -4],
        ],
        INK,
        opts,
      );
      wash(c, ellipsePoints(2, 0, 19, 7, 12), shade(INK, 0.14), opts); // mount
      brushStroke(c, -16, -2, -26, -7, 3, INK, 0.8, 3);
      brushStroke(c, -26, -7, -31, -5, 1.6, accent, 0.9, 2);
    } else {
      wash(
        c,
        [
          [-bw * 0.85, top],
          [bw * 0.8, top],
          [bw * 0.95, -h * 0.4],
          [0, -h * 0.34],
          [-bw * 0.9, -h * 0.4],
        ],
        INK,
        opts,
      );
    }

    // Scarf
    brushStroke(c, bw * 0.7, top + 2, -bw * 0.8, -h * 0.42, 3.2, accent, 0.85, 4);
    brushStroke(c, bw * 0.6, top + 1, bw * 1.2, top + random(10, 16), 2.6, accent, 0.6, 3);

    // Head, then horns (heavy enemies) or a hood
    wash(c, ellipsePoints(-1, headY, hr, hr, 11), INK, { layers: 8, alpha: 0.3, variance: 0.08, edge: 0.3 });
    if (body === 'giant' || body === 'brute' || body === 'boss') {
      const pairs = body === 'boss' ? 3 : 1;
      for (let i = 0; i < pairs; i++) {
        brushStroke(c, -hr + 1, headY - 3, -hr - 5 - i * 3, headY - 12 - i * 5, 2.2, BONE, 0.9, 3);
        brushStroke(c, hr - 3, headY - 3, hr + 3 + i * 3, headY - 12 - i * 5, 2.2, BONE, 0.9, 3);
      }
    } else {
      wash(
        c,
        [
          [-hr, headY - 1],
          [-1, headY - hr - 2],
          [hr + 5, headY - hr - 5],
          [hr, headY + 1],
        ],
        INK,
        {
          layers: 6,
          alpha: 0.3,
          variance: 0.14,
        },
      );
    }

    // Glowing eyes
    bloom(c, -3, headY, 6, accent, 0.95);
    c.fillStyle = '#fff';
    for (const ex of [-4.2, -1]) {
      c.beginPath();
      c.arc(ex, headY - 0.3, 1, 0, TAU);
      c.fill();
    }

    if (body === 'brute') {
      wash(c, ellipsePoints(-bw - 2, -h * 0.47, 8, 14, 14), shade(INK, 0.22), {
        layers: 8,
        alpha: 0.3,
        variance: 0.06,
      });
      c.strokeStyle = rgba(accent, 0.9);
      c.lineWidth = 1.6;
      c.beginPath();
      c.ellipse(-bw - 2, -h * 0.47, 7, 13, 0, 0, TAU);
      c.stroke();
      bloom(c, -bw - 2, -h * 0.47, 5, accent, 0.9);
    }
    if (body === 'boss') {
      for (let i = 0; i < 7; i++) {
        brushStroke(
          c,
          random(-bw, bw),
          top + random(6, 30),
          random(-bw, bw) * 1.2,
          -random(4, 20),
          1.3,
          accent,
          0.5,
          2,
        );
      }
    }
  });
}

function paintSplat(accentHex: string): HTMLCanvasElement {
  const [canvas, c] = createCanvas(128, 128);
  const accent = hexToRgb(accentHex);
  const outline: Point[] = Array.from({ length: 18 }, (_, i): Point => {
    const a = (i / 18) * TAU;
    const r = i % 2 ? random(34, 58) : random(14, 26);
    return [64 + Math.cos(a) * r, 64 + Math.sin(a) * r];
  });
  wash(c, outline, accent, { layers: 6, alpha: 0.13, variance: 0.5, edge: 0.12 });
  wash(c, ellipsePoints(64, 64, 20, 20, 10), INK, { layers: 4, alpha: 0.09, variance: 0.6, edge: 0 });
  splatter(c, 64, 64, 60, accent, 40, 0.6, 2.6);
  splatter(c, 64, 64, 56, INK, 14, 0.4, 1.8);
  return canvas;
}

/** Sprite cache. Hero and enemy sprites depend on `scale`, so call `reset` when it changes. */
export class SpriteBank {
  private hero: Sprite | null = null;
  private enemies = new Map<string, Sprite>();
  private splats = new Map<string, HTMLCanvasElement>();

  constructor(private scale: number) {}

  reset(scale: number): void {
    this.scale = scale;
    this.hero = null;
    this.enemies.clear();
  }

  heroSprite(): Sprite {
    this.hero ??= paintHero(this.scale);
    return this.hero;
  }

  enemySprite(body: BodyKey, accent: string): Sprite {
    const key = `${body}:${accent}`;
    let sprite = this.enemies.get(key);
    if (!sprite) {
      sprite = paintEnemy(this.scale, body, accent);
      this.enemies.set(key, sprite);
    }
    return sprite;
  }

  splat(accent: string): HTMLCanvasElement {
    let canvas = this.splats.get(accent);
    if (!canvas) {
      canvas = paintSplat(accent);
      this.splats.set(accent, canvas);
    }
    return canvas;
  }
}
