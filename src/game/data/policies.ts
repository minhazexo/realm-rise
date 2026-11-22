// ─────────────────────────────────────────────────────────────────────────────
// THE BANNER'S BARGAIN — the one faction decision the realm cannot postpone.
//
// Chapter IV ends with a choice whose consequences are real systems, not a
// dialogue colour: standing with the five powers, town happiness, the size of
// the militia, and the price of everything you buy and sell. One banner only.
// The chosen flag is also what the final council reads when it asks what kind
// of realm you built (StorySystem.endingOptions).
//
// Text only — no Phaser, no state (tests/story.mjs pins the table).
// ─────────────────────────────────────────────────────────────────────────────

export interface PolicyDef {
  /** Position in the offer menu; applyBannerPolicy takes this index. */
  idx: number;
  id: 'generosity' | 'pragmatism' | 'discipline';
  /** Story flag written once, forever. */
  flag: string;
  label: string;
  /** The power that offers it. */
  patron: string;
  /** What they ask, in their own voice. */
  offer: string;
  /** The concrete thing the realm gains. */
  benefit: string;
  /** The concrete thing the realm pays. */
  cost: string;
  factionDeltas: Record<string, number>;
  /** Added to the trade context's bonus: higher = cheaper buys, richer sells. */
  tradeBonus: number;
  happiness: number;
  gold: number;
  /** Militia mustered by the Iron garrison. */
  militia: number;
}

export const BANNER_POLICIES: PolicyDef[] = [
  {
    idx: 0,
    id: 'generosity',
    flag: 'policy_generosity',
    label: 'The Open Granary',
    patron: 'Verdant Clans',
    offer: 'Elara will fill your stores and teach your fields, if your gate stays open to anyone who reaches it — clan, refugee, or stranger with an empty bowl.',
    benefit: '+12 Verdant standing · +6 town happiness · fair prices on everything you sell (+3% trade).',
    cost: 'The League reads open gates as unpaid contracts: −8 League, −3 Iron. The granary will be empty some weeks.',
    factionDeltas: { verdant: 12, league: -8, iron: -3 },
    tradeBonus: 0.03,
    happiness: 6,
    gold: 0,
    militia: 0
  },
  {
    idx: 1,
    id: 'pragmatism',
    flag: 'policy_pragmatism',
    label: 'The Signed Road',
    patron: 'Merchant League',
    offer: 'Torvald will underwrite your roads and your granary, if the realm trades on League paper and honors League contracts before clan custom.',
    benefit: '+14 League standing · 120 gold on signing · cheaper goods across the frontier (buy prices drop about 8%).',
    cost: 'The clans lose the commons they were promised: −8 Verdant, −4 Iron. Some of your people will find the ledger colder than the fire.',
    factionDeltas: { league: 14, verdant: -8, iron: -4 },
    tradeBonus: 0.08,
    happiness: 0,
    gold: 120,
    militia: 0
  },
  {
    idx: 2,
    id: 'discipline',
    flag: 'policy_discipline',
    label: 'The Iron Levy',
    patron: 'Iron Kingdom',
    offer: 'The Iron Kingdom will post a garrison, raise a wall, and hold your roads to one law — on the Crown’s terms, and with the Crown’s officer at your table.',
    benefit: '+14 Iron standing · 8 militia mustered at your hall · raids met at the gate instead of the square.',
    cost: 'Your people trade freedom for safety: −4 happiness, −8 Verdant, −6 League. The gate now has a list.',
    factionDeltas: { iron: 14, verdant: -8, league: -6 },
    tradeBonus: 0.02,
    happiness: -4,
    gold: 0,
    militia: 8
  }
];

export const POLICY_FLAGS: string[] = BANNER_POLICIES.map((p: PolicyDef) => p.flag);

/** Written alongside the chosen banner — “a banner has been chosen”. */
export const POLICY_TOTAL_FLAG = 'policy_banner';

export function policyById(id: string): PolicyDef | null {
  return BANNER_POLICIES.find((p: PolicyDef) => p.id === id) || null;
}

export function policyByFlag(flag: string): PolicyDef | null {
  return BANNER_POLICIES.find((p: PolicyDef) => p.flag === flag) || null;
}

/** The banner the realm flies, or null while the bargain is still open. */
export function chosenPolicy(flags: Record<string, unknown>): PolicyDef | null {
  return BANNER_POLICIES.find((p: PolicyDef) => !!flags[p.flag]) || null;
}
