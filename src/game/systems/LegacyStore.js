// ─────────────────────────────────────────────────────────────────────────────
// LegacyStore (spec §76): tiny localStorage payload that survives new games —
// achievements, discovered lore and NG+ inheritance flags.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'rotr_legacy_v1';
const FALLBACK = () => ({ achievements: {}, legacyBanner: null, bonusesSeen: {}, endingsSeen: [] });

let cache = null;

export function readLegacy() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...FALLBACK(), ...JSON.parse(raw) } : FALLBACK();
  } catch {
    cache = FALLBACK();
  }
  return cache;
}

export function writeLegacy(obj) {
  try {
    cache = obj;
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* storage may be unavailable (private mode); play continues, legacy won't persist */
  }
}

/** Called from the epilogue; grants small cross-run perks (never overpowered). */
export function grantLegacy(oathEnding) {
  const leg = readLegacy();
  if (!leg.endingsSeen.includes(oathEnding)) leg.endingsSeen.push(oathEnding);
  leg.legacyOath = oathEnding;
  writeLegacy(leg);
}

/* ── NG+ heirloom boons (Phase E) ─────────────────────────────────────── */
// Small starting edges for completed runs. One boon per new game, picked at
// character creation. Deliberately modest: a head start, not a victory lap.
export const LEGACY_BOONS = [
  {
    id: 'survivor', name: 'Survivor\'s Grit', desc: '+1 attribute point to spend.',
    unlocked: (leg) => Object.keys(leg.achievements || {}).length >= 1,
    unlockHint: 'Earn any achievement',
  },
  {
    id: 'conqueror', name: 'Conqueror\'s Blade', desc: 'Begin with a honed iron sword.',
    unlocked: (leg) => (leg.endingsSeen || []).includes('conqueror'),
    unlockHint: 'Finish the Conqueror ending',
  },
  {
    id: 'diplomat', name: 'Diplomat\'s Purse', desc: '+150 gold and friends in high places (+10 League standing).',
    unlocked: (leg) => (leg.endingsSeen || []).includes('diplomat'),
    unlockHint: 'Finish the Diplomat ending',
  },
  {
    id: 'sage', name: 'Sage\'s Insight', desc: '+1 skill point and 3 herb teas.',
    unlocked: (leg) => (leg.endingsSeen || []).includes('sage'),
    unlockHint: 'Finish the Sage ending',
  },
  {
    id: 'sovereign', name: 'High Sovereign\'s Crown', desc: '+1 attribute point and +100 gold.',
    unlocked: (leg) => (leg.endingsSeen || []).length >= 3,
    unlockHint: 'Finish all three endings',
  },
];

/** Boons unlocked for this browser (with locked ones + hints for display). */
export function availableBoons() {
  let leg;
  try { leg = readLegacy(); } catch { return []; }
  return LEGACY_BOONS.map((b) => {
    let open = false;
    try { open = !!b.unlocked(leg); } catch { open = false; }
    return { ...b, open };
  });
}

/**
 * Apply a boon id to a FRESH state (post-createStateDefaults, pre-recompute).
 * Unknown/locked ids are ignored — never crash newGame.
 */
export function applyBoon(st, boonId) {
  if (!st || !boonId) return false;
  const open = availableBoons().some((b) => b.id === boonId && b.open);
  if (!open) return false;
  st.player.heirloom = boonId;
  switch (boonId) {
    case 'survivor':
      st.player.statPoints = (st.player.statPoints || 0) + 1;
      break;
    case 'conqueror':
      st.inventory.push({ id: 'iron_sword', qty: 1 });
      break;
    case 'diplomat':
      st.player.gold = (st.player.gold || 0) + 150;
      if (st.factions?.league) st.factions.league.rel = Math.min(100, (st.factions.league.rel || 0) + 10);
      break;
    case 'sage':
      st.player.skillPoints = (st.player.skillPoints || 0) + 1;
      st.inventory.push({ id: 'herb_tea', qty: 3 });
      break;
    case 'sovereign':
      st.player.statPoints = (st.player.statPoints || 0) + 1;
      st.player.gold = (st.player.gold || 0) + 100;
      break;
    default:
      return false;
  }
  return true;
}
