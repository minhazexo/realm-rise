// ─────────────────────────────────────────────────────────────────────────────
// TutorialSystem (Phase D): guided first minutes for new players.
//
// Data-driven hint chain evaluated every few seconds from live state.
// Each hint fires once per save (tracked in story.flags as `hint_<id>`).
// Hints stay short, actionable, and key-bound — no modal interruptions.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { countItem } from './InventorySystem.js';

const st = () => GameState.s;
const flags = () => st().story.flags;

/** Any real weapon/tool equipped (not bare fists). */
function hasTool() {
  const eq = st().player.equipment.weapon;
  if (!eq?.id) return false;
  return /axe|pick|sword|bow|spear|knife|hammer/i.test(eq.id);
}

function hasAxe() {
  const inv = st().inventory || [];
  const eq = st().player.equipment.weapon;
  return [eq?.id, ...inv.map((e) => e.id)].some((id) => id && /axe/i.test(id));
}

/** Ordered hint chain: first matching unfired hint wins. */
const HINTS = [
  {
    id: 'move',
    when: () => (st().meta.playSeconds || 0) > 8,
    title: 'Survive the wilds',
    msg: 'WASD / arrows to move · E gathers · Left-click attacks · I inventory',
  },
  {
    id: 'axe',
    when: () => countItem('wood') >= 2 && !hasAxe(),
    title: 'Craft a stone axe',
    msg: 'Press C → Tools → stone axe. Tools gather faster and unlock nodes.',
  },
  {
    id: 'gather',
    when: () => hasAxe() && countItem('stone') < 3,
    title: 'Chop and mine',
    msg: 'Hit oaks for wood, boulders for stone. Watch your stamina.',
  },
  {
    id: 'cook',
    when: () => countItem('raw_meat') + countItem('raw_fish') >= 2,
    title: 'Cook your food',
    msg: 'Raw meat barely feeds. Cook it at a campfire (craft one in Survival).',
  },
  {
    id: 'weapon',
    when: () => (st().meta.playSeconds || 0) > 300 && !hasTool(),
    title: 'Arm yourself',
    msg: 'Wolves hunt at dusk. Craft a wooden sword or short bow (C).',
  },
  {
    id: 'settle',
    when: () => (st().meta.playSeconds || 0) > 600 && !st().settlement.founded,
    title: 'Found your realm',
    msg: 'Press B → place a Town Hall. Citizens, taxes and armies follow.',
  },
];

/** Evaluate the chain; show the first due hint. Call every ~5s. */
export function tutorialTick() {
  const S = st();
  if (!S || S.meta.playSeconds == null) return;
  for (const h of HINTS) {
    const key = `hint_${h.id}`;
    if (flags()[key]) continue;
    let due = false;
    try { due = !!h.when(); } catch { due = false; }
    if (!due) continue;
    flags()[key] = true;
    GameState.toast({ title: `✦ ${h.title}`, msg: h.msg, kind: 'quest', dur: 6000 });
    break; // one hint per tick
  }
}
