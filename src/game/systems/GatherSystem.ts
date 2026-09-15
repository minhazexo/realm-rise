// ─────────────────────────────────────────────────────────────────────────────
// GatherSystem: resource-node regrow, proximity detection, gathering hits and
// node breaking (spec §13). Extracted from WorldScene; the scene keeps thin
// delegates (doGather is called by InputSystem + main.js sceneCommand).
//
// Scene contract: scene.nodes (Map), scene.floats, scene.tweens,
// scene.onMeleeImpact(x, y, heavy), scene.spawnBurst(x, y, tex),
// scene.postFX?.pulse?.()
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { GATHER_CONFIG } from '../core/Constants.ts';
import { getItem } from '../data/items.ts';
import type { NodeTypeDef } from '../world/nodeTypes.ts';
import { addItem } from './InventorySystem.ts';
import { awardXP, profXP } from './ProgressionSystem.ts';

/** One live gather node owned by the scene's node map. */
export interface GatherNode {
  uid: string;
  type: string;
  x: number;
  y: number;
  def: NodeTypeDef;
  img: Phaser.GameObjects.Image | null;
  stateKey: string;
  hp: number;
  maxHp: number;
  depleted: boolean;
  regrowAt: number;
  ticks: number;
  [key: string]: any;
}

/** Scene-local floating-text renderer (installed by WorldScene). */
export interface GatherFloats {
  add(x: number, y: number, text: string, color?: string, scale?: number): void;
}

/** Minimal scene surface consumed by the gather lifecycle. */
export type GatherScene = Phaser.Scene & {
  nodes: Map<string, GatherNode>;
  floats: GatherFloats;
  spawnBurst(x: number, y: number, key: string): void;
  onMeleeImpact(x: number, y: number, heavy: boolean): void;
  postFX?: { pulse?: () => void } | null;
  /** Throttle stamp for proximity recomputation. */
  _lastProxDirty?: number;
};

const itemNameOf = (id: string): string => getItem(id)?.name || id;

/** Regrow depleted nodes whose timer elapsed. */
export function gatherTick(scene: GatherScene): void {
  for (const n of scene.nodes.values()) {
    if (n.depleted && n.regrowAt && GameState.s.meta.playSeconds > n.regrowAt) {
      n.depleted = false;
      if (n.img && n.img.scene) {
        n.img.setTexture(n.def.tex);
        if (n.def.tint) n.img.setTint(n.def.tint);
      }
      n.hp = n.maxHp;
    }
  }
}

/** Track the nearest non-depleted node within 90px on the session. */
export function updateGatherProximity(scene: GatherScene, px: number, py: number): void {
  if (scene._lastProxDirty === undefined) scene._lastProxDirty = 0;
  if (performance.now() - scene._lastProxDirty < 120) return;
  scene._lastProxDirty = performance.now();
  let nearest: GatherNode | null = null;
  let nearestD = 90 * 90;
  for (const n of scene.nodes.values()) {
    if (n.depleted) continue;
    const d = (n.x - px) ** 2 + (n.y - py) ** 2;
    if (d < nearestD) { nearestD = d; nearest = n; }
  }
  GameState.session.nearNode = nearest;
}

/** One gather swing against the session's near node (tool check + damage). */
export function doGather(scene: GatherScene): void {
  const n: GatherNode | null = GameState.session.nearNode;
  if (!n) return;
  const S = GameState.s;
  // tool check
  const needed: string | null = n.def.tool;
  const equipped = S.player.equipment.weapon;
  let toolOk = true;
  let mult = 1;
  if (needed && !equipped) toolOk = false;
  else if (needed && equipped) {
    const def = getItem(equipped.id);
    toolOk = def?.tool === needed && (def.tier || 1) >= (n.def.minToolTier || 0);
    mult = def?.gatherMult || 1;
  }
  if (!toolOk) { scene.floats.add(n.x, n.y - 30, `Need ${needed}`, '#ff9a7a'); return; }

  n.hp -= 1;
  Bus.emit('play-sound', !needed ? 'pickup' : needed === 'pick' ? 'mine' : 'chop');
  if (n.hp <= 0) breakNode(scene, n, mult);
  else {
    // Hit feedback: remaining-hits pip + impact wiggle so every swing reads.
    const left = Math.max(1, n.hp);
    scene.floats.add(n.x, n.y - 30, left > 1 ? `${left}` : '…', '#ffe9c9', 0.9);
    scene.onMeleeImpact(n.x, n.y, false);
    try {
      if (n.img && n.img.scene) {
        scene.tweens.add({ targets: n.img, x: n.x + 2, duration: 45, yoyo: true, repeat: 1, onComplete: () => n.img?.setPosition(n.x, n.y) });
      }
    } catch { /* cosmetic */ }
  }
}

/** Break a depleted node: yield items, FX tiers, XP, quest event, regrow timer. */
export function breakNode(scene: GatherScene, n: GatherNode, mult: number): void {
  const S = GameState.s;
  const D = S.player.derived;
  const def: NodeTypeDef = n.def;
  const rng = Math.random;
  const gatherYield: number = D?.gatherYield ?? 1;
  let gatherAmt = Math.round((def.yieldBase[0] + rng() * (def.yieldBase[1] - def.yieldBase[0])) * mult * gatherYield);
  if (def.hardMinProf && (S.player.professions[def.prof]?.lv || 0) < def.hardMinProf) gatherAmt = Math.max(1, Math.floor(gatherAmt * 0.3));
  addItem(def.yRes, gatherAmt);
  // Rare-eruption FX derive from the item's own rarity — no hardcoded list.
  const rar = getItem(def.yRes)?.rarity;
  const isRare = rar === 'rare' || rar === 'epic' || rar === 'legendary' || rar === 'mythic';
  const tier = isRare || gatherAmt >= 8 ? 2 : gatherAmt >= 4 ? 1 : 0;
  scene.floats.add(n.x, n.y - 40, `+${gatherAmt} ${itemNameOf(def.yRes)}`, tier === 2 ? '#ffd66b' : '#a8d890', tier === 2 ? 1.5 : tier === 1 ? 1.2 : 1);
  if (tier === 1) scene.spawnBurst(n.x, n.y, 'fx_hitflash');
  else if (tier === 2) {
    scene.spawnBurst(n.x, n.y, 'fx_ring');
    scene.spawnBurst(n.x, n.y, 'fx_hitflash');
    try { scene.postFX?.pulse?.(); } catch { /* cosmetic */ }
  }
  GameState.notify(CH.INVENTORY);
  profXP(def.prof, def.xpPerHit || 2);
  awardXP(GATHER_CONFIG.tickXp, 'gather');
  import('./QuestEngine.ts').then((q) => q.handleEvent({ type: 'gather', item: def.yRes, amount: gatherAmt }));
  Bus.emit('play-sound', 'pickup');

  // deplete node for a while if it has a solid block or fast-yield
  if (def.solid) {
    n.depleted = true;
    n.regrowAt = GameState.s.meta.playSeconds + (GATHER_CONFIG.regrowTimeMin + rng() * GATHER_CONFIG.regrowTimeVar);
    GameState.s.world.poiStates[n.stateKey] = { depletedAt: S.meta.playSeconds, regrowIn: n.regrowAt };
    if (n.img && n.img.scene) { n.img.setTexture(def.emptyTex || 'tree_stump').setTint(def.tint || 0xaaaaaa); }
  } else {
    n.depleted = true;
    n.regrowAt = GameState.s.meta.playSeconds + (def.emptyTex ? 80 : 160);
    GameState.s.world.poiStates[n.stateKey] = { depletedAt: S.meta.playSeconds, regrowIn: n.regrowAt };
    if (n.img && n.img.scene) {
      n.img.setTexture(def.emptyTex || def.tex);
      if (n.def.tint) n.img.setTint(n.def.tint);
    }
  }
}
