/** The browser implementation of UiPort: banners, hints, combo text, boss bar and transitions. */
import type { Settings } from '../state/save';
import type { UiPort } from '../state/types';
import { byId } from './dom';

export interface BrowserUiHooks {
  requestPerks(): void;
  runEnded(win: boolean): void;
  settings(): Settings;
}

export function createBrowserUi(hooks: BrowserUiHooks): UiPort {
  const banner = byId('banner');
  const bannerTitle = banner.firstElementChild as HTMLElement;
  const bannerSubtitle = banner.lastElementChild as HTMLElement;
  const hint = byId('hint');
  const combo = byId('combo');
  const bossBar = byId('boss');
  const bossFill = bossBar.querySelector('i') as HTMLElement;
  const fade = byId('fade');
  let bannerTimer = 0;
  let hintTimer = 0;

  return {
    banner(title, subtitle = '', durationMs = 2000) {
      bannerTitle.textContent = title;
      bannerSubtitle.textContent = subtitle;
      banner.style.opacity = '1';
      clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => (banner.style.opacity = '0'), durationMs);
    },
    hint(text, durationMs = 3600) {
      hint.textContent = text;
      hint.style.opacity = '1';
      clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => (hint.style.opacity = '0'), durationMs);
    },
    combo(count, multiplier) {
      combo.textContent = count > 1 ? `${count} combo  ×${multiplier.toFixed(1)}` : '';
      combo.style.opacity = count > 1 ? '1' : '0';
    },
    bossBar(name) {
      bossBar.style.display = name ? 'block' : 'none';
      if (name) {
        (bossBar.firstElementChild as HTMLElement).textContent = name;
        bossFill.style.width = '100%';
      }
    },
    bossHealth(fraction) {
      bossFill.style.width = `${fraction * 100}%`;
    },
    waveLabel(wave) {
      byId('wave').textContent = `Wave ${wave}`;
    },
    requestPerks: () => hooks.requestPerks(),
    realmTransition(atMidpoint) {
      fade.style.opacity = '1';
      window.setTimeout(() => {
        atMidpoint();
        fade.style.opacity = '0';
      }, 700);
    },
    runEnded: (win) => hooks.runEnded(win),
    vibrate(ms) {
      if (!hooks.settings().haptics || !('vibrate' in navigator)) return;
      try {
        navigator.vibrate(ms);
      } catch {
        // Some browsers throw when vibration is blocked; it is only a nicety.
      }
    },
  };
}
