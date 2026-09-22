// ─────────────────────────────────────────────────────────────────────────────
// RegionSystem — streams the authored regions (systems/RegionRegistry.ts) over
// the procedural world and runs their per-frame work.
//
// This module owns ONE job: the region lifecycle. Everything an area is made of
// lives with its own owner — RegionForeground (the near-camera band),
// RegionInteractables (clickables + the station rule), RegionEncounters (designed
// fights), RegionArena (hazards + the boss aftermath) — and the region data
// module is the only input any of them sees.
//   • lazy placement — an area streams in when the player comes within
//     RegionLayout.PLACE_RADIUS, so boot cost stays flat no matter how many
//     regions exist
//   • per-area ambience, one emitter live at a time
//   • frame order: placement → ambience → encounters → alarms → foreground fade
//     → the slow tick (arena, hazards, flag-gated spawns)
// Persistence rides the existing `world.poiStates` map (already saved), so
// cleared fights, looted caches and solved puzzles survive save/load with no
// new save-schema work.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { REGIONS } from './RegionRegistry.ts';
import { SLOW_TICK, areasToPlace, propDepth } from './RegionLayout.ts';
import { regionFlag, regionState } from './RegionState.ts';
import { registerForegroundProp, tickForeground } from './RegionForeground.ts';
import { placeFlaggedInteractables, placeInteractables } from './RegionInteractables.ts';
import { liveMemberCount, spawnEncounter, tickAlarms } from './RegionEncounters.ts';
import { placeHazardVisuals, tickArena } from './RegionArena.ts';
import type { RegionScene } from './RegionState.ts';
import type { Landmark, PropSpec, RegionDef, SubRegion } from '../data/region.ts';

/**
 * Create the regions' structural collision + runtime state. Called once from
 * WorldScene.create (player must already exist).
 */
export function placeRegion(scene: RegionScene): void {
  const st = regionState(scene);
  if (st.solids) return;
  try {
    st.solids = scene.physics.add.staticGroup();
    const sprite = scene.player?.sprite;
    // Player-only collider: authored walls block the hero but never wedge an
    // enemy mid-chase (the procedural world stays walk-through, as designed).
    if (sprite) scene.physics.add.collider(sprite, st.solids);
  } catch { st.solids = null; }
}

/**
 * Stream areas in near the player and run everything they bring with them.
 * Called once per frame from WorldScene.update.
 */
export function updateRegion(scene: RegionScene, px: number, py: number, dt: number): void {
  const st = regionState(scene);

  // 1. Lazy placement (cheap: only areas not yet built are tested).
  for (const region of REGIONS) {
    for (const area of areasToPlace(region.subregions, st.placed, px, py)) placeArea(scene, region, area.id);
  }

  // 2. Ambience follows the current area (one emitter at a time).
  for (const region of REGIONS) {
    const here: SubRegion | null = region.subregionAt(px, py);
    const areaId: string = here ? here.id : '';
    if (areaId === st.currentArea) continue;
    st.currentArea = areaId;
    for (const [id, em] of st.emitters) {
      if (id === areaId) em.start();
      else em.stop();
    }
  }

  // 3. Designed encounters: fire when the player crosses the trigger, once.
  for (const region of REGIONS) {
    for (const enc of region.encountersToTrigger(px, py, regionFlag)) {
      if (!st.placed.has(enc.area)) continue;
      spawnEncounter(scene, enc);
    }
  }

  // 4. Alarm: guards converge once a camp fight actually starts.
  for (const region of REGIONS) tickAlarms(scene, region, px, py);

  // 5. Foreground band: near-camera foliage draws OVER the hero, so whatever
  //    the player is actually behind fades out — the band reads as depth
  //    instead of hiding your own character (map brief §7).
  tickForeground(scene, px, py, dt);

  // 6. The slow tick: arena aftermath, hazards, flag-gated spawns.
  st.slowT += dt;
  if (st.slowT < SLOW_TICK) return;
  st.slowT = 0;
  for (const region of REGIONS) {
    tickArena(scene, region, px, py);
    placeFlaggedInteractables(scene, region);
  }
}

/** Snapshot for tests and live probes. */
export function regionSnapshot(scene: RegionScene): Record<string, unknown> {
  const st = regionState(scene);
  return {
    placed: [...st.placed],
    encountersCleared: REGIONS.flatMap((r: RegionDef) => r.encounters.filter((e) => regionFlag(e.id)).map((e) => e.id)),
    interactablesPlaced: [...st.interactPlaced],
    puzzleProgress: st.puzzle,
    puzzleSolved: REGIONS.some((r: RegionDef) => !!r.puzzle && !!GameState.s.story.flags[r.puzzle.flag]),
    currentArea: st.currentArea,
    liveMembers: liveMemberCount(scene),
  };
}

// ── Area building ───────────────────────────────────────────────────────────

/** Place one area: landmark composition, NPCs, ambience, clickables. */
function placeArea(scene: RegionScene, region: RegionDef, areaId: string): void {
  const st = regionState(scene);
  if (st.placed.has(areaId)) return;
  st.placed.add(areaId);

  const lm: Landmark | undefined = region.landmarks.find((l: Landmark) => l.area === areaId);
  if (lm) {
    for (const prop of lm.props) placeProp(scene, lm, prop);
    if (lm.glow) {
      // Warm/corrupt light pooled on the ground — gameplay readability first.
      const glow = scene.add.image(lm.x, lm.y, 'proj_fireball')
        .setScale(lm.glow.radius / 26).setAlpha(0.09)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(lm.glow.color).setDepth(5);
      scene.tweens.add({ targets: glow, alpha: { from: 0.06, to: 0.13 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  // Hub NPCs (dialogue + quest-offer + trade all ride the existing systems).
  for (const n of region.npcs ?? []) {
    if (n.area !== areaId) continue;
    try {
      if (scene.spawnNpc && lm) scene.spawnNpc(n.key, lm.x + n.dx, lm.y + n.dy);
    } catch { /* NPCs never block region load */ }
  }

  placeHazardVisuals(scene, region, areaId);
  buildAmbience(scene, region.subregions.find((a: SubRegion) => a.id === areaId));
  placeInteractables(scene, region, areaId);
}

/** Build a real game-object for one landmark prop (y-sorted, optional solid). */
function placeProp(scene: RegionScene, lm: Landmark, prop: PropSpec): void {
  const x: number = lm.x + prop.dx;
  const y: number = lm.y + prop.dy;
  const img: Phaser.GameObjects.Image = scene.add.image(x, y, prop.tex).setDepth(propDepth(prop, y));
  if (prop.scale) img.setScale(prop.scale);
  if (prop.flip) img.setFlipX(true);
  if (prop.rot) img.setRotation(prop.rot);
  if (prop.tint) img.setTint(prop.tint);
  if (prop.alpha !== undefined) img.setAlpha(prop.alpha);
  // The near-camera band is registered for the proximity fade. Never
  // collidable: the band exists to be walked behind, not into.
  if (prop.band === 'fg') registerForegroundProp(scene, img, prop.alpha ?? 1);
  if (prop.solid && regionState(scene).solids) {
    // Authored structures get real collision (the procedural world is
    // walk-through by design; buildings/ruins that block are what make a
    // landmark read as architecture). Player-only collider — enemies keep
    // their simple chase so they can never wedge themselves on a wall.
    const body: Phaser.GameObjects.Rectangle = scene.add.rectangle(x, y, prop.solid[0], prop.solid[1], 0, 0);
    regionState(scene).solids!.add(body);
  }
}

/** Particles for the area's mood. Low rates — atmosphere, not confetti. */
function buildAmbience(scene: RegionScene, area: SubRegion | undefined): void {
  const st = regionState(scene);
  if (!area || area.ambience.type === 'none' || st.emitters.has(area.id)) return;
  const spec = area.ambience;
  const r: number = area.radius * 0.6;
  const tex: string = (spec.type === 'flies' || spec.type === 'motes') ? 'pt_firefly' : 'pt_spark';
  try {
    const emitter: Phaser.GameObjects.Particles.ParticleEmitter = scene.add.particles(0, 0, tex, {
      x: { min: area.x - r, max: area.x + r },
      y: { min: area.y - r * 0.6, max: area.y + r * 0.6 },
      lifespan: { min: 2600, max: 5200 },
      speedX: { min: -8, max: 8 },
      speedY: { min: (spec.drift ?? -4) - 6, max: (spec.drift ?? -4) + 6 },
      scale: { start: spec.type === 'smoke' ? 0.9 : 0.55, end: 0 },
      alpha: { start: spec.type === 'smoke' ? 0.16 : 0.5, end: 0 },
      quantity: 1,
      frequency: Math.max(120, Math.round(1000 / Math.max(0.2, spec.rate))),
      tint: spec.tint,
      blendMode: spec.type === 'smoke' || spec.type === 'ash' ? 'NORMAL' : 'ADD',
    }).setDepth(spec.type === 'embers' ? 8 : 6);
    st.emitters.set(area.id, emitter);
    emitter.stop(); // only the current area emits (toggled in update)
  } catch { /* particles are cosmetic; never block the region */ }
}
