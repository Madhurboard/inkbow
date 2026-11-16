/**
 * Paints a realm's background once per realm or resize into three parallax layers:
 * sky, hills, and the near ground with perches, platform and water.
 */
import { type Rgb, WHITE, mixColor, rgba, shade } from '../core/color';
import { TAU, clamp, gaussian, lerp, pick, random } from '../core/math';
import type { Realm } from '../data/realms';
import type { Layout, Perch } from '../state/types';
import { GOLD_GLOW } from './palette';
import {
  type Point,
  bloom,
  brushStroke,
  createCanvas,
  densify,
  ellipsePoints,
  splatter,
  wash,
} from './paint';

/** Extra width painted on each side so layers can sway without showing an edge. */
export const OVERSCAN = 26;

export interface DriftingCloud {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  x: number;
  y: number;
  speed: number;
}

export interface SceneAssets {
  sky: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  near: HTMLCanvasElement;
  clouds: DriftingCloud[];
  mist: HTMLCanvasElement;
}

type Ctx = CanvasRenderingContext2D;

function skyColorAt(realm: Realm, t: number): Rgb {
  const stops = realm.sky;
  const f = clamp(t, 0, 0.999) * (stops.length - 1);
  const i = Math.floor(f);
  return mixColor(stops[i] as Rgb, stops[i + 1] as Rgb, f - i);
}

/** Layered sine ridges give a natural-looking mountain line. */
function ridge(width: number, baseY: number, amplitude: number, step: number): Point[] {
  const k1 = TAU / (width * random(0.5, 0.9));
  const k2 = TAU / (width * random(0.2, 0.35));
  const k3 = TAU / (width * random(0.07, 0.12));
  const [a, b, c] = [random(TAU), random(TAU), random(TAU)];
  const points: Point[] = [];
  for (let x = -OVERSCAN - 10; x <= width + OVERSCAN + 10; x += step) {
    const height =
      0.55 * (1 - Math.abs(Math.sin(x * k1 + a))) +
      0.3 * (1 - Math.abs(Math.sin(x * k2 + b))) +
      0.15 * Math.sin(x * k3 + c);
    points.push([x, baseY - amplitude * height + gaussian() * amplitude * 0.02]);
  }
  return points;
}

/** A floating island with a waterfall and a small tree; `far` ones are faint silhouettes. */
function island(c: Ctx, cx: number, y: number, w: number, realm: Realm, s: number, far: boolean): void {
  const rock = far ? mixColor(realm.farHills, realm.mist, 0.25) : realm.rock;
  const outline = densify(
    [
      [cx - w / 2, y],
      [cx + w / 2, y],
      [cx + w * 0.4, y + w * 0.2],
      [cx + w * 0.16, y + w * 0.5],
      [cx - w * 0.02, y + w * 0.82],
      [cx - w * 0.17, y + w * 0.44],
      [cx - w * 0.4, y + w * 0.2],
    ],
    w / 9,
  );
  wash(c, outline, rock, { layers: 7, alpha: far ? 0.1 : 0.2, variance: 0.35 });
  if (!far) {
    for (let i = 0; i < 7; i++) {
      brushStroke(
        c,
        cx + random(-w * 0.35, w * 0.3),
        y + random(4, w * 0.25),
        cx + random(-w * 0.1, w * 0.1),
        y + random(w * 0.3, w * 0.7),
        random(2, 5) * s,
        i % 2 ? realm.highlight : shade(realm.rock, -0.3),
        0.22,
      );
    }
    for (let i = 0; i < 4; i++) {
      const rx = cx + random(-w * 0.3, w * 0.3);
      brushStroke(
        c,
        rx,
        y + w * 0.2,
        rx + gaussian() * 4,
        y + w * random(0.5, 1),
        1.2 * s,
        shade(realm.rock, -0.2),
        0.4,
        2,
      );
    }
  }
  const turf = densify(
    [
      [cx - w / 2 - 2, y - 2 * s],
      [cx + w / 2 + 2, y - 2 * s],
      [cx + w / 2, y + 5 * s],
      [cx - w / 2, y + 5 * s],
    ],
    8,
  );
  wash(c, turf, realm.grass, { layers: 5, alpha: far ? 0.1 : 0.24, variance: 0.4 });
  if (far) {
    brushStroke(c, cx - w * 0.3, y + 2, cx - w * 0.3, y + w * 1.2, 1.5 * s, WHITE, 0.25, 3);
    return;
  }
  for (let i = 0; i < 16; i++) {
    const gx = cx + random(-w / 2, w / 2);
    brushStroke(c, gx, y + 1, gx + gaussian() * 3 * s, y - random(3, 8) * s, 1.2 * s, realm.grass, 0.7, 2);
  }
  const fallX = cx - w * 0.44;
  for (let i = 0; i < 4; i++) {
    brushStroke(
      c,
      fallX + i * 1.5,
      y + 3,
      fallX + i * 1.5 + gaussian() * 2,
      y + w * random(0.9, 1.5),
      2 * s,
      WHITE,
      0.3,
      3,
    );
  }
  bloom(c, fallX, y + w * 1.3, 14 * s, WHITE, 0.25);
  const treeX = cx + w * 0.36;
  brushStroke(c, treeX, y, treeX + 2 * s, y - 16 * s, 2 * s, shade(realm.rock, -0.3), 0.8, 3);
  for (let i = 0; i < 3; i++) {
    wash(
      c,
      ellipsePoints(
        treeX + gaussian() * 5 * s,
        y - (18 + i * 5) * s,
        random(7, 11) * s,
        random(6, 9) * s,
        10,
      ),
      realm.tree,
      { layers: 5, alpha: 0.16, variance: 0.5, colorJitter: 0.15 },
    );
  }
}

function paintSky(c: Ctx, L: Layout, realm: Realm): void {
  const { width: W, height: H, groundY: GY, scale: s } = L;
  const gradient = c.createLinearGradient(0, 0, 0, GY);
  realm.sky.forEach((color, i) => gradient.addColorStop(i / (realm.sky.length - 1), rgba(color, 1)));
  c.fillStyle = gradient;
  c.fillRect(-OVERSCAN, 0, W + OVERSCAN * 2, H);
  for (let i = 0; i < 14; i++) {
    const cy = random(0, GY);
    wash(
      c,
      ellipsePoints(random(-OVERSCAN, W), cy, random(60, 170) * s, random(26, 70) * s, 12),
      shade(skyColorAt(realm, cy / GY), gaussian() * 0.3),
      { layers: 5, alpha: 0.05, variance: 0.6, edge: 0 },
    );
  }
  for (let i = 0; i < 80; i++) {
    const y = random(0, GY);
    const w = random(W * 0.3, W);
    const x0 = random(-OVERSCAN, W) - w * 0.3;
    brushStroke(
      c,
      x0,
      y,
      x0 + w,
      y + gaussian() * 10,
      random(8, 44) * s,
      shade(skyColorAt(realm, y / GY), gaussian() * 0.22),
      0.075,
      12,
    );
  }
  if (realm.stars) {
    for (let i = 0; i < 170; i++) {
      c.fillStyle = `rgba(255,255,255,${random(0.2, 0.95)})`;
      c.beginPath();
      c.arc(
        random(-OVERSCAN, W + OVERSCAN),
        Math.pow(Math.random(), 1.6) * GY * 0.75,
        random(0.3, 1.3),
        0,
        TAU,
      );
      c.fill();
    }
  }
  const { x: ox, y: oy, r: or } = orb(L, realm);
  bloom(c, ox, oy, or * 4, realm.glow, 0.5);
  bloom(c, ox, oy, or * 2, realm.orb, 0.55);
  if (realm.ring) {
    c.save();
    c.translate(ox, oy);
    c.rotate(-0.35);
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = rgba(realm.orb, 0.14);
      c.lineWidth = random(2, 6) * s;
      c.beginPath();
      c.ellipse(0, 0, or * (1.7 + i * 0.06), or * (0.42 + i * 0.02), 0, 0, TAU);
      c.stroke();
    }
    c.restore();
  }
  wash(c, ellipsePoints(ox, oy, or, or, 26), realm.orb, {
    layers: 9,
    alpha: 0.2,
    variance: 0.12,
    edge: 0.08,
  });
  if (realm.moon) {
    for (let i = 0; i < 7; i++) {
      const a = random(TAU);
      const d = random(or * 0.75);
      wash(
        c,
        ellipsePoints(
          ox + Math.cos(a) * d,
          oy + Math.sin(a) * d,
          random(or * 0.1, or * 0.3),
          random(or * 0.08, or * 0.22),
          9,
        ),
        shade(realm.glow, -0.25),
        { layers: 4, alpha: 0.045, variance: 0.5, edge: 0 },
      );
    }
  }
  for (let i = 0; i < 6; i++) {
    const cx = random(0, W);
    const cy = random(GY * 0.12, GY * 0.62);
    const w = random(90, 190) * s;
    for (let j = 0; j < 6; j++) {
      wash(
        c,
        ellipsePoints(
          cx + gaussian() * w * 0.45,
          cy + gaussian() * w * 0.07,
          w * random(0.25, 0.5),
          w * random(0.06, 0.12),
          11,
        ),
        j < 4 ? realm.cloud : shade(realm.cloud, -0.25),
        { layers: 4, alpha: 0.05, variance: 0.5, edge: 0 },
      );
    }
  }
  splatter(c, random(W), random(GY * 0.5), W * 0.5, shade(realm.sky[1] as Rgb, 0.3), 40, 0.25, 1.6);
}

function orb(L: Layout, realm: Realm): { x: number; y: number; r: number } {
  return {
    x: L.width * realm.orbX,
    y: L.height * realm.orbY,
    r: realm.orbRadius * Math.min(L.width, L.height) * (L.height > L.width ? 1.25 : 1),
  };
}

function paintHills(c: Ctx, L: Layout, realm: Realm): void {
  const { width: W, height: H, groundY: GY, scale: s } = L;
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const color = mixColor(realm.farHills, realm.nearHills, t);
    const baseY = GY - H * lerp(0.17, 0.02, t);
    const amp = H * lerp(0.2, 0.12, t);
    const line = ridge(W, baseY, amp, 13 * s);
    if (i === 1) {
      island(c, W * 0.22, H * 0.33, 58 * s, realm, s, true);
      island(c, W * 0.56, H * 0.4, 40 * s, realm, s, true);
    }
    wash(
      c,
      line.concat([
        [W + OVERSCAN + 10, H + 80],
        [-OVERSCAN - 10, H + 80],
      ]),
      color,
      {
        layers: 7,
        alpha: 0.17,
        variance: 0.5,
        baseRounds: 0,
        edge: 0.14,
      },
    );
    // light and shadow on the peaks
    for (let j = 2; j < line.length - 2; j++) {
      const p = line[j] as Point;
      const isPeak = p[1] < (line[j - 2] as Point)[1] - 2 && p[1] < (line[j + 2] as Point)[1] - 2;
      if (!isPeak || Math.random() >= 0.6) continue;
      brushStroke(
        c,
        p[0],
        p[1] + 2,
        p[0] - amp * random(0.15, 0.3),
        p[1] + amp * random(0.25, 0.5),
        random(8, 16) * s,
        mixColor(realm.highlight, realm.mist, 0.4),
        0.14,
      );
      brushStroke(
        c,
        p[0] + 3,
        p[1] + 3,
        p[0] + amp * random(0.1, 0.25),
        p[1] + amp * random(0.3, 0.5),
        random(8, 14) * s,
        shade(color, -0.3),
        0.12,
      );
    }
    if (i === 2) {
      for (let j = 0; j < 22; j++) {
        const q = pick(line);
        const r = random(10, 24) * s;
        wash(c, ellipsePoints(q[0], q[1] + r * 0.2, r, r * 0.8, 10), realm.tree, {
          layers: 4,
          alpha: 0.11,
          variance: 0.6,
          colorJitter: 0.2,
          edge: 0.1,
        });
      }
    }
    if (i === 1) {
      // distant ruined arches
      for (const ax of [0.3, 0.5]) {
        const bx = W * ax;
        const by = baseY + amp * 0.1;
        const tone = mixColor(color, realm.mist, 0.2);
        const hh = random(44, 64) * s;
        brushStroke(c, bx, by, bx, by - hh, 8 * s, tone, 0.5);
        brushStroke(c, bx + 30 * s, by, bx + 30 * s, by - hh * 0.7, 8 * s, tone, 0.5);
        brushStroke(c, bx, by - hh, bx + 14 * s, by - hh - 10 * s, 6 * s, tone, 0.45);
        brushStroke(c, bx + 14 * s, by - hh - 10 * s, bx + 24 * s, by - hh - 4 * s, 5 * s, tone, 0.4);
      }
    }
    const mist = c.createLinearGradient(0, baseY - amp * 0.25, 0, GY + 10);
    mist.addColorStop(0, rgba(realm.mist, 0));
    mist.addColorStop(1, rgba(realm.mist, lerp(0.75, 0.4, t)));
    c.fillStyle = mist;
    c.fillRect(-OVERSCAN, baseY - amp * 0.25, W + OVERSCAN * 2, GY - baseY + amp * 0.25 + 12);
  }
}

function paintCliffsAndTower(c: Ctx, L: Layout, realm: Realm): void {
  const { width: W, height: H, groundY: GY, scale: s, perches } = L;
  const [low, high, tower] = perches as [Perch, Perch, Perch, ...Perch[]];
  const cliff = densify(
    [
      [W + OVERSCAN + 8, H + 20],
      [low.x - 44 * s, GY + 8],
      [low.x - 36 * s, (GY + low.y) / 2],
      [low.x - 26 * s, low.y],
      [low.x + 22 * s, low.y],
      [low.x + 28 * s, (low.y + high.y) / 2],
      [high.x - 24 * s, high.y],
      [high.x + 26 * s, high.y],
      [high.x + 30 * s, high.y - 70 * s],
      [W + OVERSCAN + 8, high.y - 110 * s],
    ],
    11 * s,
  );
  wash(c, cliff, realm.rock, { layers: 8, alpha: 0.2, variance: 0.3, baseRounds: 0 });
  for (let i = 0; i < 34; i++) {
    const y = random(high.y - 60 * s, GY);
    const x = random(low.x - 30 * s, W + OVERSCAN);
    brushStroke(
      c,
      x,
      y,
      x + random(14, 44) * s,
      y + gaussian() * 8 * s,
      random(3, 9) * s,
      i % 3 ? shade(realm.rock, -0.35) : realm.highlight,
      0.2,
    );
  }
  for (const ledge of [low, high]) {
    wash(
      c,
      densify(
        [
          [ledge.x - 28 * s, ledge.y - 2 * s],
          [ledge.x + 26 * s, ledge.y - 2 * s],
          [ledge.x + 24 * s, ledge.y + 5 * s],
          [ledge.x - 27 * s, ledge.y + 5 * s],
        ],
        8,
      ),
      realm.grass,
      { layers: 5, alpha: 0.22, variance: 0.4 },
    );
    for (let i = 0; i < 10; i++) {
      const gx = ledge.x + random(-26, 24) * s;
      brushStroke(
        c,
        gx,
        ledge.y + 1,
        gx + gaussian() * 3 * s,
        ledge.y - random(3, 8) * s,
        1.2 * s,
        realm.grass,
        0.7,
        2,
      );
    }
  }
  // Ruined tower
  const t = tower;
  wash(
    c,
    densify(
      [
        [t.x - 14 * s, GY + 6],
        [t.x - 13 * s, t.y + 9 * s],
        [t.x - 22 * s, t.y + 9 * s],
        [t.x - 22 * s, t.y],
        [t.x + 22 * s, t.y],
        [t.x + 22 * s, t.y + 9 * s],
        [t.x + 13 * s, t.y + 9 * s],
        [t.x + 15 * s, GY + 6],
      ],
      9 * s,
    ),
    realm.stone,
    { layers: 8, alpha: 0.2, variance: 0.22, baseRounds: 0 },
  );
  for (let y = t.y + 16 * s; y < GY; y += 9 * s)
    brushStroke(
      c,
      t.x - 12 * s,
      y,
      t.x + 12 * s,
      y + gaussian() * 2,
      1.4 * s,
      shade(realm.stone, -0.45),
      0.35,
      2,
    );
  brushStroke(c, t.x - 9 * s, t.y + 12 * s, t.x - 9 * s, GY, 6 * s, shade(realm.stone, 0.35), 0.2);
  brushStroke(c, t.x + 9 * s, t.y + 12 * s, t.x + 9 * s, GY, 6 * s, shade(realm.stone, -0.5), 0.25);
  for (let i = 0; i < 5; i++) {
    const vx = t.x + random(-18, 18) * s;
    brushStroke(
      c,
      vx,
      t.y + 4 * s,
      vx + gaussian() * 5 * s,
      t.y + random(14, 40) * s,
      1.3 * s,
      realm.grass,
      0.6,
      2,
    );
  }
  // Glowing rune
  brushStroke(c, t.x - 5 * s, t.y + 20 * s, t.x + 5 * s, t.y + 20 * s, 1.6 * s, GOLD_GLOW, 0.9, 2);
  brushStroke(c, t.x, t.y + 15 * s, t.x, t.y + 26 * s, 1.6 * s, GOLD_GLOW, 0.9, 2);
  bloom(c, t.x, t.y + 20 * s, 14 * s, GOLD_GLOW, 0.3);
  // Floating island perches
  for (let i = 3; i < perches.length; i++) {
    const p = perches[i] as Perch;
    island(c, p.x, p.y, (i === 3 ? 84 : 70) * s, realm, s, false);
  }
}

/** Y where the ground meets the water. */
export function shoreline(L: Layout): number {
  return L.groundY + Math.min(44 * L.scale, (L.height - L.groundY) * 0.3);
}

function paintGroundAndWater(c: Ctx, L: Layout, realm: Realm): void {
  const { width: W, height: H, groundY: GY, scale: s } = L;
  const shore = shoreline(L);
  const { x: ox, r: or } = orb(L, realm);
  const water = c.createLinearGradient(0, shore - 6, 0, H);
  water.addColorStop(0, rgba(mixColor(realm.sky[3] as Rgb, realm.mist, 0.3), 1));
  water.addColorStop(0.5, rgba(mixColor(realm.sky[2] as Rgb, realm.groundDark, 0.25), 1));
  water.addColorStop(1, rgba(mixColor(realm.sky[0] as Rgb, realm.groundDark, 0.6), 1));
  c.fillStyle = water;
  c.fillRect(-OVERSCAN, shore - 6, W + OVERSCAN * 2, H - shore + 8);
  for (let i = 0; i < 70; i++) {
    const y = random(shore, H);
    const t = (y - shore) / (H - shore);
    const w = random(40, 180) * s;
    const x0 = random(-OVERSCAN, W);
    brushStroke(
      c,
      x0,
      y,
      x0 + w,
      y + gaussian() * 2,
      random(2, 7) * s,
      shade(skyColorAt(realm, 1 - t * 0.8), gaussian() * 0.25),
      0.16,
      5,
    );
  }
  // Reflection of the sun or moon
  for (let i = 0; i < 16; i++) {
    const y = shore + ((H - shore) * i) / 16;
    brushStroke(
      c,
      ox - or * random(0.3, 1) - i,
      y,
      ox + or * random(0.3, 1) + i,
      y,
      random(3, 6) * s,
      realm.orb,
      0.22,
      4,
    );
  }
  bloom(c, ox, shore + (H - shore) * 0.3, or * 2.4, realm.glow, 0.22);

  const ground: Point[] = [];
  for (let x = -OVERSCAN - 8; x <= W + OVERSCAN + 8; x += 10 * s) ground.push([x, GY + gaussian() * 1.2]);
  for (let x = W + OVERSCAN + 8; x >= -OVERSCAN - 8; x -= 12 * s)
    ground.push([x, shore + Math.sin(x * 0.02) * 5 * s + gaussian() * 3 * s]);
  wash(c, ground, realm.ground, { layers: 8, alpha: 0.24, variance: 0.3, baseRounds: 0 });
  for (let i = 0; i < 40; i++) {
    const x = random(-OVERSCAN, W + OVERSCAN);
    const y = random(GY + 3, shore - 3);
    brushStroke(
      c,
      x,
      y,
      x + random(20, 70) * s,
      y + gaussian() * 2,
      random(2, 6) * s,
      i % 2 ? realm.groundDark : shade(realm.ground, 0.2),
      0.2,
    );
  }
  splatter(c, W / 2, (GY + shore) / 2, W * 0.6, realm.groundDark, 90, 0.5, 1.5);
  for (let i = 0; i < 130; i++) {
    const gx = random(-OVERSCAN, W + OVERSCAN);
    const gy = GY + random(-1, 3);
    brushStroke(
      c,
      gx,
      gy,
      gx + gaussian() * 4 * s,
      gy - random(3, 10) * s,
      1.3 * s,
      Math.random() < 0.3 ? realm.highlight : realm.grass,
      0.65,
      2,
    );
  }
  for (let i = 0; i < 34; i++) {
    c.fillStyle = rgba(realm.flower, random(0.6, 1));
    c.beginPath();
    c.arc(random(-OVERSCAN, W + OVERSCAN), GY + random(-6, 4) * s, random(0.8, 1.9) * s, 0, TAU);
    c.fill();
  }
}

function paintPlatform(c: Ctx, L: Layout, realm: Realm): void {
  const { height: H, groundY: GY, scale: s, platformHeight: PH, archerX } = L;
  const shore = shoreline(L);
  const top = GY - PH;
  const right = archerX + 30 * s;
  wash(
    c,
    densify(
      [
        [-OVERSCAN - 8, H * 0.5 + GY * 0.5],
        [-OVERSCAN - 8, top],
        [right, top],
        [right + 3 * s, top + PH * 0.5],
        [right + 20 * s, top + PH * 0.5],
        [right + 23 * s, GY + 10 * s],
        [right + 10 * s, shore + 8 * s],
        [-OVERSCAN - 8, shore + 14 * s],
      ],
      10 * s,
    ),
    realm.stone,
    { layers: 9, alpha: 0.22, variance: 0.2, baseRounds: 0 },
  );
  for (let y = top + 10 * s; y < GY + 6 * s; y += 11 * s) {
    brushStroke(
      c,
      -OVERSCAN,
      y,
      right + (y > top + PH * 0.5 ? 20 * s : 0),
      y + gaussian(),
      1.3 * s,
      shade(realm.stone, -0.5),
      0.4,
      2,
    );
    for (let x = random(8, 22) * s; x < right; x += random(18, 30) * s) {
      brushStroke(c, x, y, x + gaussian(), y + 11 * s, 1.1 * s, shade(realm.stone, -0.5), 0.3, 2);
    }
  }
  brushStroke(c, -OVERSCAN, top + 2 * s, right, top + 2 * s, 4 * s, shade(realm.stone, 0.45), 0.4);
  for (let i = 0; i < 10; i++) {
    const gx = random(-OVERSCAN, right);
    brushStroke(
      c,
      gx,
      top + 1,
      gx + gaussian() * 3 * s,
      top + random(6, 18) * s,
      1.4 * s,
      realm.grass,
      0.55,
      2,
    );
  }
  // Star rune on the platform
  const rx = archerX + 2 * s;
  const ry = top + PH * 0.55;
  bloom(c, rx, ry, 20 * s, GOLD_GLOW, 0.35);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    brushStroke(
      c,
      rx,
      ry,
      rx + Math.cos(a) * 8 * s,
      ry + Math.sin(a) * 8 * s,
      1.5 * s,
      [255, 225, 140],
      0.95,
      2,
    );
  }
}

function paintForegroundRocks(c: Ctx, L: Layout, realm: Realm): void {
  const { width: W, height: H, scale: s } = L;
  for (const fx of [-0.02, 0.2, 0.94, 0.72]) {
    const cx = W * fx;
    const r = random(34, 62) * s;
    const cy = H + r * 0.25;
    wash(c, ellipsePoints(cx, cy, r * 1.35, r, 12), realm.groundDark, {
      layers: 8,
      alpha: 0.24,
      variance: 0.5,
    });
    brushStroke(c, cx - r * 0.8, cy - r * 0.75, cx + r * 0.5, cy - r * 0.85, 5 * s, realm.highlight, 0.22);
    for (let i = 0; i < 12; i++) {
      const gx = cx + random(-r * 1.3, r * 1.3);
      brushStroke(
        c,
        gx,
        H - random(0, r * 0.6),
        gx + gaussian() * 12 * s,
        H - r - random(10, 48) * s,
        1.8 * s,
        i % 3 ? realm.groundDark : realm.grass,
        0.75,
        3,
      );
    }
  }
}

export function paintScene(L: Layout, realm: Realm): SceneAssets {
  const resolution = Math.min(L.dpr, 1.5);
  const layer = (): [HTMLCanvasElement, Ctx] => {
    const [canvas, c] = createCanvas((L.width + OVERSCAN * 2) * resolution, L.height * resolution);
    c.scale(resolution, resolution);
    c.translate(OVERSCAN, 0);
    return [canvas, c];
  };
  const [sky, skyCtx] = layer();
  paintSky(skyCtx, L, realm);
  const [hills, hillsCtx] = layer();
  paintHills(hillsCtx, L, realm);
  const [near, nearCtx] = layer();
  paintCliffsAndTower(nearCtx, L, realm);
  paintGroundAndWater(nearCtx, L, realm);
  paintPlatform(nearCtx, L, realm);
  paintForegroundRocks(nearCtx, L, realm);

  const clouds: DriftingCloud[] = Array.from({ length: 4 }, () => {
    const w = random(150, 260) * L.scale;
    const h = w * 0.34;
    const [canvas, c] = createCanvas(w * resolution, h * resolution);
    c.scale(resolution, resolution);
    for (let j = 0; j < 8; j++) {
      wash(
        c,
        ellipsePoints(
          w / 2 + gaussian() * w * 0.24,
          h * 0.55 + gaussian() * h * 0.1,
          w * random(0.14, 0.24),
          h * random(0.14, 0.24),
          11,
        ),
        j < 5 ? realm.cloud : shade(realm.cloud, -0.2),
        { layers: 4, alpha: 0.06, variance: 0.5, edge: 0 },
      );
    }
    return {
      canvas,
      width: w,
      height: h,
      x: random(L.width),
      y: random(L.groundY * 0.1, L.groundY * 0.55),
      speed: random(3, 9) * L.scale,
    };
  });

  const [mist, mistCtx] = createCanvas(256, 64);
  mistCtx.scale(1, 0.25);
  bloom(mistCtx, 128, 128, 128, realm.mist, 0.5);

  return { sky, hills, near, clouds, mist };
}

/** Paper grain tile and edge vignette, multiplied over the whole frame. */
export function paintPaper(target: Ctx): { grain: CanvasPattern | null; vignette: HTMLCanvasElement } {
  const [tile, c] = createCanvas(256, 256);
  c.fillStyle = '#fff';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 50; i++)
    bloom(c, random(30, 226), random(30, 226), random(14, 50), [190, 170, 140], random(0.03, 0.08));
  const image = c.getImageData(0, 0, 256, 256);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const k = (Math.random() - 0.5) * 26 + (Math.random() < 0.03 ? -22 : 0);
    d[i] = clamp((d[i] ?? 0) + k - 5, 0, 255);
    d[i + 1] = clamp((d[i + 1] ?? 0) + k - 8, 0, 255);
    d[i + 2] = clamp((d[i + 2] ?? 0) + k - 14, 0, 255);
  }
  c.putImageData(image, 0, 0);
  for (let i = 0; i < 90; i++) {
    c.strokeStyle = `rgba(110,90,70,${random(0.04, 0.1)})`;
    c.lineWidth = 0.7;
    c.beginPath();
    const a = random(256);
    const b = random(256);
    c.moveTo(a, b);
    c.lineTo(a + random(-16, 16), b + random(-16, 16));
    c.stroke();
  }
  const [vignette, v] = createCanvas(64, 64);
  const g = v.createRadialGradient(32, 32, 16, 32, 32, 46);
  g.addColorStop(0, 'rgba(60,30,50,0)');
  g.addColorStop(1, 'rgba(50,24,44,.5)');
  v.fillStyle = g;
  v.fillRect(0, 0, 64, 64);
  return { grain: target.createPattern(tile, 'repeat'), vignette };
}
