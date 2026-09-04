# Craft System Upgrade

> Sources: `recipesA.js` (19), `recipesB.js` (26) → 45 total, `CraftingSystem.js`, `InventorySystem.js`, `itemsGear/Armor/Resources.js`.
> Research: crafting UX (station proximity, batch craft, meaningful tiers, repair loops).

## 1. Today — 45 recipes, 7 cats, 5 stations

- survival 3 (hand), cooking 5 (campfire/kitchen), tools 9 (hand/forge/workshop), weapons 12 (hand/forge/workshop + `ancient_forge_lit` dawnbreaker), armor 13 (tannery/forge/workshop), process 2, special 1.
- `blockReason()` → station-in-200px / flag / resources. `craft()` spends, `newInstance` per qty, +14 craft XP +6 generic. Duration 1.4s / 2.4s weapons / 8s dawnbreaker × `craftSpeedMult`.
- Gear = unique `{iid,dur}`; stackables merge to `stack` (arrows 400).

Holes:
- `steel_sword`, `iron_shield` have **item defs but no recipe** (dead loot-only). `nightfall_bow`, royal/legendary sets intentionally loot-only but UI never says so.
- Armor/shields never wear (only `weapon` slot in `wearEquipped`) → repair loop half-dead.
- `steel_plate` 14 ingots + 10 coal vs `iron_plate` 10+4 — grind spike, no batch `process` craft (1-by-1 clicking).
- No craft queue bar wiring in scene despite `craftDurationSec` existing; no favorites/search.

## 2. Upgrade plan

### Phase A — done in this patch
- [x] Added `steel_sword` (workshop: 6 steel + 3 hardwood + 2 leather) and `iron_shield` (forge: 6 iron + 3 hardwood + 2 leather) recipes — closes the two accidental gaps.
- [x] `wearEquipped` extended: `kind='armor'` wears helmet/chest/offhand; `Player.takeDamage` calls it on hit (÷6 rate so armor lasts).
- [x] `craft()` batch: `process` cat crafts ×5 when Shift held (UI passes `qtyMult`); ingot loop no longer click-hell.
- [x] Recipe UI enrichment: `lootOnly` flag for `nightfall_bow`/royal items with "Found in the wild" reason instead of silent absence.

### Phase B — implemented
- [x] Station radius ring: `WorldScene.showStationRadius(station)` via `GameState.session.showStationRing` — 200px ring, auto-fades 2.5s. Crafting UI can call it on recipe hover/select. `refreshStationsNear` now re-runs every 60 frames (follows the player, was build-time only).
- [x] Smart tooltips: `recipesForUI` adds `compare` (`dmgDelta/cdDelta/critDelta` vs equipped + equipped id).
- [x] Rebalance: `steel_plate` 14→10 ingots, 10→6 coal; `crossbow` feathers 8→5; added `iron_ingot_x5` / `steel_ingot_x5` batch recipes.
- [x] Salvage: `salvage(ref)` — gear → 50% recipe refund at a forge + 4 craft XP. Bad rolls now have purpose.
- Deferred: hold-to-craft queue with progress ring + cancel refunds (needs React panel work — `craftDurationSec` ready); tutorial next-craftable toast.

## 3. Acceptance
- `recipesForUI('all')` = 47 (45 + 2 new), zero item defs without either recipe or `lootOnly`.
- Wear full iron set, take 20 hits → durability drops, toast on break, repair kit restores.
- Craft 20 iron ingots in ≤5 clicks.
- `npm test` green (smoke asserts recipe outputs resolve to item defs).
