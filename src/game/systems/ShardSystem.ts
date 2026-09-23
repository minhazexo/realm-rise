// ─────────────────────────────────────────────────────────────────────────────
// ShardSystem — the pure rules of the shard chain: is a fragment's guardian
// still standing over it, which shard the story is on, and is the barrier's
// anchor ready to take the five.
//
// Deliberately Phaser-free (and scene-free) so every rule is pinned in node
// (tests/shards.mjs) instead of only being observable by walking a frontier.
// The scene-side halves are RegionInteractables (taking a shard, planting them)
// and VoiceSystem (who says what).
// ─────────────────────────────────────────────────────────────────────────────
import { SHARDS, BARRIER } from '../data/storyShards.ts';
import type { ShardDef } from '../data/storyShards.ts';

/** The bits of a live enemy these rules care about — nothing else is read. */
export interface ShardFoe {
  key: string;
  x: number;
  y: number;
  dead?: boolean;
}

export type Flags = Record<string, unknown>;

/**
 * The guardian still standing over this shard, or null when the way is clear.
 *
 * Two rules, because there are two kinds of keeper:
 *   • a boss keeps its fragment wherever it stands — it was POSTED there, and
 *     walking it away from the pyre must not hand the fragment over (live
 *     probing caught exactly that). Its key is unique to this fragment.
 *   • anything else only holds the fragment while it is actually near it, so a
 *     wandering wolf does not hold it forever from the far side of the wood.
 */
export function guardianHolding(def: ShardDef, foes: ShardFoe[]): ShardFoe | null {
  const g = def.guardian;
  for (const f of foes) {
    if (f.dead || f.key !== g.key) continue;
    if (g.boss) return f;
    if (Math.hypot(f.x - def.site.x, f.y - def.site.y) <= g.radius) return f;
  }
  return null;
}

/**
 * May this fragment be taken right now? A refusal must always say why — the
 * fragment is not hidden, it is HELD, and the message names its holder.
 */
export function canTakeShard(def: ShardDef, foes: ShardFoe[]): { ok: boolean; reason?: string } {
  const holding = guardianHolding(def, foes);
  if (!holding) return { ok: true };
  return { ok: false, reason: `${def.heldText}` };
}

/** Shards already recovered, in the order they were written. */
export function takenShards(flags: Flags): ShardDef[] {
  return SHARDS.filter((s: ShardDef) => !!flags[s.flag]);
}

/** How many of the five are back in the world's hands. */
export function takenCount(flags: Flags): number {
  return takenShards(flags).length;
}

/** The shard the story is currently on (null once all five are recovered). */
export function nextShard(flags: Flags): ShardDef | null {
  return SHARDS.find((s: ShardDef) => !flags[s.flag]) || null;
}

/** Fragments nobody has recovered yet — what the anchor is still owed. */
export function missingShards(flags: Flags): ShardDef[] {
  return SHARDS.filter((s: ShardDef) => !flags[s.flag]);
}

/**
 * Is the Fivefold Anchor ready? Not ready lists what is still lost, so an
 * attempt with nothing to plant says why instead of doing nothing.
 */
export function barrierGate(flags: Flags): { ok: boolean; reason?: string; missing: ShardDef[] } {
  const missing = missingShards(flags);
  if (!missing.length) return { ok: true, missing };
  const names = missing.map((s: ShardDef) => s.name.replace('The ', '').replace(' Shard', '')).join(', ');
  return { ok: false, missing, reason: `${BARRIER.coldText} ${SHARDS.length - missing.length}. Still lost: ${names}.` };
}
