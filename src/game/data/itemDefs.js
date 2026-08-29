// Shared item definition kernel: rarity metadata + registration helper used by
// every item category module. (spec §80 — data separated from logic)

export const RARITY = Object.freeze({
  common: { label: 'Common', color: '#c9c4b4', order: 0 },
  uncommon: { label: 'Uncommon', color: '#6fbf73', order: 1 },
  rare: { label: 'Rare', color: '#5aa2e8', order: 2 },
  epic: { label: 'Epic', color: '#b071e0', order: 3 },
  legendary: { label: 'Legendary', color: '#e8a13a', order: 4 },
  mythic: { label: 'Mythic', color: '#e85a7a', order: 5 }
});

export const ITEM_CATS = ['resource', 'tool', 'weapon', 'offhand', 'armor', 'trinket', 'consumable', 'special'];

const REGISTRY = {};

/**
 * Register an item. Common fields auto-filled.
 * `icon` = hint consumed by the procedural ArtFactory: { shape, c1, c2 }.
 */
export function def(id, o) {
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

/** Create a new inventory entry. Gear gets unique ids + durability. */
let iidCounter = 1;
export const newInstance = (id) => {
  const base = REGISTRY[id];
  if (!base) return null;
  const instanced = !!(base.durability || base.weapon || base.slot);
  if (!instanced) return { id, qty: 1 };
  return { iid: `i${iidCounter++}`, id, qty: 1, dur: base.durability, maxDur: base.durability };
};
export const resetInstanceIdCounter = () => {
  iidCounter = 1;
};

export function finalizeItems() {
  for (const id of Object.keys(REGISTRY)) {
    if (!REGISTRY[id].icon) console.warn('[items] missing icon hint:', id);
  }
  return Object.freeze({ ...REGISTRY });
}
