// ─────────────────────────────────────────────────────────────────────────────
// Inventory operations (spec §11–12). Unified inventory: resources + gear.
// Stackables merge by id; gear instances carry iid + durability.
// Equipment slots hold { ref, id, dur } where ref is the instance key.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { getItem, newInstance, RARITY } from '../data/items.ts';
import type { ItemDef, ItemUseEffect } from '../data/itemDefs.ts';
import { CH, Bus } from '../core/EventBus.ts';
import type { GameRootState, InventoryEntry, EquipmentInstance } from '../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

export interface AddItemOpts {
  ignoreCap?: boolean;
  silent?: boolean;
}

export const countItem = (id: string): number =>
  st().inventory.reduce((n: number, e: InventoryEntry) => n + (e.id === id ? e.qty : 0), 0);

export function capacity(): number {
  const S: GameRootState = st();
  let cap: number = S.inventorySlots;
  for (const b of S.settlement?.buildings || []) {
    if (b.key === 'storage_chest' && b.complete && b.tier >= 1) cap += 10;
  }
  return cap;
}

export const usedSlots = (): number => st().inventory.length;

export function addItem(id: string, qty = 1, opts: AddItemOpts = {}): number {
  const def: ItemDef | null = getItem(id);
  if (!def) return qty;
  const S: GameRootState = st();
  const cap: number = opts.ignoreCap ? Infinity : capacity();
  const stackable: boolean = !(def.durability || def.weapon || def.slot);
  let left: number = qty;
  if (stackable) {
    for (const e of S.inventory) {
      if (e.id !== id || left <= 0) continue;
      const move: number = Math.min(def.stack - e.qty, left);
      e.qty += move;
      left -= move;
    }
    while (left > 0 && S.inventory.length < cap) {
      const move: number = Math.min(def.stack, left);
      S.inventory.push({ id, qty: move });
      left -= move;
    }
  } else {
    while (left > 0 && S.inventory.length < cap) {
      const inst = newInstance(id);
      if (!inst) break;
      S.inventory.push(inst);
      left -= 1;
    }
  }
  if (qty - left > 0 && !opts.silent) GameState.notify(CH.INVENTORY);
  return left;
}

export function hasItems(costObj: Record<string, number> | null | undefined): boolean {
  const S: GameRootState = st();
  for (const [id, n] of Object.entries(costObj || {})) {
    if (id === 'gold') {
      if (S.player.gold < n) return false;
    } else if (countItem(id) < n) return false;
  }
  return true;
}

export function spendItems(costObj: Record<string, number>): boolean {
  if (!hasItems(costObj)) return false;
  const S: GameRootState = st();
  for (const [id, n] of Object.entries(costObj)) {
    if (id === 'gold') {
      S.player.gold -= n;
      continue;
    }
    let need: number = n;
    while (need > 0) {
      const entry: InventoryEntry | undefined = S.inventory.find((e) => e.id === id);
      if (!entry) break;
      const take: number = Math.min(entry.qty, need);
      entry.qty -= take;
      need -= take;
      if (entry.qty <= 0) S.inventory.splice(S.inventory.indexOf(entry), 1);
    }
  }
  GameState.notify(CH.INVENTORY, CH.PLAYER);
  return true;
}

export const removeItem = (id: string, qty = 1): boolean => spendItems({ [id]: qty });

/* ── Equipment ─────────────────────────────────────────────────────────── */

export function slotFor(def: ItemDef | null | undefined): string | null {
  if (!def) return null;
  if (def.weapon) return 'weapon';
  if (def.slot) return def.slot;
  if (def.shieldBlock || def.tool === 'light') return 'offhand';
  return null;
}

/** ref may be an instance key ('i7') or a plain stackable id. */
export function equip(ref: string): boolean {
  const S: GameRootState = st();
  const entry: InventoryEntry | undefined = S.inventory.find((e) => e.iid === ref || e.id === ref);
  if (!entry) return false;
  const def: ItemDef | null = getItem(entry.id);
  const slot: string | null = slotFor(def);
  if (!slot) return false;
  unequip(slot, true); // bag swap silently
  S.player.equipment[slot] = { ref: entry.iid || entry.id, id: entry.id, dur: entry.dur ?? def?.durability ?? null };
  S.inventory.splice(S.inventory.indexOf(entry), 1);
  GameState.notify(CH.INVENTORY, CH.EQUIPMENT);
  Bus.emit('equipped');
  return true;
}

export function unequip(slot: string, silent = false): boolean {
  const S: GameRootState = st();
  const eq: EquipmentInstance | null | undefined = S.player.equipment[slot];
  if (!eq) return false;
  const def: ItemDef | null = getItem(eq.id);
  if (def?.durability || def?.weapon || def?.slot) {
    const inst = newInstance(eq.id) as unknown as InventoryEntry | null;
    if (inst) {
      if (typeof eq.dur === 'number') inst.dur = eq.dur;
      if (typeof eq.ref === 'string' && eq.ref.startsWith('i')) inst.iid = eq.ref; // keep identity stable across save/load
      S.inventory.push(inst);
    }
  } else {
    S.inventory.push({ id: eq.id, qty: 1 });
  }
  delete S.player.equipment[slot];
  if (!silent) GameState.notify(CH.INVENTORY, CH.EQUIPMENT);
  else GameState.notify(CH.EQUIPMENT);
  return true;
}

export const equippedDef = (slot: string): ItemDef | null => {
  const eq: EquipmentInstance | null | undefined = st().player.equipment[slot];
  return eq ? getItem(eq.id) : null;
};
export const equippedDur = (slot: string): number | null => st().player.equipment[slot]?.dur ?? null;

/* ── Durability wear & repair ──────────────────────────────────────────── */
// kind: 'weapon' (attack swing), 'armor' (taking damage), 'offhand' (blocking),
// or 'all'. Armor wears slower — callers pass fractional amounts; we round to ≥1
// only when accumulated damage justifies it (amount is pre-scaled by caller).
export function wearEquipped(kind = 'weapon', amount = 1, toolWearMult = 1): boolean {
  const slots: string[] =
    kind === 'weapon' ? ['weapon']
    : kind === 'armor' ? ['helmet', 'chest', 'gloves', 'boots']
    : kind === 'offhand' ? ['offhand']
    : kind === 'all' ? ['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots']
    : [];
  let brokeSomething = false;
  for (const slot of slots) {
    const eq: EquipmentInstance | null | undefined = st().player.equipment[slot];
    if (!eq || typeof eq.dur !== 'number') continue;
    eq.dur = Math.max(0, eq.dur - Math.max(1, Math.round(amount * toolWearMult)));
    if (eq.dur === 0) {
      brokeSomething = true;
      const def: ItemDef | null = getItem(eq.id);
      st().player.equipment[slot] = null;
      GameState.toast({ title: `${def?.name || 'Gear'} broke!`, msg: 'It finally gave out. Craft or buy another.', kind: 'warn' });
    }
  }
  GameState.notify(CH.EQUIPMENT);
  return brokeSomething;
}

export function repairAll(factor = 0.5, perfect = false): number {
  const S: GameRootState = st();
  let repaired = 0;
  const fixEntry = (obj: InventoryEntry | EquipmentInstance | null | undefined): void => {
    if (obj && typeof obj.dur === 'number') {
      const max: number = getItem(obj.id)?.durability ?? obj.dur;
      obj.dur = perfect ? max : Math.min(max, Math.ceil(obj.dur + max * factor));
      repaired++;
    }
  };
  for (const e of S.inventory) fixEntry(e);
  for (const slot of Object.keys(S.player.equipment)) fixEntry(S.player.equipment[slot]);
  if (repaired) GameState.notify(CH.INVENTORY, CH.EQUIPMENT);
  return repaired;
}

/* ── Consumption ───────────────────────────────────────────────────────── */
export function useConsumable(id: string, healPowerMult = 1): ItemUseEffect | null {
  const def: ItemDef | null = getItem(id);
  if (!def?.use) return null;
  const u: ItemUseEffect = { ...def.use };
  if (u.hp) u.hp = Math.max(1, Math.round(u.hp * healPowerMult));
  removeItem(id, 1);
  GameState.notify(CH.PLAYER);
  return u;
}

/* ── UI helpers ────────────────────────────────────────────────────────── */
export function sortedInventory(sortMode = 'rarity', filterCat: string | null = null, query = ''): InventoryEntry[] {
  let list: InventoryEntry[] = [...st().inventory];
  if (filterCat && filterCat !== 'all') list = list.filter((e) => (getItem(e.id)?.cat || 'resource') === filterCat);
  if (query) list = list.filter((e) => (getItem(e.id)?.name ?? '').toLowerCase().includes(query.toLowerCase()));
  const ordOf = (id: string): number => RARITY[getItem(id)?.rarity || 'common']?.order ?? 0;
  if (sortMode === 'rarity') list.sort((a, b) => ordOf(b.id) - ordOf(a.id) || (getItem(b.id)?.value ?? 0) - (getItem(a.id)?.value ?? 0));
  else if (sortMode === 'name') list.sort((a, b) => (getItem(a.id)?.name ?? '').localeCompare(getItem(b.id)?.name ?? ''));
  else if (sortMode === 'type') list.sort((a, b) => String(getItem(a.id)?.cat).localeCompare(String(getItem(b.id)?.cat)));
  else list.sort((a, b) => (getItem(b.id)?.value ?? 0) * b.qty - (getItem(a.id)?.value ?? 0) * a.qty);
  return list;
}
