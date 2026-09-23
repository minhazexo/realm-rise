// NPC personalities & recruit pool. `req` = recruitment requirements (spec §22).
import { Registry } from '../core/Registry.ts';

export interface NpcRequirement {
  rep?: number;
  gold?: number;
  stage?: number;
  buildingNearby?: string;
  questFlag?: string;
}

/** A block of dialogue unlocked by a story flag. The LAST match wins. */
export interface NpcDialogueBlock {
  flag: string;
  lines: string[];
}

export interface NpcDef {
  key: string;
  name: string;
  role: string;
  portrait: string;
  personality?: string;
  skillRate?: number;
  joinAs?: string;
  dialogue?: string[];
  /**
   * What this NPC says once the world has moved on. The last block whose flag is
   * set replaces `dialogue` entirely, so an area's people change as its story
   * does (brief §14: the mystery unfolds from the voices, not one dump).
   */
  linesByFlag?: NpcDialogueBlock[];
  req?: NpcRequirement;
  grantsJobBoost?: string;
  questGiver?: string;
  /**
   * More than one offerable quest, walked in order — the shard chain is offered
   * link by link, and only the next available one shows an Accept button.
   */
  questGivers?: string[];
  hunterAura?: boolean;
  minerAura?: boolean;
  farmerAura?: boolean;
  smithAura?: boolean;
  legendary?: boolean;
  cost?: Record<string, number>;
  merchant?: boolean;
  staticMerchantAtSettlement?: boolean;
  requiresStage?: number;
  greetLines?: string[];
  scholar?: boolean;
  grantsStationBuff?: string;
  auraDesc?: string;
}

export const NPCS: Record<string, NpcDef> = {
  tam: {
    key: 'tam', name: 'Tam', role: 'survivor', portrait: '#b8875a',
    personality: 'grateful', skillRate: 0.8,
    joinAs: 'worker',
    dialogue: [
      'T-thank you… I thought those wolves would finish me.',
      'You fight well for someone who washed up half-drowned.',
      'I can swing an axe or haul stone. Just point me somewhere useful.',
      'The pines east of the road are dead standing. They did not burn — they just stopped. Go around them.'
    ]
  },
  // ── Ashen Frontier hub (map brief §5) ────────────────────────────────────
  mara: {
    key: 'mara', name: 'Mara', role: 'survivor', portrait: '#b8875a',
    personality: 'grieving',
    questGiver: 'sq_echoes_of_ash',
    questGivers: [
      'sq_shard_hearth', 'sq_shard_green', 'sq_shard_watch',
      'sq_shard_hollow', 'sq_shard_ash', 'sq_shard_barrier'
    ],
    dialogue: [
      'You came up the road alive. That is more than the carters managed.',
      'The anvil, south of the shrine — Oren kept it lit even after the smithy burned. Stand at it and hammer your gear better than you came in with.',
      'The Veil took the frontier in one night. I counted the dead until I ran out of names.',
      'There are five things lying lost out here that should never have been left in the open. I will tell you where each one is. I cannot walk it with you — my knees quit the night the frontier did.'
    ],
    linesByFlag: [
      {
        flag: 'shard_hearth_taken',
        lines: [
          'The camp standard. You took it back off their trophy pole — that one was ours to begin with.',
          'Four left. The wood next: the trees have been holding theirs longer than this frontier has existed, and they are tired.'
        ]
      },
      {
        flag: 'shard_green_taken',
        lines: [
          'The wood gave it up. I did not think it would.',
          'The watchtower next. The garrison died holding theirs — do not expect the dead to hand it over politely.'
        ]
      },
      {
        flag: 'shard_watch_taken',
        lines: [
          'Three. My brother was garrison there. If you laid their knight down, you did more for that tower than the kingdom ever did.',
          'The hollow is next, and I will not pretend it is the same kind of errand. The Veil is inside that one.'
        ]
      },
      {
        flag: 'shard_hollow_taken',
        lines: [
          'You came back out of the hollow. Sit down. Drink something.',
          'One left, and it is the worst of them. The Warden of Ash has held the fifth since before anyone here had a name.'
        ]
      },
      {
        flag: 'shard_ash_taken',
        lines: [
          'All five. I keep counting them because I do not believe it.',
          'Take them to the Forsaken Shrine. There is a block there with five cuts in it and nobody alive has seen it filled.'
        ]
      },
      {
        flag: 'barrier_restored',
        lines: [
          'The anchor is holding. The Veil is… further away. I can feel the difference and I cannot explain it.',
          'You asked me once why the sea let you live. I think you have the answer now, and I am sorry that it is worse than not knowing.'
        ]
      }
    ]
  },
  corvin: {
    key: 'corvin', name: 'Corvin the Pedlar', role: 'merchant', portrait: '#9a7d4f',
    personality: 'wry', merchant: true,
    dialogue: [
      'Everything is for sale. Some of it is even mine.',
      'I walked the whole frontier this season. Nothing on it wants me alive.',
      'The Legion paid in coin minted the year the sky opened. Draw your own conclusions about the buyer.',
      'Cheap steel, honest rope, and a map that is only slightly wrong.'
    ],
    linesByFlag: [
      {
        flag: 'shard_watch_taken',
        lines: [
          'You went into the watchtower and came back out. I sell to survivors, not to people who go looking.',
          'Try to stay in the first group. My prices assume repeat custom.'
        ]
      }
    ]
  },
  elara: {
    key: 'elara', name: 'Elara the Hunter', role: 'hunter', portrait: '#7d5936',
    personality: 'stoic', skillRate: 1.2, hunterAura: true,
    req: { rep: 20 },
    joinAs: 'worker', grantsJobBoost: 'farmer',
    dialogue: [
      'The forest speaks of iron in its belly and fire in its crown.',
      'A clean blade and quieter feet — everything else is noise.',
      'I tracked Grendelfang once. I still hear it howling when the moon is wrong.',
      'The deep wood has gone quiet in a way wolves do not go quiet for weather. They go quiet for a bigger wolf.',
      'If you carry a fragment out of the trees, do not do it at night. I have seen what they do to the light.'
    ],
    questGiver: 'sq_herbs_for_elara',
    linesByFlag: [
      {
        flag: 'shard_green_taken',
        lines: [
          'So it was in the wood all along. I have walked past that grove for six seasons.',
          'The dire wolves will scatter now. Something else will take the den by spring — something always does.'
        ]
      },
      {
        flag: 'warden_slain',
        lines: [
          'The pyre is out. I did not think I would live to see it dark.',
          'Whatever was standing on it is finished. What it was holding is yours to carry now — carry it further than the pyre, for all our sakes.'
        ]
      }
    ]
  },
  borin: {
    key: 'borin', name: 'Borin Stonebeard', role: 'miner', portrait: '#9aa0a8',
    personality: 'boisterous', skillRate: 1.3, minerAura: true,
    req: { rep: 15, gold: 80 },
    joinAs: 'miner', grantsJobBoost: 'miner',
    dialogue: [
      'Stone talks to them that listen proper!',
      "Ya call THAT a pickaxe? My gran' chipped flint sharper!",
      'Iron below, sweat above — that’s the whole secret o’ mining.',
      'I cut the road down into the hollow, before the seal. There’s a pillar down there older than the kingdom and it still hums in my fillings.'
    ],
    cost: { gold: 80 }
  },
  mira: {
    key: 'mira', name: 'Mira', role: 'farmer', portrait: '#6fbf73',
    personality: 'warm', skillRate: 1.25, farmerAura: true,
    req: { stage: 2 },
    joinAs: 'farmer', grantsJobBoost: 'farmer',
    dialogue: [
      'Good soil needs patience — and someone to keep the crows honest.',
      'Bread in the morning fixes most quarrels by evening.',
      'The first green sprouts always make my heart leap.',
      'The ash ruined everything except the soil. It is better than it was before, and I have decided not to think about why.'
    ],
    cost: { gold: 50 }
  },
  kara: {
    key: 'kara', name: 'Kara Emberfall', role: 'blacksmith', portrait: '#e05a4e',
    personality: 'fiery', skillRate: 1.5, smithAura: true, legendary: true,
    req: { rep: 50, stage: 3, gold: 500, buildingNearby: 'forge', questFlag: 'kara_rescued' },
    joinAs: 'artisan',
    grantsStationBuff: 'forge',
    auraDesc: 'Kara runs your forge: craft times halved near her station.',
    dialogue: [
      'Show me an ingot and step back — sparks know their master.',
      'Your sword arm has promise. Your forge is a tragedy.',
      'One day I will hammer something they sing about in taverns.',
      'Whatever you are collecting out there is not metal and it will not be forged. Do not bring it near my anvil.'
    ],
    cost: { gold: 500 }
  },
  torvald: {
    key: 'torvald', name: 'Torvald Goldtongue', role: 'merchant', portrait: '#d8b74a',
    merchant: true, staticMerchantAtSettlement: true, requiresStage: 2,
    greetLines: [
      'Coin welcomes everyone to my little corner of civilization!',
      'Steel, spice or secrets — Torvald deals in all three.',
      'The League sends regards, and a bill.',
      'Three buyers this month have asked me after “warm stones”. I do not sell what I cannot price, and I cannot price that.'
    ]
  },
  hob: {
    key: 'hob', name: 'Old Hob', role: 'scholar', portrait: '#7ea4e0',
    personality: 'cryptic', scholar: true,
    req: { buildingNearby: 'library' },
    dialogue: [
      'The stones remember what men forget, friend.',
      'An old core still beats beneath the western ruins. Ask it kindly.',
      'Every kingdom ends; that is what makes each one precious.',
      'Five anchors, friend. Not one wall — five. Whoever told you the barrier was a gate never read the inscription.',
      'Four were kept in stones. The fifth was never in a stone at all: it was in the crown’s own keeping, and then it was on a ship, and then it was in the sea.'
    ],
    questGiver: 'sq_translation',
    linesByFlag: [
      {
        flag: 'shard_hearth_taken',
        lines: [
          'You have one. Do not set it down near the others, and whatever you do, do not carry all five into one room unless you mean it.',
          'An anchor is not a lock, friend. It is a promise. Break one and everything it was holding back comes to collect.'
        ]
      },
      {
        flag: 'barrier_restored',
        lines: [
          'The anchor is whole. I have read about this my whole life and never believed a word of it.',
          'Ask the shrine what it cost. Ask it out loud — it answers, and you will not like the answer.'
        ]
      }
    ]
  }
};

const NPC_REGISTRY = new Registry<NpcDef>('npc', { required: ['name'] });
NPC_REGISTRY.defineAll(NPCS);
NPC_REGISTRY.seal();

export const getNpcDef = (key: string): NpcDef | null => NPC_REGISTRY.get(key);

/**
 * What this NPC says right now: the last flag-gated block whose flag is set,
 * otherwise their standing dialogue. Pure, so a test can pin that an area's
 * people change as its story does rather than needing a scene to prove it.
 */
export function npcLines(def: NpcDef, flags: Record<string, unknown>): string[] {
  const blocks: NpcDialogueBlock[] = def.linesByFlag || [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block: NpcDialogueBlock | undefined = blocks[i];
    if (block && flags[block.flag]) return block.lines;
  }
  return def.dialogue || def.greetLines || ['…'];
}

/** Random citizen name generator for procedural settlers. */
const FIRST: string[] = ['Willem','Asha','Doran','Pell','Sorrel','Brann','Hesta','Corvin','Ysolde','Marrec','Gwen','Tammas','Odric','Liora','Fenn'];
const LAST: string[] = ['Bramblefoot','Ashdown','Miller','Thornfield','Marsh','Copperpot','Brightwater','Hollis','Fenwick','Fallowseed'];
export const randomCitizenName = (rng: () => number): string => `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
