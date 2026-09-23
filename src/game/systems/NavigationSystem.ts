// ─────────────────────────────────────────────────────────────────────────────
// NavigationSystem — the world map's navigation state: the compass sector a
// target lies in, distance to it, and whether the player has arrived.
//
// Session-only (no save migration) and Phaser-free, so the geometry is
// unit-testable in node.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { CH } from '../core/EventBus.ts';
import { WORLD_CONFIG } from '../core/Constants.ts';

export const MAP_VIEW_RADIUS = 7000;
export const ARRIVAL_RADIUS = 80;
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Convert normalized canvas coordinates (independent of CSS/retina size). */
export function mapPoint(u: number, v: number, cx: number, cy: number): { x: number; y: number } {
  return { x: cx + (u - 0.5) * MAP_VIEW_RADIUS * 2, y: cy + (v - 0.5) * MAP_VIEW_RADIUS * 2 };
}

export function setWaypoint(x: number, y: number, label = 'Map waypoint'): boolean {
  if (!GameState.s || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const limit = WORLD_CONFIG.worldHalfExtent;
  GameState.session.waypoint = {
    x: Math.round(Math.max(-limit, Math.min(limit, x))),
    y: Math.round(Math.max(-limit, Math.min(limit, y))),
    label: label.trim().slice(0, 80) || 'Map waypoint'
  };
  GameState.notify(CH.MINIMAP);
  return true;
}

export function clearWaypoint(): void {
  GameState.session.waypoint = null;
  GameState.notify(CH.MINIMAP);
}

export function navigationSnapshot() {
  const target = GameState.session.waypoint;
  const world = GameState.s?.world;
  if (!target || !world) return null;
  const dx = target.x - world.px, dy = target.y - world.py;
  const bearing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return { ...target, distance: Math.round(Math.hypot(dx, dy)), bearing,
    direction: DIRECTIONS[Math.round(bearing / 45) % 8] ?? 'N' };
}

/** Called at the existing minimap cadence, not on every render frame. */
export function updateNavigation(px: number, py: number): void {
  const target = GameState.session.waypoint;
  if (!target) return;
  if (Math.hypot(target.x - px, target.y - py) <= ARRIVAL_RADIUS) {
    clearWaypoint();
    GameState.toast({ title: 'Destination reached', msg: target.label, kind: 'info' });
  } else {
    GameState.notify(CH.MINIMAP);
  }
}
