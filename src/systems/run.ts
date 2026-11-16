/** The run loop: starting runs and waves, stepping the simulation, and ending the run. */
import { sfx } from '../audio/audio';
import { BALANCE } from '../config';
import { TAU, clamp, gaussian, lerp, random } from '../core/math';
import type { PerkDef } from '../data/perks';
import { bossForRealm } from '../data/progression';
import { realmAt } from '../data/realms';
import { resetRun } from '../state/game';
import type { Game, GameMode } from '../state/types';
import { shoot } from './combat';
import { burst, updateParticles, updateTextsAndDecals } from './effects';
import { spawnEnemy, updateEnemies } from './enemies';
import { updateEnemyArrows, updatePlayerArrows } from './projectiles';
import { addInk, breakCombo } from './rewards';
import { catchUpPerks, firstWaveOfRealm, isBossWave, spawnCap, waveClearHeal } from './rules';
import { buildWave } from './waves';

export function startRun(game: Game, mode: GameMode, realm: number): void {
  resetRun(game, mode, realm);
  game.phase = 'play';
  game.paused = false;
  game.ui.bossBar(null);
  game.ui.combo(0, 1);
  startWave(game, mode === 'campaign' ? firstWaveOfRealm(realm) : 1);
  if (mode === 'campaign' && realm > 1) {
    game.run.pendingPerks = catchUpPerks(realm);
    game.run.level += game.run.pendingPerks;
    game.ui.requestPerks();
  }
}

export function startWave(game: Game, wave: number): void {
  const { run } = game;
  run.wave = wave;
  run.spawnQueue = buildWave(wave, run.mode);
  run.spawnTimer = BALANCE.waves.firstSpawnDelay;
  const realm = realmAt(run.realm);
  if (isBossWave(wave)) game.ui.banner(bossForRealm(run.realm).name, 'Strike it down');
  else game.ui.banner(`Wave ${wave}`, run.mode === 'endless' ? `Endless · ${realm.name}` : realm.name);
  sfx.wave();
  game.ui.waveLabel(wave);
}

export function applyPerk(game: Game, perk: PerkDef): void {
  game.perkPicks.set(perk.id, (game.perkPicks.get(perk.id) ?? 0) + 1);
  perk.apply(game.stats, game.run);
  game.run.pendingPerks = Math.max(0, game.run.pendingPerks - 1);
}

/** End the run, unless Second Wind can revive the archer. */
export function endRun(game: Game, win: boolean): void {
  const { run, save, layout } = game;
  if (!win && run.revives > 0) {
    run.revives--;
    run.hp = run.maxHp * BALANCE.player.reviveHpFraction;
    run.burn = run.poison = run.frost = 0;
    game.enemyArrows = [];
    run.shieldTime = 2.2;
    run.shieldAge = 9;
    run.flash = 0.5;
    run.slowTime = 0.6;
    game.ui.banner('Second Wind', 'You rise again', 1600);
    sfx.spirit();
    burst(game, layout.archerX, layout.archerY, '#ffd76a', 30, 1.3);
    return;
  }
  game.phase = 'over';
  if (win) sfx.spirit();
  else sfx.die();
  if (run.mode === 'endless') save.bestEndless = Math.max(save.bestEndless, run.score);
  else save.bestCampaign = Math.max(save.bestCampaign, run.score);
  game.persist();
  game.aim = null;
  game.ui.runEnded(win);
}

function updatePlayerStatus(game: Game, dt: number): void {
  const { run, layout } = game;
  const s = layout.scale;
  const status = BALANCE.status;
  if (run.comboTimer > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) breakCombo(game);
  }
  if (run.burn > 0) {
    run.burn -= dt;
    run.hp -= status.burnDps * dt;
    if (Math.random() < dt * 14)
      burst(
        game,
        layout.archerX + gaussian() * 8 * s,
        layout.archerY + gaussian() * 20 * s,
        '#ff7a2e',
        1,
        0.3,
        'dot',
      );
  }
  if (run.poison > 0) {
    run.poison -= dt;
    run.hp -= status.poisonDps * dt;
    if (Math.random() < dt * 10)
      burst(
        game,
        layout.archerX + gaussian() * 8 * s,
        layout.archerY + gaussian() * 20 * s,
        '#86d94c',
        1,
        0.3,
        'dot',
      );
  }
  if (run.frost > 0) run.frost -= dt;
}

function updateAiming(game: Game, dt: number): void {
  const { run, layout } = game;
  const s = layout.scale;
  const fullDraw = BALANCE.shot.fullDrawPull * s;
  run.drawAmount = lerp(run.drawAmount, game.aim ? clamp(game.aim.pull / fullDraw, 0, 1) : 0, 0.4);
  if (game.queuedShot && run.reloadTimer <= 0) {
    const shot = game.queuedShot;
    game.queuedShot = null;
    shoot(game, shot.angle, shot.power, shot.powerShot);
  }
  if (game.aim && game.aim.pull >= (BALANCE.shot.fullDrawPull - 2) * s) {
    const before = run.charge;
    run.charge += dt;
    if (before < BALANCE.shot.powerShotHold && run.charge >= BALANCE.shot.powerShotHold) {
      sfx.ping();
      if (!game.seen.has('powerShot')) {
        game.seen.add('powerShot');
        game.ui.hint('Power Shot: hold a full draw for a moment');
      }
    }
  } else {
    run.charge = 0;
  }
}

function updateLantern(game: Game, dt: number): void {
  const { run, layout } = game;
  const s = layout.scale;
  const cfg = BALANCE.lantern;
  run.lanternTimer -= dt;
  if (run.lanternTimer <= 0 && !game.lantern && game.enemies.length > 0) {
    run.lanternTimer = random(cfg.minInterval, cfg.maxInterval);
    const baseY = random(layout.height * 0.17, layout.height * 0.33);
    game.lantern = { x: layout.width + 30, y: baseY, baseY, age: 0, phase: random(TAU) };
    if (!game.seen.has('lantern')) {
      game.seen.add('lantern');
      game.ui.hint('A lantern spirit! Shoot it for ink, health and spirit');
    }
  }
  const lantern = game.lantern;
  if (lantern) {
    lantern.age += dt;
    lantern.x -= 48 * s * dt;
    lantern.y = lantern.baseY + Math.sin(lantern.age * 2 + lantern.phase) * 14 * s;
    if (lantern.x < -40) game.lantern = null;
  }
}

function updateWaves(game: Game, dt: number): void {
  const { run } = game;
  if (run.spawnQueue.length > 0) {
    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0 && game.enemies.length < spawnCap(run.wave)) {
      const next = run.spawnQueue.shift();
      if (next) spawnEnemy(game, next.type);
      run.spawnTimer = run.spawnQueue[0]?.delay ?? 0;
    }
  } else if (game.enemies.length === 0 && run.clearTimer <= 0 && !run.transitioning && run.wave > 0) {
    run.clearTimer = BALANCE.waves.clearPause;
    run.hp = Math.min(run.maxHp, run.hp + waveClearHeal(game.save));
    addInk(game, BALANCE.ink.waveClear);
    const bossWave = isBossWave(run.wave);
    const stars = run.lastStars || 1;
    const title = run.won ? 'Victory' : bossWave ? 'Realm cleansed' : 'Wave cleared';
    const subtitle = bossWave
      ? run.mode === 'campaign'
        ? '★'.repeat(stars) + '☆'.repeat(3 - stars)
        : 'A new sky opens'
      : '';
    game.ui.banner(title, subtitle, 1500);
  }

  if (run.clearTimer > 0) {
    run.clearTimer -= dt;
    if (run.clearTimer <= 0) {
      run.clearTimer = 0;
      if (run.won) endRun(game, true);
      else if (isBossWave(run.wave)) advanceRealm(game);
      else startWave(game, run.wave + 1);
    }
  }
}

function advanceRealm(game: Game): void {
  const run = game.run;
  const nextWave = run.wave + 1;
  run.transitioning = true;
  game.ui.realmTransition(() => {
    // The player may have quit to the menu during the fade.
    if (game.run !== run || game.phase !== 'play') return;
    run.realm++;
    run.transitioning = false;
    startWave(game, nextWave);
  });
}

/** Advance the run by `dt` seconds. Call only while playing and not paused. */
export function stepRun(game: Game, dt: number): void {
  const { run } = game;
  if (run.hitStop > 0) {
    run.hitStop -= dt;
    return;
  }
  if (run.slowTime > 0) {
    run.slowTime -= dt;
    dt *= 0.3;
  }
  run.reloadTimer -= dt;
  run.shieldCooldown -= dt;
  run.shieldTime -= dt;
  run.shieldAge += dt;
  run.hurtTime -= dt;
  run.flash -= dt;
  run.shake *= Math.pow(0.02, dt);

  updatePlayerStatus(game, dt);
  if (run.hp <= 0) {
    endRun(game, false);
    return;
  }
  updateAiming(game, dt);
  updateLantern(game, dt);
  updateWaves(game, dt);
  updateEnemies(game, dt);
  updatePlayerArrows(game, dt);
  updateEnemyArrows(game, dt);
  updateParticles(game, dt);
  updateTextsAndDecals(game, dt);
}
