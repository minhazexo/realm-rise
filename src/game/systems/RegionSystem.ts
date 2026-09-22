// ─────────────────────────────────────────────────────────────────────────────
// RegionSystem — places and runs authored regions (starting with THE ASHEN
// FRONTIER) on top of the procedural world.
//
// Design (map brief §28): the region itself is pure data in
// data/regionAshen.ts; this module owns the scene-side work:
//   • lazy placement — an area streams in when the player comes within
//     PLACE_RADIUS, so boot cost stays flat no matter how many regions exist
//   • designed encounters with enemy ROLES (patrol / guard / idle / leader /
//     ambush) and alarm propagation — never random scatter
//   • clickables (chests, savepoints, lore, puzzle crystals, a rescue)
//   • hazards, per-area ambience, and the crystal-sequence puzzle
// Persistence rides on the existing `world.poiStates` map (already saved), so
// cleared fights, looted caches and solved puzzles survive save/load with no
// new save-schema work.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { saveToSlot } from './SaveSystem.ts';
import { spawnEnemy } from './SpawnDirector.ts';
import { idleReason } from './CraftingSystem.ts';
import { WORLD_CONFIG } from '../core/Constants.ts';
import {
  ASHEN_LANDMARKS, ASHEN_INTERACTABLES, ASHEN_ENCOUNTERS, ASHEN_HAZARDS,
  ASHEN_PUZZLE, ASHEN_SUBREGIONS, subregionAt, encountersToTrigger, puzzleStep,
} from '../data/regionAshen.ts';
import type { Encounter, Interactable, Landmark, PropSpec, SubRegion } from '../data/regionAshen.ts';

/**
 * Foreground-band depth: above every actor and health bar in the region, below
 * damage floaters (900) so combat text stays readable, and far below the
 * screen-space overlay layer. Near-camera foliage draws here, over the hero.
 */
const FOREGROUND_DEPTH = 820;
/**
 * Background-band depth: just above the ground and grass images (which the
 * world paints at −worldHalf×2), so the deep wood sits behind every y-sorted
 * actor no matter where in the world the region is.
 */
const BACKGROUND_DEPTH = -WORLD_CONFIG.worldHalfExtent * 2 + 2;
/** How faint the hero's own silhouette may get behind foreground foliage. */
const FOREGROUND_FADED_ALPHA = 0.32;
/** Half the hero's collision height — the fade covers the body, not the feet. */
const PLAYER_HALF_H = 16;

/**
 * Areas within this radius of the player are built (and keep running).
 * Sized against the region itself (~1,500 units across) so the hub builds at
 * spawn and the far corners genuinely stream in later.
 */
const PLACE_RADIUS = 1150;

/** Where the Ashen Frontier's hub NPCs stand (village). */
const REGION_NPCS: { key: string; area: string; dx: number; dy: number }[] = [
  { key: 'mara', area: 'village', dx: 26, dy: 400 },
  { key: 'corvin', area: 'village', dx: -196, dy: 400 },
];

interface ForegroundProp {
  img: Phaser.GameObjects.Image;
  /** Half-extents of the drawn prop, so the fade tests a real overlap. */
  hw: number;
  hh: number;
  base: number;
}

interface RegionState {
  placed: Set<string>;
  interactPlaced: Set<string>;
  /** Near-camera foliage, faded when the hero walks behind it. */
  foreground: ForegroundProp[];
  solids: Phaser.Physics.Arcade.StaticGroup | null;
  emitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter>;
  members: Map<string, any[]>;
  alarmed: Set<string>;
  puzzle: string[];
  hazardT: number;
  currentArea: string;
  /** Set once the arena boss has been seen alive, so its aftermath fires once. */
  bossSeen: boolean;
}

type RegionScene = Phaser.Scene & { _ashen?: RegionState; player?: { sprite: Phaser.GameObjects.Sprite } | null };

function state(scene: RegionScene): RegionState {
  if (!scene._ashen) {
    scene._ashen = {
      placed: new Set(), interactPlaced: new Set(), foreground: [], solids: null,
      emitters: new Map(), members: new Map(), alarmed: new Set(),
      puzzle: [], hazardT: 0, currentArea: '', bossSeen: false,
    };
  }
  return scene._ashen;
}

/** Persisted flag helpers (region progress rides the saved poiStates map). */
function regionFlag(id: string): boolean {
  return !!GameState.s.world.poiStates[id]?.looted;
}
function setRegionFlag(id: string): void {
  const S = GameState.s;
  S.world.poiStates[id] = { ...(S.world.poiStates[id] || {}), looted: true };
}

// ── Placement ───────────────────────────────────────────────────────────────

/** Build a real game-object for one landmark prop (y-sorted, optional solid). */
function placeProp(scene: RegionScene, lm: Landmark, prop: PropSpec, solids: Phaser.Physics.Arcade.StaticGroup | null): Phaser.GameObjects.Image {
  const x: number = lm.x + prop.dx;
  const y: number = lm.y + prop.dy;
  // Depth bands (map brief §7): decals on the ground, background foliage behind
  // every actor, foreground foliage in front of them, and everything else
  // y-sorted with the player exactly like gather nodes do.
  const depth: number = prop.decal ? 4
    : prop.band === 'bg' ? BACKGROUND_DEPTH
    : prop.band === 'fg' ? FOREGROUND_DEPTH
    : Math.round(y);
  const img: Phaser.GameObjects.Image = scene.add.image(x, y, prop.tex).setDepth(depth);
  if (prop.scale) img.setScale(prop.scale);
  if (prop.flip) img.setFlipX(true);
  if (prop.rot) img.setRotation(prop.rot);
  if (prop.tint) img.setTint(prop.tint);
  if (prop.alpha !== undefined) img.setAlpha(prop.alpha);
  if (prop.band === 'fg') {
    // Register for the proximity fade. Never collidable: the band exists to be
    // walked behind, not into.
    state(scene).foreground.push({
      img, hw: img.displayWidth * 0.5, hh: img.displayHeight * 0.5,
      base: prop.alpha ?? 1,
    });
  }
  if (prop.solid && solids) {
    // Authored structures get real collision (the procedural world is
    // walk-through by design; buildings/ruins that block are what make a
    // landmark read as architecture). Player-only collider — enemies keep
    // their simple chase so they can never wedge themselves on a wall.
    const body: Phaser.GameObjects.Rectangle = scene.add.rectangle(x, y, prop.solid[0], prop.solid[1], 0, 0);
    solids.add(body);
  }
  return img;
}

/** Place one area: landmark composition, NPCs, interactables, ambience. */
function placeArea(scene: RegionScene, areaId: string): void {
  const st = state(scene);
  if (st.placed.has(areaId)) return;
  st.placed.add(areaId);

  const lm: Landmark | undefined = ASHEN_LANDMARKS.find((l: Landmark) => l.area === areaId);
  if (lm) {
    for (const prop of lm.props) placeProp(scene, lm, prop, st.solids);
    if (lm.glow) {
      // Warm/corrupt light pooled on the ground — gameplay readability first.
      const glow = scene.add.image(lm.x, lm.y, 'proj_fireball')
        .setScale(lm.glow.radius / 26).setAlpha(0.09)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(lm.glow.color).setDepth(5);
      scene.tweens.add({ targets: glow, alpha: { from: 0.06, to: 0.13 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  // Hub NPCs (dialogue + quest-offer + trade all ride the existing systems).
  for (const n of REGION_NPCS) {
    if (n.area !== areaId) continue;
    try {
      const host: any = scene as any;
      const base: Landmark | undefined = lm;
      if (host.spawnNpc && base) host.spawnNpc(n.key, base.x + n.dx, base.y + n.dy);
    } catch { /* NPCs never block region load */ }
  }

  // Hazards: visual anchor + particle signature (damage ticks in update).
  for (const h of ASHEN_HAZARDS) {
    if (h.area !== areaId) continue;
    const isFire: boolean = h.kind === 'fire';
    scene.add.image(h.x, h.y, isFire ? 'decal_scorch' : 'crystal_node')
      .setScale(isFire ? 1.5 : 1.1)
      .setTint(isFire ? 0x7a4a3a : 0x8a5ad0)
      .setAlpha(0.85)
      .setDepth(4);
  }

  buildAmbience(scene, areaId);
  placeInteractables(scene, areaId);
}

/** Particles for the area's mood. Low rates — atmosphere, not confetti. */
function buildAmbience(scene: RegionScene, areaId: string): void {
  const st = state(scene);
  const area: SubRegion | undefined = ASHEN_SUBREGIONS.find((a: SubRegion) => a.id === areaId);
  if (!area || area.ambience.type === 'none' || st.emitters.has(areaId)) return;
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
    st.emitters.set(areaId, emitter);
    emitter.stop(); // only the current area emits (toggled in update)
  } catch { /* particles are cosmetic; never block the region */ }
}

/** Clickable world objects. */
function placeInteractables(scene: RegionScene, areaId: string): void {
  const st = state(scene);
  for (const it of ASHEN_INTERACTABLES) {
    if (it.area !== areaId || st.interactPlaced.has(it.id)) continue;
    if (it.requiresFlag && !GameState.s.story.flags[it.requiresFlag]) continue;
    st.interactPlaced.add(it.id);
    if (it.kind === 'chest') {
      // Reuse the shipped chest path (pools, toast, sound, persistence).
      const host: any = scene as any;
      host.spawnChest?.(it.x, it.y, it.tier || 'wooden_chest', it.id);
      continue;
    }
    const img: Phaser.GameObjects.Image = scene.add.image(it.x, it.y, it.tex)
      .setDepth(Math.round(it.y))
      .setInteractive({ useHandCursor: true });
    if (it.scale) img.setScale(it.scale);
    if (it.tint) img.setTint(it.tint);
    // Interaction highlight — the only "UI" the world needs.
    img.on('pointerover', () => img.setTint(0xffe9c9));
    img.on('pointerout', () => { img.setTint(it.tint ?? 0xffffff); });
    img.on('pointerdown', () => useInteractable(scene, it, img));
  }
}

// ── Interactable behaviors ──────────────────────────────────────────────────

function useInteractable(scene: RegionScene, it: Interactable, img: Phaser.GameObjects.Image): void {
  const host: any = scene as any;
  const S = GameState.s;

  switch (it.kind) {
    case 'savepoint': {
      const heal: number = Math.round((S.player.derived?.maxHp || 100) * 0.35);
      S.player.hp = Math.min(S.player.derived?.maxHp || S.player.hp, S.player.hp + heal);
      S.player.stamina = S.player.derived?.maxStamina || S.player.stamina;
      // Tell the UI: the HUD only re-reads on a channel notification, so a heal
      // that skipped this left the health bar showing the pre-rest value.
      GameState.notify(CH.PLAYER);
      saveToSlot('auto', S);
      Bus.emit('play-sound', 'craft_done');
      host.floats?.add?.(it.x, it.y - 30, `+${heal}`, '#8aff9f', 1);
      GameState.toast({ title: it.label.toUpperCase(), msg: 'You rest. The realm remembers you here.', kind: 'discover', dur: 4200 });
      break;
    }
    case 'lore': {
      if (it.flag) setLoreFlag(it.flag);
      GameState.toast({ title: it.label, msg: it.text || '', kind: 'dialogue', dur: 7600 });
      Bus.emit('play-sound', 'ui_click');
      break;
    }
    case 'station': {
      // The region's own forging station. It is NOT a second upgrade system:
      // BuildSystem already answered "is this station in reach?" for the
      // settlement forge, and the crafting panel is the same panel either way.
      // Here we only open it (and say why when there is nothing to do).
      // Open, never toggle: a station is a place, and world pointer input stays
      // live while a panel is up, so a second click would otherwise close the
      // panel it just opened. The panel already being open also means the
      // player is looking at it — repeating the advice would just stack toasts.
      const alreadyOpen: boolean = GameState.session.uiPanel === 'crafting';
      if (!alreadyOpen) host.togglePanel?.('crafting');
      Bus.emit('play-sound', 'ui_open');
      host.floats?.add?.(it.x, it.y - 34, '⚒', '#ffd66b', 1.2);
      if (alreadyOpen) break;
      const why: string | null = idleReason(it.station || '');
      if (why) {
        GameState.toast({ title: it.label, msg: `Nothing to forge here — ${why.toLowerCase()}.`, kind: 'info', dur: 4200 });
      } else if (it.flag && !S.story.flags[it.flag]) {
        // Flavour once, then the station is just a station.
        setLoreFlag(it.flag);
        GameState.toast({ title: it.label, msg: it.text || '', kind: 'dialogue', dur: 6400 });
      }
      break;
    }
    case 'crystal': {
      const st = state(scene);
      const res = puzzleStep(st.puzzle, it.crystal || '', ASHEN_PUZZLE.sequence);
      st.puzzle = res.progress;
      if (res.solved) {
        setLoreFlag(ASHEN_PUZZLE.flag);
        Bus.emit('play-sound', 'boss_roar');
        GameState.toast({ title: 'THE SEAL BREAKS', msg: ASHEN_PUZZLE.doneText, kind: 'stage', dur: 5200 });
        host.floats?.add?.(it.x, it.y - 34, 'SEAL', '#c9a0ff', 1.4);
        // The vault and its reward only exist once the seal is broken.
        placeInteractables(scene, it.area);
      } else if (res.failed) {
        GameState.toast({ title: 'THE CRYSTALS DIM', msg: ASHEN_PUZZLE.failText, kind: 'info', dur: 5200 });
        Bus.emit('play-sound', 'hit_flesh');
      } else {
        GameState.toast({ title: it.label, msg: ASHEN_PUZZLE.prompt, kind: 'info', dur: 2600 });
        Bus.emit('play-sound', 'ui_click');
      }
      break;
    }
    case 'hostage': {
      const area: SubRegion | undefined = ASHEN_SUBREGIONS.find((a: SubRegion) => a.id === it.area);
      const guards: any[] = (scene as any).enemies?.filter((e: any) =>
        !e.dead && area && Math.hypot(e.sprite.x - it.x, e.sprite.y - it.y) < 460) || [];
      if (guards.length) {
        GameState.toast({ title: it.label, msg: 'The guards still watch the cage. Clear the camp first.', kind: 'info', dur: 3600 });
        break;
      }
      if (it.flag) setLoreFlag(it.flag);
      S.player.gold = (S.player.gold || 0) + 40;
      GameState.notify(CH.PLAYER);
      host.floats?.add?.(it.x, it.y - 34, '+40 gold', '#ffd66b', 1.2);
      GameState.toast({ title: 'FREED', msg: it.text || '', kind: 'stage', dur: 6000 });
      img.setAlpha(0.45);
      Bus.emit('play-sound', 'craft_done');
      break;
    }
    default:
      break;
  }
}

/** Set a story flag AND fire the quest event so 'flag' steps progress. */
function setLoreFlag(flag: string): void {
  GameState.s.story.flags[flag] = true;
  import('./QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'flagset', flag })).catch(() => {});
}

// ── Encounters ──────────────────────────────────────────────────────────────

function spawnEncounter(scene: RegionScene, enc: Encounter): void {
  const st = state(scene);
  const spawned: any[] = [];
  let seat: number = 0;
  for (const member of enc.members) {
    for (let i: number = 0; i < member.count; i++) {
      // Even ring placement: members get their own space to fight in.
      const a: number = (seat / Math.max(1, enc.members.reduce((n, m) => n + m.count, 0))) * Math.PI * 2 + Math.random() * 0.4;
      seat++;
      const d: number = enc.spread * (0.45 + Math.random() * 0.55);
      const x: number = enc.x + Math.cos(a) * d;
      const y: number = enc.y + Math.sin(a) * d;
      const e: any = spawnEnemy(scene as unknown as Phaser.Scene, member.key, x, y);
      if (!e) continue;
      e._ashenEncounter = enc.id;
      e._ashenRole = member.role;
      applyRole(scene, e, member.role, enc);
      spawned.push(e);
    }
  }
  st.members.set(enc.id, spawned);
  setRegionFlag(enc.id);
  if (enc.intro) GameState.toast({ title: 'ENCOUNTER', msg: enc.intro, kind: 'discover', dur: 3200 });
}

/** Roles give a camp its texture: watchmen walk, guards hold, some sleep. */
function applyRole(scene: RegionScene, e: any, role: string, enc: Encounter): void {
  try {
    switch (role) {
      case 'patrol':
        // The IDLE branch follows patrolTarget, so this makes them walk a beat.
        e.patrolTarget = {
          x: e.sprite.x + Math.cos(Math.random() * Math.PI * 2) * 190,
          y: e.sprite.y + Math.sin(Math.random() * Math.PI * 2) * 190,
        };
        break;
      case 'guard':
        // Shorter leash: they hold their post until you come to them.
        e.aggro = Math.max(140, (e.aggro || 300) * 0.85);
        break;
      case 'idle':
        // Off-duty: late to notice, and they will not wander off post.
        e.aggro = Math.max(120, (e.aggro || 300) * 0.55);
        break;
      case 'leader':
        e.aggro = (e.aggro || 300) * 1.3;
        break;
      case 'ambush':
        e.enterChase?.();
        break;
      default:
        break;
    }
    if (enc.ambush) e.enterChase?.();
  } catch { /* a missing role must never break a fight */ }
}

// ── Main update ─────────────────────────────────────────────────────────────

/**
 * Stream areas in near the player, run encounters/hazards/ambience.
 * Called once per frame from WorldScene.update.
 */
export function updateRegion(scene: RegionScene, px: number, py: number, dt: number): void {
  const st = state(scene);

  // 1. Lazy placement (cheap: only areas not yet built are tested).
  if (st.placed.size < ASHEN_SUBREGIONS.length) {
    for (const area of ASHEN_SUBREGIONS) {
      if (st.placed.has(area.id)) continue;
      if (Math.hypot(px - area.x, py - area.y) <= PLACE_RADIUS) placeArea(scene, area.id);
    }
  }

  // 2. Ambience follows the current area (one emitter at a time).
  const here: SubRegion | null = subregionAt(px, py);
  const areaId: string = here ? here.id : '';
  if (areaId !== st.currentArea) {
    st.currentArea = areaId;
    for (const [id, em] of st.emitters) {
      if (id === areaId) em.start();
      else em.stop();
    }
  }

  // 3. Designed encounters: fire when the player crosses the trigger, once.
  for (const enc of encountersToTrigger(px, py, regionFlag)) {
    if (!st.placed.has(enc.area)) continue;
    spawnEncounter(scene, enc);
  }

  // 4. Alarm: guards converge once a camp fight actually starts.
  for (const enc of ASHEN_ENCOUNTERS) {
    if (!enc.alarm || st.alarmed.has(enc.id)) continue;
    const list: any[] = st.members.get(enc.id) || [];
    const engaged: boolean = list.some((e: any) => !e.dead && e.sprite && Math.hypot(e.sprite.x - px, e.sprite.y - py) < 320);
    if (!engaged) continue;
    st.alarmed.add(enc.id);
    for (const e of list) if (!e.dead) e.enterChase?.();
    GameState.toast({ title: 'ALARM', msg: 'The camp answers the shout.', kind: 'discover', dur: 2800 });
  }

  // 5. Foreground band: near-camera foliage draws OVER the hero, so whatever
  //    the player is actually behind fades out — the band reads as depth
  //    instead of hiding your own character (map brief §7).
  for (const f of st.foreground) {
    const behind: boolean = Math.abs(px - f.img.x) < f.hw && Math.abs(py - f.img.y) < f.hh + PLAYER_HALF_H;
    const target: number = behind ? FOREGROUND_FADED_ALPHA : f.base;
    const next: number = f.img.alpha + (target - f.img.alpha) * Math.min(1, dt * 10);
    if (Math.abs(next - f.img.alpha) > 0.004) f.img.setAlpha(next);
  }

  // 6. Hazards + vault/reward spawns that depend on flags.
  st.hazardT += dt;
  if (st.hazardT >= 0.5) {
    st.hazardT = 0;
    recordArenaOutcome(scene);
    tickHazards(scene, px, py);
    for (const it of ASHEN_INTERACTABLES) {
      if (it.requiresFlag && st.placed.has(it.area) && !st.interactPlaced.has(it.id)
        && GameState.s.story.flags[it.requiresFlag]) {
        placeInteractables(scene, it.area);
      }
    }
  }
}

/**
 * The arena records its own outcome. Killing the Warden sets `warden_slain`
 * directly, so its story beat and the royal cache exist whether or not the
 * player happened to have the quest active at the killing blow.
 */
function recordArenaOutcome(scene: RegionScene): void {
  const st = state(scene);
  if (!st.placed.has('pyre')) return;
  const boss: any = ((scene as any).enemies || []).find((e: any) => e.key === 'warden_of_ash');
  if (boss && !boss.dead) { st.bossSeen = true; return; }
  if (st.bossSeen && !GameState.s.story.flags.warden_slain) setLoreFlag('warden_slain');
}

function tickHazards(scene: RegionScene, px: number, py: number): void {
  for (const h of ASHEN_HAZARDS) {
    if (!state(scene).placed.has(h.area)) continue;
    // Arena vents only burn while their boss still holds the field.
    if (h.bossKey) {
      const bossAlive: boolean = !!((scene as any).enemies || []).some((e: any) => !e.dead && e.key === h.bossKey);
      if (!bossAlive) continue;
    }
    if (Math.hypot(px - h.x, py - h.y) > h.radius) continue;
    (scene as any).player?.takeDamage?.(h.dps * 0.5, h.x, h.y);
    (scene as any).floats?.add?.(px, py - 46, h.label, '#c9a0ff', 0.7);
  }
}

/**
 * Create the region's structural collision + state. Called once from
 * WorldScene.create (player must already exist).
 */
export function placeRegion(scene: RegionScene): void {
  const st = state(scene);
  if (st.solids) return;
  try {
    st.solids = scene.physics.add.staticGroup();
    const sprite = scene.player?.sprite;
    // Player-only collider: authored walls block the hero but never wedge an
    // enemy mid-chase (the procedural world stays walk-through, as designed).
    if (sprite) scene.physics.add.collider(sprite, st.solids);
  } catch { st.solids = null; }
}

/** Snapshot for tests and live probes. */
export function regionSnapshot(scene: RegionScene): Record<string, unknown> {
  const st = state(scene);
  return {
    placed: [...st.placed],
    encountersCleared: ASHEN_ENCOUNTERS.filter((e: Encounter) => regionFlag(e.id)).map((e: Encounter) => e.id),
    interactablesPlaced: [...st.interactPlaced],
    puzzleProgress: st.puzzle,
    puzzleSolved: !!GameState.s.story.flags[ASHEN_PUZZLE.flag],
    currentArea: st.currentArea,
    liveMembers: [...st.members.values()].flat().filter((e: any) => !e.dead).length,
  };
}
