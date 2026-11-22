// Structure gate: the shape of the codebase, enforced.
//
// docs/STRUCTURE.md is the map. This test keeps it true, so the next pass can
// trust it instead of re-reading everything:
//
//   1. every systems module is NAMED in docs/STRUCTURE.md (add a module, update the map)
//   2. data/ and core/ never touch Phaser, and data/ never imports systems/
//   3. the modules declared Phaser-free really are (node tests can import them)
//   4. size budgets hold (a file that outgrows its budget gets split, not exempted)
//   5. every source file opens with a header comment saying what it is
//   6. no component that is pure re-export indirection (those were deleted once)
//   7. the render pipeline declares no dead knobs (core/VisualProfile)
//   8. every canvas that becomes a Phaser texture is authored at the profile density
//   9. reused canvases reset their transform before repainting
//  10. both map surfaces draw the ONE map (no private terrain or markers)
//
// Deliberately dependency-free: reads files, no parser, no Phaser.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

let checks = 0;
const fails = [];
const fail = (msg) => { fails.push(msg); console.error(`✗ ${msg}`); };
const ok = (msg) => { checks++; console.log(`✓ ${msg}`); };

/** Every file under a directory, recursively, with the given extensions. */
function walk(dir, exts = ['.ts', '.tsx']) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/');
const codeOnly = (text) => text.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n');

/* ── 1. The module map is complete ──────────────────────────────────────── */
const doc = read(join(root, 'docs', 'STRUCTURE.md'));
const systemFiles = walk(join(src, 'game', 'systems'))
  .map(f => basename(f))
  .filter((f) => f.endsWith('.ts'));
const undocumented = systemFiles.filter((f) => !doc.includes(f));
if (undocumented.length) fail(`docs/STRUCTURE.md does not name: ${undocumented.join(', ')}`);
else ok(`module map names all ${systemFiles.length} systems modules`);

/* ── 2. Layer rules ─────────────────────────────────────────────────────── */
const PURE_DIRS = ['data', 'core'];
for (const dir of PURE_DIRS) {
  const bad = walk(join(src, 'game', dir)).filter((f) => /Phaser\.|from 'phaser'/.test(codeOnly(read(f))));
  if (bad.length) fail(`${dir}/ must stay Phaser-free: ${bad.map(rel).join(', ')}`);
}
ok(`${PURE_DIRS.join('/ and ')}/ never touch Phaser`);

const dataImportingSystems = walk(join(src, 'game', 'data'))
  .filter((f) => /from '\.\.\/systems\//.test(read(f)));
if (dataImportingSystems.length) fail(`data/ imports systems/ (wrong direction): ${dataImportingSystems.map(rel).join(', ')}`);
else ok('data/ imports nothing from systems/');

// world/ is the procedural layer and sits BELOW systems/: the generator must not
// know about authored content. The one merge that needs both halves lives in a
// system (systems/PoiRegistry merges proceduralPois() with the regions).
const worldImportingSystems = walk(join(src, 'game', 'world'))
  .filter((f) => /from '\.\.\/systems\//.test(read(f)));
if (worldImportingSystems.length) fail(`world/ imports systems/ (generator must stay below them): ${worldImportingSystems.map(rel).join(', ')}`);
else ok('world/ (procedural layer) imports nothing from systems/');

/* ── 2b. Entities own themselves, not the game ──────────────────────────── */
// An entity may read state and act, but a reward it produces goes through the
// system that owns that state (KillReward, ProgressionXP, …) — never a direct
// `GameState.s.<branch> =` write here.
const PERSISTENT = ['player', 'inventory', 'inventorySlots', 'settlement', 'world', 'quests',
  'story', 'factions', 'achievements', 'stats', 'settings', 'meta', 'kingdom'];
let entityWrites = 0;
for (const f of walk(join(src, 'game', 'entities'))) {
  read(f).split('\n').forEach((line, i) => {
    const code = line.split('//')[0];
    for (const branch of PERSISTENT) {
      const re = new RegExp(`GameState\\.s\\.${branch}\\b[^\\n]*?(?<![=!<>])=(?![=>])`);
      if (re.test(code)) { entityWrites++; fail(`${rel(f)}:${i + 1} writes persistent state: ${code.trim().slice(0, 90)}`); }
    }
  });
}
if (!entityWrites) ok('no entity writes persistent state (rewards go through systems)');

/* ── 3. Declared Phaser-free modules really are ─────────────────────────── */
// These run under node in the test suite: a Phaser import here breaks that.
const PURE = [
  'AchievementSystem', 'AudioSystem', 'AutoAttackSystem', 'BossUISystem', 'BreathingFX',
  'CameraSystem', 'CraftingSystem', 'EconomySystem', 'ElementalSystem', 'FactionSystem',
  'InventorySystem', 'KingdomEconomy', 'KingdomSystem', 'LegacyStore', 'NavigationSystem',
  'ProgressionSystem', 'ProgressionXP', 'QuestEngine', 'QuestSystem', 'RegionArena',
  'RegionEncounters', 'RegionLayout', 'RegionRegistry', 'RegionStory', 'RegionTravel', 'SaveSystem',
  'SettingsSystem', 'ShardSystem', 'StorySystem', 'TutorialSystem', 'WeaponSpecials',
  'WorldEvents', 'ambientSounds', 'audioSfx', 'kingdomSim', 'particleThrottle'
];
const polluted = PURE.filter((name) => {
  const all = walk(join(src, 'game', 'systems'));
  const f = all.find(file => basename(file) === `${name}.ts`);
  return f && /Phaser\.|from 'phaser'/.test(codeOnly(read(f)));
});
if (polluted.length) fail(`declared Phaser-free but reference Phaser: ${polluted.join(', ')}`);
else ok(`${PURE.length} pure modules stay Phaser-free (node-testable)`);

/* ── 4. Size budgets ───────────────────────────────────────────────────── */
const BUDGETS = [
  ['src/game/scenes', 1000],
  ['src/game/data', 800],
  ['src/game/world', 800],
  ['src/game/systems', 800],
  ['src/game/assets', 800],
  ['src/game/entities', 700],
  ['src/game/core', 700],
  ['src/app', 500]
];
let over = 0;
for (const [dir, budget] of BUDGETS) {
  for (const f of walk(join(root, dir))) {
    const lines = read(f).split('\n').length;
    if (lines > budget) { over++; fail(`${rel(f)} is ${lines} lines (budget ${budget}) — split it by concern`); }
  }
}
if (!over) ok(`${BUDGETS.length} area budgets hold (largest: WorldScene.ts, SettingsPanel.tsx)`);

/* ── 5. Every source file says what it is ───────────────────────────────── */
const headerless = walk(src).filter((f) => !read(f).startsWith('//'));
if (headerless.length) fail(`no header comment: ${headerless.map(rel).join(', ')}`);
else ok(`all ${walk(src).length} source files open with a header comment`);

/* ── 6. No re-export indirection in components ──────────────────────────── */
const components = walk(join(src, 'app', 'components'));
const shims = components.filter((f) => {
  if (basename(f) === 'index.ts') return false;
  const body = codeOnly(read(f)).split('\n').filter((l) => l.trim());
  return body.length > 0 && body.every((l) => /^export .* from /.test(l.trim()));
});
if (shims.length) fail(`re-export-only component(s) — import the real file instead: ${shims.map(rel).join(', ')}`);
else ok(`no re-export shims among ${components.length} component files`);

/* ── 7. The render pipeline declares no dead knobs ─────────────────────── */
// core/VisualProfile is the ONE switch for the rendering pipeline. A knob
// nobody reads is a promise, not a pipeline: `isPainterly`, `supersample` and
// `lightFeather` were all declared here and read by nothing while the docs told
// readers to flip switches that did nothing. Two rules keep that from coming
// back — every knob is READ inside the module, and every accessor it offers is
// CONSUMED outside it (a mention in a comment does not count).
const profilePath = join(src, 'game', 'core', 'VisualProfile.ts');
const profileCode = codeOnly(read(profilePath));
const literalStart = profileCode.indexOf('Object.freeze({');
const literalEnd = profileCode.indexOf('});', literalStart);
const knobTable = profileCode.slice(literalStart, literalEnd);
const knobs = [...knobTable.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
const unreadKnobs = knobs.filter((k) => !profileCode.includes(`VISUAL_PROFILE.${k}`));
if (unreadKnobs.length) fail(`VISUAL_PROFILE declares knobs nothing reads: ${unreadKnobs.join(', ')}`);
else ok(`all ${knobs.length} render-profile knobs are read (${knobs.join(', ')})`);

const profileAccessors = [...profileCode.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
const otherSources = walk(src)
  .filter((f) => f !== profilePath)
  .map((f) => codeOnly(read(f)));
const unreadAccessors = profileAccessors.filter((name) => {
  const re = new RegExp(`\\b${name}\\b`);
  return !otherSources.some((text) => re.test(text));
});
if (unreadAccessors.length) fail(`core/VisualProfile exports nobody consumes: ${unreadAccessors.join(', ')}`);
else ok(`all ${profileAccessors.length} render-profile accessors have consumers`);

/* ── 8. World-space textures are authored at the profile density ────────── */
// Check 7 keeps the profile honest; this keeps the WORLD faithful to it. Three
// different blur sources were found in one review, all of the same shape — a
// canvas that becomes a Phaser texture without going through the profile:
//   • GrassField painted its blade tile 1:1 and the camera's ~2× device zoom
//     magnified it (0.49 texels per device pixel, every blade smeared)
//   • a hand-rolled canvas in any new system would do the same thing again
// So: creating a texture is only allowed through the profile (directly or via
// the artCore factory). The exemptions below are deliberate decisions and are
// listed with the reason they are exempt.
const DENSITY_EXEMPT = new Map([
  ['scenes/chunkStreaming.ts', 'bakes the painter\'s density-aware canvas; owns the tile world size after setTexture'],
  ['systems/environment/DynamicLights.ts', 'screen-space light map sized from scale.width (already device px)'],
  ['systems/environment/EnvSystem.ts', 'screen-space sky/weather overlay, device-pixel sized'],
]);
const CREATES_TEXTURE = /document\.createElement\('canvas'\)|textures\.createCanvas\(|textures\.addCanvas\(/;
const DENSITY_AWARE = /from '[^']*VisualProfile\.ts'|makeCanvas\(|makeSheetPaint\(|registerFrames\(|registerImage\(|single\(/;
const softTexels = walk(src).filter((f) => {
  if (basename(f) === 'artCore.ts') return false;      // the factory itself
  const body = codeOnly(read(f));
  if (!CREATES_TEXTURE.test(body)) return false;
  const key = rel(f).replace(/^src\/game\//, '');
  return !DENSITY_AWARE.test(body) && !DENSITY_EXEMPT.has(key);
});
if (softTexels.length) {
  fail(`canvas textures not authored through core/VisualProfile: ${softTexels.map(rel).join(', ')}`
    + ' — author via assets/artCore, read artScale()/terrainScale(), or exempt it here with a reason');
} else {
  ok(`all ${walk(src).filter((f) => CREATES_TEXTURE.test(codeOnly(read(f)))).length} texture-authoring modules go through core/VisualProfile`
    + ` (${DENSITY_EXEMPT.size} documented exemption(s))`);
}

/* ── 9. Reused canvases reset their transform ───────────────────────────── */
// A canvas REMEMBERS its transform, and the authoring helpers hand out a
// context that is already scaled by the profile density. Any code that repaints
// a canvas it has painted before must therefore establish scale from an
// identity matrix. Both ship-blocking bugs of this shape came from skipping it:
//   • a rebuilt sprite sheet was copied through the leftover 4× transform, so
//     every character and enemy turned into a giant unreadable blob (left-facing
//     frames measured 98% solid paint instead of 50%)
//   • the character portraits stacked another 4× on each repaint, so changing a
//     hairstyle grew the preview off its frame
const TRANSFORM_GUARD = [
  ['game/assets/artCore.ts', 'sheet rebuild copy path (registerFrames)'],
  ['app/components/panels/CharacterPanel.tsx', 'character portrait repaint'],
  ['app/components/screens/CharacterCreation.tsx', 'creation preview repaint'],
];
const missingReset = TRANSFORM_GUARD
  .filter(([f]) => !/setTransform\(1, 0, 0, 1, 0, 0\)/.test(codeOnly(read(join(src, f)))))
  .map(([f, why]) => `${f} (${why})`);
if (missingReset.length) {
  fail(`reused canvas without a transform reset: ${missingReset.join(', ')}`
    + ' — call ctx.setTransform(1, 0, 0, 1, 0, 0) before repainting');
} else {
  ok(`${TRANSFORM_GUARD.length} repainting canvases reset their transform (no magnified rebuilds)`);
}

/* ── 10. One map, one entry point ───────────────────────────────────────── */
// The minimap drifted into being a SECOND map once: it painted its own terrain
// and its own markers while the panel painted a different one, so the corner map
// and the world map disagreed about the same world. Both surfaces must draw
// through `drawWorldMap`, and neither may reach for the layers underneath it
// (terrain sampling, marker placement, the POI language) — that is what makes
// them one map at two scales instead of two maps that agree by accident.
const MAP_HOSTS = [
  ['src/game/systems/environment/MinimapSystem.ts', 'the corner map'],
  ['src/app/components/panels/MapPanel.tsx', 'the World Map panel'],
];
const MAP_LOWER_LAYERS = ['drawMapTerrain', 'paintTerrainGrid', 'buildTerrainGrid', 'placeMarkers', 'layoutLabels', 'poiStyle', 'paintResources'];
for (const [host, what] of MAP_HOSTS) {
  const body = codeOnly(read(join(root, host)));
  const own = MAP_LOWER_LAYERS.filter((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(body));
  if (!/drawWorldMap\s*\(/.test(body)) {
    fail(`${what} (${host}) does not draw the shared map — call drawWorldMap()`);
  } else if (own.length) {
    fail(`${what} (${host}) paints its own map layers (${own.join(', ')}) — go through world/mapRender.drawWorldMap`);
  } else {
    ok(`${what} draws the one map (no private terrain or markers)`);
  }
}

/* ── Report ─────────────────────────────────────────────────────────────── */
console.log(fails.length
  ? `❌ STRUCTURE FAIL — ${fails.length} problem(s), ${checks} check(s) passed`
  : `✅ STRUCTURE PASS — ${checks} structure checks verified.`);
process.exit(fails.length ? 1 : 0);
