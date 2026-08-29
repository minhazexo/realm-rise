// Side quests offered by NPCs, events and discoveries.
export const SIDE_QUESTS = {
  sq_herbs_for_elara: {
    id: 'sq_herbs_for_elara', title: "Elara's Poultices", giver: 'elara',
    steps: [ { type: 'gather', item: 'herbs', count: 12, text: 'Gather 12 Herbs' }, { type: 'deliver', npc: 'elara', item: 'herbs', count: 12, text: 'Bring herbs to Elara' } ],
    rewards: { xp: 90, items: { healing_salve: 2 }, rep: 6 }
  },
  sq_broken_cart: {
    id: 'sq_broken_cart', title: 'The Broken Cart', eventOnly: true,
    intro: 'A merchant’s cart sits wheel-deep in mud. Bandits may return.',
    steps: [ { type: 'flag', flag: 'cart_escort_done', text: 'Escort Torvald’s cousin to safety (stay close)' } ],
    choicesAtStart: [
      { label: 'Escort them (+reputation)', fx: { escort: true } },
      { label: 'Take the hauling fee (+40 gold)', fx: { gold: 40, rep: -4 } },
      { label: 'Not my problem…', fx: { rep: -8 } }
    ],
    rewards: { xp: 80, rep: 10, gold: 30 }
  },
  sq_missing_hunter: {
    id: 'sq_missing_hunter', title: 'The Missing Hunter',
    steps: [
      { type: 'reach', poiTag: 'crashed_camp', text: 'Find the hunter’s crashed camp' },
      { type: 'kill', enemy: 'wolf', count: 3, text: 'Drive off the wolf pack' },
      { type: 'talk', npc: 'rescue_hunter', text: 'Speak with the grateful hunter' }
    ],
    rewards: { xp: 120, recruitRoll: true, rep: 5 }
  },
  sq_clear_the_den: {
    id: 'sq_clear_the_den', title: 'Clear the Den', repeatable: false,
    steps: [ { type: 'kill', enemy: 'dire_wolf', count: 2, text: 'Slay the Dire Wolves' } ],
    rewards: { xp: 150, res: { fur_pelt: 3 } }
  },
  sq_translation: {
    id: 'sq_translation', title: 'Words in Stone', giver: 'hob',
    steps: [ { type: 'gather', item: 'ancient_relic', count: 3, text: 'Recover 3 Ancient Relics' }, { type: 'deliver', npc: 'hob', item: 'ancient_relic', count: 3, text: 'Deliver relics to Old Hob' } ],
    rewards: { xp: 260, flagsSet: ['ancient_studies'], items: { sage_pendant: 1 } }
  },
  sq_festival_provision: {
    id: 'sq_festival_provision', title: 'A Harvest Worth Dancing About', eventOnly: true,
    steps: [ { type: 'deliver', npc: 'mira', item: 'wheat', count: 20, text: 'Deliver 20 Wheat for the festival' } ],
    rewards: { xp: 100, happinessTown: 10, rep: 4 }
  },
  sq_treasure_cache: {
    id: 'sq_treasure_cache', title: 'X Marks the Spot', itemOnly: true,
    steps: [ { type: 'useItem', itemId: 'treasure_map', text: 'Use a Treasure Map to reveal a cache' } ],
    rewards: {}
  }
};

export const ALL_QUEST_DEFS = {};
