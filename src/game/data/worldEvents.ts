// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENTS (brief §15) — the table the dynamic-event scheduler rolls from.
//
// The brief's demand is that exploration stop being predictable: "lightweight
// dynamic events: enemy ambush, traveling merchant, wandering elite, treasure
// event, corrupted zone, NPC rescue, mysterious shrine, hidden boss".
//
// This file is DATA only. It says what each event is, how long it may live, how
// long its kind must rest afterwards, and which existing content it reuses — a
// wandering elite is a SpawnDirector spawn of a real ELITES entry, an ambush is
// a real designed-encounter roster, a rescue is the shipped hostage path, a
// treasure cache is a real CHEST_POOLS tier. Nothing here invents a second
// version of any of those.
//
// Pure: no Phaser, no scene, so tests/world-events.mjs can pin every rule.
// ─────────────────────────────────────────────────────────────────────────────
import { ELITES } from './elites.ts';
import type { EncounterMember } from './region.ts';

export type WorldEventKind =
  | 'ambush'
  | 'wandering_elite'
  | 'rescue'
  | 'corrupted_zone'
  | 'treasure_cache'
  | 'traveling_merchant'
  | 'shrine';

export interface WorldEventDef {
  kind: WorldEventKind;
  label: string;
  /** Relative chance of being picked when a roll is due. */
  weight: number;
  /** Seconds a live event lasts before it withdraws on its own. */
  duration: number;
  /** Seconds this kind must rest after it has been used. */
  cooldown: number;
  /** Toast title, upper-case by convention. */
  title: string;
  /** Toast body — one line, because it is read mid-fight. */
  toast: string;
}

/**
 * Every dynamic event, in pick order (the scheduler walks this list and takes
 * the first eligible entry its seeded roll lands on, so the table IS the
 * probability order — heaviest first).
 */
export const WORLD_EVENT_DEFS: WorldEventDef[] = [
  {
    kind: 'ambush', label: 'Roadside ambush', weight: 3, duration: 90, cooldown: 150,
    title: 'AMBUSH', toast: 'They were waiting for the next column.',
  },
  {
    kind: 'wandering_elite', label: 'Wandering elite', weight: 2.5, duration: 120, cooldown: 210,
    title: 'SOMETHING IS HUNTING', toast: 'A named beast is working this ground.',
  },
  {
    kind: 'rescue', label: 'Caged survivor', weight: 2, duration: 180, cooldown: 240,
    title: 'RESCUE', toast: 'Someone is still alive out here.',
  },
  {
    kind: 'corrupted_zone', label: 'Veil bloom', weight: 2, duration: 150, cooldown: 260,
    title: 'THE VEIL BLOOMS', toast: 'The ground has gone wrong here. Cleanse it.',
  },
  {
    kind: 'treasure_cache', label: 'Buried cache', weight: 1.6, duration: 150, cooldown: 280,
    title: 'CACHE REVEALED', toast: 'Freshly turned earth, and a lid beneath it.',
  },
  {
    kind: 'traveling_merchant', label: 'Traveling pedlar', weight: 1.4, duration: 200, cooldown: 300,
    title: 'A PEDLAR ON THE ROAD', toast: 'Corvin is working this road — he will not wait long.',
  },
  {
    kind: 'shrine', label: 'Wayside shrine', weight: 1.2, duration: 180, cooldown: 300,
    title: 'A SHRINE STANDS', toast: 'Someone built this and left it lit.',
  },
];

export interface EventRules {
  /** Seconds between rolls once the world is running. */
  interval: number;
  /** Quiet time after entering the world before the first roll. */
  firstDelay: number;
  /** Live events allowed at once. The brief's rule is one. */
  maxLive: number;
  /** Player farther than this from a live event → it withdraws. */
  leaveDist: number;
  /** Never within this of where the player entered the world this session. */
  arrivalClear: number;
  /** An anchor is placed on a ring this far from the player. */
  anchorMin: number;
  anchorMax: number;
}

export const EVENT_RULES: EventRules = {
  interval: 55,
  firstDelay: 25,
  maxLive: 1,
  leaveDist: 900,
  arrivalClear: 700,
  anchorMin: 320,
  anchorMax: 560,
};

/* ── Ambush: a real designed encounter, rosters with roles (never scatter) ─── */

export interface AmbushRoster {
  id: string;
  label: string;
  intro: string;
  /** Members spawn within this radius of the anchor. */
  spread: number;
  members: EncounterMember[];
}

/**
 * An ambush spawned by an event still obeys the region's rule — members with
 * ROLES, no random scatter. `ambush` members charge, the rest hold position.
 */
export const EVENT_AMBUSHES: AmbushRoster[] = [
  {
    id: 'road', label: 'Roadside ambush', intro: 'AMBUSH — they were waiting for the next column.',
    spread: 95,
    members: [
      { key: 'bandit_swordsman', count: 2, role: 'idle' },
      { key: 'bandit_archer', count: 1, role: 'idle' },
      { key: 'wolf', count: 1, role: 'ambush' },
    ],
  },
  {
    id: 'wild', label: 'Beast ambush', intro: 'The brush moved before you did.',
    spread: 85,
    members: [
      { key: 'wolf', count: 2, role: 'ambush' },
      { key: 'boar', count: 1, role: 'guard' },
    ],
  },
];

/* ── The Veil bloom: raised out of nothing, cleansed by hand ──────────────── */

export const VEIL_ZONE = {
  /** Damage radius. Big enough to read as ground, small enough to walk out of. */
  radius: 150,
  /** Damage per second at the centre (the shipped hazard applies dps * 0.5). */
  dps: 6,
  /** Violet corruption palette (matches RegionArena's corruption hazard). */
  tint: 0x8a5ad0,
  poolTint: 0x4a2a72,
  /** Gold for cleansing it. */
  gold: 60,
  /** Player must clear the bloom before it can be cleansed. */
  clearRadius: 320,
  title: 'THE VEIL BLOOMS',
  held: 'Something still walks in the bloom. Clear it first.',
  cleansed: 'The ground remembers what it was.',
};

/* ── Reused content ───────────────────────────────────────────────────────── */

/** The traveling merchant is the shipped pedlar, walked between waypoints. */
export const MERCHANT_EVENT = {
  npcKey: 'corvin',
  /** Waypoints walked per event, on a ring around the anchor. */
  waypoints: 3,
  /** Faster than the 28 px/s village wander — a merchant covers ground. */
  walkSpeed: 56,
  ringMin: 150,
  ringMax: 420,
  goneToast: 'Corvin packs up and moves on.',
};

/** Elites are real ELITES entries; the event only chooses where one hunts. */
export const ELITE_EVENT = {
  keys: Object.keys(ELITES).sort(),
  /** The elite gives up the hunt after this long (matches its event duration). */
  withdrawToast: 'The hunt moves on.',
};

/** Treasure caches pay out through the shipped chest path and its tiers. */
export const TREASURE_EVENT = {
  tiers: ['iron_chest', 'royal_chest', 'ancient_chest'],
  /** The earth takes back a cache nobody found. */
  goneToast: 'The cache settles back into the earth.',
};

/** Rescue reuses the hostage path verbatim, cage and all. */
export const RESCUE_EVENT = {
  tex: 'cage_frame',
  scale: 1.05,
  label: 'Caged Survivor',
  text: 'A survivor, wrists raw from rope. "They took the others up the road. Please — before they come back."',
};

/** A wayside shrine reuses the savepoint path: rest, heal, and it is gone. */
export const SHRINE_EVENT = {
  tex: 'temple_shrine',
  scale: 0.9,
  tint: 0x8d8778,
  label: 'Wayside Shrine',
  text: 'A shrine raised by someone who never came back for it.',
};
