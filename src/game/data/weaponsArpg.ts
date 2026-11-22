// ─────────────────────────────────────────────────────────────────────────────
// ARPG weapon pass — dagger, dual blades, staff, and the named legendary line.
// Data only; the combat path in Player.tryAttack / ElementalSystem interprets it.
//
// ── The weapon curve (professional pass, 2026-11) ────────────────────────────
// Damage-per-second (dmg / cd) is deliberately banded by rarity, and WITHIN a
// band the weapon's identity decides where it sits:
//
//   rarity      DPS band   identity budget
//   common      14–27      no mechanic, one clear trade-off
//   uncommon    28–40      a stat trade-off (reach, stagger, ammo)
//   rare        42–55      one stat spike (crit, range, combo finisher)
//   epic        56–66      one NAMED special (cleave / shadowfang)
//   legendary   70–80      one NAMED special + a second stat spike
//   mythic      84–95      a special AND a rule-breaker (pierce, wave, reach)
//
// A slow weapon earns a little more DPS than a fast one at the same rarity; a
// fast weapon earns crit instead. tests/items.mjs enforces the bands, the
// special ids, and that every weapon here is actually obtainable.
//
// Category identity (feel, not just numbers):
//   dagger     — fastest, crit-focused, short reach
//   dualblades — fast chain, widest combo finisher payoff
//   staff      — magic bolts (mana ammo), elemental variety, longest reach
// ─────────────────────────────────────────────────────────────────────────────
import { def } from './itemDefs.ts';

// ── Dagger — crit-focused assassin line ─────────────────────────────────────
def('bone_dagger', {
  name: 'Bone Dagger', cat: 'weapon',
  weapon: { dmg: 7, crit: 0.22, cd: 0.3, range: 38, style: 'slash', critDmgBonus: 0.25 },
  durability: 100, value: 34,
  icon: { shape: 'sword', c1: '#e8e2d0' },
  desc: 'Knapped from a wolf’s femur. Whisper-thin, and it finds the gaps.'
});
def('shadow_fang', {
  name: 'Shadow Fang', cat: 'weapon',
  weapon: { dmg: 16, crit: 0.3, cd: 0.28, range: 40, style: 'slash', element: 'shadow', critDmgBonus: 0.5, special: 'shadowfang' },
  rarity: 'epic', durability: 240, value: 320,
  icon: { shape: 'sword', c1: '#8a6fd0' },
  desc: 'Ground down from a Void Ember. Critical strikes drink the wound they make.'
});

// ── Dual blades — combo chain line ──────────────────────────────────────────
def('twin_cutlasses', {
  name: 'Twin Cutlasses', cat: 'weapon',
  weapon: { dmg: 7, crit: 0.1, cd: 0.26, range: 44, style: 'slash', comboFinisherMult: 1.75 },
  durability: 130, value: 48,
  icon: { shape: 'sword', c1: '#c9a86a' },
  desc: 'One for the parry, one for the ribs. The third blow is the one they remember.'
});
def('embersong_twins', {
  name: 'Embersong Twins', cat: 'weapon',
  weapon: { dmg: 13, crit: 0.12, cd: 0.25, range: 46, style: 'slash', element: 'fire', comboFinisherMult: 1.9 },
  rarity: 'rare', durability: 220, value: 240,
  icon: { shape: 'sword', c1: '#ff9a5c' },
  desc: 'Each strike fans the last into flame. The finisher lands like a struck bell.'
});

// ── Staff — magic bolt line (mana cost instead of stamina-ammo) ─────────────
def('apprentice_staff', {
  name: 'Apprentice Staff', cat: 'weapon',
  weapon: { dmg: 11, crit: 0.08, cd: 0.62, range: 420, style: 'staff', projectileSpeed: 460, manaCost: 6, element: 'arcane' },
  durability: 110, value: 60,
  icon: { shape: 'rod', c1: '#9fb4e8' },
  desc: 'Cheap wood and honest hexes. It will not win a duel; it will not lose one either.'
});
def('stormshard_staff', {
  name: 'Stormshard Staff', cat: 'weapon',
  weapon: { dmg: 36, crit: 0.12, cd: 0.58, range: 500, style: 'staff', projectileSpeed: 540, manaCost: 9, element: 'lightning' },
  rarity: 'epic', durability: 260, value: 380,
  icon: { shape: 'rod', c1: '#ffe86b' },
  desc: 'A thundercloud, politely handle-able. Every bolt leaves the air smelling of rain.'
});

// ── Legendaries — named weapons (Dawnbreaker lives in itemsGear) ────────────
def('voidfang', {
  name: 'Voidfang', cat: 'weapon',
  weapon: { dmg: 24, crit: 0.28, cd: 0.32, range: 46, style: 'slash', element: 'shadow', critDmgBonus: 0.35, special: 'voidfang' },
  rarity: 'legendary', durability: 999, value: 850,
  icon: { shape: 'sword', c1: '#b48aff' },
  desc: 'Critical hits drink a sliver of the enemy to feed your energy. The blade never warms.'
});
def('stormpiercer', {
  name: 'Stormpiercer', cat: 'weapon',
  weapon: { dmg: 29, crit: 0.14, cd: 0.38, range: 60, style: 'pierce', element: 'lightning', special: 'chain_lightning', heavy: true },
  rarity: 'legendary', durability: 999, value: 900,
  icon: { shape: 'spear', c1: '#ffe86b' },
  desc: 'The strike does not stop at the first body. Lightning leaps between foes.'
});
def('gravekeeper', {
  name: 'Gravekeeper', cat: 'weapon',
  weapon: { dmg: 40, crit: 0.1, cd: 0.55, range: 58, style: 'crush', element: 'holy', special: 'gravekeeper', heavy: true },
  rarity: 'legendary', durability: 999, value: 880,
  icon: { shape: 'axe', c1: '#fff3c9' },
  desc: 'Consecrated iron. Drains the dead to mend the living — and the dead feel it.'
});
