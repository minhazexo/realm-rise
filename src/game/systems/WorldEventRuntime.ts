// ─────────────────────────────────────────────────────────────────────────────
// WorldEventRuntime — the scene side of the dynamic-event layer.
//
// It owns exactly one thing: the objects a live event put into the world, and
// their removal. Every event is driven through systems that already exist —
//   • wandering elite  → SpawnDirector.spawnEnemy with a real ELITES key
//   • ambush           → RegionEncounters.spawnEncounter with a role roster
//   • rescue           → RegionInteractables.useHostage (the shipped cage)
//   • shrine           → RegionInteractables.useSavepoint (the shipped rest)
//   • treasure cache   → WorldScene.spawnChest + a real CHEST_POOLS tier
//   • traveling pedlar → the merchant NPC and its existing trade UI
//   • Veil bloom       → the corruption signature RegionArena already uses
//
// The brief's rule holds: never in a safe hub, never where the player arrived,
// never over a live boss fight, and every event takes its objects with it when
// it expires, is finished, or is left behind (see systems/WorldEvents.ts).
//
// Live state is deliberately NOT saved: events are the world's surprises.
// Persistence stays where it belongs — a looted cache rides the existing
// `world.poiStates` map, and an event's outcome flag is written there too.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { Bus } from '../core/EventBus.ts';
import { spawnEnemy } from './SpawnDirector.ts';
import { spawnEncounter } from './RegionEncounters.ts';
import { useHostage, useSavepoint } from './RegionInteractables.ts';
import { regionState, setRegionFlag } from './RegionState.ts';
import { REGIONS, inRegionSafeZone } from './RegionRegistry.ts';
import { isWaterAt } from '../world/worldGen.ts';
import {
  createEventRuntime, forceEndEvent, mulberry32, tickEvents,
} from './WorldEvents.ts';
import type { BlockReason, EventEnd, EventRuntime, EventStart } from './WorldEvents.ts';
import {
  ELITE_EVENT, EVENT_AMBUSHES, EVENT_RULES, MERCHANT_EVENT, RESCUE_EVENT,
  SHRINE_EVENT, TREASURE_EVENT, VEIL_ZONE,
} from '../data/worldEvents.ts';
import type { Encounter, Interactable, RegionDef, SubRegion } from '../data/region.ts';
import type { RegionScene } from './RegionState.ts';

/** The scene surface this runtime uses (the region host plus its NPC list). */
export type WorldEventScene = RegionScene & { npcs?: any[] };

interface ActiveEvent {
  kind: string;
  id: string;
  x: number;
  y: number;
  /** Anything the event put in the world, so withdrawal can take it back. */
  images: Phaser.GameObjects.Image[];
  enemies: any[];
  others: Array<{ destroy?: () => void }>;
  npc: any;
  chest: any;
  chestId: string;
  /** Traveling pedlar bookkeeping. */
  waypointAt: number;
  waypointT: number;
  /** Seconds since the bloom last burned — hazards tick, they do not stream. */
  damageT: number;
}

/** How often a standing hazard burns the player (matches RegionArena's tick). */
const HAZARD_TICK = 0.5;

export interface EventSession {
  sched: EventRuntime;
  rand: () => number;
  /** Where the player entered the world this session (the arrival rule). */
  arrival: { x: number; y: number } | null;
  active: ActiveEvent | null;
  lastBlock: BlockReason | null;
  cleansed: number;
}

/** The session's event state. Created on first use, like the region runtime. */
export function eventSession(scene: WorldEventScene): EventSession {
  const host = scene as unknown as { _events?: EventSession };
  if (!host._events) {
    host._events = {
      sched: createEventRuntime(),
      // Seeded from the world seed so a session's event stream is reproducible.
      rand: mulberry32((GameState.s?.meta?.seed ?? 1) >>> 0),
      arrival: null,
      active: null,
      lastBlock: null,
      cleansed: 0,
    };
  }
  return host._events;
}

/** One frame of the dynamic-event layer. Called from WorldScene.update. */
export function tickWorldEvents(scene: WorldEventScene, px: number, py: number, dt: number): void {
  const ses = eventSession(scene);
  if (!ses.arrival) ses.arrival = { x: px, y: py };

  const bossLive: boolean = (scene.enemies || []).some((e: any) => !e.dead && e.boss);
  const inSafe: boolean = inRegionSafeZone(px, py);
  const arrivalDist: number = Math.hypot(px - ses.arrival.x, py - ses.arrival.y);
  const live = ses.sched.live;
  const distToLive: number | undefined = live ? Math.hypot(px - live.x, py - live.y) : undefined;

  // An anchor is only worth finding when a roll could actually use it.
  const anchor = (!live && !inSafe && arrivalDist >= EVENT_RULES.arrivalClear && !bossLive)
    ? pickAnchor(scene, ses, px, py)
    : null;

  const tick = tickEvents(ses.sched, {
    dt,
    facts: { inSafe, arrivalDist, bossLive, anchor },
    rand: ses.rand,
    distToLive,
  }, undefined, EVENT_RULES);

  ses.lastBlock = tick.blocked;
  if (tick.end) withdraw(scene, ses, tick.end);
  if (tick.start) begin(scene, ses, tick.start);
  if (ses.active) tickActive(scene, ses, px, py, dt);
}

/** Snapshot for live probes and diagnostics. */
export function worldEventSnapshot(scene: WorldEventScene): Record<string, unknown> {
  const ses = eventSession(scene);
  const live = ses.sched.live;
  return {
    live: live ? { kind: live.kind, x: Math.round(live.x), y: Math.round(live.y), age: Math.round(live.age), duration: live.duration } : null,
    active: ses.active ? { kind: ses.active.kind, id: ses.active.id } : null,
    started: ses.sched.seq,
    rolls: ses.sched.rolls,
    cooldowns: ses.sched.cooldowns,
    lastRefused: ses.lastBlock,
    cleansed: ses.cleansed,
  };
}

/* ── Anchors ──────────────────────────────────────────────────────────────── */

/**
 * Where an event may happen: on a ring around the player, on real ground —
 * inside an area that is already streamed in, not water, not a safe zone, and
 * not back at the arrival point.
 */
function pickAnchor(scene: WorldEventScene, ses: EventSession, px: number, py: number): { x: number; y: number } | null {
  const st = regionState(scene);
  for (let i: number = 0; i < 10; i++) {
    const a: number = ses.rand() * Math.PI * 2;
    const d: number = EVENT_RULES.anchorMin + ses.rand() * (EVENT_RULES.anchorMax - EVENT_RULES.anchorMin);
    const x: number = px + Math.cos(a) * d;
    const y: number = py + Math.sin(a) * d;
    if (inRegionSafeZone(x, y)) continue;
    // A pedlar and a caged survivor need dry land; so does everything else.
    if (isWaterAt(x, y)) continue;
    if (ses.arrival && Math.hypot(x - ses.arrival.x, y - ses.arrival.y) < EVENT_RULES.arrivalClear) continue;
    for (const region of REGIONS) {
      const area: SubRegion | null = region.subregionAt(x, y);
      if (area && st.placed.has(area.id)) return { x, y };
    }
  }
  return null;
}

/** The region + area an anchor sits in, for data that has to name them. */
function areaAt(x: number, y: number): { region: RegionDef; area: SubRegion } | null {
  for (const region of REGIONS) {
    const area: SubRegion | null = region.subregionAt(x, y);
    if (area) return { region, area };
  }
  return null;
}

/* ── Starting an event ────────────────────────────────────────────────────── */

function begin(scene: WorldEventScene, ses: EventSession, start: EventStart): void {
  const id: string = `ev_${start.def.kind}_${start.seq}`;
  const active: ActiveEvent = {
    kind: start.def.kind, id, x: start.x, y: start.y,
    images: [], enemies: [], others: [], npc: null, chest: null, chestId: '',
    waypointAt: 0, waypointT: 0, damageT: 0,
  };
  ses.active = active;
  try {
    switch (start.def.kind) {
      case 'ambush': beginAmbush(scene, active, start.seq); break;
      case 'wandering_elite': beginElite(scene, active, start.seq); break;
      case 'traveling_merchant': beginMerchant(scene, ses, active); break;
      case 'treasure_cache': beginCache(scene, active, start.seq); break;
      case 'corrupted_zone': beginVeilBloom(scene, ses, active); break;
      case 'rescue': beginRescue(scene, ses, active); break;
      case 'shrine': beginShrine(scene, ses, active); break;
      default: break;
    }
    GameState.toast({ title: start.def.title, msg: start.def.toast, kind: 'discover', dur: 4200 });
    Bus.emit('play-sound', 'danger_sting');
  } catch {
    // An event that cannot build itself must not leave a half-made one behind.
    withdraw(scene, ses, { ...ses.sched.live!, reason: 'expired' });
  }
}

/** Ambush: the region's own designed-encounter path, roles and all. */
function beginAmbush(scene: WorldEventScene, active: ActiveEvent, seq: number): void {
  const roster = EVENT_AMBUSHES[seq % EVENT_AMBUSHES.length] ?? EVENT_AMBUSHES[0];
  if (!roster) return;
  const where = areaAt(active.x, active.y);
  const enc: Encounter = {
    id: active.id,
    area: where?.area.id || '',
    label: roster.label,
    x: active.x,
    y: active.y,
    spread: roster.spread,
    trigger: 0,
    members: roster.members,
    ambush: true,
    intro: roster.intro,
  };
  spawnEncounter(scene, enc);
  active.enemies = regionState(scene).members.get(enc.id) || [];
  for (const e of active.enemies) e.eventSpawn = active.id;
}

/** Elite: a real ELITES entry, spawned through SpawnDirector. */
function beginElite(scene: WorldEventScene, active: ActiveEvent, seq: number): void {
  const key: string | undefined = ELITE_EVENT.keys[seq % ELITE_EVENT.keys.length];
  if (!key) return;
  // SpawnDirector owns spawning — the event only chooses where and when.
  const e: any = spawnEnemy(scene, key, active.x, active.y);
  if (!e || e.dead) return;
  e.eventSpawn = active.id;
  // An elite works its own ground instead of standing where it spawned.
  e.patrolTarget = { x: active.x + 120, y: active.y - 90 };
  active.enemies.push(e);
}

/** Pedlar: the shipped merchant NPC, walked between waypoints. */
function beginMerchant(scene: WorldEventScene, ses: EventSession, active: ActiveEvent): void {
  const npc: any = scene.spawnNpc?.(MERCHANT_EVENT.npcKey, active.x, active.y);
  if (!npc) return;
  npc.walkSpeed = MERCHANT_EVENT.walkSpeed;
  npc.homeX = active.x;
  npc.homeY = active.y;
  npc.wanderRadius = MERCHANT_EVENT.ringMax;
  active.npc = npc;
  assignWaypoint(ses, active);
}

/** Cache: revealed through the shipped chest path, with a real tier. */
function beginCache(scene: WorldEventScene, active: ActiveEvent, seq: number): void {
  const tier: string | undefined = TREASURE_EVENT.tiers[seq % TREASURE_EVENT.tiers.length];
  if (!tier) return;
  active.chestId = active.id;
  active.chest = scene.spawnChest?.(active.x, active.y, tier, active.chestId) ?? null;
}

/** Veil bloom: corruption the player has to walk into and cleanse by hand. */
function beginVeilBloom(scene: WorldEventScene, ses: EventSession, active: ActiveEvent): void {
  const r: number = VEIL_ZONE.radius;
  // Ground signature, reusing the ashen decals and the arena's corruption art.
  for (let i: number = 0; i < 3; i++) {
    const a: number = (i / 3) * Math.PI * 2;
    const img = scene.add.image(active.x + Math.cos(a) * r * 0.45, active.y + Math.sin(a) * r * 0.3, 'decal_scorch')
      .setScale(1.6 + i * 0.2).setTint(VEIL_ZONE.tint).setAlpha(0.8).setDepth(4);
    active.images.push(img);
  }
  for (let i: number = 0; i < 2; i++) {
    const img = scene.add.image(active.x + (i ? 34 : -30), active.y - 6 + i * 10, 'crystal_node')
      .setScale(1.05).setTint(VEIL_ZONE.tint).setAlpha(0.9).setDepth(5);
    active.images.push(img);
  }
  const glow = scene.add.image(active.x, active.y, 'proj_fireball')
    .setScale(r / 26).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD)
    .setTint(VEIL_ZONE.poolTint).setDepth(5);
  scene.tweens.add({ targets: glow, alpha: { from: 0.07, to: 0.15 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  active.images.push(glow);

  try {
    const motes = scene.add.particles(0, 0, 'pt_spark', {
      x: { min: active.x - r * 0.7, max: active.x + r * 0.7 },
      y: { min: active.y - r * 0.5, max: active.y + r * 0.5 },
      lifespan: { min: 2400, max: 4600 },
      speedY: { min: -14, max: -4 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.5, end: 0 },
      quantity: 1,
      frequency: 260,
      tint: [VEIL_ZONE.tint],
      blendMode: 'ADD',
    }).setDepth(7);
    active.others.push(motes);
  } catch { /* particles are cosmetic; the bloom still reads */ }

  // The visible heart of it: click to cleanse once nothing is standing in it.
  const hit = scene.add.circle(active.x, active.y, r, VEIL_ZONE.tint, 0.001)
    .setDepth(6).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', () => cleanseBloom(scene, ses, active));
  active.others.push(hit);
}

/** Rescue: the shipped cage, guard rule and reward, exactly as authored. */
function beginRescue(scene: WorldEventScene, ses: EventSession, active: ActiveEvent): void {
  const where = areaAt(active.x, active.y);
  const it: Interactable = {
    id: active.id, area: where?.area.id || '', kind: 'hostage', label: RESCUE_EVENT.label,
    x: active.x, y: active.y, tex: RESCUE_EVENT.tex, scale: RESCUE_EVENT.scale,
    text: RESCUE_EVENT.text, flag: `${active.id}_freed`,
  };
  const img = scene.add.image(it.x, it.y, it.tex).setDepth(Math.round(it.y)).setInteractive({ useHandCursor: true });
  if (it.scale) img.setScale(it.scale);
  img.on('pointerover', () => img.setTint(0xffe9c9));
  img.on('pointerout', () => img.clearTint());
  img.on('pointerdown', () => {
    useHostage(scene, it, img);
    if (GameState.s.story.flags[it.flag as string]) finishEvent(scene, ses, 'done');
  });
  active.images.push(img);
}

/** Shrine: the shipped savepoint rest, raised where the roll put it. */
function beginShrine(scene: WorldEventScene, ses: EventSession, active: ActiveEvent): void {
  const where = areaAt(active.x, active.y);
  const it: Interactable = {
    id: active.id, area: where?.area.id || '', kind: 'savepoint', label: SHRINE_EVENT.label,
    x: active.x, y: active.y, tex: SHRINE_EVENT.tex, scale: SHRINE_EVENT.scale,
    tint: SHRINE_EVENT.tint, text: SHRINE_EVENT.text,
  };
  const img = scene.add.image(it.x, it.y, it.tex)
    .setDepth(Math.round(it.y)).setScale(SHRINE_EVENT.scale).setTint(SHRINE_EVENT.tint)
    .setInteractive({ useHandCursor: true });
  img.on('pointerover', () => img.setTint(0xffe9c9));
  img.on('pointerout', () => img.setTint(SHRINE_EVENT.tint));
  img.on('pointerdown', () => {
    useSavepoint(scene, it);
    finishEvent(scene, ses, 'done');
  });
  active.images.push(img);
}

/* ── Live work ────────────────────────────────────────────────────────────── */

function tickActive(scene: WorldEventScene, ses: EventSession, px: number, py: number, dt: number): void {
  const active: ActiveEvent | null = ses.active;
  if (!active) return;

  if (active.kind === 'corrupted_zone') {
    // Same shape as an authored hazard — and the same cadence: hazards burn on
    // the 0.5s tick, not every frame (per-frame damage was instant death).
    active.damageT += dt;
    if (active.damageT >= HAZARD_TICK) {
      active.damageT -= HAZARD_TICK;
      if (Math.hypot(px - active.x, py - active.y) <= VEIL_ZONE.radius) {
        scene.player?.takeDamage?.(VEIL_ZONE.dps * 0.5, active.x, active.y);
        scene.floats?.add?.(px, py - 46, 'VEIL', '#c9a0ff', 0.7);
      }
    }
    return;
  }

  if (active.kind === 'traveling_merchant' && active.npc) {
    const npc: any = active.npc;
    active.waypointT += dt;
    const arrived: boolean = Math.hypot(npc.sprite.x - npc.aiTargetX, npc.sprite.y - npc.aiTargetY) < 16;
    // Next leg when he gets there, or if something has held him too long.
    if (arrived || active.waypointT > 22 || !npc.sprite.active) assignWaypoint(ses, active);
  }
}

/** Point the pedlar at his next waypoint, on a ring around the event anchor. */
function assignWaypoint(ses: EventSession, active: ActiveEvent): void {
  const npc: any = active.npc;
  if (!npc || !npc.sprite) return;
  active.waypointAt++;
  active.waypointT = 0;
  const step: number = active.waypointAt % MERCHANT_EVENT.waypoints;
  const angle: number = (step / MERCHANT_EVENT.waypoints) * Math.PI * 2 + ses.rand() * 0.5;
  const dist: number = MERCHANT_EVENT.ringMin + ses.rand() * (MERCHANT_EVENT.ringMax - MERCHANT_EVENT.ringMin);
  npc.aiTargetX = active.x + Math.cos(angle) * dist;
  npc.aiTargetY = active.y + Math.sin(angle) * dist;
  const dx: number = npc.aiTargetX - npc.sprite.x;
  const dy: number = npc.aiTargetY - npc.sprite.y;
  npc.aiDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  npc.aiState = 'walking';
  npc.aiTimer = 30;
}

/** Cleanse a bloom — refused while anything still stands inside it. */
function cleanseBloom(scene: WorldEventScene, ses: EventSession, active: ActiveEvent): void {
  const guards: any[] = (scene.enemies || []).filter((e: any) => !e.dead && e.sprite
    && Math.hypot(e.sprite.x - active.x, e.sprite.y - active.y) < VEIL_ZONE.clearRadius);
  if (guards.length) {
    GameState.toast({ title: VEIL_ZONE.title, msg: VEIL_ZONE.held, kind: 'info', dur: 3600 });
    return;
  }
  const S = GameState.s;
  S.player.gold = (S.player.gold || 0) + VEIL_ZONE.gold;
  GameState.notify('PLAYER');
  scene.floats?.add?.(active.x, active.y - 40, `+${VEIL_ZONE.gold} gold`, '#ffd66b', 1.2);
  GameState.toast({ title: 'CLEANSED', msg: VEIL_ZONE.cleansed, kind: 'stage', dur: 5200 });
  Bus.emit('play-sound', 'craft_done');
  setRegionFlag(active.id);
  ses.cleansed++;
  finishEvent(scene, ses, 'done');
}

/* ── Ending an event ──────────────────────────────────────────────────────── */

/** End a live event early (freed survivor, used shrine, cleansed bloom). */
export function finishEvent(scene: WorldEventScene, ses: EventSession, reason: 'done' | 'expired' | 'left'): void {
  const end: EventEnd | null = forceEndEvent(ses.sched, reason);
  if (end) withdraw(scene, ses, end);
}

/** Take back everything the event put in the world. */
function withdraw(scene: WorldEventScene, ses: EventSession, end: EventEnd): void {
  const active: ActiveEvent | null = ses.active;
  if (!active) return;

  const px: number = scene.player?.sprite?.x ?? 0;
  const py: number = scene.player?.sprite?.y ?? 0;

  // Enemies: an elite always leaves; ambush members only leave if the player is
  // not fighting them — nothing vanishes out of a melee you are in.
  for (const e of active.enemies) {
    if (e.dead) continue;
    const d: number = e.sprite ? Math.hypot(e.sprite.x - px, e.sprite.y - py) : Infinity;
    if (active.kind === 'wandering_elite' || end.reason === 'left' || d > 500) despawnEnemy(scene, e);
  }

  if (active.npc) {
    removeNpc(scene, active.npc);
    if (active.kind === 'traveling_merchant') GameState.toast({ title: active.npc.def?.name || 'Pedlar', msg: MERCHANT_EVENT.goneToast, kind: 'info', dur: 3200 });
  }

  if (active.chest && active.chest.destroy) {
    if (!GameState.s.world.poiStates[active.chestId]?.looted) {
      GameState.toast({ title: 'CACHE', msg: TREASURE_EVENT.goneToast, kind: 'info', dur: 3200 });
    }
    active.chest.destroy();
    active.chest = null;
  }

  for (const img of active.images) img.destroy();
  for (const other of active.others) other.destroy?.();
  active.images = [];
  active.others = [];
  active.enemies = [];
  active.npc = null;

  ses.active = null;
}

/** Full teardown for one enemy — the same fields Enemy clears on daylight banish. */
function despawnEnemy(scene: WorldEventScene, e: any): void {
  try {
    e.dead = true;
    e.hpBar?.destroy?.(); e.hpBar = null;
    e.eliteAura?.destroy?.(); e.eliteAura = null;
    e.eliteTag?.destroy?.(); e.eliteTag = null;
    e.shadow?.destroy?.(); e.shadow = null;
    e.sprite?.destroy?.();
  } catch { /* an enemy that was already gone is fine */ }
  if (Array.isArray(scene.enemies)) scene.enemies = scene.enemies.filter((x: any) => x !== e);
}

/** The scene's own npc-removal idiom (see WorldScene.recruitNpc). */
function removeNpc(scene: WorldEventScene, npc: any): void {
  if (!npc) return;
  try { npc.sprite?.destroy?.(); npc.shadow?.destroy?.(); } catch { /* already gone */ }
  if (Array.isArray(scene.npcs)) scene.npcs = scene.npcs.filter((n: any) => n !== npc);
}
