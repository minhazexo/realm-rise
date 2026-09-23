// ─────────────────────────────────────────────────────────────────────────────
// RegionStory — the narrative spine's two world interactions (brief §14): a
// Realm Shard and the Fivefold Anchor that takes all five.
//
// Split out of RegionInteractables so that file is only placement + the click
// dispatch, and the story beats have one home. The rules still live in
// ShardSystem (pure, node-testable), the prose in data/voices.ts and
// data/storyShards.ts; this module is the runtime side that spends, flags,
// speaks and floats.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { addItem, spendItems } from './InventorySystem.ts';
import { setStoryFlag, setRegionFlag } from './RegionState.ts';
import { canTakeShard, barrierGate, type ShardFoe } from './ShardSystem.ts';
import { readLines } from './VoiceSystem.ts';
import { shardById, SHARDS, BARRIER } from '../data/storyShards.ts';
import type { RegionScene } from './RegionState.ts';
import type { Interactable } from '../data/region.ts';

/** Live enemies as the shard rules see them (key + where + still standing). */
export function foes(scene: RegionScene): ShardFoe[] {
  const out: ShardFoe[] = [];
  for (const e of (scene.enemies || [])) {
    if (!e?.sprite) continue;
    out.push({ key: String(e.key), x: e.sprite.x, y: e.sprite.y, dead: !!e.dead });
  }
  return out;
}

/**
 * Take a Realm Shard (kind 'shard'). The fragment is never hidden, it is HELD:
 * while its guardian still stands within reach the click refuses and says who,
 * and the fragment only becomes the player's once that enemy is dead. Reuses
 * the shipped inventory, story flags, dialogue modal and POI markers.
 */
export function takeShard(scene: RegionScene, it: Interactable, img: any): void {
  const def = it.shard ? shardById(it.shard) : null;
  if (!def) return;
  const verdict = canTakeShard(def, foes(scene));
  if (!verdict.ok) {
    GameState.toast({ title: def.name.toUpperCase(), msg: verdict.reason || def.heldText, kind: 'info', dur: 4600 });
    Bus.emit('play-sound', 'hit_flesh');
    scene.floats?.add?.(it.x, it.y - 34, 'HELD', '#ff8f6b', 1.1);
    return;
  }
  addItem(def.item, 1, { ignoreCap: true });
  setStoryFlag(def.flag);
  if (it.onceOnly) setRegionFlag(it.id);
  Bus.emit('play-sound', 'boss_defeat');
  scene.floats?.add?.(it.x, it.y - 34, def.name.replace('The ', '').replace(' Shard', ''), '#c9a0ff', 1.3);
  // Read on recovery — the fragment itself is the primary source.
  readLines(def.name, def.inscription);
  img.destroy();
}

/**
 * The final beat (kind 'ritual'): the Fivefold Anchor. It takes all five or
 * none, and when it takes them the mystery the intro slides opened is answered
 * in the same modal — no new screen, and the epilogue is the shrine's voice.
 */
export function plantAnchor(scene: RegionScene, it: Interactable): void {
  const S = GameState.s;
  const gate = barrierGate(S.story.flags);
  if (!gate.ok) {
    GameState.toast({ title: BARRIER.name.toUpperCase(), msg: gate.reason || BARRIER.coldText, kind: 'info', dur: 5200 });
    Bus.emit('play-sound', 'ui_click');
    scene.floats?.add?.(it.x, it.y - 40, `${SHARDS.length - gate.missing.length}/5`, '#8f9bb0', 1.1);
    return;
  }
  spendItems(Object.fromEntries(SHARDS.map((s) => [s.item, 1])));
  setStoryFlag(BARRIER.flag);
  Bus.emit('play-sound', 'boss_defeat');
  GameState.notify(CH.STORY);
  scene.floats?.add?.(it.x, it.y - 40, 'ANCHORED', '#c9a0ff', 1.6);
  GameState.toast({ title: BARRIER.raisedTitle, msg: BARRIER.raisedText, kind: 'stage', dur: 8000 });
  readLines(BARRIER.name, [...BARRIER.epilogue]);
}
