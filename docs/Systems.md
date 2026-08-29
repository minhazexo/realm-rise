# Game Systems — Complete Reference

All 18 systems, their responsibilities, entry points, and inter-dependencies.

---

## 1. ProgressionSystem (`src/game/systems/ProgressionSystem.js`)
**Role:** Central stat computation, XP awards, profession leveling.

- `recompute()` — rebuilds `player.derived` from alloc stats + equipment mods + skill effects
- `awardXP(amount, source)` — grants XP, triggers level-up, notifies `CH.PLAYER`
- `profXP(profession, amount)` — profession XP with cap at level 50
- `addReputation(amount)` — faction-agnostic reputation
- `skillFx()` — aggregates all active skill passive bonuses

**Depends on:** `InventorySystem`, `items.js`, `skills.js`, `Constants.js`

---

## 2. InventorySystem (`src/game/systems/InventorySystem.js`)
**Role:** Item add/remove/spend, equipment equip/unequip, durability wear, storage.

- `addItem(id, qty, opts)` — stack or add new entry, respects slot cap
- `spendItems(costMap)` / `hasItems(costMap)` — bulk check + spend
- `equip(ref)` / `unequip(slot)` — move items ↔ equipment slots (creates `{id, ref, dur}` objects)
- `wearEquipped(kind, amount)` — durability decrement, auto-unequip on break
- `repairAll(factor)` — bulk repair
- `inventoryForUI(filter, query, sort)` — filtered/sorted list for React panels

**Equipment format:** `{ id: string, ref: string, dur: number|null }` — NOT a plain string.

---

## 3. CraftingSystem (`src/game/systems/CraftingSystem.js`)
**Role:** Recipe validation, station proximity, craft execution.

- `blockReason(recipe)` — returns null if craftable, else human reason
- `craft(recipeId)` — spend cost, add item, award XP, emit sound
- `recipesForUI(category)` — enriched recipe list for React panels
- `craftDurationSec(recipe)` — base time * derived craft speed

**Station types:** campfire, forge, kitchen, tannery, workshop

---

## 4. QuestEngine (`src/game/systems/QuestEngine.js`)
**Role:** Quest state machine, step progress tracking, completion.

- `handleEvent(event)` — dispatches gather/kill/discover/talk/built/territory events
- `stepProgress(qid, step)` — returns current count for a quest step
- `currentMainQuest()` — returns active main quest def
- `completeQuest(qid)` — mark done, award rewards, advance chain

---

## 5. QuestSystem (`src/game/systems/QuestSystem.js`)
**Role:** UI snapshots, side-quest offers, choices.

- `questStateSnapshot()` — `{title, steps[{text,have,need,done}], side[]}` for HUD tracker
- `offerSideQuest(id)` — activate a side quest
- `applyChoice(choiceId, optionIdx)` — branching narrative decisions

---

## 6. StorySystem (`src/game/systems/StorySystem.js`)
**Role:** Chapter progression, event triggers, story flags.

- Chapter gates control narrative pacing
- Flags stored in `state.story.flags` for conditional content

---

## 7. EnvSystem (`src/game/systems/EnvSystem.js`)
**Role:** Day/night cycle, weather, time-of-day effects.

- Day cycle: 520 seconds per full cycle
- Weather changes every 150-340 seconds
- Night enemies get damage buff
- Cold exposure near frozen/volcanic biomes
- Drains hunger/thirst per frame

---

## 8. KingdomSystem (`src/game/systems/KingdomSystem.js`)
**Role:** Settlement building, citizen recruitment, stage advancement.

- `refresh()` — recalculate defense, happiness, military power
- `recruitCitizen(data)` — add citizen to settlement
- `claimRadius(pos)` — determine territory bounds
- Stage progression: Camp → Homestead → Village → Town → City → Kingdom → Empire

---

## 9. KingdomEconomy (`src/game/systems/KingdomEconomy.js`)
**Role:** Per-tick resource production from buildings.

- `productionTick(playerPos)` — runs every 4 seconds
- Farms produce food, woodcutters produce wood, mines produce ore
- Citizen jobs affect production rates

---

## 10. EconomySystem (`src/game/systems/EconomySystem.js`)
**Role:** Gold flow, trade pricing, NPC shops.

- Buy/sell spreads configured in Constants
- Merchant NPCs buy/sell at different rates
- Tax collection from citizens

---

## 11. FactionSystem (`src/game/systems/FactionSystem.js`)
**Role:** 5-faction reputation, diplomacy states.

- Factions: Iron (military), Verdant (nature), League (trade), Ashen (dark), Ancient (mystic)
- States: war → hostile → neutral → cordial → allied
- Gift, quest, and trade actions modify reputation

---

## 12. SaveSystem (`src/game/systems/SaveSystem.js`)
**Role:** Save/load to localStorage, autosave, recovery.

- 3 manual slots + 1 autosave
- Shadow backup for crash recovery
- JSON serialization with version check

---

## 13. AchievementSystem (`src/game/systems/AchievementSystem.js`)
**Role:** Achievement evaluation and tracking.

- `evaluateAll()` — check all achievement conditions
- Stored in `state.achievements` as `{id: timestamp}`
- Triggers toast on unlock

---

## 14. LegacyStore (`src/game/systems/LegacyStore.js`)
**Role:** Cross-run persistent bonuses (New Game+).

- Survives save wipe
- Bonus stats/items for subsequent playthroughs

---

## 15. AudioSystem (`src/game/systems/AudioSystem.js`)
**Role:** Procedural music, SFX, ambient audio.

- All audio generated via Web Audio API oscillators
- Mood-based music system (menu, explore, combat, boss)
- Resumes AudioContext on first user gesture

---

## 16. BridgeSystem (`src/game/core/BridgeSystem.js`)
**Role:** Wiring between Phaser events and React re-renders.

- Listens to Phaser-side events, emits Bus channels
- Ensures React updates when game state changes

---

## 17. EventBus (`src/game/core/EventBus.js`)
**Role:** Publish/subscribe channel system.

- `Bus.on(channel, callback)` — subscribe, returns unsubscribe fn
- `Bus.emit(channel, data)` — notify all subscribers
- Channels defined in `CH` enum (SCREEN, PLAYER, INVENTORY, etc.)

---

## 18. GameState (`src/game/core/GameState.js`)
**Role:** Single source of truth. Holds `state` (persistent) and `session` (runtime).

- `GameState.s` — persistent game data (player, inventory, world, quests, etc.)
- `GameState.session` — UI state (screen, panel, dialogue, etc.)
- `GameState.notify(...channels)` — emit updates to React
- `GameState.toast({title, msg, kind})` — display notifications
