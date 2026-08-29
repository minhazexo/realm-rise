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
