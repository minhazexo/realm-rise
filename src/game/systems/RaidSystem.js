// ─────────────────────────────────────────────────────────────────────────────
// RaidSystem (Phase D): hostile factions and open wars finally have teeth.
//
// Previously `war`/`hostile` standings were tracked but produced no invasion
// events (TODO #9). Now, while the settlement stands and a faction is
// hostile (or at war), raid parties march on the Town Hall every few
// minutes. Raiders carry `raider=true`: WorldScene steers them at buildings
// when the player is far, and buildings take real HP damage (TODO #4).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus, CH } from '../core/EventBus.js';
import { FACTIONS } from '../data/factions.js';
import { statusOf } from './FactionSystem.js';

const st = () => GameState.s;

/** Factions currently hostile-or-worse toward the player. */
export function hostileFactions() {
  return Object.keys(FACTIONS || {})
    .filter((k) => ['hostile', 'war'].includes(statusOf(k)))
    .map((k) => ({ key: k, name: FACTIONS[k].name, status: statusOf(k) }));
}

/** Raid party composition scales with realm stage + war status. */
function partyFor(stageIndex, atWar) {
  const size = Math.min(6, 2 + Math.floor(stageIndex / 2) + (atWar ? 1 : 0));
  const pool = ['bandit_scout', 'bandit_swordsman', 'bandit_swordsman', 'bandit_archer', 'bandit_brute'];
  const party = [];
  for (let i = 0; i < size; i++) party.push(pool[Math.floor(Math.random() * pool.length)]);
  return party;
}

/**
 * Scheduler — call every ~30s from WorldScene.update. Returns true when a
 * raid launched. Cooldown + gating live on the scene (`_raidCd`) so saves
 * never have to serialize scheduler state.
 */
export function raidTick(scene) {
  const S = st();
  if (!S?.settlement?.founded || (S.meta.playSeconds || 0) < 1200) return false;
  if ((scene._raidCd || 0) > S.meta.playSeconds) return false;
  const hostiles = hostileFactions();
  if (!hostiles.length) return false;

  const foe = hostiles[Math.floor(Math.random() * hostiles.length)];
  const atWar = foe.status === 'war';
  const party = partyFor(S.settlement.stageIndex || 0, atWar);
  const home = S.settlement.pos;
  const ang = Math.random() * Math.PI * 2;
  const dist = 480 + Math.random() * 160;
  for (const key of party) {
    const e = scene.spawnEnemy(key, home.x + Math.cos(ang) * dist, home.y + Math.sin(ang) * dist);
    if (e) e.raider = true;
  }
  scene._raidCd = S.meta.playSeconds + 300 + Math.random() * 240;
  GameState.toast({
    title: `⚔ ${foe.name} raid!`,
    msg: `${party.length} raiders march on your settlement. Defend it!`,
    kind: 'danger', dur: 6000,
  });
  Bus.emit('play-sound', 'boss_roar');
  GameState.notify(CH.FACTIONS);
  return true;
}
