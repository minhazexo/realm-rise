// ─────────────────────────────────────────────────────────────────────────────
// RegionEncounters — the region's designed fights.
//
// An encounter is authored as members with ROLES, never as a random scatter:
// RegionLayout seats them and tunes them (watchmen walk a beat, guards hold a
// post, leaders are quick to notice, ambushers charge). A camp with `alarm`
// answers a fight once, and a spawned fight is recorded in the save so the same
// designed encounter never has to be fought twice.
//
// Owns: the members spawned per encounter, and which alarms have fired.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { spawnEnemy } from './SpawnDirector.ts';
import { ROLE_TUNING, encounterPlan } from './RegionLayout.ts';
import { regionState, setRegionFlag } from './RegionState.ts';
import type { RegionScene } from './RegionState.ts';
import type { Encounter, EncounterRole, RegionDef } from '../data/region.ts';

/** Spawn a designed encounter at its authored seats, then tune each member. */
export function spawnEncounter(scene: RegionScene, enc: Encounter): void {
  const spawned: any[] = [];
  for (const seat of encounterPlan(enc)) {
    const e: any = spawnEnemy(scene, seat.key, seat.x, seat.y);
    if (!e) continue;
    applyRole(e, seat.role, enc);
    spawned.push(e);
  }
  regionState(scene).members.set(enc.id, spawned);
  setRegionFlag(enc.id);
  if (enc.intro) GameState.toast({ title: 'ENCOUNTER', msg: enc.intro, kind: 'discover', dur: 3200 });
}

/** Roles give a camp its texture; the tuning itself is data in RegionLayout. */
function applyRole(e: any, role: EncounterRole, enc: Encounter): void {
  try {
    const t = ROLE_TUNING[role];
    if (t) {
      if (t.aggroMult !== undefined) e.aggro = Math.max(t.aggroFloor ?? 0, (e.aggro || 300) * t.aggroMult);
      if (t.patrol) {
        e.patrolTarget = {
          x: e.sprite.x + Math.cos(Math.random() * Math.PI * 2) * 190,
          y: e.sprite.y + Math.sin(Math.random() * Math.PI * 2) * 190,
        };
      }
      if (t.chase) e.enterChase?.();
    }
    if (enc.ambush) e.enterChase?.();
  } catch { /* a missing role must never break a fight */ }
}

/** Guards converge on whoever started the fight, once per camp. */
export function tickAlarms(scene: RegionScene, region: RegionDef, px: number, py: number): void {
  const st = regionState(scene);
  for (const enc of region.encounters) {
    if (!enc.alarm || st.alarmed.has(enc.id)) continue;
    const list: any[] = st.members.get(enc.id) || [];
    const engaged: boolean = list.some((e: any) => !e.dead && e.sprite && Math.hypot(e.sprite.x - px, e.sprite.y - py) < 320);
    if (!engaged) continue;
    st.alarmed.add(enc.id);
    for (const e of list) if (!e.dead) e.enterChase?.();
    GameState.toast({ title: 'ALARM', msg: 'The camp answers the shout.', kind: 'discover', dur: 2800 });
  }
}

/** Live members across every spawned encounter (region snapshot). */
export function liveMemberCount(scene: RegionScene): number {
  return [...regionState(scene).members.values()].flat().filter((e: any) => !e.dead).length;
}
