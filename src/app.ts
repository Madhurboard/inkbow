/** Wires the game together: state, renderer, UI, input, and the frame loop. */
import { bindMusicState, initAudio, resumeAudio } from './audio/audio';
import { SPIRIT_ARROW_ORDER } from './data/progression';
import type { PerkDef } from './data/perks';
import { Renderer } from './render/renderer';
import { clearBattlefield, createGame } from './state/game';
import { computeLayout } from './state/layout';
import { browserStore, loadSave, writeSave } from './state/save';
import type { Game, GameMode } from './state/types';
import { beginAim, moveAim, releaseAim } from './systems/aim';
import { raiseShield, selectSpiritArrow, shoot, starfall } from './systems/combat';
import { updateParticles } from './systems/effects';
import { spawnEnemy } from './systems/enemies';
import { applyPerk, startRun, startWave, stepRun } from './systems/run';
import { updateWeather, initWeather } from './systems/weather';
import { createBrowserUi } from './ui/browser-ui';
import { byId, onPress } from './ui/dom';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';

/** Longest step simulated in one frame, so a stalled tab doesn't teleport everything. */
const MAX_FRAME = 0.034;

export function startApp(): void {
  const isDesktop = matchMedia('(hover:hover) and (pointer:fine)').matches;
  if (isDesktop) document.body.classList.add('pc');

  const store = browserStore();
  const save = loadSave(store);
  // eslint-disable-next-line prefer-const -- assigned once the UI exists
  let screens: Screens;
  let lastRun: { mode: GameMode; realm: number } = { mode: 'campaign', realm: 1 };

  const ui = createBrowserUi({
    requestPerks: () => {
      if (!screens.isOpen('perks')) screens.openPerks();
    },
    runEnded: (win) => {
      window.setTimeout(
        () => {
          hud.clearTint();
          byId('hud').style.display = 'none';
          screens.showGameOver(win);
        },
        win ? 1700 : 900,
      );
    },
    settings: () => game.save.settings,
  });
  const game: Game = createGame(save, ui, () => writeSave(store, game.save));
  const canvas = byId<HTMLCanvasElement>('c');
  const renderer = new Renderer(canvas);
  const hud = new Hud((text) => ui.hint(text), isDesktop);

  const begin = (mode: GameMode, realm: number) => {
    initAudio();
    resumeAudio();
    lastRun = { mode, realm };
    screens.hideAll();
    byId('hud').style.display = 'block';
    startRun(game, mode, realm);
    lastFrame = performance.now();
    if (mode === 'campaign' && realm === 1) {
      ui.hint(
        isDesktop
          ? 'Click and drag anywhere, pull back and release to shoot'
          : 'Drag anywhere, pull back and release to shoot',
        5000,
      );
    }
  };

  const pause = () => {
    if (game.phase !== 'play' || screens.isOpen('perks')) return;
    game.paused = true;
    game.aim = null;
    screens.open('pause');
  };

  screens = new Screens(
    game,
    {
      startCampaign: (realm) => begin('campaign', realm),
      startEndless: () => begin('endless', 1),
      restart: () => begin(lastRun.mode, lastRun.realm),
      quitToMenu: () => {
        game.phase = 'menu';
        game.paused = false;
        clearBattlefield(game);
        byId('hud').style.display = 'none';
        hud.clearTint();
        ui.bossBar(null);
        screens.open('menu');
      },
      resume: () => {
        game.paused = false;
        lastFrame = performance.now();
        if (game.phase === 'play') screens.hideAll();
        else screens.open('menu');
      },
      choosePerk: (perk: PerkDef) => {
        applyPerk(game, perk);
        if (game.run.pendingPerks > 0) {
          screens.openPerks();
          return;
        }
        screens.hideAll();
        game.paused = false;
        lastFrame = performance.now();
      },
    },
    isDesktop,
  );
  bindMusicState(() => ({ wave: game.phase === 'play' ? game.run.wave : 0, paused: game.paused }));

  // --- Layout ----------------------------------------------------------------------------------

  const layout = () => {
    const oldPerches = game.layout.perches;
    game.layout = computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio);
    // Keep perched enemies on their (moved) perches; put ground enemies back on the ground.
    oldPerches.forEach((perch, i) => {
      const next = game.layout.perches[i];
      if (perch.occupant && next) {
        next.occupant = perch.occupant;
        perch.occupant.x = next.x;
        perch.occupant.y = next.y;
      }
    });
    for (const e of game.enemies) if (e.perch === null && e.kind !== 'rider') e.y = game.layout.groundY;
    renderer.resize(game.layout);
  };
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 200);
  });

  // --- Input -----------------------------------------------------------------------------------

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      raiseShield(game);
      return;
    }
    if (beginAim(game, event.pointerId, event.clientX, event.clientY)) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture can fail for synthetic events; aiming still works without it.
      }
      event.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', (event) =>
    moveAim(game, event.pointerId, event.clientX, event.clientY),
  );
  const release = (event: PointerEvent) => {
    const shot = releaseAim(game, event.pointerId, event.type === 'pointercancel');
    if (shot) shoot(game, shot.angle, shot.power, shot.powerShot);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  onPress(byId('bShield'), () => raiseShield(game));
  onPress(byId('bSpirit'), () => starfall(game));
  for (const button of document.querySelectorAll<HTMLElement>('.ab')) {
    const id = SPIRIT_ARROW_ORDER.find((a) => a === button.dataset.a);
    if (id) onPress(button, () => selectSpiritArrow(game, id));
  }
  byId('bPause').onclick = pause;

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (event.code === 'Space') {
      event.preventDefault();
      if (screens.isOpen('menu')) begin('campaign', screens.selectedRealm);
      else raiseShield(game);
    } else if (key === 'q') raiseShield(game);
    else if (key === 'e' || key === 'f') starfall(game);
    else if (key === '1' || key === '2' || key === '3') {
      const index = Number(key) - 1;
      if (screens.isOpen('perks')) screens.choosePerkByIndex(index);
      else {
        const id = SPIRIT_ARROW_ORDER[index];
        if (id) selectSpiritArrow(game, id);
      }
    } else if (key === 'escape' || key === 'p') {
      if (screens.isOpen('pause')) byId('bResume').click();
      else pause();
    } else if (key === 'enter') {
      if (screens.isOpen('menu')) begin('campaign', screens.selectedRealm);
      else if (screens.isOpen('over')) begin(lastRun.mode, lastRun.realm);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.phase === 'play' && !game.paused) pause();
  });

  // --- Frame loop ------------------------------------------------------------------------------

  let lastFrame = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(MAX_FRAME, (now - lastFrame) / 1000);
    lastFrame = now;
    if (renderer.ensureScene(game)) initWeather(game);
    if (!game.paused) {
      game.time += dt;
      renderer.updateAmbient(game, dt);
      updateWeather(game, dt);
      if (game.phase === 'play') stepRun(game, dt);
      else updateParticles(game, dt);
    }
    renderer.draw(game);
    hud.update(game);
    requestAnimationFrame(frame);
  };

  layout();
  screens.open('menu');
  requestAnimationFrame(frame);

  if (new URLSearchParams(location.search).has('debug')) {
    Object.assign(window, {
      __inkbow: {
        game,
        begin,
        spawn: (type: Parameters<typeof spawnEnemy>[1]) => spawnEnemy(game, type),
        startWave: (wave: number) => startWave(game, wave),
        setRealm: (realm: number) => {
          game.run.realm = realm;
        },
      },
    });
  }
}
