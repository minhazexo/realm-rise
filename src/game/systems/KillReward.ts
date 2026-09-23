// ─────────────────────────────────────────────────────────────────────────────
// KillReward — what a kill pays, in one place: loot rolls, gold on the ground,
// biome-scaled XP, profession XP, the reward beat, the stamina refund and the
// kill events.
//
// Moved out of Enemy.die() (which now owns the death: teardown + delegate) so
// the payout policy is gameplay that can be read and changed without reading an
// entity, and so an entity never writes persistent state — the stamina refund
// goes through ProgressionXP.restoreStamina like every other stamina change.
//
// Scene contract: scene.dropLoot(x, y, id, qty), scene.dropLootGold(x, y, n),
// scene.onEnemyDeath?(e)
// ─────────────────────────────────────────────────────────────────────────────
import { Bus } from '../core/EventBus.ts';
import { DIFFICULTY } from '../core/Constants.ts';
import GameState from '../core/GameState.ts';
import { BIOMES } from '../world/biomeTable.ts';
import { biomeAt } from '../world/worldGen.ts';
import { awardXP, profXP, restoreStamina } from './ProgressionSystem.ts';

/** A killed enemy, as this module needs it. */
export interface KillTarget {
  key: string;
  def: any;
  boss: boolean;
  elite: boolean;
  sprite: { x: number; y: number };
}

/** Minimal scene surface consumed by the payout. */
export interface KillRewardScene {
  dropLoot(x: number, y: number, id: string, qty: number): unknown;
  dropLootGold(x: number, y: number, amount: number): void;
  onEnemyDeath?(e: any): void;
}

/** Stamina refunded for the kill, by how hard it was. */
const KILL_STAMINA = { boss: 25, elite: 14, normal: 6 } as const;
/** Profession XP per kill. */
const COMBAT_PROF_XP = 6;

/** The active difficulty's tuning for the current save. */
function difficultyTier(): { loot?: number } {
  const table: any = DIFFICULTY;
  return table[GameState.s.settings.difficulty] || table.normal;
}

/**
 * Roll this enemy's loot table. Pure: hand it the multipliers and it decides.
 * Hunt drops (meat/hide/pelt) scale with the player's huntLoot stat, everything
 * else with the difficulty's loot multiplier.
 */
export function rollLoot(
  def: any,
  opts: { lootMult?: number; huntMult?: number } = {}
): { id: string; qty: number }[] {
  const lootMult: number = opts.lootMult ?? 1;
  const huntMult: number = opts.huntMult ?? 1;
  const out: { id: string; qty: number }[] = [];
  for (const l of def.loot || []) {
    const id: string = l.id as string;
    const isHunt: boolean = id.includes('meat') || id.includes('hide') || id.includes('pelt');
    if (Math.random() < (l.chance as number) * (isHunt ? huntMult : 1) * lootMult) {
      out.push({ id, qty: Math.max(l.min, Math.round(l.min + Math.random() * (l.max - l.min))) });
    }
  }
  return out;
}

/**
 * Pay out one kill, in the order the player sees it: drops land, gold on the
 * ground, XP (biome danger scales it), the beat at the corpse, the stamina
 * refund, then the kill events and the scene's death hook.
 */
export function grantKillReward(scene: KillRewardScene, e: KillTarget): void {
  const S = GameState.s;
  const x: number = e.sprite.x, y: number = e.sprite.y;
  const tier = difficultyTier();

  for (const item of rollLoot(e.def, {
    lootMult: tier.loot ?? 1,
    huntMult: S.player.derived?.huntLoot || 1
  })) {
    scene.dropLoot(x, y, item.id, item.qty);
  }
  if (e.def.goldDrop) scene.dropLootGold(x, y, Math.round(e.def.goldDrop * (tier.loot || 1)));

  // Kill XP scales with the biome's danger multiplier (swamp 1.25 …
  // volcanic 1.6), making dangerous biomes worth the trip.
  let xpGain: number = e.def.xp;
  try {
    const dm: number = BIOMES[biomeAt(x, y)]?.dangerMult || 1;
    xpGain = Math.round(xpGain * dm);
  } catch { /* flat XP fallback */ }
  awardXP(xpGain, 'kill');
  profXP('combat', COMBAT_PROF_XP);

  // Kill-reward beat: anchor the XP gain at the corpse so kills read as wins;
  // boss deaths get a heavier burst.
  try {
    import('./CelebrationFX.ts').then((c) => c.killRewardBeat(scene as any, x, y, xpGain, e.boss));
  } catch { /* cosmetic */ }

  // Combat reward: stamina back on the kill — rewards aggressive play and
  // makes kill chains possible.
  restoreStamina(e.boss ? KILL_STAMINA.boss : e.elite ? KILL_STAMINA.elite : KILL_STAMINA.normal);

  Bus.emit('enemy-killed', { defKey: e.key, isBoss: e.boss, x, y });
  Bus.emit('play-sound', 'hit_flesh');
  if (e.boss) Bus.emit('boss-defeated', e.key);
  scene.onEnemyDeath?.(e);
}
