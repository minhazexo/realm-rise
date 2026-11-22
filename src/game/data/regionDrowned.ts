// ─────────────────────────────────────────────────────────────────────────────
// THE DROWNED REACH — the League's river road (docs/WORLD-MAP.md §4, region 6).
//
// Level 6–14, chapters IV–VI. A trade corridor that only works because someone
// is paid to keep it open. The player comes here for passage and finds the
// League's arithmetic laid bare: the toll is not gold, it is a name on a list.
//
// Authored through data/regionKit.defineRegion.
// ─────────────────────────────────────────────────────────────────────────────
import { defineRegion } from './regionKit.ts';
import type { Encounter, Interactable, Landmark, PropSpec, RegionAnchor, RegionPoi, SubRegion } from './region.ts';

const p = (tex: string, dx: number, dy: number, extra: Partial<PropSpec> = {}): PropSpec => ({ tex, dx, dy, ...extra });
const decal = (tex: string, dx: number, dy: number, rot = 0, scale = 1): PropSpec =>
  ({ tex, dx, dy, rot, scale, decal: true });

/* ── Places ─────────────────────────────────────────────────────────────── */

export const DROWNED_SUBREGIONS: SubRegion[] = [
  {
    id: 'toll_bridge', name: 'The Toll Bridge', x: 9200, y: -880, radius: 420, kind: 'hub',
    safe: true, mood: 'camp',
    ambience: { type: 'mist', rate: 1.8, tint: [0x9fb8d8, 0xc0d0e8], drift: -3 },
  },
  {
    id: 'causeway', name: 'The Market Causeway', x: 9280, y: -1240, radius: 460, kind: 'road', mood: 'road',
    ambience: { type: 'mist', rate: 1.4, tint: [0xa8bcd4], drift: -2 },
  },
  {
    id: 'sunken_ward', name: 'The Sunken Ward', x: 9720, y: -1440, radius: 480, kind: 'ruin', mood: 'ruin',
    ambience: { type: 'motes', rate: 1.5, tint: [0xbfd0e8, 0x8fa8c8], drift: -4 },
  },
  {
    id: 'drowned_hall', name: 'The Drowned Hall', x: 9620, y: -620, radius: 420, kind: 'ruin', mood: 'ruin',
    ambience: { type: 'mist', rate: 1.6, tint: [0x9fb8d8, 0x7f98b8], drift: -2 },
  },
  {
    id: 'keeper_gate', name: "The Keeper's Gate", x: 9200, y: -1820, radius: 380, kind: 'arena', mood: 'boss',
    ambience: { type: 'motes', rate: 2.0, tint: [0xd8c8a0, 0xb09060], drift: -6 },
  },
];

/** The bridge house is neutral ground: the League needs it to stay standing. */
export const DROWNED_SAFE_ZONE = { x: 9200, y: -880, radius: 460 };

export const DROWNED_ANCHOR: RegionAnchor = {
  id: 'drowned_reach', name: 'The Drowned Reach', x: 9400, y: -1200, radius: 2800,
};

/* ── Landmarks ─────────────────────────────────────────────────────────── */

const tollBridge: Landmark = {
  id: 'toll_bridge_house', area: 'toll_bridge', label: 'The Toll Bridge', x: 9200, y: -880,
  story: 'A stone span the river has been trying to take for a century. The bridge house has a ledger, a lamp, and a chair for the man who decides whether your cargo is worth more than your life.',
  glow: { color: 0xffc880, radius: 150 },
  props: [
    p('ruin_arch', -90, -30, { scale: 1.3, tint: 0x6d7278, solid: [44, 16] }),
    p('ruin_arch', 90, -26, { scale: 1.3, rot: 0.04, tint: 0x6a6f75, solid: [44, 16] }),
    p('wall_seg', 0, 10, { scale: 1.15, tint: 0x656a70, solid: [46, 12] }),
    p('wall_seg', -70, 60, { rot: 1.57, tint: 0x60656b, solid: [46, 12] }),
    p('tent', -150, 50, { scale: 1.0, solid: [38, 25] }),
    p('campfire', -120, 20, { scale: 0.9 }),
    p('banner', 140, 40, { tint: 0x3f5a7a }),
    p('storage_chest', 60, 70, { scale: 0.9 }),
    p('sign_broken', -30, 84, { rot: -0.2, solid: [10, 8] }),
    p('reed_tuft', 170, 80, { scale: 1.1 }),
    p('lilypad', 150, 100, { scale: 1.0 }),
    decal('decal_footsteps', 0, 50, 0.9),
  ],
};

const causeway: Landmark = {
  id: 'market_causeway', area: 'causeway', label: 'The Market Causeway', x: 9280, y: -1240,
  story: 'Stalls on a road that is under water twice a year. Someone has painted the high-water line on every post, and someone else has painted over it. Trade continues.',
  props: [
    p('cart_wreck', -80, -40, { scale: 1.1, solid: [40, 20] }),
    p('cart_wreck_b', 70, 30, { scale: 1.0, rot: 0.2, solid: [36, 18] }),
    p('tent', 150, -70, { scale: 0.9, solid: [34, 22] }),
    p('tent', -170, 40, { scale: 0.95, flip: true, solid: [36, 24] }),
    p('campfire', 20, 60, { scale: 0.85 }),
    p('sign_broken', 110, 80, { rot: 0.3, solid: [10, 8] }),
    p('storage_chest', -40, 90, { scale: 0.85 }),
    p('rock_small', 180, 50, { scale: 1.2, solid: [22, 16] }),
    p('reed_tuft', -140, -90, { scale: 1.05 }),
    p('reed_tuft', 60, -110, { scale: 0.95, flip: true }),
    p('lilypad', -100, 110, { scale: 1.0 }),
    decal('decal_scorch', 90, 10, 0, 0.9),
    decal('decal_footsteps', -20, -20, 2.4),
  ],
};

const sunkenWard: Landmark = {
  id: 'sunken_ward_arch', area: 'sunken_ward', label: 'The Sunken Ward', x: 9720, y: -1440,
  story: 'The ward was built to hold the river back. It is still holding — the water is simply on the other side of the walls now. Whatever the League sealed inside has had a long time to think.',
  props: [
    p('ruin_arch', 0, -60, { scale: 1.35, tint: 0x66707a, solid: [46, 17] }),
    p('ruin_pillar', -110, 20, { scale: 1.1, solid: [16, 14] }),
    p('ruin_pillar', 100, 30, { scale: 1.0, rot: 0.16, solid: [14, 12] }),
    p('ruin_pillar', -30, 100, { scale: 0.95, solid: [14, 12] }),
    p('wall_seg', 60, 90, { rot: 1.57, tint: 0x606a74, solid: [46, 12] }),
    p('wall_seg', -80, 70, { tint: 0x656f79, solid: [46, 12] }),
    p('lilypad', 150, 70, { scale: 1.1 }),
    p('lilypad', -150, 60, { scale: 1.0, flip: true }),
    p('reed_tuft', 40, -120, { scale: 1.15 }),
    p('rock_mossy', 160, -40, { scale: 1.15, solid: [22, 16] }),
    decal('decal_ash', -60, -80, 0, 1.2),
  ],
};

const drownedHall: Landmark = {
  id: 'drowned_hall_steps', area: 'drowned_hall', label: 'The Drowned Hall', x: 9620, y: -620,
  story: 'A counting house that went under with its ledgers. The stairs still descend into black water, and on quiet nights the League clerks swear they can hear the accounts being read aloud.',
  props: [
    p('ruin_pillar', -90, -30, { scale: 1.2, solid: [16, 14] }),
    p('ruin_pillar', 90, -20, { scale: 1.15, rot: -0.1, solid: [16, 14] }),
    p('ruin_pillar', 0, 60, { scale: 1.0, solid: [14, 12] }),
    p('wall_seg', -130, 40, { rot: 1.57, tint: 0x5f6973, solid: [46, 12] }),
    p('wall_seg', 130, 50, { rot: 1.57, tint: 0x5a646e, solid: [46, 12] }),
    p('ancient_statue', 0, -80, { scale: 0.95, tint: 0x8a94a0, solid: [18, 14] }),
    p('lilypad', -40, 110, { scale: 1.05 }),
    p('lilypad', 60, 120, { scale: 0.95 }),
    p('reed_tuft', 150, 90, { scale: 1.05 }),
    decal('decal_ash', 30, 0, 0, 1.1),
  ],
};

const keeperGate: Landmark = {
  id: 'keeper_gate_arch', area: 'keeper_gate', label: "The Keeper's Gate", x: 9200, y: -1820,
  story: 'The last gate on the river road, and the only one with a chain across it. The chain is not locked. It is held, and it has been held for longer than any one keeper should have been able to hold it.',
  props: [
    p('ruin_arch', -110, -20, { scale: 1.5, tint: 0x5f6870, solid: [50, 18] }),
    p('ruin_arch', 110, -16, { scale: 1.5, rot: -0.03, tint: 0x5c656d, solid: [50, 18] }),
    p('wall_seg', 0, 40, { scale: 1.2, tint: 0x596269, solid: [46, 12] }),
    p('cage_frame', -40, 90, { scale: 1.15, solid: [22, 14] }),
    p('cage_frame', 50, 100, { scale: 1.05, flip: true, solid: [22, 14] }),
    p('rock_mossy', -170, 70, { scale: 1.2, solid: [22, 16] }),
    p('rock_mossy', 170, 60, { scale: 1.1, solid: [20, 14] }),
    decal('decal_blood_a', 0, 70, 0.4),
    decal('decal_scorch', 80, 20, 0, 1.1),
  ],
};

export const DROWNED_LANDMARKS: Landmark[] = [tollBridge, causeway, sunkenWard, drownedHall, keeperGate];

/* ── Designed fights ───────────────────────────────────────────────────── */

export const DROWNED_ENCOUNTERS: Encounter[] = [
  {
    id: 'drowned_toll_ambush', area: 'causeway', label: 'The Unpaid Toll', x: 9320, y: -1400,
    spread: 120, trigger: 280, oneShot: true, ambush: true,
    members: [
      { key: 'bandit_archer', count: 2, role: 'ambush' },
      { key: 'bandit_swordsman', count: 2, role: 'guard' },
    ],
    intro: 'The toll has gone up. It is now everything you are carrying.',
  },
  {
    id: 'drowned_ward_dead', area: 'sunken_ward', label: 'The Ward Keeps Its Dead', x: 9700, y: -1430,
    spread: 140, trigger: 300, oneShot: true,
    members: [
      { key: 'skeleton', count: 3, role: 'patrol' },
      { key: 'swamp_beast', count: 1, role: 'leader' },
    ],
    intro: 'The ward was built to keep something in. It has been very diligent.',
  },
  {
    id: 'drowned_hall_clerks', area: 'drowned_hall', label: 'The Ledger Room', x: 9600, y: -650,
    spread: 120, trigger: 280, oneShot: true,
    members: [
      { key: 'skeleton', count: 2, role: 'idle' },
      { key: 'swamp_beast', count: 1, role: 'guard' },
    ],
    intro: 'Something in the water is still counting.',
  },
  {
    id: 'drowned_gate_guard', area: 'keeper_gate', label: 'The Chain Holds', x: 9200, y: -1800,
    spread: 160, trigger: 340, oneShot: true, alarm: true,
    members: [
      { key: 'bandit_brute', count: 1, role: 'guard' },
      { key: 'bandit_swordsman', count: 2, role: 'patrol' },
    ],
    intro: 'The gate is held, and the holder has help.',
  },
];

/* ── Clickables ────────────────────────────────────────────────────────── */

export const DROWNED_INTERACTABLES: Interactable[] = [
  {
    id: 'drowned_toll_ledger', area: 'toll_bridge', kind: 'lore', label: 'The Toll Ledger',
    x: 9160, y: -900, tex: 'sign_broken', scale: 1.0,
    text: 'Two columns: cargo, and name. The cargo column is short. The name column runs to the end of the book and continues on a second book.',
    flag: 'lore_drowned_ledger',
  },
  {
    id: 'drowned_bridge_cache', area: 'toll_bridge', kind: 'chest', label: "The Keeper's Box",
    x: 9250, y: -930, tex: 'iron_chest', tier: 'iron_chest',
  },
  {
    id: 'drowned_workshop', area: 'toll_bridge', kind: 'station', label: 'Bridge Workshop',
    x: 9130, y: -830, tex: 'forge_hot', scale: 0.85, station: 'workshop',
  },
  {
    id: 'drowned_save', area: 'toll_bridge', kind: 'savepoint', label: 'The Bridge Lamp',
    x: 9200, y: -860, tex: 'ancient_statue', scale: 0.9, tint: 0x9aa4b0,
    text: 'A lamp that has not been out in a hundred years. Rest here; the League keeps its neutral ground.',
  },
  {
    id: 'drowned_causeway_lore', area: 'causeway', kind: 'lore', label: 'The High-Water Post',
    x: 9350, y: -1180, tex: 'ruin_pillar', scale: 0.9, tint: 0x6f7a84,
    text: 'The line is painted at shoulder height. Below it, in older paint: "This is not the river. The river was moved."',
    flag: 'lore_drowned_highwater',
  },
  {
    id: 'drowned_causeway_cache', area: 'causeway', kind: 'chest', label: 'Abandoned Stall',
    x: 9200, y: -1290, tex: 'wooden_chest', tier: 'iron_chest',
  },
  {
    id: 'drowned_ward_lore', area: 'sunken_ward', kind: 'lore', label: 'The Ward Inscription',
    x: 9660, y: -1390, tex: 'ruin_pillar', scale: 1.1, tint: 0x6a747e,
    text: 'Sealed at the League\'s expense. Do not open. Do not drain. Do not ask what the water is for.',
    flag: 'lore_drowned_ward',
  },
  {
    id: 'drowned_ward_cache', area: 'sunken_ward', kind: 'chest', label: 'Ward Strongbox',
    x: 9780, y: -1480, tex: 'royal_chest', tier: 'royal_chest',
  },
  {
    id: 'drowned_hall_lore', area: 'drowned_hall', kind: 'lore', label: 'The Ledger Stone',
    x: 9680, y: -600, tex: 'ruin_pillar', scale: 1.0, tint: 0x6f7a84,
    text: 'A tally cut into stone where the water cannot reach it. Every debt the Reach ever forgave is here. The list is very short.',
    flag: 'lore_drowned_ledger_stone',
  },
  {
    id: 'drowned_gate_cache', area: 'keeper_gate', kind: 'chest', label: "The Keeper's Toll",
    x: 9260, y: -1880, tex: 'royal_chest', tier: 'royal_chest', requiresFlag: 'toll_keeper_slain',
  },
];

/* ── POIs ──────────────────────────────────────────────────────────────── */

export const DROWNED_POIS: RegionPoi[] = [
  { id: 'toll_bridge', x: 9200, y: -880, kind: 'camp_friend', tag: 'toll_bridge', label: 'The Toll Bridge', danger: 2 },
  { id: 'market_causeway', x: 9280, y: -1240, kind: 'ruins', tag: 'market_causeway', label: 'The Market Causeway', danger: 3, chestTier: 'iron_chest' },
  { id: 'sunken_ward', x: 9720, y: -1440, kind: 'ruins', tag: 'sunken_ward', label: 'The Sunken Ward', danger: 5, chestTier: 'royal_chest' },
  { id: 'drowned_hall', x: 9620, y: -620, kind: 'ruins', tag: 'drowned_hall', label: 'The Drowned Hall', danger: 4 },
  { id: 'keeper_gate', x: 9200, y: -1820, kind: 'ruins', tag: 'keeper_gate', label: "The Keeper's Gate", danger: 6, boss: 'toll_keeper', chestTier: 'royal_chest' },
];

export const DROWNED_REGION = defineRegion({
  id: 'drowned_reach',
  anchor: DROWNED_ANCHOR,
  waypoint: { poi: 'toll_bridge' },
  subregions: DROWNED_SUBREGIONS,
  landmarks: DROWNED_LANDMARKS,
  encounters: DROWNED_ENCOUNTERS,
  interactables: DROWNED_INTERACTABLES,
  hazards: [],
  pois: DROWNED_POIS,
  safeZones: [DROWNED_SAFE_ZONE],
  arena: { area: 'keeper_gate', bossKey: 'toll_keeper', flag: 'toll_keeper_slain' },
});
