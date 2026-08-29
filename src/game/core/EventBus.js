// ─────────────────────────────────────────────────────────────────────────────
// Minimal event emitter shared by game systems and React UI.
// Zero dependencies so pure logic stays testable outside Phaser/browser.
// ─────────────────────────────────────────────────────────────────────────────

class MiniEmitter {
  constructor() {
    this.handlers = new Map();
  }
  on(type, fn) {
    let list = this.handlers.get(type);
    if (!list) {
      list = [];
      this.handlers.set(type, list);
    }
    list.push(fn);
    return () => this.off(type, fn);
  }
  once(type, fn) {
    const off = this.on(type, (...args) => {
      off();
      fn(...args);
    });
    return off;
  }
  off(type, fn) {
    const list = this.handlers.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  removeAll() {
    this.handlers.clear();
  }
  emit(type, payload) {
    const list = this.handlers.get(type);
    if (!list || list.length === 0) return;
    for (let i = 0; i < list.length; i++) {
      try {
        list[i](payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${type}" failed:`, err);
      }
    }
  }
}

export const Bus = new MiniEmitter();

/** Canonical bus channel names. */
export const CH = Object.freeze({
  ASSETS: 'assets',
  PLAYER: 'player',
  RESOURCES: 'resources',
  INVENTORY: 'inventory',
  EQUIPMENT: 'equipment',
  QUESTS: 'quests',
  STORY: 'story',
  SETTLEMENT: 'settlement',
  WORLD: 'world',
  FACTIONS: 'factions',
  ACHIEVEMENTS: 'achievements',
  SETTINGS: 'settings',
  TIME: 'time',
  WEATHER: 'weather',
  TOAST: 'toast',
  DIALOGUE: 'dialogue',
  MINIMAP: 'minimap',
  BOSSBAR: 'bossbar',
  RAID: 'raid',
  SCREEN: 'screen'
});
