// Tools, weapons, shields, armor and trinkets.
import { def } from './itemDefs.js';

def('axe_stone', { cat: 'tool', tool: 'axe', tier: 1, durability: 90, damage: 4, gatherMult: 1.15, value: 16, icon: { shape: 'axe', c1: '#8f939c' }, desc: 'Flint-bitted axe. Better than fingernails.' });
def('axe_iron', { cat: 'tool', tool: 'axe', tier: 2, durability: 200, damage: 8, gatherMult: 1.45, rarity: 'uncommon', value: 46, icon: { shape: 'axe', c1: '#c8ccd4' }, desc: 'Iron felling axe. The forest yields.' });
def('axe_steel', { cat: 'tool', tool: 'axe', tier: 3, durability: 340, damage: 13, gatherMult: 1.8, rarity: 'rare', value: 110, icon: { shape: 'axe', c1: '#9fc3dd' }, desc: 'Masterwork steel axe.' });
def('pick_stone', { cat: 'tool', tool: 'pick', tier: 1, durability: 90, damage: 5, gatherMult: 1.15, value: 16, icon: { shape: 'pick', c1: '#8f939c' }, desc: 'Stubborn rock, meet stubborn pick.' });
def('pick_iron', { cat: 'tool', tool: 'pick', tier: 2, durability: 200, damage: 9, gatherMult: 1.45, rarity: 'uncommon', value: 46, icon: { shape: 'pick', c1: '#c8ccd4' }, desc: 'Cracks stone and ore alike.' });
def('pick_steel', { cat: 'tool', tool: 'pick', tier: 3, durability: 340, damage: 14, gatherMult: 1.8, rarity: 'rare', value: 110, icon: { shape: 'pick', c1: '#9fc3dd' }, desc: 'Sings through granite.' });
def('hammer', { cat: 'tool', tool: 'hammer', tier: 2, durability: 260, damage: 7, buildSpeedMult: 1.5, value: 38, icon: { shape: 'hammer', c1: '#b08d55' }, desc: 'Builds faster. Doubles as an argument-ender.' });
def('fishing_rod', { cat: 'tool', tool: 'rod', durability: 120, value: 26, icon: { shape: 'rod', c1: '#a67f52' }, desc: 'Fish near water for fresh food.' });

def('knife_hunter', { name: "Hunter's Knife", cat: 'weapon', weapon: { dmg: 9, crit: 0.1, cd: 0.36, range: 44, style: 'slash' }, durability: 150, value: 30, icon: { shape: 'sword', c1: '#c5cbd3' }, desc: 'Skinning knife that bites deep.' });
def('wooden_sword', { cat: 'weapon', weapon: { dmg: 6, crit: 0.03, cd: 0.42, range: 48, style: 'slash' }, durability: 70, value: 12, icon: { shape: 'sword', c1: '#9a7443' }, desc: 'It has ended more wolves than you would think.' });
def('iron_sword', { cat: 'weapon', weapon: { dmg: 15, crit: 0.06, cd: 0.42, range: 52, style: 'slash' }, rarity: 'uncommon', durability: 190, value: 68, icon: { shape: 'sword', c1: '#ccd1d8' }, desc: 'Honest iron. Honest work.' });
def('steel_sword', { cat: 'weapon', weapon: { dmg: 21, crit: 0.08, cd: 0.4, range: 52, style: 'slash' }, rarity: 'rare', durability: 300, value: 150, icon: { shape: 'sword', c1: '#a7c1dc' }, desc: 'Balanced steel from a master smith.' });
def('greatsword', { name: 'Steel Greatsword', cat: 'weapon', weapon: { dmg: 31, crit: 0.09, cd: 0.66, range: 64, style: 'crush', heavy: true }, rarity: 'epic', durability: 320, value: 260, icon: { shape: 'sword', c1: '#95aecb' }, desc: 'Slow, colossal, unavoidable.' });
def('battle_axe', { cat: 'weapon', weapon: { dmg: 19, crit: 0.05, cd: 0.48, range: 50, style: 'crush' }, rarity: 'uncommon', durability: 210, value: 82, icon: { shape: 'axe', c1: '#b5804e' }, desc: 'Chops men like it chops logs.' });
def('stone_spear', { cat: 'weapon', weapon: { dmg: 9, crit: 0.05, cd: 0.5, range: 74, style: 'pierce', reachBonusVsAnimals: true }, durability: 110, value: 20, icon: { shape: 'spear', c1: '#8f939c' }, desc: 'Keeps claws and teeth at distance.' });
def('iron_spear', { cat: 'weapon', weapon: { dmg: 16, crit: 0.06, cd: 0.48, range: 78, style: 'pierce', reachBonusVsAnimals: true }, rarity: 'uncommon', durability: 220, value: 76, icon: { shape: 'spear', c1: '#c8ccd4' }, desc: 'A wall of pointy iron.' });
def('short_bow', { cat: 'weapon', weapon: { dmg: 10, crit: 0.09, cd: 0.55, range: 430, style: 'bow', ammo: 'arrows', projectileSpeed: 520 }, durability: 140, value: 44, icon: { shape: 'bow', c1: '#a67f52' }, desc: 'Quick hunting bow.' });
def('longbow', { cat: 'weapon', weapon: { dmg: 15, crit: 0.12, cd: 0.6, range: 560, style: 'bow', ammo: 'arrows', projectileSpeed: 640 }, rarity: 'uncommon', durability: 180, value: 120, icon: { shape: 'bow', c1: '#8a6540' }, desc: 'Whispers death across clearings.' });
def('crossbow', { cat: 'weapon', weapon: { dmg: 26, crit: 0.1, cd: 0.95, range: 500, style: 'bow', ammo: 'arrows', projectileSpeed: 700, pierce: 1 }, rarity: 'rare', durability: 220, value: 210, icon: { shape: 'xbow', c1: '#93a08f' }, desc: 'Punches through shields.' });
def('nightfall_bow', { name: 'Nightfall', cat: 'weapon', weapon: { dmg: 28, crit: 0.25, cd: 0.5, range: 640, style: 'bow', ammo: 'arrows', projectileSpeed: 720 }, rarity: 'mythic', durability: 999, value: 900, icon: { shape: 'bow', c1: '#6d5ae0' }, desc: 'Carved from moonwood under a lunar eclipse.' });
def('dawnbreaker', { name: 'Dawnbreaker', cat: 'weapon', weapon: { dmg: 36, crit: 0.18, cd: 0.4, range: 56, style: 'slash' }, rarity: 'mythic', durability: 999, value: 1000, icon: { shape: 'sword', c1: '#ffd66b' }, desc: 'Legendary blade reforged from an Ancient Core.' });

def('wooden_shield', { cat: 'offhand', shieldBlock: 0.42, durability: 120, value: 20, icon: { shape: 'shield', c1: '#937249' }, desc: 'Stops teeth, claws and carelessness.' });
def('iron_shield', { cat: 'offhand', shieldBlock: 0.6, durability: 250, rarity: 'uncommon', value: 72, icon: { shape: 'shield', c1: '#c8ccd4' }, desc: 'A steel wall for your forearm.' });
def('tower_shield', { cat: 'offhand', shieldBlock: 0.74, movePenalty: 0.06, durability: 320, rarity: 'rare', value: 170, icon: { shape: 'shield', c1: '#8ca0b8' }, desc: 'Heavy as sin. Immovable as a fortress.' });

