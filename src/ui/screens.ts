/** Menu, skill tree, settings, perk choice and game-over screens. */
import { initAudio, resumeAudio, setMusicEnabled, setMuted, sfx } from '../audio/audio';
import { type PerkDef, drawPerkChoices } from '../data/perks';
import { BOW_TIERS, SKILLS, SKILL_BRANCHES } from '../data/progression';
import { REALMS } from '../data/realms';
import { defaultSave } from '../state/save';
import type { Game } from '../state/types';
import {
  bowTierIndex,
  buySkill,
  canBuySkill,
  isSkillLocked,
  nextSkillCost,
  respecSkills,
  skillLevel,
} from '../systems/rules';
import { byId, element, hide, isShown, show } from './dom';

export interface ScreenActions {
  startCampaign(realm: number): void;
  startEndless(): void;
  restart(): void;
  quitToMenu(): void;
  resume(): void;
  choosePerk(perk: PerkDef): void;
}

const OVERLAYS = ['menu', 'over', 'pause', 'tree', 'perks'] as const;
type Overlay = (typeof OVERLAYS)[number];

export class Screens {
  selectedRealm = 1;
  private wipeArmed = false;

  constructor(
    private readonly game: Game,
    private readonly actions: ScreenActions,
    private readonly isDesktop: boolean,
  ) {
    byId('bPlay').onclick = () => actions.startCampaign(this.selectedRealm);
    byId('bEndless').onclick = () => actions.startEndless();
    byId('bRetry').onclick = () => actions.restart();
    byId('bMenu').onclick = () => actions.quitToMenu();
    byId('bQuit').onclick = () => actions.quitToMenu();
    byId('bResume').onclick = () => actions.resume();
    byId('bTree').onclick = () => this.open('tree');
    byId('bBack').onclick = () => this.open('menu');
    byId('bSet').onclick = () => this.open('pause');
    byId('bRespec').onclick = () => {
      respecSkills(this.game.save);
      this.game.persist();
      this.renderTree();
    };
    byId('bMute').onclick = () => this.toggle('sound');
    byId('bMusic').onclick = () => this.toggle('music');
    byId('bHap').onclick = () => this.toggle('haptics');
    byId('bFull').onclick = () => {
      const request = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      request.then(
        () => this.renderSettings(),
        () => undefined,
      );
    };
    byId('bWipe').onclick = () => this.wipeProgress();
    this.applyAudioSettings();
  }

  isOpen(id: Overlay): boolean {
    return isShown(id);
  }

  hideAll(): void {
    for (const id of OVERLAYS) hide(id);
  }

  open(id: Overlay): void {
    this.hideAll();
    if (id === 'menu') this.renderMenu();
    if (id === 'tree') this.renderTree();
    if (id === 'pause') this.renderSettings();
    show(id);
  }

  // --- Menu ------------------------------------------------------------------------------------

  renderMenu(): void {
    const save = this.game.save;
    this.selectedRealm = Math.min(this.selectedRealm, save.unlockedRealms);
    byId('mHelp').innerHTML = this.isDesktop
      ? 'Click and drag to aim, release to shoot.<br><b>Space</b> or right-click: shield · <b>1 2 3</b>: spirit arrows · <b>E</b>: Starfall · <b>Esc</b>: pause'
      : 'Drag anywhere, pull back, release to shoot.<br>Shoot arrows out of the air. Tap the shield at the last moment to deflect.';

    const realms = byId('mRealms');
    realms.replaceChildren(
      ...REALMS.map((realm, i) => {
        const stars = save.stars[i] ?? 0;
        const button = element('button', `rl${this.selectedRealm === i + 1 ? ' sel' : ''}`, [
          element('b', 'k', [String(i + 1)]),
          element('i', '', ['★'.repeat(stars) + '☆'.repeat(3 - stars)]),
        ]);
        button.disabled = i + 1 > save.unlockedRealms;
        button.title = realm.name;
        button.setAttribute('aria-label', `Realm ${i + 1}: ${realm.name}, ${stars} stars`);
        button.onclick = () => {
          this.selectedRealm = i + 1;
          this.renderMenu();
        };
        return button;
      }),
    );

    const tier = bowTierIndex(save.kills);
    const next = BOW_TIERS[tier + 1];
    const realmName = REALMS[this.selectedRealm - 1]?.name ?? '';
    const bowName = BOW_TIERS[tier]?.name ?? '';
    byId('mBow').textContent =
      `${realmName} · ${bowName}${next ? ` (${Math.max(0, next.killsRequired - save.kills)} kills to ${next.name})` : ''}`;
    byId('bPlay').textContent = this.selectedRealm > 1 ? `Begin realm ${this.selectedRealm}` : 'Begin';
    const endless = byId<HTMLButtonElement>('bEndless');
    endless.disabled = !save.endlessUnlocked;
    endless.textContent = save.endlessUnlocked
      ? `Endless${save.bestEndless ? ` · best ${save.bestEndless}` : ''}`
      : 'Endless (beat realm 1)';
    byId('bTree').textContent = `Skill Tree · ✦ ${save.ink}`;
    byId('mVer').textContent = `v${__APP_VERSION__}`;
  }

  // --- Skill tree ------------------------------------------------------------------------------

  renderTree(): void {
    const save = this.game.save;
    byId('tInk').innerHTML = `<b>✦ ${save.ink} ink</b> · earned from kills, waves and lantern spirits`;
    const sections = SKILL_BRANCHES.flatMap((branch) => {
      const nodes = SKILLS.filter((s) => s.branch === branch.id).map((skill) => {
        const level = skillLevel(save, skill.id);
        const maxed = level >= skill.costs.length;
        const locked = isSkillLocked(save, skill.id);
        const cost = nextSkillCost(save, skill.id);
        const status = maxed
          ? 'Mastered'
          : locked
            ? 'Locked'
            : `Lv ${level}/${skill.costs.length} · ${cost} ink`;
        const button = element('button', `nd${maxed ? ' max' : ''}`, [
          element('b', 'k', [skill.name]),
          element('span', '', [skill.description]),
          element('em', '', [status]),
        ]);
        button.disabled = !maxed && !canBuySkill(save, skill.id);
        button.onclick = () => {
          if (!buySkill(save, skill.id)) return;
          this.game.persist();
          initAudio();
          sfx.perk();
          this.renderTree();
        };
        return button;
      });
      return [element('div', 'br k', [branch.name]), element('div', 'nodes', nodes)];
    });
    byId('tBody').replaceChildren(...sections);
  }

  // --- Settings / pause ------------------------------------------------------------------------

  renderSettings(): void {
    const settings = this.game.save.settings;
    const inRun = this.game.phase === 'play';
    byId('pTitle').textContent = inRun ? 'Paused' : 'Settings';
    byId('bResume').textContent = inRun ? 'Resume' : 'Close';
    byId('bMute').textContent = `Sound: ${settings.sound ? 'on' : 'off'}`;
    byId('bMusic').textContent = `Music: ${settings.music ? 'on' : 'off'}`;
    byId('bHap').textContent = `Vibration: ${settings.haptics ? 'on' : 'off'}`;
    byId('bHap').style.display = 'vibrate' in navigator ? '' : 'none';
    byId('bFull').style.display = 'requestFullscreen' in document.documentElement ? '' : 'none';
    byId('bFull').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    byId('bQuit').style.display = inRun ? '' : 'none';
    byId('bWipe').style.display = inRun ? 'none' : '';
    byId('bWipe').textContent = 'Reset progress';
    this.wipeArmed = false;
  }

  private toggle(key: keyof Game['save']['settings']): void {
    const settings = this.game.save.settings;
    settings[key] = !settings[key];
    this.game.persist();
    if (key === 'sound' && settings.sound) {
      initAudio();
      resumeAudio();
    }
    this.applyAudioSettings();
    this.renderSettings();
  }

  applyAudioSettings(): void {
    setMuted(!this.game.save.settings.sound);
    setMusicEnabled(this.game.save.settings.music);
  }

  /** Two taps: the first arms the button, the second erases progress (settings are kept). */
  private wipeProgress(): void {
    if (!this.wipeArmed) {
      this.wipeArmed = true;
      byId('bWipe').textContent = 'Tap again to erase everything';
      return;
    }
    const fresh = defaultSave();
    fresh.settings = this.game.save.settings;
    Object.assign(this.game.save, fresh);
    this.game.persist();
    this.selectedRealm = 1;
    this.renderSettings();
  }

  // --- Perks -----------------------------------------------------------------------------------

  openPerks(): void {
    const game = this.game;
    game.paused = true;
    game.aim = null;
    sfx.perk();
    const pending = game.run.pendingPerks;
    byId('perks').firstElementChild!.textContent =
      pending > 1 ? `Choose a blessing (${pending} left)` : 'Choose a blessing';
    const cards = drawPerkChoices(game.perkPicks).map((perk) => {
      const card = element('button', 'pk', [
        element('b', 'k', [perk.name]),
        element('span', '', [perk.description]),
      ]);
      card.style.setProperty('--c', perk.color);
      card.onclick = () => this.actions.choosePerk(perk);
      return card;
    });
    byId('pc').replaceChildren(...cards);
    show('perks');
  }

  choosePerkByIndex(index: number): void {
    const card = byId('pc').children[index] as HTMLButtonElement | undefined;
    card?.click();
  }

  // --- Game over -------------------------------------------------------------------------------

  showGameOver(win: boolean): void {
    const { run, save } = this.game;
    const endless = run.mode === 'endless';
    const tier = bowTierIndex(save.kills);
    const current = BOW_TIERS[tier];
    const next = BOW_TIERS[tier + 1];
    byId('oTitle').textContent = win ? 'The kingdom endures' : 'The light fades';
    byId('oStats').innerHTML =
      `Score <b>${run.score}</b> · Best ${endless ? save.bestEndless : save.bestCampaign}<br>` +
      `${endless ? 'Endless' : 'Campaign'} wave ${run.wave} · ${run.kills} foes felled<br>` +
      `+${run.inkEarned} ink earned · ${save.ink} to spend`;
    byId('oBow').textContent = next
      ? `${current?.name}. ${next.killsRequired - save.kills} more kills awaken the ${next.name}.`
      : `${current?.name}, fully awakened.`;
    this.open('over');
  }
}
