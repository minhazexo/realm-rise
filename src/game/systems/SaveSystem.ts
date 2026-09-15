// ─────────────────────────────────────────────────────────────────────────────
// Save system (spec §38, §78): 3 manual slots + autosave. Corruption-tolerant:
// every read is guarded, broken payloads fall back to backup slots or defaults
// without ever crashing gameplay.
//
// Versioned (Phase 5): every payload carries meta.version. Loads run
// migrateSave() — sequential migrations plus missing-branch repair — so old
// saves keep working after content updates. Rules for future versions:
//   1. NEVER remove/rename a persisted field without a migration entry.
//   2. Migrations must be idempotent (loads may call migrateSave twice).
//   3. Add a fixture case in tests/save.mjs for every new migration.
// ─────────────────────────────────────────────────────────────────────────────
import { VERSION, INVENTORY_BASE_SLOTS } from '../core/Constants.ts';
import { createStateDefaults } from '../core/stateFactory.ts';
import type {
  GameRootState, GameSettings, InventoryEntry, MetaState, PlayerState,
  SettlementState, WorldState, QuestsState, StoryState, FactionState, StatsState
} from '../core/stateFactory.ts';
import { normaliseSettings } from './SettingsSystem.ts';

/** Current save-schema version. Bump with Constants.VERSION on changes. */
export const SAVE_VERSION = VERSION;

const PREFIX = 'rotr_save_';
export const SLOT_IDS = ['auto', 'slot1', 'slot2', 'slot3'];

/** Persisted save payload: whitelisted state branches plus save metadata. */
export interface SavePayload {
  meta: MetaState;
  player: PlayerState;
  inventory: InventoryEntry[];
  inventorySlots: number;
  settlement: SettlementState;
  world: WorldState;
  quests: QuestsState;
  story: StoryState;
  factions: Record<string, FactionState>;
  achievements: Record<string, unknown>;
  stats: StatsState;
  settings: GameSettings;
  savedAt: number;
  [key: string]: unknown;
}

/** Result of a slot write / export / import operation. */
export interface SlotResult {
  ok: boolean;
  msg?: string;
  json?: string;
  slot?: string;
}

/** Lightweight metadata row for save-slot list UIs. */
export interface SaveSummary {
  name: string;
  level: number;
  chapter: number;
  day: number;
  stage: number;
  founded: boolean;
  gold: number;
  seed: unknown;
  savedAt: number;
  corrupt?: false;
}

/** Placeholder row for an unreadable slot. */
export interface CorruptSaveEntry {
  corrupt: true;
  name: string;
  savedAt: number;
}

function keyFor(slot: string): string {
  return `${PREFIX}${slot}`;
}

/** Strip runtime session junk; whitelist persistent branches. */
export function serialize(state: GameRootState): SavePayload {
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
  ) as SavePayload;
}

export function saveToSlot(slotId = 'auto', state: GameRootState | null | undefined): SlotResult {
  if (!state) return { ok: false, msg: 'No game running' };
  try {
    const payload: SavePayload = serialize(state);
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

/** True when the parsed value has the minimum save shape. */
function isSaveLike(data: unknown): data is SavePayload {
  const s = data as { player?: { level?: unknown }; meta?: { seed?: unknown } } | null | undefined;
  return !!s?.player?.level && !!s?.meta?.seed;
}

export function loadFromSlot(slotId = 'auto'): SavePayload | null {
  try {
    const raw: string | null = localStorage.getItem(keyFor(slotId));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!isSaveLike(data)) throw new Error('shape');
    return migrateSave(data);
  } catch {
    // Corruption tolerance: look for the most recent valid shadow copy.
    let best: SavePayload | null = null;
    try {
      for (let i = 0; i < 9; i++) {
        const raw: string | null = localStorage.getItem(`${PREFIX}shadow_${i}`);
        if (!raw) continue;
        const d: unknown = JSON.parse(raw);
        if (isSaveLike(d) && (!best || (d.savedAt || 0) > best.savedAt)) best = d;
      }
      if (best) {
        console.warn('[save] primary slot corrupt — recovered from shadow');
        return migrateSave(best);
      }
    } catch {
      /* nothing recoverable */
    }
    return best;
  }
}

/** Lightweight metadata for save-slot list UIs. */
export function listSaves(): Record<string, SaveSummary | CorruptSaveEntry | null> {
  const out: Record<string, SaveSummary | CorruptSaveEntry | null> = {};
  for (const id of SLOT_IDS) {
    let entry: SaveSummary | CorruptSaveEntry | null = null;
    try {
      const raw: string | null = localStorage.getItem(keyFor(id));
      if (raw) {
        const d = JSON.parse(raw) as {
          player?: { name?: string; level?: number; gold?: number };
          story?: { chapter?: number };
          world?: { dayCount?: number };
          settlement?: { founded?: boolean; stageIndex?: number };
          meta?: { seed?: unknown; savedAt?: number };
          savedAt?: number;
        };
        entry = {
          name: d.player?.name || 'Stranger',
          level: d.player?.level ?? 1,
          chapter: d.story?.chapter ?? 1,
          day: d.world?.dayCount ?? 1,
          stage: d.settlement?.founded ? (d.settlement.stageIndex as number) : -1,
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

export function deleteSlot(slotId: string): boolean {
  try {
    localStorage.removeItem(keyFor(slotId));
    return true;
  } catch {
    return false;
  }
}

/** Export a slot as a JSON string for download (Phase D save sharing). */
export function exportSlot(slotId = 'auto'): SlotResult {
  try {
    const raw: string | null = localStorage.getItem(keyFor(slotId));
    if (!raw) return { ok: false, msg: 'Slot is empty' };
    JSON.parse(raw); // validate before handing out
    return { ok: true, json: raw };
  } catch {
    return { ok: false, msg: 'Save is corrupted' };
  }
}

/**
 * Import a JSON save string into a target slot. Validates shape the same
 * way loadFromSlot does; never touches existing slots on failure.
 */
export function importSlotData(jsonStr: string, targetSlot = 'slot1'): SlotResult {
  if (!SLOT_IDS.includes(targetSlot)) return { ok: false, msg: 'Bad slot' };
  try {
    const data: unknown = JSON.parse(jsonStr);
    if (!isSaveLike(data)) return { ok: false, msg: 'Not a Rise of the Realm save' };
    localStorage.setItem(keyFor(targetSlot), JSON.stringify(migrateSave(data)));
    return { ok: true, slot: targetSlot };
  } catch {
    return { ok: false, msg: 'Invalid save file' };
  }
}

export function storageAvailable(): boolean {
  try {
    const k = `${PREFIX}probe`;
    localStorage.setItem(k, 'x');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/* ── Versioned migrations ─────────────────────────────────────────────── */

/** Numeric triple compare: -1 | 0 | 1. Unparseable versions sort oldest. */
export function cmpVersions(a: unknown, b: unknown): number {
  const parts = (v: unknown): number[] => String(v ?? '0').split('.').map((n: string) => {
    const x: number = parseInt(n, 10);
    return Number.isFinite(x) ? x : 0;
  });
  const pa: number[] = parts(a), pb: number[] = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d: number = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** One ordered migration step: upgrades saves stamped with `from` to `to`. */
export interface SaveMigration {
  from: string;
  to: string;
  note: string;
  migrate(save: SavePayload): SavePayload;
}

/**
 * Ordered migration steps. Each entry upgrades saves stamped with `from`
 * to `to`. Steps run in sequence until the save reaches SAVE_VERSION.
 * Every step MUST be idempotent (safe to re-run on an already-migrated save).
 */
export const migrations: SaveMigration[] = [
  {
    from: '0.9.0',
    to: '1.0.0',
    note: 'Camera zoom, explored-chunks fog memory, inventory slots, run stats',
    migrate(save: SavePayload): SavePayload {
      // Settings added over time (camZoom, fpsCap, keybinds...) — normalise
      // fills every missing key from defaults without touching the rest.
      try { save.settings = normaliseSettings(save.settings); } catch { /* keep */ }
      // Fog-of-war memory: old saves explored the world but recorded nothing.
      if (!Array.isArray(save.world?.exploredChunks)) {
        if (save.world) save.world.exploredChunks = [];
      }
      // Storage buildings widen the bag; old saves predate the field.
      if (save.inventorySlots == null) save.inventorySlots = INVENTORY_BASE_SLOTS;
      // Run stats (kills/crafted/nights) feed quests and the journal.
      if (save.stats == null || typeof save.stats !== 'object') save.stats = {} as StatsState;
      for (const [k, v] of Object.entries({ kills: 0, crafted: 0, nightsSurvived: 0 })) {
        if (save.stats[k] == null) save.stats[k] = v;
      }
      if (save.achievements == null) save.achievements = {};
      return save;
    }
  }
];

/**
 * Bring any save payload up to SAVE_VERSION. Mutates and returns `data`
 * (safe to call twice — steps are idempotent and version-gated).
 * Records `meta.migratedFrom` when at least one step applied.
 */
export function migrateSave(data: SavePayload): SavePayload {
  if (!data || typeof data !== 'object') return data;
  try {
    data.meta = data.meta && typeof data.meta === 'object' ? data.meta : ({} as MetaState);
    const origin: string = data.meta.version || '0.0.0';
    let version: string = origin;
    let guard = 0;
    while (cmpVersions(version, SAVE_VERSION) < 0 && guard++ < 25) {
      const step: SaveMigration | undefined = migrations.find((m) => cmpVersions(version, m.from) >= 0 && cmpVersions(m.to, version) > 0);
      if (!step) break; // no covering step — jump to repair below
      step.migrate(data);
      version = step.to;
    }
    // Repair pass: fill any top-level branch a save predates, from a fresh
    // default (never overwrites present data). Keeps hand-edited and very
    // old saves playable even without a dedicated step.
    try {
      const fresh: GameRootState = createStateDefaults(data.meta?.seed || 1);
      for (const k of Object.keys(fresh)) {
        if (data[k] === undefined) data[k] = fresh[k];
      }
      data.settings = normaliseSettings(data.settings);
    } catch { /* repair is best-effort */ }
    if (cmpVersions(origin, SAVE_VERSION) < 0) {
      data.meta.migratedFrom = origin;
      data.meta.version = SAVE_VERSION;
      console.info(`[save] migrated ${origin} → ${SAVE_VERSION}`);
    } else if (!data.meta.version) {
      data.meta.version = SAVE_VERSION;
    }
    // Note: saves NEWER than this client keep their stamp (never downgrade).
  } catch (err) {
    console.warn('[save] migration failed, loading as-is', err);
  }
  return data;
}
