// Crafting recipes — survival, cooking, tools.
export const RECIPES_A = [
  { id: 'torch', out: 'torch', qty: 2, cat: 'survival', cost: { wood: 1, fiber: 2 } },
  { id: 'bandage', out: 'bandage', qty: 1, cat: 'survival', cost: { fiber: 4, herbs: 2 } },
  { id: 'waterskin', out: 'waterskin', qty: 2, cat: 'survival', cost: { leather_hide: 1, fiber: 3 } },

  { id: 'cooked_meat', out: 'cooked_meat', qty: 1, cat: 'cooking', station: 'campfire', cost: { raw_meat: 1, wood: 1 } },
  { id: 'cooked_fish', out: 'cooked_fish', qty: 1, cat: 'cooking', station: 'campfire', cost: { raw_fish: 1, wood: 1 } },
  { id: 'herb_tea', out: 'herb_tea', qty: 1, cat: 'cooking', station: 'campfire', cost: { herbs: 3 } },
  { id: 'bread', out: 'bread', qty: 2, cat: 'cooking', station: 'kitchen', cost: { wheat: 3 } },
  { id: 'hearty_stew', out: 'hearty_stew', qty: 1, cat: 'cooking', station: 'kitchen', cost: { raw_meat: 2, mushrooms: 2, herbs: 1 } },

  { id: 'axe_stone', out: 'axe_stone', qty: 1, cat: 'tools', cost: { wood: 2, stone: 3, fiber: 2 } },
  { id: 'pick_stone', out: 'pick_stone', qty: 1, cat: 'tools', cost: { wood: 2, stone: 4, fiber: 2 } },
  { id: 'knife_hunter', out: 'knife_hunter', qty: 1, cat: 'tools', cost: { wood: 1, bone: 2, flint: 1 } },
  { id: 'fishing_rod', out: 'fishing_rod', qty: 1, cat: 'tools', cost: { wood: 3, fiber: 4 } },
  { id: 'hammer', out: 'hammer', qty: 1, cat: 'tools', cost: { wood: 3, stone: 4, iron_ore: 2 } },
  { id: 'axe_iron', out: 'axe_iron', qty: 1, cat: 'tools', station: 'forge', cost: { wood: 3, iron_ingot: 3 } },
  { id: 'pick_iron', out: 'pick_iron', qty: 1, cat: 'tools', station: 'forge', cost: { wood: 3, iron_ingot: 3 } }
];
