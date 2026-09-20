// Selected CC0 artwork by Henrique Lazarini (7Soul1).
// Provenance: public/assets/items/CREDITS.md. Unmapped items keep procedural art.
import type * as Phaser from 'phaser';

export const ITEM_ARTWORK: Readonly<Record<string, string>> = {
  axe_stone: 'W_Axe001.png',
  axe_iron: 'W_Axe002.png',
  axe_steel: 'W_Axe003.png',
  battle_axe: 'W_Axe004.png',
  knife_hunter: 'W_Dagger001.png',
  iron_sword: 'W_Sword001.png',
  steel_sword: 'W_Sword002.png',
  greatsword: 'W_Sword003.png',
  dawnbreaker: 'W_Gold_Sword.png',
  stone_spear: 'W_Spear001.png',
  iron_spear: 'W_Spear002.png',
  short_bow: 'W_Bow01.png',
  longbow: 'W_Bow02.png',
  wood: 'E_Wood01.png',
  hardwood: 'E_Wood02.png',
  stone: 'I_Rock01.png',
  coal: 'I_Coal.png',
  iron_ingot: 'I_SilverBar.png',
  bone: 'I_Bone.png',
  feathers: 'I_Feather01.png',
  herbs: 'I_Leaf.png',
  mushrooms: 'I_C_Mushroom.png',
  berries: 'I_C_Mulberry.png',
  raw_meat: 'I_C_RawMeat.png',
  cooked_meat: 'I_C_Meat.png',
  raw_fish: 'I_C_RawFish.png',
  cooked_fish: 'I_C_Fish.png',
  bread: 'I_C_Bread.png',
  healing_salve: 'P_Red01.png',
  stamina_tonic: 'P_Blue01.png',
  herb_tea: 'P_Green01.png',
  torch: 'I_Torch01.png',
  fur_pelt: 'I_WolfFur.png',
  crystal: 'I_Crystal01.png',
  moonstone: 'I_Opal.png',
  ancient_key: 'I_Key01.png',
  treasure_map: 'I_Map.png',
  wolfsfang_ring: 'Ac_Ring01.png',
  merchant_signet: 'Ac_Ring02.png',
  bear_charm_amulet: 'Ac_Necklace04.png',
  sage_pendant: 'Ac_Necklace05.png',
};

export const itemArtworkKey = (id: string): string => `item_art_${id}`;

/** Phaser waits for these local images before building the shared icon atlas. */
export function preloadItemArtwork(scene: Phaser.Scene): void {
  for (const [id, file] of Object.entries(ITEM_ARTWORK)) {
    const key = itemArtworkKey(id);
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `${import.meta.env.BASE_URL}assets/items/${file}`);
    }
  }
}
