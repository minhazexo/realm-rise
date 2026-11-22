// NPC personalities & recruit pool. `req` = recruitment requirements (spec §22).
import { Registry } from '../core/Registry.ts';

export interface NpcRequirement {
  rep?: number;
  gold?: number;
  stage?: number;
  buildingNearby?: string;
  questFlag?: string;
}

/**
 * A block of dialogue unlocked by a story flag OR by reaching a chapter. The
 * LAST match wins, so a specific late-game flag can override a chapter mood.
 */
export interface NpcDialogueBlock {
  /** Story flag that unlocks this block. */
  flag?: string;
  /** Also unlocks once the realm has reached this chapter (1–8). */
  minChapter?: number;
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
    ],
    linesByFlag: [
      {
        minChapter: 4,
        lines: [
          'Three powers have sent people to look at our wall this month. None of them asked how we were doing.',
          'I do not care which banner you fly. I care that the people under it get fed before the people selling it do.'
        ]
      },
      {
        flag: 'settlement_founded',
        lines: [
          'You gave me a fire and a job. I have never had both on the same night before.',
          'People are coming up the road because they can see the smoke. That is a good thing and a frightening thing, and I think it is the same thing.'
        ]
      },
      {
        flag: 'barrier_restored',
        lines: [
          'The night is quiet. Not the quiet that was here before — the ordinary kind, with owls in it.',
          'I am going to plant something in the spring. I have never planned that far ahead. I think you did that.'
        ]
      }
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
        minChapter: 5,
        lines: [
          'The roads are full of Legion again. I remember the last time they came this far up the valley, and I remember what was left of the valley after.',
          'Whatever you are building, build it to last the winter. Nothing the Ashen do is quick, and nothing they do is finished.'
        ]
      },
      {
        minChapter: 7,
        lines: [
          'You can feel it, can you not? The frontier is holding its breath. Whatever is under the pyre has been waiting for someone to come and be responsible for it.',
          'I have counted the dead of this place twice. I would like, once, to count something we kept.'
        ]
      },
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
          'Four fragments and the Reliquary. Take them to the Forsaken Shrine. There is a block there with five cuts in it and nobody alive has seen it filled.'
        ]
      },
      {
        flag: 'policy_generosity',
        lines: [
          'The granary stayed open through the rain, and the clans remembered. Two families that would have walked past your gate are still here.',
          'It cost you the League’s contracts and I will not pretend it did not. But no child in this frontier went to bed hungry this week. Hold that.'
        ]
      },
      {
        flag: 'policy_pragmatism',
        lines: [
          'Signed roads. Warm stores. Every price in the market has a League hand on it now, including the price of a roof.',
          'The clans sent no one to your fire this month. That is what a bargain looks like from the other side of the road.'
        ]
      },
      {
        flag: 'policy_discipline',
        lines: [
          'The garrison is on the wall and the raids are dying at the gate instead of in the square. I can count my neighbors tonight. That is not nothing.',
          'There is a list now — Oren, who drinks, and the carters, who talk. I have seen what a list does after the danger is gone.'
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
        minChapter: 5,
        lines: [
          'Legion coin is everywhere this season. Good weight, bad history. I spend it and I do not look at the face on it.',
          'If a buyer ever comes asking for warm stones with a purse that large, do us both a favor and be suspicious of the purse.'
        ]
      },
      {
        flag: 'shard_watch_taken',
        lines: [
          'You went into the watchtower and came back out. I sell to survivors, not to people who go looking.',
          'Try to stay in the first group. My prices assume repeat custom.'
        ]
      },
      {
        flag: 'policy_pragmatism',
        lines: [
          'League paper, League roads, League scales. I have never been so comfortable and so certain that someone is about to be ruined.',
          'The clans will not trade with your market for a season. You will barely notice it in the ledgers. You will notice it at the gate.'
        ]
      },
      {
        flag: 'policy_generosity',
        lines: [
          'You gave the food away. I watched you do it, which is worse than hearing about it.',
          'Trade is a story about who owes whom. You just tore out the interesting pages. I will adapt — everyone always does.'
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
        minChapter: 6,
        lines: [
          'The wood has been loud since the ruins opened. Not with animals — with the sound trees make when they are deciding whether to keep standing.',
          'You went digging in the old places and came back with a truth instead of a treasure. I am not sure the frontier is better for it, but I am sure it is more honest.'
        ]
      },
      {
        flag: 'shard_green_taken',
        lines: [
          'So it was in the wood all along. I have walked past that grove for six seasons.',
          'The dire wolves will scatter now. Something else will take the den by spring — something always does.'
        ]
      },
      {
        flag: 'policy_generosity',
        lines: [
          'The wood has a warden now who is not a wall. I did not expect to live long enough to say that.',
          'Your granary is open to the clans. The trees will not thank you, but the people who came out of them will.'
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
    linesByFlag: [
      {
        flag: 'policy_pragmatism',
        lines: [
          'The League owns the road to my forge now. They have not understood that the road does not make the steel.',
          'Bring me ore and leave the contracts at the door. I will not sign a page that can foreclose on an anvil.'
        ]
      },
      {
        flag: 'barrier_restored',
        lines: [
          'The forge-fire and the shrine-light are the same colour tonight. I do not like what that suggests about my trade.',
          'You did the impossible thing. Fine. Now hold still — a mythic sword does not sharpening itself.'
        ]
      }
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
    ],
    linesByFlag: [
      {
        minChapter: 5,
        lines: [
          'War is bad for business and excellent for prices. I am ashamed of how well I am doing.',
          'The League would like your roads on paper. I would like to be alive when the paper is signed. Both of those can be arranged.'
        ]
      }
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
        minChapter: 6,
        lines: [
          'The Ancients did not build a wall, friend. They built an agreement, and then they broke it politely, with minutes taken.',
          'Every ruin you have walked is a page from the same argument. You are not looting a dead empire; you are reading its apology.'
        ]
      },
      {
        flag: 'shard_hearth_taken',
        lines: [
          'You have one. Do not set it down near the others, and whatever you do, do not carry all five into one room unless you mean it.',
          'An anchor is not a lock, friend. It is a promise. Break one and everything it was holding back comes to collect.'
        ]
      },
      {
        flag: 'policy_discipline',
        lines: [
          'The Crown’s officer has been through my library twice. He is looking for the page that says what an anchor is, and I have hidden it in a cookbook.',
          'Order is a fine roof and a poor window. You will find that out when you want to look outside.'
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
export function npcLines(def: NpcDef, flags: Record<string, unknown>, chapter = 0): string[] {
  const blocks: NpcDialogueBlock[] = def.linesByFlag || [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block: NpcDialogueBlock | undefined = blocks[i];
    if (!block) continue;
    if (block.flag && flags[block.flag]) return block.lines;
    if (block.minChapter && chapter >= block.minChapter) return block.lines;
  }
  return def.dialogue || def.greetLines || ['…'];
}

/** Random citizen name generator for procedural settlers. */
const FIRST: string[] = ['Willem','Asha','Doran','Pell','Sorrel','Brann','Hesta','Corvin','Ysolde','Marrec','Gwen','Tammas','Odric','Liora','Fenn'];
const LAST: string[] = ['Bramblefoot','Ashdown','Miller','Thornfield','Marsh','Copperpot','Brightwater','Hollis','Fenwick','Fallowseed'];
export const randomCitizenName = (rng: () => number): string => `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
