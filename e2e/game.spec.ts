/** Browser tests: the built game, played by a scripted archer on desktop and phone viewports. */
import { type Page, expect, test } from '@playwright/test';

interface DebugApi {
  game: {
    phase: string;
    paused: boolean;
    run: { wave: number; score: number; kills: number; hp: number; pendingPerks: number };
    save: { ink: number; kills: number; skills: Record<string, number>; settings: { music: boolean } };
    enemies: { x: number; y: number; height: number; scale: number }[];
    layout: { archerX: number; archerY: number; scale: number };
  };
  spawn(type: string): void;
}

declare global {
  interface Window {
    __inkbow: DebugApi;
  }
}

/** Collect uncaught errors and console errors so every test can assert there were none. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function openGame(page: Page): Promise<void> {
  await page.goto('/?debug');
  await expect(page.locator('#loader')).toHaveClass(/done/, { timeout: 10_000 });
  await expect(page.locator('#menu')).toBeVisible();
}

/** Aim at the first enemy using the real drag gesture, solving the arc for a full-power shot. */
async function shootAtEnemy(page: Page): Promise<void> {
  const target = await page.evaluate(() => {
    const { game } = window.__inkbow;
    const e = game.enemies[0];
    if (!e) return null;
    const s = game.layout.scale;
    return {
      ex: e.x,
      ey: e.y - e.height * 0.6 * s * e.scale,
      ax: game.layout.archerX,
      ay: game.layout.archerY,
      s,
    };
  });
  if (!target) return;
  const v = 1230 * target.s;
  const g = 950 * target.s;
  const dx = target.ex - target.ax;
  const dy = target.ey - target.ay;
  const disc = v ** 4 - g * (g * dx * dx - 2 * dy * v * v);
  const angle = disc > 0 ? -Math.atan((v * v - Math.sqrt(disc)) / (g * dx)) : Math.atan2(dy, dx);
  const viewport = page.viewportSize() ?? { width: 800, height: 600 };
  const sx = viewport.width / 2;
  const sy = viewport.height * 0.6;
  const pull = 118 * target.s;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx - Math.cos(angle) * pull, sy - Math.sin(angle) * pull, { steps: 3 });
  await page.waitForTimeout(80);
  await page.mouse.up();
}

async function pickPerkIfShown(page: Page): Promise<void> {
  const card = page.locator('#perks .pk').first();
  if (await card.isVisible()) await card.click();
}

test('menu loads without errors and shows five realms', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await expect(page.locator('#mRealms button')).toHaveCount(5);
  await expect(page.locator('#mRealms button').nth(1)).toBeDisabled();
  await expect(page.locator('#bEndless')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a scripted archer clears enemies in realm 1', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await page.locator('#bPlay').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.evaluate(() => {
    window.__inkbow.game.run.hp = 1e6; // the bot is slow; keep it alive to test scoring
  });
  for (let i = 0; i < 40; i++) {
    await pickPerkIfShown(page);
    await shootAtEnemy(page);
    await page.waitForTimeout(250);
  }
  const run = await page.evaluate(() => window.__inkbow.game.run);
  expect(run.kills).toBeGreaterThan(3);
  expect(run.score).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__inkbow.game.save.ink)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('skills and settings survive a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await page.evaluate(() => {
    window.__inkbow.game.save.ink = 100;
  });
  await page.locator('#bTree').click();
  await page.locator('#tBody .nd').first().click();
  await page.locator('#bBack').click();
  await page.locator('#bSet').click();
  await page.locator('#bMusic').click();
  await expect(page.locator('#bMusic')).toHaveText('Music: off');

  await page.reload();
  await expect(page.locator('#loader')).toHaveClass(/done/);
  const save = await page.evaluate(() => window.__inkbow.game.save);
  expect(save.skills).toEqual({ sharpenedTips: 1 });
  expect(save.ink).toBe(80);
  expect(save.settings.music).toBe(false);
  expect(errors).toEqual([]);
});

test('progress from the old single-file version is kept', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('inkbow.save')) return;
    localStorage.setItem(
      'inkbow1',
      JSON.stringify({
        best: 500,
        kills: 60,
        ink: 90,
        sk: { o1: 1 },
        stars: [2, 0, 0, 0, 0],
        unlock: 2,
        endless: true,
      }),
    );
  });
  await openGame(page);
  await expect(page.locator('#mRealms button').nth(1)).toBeEnabled();
  await expect(page.locator('#bEndless')).toBeEnabled();
  await expect(page.locator('#bTree')).toContainText('90');
  await expect(page.locator('#mBow')).toContainText('Moonsteel Bow');
});

test('pause, resume and quit to menu', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await page.locator('#bPlay').click();
  await page.locator('#bPause').click();
  await expect(page.locator('#pause')).toBeVisible();
  expect(await page.evaluate(() => window.__inkbow.game.paused)).toBe(true);
  await page.locator('#bResume').click();
  expect(await page.evaluate(() => window.__inkbow.game.paused)).toBe(false);
  await page.locator('#bPause').click();
  await page.locator('#bQuit').click();
  await expect(page.locator('#menu')).toBeVisible();
  expect(await page.evaluate(() => window.__inkbow.game.phase)).toBe('menu');
  expect(errors).toEqual([]);
});

test('a lost run shows the game-over screen and can be retried', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await page.locator('#bPlay').click();
  await page.evaluate(() => {
    window.__inkbow.game.run.hp = 0;
  });
  await expect(page.locator('#over')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#oTitle')).toHaveText('The light fades');
  await page.locator('#bRetry').click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => window.__inkbow.game.run.wave)).toBe(1);
  expect(errors).toEqual([]);
});
