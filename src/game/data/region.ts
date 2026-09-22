// ─────────────────────────────────────────────────────────────────────────────
// The vocabulary every authored region shares, and the shape a region presents
// to the runtime systems (RegionDef).
//
// Data declares, systems interpret: a region module owns its own coordinates,
// names and pure geometry helpers and hands them over as one RegionDef. Nothing
// in systems/ imports a region by name, so authoring another region means a new
// data module plus one line in systems/RegionRegistry.ts.
//
// Pure types + one derivation: no Phaser, no scene. Unit-testable in node.
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
   *          it passes over the hero (the foreground band fades what you are
   *          behind — see systems/RegionForeground.ts)
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

/** A sequence puzzle: click the crystals in the authored order. */
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

/** An authored NPC standing at an offset inside one of the region's areas. */
export interface RegionNpc {
  key: string;
  area: string;
  dx: number;
  dy: number;
}

/** A boss arena, so its aftermath is data rather than a branch in the runtime. */
export interface RegionArena {
  /** Sub-region holding the fight. */
  area: string;
  bossKey: string;
  /** Story flag written once the boss is dead — whether or not a quest was up. */
  flag: string;
}

/** A crafting station the region itself provides (hub anvils, camp forges). */
export interface StationPoint {
  station: string;
  x: number;
  y: number;
}

/**
 * One authored region, as the scene-side systems see it. Implement this in a
 * data module (`data/regionX.ts`), then register it in systems/RegionRegistry.
 */
export interface RegionDef {
  /** Stable id, used for diagnostics. */
  id: string;
  subregions: SubRegion[];
  landmarks: Landmark[];
  encounters: Encounter[];
  interactables: Interactable[];
  hazards: Hazard[];
  /** The region's sequence puzzle, if it has one. */
  puzzle?: Puzzle;
  /** Hub NPCs, placed relative to their area's landmark. */
  npcs?: RegionNpc[];
  /** POIs the world generator registers for discovery and quests. */
  pois?: RegionPoi[];
  /** The region's boss arena, if it has one. */
  arena?: RegionArena;
  /** Which sub-region contains a point (nearest containing circle). */
  subregionAt(x: number, y: number): SubRegion | null;
  /** Encounters that should fire for a player at this position. */
  encountersToTrigger(x: number, y: number, cleared: (id: string) => boolean): Encounter[];
  /** True inside the region's no-spawn safe zone. */
  isSafe?(x: number, y: number): boolean;
}

/**
 * The crafting stations a region provides, derived from its interactables —
 * the authored object IS the station, so there is one source of truth for
 * where it stands.
 */
export function stationsOf(def: RegionDef): StationPoint[] {
  return def.interactables
    .filter((it: Interactable) => it.kind === 'station' && !!it.station)
    .map((it: Interactable) => ({ station: it.station as string, x: it.x, y: it.y }));
}

/**
 * Advance a sequence puzzle. Returns the new progress, whether the sequence
 * completed, and whether the attempt just failed (reset).
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
