// ─────────────────────────────────────────────────────────────────────────────
// Main story quest chain (spec §32–33). Steps are driven purely by gameplay
// events emitted from the world sim. Choices apply consequences.
// Step types: gather | kill | boss | craft | build | reach | talk | flag |
//             deliver | population | stage | stores
// ─────────────────────────────────────────────────────────────────────────────

export const MAIN_QUESTS = {
  q_washed_ashore: {
    id: 'q_washed_ashore', chapter: 1, title: 'The Stranger',
    giver: 'narrator',
    steps: [
      { type: 'gather', item: 'wood', count: 10, text: 'Gather Wood from the forest' },
      { type: 'gather', item: 'fiber', count: 6, text: 'Tear Plant Fiber from bushes' }
    ],
    rewards: { xp: 60, items: { torch: 2 } },
    outro: 'Enough timber for a fire — and something to burn in it.'
  },
  q_first_fire: {
    id: 'q_first_fire', chapter: 2, title: 'The First Fire',
    steps: [
      { type: 'craft', itemId: 'axe_stone', count: 1, text: 'Craft a Stone Axe' },
      { type: 'build', building: 'campfire', count: 1, text: 'Raise a Campfire at dusk-adjacent ground' },
      { type: 'craft', itemId: 'cooked_meat', count: 1, text: 'Cook raw meat over your campfire' }
    ],
    rewards: { xp: 90, items: { wooden_sword: 1 } },
    grantWeapon: 'wooden_sword'
  },
  q_fangs_in_the_dark: {
    id: 'q_fangs_in_the_dark', chapter: 2, title: 'Fangs in the Dark',
    steps: [
      { type: 'kill', enemy: 'wolf', count: 3, text: 'Slay wolves prowling the deepwood' },
      { type: 'surviveNight', text: 'Survive until dawn' }
    ],
    rewards: { xp: 130, res: { leather_hide: 0 } },
    flagsOnComplete: ['met_hunter_hint']
  },
  q_the_alpha: {
    id: 'q_the_alpha', chapter: 3, title: 'Grendelfang',
    intro: 'Elara marks a wolf-den west of the river.',
    steps: [
      { type: 'reach', poiTag: 'wolf_den', text: 'Find the den marked on your map' },
      { type: 'boss', target: 'alpha_wolf', text: 'Kill Grendelfang, Alpha of the Deepwood' }
    ],
    rewards: { xp: 200, gold: 80 },
    flagsOnComplete: ['alpha_slain']
  },
  q_place_to_call_home: {
    id: 'q_place_to_call_home', chapter: 3, title: 'A Place to Call Home',
    steps: [
      { type: 'build', building: 'townhall', count: 1, text: "Place your Town Hall using the Founder's Kit" },
      { type: 'build', building: 'campfire', count: 1, text: 'Keep a campfire inside your settlement' },
      { type: 'recruit', npc: 'tam', text: 'Rescue Tam beyond the eastern pines' }
    ],
    rewards: { xp: 220 },
    flagsOnComplete: ['settlement_founded']
  },
  q_rising_banner: {
    id: 'q_rising_banner', chapter: 4, title: 'The Rising Banner',
    steps: [
      { type: 'population', count: 3, text: 'Grow your people to three souls' },
      { type: 'build', building: 'farm', count: 1, text: 'Plot a Farm' },
      { type: 'build', building: 'storage_chest', count: 1, text: 'Build a Storehouse Chest' }
    ],
    rewards: { xp: 260, gold: 60 }
  },
  q_iron_in_the_veins: {
    id: 'q_iron_in_the_veins', chapter: 4, title: 'Iron in the Veins',
    steps: [
      { type: 'build', building: 'forge', count: 1, text: 'Erect a Blacksmith Forge' },
      { type: 'craft', itemId: 'iron_sword', count: 1, text: 'Forge an Iron Sword' },
      { type: 'stores', resource: 'iron_ingot', count: 5, text: 'Stockpile 5 Iron Ingots' }
    ],
    rewards: { xp: 300 }
  },
  q_war_comes: {
    id: 'q_war_comes', chapter: 5, title: 'War Comes',
    intro: 'Ragged banners have been sighted — the Ashen Legion stirs.',
    steps: [
      { type: 'kill', enemy: 'bandit_scout', count: 4, text: 'Drive off Bandit Scouts raiding your lands' },
      { type: 'build', building: 'watchtower', count: 1, text: 'Watch the roads with a Watchtower' },
      { type: 'raid_defended', text: 'Survive an Ashen night raid' }
    ],
    rewards: { xp: 340 }
  },
  q_the_bandit_king: {
    id: 'q_the_bandit_king', chapter: 5, title: 'The Crown of Thorns',
    intro: 'A treasure map recovered from Captain Vex leads to Rhogar’s hollow crown…',
    steps: [
      { type: 'reach', poiTag: 'bandit_king_camp', text: 'March to Rhogar’s fortress-camp' },
      { type: 'boss', target: 'bandit_king', text: 'Break the Bandit King' }
    ],
    rewards: { xp: 450, gold: 300 },
    flagsOnComplete: ['bandit_king_slain']
  },
  q_lost_civilization: {
    id: 'q_lost_civilization', chapter: 6, title: 'The Lost Civilization',
    steps: [
      { type: 'reachCount', poiKind: 'ruins', count: 3, text: 'Discover 3 Ancient Ruin sites' },
      { type: 'talk', npc: 'hob', text: 'Consult Old Hob of the Library' },
      { type: 'flag', flag: 'ancient_forge_lit', text: 'Reforged the Ancient Core into Dawnbreaker' }
    ],
    rewards: { xp: 550 },
    flagsOnComplete: ['secrets_unsealed']
  },
  q_ancient_threat: {
    id: 'q_ancient_threat', chapter: 7, title: 'The Ancient Threat',
    intro: 'Hob’s translation is grim: a Warden beneath the Great Ruins must never wake. It already has.',
    steps: [
      { type: 'reach', poiTag: 'great_ruins', text: 'Descend to the sunken amphitheater' },
      { type: 'boss', target: 'ancient_guardian', text: 'Silence the Ancient Guardian' }
    ],
    rewards: { xp: 800, gold: 500 },
    flagsOnComplete: ['guardian_slain']
  },
  q_crown_of_realm: {
    id: 'q_crown_of_realm', chapter: 8, title: 'Crown of the Realm',
    steps: [
      { type: 'stage', index: 5, text: 'Ascend your realm to Kingdom status' },
      { type: 'territory', count: 40, text: 'Control 40% of the known realm' },
      { type: 'choice', choiceId: 'coronation', text: 'Decide the fate of the realm at your coronation' }
    ],
    rewards: { xp: 1200 },
    ending: true
  }
};

export const QUEST_ORDER = Object.keys(MAIN_QUESTS);
