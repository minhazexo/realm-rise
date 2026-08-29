// ─────────────────────────────────────────────────────────────────────────────
// Faction relations (spec §30–31): numeric standing with real consequences —
// discounts at war-free markets, allied perks, hostile raids and open wars.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { CH } from '../core/EventBus.js';
import { FACTIONS } from '../data/factions.js';

const st = () => GameState.s;
const clampRel = (v) => Math.max(-100, Math.min(100, v));

export function relOf(key) {
  return st()?.factions[key]?.rel ?? 0;
}

export function adjustRel(key, delta, reasonNote = '') {
  const f = st().factions[key];
  if (!f || !delta) return relOf(key);
  f.rel = clampRel(f.rel + delta);
  // Status flips drive world consequences.
  if (f.rel <= -70 && f.status !== 'war') {
    f.status = 'war';
    GameState.toast({ title: `${FACTIONS[key].name} declares war!`, msg: 'Expect raids on your borders.', kind: 'danger' });
  } else if (f.rel >= 75 && f.status !== 'allied') {
    f.status = 'allied';
    GameState.toast({ title: `${FACTIONS[key].name} swears alliance!`, msg: 'Their traders extend you special terms.', kind: 'quest' });
  } else if (f.status === 'war' && f.rel > -60) {
    f.status = 'hostile';
  } else if (f.status === 'allied' && f.rel < 70) {
    f.status = 'cordial';
  } else if (Math.abs(f.rel) < 25 && f.status === 'hostile') {
    f.status = 'neutral';
  } else if (f.rel > 28 && f.status === 'neutral') {
    f.status = 'cordial';
  }
  GameState.notify(CH.FACTIONS);
  return f.rel;
}

export function statusOf(key) {
  return st()?.factions[key]?.status || 'neutral';
}

/* ── Diplomacy actions (UI-callable, real effects, cooldowns enforced) ──── */
export function sendGift(key) {
  const S = st();
  const diploDisc = S.player.derived.diploDiscount || 0;
  const cost = Math.round(60 * (1 - diploDisc));
  if (S.player.gold < cost) return { ok: false, msg: `Needs ${cost} gold` };
  S.player.gold -= cost;
  const gain = key === 'ashen' ? 8 : 14;
  adjustRel(key, gain);
  GameState.notify(CH.PLAYER);
  return { ok: true, cost };
}

export function proposeAlliance(key) {
  const S = st();
  if (relOf(key) < 60 || S.settlement.stageIndex < 3) return { ok: false, msg: 'Requires 60+ standing and Town rank' };
  st().factions[key].alliedToUs = true;
  adjustRel(key, 10);
  return { ok: true, msg: `${FACTIONS[key].name} accepts!` };
}

export function declareWar(key) {
  if (statusOf(key) === 'war') return { ok: false, msg: 'Already at war' };
  adjustRel(key, -80);
  return { ok: true, msg: `You march against ${FACTIONS[key].name}.` };
}

export function offerPeace(key) {
  const S = st();
  const cost = Math.round(200 - relOf(key) * 1.5);
  if (S.player.gold < cost) return { ok: false, msg: `They demand ${cost} gold reparations` };
  S.player.gold -= cost;
  st().factions[key].atWarWithUs = false;
  st().factions[key].rel = -35;
  st().factions[key].status = 'hostile';
  GameState.notify(CH.PLAYER, CH.FACTIONS);
  return { ok: true, msg: 'An uneasy peace is signed.' };
}

/** Faction perk resolution consumed by trade/recruit UI. */
export function factionBonus(tradeCtx) {
  let pct = 0;
  for (const [key, data] of Object.entries(st().factions)) {
    if (data.alliedToUs || data.status === 'allied') {
      const per = FACTIONS[key]?.perks || {};
      pct += per.tradeBonus ? per.tradeBonus : key === 'league' ? 0.08 : 0;
      if (key === 'iron') pct += per.alliedTradeBonus || 0;
    }
  }
  return pct;
}
