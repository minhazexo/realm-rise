// ─────────────────────────────────────────────────────────────────────────────
// TutorialSystem (Phase D): guided first minutes for new players.
//
// Data-driven hint chain evaluated every few seconds from live state.
// Each hint fires once per save (tracked in story.flags as `hint_<id>`).
// Hints stay short, actionable, and key-bound — no modal interruptions.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { countItem } from './InventorySystem.ts';
import { awardXP } from './ProgressionXP.ts';
import type { GameRootState } from '../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;
const flags = (): Record<string, unknown> => st().story.flags;

/** Any real weapon/tool equipped (not bare fists). */
function hasTool(): boolean {
  const eq = st().player.equipment.weapon;
  if (!eq?.id) return false;
  return /axe|pick|sword|bow|spear|knife|hammer/i.test(eq.id);
}

function hasAxe(): boolean {
  const inv = st().inventory || [];
  const eq = st().player.equipment.weapon;
  return [eq?.id, ...inv.map((e) => e.id)].some((id) => id && /axe/i.test(id));
}

/** One ordered tutorial hint: first matching unfired hint wins. */
export interface TutorialHint {
  id: string;
  when: () => boolean;
  title: string;
  msg: string;
}

/** Ordered hint chain: first matching unfired hint wins. */
const HINTS: TutorialHint[] = [
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
export function tutorialTick(): void {
  earlyWinTick();
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

/**
 * Early win (game-feel research: first reward inside 60s builds momentum).
 * The very first wood gathered pays a small XP bonus + celebration once.
 */
export function earlyWinTick(): void {
  try {
    const S = st();
    if (!S || flags().early_win) return;
    if (countItem('wood') >= 1 || (S.stats?.gathered || 0) > 0) {
      flags().early_win = true;
      awardXP(12, 'first steps');
      GameState.toast({ title: '✦ First spoil of the wilds', msg: '+12 XP — keep gathering, then press C to craft.', kind: 'quest', dur: 5000 });
    }
  } catch { /* never block the loop */ }
}

/** One "first steps" checklist row for the starter card. */
export interface FirstStep {
  id: string;
  text: string;
  have: number;
  need: number;
  done?: boolean;
}

/** Checklist row with completion resolved. */
export interface FirstStepDone extends FirstStep {
  done: boolean;
}

/** Persistent "first steps" checklist for the starter card (progressive disclosure). */
export function firstSteps(): FirstStepDone[] {
  const S = st();
  if (!S) return [];
  const wood: number = countItem('wood') + countItem('stone');
  const steps: FirstStep[] = [
    { id: 'move', text: 'Move (WASD / arrows)', have: (S.meta.playSeconds || 0) > 8 ? 1 : 0, need: 1 },
    { id: 'gather', text: 'Gather wood or stone', have: Math.min(wood, 5), need: 5 },
    { id: 'axe', text: hasAxe() ? 'Own an axe' : 'Craft a stone axe (C)', have: hasAxe() ? 1 : 0, need: 1 },
    { id: 'settle', text: 'Found a settlement (B → Town Hall)', have: S.settlement?.founded ? 1 : 0, need: 1 },
  ];
  return steps.map((s) => ({ ...s, done: s.have >= s.need }));
}

/** One-line reboarding recap for returning players (cold-start context). */
export function welcomeBackText(): string {
  const S = st();
  if (!S) return '';
  const name: string = S.player?.name || 'Traveler';
  const lv: number = S.player?.level ?? 1;
  const stage: string = S.settlement?.founded ? ` · ${S.settlement.stageIndex ?? 0} realm stage` : ' · no settlement yet';
  const gold: number = S.player?.gold ?? 0;
  return `Welcome back, ${name} — Lv ${lv}${stage} · ${gold}g. Press J for your journal.`;
}
