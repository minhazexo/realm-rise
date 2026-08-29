// The five great powers contesting the realm (spec §30–31).
export const FACTIONS = {
  iron: {
    key: 'iron', name: 'The Iron Kingdom', color: '#9aa7b8', icon: 'castle',
    creed: 'Order through strength.',
    home: 'Northern mountains', unitStyle: 'legionnaires',
    baseRel: -5,
    perks: { alliedTradeBonus: 0.15 },
    likes: { warriorSells: true, tributeSteel: 'steel_ingot' },
    notes: 'Their quartermasters buy weapons dear and sell steel fair — if they trust you.'
  },
  verdant: {
    key: 'verdant', name: 'The Verdant Clans', color: '#6fbf73', icon: 'leaf',
    creed: 'The wild provides for those who listen.',
    home: 'Deepwood reaches',
    baseRel: 8,
    perks: { herbalismBonus: 0.15 },
    notes: 'Herbalists and huntsmen. Aid villages and spare wildlife to earn their nod.'
  },
  league: {
    key: 'league', name: 'The Merchant League', color: '#e8c94b', icon: 'coin',
    creed: 'Every wall has a price.',
    home: 'Riverbend cities',
    baseRel: 0,
    perks: { tradeBonus: 0.08 },
    notes: 'Caravans respect gold and contracts above crowns.'
  },
  ashen: {
    key: 'ashen', name: 'The Ashen Legion', color: '#e05a4e', icon: 'flame',
    creed: 'From ashes, dominion.',
    home: 'Volcanic south',
    baseRel: -45,
    perks: {},
    notes: 'Bandit camps fly their ragged banners. Expect fire, not treaties.'
  },
  ancient: {
    key: 'ancient', name: 'The Ancient Order', color: '#7be0c3', icon: 'rune',
    creed: 'What sleeps must not be woken carelessly.',
    home: 'Ruins scattered everywhere',
    baseRel: 0,
    perks: { revealsRuins: true },
    notes: 'Faceless scholars who trade relics knowledge — for relics.'
  }
};

export const REL_STAGES = [
  { min: 75, label: 'Allied' },
  { min: 30, label: 'Cordial' },
  { min: -30, label: 'Neutral' },
  { min: -70, label: 'Hostile' },
  { min: -999, label: 'War' }
];

export const relLabel = (v) => REL_STAGES.find((s) => v >= s.min)?.label || 'Neutral';
export const getFactionDef = (key) => FACTIONS[key] || null;
