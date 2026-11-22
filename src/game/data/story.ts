// Chapters & narrative beats (spec §33). Advancement conditions are checked by
// StorySystem whenever relevant gameplay events fire. The chapter table itself
// lives in data/chapters.ts — this file owns the prose the player reads.
import { CHAPTER_ARC } from './chapters.ts';

export interface IntroSlide {
  title: string;
  body: string;
}

export const INTRO_SLIDES: IntroSlide[] = [
  {
    title: 'They said the ship would reach the Golden Coast.',
    body: 'It never did. The storm took everything — cargo, crew, and the world you knew.'
  },
  {
    title: 'You wake on a grey shore with salt-ruined clothes,',
    body: 'a wooden sword someone carved into driftwood, and hunger as your only compass.'
  },
  {
    title: 'Beyond the dunes rise forests older than maps.',
    body: 'Smoke from distant fires. Banners you do not know. Ruins that hum at night.'
  },
  {
    title: 'This land has no name anymore.',
    body: 'Perhaps it is waiting for someone foolish enough to give it one.'
  }
];

export interface ChapterInfo {
  title: string;
  card: string;
}

/**
 * The playable opening's emotional promise. Kept separate from the legacy
 * slideshow so older saves and references remain safe while the UI upgrades.
 */
export const STORY_INTRO_SLIDES: IntroSlide[] = [
  {
    title: 'The sea should have taken you.',
    body: 'It took the ship, the crew, and every name you knew. Still, a lantern burned beneath the waves, and something pulled you toward the shore.'
  },
  {
    title: 'You wake on a grey shore.',
    body: 'Salt-ruined clothes. A driftwood blade. Footprints leading away from the tide pools that cannot belong to anyone else.'
  },
  {
    title: 'Beyond the dunes, a single fire answers.',
    body: 'Forests older than maps wait in the dark. Smoke rises from distant homes. Ruins hum when the night is listening.'
  },
  {
    title: 'Keep the fire.',
    body: 'Make a place where strangers can stay. The frontier has forgotten its name. It is waiting to learn whether it still has a future.'
  }
];

/**
 * Chapter cards, derived from the arc so a title can never drift out of step
 * with its gate. The arc is the canon; this is the same table in UI shape.
 */
export const CHAPTERS: Record<number, ChapterInfo> = Object.fromEntries(
  CHAPTER_ARC.map((c) => [c.n, { title: c.title, card: c.card }])
);

export const JOURNAL_LORE: Record<string, string> = {
  opening_shore: 'The sea should have taken me. Instead, a light moved beneath the water and led me ashore. The footprints at the tide pools look like mine, though I do not remember making them.',
  first_fire: 'The first flame is small, but it holds the dark back. A home begins when someone believes the light will still be here tomorrow.',
  settlement_founded: 'The Town Hall is not a claim on this land. It is a promise: anyone who reaches this fire may stay.',
  banner_risen: 'Three people call this place home. That is enough for a banner to mean something—and enough for someone to want to tear it down.',
  banner_bargain: 'Three powers offered to hold my banner up, and each of them meant to hold the hand that carries it. I chose one. The other two are still out there, remembering what I refused.',
  war_comes: 'The Ashen Legion is not raiding for land. Their scouts ask after warm stones and old ruins. Someone is paying them to find what should have stayed buried.',
  crown_thorns: 'Rhogar wore a crown hollowed out by fear. He thought walls and obedience could keep abandonment away. It never can.',
  secrets_unsealed: 'The Ancients did not lose the realm in one night. They opened a seal to save a city, then called the cost necessary. The Veil remembers every necessary thing.',
  warden_slain: 'The Warden of Ash said one word when it fell: RELIEF. It had been posted to a kingdom that stopped existing, and nobody ever came to relieve it. It was never a monster. It was a guard nobody remembered to send home.',
  reliquary_truth: 'The fifth thing they call the Ashen Reliquary is not a stone. It is the Warden’s own oath, made into a vessel, and it can stand in the fifth cut at the shrine. What it cannot do is give back the life the Crown Ember spent to keep me breathing.',
  frontier_holds: 'The anchors were never weapons. They were promises kept by people, forests, and those posted to stand when everyone else had gone.',
  council_called: 'I called the surviving powers to the Forsaken Shrine because a crown that decides alone is only a louder kind of silence. They came. Each of them brought a grievance and called it a condition.',
  crown_ember: 'The fifth light was not lost at sea. It is inside me. The barrier saved one drowning stranger, and the frontier has been paying for that mercy ever since.',
  ending_concord: 'I gave the burden away in fifths. I still carry the Ember, but I cannot spend it without four other voices in the room. Some mornings that feels like a cage. Most mornings it sounds like a kingdom.',
  ending_crown: 'I bound the Ember to the line and the frontier went quiet. Grain in every store, a watch on every road, no raid unanswered. I am the door now. Doors do not get to leave.',
  ending_dominion: 'I paid the Veil in conquered ground and called the ledger victory. The realm is safe, quiet, and mine. I saved it. The rest of my life is the part where I find out what for.',
  shore: 'Survived a shipwreck. Someone before me survived it too — there are footprints by the tide pools that are not mine.',
  deepwood: 'Wolves here hunt in silence. That is wrong; wolves should sing.',
  shrine: 'An old shrine wore circles of worn-away kneeling marks. Whatever they worshipped left before we learned its name.',
  ruins_symbols: 'Ruined archways keep repeating the same spiral sigil. Elara calls it “the sleeping eye”.',
  ashen_banners: 'Bandit camps fly scorched banners of the Ashen Legion. They serve something further south.',
  hob_line: 'Old Hob says the realm was once ruled from a single shining city, and that the Ancients unmade themselves rather than surrender it.',
  guardian_wake: 'The Warden beneath the Great Ruins answers only to an Ancient Core. We gave one life again. It heard us.',
  coronation: 'Banners from every surviving faction now face my hall. Tonight the realm decides what I am to become.'
};
