import { createGame } from '../src/state/game';
import { computeLayout } from '../src/state/layout';
import { type SaveData, defaultSave } from '../src/state/save';
import type { Game, UiPort } from '../src/state/types';

/** A UiPort that records calls instead of touching the DOM. */
export function recordingUi(): UiPort & { calls: string[]; perkRequests: number; ended: boolean[] } {
  const calls: string[] = [];
  const ui = {
    calls,
    perkRequests: 0,
    ended: [] as boolean[],
    banner: (title: string) => void calls.push(`banner:${title}`),
    hint: (text: string) => void calls.push(`hint:${text}`),
    combo: () => undefined,
    bossBar: (name: string | null) => void calls.push(`bossBar:${name}`),
    bossHealth: () => undefined,
    waveLabel: () => undefined,
    requestPerks: () => {
      ui.perkRequests++;
    },
    realmTransition: (atMidpoint: () => void) => atMidpoint(),
    runEnded: (win: boolean) => void ui.ended.push(win),
    vibrate: () => undefined,
  };
  return ui;
}

export function testGame(save: SaveData = defaultSave()): Game & { ui: ReturnType<typeof recordingUi> } {
  const ui = recordingUi();
  const game = createGame(save, ui, () => undefined);
  game.layout = computeLayout(844, 390, 1);
  return game as Game & { ui: typeof ui };
}
