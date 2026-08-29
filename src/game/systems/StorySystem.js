// ─────────────────────────────────────────────────────────────────────────────
// Story director (spec §33): drives the eight-chapter arc from quest progress
// and world flags; writes journal entries; emits cinematic cards.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';
import { JOURNAL_LORE } from '../data/story.js';

const st = () => GameState.s;

/** Chapter per main-chain index (QUEST_ORDER order). */
const CHAPTER_AT_CHAIN = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 8];

export function evaluate() {
  const S = st().story;
  const qi = st().quests.chainIndex;
  const target = CHAPTER_AT_CHAIN[Math.min(qi, CHAPTER_AT_CHAIN.length - 1)] || S.chapter;
  if (target > S.chapter) {
    S.chapter = target;
    Bus.emit('chapter-advance', target);
    addJournal(`chapter_${target}`, `Chapter ${roman(target)} began.`);
  }
}

export function addJournal(key, titleOverride) {
  const S = st().story;
  if (!JOURNAL_LORE[key]) return false;
  if (S.journal.some((j) => j.key === key)) return false;
  const t = titleOverride || loreTitle(key);
  S.journal.push({ key, title: t, body: JOURNAL_LORE[key], day: st().world.dayCount });
  GameState.notify('STORY');
  return true;
}

function loreTitle(key) {
  const titles = {
    shore: 'Grey Shores', deepwood: 'The Deepwood Hush', shrine: 'Kneeling Marks',
    ruins_symbols: 'The Sleeping Eye', ashen_banners: 'Ragged Banners',
    hob_line: 'Old Hob’s History', guardian_wake: 'What We Woke', coronation: 'The Night Before Crowning'
  };
  return titles[key] || key;
}

const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] || String(n);

/** Ending text for epilogue screen keyed by chosen oath. */
export function endingFor(oath) {
  return {
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
  }[oath] || { title: 'A NEW AGE', body: 'Your reign begins.' };
}
