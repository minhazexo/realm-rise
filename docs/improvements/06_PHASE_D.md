# Phase D — Missing Panels, Fog Cards, Tutorial, Raids, Saves, Popups

## D0 — Crash fix: six referenced-but-undefined panels
`Panels.jsx` rendered `<MapPanel/> <JournalPanel/> <CharacterPanel/> <TradePanel/> <PausePanel/> <SavePanel/>` that were never defined (file ended at `// ==PANELS_D==`) — opening any of them (M/J/B menus, pause, trade, save) threw. All six now implemented in `Panels.jsx`:
- **Map:** discovered POIs + coords, camps held, territory %, home coords, faction standings, biome legend.
- **Journal:** `questStateSnapshot()` main quest + steps (have/need/done) + side quests.
- **Character:** level, hp/stamina, gold, renown, melee/resist, attributes, professions.
- **Trade:** `merchantStock()` buy (gold-validated) + resource/consumable sell at `sellPrice()` with live biome context.
- **Pause:** resume, all panel shortcuts, quick save, quit-to-menu.
- **Save:** per-slot save/load/delete + JSON export (download) + import into Slot 1 (`exportSlot`/`importSlotData` in `SaveSystem.js`, shape-validated).
- Also fixed latent `I.findEntry` crash in inventory equip (was Phase C-adjacent, folded in).

## D1 — Atmosphere & minimap
- `FogCards.js`: 10 world-space drifting fog banks around the player (weather/biome/night density, wind vectors, particle-setting aware, `pt_smoke` tinted per mood).
- Minimap zoom (`−`/`+`, 0.5/1/2/4× via `session.minimapZoom`) + biome legend in the Map panel (TODO minimap legend ✓).

## D2 — Tutorial (`TutorialSystem.js`)
One-shot hint chain in `story.flags`: move/gather keys → stone axe → chop/mine → cook meat → arm up → found settlement. Evaluated every 5s, one toast max per tick, never modal.

## D3 — Faction raids + building damage (`RaidSystem.js`)
- `war`/`hostile` standings now produce announced raid parties (2–6 scaled by stage, war bonus) at the settlement edge every 5–9 min after 20 min of play.
- Raiders (`raider=true`) besiege: march on buildings while the player is >260px away, 1.6s swing for 70% atk; player proximity hands them back to normal AI.
- Buildings take real HP damage (TODO #4 ✓) with floaters + thud; at 0 HP `destroyBuilding()` removes sprite/state, toasts, refreshes stations/kingdom; Town Hall fall un-founds the settlement.
- D4 included: chunk spawns skip a 700px settlement safe zone (raids bypass explicitly).

## D5 — Rewards & sharing
- Save export/import (see D0 Save panel).
- Achievement center-screen popup (`AchievementPopup` in `Overlays.jsx`, mounted in `App.jsx`, 5s auto-dismiss) alongside the existing toast.
- **Boss bar actually works now:** `bossUI.show/setPhase/hide` publishes `session.activeBoss` + `refreshBossBar()` HP tick with leash-hide; `<BossBar/>` was imported in `App.jsx` but never rendered — mounted.

## Acceptance
- `npm test` green, `vite build` clean (118 modules).
- Press M/J/B/C/I/K/P, ESC, trade, save — no crashes, all panels functional.
- Declare war via diplomacy → raid party + danger toast within minutes; ignore it → buildings chip and fall.
- New save: 6 tutorial toasts across the first 10 minutes, each once.
