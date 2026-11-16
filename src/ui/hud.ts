/** The in-game heads-up display, refreshed every frame from game state. */
import { clamp } from '../core/math';
import type { Game } from '../state/types';
import { byId } from './dom';

const VIGNETTES = {
  hurt: 'radial-gradient(ellipse at center,rgba(214,58,49,0) 45%,rgba(214,58,49,.55))',
  frost: 'radial-gradient(ellipse at center,rgba(143,227,255,0) 50%,rgba(143,227,255,.4))',
  poison: 'radial-gradient(ellipse at center,rgba(134,217,76,0) 55%,rgba(134,217,76,.32))',
  burn: 'radial-gradient(ellipse at center,rgba(255,122,46,0) 55%,rgba(255,122,46,.32))',
};

export class Hud {
  private readonly score = byId('score');
  private readonly hp = byId('hp').firstElementChild as HTMLElement;
  private readonly xp = byId('xp').firstElementChild as HTMLElement;
  private readonly ink = byId('ink');
  private readonly spirit = byId('bSpirit');
  private readonly shield = byId('bShield');
  private readonly tint = byId('tint');
  private readonly spiritButtons = [...document.querySelectorAll<HTMLElement>('.ab')];
  private tintStyle = '';

  constructor(
    private readonly hint: (text: string) => void,
    private readonly isDesktop: boolean,
  ) {}

  update(game: Game): void {
    if (game.phase !== 'play') return;
    const run = game.run;
    this.score.textContent = String(run.score);
    this.hp.style.width = `${clamp((run.hp / run.maxHp) * 100, 0, 100)}%`;
    this.xp.style.width = `${clamp((run.xp / run.xpToNext) * 100, 0, 100)}%`;
    this.ink.textContent = `✦ ${game.save.ink} ink`;

    const canAfford = run.spirit >= run.spiritCost;
    for (const button of this.spiritButtons) {
      button.classList.toggle('off', !canAfford);
      button.classList.toggle('sel', run.selectedSpirit === button.dataset.a);
    }
    if (canAfford && run.shots > 3 && !game.seen.has('spiritReady')) {
      game.seen.add('spiritReady');
      this.hint(
        this.isDesktop
          ? 'Spirit arrows ready: press 1, 2 or 3'
          : 'Spirit arrows ready: pick one at the bottom left',
      );
    }

    const spirit = Math.floor(run.spirit);
    this.spirit.style.setProperty('--p', String(spirit));
    this.spirit.classList.toggle('off', spirit < 100);
    this.spirit.classList.toggle('ready', spirit >= 100);

    const shieldReady = clamp(1 - run.shieldCooldown / game.stats.shieldCooldown, 0, 1);
    this.shield.style.setProperty('--p', String(shieldReady * 100));
    this.shield.classList.toggle('off', shieldReady < 1);

    const style =
      run.hurtTime > 0
        ? VIGNETTES.hurt
        : run.frost > 0
          ? VIGNETTES.frost
          : run.poison > 0
            ? VIGNETTES.poison
            : run.burn > 0
              ? VIGNETTES.burn
              : '';
    if (style) {
      if (style !== this.tintStyle) {
        this.tint.style.background = style;
        this.tintStyle = style;
      }
      this.tint.style.opacity = '1';
    } else {
      this.tint.style.opacity = '0';
    }
  }

  clearTint(): void {
    this.tint.style.opacity = '0';
  }
}
