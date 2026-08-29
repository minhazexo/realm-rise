// Armor pieces (chest drives visible outfit tier), trinkets and rare materials.
import { def } from './itemDefs.js';

const armorDef = (id, name, slot, armor, tier, warmth, opts = {}) =>
  def(id, {
    cat: 'armor',
    slot,
    armor,
    outfitTier: tier,
    warmth,
    rarity: opts.rarity || 'common',
    value: opts.value,
    mods: opts.mods,
    icon: { shape: { helmet: 'helm', chest: 'chest', gloves: 'gloves', boots: 'boots' }[slot], c1: opts.c1 || '#b08d55' },
    desc: opts.desc || ''
  });

armorDef('traveler_garb', 'Traveler Garb', 'chest', 2, 0, 1, { c1: '#7c6c52', value: 5, desc: 'Road-worn cloth. It has seen better decades.' });
armorDef('leather_vest', 'Leather Vest', 'chest', 5, 1, 2, { c1: '#93683e', value: 34, desc: 'Boiled leather. Wolves disapprove.' });
armorDef('hunter_leather', "Hunter's Leathers", 'chest', 8, 1, 2, { rarity: 'uncommon', c1: '#7d5936', value: 60, mods: { agility: 1 }, desc: 'Quiet, flexible, bloodstained.' });
armorDef('fur_coat', 'Fur Coat', 'chest', 7, 2, 6, { rarity: 'uncommon', c1: '#7c5b41', value: 88, desc: 'Winter laughs at this coat.' });
armorDef('iron_plate', 'Iron Cuirass', 'chest', 14, 3, 3, { rarity: 'uncommon', c1: '#aeb4bd', value: 130, desc: 'Clumsy but dependable plate.' });
armorDef('steel_plate', 'Steel Plate Armor', 'chest', 21, 4, 4, { rarity: 'rare', c1: '#a3bedb', value: 280, desc: 'The gleam of a real soldier.' });
armorDef('royal_armor', 'Royal Warplate', 'chest', 27, 5, 4, { rarity: 'epic', c1: '#c9a24b', value: 480, mods: { willpower: 2 }, desc: 'Gilded warplate for a ruler who leads from the front.' });
armorDef('legendary_aegis', 'Aegis of the Realm', 'chest', 34, 6, 5, { rarity: 'mythic', c1: '#e8d48a', value: 850, mods: { strength: 2, defense: 2, agility: 1 }, desc: 'Woven by the Ancient Order from star-metal.' });
armorDef('cap_cloth', 'Padded Cap', 'helmet', 2, 0, 1, { c1: '#87705a', value: 6 });
armorDef('helm_leather', 'Leather Helm', 'helmet', 4, 1, 1, { c1: '#8a6540', value: 24 });
armorDef('helm_iron', 'Iron Helm', 'helmet', 8, 3, 2, { rarity: 'uncommon', c1: '#aeb4bd', value: 70 });
armorDef('helm_steel', 'Steel Crown-Guard', 'helmet', 12, 4, 2, { rarity: 'rare', c1: '#a3bedb', value: 150 });
armorDef('crown_realm', 'Crown of the Realm', 'helmet', 10, 5, 3, { rarity: 'mythic', c1: '#e8c94b', value: 600, mods: { willpower: 3 }, desc: 'Weightier than any helm: responsibility.' });
armorDef('gloves_leather', 'Leather Gloves', 'gloves', 2, 1, 1, { c1: '#8a6540', value: 16, desc: '+ gathering speed.' });
armorDef('gloves_iron', 'Iron Gauntlets', 'gloves', 6, 3, 2, { rarity: 'uncommon', c1: '#aeb4bd', value: 64, mods: { strength: 1 } });
armorDef('boots_worn', 'Worn Boots', 'boots', 1, 0, 1, { c1: '#7c6c52', value: 8 });
armorDef('boots_ranger', "Ranger's Boots", 'boots', 3, 1, 1, { c1: '#6d5636', value: 42, mods: { agility: 1 }, desc: 'Silent on moss, sure on scree.' });
armorDef('boots_steel', 'Steel Greaves', 'boots', 7, 4, 2, { rarity: 'rare', c1: '#a3bedb', value: 140 });

def('wolfsfang_ring', { name: 'Wolfsfang Ring', cat: 'trinket', slot: 'ring', rarity: 'uncommon', value: 90, mods: { critFlat: 0.06 }, icon: { shape: 'ring', c1: '#b9a06a' }, desc: 'Trophy of the Alpha Wolf.' });
def('bear_charm_amulet', { name: 'Bear-Heart Amulet', cat: 'trinket', slot: 'amulet', rarity: 'rare', value: 160, mods: { flatHp: 30 }, icon: { shape: 'amulet', c1: '#a34d3e' }, desc: 'Grants the endurance of a hibernating bear.' });
def('merchant_signet', { name: "Merchant's Signet", cat: 'trinket', slot: 'ring', rarity: 'rare', value: 220, mods: { tradeBonus: 0.12 }, icon: { shape: 'ring', c1: '#d8b74a' }, desc: 'League-marked gold opens generous purses.' });
def('sage_pendant', { name: 'Sage Pendant', cat: 'trinket', slot: 'amulet', rarity: 'epic', value: 300, mods: { xpBonus: 0.14, intellect: 2 }, icon: { shape: 'amulet', c1: '#7ea4e0' }, desc: 'Knowledge flows quicker around the curious.' });
def('ancient_sigil', { name: 'Ancient Sigil', cat: 'trinket', slot: 'ring', rarity: 'mythic', value: 750, mods: { allStats: 1, luckFlat: 0.08 }, icon: { shape: 'ring', c1: '#7be0c3' }, desc: 'Recovered from ruins older than language.' });

def('silver', { name: 'Silver Vein Chunk', rarity: 'rare', value: 40, icon: { shape: 'ore', c1: '#d9dde4' }, desc: 'Mountain silver. Nobles adore it.' });
def('gold_nugget', { name: 'Gold Nugget', rarity: 'rare', value: 60, icon: { shape: 'lump', c1: '#d8b74a' }, desc: 'Weighs down pockets, lifts spirits.' });
def('crystal', { name: 'Lumin Crystal', rarity: 'rare', value: 85, icon: { shape: 'gem', c1: '#7be0c3' }, desc: 'Shards that glow faintly at night.' });
def('moonstone', { name: 'Moonstone', rarity: 'epic', value: 300, icon: { shape: 'gem', c1: '#b9c7ff' }, desc: 'Cold radiance from the Frozen North.' });
def('ancient_core', { name: 'Ancient Core', rarity: 'legendary', value: 500, icon: { shape: 'core', c1: '#5ad0c0' }, desc: 'Still warm after centuries. Still humming.' });
def('dragon_scale', { name: 'Dragon Scale', rarity: 'legendary', value: 420, icon: { shape: 'scale', c1: '#c0453a' }, desc: 'Proof you stood beneath wing and fire.' });
def('royal_artifact', { name: 'Royal Artifact', rarity: 'mythic', value: 800, icon: { shape: 'relic', c1: '#e8c94b' }, desc: 'Crown-jewels of the vanished dynasty.' });
def('ancient_relic', { name: 'Ancient Relic', rarity: 'epic', value: 260, icon: { shape: 'relic', c1: '#8fd0bd' }, desc: 'Meaningless bauble or message in metal?' });

def('ancient_key', { cat: 'special', stack: 20, value: 0, icon: { shape: 'key', c1: '#7be0c3' }, desc: 'Opens what the ancients locked away.' });
def('treasure_map', { cat: 'special', stack: 1, value: 100, usable: true, icon: { shape: 'map', c1: '#c9a97a' }, desc: 'X marks somewhere promising… Use it to reveal a cache.' });
def('founders_kit', { name: "Founder's Kit", cat: 'special', stack: 1, value: 0, icon: { shape: 'kit', c1: '#8a6540' }, desc: 'Tools, plans and one stubborn banner. Place your Town Hall.' });

