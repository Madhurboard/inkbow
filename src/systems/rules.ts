/**
 * Pure game rules: no state, no browser, no randomness. Everything here is unit-tested.
 */
import { BALANCE } from '../config';
import { BOW_TIERS, SKILLS, type SkillDef, type SkillId } from '../data/progression';
import { REALM_COUNT } from '../data/realms';
import type { SaveData } from '../state/save';
import type { GameMode, Stats } from '../state/types';

export const WAVES_PER_REALM = 5;

export function bowTierIndex(lifetimeKills: number): number {
  let tier = 0;
  BOW_TIERS.forEach((t, i) => {
    if (lifetimeKills >= t.killsRequired) tier = i;
  });
  return tier;
}

export function bowDamageMultiplier(lifetimeKills: number): number {
  return BOW_TIERS[bowTierIndex(lifetimeKills)]?.damageMultiplier ?? 1;
}

export function skillLevel(save: SaveData, id: SkillId): number {
  return save.skills[id] ?? 0;
}

function skillDef(id: SkillId): SkillDef {
  const def = SKILLS.find((s) => s.id === id);
  if (!def) throw new Error(`Unknown skill ${id}`);
  return def;
}

/** A skill needs the one before it in its branch at level 1 or more. */
export function isSkillLocked(save: SaveData, id: SkillId): boolean {
  const def = skillDef(id);
  const branch = SKILLS.filter((s) => s.branch === def.branch);
  const index = branch.indexOf(def);
  const previous = branch[index - 1];
  return previous !== undefined && skillLevel(save, previous.id) === 0;
}

/** Ink cost of the next level, or null when the skill is maxed. */
export function nextSkillCost(save: SaveData, id: SkillId): number | null {
  return skillDef(id).costs[skillLevel(save, id)] ?? null;
}

export function canBuySkill(save: SaveData, id: SkillId): boolean {
  const cost = nextSkillCost(save, id);
  return cost !== null && !isSkillLocked(save, id) && save.ink >= cost;
}

export function buySkill(save: SaveData, id: SkillId): boolean {
  const cost = nextSkillCost(save, id);
  if (cost === null || !canBuySkill(save, id)) return false;
  save.ink -= cost;
  save.skills[id] = skillLevel(save, id) + 1;
  return true;
}

/** Refund every skill. Returns the ink refunded. */
export function respecSkills(save: SaveData): number {
  let refund = 0;
  for (const def of SKILLS) {
    for (let i = 0; i < skillLevel(save, def.id); i++) refund += def.costs[i] ?? 0;
  }
  save.ink += refund;
  save.skills = {};
  return refund;
}

/** Stats a run starts with, from the skill tree. */
export function baseStats(save: SaveData): Stats {
  const k = BALANCE.skills;
  const p = BALANCE.player;
  const lv = (id: SkillId) => skillLevel(save, id);
  return {
    damage: p.baseDamage * (1 + k.damagePerLevel * lv('sharpenedTips')),
    multishot: 1 + lv('openingVolley'),
    pierce: 0,
    burn: 0,
    critMultiplier: p.baseCrit + k.critPerLevel * lv('hawkEye'),
    reloadTime: p.baseReload * (1 - k.reloadPerLevel * lv('quickHands')),
    lifesteal: 0,
    ricochet: 0,
    shieldCooldown: p.baseShieldCooldown * (1 - k.shieldPerLevel * lv('swiftAegis')),
    spiritGain: 1 + k.spiritGainPerLevel * lv('deepWell'),
  };
}

export function runStartValues(save: SaveData): {
  maxHp: number;
  spirit: number;
  revives: number;
  spiritCost: number;
} {
  const k = BALANCE.skills;
  return {
    maxHp: BALANCE.player.baseHp + k.hpPerLevel * skillLevel(save, 'toughHide'),
    spirit: k.startSpiritPerLevel * skillLevel(save, 'kindled'),
    revives: skillLevel(save, 'secondWind'),
    spiritCost: BALANCE.player.spiritArrowCost - k.spiritCostPerLevel * skillLevel(save, 'deftMagic'),
  };
}

export function waveClearHeal(save: SaveData): number {
  return BALANCE.waves.clearHeal + BALANCE.skills.healPerLevel * skillLevel(save, 'mending');
}

export function comboMultiplier(combo: number): number {
  return Math.min(BALANCE.combo.max, 1 + combo * BALANCE.combo.perHit);
}

/** Enemy damage ramps gently through realm 1, then slowly forever. */
export function enemyDamageMultiplier(wave: number): number {
  return wave < 6 ? 0.6 + wave * 0.07 : 1 + (wave - 5) * 0.04;
}

export function enemyHealthScale(wave: number): number {
  return 1 + (wave - 1) * BALANCE.waves.enemyHpGrowth;
}

export function xpForNextLevel(current: number): number {
  return Math.round(current * BALANCE.xp.growth);
}

/** Most enemies on screen at once. */
export function spawnCap(wave: number): number {
  return Math.min(3 + (wave >> 1), 7);
}

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % WAVES_PER_REALM === 0;
}

export function firstWaveOfRealm(realm: number): number {
  return (realm - 1) * WAVES_PER_REALM + 1;
}

export function starsForHealth(fraction: number): number {
  return fraction >= 0.7 ? 3 : fraction >= 0.35 ? 2 : 1;
}

/**
 * Record a boss kill. Unlocks Endless, and in the campaign stores stars and unlocks the
 * next realm. `won` is true when the last realm's boss falls.
 */
export function recordBossVictory(
  save: SaveData,
  mode: GameMode,
  wave: number,
  hpFraction: number,
): { stars: number; won: boolean } {
  save.endlessUnlocked = true;
  if (mode !== 'campaign') return { stars: 0, won: false };
  const realm = Math.floor(wave / WAVES_PER_REALM);
  const stars = starsForHealth(hpFraction);
  save.stars[realm - 1] = Math.max(save.stars[realm - 1] ?? 0, stars);
  save.unlockedRealms = Math.max(save.unlockedRealms, Math.min(REALM_COUNT, realm + 1));
  return { stars, won: realm >= REALM_COUNT };
}

/** Perk picks granted when starting a campaign at a later realm, to catch up. */
export function catchUpPerks(realm: number): number {
  return (realm - 1) * 3;
}
