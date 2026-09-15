// ─────────────────────────────────────────────────────────────────────────────
// Story director (spec §33): drives the eight-chapter arc from quest progress
// and world flags; writes journal entries; emits cinematic cards.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus } from '../core/EventBus.ts';
import { JOURNAL_LORE } from '../data/story.ts';
import type { GameRootState } from '../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

/** Chapter per main-chain index (QUEST_ORDER order). */
const CHAPTER_AT_CHAIN = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 8];

export function evaluate(): void {
  const S = st().story;
  const qi: number = st().quests.chainIndex;
  const target: number = CHAPTER_AT_CHAIN[Math.min(qi, CHAPTER_AT_CHAIN.length - 1)] || S.chapter;
  if (target > S.chapter) {
    S.chapter = target;
    Bus.emit('chapter-advance', target);
    addJournal(`chapter_${target}`, `Chapter ${roman(target)} began.`);
  }
}

export function addJournal(key: string, titleOverride?: string): boolean {
  const S = st().story;
  const body: string | undefined = JOURNAL_LORE[key];
  if (!body) return false;
  if (S.journal.some((j) => j.key === key)) return false;
  const t: string = titleOverride || loreTitle(key);
  S.journal.push({ key, title: t, body, day: st().world.dayCount });
  GameState.notify('STORY');
  return true;
}

function loreTitle(key: string): string {
  const titles: Record<string, string> = {
    shore: 'Grey Shores', deepwood: 'The Deepwood Hush', shrine: 'Kneeling Marks',
    ruins_symbols: 'The Sleeping Eye', ashen_banners: 'Ragged Banners',
    hob_line: 'Old Hob’s History', guardian_wake: 'What We Woke', coronation: 'The Night Before Crowning'
  };
  return titles[key] || key;
}

const roman = (n: number): string => (['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] || String(n));

/** Ending text for the epilogue screen. */
export interface StoryEnding {
  title: string;
  body: string;
}

/** Ending text for epilogue screen keyed by chosen oath. */
export function endingFor(oath: string): StoryEnding {
  const endings: Record<string, StoryEnding> = {
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
