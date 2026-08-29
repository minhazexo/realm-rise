// Bandits & bosses.
import { ENEMY_TEAMS } from './enemyTeams.js';

export const BANDITS = {
  bandit_scout: {
    key: 'bandit_scout', name: 'Bandit Scout', sheetKey: 'hu_bandit', scale: 1, team: ENEMY_TEAMS.bandit,
    hp: 55, atk: 10, def: 2, speed: 148, detect: 330, attackRange: 34, attackCd: 1.0,
    windupSec: 0.32, radius: 13, xp: 24,
    style: 'kiter', preferredRange: 230,
    palette: { skin: '#caa27c', cloth: '#7c4a3a', mask: true },
    loot: [ { id: 'gold_nugget', chance: 0.35, min: 1, max: 1 }, { id: 'bread', chance: 0.4, min: 1, max: 2 }, { id: 'wooden_sword', chance: 0.12, min: 1, max: 1 } ],
    goldDrop: 14
  },
  bandit_archer: {
    key: 'bandit_archer', name: 'Bandit Archer', sheetKey: 'hu_archer', scale: 1, team: ENEMY_TEAMS.bandit,
    hp: 46, atk: 12, def: 1, speed: 138, detect: 420, attackRange: 360, attackCd: 1.7,
    windupSec: 0.6, radius: 12, xp: 26,
    style: 'kiter', preferredRange: 280, ranged: true, projectileSpeed: 480,
    palette: { skin: '#c69a72', cloth: '#5d6b46', hood: true },
    loot: [ { id: 'arrows', chance: 0.8, min: 4, max: 9 }, { id: 'gold_nugget', chance: 0.3, min: 1, max: 2 }, { id: 'short_bow', chance: 0.09, min: 1, max: 1 } ],
    goldDrop: 16
  },
  bandit_swordsman: {
    key: 'bandit_swordsman', name: 'Bandit Swordsman', sheetKey: 'hu_bandit2', scale: 1.04, team: ENEMY_TEAMS.bandit,
    hp: 84, atk: 15, def: 5, speed: 130, detect: 320, attackRange: 40, attackCd: 1.15,
    windupSec: 0.4, radius: 14, xp: 34,
    style: 'melee',
    palette: { skin: '#c69a72', cloth: '#4c5668', iron: true },
    loot: [ { id: 'iron_ingot', chance: 0.25, min: 1, max: 1 }, { id: 'cooked_meat', chance: 0.5, min: 1, max: 1 }, { id: 'iron_sword', chance: 0.1, min: 1, max: 1 } ],
    goldDrop: 26
  },
  bandit_brute: {
    key: 'bandit_brute', name: 'Bandit Brute', sheetKey: 'hu_brute', scale: 1.3, team: ENEMY_TEAMS.bandit,
    hp: 140, atk: 22, def: 7, speed: 112, detect: 300, attackRange: 50, attackCd: 1.75,
    windupSec: 0.62, radius: 20, xp: 55, aoeSlam: true, slamRadius: 86,
    style: 'brute',
    palette: { skin: '#b98a63', cloth: '#6b3a33' },
    loot: [ { id: 'raw_meat', chance: 0.8, min: 1, max: 3 }, { id: 'iron_shield', chance: 0.14, min: 1, max: 1 }, { id: 'healing_salve', chance: 0.2, min: 1, max: 1 } ],
    goldDrop: 45
  }
};

export const BOSSES = {
  bandit_captain: {
    key: 'bandit_captain', name: 'Captain Vex, Blade of the Roads', sheetKey: 'hu_captain', scale: 1.16, team: ENEMY_TEAMS.bandit,
    boss: true, arenaRadius: 480,
    hp: 260, atk: 20, def: 7, speed: 140, detect: 800, attackRange: 44, attackCd: 1.15,
    windupSec: 0.42, radius: 15, xp: 150,
    style: 'boss',
    phases: [
      { belowHp: 1, moves: ['combo_charge'] },
      { belowHp: 0.5, moves: ['summon_guards', 'combo_charge'], summon: { type: 'bandit_scout', count: 2 } }
    ],
    palette: { skin: '#c69a72', cloth: '#7a3434', plume: true },
    loot: [ { id: 'steel_ingot', chance: 0.6, min: 1, max: 2 }, { id: 'treasure_map', chance: 0.4, min: 1, max: 1 } ],
    goldDrop: 180
  },
  alpha_wolf: {
    key: 'alpha_wolf', name: 'Grendelfang, Alpha of the Deepwood', sheetKey: 'en_alphawolf', scale: 1.85, team: ENEMY_TEAMS.wild,
    boss: true, arenaRadius: 520,
    hp: 520, atk: 22, def: 6, speed: 170, detect: 900, attackRange: 52, attackCd: 1.3,
    windupSec: 0.42, radius: 30, xp: 320,
    style: 'boss',
    phases: [
      { belowHp: 1, moves: ['pounce', 'swipe'] },
      { belowHp: 0.55, moves: ['howl_summon'], summon: { type: 'wolf', count: 2 } },
      { belowHp: 0.25, moves: ['pounce', 'swipe', 'howl_summon'], enrageSpeed: 1.25, summon: { type: 'wolf', count: 3 } }
    ],
    palette: { fur: '#3f3a33', belly: '#6e685c', scars: true, eyes: '#ffb54d' },
    loot: [ { id: 'wolfsfang_ring', chance: 1, min: 1, max: 1 }, { id: 'fur_pelt', chance: 1, min: 3, max: 4 }, { id: 'raw_meat', chance: 1, min: 4, max: 6 }, { id: 'ancient_relic', chance: 0.5, min: 1, max: 1 } ],
    goldDrop: 180
  },
  bandit_king: {
    key: 'bandit_king', name: 'Rhogar the Bandit King', sheetKey: 'hu_banditking', scale: 1.4, team: ENEMY_TEAMS.bandit,
    boss: true, arenaRadius: 620,
    hp: 900, atk: 30, def: 10, speed: 138, detect: 900, attackRange: 58, attackCd: 1.25,
    windupSec: 0.45, radius: 24, xp: 520,
    style: 'boss',
    phases: [
      { belowHp: 1, moves: ['combo_charge', 'slam'] },
      { belowHp: 0.6, moves: ['summon_guards', 'slam'], summon: { type: 'bandit_swordsman', count: 2 } },
      { belowHp: 0.3, moves: ['combo_charge', 'summon_guards', 'throw_axe'], enrageSpeed: 1.3, summon: { type: 'bandit_archer', count: 2 } }
    ],
    palette: { skin: '#c68f61', cloth: '#6d2020', crown: true },
    loot: [ { id: 'steel_plate', chance: 0.6, min: 1, max: 1 }, { id: 'greatsword', chance: 0.45, min: 1, max: 1 }, { id: 'royal_artifact', chance: 1, min: 1, max: 1 }, { id: 'repair_kit', chance: 1, min: 1, max: 2 } ],
    goldDrop: 500
  },
  ancient_guardian: {
    key: 'ancient_guardian', name: 'The Ancient Guardian', sheetKey: 'en_guardian', scale: 2.1, team: ENEMY_TEAMS.monster,
    boss: true, arenaRadius: 700, ruinsBoss: true,
    hp: 1250, atk: 34, def: 14, speed: 92, detect: 700, attackRange: 74, attackCd: 1.9,
    windupSec: 0.7, radius: 36, xp: 800,
    style: 'boss',
    phases: [
      { belowHp: 1, moves: ['ground_slam'] },
      { belowHp: 0.66, moves: ['shockwave', 'beam_sweep'], beamDpsTick: 14 },
      { belowHp: 0.33, moves: ['ground_slam', 'shockwave', 'core_overload'], enrageSpeed: 1.15 }
    ],
    palette: { stone: '#5a6470', rune: '#5ad0c0' },
    loot: [ { id: 'ancient_core', chance: 1, min: 1, max: 1 }, { id: 'moonstone', chance: 0.7, min: 1, max: 2 }, { id: 'legendary_aegis', chance: 0.5, min: 1, max: 1 } ],
    goldDrop: 800
  }
};
