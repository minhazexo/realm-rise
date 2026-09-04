# Phase C — Build Fix, Crafting UI, Gathering Juice, Safety, Night Light

## C0 — Production build fixed
- `src/styles.css` had a rule swallowed inside a comment block (`lightningcss: Invalid dangling combinator`), failing `vite build` since before Phase A. Comment re-closed; build now succeeds (111 modules).

## C1 — Craft queue UI + salvage + station preview (`Panels.jsx`, `styles.css`)
- Slow crafts (durSec ≥ 2s: weapons, dawnbreaker) run on a visible progress bar with **Cancel**; cancel is free (resources spent only on completion, re-validated at finish).
- Shift-click `process` recipes → `craft(id, {batch: 5})` (title hint on the button).
- Recipe hover → `GameState.session.showStationRing(station)` (Phase B hook) draws the 200px radius in-world.
- `compare` line under weapon recipes: `+N dmg / ±N% crit` vs equipped.
- Inventory gear cells get a `♻` salvage button (forge required, 50% refund toast); also fixed a latent crash — `I.findEntry(ref)` never existed, now calls `I.equip(ref)` directly.
- New CSS: `.craft-queue`, `.craft-queue-bar`, `.craft-cancel`, `.compare-line`, `.salvage-btn`.

## C2 — Gathering-tier juice (`WorldScene.doGather`/`breakNode`)
- Per-hit: remaining-hits pip + node wiggle tween (every swing reads).
- Break tiers by yield/rarity: common pop → 4+ burst → 8+/rare (`crystal/moonstone/ancient_core/ancient_relic/dragon_scale/gold/silver`) ring + flash + `postFX.pulse()` + gold floater.

## C3 — Photosensitivity-safe mode
- New `settings.toggles.photosensitive` (default off): persists, normalises, sets `data-photosensitive` attr, has a SettingsPanel toggle under Accessibility.
- When on: no camera shake (`shakeAllowed`), no bloom/chromatic/pulse (`PostFXSystem`), no lightning strobe (thunder stays), static danger vignette, no boss phase `camera.flash`. Target-only hit tints stay — they carry hit-confirm info without strobing.

## C4 — Night lighting mask (`NightLights.js`)
- 480×270 canvas texture scaled fullscreen: dark-blue fill at night with `destination-out` radial holes at dynamic lights (campfire/forge/torch via `collectWantedLights`, now exported) + player sight radius (300 with torch, 190 without — torch matters).
- `EnvSystem.useLightMask` caps the flat `darkLayer` at 0.25 so sources compose; mask self-skips by day; redrawn every 4th frame; off-screen lights culled.

## Acceptance
- `npm test` green, `vite build` succeeds.
- Craft dawnbreaker: progress bar → cancel refunds nothing, complete spends; Shift-click iron → ×5.
- Salvage iron sword at forge → ~50% ingots back; without forge → reason toast.
- Toggle photosensitive: lightning storm = sound only, boss phase = no flash, hits still tint.
- Night with/without torch: sight radius visibly differs; campfire glows through the dark.
