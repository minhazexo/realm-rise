// Shared item definition kernel: rarity metadata + registration helper used by
// every item category module. (spec §80 — data separated from logic)
import { Registry } from '../core/Registry.ts';

export interface RarityInfo {
  label: string;
  color: string;
  order: number;
}

export const RARITY: Readonly<Record<string, RarityInfo>> = Object.freeze({
  common: { label: 'Common', color: '#c9c4b4', order: 0 },
  uncommon: { label: 'Uncommon', color: '#6fbf73', order: 1 },
  rare: { label: 'Rare', color: '#5aa2e8', order: 2 },
  epic: { label: 'Epic', color: '#b071e0', order: 3 },
  legendary: { label: 'Legendary', color: '#e8a13a', order: 4 },
  mythic: { label: 'Mythic', color: '#e85a7a', order: 5 }
});

export const ITEM_CATS = ['resource', 'tool', 'weapon', 'offhand', 'armor', 'trinket', 'consumable', 'special'] as const;

export type ItemCat = (typeof ITEM_CATS)[number];

export interface ItemIconHint {
  shape: string;
  c1: string;
  c2?: string;
}

export interface ItemWeaponStats {
  dmg: number;
  crit: number;
  cd: number;
  range: number;
  style: string;
  ammo?: string;
  projectileSpeed?: number;
  heavy?: boolean;
  pierce?: number;
  reachBonusVsAnimals?: boolean;
}

export interface ItemUseEffect {
  food?: number;
  hp?: number;
  thirst?: number;
  warmBuff?: number;
  staminaFull?: boolean;
  sprintBuff?: number;
  repairEquipped?: number;
  repairAll?: number;
}

export type ItemMods = Record<string, number>;

export interface ItemDef {
  id: string;
  name: string;
  rarity: string;
  cat: string;
  stack: number;
  value: number;
  desc: string;
  icon?: ItemIconHint;
  slot?: string;
  armor?: number;
  outfitTier?: number;
  warmth?: number;
  mods?: ItemMods;
  weapon?: ItemWeaponStats;
  tool?: string;
  tier?: number;
  durability?: number;
  damage?: number;
  gatherMult?: number;
  buildSpeedMult?: number;
  shieldBlock?: number;
  movePenalty?: number;
  use?: ItemUseEffect;
  usable?: boolean;
}

export type ItemDefInput = Partial<Omit<ItemDef, 'id'>>;

const REGISTRY: Record<string, ItemDef> = {};

/**
 * Register an item. Common fields auto-filled.
 * `icon` = hint consumed by the procedural ArtFactory: { shape, c1, c2 }.
 * Duplicate IDs throw (previously the later file silently overwrote).
 */
export function def(id: string, o: ItemDefInput): void {
  const bad: string | null = Registry.checkId(id);
  if (bad) throw new Error(`[items] ${bad}`);
  if (REGISTRY[id]) throw new Error(`[items] duplicate item id "${id}"`);
  if (o?.cat && !(ITEM_CATS as readonly string[]).includes(o.cat)) {
    throw new Error(`[items] "${id}" has unknown category "${o.cat}"`);
  }
  REGISTRY[id] = Object.assign(
    {
      id,
      name: id,
      rarity: 'common',
      cat: 'resource',
      stack: 999,
      value: 2,
      desc: ''
    },
    o
  );
}

export interface ItemStack {
  id: string;
  qty: number;
}

export interface ItemGearInstance {
  iid: string;
  id: string;
  qty: number;
  dur: number | undefined;
  maxDur: number | undefined;
}

export type ItemInstance = ItemStack | ItemGearInstance;

/** Create a new inventory entry. Gear gets unique ids + durability. */
let iidCounter = 1;
export const newInstance = (id: string): ItemInstance | null => {
  const base: ItemDef | undefined = REGISTRY[id];
  if (!base) return null;
  const instanced: boolean = !!(base.durability || base.weapon || base.slot);
  if (!instanced) return { id, qty: 1 };
  return { iid: `i${iidCounter++}`, id, qty: 1, dur: base.durability, maxDur: base.durability };
};
export const resetInstanceIdCounter = (): void => {
  iidCounter = 1;
};

export function finalizeItems(): Readonly<Record<string, ItemDef>> {
  for (const id of Object.keys(REGISTRY)) {
    if (!REGISTRY[id]?.icon) console.warn('[items] missing icon hint:', id);
  }
  return Object.freeze({ ...REGISTRY });
}
