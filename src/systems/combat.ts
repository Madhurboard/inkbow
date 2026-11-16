/** Damage in both directions, kills, and the player's actions (shoot, shield, spirit arrows, Starfall). */
import { sfx } from '../audio/audio';
import { BALANCE } from '../config';
import { hexToRgb } from '../core/color';
import { gaussian, lerp } from '../core/math';
import { ARROW_TYPES } from '../data/enemies';
import { BOW_TIERS, SPIRIT_ARROWS } from '../data/progression';
import type { ArrowTypeId, Enemy, EnemyArrow, Game, PlayerArrow, SpiritArrowId } from '../state/types';
import { addDecal, burst, floatText, particle, ring, wisps } from './effects';
import { addInk, addSpirit, addXp, breakCombo, bumpCombo, scoreMultiplier } from './rewards';
import {
  bowDamageMultiplier,
  bowTierIndex,
  enemyDamageMultiplier,
  recordBossVictory,
  skillLevel,
} from './rules';

const GOLD_TEXT = '#ffe9a8';
const ICE_TEXT = '#cfeaff';

export function bodyCenterY(game: Game, enemy: Enemy, fraction = 0.5): number {
  return enemy.y - enemy.height * fraction * game.layout.scale * enemy.scale;
}

function bowMultiplier(game: Game): number {
  return bowDamageMultiplier(game.save.kills);
}

export function createPlayerArrow(
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number,
  extra: Partial<PlayerArrow> = {},
): PlayerArrow {
  return {
    x,
    y,
    vx,
    vy,
    trail: [],
    damage,
    pierce: 0,
    ricochet: 0,
    hit: new Set(),
    age: 0,
    guided: false,
    target: null,
    special: null,
    powerShot: false,
    stuck: null,
    dead: false,
    ...extra,
  };
}

// ---------------------------------------------------------------------------------------------
// Damage to the player
// ---------------------------------------------------------------------------------------------

/** Death is handled by the run loop on the next frame, so a revive can step in. */
export function hurtPlayer(game: Game, amount: number, type?: ArrowTypeId): void {
  if (game.phase !== 'play') return;
  const { run, layout } = game;
  const s = layout.scale;
  run.hp -= amount;
  run.hurtTime = 0.35;
  run.shake = Math.max(run.shake, 7);
  game.ui.vibrate(40);
  breakCombo(game);
  sfx.hurt();
  floatText(game, `-${Math.round(amount)}`, layout.archerX + 10 * s, layout.archerY - 44 * s, '#ff8a7a', 20);
  burst(game, layout.archerX, layout.archerY, '#d63a31', 8, 0.7);
  if (type === 'fire') run.burn = BALANCE.status.burnDuration;
  if (type === 'poison') run.poison = BALANCE.status.poisonDuration;
  if (type === 'ice') {
    run.frost = BALANCE.status.frostDuration;
    floatText(game, 'Chilled', layout.archerX + 20 * s, layout.archerY - 64 * s, '#bfeeff', 16);
  }
}

function showBlocked(game: Game): void {
  const { layout } = game;
  sfx.block();
  floatText(
    game,
    'Blocked',
    layout.archerX + 40 * layout.scale,
    layout.archerY - 50 * layout.scale,
    ICE_TEXT,
    15,
  );
}

/** An enemy arrow reached the archer: block, deflect, or take the hit. */
export function struckByEnemyArrow(game: Game, arrow: EnemyArrow): void {
  const { run } = game;
  const color = ARROW_TYPES[arrow.type].color;
  if (run.shieldTime > 0) {
    if (run.shieldAge < BALANCE.player.deflectWindow) deflect(game, arrow);
    else {
      showBlocked(game);
      burst(game, arrow.x, arrow.y, color, 8, 0.6);
    }
    return;
  }
  if (arrow.type === 'boom') {
    explodeEnemyArrow(game, arrow);
    return;
  }
  hurtPlayer(game, ARROW_TYPES[arrow.type].damage * enemyDamageMultiplier(run.wave), arrow.type);
  addDecal(game, arrow.x, arrow.y, color, 0.7);
}

/** A shield raised at the last moment sends the arrow back at its archer. */
function deflect(game: Game, arrow: EnemyArrow): void {
  const { layout } = game;
  const s = layout.scale;
  sfx.deflect();
  floatText(game, 'Perfect deflect!', layout.archerX + 50 * s, layout.archerY - 60 * s, GOLD_TEXT, 22);
  game.run.slowTime = 0.35;
  bumpCombo(game);
  addSpirit(game, BALANCE.spirit.deflect);
  addXp(game, BALANCE.xp.deflect);
  const target = arrow.owner && game.enemies.includes(arrow.owner) ? arrow.owner : (game.enemies[0] ?? null);
  const angle = target ? Math.atan2(bodyCenterY(game, target) - arrow.y, target.x - arrow.x) : -0.5;
  const speed = 1000 * s;
  game.arrows.push(
    createPlayerArrow(
      arrow.x,
      arrow.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      game.stats.damage * BALANCE.special.deflectDamage * bowMultiplier(game),
      { guided: true, target },
    ),
  );
}

export function explodeEnemyArrow(game: Game, arrow: EnemyArrow): void {
  const { run, layout } = game;
  const s = layout.scale;
  const color = ARROW_TYPES[arrow.type].color;
  sfx.boom();
  run.shake = Math.max(run.shake, 12);
  burst(game, arrow.x, arrow.y, color, 26, 1.5);
  addDecal(game, arrow.x, arrow.y, color, 1.8);
  ring(game, arrow.x, arrow.y, 78 * s, hexToRgb(color));
  const radius = 80 * s;
  const d = Math.hypot(arrow.x - layout.archerX, arrow.y - layout.archerY);
  if (d >= radius) return;
  if (run.shieldTime > 0) showBlocked(game);
  else
    hurtPlayer(
      game,
      ARROW_TYPES.boom.damage * (1 - (d / radius) * 0.6) * enemyDamageMultiplier(run.wave),
      'boom',
    );
}

// ---------------------------------------------------------------------------------------------
// Damage to enemies
// ---------------------------------------------------------------------------------------------

export function hitEnemy(game: Game, enemy: Enemy, arrow: PlayerArrow, headshot: boolean): void {
  const { run, layout, stats } = game;
  const s = layout.scale;
  const damage = arrow.damage * (headshot ? stats.critMultiplier : 1);
  enemy.hp -= damage;
  enemy.flash = 0.16;
  enemy.knockback = 5 * s;
  if (stats.burn) enemy.burn = BALANCE.status.enemyBurnDuration;
  if (arrow.special === 'gale' && enemy.kind === 'walker' && enemy.type !== 'giant') {
    enemy.x += 46 * s;
    enemy.state = 'walk';
  }
  if (headshot && enemy.x - layout.archerX > layout.width * 0.55 && !arrow.guided) {
    floatText(game, 'Deadeye!', enemy.x, enemy.y - (enemy.height + 26) * s * enemy.scale, GOLD_TEXT, 17);
    run.score += BALANCE.score.deadeye;
  }
  addDecal(game, arrow.x, arrow.y, enemy.accent, headshot ? 1.2 : 0.8);
  burst(game, arrow.x, arrow.y, enemy.accent, headshot ? 12 : 6, headshot ? 1 : 0.7);
  floatText(
    game,
    headshot ? `${Math.round(damage)}!` : Math.round(damage),
    arrow.x,
    arrow.y - 12 * s,
    headshot ? '#ffe07a' : '#fff',
    headshot ? 24 : 17,
  );
  run.hitStop = headshot ? 0.07 : 0.035;
  if (headshot) {
    run.slowTime = Math.max(run.slowTime, 0.22);
    run.shake = Math.max(run.shake, 5);
    sfx.crit();
    game.ui.vibrate(12);
  }
  sfx.hit();
  if (enemy.hp <= 0) killEnemy(game, enemy);
}

/** Damage that is not from a direct arrow hit (explosions, lightning, burning). */
export function damageEnemy(game: Game, enemy: Enemy, amount: number, color: string): void {
  enemy.hp -= amount;
  enemy.flash = 0.16;
  floatText(game, Math.round(amount), enemy.x, bodyCenterY(game, enemy) - 14 * game.layout.scale, color, 17);
  if (enemy.hp <= 0) killEnemy(game, enemy);
}

export function killEnemy(game: Game, enemy: Enemy): void {
  if (enemy.dead) return;
  enemy.dead = true;
  const { run, save, layout } = game;
  const s = layout.scale;
  if (enemy.perch !== null) {
    const perch = layout.perches[enemy.perch];
    if (perch?.occupant === enemy) perch.occupant = null;
  }
  const cx = enemy.x;
  const cy = bodyCenterY(game, enemy);
  const isBoss = enemy.kind === 'boss';
  const tierBefore = bowTierIndex(save.kills);

  run.kills++;
  save.kills++;
  addInk(game, isBoss ? BALANCE.ink.boss : enemy.type === 'giant' ? BALANCE.ink.giant : BALANCE.ink.other);
  const value = isBoss
    ? BALANCE.score.boss
    : enemy.type === 'giant'
      ? BALANCE.score.giant
      : enemy.kind === 'rider'
        ? BALANCE.score.rider
        : BALANCE.score.other;
  run.score += Math.round(value * scoreMultiplier(game));
  bumpCombo(game);
  if (run.combo % 5 === 0) floatText(game, `${run.combo} streak!`, cx, cy - 40 * s, GOLD_TEXT, 22);
  else if (enemy.kind === 'rider') floatText(game, 'Skyshot!', cx, cy - 26 * s, '#bfeeff', 17);

  burst(game, cx, cy, enemy.accent, isBoss ? 70 : 18, isBoss ? 1.8 : 1);
  addDecal(game, cx, cy, enemy.accent, isBoss ? 3 : 1.5);
  const wispSpirit = (isBoss ? BALANCE.spirit.bossWisps : BALANCE.spirit.killWisps) * (1 + run.combo * 0.04);
  wisps(game, cx, cy, hexToRgb(enemy.accent), isBoss ? 24 : 6, wispSpirit);

  const xp = BALANCE.xp;
  addXp(
    game,
    isBoss
      ? xp.boss
      : enemy.type === 'giant'
        ? xp.giant
        : enemy.type === 'brute'
          ? xp.brute
          : enemy.kind === 'rider'
            ? xp.rider
            : xp.other,
  );
  if (game.stats.lifesteal) run.hp = Math.min(run.maxHp, run.hp + game.stats.lifesteal);

  if (isBoss) onBossDefeated(game, enemy);

  const tierAfter = bowTierIndex(save.kills);
  if (tierAfter > tierBefore) {
    game.ui.banner(BOW_TIERS[tierAfter]?.name ?? 'New bow', 'Your bow awakens', 2600);
    sfx.perk();
  }
  game.persist();
}

function onBossDefeated(game: Game, boss: Enemy): void {
  const { run } = game;
  game.ui.vibrate(120);
  run.slowTime = 1.2;
  run.shake = 16;
  game.ui.bossBar(null);
  const remaining = game.enemies.filter((e) => e !== boss && !e.dead);
  setTimeout(() => {
    for (const e of remaining) if (game.enemies.includes(e) && game.phase === 'play') killEnemy(game, e);
  }, 200);
  game.enemyArrows = [];
  sfx.spirit();
  const result = recordBossVictory(game.save, run.mode, run.wave, run.hp / run.maxHp);
  run.lastStars = result.stars;
  if (result.won) run.won = true;
}

/** Ember spirit arrow: an explosion that burns everything nearby and clears enemy arrows. */
export function emberBlast(game: Game, arrow: PlayerArrow): void {
  const { run, layout } = game;
  const s = layout.scale;
  const radius = BALANCE.special.emberRadius * s;
  const damage = BALANCE.special.emberDamage * bowMultiplier(game);
  sfx.boom();
  run.shake = Math.max(run.shake, 9);
  burst(game, arrow.x, arrow.y, '#ff8a3c', 24, 1.4);
  addDecal(game, arrow.x, arrow.y, '#ff7a2e', 1.9);
  ring(game, arrow.x, arrow.y, radius, [255, 150, 70]);
  for (const enemy of game.enemies) {
    if (enemy.dead || arrow.hit.has(enemy)) continue;
    if (Math.hypot(enemy.x - arrow.x, bodyCenterY(game, enemy) - arrow.y) < radius + enemy.bodyWidth * s) {
      enemy.burn = BALANCE.status.enemyBurnDuration;
      damageEnemy(game, enemy, damage, '#ffb070');
    }
  }
  for (const other of game.enemyArrows) {
    if (!other.dead && Math.hypot(other.x - arrow.x, other.y - arrow.y) < radius) {
      other.dead = true;
      burst(game, other.x, other.y, ARROW_TYPES[other.type].color, 5, 0.5);
    }
  }
}

/** Storm spirit arrow: lightning jumps from the struck enemy to up to four more nearby. */
export function chainLightning(game: Game, from: Enemy): void {
  const s = game.layout.scale;
  const damage = BALANCE.special.chainDamage * bowMultiplier(game);
  const range = BALANCE.special.chainRange * s;
  const used = new Set<Enemy>([from]);
  let current = from;
  let jumps = 0;
  while (jumps < BALANCE.special.chainJumps) {
    const source = current;
    const next = game.enemies
      .filter((e) => !e.dead && !used.has(e) && Math.hypot(e.x - source.x, e.y - source.y) < range)
      .sort(
        (a, b) => Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y),
      )[0];
    if (!next) break;
    used.add(next);
    const x1 = source.x;
    const y1 = bodyCenterY(game, source);
    const x2 = next.x;
    const y2 = bodyCenterY(game, next);
    const bolt = particle('bolt', x1, y1, [240, 250, 255]);
    bolt.life = 0.25;
    for (let i = 0; i <= 6; i++) {
      const jitter = i % 6 ? 14 * s : 0;
      bolt.points.push(lerp(x1, x2, i / 6) + gaussian() * jitter, lerp(y1, y2, i / 6) + gaussian() * jitter);
    }
    game.particles.push(bolt);
    burst(game, x2, y2, '#9fd0ff', 5, 0.6, 'dot');
    damageEnemy(game, next, damage, '#bfe0ff');
    current = next;
    jumps++;
  }
  if (jumps) sfx.zap();
}

/** A player arrow met an enemy arrow in the air. */
export function interceptEnemyArrow(game: Game, arrow: PlayerArrow, target: EnemyArrow): void {
  const s = game.layout.scale;
  const color = ARROW_TYPES[target.type].color;
  target.dead = true;
  sfx.parry();
  burst(game, target.x, target.y, color, 10, 0.8);
  addDecal(game, target.x, target.y, color, 0.6);
  floatText(game, 'Intercept!', target.x, target.y - 10 * s, GOLD_TEXT, 15);
  bumpCombo(game);
  addXp(game, BALANCE.xp.intercept);
  addSpirit(game, BALANCE.spirit.intercept);
  game.run.score += Math.round(BALANCE.score.intercept * scoreMultiplier(game));
  game.run.slowTime = Math.max(game.run.slowTime, 0.08);
  if (target.type === 'boom') {
    target.x = arrow.x;
    explodeEnemyArrow(game, target);
  }
}

export function collectLantern(game: Game): void {
  const lantern = game.lantern;
  if (!lantern) return;
  const { run } = game;
  game.lantern = null;
  addInk(game, BALANCE.ink.lantern);
  run.hp = Math.min(run.maxHp, run.hp + BALANCE.lantern.heal);
  addSpirit(game, BALANCE.spirit.lantern);
  run.score += BALANCE.score.lantern;
  burst(game, lantern.x, lantern.y, '#ffd76a', 22, 1.1);
  addDecal(game, lantern.x, lantern.y, '#ffd76a', 1.2);
  floatText(
    game,
    `+${BALANCE.ink.lantern} ink`,
    lantern.x,
    lantern.y - 14 * game.layout.scale,
    GOLD_TEXT,
    20,
  );
  sfx.perk();
}

// ---------------------------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------------------------

const canAct = (game: Game) => game.phase === 'play' && !game.paused;

export function selectSpiritArrow(game: Game, id: SpiritArrowId): void {
  if (!canAct(game)) return;
  const { run, layout } = game;
  if (run.spirit < run.spiritCost) {
    floatText(
      game,
      'Need spirit',
      layout.archerX + 34 * layout.scale,
      layout.archerY - 62 * layout.scale,
      GOLD_TEXT,
      15,
    );
    return;
  }
  run.selectedSpirit = run.selectedSpirit === id ? null : id;
  const key = `spirit:${id}`;
  if (!game.seen.has(key)) {
    game.seen.add(key);
    game.ui.hint(SPIRIT_ARROWS[id].hint);
  }
}

/** Loose arrows at `angle` (radians) with `power` 0–1. */
export function shoot(game: Game, angle: number, power: number, powerShot: boolean): void {
  const { run, stats, layout } = game;
  const s = layout.scale;
  const shot = BALANCE.shot;
  let special = run.selectedSpirit;
  if (special && run.spirit < run.spiritCost) special = run.selectedSpirit = null;
  if (special) {
    run.spirit -= run.spiritCost;
    if (run.spirit < run.spiritCost) run.selectedSpirit = null;
    if (special === 'storm') sfx.zap();
  }
  if (powerShot) sfx.ping();
  run.charge = 0;
  run.reloadTimer = stats.reloadTime * (run.frost > 0 ? BALANCE.status.frostReloadPenalty : 1);
  run.shots++;
  const gale = special === 'gale';
  const count = stats.multishot + (gale ? shot.galeExtraArrows : 0);
  const speed = (shot.minSpeed + shot.speedRange * power) * s * (gale ? 1.1 : 1);
  const damage =
    stats.damage * bowMultiplier(game) * (0.75 + power * 0.35) * (powerShot ? shot.powerShotDamage : 1);
  for (let i = 0; i < count; i++) {
    const a = angle + (i - (count - 1) / 2) * shot.multishotSpread;
    game.arrows.push(
      createPlayerArrow(
        layout.archerX + Math.cos(a) * 20 * s,
        layout.archerY + Math.sin(a) * 20 * s,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        damage,
        {
          pierce: stats.pierce + (gale ? shot.galeExtraPierce : 0) + (powerShot ? 1 : 0),
          ricochet: stats.ricochet,
          special,
          powerShot,
        },
      ),
    );
  }
  sfx.shoot(power);
  run.drawAmount = -0.12;
}

export function raiseShield(game: Game): void {
  const { run } = game;
  if (run.shieldCooldown > 0 || !canAct(game)) return;
  run.shieldTime = BALANCE.player.shieldDuration;
  run.shieldAge = 0;
  run.shieldCooldown = game.stats.shieldCooldown;
  sfx.shield();
}

/** Spend a full spirit meter: clear enemy arrows and drop guided arrows on every enemy. */
export function starfall(game: Game): boolean {
  const { run, layout } = game;
  if (run.spirit < 100 || !canAct(game)) return false;
  const s = layout.scale;
  run.spirit = 0;
  sfx.spirit();
  run.slowTime = 0.6;
  run.flash = 0.5;
  run.shake = 8;
  game.ui.banner('Starfall', '', 900);
  for (const a of game.enemyArrows) burst(game, a.x, a.y, ARROW_TYPES[a.type].color, 6, 0.6);
  game.enemyArrows = [];
  const damage = BALANCE.special.starfallDamage * bowMultiplier(game);
  const strikesPerTarget = 1 + skillLevel(game.save, 'twinStars');
  game.enemies.forEach((enemy, i) => {
    const strikes = (enemy.kind === 'boss' ? 5 : enemy.type === 'giant' ? 3 : 1) * strikesPerTarget;
    for (let j = 0; j < strikes; j++) {
      const sx = enemy.x + gaussian() * 60 * s - 80 * s;
      const sy = -30 - i * 40 - j * 70;
      const angle = Math.atan2(bodyCenterY(game, enemy, 0.6) - sy, enemy.x - sx);
      const speed = 1100 * s;
      game.arrows.push(
        createPlayerArrow(sx, sy, Math.cos(angle) * speed, Math.sin(angle) * speed, damage, {
          guided: true,
          target: enemy,
        }),
      );
    }
  });
  return true;
}
