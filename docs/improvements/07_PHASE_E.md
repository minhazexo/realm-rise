# Phase E — Video, Key Rebinding, NG+, Economy, Death Fix

## E5 — Death respawn rebuilt (was soft-locking)
`DeathOverlay` hand-rolled respawn: left the sprite invisible, body disabled,
`session_dead` set (frozen forever), enemies in place for instant re-kill, and
"Return to Menu" re-entered the world. Now: canonical `Player.respawn()` +
2s i-frames + `WorldScene.resetNearbyEnemies(700)` (teleport + `Enemy.evade()`
leash-reset; bosses exempt) + surrender goes to menu via `setScreen('menu')`.

## E1 — Video settings
- `fpsCap` (Auto/30/60/120, persisted): applied to `game.loop.targetFps` at
boot and live via `settings-applied` (`applyFpsCap` in `main.js`).
- Fullscreen toggle button (imperative, unpersisted — fullscreen is a state).

## E2 — Key rebinding (Controls section said "coming soon")
- `settings.keybinds` (14 actions, persisted in save + normalised/validated).
- WASD + arrows always move; binds add alternatives (`bindKeys` in scene ctx,
consumed by `Player.js` movement + sprint).
- Actions (`registerActionBinds`) tear down + re-register on `settings-applied`;
unknown codes fall back to defaults — a bad bind can never lock you out.
- Capture UI: click → press key (`eventToCodeName`: letters, digits,
arrows, space, modifiers, punctuation) + Reset keys.

## E3 — NG+ heirloom boons (`LegacyStore.js`)
- `LEGACY_BOONS` (Survivor/Conqueror/Diplomat/Sage/Sovereign) unlocked by
achievements/endings; `availableBoons()` + `applyBoon(st, id)` (validated,
fresh-state only, never crashes `newGame`).
- `CharacterCreation` shows the picker when anything is unlocked; `GameState.newGame`
applies synchronously (static import — leaf module, no cycle).

## E4 — Economy balance
- `TRADE_SPREAD.sellMult` 0.38 → 0.45: old ~2.6:1 spread punished selling vs
bandit drops/taxes; 0.45 keeps trade viable without beating loot. Further
tuning needs playtest telemetry — flagged, not guessed.

## Quality sweep (TODOs)
- Removed dead `kingdomPct()` method (module fn is the used one).
- `GATHER_CONFIG_TICK_XP` module const → `GATHER_CONFIG.tickXp` single source.
- (Phase C already removed unused `nodeHasTicks`.)

## Acceptance
- `npm test` green (incl. settings round-trips for `fpsCap`/`keybinds`),
`vite build` clean (118 modules).
- Die → Rise Again: visible, mobile, breathing room, overlay gone.
- Rebind gather to F → E does nothing, F gathers; reset restores.
- Finish an ending → new game offers that ending's heirloom.
