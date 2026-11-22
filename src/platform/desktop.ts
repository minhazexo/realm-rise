// ─────────────────────────────────────────────────────────────────────────────
// Desktop bootstrap: hydrate the file-backed store before React or Phaser read
// a save.
//
// The shell contract is three functions, shell-agnostic by design:
//
//   window.rotrDesktop = {
//     loadStore(): Promise<string | null>   // the whole JSON document
//     saveStore(json): Promise<void>        // atomic write
//     flushStore?(json): void               // synchronous, on pagehide
//   }
//
// Electron implements it in electron/preload.cjs; a Tauri shell could expose the
// same object. The game never learns which runtime it is on.
// ─────────────────────────────────────────────────────────────────────────────
import { createDesktopBackend, installBackend } from './kv.ts';

/** Refuse absurd documents so a corrupt file cannot stall boot. */
const MAX_STORE_BYTES = 64 * 1024 * 1024;

export interface DesktopBridge {
  loadStore(): Promise<string | null>;
  saveStore(json: string): Promise<void>;
  flushStore?(json: string): void;
}

declare global {
  interface Window {
    rotrDesktop?: DesktopBridge;
  }
}

/** Everything the game persisted, keyed exactly as it was in localStorage. */
export type StoreDocument = Record<string, string>;

/** Parse the shell document defensively; anything unexpected yields {}. */
export function parseStore(raw: string | null | undefined): StoreDocument {
  if (!raw || raw.length > MAX_STORE_BYTES) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out: StoreDocument = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Boot the storage layer. A no-op on the web. In a desktop shell it loads the
 * file store and installs the backend BEFORE any caller reads a slot.
 */
export async function bootDesktopStorage(): Promise<void> {
  const bridge = window.rotrDesktop;
  if (!bridge) return;

  let raw: string | null = null;
  try { raw = await bridge.loadStore(); } catch { /* treat as empty */ }

  const store = parseStore(raw);
  let dirty = false;

  installBackend(createDesktopBackend(store, (json) => {
    dirty = true;
    void bridge.saveStore(json).catch(() => { /* disk full / shell closing */ });
  }));

  // A hard quit (Alt+F4, Steam overlay) does not wait for promises. Only flush
  // when this session changed the store: an untouched snapshot must not
  // overwrite a newer document.
  window.addEventListener('pagehide', () => {
    if (!dirty) return;
    try { bridge.flushStore?.(JSON.stringify(store)); } catch { /* closing */ }
  });

  console.info(`[storage] desktop file store active (${Object.keys(store).length} keys)`);
}
