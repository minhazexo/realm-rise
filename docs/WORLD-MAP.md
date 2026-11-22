# World Map — The Frontier Atlas

> The detailed, implementable map of the playable world: coordinates, biome
> bands, region catalog, roads, fast travel, and the map UI. Everything here is
> expressed against the **real generator** (`src/game/world/worldGen.ts`,
> `biomeTable.ts`, `core/Constants.ts`) and the **real registry**
> (`systems/world/RegionRegistry.ts`).

## 1. Coordinate system and scale

| Property | Value | Source |
|---|---|---|
| Tile size | 32 px | `WORLD_CONFIG.tileSize` |
| Chunk size | 512 px (16 tiles) | `WORLD_CONFIG.chunkSize` |
| World half-extent | 16384 px | `WORLD_CONFIG.worldHalfExtent` |
| Playable square | **32768 × 32768 px** = 64 × 64 chunks = 1024 × 1024 tiles | derived |
| Axes | **+X east, +Y south** (screen convention; north is −Y) | `worldGen` temperature |
| Spawn | `(0, 260)` | `WORLD_CONFIG.spawn` |
| Active chunk radius | 3 chunks (streamed) | `WORLD_CONFIG.activeChunkRadius` |

**Latitude:** `tempAt()` uses `LATITUDE_SCALE = 9000`; temperature falls toward
−Y. So the **Frozen North** is the top of the map and the **Emberwaste** is the
bottom. This is the backbone of the atlas.

## 2. Biome resolution (as generated)

`biomeAt(wx, wy)` resolves in this priority (unchanged; the atlas is built *on
top*, not by replacing it):

| Priority | Biome | Condition |
|---|---|---|
| 1 | `riverlands` | `elevation < RIVER_LEVEL (0.34)` |
| 2 | `mountains` | `elevation > 0.78` **and** ridge > 0.55 |
| 3 | `desert` | `temp > 0.52` and `moisture < 0.42` |
| 4 | `volcanic` | `temp > 0.62`, `moisture ≥ 0.42`, ridge > 0.45 |
| 5 | `frozen` | `temp < −0.28` |
| 6 | `swamp` | `moisture > 0.68`, `temp > 0.05`, `elevation < 0.52` |
| 7 | `forest` | `moisture > 0.55` |
| 8 | `plains` | fallback |

Biome labels (`biomeTable.ts`): Sunlit Plains, The Deepwood, Riverlands,
Murkfen Swamp, Grayfang Mountains, Ashen Dunes, Frozen North, Emberwaste.

> **Design intent:** the generator is noise-based, so biomes appear where the
> simulation says — *authored regions are placed inside the band that matches
> them*. A region never forces a biome; it is themed to the biome it lands in.

## 3. The continent — conceptual layout

The world is a single wounded frontier continent. Rings describe **proximity to
home**, which is also a **level/danger band**.

```
                         -16384 (north / frozen)
        ┌──────────────────────────────────────────────────────┐
        │            THE FROZEN NORTH  (Lv 18–28)               │
        │      Grayfang        ┌────────────┐       The Veil    │
        │      (Lv 10–18)      │  HOLLOW    │        Scar       │
        │  ┌──────────┐        │  SPIRE     │      (void edge)  │
        │  │ Deepwood │        └────────────┘                   │
        │  │ (Lv 4–10)│     ┌──────────────────┐                 │
        │  └──────────┘     │  ASHEN FRONTIER  │   Drowned Reach  │
        │                   │  + Heartland     │   (Lv 6–14)      │
   -X ──┤                   │  (Lv 1–8) HOME   │──────────────► +X │
        │                   └──────────────────┘   Golden Coast   │
        │   Murkfen (Lv 6–12)      Ashen Dunes (Lv 8–14)          │
        │                                                         │
        │            THE EMBERWASTE  (Lv 22–32)                   │
        └──────────────────────────────────────────────────────┘
                         +16384 (south / volcanic)
```

**Danger rings** (distance from `(0,260)`):

| Ring | Radius | Content |
|---|---|---|
| **Home** | 0–2 500 px | Heartland + Ashen Frontier village; tutorial, first settlement |
| **Frontier** | 2 500–8 000 px | First authored regions; bandit camps, ruins ring, shrines |
| **Deep Wilds** | 8 000–16 384 px | Extreme biomes, guardians, endgame shards |

## 4. Region catalog

Add each region as `data/region<Name>.ts` built with `defineRegion()` from
`data/regionKit.ts` — it derives `subregionAt`, `encountersToTrigger` and
`isSafe` from the authored areas, so a region only authors places, props,
fights and POIs. Then add **one line** in `systems/world/RegionRegistry.ts`. No
system code changes (per `STRUCTURE.md`). `regionStations()` and `regionPois()`
pick them up automatically, and `tests/region-pipeline.mjs` runs `regionIssues()`
over every registered region: wrong-side-of-boundary POIs, dangling waypoints,
unknown enemies and guardians inside safe zones fail the build instead of being
found by walking there.

| # | Region | Anchor (x, y) | Radius | Biome band | Level | Chapter | Signature | Guardian |
|---|---|---|---|---|---|---|---|---|
| 1 | **The Ashen Frontier** *(exists)* | `(200, −300)` | 2 200 | mixed (authored) | 1–8 | I–III | Story hub, shards | Warden of Ash |
| 2 | **The Heartland** | `(0, 260)` | 2 000 | plains | 1–6 | I–II | First fire, founding | — (tutorial) |
| 3 | **The Deepwood** *(exists)* | `(−6 200, −800)` | 2 600 | forest | 4–10 | III–IV | Verdant Clans, Elara | Grendelfang |
| 4 | **Murkfen** | `(3 200, 5 600)` | 2 400 | swamp | 6–12 | IV–V | Herbs, drowned ruins | The Fen Mother |
| 5 | **Grayfang Heights** | `(−6 800, −7 200)` | 2 800 | mountains | 10–18 | V–VI | Iron ore, Ancient Order | The Hollow Warden |
| 6 | **The Drowned Reach** *(exists)* | `(9 400, −1 200)` | 2 800 | riverlands | 6–14 | IV–VI | Trade routes, League | The Toll Keeper |
| 7 | **Ashen Dunes** | `(8 200, 4 200)` | 2 600 | desert | 8–14 | V–VI | Flint, bandit courts | Rhogar's Court |
| 8 | **The Frozen North** | `(600, −12 000)` | 3 200 | frozen | 18–28 | VI–VII | Moonstone, Watch shard | The Long Winter |
| 9 | **The Emberwaste** | `(−1 200, 11 800)` | 3 400 | volcanic | 22–32 | VII–VIII | Crystal, Green→Hearth forge | The Ember Sovereign |
| 10 | **The Golden Coast** | `(13 500, 2 000)` | 2 000 | riverlands/plains | 12–20 | VI–VIII | Ship origin, ending gate | — (finale) |

Notes:
- Anchors keep the 8 existing landmarks of the Frontier intact — the Frontier
  stays exactly where it is today (`village (-90,330)`, `pyre (980,-1520)`, etc.).
- Regions are placed **≥1 500 px apart** so their authored radii never overlap.
- Each region contributes: `pois[]`, `landmarks[]`, `encounters[]`,
  `interactables[]`, optional `hazards[]`, `puzzles[]`, `arena`, `npcs[]`,
  `stations[]`, and an `isSafe()` zone — the full `RegionDef` vocabulary.

### Region detail template

For each region define (schema in `data/region.ts`):

```text
id, name, mood, ambience
landmarks[]   — 4–8 named places, each a story clue
pois[]        — discoverable, grant XP + map marker
encounters[]  — designed fights with roles (not random spawns)
interactables[]— shard/anchor/lever/cache/hunger objects
hazards[]     — biome hazard visuals + gameplay (heat/cold/veil)
arena         — guardian fight + aftermath
npcs[]        — named residents/quest-givers
stations[]    — crafting stations the region provides
isSafe(x,y)   — no-spawn safe radius
story         — one-paragraph perspective on the current mystery
```

## 5. Existing POI anchors (keep)

The generator's fixed anchors (`worldGen.proceduralPois()`) must not move:

| POI | Coordinates | Role |
|---|---|---|
| `wolf_den` Growling Hollow | `(−1 750, 420)` | Ch III boss (Grendelfang) |
| `elara_camp` Hunter's Rest | `(520, −880)` | Elara, hunts |
| `tam_crash` Scattered Wreckage | `(1 150, 720)` | Tam, first rescue |
| `ruins_0` The Great Ruins | ring r 2 600–5 200 | Ancient Guardian, lore |
| `ruins_1..5` Whispering Ruins | ring | reach-count quests |
| `bcamp_0..16` Ragged Banner Camps | r 1 800–8 600 | capturable territory |
| `bcamp_8` Bandit King camp | r | Rhogar |
| `shrine_0..7` Ancient Shrines | r 1 200–8 200 | lore + blessing wells |

**Territory target:** `TERRITORY_TARGET = 18` camps. The atlas does not change
this count; new regions add *authored* outposts instead.

## 6. Roads and fast travel

- **Roads** are authored per region as visual paths + a navigation spine. They
  connect each region anchor to the Heartland hub, matching the narrative that
  the old civilisation built them.
- **Waypoints** (one per region + Heartland) are `discovered` POIs. Discovery
  unlocks fast travel; the existing `world.unlockedFastTravel[]` persists it.
- **Map radius:** `NavigationSystem.MAP_VIEW_RADIUS = 7000` — the map shows
  ~14 000 px around the player; the Deep Wilds deliberately sit *beyond* initial
  view so they are a discovery, not a menu item.
- **Arrival:** `ARRIVAL_RADIUS = 80` by `NavigationSystem`; keep.
- **Implemented (registered regions):** a region declares two things in
  `data/region.ts` — `anchor` (its circle in this atlas) and `waypoint` (the POI
  travel lands on). `systems/world/RegionTravel.ts` announces the region the
  player crosses into, unlocks its waypoint on arrival (idempotent, written to
  `world.unlockedFastTravel`, so the existing save already carries it) and
  travels to any unlocked waypoint through the scene's `movePlayer` delegate;
  `MapPanel` lists the unlocked ones. `tests/regions.mjs` enforces the rules in
  §9 — the atlas is now a gate, not just a document.

## 7. Map UI — shipped

**There is ONE map, shown twice.** `world/mapRender.drawWorldMap()` is the only
entry point; the two surfaces differ in view and detail, never in content.
`tests/structure.mjs` check 10 fails if either host paints its own terrain or
markers, because the last time it did, the corner map and the world map drifted
into being two different maps.

| Piece | Module | Owns |
|---|---|---|
| Frame painter | `world/mapRender.ts` | `drawWorldMap()` — base, terrain, relief, fog frontier, regions, grid, resources, markers, labels, viewport, player, waypoint, hover, chrome. `buildMapMarkers()` is the one place state becomes markers. |
| Ground | `world/mapTerrain.ts` | Sampling + painting: `terrainColorFor/At`, the grid, hill shading, coastline, fog frontier. |
| Rules | `world/mapView.ts` | View⇄canvas math, pan/zoom/fit/clamp, cell budget, marker placement and pinning, label declutter, hover pick, region naming. Phaser-free, canvas-free, unit-tested. |
| Corner map | `systems/environment/MinimapSystem.ts` | A player-centred **window**: `minimapView(px, py, zoom, w, h)`, radius `2 200 / zoom`, canvas aspect kept on both axes. No labels, no grid. Publishes the world camera's footprint to `session.viewRect` at the 10 Hz minimap cadence. |
| World Map panel | `app/components/panels/MapPanel.tsx` | The whole map: drag pans, wheel zooms **about the cursor**, a click that did not drag charts a waypoint, double-click re-centres, `Fit world` / `Centre on me`, hover readout, scale bar + coordinates, region names, the live window rectangle. |
| Navigation state | `systems/world/NavigationSystem.ts` | Compass, bearing, arrival (8 dirs). `MAP_VIEW_RADIUS = 7 000` is the panel's opening frame. |
| Fog | `world.exploredChunks` (capped 3 000) | Unchanged: unknown ground is dimmed and the explored edge is drawn as a warm frontier line. |

**Marker rules** (all in `buildMapMarkers`, so both surfaces obey them):

- A map records **places**: player, home, buildings, POIs, the tracked waypoint.
  There is deliberately **no enemy or creature marker** — a map is not a radar.
- The panel **pins** a place it cannot show to the frame rim (with a tick showing
  which way it lies). The minimap **drops** it, because a window stays truthful
  — except `home` and the tracked `waypoint`, which carry `pin` so the corner map
  always keeps your bearings.
- Off-view markers are drawn at 60% alpha so a rim of pins never reads as a
  cluster of real places.

**Region naming.** A region is named once the player has stood in it (its
waypoint unlocks on arrival, written to `world.unlockedFastTravel`). Ground that
is merely *close* is `"<name> — rumoured"` in muted italic (within 1.6× the
region radius), and everything further draws nothing at all — that is what keeps
the frontier dark and exploration a discovery. Visited regions also draw their
footprint as a dashed gold ring.

**Frame budget.** Terrain sampling is the cost of a map frame, so the cell size
comes from `mapView.mapCellSize(view, cellWorld, budget)` with
`MAP_CELL_BUDGET = 9 000` cells: a whole-world view is 6 240 cells (cell 5)
instead of the ~39 000 the plain world-density rule asked for. A gesture passes a
lower budget (`cellBudget`) and the frame is re-sampled crisply once it settles,
which is what keeps dragging smooth on a 520×300 panel.

## 8. Implementation plan

1. Add `data/region<Name>.ts` following `regionAshen.ts` as the shape template.
2. Register it in `systems/world/RegionRegistry.ts` (one line per region).
3. Add its waypoint + road data; `PoiRegistry.allPois()` merges automatically.
4. Add region names/labels to the map UI (`MapPanel`, `mapRender`).
5. Validate with existing gates: `tests/ashen-frontier.mjs` is the template for
   a per-region probe; `tests/structure.mjs` enforces the file budget (data/ 800).
6. Screenshot the region in day + night via `tests/screen-review.mjs`.

## 9. Validation

- **Automated** by `tests/regions.mjs` (chained into `npm test`): no two region
  footprints overlap; the spawn sits inside exactly one region and that region's
  safe zone covers it; no designed fight is seated in a safe zone; every region
  POI is unique and inside its own footprint; every waypoint resolves to a POI of
  its own region; every arena/hazard boss and encounter member is a real enemy.
- Still to automate as regions land: every guardian's `bossKey` reachable in its
  region, per-region signature resource, `territory` math to 18 camps.

- No two region radii overlap; no region covers the spawn safe zone.
- Every region POI has a unique id and is discoverable.
- Every guardian has a `bossKey` that exists in `data/enemies.ts`.
- Every region's signature resource exists in `data/items*.ts` / node types.
- `territory` quest math (`TERRITORY_TARGET`) still reaches 18 camps.
- Fog cap `exploredChunks ≤ 3000` still holds.

## 10. Sources

- Nathan Cheever, *The Art of Game World Maps* — purpose-first maps.
- Red Blob Games `mapgen4` — biome from elevation × moisture × temperature,
  which is exactly the model already in `worldGen.ts`.
- Community progression guides (Bellwright, Core Keeper) — spend the early ring
  on clarity, the outer ring on mastery.
