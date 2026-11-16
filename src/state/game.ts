/** Creating the game object and resetting it for a new run. */
import { BALANCE } from '../config';
import { REALM_COUNT } from '../data/realms';
import { baseStats, runStartValues } from '../systems/rules';
import type { SaveData } from './save';
import type { Game, GameMode, Layout, Run, UiPort } from './types';

export function freshRun(save: SaveData, mode: GameMode, realm: number): Run {
  const start = runStartValues(save);
  return {
    mode,
    realm,
    wave: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    xp: 0,
    xpToNext: BALANCE.xp.first,
    level: 1,
    pendingPerks: 0,
    hp: start.maxHp,
    maxHp: start.maxHp,
    spirit: start.spirit,
    spiritCost: start.spiritCost,
    revives: start.revives,
    shieldTime: 0,
    shieldAge: 9,
    shieldCooldown: 0,
    reloadTimer: 0,
    burn: 0,
    poison: 0,
    frost: 0,
    spawnQueue: [],
    spawnTimer: 0,
    clearTimer: 0,
    transitioning: false,
    slowTime: 0,
    hitStop: 0,
    shake: 0,
    flash: 0,
    hurtTime: 0,
    shots: 0,
    drawAmount: 0,
    selectedSpirit: null,
    charge: 0,
    inkEarned: 0,
    lanternTimer: BALANCE.lantern.firstDelay,
    won: false,
    lastStars: 0,
  };
}

const emptyLayout = (): Layout => ({
  width: 0,
  height: 0,
  dpr: 1,
  scale: 1,
  portrait: false,
  groundY: 0,
  platformHeight: 0,
  archerX: 0,
  archerY: 0,
  perches: [],
});

export function createGame(save: SaveData, ui: UiPort, persist: () => void): Game {
  return {
    phase: 'menu',
    paused: false,
    time: 0,
    save,
    run: freshRun(save, 'campaign', 0),
    stats: baseStats(save),
    layout: emptyLayout(),
    enemies: [],
    arrows: [],
    enemyArrows: [],
    particles: [],
    texts: [],
    decals: [],
    lantern: null,
    aim: null,
    queuedShot: null,
    seen: new Set(),
    perkPicks: new Map(),
    weather: { kind: 'ember', drops: [], birds: [], lightningTimer: 0, lightningFlash: 0 },
    ui,
    persist,
  };
}

/** Clear the battlefield and start a new run. Campaign realms are 1-based; Endless picks one at random. */
export function resetRun(game: Game, mode: GameMode, realm: number): void {
  const realmIndex = mode === 'campaign' ? realm - 1 : Math.floor(Math.random() * REALM_COUNT);
  game.run = freshRun(game.save, mode, realmIndex);
  game.stats = baseStats(game.save);
  clearBattlefield(game);
  game.seen.clear();
  game.perkPicks.clear();
}

export function clearBattlefield(game: Game): void {
  game.enemies = [];
  game.arrows = [];
  game.enemyArrows = [];
  game.particles = [];
  game.texts = [];
  game.decals = [];
  game.lantern = null;
  game.aim = null;
  game.queuedShot = null;
  for (const perch of game.layout.perches) perch.occupant = null;
}
