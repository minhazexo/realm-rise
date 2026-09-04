// ─────────────────────────────────────────────────────────────────────────────
// The single source of truth. Systems mutate `GameState.state`, then notify
// channels; React panels subscribe via useGameState(channel). Phaser reads
// state directly every frame — React never sees per-frame traffic (spec §56).
// ─────────────────────────────────────────────────────────────────────────────
import { createStateDefaults, STARTER_KIT } from './stateFactory.js';
import { CH, Bus } from './EventBus.js';
import { getItem } from '../data/items.js';
import { applyBoon } from '../systems/LegacyStore.js';

class GameStore {
  constructor() {
    this.state = null;
    this.session = {
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
  }

  /** Boot a fresh save and optionally seed identity fields from character creation. */
  newGame(seed, charOpts = {}, difficulty = 'normal') {
    const st = createStateDefaults(seed);
    this.state = st;
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
    const pBumps = { bold: { strength: 1 }, stoic: { defense: 1 }, kind: { willpower: 1 }, clever: { intellect: 1 } };
    Object.assign(st.player.alloc, pBumps[st.player.personality] || {});
    // Phase E: NG+ heirloom boon from a completed run (validated inside
    // applyBoon — locked/unknown ids are ignored, never crash newGame).
    if (charOpts.heirloom) {
      try { applyBoon(st, charOpts.heirloom); } catch { /* no boon */ }
    }
    return st;
  }

  load(stateJson) {
    this.state = stateJson;
    this.session.uiPanel = null;
    this.session.paused = false;
    this.session.dialogue = null;
  }

  get s() {
    return this.state;
  }

  /* ── channel notification ─────────────────────────────────────────────── */
  notify(...keys) {
    for (const k of keys) Bus.emit(k);
  }

  toast({ title, msg, kind = 'info', icon, dur = 3800 }) {
    Bus.emit(CH.TOAST, { title, msg, kind, icon, dur });
  }

  floatText(worldX, worldY, text, style) {
    // Scene registers itself as renderer; keeps systems decoupled from Phaser types.
    if (this.session.floatRenderer) this.session.floatRenderer(worldX, worldY, text, style);
  }
}

export const GameState = new GameStore();
export default GameState;
