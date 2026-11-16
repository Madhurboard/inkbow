/**
 * Synthesised sound effects and a generative score, all Web Audio, with no audio files.
 * Every function is a safe no-op until `initAudio()` runs from a user gesture.
 */
import { clamp, pick } from '../core/math';

interface MusicState {
  wave: number;
  paused: boolean;
}

let context: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = false;
let musicOn = true;
let musicClock = 0;
let musicStep = 0;
let melodyIndex = 4;
let readMusicState: () => MusicState = () => ({ wave: 0, paused: false });

export function bindMusicState(read: () => MusicState): void {
  readMusicState = read;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function setMusicEnabled(value: boolean): void {
  musicOn = value;
}

/** Create the audio context. Browsers only allow this after a tap or key press. */
export function initAudio(): void {
  if (context) return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    musicClock = context.currentTime + 0.2;
    setInterval(scheduleMusic, 120);
  } catch {
    context = null;
  }
}

export function resumeAudio(): void {
  if (context?.state === 'suspended') void context.resume();
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.1,
  slide = 0,
  delay = 0,
): void {
  if (!context || !master || muted) return;
  const t = context.currentTime + delay;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), t + duration);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

function noise(duration: number, volume: number, frequency: number, delay = 0): void {
  if (!context || !master || muted) return;
  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = context.currentTime + delay;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = noiseBuffer;
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(t, Math.random() * 0.5, duration + 0.03);
}

export const sfx = {
  zap: () => {
    tone(1800, 0.12, 'square', 0.06, -1200);
    noise(0.12, 0.3, 4200);
  },
  ping: () => tone(1568, 0.18, 'sine', 0.12),
  shoot: (power: number) => {
    noise(0.09, 0.3, 2000);
    tone(190 + power * 140, 0.14, 'triangle', 0.16, -110);
  },
  hit: () => {
    noise(0.07, 0.35, 800);
    tone(150, 0.1, 'sine', 0.25, -70);
  },
  crit: () => {
    tone(880, 0.25, 'sine', 0.16);
    tone(1320, 0.35, 'sine', 0.1, 0, 0.06);
  },
  enemyShoot: () => noise(0.08, 0.1, 1300),
  hurt: () => {
    tone(120, 0.28, 'sawtooth', 0.16, -60);
    noise(0.16, 0.3, 380);
  },
  shield: () => {
    tone(620, 0.3, 'sine', 0.14);
    tone(930, 0.4, 'sine', 0.08);
  },
  deflect: () => {
    tone(1040, 0.2, 'triangle', 0.2);
    tone(1560, 0.45, 'sine', 0.14, 0, 0.05);
  },
  block: () => noise(0.08, 0.3, 2600),
  boom: () => {
    noise(0.5, 0.55, 170);
    tone(70, 0.45, 'sine', 0.4, -35);
  },
  parry: () => {
    tone(1250, 0.09, 'square', 0.05);
    noise(0.05, 0.2, 3200);
  },
  perk: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'sine', 0.13, 0, i * 0.07)),
  spirit: () => {
    [392, 587, 784, 1175].forEach((f, i) => tone(f, 0.7, 'triangle', 0.12, 0, i * 0.05));
    noise(0.8, 0.2, 900);
  },
  die: () => tone(180, 0.9, 'sawtooth', 0.2, -140),
  wave: () => {
    tone(294, 0.5, 'triangle', 0.12);
    tone(440, 0.7, 'triangle', 0.1, 0, 0.15);
  },
};

/** Pentatonic-ish scale for the wandering melody. */
const SCALE = [146.8, 174.6, 196, 220, 261.6, 293.7, 349.2, 392, 440, 523.3];

/** Schedule the next ~300 ms of music: drone, melody, and drums that build with the wave. */
function scheduleMusic(): void {
  const state = readMusicState();
  if (!context || muted || !musicOn || state.paused || context.state !== 'running') return;
  const wave = state.wave;
  const beat = 60 / (70 + Math.min(wave, 12) * 5) / 2;
  while (musicClock < context.currentTime + 0.3) {
    const delay = Math.max(0, musicClock - context.currentTime);
    if (musicStep % 16 === 0) tone(musicStep % 32 ? 55 : 73.4, beat * 15, 'sine', 0.11, 0, delay);
    if (Math.random() < 0.5 + Math.min(wave, 8) * 0.04) {
      melodyIndex = clamp(melodyIndex + pick([-2, -1, -1, 1, 1, 2]), 0, SCALE.length - 1);
      const note = SCALE[melodyIndex] ?? 220;
      tone(note, 0.9, 'triangle', 0.07, 0, delay);
      if (Math.random() < 0.25) tone(note * 2, 0.5, 'sine', 0.03, 0, delay + beat * 0.5);
    }
    const drum =
      wave > 0 &&
      (musicStep % 8 === 0 || (wave > 2 && musicStep % 8 === 5) || (wave > 4 && musicStep % 4 === 2));
    if (drum) {
      noise(0.12, 0.2 + Math.min(wave, 8) * 0.02, 110, delay);
      tone(82, 0.14, 'sine', 0.2, -34, delay);
    }
    musicClock += beat;
    musicStep++;
  }
}
