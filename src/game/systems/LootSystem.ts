// ─────────────────────────────────────────────────────────────────────────────
// LootSystem — ground drops: spawn, magnet drift, pickup, expiry.
//
// Extracted from WorldScene (Phase 3). Functions take the scene as context
// (same pattern as productionTick / refreshDynamicLights) so WorldScene
// stays a coordinator. Phaser-free: randomness uses Math.random so this
// module stays importable in node tests.
//
// Loot lifecycle:
//   dropLoot → ground item (auto-pickup radius + 90s expiry)
//   updateLoot (per frame) → magnet drift (<130px) → pickLoot (<45px)
//   pickLoot → inventory + fly-to-player tween + rarity fanfare
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { getItem } from '../data/items.ts';
import { addItem } from './InventorySystem.ts';
import { addGold } from './ProgressionXP.ts';
import { iconFrame } from '../assets/icons.ts';

const RARE = new Set(['rare', 'epic', 'legendary', 'mythic']);
const PICKUP_R = 45;
const MAGNET_R = 130;
const EXPIRE_SEC = 90;

/** One ground-drop entity owned by the scene's loot list. */
export interface LootDrop {
  img: Phaser.GameObjects.Image;
  id: string;
  qty: number;
  x: number;
  y: number;
  t: number;
  picked?: boolean;
  glow?: Phaser.GameObjects.Image | null;
}

/** Scene-local floating-text renderer installed by WorldScene. */
export interface LootFloats {
  add(x: number, y: number, text: string, color?: string, scale?: number): void;
}

/** Minimal scene surface consumed by the loot lifecycle. */
export type LootScene = Phaser.Scene & {
  loots: LootDrop[];
  floats: LootFloats;
  player: { sprite: { x: number; y: number } };
  spawnBurst(x: number, y: number, key: string): void;
  postFX?: { pulse?: () => void } | null;
};

/** Initialize the scene's loot list. Called once from WorldScene.create(). */
export function setupLoot(scene: LootScene): void {
  scene.loots = [];
}

/** Drop a ground item with optional rare-glow ring. */
export function dropLoot(scene: LootScene, x: number, y: number, id: string, qty: number): LootDrop {
  const img: Phaser.GameObjects.Image = scene.add.image(x, y, iconFrame(id)).setDepth(8).setScale(1.2);
  if (Math.random() < 0.5) img.setAngle(-20 + Math.random() * 40);
  img.setInteractive();
  const l: LootDrop = { img, id, qty, x, y, t: 0 };
  img.on('pointerdown', () => pickLoot(scene, l));
  scene.loots.push(l);
  // Rare+ drops announce themselves — pulsing glow ring so rarity reads
  // before pickup, not just after.
  try {
    const rarity: string = getItem(id)?.rarity || 'common';
    if (RARE.has(rarity)) {
      const ring: Phaser.GameObjects.Image = scene.add.image(x, y, 'fx_ring').setDepth(7).setAlpha(0.7).setScale(1.1);
      scene.tweens.add({ targets: ring, alpha: 0.25, scale: 1.5, duration: 700, yoyo: true, repeat: -1 });
      l.glow = ring;
    }
  } catch { /* cosmetic only */ }
  return l;
}

/** Gold auto-collects with a floater (no ground entity). */
export function dropLootGold(scene: LootScene, x: number, y: number, amount: number): void {
  scene.floats.add(x, y - 34, `+${amount} 🪙`, '#ffd66b', 1.15);
  addGold(amount);
  Bus.emit('play-sound', 'coin');
}

/** Per-frame magnet drift + expiry. Call with the player position. */
export function updateLoot(scene: LootScene, px: number, py: number): void {
  for (const l of [...scene.loots]) {
    l.t += 1 / 60;
    if (l.t > EXPIRE_SEC) {
      l.img.destroy();
      l.glow?.destroy();
      scene.loots = scene.loots.filter((q) => q !== l);
      continue;
    }
    if (l.t <= 0.6 || l.picked) continue;
    const dx: number = px - l.img.x, dy: number = (py - 20) - l.img.y;
    const d2: number = dx * dx + dy * dy;
    // Magnet stage: nearby drops drift toward the player instead of
    // popping instantly — reads as physical, rewards running over loot.
    if (d2 < PICKUP_R * PICKUP_R) { pickLoot(scene, l); continue; }
    if (d2 < MAGNET_R * MAGNET_R && l.img?.active !== false) {
      const d: number = Math.max(1, Math.sqrt(d2));
      const step: number = Math.min(d, 320 / 60);
      l.img.x += (dx / d) * step;
      l.img.y += (dy / d) * step;
      l.x = l.img.x; l.y = l.img.y;
      if (l.glow) l.glow.setPosition(l.img.x, l.img.y);
    }
  }
}

/** Collect a ground drop into the inventory with fly-to-player feedback. */
export function pickLoot(scene: LootScene, l: LootDrop): void {
  if (l.picked) return;
  const left: number = addItem(l.id, l.qty);
  const gained: number = l.qty - left;
  // Rarity-graded feedback: rare+ gets a ring + post pulse, not just a pop.
  try {
    const rarity: string = getItem(l.id)?.rarity || 'common';
    if (gained > 0 && RARE.has(rarity)) {
      scene.spawnBurst(l.img.x, l.img.y, 'fx_ring');
      scene.postFX?.pulse?.();
    }
  } catch { /* cosmetic only */ }
  if (gained > 0) {
    const px: number = scene.player.sprite.x, py: number = scene.player.sprite.y;
    const startX: number = l.img.x, startY: number = l.img.y;
    scene.tweens.add({
      targets: l.img,
      x: px, y: py - 20,
      scaleX: 0.3, scaleY: 0.3,
      alpha: 0.2,
      duration: 280,
      ease: 'Cubic.easeIn',
      onComplete: () => { l.img.destroy(); }
    });
    // Delay the float text slightly so it appears at the pickup point.
    scene.time.delayedCall(100, () => {
      scene.floats.add(startX, startY - 24, `+${gained} ${getItem(l.id)?.name || l.id}`, '#dcead0');
    });
    l.glow?.destroy();
  } else {
    l.img.destroy();
  }
  if (left === 0) {
    l.picked = true;
    scene.loots = scene.loots.filter((q) => q !== l);
  } else l.qty = left;
  Bus.emit('play-sound', 'pickup');
  GameState.notify(CH.INVENTORY);
}
