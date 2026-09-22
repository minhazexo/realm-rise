// ─────────────────────────────────────────────────────────────────────────────
// WeaponSpecials — named legendary abilities, resolved from data.
//
// Pure logic module: the combat path calls `resolveSpecial` with the hit
// context and gets a result object describing side-effects (energy refund,
// chain targets, lifesteal). No Phaser imports → unit-testable (tests/weapons-elements.mjs).
//
// Registry (docs/improvements/09-ARPG-TRANSFORMATION-PLAN.md §weapons):
//   voidfang        — crits restore energy (stamina/mana pool)
//   chain_lightning — Stormpiercer: hit arcs to nearby enemies at 45% damage
//   gravekeeper     — lifesteal 12% of damage; +35% vs undead
//   dawnbreaker     — heavy attacks release a fire wave (AoE around impact)
//   (weapon defs without `special` simply never enter this path)
// ─────────────────────────────────────────────────────────────────────────────
import type { Element } from './ElementalSystem.ts';

/** Context of one landed melee hit, as the combat path sees it. */
export interface SpecialCtx {
  special: string | undefined;
  element: Element;
  baseDmg: number;
  isCrit: boolean;
  isFinisher: boolean;
  isHeavy: boolean;
  /** Defeated-defender lookups for chain/AoE resolution. */
  nearbyEnemies: Array<{ key: string; def?: { boss?: boolean } }>;
  defenderKey: string;
}

export interface SpecialResult {
  /** Fraction of damage restored to the attacker's health pool (0–1). */
  lifesteal: number;
  /** Energy (stamina) refunded on this hit. */
  energyRefund: number;
  /** Damage multiplier applied to THIS hit before resistances. */
  dmgMult: number;
  /** Indices into nearbyEnemies that chain damage should jump to. */
  chainTargets: number[];
  /** Chain damage fraction per target (0 = no chain). */
  chainMult: number;
  /** Fire-wave AoE trigger (Dawnbreaker heavy) — combat path spawns the ring. */
  fireWave: boolean;
  /** Floater text for the trigger, if any. */
  label: string | null;
}

const UNDEAD = /skeleton|wraith|revenant|lich|zombie|ghoul|undead/i;

function emptyResult(): SpecialResult {
  return { lifesteal: 0, energyRefund: 0, dmgMult: 1, chainTargets: [], chainMult: 0, fireWave: false, label: null };
}

/** Resolve one special against one landed hit. Never throws. */
export function resolveSpecial(ctx: SpecialCtx): SpecialResult {
  const r = emptyResult();
  try {
    switch (ctx.special) {
      case 'voidfang': {
        // Crits drink the enemy: refund a chunk of stamina per crit.
        if (ctx.isCrit) {
          r.energyRefund = 8;
          r.label = 'Void drain';
        }
        break;
      }
      case 'chain_lightning': {
        // Non-boss neighbors within chain range take 45% of the hit.
        r.chainMult = 0.45;
        for (let i = 0; i < ctx.nearbyEnemies.length && r.chainTargets.length < 3; i++) {
          const cand = ctx.nearbyEnemies[i];
          if (cand && !cand.def?.boss) r.chainTargets.push(i);
        }
        if (r.chainTargets.length) r.label = 'Chain lightning';
        break;
      }
      case 'gravekeeper': {
        // Consecrated: mends the wielder; the dead especially hate it.
        r.lifesteal = 0.12;
        if (UNDEAD.test(ctx.defenderKey)) {
          r.dmgMult = 1.35;
          r.label = 'Purified';
        }
        break;
      }
      case 'dawnbreaker': {
        // Heavies release a fire wave — combat path spawns the AoE ring.
        if (ctx.isHeavy) {
          r.fireWave = true;
          r.label = 'Dawn wave';
        }
        break;
      }
      default:
        break;
    }
  } catch { /* specials never crash the swing */ }
  return r;
}

/** True when the defender counts as undead (shared by specials & elements). */
export function isUndead(key: string | undefined | null): boolean {
  return !!key && UNDEAD.test(key);
}
