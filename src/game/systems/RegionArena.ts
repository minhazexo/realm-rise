// ─────────────────────────────────────────────────────────────────────────────
// RegionArena — the region's hostile ground and its boss aftermath.
//
// Hazards are damage zones the region authors (corruption, arena vents); the
// vents only burn while their boss still holds the field. The arena also records
// its own outcome: killing its boss sets the arena's story flag directly, so the
// beat and its reward exist whether or not the player happened to have that
// quest at the killing blow.
//
// Owns: whether the boss has been seen alive (so the aftermath fires once).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { regionState, setStoryFlag } from './RegionState.ts';
import type { RegionScene } from './RegionState.ts';
import type { RegionArena as ArenaDef, RegionDef } from '../data/region.ts';

/** Hazard anchors for an area: the visual signature the damage zone matches. */
export function placeHazardVisuals(scene: RegionScene, region: RegionDef, areaId: string): void {
  for (const h of region.hazards) {
    if (h.area !== areaId) continue;
    const isFire: boolean = h.kind === 'fire';
    scene.add.image(h.x, h.y, isFire ? 'decal_scorch' : 'crystal_node')
      .setScale(isFire ? 1.5 : 1.1)
      .setTint(isFire ? 0x7a4a3a : 0x8a5ad0)
      .setAlpha(0.85)
      .setDepth(4);
  }
}

/** The region's slow tick: the arena's aftermath, then the ground itself. */
export function tickArena(scene: RegionScene, region: RegionDef, px: number, py: number): void {
  recordArenaOutcome(scene, region.arena);
  tickHazards(scene, region, px, py);
}

/** The arena's aftermath: seen alive → then flag its defeat, once. */
function recordArenaOutcome(scene: RegionScene, arena?: ArenaDef): void {
  if (!arena) return;
  const st = regionState(scene);
  if (!st.placed.has(arena.area)) return;
  const boss: any = (scene.enemies || []).find((e: any) => e.key === arena.bossKey);
  if (boss && !boss.dead) { st.bossSeen = true; return; }
  if (st.bossSeen && !GameState.s.story.flags[arena.flag]) setStoryFlag(arena.flag);
}

function tickHazards(scene: RegionScene, region: RegionDef, px: number, py: number): void {
  for (const h of region.hazards) {
    if (!regionState(scene).placed.has(h.area)) continue;
    // Arena vents only burn while their boss still holds the field.
    if (h.bossKey) {
      const bossAlive: boolean = (scene.enemies || []).some((e: any) => !e.dead && e.key === h.bossKey);
      if (!bossAlive) continue;
    }
    if (Math.hypot(px - h.x, py - h.y) > h.radius) continue;
    scene.player?.takeDamage?.(h.dps * 0.5, h.x, h.y);
    scene.floats?.add?.(px, py - 46, h.label, '#c9a0ff', 0.7);
  }
}
