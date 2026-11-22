// Crafting recipes — advanced tools/weapons/armor/process/specials.
import type { RecipeDef } from './recipesA.ts';

export const RECIPES_B: RecipeDef[] = [
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
    cost: { crystal: 4, ancient_relic: 2, moonstone: 1 } },

  // ── ARPG weapon lines (every weapon in data/weaponsArpg.ts has a path here) ──
  // The dagger/dual/staff/legendary lines shipped as data with no acquisition
  // at all — they looked craftable and were not. Each recipe below is the one
  // way to get its weapon, and its flag ties the weapon to the story beat that
  // makes it plausible.
  { id: 'bone_dagger', out: 'bone_dagger', qty: 1, cat: 'weapons', cost: { bone: 3, flint: 2, fiber: 2 } },
  { id: 'twin_cutlasses', out: 'twin_cutlasses', qty: 1, cat: 'weapons', station: 'forge', cost: { iron_ingot: 3, hardwood: 2 } },
  { id: 'apprentice_staff', out: 'apprentice_staff', qty: 1, cat: 'weapons', station: 'workshop', cost: { hardwood: 4, crystal: 1, fiber: 6 } },
  { id: 'shadow_fang', out: 'shadow_fang', qty: 1, cat: 'weapons', station: 'workshop', flag: 'shard_hollow_taken',
    cost: { void_ember: 3, steel_ingot: 3, leather_hide: 2 }, desc: 'Void Ember folded into steel. It remembers the Hollow.' },
  { id: 'embersong_twins', out: 'embersong_twins', qty: 1, cat: 'weapons', station: 'forge', flag: 'shard_ash_taken',
    cost: { ash_ember: 4, steel_ingot: 4 }, desc: 'Pyre-ash quenched blades. The heat never quite leaves them.' },
  { id: 'stormshard_staff', out: 'stormshard_staff', qty: 1, cat: 'weapons', station: 'workshop', flag: 'shard_watch_taken',
    cost: { crystal: 3, steel_ingot: 4, silver: 2 }, desc: 'A garrison storm-lens cased in steel.' },
  { id: 'voidfang', out: 'voidfang', qty: 1, cat: 'special', station: 'workshop', flag: 'ancient_studies',
    cost: { void_ember: 4, ancient_relic: 3, steel_ingot: 6 }, desc: 'A dagger that eats the light of the thing it cuts.' },
  { id: 'stormpiercer', out: 'stormpiercer', qty: 1, cat: 'special', station: 'workshop', flag: 'ancient_studies',
    cost: { crystal: 5, silver: 3, steel_ingot: 5 }, desc: 'A spear built to carry a storm down its length.' },
  { id: 'gravekeeper', out: 'gravekeeper', qty: 1, cat: 'special', station: 'workshop', flag: 'warden_slain',
    cost: { ash_ember: 6, ancient_core: 1, steel_ingot: 6 }, desc: 'Consecrated in the Warden’s own pyre.' },
  { id: 'royal_armor', out: 'royal_armor', qty: 1, cat: 'armor', station: 'workshop', flag: 'policy_banner',
    cost: { steel_ingot: 12, gold_nugget: 6 }, desc: 'Warplate for the ruler your banner promised.' },
  { id: 'crown_realm', out: 'crown_realm', qty: 1, cat: 'armor', station: 'workshop', flag: 'barrier_restored',
    cost: { royal_artifact: 1, gold_nugget: 8, ancient_core: 1 }, desc: 'The realm’s crown, reforged to be worn rather than kept in a box.' },
  { id: 'merchant_signet', out: 'merchant_signet', qty: 1, cat: 'special', station: 'workshop', flag: 'policy_pragmatism',
    cost: { gold_nugget: 4, silver: 4 }, desc: 'League paper in ring form. Every purse opens a little wider.' }
];

export const RECIPE_CATS = ['survival', 'cooking', 'tools', 'weapons', 'armor', 'process', 'special'];
