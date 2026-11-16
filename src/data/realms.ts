/** The five painted realms: palette, sun or moon, and weather. */
import { type Rgb, hexToRgb } from '../core/color';
import type { WeatherKind } from '../state/types';

export interface Realm {
  name: string;
  /** Sky gradient, top to horizon. */
  sky: Rgb[];
  orb: Rgb;
  glow: Rgb;
  /** Sun or moon position and size, as fractions of the screen. */
  orbX: number;
  orbY: number;
  orbRadius: number;
  moon: boolean;
  ring: boolean;
  stars: boolean;
  cloud: Rgb;
  farHills: Rgb;
  nearHills: Rgb;
  mist: Rgb;
  rock: Rgb;
  highlight: Rgb;
  stone: Rgb;
  ground: Rgb;
  groundDark: Rgb;
  grass: Rgb;
  tree: Rgb;
  flower: Rgb;
  weather: WeatherKind;
}

interface RealmSpec {
  name: string;
  sky: string[];
  orb: string;
  glow: string;
  orbX: number;
  orbY: number;
  orbRadius: number;
  moon?: boolean;
  ring?: boolean;
  stars?: boolean;
  cloud: string;
  farHills: string;
  nearHills: string;
  mist: string;
  rock: string;
  highlight: string;
  stone: string;
  ground: string;
  groundDark: string;
  grass: string;
  tree: string;
  flower: string;
  weather: WeatherKind;
}

function realm(spec: RealmSpec): Realm {
  const c = hexToRgb;
  return {
    name: spec.name,
    sky: spec.sky.map(c),
    orb: c(spec.orb),
    glow: c(spec.glow),
    orbX: spec.orbX,
    orbY: spec.orbY,
    orbRadius: spec.orbRadius,
    moon: spec.moon ?? false,
    ring: spec.ring ?? false,
    stars: spec.stars ?? false,
    cloud: c(spec.cloud),
    farHills: c(spec.farHills),
    nearHills: c(spec.nearHills),
    mist: c(spec.mist),
    rock: c(spec.rock),
    highlight: c(spec.highlight),
    stone: c(spec.stone),
    ground: c(spec.ground),
    groundDark: c(spec.groundDark),
    grass: c(spec.grass),
    tree: c(spec.tree),
    flower: c(spec.flower),
    weather: spec.weather,
  };
}

export const REALMS: readonly Realm[] = [
  realm({
    name: 'Golden Dusk',
    sky: ['#2e2a5c', '#8d4f86', '#e9837a', '#fbd18f'],
    orb: '#fff3cf',
    glow: '#ffc77a',
    orbX: 0.64,
    orbY: 0.47,
    orbRadius: 0.14,
    cloud: '#ffd9c2',
    farHills: '#b58fb0',
    nearHills: '#5a3a66',
    mist: '#f8cfa6',
    rock: '#4b3355',
    highlight: '#d98a6f',
    stone: '#9a7f98',
    ground: '#5b3d5b',
    groundDark: '#241a33',
    grass: '#e29a54',
    tree: '#d8674f',
    flower: '#ffe08a',
    weather: 'ember',
  }),
  realm({
    name: 'Moonlit Pass',
    sky: ['#0b1433', '#1f3f72', '#5f8fb8', '#cfe3ee'],
    orb: '#f6fbff',
    glow: '#a9d4ff',
    orbX: 0.58,
    orbY: 0.3,
    orbRadius: 0.18,
    moon: true,
    stars: true,
    cloud: '#c9dcf0',
    farHills: '#9db6d2',
    nearHills: '#3d5a82',
    mist: '#dcebf5',
    rock: '#2e4468',
    highlight: '#dfeefa',
    stone: '#8ea6c2',
    ground: '#b9d0e2',
    groundDark: '#4e6f95',
    grass: '#f4fbff',
    tree: '#6f8fb0',
    flower: '#ffffff',
    weather: 'snow',
  }),
  realm({
    name: 'Autumn Vale',
    sky: ['#4f8f9c', '#a9cfc0', '#f6dfae', '#f3a56b'],
    orb: '#fffbe6',
    glow: '#ffe2a0',
    orbX: 0.7,
    orbY: 0.36,
    orbRadius: 0.1,
    cloud: '#fff4e0',
    farHills: '#d9a17a',
    nearHills: '#8f4a36',
    mist: '#fbe6c4',
    rock: '#6b3a2e',
    highlight: '#f0a865',
    stone: '#b08f74',
    ground: '#7a4630',
    groundDark: '#3a1f1c',
    grass: '#e8892f',
    tree: '#d9482b',
    flower: '#ffd34d',
    weather: 'leaf',
  }),
  realm({
    name: 'Storm Cliffs',
    sky: ['#161c2a', '#36465c', '#6f8496', '#b7c2c4'],
    orb: '#e9f1f5',
    glow: '#b9cbd6',
    orbX: 0.38,
    orbY: 0.27,
    orbRadius: 0.08,
    moon: true,
    cloud: '#55647a',
    farHills: '#7d8fa0',
    nearHills: '#2f3b4b',
    mist: '#aebcc4',
    rock: '#252e3c',
    highlight: '#8fa3b3',
    stone: '#6a798b',
    ground: '#34404e',
    groundDark: '#141a24',
    grass: '#7fa08f',
    tree: '#3f5a58',
    flower: '#d7e6ea',
    weather: 'rain',
  }),
  realm({
    name: 'Spirit Realm',
    sky: ['#0e0728', '#3a1670', '#9a3f9e', '#f58fb3'],
    orb: '#ffe3f4',
    glow: '#ff9fe0',
    orbX: 0.6,
    orbY: 0.34,
    orbRadius: 0.2,
    moon: true,
    ring: true,
    stars: true,
    cloud: '#b98ae8',
    farHills: '#8f6fe0',
    nearHills: '#3a1f7a',
    mist: '#f0a8d8',
    rock: '#2a1560',
    highlight: '#c79bff',
    stone: '#8a6fd0',
    ground: '#2c1a5e',
    groundDark: '#120a30',
    grass: '#7ff0e0',
    tree: '#ff8fd0',
    flower: '#fff3a8',
    weather: 'wisp',
  }),
];

export const REALM_COUNT = REALMS.length;

export function realmAt(index: number): Realm {
  return REALMS[((index % REALM_COUNT) + REALM_COUNT) % REALM_COUNT] as Realm;
}
