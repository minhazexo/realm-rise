// ─────────────────────────────────────────────────────────────────────────────
// The single source of truth. Systems mutate `GameState.state`, then notify
// channels; React panels subscribe via useGameState(channel). Phaser reads
// state directly every frame — React never sees per-frame traffic (spec §56).
// ─────────────────────────────────────────────────────────────────────────────
import { createStateDefaults, STARTER_KIT } from './stateFactory.ts';
import type { GameRootState, CharOpts, PlayerAlloc } from './stateFactory.ts';
import type { DifficultyKey } from './Constants.ts';
import { CH, Bus } from './EventBus.ts';
import { getItem } from '../data/items.ts';
import { applyBoon } from '../systems/LegacyStore.ts';
import { migrateSave } from '../systems/SaveSystem.ts';
import type { SavePayload } from '../systems/SaveSystem.ts';

export interface ToastOptions {
  title?: string;
  msg?: string;
  kind?: string;
  icon?: unknown;
  dur?: number;
}

export interface ToastEntry {
  title?: string;
  msg?: string;
  kind?: string;
  icon?: unknown;
  dur?: number;
  [key: string]: any;
}

export interface SessionDialogue {
  npc: string;
  [key: string]: any;
}

export interface PendingBuild {
  key: string;
  [key: string]: any;
}

export interface ActiveBossInfo {
  name?: string;
  hp?: number;
  maxHp?: number;
  phase?: number;
  [key: string]: any;
}

export interface LastAchievement {
  id: string;
  name: string;
  desc: string;
  at: number;
}

/** Scene-registered world-space text renderer (WorldScene installs this). */
export type FloatRenderer = (worldX: number, worldY: number, text: string, style?: any, scale?: number) => void;

export interface SessionState {
  uiPanel: string | null; // 'inventory' | 'crafting' | ... | null
  paused: boolean;
  /** Navigation target is deliberately excluded from saved state. */
  waypoint?: { x: number; y: number; label: string } | null;
  screen: string; // boot | menu | creation | intro | world
  dialogue: SessionDialogue | null;
  toasts: ToastEntry[];
  inCombat: boolean;
  activeBossKey: string | null;
  buildMode: boolean;
  pendingBuild: PendingBuild | null;
  raidActive: boolean;
  debugVisible: boolean;
  /** Installed by WorldScene; invoked by GameState.floatText. */
  floatRenderer?: FloatRenderer | null;
  /** Published boss-bar snapshot for the React overlay. */
  activeBoss?: ActiveBossInfo | null;
  /** Last unlocked achievement (consumed by the popup, then cleared). */
  lastAchievement?: LastAchievement | null;
  /** Cached by KingdomSystem.territoryPct for achievement checks. */
  territoryPct?: number;
  /** 'day' | 'night', maintained by EnvSystem. */
  timePhase?: string;
  [key: string]: any;
}

class GameStore {
  state: GameRootState | null = null;
  session: SessionState = {
    uiPanel: null,        // 'inventory' | 'crafting' | ... | null
    paused: false,
    screen: 'boot',       // boot | menu | creation | intro | world
    dialogue: null,
    toasts: [],
    inCombat: false,
    activeBossKey: null,
    buildMode: false,
    pendingBuild: null,
    raidActive: false,
    debugVisible: false
  };
  /** Floating menu-backdrop seed assigned once by the main entry point. */
  _menuSeed: number | null = null;
  /** World-space player position published by the scene (see DynamicLights). */
  _playerWorldXY: { x: number; y: number } = { x: 0, y: 0 };

  /** Boot a fresh save and optionally seed identity fields from character creation. */
  newGame(seed: number, charOpts: CharOpts = {}, difficulty: DifficultyKey = 'normal'): GameRootState {
    const st: GameRootState = createStateDefaults(seed);
    this.state = st;
    this.session.waypoint = null;
    if (charOpts.name) st.player.name = charOpts.name;
    Object.assign(st.player.appearance, charOpts.appearance || {});
    if (charOpts.gender) st.player.gender = charOpts.gender;
    if (charOpts.personality) st.player.personality = charOpts.personality;
    st.settings.difficulty = difficulty;
    // Starter kit: equipped items go into equipment slots, rest into inventory.
    for (const entry of STARTER_KIT()) {
      if (entry.eq) {
        const def = getItem(entry.id);
        st.player.equipment[entry.eq] = { ref: entry.id, id: entry.id, dur: def?.durability ?? null };
      } else {
        st.inventory.push({ id: entry.id, qty: entry.qty });
      }
    }
    // Personality micro-identity bonuses (spec §7 — different paths feel different).
    const pBumps: Record<string, Partial<PlayerAlloc>> = { bold: { strength: 1 }, stoic: { defense: 1 }, kind: { willpower: 1 }, clever: { intellect: 1 } };
    Object.assign(st.player.alloc, pBumps[st.player.personality] || {});
    // Phase E: NG+ heirloom boon from a completed run (validated inside
    // applyBoon — locked/unknown ids are ignored, never crash newGame).
    if (charOpts.heirloom) {
      try { applyBoon(st, charOpts.heirloom); } catch { /* no boon */ }
    }
    return st;
  }

  load(stateJson: unknown): void {
    // Versioned saves: migrate before adopting (idempotent — storage loads
    // already migrated, programmatic loads migrate here).
    try {
      this.state = migrateSave(stateJson as SavePayload);
    } catch {
      this.state = stateJson as GameRootState;
    }
    // TEMPORARY god-mode (user request): every loaded save plays immortal
    // until the default is flipped back. The Settings toggle can still turn
    // it off mid-session, but the next load re-enables it.
    try {
      if (this.state?.settings) this.state.settings.immortal = true;
    } catch { /* never block loading */ }
    // Ensure the loaded game is not stuck in a dead state
    if (this.state) {
      this.state.session_dead = false;
      if (this.state.player) {
        if (!this.state.player.hp || this.state.player.hp <= 0) {
          this.state.player.hp = this.state.player.derived?.maxHp || 100;
        }
      }
    }
    this.session.waypoint = null;
    this.session.uiPanel = null;
    this.session.paused = false;
    this.session.dialogue = null;
  }

  get s(): GameRootState {
    // Consumers (entities, scenes, systems) dereference unconditionally and
    // only ever run once a game is booted; the non-null surface matches that
    // established contract (verified across all current .ts consumers).
    return this.state as GameRootState;
  }

  /* ── channel notification ─────────────────────────────────────────────── */
  notify(...keys: string[]): void {
    for (const k of keys) Bus.emit(k);
  }

  /* ── dialogue ─────────────────────────────────────────────────────────── */
  // Dialogue lives in `session` (UI-only), but the React modal is a
  // useSyncExternalStore consumer: clearing the field without notifying the
  // channel leaves the modal on screen forever. Keeping the write and the
  // notify together here gives every close path one owner.
  closeDialogue(): void {
    if (this.session.dialogue === null) return;
    this.session.dialogue = null;
    Bus.emit(CH.DIALOGUE);
  }

  toast({ title, msg, kind = 'info', icon, dur = 3800 }: ToastOptions): void {
    Bus.emit(CH.TOAST, { title, msg, kind, icon, dur });
  }

  floatText(worldX: number, worldY: number, text: string, style?: unknown): void {
    // Scene registers itself as renderer; keeps systems decoupled from Phaser types.
    if (this.session.floatRenderer) this.session.floatRenderer(worldX, worldY, text, style);
  }
}

export const GameState = new GameStore();
export default GameState;
