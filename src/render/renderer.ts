/** Draws one frame of the game. Reads game state; never changes it. */
import { type Rgb, hexToRgb, rgba, shade } from '../core/color';
import { TAU, clamp, gaussian, lerp } from '../core/math';
import { ARROW_TYPES } from '../data/enemies';
import { BOW_TIERS, SPIRIT_ARROWS } from '../data/progression';
import { type Realm, realmAt } from '../data/realms';
import { BALANCE } from '../config';
import { currentShot } from '../systems/aim';
import { enemyArtHeight, bowHand, heroArrowTip, heroFrame, heroTurn, shieldShape } from '../systems/bodies';
import { DECAL_LIFE, TEXT_LIFE } from '../systems/effects';
import { bowTierIndex } from '../systems/rules';
import type { Enemy, Game, Layout } from '../state/types';
import { HERO_COLORS, INK } from './palette';
import { tracePolygon, type Point } from './paint';
import { OVERSCAN, type SceneAssets, paintPaper, paintScene, shoreline } from './scene';
import { CharacterArt, enemyArtKey } from './characters';
import { type Sprite, SpriteBank } from './sprites';

/** Trail points at least `gap` behind the arrow tip at (x, y). */
function trailBehind(trail: number[], x: number, y: number, gap: number): number[] {
  let end = trail.length;
  while (end >= 2 && Math.hypot((trail[end - 2] ?? x) - x, (trail[end - 1] ?? y) - y) < gap) end -= 2;
  return trail.slice(0, end);
}

const BRUSH_FONT = '"Kaushan Script","Brush Script MT",cursive';

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private scene: SceneAssets | null = null;
  private sceneRealm = -1;
  private sceneLayoutKey = '';
  private sprites: SpriteBank;
  private paper: { grain: CanvasPattern | null; vignette: HTMLCanvasElement } | null = null;
  readonly art = new CharacterArt();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.sprites = new SpriteBank(1);
  }

  /** Resize the canvas and drop anything painted at the old size. */
  resize(layout: Layout): void {
    this.canvas.width = Math.floor(layout.width * layout.dpr);
    this.canvas.height = Math.floor(layout.height * layout.dpr);
    this.sprites.reset(layout.scale);
    this.paper ??= paintPaper(this.ctx);
    this.sceneLayoutKey = '';
  }

  /** Repaint the background if the realm or layout changed. Returns true when it did. */
  ensureScene(game: Game): boolean {
    const key = `${game.layout.width}x${game.layout.height}`;
    if (this.scene && this.sceneRealm === game.run.realm && this.sceneLayoutKey === key) return false;
    this.scene = paintScene(game.layout, realmAt(game.run.realm));
    this.sceneRealm = game.run.realm;
    this.sceneLayoutKey = key;
    return true;
  }

  updateAmbient(game: Game, dt: number): void {
    if (!this.scene) return;
    const edge = game.layout.width + OVERSCAN;
    for (const cloud of this.scene.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x > edge) cloud.x = -cloud.width - OVERSCAN;
    }
  }

  draw(game: Game): void {
    const scene = this.scene;
    if (!scene) return;
    const { ctx: c } = this;
    const L = game.layout;
    const realm = realmAt(game.run.realm);
    const s = L.scale;
    const playing = game.phase === 'play';
    const run = game.run;

    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    c.fillStyle = rgba(realm.sky[1] as Rgb, 1);
    c.fillRect(0, 0, L.width, L.height);

    const sway = Math.sin(game.time * 0.22) * 6;
    const shakeX = playing ? gaussian() * run.shake : 0;
    const shakeY = playing ? gaussian() * run.shake * 0.6 : 0;
    const fullWidth = L.width + OVERSCAN * 2;

    // Far layers move least.
    c.drawImage(scene.sky, -OVERSCAN + sway * 0.25 + shakeX * 0.3, shakeY * 0.3, fullWidth, L.height);
    for (const cloud of scene.clouds)
      c.drawImage(cloud.canvas, cloud.x + sway * 0.3, cloud.y, cloud.width, cloud.height);
    if (game.weather.lightningFlash > 0) {
      c.fillStyle = `rgba(235,245,255,${game.weather.lightningFlash * 1.6})`;
      c.fillRect(0, 0, L.width, L.height);
    }
    this.drawBirds(game);
    c.drawImage(scene.hills, -OVERSCAN + sway * 0.55 + shakeX * 0.6, shakeY * 0.6, fullWidth, L.height);
    c.globalAlpha = 0.55;
    for (let i = 0; i < 3; i++) {
      const mx = ((game.time * (6 + i * 3) + i * L.width * 0.4) % (L.width * 1.6)) - L.width * 0.5;
      c.drawImage(scene.mist, mx, L.groundY - L.height * (0.1 + i * 0.035), L.width * 0.9, 54 * s);
    }
    c.globalAlpha = 1;

    c.save();
    c.translate(sway + shakeX, shakeY);
    c.drawImage(scene.near, -OVERSCAN, 0, fullWidth, L.height);
    this.drawWaterShimmer(game, realm);
    this.drawDecals(game);
    for (const enemy of [...game.enemies].sort((a, b) => a.y - b.y)) this.drawEnemy(game, enemy);
    this.drawHero(game);
    this.drawLantern(game);
    this.drawPlayerArrows(game);
    this.drawEnemyArrows(game);
    this.drawParticles(game);
    this.drawTexts(game);
    this.drawForegroundGrass(game, realm);
    c.restore();

    c.globalAlpha = 0.5;
    const mx = ((game.time * 9) % (L.width * 1.8)) - L.width * 0.6;
    c.drawImage(scene.mist, mx, L.groundY - 18 * s, L.width * 1.1, 60 * s);
    c.globalAlpha = 1;
    this.drawWeather(game, realm);
    if (run.flash > 0) {
      c.fillStyle = `rgba(255,244,210,${clamp(run.flash, 0, 0.5)})`;
      c.fillRect(0, 0, L.width, L.height);
    }

    // Paper grain over everything.
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.paper) {
      if (this.paper.grain) {
        c.globalCompositeOperation = 'multiply';
        c.fillStyle = this.paper.grain;
        c.fillRect(0, 0, this.canvas.width, this.canvas.height);
        c.globalCompositeOperation = 'source-over';
      }
      c.drawImage(this.paper.vignette, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // -------------------------------------------------------------------------------------------

  private drawSprite(sprite: Sprite, x: number, y: number, scale: number, s: number, alpha = 1): void {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.drawImage(
      sprite.canvas,
      x - sprite.originX * s * scale,
      y - sprite.originY * s * scale,
      sprite.width * s * scale,
      sprite.height * s * scale,
    );
    c.globalAlpha = 1;
  }

  private glowDot(x: number, y: number, r: number, color: Rgb, alpha: number): void {
    const c = this.ctx;
    c.fillStyle = rgba(color, alpha * 0.22);
    c.beginPath();
    c.arc(x, y, r * 2.4, 0, TAU);
    c.fill();
    c.fillStyle = rgba(color, alpha * 0.5);
    c.beginPath();
    c.arc(x, y, r * 1.4, 0, TAU);
    c.fill();
    c.fillStyle = rgba(shade(color, 0.6), alpha);
    c.beginPath();
    c.arc(x, y, r * 0.7, 0, TAU);
    c.fill();
  }

  private drawBow(
    x: number,
    y: number,
    angle: number,
    pull: number,
    size: number,
    color: Rgb,
    glow: boolean,
  ): void {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.lineCap = 'round';
    const belly = size * (0.62 - pull * 0.18);
    const limb = (width: number, style: string) => {
      c.strokeStyle = style;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(0, -size);
      c.quadraticCurveTo(belly, 0, 0, size);
      c.stroke();
    };
    if (glow) limb(size * 0.42, rgba(color, 0.25));
    limb(size * 0.17, rgba(shade(color, -0.45), 0.9));
    limb(size * 0.1, rgba(color, 0.95));
    c.strokeStyle = 'rgba(255,250,235,.85)';
    c.lineWidth = Math.max(0.7, size * 0.035);
    c.beginPath();
    c.moveTo(0, -size);
    c.lineTo(-pull * size * 0.75, 0);
    c.lineTo(0, size);
    c.stroke();
    c.restore();
  }

  /** A painted arrow whose tip is at (x, y). Returns false if the art is not loaded yet. */
  private drawPaintedArrow(
    key: string,
    x: number,
    y: number,
    angle: number,
    length: number,
    dpr: number,
    alpha = 1,
  ): boolean {
    const info = this.art.info(key);
    if (!info) return false;
    const thickness = (length * info.height) / info.width;
    const image = this.art.get(key, thickness * dpr * 1.5);
    if (!image) return false;
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    c.rotate(angle);
    c.drawImage(image, -length, -thickness / 2, length, thickness);
    c.restore();
    return true;
  }

  private drawArrow(
    x: number,
    y: number,
    angle: number,
    length: number,
    shaft: string,
    tip: string,
    s: number,
    alpha = 1,
  ): void {
    const c = this.ctx;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tx = x - cos * length;
    const ty = y - sin * length;
    c.globalAlpha = alpha;
    c.lineCap = 'round';
    c.strokeStyle = shaft;
    c.lineWidth = 1.7 * s;
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(x, y);
    c.stroke();
    c.fillStyle = tip;
    c.beginPath();
    c.moveTo(x + cos * 5 * s, y + sin * 5 * s);
    c.lineTo(x - cos * 3 * s - sin * 2.6 * s, y - sin * 3 * s + cos * 2.6 * s);
    c.lineTo(x - cos * 3 * s + sin * 2.6 * s, y - sin * 3 * s - cos * 2.6 * s);
    c.fill();
    c.strokeStyle = tip;
    c.lineWidth = 1.2 * s;
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(tx - cos * 4 * s - sin * 3 * s, ty - sin * 4 * s + cos * 3 * s);
    c.moveTo(tx, ty);
    c.lineTo(tx - cos * 4 * s + sin * 3 * s, ty - sin * 4 * s - cos * 3 * s);
    c.stroke();
    c.globalAlpha = 1;
  }

  /** A tapering brush-stroke trail behind an arrow. */
  private drawTrail(trail: number[], color: Rgb, width: number, alpha: number, s: number): void {
    const c = this.ctx;
    const n = trail.length / 2;
    if (n < 2) return;
    c.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const x0 = trail[i * 2 - 2] as number;
      const y0 = trail[i * 2 - 1] as number;
      const x1 = trail[i * 2] as number;
      const y1 = trail[i * 2 + 1] as number;
      c.strokeStyle = rgba(color, alpha * f * f);
      c.lineWidth = width * f;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      if (i % 2) {
        c.strokeStyle = rgba(color, alpha * f * 0.5);
        c.lineWidth = width * f * 0.4;
        c.beginPath();
        c.moveTo(x0 + 2 * s, y0 - 2.5 * s);
        c.lineTo(x1 + 2 * s, y1 - 2.5 * s);
        c.stroke();
      }
    }
  }

  private drawBirds(game: Game): void {
    const c = this.ctx;
    const s = game.layout.scale;
    c.strokeStyle = rgba(INK, 0.6);
    c.lineWidth = 1.3 * s;
    c.lineCap = 'round';
    for (const b of game.weather.birds) {
      const flap = Math.sin(game.time * 7 + b.phase) * 4 * b.size * s;
      c.beginPath();
      c.moveTo(b.x - 6 * b.size * s, b.y - flap);
      c.quadraticCurveTo(b.x - 2 * s, b.y - s, b.x, b.y + s);
      c.quadraticCurveTo(b.x + 2 * s, b.y - s, b.x + 6 * b.size * s, b.y - flap);
      c.stroke();
    }
  }

  private drawWaterShimmer(game: Game, realm: Realm): void {
    const c = this.ctx;
    const L = game.layout;
    const s = L.scale;
    const shore = shoreline(L);
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y = shore + 10 * s + (L.height - shore - 14 * s) * ((i * 0.618) % 1);
      const x = ((i * 137 + game.time * (8 + (i % 3) * 5)) % (L.width + 120)) - 60;
      const w = (20 + (i % 4) * 12) * s;
      c.strokeStyle = rgba(realm.orb, 0.16 + 0.1 * Math.sin(game.time * 2 + i));
      c.lineWidth = 1.6 * s;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w, y);
      c.stroke();
    }
  }

  private drawDecals(game: Game): void {
    const c = this.ctx;
    const s = game.layout.scale;
    for (const d of game.decals) {
      const size = 96 * s * d.scale * (0.55 + 0.5 * Math.min(1, d.age * 6));
      c.globalAlpha = (1 - d.age / DECAL_LIFE) * 0.85;
      c.save();
      c.translate(d.x, d.y);
      c.rotate(d.rotation);
      c.drawImage(this.sprites.splat(d.accent), -size / 2, -size / 2, size, size);
      c.restore();
    }
    c.globalAlpha = 1;
  }

  private drawHero(game: Game): void {
    if (!this.drawPaintedHero(game)) this.drawCodeHero(game);
    this.drawHeroOverlays(game);
  }

  /** The painted hero: planted legs, and an upper body that turns to follow the aim. */
  private drawPaintedHero(game: Game): boolean {
    const L = game.layout;
    const run = game.run;
    const upper = this.art.get('hero-upper', heroFrame(L).height * L.dpr);
    const lower = this.art.get('hero-lower', heroFrame(L).height * L.dpr);
    const info = this.art.info('hero');
    if (!upper || !lower || !info) return false;
    const c = this.ctx;
    const s = L.scale;
    const f = heroFrame(L);
    const breathe = Math.sin(game.time * 2) * 0.8 * s;
    const shot = currentShot(game);
    const aim = shot ? shot.angle : -0.04 + Math.sin(game.time * 1.1) * 0.03;
    const turn = heroTurn(aim);
    const recoil = Math.min(0, run.drawAmount) * 40 * s;
    const hurt = run.hurtTime > 0 && game.phase === 'play' ? clamp(run.hurtTime / 0.35, 0, 1) : 0;
    const hurtTint = hurt > 0 ? this.art.get('hero-lower', f.height * L.dpr, '#ff5a4a') : null;

    // Soft shadow on the platform
    c.fillStyle = rgba(INK, 0.3);
    c.beginPath();
    c.ellipse(L.archerX, f.top + f.height, f.width * 0.42, 5 * s, 0, 0, TAU);
    c.fill();

    c.drawImage(lower, f.left, f.top, f.width, f.height);
    if (hurtTint) {
      c.globalAlpha = hurt * 0.55;
      c.drawImage(hurtTint, f.left, f.top, f.width, f.height);
      c.globalAlpha = 1;
    }

    c.save();
    c.translate(f.pivotX, f.pivotY + breathe);
    c.rotate(turn);
    c.translate(recoil, 0);
    const ox = f.left - f.pivotX;
    const oy = f.top - f.pivotY;
    c.drawImage(upper, ox, oy, f.width, f.height);
    if (hurt > 0) {
      const tint = this.art.get('hero-upper', f.height * L.dpr, '#ff5a4a');
      if (tint) {
        c.globalAlpha = hurt * 0.55;
        c.drawImage(tint, ox, oy, f.width, f.height);
        c.globalAlpha = 1;
      }
    }
    c.restore();

    // Glows at the arrow tip: spirit arrow loaded, power shot charged.
    const tip = heroArrowTip(L, aim);
    if (run.reloadTimer <= 0.06 && game.phase === 'play') {
      if (run.selectedSpirit) this.glowDot(tip.x, tip.y, 5 * s, SPIRIT_ARROWS[run.selectedSpirit].color, 0.9);
      if (run.charge >= BALANCE.shot.powerShotHold) {
        this.glowDot(tip.x, tip.y, (6 + Math.sin(game.time * 18) * 1.5) * s, [255, 240, 170], 1);
      }
    }
    const spirit = run.spirit / 100;
    if (spirit > 0.05 && game.phase === 'play') {
      this.glowDot(tip.x - 24 * s, tip.y + 4 * s, (5 + spirit * 9) * s, [255, 222, 140], 0.12 + spirit * 0.4);
    }
    return true;
  }

  /** Fallback hero drawn in code, used until the painted art has loaded. */
  private drawCodeHero(game: Game): void {
    const c = this.ctx;
    const L = game.layout;
    const run = game.run;
    const s = L.scale;
    const { archerX: ax, archerY: ay } = L;
    const footY = L.groundY - L.platformHeight;
    const bob = Math.sin(game.time * 2) * 1.2 * s;
    const shot = currentShot(game);
    const angle = shot ? shot.angle : -0.22 + Math.sin(game.time * 1.1) * 0.04;
    const pull = clamp(run.drawAmount, 0, 1);
    const tier = bowTierIndex(game.save.kills);
    const bowColor = hexToRgb(BOW_TIERS[tier]?.color ?? '#8a5a34');

    // Cloak rippling in the wind
    const sx = ax - 5 * s;
    const sy = footY - 52 * s + bob;
    const upper: Point[] = [];
    const lower: Point[] = [];
    for (let i = 0; i <= 7; i++) {
      const f = i / 7;
      const wave =
        Math.sin(game.time * 3.2 - i * 0.75) * f * 7 * s + Math.sin(game.time * 5.1 - i * 1.3) * f * 2 * s;
      const x = sx - f * 40 * s;
      const y = sy + f * f * 30 * s + wave;
      upper.push([x, y - f * 9 * s]);
      lower.unshift([x + 2 * s, y + (6 + f * 12) * s]);
    }
    c.fillStyle = rgba(HERO_COLORS.cloak, 0.82);
    tracePolygon(c, upper.concat(lower));
    c.fill();
    c.fillStyle = rgba(shade(HERO_COLORS.cloak, -0.35), 0.4);
    tracePolygon(c, upper.slice(2).concat(lower.slice(0, -2).map((q): Point => [q[0], q[1] - 4 * s])));
    c.fill();
    c.strokeStyle = rgba(shade(HERO_COLORS.cloak, 0.4), 0.6);
    c.lineWidth = 1.2 * s;
    c.beginPath();
    upper.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
    c.stroke();

    this.drawSprite(this.sprites.heroSprite(), ax, footY + bob * 0.4, 1, s);
    if (run.frost > 0 && game.phase === 'play') {
      c.fillStyle = 'rgba(170,230,255,.22)';
      c.beginPath();
      c.ellipse(ax, ay, 20 * s, 40 * s, 0, 0, TAU);
      c.fill();
    }

    const bx = ax + Math.cos(angle) * 15 * s;
    const by = ay + bob + Math.sin(angle) * 15 * s;
    const size = 25 * s;
    const spirit = run.spirit / 100;
    if (spirit > 0.05 && game.phase === 'play')
      this.glowDot(bx, by, (5 + spirit * 9) * s, [255, 222, 140], 0.15 + spirit * 0.5);
    c.strokeStyle = rgba(HERO_COLORS.skin, 1);
    c.lineWidth = 3.2 * s;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(ax + 3 * s, ay - 9 * s + bob);
    c.lineTo(bx, by);
    c.stroke();
    this.drawBow(bx, by, angle, pull, size, bowColor, tier > 0);
    const hx = bx - Math.cos(angle) * pull * size * 0.75;
    const hy = by - Math.sin(angle) * pull * size * 0.75;
    c.strokeStyle = rgba(HERO_COLORS.skin, 1);
    c.lineWidth = 3 * s;
    c.beginPath();
    c.moveTo(ax - 2 * s, ay - 9 * s + bob);
    c.lineTo(hx, hy);
    c.stroke();

    if (run.reloadTimer <= 0.06 && game.phase !== 'over') {
      const tx = hx + Math.cos(angle) * 27 * s;
      const ty = hy + Math.sin(angle) * 27 * s;
      this.drawArrow(tx, ty, angle, 27 * s, '#f6ecd2', rgba(bowColor, 1), s);
      if (run.selectedSpirit && game.phase === 'play')
        this.glowDot(tx, ty, 5 * s, SPIRIT_ARROWS[run.selectedSpirit].color, 0.9);
      if (run.charge >= BALANCE.shot.powerShotHold)
        this.glowDot(tx, ty, (6 + Math.sin(game.time * 18) * 1.5) * s, [255, 240, 170], 1);
    }
  }

  /** Shield bubble and trajectory preview, drawn over either hero. */
  private drawHeroOverlays(game: Game): void {
    const c = this.ctx;
    const L = game.layout;
    const run = game.run;
    const s = L.scale;
    const shot = currentShot(game);
    const shield = shieldShape(L);
    if (run.frost > 0 && game.phase === 'play') {
      c.fillStyle = 'rgba(170,230,255,.2)';
      c.beginPath();
      c.ellipse(shield.cx, shield.cy, shield.rx * 0.6, shield.ry * 0.85, 0, 0, TAU);
      c.fill();
    }
    if (run.shieldTime > 0 && game.phase === 'play') {
      const fade = clamp(run.shieldTime / 0.3, 0, 1);
      const pulse = Math.sin(game.time * 20) * 1.5 * s;
      c.strokeStyle = `rgba(170,225,255,${0.75 * fade})`;
      c.lineWidth = 3 * s;
      c.beginPath();
      c.ellipse(shield.cx, shield.cy, shield.rx + pulse, shield.ry + pulse, 0, 0, TAU);
      c.stroke();
      c.fillStyle = `rgba(170,225,255,${0.16 * fade})`;
      c.fill();
      if (run.shieldAge < BALANCE.player.deflectWindow) {
        c.strokeStyle = `rgba(255,240,180,${0.9 * fade})`;
        c.lineWidth = 2 * s;
        c.beginPath();
        c.ellipse(shield.cx, shield.cy, shield.rx + pulse + 5 * s, shield.ry + pulse + 5 * s, 0, 0, TAU);
        c.stroke();
      }
    }

    // Dotted trajectory preview
    const aim = game.aim;
    if (shot && aim && game.phase === 'play') {
      const v = (BALANCE.shot.minSpeed + BALANCE.shot.speedRange * shot.power) * s;
      const vx = Math.cos(shot.angle) * v;
      const vy = Math.sin(shot.angle) * v;
      const origin = heroArrowTip(L, shot.angle);
      const ox = origin.x;
      const oy = origin.y;
      for (let i = 1; i <= 18; i++) {
        const t = i * 0.042;
        const x = ox + vx * t;
        const y = oy + vy * t + 0.5 * BALANCE.shot.gravity * s * t * t;
        if (y > L.groundY) break;
        const f = 1 - i / 19;
        c.fillStyle = `rgba(255,250,230,${0.85 * f})`;
        c.beginPath();
        c.arc(x, y, (1.2 + 2.4 * f) * s, 0, TAU);
        c.fill();
      }
      c.strokeStyle = 'rgba(255,250,230,.35)';
      c.lineWidth = 1.5 * s;
      c.setLineDash([4 * s, 5 * s]);
      c.beginPath();
      c.moveTo(aim.startX, aim.startY);
      c.lineTo(aim.x, aim.y);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(255,250,230,.3)';
      c.beginPath();
      c.arc(aim.x, aim.y, 9 * s, 0, TAU);
      c.fill();
    }
  }

  private drawEnemy(game: Game, e: Enemy): void {
    if (!this.drawPaintedEnemy(game, e)) this.drawCodeEnemy(game, e);
  }

  /** A painted enemy, brought to life with sway, lunges, recoil and hit flashes. */
  private drawPaintedEnemy(game: Game, e: Enemy): boolean {
    const L = game.layout;
    const s = L.scale;
    const key = enemyArtKey(e, game.run.realm);
    const info = this.art.info(key);
    const height = enemyArtHeight(e, s);
    const image = this.art.get(key, height * L.dpr);
    if (!info || !image) return false;
    const c = this.ctx;
    const k = e.scale * s;
    const width = (height * info.width) / info.height;
    const accent = hexToRgb(e.accent);
    const moving = e.state === 'walk';

    let bob = 0;
    let tilt = 0;
    let stretch = 1;
    if (e.kind === 'walker' || moving) {
      bob = Math.abs(Math.sin(e.walkPhase)) * 3 * k;
      tilt = Math.sin(e.walkPhase) * 0.035;
    } else if (e.kind === 'rider') {
      tilt = Math.sin(e.age * 2 + e.bobPhase) * 0.05;
      stretch = 1 + Math.sin(e.age * 9) * 0.03;
    } else {
      stretch = 1 + Math.sin(e.age * 2 + e.bobPhase) * 0.012;
      // Lean back while drawing the bow.
      if (e.state === 'aim') tilt = 0.05 * (1 - e.aimRemaining / e.aimDuration);
    }
    let lungeX = 0;
    if (e.lunge > 0) {
      const p = Math.sin((e.lunge / 0.25) * Math.PI);
      lungeX = -10 * k * p;
      tilt -= 0.14 * p;
    }
    const x = e.x + e.knockback + lungeX;

    c.globalAlpha = e.appear;
    if (e.kind !== 'rider') {
      c.fillStyle = rgba(INK, 0.28);
      c.beginPath();
      c.ellipse(e.x, e.y, width * 0.3, 4 * k, 0, 0, TAU);
      c.fill();
    }
    c.save();
    c.translate(x, e.y - bob);
    c.rotate(tilt);
    c.scale(1, stretch);
    c.drawImage(image, -info.anchorX * width, -height, width, height);
    if (e.flash > 0) {
      const white = this.art.get(key, height * L.dpr, '#ffffff');
      if (white) {
        c.globalAlpha = Math.min(1, e.flash * 4) * e.appear;
        c.drawImage(white, -info.anchorX * width, -height, width, height);
      }
    }
    c.restore();
    c.globalAlpha = 1;

    if (e.state === 'aim' && e.kind !== 'walker') {
      // Telegraph at the painted bow hand: a shrinking ring and a dashed line to the archer.
      const hand = bowHand(e, s);
      const f = e.aimRemaining / e.aimDuration;
      const toArcher = Math.atan2(L.archerY - hand.y, L.archerX - hand.x);
      c.strokeStyle = rgba(accent, 0.9 * (1 - f * 0.5));
      c.lineWidth = 2.4 * s;
      c.beginPath();
      c.arc(hand.x, hand.y, lerp(7, 30, f) * k, 0, TAU);
      c.stroke();
      this.glowDot(hand.x, hand.y, (3 + 4 * (1 - f)) * s, accent, 0.9);
      c.strokeStyle = rgba(accent, 0.5 * (1 - f));
      c.lineWidth = 1.4 * s;
      c.setLineDash([3 * s, 6 * s]);
      c.beginPath();
      c.moveTo(hand.x, hand.y);
      c.lineTo(
        hand.x + Math.cos(toArcher) * (1 - f) * 70 * s,
        hand.y + Math.sin(toArcher) * (1 - f) * 70 * s,
      );
      c.stroke();
      c.setLineDash([]);
    }

    if (e.hp < e.maxHp && e.kind !== 'boss') {
      const w = 26 * k;
      const fill = clamp(e.hp / e.maxHp, 0, 1);
      const barY = e.y - height - 6 * k;
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(20,14,40,.55)';
      c.lineWidth = 3.4 * s;
      c.beginPath();
      c.moveTo(e.x - w / 2, barY);
      c.lineTo(e.x + w / 2, barY);
      c.stroke();
      c.strokeStyle = rgba(accent, 1);
      c.lineWidth = 2 * s;
      c.beginPath();
      c.moveTo(e.x - w / 2, barY);
      c.lineTo(e.x - w / 2 + w * fill, barY);
      c.stroke();
    }
    return true;
  }

  /** Fallback enemy drawn in code, used until the painted art has loaded. */
  private drawCodeEnemy(game: Game, e: Enemy): void {
    const c = this.ctx;
    const L = game.layout;
    const s = L.scale;
    const k = e.scale * s;
    const accent = hexToRgb(e.accent);
    const bob =
      e.kind === 'walker' ? Math.abs(Math.sin(e.walkPhase)) * 2 * k : Math.sin(e.age * 2 + e.bobPhase) * k;
    const x = e.x + e.knockback;
    const y = e.y - bob;
    c.globalAlpha = e.appear;

    if (e.kind === 'walker') {
      const swing = e.state === 'walk' ? Math.sin(e.walkPhase) : 0;
      const hip = y - e.height * 0.38 * k;
      c.strokeStyle = rgba(INK, 0.92);
      c.lineWidth = 4 * k;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - 2 * k, hip);
      c.lineTo(x - 2 * k + swing * 7 * k, e.y);
      c.moveTo(x + 2 * k, hip);
      c.lineTo(x + 2 * k - swing * 7 * k, e.y);
      c.stroke();
    }
    if (e.kind === 'rider') {
      const flap = Math.sin(e.age * 9) * 0.7;
      c.fillStyle = rgba(INK, 0.78);
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(x + 2 * k, y - 4 * k);
        const tipY =
          y -
          (4 + 26 * flap * side * (side > 0 ? 1 : 0.8) + (side > 0 ? 10 : 14)) * k * (flap > 0 ? 1 : 0.45) -
          6 * k;
        c.lineTo(x + (6 + side * 4) * k, tipY);
        c.lineTo(x + 22 * k, y - 2 * k);
        c.fill();
      }
    }
    const lunge = e.lunge > 0 ? -8 * k * Math.sin((e.lunge / 0.25) * Math.PI) : 0;
    this.drawSprite(this.sprites.enemySprite(e.body, e.accent), x + lunge, y, e.scale, s, e.appear);
    if (e.flash > 0) {
      c.globalAlpha = e.flash * 4;
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(x, y - e.height * 0.5 * k, (e.bodyWidth + 6) * k, e.height * 0.5 * k, 0, 0, TAU);
      c.fill();
    }
    c.globalAlpha = e.appear;

    if (e.kind === 'walker') {
      const hx = x - (e.bodyWidth + 2) * k + lunge;
      const hy = y - e.height * 0.5 * k;
      c.lineCap = 'round';
      if (e.type === 'giant') {
        c.strokeStyle = rgba(INK, 0.95);
        c.lineWidth = 5 * k;
        c.beginPath();
        c.moveTo(hx, hy);
        c.lineTo(hx - 12 * k, hy - 20 * k + lunge);
        c.stroke();
        c.fillStyle = rgba(accent, 0.9);
        c.beginPath();
        c.arc(hx - 13 * k, hy - 22 * k + lunge, 5 * k, 0, TAU);
        c.fill();
      } else if (e.type !== 'brute') {
        c.strokeStyle = 'rgba(235,240,250,.95)';
        c.lineWidth = 2 * k;
        c.beginPath();
        c.moveTo(hx, hy);
        c.lineTo(hx - 13 * k, hy - 13 * k - lunge);
        c.stroke();
      }
    } else {
      const bx = x - 10 * k;
      const by = y - e.height * 0.6 * k;
      const toArcher = Math.atan2(L.archerY - by, L.archerX - bx);
      const drawn = e.state === 'aim' ? 1 - e.aimRemaining / e.aimDuration : 0;
      this.drawBow(
        bx,
        by,
        toArcher - (e.kind === 'boss' ? 0.25 : 0.35),
        drawn,
        (e.kind === 'boss' ? 17 : 13) * k,
        accent,
        false,
      );
      if (e.state === 'aim') {
        // Telegraph: a shrinking ring and a dashed line towards the archer.
        const f = e.aimRemaining / e.aimDuration;
        c.strokeStyle = rgba(accent, 0.9 * (1 - f * 0.5));
        c.lineWidth = 2.4 * s;
        c.beginPath();
        c.arc(bx, by, lerp(7, 30, f) * k, 0, TAU);
        c.stroke();
        this.glowDot(bx, by, (3 + 4 * (1 - f)) * s, accent, 0.9);
        c.strokeStyle = rgba(accent, 0.5 * (1 - f));
        c.lineWidth = 1.4 * s;
        c.setLineDash([3 * s, 6 * s]);
        c.beginPath();
        c.moveTo(bx, by);
        c.lineTo(bx + Math.cos(toArcher) * (1 - f) * 70 * s, by + Math.sin(toArcher) * (1 - f) * 70 * s);
        c.stroke();
        c.setLineDash([]);
      }
    }

    if (e.hp < e.maxHp && e.kind !== 'boss') {
      const w = 24 * k;
      const f = clamp(e.hp / e.maxHp, 0, 1);
      const barY = y - (e.height + 10) * k;
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(20,14,40,.55)';
      c.lineWidth = 3.4 * s;
      c.beginPath();
      c.moveTo(x - w / 2, barY);
      c.lineTo(x + w / 2, barY);
      c.stroke();
      c.strokeStyle = rgba(accent, 1);
      c.lineWidth = 2 * s;
      c.beginPath();
      c.moveTo(x - w / 2, barY);
      c.lineTo(x - w / 2 + w * f, barY);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  private drawLantern(game: Game): void {
    const lantern = game.lantern;
    if (!lantern) return;
    const c = this.ctx;
    const s = game.layout.scale;
    const flap = Math.sin(game.time * 14);
    this.glowDot(lantern.x, lantern.y, 9 * s, [255, 215, 110], 0.95);
    c.fillStyle = 'rgba(255,244,210,.85)';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(
        lantern.x + side * 7 * s,
        lantern.y - (4 + flap * 3) * s,
        7 * s,
        3 * s,
        side * (0.5 + flap * 0.25),
        0,
        TAU,
      );
      c.fill();
    }
  }

  private drawPlayerArrows(game: Game): void {
    const s = game.layout.scale;
    for (const a of game.arrows) {
      const angle = Math.atan2(a.vy, a.vx);
      const tint: Rgb | null = a.special
        ? SPIRIT_ARROWS[a.special].color
        : a.powerShot
          ? [255, 236, 150]
          : null;
      const bright = a.guided || tint !== null;
      // The trail starts behind the painted arrow, so the shaft and feathers stay visible.
      if (a.stuck === null)
        this.drawTrail(
          trailBehind(a.trail, a.x, a.y, 44 * s),
          tint ?? (a.guided ? [255, 225, 140] : [255, 248, 225]),
          (bright ? 7 : 3.5) * s,
          bright ? 0.85 : 0.4,
          s,
        );
      if (a.guided) this.glowDot(a.x, a.y, 5 * s, [255, 220, 130], 0.9);
      if (tint && a.stuck === null) this.glowDot(a.x, a.y, 4.5 * s, tint, 0.9);
      const fade = a.stuck === null ? 1 : clamp(a.stuck, 0, 1);
      if (!this.drawPaintedArrow('arrow-player', a.x, a.y, angle, 52 * s, game.layout.dpr, fade)) {
        this.drawArrow(a.x, a.y, angle, 24 * s, '#f6ecd2', a.guided ? '#ffd76a' : '#e8b84a', s, fade);
      }
    }
  }

  private drawEnemyArrows(game: Game): void {
    const L = game.layout;
    const s = L.scale;
    for (const a of game.enemyArrows) {
      const angle = Math.atan2(a.vy, a.vx);
      const hex = ARROW_TYPES[a.type].color;
      const color = hexToRgb(hex);
      // Shadow arrows are nearly invisible until close.
      const alpha = a.type === 'shadow' && Math.hypot(a.x - L.archerX, a.y - L.archerY) >= 150 * s ? 0.16 : 1;
      const trail = a.type === 'homing' ? a.trail : trailBehind(a.trail, a.x, a.y, 36 * s);
      this.drawTrail(trail, color, (a.type === 'homing' ? 6 : 4) * s, 0.7 * alpha, s);
      if (a.type !== 'shadow' || alpha === 1) {
        this.glowDot(
          a.x,
          a.y,
          (a.type === 'boom' ? 6 : a.type === 'homing' ? 5.5 : 3.6) * s,
          color,
          0.85 * alpha,
        );
      }
      if (
        a.type !== 'homing' &&
        !this.drawPaintedArrow('arrow-enemy', a.x, a.y, angle, 44 * s, L.dpr, alpha)
      ) {
        this.drawArrow(a.x, a.y, angle, 20 * s, rgba(INK, 0.9), hex, s, alpha);
      }
    }
  }

  private drawParticles(game: Game): void {
    const c = this.ctx;
    const s = game.layout.scale;
    for (const p of game.particles) {
      const f = 1 - p.age / p.life;
      switch (p.kind) {
        case 'bolt':
          c.lineCap = 'round';
          c.lineJoin = 'round';
          for (const [w, style] of [
            [7, `rgba(140,190,255,${f * 0.45})`],
            [2.4, `rgba(240,250,255,${f})`],
          ] as const) {
            c.strokeStyle = style;
            c.lineWidth = w * s;
            c.beginPath();
            for (let i = 0; i < p.points.length; i += 2) {
              const px = p.points[i] as number;
              const py = p.points[i + 1] as number;
              if (i) c.lineTo(px, py);
              else c.moveTo(px, py);
            }
            c.stroke();
          }
          break;
        case 'ring':
          c.strokeStyle = rgba(p.color, f * 0.8);
          c.lineWidth = 5 * s * f;
          c.beginPath();
          c.arc(p.x, p.y, p.size * (1 - f * f), 0, TAU);
          c.stroke();
          break;
        case 'wisp':
          this.glowDot(p.x, p.y, p.size, p.color, Math.min(1, f * 2));
          break;
        case 'petal':
          c.fillStyle = rgba(p.color, f * 0.85);
          c.beginPath();
          c.ellipse(p.x, p.y, p.size, p.size * 0.45, p.rotation, 0, TAU);
          c.fill();
          break;
        case 'dot':
          c.fillStyle = rgba(p.color, f * 0.8);
          c.beginPath();
          c.arc(p.x, p.y, p.size * 0.5, 0, TAU);
          c.fill();
          break;
      }
    }
  }

  private drawTexts(game: Game): void {
    const c = this.ctx;
    const s = game.layout.scale;
    c.textAlign = 'center';
    for (const t of game.texts) {
      const f = 1 - t.age / TEXT_LIFE;
      c.globalAlpha = Math.min(1, f * 2.2);
      c.font = `${t.size * (1 + 0.25 * Math.max(0, 1 - t.age * 8))}px ${BRUSH_FONT}`;
      c.lineWidth = 3 * s;
      c.strokeStyle = 'rgba(26,20,46,.7)';
      c.strokeText(t.text, t.x, t.y);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
  }

  private drawForegroundGrass(game: Game, realm: Realm): void {
    const c = this.ctx;
    const L = game.layout;
    const s = L.scale;
    c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const nearGround = i % 3 === 0;
      const gx = (((i * 71) % 100) / 100) * L.width;
      const gy = nearGround ? L.groundY + 2 : L.height + 2;
      const height = (nearGround ? 12 : 44 + (i % 5) * 9) * s;
      const sway = Math.sin(game.time * 1.6 + i) * height * 0.22;
      c.strokeStyle = rgba(nearGround ? realm.grass : realm.groundDark, nearGround ? 0.8 : 0.9);
      c.lineWidth = (nearGround ? 1.3 : 2.2) * s;
      for (let j = -1; j <= 1; j++) {
        c.beginPath();
        c.moveTo(gx + j * 3 * s, gy);
        c.quadraticCurveTo(
          gx + j * 5 * s,
          gy - height * 0.6,
          gx + j * 8 * s + sway,
          gy - height * (1 - 0.12 * Math.abs(j)),
        );
        c.stroke();
      }
    }
  }

  private drawWeather(game: Game, realm: Realm): void {
    const c = this.ctx;
    const s = game.layout.scale;
    const kind = game.weather.kind;
    for (const d of game.weather.drops) {
      if (kind === 'rain') {
        c.strokeStyle = 'rgba(220,235,245,.3)';
        c.lineWidth = s;
        c.beginPath();
        c.moveTo(d.x, d.y);
        c.lineTo(d.x - 4 * s, d.y + 16 * d.size * s);
        c.stroke();
      } else if (kind === 'snow') {
        c.fillStyle = `rgba(255,255,255,${0.55 + 0.3 * Math.sin(d.phase)})`;
        c.beginPath();
        c.arc(d.x, d.y, 1.6 * d.size * s, 0, TAU);
        c.fill();
      } else if (kind === 'leaf') {
        c.fillStyle = rgba(d.phase > 3 ? realm.tree : realm.grass, 0.8);
        c.beginPath();
        c.ellipse(d.x, d.y, 3.4 * d.size * s, 1.5 * d.size * s, game.time * 2 + d.phase, 0, TAU);
        c.fill();
      } else {
        this.glowDot(
          d.x,
          d.y,
          1.2 * d.size * s,
          kind === 'ember' ? [255, 190, 110] : realm.grass,
          0.45 + 0.3 * Math.sin(game.time * 3 + d.phase),
        );
      }
    }
  }
}
