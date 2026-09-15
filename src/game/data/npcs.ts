// NPC personalities & recruit pool. `req` = recruitment requirements (spec §22).
import { Registry } from '../core/Registry.ts';

export interface NpcRequirement {
  rep?: number;
  gold?: number;
  stage?: number;
  buildingNearby?: string;
  questFlag?: string;
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
  req?: NpcRequirement;
  grantsJobBoost?: string;
  questGiver?: string;
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
      'I can swing an axe or haul stone. Just point me somewhere useful.'
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
      'I tracked Grendelfang once. I still hear it howling when the moon is wrong.'
    ],
    questGiver: 'sq_herbs_for_elara'
  },
  borin: {
    key: 'borin', name: 'Borin Stonebeard', role: 'miner', portrait: '#9aa0a8',
    personality: 'boisterous', skillRate: 1.3, minerAura: true,
    req: { rep: 15, gold: 80 },
    joinAs: 'miner', grantsJobBoost: 'miner',
    dialogue: [
      'Stone talks to them that listen proper!',
      "Ya call THAT a pickaxe? My gran' chipped flint sharper!",
      'Iron below, sweat above — that’s the whole secret o’ mining.'
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
      'Bread in the morning fixes most quarries by evening.',
      'The first green sprouts always make my heart leap.'
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
      'One day I will hammer something they sing about in taverns.'
    ],
    cost: { gold: 500 }
  },
  torvald: {
    key: 'torvald', name: 'Torvald Goldtongue', role: 'merchant', portrait: '#d8b74a',
    merchant: true, staticMerchantAtSettlement: true, requiresStage: 2,
    greetLines: [
      'Coin welcomes everyone to my little corner of civilization!',
      'Steel, spice or secrets — Torvald deals in all three.',
      'The League sends regards, and a bill.'
    ]
  },
  hob: {
    key: 'hob', name: 'Old Hob', role: 'scholar', portrait: '#7ea4e0',
    personality: 'cryptic', scholar: true,
    req: { buildingNearby: 'library' },
    dialogue: [
      'The stones remember what men forget, friend.',
      'An old core still beats beneath the western ruins. Ask it kindly.',
      'Every kingdom ends; that is what makes each one precious.'
    ],
    questGiver: 'sq_translation'
  }
};

const NPC_REGISTRY = new Registry<NpcDef>('npc', { required: ['name'] });
NPC_REGISTRY.defineAll(NPCS);
NPC_REGISTRY.seal();

export const getNpcDef = (key: string): NpcDef | null => NPC_REGISTRY.get(key);

/** Random citizen name generator for procedural settlers. */
const FIRST: string[] = ['Willem','Asha','Doran','Pell','Sorrel','Brann','Hesta','Corvin','Ysolde','Marrec','Gwen','Tammas','Odric','Liora','Fenn'];
const LAST: string[] = ['Bramblefoot','Ashdown','Miller','Thornfield','Marsh','Copperpot','Brightwater','Hollis','Fenwick','Fallowseed'];
export const randomCitizenName = (rng: () => number): string => `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
