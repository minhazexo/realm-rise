// ─────────────────────────────────────────────────────────────────────────────
// WorldEvents — the dynamic-event SCHEDULER, pure and Phaser-free.
//
// It answers one question per tick: "should something happen now, and where?"
// It never spawns anything — systems/WorldEventRuntime.ts acts on its decisions.
// Keeping the policy here is what makes it testable: roll cadence, per-kind
// cooldowns, one-event-at-a-time, the three forbidden places, expiry and
// withdrawal are all decided without a scene.
//
// The brief's rule is unchanged by the fact that events are dynamic: nothing
// fires inside a safe hub, next to where the player arrived, or while a boss
// fight is live — see eventBlockReason.
// ─────────────────────────────────────────────────────────────────────────────
import { EVENT_RULES, WORLD_EVENT_DEFS } from '../data/worldEvents.ts';
import type { EventRules, WorldEventDef, WorldEventKind } from '../data/worldEvents.ts';

/** A seeded 32-bit PRNG, so a run of rolls is reproducible from the world seed. */
export function mulberry32(seed: number): () => number {
  let a: number = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t: number = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LiveEvent {
  kind: WorldEventKind;
  x: number;
  y: number;
  /** Seconds this event has been running. */
  age: number;
  /** Seconds it may run before it withdraws. */
  duration: number;
  label: string;
}

export type EndReason = 'expired' | 'left' | 'done';
export type EventEnd = LiveEvent & { reason: EndReason };

export interface EventRuntime {
  /** Seconds accumulated toward the next roll. */
  rollT: number;
  /** The one live event, if any. */
  live: LiveEvent | null;
  /** Seconds of rest left per kind. */
  cooldowns: Record<string, number>;
  /** How many rolls have happened (also seeds the runtime's own anchor RNG). */
  rolls: number;
  /** How many events have started this session. */
  seq: number;
}

export function createEventRuntime(): EventRuntime {
  return { rollT: 0, live: null, cooldowns: {}, rolls: 0, seq: 0 };
}

/** What the world looks like to a roll. The runtime supplies the facts. */
export interface EventFacts {
  /** Inside an authored safe hub (region safe zone). */
  inSafe: boolean;
  /** Distance from where the player entered the world this session. */
  arrivalDist: number;
  /** A boss is on the field. */
  bossLive: boolean;
  /** Where the event would happen, or null when there is no legal ground. */
  anchor: { x: number; y: number } | null;
}

export type BlockReason = 'safe-zone' | 'arrival-clearance' | 'boss-fight' | 'no-ground' | 'all-resting';

/**
 * Why an event may NOT start right now, or null when the ground is legal.
 * Order is the priority the player would expect: the hub is never disturbed,
 * then the place you arrived, then a live boss, then simply nowhere to put it.
 */
export function eventBlockReason(facts: EventFacts, rules: EventRules = EVENT_RULES): BlockReason | null {
  if (facts.inSafe) return 'safe-zone';
  if (facts.arrivalDist < rules.arrivalClear) return 'arrival-clearance';
  if (facts.bossLive) return 'boss-fight';
  if (!facts.anchor) return 'no-ground';
  return null;
}

/** Kinds that are off cooldown, in table order. */
export function eligibleKinds(rt: EventRuntime, defs: WorldEventDef[] = WORLD_EVENT_DEFS): WorldEventDef[] {
  return defs.filter((d: WorldEventDef) => d.weight > 0 && (rt.cooldowns[d.kind] || 0) <= 0);
}

/**
 * One weighted pick over the eligible kinds. Table order is the tie-break, so a
 * seeded roll gives the same kind for the same seed.
 */
export function pickKind(rt: EventRuntime, rand: () => number, defs: WorldEventDef[] = WORLD_EVENT_DEFS): WorldEventDef | null {
  const pool: WorldEventDef[] = eligibleKinds(rt, defs);
  if (!pool.length) return null;
  const total: number = pool.reduce((n: number, d: WorldEventDef) => n + d.weight, 0);
  let roll: number = rand() * total;
  for (const d of pool) {
    roll -= d.weight;
    if (roll <= 0) return d;
  }
  return pool[pool.length - 1] ?? null;
}

export interface EventStart {
  def: WorldEventDef;
  x: number;
  y: number;
  /** 1-based ordinal of this event in the session (used for stable ids). */
  seq: number;
}

export interface EventTick {
  start: EventStart | null;
  end: EventEnd | null;
  /** Why a due roll was refused — for diagnostics and probes. */
  blocked: BlockReason | null;
}

/**
 * Advance the scheduler by `dt` seconds.
 *
 * Order matters and is the contract tests pin:
 *   1. cooldowns always tick down (a live event is not paused time)
 *   2. a live event ages; it ends on expiry, or when the player has left
 *   3. while one is live, nothing else may roll
 *   4. a due roll is refused (quietly) when the ground is forbidden
 *   5. a start sets that kind's cooldown immediately
 */
export function tickEvents(
  rt: EventRuntime,
  ctx: { dt: number; facts: EventFacts; rand: () => number; distToLive?: number },
  defs: WorldEventDef[] = WORLD_EVENT_DEFS,
  rules: EventRules = EVENT_RULES,
): EventTick {
  const out: EventTick = { start: null, end: null, blocked: null };

  for (const k of Object.keys(rt.cooldowns)) {
    rt.cooldowns[k] = Math.max(0, (rt.cooldowns[k] || 0) - ctx.dt);
  }

  if (rt.live) {
    const live: LiveEvent = rt.live;
    live.age += ctx.dt;
    const d: number = ctx.distToLive ?? Math.hypot(live.x - 0, live.y - 0);
    if (live.age >= live.duration) {
      rt.live = null;
      out.end = { ...live, reason: 'expired' };
      return out;
    }
    if (d > rules.leaveDist) {
      rt.live = null;
      out.end = { ...live, reason: 'left' };
      return out;
    }
    return out;
  }

  rt.rollT += ctx.dt;
  const wait: number = rt.rolls === 0 ? rules.firstDelay : rules.interval;
  if (rt.rollT < wait) return out;
  // The roll is consumed either way: a refused roll waits a full interval again,
  // so a player parked in the hub is not rolled against every frame.
  rt.rollT = 0;
  rt.rolls++;

  const reason: BlockReason | null = eventBlockReason(ctx.facts, rules);
  if (reason) { out.blocked = reason; return out; }

  const def: WorldEventDef | null = pickKind(rt, ctx.rand, defs);
  // Every kind still resting is not a failure — it is the layer pacing itself.
  if (!def) { out.blocked = 'all-resting'; return out; }

  const anchor = ctx.facts.anchor as { x: number; y: number };
  rt.seq++;
  rt.cooldowns[def.kind] = def.cooldown;
  rt.live = { kind: def.kind, x: anchor.x, y: anchor.y, age: 0, duration: def.duration, label: def.label };
  out.start = { def, x: anchor.x, y: anchor.y, seq: rt.seq };
  return out;
}

/** End a live event early (a rescue that was freed, a bloom that was cleansed). */
export function forceEndEvent(rt: EventRuntime, reason: EndReason = 'done'): EventEnd | null {
  if (!rt.live) return null;
  const live: LiveEvent = rt.live;
  rt.live = null;
  return { ...live, reason };
}
