import { describe, expect, it } from 'vitest';
import {
  type KeyValueStore,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  defaultSave,
  loadSave,
  migrateSave,
  writeSave,
} from '../src/state/save';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

/** Shape written by the original single-file game. */
const legacyV1 = {
  best: 1234,
  bestE: 567,
  kills: 88,
  ink: 140,
  sk: { o1: 2, o2: 1, d1: 3, s4: 1, bogus: 9 },
  stars: [3, 2, 0, 0, 0],
  unlock: 3,
  endless: true,
  set: { sound: false, music: true, haptics: false },
};

describe('migrateSave', () => {
  it('returns a fresh save for missing or junk data', () => {
    for (const junk of [undefined, null, 42, 'text', [], true])
      expect(migrateSave(junk)).toEqual(defaultSave());
  });

  it('converts a v1 save without losing progress', () => {
    const save = migrateSave(legacyV1);
    expect(save).toEqual({
      version: 2,
      bestCampaign: 1234,
      bestEndless: 567,
      kills: 88,
      ink: 140,
      skills: { sharpenedTips: 2, hawkEye: 1, toughHide: 3, twinStars: 1 },
      stars: [3, 2, 0, 0, 0],
      unlockedRealms: 3,
      endlessUnlocked: true,
      settings: { sound: false, music: true, haptics: false },
    });
  });

  it('is idempotent on current saves', () => {
    const once = migrateSave(legacyV1);
    expect(migrateSave(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it('clamps out-of-range and wrong-typed values', () => {
    const save = migrateSave({
      version: 2,
      bestCampaign: -50,
      kills: 'lots',
      ink: 12.9,
      skills: { sharpenedTips: 99, hawkEye: -1, notASkill: 2 },
      stars: [7, -1, 'x'],
      unlockedRealms: 40,
      endlessUnlocked: 'yes',
      settings: { sound: 'off' },
    });
    expect(save.bestCampaign).toBe(0);
    expect(save.kills).toBe(0);
    expect(save.ink).toBe(12);
    expect(save.skills).toEqual({ sharpenedTips: 3 });
    expect(save.stars).toEqual([3, 0, 0, 0, 0]);
    expect(save.unlockedRealms).toBe(5);
    expect(save.endlessUnlocked).toBe(false);
    expect(save.settings).toEqual({ sound: true, music: true, haptics: true });
  });
});

describe('loadSave / writeSave', () => {
  it('falls back to the v1 key, then writes under the new key', () => {
    const store = memoryStore({ [LEGACY_SAVE_KEY]: JSON.stringify(legacyV1) });
    const save = loadSave(store);
    expect(save.ink).toBe(140);
    expect(writeSave(store, save)).toBe(true);
    expect(JSON.parse(store.data[SAVE_KEY] ?? '{}').version).toBe(2);
    // The new key now wins over the old one.
    store.data[LEGACY_SAVE_KEY] = JSON.stringify({ ...legacyV1, ink: 1 });
    expect(loadSave(store).ink).toBe(140);
  });

  it('survives corrupt JSON and missing storage', () => {
    expect(loadSave(memoryStore({ [SAVE_KEY]: '{not json' }))).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
    expect(writeSave(null, defaultSave())).toBe(false);
  });

  it('reports failure when storage is full instead of throwing', () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(writeSave(full, defaultSave())).toBe(false);
  });
});
