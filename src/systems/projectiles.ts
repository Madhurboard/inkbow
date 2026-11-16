/** Arrows in flight: enemy volleys, and both sides' arrows moving and colliding each frame. */
import { sfx } from '../audio/audio';
import { BALANCE } from '../config';
import { TAU, clamp, gaussian } from '../core/math';
import { ARROW_TYPES } from '../data/enemies';
import type { ArrowTypeId, Enemy, EnemyArrow, Game, PlayerArrow } from '../state/types';
import {
  bodyCenterY,
  chainLightning,
  collectLantern,
  emberBlast,
  explodeEnemyArrow,
  hitEnemy,
  interceptEnemyArrow,
  struckByEnemyArrow,
} from './combat';
import { burst, floatText } from './effects';

const PLAYER_TRAIL = 18;
const ENEMY_TRAIL = 14;
const STUCK_TIME = 1.6;
const MAX_FLIGHT = 6;
const SUBSTEPS = 3;

/**
 * Fire one arrow from `enemy` at the archer. Arcing arrows are aimed by solving for a flight
 * time; `timeScale` stretches it so volleys land at slightly different moments.
 */
export function launchEnemyArrow(
  game: Game,
  enemy: Enemy,
  type: ArrowTypeId,
  timeScale = 1,
  spread = 0,
): void {
  const { layout, run } = game;
  const s = layout.scale;
  const sx = enemy.x - 10 * s * enemy.scale;
  const sy = bodyCenterY(game, enemy, 0.62);
  const tx = layout.archerX + gaussian() * 20 * s;
  const ty = layout.archerY - 2 * s + gaussian() * 24 * s + (type === 'boom' ? 24 * s : 0);
  const dx = tx - sx;
  const dy = ty - sy;
  const arrow: EnemyArrow = {
    type,
    x: sx,
    y: sy,
    vx: 0,
    vy: 0,
    owner: enemy,
    trail: [],
    age: 0,
    speed: 0,
    dead: false,
  };
  if (type === 'homing') {
    const angle = Math.atan2(dy, dx) + gaussian() * 0.9 + spread;
    arrow.speed = (120 + Math.min(run.wave, 12) * 5) * s;
    arrow.vx = Math.cos(angle) * arrow.speed;
    arrow.vy = Math.sin(angle) * arrow.speed;
  } else {
    const flightSpeed = (235 + Math.min(run.wave, 14) * 9) * s;
    const time = clamp(Math.hypot(dx, dy) / flightSpeed, 0.9, 2.5) * timeScale * (type === 'boom' ? 1.35 : 1);
    arrow.vx = dx / time;
    arrow.vy = dy / time - 0.5 * BALANCE.enemies.arrowGravity * s * time;
  }
  game.enemyArrows.push(arrow);
}

/** An ordinary archer or rider looses its arrow (fan archers loose three). */
export function enemyFire(game: Game, enemy: Enemy): void {
  if (enemy.arrowType === 'fan')
    for (const k of [-0.17, 0, 0.17]) launchEnemyArrow(game, enemy, 'fan', 1 + k);
  else launchEnemyArrow(game, enemy, enemy.arrowType);
  sfx.enemyShoot();
  if (!game.seen.has('enemyArrow')) {
    game.seen.add('enemyArrow');
    setTimeout(() => game.ui.hint('Shoot their arrows out of the air, or tap the shield'), 500);
  }
}

function headAndBodyHit(game: Game, enemy: Enemy, x: number, y: number): 'head' | 'body' | null {
  const k = enemy.scale * game.layout.scale;
  const headX = enemy.x - k;
  const headY = enemy.y - (enemy.height - 5) * k;
  const headR = (enemy.headRadius + 3) * k;
  if ((x - headX) ** 2 + (y - headY) ** 2 < headR * headR) return 'head';
  const bx = (x - enemy.x) / ((enemy.bodyWidth + 5) * k);
  const by = (y - (enemy.y - enemy.height * 0.42 * k)) / (enemy.height * 0.44 * k);
  return bx * bx + by * by < 1 ? 'body' : null;
}

/** Shield brutes block flat shots from the front; lobbed or guided arrows get over the shield. */
function blockedByShield(arrow: PlayerArrow, enemy: Enemy): boolean {
  return (
    enemy.type === 'brute' &&
    !arrow.guided &&
    arrow.vx > 0 &&
    arrow.vy < Math.abs(arrow.vx) * 1.1 &&
    arrow.x < enemy.x
  );
}

function bounceOffShield(game: Game, arrow: PlayerArrow, enemy: Enemy): void {
  const s = game.layout.scale;
  sfx.block();
  floatText(game, 'Shield!', arrow.x, arrow.y - 10 * s, '#cfd8e6', 15);
  burst(game, arrow.x, arrow.y, '#cfd8e6', 5, 0.5, 'dot');
  arrow.vx *= -0.25;
  arrow.vy = -120 * s;
  arrow.hit.add(enemy);
  arrow.pierce = 0;
  arrow.ricochet = 0;
  arrow.damage = 0;
  if (!game.seen.has('brute')) {
    game.seen.add('brute');
    game.ui.hint('Shield Brute: aim for the head, or lob an arrow over the shield');
  }
}

function steerTowards(game: Game, arrow: PlayerArrow, target: Enemy, speed: number): void {
  const angle = Math.atan2(bodyCenterY(game, target, 0.55) - arrow.y, target.x - arrow.x);
  arrow.vx = Math.cos(angle) * speed;
  arrow.vy = Math.sin(angle) * speed;
}

/** Returns true when the arrow's flight ends this substep. */
function collideWithEnemies(game: Game, arrow: PlayerArrow): void {
  const s = game.layout.scale;
  for (const enemy of game.enemies) {
    if (enemy.dead || arrow.hit.has(enemy) || enemy.appear < 0.5) continue;
    const zone = headAndBodyHit(game, enemy, arrow.x, arrow.y);
    if (!zone) continue;
    if (zone === 'body' && blockedByShield(arrow, enemy)) {
      bounceOffShield(game, arrow, enemy);
      return;
    }
    if (arrow.damage <= 0) continue;
    arrow.hit.add(enemy);
    hitEnemy(game, enemy, arrow, zone === 'head');
    if (arrow.special === 'ember') {
      emberBlast(game, arrow);
      arrow.dead = true;
      return;
    }
    if (arrow.special === 'storm') chainLightning(game, enemy);
    if (arrow.ricochet > 0) {
      const next = game.enemies
        .filter((e) => !e.dead && !arrow.hit.has(e))
        .sort(
          (a, b) => Math.hypot(a.x - arrow.x, a.y - arrow.y) - Math.hypot(b.x - arrow.x, b.y - arrow.y),
        )[0];
      if (next) {
        arrow.ricochet--;
        steerTowards(game, arrow, next, 820 * s);
        arrow.vy -= 60 * s;
        continue;
      }
    }
    if (arrow.pierce > 0) arrow.pierce--;
    else arrow.dead = true;
    return;
  }
}

export function updatePlayerArrows(game: Game, dt: number): void {
  const { layout } = game;
  const s = layout.scale;
  const gravity = BALANCE.shot.gravity * s;
  const h = dt / SUBSTEPS;
  for (const arrow of game.arrows) {
    arrow.age += dt;
    if (arrow.stuck !== null) {
      arrow.stuck -= dt;
      if (arrow.stuck <= 0) arrow.dead = true;
      continue;
    }
    for (let step = 0; step < SUBSTEPS && !arrow.dead && arrow.stuck === null; step++) {
      if (arrow.target && !arrow.target.dead)
        steerTowards(game, arrow, arrow.target, Math.hypot(arrow.vx, arrow.vy));
      else if (!arrow.guided) arrow.vy += gravity * h;
      arrow.x += arrow.vx * h;
      arrow.y += arrow.vy * h;

      collideWithEnemies(game, arrow);
      if (arrow.dead) break;

      for (const other of game.enemyArrows) {
        if (!other.dead && (arrow.x - other.x) ** 2 + (arrow.y - other.y) ** 2 < (17 * s) ** 2) {
          interceptEnemyArrow(game, arrow, other);
        }
      }
      const lantern = game.lantern;
      if (lantern && (arrow.x - lantern.x) ** 2 + (arrow.y - lantern.y) ** 2 < (24 * s) ** 2)
        collectLantern(game);

      if (arrow.y >= layout.groundY && arrow.vy > 0) {
        arrow.y = layout.groundY;
        arrow.stuck = STUCK_TIME;
        if (arrow.guided) arrow.dead = true;
        if (arrow.special === 'ember') {
          emberBlast(game, arrow);
          arrow.dead = true;
        }
      }
      if (
        arrow.x > layout.width + 60 ||
        arrow.x < -60 ||
        arrow.y > layout.height + 40 ||
        arrow.age > MAX_FLIGHT
      ) {
        arrow.dead = true;
      }
    }
    arrow.trail.push(arrow.x, arrow.y);
    if (arrow.trail.length > PLAYER_TRAIL) arrow.trail.splice(0, 2);
  }
  game.arrows = game.arrows.filter((a) => !a.dead);
}

export function updateEnemyArrows(game: Game, dt: number): void {
  const { layout, run } = game;
  const s = layout.scale;
  for (const arrow of game.enemyArrows) {
    arrow.age += dt;
    if (arrow.type === 'homing') {
      const want = Math.atan2(layout.archerY - arrow.y, layout.archerX - arrow.x);
      let heading = Math.atan2(arrow.vy, arrow.vx);
      const turn = ((want - heading + Math.PI * 3) % TAU) - Math.PI;
      heading += clamp(turn, -1.7 * dt, 1.7 * dt) + Math.sin(arrow.age * 5) * dt * 0.8;
      arrow.vx = Math.cos(heading) * arrow.speed;
      arrow.vy = Math.sin(heading) * arrow.speed;
      if (arrow.age > 10) arrow.dead = true;
    } else {
      arrow.vy += BALANCE.enemies.arrowGravity * s * dt;
    }
    arrow.x += arrow.vx * dt;
    arrow.y += arrow.vy * dt;
    arrow.trail.push(arrow.x, arrow.y);
    if (arrow.trail.length > ENEMY_TRAIL) arrow.trail.splice(0, 2);

    const ex = (arrow.x - layout.archerX) / (15 * s);
    const ey = (arrow.y - (layout.archerY - 4 * s)) / (34 * s);
    const inShield =
      run.shieldTime > 0 && (arrow.x - layout.archerX) ** 2 + (arrow.y - layout.archerY) ** 2 < (46 * s) ** 2;
    if (inShield || ex * ex + ey * ey < 1) {
      arrow.dead = true;
      struckByEnemyArrow(game, arrow);
    } else if (
      arrow.y >= layout.groundY ||
      (arrow.x < layout.archerX + 30 * s && arrow.y >= layout.groundY - layout.platformHeight)
    ) {
      arrow.dead = true;
      if (arrow.type === 'boom') explodeEnemyArrow(game, arrow);
      else burst(game, arrow.x, arrow.y, ARROW_TYPES[arrow.type].color, 3, 0.3, 'dot');
    } else if (arrow.x < -40 || arrow.y > layout.height) {
      arrow.dead = true;
    }
  }
  game.enemyArrows = game.enemyArrows.filter((a) => !a.dead);
}
