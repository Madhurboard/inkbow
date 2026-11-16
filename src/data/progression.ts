/** Bow tiers, the skill tree, bosses and spirit arrows. */
import { type Rgb } from '../core/color';
import type { ArrowTypeId, SpiritArrowId } from '../state/types';

export interface BowTier {
  name: string;
  killsRequired: number;
  color: string;
  damageMultiplier: number;
}

export const BOW_TIERS: readonly BowTier[] = [
  { name: 'Ashwood Bow', killsRequired: 0, color: '#8a5a34', damageMultiplier: 1 },
  { name: 'Moonsteel Bow', killsRequired: 40, color: '#bfe6f5', damageMultiplier: 1.2 },
  { name: 'Starforged Bow', killsRequired: 150, color: '#ffd76a', damageMultiplier: 1.45 },
];

export type SkillBranch = 'offense' | 'defense' | 'spirit';
export type SkillId =
  | 'sharpenedTips'
  | 'hawkEye'
  | 'quickHands'
  | 'openingVolley'
  | 'toughHide'
  | 'swiftAegis'
  | 'mending'
  | 'secondWind'
  | 'deepWell'
  | 'kindled'
  | 'deftMagic'
  | 'twinStars';

export interface SkillDef {
  id: SkillId;
  branch: SkillBranch;
  name: string;
  description: string;
  /** Ink cost of each level, in order. Its length is the max level. */
  costs: readonly number[];
}

/** Within a branch, each skill needs the one before it at level 1 or more. */
export const SKILLS: readonly SkillDef[] = [
  {
    id: 'sharpenedTips',
    branch: 'offense',
    name: 'Sharpened Tips',
    description: '+8% arrow damage',
    costs: [20, 45, 80],
  },
  {
    id: 'hawkEye',
    branch: 'offense',
    name: 'Hawk Eye',
    description: 'Headshots hit harder',
    costs: [25, 50, 90],
  },
  {
    id: 'quickHands',
    branch: 'offense',
    name: 'Quick Hands',
    description: 'Nock arrows 7% faster',
    costs: [25, 50, 90],
  },
  {
    id: 'openingVolley',
    branch: 'offense',
    name: 'Opening Volley',
    description: 'Begin every run with Twin Shot',
    costs: [160],
  },
  {
    id: 'toughHide',
    branch: 'defense',
    name: 'Tough Hide',
    description: '+15 max health',
    costs: [20, 45, 80],
  },
  {
    id: 'swiftAegis',
    branch: 'defense',
    name: 'Swift Aegis',
    description: 'Shield recharges 8% faster',
    costs: [25, 50, 90],
  },
  {
    id: 'mending',
    branch: 'defense',
    name: 'Mending',
    description: 'Heal more between waves',
    costs: [25, 50, 90],
  },
  {
    id: 'secondWind',
    branch: 'defense',
    name: 'Second Wind',
    description: 'Rise once from defeat each run',
    costs: [160],
  },
  {
    id: 'deepWell',
    branch: 'spirit',
    name: 'Deep Well',
    description: '+12% spirit from kills',
    costs: [20, 45, 80],
  },
  {
    id: 'kindled',
    branch: 'spirit',
    name: 'Kindled',
    description: 'Begin each run with 25 spirit',
    costs: [25, 50, 90],
  },
  {
    id: 'deftMagic',
    branch: 'spirit',
    name: 'Deft Magic',
    description: 'Spirit arrows cost 3 less',
    costs: [25, 50, 90],
  },
  {
    id: 'twinStars',
    branch: 'spirit',
    name: 'Twin Stars',
    description: 'Starfall strikes twice',
    costs: [160],
  },
];

export const SKILL_BRANCHES: readonly { id: SkillBranch; name: string }[] = [
  { id: 'offense', name: 'Offense' },
  { id: 'defense', name: 'Defense' },
  { id: 'spirit', name: 'Spirit' },
];

/** Skill ids used by saves from before v2. */
export const LEGACY_SKILL_IDS: Readonly<Record<string, SkillId>> = {
  o1: 'sharpenedTips',
  o2: 'hawkEye',
  o3: 'quickHands',
  o4: 'openingVolley',
  d1: 'toughHide',
  d2: 'swiftAegis',
  d3: 'mending',
  d4: 'secondWind',
  s1: 'deepWell',
  s2: 'kindled',
  s3: 'deftMagic',
  s4: 'twinStars',
};

export interface BossDef {
  name: string;
  color: string;
  /** Volley arrow, enraged volley arrow, and enraged extra arrow. */
  arrows: readonly [ArrowTypeId, ArrowTypeId, ArrowTypeId];
}

/** One boss per realm, in realm order. */
export const BOSSES: readonly BossDef[] = [
  { name: 'The Hollow King', color: '#ff4d6d', arrows: ['normal', 'shadow', 'fire'] },
  { name: 'The Frost Warden', color: '#8fe3ff', arrows: ['ice', 'ice', 'fan'] },
  { name: 'The Ember Stag', color: '#ff7a2e', arrows: ['fire', 'boom', 'fire'] },
  { name: 'The Storm Caller', color: '#ffc531', arrows: ['fan', 'boom', 'homing'] },
  { name: 'The Void Monarch', color: '#a078ff', arrows: ['shadow', 'shadow', 'poison'] },
];

export function bossForRealm(realm: number): BossDef {
  return BOSSES[((realm % BOSSES.length) + BOSSES.length) % BOSSES.length] as BossDef;
}

/** Arrows a boss summons as helpers, before and after half health. */
export const BOSS_SUMMONS: { calm: readonly ArrowTypeId[]; enraged: readonly ArrowTypeId[] } = {
  calm: ['fire', 'poison', 'normal'],
  enraged: ['shadow', 'boom', 'ice', 'homing'],
};

export interface SpiritArrowDef {
  id: SpiritArrowId;
  color: Rgb;
  hint: string;
}

export const SPIRIT_ARROWS: Record<SpiritArrowId, SpiritArrowDef> = {
  ember: { id: 'ember', color: [255, 140, 60], hint: 'Ember arrow: explodes on impact' },
  storm: { id: 'storm', color: [150, 200, 255], hint: 'Storm arrow: lightning leaps between foes' },
  gale: {
    id: 'gale',
    color: [160, 240, 200],
    hint: 'Gale volley: five piercing arrows that push walkers back',
  },
};

export const SPIRIT_ARROW_ORDER: readonly SpiritArrowId[] = ['ember', 'storm', 'gale'];
