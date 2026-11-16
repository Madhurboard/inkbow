/** Headless simulation tests: run the real systems with a stub UI and no browser. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERKS } from '../src/data/perks';
import { defaultSave } from '../src/state/save';
import {
  bodyCenterY,
  createPlayerArrow,
  hitEnemy,
  raiseShield,
  shoot,
  starfall,
} from '../src/systems/combat';
import { spawnEnemy } from '../src/systems/enemies';
import { applyPerk, endRun, startRun, stepRun } from '../src/systems/run';
import { testGame } from './helpers';

const FRAME = 1 / 60;

function stepFor(game: ReturnType<typeof testGame>, seconds: number): void {
  for (let t = 0; t < seconds && game.phase === 'play'; t += FRAME) stepRun(game, FRAME);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a run', () => {
  it('starts on wave 1 of the chosen realm with base stats', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    expect(game.phase).toBe('play');
    expect(game.run.wave).toBe(1);
    expect(game.run.hp).toBe(100);
    expect(game.run.spawnQueue).toHaveLength(6);
    expect(game.ui.calls).toContain('banner:Wave 1');
  });

  it('starting at realm 3 begins on wave 11 with six catch-up perks', () => {
    const game = testGame();
    game.save.unlockedRealms = 3;
    startRun(game, 'campaign', 3);
    expect(game.run.wave).toBe(11);
    expect(game.run.realm).toBe(2);
    expect(game.run.pendingPerks).toBe(6);
    expect(game.ui.perkRequests).toBeGreaterThan(0);
  });

  it('enemies spawn and shoot at an archer who does nothing, until the run ends', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    stepFor(game, 5);
    expect(game.enemies.length).toBeGreaterThan(0);
    stepFor(game, 240);
    expect(game.phase).toBe('over');
    expect(game.ui.ended).toEqual([false]);
    expect(game.run.hp).toBeLessThanOrEqual(0);
  });

  it('Second Wind revives once instead of ending the run', () => {
    const save = defaultSave();
    save.skills.secondWind = 1;
    const game = testGame(save);
    startRun(game, 'campaign', 1);
    game.run.hp = 0;
    stepRun(game, FRAME);
    expect(game.phase).toBe('play');
    expect(game.run.hp).toBe(50);
    expect(game.run.revives).toBe(0);
    endRun(game, false);
    expect(game.phase).toBe('over');
  });

  it('records the best score per mode', () => {
    const game = testGame();
    startRun(game, 'endless', 1);
    game.run.score = 900;
    endRun(game, false);
    expect(game.save.bestEndless).toBe(900);
    expect(game.save.bestCampaign).toBe(0);
  });
});

describe('combat', () => {
  it('a headshot does crit damage; a kill pays ink, score, xp and lifetime kills', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    const enemy = spawnEnemy(game, 'normal');
    enemy.appear = 1;
    const arrow = createPlayerArrow(enemy.x, enemy.y, 100, 0, 3);
    hitEnemy(game, enemy, arrow, true);
    expect(enemy.maxHp - enemy.hp).toBeCloseTo(3 * game.stats.critMultiplier);
    hitEnemy(game, enemy, createPlayerArrow(enemy.x, enemy.y, 100, 0, 1000), false);
    expect(enemy.dead).toBe(true);
    expect(game.save.kills).toBe(1);
    expect(game.save.ink).toBe(1);
    expect(game.run.score).toBeGreaterThan(0);
    expect(game.run.xp).toBeGreaterThan(0);
  });

  it('an aimed arrow travels and hits a perched archer', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    game.run.spawnQueue = [];
    const enemy = spawnEnemy(game, 'normal');
    enemy.appear = 1;
    const hp = enemy.hp;
    // Fire straight at the body with a guided arrow so the test doesn't depend on ballistics.
    const { archerX, archerY } = game.layout;
    const angle = Math.atan2(bodyCenterY(game, enemy) - archerY, enemy.x - archerX);
    game.arrows.push(
      createPlayerArrow(archerX, archerY, Math.cos(angle) * 900, Math.sin(angle) * 900, 5, {
        guided: true,
        target: enemy,
      }),
    );
    stepFor(game, 2);
    expect(enemy.hp).toBeLessThan(hp);
  });

  it('shooting uses reload time and spirit arrows cost spirit', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    game.run.spirit = 30;
    game.run.selectedSpirit = 'gale';
    shoot(game, -0.3, 1, false);
    expect(game.arrows).toHaveLength(1 + 4);
    expect(game.run.spirit).toBe(5);
    expect(game.run.selectedSpirit).toBeNull();
    expect(game.run.reloadTimer).toBeCloseTo(game.stats.reloadTime);
  });

  it('the shield has a cooldown', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    raiseShield(game);
    expect(game.run.shieldTime).toBeGreaterThan(0);
    game.run.shieldTime = 0;
    raiseShield(game);
    expect(game.run.shieldTime).toBe(0);
  });

  it('Starfall needs a full meter and sends guided arrows at every enemy', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    spawnEnemy(game, 'normal');
    spawnEnemy(game, 'giant');
    game.run.spirit = 99;
    expect(starfall(game)).toBe(false);
    game.run.spirit = 100;
    expect(starfall(game)).toBe(true);
    expect(game.run.spirit).toBe(0);
    expect(game.arrows.filter((a) => a.guided)).toHaveLength(1 + 3);
  });

  it('stuck arrows disappear after a moment', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    game.run.spawnQueue = [];
    game.arrows.push(createPlayerArrow(200, game.layout.groundY - 5, 0, 300, 5));
    stepFor(game, 0.5);
    expect(game.arrows[0]?.stuck).not.toBeNull();
    stepFor(game, 2);
    expect(game.arrows).toHaveLength(0);
  });
});

describe('bosses and progression', () => {
  it('killing the realm boss stores stars and unlocks the next realm', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    game.run.wave = 5;
    const boss = spawnEnemy(game, 'boss');
    expect(game.ui.calls).toContain('bossBar:The Hollow King');
    hitEnemy(game, boss, createPlayerArrow(boss.x, boss.y, 0, 0, 1e6), false);
    expect(game.save.unlockedRealms).toBe(2);
    expect(game.save.stars[0]).toBe(3);
    expect(game.save.endlessUnlocked).toBe(true);
    expect(game.enemyArrows).toHaveLength(0);
  });

  it('the boss takes the boss perch from any archer standing on it', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    game.run.wave = 5;
    const archer = spawnEnemy(game, 'normal');
    game.layout.perches[archer.perch ?? 0]!.occupant = null;
    archer.perch = 1;
    game.layout.perches[1]!.occupant = archer;
    const boss = spawnEnemy(game, 'boss');
    expect(archer.dead).toBe(true);
    expect(game.layout.perches[1]?.occupant).toBe(boss);
  });

  it('a level-up queues a perk, and applying one counts it', () => {
    const game = testGame();
    startRun(game, 'campaign', 1);
    const enemy = spawnEnemy(game, 'giant');
    hitEnemy(game, enemy, createPlayerArrow(0, 0, 0, 0, 1e6), false);
    expect(game.run.pendingPerks).toBe(1);
    const twin = PERKS.find((p) => p.id === 'twinShot');
    if (!twin) throw new Error('missing perk');
    applyPerk(game, twin);
    expect(game.stats.multishot).toBe(2);
    expect(game.perkPicks.get('twinShot')).toBe(1);
    expect(game.run.pendingPerks).toBe(0);
  });
});
