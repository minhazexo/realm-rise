// Aggregated item database.
import { RARITY, ITEM_CATS, newInstance, resetInstanceIdCounter, finalizeItems } from './itemDefs.js';
import './itemsResources.js';
import './itemsGear.js';
import './itemsArmor.js';

export const ITEMS = finalizeItems();

export const getItem = (id) => ITEMS[id] || null;
export const isNewInstance = newInstance; // re-export convenience
export const itemName = (it) => ITEMS[it?.id]?.name || '?';
export const itemRarity = (it) => RARITY[ITEMS[it?.id]?.rarity || 'common'];

export { newInstance, resetInstanceIdCounter, RARITY, ITEM_CATS };
