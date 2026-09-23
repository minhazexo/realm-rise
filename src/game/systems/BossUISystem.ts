// ─────────────────────────────────────────────────────────────────────────────
// BossUISystem — the boss bar's owner: publishing session.activeBoss when a
// boss appears, keeping its HP live while the fight is in sight, hiding it
// when the fight is won or abandoned, and speaking the boss lines on the way
// in and on the way down (brief §14: bosses get dialogue both ways).
//
// Extracted from WorldScene (Phase 4). The bar itself renders in React from
// session.activeBoss; this module only owns that session state. BossEnemy
// reaches it through the scene: scene.bossUI.show(this) / setPhase(n).
//
// Scene contract: scene.bossUI, scene.player
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';

/** The boss bar handle BossEnemy calls into. */
export interface BossUI {
  _boss: any;
  _phase: number;
  show(boss: any): void;
  setPhase(p: number): void;
  hide(): void;
}

/** Minimal scene surface consumed by the boss bar. */
export type BossScene = {
  bossUI: BossUI;
  player: { sprite: { x: number; y: number } };
};

/** Extra leash beyond the arena radius the bar stays visible at. */
const LEASH_SLACK = 300;

/**
 * Publish a boss as the active fight: session.activeBoss drives the React bar,
 * `boss-intro` drives the title card, and the boss gets to say something first
 * — staggered toasts rather than a modal, so a fight does not open on a dialog.
 */
export function createBossUI(scene: BossScene): BossUI {
  void scene;
  return {
    _boss: null as any,
    _phase: 1 as number,
    show(boss: any): void {
      this._boss = boss; this._phase = 1;
      (GameState.session as any).activeBoss = { name: boss.def?.name || boss.key, hp: boss.hp, maxHp: boss.maxHp, phase: 1 };
      GameState.notify(CH.BOSSBAR);
      Bus.emit('boss-intro', boss.key);
      const key: string = boss.key;
      const owner = boss.scene;
      import('./VoiceSystem.ts').then((v) => v.speakBossIntro(owner, key)).catch(() => {});
    },
    setPhase(p: number): void {
      this._phase = p;
      if ((GameState.session as any).activeBoss) {
        (GameState.session as any).activeBoss.phase = p;
        GameState.notify(CH.BOSSBAR);
      }
    },
    hide(): void {
      this._boss = null;
      (GameState.session as any).activeBoss = null;
      GameState.notify(CH.BOSSBAR);
    }
  };
}

/** Keep the bar's HP live; hide it when the fight is won or left behind. */
export function refreshBossBar(scene: BossScene, px: number, py: number): void {
  const b = scene.bossUI?._boss;
  if (!b || !(GameState.session as any).activeBoss) return;
  if (b.dead || !b.sprite) { scene.bossUI.hide(); return; }
  const d2: number = (b.sprite.x - px) ** 2 + (b.sprite.y - py) ** 2;
  const leash: number = (b.radius || 520) + LEASH_SLACK;
  if (d2 > leash * leash) { scene.bossUI.hide(); return; }
  const ab = (GameState.session as any).activeBoss;
  const hp: number = Math.max(0, Math.ceil(b.hp));
  if (ab.hp !== hp) {
    ab.hp = hp;
    GameState.notify(CH.BOSSBAR);
  }
}

/**
 * A boss died: drop the bar, say what it says as it falls, then report the
 * kill to the quest engine.
 */
export function onBossDeath(scene: BossScene, e: any): void {
  if (e.boss && scene.bossUI?._boss === e) scene.bossUI.hide();
  if (!e.boss) return;
  import('./VoiceSystem.ts').then((v) => v.speakBossDefeat(scene as any, e.key)).catch(() => {});
  import('./QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'kill', boss: e.key }));
}
