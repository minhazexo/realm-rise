// ─────────────────────────────────────────────────────────────────────────────
// RegionLayout — the pure placement and cadence math of an authored region.
//
// No Phaser, no scene, no GameState: every function here is a function of its
// arguments, so the depth bands, the streaming radius, the encounter seating and
// the foreground-fade rule are all unit-testable in node (tests/ashen-frontier).
// ─────────────────────────────────────────────────────────────────────────────
import { WORLD_CONFIG } from '../core/Constants.ts';
import type { Encounter, EncounterRole, PropSpec, SubRegion } from '../data/region.ts';

/**
 * Foreground-band depth: above every actor and health bar in the region, below
 * damage floaters (900) so combat text stays readable, and far below the
 * screen-space overlay layer. Near-camera foliage draws here, over the hero.
 */
export const FOREGROUND_DEPTH = 820;
/**
 * Background-band depth: just above the ground and grass images (which the
 * world paints at −worldHalf×2), so the deep wood sits behind every y-sorted
 * actor no matter where in the world the region is.
 */
export const BACKGROUND_DEPTH = -WORLD_CONFIG.worldHalfExtent * 2 + 2;
/**
 * Areas within this radius of the player are built (and keep running). Sized
 * against a region of a couple of km so the hub builds at spawn and the far
 * corners genuinely stream in later.
 */
export const PLACE_RADIUS = 1150;
/** How faint the hero's own silhouette may get behind foreground foliage. */
export const FOREGROUND_FADED_ALPHA = 0.32;
/** Half the hero's collision height — the fade covers the body, not the feet. */
const PLAYER_HALF_H = 16;
/** Fade speed, in "fraction of the gap per second" (dt-scaled). */
const FADE_RATE = 10;
/** The region's slow cadence: hazards, arena aftermath, flag-gated spawns. */
export const SLOW_TICK = 0.5;

/** Depth for one landmark prop: decals flat, bands fixed, the rest y-sorted. */
export function propDepth(prop: PropSpec, y: number): number {
  if (prop.decal) return 4;
  if (prop.band === 'bg') return BACKGROUND_DEPTH;
  if (prop.band === 'fg') return FOREGROUND_DEPTH;
  return Math.round(y);
}

/** Areas close enough to the player to build, and not built yet. */
export function areasToPlace(areas: SubRegion[], placed: Set<string>, px: number, py: number): SubRegion[] {
  return areas.filter((a: SubRegion) => !placed.has(a.id) && Math.hypot(px - a.x, py - a.y) <= PLACE_RADIUS);
}

/** The part of a foreground prop the fade test needs. */
export interface ForegroundHit {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

/** Is the hero actually behind this near-camera prop? */
export function isBehind(px: number, py: number, p: ForegroundHit): boolean {
  return Math.abs(px - p.x) < p.hw && Math.abs(py - p.y) < p.hh + PLAYER_HALF_H;
}

/** One fade step toward the target alpha, frame-rate independent. */
export function fadeAlpha(alpha: number, target: number, dt: number): number {
  return alpha + (target - alpha) * Math.min(1, dt * FADE_RATE);
}

/** One enemy the encounter plan will spawn. */
export interface EncounterSeat {
  key: string;
  role: EncounterRole;
  x: number;
  y: number;
}

/**
 * Where an encounter's members stand: one seat each, evenly ringed around the
 * encounter centre so members get their own space to fight in. `rand` is
 * injectable so the plan is testable.
 */
export function encounterPlan(enc: Encounter, rand: () => number = Math.random): EncounterSeat[] {
  const total: number = Math.max(1, enc.members.reduce((n, m) => n + m.count, 0));
  const seats: EncounterSeat[] = [];
  let seat: number = 0;
  for (const member of enc.members) {
    for (let i: number = 0; i < member.count; i++) {
      // Even ring placement, with a little jitter so it never looks stamped.
      const a: number = (seat / total) * Math.PI * 2 + rand() * 0.4;
      seat++;
      const d: number = enc.spread * (0.45 + rand() * 0.55);
      seats.push({ key: member.key, role: member.role, x: enc.x + Math.cos(a) * d, y: enc.y + Math.sin(a) * d });
    }
  }
  return seats;
}

/**
 * What a role does to its enemy: how alert it is, whether it walks a beat, and
 * whether it charges on sight. Data, so the camps read differently without a
 * single one-off enemy.
 */
export const ROLE_TUNING: Record<EncounterRole, { aggroMult?: number; aggroFloor?: number; patrol?: boolean; chase?: boolean }> = {
  // Watchmen walk a beat (the chase loop follows patrolTarget).
  patrol: { patrol: true },
  // Guards hold their post until you come to them.
  guard: { aggroMult: 0.85, aggroFloor: 140 },
  // Off-duty: late to notice, and they will not wander off post.
  idle: { aggroMult: 0.55, aggroFloor: 120 },
  leader: { aggroMult: 1.3 },
  ambush: { chase: true },
};
