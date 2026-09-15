// ─────────────────────────────────────────────────────────────────────────────
// Progression (1/2): DERIVED STAT ENGINE. Every gameplay number the player
// influences flows through `recompute()` — the single balance seam (spec §7–9).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { CH } from '../core/EventBus.ts';
import { PLAYER_CONFIG } from '../core/Constants.ts';
import { SKILL_MAP } from '../data/skills.ts';
import { getItem } from '../data/items.ts';
import type { GameRootState, PlayerAlloc } from '../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

/** Aggregated skill effects: numeric bonuses, or `true` for unlock flags. */
export type SkillFx = Record<string, number | boolean>;

/** Five core attributes accumulated from allocation + item mods. */
interface CombatAlloc {
  strength: number;
  defense: number;
  agility: number;
  intellect: number;
  willpower: number;
}

const STAT_KEYS = ['strength', 'defense', 'agility', 'intellect', 'willpower'] as const;

/** All derived player statistics assembled by `recompute()`. */
export interface DerivedStats {
  strength: number; defense: number; agility: number;
  intellect: number; willpower: number;
  maxHp: number; maxStamina: number;
  moveSpeed: number; sprintMult: number; staminaCostMult: number; staminaRegen: number;
  damageReduction: number; armorValue: number; warmthCapable: number;
  meleeDmgMult: number; rangedDmgMult: number; attackCdMult: number;
  critMelee: number; critRanged: number;
  heavyUnlocked: boolean; heavyDmgMult: number; berserk: number;
  blockEfficiency: number; blockStaminaCost: number;
  dodgeSpeed: number; dodgeStamina: number;
  gatherYield: number; huntLoot: number; healPower: number;
  toolWearMult: number; craftSpeedMult: number; perfectRepair: boolean;
  drainResist: number; regenFoodFloor: number;
  xpGainMult: number; tradeBonus: number; taxBonus: number;
  armyCap: number; militaryPowerMult: number; productionMult: number;
  territoryOutput: number; recruitDiscount: number; diploDiscount: number;
  happinessFlat: number; stealth: number; bowRangeMult: number;
  ambushSense: boolean;
}

/** Aggregate skill fx across learned ranks. */
export function skillFx(): SkillFx {
  const acc: SkillFx = {};
  const sk: Record<string, unknown> = st()?.player?.skills || {};
  for (const [id, rank] of Object.entries(sk)) {
    if (!rank) continue;
    const def = SKILL_MAP[id];
    if (!def) continue;
    for (const [k, v] of Object.entries(def.fx)) {
      if (typeof v === 'number' && Number.isInteger(v) && v === 1 && /unlock|Repair|Sense/i.test(k)) acc[k] = true;
      else {
        const cur: number | boolean | undefined = acc[k];
        acc[k] = (typeof cur === 'number' ? cur : 0) + v * (rank as number);
      }
    }
  }
  return acc;
}

/** Recompute all derived player statistics into player.derived. */
export function recompute(): DerivedStats | null {
  const P = st().player;
  if (!P) return null;
  const a: PlayerAlloc = P.alloc;
  const fx: SkillFx = skillFx();
  // Numeric skill-fx read: unlock flags (`true`) never flow into arithmetic —
  // they are consumed through `!!` reads below. Only reachable values matter.
  const fxN = (k: string): number => {
    const v: number | boolean | undefined = fx[k];
    return typeof v === 'number' ? v : 0;
  };
  let armor = 0, warmth = 0, movePenalty = 0;
  const S: CombatAlloc = { strength: a.strength || 0, defense: a.defense || 0, agility: a.agility || 0,
              intellect: a.intellect || 0, willpower: a.willpower || 0 };
  let modCrit = 0, flatHp = 0, modTrade = 0, modXp = 0;

  for (const eq of Object.values(P.equipment)) {
    if (!eq) continue;
    const d = getItem(eq.id);
    if (!d) continue;
    armor += d.armor || 0;
    warmth += d.warmth || 0;
    movePenalty += d.movePenalty || 0;
    const mods: Record<string, number> = d.mods || {};
    for (const [k, v] of Object.entries(mods)) {
      if (k === 'critFlat') modCrit += v;
      else if (k === 'flatHp') flatHp += v;
      else if (k === 'tradeBonus') modTrade += v;
      else if (k === 'xpBonus') modXp += v;
      else if (k === 'allStats') { S.strength += v; S.defense += v; S.agility += v; S.intellect += v; S.willpower += v; }
      else if (k === 'luckFlat') modCrit += v * 0.6;
      else if ((STAT_KEYS as readonly string[]).includes(k)) S[k as keyof CombatAlloc] += v;
    }
  }

  const effArmor: number = Math.round(armor * (1 + fxN('armorBonus')));
  const damageReduction: number = Math.min(0.78, effArmor / (effArmor + 62));
  const berserkV: number = fxN('berserk');

  const D: DerivedStats = {
    strength: S.strength, defense: S.defense, agility: S.agility,
    intellect: S.intellect, willpower: S.willpower,

    maxHp: Math.round(PLAYER_CONFIG.baseMaxHp + S.defense * 7 + P.level * 3 + flatHp),
    maxStamina: Math.round(PLAYER_CONFIG.baseMaxStamina + S.agility * 1.5 + profLv('survival') * 4),

    moveSpeed: PLAYER_CONFIG.moveSpeed * (1 + S.agility * 0.012) * (1 - movePenalty),
    sprintMult: PLAYER_CONFIG.sprintMult * (1 + fxN('sprintEff') * 0.25),
    staminaCostMult: Math.max(0.5, 1 - fxN('drainResist') * 0.5),
    staminaRegen: PLAYER_CONFIG.staminaRegenPerSec * (1 + S.defense * 0.004),

    damageReduction,
    armorValue: effArmor,
    warmthCapable: warmth,

    meleeDmgMult: (1 + S.strength * 0.055) * (1 + fxN('meleeDmg')),
    rangedDmgMult: (1 + S.intellect * 0.045) * (1 + fxN('rangedDmg')),
    attackCdMult: Math.max(0.62, 1 / (1 + S.agility * 0.02)),
    critMelee: PLAYER_CONFIG.critBaseChance + S.agility * 0.005 + modCrit + fxN('critChance'),
    critRanged: PLAYER_CONFIG.critBaseChance + S.agility * 0.007 + modCrit + fxN('rangedCrit'),
    heavyUnlocked: !!fx['unlockHeavy'],
    heavyDmgMult: 1.65 * (1 + fxN('heavyDmg')),
    berserk: berserkV ? 1 + berserkV : 1,

    blockEfficiency: PLAYER_CONFIG.blockDamageReduction + (S.defense >= 6 ? 0.04 : 0),
    blockStaminaCost: PLAYER_CONFIG.blockStaminaPerHit * (1 - fxN('blockStaminaSave')),

    dodgeSpeed: PLAYER_CONFIG.dodgeSpeed + S.agility * 4,
    dodgeStamina: PLAYER_CONFIG.dodgeStamina,

    gatherYield: 1 + fxN('gatherYield') + profLv('woodcutting') * 0.02,
    huntLoot: 1 + fxN('huntLoot'),
    healPower: 1 + fxN('healPower'),
    toolWearMult: Math.max(0.2, 1 + fxN('toolWear')),
    craftSpeedMult: Math.max(0.4, 1 - fxN('craftSpeed')),
    perfectRepair: !!fx['perfectRepair'],

    drainResist: fxN('drainResist'),
    regenFoodFloor: PLAYER_CONFIG.regenWhenFedAbove * hungerPenaltyFactor(),

    xpGainMult: 1 + modXp + (P.personality === 'clever' ? 0.05 : 0) + S.intellect * 0.008,
    tradeBonus: modTrade + fxN('tradeBonus'),
    taxBonus: fxN('taxBonus'),
    armyCap: 4 + fxN('armyCap') + Math.floor(S.willpower * 0.6),
    militaryPowerMult: 1 + fxN('militaryPower'),
    productionMult: 1 + fxN('production'),
    territoryOutput: 1 + fxN('territoryOutput'),
    recruitDiscount: fxN('recruitDiscount'),
    diploDiscount: fxN('diploDiscount'),
    happinessFlat: fxN('happinessFlat'),
    stealth: Math.min(0.5, fxN('stealth')),
    bowRangeMult: 1 + fxN('bowRange'),
    ambushSense: !!fx['ambushSense']
  };

  // Survival pressure (spec §15): low needs gate performance gently, never hard-block.
  if (P.hunger < 12) D.moveSpeed *= 0.92;
  if (P.thirst < 10) D.maxStamina = Math.round(D.maxStamina * 0.85);

  P.derived = D;
  GameState.notify(CH.PLAYER);
  return D;

  function profLv(p: string): number { return P.professions?.[p]?.lv || 0; }
  function hungerPenaltyFactor(): number {
    const h: number = P.hunger;
    return h < 15 ? 0 : h < 35 ? 0.45 : 1;
  }
}

export * from './ProgressionXP.ts';
