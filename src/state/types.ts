/** Type definitions for everything that lives in the game world. */
import type { Rgb } from '../core/color';
import type { PerkId } from '../data/perks';
import type { SaveData } from './save';

export type ArrowTypeId = 'normal' | 'fire' | 'poison' | 'ice' | 'boom' | 'homing' | 'fan' | 'shadow';
export type WalkerTypeId = 'sword' | 'sprinter' | 'brute' | 'giant';
export type SpawnType = ArrowTypeId | WalkerTypeId | 'rider' | 'boss';
export type EnemyKind = 'archer' | 'walker' | 'rider' | 'boss';
/** Which body shape an enemy is drawn with. */
export type BodyKey = 'archer' | WalkerTypeId | 'rider' | 'boss';
export type SpiritArrowId = 'ember' | 'storm' | 'gale';
export type GameMode = 'campaign' | 'endless';
export type WeatherKind = 'ember' | 'snow' | 'leaf' | 'rain' | 'wisp';
export type Phase = 'menu' | 'play' | 'over';
export type EnemyState = 'idle' | 'aim' | 'walk' | 'attack';

export interface SpawnEntry {
  type: SpawnType;
  /** Seconds to wait before this spawn, counted from the previous one. */
  delay: number;
}

export interface Enemy {
  type: SpawnType;
  kind: EnemyKind;
  body: BodyKey;
  /** Hex colour of the enemy's glow, eyes and arrows. */
  accent: string;
  arrowType: ArrowTypeId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  scale: number;
  bodyWidth: number;
  height: number;
  headRadius: number;
  state: EnemyState;
  cooldown: number;
  aimDuration: number;
  aimRemaining: number;
  shots: number;
  /** 0 → 1 fade-in when appearing on a perch. */
  appear: number;
  flash: number;
  age: number;
  burn: number;
  knockback: number;
  lunge: number;
  walkPhase: number;
  bobPhase: number;
  /** Index into `layout.perches`, or null when on the ground or in the air. */
  perch: number | null;
  stopX: number;
  speed: number;
  damage: number;
  baseY: number;
  summonTimer: number;
  dead: boolean;
}

export interface PlayerArrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Flat list of recent x, y positions for the trail. */
  trail: number[];
  damage: number;
  pierce: number;
  ricochet: number;
  hit: Set<Enemy>;
  age: number;
  /** Starfall and deflected arrows: no gravity, steer to `target`. */
  guided: boolean;
  target: Enemy | null;
  special: SpiritArrowId | null;
  powerShot: boolean;
  /** Seconds left stuck in the ground, or null while flying. */
  stuck: number | null;
  dead: boolean;
}

export interface EnemyArrow {
  type: ArrowTypeId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: Enemy | null;
  trail: number[];
  age: number;
  /** Homing arrows fly at a constant speed. */
  speed: number;
  dead: boolean;
}

export type ParticleKind = 'petal' | 'dot' | 'wisp' | 'ring' | 'bolt';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: Rgb;
  rotation: number;
  spin: number;
  /** Spirit granted when a wisp reaches the archer. */
  spiritValue: number;
  /** Lightning bolt vertices as a flat x, y list. */
  points: number[];
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vx: number;
  color: string;
  size: number;
  age: number;
}

export interface Decal {
  x: number;
  y: number;
  accent: string;
  age: number;
  scale: number;
  rotation: number;
}

export interface Lantern {
  x: number;
  y: number;
  baseY: number;
  age: number;
  phase: number;
}

export interface Perch {
  x: number;
  y: number;
  occupant: Enemy | null;
}

export interface Layout {
  width: number;
  height: number;
  dpr: number;
  /** Size multiplier: 1 on a 390-px-wide phone. */
  scale: number;
  portrait: boolean;
  groundY: number;
  platformHeight: number;
  archerX: number;
  archerY: number;
  perches: Perch[];
}

/** Player stats for the current run, from skills and then perks. */
export interface Stats {
  damage: number;
  multishot: number;
  pierce: number;
  burn: number;
  critMultiplier: number;
  reloadTime: number;
  lifesteal: number;
  ricochet: number;
  shieldCooldown: number;
  spiritGain: number;
}

export interface Run {
  mode: GameMode;
  /** Index into REALMS; also picks the boss. */
  realm: number;
  wave: number;
  score: number;
  kills: number;
  combo: number;
  comboTimer: number;
  xp: number;
  xpToNext: number;
  level: number;
  pendingPerks: number;
  hp: number;
  maxHp: number;
  spirit: number;
  spiritCost: number;
  revives: number;
  shieldTime: number;
  shieldAge: number;
  shieldCooldown: number;
  reloadTimer: number;
  burn: number;
  poison: number;
  frost: number;
  spawnQueue: SpawnEntry[];
  spawnTimer: number;
  clearTimer: number;
  /** True during the fade between realms. */
  transitioning: boolean;
  slowTime: number;
  hitStop: number;
  shake: number;
  flash: number;
  hurtTime: number;
  shots: number;
  drawAmount: number;
  selectedSpirit: SpiritArrowId | null;
  charge: number;
  inkEarned: number;
  lanternTimer: number;
  won: boolean;
  lastStars: number;
}

export interface Aim {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  pull: number;
}

export interface Shot {
  angle: number;
  power: number;
  powerShot: boolean;
}

export interface WeatherDrop {
  x: number;
  y: number;
  size: number;
  phase: number;
}

export interface Bird {
  x: number;
  y: number;
  speed: number;
  phase: number;
  size: number;
}

export interface WeatherState {
  kind: WeatherKind;
  drops: WeatherDrop[];
  birds: Bird[];
  lightningTimer: number;
  lightningFlash: number;
}

/** How game systems talk to the screen. The browser UI implements it; tests stub it. */
export interface UiPort {
  banner(title: string, subtitle?: string, durationMs?: number): void;
  hint(text: string, durationMs?: number): void;
  combo(count: number, multiplier: number): void;
  bossBar(name: string | null): void;
  bossHealth(fraction: number): void;
  waveLabel(wave: number): void;
  requestPerks(): void;
  realmTransition(atMidpoint: () => void): void;
  runEnded(win: boolean): void;
  vibrate(ms: number): void;
}

export interface Game {
  phase: Phase;
  paused: boolean;
  time: number;
  save: SaveData;
  run: Run;
  stats: Stats;
  layout: Layout;
  enemies: Enemy[];
  arrows: PlayerArrow[];
  enemyArrows: EnemyArrow[];
  particles: Particle[];
  texts: FloatingText[];
  decals: Decal[];
  lantern: Lantern | null;
  aim: Aim | null;
  queuedShot: Shot | null;
  /** Tutorial hints already shown this run. */
  seen: Set<string>;
  perkPicks: Map<PerkId, number>;
  weather: WeatherState;
  ui: UiPort;
  persist: () => void;
}
