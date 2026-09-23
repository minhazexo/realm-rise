// UI-discipline gate: React components must never write persistent game state
// directly. All persistent mutation goes through system services
// (InventorySystem, EconomySystem, ProgressionXP, QuestSystem, ...).
//
// Scans app/components RECURSIVELY for `GameState.s.<branch>... =` assignments
// on persistent branches. Session writes (uiPanel, paused, screen, dialogue,
// joystick, ...) remain allowed — they are the explicit UI exception in
// AI_RULES.md. Reads (`===`, `=>`, comparisons) are ignored.
//
// 2026-09-23: this gate used to filter for `.js`/`.jsx` while every component is
// `.ts`/`.tsx`, so it scanned nothing and passed forever. It now walks the whole
// folder tree and every extension the project actually uses.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'components');
const PERSISTENT = ['player', 'inventory', 'inventorySlots', 'settlement', 'world', 'quests', 'story', 'factions', 'achievements', 'stats', 'settings', 'meta'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** Every component file, at any depth. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

let fails = 0;
const files = walk(root);
for (const full of files) {
  const rel = full.slice(root.length + 1).replace(/\\/g, '/');
  const lines = readFileSync(full, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.split('//')[0]; // ignore trailing comments
    for (const branch of PERSISTENT) {
      // GameState.s.<branch> ... = (single =, not ==/=>/!=/<=/>=)
      const re = new RegExp(`GameState\\.s\\.${branch}\\b[^\\n]*?(?<![=!<>])=(?![=>])`);
      if (re.test(code)) {
        fails++;
        console.error(`✗ ${rel}:${i + 1} writes persistent state: ${code.trim().slice(0, 110)}`);
        break;
      }
    }
  });
}

console.log(fails === 0
  ? `✅ UI-DISCIPLINE PASS — ${files.length} component file(s) scanned, none writes persistent state.`
  : `❌ ${fails} violation(s) across ${files.length} files`);
process.exit(fails ? 1 : 0);
