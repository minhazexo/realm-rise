// Resources, food and consumable item definitions.
import { def } from './itemDefs.js';

def('wood', { name: 'Wood', icon: { shape: 'log', c1: '#8a5a33' }, desc: 'Sturdy timber. The backbone of any settlement.' });
def('hardwood', { name: 'Hardwood', rarity: 'uncommon', value: 5, icon: { shape: 'log', c1: '#5d3d20' }, desc: 'Dense ancient wood for fine craft.' });
def('fiber', { name: 'Plant Fiber', value: 1, icon: { shape: 'fiber', c1: '#9fb35c' }, desc: 'Twisted grass. Binds tools and rope.' });
def('stone', { name: 'Stone', icon: { shape: 'ore', c1: '#9aa0a8' }, desc: 'A realm is built on stone.' });
def('flint', { name: 'Flint', value: 3, rarity: 'common', icon: { shape: 'shard', c1: '#55575e' }, desc: 'Sparks fire. Fragile edges.' });
def('clay', { name: 'Clay', icon: { shape: 'blob', c1: '#b07350' }, desc: 'Malleable earth for bricks and pots.' });
def('coal', { name: 'Coal', value: 4, icon: { shape: 'lump', c1: '#33343a' }, desc: 'Fuel for the forge.' });
def('iron_ore', { name: 'Iron Ore', value: 6, rarity: 'uncommon', icon: { shape: 'ore', c1: '#b0654f' }, desc: 'Raw iron waiting for the furnace.' });
def('iron_ingot', { name: 'Iron Ingot', value: 15, rarity: 'uncommon', icon: { shape: 'ingot', c1: '#cfd3da' }, desc: 'Smelted iron, ready to be forged.' });
def('steel_ingot', { name: 'Steel Ingot', value: 34, rarity: 'rare', icon: { shape: 'ingot', c1: '#9db4cf' }, desc: 'Folded steel of superior quality.' });
def('leather_hide', { name: 'Animal Hide', value: 6, icon: { shape: 'hide', c1: '#9a6b40' }, desc: 'Can be tanned into leather at the tannery.' });
def('fur_pelt', { name: 'Thick Fur', value: 11, rarity: 'uncommon', icon: { shape: 'hide', c1: '#6e5641' }, desc: 'Warm pelt against the freezing north.' });
def('bone', { name: 'Bone', value: 1, icon: { shape: 'bone', c1: '#ded8c2' }, desc: 'Old bones make old tools.' });
def('feathers', { name: 'Feathers', value: 1, icon: { shape: 'feather', c1: '#e5e0d2' }, desc: 'Flight for your arrows.' });
def('herbs', { name: 'Herbs', value: 3, icon: { shape: 'herb', c1: '#5fa05c' }, desc: 'Medicinal greens. Tastes awful. Works wonders.' });
def('mushrooms', { cat: 'consumable', use: { food: 8, hp: 4 }, value: 3, icon: { shape: 'mushroom', c1: '#c47b57' }, desc: 'Forest food with mild restorative properties. Mostly safe.' });
def('berries', { cat: 'consumable', use: { food: 10, hp: 3 }, value: 2, icon: { shape: 'berries', c1: '#a04258' }, desc: 'Sweet enough to keep you walking. A little healing too.' });
def('wheat', { name: 'Wheat', value: 4, icon: { shape: 'grain', c1: '#d8b74a' }, desc: 'Golden grain from the farm plots.' });

// ── Food & consumables ───────────────────────────────────────────────────────
def('raw_meat', { cat: 'consumable', use: { food: 14, hp: 2 }, value: 4, icon: { shape: 'meat', c1: '#b45454' }, desc: 'Better cooked. Much better. Sustains in a pinch.' });
def('cooked_meat', { cat: 'consumable', use: { food: 38, hp: 12 }, value: 9, icon: { shape: 'meat', c1: '#8a512e' }, desc: 'Hearty roast that restores health and morale.' });
def('raw_fish', { name: 'Fresh Fish', value: 5, icon: { shape: 'fish', c1: '#7fa3b8' }, desc: 'Caught in the rivers of the realm.' });
def('cooked_fish', { cat: 'consumable', use: { food: 28, hp: 12 }, value: 10, rarity: 'uncommon', icon: { shape: 'fish', c1: '#b8865a' }, desc: 'River-grilled fish with crispy skin.' });
def('bread', { cat: 'consumable', use: { food: 44, hp: 6 }, value: 12, icon: { shape: 'bread', c1: '#c79b57' }, desc: 'Baked warm at the kitchen hearth. Restores a little health.' });
def('hearty_stew', { cat: 'consumable', use: { food: 65, hp: 24 }, rarity: 'uncommon', value: 22, icon: { shape: 'stew', c1: '#a86a32' }, desc: 'The smell alone lifts morale. Deeply restorative.' });
def('honeycomb', { name: 'Honeycomb', cat: 'consumable', use: { food: 16, thirst: 10 }, value: 7, rarity: 'uncommon', icon: { shape: 'comb', c1: '#d8a53c' }, desc: 'Golden sweetness raided from bees.' });
def('bandage', { cat: 'consumable', use: { hp: 30 }, value: 14, icon: { shape: 'roll', c1: '#ddd6c4' }, desc: 'Herb-dressed cloth. Stops the bleeding.' });
def('healing_salve', { cat: 'consumable', use: { hp: 70 }, value: 30, rarity: 'rare', icon: { shape: 'flask', c1: '#d05a5a' }, desc: 'Concentrated herbal medicine.' });
def('waterskin', { cat: 'consumable', use: { thirst: 55 }, value: 6, icon: { shape: 'skin', c1: '#92714e' }, desc: 'Skins filled with fresh water.' });
def('herb_tea', { cat: 'consumable', use: { thirst: 35, hp: 14, warmBuff: 60 }, value: 9, icon: { shape: 'flask', c1: '#7fa860' }, desc: 'Steaming herbal tea — warms the body and mends wounds.' });
def('stamina_tonic', { cat: 'consumable', use: { staminaFull: true, sprintBuff: 12 }, rarity: 'uncommon', value: 24, icon: { shape: 'flask', c1: '#63b6d8' }, desc: 'Sharp, bitter, effective.' });
def('whetstone', { cat: 'consumable', use: { repairEquipped: 0.5 }, value: 18, icon: { shape: 'stoneblade', c1: '#888fa0' }, desc: 'Restores half durability of your weapon.' });
def('repair_kit', { cat: 'consumable', use: { repairAll: 0.45 }, rarity: 'uncommon', value: 40, icon: { shape: 'kit', c1: '#a38049' }, desc: 'Mends every worn piece you carry.' });

def('arrows', { name: 'Arrows', stack: 400, value: 1, icon: { shape: 'arrow', c1: '#caa96b' }, desc: 'Ammunition for bows and crossbows.' });
def('torch', { cat: 'tool', tool: 'light', durability: 240, stack: 20, value: 5, icon: { shape: 'torch', c1: '#e8983f' }, desc: 'Lights the dark — and nights here are dark.' });

