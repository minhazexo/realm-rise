// ─────────────────────────────────────────────────────────────────────────────
// THE FIVE REALM SHARDS — the narrative spine (brief §14).
//
// The barrier that held The Veil out of Aetheria was not one wall but five
// anchors. When the kingdom fell, four were torn away and hidden in the ruins
// of the frontier; the fifth went south aboard the last ship out — the ship
// that sank under the player in the opening slides.
//
// Every shard below is a real place in the Ashen Frontier: `site` is where its
// fragment lies, `guardian` is the thing standing over it, and `flag` is what
// the world records once it is taken. Nothing here touches Phaser, so the
// spine's geography and gating are unit-testable (tests/shards.mjs).
//
// The gate rules live in systems/ShardSystem.ts; the prose in data/voices.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** The thing that will not let a shard go. `radius` is how close it counts. */
export interface ShardGuardian {
  /** Real enemy key (data/enemies*.ts) — the fight is one the game already has. */
  key: string;
  /** What the player is told to deal with, in the world's own voice. */
  label: string;
  /**
   * How close a guardian must be to hold the fragment. Ignored for a boss
   * (`boss: true`), which holds its fragment wherever it stands because it was
   * posted there — and because kiting it away must not open the gate. This is
   * still the distance a boss POI must sit within, and what the tests pin.
   */
  radius: number;
  boss?: boolean;
}

export interface ShardDef {
  id: string;
  /** 1…5 — the order Mara's account walks them in. */
  order: number;
  name: string;
  /** Item the fragment becomes when taken. */
  item: string;
  /** Story flag written when it is taken. Saved; the chain is gated on it. */
  flag: string;
  /** Side quest that carries this shard. */
  quest: string;
  /** Sub-region it lies in (regionAshen), for the journal wording. */
  area: string;
  /** Where the fragment lies, in world coordinates. */
  site: { x: number; y: number };
  guardian: ShardGuardian;
  /** Refusal when the guardian still stands, after the location. */
  heldText: string;
  /** Read aloud on recovery, through the shipped dialogue UI. */
  inscription: string[];
}

export const SHARDS: ShardDef[] = [
  {
    id: 'shard_hearth',
    order: 1,
    name: 'The Hearth Shard',
    item: 'shard_of_the_hearth',
    flag: 'shard_hearth_taken',
    quest: 'sq_shard_hearth',
    area: 'camp',
    // Placed on ground a player can stand on and clear of the camp's own props —
    // tests/shards.mjs asserts exactly that for every fragment below.
    site: { x: 652, y: 142 },
    guardian: { key: 'executioner', label: 'the Executioner of the Ragged Hollow', radius: 340 },
    heldText: 'The fragment is speared through the camp standard, and the Executioner has not left his post.',
    inscription: [
      'The fragment is warm. It was cut from something larger, and it remembers being larger.',
      'Set into the standard it hums one note — the note the shrine sang before the frontier burned.',
      'Someone carried it here to keep it safe, then died keeping the men who took it.'
    ]
  },
  {
    id: 'shard_green',
    order: 2,
    name: 'The Green Shard',
    item: 'shard_of_the_green',
    flag: 'shard_green_taken',
    quest: 'sq_shard_green',
    area: 'forest',
    site: { x: 960, y: -430 },
    guardian: { key: 'dire_wolf', label: 'the dire wolves of the Whispering Wood', radius: 380 },
    heldText: 'The wood is still holding its breath. The dire wolves are between you and it.',
    inscription: [
      'Roots have grown through the fragment and will not let go; you cut them and they bleed sap, not blood.',
      'The forest was the barrier’s first anchor. The trees have been keeping the Veil out so long they forgot why.',
      'Under the fragment, scratched by a hand that had run out of time: "FOUR LEFT. TELL THEM IT WAS NOT OUR FAULT."'
    ]
  },
  {
    id: 'shard_watch',
    order: 3,
    name: 'The Watch Shard',
    item: 'shard_of_the_watch',
    flag: 'shard_watch_taken',
    quest: 'sq_shard_watch',
    area: 'tower',
    site: { x: -648, y: -432 },
    guardian: { key: 'grave_knight', label: 'the garrison’s risen knight', radius: 340 },
    heldText: 'A knight’s gauntlet rests on the fragment, and the knight has not finished standing up.',
    inscription: [
      'The garrison died in ranks facing the same direction — inward, at something that came up through their own keep.',
      'The fragment lay in the strongroom. They brought it out to the wall and never got to use it.',
      'The last line of the log is legible: "It is not an army. It is a door, and we left it open."'
    ]
  },
  {
    id: 'shard_hollow',
    order: 4,
    name: 'The Hollow Shard',
    item: 'shard_of_the_hollow',
    flag: 'shard_hollow_taken',
    quest: 'sq_shard_hollow',
    area: 'hollow',
    site: { x: -120, y: -1010 },
    guardian: { key: 'void_stalker', label: 'the thing the Veil left in the Hollow', radius: 360 },
    heldText: 'Corruption thickens around the fragment. Its keeper is still here.',
    inscription: [
      'The fragment is cold and the cold goes through your gloves into the bone.',
      'This anchor was not torn open — it was UNSEALED. The seal was opened from this side, by hands that thought they were being kind.',
      'It answers the note the other two sang, a third lower. Three anchors found. The Veil has counted them too.'
    ]
  },
  {
    id: 'shard_ash',
    order: 5,
    name: 'The Ash Shard',
    item: 'shard_of_ash',
    flag: 'shard_ash_taken',
    quest: 'sq_shard_ash',
    area: 'pyre',
    site: { x: 780, y: -1600 },
    guardian: { key: 'warden_of_ash', label: 'the Warden of Ash', radius: 420, boss: true },
    heldText: 'The last fragment is inside the crown of the pyre, and the Warden of Ash is still standing over it.',
    inscription: [
      'The Warden’s armour empties as it falls — a man-shaped nothing with the fragment where the heart went.',
      'It was never corrupted. It was posted here, and it held this fragment for a kingdom that stopped existing.',
      'The fifth anchor is the one that broke. The Veil walked into Aetheria through the hole where this shard used to be.'
    ]
  }
];

/** Shard ids in the order the chain walks them. */
export const SHARD_ORDER: string[] = SHARDS.map((s: ShardDef) => s.id);

/** Every shard flag — what the world records once all five are recovered. */
export const SHARD_FLAGS: string[] = SHARDS.map((s: ShardDef) => s.flag);

export function shardById(id: string): ShardDef | null {
  return SHARDS.find((s: ShardDef) => s.id === id) || null;
}

export function shardByFlag(flag: string): ShardDef | null {
  return SHARDS.find((s: ShardDef) => s.flag === flag) || null;
}

/**
 * The final beat (brief §14): the five fragments are not trophies, they are the
 * barrier. Planting them at the shrine re-anchors it — and answers the mystery
 * the intro slides opened, in the shrine's own voice.
 */
export const BARRIER = {
  name: 'The Fivefold Anchor',
  flag: 'barrier_restored',
  quest: 'sq_shard_barrier',
  area: 'shrine',
  // South-east of the altar, on the shrine's own water (its whole area is), and
  // clear of every solid the shrine places.
  site: { x: 1250, y: -1105 },
  /** Refusal while fragments are still lost — names them, so the player knows why. */
  coldText: 'The anchor is cold. It wants five fragments and it has',
  /** Shown when it finally takes them. */
  raisedTitle: 'THE FIVEFOLD ANCHOR',
  raisedText: 'The fragments go into the stone like keys into locks. The Veil recoils — far out, past the horizon, something that had been leaning on the world stands up straight and takes its weight off.',
  epilogue: [
    'You asked, once, why the sea let you live when it took the ship and everyone on it.',
    'The fifth anchor was aboard that ship. It went into the water with you, and the barrier — with nothing left to hold — turned all five of its hands to keeping one drowned stranger breathing.',
    'You are alive because the barrier chose you over the kingdom. The Veil got in through the gap that choice made.',
    'Mara asks what happens now. The honest answer is that the anchor is holding, the frontier holds it, and neither of those is the same as forgiven.',
    'The gate is shut. You are still standing on the wrong side of it — and for the first time since the shore, that is a choice you made on purpose.'
  ]
} as const;
