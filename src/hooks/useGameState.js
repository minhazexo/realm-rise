// React bridge hook (spec §56): subscribe to a list of bus channels and get a
// re-render whenever any of them fire. Phaser mutates state; React reacts.
import { useSyncExternalStore, useCallback, useRef } from 'react';
import { Bus } from '../game/core/EventBus.js';
import GameState from '../game/core/GameState.js';

const EMPTY = Object.freeze([]);

function shallowEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (a[keysA[i]] !== b[keysA[i]]) return false;
  }
  return true;
}

export function useGameState(channels = EMPTY, select = (s) => s) {
  // Use a ref so the subscribe callback always reads the latest channels
  // without needing channels in the useCallback deps (which would be unstable
  // if the caller creates a new array each render).
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  const subscribe = useCallback(
    (cb) => {
      const offs = channelsRef.current.map((ch) => Bus.on(ch, cb));
      // also listen to a generic refresh for forced syncs
      const offR = Bus.on('refresh-ui', cb);
      return () => {
        offs.forEach((o) => o());
        offR();
      };
    },
    [] // stable — channels read via ref
  );

  // Cache the previous snapshot so getSnapshot returns the same reference
  // when values haven't changed. Without this, select() creates a new object
  // each call, and useSyncExternalStore detects a "change" → infinite loop.
  const prevRef = useRef(null);
  const prevJsonRef = useRef(null);

  const getSnapshot = useCallback(() => {
    const next = select(GameState.s, GameState.session);
    if (prevRef.current !== null && shallowEqual(prevRef.current, next)) {
      return prevRef.current;
    }
    // Fallback for nested objects: compare by serialised form.
    const json = JSON.stringify(next);
    if (prevRef.current !== null && prevJsonRef.current === json) {
      return prevRef.current;
    }
    prevRef.current = next;
    prevJsonRef.current = json;
    return next;
  }, [select]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Snap to a specific state slice. */
export const slice = (s) => ({ player: s?.player, session: GameState.session, world: s?.world });
