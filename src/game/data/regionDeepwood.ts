// ─────────────────────────────────────────────────────────────────────────────
// THE DEEPWOOD — the Verdant Clans' forest (docs/WORLD-MAP.md §4, region 3).
//
// Level 4–10, chapters III–IV. The wood the Clans have kept for six hundred
// years, now thinning at its heart. The player comes here for the Clans' oath
// and finds the first proof that the Veil is not weather but a wound.
//
// Authored through data/regionKit.defineRegion, so the containment, trigger and
// safe-zone rules are derived, not re-written. Scene-side streaming is generic.
// ─────────────────────────────────────────────────────────────────────────────
import { defineRegion } from './regionKit.ts';
import type { Encounter, Interactable, Landmark, PropSpec, RegionAnchor, RegionNpc, RegionPoi, SubRegion } from './region.ts';

const p = (tex: string, dx: number, dy: number, extra: Partial<PropSpec> = {}): PropSpec => ({ tex, dx, dy, ...extra });
const decal = (tex: string, dx: number, dy: number, rot = 0, scale = 1): PropSpec =>
  ({ tex, dx, dy, rot, scale, decal: true });

/* ── Places ─────────────────────────────────────────────────────────────── */

export const DEEPWOOD_SUBREGIONS: SubRegion[] = [
  {
    id: 'clan_camp', name: 'Verdant Clan Camp', x: -6480, y: -420, radius: 300, kind: 'hub',
    safe: true, mood: 'village',
    ambience: { type: 'flies', rate: 1.5, tint: [0xc9e8ff, 0xffe8a0], drift: -3 },
  },
  {
    id: 'verdant_way', name: 'The Verdant Way', x: -6200, y: -820, radius: 440, kind: 'road', mood: 'road',
    ambience: { type: 'motes', rate: 1.2, tint: [0xd8e8b0], drift: -2 },
  },
  {
    id: 'thicket', name: 'The Whisper Thicket', x: -5920, y: -1080, radius: 470, kind: 'forest', mood: 'forest',
    ambience: { type: 'flies', rate: 1.8, tint: [0xc9e8ff, 0xbfe0a0], drift: -3 },
  },
  {
    id: 'oath_grove', name: 'The Oath Grove', x: -6540, y: -1120, radius: 430, kind: 'secret', mood: 'shrine',
    ambience: { type: 'motes', rate: 1.6, tint: [0xd0e8c0, 0x9dffd0], drift: -5 },
  },
  {
    id: 'grendel_den', name: "Grendelfang's Den", x: -6200, y: -1520, radius: 400, kind: 'arena', mood: 'boss',
    ambience: { type: 'mist', rate: 2.2, tint: [0x9fb8d8, 0x6f7f9f], drift: -6 },
  },
];

/** The camp is the only ground the Clans keep clear of teeth. */
export const DEEPWOOD_SAFE_ZONE = { x: -6480, y: -420, radius: 340 };

export const DEEPWOOD_ANCHOR: RegionAnchor = {
  id: 'deepwood', name: 'The Deepwood', x: -6200, y: -800, radius: 2600,
};

export const DEEPWOOD_NPCS: RegionNpc[] = [];

/* ── Landmarks ─────────────────────────────────────────────────────────── */

const clanCamp: Landmark = {
  id: 'clan_camp_ground', area: 'clan_camp', label: 'Verdant Clan Camp', x: -6480, y: -420,
  story: 'Six tents in a ring around a fire that has not gone out in living memory. The Clans do not build walls — they build around a tree and let the tree decide where the walls would have been.',
  glow: { color: 0xffd08a, radius: 140 },
  props: [
    p('tent', -70, -50, { scale: 1.05, solid: [40, 26] }),
    p('tent', 20, -80, { scale: 0.95, rot: 0.08, solid: [36, 24] }),
    p('tent', 74, 30, { scale: 1.0, flip: true, solid: [38, 25] }),
    p('tent', -96, 44, { scale: 0.9, solid: [34, 22] }),
    p('campfire', 0, 0, {}),
    p('banner', 6, -104, { tint: 0x4f7a4a }),
    p('storage_chest', -34, 84, { scale: 0.9 }),
    p('tree_oak', -170, -110, { scale: 1.45, solid: [14, 10] }),
    p('tree_birch', 150, -120, { scale: 1.2, solid: [10, 8] }),
    p('berry_bush', 120, 74, { scale: 1.05 }),
    p('herb_plant', -150, 90, { scale: 1.0 }),
    p('log_fallen', 40, 96, { scale: 1.1, rot: 0.1, solid: [30, 11] }),
    decal('decal_footsteps', -20, 40, 1.2),
  ],
};

const verdantWay: Landmark = {
  id: 'verdant_way_stone', area: 'verdant_way', label: 'The Verdant Way', x: -6200, y: -820,
  story: 'A road the forest agreed to leave open. Waystones line it at intervals, each carved with a clan mark and a year — the last stone is blank, and the moss has not reached it yet.',
  props: [
    p('ruin_arch', 0, -40, { scale: 1.15, tint: 0x6f7a63, solid: [40, 14] }),
    p('ruin_pillar', -70, 20, { scale: 0.95, solid: [14, 12] }),
    p('ruin_pillar', 66, 26, { scale: 0.9, rot: 0.12, solid: [14, 12] }),
    p('sign_broken', 34, 76, { rot: 0.24, solid: [10, 8] }),
    p('log_fallen', -120, 64, { scale: 1.15, rot: 0.32, solid: [32, 11] }),
    p('tree_pine', 160, -60, { scale: 1.5, solid: [12, 10] }),
    p('tree_oak', -180, -80, { scale: 1.3, solid: [14, 10] }),
    p('herb_plant', 96, -30, { scale: 1.0 }),
    decal('decal_ash', -30, -90, 0, 1.1),
  ],
};

const thicket: Landmark = {
  id: 'whisper_thicket', area: 'thicket', label: 'The Whisper Thicket', x: -5920, y: -1080,
  story: 'The wood is loud here — not with birds. The canopy leans toward the middle of the thicket and the undergrowth has been flattened in a ring, the way a pack circles a kill it has not made yet.',
  props: [
    p('tree_pine', -140, -80, { scale: 1.6, solid: [12, 10] }),
    p('tree_oak', -40, -130, { scale: 1.45, solid: [14, 10] }),
    p('tree_birch', 70, -90, { scale: 1.25, solid: [10, 8] }),
    p('tree_oak', 150, -40, { scale: 1.3, flip: true, solid: [14, 10] }),
    p('dead_tree', -180, 60, { scale: 1.2, rot: 0.3, solid: [12, 10] }),
    p('log_fallen', 10, 70, { scale: 1.25, solid: [34, 12] }),
    p('log_fallen', -80, 110, { scale: 1.05, rot: 0.4, solid: [28, 10] }),
    p('rock_mossy', 110, 80, { scale: 1.15, solid: [22, 16] }),
    p('tree_stump', 40, 20, { scale: 1.2, solid: [16, 10] }),
    p('mushroom_patch', -110, -20, { scale: 1.1 }),
    p('berry_bush', 90, 10, { scale: 1.05 }),
    decal('decal_blood_a', 20, 40, 0.5),
    decal('decal_footsteps', -40, 30, 1.8),
    // layering: depth behind and in front of the fighting band (map brief §7)
    p('canopy_mass', -60, -190, { band: 'bg', scale: 1.2, alpha: 0.9 }),
    p('under_bush', 60, -160, { band: 'bg', scale: 1.1, alpha: 0.85 }),
    p('frond_near', 26, 60, { band: 'fg', scale: 1.05 }),
    p('frond_near', -60, 20, { band: 'fg', scale: 0.95, flip: true }),
  ],
};

const oathGrove: Landmark = {
  id: 'oath_grove_ring', area: 'oath_grove', label: 'The Oath Grove', x: -6540, y: -1120,
  story: 'Nine stones in a ring, one for each clan that swore to keep the wood. The ninth stone is split down the middle. The Clans say a promise broke here, and the forest has been waiting for someone to say which one.',
  glow: { color: 0x9dffd0, radius: 160 },
  props: [
    p('ruin_pillar', 0, -70, { scale: 1.25, solid: [16, 14] }),
    p('ruin_pillar', 88, -20, { scale: 1.0, rot: 0.2, solid: [14, 12] }),
    p('ruin_pillar', 60, 78, { scale: 0.95, solid: [14, 12] }),
    p('ruin_pillar', -60, 84, { scale: 1.05, rot: -0.14, solid: [14, 12] }),
    p('ruin_pillar', -92, -14, { scale: 0.9, solid: [14, 12] }),
    p('ruin_arch', 0, 130, { scale: 1.1, tint: 0x6a7a6a, solid: [42, 15] }),
    p('tree_oak', 170, -120, { scale: 1.55, solid: [14, 10] }),
    p('tree_birch', -170, -100, { scale: 1.3, solid: [10, 8] }),
    p('herb_plant', 130, 40, { scale: 1.05 }),
    p('mushroom_patch', -130, 50, { scale: 1.0 }),
    decal('decal_ash', 0, 40, 0, 1.25),
  ],
};

const grendelDen: Landmark = {
  id: 'grendel_den_mouth', area: 'grendel_den', label: "Grendelfang's Den", x: -6200, y: -1520,
  story: 'A hollow under a fallen giant of a tree, ringed with bones that were not stripped — only broken. The pack does not hunt here. It waits here, and the wood has learned to be quiet around it.',
  props: [
    p('dead_tree', -120, -90, { scale: 1.7, rot: 0.5, tint: 0x4a4a44, solid: [14, 12] }),
    p('dead_tree', 110, -110, { scale: 1.4, rot: -0.35, tint: 0x4a4a44, solid: [12, 10] }),
    p('log_fallen', 0, -60, { scale: 1.4, solid: [38, 13] }),
    p('rock_mossy', -150, 60, { scale: 1.2, solid: [22, 16] }),
    p('rock_mossy', 140, 50, { scale: 1.1, solid: [20, 14] }),
    p('tree_stump', 20, 90, { scale: 1.35, solid: [18, 11] }),
    p('cage_frame', -60, 110, { scale: 1.05, solid: [22, 14] }),
    decal('decal_blood_a', 0, 30, 0.8, 1.2),
    decal('decal_blood_b', 40, 70, 2.1),
    decal('decal_footsteps', -30, 60, 0.6),
    decal('decal_scorch', 70, 10, 0, 1.1),
  ],
};

export const DEEPWOOD_LANDMARKS: Landmark[] = [clanCamp, verdantWay, thicket, oathGrove, grendelDen];

/* ── Designed fights ───────────────────────────────────────────────────── */

export const DEEPWOOD_ENCOUNTERS: Encounter[] = [
  {
    id: 'deepwood_way_watch', area: 'verdant_way', label: 'Clan Outriders', x: -6230, y: -790,
    spread: 90, trigger: 300, oneShot: true, alarm: true,
    members: [
      { key: 'wolf', count: 2, role: 'patrol' },
      { key: 'goblin', count: 1, role: 'leader' },
    ],
    intro: 'Clan outriders have been driven off the road — something with teeth holds it now.',
  },
  {
    id: 'deepwood_thicket_pack', area: 'thicket', label: 'The Ring of Wolves', x: -5940, y: -1070,
    spread: 130, trigger: 260, oneShot: true, ambush: true,
    members: [
      { key: 'wolf', count: 3, role: 'ambush' },
      { key: 'dire_wolf', count: 1, role: 'leader' },
    ],
    intro: 'The thicket closes behind you. They were already circling.',
  },
  {
    id: 'deepwood_grove_bear', area: 'oath_grove', label: 'The Grove Warden', x: -6520, y: -1110,
    spread: 110, trigger: 280, oneShot: true,
    members: [
      { key: 'bear', count: 1, role: 'guard' },
      { key: 'boar', count: 2, role: 'idle' },
    ],
    intro: 'Something huge has made its den against the split stone.',
  },
  {
    id: 'deepwood_den_rings', area: 'grendel_den', label: 'The Bone Ring', x: -6200, y: -1500,
    spread: 150, trigger: 340, oneShot: true, alarm: true,
    members: [
      { key: 'dire_wolf', count: 2, role: 'guard' },
      { key: 'wolf', count: 2, role: 'patrol' },
    ],
    intro: 'The pack rises out of the bone ring as one animal.',
  },
];

/* ── Clickables ────────────────────────────────────────────────────────── */

export const DEEPWOOD_INTERACTABLES: Interactable[] = [
  {
    id: 'deepwood_clan_lore', area: 'clan_camp', kind: 'lore', label: 'The Clan Ledger',
    x: -6500, y: -380, tex: 'banner', scale: 0.95, tint: 0x4f7a4a,
    text: 'Names, in columns, each with a year. The last column has one name and no year: "Elara — went to the frontier to see what the Clans had forgotten."',
    flag: 'lore_deepwood_ledger',
  },
  {
    id: 'deepwood_camp_cache', area: 'clan_camp', kind: 'chest', label: 'Clan Stores',
    x: -6440, y: -470, tex: 'iron_chest', tier: 'iron_chest',
  },
  {
    id: 'deepwood_forge', area: 'clan_camp', kind: 'station', label: 'Clan Forge',
    x: -6420, y: -360, tex: 'forge_hot', scale: 0.9, station: 'forge',
  },
  {
    id: 'deepwood_altar', area: 'clan_camp', kind: 'savepoint', label: 'The Clan Fire',
    x: -6480, y: -440, tex: 'ancient_statue', scale: 0.95, tint: 0x8f8aa0,
    text: 'A ring of stones, a fire that is never allowed to die. Rest here and the Clans will remember your name.',
  },
  {
    id: 'deepwood_way_lore', area: 'verdant_way', kind: 'lore', label: 'The Blank Waystone',
    x: -6170, y: -860, tex: 'ruin_pillar', scale: 0.95, tint: 0x6f7a63,
    text: 'Every stone on this road carries a year and a clan mark. This one is blank, and the chisel is still in the grass beside it.',
    flag: 'lore_deepwood_waystone',
  },
  {
    id: 'deepwood_thicket_cache', area: 'thicket', kind: 'chest', label: "Poacher's Cache",
    x: -5860, y: -1010, tex: 'wooden_chest', tier: 'iron_chest',
  },
  {
    id: 'deepwood_grove_lore', area: 'oath_grove', kind: 'lore', label: 'The Split Stone',
    x: -6560, y: -1070, tex: 'ruin_pillar', scale: 1.1, tint: 0x7a8a7a,
    text: 'Eight marks are clean. The ninth was struck so hard the stone split: "We will not raise a hand against another clan, not even to save the wood."',
    flag: 'lore_deepwood_oath',
  },
  {
    id: 'deepwood_grove_cache', area: 'oath_grove', kind: 'chest', label: 'Offering Stone',
    x: -6500, y: -1180, tex: 'ancient_chest', tier: 'ancient_chest',
  },
  {
    id: 'deepwood_den_lore', area: 'grendel_den', kind: 'lore', label: 'The Bone Cairn',
    x: -6150, y: -1470, tex: 'tree_stump', scale: 1.2,
    text: 'Bones stacked with care, not scattered. The pack did not eat here. Someone else built this, and the pack has been guarding it since.',
    flag: 'lore_deepwood_cairn',
  },
  {
    id: 'deepwood_den_cache', area: 'grendel_den', kind: 'chest', label: "Grendelfang's Cache",
    x: -6280, y: -1580, tex: 'royal_chest', tier: 'royal_chest', requiresFlag: 'grendelfang_slain',
  },
];

/* ── POIs ──────────────────────────────────────────────────────────────── */

export const DEEPWOOD_POIS: RegionPoi[] = [
  { id: 'deepwood_camp', x: -6480, y: -420, kind: 'camp_friend', tag: 'deepwood_camp', label: 'Verdant Clan Camp', danger: 1 },
  { id: 'verdant_way', x: -6200, y: -820, kind: 'ruins', tag: 'verdant_way', label: 'The Verdant Way', danger: 2 },
  { id: 'whisper_thicket', x: -5920, y: -1080, kind: 'ruins', tag: 'whisper_thicket', label: 'The Whisper Thicket', danger: 3, chestTier: 'iron_chest' },
  { id: 'oath_grove', x: -6540, y: -1120, kind: 'shrine', tag: 'oath_grove', label: 'The Oath Grove', danger: 3 },
  { id: 'grendelfang_den', x: -6200, y: -1520, kind: 'ruins', tag: 'grendelfang_den', label: "Grendelfang's Den", danger: 5, boss: 'alpha_wolf', chestTier: 'royal_chest' },
];

export const DEEPWOOD_REGION = defineRegion({
  id: 'deepwood',
  anchor: DEEPWOOD_ANCHOR,
  waypoint: { poi: 'deepwood_camp' },
  subregions: DEEPWOOD_SUBREGIONS,
  landmarks: DEEPWOOD_LANDMARKS,
  encounters: DEEPWOOD_ENCOUNTERS,
  interactables: DEEPWOOD_INTERACTABLES,
  hazards: [
    { id: 'deepwood_veil_a', area: 'oath_grove', kind: 'corruption', x: -6620, y: -1160, radius: 78, dps: 3, label: 'Veil seep' },
    { id: 'deepwood_veil_b', area: 'grendel_den', kind: 'corruption', x: -6260, y: -1440, radius: 70, dps: 3, label: 'Veil seep', bossKey: 'alpha_wolf' },
  ],
  npcs: DEEPWOOD_NPCS,
  pois: DEEPWOOD_POIS,
  safeZones: [DEEPWOOD_SAFE_ZONE],
  arena: { area: 'grendel_den', bossKey: 'alpha_wolf', flag: 'grendelfang_slain' },
});
