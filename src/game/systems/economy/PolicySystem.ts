// ─────────────────────────────────────────────────────────────────────────────
// PolicySystem — the behaviour behind Chapter IV's faction bargain: may the
// question be asked yet, which banner is flying, and what it changes in the
// world. One banner, chosen once, saved as a story flag.
//
// Pure of Phaser so the whole decision (standing, happiness, militia, trade)
// is pinned in node (tests/story.mjs). The UI offers it in RulerPanel; the
// quest engine hears the choice as a normal quest event.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../../core/GameState.ts';
import { CH } from '../../core/EventBus.ts';
import { BANNER_POLICIES, POLICY_TOTAL_FLAG, chosenPolicy } from '../../data/policies.ts';
import type { PolicyDef } from '../../data/policies.ts';
import { adjustRel } from './FactionSystem.ts';
import { earnGold } from './EconomySystem.ts';
import { currentMainQuest, stepProgress, handleEvent } from '../narrative/QuestEngine.ts';
import type { GameRootState } from '../../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

/** The quest that asks the question. */
export const BANNER_QUEST = 'q_rising_banner';
export const BANNER_CHOICE = 'banner_policy';

export interface BannerOffer {
  /** The choice is pending: Chapter IV reached, no banner flying. */
  ready: boolean;
  /** Why it is not ready, in one line (UI shows it instead of the buttons). */
  reason?: string;
  /** Which banner is flying, once chosen. */
  chosen: PolicyDef | null;
}

/**
 * Is the banner bargain open right now? The single owner of that rule: the
 * Ruler panel's affordance and applyBannerPolicy both ask this, so the button
 * and the action can never disagree about whether the realm has chosen.
 */
export function bannerBargain(): BannerOffer {
  const S = st();
  if (!S) return { ready: false, reason: 'No realm yet.', chosen: null };
  const chosen: PolicyDef | null = chosenPolicy(S.story.flags) || null;
  if (chosen) return { ready: false, chosen };
  const main = currentMainQuest();
  if (!main || main.id !== BANNER_QUEST) {
    return { ready: false, reason: 'Your banner is not yet big enough to be worth buying.', chosen: null };
  }
  const idx: number = main.steps.findIndex((s) => s.type === 'choice' && s.choiceId === BANNER_CHOICE);
  if (idx < 0) return { ready: false, reason: 'The bargain is not part of this chapter.', chosen: null };
  if (stepProgress(main.id, idx) >= 1) return { ready: false, reason: 'Your banner has already answered.', chosen: null };
  // The bargain is the LAST thing Chapter IV asks for: a realm that has not
  // grown enough to be worth buying does not get to skip the growing.
  for (let i = 0; i < main.steps.length; i++) {
    if (i === idx) continue;
    if (stepProgress(main.id, i) < (main.steps[i]?.count || 1)) {
      return { ready: false, reason: 'Grow the settlement first — the offer comes when the banner means something.', chosen: null };
    }
  }
  return { ready: true, chosen: null };
}

export interface PolicyResult {
  ok: boolean;
  reason?: string;
  policy?: PolicyDef;
}

/**
 * Choose the realm's banner. Applies the whole consequence bundle exactly once
 * and feeds the choice back through the quest engine so Chapter IV can close.
 */
export function applyBannerPolicy(idx: number): PolicyResult {
  const offer: BannerOffer = bannerBargain();
  if (!offer.ready) return { ok: false, reason: offer.reason || 'The bargain is closed.' };
  const policy: PolicyDef | undefined = BANNER_POLICIES[idx];
  if (!policy) return { ok: false, reason: 'Unknown banner.' };

  const S = st();
  S.story.flags[policy.flag] = true;
  S.story.flags[POLICY_TOTAL_FLAG] = true;

  for (const [faction, delta] of Object.entries(policy.factionDeltas)) {
    adjustRel(faction, delta, `banner: ${policy.label}`);
  }
  if (policy.happiness) {
    S.settlement.happiness = Math.max(0, Math.min(100, (S.settlement.happiness || 0) + policy.happiness));
  }
  if (policy.gold) earnGold(policy.gold);
  if (policy.militia && S.settlement.military) {
    S.settlement.military.militia = (S.settlement.military.militia || 0) + policy.militia;
  }

  // The choice is a real quest step: completing it closes Chapter IV and lets
  // the war chapter begin.
  try {
    handleEvent({ type: 'choice', choiceId: BANNER_CHOICE });
  } catch { /* flags above are the source of truth */ }

  GameState.toast({
    title: `THE BANNER: ${policy.label.toUpperCase()}`,
    msg: `${policy.benefit} ${policy.cost}`,
    kind: 'story',
    dur: 9000
  });
  GameState.notify(CH.STORY, CH.FACTIONS, CH.PLAYER, CH.SETTLEMENT);
  return { ok: true, policy };
}

/**
 * What the chosen banner does to prices. Added to the trade context's bonus by
 * TradePanel, so the decision is visible in every merchant's numbers.
 */
export function policyTradeBonus(flags?: Record<string, unknown>): number {
  const f: Record<string, unknown> | undefined = flags || st()?.story?.flags;
  if (!f) return 0;
  return chosenPolicy(f)?.tradeBonus ?? 0;
}
