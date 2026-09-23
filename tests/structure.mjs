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
const systemFiles = readdirSync(join(src, 'game', 'systems'))
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

/* ── 3. Declared Phaser-free modules really are ─────────────────────────── */
// These run under node in the test suite: a Phaser import here breaks that.
const PURE = [
  'AchievementSystem', 'AudioSystem', 'AutoAttackSystem', 'BossUISystem', 'BreathingFX',
  'CameraSystem', 'CraftingSystem', 'EconomySystem', 'ElementalSystem', 'FactionSystem',
  'InventorySystem', 'KingdomEconomy', 'KingdomSystem', 'LegacyStore', 'NavigationSystem',
  'ProgressionSystem', 'ProgressionXP', 'QuestEngine', 'QuestSystem', 'RegionArena',
  'RegionEncounters', 'RegionLayout', 'RegionRegistry', 'RegionStory', 'SaveSystem',
  'SettingsSystem', 'ShardSystem', 'StorySystem', 'TutorialSystem', 'WeaponSpecials',
  'WorldEvents', 'ambientSounds', 'audioSfx', 'kingdomSim', 'particleThrottle'
];
const polluted = PURE.filter((name) =>
  /Phaser\.|from 'phaser'/.test(codeOnly(read(join(src, 'game', 'systems', `${name}.ts`)))));
if (polluted.length) fail(`declared Phaser-free but reference Phaser: ${polluted.join(', ')}`);
else ok(`${PURE.length} pure modules stay Phaser-free (node-testable)`);

/* ── 4. Size budgets ────────────────────────────────────────────────────── */
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

/* ── Report ─────────────────────────────────────────────────────────────── */
console.log(fails.length
  ? `❌ STRUCTURE FAIL — ${fails.length} problem(s), ${checks} check(s) passed`
  : `✅ STRUCTURE PASS — ${checks} structure checks verified.`);
process.exit(fails.length ? 1 : 0);
