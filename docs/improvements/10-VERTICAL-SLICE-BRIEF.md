# 10 — Dark-Fantasy Vertical Slice: Brief & Completion Ledger

Date: 2026-09-22. This file IS the working plan for the vertical-slice pass:
it captures the follow-up brief, maps it onto the audited codebase, and is
updated with completion status + verification evidence as items land.

**Status: COMPLETE and live-verified** (probes below ran against the real
running game, not mocks).

## Prime directives (from the brief, honored throughout)

1. **Do not rebuild.** React + Phaser architecture, GameState, boot, UI layer,
   weapon/element systems, auto-attack, ambient, save/settings/content all
   audited and PRESERVED. New work extends seams.
2. **Vertical slice, not the whole RPG.** One polished loop:
   explore → fight → loot → equip → elite → boss → unique reward → next area.
3. **Do not overbuild.** No MMORPG systems. No features that don't serve the loop.
4. **Architecture stays layered.** Phaser = gameplay, React = menus/UI,
   `src/game/data` = content, systems = mechanics, GameState = authority.
5. **Combat feel over stat inflation.** Telegraphs, windup→impact→recovery.
6. **Verify by playing**, not just reading code.

## What already existed (audited — untouched)

- Combat core: hit-stop, shake, combos + finishers, parry, dodge i-frames,
  weapon trails, floaters, knockback, crit feedback
- 7-element system with weak/resist + statuses; enemy `weak`/`resist` data
- Weapon categories: sword, greatsword, bow, dagger, dualblades, staff +
  legendaries with specials
- Enemy state machines; deer prey; night-only spawns; water-gated spawning
- Four multi-phase bosses wired to POIs (Captain Vex, Grendelfang, Rhogar,
  Ancient Guardian) with a boss-bar UI
- Rarity loot, quest engine, story chapters, save 1.1.0, audio, ambient,
  aspect-correct night lighting

## What this pass added

### A. Elite enemies — COMPLETE ✅
- [x] `data/elites.ts`: 4 named variants, full EnemyDefs (data-baked stats,
      no runtime multipliers): **Bloodfang Alpha** (wolf → charger dash),
      **Grave Knight** (skeleton → brute AoE slam, fire/holy-weak,
      shadow-resistant), **The Executioner** (bandit → wider slam),
      **Void Stalker** (bog lurker → ranged void bolts, holy-weak)
- [x] Subtle elite aura (low-alpha additive ellipse, pulsing 0.09↔0.24) +
      nameplate text + wider hp bar — no particle spam
- [x] `SpawnDirector.spawnEnemy` promotion roll: ~3% × biome danger,
      +2.5% at night; never for bosses/prey
- [x] Better loot: guaranteed trophy (`bloodfang_fang`, `void_ember`) +
      steel/pelts; elite kills restore 14 stamina; death burst accent
- [x] Live probe: 60 night-spawned wolves → 1 Bloodfang Alpha promoted;
      aura + nameplate rendered; kill dropped **Bloodfang Fang** into
      inventory and awarded XP

### B. Boss encounter: THE WARDEN OF ASH — COMPLETE ✅
- [x] Def in `enemiesHuman.ts`: P1 teaches (combo_charge + ground_slam);
      P2 at 55% adds **fire_slam** (telegraphed: ash-red tint + ground ring
      for 650 ms, then 150 px AoE), fire bolts, ×1.2 enrage tempo
- [x] Fire identity: ice/holy-weak, fire-resistant; drops **ash_ember**
      (guaranteed) + steel; 320 gold, 450 XP
- [x] POI `warden_pyre` ("The Warden's Pyre", ruins, danger 4, royal chest)
      placed ≈1.8k NE of origin — spawns the boss on discovery
- [x] **Fixed a pre-existing phase-lock bug**: `findIndex(pct <= belowHp)`
      always matched phase 0's `belowHp: 1`, so **every boss in the game was
      stuck at Phase 1** (all four pre-existing bosses included). Now walks
      thresholds from the deepest phase. Verified live: 40% HP → Phase 2,
      atkSpd 126→151, fire_slam/throw_axe in rotation.
- [x] Live probe: discovery → boss bar ("THE WARDEN OF ASH — PHASE 1") →
      phase transition → death → boss-bar cleanup → ground drops picked up

### C. Slice wiring — COMPLETE ✅
- [x] Quest `sq_the_warden_of_ash` (giver Elara, lore intro): reach the
      pyre → slay the Warden → **Emberforged Blade** (legendary fire
      greatsword reusing the fire-wave special) + `warden_slain` unlock flag
- [x] Loot trail verified in inventory after play:
      `bloodfang_fang → fur_pelt → steel_ingot → ash_ember`

### D. Feel/feedback found during live play — COMPLETE ✅
- [x] Phase-lock fix above (the big one)
- [x] Elite deaths read as wins (burst + stamina reward); nameplate/aura
      follow the sprite and clean up on death *and* on daylight despawn

### E. Tests — COMPLETE ✅
- [x] New suite `tests/elites-boss.mjs` (10th suite, chained into `npm test`):
      74 assertions — elite registry integrity, base-vs-elite stat/loot
      comparisons, promotion-map round-trip, warden phase/move/threshold
      validation against the implemented move set, blade identity
      (fire greatsword, no stat inflation), quest step/reward wiring,
      POI placement (danger + deliberate distance from hub)

## Verification ledger

- [x] `tsc --noEmit` clean
- [x] `npm test`: all 10 suites green (29 autoattack + 138 weapons-elements
      + 74 elites-boss + 7 classic suites)
- [x] `npm run build` OK (1.7 s)
- [x] Live play probe (running game): elite aura/nameplate, promotion roll,
      elite kill loot; warden discovery → boss bar → phase 2 → death →
      drops → inventory; boss UI cleanup
- [x] No FPS regression observed during the night boss fight (mask + embers
      + combat all running together)

## Follow-up: title screen as first impression — COMPLETE ✅

- [x] **Living world, not a static menu**: the real `player_char` sheet walks
      the near ridge as a lone wanderer (walk/pause/gaze loop toward the
      ruined castle — the character you will play), two tinted background
      travellers cross the mid hills, four fog banks roll across the valley
- [x] **Foreground treeline**: 9 near-black silhouette oaks/pines framing
      the bottom edge, gently swaying (layered depth: hills → castle →
      wanderer → treeline → fog/UI)
- [x] Distant campfire glow in the ruins ("someone survived down there")
- [x] **Title plate treatment**: gold overline/underline flourishes
      (engraved-title look) + stronger cinematic edge vignette so UI text
      never fights the backdrop
- [x] Settings respected: embers/fog/tweens gate on `particleMultiplier()`
      and `reducedMotion()`; treeline sway and figures freeze under reduced
      motion
- [x] **Crash caught live and fixed**: `player_char` did not exist at menu
      time (WorldScene builds it) → MenuScene now builds the default sheet
      only when absent, never clobbering a save's customized appearance
- [x] Verified in the running game: all layers created, animation frame
      advancing, wanderer walk/pause loop proven by pumping `update()`
      (moved +34 px with gaze pauses; fog drift +24 px; hikers wrap)

## Known limits (deferred, per the no-overbuild rule)

- Boss phase-2 "environmental transformation" is a flash + tempo + move-pool
  change, not a palette/music shift (audio hooks exist for a later pass)
- Only the Warden quest is new; pre-existing bosses lack their own quest
  wrappers (their loot/achievements already reward them)
- Elite promotion is pure Math.random — fine for a slice; per-seed tables
  would make chunk content fully deterministic (tracked in docs/TODOs.md)
