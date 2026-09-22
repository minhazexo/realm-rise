// Elite variants — rare, named versions of common enemies (vertical slice §7).
//
// Data-driven like every other enemy: an elite is a full EnemyDef that
// inherits its base's sheetKey but bakes in multiplied stats, a behavior
// change (style/pounce/charge/aoe), a distinct palette, better loot and a
// nameplate. SpawnDirector occasionally promotes a rolled common enemy to
// its elite via ELITE_FOR_BASE (night/danger-gated); Enemy renders the
// aura + nameplate from `elite: true`. Kill quests track elite keys
// directly — BridgeSystem already emits their kill events.
import { ENEMY_TEAMS } from './enemyTeams.ts';
import type { EnemyDef } from './enemiesWild.ts';

export const ELITES: Record<string, EnemyDef> = {
  bloodfang_alpha: {
    key: 'bloodfang_alpha', name: 'Bloodfang Alpha', sheetKey: 'en_wolf', scale: 1.45, team: ENEMY_TEAMS.wild,
    elite: true, baseOf: 'wolf',
    hp: 240, atk: 20, def: 4, speed: 162, detect: 480, attackRange: 38, attackCd: 1.05,
    windupSec: 0.32, radius: 19, xp: 150,
    // Charger dash instead of the wolf's pounce — a different dodge puzzle.
    style: 'charger', chargeDist: 320, chargeSpeedMult: 2.4,
    palette: { fur: '#5a1c22', belly: '#8a3a3a', eyes: '#ff4d4d', scars: true },
    loot: [
      { id: 'bloodfang_fang', chance: 1, min: 1, max: 1 },
      { id: 'fur_pelt', chance: 1, min: 2, max: 4 },
      { id: 'steel_ingot', chance: 0.35, min: 1, max: 1 }
    ],
    goldDrop: 85
  },
  grave_knight: {
    key: 'grave_knight', name: 'Grave Knight', sheetKey: 'en_skeleton', scale: 1.2, team: ENEMY_TEAMS.monster,
    elite: true, baseOf: 'skeleton',
    // Not nightOnly: an elite that banishes at dawn would strand its
    // nameplate/aura and read as a bug — elites may patrol by day.
    hp: 260, atk: 22, def: 12, speed: 104, detect: 400, attackRange: 42, attackCd: 1.35,
    windupSec: 0.5, radius: 16, xp: 170,
    // Brute slam instead of the skeleton's poke — telegraphed AoE ring.
    style: 'brute', aoeSlam: true, slamRadius: 80,
    weak: ['fire', 'holy'], resist: ['ice', 'shadow'],
    palette: { bone: '#3b3f4a', glow: '#6d5ae0' },
    loot: [
      { id: 'bone', chance: 1, min: 2, max: 4 },
      { id: 'ancient_relic', chance: 0.55, min: 1, max: 1 },
      { id: 'steel_ingot', chance: 0.45, min: 1, max: 2 }
    ],
    goldDrop: 65
  },
  executioner: {
    key: 'executioner', name: 'The Executioner', sheetKey: 'hu_brute', scale: 1.42, team: ENEMY_TEAMS.bandit,
    elite: true, baseOf: 'bandit_swordsman',
    hp: 340, atk: 26, def: 9, speed: 118, detect: 400, attackRange: 50, attackCd: 1.6,
    windupSec: 0.62, radius: 20, xp: 200,
    // Wider, slower slam than the bandit brute — dodge window is generous
    // but the payoff hurts.
    style: 'brute', aoeSlam: true, slamRadius: 96,
    palette: { skin: '#b98a63', cloth: '#2c2c34', hood: true },
    loot: [
      { id: 'steel_ingot', chance: 1, min: 1, max: 2 },
      { id: 'repair_kit', chance: 0.6, min: 1, max: 1 },
      { id: 'healing_salve', chance: 0.7, min: 1, max: 2 }
    ],
    goldDrop: 150
  },
  void_stalker: {
    key: 'void_stalker', name: 'Void Stalker', sheetKey: 'en_bogling', scale: 1.35, team: ENEMY_TEAMS.monster,
    elite: true, baseOf: 'swamp_beast',
    hp: 240, atk: 20, def: 6, speed: 140, detect: 480, attackRange: 380, attackCd: 1.5,
    windupSec: 0.55, radius: 16, xp: 180,
    // Corrupted lurker: keeps its distance and spits void bolts (the
    // 'magic' projectile kind renders as a glowing dark bolt).
    style: 'kiter', ranged: true, projectileSpeed: 500, projectileKind: 'magic', preferredRange: 240,
    weak: ['holy'], resist: ['poison', 'shadow'],
    palette: { skin: '#241a33', cloth: '#3a2a4a', glow: '#9d4dff' },
    loot: [
      { id: 'void_ember', chance: 1, min: 1, max: 1 },
      { id: 'crystal', chance: 0.6, min: 1, max: 1 },
      { id: 'herbs', chance: 0.8, min: 2, max: 4 }
    ],
    goldDrop: 110
  }
};

/** base common-enemy key → elite variant key (SpawnDirector promotion). */
export const ELITE_FOR_BASE: Record<string, string> = Object.fromEntries(
  Object.values(ELITES).map((d) => [d.baseOf as string, d.key])
);
