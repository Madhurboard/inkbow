import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config';
import { SKILLS } from '../src/data/progression';
import { defaultSave } from '../src/state/save';
import {
  baseStats,
  bowTierIndex,
  buySkill,
  canBuySkill,
  catchUpPerks,
  comboMultiplier,
  enemyDamageMultiplier,
  enemyHealthScale,
  firstWaveOfRealm,
  isBossWave,
  isSkillLocked,
  nextSkillCost,
  recordBossVictory,
  respecSkills,
  runStartValues,
  spawnCap,
  starsForHealth,
  xpForNextLevel,
} from '../src/systems/rules';

describe('bow tiers', () => {
  it('awaken at 40 and 150 lifetime kills', () => {
    expect(bowTierIndex(0)).toBe(0);
    expect(bowTierIndex(39)).toBe(0);
    expect(bowTierIndex(40)).toBe(1);
    expect(bowTierIndex(149)).toBe(1);
    expect(bowTierIndex(150)).toBe(2);
    expect(bowTierIndex(10_000)).toBe(2);
  });
});

describe('skill tree', () => {
  it('locks a skill until the one before it in the branch is bought', () => {
    const save = defaultSave();
    expect(isSkillLocked(save, 'sharpenedTips')).toBe(false);
    expect(isSkillLocked(save, 'hawkEye')).toBe(true);
    save.skills.sharpenedTips = 1;
    expect(isSkillLocked(save, 'hawkEye')).toBe(false);
    // Branches are independent.
    expect(isSkillLocked(save, 'toughHide')).toBe(false);
    expect(isSkillLocked(save, 'swiftAegis')).toBe(true);
  });

  it('charges the next level cost and refuses when short of ink', () => {
    const save = defaultSave();
    save.ink = 19;
    expect(canBuySkill(save, 'sharpenedTips')).toBe(false);
    expect(buySkill(save, 'sharpenedTips')).toBe(false);
    save.ink = 70;
    expect(buySkill(save, 'sharpenedTips')).toBe(true);
    expect(save.ink).toBe(50);
    expect(save.skills.sharpenedTips).toBe(1);
    expect(nextSkillCost(save, 'sharpenedTips')).toBe(45);
    expect(buySkill(save, 'sharpenedTips')).toBe(true);
    expect(save.ink).toBe(5);
  });

  it('stops at max level', () => {
    const save = defaultSave();
    save.ink = 10_000;
    for (let i = 0; i < 5; i++) buySkill(save, 'sharpenedTips');
    expect(save.skills.sharpenedTips).toBe(3);
    expect(nextSkillCost(save, 'sharpenedTips')).toBeNull();
    expect(save.ink).toBe(10_000 - 20 - 45 - 80);
  });

  it('respec refunds every level bought', () => {
    const save = defaultSave();
    save.ink = 1000;
    buySkill(save, 'sharpenedTips');
    buySkill(save, 'sharpenedTips');
    buySkill(save, 'toughHide');
    expect(respecSkills(save)).toBe(20 + 45 + 20);
    expect(save.ink).toBe(1000);
    expect(save.skills).toEqual({});
  });

  it('every skill has at least one level and positive costs', () => {
    for (const skill of SKILLS) {
      expect(skill.costs.length).toBeGreaterThan(0);
      for (const cost of skill.costs) expect(cost).toBeGreaterThan(0);
    }
  });
});

describe('run start stats', () => {
  it('match the base balance with no skills', () => {
    const save = defaultSave();
    const stats = baseStats(save);
    expect(stats.damage).toBe(BALANCE.player.baseDamage);
    expect(stats.multishot).toBe(1);
    expect(stats.reloadTime).toBe(BALANCE.player.baseReload);
    expect(runStartValues(save)).toEqual({ maxHp: 100, spirit: 0, revives: 0, spiritCost: 25 });
  });

  it('apply skill levels', () => {
    const save = defaultSave();
    save.skills = {
      sharpenedTips: 3,
      openingVolley: 1,
      toughHide: 2,
      secondWind: 1,
      kindled: 1,
      deftMagic: 2,
    };
    const stats = baseStats(save);
    expect(stats.damage).toBeCloseTo(10 * 1.24);
    expect(stats.multishot).toBe(2);
    expect(runStartValues(save)).toEqual({ maxHp: 130, spirit: 25, revives: 1, spiritCost: 19 });
  });
});

describe('scaling', () => {
  it('combo multiplier grows 0.1 per hit and caps at 3', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(100)).toBe(3);
  });

  it('enemy damage ramps through realm 1 then slowly', () => {
    expect(enemyDamageMultiplier(1)).toBeCloseTo(0.67);
    expect(enemyDamageMultiplier(5)).toBeCloseTo(0.95);
    expect(enemyDamageMultiplier(6)).toBeCloseTo(1.04);
    expect(enemyDamageMultiplier(25)).toBeCloseTo(1.8);
  });

  it('enemy health grows 13% per wave from wave 1', () => {
    expect(enemyHealthScale(1)).toBe(1);
    expect(enemyHealthScale(11)).toBeCloseTo(2.3);
  });

  it('xp requirement grows and stays an integer', () => {
    expect(xpForNextLevel(40)).toBe(53);
    expect(Number.isInteger(xpForNextLevel(53))).toBe(true);
  });

  it('spawn cap rises with waves and stops at 7', () => {
    expect(spawnCap(1)).toBe(3);
    expect(spawnCap(4)).toBe(5);
    expect(spawnCap(50)).toBe(7);
  });
});

describe('realms and bosses', () => {
  it('boss waves are every fifth wave', () => {
    expect([1, 4, 5, 6, 10, 0].map(isBossWave)).toEqual([false, false, true, false, true, false]);
    expect(firstWaveOfRealm(1)).toBe(1);
    expect(firstWaveOfRealm(3)).toBe(11);
  });

  it('stars depend on health left', () => {
    expect(starsForHealth(1)).toBe(3);
    expect(starsForHealth(0.7)).toBe(3);
    expect(starsForHealth(0.5)).toBe(2);
    expect(starsForHealth(0.1)).toBe(1);
  });

  it('a campaign boss kill stores stars, unlocks the next realm and Endless', () => {
    const save = defaultSave();
    expect(recordBossVictory(save, 'campaign', 5, 0.8)).toEqual({ stars: 3, won: false });
    expect(save.stars[0]).toBe(3);
    expect(save.unlockedRealms).toBe(2);
    expect(save.endlessUnlocked).toBe(true);
    // A worse replay keeps the best stars.
    recordBossVictory(save, 'campaign', 5, 0.1);
    expect(save.stars[0]).toBe(3);
  });

  it('the fifth boss wins the campaign; unlocks never pass the last realm', () => {
    const save = defaultSave();
    expect(recordBossVictory(save, 'campaign', 25, 0.4)).toEqual({ stars: 2, won: true });
    expect(save.unlockedRealms).toBe(5);
  });

  it('endless boss kills do not touch campaign stars', () => {
    const save = defaultSave();
    expect(recordBossVictory(save, 'endless', 5, 1)).toEqual({ stars: 0, won: false });
    expect(save.stars.every((s) => s === 0)).toBe(true);
    expect(save.endlessUnlocked).toBe(true);
  });

  it('later realms grant three catch-up perks per skipped realm', () => {
    expect(catchUpPerks(1)).toBe(0);
    expect(catchUpPerks(4)).toBe(9);
  });
});
