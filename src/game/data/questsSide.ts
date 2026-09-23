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
  },

  // ── THE FIVE REALM SHARDS (brief §14) ──────────────────────────────────────
  // Mara's account of what the barrier was, walked as five links. Each link is
  // offered only after the one before it (requiresFlags), and each asks for a
  // fragment that is a real object in a real place, held by a real enemy —
  // there is no step here that can be completed without going there.
  // The shard's own coordinates, guardian and gate live in data/storyShards.ts;
  // what the player reads on recovery lives in data/voices.ts.
  sq_shard_hearth: {
    id: 'sq_shard_hearth', title: 'First Fragment: the Hearth', giver: 'mara',
    intro: 'Mara starts with the camp, because the camp is closest and she wants you to understand what you are collecting. "The Legion took a fragment off the Ragged Hollow and set it in their standard like a trophy. Their Executioner sleeps under it. Take it back before someone sells it."',
    steps: [ { type: 'flag', flag: 'shard_hearth_taken', text: 'Take the Hearth fragment from the Ragged Hollow standard — the Executioner holds it' } ],
    rewards: { xp: 240, gold: 90, rep: 6, items: { moonstone: 1 } },
    outro: 'One. Mara turns the fragment over twice and does not give it back.'
  },
  sq_shard_green: {
    id: 'sq_shard_green', title: 'Second Fragment: the Green', giver: 'mara',
    requiresFlags: ['shard_hearth_taken'],
    intro: '"The forest was the wall before there were walls. The trees have held a fragment so long they grew through it, and now the Veil is in the wood trying to take it back."',
    steps: [ { type: 'flag', flag: 'shard_green_taken', text: 'Cut the Green fragment free of the Whispering Wood — the dire wolves will not let it go' } ],
    rewards: { xp: 260, gold: 100, rep: 6, items: { healing_salve: 2 } },
    outro: 'Two. The wood sounds different on the way out — like it is listening for the third.'
  },
  sq_shard_watch: {
    id: 'sq_shard_watch', title: 'Third Fragment: the Watch', giver: 'mara',
    requiresFlags: ['shard_green_taken'],
    intro: '"The garrison at the watchtower carried theirs out of the strongroom and died holding the wall with it. Their knight is still standing. I do not think he knows he stopped being alive."',
    steps: [ { type: 'flag', flag: 'shard_watch_taken', text: 'Take the Watch fragment from the Old Watchtower — lay the garrison’s knight to rest first' } ],
    rewards: { xp: 280, gold: 120, rep: 8, items: { iron_ingot: 4 } },
    outro: 'Three. The tower is quiet for the first time in a hundred years.'
  },
  sq_shard_hollow: {
    id: 'sq_shard_hollow', title: 'Fourth Fragment: the Hollow', giver: 'mara',
    requiresFlags: ['shard_watch_taken'],
    intro: '"The hollow is the one that scares me. That anchor was not torn open — someone unsealed it from this side, kindly. Whatever came through is still down there with the fragment."',
    steps: [ { type: 'flag', flag: 'shard_hollow_taken', text: 'Take the Hollow fragment out of the corruption — destroy the thing the Veil left guarding it' } ],
    rewards: { xp: 320, gold: 150, rep: 10, items: { void_ember: 2 } },
    outro: 'Four. The corruption thins behind you like water closing, and then it does not move at all.'
  },
  sq_shard_ash: {
    id: 'sq_shard_ash', title: 'Fifth Fragment: the Ash', giver: 'mara',
    requiresFlags: ['shard_hollow_taken'],
    intro: '"The last one is at the pyre, under the Warden of Ash. It was posted there to keep that fragment before the frontier had a name. It has not been relieved. Go and relieve it."',
    steps: [ { type: 'flag', flag: 'shard_ash_taken', text: 'Break the Warden of Ash and take the fifth fragment from the pyre' } ],
    rewards: { xp: 420, gold: 220, rep: 14, items: { ash_ember: 3 } },
    outro: 'Five. The fragment is cold, and the whole frontier is leaning in to watch what you do with it.'
  },
  sq_shard_barrier: {
    id: 'sq_shard_barrier', title: 'The Fivefold Anchor', giver: 'mara', chapter: 8,
    requiresFlags: ['shard_hearth_taken', 'shard_green_taken', 'shard_watch_taken', 'shard_hollow_taken', 'shard_ash_taken'],
    intro: 'Mara does not have a speech for this one. "The anchor is at the Forsaken Shrine. Five cuts in the stone, five fragments. Put them back and the Veil has nowhere to lean." She pauses. "It will want them back. It has been waiting for someone to carry them all to one place."',
    steps: [ { type: 'flag', flag: 'barrier_restored', text: 'Carry the five fragments to the Fivefold Anchor at the Forsaken Shrine and set them back in the stone' } ],
    rewards: { xp: 900, gold: 400, rep: 25, flagsSet: ['aetheria_remembered'] },
    outro: 'The anchor holds. What that costs, the shrine does not say out loud.',
    ending: true
  }
};
