// Chapters & narrative beats (spec §33). Advancement conditions are checked by
// StorySystem whenever relevant gameplay events fire.

export const INTRO_SLIDES = [
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

export const CHAPTERS = {
  1: { title: 'Chapter I — The Stranger', card: '#c9c4b4' },
  2: { title: 'Chapter II — The First Fire', card: '#e8983f' },
  3: { title: 'Chapter III — A Place to Call Home', card: '#6fbf73' },
  4: { title: 'Chapter IV — The Rising Banner', card: '#e8c94b' },
  5: { title: 'Chapter V — War Comes', card: '#e05a4e' },
  6: { title: 'Chapter VI — The Lost Civilization', card: '#7be0c3' },
  7: { title: 'Chapter VII — The Ancient Threat', card: '#b071e0' },
  8: { title: 'Chapter VIII — Crown of the Realm', card: '#ffd66b' }
};

export const JOURNAL_LORE = {
  shore: 'Survived a shipwreck. Someone before me survived it too — there are footprints by the tide pools that are not mine.',
  deepwood: 'Wolves here hunt in silence. That is wrong; wolves should sing.',
  shrine: 'An old shrine wore circles of worn-away kneeling marks. Whatever they worshipped left before we learned its name.',
  ruins_symbols: 'Ruined archways keep repeating the same spiral sigil. Elara calls it “the sleeping eye”.',
  ashen_banners: 'Bandit camps fly scorched banners of the Ashen Legion. They serve something further south.',
  hob_line: 'Old Hob says the realm was once ruled from a single shining city, and that the Ancients unmade themselves rather than surrender it.',
  guardian_wake: 'The Warden beneath the Great Ruins answers only to an Ancient Core. We gave one life again. It heard us.',
  coronation: 'Banners from every surviving faction now face my hall. Tonight the realm decides what I am to become.'
};
