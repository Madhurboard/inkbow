import { describe, expect, it } from 'vitest';
import { ARROW_TYPE_IDS, isArrowType, isWalkerType } from '../src/data/enemies';
import { PERKS, drawPerkChoices } from '../src/data/perks';
import { BOSSES } from '../src/data/progression';
import { REALMS, realmAt } from '../src/data/realms';
import { freshRun } from '../src/state/game';
import { computeLayout } from '../src/state/layout';
import { defaultSave } from '../src/state/save';
import { baseStats } from '../src/systems/rules';
import { ALL_SPAWN_TYPES, allowedPerches, buildWave } from '../src/systems/waves';

describe('waves', () => {
  it('campaign opens with fixed, gentle waves', () => {
    const wave1 = buildWave(1, 'campaign');
    expect(wave1.map((e) => e.type)).toEqual(['normal', 'normal', 'sword', 'normal', 'sword', 'normal']);
    expect(buildWave(1, 'campaign')).toEqual(wave1);
  });

  it('boss waves contain only the boss', () => {
    for (const mode of ['campaign', 'endless'] as const) {
      expect(buildWave(5, mode)).toEqual([{ type: 'boss', delay: 1 }]);
      expect(buildWave(20, mode)).toEqual([{ type: 'boss', delay: 1 }]);
    }
  });

  it('random waves grow with the wave number and use only real enemy types', () => {
    for (const wave of [1, 6, 13, 27]) {
      const entries = buildWave(wave, 'endless');
      expect(entries).toHaveLength(8 + wave);
      for (const e of entries) {
        expect(ALL_SPAWN_TYPES).toContain(e.type);
        expect(e.type).not.toBe('boss');
        expect(e.delay).toBeGreaterThan(0);
      }
    }
  });

  it('about 70% of random spawns are archers or riders', () => {
    let archers = 0;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      for (const e of buildWave(9, 'endless')) {
        total++;
        if (isArrowType(e.type) || e.type === 'rider') archers++;
      }
    }
    expect(archers / total).toBeGreaterThan(0.64);
    expect(archers / total).toBeLessThan(0.76);
  });

  it('more perches open over the first waves', () => {
    expect(allowedPerches(1)).toEqual([0, 2]);
    expect(allowedPerches(3)).toHaveLength(5);
    expect(allowedPerches(30)).toHaveLength(6);
  });
});

describe('perks', () => {
  it('offers three different perks', () => {
    const choices = drawPerkChoices(new Map());
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((p) => p.id)).size).toBe(3);
  });

  it('never offers a perk that reached its pick limit', () => {
    const picks = new Map([
      ['twinShot', 3],
      ['emberTip', 1],
    ] as const);
    for (let i = 0; i < 100; i++) {
      const ids = drawPerkChoices(picks).map((p) => p.id);
      expect(ids).not.toContain('twinShot');
      expect(ids).not.toContain('emberTip');
    }
  });

  it('each perk changes the stats or run it says it does', () => {
    const save = defaultSave();
    for (const perk of PERKS) {
      const stats = baseStats(save);
      const run = freshRun(save, 'campaign', 0);
      run.hp = 50;
      const before = JSON.stringify({ stats, run });
      perk.apply(stats, run);
      expect(JSON.stringify({ stats, run }), perk.id).not.toBe(before);
    }
  });
});

describe('content tables', () => {
  it('every realm has a boss and boss arrows are real arrow types', () => {
    expect(BOSSES).toHaveLength(REALMS.length);
    for (const boss of BOSSES) for (const a of boss.arrows) expect(ARROW_TYPE_IDS).toContain(a);
  });

  it('realmAt wraps around for Endless', () => {
    expect(realmAt(5).name).toBe(REALMS[0]?.name);
    expect(realmAt(-1).name).toBe(REALMS[4]?.name);
  });

  it('walker and arrow type guards agree with the tables', () => {
    expect(isWalkerType('giant')).toBe(true);
    expect(isWalkerType('fire')).toBe(false);
    expect(isArrowType('fire')).toBe(true);
  });
});

describe('layout', () => {
  it('puts every perch on screen and to the right of the archer', () => {
    for (const [w, h] of [
      [390, 844],
      [844, 390],
      [1920, 1080],
    ] as const) {
      const layout = computeLayout(w, h, 2);
      expect(layout.perches).toHaveLength(6);
      for (const p of layout.perches) {
        expect(p.x).toBeGreaterThan(layout.archerX);
        expect(p.x).toBeLessThan(w);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(layout.groundY);
      }
      expect(layout.archerY).toBeLessThan(layout.groundY);
    }
  });

  it('scales with the short side, within limits', () => {
    expect(computeLayout(390, 844, 1).scale).toBe(1);
    expect(computeLayout(200, 300, 1).scale).toBe(0.75);
    expect(computeLayout(3840, 2160, 1).scale).toBe(1.7);
    expect(computeLayout(390, 844, 3).dpr).toBe(2);
  });
});
