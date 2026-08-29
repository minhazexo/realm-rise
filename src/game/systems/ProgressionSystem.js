// ─────────────────────────────────────────────────────────────────────────────
// Progression (1/2): DERIVED STAT ENGINE. Every gameplay number the player
// influences flows through `recompute()` — the single balance seam (spec §7–9).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { CH } from '../core/EventBus.js';
import { PLAYER_CONFIG } from '../core/Constants.js';
import { SKILL_MAP } from '../data/skills.js';
import { getItem } from '../data/items.js';

const st = () => GameState.s;

/** Aggregate skill fx across learned ranks. */
export function skillFx() {
  const acc = {};
  const sk = st()?.player?.skills || {};
  for (const [id, rank] of Object.entries(sk)) {
    if (!rank) continue;
    const def = SKILL_MAP[id];
    if (!def) continue;
    for (const [k, v] of Object.entries(def.fx)) {
      if (typeof v === 'number' && Number.isInteger(v) && v === 1 && /unlock|Repair|Sense/i.test(k)) acc[k] = true;
      else acc[k] = (acc[k] || 0) + v * rank;
    }
  }
  return acc;
}

/** Recompute all derived player statistics into player.derived. */
export function recompute() {
  const P = st().player;
  if (!P) return null;
  const a = P.alloc || {};
  const fx = skillFx();
  let armor = 0, warmth = 0, movePenalty = 0;
  const S = { strength: a.strength || 0, defense: a.defense || 0, agility: a.agility || 0,
              intellect: a.intellect || 0, willpower: a.willpower || 0 };
  let modCrit = 0, flatHp = 0, modTrade = 0, modXp = 0;

  for (const eq of Object.values(P.equipment)) {
    if (!eq) continue;
    const d = getItem(eq.id);
    if (!d) continue;
    armor += d.armor || 0;
    warmth += d.warmth || 0;
    movePenalty += d.movePenalty || 0;
    const mods = d.mods || {};
    for (const [k, v] of Object.entries(mods)) {
      if (k === 'critFlat') modCrit += v;
      else if (k === 'flatHp') flatHp += v;
      else if (k === 'tradeBonus') modTrade += v;
      else if (k === 'xpBonus') modXp += v;
      else if (k === 'allStats') { S.strength += v; S.defense += v; S.agility += v; S.intellect += v; S.willpower += v; }
      else if (k === 'luckFlat') modCrit += v * 0.6;
      else if (S[k] !== undefined) S[k] += v;
    }
  }

  const effArmor = Math.round(armor * (1 + (fx.armorBonus || 0)));
  const damageReduction = Math.min(0.78, effArmor / (effArmor + 62));

  const D = {
    strength: S.strength, defense: S.defense, agility: S.agility,
    intellect: S.intellect, willpower: S.willpower,

    maxHp: Math.round(PLAYER_CONFIG.baseMaxHp + S.defense * 7 + P.level * 3 + flatHp),
    maxStamina: Math.round(PLAYER_CONFIG.baseMaxStamina + S.agility * 1.5 + profLv('survival') * 4),

    moveSpeed: PLAYER_CONFIG.moveSpeed * (1 + S.agility * 0.012) * (1 - movePenalty),
    sprintMult: PLAYER_CONFIG.sprintMult * (1 + (fx.sprintEff || 0) * 0.25),
    staminaCostMult: Math.max(0.5, 1 - (fx.drainResist || 0) * 0.5),
    staminaRegen: PLAYER_CONFIG.staminaRegenPerSec * (1 + S.defense * 0.004),

    damageReduction,
    armorValue: effArmor,
    warmthCapable: warmth,

    meleeDmgMult: (1 + S.strength * 0.055) * (1 + (fx.meleeDmg || 0)),
    rangedDmgMult: (1 + S.intellect * 0.045) * (1 + (fx.rangedDmg || 0)),
    attackCdMult: Math.max(0.62, 1 / (1 + S.agility * 0.02)),
    critMelee: PLAYER_CONFIG.critBaseChance + S.agility * 0.005 + modCrit + (fx.critChance || 0),
    critRanged: PLAYER_CONFIG.critBaseChance + S.agility * 0.007 + modCrit + (fx.rangedCrit || 0),
    heavyUnlocked: !!fx.unlockHeavy,
    heavyDmgMult: 1.65 * (1 + (fx.heavyDmg || 0)),
    berserk: fx.berserk ? 1 + fx.berserk : 1,

    blockEfficiency: PLAYER_CONFIG.blockDamageReduction + (S.defense >= 6 ? 0.04 : 0),
    blockStaminaCost: PLAYER_CONFIG.blockStaminaPerHit * (1 - (fx.blockStaminaSave || 0)),

    dodgeSpeed: PLAYER_CONFIG.dodgeSpeed + S.agility * 4,
    dodgeStamina: PLAYER_CONFIG.dodgeStamina,

    gatherYield: 1 + (fx.gatherYield || 0) + profLv('woodcutting') * 0.02,
    huntLoot: 1 + (fx.huntLoot || 0),
    healPower: 1 + (fx.healPower || 0),
    toolWearMult: Math.max(0.2, 1 + (fx.toolWear || 0)),
    craftSpeedMult: Math.max(0.4, 1 - (fx.craftSpeed || 0)),
    perfectRepair: !!fx.perfectRepair,

    drainResist: fx.drainResist || 0,
    regenFoodFloor: PLAYER_CONFIG.regenWhenFedAbove * hungerPenaltyFactor(),

    xpGainMult: 1 + modXp + (P.personality === 'clever' ? 0.05 : 0) + S.intellect * 0.008,
    tradeBonus: modTrade + (fx.tradeBonus || 0),
    taxBonus: fx.taxBonus || 0,
    armyCap: 4 + (fx.armyCap || 0) + Math.floor(S.willpower * 0.6),
    militaryPowerMult: 1 + (fx.militaryPower || 0),
    productionMult: 1 + (fx.production || 0),
    territoryOutput: 1 + (fx.territoryOutput || 0),
    recruitDiscount: fx.recruitDiscount || 0,
    diploDiscount: fx.diploDiscount || 0,
    happinessFlat: fx.happinessFlat || 0,
    stealth: Math.min(0.5, fx.stealth || 0),
    bowRangeMult: 1 + (fx.bowRange || 0),
    ambushSense: !!fx.ambushSense
  };

  // Survival pressure (spec §15): low needs gate performance gently, never hard-block.
  if (P.hunger < 12) D.moveSpeed *= 0.92;
  if (P.thirst < 10) D.maxStamina = Math.round(D.maxStamina * 0.85);

  P.derived = D;
  GameState.notify(CH.PLAYER);
  return D;

  function profLv(p) { return P.professions?.[p]?.lv || 0; }
  function hungerPenaltyFactor() {
    const h = P.hunger;
    return h < 15 ? 0 : h < 35 ? 0.45 : 1;
  }
}

export * from './ProgressionXP.js';
