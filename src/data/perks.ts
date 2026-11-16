/** In-run blessings offered on level-up. */
import type { Run, Stats } from '../state/types';

export type PerkId =
  | 'twinShot'
  | 'piercingWind'
  | 'emberTip'
  | 'keenEye'
  | 'swiftNock'
  | 'heartwood'
  | 'spiritDrinker'
  | 'ricochet'
  | 'quickAegis'
  | 'spiritWell'
  | 'heavyDraw';

export interface PerkDef {
  id: PerkId;
  name: string;
  description: string;
  color: string;
  /** How many times it can be picked in one run; undefined means unlimited. */
  maxPicks?: number;
  apply(stats: Stats, run: Run): void;
}

export const PERKS: readonly PerkDef[] = [
  {
    id: 'twinShot',
    name: 'Twin Shot',
    description: 'Loose one more arrow with every shot.',
    color: '#e0863a',
    maxPicks: 3,
    apply: (s) => void s.multishot++,
  },
  {
    id: 'piercingWind',
    name: 'Piercing Wind',
    description: 'Arrows pass through one more foe.',
    color: '#6fb8d9',
    maxPicks: 3,
    apply: (s) => void s.pierce++,
  },
  {
    id: 'emberTip',
    name: 'Ember Tip',
    description: 'Your hits set enemies burning.',
    color: '#e2543a',
    maxPicks: 1,
    apply: (s) => void s.burn++,
  },
  {
    id: 'keenEye',
    name: 'Keen Eye',
    description: 'Headshots deal far more damage.',
    color: '#d9b23a',
    apply: (s) => void (s.critMultiplier += 0.9),
  },
  {
    id: 'swiftNock',
    name: 'Swift Nock',
    description: 'Ready your next arrow 25% faster.',
    color: '#8fc46a',
    maxPicks: 4,
    apply: (s) => void (s.reloadTime *= 0.75),
  },
  {
    id: 'heartwood',
    name: 'Heartwood',
    description: '+25 max health and heal 40.',
    color: '#c8506a',
    apply: (_s, run) => {
      run.maxHp += 25;
      run.hp = Math.min(run.maxHp, run.hp + 40);
    },
  },
  {
    id: 'spiritDrinker',
    name: 'Spirit Drinker',
    description: 'Each kill restores 3 health.',
    color: '#b56ad0',
    apply: (s) => void (s.lifesteal += 3),
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    description: 'Arrows leap to one more nearby foe.',
    color: '#4fb0a0',
    maxPicks: 3,
    apply: (s) => void s.ricochet++,
  },
  {
    id: 'quickAegis',
    name: 'Quick Aegis',
    description: 'Shield recharges 25% faster.',
    color: '#6f9ae0',
    maxPicks: 3,
    apply: (s) => void (s.shieldCooldown *= 0.75),
  },
  {
    id: 'spiritWell',
    name: 'Spirit Well',
    description: 'Starfall charges 40% faster.',
    color: '#e0c04a',
    maxPicks: 3,
    apply: (s) => void (s.spiritGain *= 1.4),
  },
  {
    id: 'heavyDraw',
    name: 'Heavy Draw',
    description: '+30% arrow damage.',
    color: '#a05a3a',
    apply: (s) => void (s.damage *= 1.3),
  },
];

/** Up to `count` different perks that have not reached their pick limit. */
export function drawPerkChoices(
  picks: ReadonlyMap<PerkId, number>,
  count = 3,
  rng: () => number = Math.random,
): PerkDef[] {
  const pool = PERKS.filter((p) => p.maxPicks === undefined || (picks.get(p.id) ?? 0) < p.maxPicks);
  const choices: PerkDef[] = [];
  while (choices.length < count && pool.length > 0) {
    const [perk] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (perk) choices.push(perk);
  }
  return choices;
}
