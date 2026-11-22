// ─────────────────────────────────────────────────────────────────────────────
// THE EIGHT-CHAPTER ARC — the chapter-state table from STORY-BIBLE.md, as data.
//
// StorySystem advances a chapter when the main chain reaches its quest AND the
// chapter's entry flags are earned. The gate is deliberately redundant with the
// chain: it never blocks a quest, it only decides when the realm is allowed to
// claim it has reached the next chapter. Each chapter names the one decisive
// quest, the question it asks, and the world-state change that proves it.
//
// Phaser-free and system-free, so a node test can pin the whole arc
// (tests/story.mjs) without a scene.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChapterDef {
  /** 1…8 */
  n: number;
  title: string;
  /** Banner colour for the chapter card. */
  card: string;
  /** The decisive main quest that carries this chapter. */
  questId: string;
  /** Story flags that must already be true before the chapter can be claimed. */
  requires: string[];
  /** What the chapter is about — written to the journal when it begins. */
  beat: string;
  /** The question the chapter leaves the player holding. */
  question: string;
  /** The irreversible change the chapter leaves in the world. */
  worldChange: string;
}

export const CHAPTER_ARC: ChapterDef[] = [
  {
    n: 1,
    title: 'Chapter I — The Stranger',
    card: '#c9c4b4',
    questId: 'q_washed_ashore',
    requires: [],
    beat: 'You wake with salt in your teeth and no name the sea respects. Gather, craft, eat: every small act is a refusal to disappear. Footprints at the tide pools lead away from the water, and they are your size.',
    question: 'Why did I survive when the ship did not?',
    worldChange: 'The shore becomes a place you can leave, not a thing that happened to you.'
  },
  {
    n: 2,
    title: 'Chapter II — The First Fire',
    card: '#e8983f',
    questId: 'q_first_fire',
    requires: [],
    beat: 'The first flame is small and it costs you a whole afternoon of daylight. Wolves circle it — not hunting, waiting — and something further out in the dark avoids the light entirely. In the morning there is a message scratched into driftwood: KEEP THE FIRE.',
    question: 'What is circling beyond the light, and what is it afraid of?',
    worldChange: 'A campfire becomes a safe point on the map, and night becomes a thing with rules.'
  },
  {
    n: 3,
    title: 'Chapter III — A Place to Call Home',
    card: '#6fbf73',
    questId: 'q_the_alpha',
    requires: ['met_hunter_hint'],
    beat: 'Elara marks the den and Grendelfang dies facing the way its pack came from. Beyond the eastern pines Tam is still alive, which is not something this frontier has been handing out lately. The den holds an anchor-mark older than the frontier, and the Town Hall you raise is not a claim on the land — it is a promise that anyone who reaches its fire may stay.',
    question: 'Can strangers become a people?',
    worldChange: 'Your settlement is founded and gains its first named citizen, and the land admits it was protected once.'
  },
  {
    n: 4,
    title: 'Chapter IV — The Rising Banner',
    card: '#e8c94b',
    questId: 'q_rising_banner',
    requires: ['settlement_founded'],
    beat: 'Refugees arrive with the weather. Three powers notice the smoke and offer help on their own terms: the Verdant Clans want open gates, the Merchant League wants signed roads, the Iron Kingdom wants obedience and a garrison. You cannot take all three without becoming someone none of them would trade with.',
    question: 'What kind of realm are we building, and who pays for it?',
    worldChange: 'A banner policy is chosen; it moves prices, standing, and the people who answer your gate.'
  },
  {
    n: 5,
    title: 'Chapter V — War Comes',
    card: '#e05a4e',
    questId: 'q_war_comes',
    requires: ['policy_banner'],
    beat: 'The Ashen Legion raids for warm stones, not land. Their scouts ask after ruins and fragments and pay in coin minted the year the sky opened. Rhogar wears a crown he found in the mud where the barrier fell, and behind him someone with money is collecting pieces of a door.',
    question: 'Who is paying the Legion, and what do they know that you do not?',
    worldChange: 'Raids escalate, the Ashen become redeemable rather than merely hostile, and the dunes open as a route.'
  },
  {
    n: 6,
    title: 'Chapter VI — The Lost Civilization',
    card: '#7be0c3',
    questId: 'q_lost_civilization',
    requires: ['bandit_king_slain'],
    beat: 'Old Hob reads the ruins and does not enjoy what he reads. The Ancient Order opened one anchor to save a city during the first catastrophe, and called the cost necessary. You light the forge and make Dawnbreaker from an Ancient Core — a blade that cuts false bindings, not the dark itself.',
    question: 'What do we owe the mistakes of the dead?',
    worldChange: 'The forge opens, the Ancient truth becomes public, and the first sin has a name.'
  },
  {
    n: 7,
    title: 'Chapter VII — The Frontier Holds',
    card: '#b071e0',
    questId: 'q_ancient_threat',
    requires: ['secrets_unsealed'],
    beat: 'Five anchors held the Veil out, and the frontier has been carrying four of them with its bare hands. Recover the Hearth, the Green, the Watch and the Hollow; relieve the Warden of Ash and take up the Ashen Reliquary it has guarded past the end of its kingdom. Each keeper is an embodied failure — greed, exhaustion, duty, fear — and none of them is a monster.',
    question: 'What kept me alive, and who is still paying for it?',
    worldChange: 'The five fragments are in your hands, the regions they came from are changed, and the shrine at last has something to take.'
  },
  {
    n: 8,
    title: 'Chapter VIII — Crown of the Realm',
    card: '#ffd66b',
    questId: 'q_crown_of_realm',
    requires: ['barrier_restored'],
    beat: 'At the Forsaken Shrine the four fragments and the Ashen Reliquary set themselves into the block, and the shrine asks the fifth question out loud: where is the Crown Ember? The barrier saved one drowned stranger and has been paying for that mercy ever since. Now the realm is yours to hold, and holding it has a shape you have to choose.',
    question: 'What does a ruler owe the people they protect?',
    worldChange: 'A government is chosen, the burden is shared or seized, and your oath is carried into the next life.'
  }
];

/** Chapter by number (1…8). */
export const CHAPTER_BY_NUMBER: Record<number, ChapterDef> = Object.fromEntries(
  CHAPTER_ARC.map((c: ChapterDef) => [c.n, c])
);

/**
 * Chapter per main-chain index (QUEST_ORDER order). Kept in step with
 * `data/questsMain.ts`; tests/story.mjs fails if the lengths drift apart.
 */
export const CHAPTER_AT_CHAIN: number[] = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 8];

/** The chapter the main chain has actually reached, before gating. */
export function chapterForChain(chainIndex: number): number {
  const idx: number = Math.max(0, Math.min(chainIndex | 0, CHAPTER_AT_CHAIN.length - 1));
  return CHAPTER_AT_CHAIN[idx] ?? 1;
}

/** Is this chapter's entry gate earned? Chapter I has no gate. */
export function chapterGateMet(n: number, flags: Record<string, unknown>): boolean {
  const def: ChapterDef | undefined = CHAPTER_BY_NUMBER[n];
  if (!def) return false;
  return def.requires.every((f: string) => !!flags[f]);
}

/**
 * The highest chapter both the chain and the gates allow. Gates never skip:
 * an unmet gate stops the count there, so the journal cannot claim a chapter
 * whose decisive work the player has not done.
 */
export function chapterReached(chainIndex: number, flags: Record<string, unknown>): number {
  const chainChapter: number = chapterForChain(chainIndex);
  let reached = 1;
  for (let n = 2; n <= chainChapter; n++) {
    if (!chapterGateMet(n, flags)) break;
    reached = n;
  }
  return reached;
}
