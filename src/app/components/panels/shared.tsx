// ─────────────────────────────────────────────────────────────────────────────
// Panel furniture shared by every panel: the item icon, the one close path, and
// the session view of GameState (the UI-only fields the game batch owns).
// ─────────────────────────────────────────────────────────────────────────────
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { getItem } from '../../../game/data/items.ts';
import { iconDataURLs } from '../../../game/assets/icons.ts';
import type { IconProps } from './types.ts';

// GameState.session gains dynamic UI-only fields at runtime (game batch owns the type).
export type SessionExtras = Record<string, any>;
export const uiSession = GameState.session as unknown as SessionExtras;

/** The one item icon used by every panel grid. */
export function Icon({ id, size = 34 }: IconProps): JSX.Element {
  const url: string | undefined = iconDataURLs[id];
  return url
    ? <img className="inv-icon" src={url} width={size} height={size} style={{ width: size, height: size }} alt={getItem(id)?.name || id} />
    : <span className="inv-icon text" style={{ width: size, height: size }}>?</span>;
}

export function close(): void {
  GameState.session.uiPanel = null;
  GameState.session.paused = false;
  GameState.notify(CH.SCREEN);
}
