// ─────────────────────────────────────────────────────────────────────────────
// BuildSystem — settlement construction: sprites, placement, validation,
// construction animation, upgrades, station auras, demolition.
//
// Extracted from WorldScene (Phase 3). Scene-context functions (same pattern
// as LootSystem); pure helpers (buildingTexture, canBuildAt, nearMountains)
// take no scene and are unit-testable in node.
//
// Validation contract: canBuildAt(pos) returns null when placement is legal,
// otherwise a human-readable reason string. placeBuild() enforces it plus
// stage/cost/townhall-uniqueness rules.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { WORLD_CONFIG, BUILD_RADIUS_FROM_HALL } from '../core/Constants.ts';
import { biomeAt, elevationAt, isWaterAt } from '../world/worldGen.ts';
import { getBuildingDef } from '../data/buildings.ts';
import type { GameRootState, SettlementBuilding } from '../core/stateFactory.ts';
import { hasItems, spendItems } from './InventorySystem.ts';
import { setFlag } from './QuestSystem.ts';
import { refresh as kingdomRefresh, recruitCitizen } from './KingdomSystem.ts';

/** World position used by placement helpers. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Minimal scene surface consumed by the build lifecycle. */
export type BuildScene = Phaser.Scene & {
  buildingLayer: Phaser.GameObjects.Layer;
  buildings: Map<string, Phaser.GameObjects.Image>;
  player: { sprite: { x: number; y: number } };
  buildGhost?: Phaser.GameObjects.Image | null;
  _stationRings?: Phaser.GameObjects.GameObject[];
  spawnBurst(x: number, y: number, key: string): void;
};

let buildUidSeq = 1;
const nextBuildUid = (): string => `b${buildUidSeq++}`;

const STAGE_NAMES = ['', 'Camp', 'Village', 'Town', 'City', 'Kingdom', 'Empire'];
const STATION_RADIUS = 200;
const MIN_BUILD_SEPARATION = 40;

/** Resolve the Phaser texture key for a building (tier-aware). Pure. */
export function buildingTexture(b: { key: string; tier?: number; complete?: boolean }): string {
  const tier = b.tier || 1;
  switch (b.key) {
    case 'townhall': return `townhall_t${Math.min(tier, 5)}`;
    case 'campfire': return 'campfire';
    case 'tent': return 'tent';
    case 'storage_chest': return 'storage_chest';
    case 'farm': return `farm_stage${b.complete ? 3 : 1}`;
    case 'woodcutter': return 'woodcutter_lodge';
    case 'mine': return 'mine_entrance';
    case 'forge': case 'kitchen': case 'tannery': case 'workshop': return `stn_${b.key}`;
    case 'watchtower': return `watchtower_t${Math.min(tier, 2)}`;
    case 'barracks': return 'barracks';
    case 'archery_range': return 'archery_range';
    case 'stable': return 'stable';
    case 'fortress': return 'fortress';
    case 'wall': return 'wall_seg';
    case 'gate': return 'gate_seg';
    case 'market': return 'market_stalls';
    case 'temple': return 'temple_shrine';
    case 'library': return 'library';
    default: return 'hut_t1';
  }
}

/** True for mountain/volcanic soil (mine yield affinity). Pure. */
export function nearMountains(pos: Vec2): boolean {
  const b = biomeAt(pos.x, pos.y);
  return b === 'mountains' || b === 'volcanic';
}

/**
 * Placement validation. Returns null when legal, else a reason string.
 * Pure — safe to call from UI previews and tests.
 */
export function canBuildAt(pos: Vec2): string | null {
  const S = GameState.s;
  if (!S) return 'No game running';
  // World bounds
  const ext = WORLD_CONFIG.worldHalfExtent - 200;
  if (Math.abs(pos.x) > ext || Math.abs(pos.y) > ext) return 'Too close to the world edge';
  // Water
  if (isWaterAt(pos.x, pos.y)) return 'Cannot build in water';
  // Steep / unstable ground
  const elev = elevationAt(pos.x, pos.y);
  const biome = biomeAt(pos.x, pos.y);
  if (biome === 'mountains' && elev > 0.82) return 'Terrain too steep for building';
  if (biome === 'volcanic' && elev > 0.78) return 'Volcanic ground is unstable';
  // Build radius from town hall (if founded)
  if (S.settlement.founded && S.settlement.pos) {
    const radius = BUILD_RADIUS_FROM_HALL[Math.min(S.settlement.stageIndex, BUILD_RADIUS_FROM_HALL.length - 1)] ?? 900;
    const dx = pos.x - S.settlement.pos.x, dy = pos.y - S.settlement.pos.y;
    if (dx * dx + dy * dy > radius * radius) return `Too far from your settlement (max ${Math.round(radius)}px)`;
  }
  // Collision with existing buildings
  for (const b of S.settlement.buildings) {
    if ((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2 < MIN_BUILD_SEPARATION * MIN_BUILD_SEPARATION) {
      return 'Too close to another building';
    }
  }
  return null;
}

/** Re-render every settlement building sprite from state (load / refresh). */
export function syncBuildingsFromState(scene: BuildScene): void {
  scene.buildingLayer.removeAll(true);
  scene.buildings.clear();
  for (const b of GameState.s.settlement.buildings) addBuildingSprite(scene, b);
  kingdomRefresh();
}

/** Create the interactive sprite for one building record. */
export function addBuildingSprite(scene: BuildScene, b: SettlementBuilding): Phaser.GameObjects.Image | null {
  const def = getBuildingDef(b.key);
  if (!def) return null;
  const img = scene.add.image(b.x, b.y, buildingTexture(b)).setDepth(b.y).setInteractive({ useHandCursor: true });
  img.on('pointerdown', () => {
    GameState.session.selectedBuilding = b.uid;
    GameState.notify(CH.SETTLEMENT);
  });
  scene.buildingLayer.add(img);
  scene.buildings.set(b.uid, img);
  return img;
}

/** Enter placement mode for a building key (from the Build panel). */
export function enterBuildMode(scene: Phaser.Scene, buildKey: string): void {
  const def = getBuildingDef(buildKey);
  GameState.session.pendingBuild = { key: buildKey };
  GameState.session.uiPanel = null;
  GameState.notify(CH.SCREEN);
  if (def) {
    GameState.toast({
      title: `Placing ${def.label}`,
      msg: 'Click ground to place · ESC or right-click to cancel',
      kind: 'info',
      dur: 3500
    });
  }
  const bScene = scene as BuildScene;
  const pointer = scene.input?.activePointer;
  const cam = scene.cameras?.main;
  const wx = pointer && cam ? cam.getWorldPoint(pointer.x, pointer.y).x : (bScene.player?.sprite?.x || 0);
  const wy = pointer && cam ? cam.getWorldPoint(pointer.x, pointer.y).y : (bScene.player?.sprite?.y || 0);
  updateBuildGhost(bScene, { x: wx, y: wy });
}

/** Repair a damaged building using wood/stone. */
export function repairBuilding(scene: BuildScene, b: SettlementBuilding): boolean {
  const def = getBuildingDef(b.key);
  if (!def) return false;
  const maxHp = def.hp || 100;
  if ((b.hp ?? maxHp) >= maxHp) {
    GameState.toast({ title: def.label, msg: 'Structure is already in pristine condition.', kind: 'info' });
    return false;
  }
  if (!hasItems({ wood: 1, stone: 1 })) {
    GameState.toast({ title: 'Repair Supplies Needed', msg: 'Requires 1 Wood and 1 Stone to patch structure.', kind: 'warn' });
    return false;
  }
  spendItems({ wood: 1, stone: 1 });
  const heal = Math.round(maxHp * 0.4);
  b.hp = Math.min(maxHp, (b.hp ?? 0) + heal);
  scene.spawnBurst?.(b.x, b.y, 'fx_hitflash');
  Bus.emit('play-sound', 'build_thud');
  GameState.toast({ title: `${def.label} Repaired`, msg: `Integrity at ${Math.round((b.hp / maxHp) * 100)}% (+${heal} HP)`, kind: 'quest' });
  GameState.notify(CH.SETTLEMENT, CH.INVENTORY);
  return true;
}

/** Spend resources + create the building record + sprite + construction. */
export function placeBuild(scene: BuildScene, pos: Vec2): void {
  const S = GameState.s;
  const pending = GameState.session.pendingBuild;
  if (!pending) return;
  const def = getBuildingDef(pending.key);
  if (!def) return;
  // Terrain/build validation
  const blockReason = canBuildAt(pos);
  if (blockReason) { GameState.toast({ title: def.label, msg: blockReason, kind: 'warn' }); return; }
  // Stage check
  if (S.settlement.founded && def.requiresStage && S.settlement.stageIndex < def.requiresStage) {
    GameState.toast({ title: def.label, msg: `Requires ${STAGE_NAMES[def.requiresStage]} rank`, kind: 'warn' });
    return;
  }
  if (!hasItems(def.cost)) { GameState.toast({ title: def.label, msg: 'Not enough resources', kind: 'warn' }); return; }
  if (pending.key === 'townhall' && S.settlement.founded) {
    GameState.toast({ title: 'Town Hall', msg: 'A realm may hold but one hall.', kind: 'warn' });
    return;
  }
  spendItems(def.cost);
  const startHp: number = def.hpByTier?.[0] ?? def.hp ?? 100;
  const b: SettlementBuilding = {
    uid: nextBuildUid(), key: pending.key, x: pos.x, y: pos.y,
    tier: 1, builtProgress: 0, complete: (def.buildSec || 0) <= 0,
    builders: [],
    hp: startHp, maxHp: startHp
  };
  if (pending.key === 'townhall' && !S.settlement.founded) {
    S.settlement.founded = true;
    S.settlement.pos = { x: pos.x, y: pos.y };
    GameState.toast({ title: 'SETTLEMENT FOUNDED', msg: 'Your realm has a hearth and a hall. This is where it begins.', kind: 'stage', dur: 5200 });
    setFlag('settlement_founded');
    import('./AchievementSystem.ts').then((a) => a.evaluateAll());
    spawnIntroFollowers(S);
  }
  if (def.yieldMultNearMountain) b.mountainAffinity = nearMountains(pos);
  S.settlement.buildings.push(b);
  addBuildingSprite(scene, b);
  animateConstruction(scene, b);
  import('./QuestEngine.ts').then((q) => q.handleEvent({ type: 'built', building: pending.key }));
  Bus.emit('play-sound', 'build_thud');
  GameState.notify(CH.SETTLEMENT, CH.INVENTORY);
  kingdomRefresh();
  GameState.session.pendingBuild = null;
}

function spawnIntroFollowers(S: GameRootState): void {
  if (S.settlement.citizens.length > 0) return;
  recruitCitizen({ name: 'Tam', role: 'worker', skillLv: 1 });
  recruitCitizen({ name: 'Mira', role: 'farmer', skillLv: 2 });
  GameState.toast({ title: 'Two souls settle in', msg: 'Travelers who followed the smoke of your first fire.', kind: 'quest' });
}

/** Blink-while-building effect; completes after def.buildSec. */
export function animateConstruction(scene: BuildScene, b: SettlementBuilding): void {
  const img = scene.buildings.get(b.uid);
  if (!img) return;
  img.setAlpha(0.35);
  const def = getBuildingDef(b.key);
  scene.tweens.add({ targets: img, alpha: 0.35, duration: 200, yoyo: true, repeat: -1 });
  scene.time.delayedCall(((def?.buildSec) || 4) * 1000, () => {
    b.complete = true;
    scene.tweens.killTweensOf(img);
    img.setAlpha(1).setDepth(img.y);
    GameState.notify(CH.SETTLEMENT);
    Bus.emit('built-complete', { key: b.key });
    Bus.emit('play-sound', 'craft_done');
    kingdomRefresh();
    refreshStationsNear(scene);
  });
}

/** Upgrade a building one tier (spends tierCosts). Returns { ok, reason? }. */
export function upgradeBuilding(scene: BuildScene, uid: string): { ok: boolean; reason?: string } {
  const S = GameState.s;
  const b = S.settlement.buildings.find((x) => x.uid === uid);
  if (!b) return { ok: false, reason: 'Missing' };
  const def = getBuildingDef(b.key);
  if (!def) return { ok: false, reason: 'Missing' };
  const next = b.tier + 1;
  if (def.maxTier < next || !def.maxTier) return { ok: false, reason: 'Max tier' };
  const cost = def.tierCosts && def.tierCosts[b.tier];
  if (cost && !hasItems(cost)) return { ok: false, reason: 'Missing resources' };
  if (cost) spendItems(cost);
  b.tier = next;
  if (b.hp && def.hpByTier) b.maxHp = def.hpByTier[next - 1] || b.maxHp;
  const img = scene.buildings.get(uid);
  if (img) img.setTexture(buildingTexture(b)).setAlpha(1);
  GameState.toast({ title: `${def.label} upgraded → Tier ${next}`, kind: 'stage' });
  GameState.notify(CH.SETTLEMENT);
  kingdomRefresh();
  refreshStationsNear(scene);
  return { ok: true };
}

/** Recompute crafting-station proximity for the player position. */
export function refreshStationsNear(scene: BuildScene): void {
  const near: Record<string, boolean> = {};
  const px = scene.player.sprite.x, py = scene.player.sprite.y;
  for (const b of GameState.s.settlement.buildings) {
    if (!b.complete) continue;
    const def = getBuildingDef(b.key);
    if (def?.station && (b.x - px) ** 2 + (b.y - py) ** 2 < STATION_RADIUS * STATION_RADIUS) {
      near[def.station] = true;
    }
  }
  GameState.session.stationsNear = near;
}

/** Draw the 200px station radius ring (from the crafting UI). Auto-fades. */
export function showStationRadius(scene: BuildScene, station: string | null | undefined): void {
  if (!station) return;
  scene._stationRings?.forEach((g) => g.destroy());
  scene._stationRings = [];
  for (const b of GameState.s.settlement.buildings) {
    if (!b.complete) continue;
    const def = getBuildingDef(b.key);
    if (def?.station !== station) continue;
    const g = scene.add.graphics().setDepth(6);
    g.lineStyle(2, 0x8fd8ff, 0.9);
    g.strokeCircle(b.x, b.y, STATION_RADIUS);
    g.fillStyle(0x8fd8ff, 0.06);
    g.fillCircle(b.x, b.y, STATION_RADIUS);
    scene.tweens.add({ targets: g, alpha: 0, duration: 2500, onComplete: () => g.destroy() });
    scene._stationRings.push(g);
  }
}

/** Remove a destroyed (0 HP) building; un-founding if it was the hall. */
export function destroyBuilding(scene: BuildScene, b: SettlementBuilding): void {
  const S = GameState.s;
  const def = getBuildingDef(b.key);
  S.settlement.buildings = S.settlement.buildings.filter((x) => x.uid !== b.uid);
  const img = scene.buildings.get(b.uid);
  if (img) { try { img.destroy(); } catch { /* already gone */ } scene.buildings.delete(b.uid); }
  scene.spawnBurst(b.x, b.y, 'fx_ring');
  scene.spawnBurst(b.x, b.y, 'fx_hitflash');
  GameState.toast({ title: `${def?.label || 'Building'} destroyed!`, msg: 'Raiders tore it down. Rebuild from the Build menu (B).', kind: 'danger', dur: 5200 });
  if (b.key === 'townhall') {
    S.settlement.founded = false;
    GameState.toast({ title: 'YOUR HALL HAS FALLEN', msg: 'The realm scatters. Raise a new Town Hall to rally.', kind: 'danger', dur: 7000 });
  }
  GameState.notify(CH.SETTLEMENT, CH.WORLD);
  try { refreshStationsNear(scene); } catch { /* optional */ }
  try { kingdomRefresh(); } catch { /* optional */ }
}

/**
 * Placement ghost preview (called from the scene's pointermove handler).
 * Green = buildable here, red = blocked.
 */
export function updateBuildGhost(scene: BuildScene, w: Vec2): void {
  if (!GameState.session.pendingBuild) {
    if (scene.buildGhost) { scene.buildGhost.destroy(); scene.buildGhost = null; }
    return;
  }
  if (!scene.buildGhost) scene.buildGhost = scene.add.image(w.x, w.y, 'hut_t1').setAlpha(0.6).setDepth(70);
  else scene.buildGhost.setPosition(w.x, w.y).setTexture(ghostTexture(scene)).setAlpha(0.6);
  const valid = !canBuildAt(w);
  scene.buildGhost.setTint(valid ? 0x44ff88 : 0xff4444);
}

/** Texture key for the current placement ghost. */
export function ghostTexture(scene: BuildScene): string {
  void scene;
  const key: string = GameState.session.pendingBuild?.key ?? '';
  const def = getBuildingDef(key);
  if (!def) return 'hut_t1';
  return buildingTexture({ key, tier: 1, complete: true });
}
