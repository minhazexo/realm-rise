// ─────────────────────────────────────────────────────────────────────────────
// Synchronous key/value storage for every persistence path.
//
// SaveSystem, LegacyStore and SettingsSystem need *synchronous* reads: the slot
// list renders during a React render and a load happens mid-frame. Browsers have
// localStorage for that; a desktop shell has a file. This module keeps the
// synchronous contract by holding the keys in memory and handing writes to the
// shell, which persists them atomically (see electron/main.cjs).
//
// Backend selection is lazy: the web path resolves `globalThis.localStorage` at
// call time (so tests can swap a stub after import), and platform/desktop.ts
// installs the file backend before React mounts.
// ─────────────────────────────────────────────────────────────────────────────

export interface KvBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/* ── memory: no storage available (node, private mode, quota failure) ───── */

const memory = new Map<string, string>();
const MEMORY: KvBackend = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => { memory.set(k, v); },
  removeItem: (k) => { memory.delete(k); }
};

/* ── web: localStorage ──────────────────────────────────────────────────── */

function webBackend(ls: Storage): KvBackend {
  return {
    // Reads are guarded: a throwing getter (private mode) must not break a load.
    getItem: (k) => {
      try { return ls.getItem(k); } catch { return null; }
    },
    setItem: (k, v) => { ls.setItem(k, v); },
    removeItem: (k) => { ls.removeItem(k); }
  };
}

/* ── desktop: shell-persisted snapshot ──────────────────────────────────── */

/**
 * Back the store with a plain object the shell persists. `persist` receives the
 * whole serialised document; writes in the same tick are coalesced so one save
 * (primary + shadow copy) is one disk write. Reads stay synchronous.
 */
export function createDesktopBackend(
  store: Record<string, string>,
  persist: (json: string) => void
): KvBackend {
  let scheduled = false;
  const flushSoon = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      try { persist(JSON.stringify(store)); } catch { /* shell unavailable */ }
    });
  };
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] ?? null : null),
    setItem: (k, v) => { store[k] = v; flushSoon(); },
    removeItem: (k) => { if (k in store) { delete store[k]; flushSoon(); } }
  };
}

/* ── active backend ─────────────────────────────────────────────────────── */

let override: KvBackend | null = null;

/** Install the shell backend (or a test double). `null` restores auto-detection. */
export function installBackend(backend: KvBackend | null): void {
  override = backend;
}

function active(): KvBackend {
  if (override) return override;
  const ls = (globalThis as { localStorage?: Storage }).localStorage;
  return ls ? webBackend(ls) : MEMORY;
}

export function kvGet(key: string): string | null {
  return active().getItem(key);
}

export function kvSet(key: string, value: string): void {
  active().setItem(key, value);
}

export function kvRemove(key: string): void {
  active().removeItem(key);
}
