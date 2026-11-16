/** Turning a drag gesture into a shot. Pull back from where the drag started; release to fire. */
import { BALANCE } from '../config';
import { clamp } from '../core/math';
import type { Game, Shot } from '../state/types';

export function beginAim(game: Game, pointerId: number, x: number, y: number): boolean {
  if (game.phase !== 'play' || game.paused || game.aim) return false;
  game.aim = { pointerId, startX: x, startY: y, x, y, pull: 0 };
  return true;
}

export function moveAim(game: Game, pointerId: number, x: number, y: number): void {
  const aim = game.aim;
  if (!aim || aim.pointerId !== pointerId) return;
  aim.x = x;
  aim.y = y;
  aim.pull = Math.hypot(aim.startX - x, aim.startY - y);
}

/** The shot the current drag would fire, or null if it is too short to count. */
export function currentShot(game: Game): Shot | null {
  const aim = game.aim;
  if (!aim) return null;
  const s = game.layout.scale;
  const dx = aim.startX - aim.x;
  const dy = aim.startY - aim.y;
  const pull = Math.hypot(dx, dy);
  if (pull < BALANCE.shot.minPull * s) return null;
  const frost = game.run.frost > 0 ? BALANCE.status.frostPowerPenalty : 1;
  return {
    angle: Math.atan2(dy, dx),
    power: clamp(pull / (BALANCE.shot.fullDrawPull * s), 0.05, 1) * frost,
    powerShot: game.run.charge >= BALANCE.shot.powerShotHold,
  };
}

/** End the drag. Returns the shot to fire now, or queues it until the bow is ready. */
export function releaseAim(game: Game, pointerId: number, cancelled: boolean): Shot | null {
  const aim = game.aim;
  if (!aim || aim.pointerId !== pointerId) return null;
  const shot = currentShot(game);
  game.aim = null;
  if (!shot || cancelled) return null;
  if (game.run.reloadTimer <= 0) return shot;
  game.queuedShot = shot;
  return null;
}
