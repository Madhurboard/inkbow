/** Spirit, XP, ink and combo: the small rewards that most actions grant. */
import { BALANCE } from '../config';
import type { Game } from '../state/types';
import { comboMultiplier, xpForNextLevel } from './rules';

export function addSpirit(game: Game, amount: number): void {
  game.run.spirit = Math.min(100, game.run.spirit + amount * game.stats.spiritGain);
}

/** Add XP; each level gained queues a perk choice. */
export function addXp(game: Game, amount: number): void {
  const run = game.run;
  run.xp += amount;
  while (run.xp >= run.xpToNext) {
    run.xp -= run.xpToNext;
    run.xpToNext = xpForNextLevel(run.xpToNext);
    run.level++;
    run.pendingPerks++;
  }
  if (run.pendingPerks > 0) game.ui.requestPerks();
}

/** Ink goes straight into the save so it is kept even if the run is abandoned. */
export function addInk(game: Game, amount: number): void {
  game.run.inkEarned += amount;
  game.save.ink += amount;
}

export function bumpCombo(game: Game): void {
  const run = game.run;
  run.combo++;
  run.comboTimer = BALANCE.combo.window;
  game.ui.combo(run.combo, comboMultiplier(run.combo));
}

export function breakCombo(game: Game): void {
  game.run.combo = 0;
  game.run.comboTimer = 0;
  game.ui.combo(0, 1);
}

export function scoreMultiplier(game: Game): number {
  return comboMultiplier(game.run.combo);
}
