// UI-discipline gate (Phase 4): React components must never write persistent
// game state directly. All persistent mutation goes through system services
// (InventorySystem, EconomySystem, ProgressionXP, QuestSystem, ...).
//
// Scans app/components for `GameState.s.<branch>... =` assignments on
// persistent branches. Session writes (uiPanel, paused, screen, dialogue,
// joystick, ...) remain allowed — they are the explicit UI exception in
// AI_RULES.md. Reads (`===`, `=>`, comparisons) are ignored.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'components');
const PERSISTENT = ['player', 'inventory', 'inventorySlots', 'settlement', 'world', 'quests', 'story', 'factions', 'achievements', 'stats', 'settings', 'meta'];

let fails = 0;
const files = readdirSync(root).filter((f) => f.endsWith('.jsx') || f.endsWith('.js'));
for (const f of files) {
  const lines = readFileSync(join(root, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.split('//')[0]; // ignore trailing comments
    for (const branch of PERSISTENT) {
      // GameState.s.<branch> ... = (single =, not ==/=>/!=/<=/>=)
      const re = new RegExp(`GameState\\.s\\.${branch}\\b[^\\n]*?(?<![=!<>])=(?![=>])`);
      if (re.test(code)) {
        fails++;
        console.error(`✗ ${f}:${i + 1} writes persistent state: ${code.trim().slice(0, 110)}`);
        break;
      }
    }
  });
}

console.log(fails === 0 ? '✅ UI-DISCIPLINE PASS — components write no persistent state.' : `❌ ${fails} violation(s)`);
process.exit(fails ? 1 : 0);
