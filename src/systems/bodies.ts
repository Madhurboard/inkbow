/**
 * Geometry of the painted characters, shared by hit tests, firing and drawing so that what
 * you see is what you hit. All sizes are in layout units (multiply by `layout.scale`).
 */
import manifest from '../assets/characters/manifest.json';
import { clamp } from '../core/math';
import type { Enemy, Layout } from '../state/types';

/** Painted figure height relative to an enemy's hitbox height (hoods and bows stick out). */
export const ENEMY_ART_SCALE = 1.08;

/** Painted hero height, feet to bow tip. */
export const HERO_HEIGHT = 96;

/** Upper-body rotation limits. Turning further down shows a seam in the cloak. */
export const HERO_TURN_UP = -0.75;
export const HERO_TURN_DOWN = 0.35;

/** Where each kind of enemy holds its bow: x left of centre, y up from the feet, as fractions of art height. */
const BOW_HAND: Record<Enemy['kind'], { x: number; y: number }> = {
  archer: { x: -0.34, y: 0.66 },
  boss: { x: -0.36, y: 0.55 },
  rider: { x: -0.12, y: 0.74 },
  walker: { x: -0.3, y: 0.6 },
};

export function enemyArtHeight(enemy: Enemy, scale: number): number {
  return enemy.height * ENEMY_ART_SCALE * enemy.scale * scale;
}

export function bowHand(enemy: Enemy, scale: number): { x: number; y: number } {
  const h = enemyArtHeight(enemy, scale);
  const hand = BOW_HAND[enemy.kind];
  return { x: enemy.x + hand.x * h, y: enemy.y - hand.y * h };
}

export interface HeroFrame {
  width: number;
  height: number;
  left: number;
  top: number;
  pivotX: number;
  pivotY: number;
}

/** Where the painted hero sits on screen, and the waist pivot the upper body turns around. */
export function heroFrame(layout: Layout): HeroFrame {
  const info = manifest.hero;
  const height = HERO_HEIGHT * layout.scale;
  const width = (height * info.width) / info.height;
  const left = layout.archerX - info.anchorX * width;
  const top = layout.groundY - layout.platformHeight - height;
  return {
    width,
    height,
    left,
    top,
    pivotX: left + (info.pivot[0] ?? 0.5) * width,
    pivotY: top + (info.pivot[1] ?? 0.5) * height,
  };
}

/** How far the upper body turns for a given aim angle. */
export function heroTurn(aimAngle: number): number {
  return clamp(aimAngle, HERO_TURN_UP, HERO_TURN_DOWN);
}

/** The tip of the nocked arrow when aiming at `aimAngle`: where shots leave the bow. */
export function heroArrowTip(layout: Layout, aimAngle: number): { x: number; y: number } {
  const frame = heroFrame(layout);
  const tip = manifest.hero.arrowTip;
  const pivot = manifest.hero.pivot;
  const dx = ((tip[0] ?? 1) - (pivot[0] ?? 0.5)) * frame.width;
  const dy = ((tip[1] ?? 0.3) - (pivot[1] ?? 0.5)) * frame.height;
  const turn = heroTurn(aimAngle);
  return {
    x: frame.pivotX + dx * Math.cos(turn) - dy * Math.sin(turn),
    y: frame.pivotY + dx * Math.sin(turn) + dy * Math.cos(turn),
  };
}

/** Ellipse enemy arrows must enter to hit the archer. */
export function heroHitbox(layout: Layout): { cx: number; cy: number; rx: number; ry: number } {
  const frame = heroFrame(layout);
  return {
    cx: layout.archerX,
    cy: frame.top + frame.height * 0.52,
    rx: 18 * layout.scale,
    ry: frame.height * 0.46,
  };
}

/** The shield bubble: an oval around the whole painted hero, including a raised bow. */
export function shieldShape(layout: Layout): { cx: number; cy: number; rx: number; ry: number } {
  const frame = heroFrame(layout);
  return {
    cx: frame.left + frame.width * 0.5,
    cy: frame.top + frame.height * 0.48,
    rx: frame.width * 0.68,
    ry: frame.height * 0.64,
  };
}

/** Whether a point is inside the shield bubble. */
export function insideShield(layout: Layout, x: number, y: number): boolean {
  const shield = shieldShape(layout);
  return ((x - shield.cx) / shield.rx) ** 2 + ((y - shield.cy) / shield.ry) ** 2 < 1;
}
