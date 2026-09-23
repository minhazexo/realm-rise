// ─────────────────────────────────────────────────────────────────────────────
// NpcSystem — every NPC the world hosts: spawning the wild camp_friend and
// rescue POIs, the dialogue the player opens, the recruit/trade actions, and
// the wander AI that keeps them around their home.
//
// Extracted from WorldScene (Phase 4) so the scene stays a coordinator — the
// same scene-context pattern as LootSystem / GatherSystem / BuildSystem.
//
// The quest gate is NOT re-implemented here. "May this quest be offered?" has
// one owner, QuestSystem.canOfferSideQuest, which both the Accept button (via
// offerableQuest below) and the action itself call — so the affordance and the
// action can never disagree.
//
// Scene contract: scene.npcs, scene.spawnNpc(), scene.interactNpc()
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { CH } from '../core/EventBus.ts';
import { allPois } from './PoiRegistry.ts';
import { getNpcDef, npcLines } from '../data/npcs.ts';
import { getBuildingDef } from '../data/buildings.ts';
import { createNpc, type NpcRecord } from './EntityFactory.ts';
import { recruitCitizen, refresh as kingdomRefresh } from './KingdomSystem.ts';
import { canOfferSideQuest } from './QuestSystem.ts';
import { addReputation } from './ProgressionSystem.ts';

/** Minimal scene surface consumed by the NPC lifecycle. */
export type NpcScene = Phaser.Scene & {
  npcs: NpcRecord[];
  spawnNpc(key: string, x: number, y: number): unknown;
  interactNpc(npc: NpcRecord): void;
};

/** NPC definition, as authored in data/npcs.ts. */
const defOf = (npc: NpcRecord): any => npc.def as any;

/**
 * Shadow depth kept exactly as the pre-extraction code had it: `npc.depth` is
 * only ever defined by callers that set it, so this is normally NaN and the
 * shadow simply stays where the display list put it. Preserved verbatim —
 * sorting shadows by y instead would move every NPC's shadow on screen.
 */
const shadowDepth = (npc: NpcRecord): number => (npc as any).depth - 1;

const DEFAULT_WALK_SPEED = 28;

/**
 * The camp_friend / rescue POIs each hold an NPC, unless that soul already
 * joined the player's realm (a recruit must not be waiting at the cage twice).
 */
export function spawnWildNpcs(scene: NpcScene): void {
  const forged: string[] = GameState.s.settlement.citizens.map((c: any) => c.name);
  for (const poi of allPois() as any[]) {
    if (poi.kind === 'camp_friend' || poi.kind === 'rescue') {
      const npcDef = getNpcDef(poi.npc);
      if (npcDef && forged.includes(npcDef.name)) continue;
      scene.spawnNpc(poi.npc, poi.x + 8, poi.y + 14);
    }
  }
}

export function spawnNpc(scene: NpcScene, key: string, x: number, y: number): any {
  return createNpc(scene, key, x, y, (npc: any) => scene.interactNpc(npc));
}

/**
 * Open this NPC's dialogue. Requirements that are not met refuse with a toast
 * naming what is missing instead of opening an empty modal.
 */
export function interactNpc(scene: NpcScene, npc: NpcRecord): void {
  const S = GameState.s;
  const def = defOf(npc);
  if (def.req && !npcRequirementsMet(def)) {
    (GameState as any).toast({ title: def.name, msg: reqText(def.req), kind: 'dialogue' });
    return;
  }
  import('./QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'talk', npc: npc.key }));
  // What they say now, not what they said before their area changed
  // (brief §14: the mystery unfolds from the voices, not one dump).
  const lines = npcLines(def, S.story.flags);
  (GameState.session as any).dialogue = {
    npc: npc.key, name: def.name, portrait: def.portrait, lines, actions: npcActions(npc)
  };
  const offer = offerableQuest(def);
  if (offer) {
    (GameState.session as any).dialogue.actions.push({ label: 'Accept quest', fn: 'offerSideQuest', arg: offer });
  }
  GameState.notify(CH.DIALOGUE);
}

/**
 * The next link of this NPC's chain the player may accept, or null. An NPC
 * with several offers (Mara's five fragments) walks them in order, so exactly
 * one Accept button shows at a time and only when its gates are met.
 */
export function offerableQuest(def: any): string | null {
  const keys: string[] = def.questGivers || (def.questGiver ? [def.questGiver] : []);
  for (const qid of keys) {
    if (canOfferSideQuest(qid)) return qid;
  }
  return null;
}

export function npcRequirementsMet(def: any): boolean {
  const R = GameState.s;
  const req = def.req || {};
  if (req.rep && R.player.reputation < req.rep) return false;
  if (req.gold && R.player.gold < req.gold) return false;
  if (req.stage && (R.settlement.stageIndex || 0) < req.stage) return false;
  if (req.buildingNearby && !R.settlement.buildings.some((b: any) => b.key === req.buildingNearby && b.complete)) return false;
  if (req.questFlag && !R.story.flags[req.questFlag]) return false;
  return true;
}

export function reqText(req: any): string {
  const needs: string[] = [];
  if (req.rep) needs.push(`${req.rep} reputation`);
  if (req.gold) needs.push(`${req.gold} gold`);
  if (req.stage) needs.push(`${(['Camp', 'Camp', 'Village', 'Town', 'City', 'Kingdom', 'Empire'] as string[])[req.stage as number]} rank`);
  if (req.buildingNearby) needs.push(`${getBuildingDef(req.buildingNearby)?.label || req.buildingNearby} built`);
  return 'Requires ' + needs.join(' · ');
}

export function npcActions(npc: NpcRecord): any[] {
  const def = defOf(npc);
  const out: any[] = [];
  if (def.joinAs || def.cost) {
    out.push({ label: def.cost ? `Recruit (${def.cost.gold} gold)` : 'Invite to your realm', fn: 'recruitNpc', arg: npc.key });
  }
  if (def.merchant) out.push({ label: 'Trade', fn: 'openTrade', arg: npc.key });
  return out;
}

/** Wander AI. Distant NPCs skip it entirely (enemies cull at 1250/1800 px). */
export function updateNpcs(scene: NpcScene, dt: number, px: number, py: number): void {
  for (const npc of scene.npcs) {
    const s = npc.sprite;
    const wanderSpeed: number = (npc as any).walkSpeed || 0;
    // Depth/shadow still update while culled so nothing pops when they return.
    if (px != null && py != null) {
      const ndx: number = s.x - px, ndy: number = s.y - py;
      if (ndx * ndx + ndy * ndy > 1600 * 1600) {
        s.setDepth(Math.round(s.y));
        npc.shadow.setPosition(s.x, s.y + 3).setDepth(shadowDepth(npc));
        continue;
      }
    }
    // Skip AI if NPC is being talked to
    if ((GameState.session as any).dialogue?.npc === npc.key) {
      s.setDepth(Math.round(s.y));
      npc.shadow.setPosition(s.x, s.y + 3).setDepth(shadowDepth(npc));
      continue;
    }

    npc.aiTimer -= dt;

    switch (npc.aiState) {
      case 'idle': {
        // Stand still, countdown to next wander
        if (npc.aiTimer <= 0) {
          // Pick a random walkable target within wander radius of home
          const angle: number = Math.random() * Math.PI * 2;
          const dist: number = 20 + Math.random() * (npc.wanderRadius - 20);
          npc.aiTargetX = npc.homeX + Math.cos(angle) * dist;
          npc.aiTargetY = npc.homeY + Math.sin(angle) * dist;
          const dx: number = npc.aiTargetX - s.x;
          const dy: number = npc.aiTargetY - s.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            npc.aiDir = dx < 0 ? 'left' : 'right';
          } else {
            npc.aiDir = dy < 0 ? 'up' : 'down';
          }
          npc.aiState = 'walking';
          npc.aiWalkFrame = 0;
          npc.aiWalkAccum = 0;
        }
        break;
      }
      case 'walking': {
        const dx: number = npc.aiTargetX - s.x;
        const dy: number = npc.aiTargetY - s.y;
        const dist: number = Math.hypot(dx, dy);
        if (dist < 3 || npc.aiTimer <= 0) {
          // Arrived or timed out — stop and pause
          npc.aiState = 'pausing';
          npc.aiTimer = 2 + Math.random() * 5;  // pause 2–7 seconds
          npc.aiDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
          s.setFrame(`${npc.aiDir}_1`);
        } else {
          // Village wander is 28 px/s; a traveling pedlar says otherwise.
          const speed = wanderSpeed || DEFAULT_WALK_SPEED;
          const step: number = Math.min(speed * dt, dist);
          s.x += (dx / dist) * step;
          s.y += (dy / dist) * step;
          // Walk animation cycle: frames 0→1→2→1 at ~6fps
          npc.aiWalkAccum += dt;
          if (npc.aiWalkAccum > 0.16) {
            npc.aiWalkAccum -= 0.16;
            npc.aiWalkFrame = (npc.aiWalkFrame + 1) % 4; // 0,1,2,1
          }
          const phase: number = npc.aiWalkFrame === 3 ? 1 : npc.aiWalkFrame;
          s.setFrame(`${npc.aiDir}_${phase}`);
        }
        break;
      }
      case 'pausing': {
        // Stand still, then go idle
        if (npc.aiTimer <= 0) {
          npc.aiState = 'idle';
          npc.aiTimer = 1 + Math.random() * 3;  // 1–4 sec before next wander
          s.setFrame(`${npc.aiDir}_1`);
        }
        break;
      }
    }

    s.setDepth(Math.round(s.y));
    npc.shadow.setPosition(s.x, s.y + 3).setDepth(shadowDepth(npc));
  }
}

/** Pay an NPC's price and move them into the player's realm as a citizen. */
export function recruitNpcFrom(scene: NpcScene, key: string): void {
  const npcDef = getNpcDef(key);
  if (!npcDef) return;
  const cost = npcDef.cost || {};
  if (cost.gold && GameState.s.player.gold < cost.gold) {
    (GameState as any).toast({ title: npcDef.name, msg: 'Not enough gold.', kind: 'warn' });
    return;
  }
  if (cost.gold) GameState.s.player.gold -= cost.gold;
  recruitCitizen({ name: npcDef.name, role: npcDef.joinAs || 'worker', skillLv: npcDef.skillRate ? Math.round(npcDef.skillRate) : 1 });
  addReputation(8);
  (GameState as any).toast({ title: `${npcDef.name} joins you!`, msg: npcDef.dialogue?.[0] || 'Welcome aboard.', kind: 'quest', dur: 4200 });
  const npc = scene.npcs.find((n) => n.key === key);
  if (npc) { scene.npcs = scene.npcs.filter((n) => n !== npc); npc.sprite.destroy(); npc.shadow.destroy(); }
  GameState.closeDialogue();
  GameState.notify(CH.SETTLEMENT, CH.PLAYER);
  kingdomRefresh();
}

/** Open the trade panel on this merchant (TradePanel reads session.tradeNpc). */
export function openTradeFor(key: string): void {
  (GameState.session as any).tradeNpc = { key };
  (GameState.session as any).uiPanel = 'trade';
  GameState.notify(CH.SCREEN);
}
