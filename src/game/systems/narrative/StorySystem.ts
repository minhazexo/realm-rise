// ─────────────────────────────────────────────────────────────────────────────
// Story director (spec §33): drives the eight-chapter arc from quest progress
// and world flags; writes journal entries; emits cinematic cards.
//
// Chapters come from data/chapters.ts and advance only when BOTH the main chain
// has reached the chapter and its gate flags are earned. Gates never block a
// quest — they decide when the realm may claim the chapter is over.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../../core/GameState.ts';
import { Bus, CH } from '../../core/EventBus.ts';
import { JOURNAL_LORE } from '../../data/story.ts';
import { CHAPTER_BY_NUMBER, chapterReached } from '../../data/chapters.ts';
import { chosenPolicy } from '../../data/policies.ts';
import type { GameRootState } from '../../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

export function evaluate(): void {
  const S = st().story;
  const qi: number = st().quests.chainIndex;
  const target: number = chapterReached(qi, S.flags);
  if (target > S.chapter) {
    S.chapter = target;
    const def = CHAPTER_BY_NUMBER[target];
    Bus.emit('chapter-advance', target);
    if (def) addJournal(`chapter_${target}`, def.title, `${def.beat} ${def.question}`);
  }
  syncMilestones();
}

/** Record authored consequences when their real game state becomes true. */
export function syncMilestones(): void {
  const root = st();
  for (const milestone of MILESTONE_JOURNALS) {
    if (milestone.when(root)) addJournal(milestone.key);
  }
}

const MILESTONE_JOURNALS: Array<{ key: string; when: (S: GameRootState) => boolean }> = [
  { key: 'first_fire', when: (S) => S.quests.chainIndex >= 2 },
  { key: 'settlement_founded', when: (S) => !!S.story.flags.settlement_founded },
  { key: 'banner_risen', when: (S) => S.quests.chainIndex >= 6 },
  { key: 'banner_bargain', when: (S) => !!S.story.flags.policy_banner },
  { key: 'war_comes', when: (S) => S.quests.chainIndex >= 8 },
  { key: 'crown_thorns', when: (S) => !!S.story.flags.bandit_king_slain },
  { key: 'secrets_unsealed', when: (S) => !!S.story.flags.secrets_unsealed },
  { key: 'warden_slain', when: (S) => !!S.story.flags.warden_slain },
  { key: 'reliquary_truth', when: (S) => !!S.story.flags.shard_ash_taken },
  { key: 'frontier_holds', when: (S) => !!S.story.flags.barrier_restored },
  { key: 'crown_ember', when: (S) => !!S.story.flags.barrier_restored },
  { key: 'council_called', when: (S) => !!S.story.flags.barrier_restored && (S.settlement?.stageIndex || 0) >= 5 },
  { key: 'ending_concord', when: (S) => !!S.story.flags.ending_concord },
  { key: 'ending_crown', when: (S) => !!S.story.flags.ending_crown },
  { key: 'ending_dominion', when: (S) => !!S.story.flags.ending_dominion }
];

export function addJournal(key: string, titleOverride?: string, bodyOverride?: string): boolean {
  const S = st().story;
  const body: string | undefined = bodyOverride || JOURNAL_LORE[key];
  if (!body) return false;
  if (S.journal.some((j) => j.key === key)) return false;
  const t: string = titleOverride || loreTitle(key);
  S.journal.push({ key, title: t, body, day: st().world.dayCount });
  GameState.notify(CH.STORY);
  return true;
}

function loreTitle(key: string): string {
  const titles: Record<string, string> = {
    shore: 'Grey Shores', deepwood: 'The Deepwood Hush', shrine: 'Kneeling Marks',
    ruins_symbols: 'The Sleeping Eye', ashen_banners: 'Ragged Banners',
    hob_line: 'Old Hob’s History', guardian_wake: 'What We Woke', coronation: 'The Night Before Crowning',
    banner_bargain: 'The Banner’s Bargain', reliquary_truth: 'The Ashen Reliquary',
    warden_slain: 'Relief', council_called: 'The Council at the Shrine',
    ending_concord: 'The Realm Concord', ending_crown: 'The Warden Crown',
    ending_dominion: 'The Ashen Dominion'
  };
  return titles[key] || key;
}

const roman = (n: number): string => (['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] || String(n));
void roman;

/** Ending text for the epilogue screen. */
export interface StoryEnding {
  title: string;
  body: string;
}

/* ── The final council: three governments, each with a price ───────────── */

export type EndingId = 'concord' | 'crown' | 'dominion';

/** Menu order. applyChoice('coronation', idx) indexes this list. */
export const ENDING_IDS: EndingId[] = ['concord', 'crown', 'dominion'];

export interface EndingRequirement {
  label: string;
  ok: boolean;
}

export interface EndingOption {
  idx: number;
  id: EndingId;
  title: string;
  tagline: string;
  cost: string;
  requirements: EndingRequirement[];
  eligible: boolean;
}

/**
 * The three governments, with their requirements resolved against the live
 * realm. Shown transparently before the choice: the player can see why a
 * government is out of reach, and every ending names what it will cost.
 *
 * Dominion is always available on purpose — the uneasy ending is a choice the
 * player is allowed to make, not a punishment for failing a check.
 */
export function endingOptions(): EndingOption[] {
  const S = st();
  const rel = (k: string): number => S?.factions?.[k]?.rel ?? 0;
  const stage: number = S?.settlement?.stageIndex ?? 0;
  const policy = S ? chosenPolicy(S.story.flags) : null;

  const raw: Array<Omit<EndingOption, 'idx' | 'eligible'>> = [
    {
      id: 'concord',
      title: 'The Realm Concord',
      tagline: 'Share the Ember in fifths: a council of five, and a ruler who cannot rule alone.',
      cost: 'You will never act without four other signatures — not even when they are slow, or wrong.',
      requirements: [
        { label: 'Verdant standing 25+', ok: rel('verdant') >= 25 },
        { label: 'League standing 25+', ok: rel('league') >= 25 },
        { label: 'Iron standing above −20', ok: rel('iron') > -20 }
      ]
    },
    {
      id: 'crown',
      title: 'The Warden Crown',
      tagline: 'Bind the Ember to your line. One law, one wall, one watch that never sleeps.',
      cost: 'Safety measured in obedience. The gate keeps a list, and the list only grows.',
      requirements: [
        { label: 'Iron standing 25+', ok: rel('iron') >= 25 },
        { label: 'Kingdom rank reached', ok: stage >= 5 }
      ]
    },
    {
      id: 'dominion',
      title: 'The Ashen Dominion',
      tagline: 'Feed the Veil what you cannot hold, and rule what remains without asking.',
      cost: 'The realm goes quiet in the way a room goes quiet when everyone in it is afraid.',
      requirements: [
        { label: 'Ashen standing above −50, or the Legion’s methods', ok: rel('ashen') > -50 || policy?.id === 'pragmatism' }
      ]
    }
  ];

  return raw.map((o, idx) => ({ ...o, idx, eligible: o.requirements.every((r) => r.ok) }));
}

/** One-line summary of what the chosen banner leans the realm toward. */
export function policyLean(): string {
  const S = st();
  const p = S ? chosenPolicy(S.story.flags) : null;
  if (!p) return 'No banner chosen yet.';
  return `${p.label} — ${p.patron}. ${p.cost}`;
}

/** Ending text for epilogue screen keyed by the chosen government oath. */
export function endingFor(oath: string): StoryEnding {
  const endings: Record<string, StoryEnding> = {
    concord: {
      title: 'THE REALM CONCORD',
      body: 'You do not keep the Crown Ember. You give it away in fifths — to the groves, to the ledgers, to the watch, to the Ashen who came in from the cold, and the last fifth to the shrine, which has waited a very long time to be trusted with anything. The barrier closes like a hand around five smaller hands. You live. You will never rule alone. On the worst nights you will miss the certainty of a single crown; on the mornings after, someone else’s child is alive because four other people had to agree.'
    },
    crown: {
      title: 'THE WARDEN CROWN',
      body: 'You bind the Ember to your line. The frontier goes quiet the way a room goes quiet when the door is locked. Order grows like a wall: grain in every store, a watch on every road, no raid unanswered. Children learn your name before their letters. And in the shrine’s cold water a question keeps its shape — whether a kingdom that cannot imagine its ruler leaving has simply built a better cage. The barrier holds. You are alive. You are also, now, the only door.'
    },
    dominion: {
      title: 'THE ASHEN DOMINION',
      body: 'You take the Legion’s bargain and make it a crown. The Veil is not sealed but fed — fed the land you could not hold, the villages that would not kneel, the ash of everyone who asked whether there had to be another way. The frontier grows quiet and empty and absolutely obedient. The Crown Ember burns in you like a furnace with no grate. You saved the realm. You will spend the rest of your reign deciding what, exactly, you saved it for.'
    },
    conqueror: {
      title: 'THE CONQUEROR’S PEACE',
      body: 'You rule not because crowns kneel easily, but because every banner has tasted your walls and chosen wisdom instead. The realm is one country now, under one law: yours.'
    },
    diplomat: {
      title: 'THE DIPLOMAT’S CROWN',
      body: 'No faction knelt. They married into your court, signed into your roads, invested their grandchildren into your banks. You did not conquer the realm. You became its center of gravity.'
    },
    sage: {
      title: 'THE WISE SOVEREIGN',
      body: 'You rebuilt the Ancient Order’s libraries first and palaces second. When the next darkness stirs in a thousand years, it will find this realm awake, reading, and ready.'
    }
  };
  return endings[oath] || { title: 'A NEW AGE', body: 'Your reign begins.' };
}
