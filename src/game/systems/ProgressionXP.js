// ─────────────────────────────────────────────────────────────────────────────
// Progression (2/2): XP & levels, allocations, skills, professions, reputation.
// Re-exported through ProgressionSystem.js.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus, CH } from '../core/EventBus.js';
import { xpForLevel, MAX_PLAYER_LEVEL } from '../core/Constants.js';
import { SKILL_MAP } from '../data/skills.js';

const st = () => GameState.s;

export const xpToNext = (level = st().player.level) => xpForLevel(level);

/** Award experience. Returns true when at least one level was gained. */
export function awardXP(baseAmount, sourceLabel = '') {
  const P = st().player;
  if (!P || P.level >= MAX_PLAYER_LEVEL) return false;
  P.xp += Math.max(0, Math.round(baseAmount * P.derived.xpGainMult));
  let leveled = false;
  while (P.level < MAX_PLAYER_LEVEL && P.xp >= xpToNext(P.level)) {
    P.xp -= xpToNext(P.level);
    P.level++;
    P.statPoints += 3;
    P.skillPoints += 1;
    leveled = true;
    GameState.notify(CH.PLAYER);
    // Refresh derived stats for the new level (self-import resolves the cycle lazily).
    import('./ProgressionSystem.js')
      .then((m) => m.recompute())
      .catch(() => {});
    const D = P.derived;
    if (D) P.hp = Math.min(D.maxHp + 30, P.hp + D.maxHp * 0.3);
    Bus.emit('level-up', { level: P.level, source: sourceLabel });
    import('./AchievementSystem.js').then((m) => m.checkLevel(P.level)).catch(() => {});
  }
  if (!leveled) GameState.notify(CH.PLAYER);
  return leveled;
}

export function spendStat(key) {
  const P = st().player;
  if (P.statPoints <= 0) return false;
  if (!(key in P.alloc) || P.alloc[key] >= 30) return false;
  P.statPoints--;
  P.alloc[key]++;
  GameState.notify(CH.PLAYER);
  return true;
}

export function learnSkill(id) {
  const P = st().player;
  const def = SKILL_MAP[id];
  if (!def || P.skillPoints <= 0) return false;
  const rank = P.skills[id] || 0;
  if (rank >= def.maxRank) return false;
  if (def.req) for (const [reqId, min] of Object.entries(def.req)) if ((P.skills[reqId] || 0) < min) return false;
  P.skillPoints--;
  P.skills[id] = rank + 1;
  GameState.notify(CH.PLAYER);
  GameState.toast({ title: `Learned: ${def.name}`, kind: 'skill' });
  return true;
}

/* ── Professions: learn-by-doing with rank titles (spec §7) ────────────── */
const PROF_KEYS = ['woodcutting', 'mining', 'survival', 'combat', 'crafting'];
const profNeed = (lv) => Math.round(70 + Math.pow(lv, 1.65) * 52);

export function profXP(prof, amount) {
  const P = st().player.professions;
  if (!PROF_KEYS.includes(prof)) return 0;
  const p = P[prof];
  p.xp += amount;
  let raised = 0;
  while (p.lv < 10 && p.xp >= profNeed(p.lv)) {
    p.xp -= profNeed(p.lv);
    p.lv++;
    raised++;
  }
  if (raised > 0) {
    GameState.toast({ title: `${cap(prof)} ${roman(p.lv)}`, msg: 'Your practice grows more skilled.', kind: 'skill' });
  }
  GameState.notify(CH.PLAYER);
  return raised;
}

export const profLevel = (prof) => st().player.professions[prof]?.lv ?? 0;

/* ── Reputation ────────────────────────────────────────────────────────── */
export function addReputation(n) {
  const P = st().player;
  let val = n * (1 + (P.derived?.willpower || 0) * 0.01);
  if (P.personality === 'kind' && n > 0) val *= 1.1;
  P.reputation = Math.round(P.reputation + val);
  GameState.notify(CH.PLAYER);
  return P.reputation;
}

export function addGold(n) {
  const S = st();
  S.player.gold = Math.max(0, S.player.gold + n);
  GameState.notify(CH.PLAYER, CH.RESOURCES);
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const roman = (lv) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(lv, 10)];

