# 08 — Lighting & Fauna Realism Pass

Date: 2026-09-21. Research-backed overhaul of night lighting and animal
behavior/rendering, plus the grass-in-water fix.

---

## Research summary

### 2D night lighting (canvas/Phaser)

The standard technique for "darkness with light holes" is a low-res darkness
texture (offscreen canvas) filled with the night tint, then light holes punched
out with `globalCompositeOperation = 'destination-out'` radial gradients before
the texture is drawn over the scene. Key practices from the sources surveyed
(gamedev.stackexchange torch-light thread, canvas lighting articles):

- **Keep the mask low-res** (¼–⅛ game scale) for cheap gradients, but **scale
  it uniformly**. Stretching a low-res mask to a non-uniform display
  (e.g. 480×270 into a 440×784 canvas) turns circular light holes into tall
  ellipses — visible distortion of every light.
- **The darkness alpha is the dimming control.** Baking day/night dimming into
  separate color ramps per hour multiplies the tuning surface; a single mask
  whose alpha tracks sun elevation dims uniformly.
- **Sight radius must adapt to the view.** A fixed world-space "sight hole"
  larger than the visible area produces a flat wash — no contrast, no night
  feeling. Clamp the hole to a fraction of the smaller viewport axis.
- **Lights attached to moving entities must follow per-frame.** A structural
  refresh on a 30-frame cadence makes a held torch trail behind sprinting
  players and snap when they stop.
- Warm light color (≈ `#ffd9a0` amber) for fire, cool moonlight for ambient
  night; avoid pure black — a blue-grey floor keeps terrain readable.

### Believable animal AI (theHunter: Call of the Wild post-mortem)

Design pillars that make prey animals read as *animals* rather than mobs:

- **Prey flee on detection — they never escalate to combat.** A deer that
  freezes, telegraphs, then bolts (and keeps fleeing until "well clear")
  reads real; one that charges reads broken.
- **Species-distinct senses and reactions**: different detection radii and
  flee thresholds per species create the hunting loop (spot, stalk, strike).
- **Herds**: prey animals are social. A lone deer reads as a bug; small
  groups (2–4) that spook together are the believable default.
- **Schedules/need zones** (graze at dawn near water, rest midday) are the
  long-term realism lever — noted below as future work.

---

## Diagnosed problems (live-probed, this pass)

Driving the real game at night and around lakes surfaced:

1. **Grass carpeted the entire lake** — the lake read as a green lawn with
   water barely visible (`GrassField` had no water query).
2. **Trees and enemies spawned in water** (`SpawnDirector.populateChunk` had
   no water check) — including a tree standing mid-lake.
3. **Night was a flat blue-grey wash**: the 480×270 night mask was stretched
   non-uniformly into a tall canvas (egg-shaped holes) and the fixed 190px
   sight hole covered ~86% of the small view's width — no contrast at all.
4. **Held-torch glow lagged**: repositioned only on the 30-frame structural
   refresh, so it trailed sprinting players.
5. **Animals slide-walked**: 12 walk frames existed but stride rate was fixed
   (0.13s) regardless of speed, up-facing frames showed a side profile *with
   an eye*, and no prey species existed at all (wolves/boars/bears only).

## Fixes implemented

| Problem | Fix |
|---|---|
| Grass in water | `GrassField` queries `isWaterAt()` per lattice cell; shoreline cells fade via per-slab base alpha (trample/revive restore the stored alpha, not hardcoded 0.8) |
| Trees/enemies in lakes | `populateChunk` rejects node positions and enemy rolls on water (`isWaterAt`) |
| Egg-shaped light holes | `NightLights` renders the mask at display aspect, uniform scale factor `min(sx, sy)`, zoom-safe sizing |
| Flat night wash | Adaptive sight radius clamped to ~55% of the smaller viewport axis (min 90px, max 340px) |
| Torch lag | `DynamicLights.followPlayerLights()` repositions player-following lights every frame; structural refresh (30-frame) keeps ownership of campfires/settlement lights |
| Flat day-dimming | Night-mask alpha tracks sun elevation; day dimming handled by alpha, not baked color ramps |
| Slide-walking | Stride rate scales with actual velocity (`14 / speed`, clamped 0.07–0.22s) + torso bob per stride phase |
| Broken rear view | Up-facing frames redrawn: head hidden behind rump, ears + antlers peek over the back, centre-hanging tail, symmetric leg pairs |
| No prey fauna | **Red Deer** added: `prey: true` (freeze-telegraph → bolt → calm only when well clear, never attacks), speed 178, slim build + long legs + antlers, loot raw_meat/hides; spawns as herds of 2–4 in forest/grassland |

## Future directions (from the research)

- **Need zones & schedules** — deer graze near water at dawn, rest midday;
  wolves den in pines. Biggest single realism win per the theHunter pillar.
- **Senses, not omniscience** — sight cones + hearing radius; crouch-walking
  reduces detection, creating a stalking mechanic.
- **Light flicker** — subtle 2–4 Hz noise on fire lights (amplitude-capped so
  photosensitivity settings can zero it).
- **Grass interaction with fauna** — trample under deer herds, chaff when they
  bolt (GrassField already exposes per-slab trample).

---

## Screen-space overlay ownership (2026-09-22)

Every overlay that has to sit in screen space — night mask, flat night
darkening, dawn/dusk grade, sky glow, stars, sun/moon, both vignettes, weather
tints and the screen-space particle emitters (rain, snow, fog, heat, ash,
fireflies, birds, mist) — now goes through one owner:
`src/game/systems/ScreenOverlays.ts`.

**Root cause it fixes:** the camera zoom applies to `scrollFactor(0)` objects
too — scrollFactor removes parallax, not zoom. A full-screen overlay sized to
the canvas therefore drew as a centred rectangle covering exactly zoom×100 % of
the viewport, which is why night in the forest (zoom 0.6) was a hard dark box
with bright terrain at its edges.

| Problem | Fix |
| --- | --- |
| Overlays scaled by camera zoom | One container pinned to the camera midpoint at scale `1/zoom`: `screen = zoom × (local + container − midpoint) + midpoint = local + midpoint`, so an overlay only ever sizes itself to the viewport. A second UI camera was rejected — it would need an `ignore()` entry for every display-list object, re-applied as chunks, enemies and loot stream in |
| Five copies of the sizing math | Three declared placement modes (`fill` / `pin` / `anchor`); `fitScreenLayer()` re-places every entry when zoom or canvas size changes and no-ops otherwise |
| Overlays lagging a zoom change | Fit now runs every frame; the old every-4th-frame gate left overlays sized for a stale zoom, so night/weather showed bright edge bands while `applyCamZoom` lerped |
| Dead overlays left registered | Prune runs *before* the zoom/size early-return, and the empty `obj.destroyed` checks became `isDestroyed()` — Phaser 4 has no `destroyed` flag, it clears `active`, so the old guards never fired |
| No ashfall | New `ash` weather state (grey veil + drifting flakes), rolled in the volcanic / Emberwaste biome — the brief's §18 ASH atmosphere |

The audit's "dead alpha-0 rects" are **not** dead: they are the night
darkening and the dawn/dusk grade, both written every frame from `timeOfDay`
(alpha 0 by day, 0.25 residual at night when the mask carries the darkness).
They were kept, not deleted.

**Verification (live, in the running region).** A magenta probe registered
through the owner fills the canvas with zero uncovered pixels at zoom 0.6 and 2,
driven through the real `camZoom` setting and combat-bias path; every `fill`
overlay covers the viewport at zoom 0.6 / 0.96 / 1 / 1.5 / 2; FOG and ASH were
verified at both extremes; night, weather and vignette states are all
edge-to-edge. Ninety weather switches leave the layer at exactly its nine base
entries — no leak. Residual rectangles seen while testing were traced to terrain
chunk tinting, not overlays, by hiding the layer. `tests/overlays.mjs` (in
`npm test`) locks the transform, placement, prune and scene-restart paths.
