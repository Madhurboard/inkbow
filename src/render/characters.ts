/**
 * Painted character art: loads the WebP sprites made by tools/prepare_characters.py and hands
 * out copies pre-scaled to the size they are drawn at (sharper and faster than scaling a large
 * image every frame), plus solid-colour silhouettes for hit flashes.
 */
import manifest from '../assets/characters/manifest.json';
import type { Enemy } from '../state/types';
import { createCanvas } from './paint';

const urls = import.meta.glob<string>('../assets/characters/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export interface ArtInfo {
  width: number;
  height: number;
  anchorX: number;
}

const BOSS_ART = [
  'boss-hollow-king',
  'boss-frost-warden',
  'boss-ember-stag',
  'boss-storm-caller',
  'boss-void-monarch',
];

/** Which painting an enemy uses. */
export function enemyArtKey(enemy: Enemy, realm: number): string {
  switch (enemy.kind) {
    case 'archer':
      return `archer-${enemy.arrowType}`;
    case 'walker':
      return `walker-${enemy.type}`;
    case 'rider':
      return 'rider';
    case 'boss': {
      const index = BOSS_ART.length ? ((realm % BOSS_ART.length) + BOSS_ART.length) % BOSS_ART.length : 0;
      return BOSS_ART[index] ?? 'boss-hollow-king';
    }
  }
}

export class CharacterArt {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly cache = new Map<string, HTMLCanvasElement>();
  ready = false;

  /** Resolves once every sprite has loaded or failed. Drawing falls back to code art until then. */
  load(): Promise<void> {
    const entries = Object.entries(urls).map(([path, url]) => {
      const name = path.split('/').pop()?.replace('.webp', '') ?? path;
      const image = new Image();
      image.decoding = 'async';
      const loaded = new Promise<boolean>((resolve) => {
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
      });
      image.src = url;
      this.images.set(name, image);
      return loaded;
    });
    return Promise.all(entries).then((results) => {
      this.ready = results.length > 0 && results.every(Boolean);
    });
  }

  info(key: string): ArtInfo | null {
    return (manifest as Record<string, ArtInfo>)[key] ?? null;
  }

  /**
   * The sprite scaled to `pixelHeight` (rounded up to an 8-px step so small size changes reuse
   * the cache). With `tint`, a solid silhouette in that colour.
   */
  get(name: string, pixelHeight: number, tint?: string): HTMLCanvasElement | null {
    if (!this.ready) return null;
    const image = this.images.get(name);
    if (!image || !image.naturalHeight) return null;
    const height = Math.max(8, Math.ceil(Math.min(pixelHeight, image.naturalHeight) / 8) * 8);
    const key = `${name}@${height}${tint ? `:${tint}` : ''}`;
    let canvas = this.cache.get(key);
    if (!canvas) {
      canvas = tint ? this.silhouette(name, height, tint) : this.downscale(image, height);
      this.cache.set(key, canvas);
    }
    return canvas;
  }

  /** Halve repeatedly, then a final step: much smoother than one big downscale. */
  private downscale(image: HTMLImageElement, height: number): HTMLCanvasElement {
    let source: CanvasImageSource = image;
    let w = image.naturalWidth;
    let h = image.naturalHeight;
    while (h / 2 >= height) {
      w = Math.round(w / 2);
      h = Math.round(h / 2);
      const [step, c] = createCanvas(w, h);
      c.imageSmoothingQuality = 'high';
      c.drawImage(source, 0, 0, w, h);
      source = step;
    }
    const width = Math.round((image.naturalWidth * height) / image.naturalHeight);
    const [out, c] = createCanvas(width, height);
    c.imageSmoothingQuality = 'high';
    c.drawImage(source, 0, 0, width, height);
    return out;
  }

  private silhouette(name: string, height: number, tint: string): HTMLCanvasElement {
    const base = this.get(name, height);
    const [out, c] = createCanvas(base?.width ?? 1, base?.height ?? 1);
    if (base) {
      c.drawImage(base, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = tint;
      c.fillRect(0, 0, out.width, out.height);
    }
    return out;
  }
}
