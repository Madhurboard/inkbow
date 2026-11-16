/** Enemy archers, their arrows, walkers, and the body sizes used for drawing and hit-testing. */
import type { ArrowTypeId, BodyKey, WalkerTypeId } from '../state/types';

export interface ArrowTypeDef {
  color: string;
  /** Damage to the player before wave scaling. */
  damage: number;
  /** Name of the archer that fires it, shown in the first-sighting hint. */
  archerName: string;
  description: string;
}

export const ARROW_TYPES: Record<ArrowTypeId, ArrowTypeDef> = {
  normal: { color: '#e6dcc6', damage: 8, archerName: 'Bone Archer', description: 'plain arrows' },
  fire: { color: '#ff7a2e', damage: 6, archerName: 'Ember Archer', description: 'burning arrows' },
  poison: { color: '#86d94c', damage: 4, archerName: 'Venom Archer', description: 'poison that lingers' },
  ice: { color: '#8fe3ff', damage: 6, archerName: 'Frost Archer', description: 'chills your draw' },
  boom: { color: '#ffc531', damage: 16, archerName: 'Blast Archer', description: 'arrows that explode' },
  homing: {
    color: '#ff5fd0',
    damage: 10,
    archerName: 'Seeker',
    description: 'arrows that hunt you. Shoot them down',
  },
  fan: { color: '#f4f2ff', damage: 6, archerName: 'Fan Archer', description: 'three arrows at once' },
  shadow: { color: '#a078ff', damage: 11, archerName: 'Shade', description: 'arrows you can barely see' },
};

export const ARROW_TYPE_IDS = Object.keys(ARROW_TYPES) as ArrowTypeId[];

export interface WalkerTypeDef {
  color: string;
  hp: number;
  speed: number;
  damage: number;
  scale: number;
  name: string;
  description: string;
}

export const WALKER_TYPES: Record<WalkerTypeId, WalkerTypeDef> = {
  sword: {
    color: '#ff6a5e',
    hp: 22,
    speed: 34,
    damage: 8,
    scale: 1,
    name: 'Swordsman',
    description: 'marches on your platform',
  },
  sprinter: {
    color: '#ffb347',
    hp: 10,
    speed: 95,
    damage: 6,
    scale: 1,
    name: 'Runner',
    description: 'fast and fragile',
  },
  brute: {
    color: '#cfd8e6',
    hp: 44,
    speed: 22,
    damage: 12,
    scale: 1,
    name: 'Shield Brute',
    description: 'aim for the head or lob over the shield',
  },
  giant: {
    color: '#ff5a3c',
    hp: 130,
    speed: 15,
    damage: 22,
    scale: 1.9,
    name: 'Giant',
    description: 'slow, and very hard to stop',
  },
};

export const WALKER_TYPE_IDS = Object.keys(WALKER_TYPES) as WalkerTypeId[];

export interface BodySize {
  width: number;
  height: number;
  headRadius: number;
}

export const BODY_SIZES: Record<BodyKey, BodySize> = {
  archer: { width: 9, height: 50, headRadius: 5.5 },
  sword: { width: 9, height: 48, headRadius: 5.5 },
  sprinter: { width: 7, height: 46, headRadius: 5 },
  brute: { width: 14, height: 52, headRadius: 6.5 },
  giant: { width: 16, height: 58, headRadius: 7 },
  rider: { width: 8, height: 34, headRadius: 5.5 },
  boss: { width: 15, height: 72, headRadius: 7.5 },
};

/** Arrows a sky rider may carry, before and after wave 4. */
export const RIDER_ARROWS_EARLY: readonly ArrowTypeId[] = ['normal', 'fire'];
export const RIDER_ARROWS: readonly ArrowTypeId[] = ['normal', 'fire', 'ice', 'poison', 'fan', 'boom'];

export function isArrowType(type: string): type is ArrowTypeId {
  return type in ARROW_TYPES;
}

export function isWalkerType(type: string): type is WalkerTypeId {
  return type in WALKER_TYPES;
}
