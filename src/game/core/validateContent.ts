// ─────────────────────────────────────────────────────────────────────────────
// Content validator — development-time cross-reference checks for every
// data-driven domain (requirement: validation).
//
// Catches at test time what used to break silently in-game:
//   duplicate IDs across split source files, dangling item/recipe/loot/
//   node/biome/quest/skill references, unknown icon shapes, bad equipment
//   slots, and quest chains pointing at unknown content.
//
// Pure modules only (no Phaser, no DOM) so it runs in node tests AND in the
// browser console. Returns { errors[], warnings[] }; errors fail the build.
// ─────────────────────────────────────────────────────────────────────────────
import { ITEMS } from '../data/items.ts';
import { SHAPES_A } from '../assets/iconShapesA.ts';
import { SHAPES_B } from '../assets/iconShapesB.ts';
import { RECIPES } from '../data/recipes.ts';
import { ALL_ENEMY_DEFS } from '../data/enemies.ts';
import { ENEMIES } from '../data/enemiesWild.ts';
import { BANDITS, BOSSES } from '../data/enemiesHuman.ts';
import { BUILDINGS } from '../data/buildings.ts';
import { BUILDINGS_A } from '../data/buildingsA.ts';
import { BUILDINGS_B } from '../data/buildingsB.ts';
import { NPCS } from '../data/npcs.ts';
import { MAIN_QUESTS, QUEST_ORDER } from '../data/questsMain.ts';
import type { QuestDef } from '../data/questsMain.ts';
import { SIDE_QUESTS } from '../data/questsSide.ts';
import { ALL_QUEST_DEFS } from '../data/quests.ts';
import { SKILLS, BRANCHES } from '../data/skills.ts';
import { FACTIONS } from '../data/factions.ts';
import { NODE_TYPES } from '../world/nodeTypes.ts';
import { BIOMES } from '../world/biomeTable.ts';
import { CHEST_POOLS, RAID_POOL } from '../data/lootTables.ts';

const KNOWN_CATS = new Set(['resource', 'consumable', 'tool', 'weapon', 'offhand', 'armor', 'trinket', 'special']);
const KNOWN_SLOTS = new Set(['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet']);

/** Shape of still-untyped world data (nodeTypes/biomeTable migrate separately). */
interface NodeLike {
  tex?: string;
  yRes?: string;
}

interface BiomeResourceLike {
  type: string;
  weight: number;
}

interface BiomeEnemyLike {
  key: string;
}

interface BiomeLike {
  grass?: unknown;
  resources?: BiomeResourceLike[];
  enemies?: BiomeEnemyLike[];
}

// Normalised views over the not-yet-typed world modules. `as unknown as`
// keeps this file immune to their eventual type choices; runtime shapes are
// frozen by the no-logic-change migration rule.
const NODE_MAP = NODE_TYPES as unknown as Record<string, NodeLike>;
const BIOME_MAP = BIOMES as unknown as Record<string, BiomeLike>;

function collisionScan(namedMaps: Record<string, string[]>): string[] {
  // namedMaps: { label: string[] } — report ids present in >1 source.
  const seen = new Map<string, string>();
  const dupes = new Set<string>();
  for (const [label, ids] of Object.entries(namedMaps)) {
    for (const id of ids) {
      if (seen.has(id)) dupes.add(`${id} (in ${seen.get(id)} + ${label})`);
      else seen.set(id, label);
    }
  }
  return [...dupes];
}

export interface ContentValidation {
  errors: string[];
  warnings: string[];
}

export function validateContent(): ContentValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string): void => { errors.push(m); };
  const warn = (m: string): void => { warnings.push(m); };
  const hasItem = (id: string): boolean => !!ITEMS[id];

  // ── 1. Duplicate IDs across split sources ─────────────────────────────
  for (const d of collisionScan({
    enemiesWild: Object.keys(ENEMIES),
    bandits: Object.keys(BANDITS),
    bosses: Object.keys(BOSSES),
  })) err(`enemy id collision: ${d}`);
  for (const d of collisionScan({
    buildingsA: Object.keys(BUILDINGS_A),
    buildingsB: Object.keys(BUILDINGS_B),
  })) err(`building id collision: ${d}`);
  const questIds: string[] = [...Object.keys(MAIN_QUESTS), ...Object.keys(SIDE_QUESTS)];
  for (const d of collisionScan({ allQuests: questIds })) err(`quest id collision: ${d}`);

  // ── 2. Items ──────────────────────────────────────────────────────────
  const drawers = new Set([...Object.keys(SHAPES_A), ...Object.keys(SHAPES_B)]);
  for (const [id, it] of Object.entries(ITEMS)) {
    if (!it.name) err(`item "${id}" missing name`);
    if (!KNOWN_CATS.has(it.cat)) err(`item "${id}" has unknown category "${it.cat}"`);
    if (!(it.stack > 0)) err(`item "${id}" has bad stack limit "${it.stack}"`);
    const shape: string | undefined = it.icon?.shape;
    if (!shape) err(`item "${id}" missing icon.shape`);
    else if (!drawers.has(shape)) err(`item "${id}" icon.shape "${shape}" has no drawer`);
    if (it.slot && !KNOWN_SLOTS.has(it.slot)) err(`item "${id}" has unknown slot "${it.slot}"`);
    if (it.durability != null && !(it.durability > 0)) err(`item "${id}" has bad durability`);
  }

  // ── 3. Recipes (cost + output must resolve) ───────────────────────────
  const recipeIds = new Set<string>();
  for (const r of RECIPES) {
    if (!r.id) { err('recipe missing id'); continue; }
    if (recipeIds.has(r.id)) err(`duplicate recipe id "${r.id}"`);
    recipeIds.add(r.id);
    if (!r.out) err(`recipe "${r.id}" missing output`);
    else if (!hasItem(r.out)) err(`recipe "${r.id}" outputs unknown item "${r.out}"`);
    for (const c of Object.keys(r.cost || {})) {
      if (!hasItem(c)) err(`recipe "${r.id}" consumes unknown item "${c}"`);
    }
  }

  // ── 4. Enemies (loot must resolve; stats sane) ─────────────────────────
  for (const [key, e] of Object.entries(ALL_ENEMY_DEFS)) {
    if (!(e.hp > 0)) err(`enemy "${key}" has bad hp`);
    for (const l of e.loot || []) {
      if (!hasItem(l.id)) err(`enemy "${key}" drops unknown item "${l.id}"`);
    }
  }

  // ── 5. Buildings (costs resolve to items or buildings) ────────────────
  for (const [key, b] of Object.entries(BUILDINGS)) {
    for (const c of Object.keys(b.cost || {})) {
      if (!hasItem(c) && !BUILDINGS[c]) err(`building "${key}" costs unknown "${c}"`);
    }
    // upgradesTo is read defensively: the BuildingDef type does not declare
    // it, but authored data may still carry it — preserve the original check.
    const upgradesTo: unknown = (b as unknown as Record<string, unknown>).upgradesTo;
    if (typeof upgradesTo === 'string' && upgradesTo && !BUILDINGS[upgradesTo]) {
      err(`building "${key}" upgrades to unknown "${upgradesTo}"`);
    }
  }

  // ── 6. Gather nodes (yield resolves; texture present) ─────────────────
  for (const [type, n] of Object.entries(NODE_MAP)) {
    if (!n.tex) err(`node "${type}" missing texture key`);
    if (!n.yRes) err(`node "${type}" missing yield resource`);
    else if (!hasItem(n.yRes)) err(`node "${type}" yields unknown item "${n.yRes}"`);
  }

  // ── 7. Biomes (spawn tables resolve) ──────────────────────────────────
  for (const [id, b] of Object.entries(BIOME_MAP)) {
    if (!b.grass) warn(`biome "${id}" missing grass color`);
    for (const r of b.resources || []) {
      if (!NODE_MAP[r.type]) err(`biome "${id}" spawns unknown node "${r.type}"`);
      if (!(r.weight > 0)) err(`biome "${id}" node "${r.type}" has bad weight`);
    }
    for (const e of b.enemies || []) {
      if (!ALL_ENEMY_DEFS[e.key]) err(`biome "${id}" spawns unknown enemy "${e.key}"`);
    }
  }

  // ── 8. Skills (branches + prereqs resolve) ────────────────────────────
  const branchIds = new Set(BRANCHES.map((b) => b.id));
  const skillIds = new Set(SKILLS.map((s) => s.id));
  for (const s of SKILLS) {
    if (!branchIds.has(s.branch)) err(`skill "${s.id}" has unknown branch "${s.branch}"`);
    for (const rq of Object.keys(s.req || {})) {
      if (!skillIds.has(rq)) err(`skill "${s.id}" requires unknown skill "${rq}"`);
    }
    if (!(s.maxRank > 0)) err(`skill "${s.id}" has bad maxRank`);
  }

  // ── 9. Quests (chain order + step refs resolve) ───────────────────────
  for (const qid of QUEST_ORDER) {
    if (!MAIN_QUESTS[qid]) err(`QUEST_ORDER points at unknown main quest "${qid}"`);
  }
  const checkSteps = (qid: string, q: QuestDef): void => {
    for (const st of q.steps || []) {
      if (st.item && !hasItem(st.item)) err(`quest "${qid}" step wants unknown item "${st.item}"`);
      if (st.enemy && !ALL_ENEMY_DEFS[st.enemy]) err(`quest "${qid}" step wants unknown enemy "${st.enemy}"`);
      if (st.target && !ALL_ENEMY_DEFS[st.target]) err(`quest "${qid}" step targets unknown "${st.target}"`);
      if (st.building && !BUILDINGS[st.building]) err(`quest "${qid}" step wants unknown building "${st.building}"`);
    }
  };
  for (const [qid, q] of Object.entries(MAIN_QUESTS)) checkSteps(qid, q);
  for (const [qid, q] of Object.entries(SIDE_QUESTS)) checkSteps(qid, q);
  for (const qid of [...Object.keys(MAIN_QUESTS), ...Object.keys(SIDE_QUESTS)]) {
    if (!ALL_QUEST_DEFS[qid]) err(`quest "${qid}" missing from quest registry`);
  }

  // ── 10. NPCs + factions (light touch) ─────────────────────────────────
  for (const [key, n] of Object.entries(NPCS)) {
    if (!n.name) warn(`npc "${key}" missing display name`);
  }
  if (Object.keys(FACTIONS).length === 0) err('no factions defined');

  // ── 11. Loot tables (chest drops + raid parties resolve) ────────────
  for (const [tier, entries] of Object.entries(CHEST_POOLS)) {
    for (const [id, qtyMax, chance] of entries) {
      if (!hasItem(id)) err(`chest "${tier}" drops unknown item "${id}"`);
      if (!(qtyMax > 0)) err(`chest "${tier}" item "${id}" has bad qtyMax`);
      if (!(chance > 0 && chance <= 1)) err(`chest "${tier}" item "${id}" has bad chance`);
    }
  }
  for (const e of RAID_POOL) {
    if (!ALL_ENEMY_DEFS[e.key]) err(`raid pool spawns unknown enemy "${e.key}"`);
    if (!(e.weight > 0)) err(`raid pool enemy "${e.key}" has bad weight`);
  }

  return { errors, warnings };
}
