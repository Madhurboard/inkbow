/**
 * Versioned save data in the browser's localStorage.
 *
 * Every load goes through `migrateSave`, which accepts any older version (or junk) and
 * returns valid current data, so an update never wipes or corrupts a player's progress.
 */
import { clamp } from '../core/math';
import { LEGACY_SKILL_IDS, SKILLS, type SkillId } from '../data/progression';
import { REALM_COUNT } from '../data/realms';

export const SAVE_KEY = 'inkbow.save';
/** Key used by v1 (the single-file version of the game). */
export const LEGACY_SAVE_KEY = 'inkbow1';
export const SAVE_VERSION = 2;

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  bestCampaign: number;
  bestEndless: number;
  /** Lifetime kills; they awaken bow tiers. */
  kills: number;
  ink: number;
  skills: Partial<Record<SkillId, number>>;
  /** Best stars (0–3) per realm. */
  stars: number[];
  unlockedRealms: number;
  endlessUnlocked: boolean;
  settings: Settings;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    bestCampaign: 0,
    bestEndless: 0,
    kills: 0,
    ink: 0,
    skills: {},
    stars: Array.from({ length: REALM_COUNT }, () => 0),
    unlockedRealms: 1,
    endlessUnlocked: false,
    settings: { sound: true, music: true, haptics: true },
  };
}

type Loose = Record<string, unknown>;

const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

function count(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.floor(value), 0, max) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readSkills(raw: unknown, idMap?: Readonly<Record<string, SkillId>>): SaveData['skills'] {
  const skills: SaveData['skills'] = {};
  if (!isObject(raw)) return skills;
  for (const [key, level] of Object.entries(raw)) {
    const id = idMap ? idMap[key] : (key as SkillId);
    const def = SKILLS.find((s) => s.id === id);
    if (!def) continue;
    const lv = count(level, 0, def.costs.length);
    if (lv > 0) skills[def.id] = lv;
  }
  return skills;
}

function readStars(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: REALM_COUNT }, (_, i) => count(list[i], 0, 3));
}

function readSettings(raw: unknown): Settings {
  const s = isObject(raw) ? raw : {};
  return { sound: flag(s.sound, true), music: flag(s.music, true), haptics: flag(s.haptics, true) };
}

/** Turn any stored value (any version, or garbage) into valid current save data. */
export function migrateSave(raw: unknown): SaveData {
  if (!isObject(raw)) return defaultSave();
  const legacy = raw.version === undefined;
  return {
    version: SAVE_VERSION,
    bestCampaign: count(legacy ? raw.best : raw.bestCampaign, 0),
    bestEndless: count(legacy ? raw.bestE : raw.bestEndless, 0),
    kills: count(raw.kills, 0),
    ink: count(raw.ink, 0),
    skills: legacy ? readSkills(raw.sk, LEGACY_SKILL_IDS) : readSkills(raw.skills),
    stars: readStars(raw.stars),
    unlockedRealms: clamp(count(legacy ? raw.unlock : raw.unlockedRealms, 1, REALM_COUNT), 1, REALM_COUNT),
    endlessUnlocked: flag(legacy ? raw.endless : raw.endlessUnlocked, false),
    settings: readSettings(legacy ? raw.set : raw.settings),
  };
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function parse(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Load the current save, falling back to the v1 save, then to a fresh one. */
export function loadSave(store: KeyValueStore | null): SaveData {
  if (!store) return defaultSave();
  try {
    const current = parse(store.getItem(SAVE_KEY));
    if (current !== undefined) return migrateSave(current);
    return migrateSave(parse(store.getItem(LEGACY_SAVE_KEY)));
  } catch {
    return defaultSave();
  }
}

/** Returns false when storage is unavailable or full; the game keeps running either way. */
export function writeSave(store: KeyValueStore | null, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** localStorage, or null where the browser blocks it (some private modes, sandboxed frames). */
export function browserStore(): KeyValueStore | null {
  try {
    const store = globalThis.localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}
