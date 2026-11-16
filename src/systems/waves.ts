/** What spawns in each wave, and which perches are open. */
import { ARROW_TYPE_IDS, WALKER_TYPE_IDS } from '../data/enemies';
import type { GameMode, SpawnEntry, SpawnType, WalkerTypeId } from '../state/types';
import { isBossWave } from './rules';

/** Hand-made opening waves of each campaign realm, introducing enemies one or two at a time. */
const SCRIPTED_WAVES: Readonly<Record<number, readonly (readonly [SpawnType, number])[]>> = {
  1: [
    ['normal', 0.6],
    ['normal', 3],
    ['sword', 3],
    ['normal', 2.5],
    ['sword', 3],
    ['normal', 2],
  ],
  2: [
    ['fire', 0.6],
    ['normal', 2],
    ['sprinter', 2.4],
    ['fire', 2],
    ['sword', 2],
    ['normal', 1.6],
    ['sprinter', 2],
    ['fire', 1.6],
  ],
  3: [
    ['poison', 0.6],
    ['ice', 2],
    ['brute', 2],
    ['normal', 1.6],
    ['rider', 2],
    ['fire', 1.6],
    ['sprinter', 1.6],
    ['poison', 1.6],
    ['ice', 1.4],
  ],
  4: [
    ['boom', 0.6],
    ['fan', 1.8],
    ['homing', 1.8],
    ['giant', 2],
    ['rider', 1.6],
    ['shadow', 1.6],
    ['brute', 1.6],
    ['fire', 1.4],
    ['boom', 1.4],
    ['homing', 1.4],
  ],
};

/** Walkers drawn in random waves: swordsmen and runners are twice as common. */
const RANDOM_WALKERS: readonly WalkerTypeId[] = ['sword', 'sword', 'sprinter', 'sprinter', 'brute', 'giant'];

export const ARCHER_SHARE = 0.7;
export const RIDER_SHARE_OF_ARCHERS = 0.18;

export function buildWave(wave: number, mode: GameMode, rng: () => number = Math.random): SpawnEntry[] {
  const scripted = mode === 'campaign' ? SCRIPTED_WAVES[wave] : undefined;
  if (scripted) return scripted.map(([type, delay]) => ({ type, delay }));
  if (isBossWave(wave)) return [{ type: 'boss', delay: 1 }];

  const pickFrom = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)] as T;
  const count = 8 + wave;
  const pace = Math.max(0.5, 1 - wave * 0.03);
  const entries: SpawnEntry[] = [];
  for (let i = 0; i < count; i++) {
    let type: SpawnType;
    if (rng() < ARCHER_SHARE) type = rng() < RIDER_SHARE_OF_ARCHERS ? 'rider' : pickFrom(ARROW_TYPE_IDS);
    else type = pickFrom(RANDOM_WALKERS);
    entries.push({ type, delay: (1 + rng() * 1.2) * pace });
  }
  return entries;
}

/** Perches enemy archers may use; more open up over the first waves. */
export function allowedPerches(wave: number): number[] {
  if (wave <= 1) return [0, 2];
  if (wave === 2) return [0, 2, 3];
  if (wave === 3) return [0, 1, 2, 3, 4];
  return [0, 1, 2, 3, 4, 5];
}

/** Perches the boss teleports between. */
export const BOSS_PERCHES: readonly number[] = [1, 3, 4, 5];

export const ALL_SPAWN_TYPES: readonly SpawnType[] = [...ARROW_TYPE_IDS, ...WALKER_TYPE_IDS, 'rider', 'boss'];
