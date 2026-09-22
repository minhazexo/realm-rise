// Aggregated item database.
import { RARITY, ITEM_CATS, newInstance, resetInstanceIdCounter, finalizeItems } from './itemDefs.ts';
import type { ItemDef, RarityInfo } from './itemDefs.ts';
import './itemsResources.ts';
import './itemsGear.ts';
import './itemsArmor.ts';
import './weaponsArpg.ts';

export const ITEMS: Readonly<Record<string, ItemDef>> = finalizeItems();

export interface ItemRef {
  id?: string;
}

export const getItem = (id: string): ItemDef | null => ITEMS[id] || null;
export const isNewInstance = newInstance; // re-export convenience
export const itemName = (it: ItemRef | null | undefined): string => {
  const id: string | undefined = it?.id;
  if (id === undefined) return '?';
  return ITEMS[id]?.name || '?';
};
export const itemRarity = (it: ItemRef | null | undefined): RarityInfo | undefined => {
  const id: string | undefined = it?.id;
  const key: string = (id === undefined ? undefined : ITEMS[id]?.rarity) || 'common';
  return RARITY[key];
};

export { newInstance, resetInstanceIdCounter, RARITY, ITEM_CATS };
