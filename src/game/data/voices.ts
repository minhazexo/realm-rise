// ─────────────────────────────────────────────────────────────────────────────
// VOICES — every line of prose the world speaks outside the dialogue modal:
// what a boss says when it stands up and when it falls, and what the frontier's
// books and inscriptions say when a player actually reads them.
//
// One home for the prose so the mystery can be read end to end in one place,
// and so a test can prove no boss is silent and no inscription is a one-liner
// (tests/shards.mjs). Text only — no Phaser, no state.
// ─────────────────────────────────────────────────────────────────────────────

export interface BossVoice {
  /** Spoken as the fight opens, one line at a time. */
  intro: string[];
  /** Spoken as it dies. The last thing the thing says. */
  defeat: string[];
}

/**
 * Boss dialogue (brief §14: "boss dialogue"). Before this every boss announced
 * itself with a single generated banner line and said nothing on death.
 */
export const BOSS_VOICE: Record<string, BossVoice> = {
  bandit_captain: {
    intro: [
      'The captain plants his standard and spits. "Another one come to count the dead."',
      '"The Legion pays by the fragment. You are standing on my wages."'
    ],
    defeat: [
      '"…they never said what the fragments was FOR."',
      'His standard falls across him like a shroud he did not earn.'
    ]
  },
  alpha_wolf: {
    intro: [
      'The pack goes quiet, which is worse than the howling.',
      'Grendelfang comes through the trees at a walk. It has never had to run at anything.'
    ],
    defeat: [
      'It dies standing, facing the way the pack came from.',
      'The wood is loud again within ten breaths. Something else has already taken the den.'
    ]
  },
  bandit_king: {
    intro: [
      '"You walked here." Rhogar sounds almost pleased. "Nobody walks here anymore."',
      '"I hold the roads, the camp, and a crown made out of a broken world. Sit down or die standing."'
    ],
    defeat: [
      '"The crown… was never mine. I found it in the mud where the barrier fell."',
      'The hollow crown rings once against the stone and is only iron again.'
    ]
  },
  ancient_guardian: {
    intro: [
      'The Warden of the ruins wakes the way a mountain decides to move: slowly, then all at once.',
      '"ANCHOR… INTACT…" It is not speaking to you. It is reading a ledger that burned centuries ago.'
    ],
    defeat: [
      '"CUSTODY… TRANSFERRED…" The light behind its ribs goes out in order, like a room being left.',
      'It folds down over the shard it was guarding and does not let go of it even now.'
    ]
  },
  warden_of_ash: {
    intro: [
      'The pyre stands up. The armour is empty and it is still standing up.',
      '"POST HELD," says the cinders, in a voice that used to belong to someone.',
      'It has been holding this fragment since before the frontier had a name. It is not going to stop because a stranger asked.'
    ],
    defeat: [
      '"RELIEF…" The word comes out of the fire like a sigh it has been saving for a hundred years.',
      'The armour collapses in on the fragment. Underneath there is nothing at all — no bones, no ash, no man. Just the post, and the thing it was posted to keep.',
      'The fragment is the last of the five. The Veil knows it. You can feel the whole frontier lean in to watch.'
    ]
  }
};

export const bossVoice = (key: string): BossVoice | null => BOSS_VOICE[key] || null;

export interface BookDef {
  title: string;
  /** Readable in the shipped dialogue UI, one page at a time. */
  lines: string[];
}

/**
 * Inscriptions and books (brief §14: "books, inscriptions, environmental
 * storytelling"). These carry the mystery — the barrier's five anchors, the
 * fifth going south by ship, and the frontier's last night — so a player who
 * reads the world learns what the shard chain is about before Mara explains it.
 */
export const BOOKS: Record<string, BookDef> = {
  anchor_ledger: {
    title: 'The Anchor Ledger',
    lines: [
      'A settler’s notice, burned back to one corner of one page. The order is legible — all settlers to the watchtower, the road south is lost.',
      '"THE FIVEFOLD ANCHOR: five fragments, one per quarter of the old realm, one kept in the crown’s own hand. While all five sit in their stones, the Veil does not move."',
      '"Four stones are named: the wood, the watch, the hollow, and the crown’s own hearth. The fifth was never written down, which is either the safest thing they ever did or the stupidest."'
    ]
  },
  spilled_ledger: {
    title: 'Spilled Ledger',
    lines: [
      'A carter’s ledger, pages swollen with rain and fanned across the road.',
      '"Last cargo south: one crate, sealed, no manifest, four men who would not say what they were carrying and did not eat with the rest."',
      '"The ship left the night the sky opened. The crate went with it. The sea kept what the kingdom could not."'
    ]
  },
  captains_orders: {
    title: 'Captain’s Orders',
    lines: [
      'The orders are Legion, and they are not orders to hold the camp.',
      '"Collect every fragment. Any fragment. The buyer does not care what it looks like, only that it is warm and it is not in a stone."',
      '"Payment on delivery. If the frontier objects, the frontier is not the client."'
    ]
  },
  bark_carving: {
    title: 'Carving in the Bark',
    lines: [
      'Someone cut this into the oak a long time ago, then again more recently, in a worse hand.',
      'The old cut is a picture: five hands, palms out, around a small circle. Words under it: "WE ARE THE WALL. TELL THEM."',
      'The new cut is only a name and a plea. "They are holding it. Break the wood to reach it before the Veil does."'
    ]
  },
  garrison_log: {
    title: 'Garrison’s Log',
    lines: [
      'The log is legible for eleven days and then almost legible, and then it is a smear that someone kept writing on anyway.',
      '"Day nine — the shard is out of the strongroom. The captain says we hold the wall with it or not at all."',
      '"Day eleven — it is not an army. It is a door, and we left it open. Whoever reads this: the anchors are not a legend, they are a WALL, and we are taking bricks out of it to be brave with."'
    ]
  },
  keystone_rubble: {
    title: 'Keystone Rubble',
    lines: [
      'The bridge was not built for carts. The span is too wide, the approach too clean, and the keystone carries a socket shaped like nothing useful.',
      '"Built to carry an anchor south without waking it," says the mason’s mark.',
      'The last span is missing, and it was removed from below — deliberately, with tools, by people in a hurry.'
    ]
  },
  sealed_inscription: {
    title: 'Sealed Inscription',
    lines: [
      'The inscription rings the seal: OUTER, INNER, CROWN. The crystals are labelled with the same three words, cut small.',
      '"The anchor was unsealed once before, by hands that believed they were saving us."',
      '"An anchor is not a lock. It is a promise. Break a promise and everything you were holding back comes to collect."'
    ]
  },
  ash_crowned_stone: {
    title: 'The Ash-Crowned Stone',
    lines: [
      'A stone at the pyre’s edge, smooth where generations of hands have rested on it. The whole life of the Warden of Ash is cut here in eleven short lines.',
      '"POST: the fifth anchor. RELIEF: none scheduled."',
      '"If the post is relieved, the relief will be a stranger. They will not know what they carry. Tell them anyway."'
    ]
  },
  shrine_anchor: {
    title: 'The Fivefold Anchor',
    lines: [
      'The block at the shrine’s heart is not a statue. It is a socket, and its five cuts are empty and shaped exactly like the fragments.',
      '"When the five are returned, the Veil has nowhere to lean. The frontier holds, because holding is what a frontier is for."',
      'Someone has scratched the end of the sentence away, and then scratched a worse one after it: "or it holds until the next fool takes one for a trophy."'
    ]
  }
};

export const bookText = (key: string): BookDef | null => BOOKS[key] || null;

/** The hub survivor's read of where the chain stands — her words, not the UI's. */
export const SHARD_PROGRESS_VOICE = {
  none: 'Mara is holding a map that has gone soft at the folds. "You want something to do. There are five things in this frontier that should not be out in the open."',
  some: 'Mara counts on her fingers and stops. "Some of them are ours again. Keep going — the Veil can count too."',
  all: 'Mara does not say anything for a while. "All five. Then there is only one place left to put them."'
} as const;
