// ─────────────────────────────────────────────────────────────────────────────
// AutoAttackSystem — defensive auto-swing ("counter-attack assist").
//
// When an enemy strikes the player (or is already attacking / chasing within
// melee range), the character automatically swings at the highest-priority
// threat without a click. Built for comfort play and for players who find
// click-timing difficult. It never overrides blocking, dodging, hitstop, or
// a swing already in progress, and it can be switched off in
// Settings → Gameplay ("Auto-attack when attacked").
//
// Pure logic: no Phaser import, so tests/autoattack.mjs exercises it in node
// with stub scenes. Numeric enemy states mirror Enemy.ts's frozen STATE map;
// targeting priority lives in scoreTarget().
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { getItem } from '../data/items.ts';
import { countItem } from './InventorySystem.ts';

/** Seconds after being struck that the character keeps hunting the attacker. */
const VENGEANCE_WINDOW = 2.5;
/** Keep the locked target while it stays alive within this radius (px). */
const LOCK_RANGE = 400;
/** Candidate scan radius — enemies beyond this are never auto-targeted. */
const SCAN_RANGE = 300;
/** Grace beyond weapon reach + enemy radius before a swing fires. */
const SWING_SLACK = 6;

/** Enemy FSM states, mirrored from Enemy.ts (kept numeric for testability). */
const E_STATE = Object.freeze({ DETECT: 2, CHASE: 3, ATTACK: 4 });

/** Per-scene mutable auto-attack state, stored on the scene object. */
interface AutoState {
  /** Seconds until the next auto-swing may fire. */
  cd: number;
  /** Currently locked enemy (sticky target), or null. */
  lock: any | null;
  /** Remaining vengeance-window seconds after the last incoming hit. */
  vengeance: number;
}

function stateOf(scene: any): AutoState {
  if (!scene._autoAtk) {
    scene._autoAtk = { cd: 0, lock: null, vengeance: 0 } as AutoState;
  }
  return scene._autoAtk as AutoState;
}

/**
 * Called by Player.takeDamage whenever an enemy lands a hit on the player.
 * Opens the vengeance window so the next tick counter-attacks the source.
 */
export function notifyPlayerHit(scene: any, srcX?: number | null): void {
  if (scene == null || srcX == null) return;
  stateOf(scene).vengeance = VENGEANCE_WINDOW;
}

/** Is the feature enabled? Reads the live settings toggle (default on). */
export function autoAttackEnabled(): boolean {
  return GameState.s?.settings?.toggles?.autoAttack !== false;
}

/**
 * Score one candidate enemy — lower is a better auto-target.
 * Exported for tests.
 */
export function scoreTarget(e: any, dist: number): number {
  let score = dist;
  if (e.state === E_STATE.ATTACK) score -= 120;
  else if (e.state === E_STATE.CHASE) score -= 60;
  else if (e.state === E_STATE.DETECT) score -= 20;
  if (e.maxHp > 0 && e.hp / e.maxHp < 0.5) score -= 50;
  return score;
}

/** Weapon reach in px (mirrors Player.tryAttack's defaults). */
function weaponReach(): { range: number; style: string; ammo?: string } {
  const eq = GameState.s?.player?.equipment?.weapon;
  const w = eq ? getItem(eq.id) : null;
  const wpn = (w?.weapon || { range: 40, style: 'slash' }) as { range?: number; style?: string; ammo?: string };
  return { range: wpn.range || 40, style: wpn.style || 'slash', ammo: wpn.ammo };
}

/** True when the player is mid-action and must not be interrupted. */
function playerBusy(scene: any): boolean {
  const S = GameState.s;
  if (!S || S.session_dead) return true;
  const p = scene.player;
  if (!p?.sprite) return true;
  if (p.blocking || (p.cool?.attack ?? 0) > 0) return true;
  if (GameState.session.uiPanel != null || GameState.session.paused) return true;
  return false;
}

/**
 * Pick the auto-attack target: the locked enemy if still valid, else the
 * lowest-scored candidate within SCAN_RANGE. Only threatening enemies
 * (detecting / chasing / attacking) qualify — the assist never initiates
 * fights with idle or patrolling critters — unless the vengeance window is
 * open, in which case the attacker becomes eligible wherever it is.
 * Returns null when nothing is worth attacking.
 */
export function pickTarget(scene: any): any | null {
  const p = scene.player;
  const px: number = p.sprite.x, py: number = p.sprite.y;
  const st = stateOf(scene);

  // Sticky lock: hold the current target while alive and in range.
  const lock = st.lock;
  if (lock && !lock.dead && lock.sprite) {
    const d2 = (lock.sprite.x - px) ** 2 + (lock.sprite.y - py) ** 2;
    if (d2 <= LOCK_RANGE * LOCK_RANGE) return lock;
    st.lock = null;
  }

  const vengeful = st.vengeance > 0;
  let best: any | null = null;
  let bestScore = Infinity;
  for (const e of scene.enemies as any[]) {
    if (!e || e.dead || !e.sprite) continue;
    const dist = Math.hypot(e.sprite.x - px, e.sprite.y - py);
    if (dist > SCAN_RANGE) continue;
    // Defensive gate: ignore non-threats unless we were just struck.
    if (!vengeful && (e.state ?? 0) < E_STATE.DETECT) continue;
    const score = scoreTarget(e, dist);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  if (best) st.lock = best;
  return best;
}

/**
 * Per-frame tick. Call from WorldScene.update after the enemy loop.
 * Handles cooldowns, target selection, and the actual swing via
 * Player.tryAttack (which owns stamina, weapon identity, FX, and juice).
 *
 * @param scene WorldScene (or a stub in tests).
 * @param dt    Frame delta in seconds.
 * @returns true when an auto-swing was performed this tick.
 */
export function autoAttackTick(scene: any, dt: number): boolean {
  const st = stateOf(scene);
  st.cd = Math.max(0, st.cd - dt);
  st.vengeance = Math.max(0, st.vengeance - dt);

  if (!autoAttackEnabled()) { st.lock = null; return false; }
  if (playerBusy(scene)) return false;

  const target = pickTarget(scene);
  if (!target) return false;

  const p = scene.player;
  const S = GameState.s;
  const px: number = p.sprite.x, py: number = p.sprite.y;
  const tx: number = target.sprite.x, ty: number = target.sprite.y;
  const dist = Math.hypot(tx - px, ty - py);

  // Swing only once actually in range — no lunging at distant enemies.
  const wr = weaponReach();
  const radius = target.def?.radius || 10;
  // Bows auto-fire only with ammo; otherwise hold fire silently (no
  // "No arrows!" floater spam — manual fire keeps that feedback).
  if (wr.style === 'bow' && (!wr.ammo || countItem(wr.ammo) <= 0)) return false;
  if (dist > wr.range + radius * 0.5 + SWING_SLACK) return false;

  // Swing toward the target: tryAttack derives facing + arc from the
  // pointerWorld argument, so passing the target position aims the blow.
  const swung = p.tryAttack({ heavy: false }, { x: tx, y: ty }, scene.enemies, scene.floats);
  if (swung !== undefined) {
    // Light attacks are on the weapon cooldown already; add a small floor
    // so auto-swing can never machine-gun faster than ~2.5/s regardless of
    // weapon cd hacks or derived-stat stacking.
    st.cd = Math.max(0.4, (p.cool?.attack ?? 0) * 0.9);
    S.stats.autoAttacks = (S.stats.autoAttacks || 0) + 1;
    return true;
  }
  return false;
}