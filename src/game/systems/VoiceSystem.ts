// ─────────────────────────────────────────────────────────────────────────────
// VoiceSystem — who says it, and where the player reads it. The display half of
// data/voices.ts.
//
// Two ways prose reaches a player, both shipped rather than new:
//   • readLines  — the dialogue modal NPCs already use (books, inscriptions,
//                  a recovered shard, the closing beat). No new screen.
//   • speak      — staggered toasts, for a boss talking DURING a fight, where
//                  a modal would swallow the player's input.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { CH } from '../core/EventBus.ts';
import { bossVoice } from '../data/voices.ts';

/** Ink for a book/inscription — the modal's portrait swatch, not a face. */
const LORE_INK = '#c9a0ff';

/**
 * Open the shipped dialogue modal with a page of prose. Used for books,
 * inscriptions, recovered shards and the barrier beat.
 */
export function readLines(name: string, lines: string[], portrait: string = LORE_INK): void {
  (GameState.session as any).dialogue = {
    npc: `lore:${name}`,
    name,
    portrait,
    lines,
    actions: []
  };
  GameState.notify(CH.DIALOGUE);
}

/** Say lines one at a time (toasts) — a speaker who must not block the fight. */
function speak(scene: Phaser.Scene, title: string, lines: string[], gapMs: number, kind: string): void {
  lines.forEach((msg: string, i: number) => {
    const fire = (): void => {
      GameState.toast({ title, msg, kind, dur: gapMs + 1200 });
    };
    if (i === 0) fire();
    else scene.time.delayedCall(i * gapMs, fire);
  });
}

/** What a boss says as it stands up. */
export function speakBossIntro(scene: Phaser.Scene, key: string): void {
  const v = bossVoice(key);
  if (!v) return;
  speak(scene, (scene as any).bossUI?._boss?.def?.name || 'BOSS', v.intro, 3400, 'dialogue');
}

/** What it says as it falls — and what it leaves behind. */
export function speakBossDefeat(scene: Phaser.Scene, key: string): void {
  const v = bossVoice(key);
  if (!v) return;
  speak(scene, 'FALLEN', v.defeat, 3600, 'story');
}
