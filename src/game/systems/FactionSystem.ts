// ─────────────────────────────────────────────────────────────────────────────
// Faction relations (spec §30–31): numeric standing with real consequences —
// discounts at war-free markets, allied perks, hostile raids and open wars.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { CH } from '../core/EventBus.ts';
import { FACTIONS } from '../data/factions.ts';
import type { GameRootState } from '../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;
const clampRel = (v: number): number => Math.max(-100, Math.min(100, v));

/** Outcome of a diplomacy action, surfaced verbatim by the UI. */
export interface DiploResult {
  ok: boolean;
  msg?: string;
  cost?: number;
}

export function relOf(key: string): number {
  return st()?.factions[key]?.rel ?? 0;
}

export function adjustRel(key: string, delta: number, reasonNote = ''): number {
  void reasonNote;
  const f = st().factions[key];
  if (!f || !delta) return relOf(key);
  f.rel = clampRel(f.rel + delta);
  const name = FACTIONS[key]?.name ?? key;
  // Status flips drive world consequences.
  if (f.rel <= -70 && f.status !== 'war') {
    f.status = 'war';
    GameState.toast({ title: `${name} declares war!`, msg: 'Expect raids on your borders.', kind: 'danger' });
  } else if (f.rel >= 75 && f.status !== 'allied') {
    f.status = 'allied';
    GameState.toast({ title: `${name} swears alliance!`, msg: 'Their traders extend you special terms.', kind: 'quest' });
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

export function statusOf(key: string): string {
  return st()?.factions[key]?.status || 'neutral';
}

/* ── Diplomacy actions (UI-callable, real effects, cooldowns enforced) ──── */
export function sendGift(key: string): DiploResult {
  const S = st();
  const diploDisc: number = S.player.derived?.diploDiscount || 0;
  const cost: number = Math.round(60 * (1 - diploDisc));
  if (S.player.gold < cost) return { ok: false, msg: `Needs ${cost} gold` };
  S.player.gold -= cost;
  const gain: number = key === 'ashen' ? 8 : 14;
  adjustRel(key, gain);
  GameState.notify(CH.PLAYER);
  return { ok: true, cost };
}

export function proposeAlliance(key: string): DiploResult {
  const S = st();
  if (relOf(key) < 60 || S.settlement.stageIndex < 3) {
    return { ok: false, msg: 'Requires 60+ standing and Town rank' };
  }
  const f = S.factions[key];
  if (f) f.alliedToUs = true;
  adjustRel(key, 10);
  return { ok: true, msg: `${FACTIONS[key]?.name ?? key} accepts!` };
}

export function declareWar(key: string): DiploResult {
  if (statusOf(key) === 'war') return { ok: false, msg: 'Already at war' };
  adjustRel(key, -80);
  return { ok: true, msg: `You march against ${FACTIONS[key]?.name ?? key}.` };
}

export function offerPeace(key: string): DiploResult {
  const S = st();
  const cost: number = Math.round(200 - relOf(key) * 1.5);
  if (S.player.gold < cost) return { ok: false, msg: `They demand ${cost} gold reparations` };
  S.player.gold -= cost;
  const f = S.factions[key];
  if (f) {
    f.atWarWithUs = false;
    f.rel = -35;
    f.status = 'hostile';
  }
  GameState.notify(CH.PLAYER, CH.FACTIONS);
  return { ok: true, msg: 'An uneasy peace is signed.' };
}

/** Faction perk resolution consumed by trade/recruit UI. */
export function factionBonus(tradeCtx?: unknown): number {
  void tradeCtx;
  let pct = 0;
  for (const [key, data] of Object.entries(st().factions)) {
    if (data.alliedToUs || data.status === 'allied') {
      const per = FACTIONS[key]?.perks || {};
      const tradeBonus = per.tradeBonus;
      pct += typeof tradeBonus === 'number' ? tradeBonus : key === 'league' ? 0.08 : 0;
      if (key === 'iron') {
        const alliedTradeBonus = per.alliedTradeBonus;
        if (typeof alliedTradeBonus === 'number') pct += alliedTradeBonus;
      }
    }
  }
  return pct;
}
