// Crafting recipes — advanced tools/weapons/armor/process/specials.
export const RECIPES_B = [
  { id: 'axe_steel', out: 'axe_steel', qty: 1, cat: 'tools', station: 'workshop', cost: { wood: 3, steel_ingot: 3 } },
  { id: 'pick_steel', out: 'pick_steel', qty: 1, cat: 'tools', station: 'workshop', cost: { wood: 3, steel_ingot: 3 } },

  { id: 'wooden_sword', out: 'wooden_sword', qty: 1, cat: 'weapons', cost: { wood: 5, flint: 1, fiber: 3 } },
  { id: 'stone_spear', out: 'stone_spear', qty: 1, cat: 'weapons', cost: { wood: 6, flint: 3, fiber: 4 } },
  { id: 'short_bow', out: 'short_bow', qty: 1, cat: 'weapons', cost: { wood: 6, fiber: 6, feathers: 4 } },
  { id: 'arrows', out: 'arrows', qty: 10, cat: 'weapons', cost: { wood: 2, flint: 1, feathers: 2 } },
  { id: 'wooden_shield', out: 'wooden_shield', qty: 1, cat: 'weapons', cost: { wood: 8, iron_ore: 2, fiber: 4 } },
  { id: 'iron_sword', out: 'iron_sword', qty: 1, cat: 'weapons', station: 'forge', cost: { iron_ingot: 4, hardwood: 2, leather_hide: 1 } },
  { id: 'steel_sword', out: 'steel_sword', qty: 1, cat: 'weapons', station: 'workshop', cost: { steel_ingot: 6, hardwood: 3, leather_hide: 2 } },
  { id: 'iron_shield', out: 'iron_shield', qty: 1, cat: 'weapons', station: 'forge', cost: { iron_ingot: 6, hardwood: 3, leather_hide: 2 } },
  { id: 'battle_axe', out: 'battle_axe', qty: 1, cat: 'weapons', station: 'forge', cost: { iron_ingot: 3, hardwood: 3 } },
  { id: 'iron_spear', out: 'iron_spear', qty: 1, cat: 'weapons', station: 'forge', cost: { iron_ingot: 3, hardwood: 2 } },
  { id: 'longbow', out: 'longbow', qty: 1, cat: 'weapons', cost: { hardwood: 4, fiber: 8, feathers: 10 } },
  { id: 'crossbow', out: 'crossbow', qty: 1, cat: 'weapons', station: 'workshop', cost: { steel_ingot: 2, hardwood: 4, feathers: 5 } },
  { id: 'greatsword', out: 'greatsword', qty: 1, cat: 'weapons', station: 'workshop', cost: { steel_ingot: 6, hardwood: 4 } },
  { id: 'dawnbreaker', out: 'dawnbreaker', qty: 1, cat: 'special', station: 'workshop', flag: 'ancient_forge_lit',
    cost: { ancient_core: 1, dragon_scale: 2, moonstone: 2, steel_ingot: 12 }, desc: 'Reforged from an Ancient Core in a ceremony of fire.' },

  { id: 'leather_vest', out: 'leather_vest', qty: 1, cat: 'armor', station: 'tannery', cost: { leather_hide: 5, fiber: 6 } },
  { id: 'hunter_leather', out: 'hunter_leather', qty: 1, cat: 'armor', station: 'tannery', cost: { leather_hide: 8, fur_pelt: 2 } },
  { id: 'fur_coat', out: 'fur_coat', qty: 1, cat: 'armor', station: 'tannery', cost: { fur_pelt: 6, leather_hide: 2 } },
  { id: 'gloves_leather', out: 'gloves_leather', qty: 1, cat: 'armor', station: 'tannery', cost: { leather_hide: 2, fiber: 3 } },
  { id: 'boots_ranger', out: 'boots_ranger', qty: 1, cat: 'armor', station: 'tannery', cost: { leather_hide: 3, fiber: 4 } },
  { id: 'helm_leather', out: 'helm_leather', qty: 1, cat: 'armor', station: 'tannery', cost: { leather_hide: 3 } },
  { id: 'iron_plate', out: 'iron_plate', qty: 1, cat: 'armor', station: 'forge', cost: { iron_ingot: 10, coal: 4 } },
  { id: 'helm_iron', out: 'helm_iron', qty: 1, cat: 'armor', station: 'forge', cost: { iron_ingot: 5, coal: 2 } },
  { id: 'gloves_iron', out: 'gloves_iron', qty: 1, cat: 'armor', station: 'forge', cost: { iron_ingot: 4, leather_hide: 1 } },
  { id: 'boots_steel', out: 'boots_steel', qty: 1, cat: 'armor', station: 'forge', cost: { steel_ingot: 4, leather_hide: 2 } },
  { id: 'steel_plate', out: 'steel_plate', qty: 1, cat: 'armor', station: 'workshop', cost: { steel_ingot: 10, coal: 6 } },
  { id: 'helm_steel', out: 'helm_steel', qty: 1, cat: 'armor', station: 'workshop', cost: { steel_ingot: 7, leather_hide: 2 } },
  { id: 'tower_shield', out: 'tower_shield', qty: 1, cat: 'armor', station: 'workshop', cost: { steel_ingot: 5, hardwood: 6 } },

  { id: 'iron_ingot', out: 'iron_ingot', qty: 1, cat: 'process', station: 'forge', cost: { iron_ore: 2, coal: 1 } },
  { id: 'steel_ingot', out: 'steel_ingot', qty: 1, cat: 'process', station: 'forge', cost: { iron_ingot: 2, coal: 3 } },
  { id: 'iron_ingot_x5', out: 'iron_ingot', qty: 5, cat: 'process', station: 'forge', cost: { iron_ore: 10, coal: 5 } },
  { id: 'steel_ingot_x5', out: 'steel_ingot', qty: 5, cat: 'process', station: 'forge', cost: { iron_ingot: 10, coal: 15 } },

  { id: 'ancient_sigil', out: 'ancient_sigil', qty: 1, cat: 'special', station: 'workshop', flag: 'ancient_studies',
    cost: { crystal: 4, ancient_relic: 2, moonstone: 1 } }
];

export const RECIPE_CATS = ['survival', 'cooking', 'tools', 'weapons', 'armor', 'process', 'special'];
