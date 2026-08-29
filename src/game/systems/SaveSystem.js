// ─────────────────────────────────────────────────────────────────────────────
// Save system (spec §38, §78): 3 manual slots + autosave. Corruption-tolerant:
// every read is guarded, broken payloads fall back to backup slots or defaults
// without ever crashing gameplay.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = 'rotr_save_';
export const SLOT_IDS = ['auto', 'slot1', 'slot2', 'slot3'];

function keyFor(slot) {
  return `${PREFIX}${slot}`;
}

/** Strip runtime session junk; whitelist persistent branches. */
export function serialize(state) {
  return JSON.parse(
    JSON.stringify({
      meta: state.meta,
      player: state.player,
      inventory: state.inventory,
      inventorySlots: state.inventorySlots,
      settlement: state.settlement,
      world: state.world,
      quests: state.quests,
      story: state.story,
      factions: state.factions,
      achievements: state.achievements,
      stats: state.stats,
      settings: state.settings,
      savedAt: Date.now()
    })
  );
}

export function saveToSlot(slotId = 'auto', state) {
  if (!state) return { ok: false, msg: 'No game running' };
  try {
    const payload = serialize(state);
    payload.meta.savedAt = Date.now();
    // Write to primary AND a rotating shadow copy for corruption recovery.
    try {
      localStorage.setItem(keyFor(slotId), JSON.stringify(payload));
      const shadow = `${PREFIX}shadow_${(payload.meta.seed % 7)}`;
      localStorage.setItem(shadow, JSON.stringify(payload));
    } catch {
      /* quota exceeded: attempt compact write without world exploration grid */
      try {
        const slim = { ...payload, world: { ...payload.world, exploredChunks: [] } };
        localStorage.setItem(keyFor(slotId), JSON.stringify(slim));
      } catch {
        return { ok: false, msg: 'Storage full' };
      }
    }
    return { ok: true };
  } catch (err) {
    console.warn('[save] failed', err);
    return { ok: false, msg: 'Save failed' };
  }
}

export function loadFromSlot(slotId = 'auto') {
  try {
    const raw = localStorage.getItem(keyFor(slotId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.player?.level || !data?.meta?.seed) throw new Error('shape');
    return data;
  } catch {
    // Corruption tolerance: look for the most recent valid shadow copy.
    let best = null;
    try {
      for (let i = 0; i < 9; i++) {
        const raw = localStorage.getItem(`${PREFIX}shadow_${i}`);
        if (!raw) continue;
        const d = JSON.parse(raw);
        if (d?.player?.level && d?.meta?.seed && (!best || (d.savedAt || 0) > best.savedAt)) best = d;
      }
      if (best) console.warn('[save] primary slot corrupt — recovered from shadow');
    } catch {
      /* nothing recoverable */
    }
    return best;
  }
}

/** Lightweight metadata for save-slot list UIs. */
export function listSaves() {
  const out = {};
  for (const id of SLOT_IDS) {
    let entry = null;
    try {
      const raw = localStorage.getItem(keyFor(id));
      if (raw) {
        const d = JSON.parse(raw);
        entry = {
          name: d.player?.name || 'Stranger',
          level: d.player?.level ?? 1,
          chapter: d.story?.chapter ?? 1,
          day: d.world?.dayCount ?? 1,
          stage: d.settlement?.founded ? d.settlement.stageIndex : -1,
          founded: !!d.settlement?.founded,
          gold: d.player?.gold ?? 0,
          seed: d.meta?.seed,
          savedAt: d.meta?.savedAt || d.savedAt || Date.now()
        };
      }
    } catch {
      entry = { corrupt: true, name: 'Corrupted save', savedAt: 0 };
    }
    out[id] = entry;
  }
  return out;
}

export function deleteSlot(slotId) {
  try {
    localStorage.removeItem(keyFor(slotId));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable() {
  try {
    const k = `${PREFIX}probe`;
    localStorage.setItem(k, 'x');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
