// ─────────────────────────────────────────────────────────────────────────────
// Achievements (spec §50) — persisted across playthroughs via LegacyStore.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { CH } from '../core/EventBus.js';
import { readLegacy, writeLegacy } from './LegacyStore.js';

const st = () => GameState.s;

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first enemy.', check: () => killCount() >= 1 },
  { id: 'homestead', name: 'Homestead', desc: 'Found a settlement.', check: () => st()?.settlement.founded },
  { id: 'blacksmith_craft', name: 'Blacksmith', desc: 'Craft your first weapon.', check: () => craftedCount() >= 1 },
  { id: 'ruler', name: 'Ruler of Souls', desc: 'Reach Village status.', check: () => stage() >= 2 },
  { id: 'conqueror', name: 'Conqueror', desc: 'Capture an enemy camp.', check: () => (st()?.world.ownedCamps.length || 0) >= 1 },
  { id: 'explorer_25', name: 'Explorer', desc: 'Discover 12 points of interest.', check: () => poiCount() >= 12 },
  { id: 'legend_alpha', name: 'Deepswood Legend', desc: 'Defeat Grendelfang.', check: () => flags().alpha_slain },
  { id: 'king_breaker', name: 'Crownbreaker', desc: 'Defeat Rhogar the Bandit King.', check: () => flags().bandit_king_slain },
  { id: 'emperor', name: 'High Sovereign', desc: 'Control 40% of the realm.', check: () => territoryPct() >= 40 },
  { id: 'level20', name: 'Hardened Wanderer', desc: 'Reach level 20.', check: () => lvl() >= 20 },
  { id: 'iron_fist', name: 'An Army Marches', desc: 'Command 15 military power units.', check: () => militaryPower() >= 15 },
  { id: 'night_survivor', name: 'Children of the Dark', desc: 'Survive three nights without dying.', check: () => nightsSurvived() >= 3 }
];

const lst = () => readLegacy();

const killCount = () => st()?.stats?.kills ?? 0;
const craftedCount = () => st()?.stats?.crafted ?? 0;
const stage = () => st()?.settlement.stageIndex ?? 0;
const poiCount = () => st()?.world.discoveredPois.length ?? 0;
const flags = () => st()?.story.flags ?? {};
const territoryPct = () => GameState.session.territoryPct ?? 0;
const lvl = () => st()?.player.level ?? 1;
const militaryPower = () => Object.values(st()?.settlement.military || {}).reduce((a, b) => a + b, 0);
const nightsSurvived = () => st()?.stats?.nightsSurvived ?? 0;

export function isUnlocked(id) {
  return !!lst().achievements[id];
}

export function allStatuses() {
  const got = lst().achievements;
  return ACHIEVEMENTS.map((a) => ({ ...a, unlockedAt: got[a.id] || null }));
}

export function evaluateAll() {
  let added = false;
  const leg = readLegacy();
  for (const a of ACHIEVEMENTS) {
    try {
      if (!leg.achievements[a.id] && a.check()) {
        leg.achievements[a.id] = Date.now();
        added = true;
        GameState.toast({ title: `ACHIEVEMENT · ${a.name}`, msg: a.desc, kind: 'achievement', dur: 5200 });
        GameState.s.achievements[a.id] = Date.now();
        // Phase D: visual center-screen popup (in addition to the toast).
        GameState.session.lastAchievement = { id: a.id, name: a.name, desc: a.desc, at: Date.now() };
      }
    } catch {
      /* achievements must never crash gameplay */
    }
  }
  if (added) {
    writeLegacy(leg);
    GameState.notify(CH.ACHIEVEMENTS);
  }
}

export function trackKill() {
  bumpStat('kills');
  evaluateAll();
}
export function trackCrafted() {
  bumpStat('crafted');
  evaluateAll();
}
export function trackNightSurvived() {
  bumpStat('nightsSurvived');
  evaluateAll();
}
export function checkLevel(level) {
  evaluateAll();
}
function bumpStat(key) {
  const s = GameState.s.stats;
  s[key] = (s[key] || 0) + 1;
}
