/** Spawning enemies and running their behaviour each frame. */
import { sfx } from '../audio/audio';
import { BALANCE } from '../config';
import { INK } from '../render/palette';
import { TAU, clamp, pick, random } from '../core/math';
import {
  ARROW_TYPES,
  BODY_SIZES,
  RIDER_ARROWS,
  RIDER_ARROWS_EARLY,
  WALKER_TYPES,
  isArrowType,
  isWalkerType,
} from '../data/enemies';
import { BOSS_SUMMONS, bossForRealm } from '../data/progression';
import { BOSS_PERCH } from '../state/layout';
import type { BodyKey, Enemy, Game, SpawnType } from '../state/types';
import { ENEMY_ART_SCALE, enemyArtHeight } from './bodies';
import { bodyCenterY, hurtPlayer, killEnemy } from './combat';
import { addDecal, burst, floatText } from './effects';
import { enemyFire, launchEnemyArrow } from './projectiles';
import { enemyDamageMultiplier, enemyHealthScale } from './rules';
import { BOSS_PERCHES, allowedPerches } from './waves';

function blankEnemy(type: SpawnType, game: Game): Enemy {
  return {
    type,
    kind: 'walker',
    body: 'sword',
    accent: '#ffffff',
    arrowType: 'normal',
    x: 0,
    y: game.layout.groundY,
    hp: 1,
    maxHp: 1,
    scale: 1,
    bodyWidth: 0,
    height: 0,
    headRadius: 0,
    state: 'idle',
    cooldown: random(0.8, 1.8),
    aimDuration: 0,
    aimRemaining: 0,
    shots: 0,
    appear: 0,
    flash: 0,
    age: 0,
    burn: 0,
    knockback: 0,
    lunge: 0,
    walkPhase: random(6),
    bobPhase: random(TAU),
    perch: null,
    stopX: 0,
    speed: 0,
    damage: 0,
    baseY: 0,
    summonTimer: 0,
    dead: false,
  };
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Screen area a painted figure of `height` covers when standing at (x, y). */
function footprint(x: number, y: number, height: number): Box {
  return { left: x - height * 0.36, right: x + height * 0.36, top: y - height, bottom: y };
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** A perch is usable if it is empty and a figure of `height` there would not overlap anyone perched nearby. */
export function perchFits(game: Game, index: number, height: number, mover: Enemy | null): boolean {
  const perch = game.layout.perches[index];
  if (!perch || (perch.occupant && perch.occupant !== mover)) return false;
  const box = footprint(perch.x, perch.y, height);
  const s = game.layout.scale;
  return !game.enemies.some(
    (e) =>
      e !== mover && !e.dead && e.perch !== null && overlaps(box, footprint(e.x, e.y, enemyArtHeight(e, s))),
  );
}

function plannedHeight(type: 'archer' | 'boss', scale: number): number {
  const factor = type === 'boss' ? BALANCE.enemies.bossScale : 1;
  return BODY_SIZES[type].height * ENEMY_ART_SCALE * factor * scale;
}

function occupyPerch(game: Game, enemy: Enemy, index: number): void {
  const perch = game.layout.perches[index];
  if (!perch) return;
  perch.occupant = enemy;
  enemy.perch = index;
  enemy.x = perch.x;
  enemy.y = perch.y;
}

/** First time an enemy type appears in a run, name it. */
function introduce(game: Game, type: SpawnType): void {
  if (game.seen.has(type)) return;
  game.seen.add(type);
  if (type === 'normal') return;
  if (isArrowType(type)) game.ui.hint(`${ARROW_TYPES[type].archerName}: ${ARROW_TYPES[type].description}`);
  else if (isWalkerType(type)) game.ui.hint(`${WALKER_TYPES[type].name}: ${WALKER_TYPES[type].description}`);
}

export function spawnEnemy(game: Game, type: SpawnType): Enemy {
  const { layout, run } = game;
  const s = layout.scale;
  const healthScale = enemyHealthScale(run.wave);
  introduce(game, type);
  const enemy = blankEnemy(type, game);

  if (isArrowType(type)) {
    enemy.kind = 'archer';
    enemy.arrowType = type;
    enemy.accent = ARROW_TYPES[type].color;
    enemy.hp = BALANCE.enemies.archerHp * healthScale;
    const free = allowedPerches(run.wave).filter((i) => perchFits(game, i, plannedHeight('archer', s), null));
    if (free.length > 0 && Math.random() < 0.75) {
      occupyPerch(game, enemy, pick(free));
    } else {
      enemy.x = layout.width + 30 * s;
      enemy.stopX = random(layout.width * 0.52, layout.width * 0.78);
      enemy.state = 'walk';
      enemy.speed = BALANCE.enemies.walkingArcherSpeed * s;
      enemy.appear = 1;
    }
  } else if (type === 'rider') {
    enemy.kind = 'rider';
    enemy.arrowType = pick(run.wave < 4 ? RIDER_ARROWS_EARLY : RIDER_ARROWS);
    enemy.accent = ARROW_TYPES[enemy.arrowType].color;
    enemy.hp = BALANCE.enemies.riderHp * healthScale;
    enemy.x = layout.width + 40 * s;
    enemy.baseY = random(layout.height * 0.2, layout.height * 0.4);
    enemy.y = enemy.baseY;
    enemy.appear = 1;
    enemy.cooldown = random(1.6, 2.4);
  } else if (type === 'boss') {
    const boss = bossForRealm(run.realm);
    enemy.kind = 'boss';
    enemy.arrowType = 'fan';
    enemy.accent = boss.color;
    enemy.hp = BALANCE.enemies.bossHp * healthScale;
    enemy.scale = BALANCE.enemies.bossScale;
    enemy.summonTimer = 6;
    // Archers standing where the boss lands step aside, or vanish if there is nowhere to go.
    const perch = layout.perches[BOSS_PERCH];
    const bossBox = perch ? footprint(perch.x, perch.y, plannedHeight('boss', s)) : null;
    for (const other of [...game.enemies]) {
      if (other.perch === null || !bossBox) continue;
      const inTheWay =
        other.perch === BOSS_PERCH ||
        overlaps(bossBox, footprint(other.x, other.y, enemyArtHeight(other, s)));
      if (!inTheWay) continue;
      const current = layout.perches[other.perch];
      if (current) current.occupant = null;
      const height = enemyArtHeight(other, s);
      const refuge = allowedPerches(run.wave).filter((i) => {
        const spot = layout.perches[i];
        return (
          i !== BOSS_PERCH && spot !== undefined && !overlaps(bossBox, footprint(spot.x, spot.y, height))
        );
      });
      const free = refuge.filter((i) => perchFits(game, i, height, other));
      if (free.length > 0) occupyPerch(game, other, pick(free));
      else {
        other.dead = true;
        other.perch = null;
      }
    }
    occupyPerch(game, enemy, BOSS_PERCH);
    game.ui.bossBar(boss.name);
  } else {
    const def = WALKER_TYPES[type];
    enemy.kind = 'walker';
    enemy.accent = def.color;
    enemy.hp = def.hp * healthScale;
    enemy.speed = def.speed * s * Math.min(1.5, 1 + run.wave * 0.02);
    enemy.damage = def.damage;
    enemy.scale = def.scale;
    enemy.x = layout.width + 30 * s;
    enemy.state = 'walk';
    enemy.appear = 1;
  }

  enemy.maxHp = enemy.hp;
  const body: BodyKey = enemy.kind === 'walker' ? (type as BodyKey) : enemy.kind;
  const size = BODY_SIZES[body];
  enemy.body = body;
  enemy.bodyWidth = size.width;
  enemy.height = size.height;
  enemy.headRadius = size.headRadius;
  if (enemy.perch !== null) burst(game, enemy.x, enemy.y - 20 * s, INK, 10, 0.5, 'dot');
  game.enemies.push(enemy);
  return enemy;
}

/** Vanish in a puff of ink and reappear on another free perch. */
export function relocateEnemy(
  game: Game,
  enemy: Enemy,
  choices: readonly number[] = allowedPerches(game.run.wave),
): void {
  const { layout } = game;
  const height = enemyArtHeight(enemy, layout.scale);
  const free = choices.filter((i) => i !== enemy.perch && perchFits(game, i, height, enemy));
  if (free.length === 0 || enemy.perch === null) return;
  const cy = bodyCenterY(game, enemy);
  burst(game, enemy.x, cy, enemy.accent, 12, 0.6);
  addDecal(game, enemy.x, cy, enemy.accent, 0.8);
  const current = layout.perches[enemy.perch];
  if (current) current.occupant = null;
  occupyPerch(game, enemy, pick(free));
  enemy.appear = 0;
}

function updateWalker(game: Game, enemy: Enemy, dt: number): void {
  const { layout, run } = game;
  const s = layout.scale;
  const reachX = layout.archerX + (38 + enemy.bodyWidth * enemy.scale) * s;
  if (enemy.state === 'walk') {
    enemy.x -= enemy.speed * dt;
    enemy.walkPhase += (dt * enemy.speed) / (5 * s);
    if (enemy.x <= reachX) {
      enemy.x = reachX;
      enemy.state = 'attack';
      enemy.cooldown = 0.5;
    }
  } else {
    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0) {
      enemy.cooldown = 1.3;
      enemy.lunge = 0.25;
      if (run.shieldTime > 0) {
        sfx.block();
        enemy.x += 26 * s;
        enemy.state = 'walk';
        floatText(game, 'Blocked', layout.archerX + 40 * s, layout.archerY - 50 * s, '#cfeaff', 15);
      } else {
        hurtPlayer(game, enemy.damage * enemyDamageMultiplier(run.wave));
      }
    }
  }
  if (enemy.lunge > 0) enemy.lunge -= dt;
}

function bossAttack(game: Game, boss: Enemy): void {
  const def = bossForRealm(game.run.realm);
  const enraged = boss.hp < boss.maxHp * 0.5;
  const pattern = boss.shots % 3;
  if (pattern === 0) {
    for (const k of [-0.2, -0.1, 0, 0.1, 0.2])
      launchEnemyArrow(game, boss, enraged ? def.arrows[1] : def.arrows[0], 1 + k);
  } else if (pattern === 1) {
    launchEnemyArrow(game, boss, 'homing', 1, -0.5);
    launchEnemyArrow(game, boss, 'homing', 1, 0.5);
    if (enraged) launchEnemyArrow(game, boss, 'homing');
  } else {
    launchEnemyArrow(game, boss, 'boom', 0.9);
    launchEnemyArrow(game, boss, 'boom', 1.15);
    if (enraged) launchEnemyArrow(game, boss, def.arrows[2], 1.3);
  }
  sfx.enemyShoot();
  boss.cooldown = enraged ? 1.5 : 2.1;
  if (boss.shots % 2 === 0) relocateEnemy(game, boss, BOSS_PERCHES);
}

function archerAttack(game: Game, enemy: Enemy): void {
  const { layout, run } = game;
  enemyFire(game, enemy);
  enemy.cooldown = random(2.6, 3.8) * Math.max(0.6, 1 - run.wave * 0.025);
  if (enemy.kind !== 'archer') return;
  if (enemy.perch === null) {
    // Ground archers creep closer every other shot.
    if (enemy.shots % 2 === 0 && enemy.stopX > layout.width * 0.46) {
      enemy.stopX -= random(30, 56) * layout.scale;
      enemy.state = 'walk';
    }
  } else if (enemy.shots % 3 === 0) {
    relocateEnemy(game, enemy);
  }
}

export function updateEnemies(game: Game, dt: number): void {
  const { layout, run } = game;
  const s = layout.scale;
  const telegraph = run.wave < 3 ? 0.9 : 0.75;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    enemy.age += dt;
    enemy.flash -= dt;
    enemy.appear = Math.min(1, enemy.appear + dt * 2.2);
    enemy.knockback *= Math.pow(0.001, dt);

    if (enemy.burn > 0) {
      enemy.burn -= dt;
      enemy.hp -= BALANCE.status.enemyBurnDps * dt;
      if (Math.random() < dt * 10) burst(game, enemy.x, bodyCenterY(game, enemy), '#ff7a2e', 1, 0.3, 'dot');
      if (enemy.hp <= 0) {
        killEnemy(game, enemy);
        continue;
      }
    }

    if (enemy.kind === 'walker') {
      updateWalker(game, enemy, dt);
      continue;
    }

    if (enemy.kind === 'rider') {
      const targetX = layout.width * (0.68 + 0.2 * Math.sin(enemy.age * 0.45 + enemy.bobPhase));
      enemy.x += (targetX - enemy.x) * dt * 0.9;
      enemy.y = enemy.baseY + Math.sin(enemy.age * 1.3 + enemy.bobPhase) * 20 * s;
    }

    if (enemy.state === 'walk') {
      enemy.x -= enemy.speed * dt;
      enemy.walkPhase += dt * 8;
      if (enemy.x <= enemy.stopX) {
        enemy.state = 'idle';
        enemy.cooldown = random(0.5, 1.2);
      }
      continue;
    }

    if (enemy.kind === 'boss') {
      enemy.summonTimer -= dt;
      if (enemy.summonTimer <= 0 && game.enemies.length < 4) {
        enemy.summonTimer = 9;
        spawnEnemy(game, pick(enemy.hp < enemy.maxHp * 0.5 ? BOSS_SUMMONS.enraged : BOSS_SUMMONS.calm));
      }
      game.ui.bossHealth(clamp(enemy.hp / enemy.maxHp, 0, 1));
    }

    if (enemy.appear < 1) continue;

    if (enemy.state === 'idle') {
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0) {
        enemy.state = 'aim';
        enemy.aimDuration = enemy.kind === 'boss' && enemy.hp < enemy.maxHp * 0.5 ? 0.55 : telegraph;
        enemy.aimRemaining = enemy.aimDuration;
      }
    } else if (enemy.state === 'aim') {
      enemy.aimRemaining -= dt;
      if (enemy.aimRemaining <= 0) {
        enemy.shots++;
        enemy.state = 'idle';
        if (enemy.kind === 'boss') bossAttack(game, enemy);
        else archerAttack(game, enemy);
      }
    }
  }
  game.enemies = game.enemies.filter((e) => !e.dead);
}
