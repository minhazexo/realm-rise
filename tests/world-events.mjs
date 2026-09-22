// WORLD EVENTS (brief §15) — scheduler rules & data integrity.
// Pure checks (no Phaser, no browser). Chained into `npm test`.
//
// The rule assertions exist because the whole point of the layer is restraint:
// one event at a time, a rest per kind, and three places where nothing may ever
// fire (safe hub, arrival point, live boss). Those are the properties a later
// edit could quietly break without any visible symptom in the hub.
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

const {
  WORLD_EVENT_DEFS, EVENT_RULES, EVENT_AMBUSHES, ELITE_EVENT, TREASURE_EVENT,
  MERCHANT_EVENT, VEIL_ZONE, RESCUE_EVENT, SHRINE_EVENT,
} = await import('../src/game/data/worldEvents.ts');
const {
  createEventRuntime, tickEvents, forceEndEvent, eventBlockReason, pickKind, mulberry32,
} = await import('../src/game/systems/WorldEvents.ts');
const { CHEST_POOLS } = await import('../src/game/data/lootTables.ts');
const { getEnemyDef } = await import('../src/game/data/enemies.ts');
const { getNpcDef } = await import('../src/game/data/npcs.ts');

// ── 1. The table ────────────────────────────────────────────────────────────
const KINDS = ['ambush', 'wandering_elite', 'rescue', 'corrupted_zone', 'treasure_cache', 'traveling_merchant', 'shrine'];
const kinds = new Set(WORLD_EVENT_DEFS.map((d) => d.kind));
ok(WORLD_EVENT_DEFS.length === KINDS.length, `every briefed event kind is tabled (${WORLD_EVENT_DEFS.length})`);
for (const k of KINDS) ok(kinds.has(k), `kind '${k}' is in the table`);
ok(kinds.size === WORLD_EVENT_DEFS.length, 'no duplicated kinds');
for (const d of WORLD_EVENT_DEFS) {
  ok(d.weight > 0, `${d.kind}: has a chance to roll`);
  ok(d.duration > 0, `${d.kind}: lasts a finite time`);
  ok(d.cooldown > 0, `${d.kind}: rests before it may return`);
  ok(typeof d.label === 'string' && d.label.length > 2, `${d.kind}: has a real label`);
  ok(typeof d.title === 'string' && d.title.length > 2, `${d.kind}: announces itself`);
  ok(typeof d.toast === 'string' && d.toast.length > 10, `${d.kind}: tells the player what happened`);
}

// ── 2. The rules of restraint ───────────────────────────────────────────────
ok(EVENT_RULES.maxLive === 1, 'one event may be live at a time');
ok(EVENT_RULES.interval > 0 && EVENT_RULES.firstDelay > 0, 'rolls are paced, with a quiet opening');
ok(EVENT_RULES.leaveDist > EVENT_RULES.anchorMax, 'an event can be walked away from');
ok(EVENT_RULES.arrivalClear > 0, 'the arrival point is protected');
ok(EVENT_RULES.anchorMin < EVENT_RULES.anchorMax, 'anchors sit on a usable ring');

// ── 3. Reused content actually exists ───────────────────────────────────────
for (const roster of EVENT_AMBUSHES) {
  ok(roster.members.length >= 2, `ambush '${roster.id}': several members, not a lone straggler`);
  ok(roster.spread > 0, `ambush '${roster.id}': members get room`);
  ok(typeof roster.intro === 'string' && roster.intro.length > 5, `ambush '${roster.id}': announces itself`);
  for (const m of roster.members) {
    ok(!!getEnemyDef(m.key), `ambush '${roster.id}': enemy '${m.key}' exists`);
    ok(['patrol', 'guard', 'idle', 'leader', 'ambush'].includes(m.role), `ambush '${roster.id}': '${m.key}' has a real role`);
    ok(m.count >= 1, `ambush '${roster.id}': '${m.key}' count is sane`);
  }
}
for (const key of ELITE_EVENT.keys) ok(!!getEnemyDef(key), `elite '${key}' exists`);
ok(ELITE_EVENT.keys.length >= 1, 'at least one elite can wander');
for (const tier of TREASURE_EVENT.tiers) ok(!!CHEST_POOLS[tier], `cache tier '${tier}' has a loot table`);
const merchant = getNpcDef(MERCHANT_EVENT.npcKey);
ok(!!merchant, `pedlar '${MERCHANT_EVENT.npcKey}' exists`);
ok(merchant?.merchant === true, 'the pedlar opens the existing trade UI');
ok(MERCHANT_EVENT.walkSpeed > 28, 'the pedlar walks faster than a village idler');
ok(MERCHANT_EVENT.waypoints >= 2, 'the pedlar has more than one leg to walk');
ok(VEIL_ZONE.radius > 0 && VEIL_ZONE.dps > 0, 'the bloom hurts and has a real footprint');
ok(VEIL_ZONE.gold > 0, 'cleansing pays');
ok(typeof RESCUE_EVENT.tex === 'string' && typeof SHRINE_EVENT.tex === 'string', 'rescue and shrine reuse existing art');

// ── 4. The scheduler, pinned ────────────────────────────────────────────────
// A long rest (100s) against a 20s roll window, so several rolls land inside a
// kind's cooldown — that is the case worth pinning.
const DEFS = [
  { kind: 'ambush', label: 'First', weight: 1, duration: 10, cooldown: 100, title: 'F', toast: 'first event' },
  { kind: 'shrine', label: 'Second', weight: 1, duration: 10, cooldown: 100, title: 'S', toast: 'second event' },
];
const RULES = { interval: 20, firstDelay: 5, maxLive: 1, leaveDist: 400, arrivalClear: 100, anchorMin: 10, anchorMax: 20 };
const OPEN = { inSafe: false, arrivalDist: 9999, bossLive: false, anchor: { x: 5, y: 6 } };
const zero = () => 0;

/** Advance the scheduler in 1s steps, collecting every start/end it reports. */
const run = (rt, seconds, facts = OPEN, distToLive) => {
  const events = [];
  for (let i = 0; i < seconds; i++) {
    const t = tickEvents(rt, { dt: 1, facts, rand: zero, distToLive }, DEFS, RULES);
    if (t.start) events.push({ t: 'start', kind: t.start.def.kind, x: t.start.x, y: t.start.y, seq: t.start.seq });
    if (t.end) events.push({ t: 'end', kind: t.end.kind, reason: t.end.reason });
    if (t.blocked) events.push({ t: 'blocked', reason: t.blocked });
  }
  return events;
};

// (a) the quiet opening, then a start that uses the anchor
{
  const rt = createEventRuntime();
  const early = run(rt, RULES.firstDelay - 1);
  ok(early.length === 0, 'nothing happens during the quiet opening');
  const started = run(rt, 2);
  ok(started[0]?.t === 'start', 'a due roll starts an event');
  ok(started[0]?.x === 5 && started[0]?.y === 6, 'the event starts at the anchor it was given');
  ok(started[0]?.kind === 'ambush', 'the seeded roll takes the first eligible kind');
}

// (b) one at a time — the invariant, checked every second of a long run
{
  const rt = createEventRuntime();
  let overlaps = 0;
  for (let i = 0; i < 400; i++) {
    const wasLive = rt.live !== null;
    const t = tickEvents(rt, { dt: 1, facts: OPEN, rand: zero }, DEFS, RULES);
    if (t.start && wasLive) overlaps++;
  }
  ok(overlaps === 0, 'no event ever starts while another is live');
  ok(rt.seq > 1, 'the layer keeps rolling across a long session');
  for (const kind of Object.keys(rt.cooldowns)) ok(rt.cooldowns[kind] >= 0, `${kind}: rest never goes negative`);
}

// (c) expiry, and the rest that follows it
{
  const rt = createEventRuntime();
  run(rt, RULES.firstDelay + 1);              // ambush starts (duration 10)
  const ev = run(rt, DEFS[0].duration + 1);   // …and expires
  ok(ev.some((e) => e.t === 'end' && e.reason === 'expired'), 'a live event expires at its duration');
  ok(rt.live === null, 'the expired event is cleared');
  ok((rt.cooldowns.ambush || 0) > 0, 'its kind is resting');
  const soon = run(rt, RULES.interval * 3);   // three roll windows inside the rest
  ok(soon.filter((e) => e.t === 'start' && e.kind === 'ambush').length === 0, 'the resting kind cannot be rolled again');
  ok(soon.some((e) => e.t === 'start' && e.kind === 'shrine'), 'a different kind can still happen');
}

// (d) the kind returns once its rest is over
{
  const rt = createEventRuntime();
  run(rt, RULES.firstDelay + 1);
  rt.live = null;                                          // as if withdrawn early
  const evs = run(rt, DEFS[0].cooldown + RULES.interval * 2 + DEFS[0].duration + 4);
  const starts = evs.filter((e) => e.t === 'start');
  ok(starts.some((e) => e.kind === 'ambush'), 'a rested kind can be rolled again');
  ok(starts.length >= 2, 'the layer keeps rolling across a long session');
}

// (e) walking away withdraws the live event
{
  const rt = createEventRuntime();
  run(rt, RULES.firstDelay + 1);
  const left = run(rt, 2, OPEN, RULES.leaveDist + 50);
  ok(left.some((e) => e.t === 'end' && e.reason === 'left'), 'leaving withdraws the event');
  ok(rt.live === null, 'a withdrawn event is cleared');
}

// (f) the three forbidden places — and nowhere to stand
for (const [label, facts, reason] of [
  ['a safe hub', { ...OPEN, inSafe: true }, 'safe-zone'],
  ['the arrival point', { ...OPEN, arrivalDist: 10 }, 'arrival-clearance'],
  ['a live boss fight', { ...OPEN, bossLive: true }, 'boss-fight'],
  ['no legal ground', { ...OPEN, anchor: null }, 'no-ground'],
]) {
  const rt = createEventRuntime();
  run(rt, RULES.firstDelay + 2, facts);
  ok(rt.live === null, `nothing fires in/at ${label}`);
  const rt2 = createEventRuntime();
  const evs = run(rt2, RULES.firstDelay + 2, facts);
  ok(evs.some((e) => e.t === 'blocked' && e.reason === reason), `${label} reports '${reason}'`);
  ok(eventBlockReason(facts, RULES) === reason, `eventBlockReason names '${reason}'`);
}

// (g) a refused roll waits a full interval (no per-frame hammering)
{
  const rt = createEventRuntime();
  const evs = run(rt, RULES.firstDelay + 3, { ...OPEN, inSafe: true });
  ok(evs.filter((e) => e.t === 'blocked').length === 1, 'a blocked roll is consumed once, not retried every second');
}

// (h) seeding: the same seed replays the same stream; a different seed does not.
// Two always-eligible kinds, so the seeded roll is what decides every pick.
{
  const FAST = DEFS.map((d) => ({ ...d, duration: 1, cooldown: 1 }));
  const stream = (seed) => {
    const rt = createEventRuntime();
    const rand = mulberry32(seed);
    const out = [];
    for (let i = 0; i < 400; i++) {
      const t = tickEvents(rt, { dt: 1, facts: OPEN, rand }, FAST, RULES);
      if (t.start) out.push(t.start.def.kind);
    }
    return out.join(',');
  };
  ok(stream(1234) === stream(1234), 'the same seed replays the same event stream');
  ok(stream(1234) !== stream(4321), 'a different seed produces a different stream');
  ok(stream(1234).length > 0, 'a seeded run actually starts events');
  ok(stream(99).includes('shrine'), 'weighted picks reach the later kinds too');
  // The world seed flows in as the runtime's seed, so a save replays its own run.
  ok(mulberry32(7)() === mulberry32(7)(), 'the runtime RNG is seeded, not random');
}

// (i) forced end (freed survivor, cleansed bloom)
{
  const rt = createEventRuntime();
  run(rt, RULES.firstDelay + 1);
  const end = forceEndEvent(rt, 'done');
  ok(end?.reason === 'done', 'an event can be finished early');
  ok(rt.live === null, 'a finished event is cleared');
  ok(forceEndEvent(rt, 'done') === null, 'finishing nothing is safe');
}

// (j) pickKind is exhausted, not broken, when everything is resting
{
  const rt = createEventRuntime();
  rt.cooldowns = { ambush: 10, shrine: 10 };
  ok(pickKind(rt, zero, DEFS) === null, 'no eligible kind means no pick');
  // …and a roll in that state says so honestly instead of blaming the ground.
  const rt2 = createEventRuntime();
  rt2.rollT = RULES.firstDelay;
  rt2.cooldowns = { ambush: 30, shrine: 30 };
  const t = tickEvents(rt2, { dt: 1, facts: OPEN, rand: zero }, DEFS, RULES);
  ok(t.blocked === 'all-resting' && !t.start, 'everything resting is reported as all-resting');
}

console.log(`world-events: ${passed} passed, ${failed} failed`);
console.log(failed === 0 ? '✅ WORLD EVENTS PASS — scheduler restraint and reused content verified.' : `❌ ${failed} world-event failure(s)`);
process.exit(failed ? 1 : 0);
