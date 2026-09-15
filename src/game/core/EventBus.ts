// ─────────────────────────────────────────────────────────────────────────────
// Minimal event emitter shared by game systems and React UI.
// Zero dependencies so pure logic stays testable outside Phaser/browser.
// ─────────────────────────────────────────────────────────────────────────────

/** Payload carried by any bus channel. Deliberately open: gameplay events,
// UI hints and audio cues all share the one bus. */
export type BusPayload = any;

/** A subscriber invoked on emit. The payload may be omitted for signal-only channels. */
export type BusListener = (payload?: BusPayload) => void;

/** Unsubscribe function returned by on()/once(). */
export type BusUnsubscribe = () => void;

class MiniEmitter {
  private handlers: Map<string, BusListener[]> = new Map();

  on(type: string, fn: BusListener): BusUnsubscribe {
    let list: BusListener[] | undefined = this.handlers.get(type);
    if (!list) {
      list = [];
      this.handlers.set(type, list);
    }
    list.push(fn);
    return () => this.off(type, fn);
  }

  once(type: string, fn: BusListener): BusUnsubscribe {
    const off: BusUnsubscribe = this.on(type, (payload?: BusPayload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off(type: string, fn: BusListener): void {
    const list: BusListener[] | undefined = this.handlers.get(type);
    if (!list) return;
    const i: number = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  removeAll(): void {
    this.handlers.clear();
  }

  emit(type: string, payload?: BusPayload): void {
    const list: BusListener[] | undefined = this.handlers.get(type);
    if (!list || list.length === 0) return;
    for (let i = 0; i < list.length; i++) {
      // Guarded for noUncheckedIndexedAccess; verified safe by the loop bound.
      const fn: BusListener | undefined = list[i];
      if (fn === undefined) continue;
      try {
        fn(payload);
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
