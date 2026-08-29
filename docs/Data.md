# Data Reference

All game data tables and their sources.

---

## Items (92 total)

### Resources (`itemsResources.js`)
Wood, stone, fiber, leather_hide, flint, herbs, mushrooms, berries, clay, raw_meat, raw_fish, wheat, feathers, bone, iron_ore, coal, silver, gold_nugget, steel_ingot, crystal, moonstone, ancient_core, ancient_relic, tar

### Gear (`itemsGear.js`)
**Axes:** axe_stone (tier 1), axe_iron (tier 2), axe_steel (tier 3)
**Pickaxes:** pick_stone, pick_iron, pick_steel
**Weapons:** wooden_sword, iron_sword, steel_sword, dawnbreaker (legendary)
**Ranged:** hunting_bow, longbow, arrows
**Tools:** hammer, fishing_rod, knife_hunter, torch

### Armor (`itemsArmor.js`)
**Helmets:** cap_cloth, cap_leather, helm_iron, helm_steel
**Chest:** traveler_garb, tunic_leather, armor_iron, armor_steel, robe_mage
**Boots:** boots_worn, boots_leather, boots_iron, boots_steel
**Gloves:** gloves_cloth, gloves_leather, gloves_iron
**Shields:** wooden_shield, iron_shield, tower_shield
**Rings/Amulets:** ring_ruby, ring_sapphire, amulet_ancient

### Consumables
berries, waterskin, bread, cooked_meat, cooked_fish, herb_tea, hearty_stew, bandage, healing_salve, founders_kit

### Special
treasure_map, repair_kit, quest_items (various), chest_tiers (wooden_chest, iron_chest, royal_chest, ancient_chest)

---

## Recipes (45 total)

### Survival (recipesA.js)
| Recipe | Output | Cost | Station |
|--------|--------|------|---------|
| torch | ×2 | wood:1, fiber:2 | — |
| bandage | ×1 | fiber:4, herbs:2 | — |
| waterskin | ×2 | leather_hide:1, fiber:3 | — |

### Cooking (recipesA.js)
| Recipe | Output | Cost | Station |
|--------|--------|------|---------|
| cooked_meat | ×1 | raw_meat:1, wood:1 | campfire |
| cooked_fish | ×1 | raw_fish:1, wood:1 | campfire |
| herb_tea | ×1 | herbs:3 | campfire |
| bread | ×2 | wheat:3 | kitchen |
| hearty_stew | ×1 | raw_meat:2, mushrooms:2, herbs:1 | kitchen |

### Tools (recipesA.js, recipesB.js)
| Recipe | Output | Cost | Station |
|--------|--------|------|---------|
| axe_stone | ×1 | wood:2, stone:3, fiber:2 | — |
| pick_stone | ×1 | wood:2, stone:4, fiber:2 | — |
| knife_hunter | ×1 | wood:1, bone:2, flint:1 | — |
| fishing_rod | ×1 | wood:3, fiber:4 | — |
| hammer | ×1 | wood:3, stone:4, iron_ore:2 | — |
| axe_iron | ×1 | wood:3, iron_ingot:3 | forge |
| pick_iron | ×1 | wood:3, iron_ingot:3 | forge |
| axe_steel | ×1 | wood:3, steel_ingot:3 | workshop |

### Armor & Weapons (recipesB.js)
Iron armor set, steel armor set, bows, swords, shields, mage robe

---

## Enemies (15 types)

### Wild (`enemiesWild.js`)
| Key | Name | HP | Damage | Biome |
|-----|------|----|--------|-------|
| wolf | Gray Wolf | 35 | 8 | forest, plains |
| alpha_wolf | Alpha Wolf (Boss) | 280 | 18 | wolf_den POI |
| boar | Wild Boar | 45 | 10 | forest, plains |
| bear | Brown Bear | 70 | 14 | forest, mountains |
| dire_wolf | Dire Wolf | 55 | 12 | frozen, mountains |

### Humanoid (`enemiesHuman.js`)
| Key | Name | HP | Damage | Biome |
|-----|------|----|--------|-------|
| goblin | Goblin Scout | 25 | 6 | swamp, desert |
| skeleton | Skeleton Warrior | 40 | 10 | ruins |
| bandit_scout | Bandit Scout | 30 | 8 | plains, forest |
| bandit_swordsman | Bandit Swordsman | 55 | 13 | bandit_camp |
| bandit_archer | Bandit Archer | 35 | 11 | bandit_camp |
| bandit_brute | Bandit Brute | 80 | 16 | bandit_camp |
| bandit_captain | Bandit Captain | 120 | 20 | bandit_camp (boss) |
| bandit_king | Bandit King (Boss) | 400 | 24 | bandit_king_camp POI |
| ancient_guardian | Ancient Guardian (Boss) | 550 | 28 | great_ruins POI |

---

## NPCs (7)

| Key | Name | Role | Location |
|-----|------|------|----------|
| elara | Elara | Hunter/Guide | Hunter's Rest |
| tam | Tam | Worker/Companion | Scattered Wreckage |
| torvald | Torvald | Merchant | Wandering |
| priest | Brother Aldric | Healer | Shrine |
| blacksmith | Hilda | Blacksmith | Forge required |
| elder | Elder Rowan | Quest giver | Settlement |
| bard | Lira | Lore/Lore | Campfire |

---

## Main Quests (8 chapters)

1. **Survive the Storm** — Gather berries, craft torch, survive first night
2. **First Blood** — Kill wolves, craft weapon
3. **A Place to Call Home** — Build Town Hall, found settlement
4. **Iron & Fire** — Mine ore, build forge, craft iron gear
5. **Bandit War** — Clear bandit camps, free captives
6. **The Ancient Ruins** — Explore ruins, face Ancient Guardian
7. **Faction Diplomacy** — Align with factions, build reputation
8. **The Coronation** — Endgame choice: conqueror/diplomat/sage

---

## Buildings (23 types)

| Category | Buildings |
|----------|-----------|
| Core | townhall (5 tiers), campfire |
| Housing | tent, hut |
| Production | farm (4 stages), woodcutter_lodge, mine_entrance |
| Crafting | forge, kitchen, tannery, workshop |
| Storage | storage_chest |
| Military | watchtower (2 tiers), barracks, archery_range, stable, fortress |
| Walls | wall_seg, gate_seg |
| Economy | market_stalls |
| Faith/Knowledge | temple_shrine, library |

---

## Skill Tree (30 skills, 6 branches)

### Combat Branch
- Mighty Blow, Shield Mastery, Cleave, Steel Skin, Berserker, Parry, Execute, Iron Will, Second Wind, Warlord

### Survival Branch
- Keen Harvesting, Forager, Herbal Lore, Path Finder, Endurance, Winter Born, Fire Keeper, Beast Tongue, Quick Hands, Scavenger

### Crafting Branch
- Efficient Crafter, Master Smith, Quality Weapons, Quality Armor, Metalworking, Woodworking, Cooking, Alchemy, Engineering, Artisan

### Exploration Branch
- Eagle Eye, Cartographer, Treasure Hunter, Swift Feet, Night Vision,渊Source Reader, Lore Master, Pathfinder, Explorer, Pathfinder

### Kingdom Branch
- Charismatic Leader, Builder, Tax Collector, Recruiter, Diplomat, Strategist, Commander, Governor, Visionary, Sovereign

### Ranged Branch
- Quick Draw, Precise Shot, Arrow Rain, Penetrating Shot, Hunter's Eye, Camouflage, Silent Step, Eagle Shot, Shadow Archer, Deadeye

---

## Biomes (8)

| Biome | Colors | Resources | Enemies |
|-------|--------|-----------|---------|
| Plains | Green-yellow | Grass, berries, fiber | Wolf, boar |
| Forest | Dark green | Oak trees, mushrooms, herbs | Wolf, bear, boar |
| Desert | Sandy | Cactus, flint, herbs | Goblin |
| Frozen | White-blue | Ice shards, dead trees | Dire wolf, skeleton |
| Swamp | Murky green | Reed, clay, mushroom | Goblin, skeleton |
| Mountains | Gray | Rock, iron, coal, silver | Bear, golem |
| Volcanic | Dark red | Gold, crystal, moonstone | Skeleton |
| Riverlands | Blue-green | Fish, clay, reed | — (safe) |
