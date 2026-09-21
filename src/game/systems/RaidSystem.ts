// ─────────────────────────────────────────────────────────────────────────────
// RaidSystem (Phase D): hostile factions and open wars finally have teeth.
//
// Previously `war`/`hostile` standings were tracked but produced no invasion
// events (TODO #9). Now, while the settlement stands and a faction is
// hostile (or at war), raid parties march on the Town Hall every few
// minutes. Raiders carry `raider=true`: WorldScene steers them at buildings
// when the player is far, and buildings take real HP damage (TODO #4).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { FACTIONS } from '../data/factions.ts';
import type { FactionDef } from '../data/factions.ts';
import { statusOf } from './FactionSystem.ts';
import { rollRaidParty } from '../data/lootTables.ts';
import type { GameRootState } from '../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

/** Hostile-or-worse faction descriptor for raid scheduling. */
export interface HostileFaction {
  key: string;
  name: string;
  status: string;
}

/** Enemy entity spawned into a raid party. */
export interface RaidEnemy {
  raider?: boolean;
  [key: string]: unknown;
}

/** Minimal scene surface consumed by the raid scheduler. */
export type RaidScene = Phaser.Scene & {
  _raidCd?: number;
  spawnEnemy(key: string, x: number, y: number): RaidEnemy | null;
};

/** Factions currently hostile-or-worse toward the player. */
export function hostileFactions(): HostileFaction[] {
  return Object.keys(FACTIONS || {})
    .filter((k) => ['hostile', 'war'].includes(statusOf(k)))
    .map((k) => {
      const def = FACTIONS[k] as FactionDef;
      return { key: k, name: def.name, status: statusOf(k) as string };
    });
}

/** Raid party composition scales with realm stage + war status. */
function partyFor(stageIndex: number, atWar: boolean): string[] {
  const size: number = Math.min(6, 2 + Math.floor(stageIndex / 2) + (atWar ? 1 : 0));
  return rollRaidParty(size);
}

/**
 * Scheduler — call every ~30s from WorldScene.update. Returns true when a
 * raid launched. Cooldown + gating live on the scene (`_raidCd`) so saves
 * never have to serialize scheduler state.
 */
export function raidTick(scene: RaidScene): boolean {
  const S = st();
  if (!S?.settlement?.founded || (S.meta.playSeconds || 0) < 1200) return false;
  if ((scene._raidCd || 0) > S.meta.playSeconds) return false;
  const hostiles: HostileFaction[] = hostileFactions();
  if (!hostiles.length) return false;

  const foe: HostileFaction | undefined = hostiles[Math.floor(Math.random() * hostiles.length)];
  if (!foe) return false;
  const atWar: boolean = foe.status === 'war';
  const party: string[] = partyFor(S.settlement.stageIndex || 0, atWar);
  const home: { x: number; y: number } | null = S.settlement.pos;
  if (!home) return false;
  const ang: number = Math.random() * Math.PI * 2;
  // Raiders arrive as
  // a column — staggered depths along the approach axis — instead of one
  // simultaneous ring. Reads as a marching party and staggers aggro.
  for (let i = 0; i < party.length; i++) {
    const key: string = party[i] as string;
    const depth: number = Math.floor(i / 2) * 46;       // two abreast
    const lateral: number = (i % 2 === 0 ? -1 : 1) * 26; // ±26px file offset
    const dist: number = 480 + depth + Math.random() * 30;
    const ex: number = home.x + Math.cos(ang) * dist + Math.cos(ang + Math.PI / 2) * lateral;
    const ey: number = home.y + Math.sin(ang) * dist + Math.sin(ang + Math.PI / 2) * lateral;
    const e: RaidEnemy | null = scene.spawnEnemy(key, ex, ey);
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
