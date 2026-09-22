// ─────────────────────────────────────────────────────────────────────────────
// THE ASHEN FRONTIER — authored region data (map brief §1–§34).
//
// A once-thriving kingdom frontier destroyed by The Veil. This file is the
// single source of truth for the region: sub-areas, landmarks composed from
// the existing prop library (+ the ashen story decals), designed encounters
// with enemy ROLES (patrol/guard/idle/leader/ambush — never random scatter),
// interactables, hazards, the crystal-sequence puzzle, per-area ambience and
// the POIs fed into worldGen so discovery, minimap fog and quests all work.
//
// Pure data + pure helpers: no Phaser import, so it is unit-testable and the
// scene-side placement lives in systems/RegionSystem.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** One prop in a landmark's composition, offset from the landmark centre. */
export interface PropSpec {
  /** Texture key (existing world props or propsAshen.ts decals). */
  tex: string;
  dx: number;
  dy: number;
  scale?: number;
  flip?: boolean;
  /** Radians; used for toppled trees, leaning signs. */
  rot?: number;
  tint?: number;
  /** Collision box [w, h] — omit for decals and walk-over dressing. */
  solid?: [number, number];
  /** Draw below actors (decals) instead of y-sorted with them. */
  decal?: boolean;
  /** Opacity override (depth-banded foliage sits back a little). */
  alpha?: number;
  /**
   * Depth band (map brief §7, the Whispering Forest composition):
   *   'bg' — the deep wood: canopy and understory BEHIND the walkable band,
   *          authored clear of the path so it never sits where you walk
   *   'fg' — near-camera foliage IN FRONT of the player, placed ON the path so
   *          it passes over the hero (RegionSystem fades what you are behind)
   * Omitted = the gameplay band: y-sorted with actors, the layer you fight in.
   */
  band?: 'bg' | 'fg';
}

/** A named point of interest the player learns to navigate by. */
export interface Landmark {
  id: string;
  /** Owner sub-region id. */
  area: string;
  label: string;
  x: number;
  y: number;
  /** What happened here — surfaced as discovery/lore text. */
  story: string;
  props: PropSpec[];
  /** Optional ambient light (torch/brazier/crystal glow). */
  glow?: { color: number; radius: number };
}

/** A named sub-area with its own ambience and gameplay character. */
export interface SubRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  /** 'hub' | 'road' | 'forest' | 'ruin' | 'corrupted' | 'camp' | 'arena' | 'secret' */
  kind: string;
  ambience: AmbienceSpec;
  /** Audio mood key (see AudioSystem.setRegionMood). */
  mood: string;
  /** Enemies suppressed inside this radius (safe hub). */
  safe?: boolean;
}

export interface AmbienceSpec {
  /** 'smoke' | 'motes' | 'ash' | 'embers' | 'mist' | 'flies' | 'none' */
  type: string;
  /** Particles per second (already low — atmosphere, not confetti). */
  rate: number;
  tint: number[];
  /** Vertical drift bias. */
  drift?: number;
}

export type EncounterRole = 'patrol' | 'guard' | 'idle' | 'leader' | 'ambush';

/** One member of a designed encounter. */
export interface EncounterMember {
  key: string;
  count: number;
  role: EncounterRole;
}

/** A hand-placed fight: it has a reason to exist, and space to fight in. */
export interface Encounter {
  id: string;
  area: string;
  label: string;
  x: number;
  y: number;
  /** Members spawn within this radius, not on top of each other. */
  spread: number;
  /** Player must come this close to trigger it. */
  trigger: number;
  members: EncounterMember[];
  /** Ambushers stay hidden until the trigger fires, then charge. */
  ambush?: boolean;
  /** One-shot per save (no respawn farming of the same designed fight). */
  oneShot?: boolean;
  /** Guards that hear the alarm converge on whoever started the fight. */
  alarm?: boolean;
  /** Toast shown when the fight starts. */
  intro?: string;
}

/** Clickable world object (pointer-based, matching the chest/NPC convention). */
export interface Interactable {
  id: string;
  area: string;
  kind: 'chest' | 'savepoint' | 'lore' | 'crystal' | 'hostage' | 'station';
  label: string;
  x: number;
  y: number;
  tex: string;
  scale?: number;
  tint?: number;
  /** Chest tier (see CHEST_POOLS) for kind 'chest'. */
  tier?: string;
  /** Lore body for kind 'lore' / 'hostage'. */
  text?: string;
  /** Flags written when used. */
  flag?: string;
  /** Crystal id for the puzzle sequence. */
  crystal?: string;
  /**
   * Crafting station this object provides (kind 'station'): the region's own
   * source of the same station a settlement building grants, so the hub works
   * without a settlement. See BuildSystem.setAuthoredStations.
   */
  station?: string;
  /** Spawn only after this flag is set. */
  requiresFlag?: string;
}

/** Environmental damage/atmosphere zone. */
export interface Hazard {
  id: string;
  area: string;
  kind: 'corruption' | 'fire';
  x: number;
  y: number;
  radius: number;
  /** Damage per second while standing inside. */
  dps: number;
  /** Only lethal while this boss is alive (arena vents). */
  bossKey?: string;
  label: string;
}

/** The corrupted hollow's three-crystal sequence puzzle. */
export interface Puzzle {
  id: string;
  area: string;
  /** Correct activation order (crystal ids). */
  sequence: string[];
  /** Toast while in progress / wording. */
  prompt: string;
  /** Flags + rewards on success. */
  flag: string;
  rewardTier: string;
  rewardItem: string;
  failText: string;
  doneText: string;
}

/** POI fed into worldGen → discovery, markers, minimap fog, quests. */
export interface RegionPoi {
  id: string;
  x: number;
  y: number;
  kind: string;
  label: string;
  tag: string;
  danger: number;
  chestTier?: string;
  npc?: string;
  /** Key of the boss that holds this POI (the arena's spawn point). */
  boss?: string;
}

// ── Sub-areas ───────────────────────────────────────────────────────────────
// Laid out around the spawn point (0, 260): a dense ~2 km frontier, not an
// empty map. Order of travel: village → road → camp → forest → tower →
// bridge → hollow → secret shrine → the Warden's Pyre (existing boss POI).

export const ASHEN_SUBREGIONS: SubRegion[] = [
  {
    id: 'village', name: 'Ruined Ashen Village', x: -90, y: 330, radius: 430, kind: 'hub',
    safe: true, mood: 'village',
    ambience: { type: 'smoke', rate: 1.6, tint: [0x6d6a63, 0x8a857c], drift: -6 },
  },
  {
    id: 'road', name: 'The Broken Road', x: 240, y: -40, radius: 300, kind: 'road', mood: 'road',
    ambience: { type: 'motes', rate: 1.1, tint: [0xc9c2a8], drift: -2 },
  },
  {
    id: 'camp', name: 'Ragged Hollow Camp', x: 540, y: 40, radius: 260, kind: 'camp', mood: 'camp',
    ambience: { type: 'embers', rate: 2.0, tint: [0xffb45a, 0xff8c3a], drift: -14 },
  },
  {
    id: 'forest', name: 'Whispering Forest', x: 760, y: -420, radius: 620, kind: 'forest', mood: 'forest',
    ambience: { type: 'flies', rate: 1.4, tint: [0xc9e8ff, 0xffe8a0], drift: -3 },
  },
  {
    id: 'tower', name: 'The Old Watchtower', x: -720, y: -520, radius: 200, kind: 'ruin', mood: 'ruin',
    ambience: { type: 'ash', rate: 1.2, tint: [0xb9b4ac], drift: -5 },
  },
  {
    id: 'bridge', name: 'The Broken Bridge', x: 250, y: -700, radius: 190, kind: 'ruin', mood: 'ruin',
    ambience: { type: 'mist', rate: 1.0, tint: [0x9fb8d8], drift: -2 },
  },
  {
    id: 'hollow', name: 'The Corrupted Hollow', x: -260, y: -1120, radius: 300, kind: 'corrupted', mood: 'corrupted',
    ambience: { type: 'ash', rate: 3.4, tint: [0xb9b4ac, 0x9d4dff], drift: -7 },
  },
  {
    id: 'shrine', name: 'The Forsaken Shrine', x: 1180, y: -980, radius: 180, kind: 'secret', mood: 'shrine',
    ambience: { type: 'motes', rate: 1.8, tint: [0xd0c0ff, 0x9d4dff], drift: -6 },
  },
  {
    id: 'pyre', name: "The Warden's Pyre", x: 980, y: -1520, radius: 420, kind: 'arena', mood: 'boss',
    ambience: { type: 'embers', rate: 3.0, tint: [0xffb45a, 0xff5a3a], drift: -18 },
  },
];

/** No enemy spawns inside this radius of the village centre (the safe hub). */
export const ASHEN_SAFE_ZONE = { x: -90, y: 330, radius: 470 };

// ── Landmarks ───────────────────────────────────────────────────────────────
// Built from the shipped prop library + propsAshen decals, so the region keeps
// one visual language. Long form here on purpose: this IS the level design.

const p = (tex: string, dx: number, dy: number, extra: Partial<PropSpec> = {}): PropSpec => ({ tex, dx, dy, ...extra });
const decal = (tex: string, dx: number, dy: number, rot = 0, scale = 1): PropSpec =>
  ({ tex, dx, dy, rot, scale, decal: true });

// ── Whispering Forest: the four-band composition ────────────────────────────
// The forest used to be a flat scatter: trees the player walked past at random
// depth. A forest reads as a PLACE only when it is layered, so the wood is
// authored in bands (map brief §7): a dense background of canopy and understory
// that never touches the path, varied midground trees/logs/rocks y-sorted with
// the player, and a true foreground band on the path itself whose depth is
// above the hero, so walking the trail passes partially behind it.

/** The walkable corridor: the segment between the forest's two encounters. */
export const FOREST_CORRIDOR = { ax: 660, ay: -340, bx: 880, by: -540 };
/** Background-band props sit at least this far from the corridor axis. */
export const FOREST_BG_CLEARANCE = 150;
/** Foreground-band props sit within this of the axis, so a walk meets them. */
export const FOREST_FG_REACH = 84;
/** North of this the wood gives way to the stream (see the bank props). */
export const FOREST_DEEP_WOOD_MAX_Y = -700;

/** Perpendicular distance from a point to the forest corridor's axis. */
export function corridorDistance(x: number, y: number): number {
  const { ax, ay, bx, by } = FOREST_CORRIDOR;
  const vx: number = bx - ax, vy: number = by - ay;
  const t: number = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
}

/** Local mulberry32 — the band scatter must be identical on every machine. */
function forestRng(seed: number): () => number {
  let s: number = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t: number = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The forest's depth bands, generated deterministically (pure — this is data,
 * and tests assert the band invariants: background clear of the corridor,
 * foreground on it, no banded prop carrying collision).
 */
export function forestBands(): PropSpec[] {
  const rnd = forestRng(0x5EEDF0);
  const out: PropSpec[] = [];
  const CX: number = 760, CY: number = -420;

  // ── Background: canopy the path threads through, plus the dim understory
  //    floor. Rings give even density without a scatter of random clumps.
  // Counts and scales are tuned for overdraw: the canopy is large and
  // alpha-blended, so the outer rings are kept sparse rather than lush (measured
  // ~17 ms/frame for the band at 52 canopy props vs ~12 ms trimmed).
  const rings: { r: number; n: number; tex: string; min: number; max: number }[] = [
    { r: 560, n: 12, tex: 'canopy_mass', min: 2.2, max: 2.9 },
    { r: 430, n: 11, tex: 'canopy_mass', min: 1.8, max: 2.4 },
    { r: 300, n: 14, tex: 'under_bush', min: 1.2, max: 1.8 },
    { r: 205, n: 12, tex: 'under_bush', min: 0.9, max: 1.5 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a: number = (i / ring.n) * Math.PI * 2 + (rnd() - 0.5) * 0.24;
      const r: number = ring.r * (0.88 + rnd() * 0.24);
      const x: number = CX + Math.cos(a) * r;
      const y: number = CY + Math.sin(a) * r * 0.86;   // the wood is a shallow hollow
      if (y < FOREST_DEEP_WOOD_MAX_Y) continue;        // never over the stream
      if (corridorDistance(x, y) < FOREST_BG_CLEARANCE) continue;
      out.push({
        tex: ring.tex, dx: x - CX, dy: y - CY, band: 'bg',
        scale: ring.min + rnd() * (ring.max - ring.min),
        rot: (rnd() - 0.5) * 0.3, flip: rnd() < 0.5, alpha: 0.95,
      });
    }
  }

  // ── Background trunks: the canopy those rings are the floor of, dark and
  //    set back so the midground trees still read in front of them.
  for (let i = 0; i < 10; i++) {
    const a: number = (i / 10) * Math.PI * 2 + 0.24 + (rnd() - 0.5) * 0.3;
    const r: number = 370 + rnd() * 215;
    const x: number = CX + Math.cos(a) * r;
    const y: number = CY + Math.sin(a) * r * 0.86;
    if (y < FOREST_DEEP_WOOD_MAX_Y) continue;
    if (corridorDistance(x, y) < FOREST_BG_CLEARANCE) continue;
    out.push({
      tex: rnd() < 0.62 ? 'tree_pine' : 'tree_oak', dx: x - CX, dy: y - CY, band: 'bg',
      scale: 1.7 + rnd() * 0.6, tint: 0x3a4630, alpha: 0.9, flip: rnd() < 0.5,
    });
  }

  // ── Foreground: near-camera foliage ON the trail, alternating sides and
  //    spread along its length so a walk is overlapped for a step or two at a
  //    time — never hidden (RegionSystem fades what the player is behind).
  const { ax, ay, bx, by } = FOREST_CORRIDOR;
  const nx: number = -(by - ay), ny: number = bx - ax;
  const nl: number = Math.hypot(nx, ny) || 1;
  const fgTex: string[] = ['frond_near', 'frond_near', 'under_bush', 'frond_near'];
  for (let i = 0; i < 12; i++) {
    const t: number = (i + 0.5) / 12;
    const off: number = (10 + rnd() * (FOREST_FG_REACH - 10)) * (i % 2 === 0 ? 1 : -1);
    const x: number = ax + (bx - ax) * t + (nx / nl) * off;
    const y: number = ay + (by - ay) * t + (ny / nl) * off;
    out.push({
      tex: fgTex[i % fgTex.length]!, dx: x - CX, dy: y - CY, band: 'fg',
      scale: 1.0 + rnd() * 0.6, flip: rnd() < 0.5, alpha: 0.95,
    });
  }
  return out;
}

export const ASHEN_LANDMARKS: Landmark[] = [
  {
    id: 'ashen_village_hall', area: 'village', label: 'Ashen Village', x: -90, y: 330,
    story: 'The market was still standing when the smoke came. Doors torn outward, carts looted, a cage dragged to the road — they took people, not just stores.',
    glow: { color: 0xffb45a, radius: 150 },
    props: [
      // ruined shell of the hall + surrounding houses
      p('house', -70, -30, { tint: 0x6a6158, solid: [96, 40] }),
      p('hut_t1', 60, 10, { scale: 1.05, tint: 0x6f665c, solid: [56, 32] }),
      p('hut_t2', -150, 90, { scale: 0.95, tint: 0x6a6158, solid: [64, 34], flip: true }),
      p('hut_t1', 130, 120, { scale: 0.9, tint: 0x736a60, solid: [50, 30] }),
      // the marketplace, abandoned mid-trade
      p('market_stalls', 10, 120, { tint: 0x6d6459, solid: [104, 34] }),
      // damaged well + broken fence line
      p('ruin_pillar', -30, 60, { solid: [16, 14] }),
      p('ruin_pillar', -6, 58, { scale: 0.8, rot: 0.4, solid: [14, 12] }),
      p('wall_seg', 90, 60, { rot: 0.06, tint: 0x6b655c, solid: [46, 12] }),
      p('wall_seg', 146, 58, { rot: -0.1, tint: 0x655f57, solid: [46, 12] }),
      // the attack, told in objects
      p('decal_blood_a', -8, 92, { decal: true }),
      p('decal_blood_b', 46, 78, { decal: true, rot: 0.6 }),
      p('decal_scorch', 100, 96, { decal: true }),
      p('decal_footsteps', 20, 60, { decal: true, rot: -0.5 }),
      p('cart_wreck', -64, 132, { scale: 1.05, solid: [26, 16] }),
      p('sign_broken', 6, 26, { solid: [10, 8] }),
      p('cage_frame', 92, 150, { scale: 1.0, solid: [22, 14] }),
      p('dead_tree', -180, 20, { scale: 1.15, tint: 0x5d554d, solid: [14, 10] }),
      p('tent', -140, 170, { scale: 0.9, tint: 0x6b5a48, solid: [40, 26] }),
      p('campfire', 30, 176, { scale: 1.0 }),
      p('storage_chest', -18, 200, { scale: 0.9 }),
    ],
  },
  {
    id: 'road_marker', area: 'road', label: 'The Broken Road', x: 240, y: -40,
    story: 'A supply column died on this road. Barrels spilled, a sign hammered flat, and a trail of blood leading north-east into the trees.',
    props: [
      p('cart_wreck', -20, 10, { scale: 1.1, solid: [26, 16] }),
      p('cart_wreck', 70, -26, { scale: 0.85, rot: 0.3, solid: [22, 14] }),
      p('sign_broken', -78, -18, { solid: [10, 8] }),
      p('decal_blood_b', 26, 26, { decal: true, rot: 1.1 }),
      p('decal_footsteps', -30, 40, { decal: true, rot: -0.2 }),
      p('decal_ash', 96, 26, { decal: true }),
      p('dead_tree', 120, -60, { scale: 1.0, rot: 0.5, solid: [12, 10] }),
      p('rock_mossy', -120, 40, { scale: 0.9, solid: [20, 14] }),
      p('banner', -60, 60, { scale: 0.85, tint: 0x7a3b3b }),
    ],
  },
  {
    id: 'camp_palisade', area: 'camp', label: 'Ragged Hollow Camp', x: 540, y: 40,
    story: 'Bandits dug in where the road bends — tents in the lee of the rocks, a lookout on a stolen tower, and a cage with a villager still breathing inside it.',
    glow: { color: 0xff8c3a, radius: 130 },
    props: [
      p('tent', -60, -40, { scale: 1.05, solid: [40, 26] }),
      p('tent', 10, -70, { scale: 0.95, rot: 0.1, solid: [36, 24] }),
      p('tent', -30, 60, { scale: 1.0, flip: true, solid: [38, 25] }),
      p('tent', 90, 20, { scale: 0.9, solid: [34, 22] }),
      p('campfire', 30, -10, {}),
      p('campfire', -90, 30, { scale: 0.85 }),
      p('watchtower_t1', 130, -80, { scale: 1.0, solid: [40, 30] }),
      p('archery_range', -110, -80, { scale: 0.9, tint: 0x6b5a48, solid: [56, 20] }),
      p('storage_chest', 70, 60, { scale: 0.9 }),
      p('storage_chest', -60, -6, { scale: 0.8 }),
      p('wall_seg', -10, 92, { tint: 0x5e5548, solid: [46, 12] }),
      p('wall_seg', 50, 92, { tint: 0x584f43, solid: [46, 12] }),
      p('banner', 20, -96, { tint: 0x7a3b3b }),
      p('banner', 160, 40, { scale: 0.9, tint: 0x6f3535 }),
      p('cage_frame', -130, 90, { scale: 1.05, solid: [22, 14] }),
      p('decal_blood_a', 66, 34, { decal: true, rot: 0.4 }),
      p('decal_scorch', -22, 26, { decal: true }),
      p('rock_small', 150, 80, { scale: 1.2, solid: [22, 16] }),
    ],
  },
  {
    id: 'forest_grove', area: 'forest', label: 'Whispering Forest', x: 760, y: -420,
    story: 'The trees lean inward here, and grey ash drifts between them where none should fall. Something in the deep wood is exhaling.',
    props: [
      // authored tree cluster — varied sizes, never a repeated pattern
      p('tree_oak', -120, -60, { scale: 1.5, solid: [14, 10] }),
      p('tree_pine', -40, -110, { scale: 1.7, solid: [12, 10] }),
      p('tree_birch', 40, -70, { scale: 1.2, solid: [10, 8] }),
      p('tree_oak', 130, -120, { scale: 1.25, flip: true, solid: [14, 10] }),
      p('tree_pine', -160, 40, { scale: 1.4, solid: [12, 10] }),
      p('tree_oak', 90, 60, { scale: 1.35, solid: [14, 10] }),
      p('tree_birch', -70, 100, { scale: 1.1, solid: [10, 8] }),
      p('dead_tree', 180, 40, { scale: 1.2, rot: 0.35, solid: [12, 10] }),
      p('dead_tree', -190, -10, { scale: 1.05, solid: [12, 10] }),
      p('rock_mossy', 10, 20, { scale: 1.1, solid: [22, 16] }),
      p('rock_mossy', -130, 130, { scale: 0.95, solid: [20, 14] }),
      p('mushroom_patch', 60, 130, { scale: 1.1 }),
      p('mushroom_patch', -30, -30, { scale: 0.9 }),
      p('herb_plant', 140, 110, { scale: 1.0 }),
      p('berry_bush', -110, 60, { scale: 1.05 }),
      p('ruin_arch', -20, -170, { scale: 1.0, tint: 0x6b6f63, solid: [40, 14] }),
      p('decal_ash', 30, -140, { decal: true, scale: 1.3 }),
      p('decal_ash', 110, 10, { decal: true }),
      // Midground depth: the things you weave between rather than walk past —
      // fallen logs, mossy boulders, stumps and mushroom shelf, all y-sorted
      // with the player and solid where they should be.
      p('log_fallen', 34, -58, { scale: 1.25, solid: [34, 12] }),
      p('log_fallen', -168, 26, { scale: 1.05, rot: 0.35, solid: [28, 10] }),
      p('log_fallen', 158, -262, { scale: 1.15, rot: -0.2, solid: [30, 11] }),
      p('rock_mossy', 122, 34, { scale: 1.15, solid: [22, 16] }),
      p('rock_mossy', -96, -228, { scale: 1.0, solid: [20, 14] }),
      p('tree_stump', -44, 148, { scale: 1.2, solid: [16, 10] }),
      p('mushroom_patch', 206, -138, { scale: 1.15 }),
      p('berry_bush', -214, 128, { scale: 1.05 }),
      p('herb_plant', 172, -318, { scale: 1.0 }),
      // Stream edge (the wood's north bank — these offsets are verified
      // against the world seed's water by tests/ashen-frontier.mjs).
      p('reed_tuft', -80, -380, { scale: 1.15 }),
      p('reed_tuft', 20, -380, { scale: 1.0, flip: true }),
      p('reed_tuft', 100, -320, { scale: 1.1 }),
      p('rock_mossy', -160, -460, { scale: 1.1, solid: [20, 14] }),
      p('rock_mossy', 300, -360, { scale: 0.95, solid: [18, 12] }),
      p('mushroom_patch', 262, -318, { scale: 1.0 }),
      p('lilypad', 60, -420, { scale: 1.0 }),
      p('lilypad', 142, -398, { scale: 0.9, flip: true }),
      p('dead_tree', 442, -420, { scale: 1.35, rot: 0.28, tint: 0x4a4a44, solid: [12, 10] }),
      // Background canopy/understory and the foreground frond band.
      ...forestBands(),
    ],
  },
  {
    id: 'watchtower', area: 'tower', label: 'The Old Watchtower', x: -720, y: -520,
    story: 'The frontier garrison made its last stand here. The stairs are broken where something came up through them, and the walls are scratched from the inside.',
    glow: { color: 0xffd080, radius: 120 },
    props: [
      p('watchtower_t2', 0, -30, { scale: 1.15, solid: [56, 40] }),
      p('wall_seg', -70, 20, { tint: 0x6a6a63, solid: [46, 12] }),
      p('wall_seg', -70, 50, { rot: 1.57, tint: 0x64645d, solid: [46, 12] }),
      p('wall_seg', 60, 30, { rot: -0.12, tint: 0x6a6a63, solid: [46, 12] }),
      p('ruin_pillar', -30, 60, { solid: [16, 14] }),
      p('ruin_pillar', 40, 70, { scale: 0.85, rot: 0.2, solid: [14, 12] }),
      p('storage_chest', -6, 96, { scale: 0.95 }),
      p('sign_broken', 84, 70, { rot: 0.3, solid: [10, 8] }),
      p('decal_blood_a', 24, 44, { decal: true }),
      p('decal_blood_b', -40, 74, { decal: true, rot: 0.9 }),
      p('decal_footsteps', 0, 20, { decal: true, rot: 1.4 }),
      p('decal_ash', -90, -40, { decal: true, scale: 1.2 }),
      p('campfire', 70, 100, { scale: 0.8 }),
    ],
  },
  {
    id: 'broken_bridge', area: 'bridge', label: 'The Broken Bridge', x: 250, y: -700,
    story: 'The span was cut not by war but by something coming out of the water. Reeds still bend where the keystone fell.',
    props: [
      p('ruin_arch', -40, -10, { scale: 1.25, tint: 0x6d6f6a, solid: [44, 16] }),
      p('ruin_arch', 40, -6, { scale: 1.2, rot: 0.08, tint: 0x666863, solid: [44, 16] }),
      p('wall_seg', 0, 18, { tint: 0x63655f, solid: [46, 12] }),
      p('ruin_pillar', 0, -50, { scale: 0.9, solid: [14, 12] }),
      p('reed_tuft', -70, 30, { scale: 1.1 }),
      p('reed_tuft', 70, 24, { scale: 1.0 }),
      p('lilypad', -30, 40, { scale: 1.0 }),
      p('lilypad', 50, 44, { scale: 0.9 }),
      p('decal_ash', 90, -30, { decal: true }),
    ],
  },
  {
    id: 'corrupted_hollow', area: 'hollow', label: 'The Corrupted Hollow', x: -260, y: -1120,
    story: 'A rock-cut mine the settlers abandoned — until The Veil found it. Three crystals pulse in the dark chamber; the old seal is still carved around them.',
    glow: { color: 0x9d4dff, radius: 170 },
    props: [
      p('mine_entrance', 0, -80, { scale: 1.2, solid: [60, 44] }),
      p('rock_mossy', -80, -40, { scale: 1.35, solid: [26, 18] }),
      p('rock_mossy', 80, -44, { scale: 1.3, solid: [26, 18] }),
      p('rock_small', -120, 20, { scale: 1.25, solid: [22, 16] }),
      p('rock_small', 120, 16, { scale: 1.2, solid: [22, 16] }),
      p('rock_mossy', -60, 70, { scale: 1.15, solid: [24, 16] }),
      p('rock_mossy', 60, 74, { scale: 1.1, solid: [24, 16] }),
      p('rock_small', -10, 110, { scale: 1.3, solid: [22, 16] }),
      p('dead_tree', -150, -70, { scale: 1.1, rot: 0.4, solid: [12, 10] }),
      p('dead_tree', 150, -76, { scale: 1.05, solid: [12, 10] }),
      p('ruin_pillar', -30, -20, { scale: 0.9, tint: 0x4a4358, solid: [14, 12] }),
      p('ruin_pillar', 34, -18, { scale: 0.85, rot: -0.2, tint: 0x4a4358, solid: [14, 12] }),
      p('decal_scorch', -20, 30, { decal: true, scale: 1.3 }),
      p('decal_scorch', 40, -40, { decal: true }),
      p('decal_ash', 0, 40, { decal: true, scale: 1.6 }),
      p('decal_ash', -70, -70, { decal: true, scale: 1.3 }),
    ],
  },
  {
    id: 'forsaken_shrine', area: 'shrine', label: 'The Forsaken Shrine', x: 1180, y: -980,
    story: 'Beyond the deep wood, someone kept a shrine to a god who stopped answering. The offerings are still laid out, and still fresh.',
    glow: { color: 0xd0c0ff, radius: 160 },
    props: [
      p('ancient_statue', 0, -50, { scale: 1.2, tint: 0x8f8aa0, solid: [34, 20] }),
      p('temple_shrine', 0, 30, { scale: 1.1, tint: 0x9a94a8, solid: [44, 30] }),
      p('ruin_pillar', -70, 0, { solid: [16, 14] }),
      p('ruin_pillar', 70, 0, { solid: [16, 14] }),
      p('ruin_pillar', -70, 60, { scale: 0.9, rot: 0.15, solid: [14, 12] }),
      p('ruin_pillar', 70, 60, { scale: 0.9, rot: -0.15, solid: [14, 12] }),
      p('moonstone_node', -40, -90, { scale: 1.1 }),
      p('crystal_node', 46, -86, { scale: 1.0 }),
      p('decal_ash', 0, 80, { decal: true, scale: 1.2 }),
      p('dead_tree', -130, -60, { scale: 1.2, solid: [12, 10] }),
      p('tree_pine', 130, -70, { scale: 1.5, solid: [12, 10] }),
      p('tree_oak', 110, 90, { scale: 1.3, solid: [14, 10] }),
    ],
  },
  {
    id: 'warden_arena', area: 'pyre', label: "The Warden's Pyre", x: 980, y: -1520,
    story: 'The pyre field where the frontier burned its dead — and where the Warden still keeps its post, crowned in ash. Braziers ring the ground; the ground answers back.',
    glow: { color: 0xff5a3a, radius: 210 },
    props: [
      // ring of broken arches + pillars = readable arena boundary
      p('ruin_arch', -170, -40, { scale: 1.25, tint: 0x6a5a52, solid: [44, 16] }),
      p('ruin_arch', 170, -40, { scale: 1.25, tint: 0x6a5a52, solid: [44, 16] }),
      p('ruin_arch', 0, -190, { scale: 1.3, tint: 0x6a5a52, solid: [44, 16] }),
      p('ruin_pillar', -140, 110, { tint: 0x66564e, solid: [16, 14] }),
      p('ruin_pillar', 140, 110, { tint: 0x66564e, solid: [16, 14] }),
      p('ruin_pillar', -60, -150, { scale: 0.9, tint: 0x66564e, solid: [14, 12] }),
      p('ruin_pillar', 60, -150, { scale: 0.9, tint: 0x66564e, solid: [14, 12] }),
      // braziers (arena lights) + scorched, ashen ground
      p('campfire', -110, 0, { scale: 1.1 }),
      p('campfire', 110, 0, { scale: 1.1 }),
      p('campfire', 0, 150, { scale: 1.0 }),
      p('decal_scorch', 0, 40, { decal: true, scale: 1.6 }),
      p('decal_scorch', -90, -80, { decal: true, scale: 1.2 }),
      p('decal_scorch', 90, -70, { decal: true, scale: 1.2 }),
      p('decal_ash', 30, 90, { decal: true, scale: 1.5 }),
      p('decal_blood_a', -40, 100, { decal: true }),
      p('rock_small', -190, 60, { scale: 1.2, solid: [22, 16] }),
      p('rock_small', 190, 70, { scale: 1.15, solid: [22, 16] }),
    ],
  },
];

// ── Designed encounters ─────────────────────────────────────────────────────
// Purposeful fights with space to move. No infinite scatter.

export const ASHEN_ENCOUNTERS: Encounter[] = [
  {
    id: 'e_road_scouts', area: 'road', label: 'Road scouts', x: 330, y: -70, spread: 70, trigger: 300,
    oneShot: true, intro: 'Scouts pick over the wreckage.',
    members: [
      { key: 'wolf', count: 2, role: 'patrol' },
    ],
  },
  {
    id: 'e_road_ambush', area: 'road', label: 'Ambush on the road', x: 330, y: -120, spread: 90, trigger: 240,
    oneShot: true, ambush: true, intro: 'AMBUSH — they were waiting for the next column.',
    members: [
      { key: 'wolf', count: 3, role: 'ambush' },
      { key: 'bandit_archer', count: 1, role: 'ambush' },
    ],
  },
  {
    id: 'e_camp_watch', area: 'camp', label: 'Camp watch', x: 430, y: -10, spread: 80, trigger: 300,
    oneShot: true, alarm: true, intro: 'The camp watch spots you.',
    members: [
      { key: 'bandit_scout', count: 2, role: 'patrol' },
      { key: 'bandit_swordsman', count: 1, role: 'guard' },
    ],
  },
  {
    id: 'e_camp_core', area: 'camp', label: 'Camp heart', x: 600, y: 70, spread: 110, trigger: 300,
    oneShot: true, alarm: true, intro: "The camp's captain shouts — everyone is coming.",
    members: [
      { key: 'bandit_archer', count: 2, role: 'idle' },
      { key: 'bandit_brute', count: 1, role: 'guard' },
      { key: 'executioner', count: 1, role: 'leader' },
      { key: 'bandit_swordsman', count: 1, role: 'guard' },
    ],
  },
  {
    id: 'e_forest_beasts', area: 'forest', label: 'Forest beasts', x: 660, y: -340, spread: 120, trigger: 320,
    oneShot: true, members: [
      { key: 'boar', count: 2, role: 'patrol' },
      { key: 'bear', count: 1, role: 'idle' },
    ],
  },
  {
    id: 'e_forest_corruption', area: 'forest', label: 'Corruption in the wood', x: 880, y: -540, spread: 130, trigger: 320,
    oneShot: true, intro: 'The trees go quiet. Something is already looking at you.',
    members: [
      { key: 'swamp_beast', count: 2, role: 'guard' },
      { key: 'dire_wolf', count: 2, role: 'patrol' },
    ],
  },
  {
    id: 'e_tower_defenders', area: 'tower', label: "The garrison's last stand", x: -720, y: -470, spread: 100, trigger: 280,
    oneShot: true, intro: 'The dead of the garrison rise — and their knight with them.',
    members: [
      { key: 'skeleton', count: 3, role: 'guard' },
      { key: 'grave_knight', count: 1, role: 'leader' },
    ],
  },
  {
    id: 'e_bridge_lurkers', area: 'bridge', label: 'Lurkers at the span', x: 250, y: -660, spread: 90, trigger: 260,
    oneShot: true, members: [
      { key: 'swamp_beast', count: 2, role: 'idle' },
    ],
  },
  {
    id: 'e_hollow_corrupted', area: 'hollow', label: 'The hollow stirs', x: -250, y: -1060, spread: 120, trigger: 300,
    oneShot: true, intro: 'The Veil has teeth in this place.',
    members: [
      { key: 'void_stalker', count: 1, role: 'leader' },
      { key: 'swamp_beast', count: 2, role: 'guard' },
      { key: 'skeleton', count: 2, role: 'patrol' },
    ],
  },
  {
    id: 'e_shrine_guardians', area: 'shrine', label: 'Shrine guardians', x: 1180, y: -930, spread: 90, trigger: 250,
    oneShot: true, intro: 'The shrine was never left unguarded.',
    members: [
      { key: 'skeleton', count: 2, role: 'guard' },
      { key: 'grave_knight', count: 1, role: 'guard' },
    ],
  },
];

// ── Interactables ───────────────────────────────────────────────────────────

export const ASHEN_INTERACTABLES: Interactable[] = [
  {
    id: 'village_shrine', area: 'village', kind: 'savepoint', label: 'Ash-Stained Shrine',
    x: -144, y: 336, tex: 'temple_shrine', scale: 0.9, tint: 0x8d8778,
    text: 'The old shrine of the frontier. Rest here and the realm remembers you.',
  },
  {
    id: 'village_forge', area: 'village', kind: 'station', station: 'forge',
    label: 'The Ashwright Anvil',
    x: -176, y: 640, tex: 'forge_hot', scale: 1.0,
    text: 'Someone hauled the anvil out of the burning smithy and kept working. Coals still hot, tools still laid out.',
    flag: 'forge_hub_found',
  },
  {
    id: 'village_cache', area: 'village', kind: 'chest', label: "Survivor's Cache",
    x: -108, y: 530, tex: 'iron_chest', tier: 'iron_chest',
  },
  {
    id: 'village_lore', area: 'village', kind: 'lore', label: 'Half-Burned Notice',
    x: -60, y: 356, tex: 'sign_broken',
    text: 'BY ORDER OF THE WARDEN: all settlers to the watchtower. The road south is lost. Do not go into the trees after dark.',
    flag: 'lore_ashen_notice',
  },
  {
    id: 'road_lore', area: 'road', kind: 'lore', label: 'Spilled Ledger',
    x: 300, y: -60, tex: 'cart_wreck', scale: 0.8,
    text: 'A tally of grain, tools, and twelve names. Eleven are struck through. The last reads: taken alive — north-east.',
    flag: 'lore_road_ledger',
  },
  {
    id: 'camp_hostage', area: 'camp', kind: 'hostage', label: 'Caged Villager',
    x: 410, y: 130, tex: 'cage_frame', scale: 1.05,
    text: 'A villager, wrists raw from rope. "They took the others up the road. Please — before they come back."',
    flag: 'camp_hostage_freed',
  },
  {
    id: 'camp_orders', area: 'camp', kind: 'lore', label: "Captain's Orders",
    x: 610, y: 20, tex: 'banner', scale: 0.9, tint: 0x7a3b3b,
    text: 'Hold the road. The Warden pays for prisoners, not corpses. If the pyre lights again, run.',
    flag: 'lore_camp_orders',
  },
  {
    id: 'camp_cache', area: 'camp', kind: 'chest', label: "Camp's Takings",
    x: 610, y: 100, tex: 'iron_chest', tier: 'iron_chest',
  },
  {
    id: 'forest_lore', area: 'forest', kind: 'lore', label: 'Carving in the Bark',
    x: 740, y: -250, tex: 'tree_oak', scale: 1.2,
    text: 'Someone cut marks into the oak — one for each night they survived out here. There are forty-one.',
    flag: 'lore_forest_carving',
  },
  {
    id: 'forest_cache', area: 'forest', kind: 'chest', label: "Forager's Stash",
    x: 900, y: -400, tex: 'wooden_chest', tier: 'iron_chest',
  },
  {
    id: 'tower_lore', area: 'tower', kind: 'lore', label: "Garrison's Log",
    x: -770, y: -470, tex: 'ruin_pillar', scale: 0.9,
    text: 'Last entry, third watch: "It came up the stair while we slept. The Warden ordered the pyre lit. Gods forgive us, we obeyed."',
    flag: 'lore_tower_log',
  },
  {
    id: 'tower_chest', area: 'tower', kind: 'chest', label: "Garrison Strongbox",
    x: -730, y: -400, tex: 'royal_chest', tier: 'royal_chest',
  },
  {
    id: 'bridge_lore', area: 'bridge', kind: 'lore', label: 'Keystone Rubble',
    x: 250, y: -740, tex: 'ruin_arch', scale: 0.9,
    text: 'The keystone is scored by something with too many teeth. The span was not cut — it was bitten through.',
    flag: 'lore_bridge_keystone',
  },
  {
    id: 'hollow_crystal_a', area: 'hollow', kind: 'crystal', label: 'Seal Crystal — First',
    x: -330, y: -1150, tex: 'crystal_node', crystal: 'a',
  },
  {
    id: 'hollow_crystal_b', area: 'hollow', kind: 'crystal', label: 'Seal Crystal — Second',
    x: -260, y: -1190, tex: 'crystal_node', crystal: 'b',
  },
  {
    id: 'hollow_crystal_c', area: 'hollow', kind: 'crystal', label: 'Seal Crystal — Third',
    x: -190, y: -1150, tex: 'crystal_node', crystal: 'c',
  },
  {
    id: 'hollow_lore', area: 'hollow', kind: 'lore', label: 'Sealed Inscription',
    x: -260, y: -1060, tex: 'ruin_pillar', scale: 1.0, tint: 0x4a4358,
    text: 'The seal reads: "THREE STEPS, ONE BREATH — outer, inner, crown." The miners ignored it. The miners are still here.',
    flag: 'lore_hollow_seal',
  },
  {
    id: 'hollow_vault', area: 'hollow', kind: 'chest', label: 'Sealed Vault',
    x: -260, y: -1100, tex: 'ancient_chest', tier: 'ancient_chest', requiresFlag: 'hollow_seal_broken',
  },
  {
    id: 'shrine_altar', area: 'shrine', kind: 'savepoint', label: 'Forsaken Altar',
    x: 1180, y: -1010, tex: 'ancient_statue', scale: 1.05, tint: 0x8f8aa0,
    text: 'The shrine of the forgotten god. Rest here and the realm remembers you.',
  },
  {
    id: 'shrine_offering', area: 'shrine', kind: 'chest', label: 'Fresh Offerings',
    x: 1230, y: -940, tex: 'ancient_chest', tier: 'ancient_chest',
  },
  {
    id: 'arena_lore', area: 'pyre', kind: 'lore', label: 'The Ash-Crowned Stone',
    x: 880, y: -1520, tex: 'ruin_pillar', scale: 1.1, tint: 0x6a5a52,
    text: 'Carved where the pyre was lit: "We burned our dead so the Veil could not wear them. The Warden would not burn."',
    flag: 'lore_warden_stone',
  },
  {
    id: 'arena_cache', area: 'pyre', kind: 'chest', label: "Warden's Cache",
    x: 1080, y: -1520, tex: 'royal_chest', tier: 'royal_chest', requiresFlag: 'warden_slain',
  },
];

// ── Hazards ─────────────────────────────────────────────────────────────────

export const ASHEN_HAZARDS: Hazard[] = [
  { id: 'vent_hollow_a', area: 'hollow', kind: 'corruption', x: -300, y: -1090, radius: 74, dps: 4, label: 'Corruption vent' },
  { id: 'vent_hollow_b', area: 'hollow', kind: 'corruption', x: -215, y: -1060, radius: 74, dps: 4, label: 'Corruption vent' },
  { id: 'vent_hollow_c', area: 'hollow', kind: 'corruption', x: -260, y: -1170, radius: 80, dps: 5, label: 'Corruption vent' },
  { id: 'vent_arena_a', area: 'pyre', kind: 'fire', x: 880, y: -1600, radius: 92, dps: 5, label: 'Fire vent', bossKey: 'warden_of_ash' },
  { id: 'vent_arena_b', area: 'pyre', kind: 'fire', x: 1080, y: -1600, radius: 92, dps: 5, label: 'Fire vent', bossKey: 'warden_of_ash' },
  { id: 'vent_arena_c', area: 'pyre', kind: 'fire', x: 980, y: -1420, radius: 92, dps: 5, label: 'Fire vent', bossKey: 'warden_of_ash' },
];

// ── Puzzle: the corrupted seal ──────────────────────────────────────────────
// Order is taught by the inscription ("outer, inner, crown"), so the solution
// is discoverable in-world rather than trial-and-error.

export const ASHEN_PUZZLE: Puzzle = {
  id: 'hollow_seal',
  area: 'hollow',
  sequence: ['a', 'b', 'c'],
  prompt: 'One of three seal crystals hums.',
  flag: 'hollow_seal_broken',
  rewardTier: 'ancient_chest',
  rewardItem: 'ancient_relic',
  failText: 'The crystals dim — wrong order. The inscription said: outer, inner, crown.',
  doneText: 'The seal breaks. The vault behind it opens.',
};

// ── POIs (merged into worldGen so discovery/fog/minimap/quests work) ────────

export const ASHEN_POIS: RegionPoi[] = [
  { id: 'ashen_village', x: -90, y: 330, kind: 'ruins', tag: 'ashen_village', label: 'Ashen Village', danger: 1 },
  { id: 'broken_road', x: 240, y: -40, kind: 'ruins', tag: 'broken_road', label: 'The Broken Road', danger: 2 },
  { id: 'ragged_camp', x: 540, y: 40, kind: 'bandit_camp', tag: 'ragged_camp', label: 'Ragged Hollow Camp', danger: 3, chestTier: 'iron_chest' },
  { id: 'whispering_forest', x: 760, y: -420, kind: 'ruins', tag: 'whispering_forest', label: 'Whispering Forest', danger: 3 },
  { id: 'old_watchtower', x: -720, y: -520, kind: 'ruins', tag: 'old_watchtower', label: 'The Old Watchtower', danger: 4 },
  { id: 'broken_bridge', x: 250, y: -700, kind: 'ruins', tag: 'broken_bridge', label: 'The Broken Bridge', danger: 3 },
  { id: 'corrupted_hollow', x: -260, y: -1120, kind: 'ruins', tag: 'corrupted_hollow', label: 'The Corrupted Hollow', danger: 5 },
  { id: 'forsaken_shrine', x: 1180, y: -980, kind: 'shrine', tag: 'forsaken_shrine', label: 'The Forsaken Shrine', danger: 4 },
  // The climax: reachable early (≈1.8k from origin) but tuned for level 4+.
  { id: 'warden_pyre', x: 980, y: -1520, kind: 'ruins', tag: 'warden_pyre', label: "The Warden's Pyre", danger: 4, boss: 'warden_of_ash', chestTier: 'royal_chest' },
];

// ── Pure helpers (unit-tested, used by RegionSystem) ────────────────────────

/** Which sub-region contains this world position? (Nearest containing circle.) */
export function subregionAt(x: number, y: number): SubRegion | null {
  let best: SubRegion | null = null;
  let bestD: number = Infinity;
  for (const s of ASHEN_SUBREGIONS) {
    const d: number = Math.hypot(x - s.x, y - s.y);
    if (d <= s.radius && d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/** True inside the safe hub — enemy spawns are suppressed here. */
export function inSafeZone(x: number, y: number): boolean {
  return Math.hypot(x - ASHEN_SAFE_ZONE.x, y - ASHEN_SAFE_ZONE.y) <= ASHEN_SAFE_ZONE.radius;
}

/** Encounter trigger check (ambushers wait for a closer trigger). */
export function encounterTriggers(e: Encounter, x: number, y: number, done: boolean): boolean {
  if (done) return false;
  const d: number = Math.hypot(x - e.x, y - e.y);
  return d <= (e.ambush ? Math.min(e.trigger, 200) : e.trigger);
}

/**
 * The encounters that should fire this frame — the ONLY place the trigger
 * decision is made, so the "fire when you walk into it" polarity is testable
 * without a scene. `cleared` reports already-fought encounters.
 */
export function encountersToTrigger(x: number, y: number, cleared: (id: string) => boolean): Encounter[] {
  return ASHEN_ENCOUNTERS.filter((e: Encounter) => encounterTriggers(e, x, y, cleared(e.id)));
}

/**
 * Advance the crystal puzzle. Returns the new progress array, whether the
 * sequence completed, and whether the attempt just failed (reset).
 */
export function puzzleStep(progress: string[], pressed: string, seq: string[]): { progress: string[]; solved: boolean; failed: boolean } {
  const expected: string | undefined = seq[progress.length];
  if (pressed === expected) {
    const nextProgress: string[] = [...progress, pressed];
    return { progress: nextProgress, solved: nextProgress.length === seq.length, failed: false };
  }
  // Wrong crystal: restart, but a re-press of the first crystal is a clean start.
  if (pressed === seq[0]) return { progress: [pressed], solved: seq.length === 1, failed: false };
  return { progress: [], solved: false, failed: true };
}

/** Total designed enemies — used by the map-density test. */
export function encounterEnemyCount(): number {
  return ASHEN_ENCOUNTERS.reduce((n, e) => n + e.members.reduce((m, mm) => m + mm.count, 0), 0);
}

/**
 * Crafting stations the region itself provides, so the hub can improve gear
 * without a settlement. Derived from the interactables — the authored object
 * IS the station, one source of truth for where it stands.
 */
export function regionStations(): { station: string; x: number; y: number }[] {
  return ASHEN_INTERACTABLES
    .filter((it: Interactable) => it.kind === 'station' && !!it.station)
    .map((it: Interactable) => ({ station: it.station as string, x: it.x, y: it.y }));
}
