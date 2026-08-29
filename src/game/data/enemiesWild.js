// Wildlife & monster definitions. AI is data-driven: `style` selects a behaviour
// controller in Enemy.js. Loot = [{ id, chance, min, max }].
import { ENEMY_TEAMS } from './enemyTeams.js';

export const ENEMIES = {
  wolf: {
    key: 'wolf', name: 'Wolf', sheetKey: 'en_wolf', scale: 1, team: ENEMY_TEAMS.wild,
    hp: 42, atk: 8, def: 1, speed: 150, detect: 300, attackRange: 34, attackCd: 1.15,
    windupSec: 0.35, radius: 14, xp: 16,
    style: 'pounce', pounceRange: 190,
    palette: { fur: '#7a7060', belly: '#b3aa97' },
    loot: [ { id: 'raw_meat', chance: 0.9, min: 1, max: 2 }, { id: 'leather_hide', chance: 0.5, min: 1, max: 2 }, { id: 'bone', chance: 0.4, min: 1, max: 1 } ],
    goldDrop: 0
  },
  dire_wolf: {
    key: 'dire_wolf', name: 'Dire Wolf', sheetKey: 'en_direwolf', scale: 1.18, team: ENEMY_TEAMS.monster,
    hp: 88, atk: 14, def: 3, speed: 158, detect: 340, attackRange: 36, attackCd: 1.05,
    windupSec: 0.3, radius: 17, xp: 38,
    style: 'pounce', pounceRange: 210,
    palette: { fur: '#4d4455', belly: '#8d8494', eyes: '#ffdf6b' },
    loot: [ { id: 'raw_meat', chance: 1, min: 2, max: 3 }, { id: 'fur_pelt', chance: 0.65, min: 1, max: 2 } ],
    goldDrop: 0
  },
  boar: {
    key: 'boar', name: 'Wild Boar', sheetKey: 'en_boar', scale: 1.05, team: ENEMY_TEAMS.wild,
    hp: 60, atk: 11, def: 3, speed: 132, detect: 240, attackRange: 32, attackCd: 1.4,
    windupSec: 0.5, radius: 16, xp: 20,
    style: 'charger', chargeDist: 260, chargeSpeedMult: 2.1,
    palette: { fur: '#6e5138', belly: '#8f7252' },
    loot: [ { id: 'raw_meat', chance: 1, min: 2, max: 4 }, { id: 'leather_hide', chance: 0.55, min: 1, max: 2 } ],
    goldDrop: 0
  },
  bear: {
    key: 'bear', name: 'Cave Bear', sheetKey: 'en_bear', scale: 1.45, team: ENEMY_TEAMS.wild,
    hp: 160, atk: 20, def: 6, speed: 118, detect: 280, attackRange: 44, attackCd: 1.6,
    windupSec: 0.6, radius: 22, xp: 60,
    style: 'brute',
    palette: { fur: '#59452f', belly: '#7c6549' },
    loot: [ { id: 'raw_meat', chance: 1, min: 3, max: 5 }, { id: 'fur_pelt', chance: 0.85, min: 2, max: 3 }, { id: 'bear_charm_amulet', chance: 0.08, min: 1, max: 1 } ],
    goldDrop: 0
  },
  goblin: {
    key: 'goblin', name: 'Goblin Scavenger', sheetKey: 'en_goblin', scale: 0.85, team: ENEMY_TEAMS.monster,
    hp: 30, atk: 7, def: 1, speed: 142, detect: 260, attackRange: 30, attackCd: 0.95,
    windupSec: 0.28, radius: 12, xp: 18,
    style: 'melee', cowardly: true,
    palette: { skin: '#69a052', cloth: '#7a4e31' },
    loot: [ { id: 'flint', chance: 0.6, min: 1, max: 2 }, { id: 'gold_nugget', chance: 0.12, min: 1, max: 1 }, { id: 'mushrooms', chance: 0.4, min: 1, max: 2 } ],
    goldDrop: 6
  },
  skeleton: {
    key: 'skeleton', name: 'Restless Bones', sheetKey: 'en_skeleton', scale: 1, team: ENEMY_TEAMS.monster,
    hp: 48, atk: 12, def: 4, speed: 96, detect: 320, attackRange: 38, attackCd: 1.25,
    windupSec: 0.45, radius: 14, xp: 26, nightOnly: true,
    style: 'melee',
    palette: { bone: '#ded6bd', glow: '#7be0c3' },
    loot: [ { id: 'bone', chance: 1, min: 1, max: 3 }, { id: 'ancient_relic', chance: 0.07, min: 1, max: 1 } ],
    goldDrop: 4
  },
  swamp_beast: {
    key: 'swamp_beast', name: 'Bog Lurker', sheetKey: 'en_bogling', scale: 1.1, team: ENEMY_TEAMS.monster,
    hp: 76, atk: 15, def: 2, speed: 128, detect: 280, attackRange: 40, attackCd: 1.3,
    windupSec: 0.4, radius: 16, xp: 34,
    style: 'melee',
    palette: { skin: '#5d7a4a', cloth: '#3f4f33' },
    loot: [ { id: 'herbs', chance: 0.7, min: 1, max: 3 }, { id: 'crystal', chance: 0.1, min: 1, max: 1 }, { id: 'raw_fish', chance: 0.4, min: 1, max: 2 } ],
    goldDrop: 0
  }
};
