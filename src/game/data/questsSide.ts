// Side quests offered by NPCs, events and discoveries.
import type { QuestDef } from './questsMain.ts';

export const SIDE_QUESTS: Record<string, QuestDef> = {
  sq_herbs_for_elara: {
    id: 'sq_herbs_for_elara', title: "Elara's Poultices", giver: 'elara',
    steps: [ { type: 'gather', item: 'herbs', count: 12, text: 'Gather 12 Herbs' }, { type: 'deliver', npc: 'elara', item: 'herbs', count: 12, text: 'Bring herbs to Elara' } ],
    rewards: { xp: 90, items: { healing_salve: 2 }, rep: 6 }
  },
  sq_the_warden_of_ash: {
    id: 'sq_the_warden_of_ash', title: 'The Warden of Ash', giver: 'elara',
    intro: 'Fire walks the old pyre grounds north-east — a crown of embers where a warden used to stand. Whatever the Veil left in that armor, it still keeps its post. Break it, and take its heat for your own.',
    steps: [
      { type: 'reach', poiTag: 'warden_pyre', text: "Find the Warden's Pyre" },
      { type: 'boss', target: 'warden_of_ash', text: 'Defeat the Warden of Ash' }
    ],
    rewards: { xp: 420, flagsSet: ['warden_slain'], items: { emberforged_blade: 1 } }
  },
  // The Ashen Frontier's spine quest (map brief §29): it walks the player
  // through every authored area in the order they were designed for.
  sq_echoes_of_ash: {
    id: 'sq_echoes_of_ash', title: 'Echoes of Ash', giver: 'mara',
    intro: 'Mara survived the night the frontier died. She wants the road walked, the watchtower searched, and whatever is burning at the pyre put out.',
    steps: [
      { type: 'reach', poiTag: 'broken_road', text: 'Follow the broken road' },
      { type: 'reach', poiTag: 'old_watchtower', text: 'Search the Old Watchtower' },
      { type: 'kill', enemy: 'grave_knight', count: 1, text: "Lay the garrison's knight to rest" },
      { type: 'reach', poiTag: 'whispering_forest', text: 'Push into the Whispering Forest' },
      { type: 'reach', poiTag: 'corrupted_hollow', text: 'Find what the Veil is exhaling' },
      { type: 'flag', flag: 'hollow_seal_broken', text: 'Break the corrupted seal' },
      { type: 'flag', flag: 'camp_hostage_freed', text: 'Free the caged villager' },
      { type: 'talk', npc: 'mara', text: 'Bring word back to Mara' },
      { type: 'boss', target: 'warden_of_ash', text: 'End the Warden of Ash' }
    ],
    rewards: { xp: 520, gold: 160, rep: 12, items: { moonstone: 2, ancient_core: 1 }, flagsSet: ['ashen_frontier_cleared'] }
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
