// ─────────────────────────────────────────────────────────────────────────────
// Main story quest chain (spec §32–33). Steps are driven purely by gameplay
// events emitted from the world sim. Choices apply consequences.
// Step types: gather | kill | boss | craft | build | reach | talk | flag |
//             deliver | population | stage | stores
//
// The chapter map lives in data/chapters.ts; this is the work each chapter
// actually asks for. Flag steps are read lazily by QuestEngine.stepProgress, so
// a save that already did the work is never asked to do it again.
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestStep {
  type: string;
  text: string;
  item?: string;
  itemId?: string;
  count?: number;
  enemy?: string;
  target?: string;
  building?: string;
  poiTag?: string;
  poiKind?: string;
  npc?: string;
  flag?: string;
  resource?: string;
  index?: number;
  choiceId?: string;
}

export interface QuestRewards {
  xp?: number;
  items?: Record<string, number>;
  gold?: number;
  res?: Record<string, number>;
  rep?: number;
  recruitRoll?: boolean;
  flagsSet?: string[];
  happinessTown?: number;
}

export interface QuestChoice {
  label: string;
  // Consequence payload keys vary per choice (gold, rep, escort flag, ...).
  fx: Record<string, number | boolean>;
}

export interface QuestDef {
  id: string;
  title: string;
  chapter?: number;
  giver?: string;
  intro?: string;
  outro?: string;
  steps: QuestStep[];
  rewards: QuestRewards;
  flagsOnComplete?: string[];
  /**
   * Side quests only: every one of these story flags must already be set before
   * the quest can be offered (the shard chain gates each link on the one before
   * it). Checked in QuestSystem.offerSideQuest and WorldScene.isSideAvailable.
   */
  requiresFlags?: string[];
  grantWeapon?: string;
  eventOnly?: boolean;
  itemOnly?: boolean;
  repeatable?: boolean;
  choicesAtStart?: QuestChoice[];
  ending?: boolean;
}

export const MAIN_QUESTS: Record<string, QuestDef> = {
  q_washed_ashore: {
    id: 'q_washed_ashore', chapter: 1, title: 'The Stranger',
    giver: 'narrator',
    intro: 'The sea left you a shore, a driftwood blade, and no explanation. Gather enough to last the first night — not because the wood matters, but because stopping does.',
    steps: [
      { type: 'gather', item: 'wood', count: 10, text: 'Gather Wood from the forest' },
      { type: 'gather', item: 'fiber', count: 6, text: 'Tear Plant Fiber from bushes' }
    ],
    rewards: { xp: 60, items: { torch: 2 } },
    outro: 'Enough timber for a fire — and something to burn in it.'
  },
  q_first_fire: {
    id: 'q_first_fire', chapter: 2, title: 'The First Fire',
    intro: 'Timber, a cutting edge, and something worth cooking. A fire is not warmth; it is a promise that tomorrow has somewhere to happen.',
    steps: [
      { type: 'craft', itemId: 'axe_stone', count: 1, text: 'Craft a Stone Axe' },
      { type: 'build', building: 'campfire', count: 1, text: 'Raise a Campfire at dusk-adjacent ground' },
      { type: 'craft', itemId: 'cooked_meat', count: 1, text: 'Cook raw meat over your campfire' }
    ],
    rewards: { xp: 90, items: { wooden_sword: 1 } },
    grantWeapon: 'wooden_sword',
    outro: 'The flame takes. Somewhere out past the treeline, something that had been drifting toward your shore turns away from the light.'
  },
  q_fangs_in_the_dark: {
    id: 'q_fangs_in_the_dark', chapter: 2, title: 'Fangs in the Dark',
    intro: 'Something is pacing the edge of the firelight and it is not hungry. Wolves do not go quiet for weather.',
    steps: [
      { type: 'kill', enemy: 'wolf', count: 3, text: 'Slay wolves prowling the deepwood' },
      { type: 'surviveNight', text: 'Survive until dawn' }
    ],
    rewards: { xp: 130, res: { leather_hide: 0 } },
    flagsOnComplete: ['met_hunter_hint'],
    outro: 'Dawn comes grey and ordinary. Your fire is still burning, and the wolves are gone — but they were not hunting you, and that is the part you keep turning over.'
  },
  q_the_alpha: {
    id: 'q_the_alpha', chapter: 3, title: 'Grendelfang',
    intro: 'Elara marks a wolf-den west of the river. The pack is not defending territory — it is standing between you and something older.',
    steps: [
      { type: 'reach', poiTag: 'wolf_den', text: 'Find the den marked on your map' },
      { type: 'boss', target: 'alpha_wolf', text: 'Kill Grendelfang, Alpha of the Deepwood' }
    ],
    rewards: { xp: 200, gold: 80 },
    flagsOnComplete: ['alpha_slain'],
    outro: 'Grendelfang dies facing the way its pack came from. In the den, cut into a stone older than the frontier, is the same anchor-mark you saw in your dreams on the water.'
  },
  q_place_to_call_home: {
    id: 'q_place_to_call_home', chapter: 3, title: 'A Place to Call Home',
    intro: 'Tam is alive beyond the eastern pines. People are already gathering at your fire — that is a promise you will have to keep.',
    steps: [
      { type: 'build', building: 'townhall', count: 1, text: "Place your Town Hall using the Founder's Kit" },
      { type: 'build', building: 'campfire', count: 1, text: 'Keep a campfire inside your settlement' },
      { type: 'recruit', npc: 'tam', text: 'Rescue Tam beyond the eastern pines' }
    ],
    rewards: { xp: 220 },
    flagsOnComplete: ['settlement_founded'],
    outro: 'The hall goes up crooked and stays up anyway. Tam carries the first load of stone through the door, and someone you have never met asks whether there is room for one more.'
  },
  q_rising_banner: {
    id: 'q_rising_banner', chapter: 4, title: 'The Rising Banner',
    intro: 'Refugees arrive with the weather. Three powers have noticed the smoke, and all three are being very generous.',
    steps: [
      { type: 'population', count: 3, text: 'Grow your people to three souls' },
      { type: 'build', building: 'farm', count: 1, text: 'Plot a Farm' },
      { type: 'build', building: 'storage_chest', count: 1, text: 'Build a Storehouse Chest' },
      { type: 'choice', choiceId: 'banner_policy', text: 'Hear the three offers and choose your banner (Crown panel, R)' }
    ],
    rewards: { xp: 260, gold: 60, rep: 8 },
    outro: 'The banner goes up over a town that did not exist a season ago. It is visible from the road now, which means the road will start sending you things — some of them people, some of them bills.'
  },
  q_iron_in_the_veins: {
    id: 'q_iron_in_the_veins', chapter: 4, title: 'Iron in the Veins',
    intro: 'A forge is the difference between a camp that survives winter and a town that sells ploughs in spring. Kara will want a real anvil, not a rock with opinions.',
    steps: [
      { type: 'build', building: 'forge', count: 1, text: 'Erect a Blacksmith Forge' },
      { type: 'craft', itemId: 'iron_sword', count: 1, text: 'Forge an Iron Sword' },
      { type: 'stores', resource: 'iron_ingot', count: 5, text: 'Stockpile 5 Iron Ingots' }
    ],
    rewards: { xp: 300 },
    outro: 'The first bar comes out of the forge grey and honest. Kara holds it up to the light, grunts, and starts planning something she will not describe to you yet.'
  },
  q_war_comes: {
    id: 'q_war_comes', chapter: 5, title: 'War Comes',
    intro: 'Ragged banners have been sighted — the Ashen Legion stirs. They are asking the frontier for warm stones, and paying in coin that should not exist anymore.',
    steps: [
      { type: 'kill', enemy: 'bandit_scout', count: 4, text: 'Drive off Bandit Scouts raiding your lands' },
      { type: 'build', building: 'watchtower', count: 1, text: 'Watch the roads with a Watchtower' },
      { type: 'raid_defended', text: 'Survive an Ashen night raid' }
    ],
    rewards: { xp: 340 },
    outro: 'The raid breaks on your wall and leaves its dead in the mud. In a scout’s satchel: a purse of coin minted the year the sky opened, and a scrap of a manifest that says CRATE — DO NOT OPEN — SOUTH.'
  },
  q_the_bandit_king: {
    id: 'q_the_bandit_king', chapter: 5, title: 'The Crown of Thorns',
    intro: 'A treasure map recovered from Captain Vex leads to Rhogar’s hollow crown — and to the buyer who pays him by the fragment.',
    steps: [
      { type: 'reach', poiTag: 'bandit_king_camp', text: 'March to Rhogar’s fortress-camp' },
      { type: 'boss', target: 'bandit_king', text: 'Break the Bandit King' }
    ],
    rewards: { xp: 450, gold: 300 },
    flagsOnComplete: ['bandit_king_slain'],
    outro: 'Rhogar’s crown is only iron again once it hits the floor. He was paid by the fragment, by someone who never came to collect — which means the buyer is still out there, and still counting.'
  },
  q_lost_civilization: {
    id: 'q_lost_civilization', chapter: 6, title: 'The Lost Civilization',
    intro: 'Old Hob has been reading the ruin-marks for years and has finally found a sentence he cannot explain away.',
    steps: [
      { type: 'reachCount', poiKind: 'ruins', count: 3, text: 'Discover 3 Ancient Ruin sites' },
      { type: 'talk', npc: 'hob', text: 'Consult Old Hob of the Library' },
      { type: 'flag', flag: 'ancient_forge_lit', text: 'Reforge the Ancient Core into Dawnbreaker' }
    ],
    rewards: { xp: 550 },
    flagsOnComplete: ['secrets_unsealed'],
    outro: 'Hob reads the last line twice and then sets the page down very carefully. The Ancients opened one anchor to save a city. Everything since — the frontier, the Veil, the ash — is the interest on that kindness.'
  },
  q_ancient_threat: {
    id: 'q_ancient_threat', chapter: 7, title: 'The Frontier Holds',
    intro: 'Five anchors held the Veil out. Four are still in the frontier, held by the dead, the woods, and the things that refused to leave. Mara will mark each one — she cannot walk it with you.',
    steps: [
      { type: 'flag', flag: 'shard_hearth_taken', text: 'Take the Hearth Shard back off the Ragged Hollow’s standard' },
      { type: 'flag', flag: 'shard_green_taken', text: 'Ask the Whispering Wood for its Green Shard' },
      { type: 'flag', flag: 'shard_watch_taken', text: 'Relieve the garrison and recover the Watch Shard' },
      { type: 'flag', flag: 'shard_hollow_taken', text: 'Go into the Hollow for its fragment and come back out' },
      { type: 'flag', flag: 'shard_ash_taken', text: 'Relieve the Warden of Ash and take up the Ashen Reliquary' },
      { type: 'flag', flag: 'barrier_restored', text: 'Carry the five to the Forsaken Shrine and raise the Fivefold Anchor' }
    ],
    rewards: { xp: 800, gold: 500, rep: 20 },
    outro: 'The anchor is holding. The frontier is still here. Neither of those is the same as forgiven.'
  },
  q_crown_of_realm: {
    id: 'q_crown_of_realm', chapter: 8, title: 'Crown of the Realm',
    intro: 'The barrier answers to five fragments and a stranger. Whatever the realm becomes next, it will be decided by who you invite into that answer.',
    outro: 'The council does not end with a cheer. It ends with five people agreeing to meet again next season, which is the least romantic and most durable thing a kingdom has ever done.',
    steps: [
      { type: 'stage', index: 5, text: 'Ascend your realm to Kingdom status' },
      { type: 'territory', count: 40, text: 'Control 40% of the known realm' },
      { type: 'flag', flag: 'barrier_restored', text: 'Stand at the Forsaken Shrine with the anchor raised' },
      { type: 'choice', choiceId: 'coronation', text: 'Call the council and decide who carries the realm (Crown panel, R)' }
    ],
    rewards: { xp: 1200 },
    ending: true
  }
};

export const QUEST_ORDER: string[] = Object.keys(MAIN_QUESTS);
