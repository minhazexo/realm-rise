// Central panel hub (spec §39–43): inventory/crafting/skills/build/kingdom/map/
// journal/character/save/trade/pause. Each panel bridges to live systems.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import GameState from '../../game/core/GameState.ts';
import { CH } from '../../game/core/EventBus.ts';
import { clearWaypoint, mapPoint, MAP_VIEW_RADIUS, setWaypoint } from '../../game/systems/NavigationSystem.ts';
import { useGameState } from '../../hooks/useGameState.ts';
import { getItem, RARITY } from '../../game/data/items.ts';
import { iconDataURLs } from '../../game/assets/icons.ts';
import { sortedInventory, equip, unequip, countItem, useConsumable } from '../../game/systems/InventorySystem.ts';
import { recipesForUI, craft } from '../../game/systems/CraftingSystem.ts';
import { BRANCHES, SKILLS } from '../../game/data/skills.ts';
import { spendStat, learnSkill, xpToNext } from '../../game/systems/ProgressionSystem.ts';
import { BUILDINGS, BUILDING_CATS, getBuildingDef } from '../../game/data/buildings.ts';
import { allPois } from '../../game/world/worldGen.ts';
import { setWorldSeed } from '../../game/world/worldGen.ts';
import { BIOMES } from '../../game/world/biomeTable.ts';
import { drawMapTerrain, poiStyle } from '../../game/world/mapRender.ts';
import { stageRequirementsMissing, territoryPct, refresh as kingdomRefresh, militaryPowerTotal } from '../../game/systems/KingdomSystem.ts';
import { canRecruitUnit, recruitUnit } from '../../game/systems/KingdomEconomy.ts';
import { saveToSlot, listSaves, loadFromSlot, deleteSlot, exportSlot, importSlotData } from '../../game/systems/SaveSystem.ts';
import { merchantStock, makeContext, buyOffer, sellUnit } from '../../game/systems/EconomySystem.ts';
import type { PriceContext } from '../../game/systems/EconomySystem.ts';
import { biomeAt } from '../../game/world/worldGen.ts';
import { statusOf } from '../../game/systems/FactionSystem.ts';
import { FACTIONS } from '../../game/data/factions.ts';
import { sceneCommand } from '../../game/main.ts';
import { questStateSnapshot } from '../../game/systems/QuestSystem.ts';
import { MILITARY_CONFIG, SETTLEMENT_CONFIG } from '../../game/core/Constants.ts';

// Keep the named re-export referenced (kingdom auto-refresh hook for future use).
void kingdomRefresh;
void SETTLEMENT_CONFIG;
void useMemo;
void equip;

interface PanelsProps {
  panel: string | null | undefined;
}

interface IconProps {
  id: string;
  size?: number;
}

interface InventoryEntry {
  id: string;
  iid?: string;
  qty?: number;
}

interface EquippedItem {
  id: string;
  dur?: number | null;
}

interface RecipeCompare {
  note?: string;
  dmgDelta?: number;
  armorDelta?: number;
  equippedId?: string;
  critDelta?: number;
}

interface RecipeUI {
  id: string;
  cat: string;
  out: string;
  cost: Record<string, number>;
  station?: string;
  durSec?: number;
  def?: { name?: string };
  reason?: string;
  compare?: RecipeCompare;
}

interface CraftQueueState {
  id: string;
  name: string;
  total: number;
  done: number;
}

interface SkillDef {
  id: string;
  branch?: string;
  name?: string;
  desc?: string;
  maxRank: number;
  req?: Record<string, number>;
}

interface BranchDef {
  id: string;
  label?: string;
  color?: string;
}

interface BuildingDef {
  key: string;
  label?: string;
  desc?: string;
  cost: Record<string, number>;
  requiresStage?: number;
}

interface CitizenInfo {
  uid?: string;
  name?: string;
  role?: string;
  skillLv?: number;
}

interface PoiInfo {
  id: string;
  name?: string;
  x: number;
  y: number;
}

interface FactionInfo {
  key: string;
  name?: string;
  status?: string;
}

interface JournalStep {
  done?: boolean;
  text?: string;
  have?: number | string;
  need?: number | string;
}

interface SideQuest {
  id: string;
  title?: string;
  steps: JournalStep[];
}

interface JournalSnapshot {
  none?: boolean;
  chapter?: number | string;
  title?: string;
  steps: JournalStep[];
  side?: SideQuest[];
}

interface TradeOffer {
  id: string;
  buy: number;
}

interface SaveSummary {
  name?: string;
  level?: number;
  day?: number;
}

// GameState.session gains dynamic UI-only fields at runtime (game batch owns the type).
type SessionExtras = Record<string, any>;
const uiSession = GameState.session as unknown as SessionExtras;

export default function Panels({ panel }: PanelsProps): JSX.Element | null {
  const key: string | null | undefined = panel;
  if (!key) return null;
  const close = (): void => {
    GameState.session.uiPanel = null;
    GameState.session.paused = false;
    GameState.notify(CH.SCREEN);
        import('../../game/core/EventBus.ts').then(({ Bus }: any) => Bus.emit('play-sound', 'ui_click'));
  };
  const panelEl: JSX.Element | null = (() => {
    switch (key) {
      case 'inventory': return <InventoryPanel />;
      case 'crafting': return <CraftingPanel />;
      case 'skills': return <SkillsPanel />;
      case 'build': return <BuildPanel />;
      case 'kingdom': return <KingdomPanel />;
      case 'map': return <MapPanel />;
      case 'journal': return <JournalPanel />;
      case 'character': return <CharacterPanel />;
      case 'save': return <SavePanel />;
      case 'trade': return <TradePanel />;
      case 'pause': return <PausePanel />;
      default: return null;
    }
  })();
  return (
    <div className="panel-layer">
      <div className="panel-wrap">
        {panelEl}
        <button className="panel-close" onClick={close} aria-label="Close panel">✕</button>
      </div>
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────── */

function Icon({ id, size = 34 }: IconProps): JSX.Element {
  const url: string | undefined = iconDataURLs[id];
  return url
    ? <img className="inv-icon" src={url} width={size} height={size} style={{ width: size, height: size }} alt={getItem(id)?.name || id} />
    : <span className="inv-icon text" style={{ width: size, height: size }}>?</span>;
}

function close(): void {
  GameState.session.uiPanel = null;
  GameState.session.paused = false;
  GameState.notify(CH.SCREEN);
}

/* ── Inventory ─────────────────────────────────────────────────────────── */
function InventoryPanel(): JSX.Element {
  const [sort, setSort] = useState<string>('rarity');
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState<string>('');
  const inv = useGameState([CH.INVENTORY, CH.EQUIPMENT, CH.SETTLEMENT], () => ({
    list: (sortedInventory as (...args: any[]) => InventoryEntry[])(sort, cat, q),
    eq: { ...GameState.s?.player?.equipment },
    gold: GameState.s?.player?.gold
  })) as { list: InventoryEntry[]; eq: Record<string, EquippedItem | undefined>; gold?: number };
  const R: any = RARITY;

  const handleClick = (e: InventoryEntry): void => {
    const ref: string = e.iid || e.id;
    if (e.qty === undefined) {
      // stacked resource/consumable — use if consumable else info toast
      const d: any = getItem(e.id);
      if (d?.use) {
        const u: any = useConsumable(e.id, GameState.s.player.derived?.healPower);
                import('../../game/main.ts').then((m: any) => m.worldScene()?.player?.applyConsumableEffects?.(u));
                if (d.id === 'treasure_map') import('../../game/systems/QuestEngine.ts').then((q2: any) => q2.handleEvent({ type: 'useItem', itemId: 'treasure_map' }));
        return;
      }
    }
    // gear → equip (equip() itself validates the entry exists)
    import('../../game/systems/InventorySystem.ts').then((I: any) => {
      I.equip(ref);
    });
    import('../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
    import('../../game/main.ts').then((m: any) => m.worldScene()?.refreshPlayerSkin?.());
  };

  const handleUnequip = (slot: string): void => {
    unequip(slot);
    import('../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
    import('../../game/main.ts').then((m: any) => m.worldScene()?.refreshPlayerSkin?.());
  };

  return (
    <div className="panel inventory-panel">
      <h2>Inventory <span className="gold">🪙 {inv.gold}</span></h2>
      <div className="inv-toolbar">
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rarity">Rarity</option><option value="name">Name</option>
          <option value="type">Type</option><option value="value">Value</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All</option>
          {['resource', 'tool', 'weapon', 'offhand', 'armor', 'trinket', 'consumable', 'special'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="equip-strip">
        {['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet'].map((slot) => {
          const eq: EquippedItem | undefined = inv.eq[slot];
          const def: any = eq ? getItem(eq.id) : null;
          return (
            <button key={slot} className="eq-slot" onClick={() => eq && handleUnequip(slot)}>
              <span className="eq-slot-label">{slot.slice(0, 3).toUpperCase()}</span>
              {def && eq ? <Icon id={eq.id} size={30} /> : <span className="eq-empty">—</span>}
              {def && (
                <span className="drop-hover">
                  <b className="rn">{def.name}</b><br />
                  <span className="rd">{RARITY[def.rarity]?.label || 'Common'}</span>
                  {def.weapon && <><br /><span className="stat-line">⚔ {def.weapon.damage} dmg</span></>}
                  {def.armor != null && def.armor > 0 && <><br /><span className="stat-line">🛡 +{def.armor} armor</span></>}
                  {def.shieldBlock && <><br /><span className="stat-line">🛡 {Math.round(def.shieldBlock * 100)}% block</span></>}
                  {eq?.dur != null && <><br /><span className="stat-line">♻ {eq.dur}/{def.durability}</span></>}
                  {def.desc && <><br /><span>{def.desc}</span></>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid">
        {inv.list.map((e) => {
          const d: any = getItem(e.id);
          const isGear: boolean = !!(e.iid || d?.durability || d?.weapon || d?.slot);
          return (
            <button key={e.iid || e.id} className="cell" style={{ '--rar': R[d.rarity].color } as CSSProperties} onClick={() => handleClick(e)} title={d.name}>
              <Icon id={e.id} size={32} />
              {(e.qty ?? 0) > 1 && <span className="qty">{e.qty}</span>}
              {isGear && (
                <span
                  className="salvage-btn"
                  title="Salvage for 50% materials (needs forge nearby)"
                  onClick={(ev) => {
                    ev.stopPropagation();
                                        import('../../game/systems/CraftingSystem.ts').then((C: any) => {
                      const r: any = C.salvage(e.iid || e.id);
                      GameState.toast(r.ok
                        ? { title: `Salvaged ${d.name}`, msg: Object.entries(r.refund || {}).map(([id, n]) => `${getItem(id)?.name}×${n}`).join(', ') || 'Scrap.', kind: 'craft', icon: undefined }
                        : { title: 'Cannot salvage', msg: r.reason, kind: 'warn', icon: undefined });
                    });
                  }}
                >♻</span>
              )}
              <span className="drop-hover">
                <b className="rn">{d.name}</b><br />
                <span className="rd">{R[d.rarity].label} {d.cat}</span>
                {d.desc && <><br /><span>{d.desc}</span></>}
                {d.weapon && <><br /><span className="stat-line">⚔ Damage: {d.weapon.damage}{d.weapon.reachBonusVsAnimals ? ' (+vs animals)' : ''}</span></>}
                {d.armor != null && d.armor > 0 && <><br /><span className="stat-line">🛡 Armor: +{d.armor}</span></>}
                {d.shieldBlock && <><br /><span className="stat-line">🛡 Block: {Math.round(d.shieldBlock * 100)}%</span></>}
                {d.tool && <><br /><span className="stat-line">🔧 Tool: {d.tool} (Tier {d.tier || 1})</span></>}
                {d.gatherMult && d.gatherMult > 1 && <><br /><span className="stat-line">📦 Gather: ×{d.gatherMult}</span></>}
                {d.durability != null && <><br /><span className="stat-line">♻ Durability: {d.durability}</span></>}
                {d.value > 0 && <><br /><span className="stat-line">🪙 Value: {d.value}g</span></>}
                {d.warmth != null && d.warmth > 0 && <><br /><span className="stat-line">🔥 Warmth: +{d.warmth}</span></>}
                {d.movePenalty != null && d.movePenalty > 0 && <><br /><span className="stat-line">🐌 Speed: -{Math.round(d.movePenalty * 100)}%</span></>}
                {d.use && <><br /><span className="stat-line">✨ Click to use</span></>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Crafting ───────────────────────────────────────────────────────────── */
// Phase C: timed craft queue (weapons/dawnbreaker take real seconds with a
// progress bar + cancel), Shift-click batch for process recipes, station
// radius preview on hover, and vs-equipped compare lines.
function CraftingPanel(): JSX.Element {
  const [cat, setCat] = useState<string>('all');
  const [queue, setQueue] = useState<CraftQueueState | null>(null); // { id, name, total, done }
  const queueRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recipes = useGameState([CH.INVENTORY, CH.WORLD], () => {
    try { return recipesForUI(cat); } catch { return []; }
  }) as RecipeUI[];

  const clearQueue = (): void => {
    if (queueRef.current) clearInterval(queueRef.current);
    queueRef.current = null;
    setQueue(null);
  };
  useEffect(() => clearQueue, []);

  const finishQueued = (id: string): void => {
    clearQueue();
    const r: any = craft(id);
    if (!r.ok) GameState.toast({ title: 'Cannot craft', msg: r.reason, kind: 'warn', icon: undefined });
  };

  const doCraft = (r: RecipeUI, shiftKey: boolean): void => {
    if (queue) return; // one at a time — finish or cancel first
    if (r.cat === 'process' && shiftKey) {
      const res: any = craft(r.id, { batch: 5 });
      if (!res.ok) GameState.toast({ title: 'Cannot craft', msg: res.reason, kind: 'warn', icon: undefined });
      return;
    }
    // Slow crafts (>2s) run on a visible timer; cancel is free because
    // resources are only spent when the timer completes.
    if ((r.durSec || 0) >= 2) {
      const total: number = Math.max(1, Math.round((r.durSec ?? 0) * 1000));
      const started: number = Date.now();
      setQueue({ id: r.id, name: r.def?.name || r.id, total, done: 0 });
      queueRef.current = setInterval(() => {
        const done: number = Date.now() - started;
        if (done >= total) finishQueued(r.id);
        else setQueue({ id: r.id, name: r.def?.name || r.id, total, done });
      }, 80);
      return;
    }
    const res: any = craft(r.id);
    if (!res.ok) GameState.toast({ title: 'Cannot craft', msg: res.reason, kind: 'warn', icon: undefined });
  };

  const previewStation = (station: string | undefined): void => {
    if (station && uiSession.showStationRing) {
      try { uiSession.showStationRing(station); } catch { /* scene not ready */ }
    }
  };

  return (
    <div className="panel crafting-panel">
      <h2>Crafting</h2>
      {queue && (
        <div className="craft-queue">
          <span>⚒ {queue.name}… {Math.round((queue.done / queue.total) * 100)}%</span>
          <div className="craft-queue-bar"><div style={{ width: `${Math.min(100, (queue.done / queue.total) * 100)}%` }} /></div>
          <button className="craft-cancel" onClick={clearQueue}>Cancel</button>
        </div>
      )}
      <div className="recipe-tabs">
        {['all', 'survival', 'cooking', 'tools', 'weapons', 'armor', 'process', 'special'].map((c) => (
          <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="recipe-grid">
        {recipes.map((r) => {
          const affordable: boolean = !r.reason && !queue;
          return (
            <button
              key={r.id}
              className={`recipe ${affordable ? '' : 'locked'}`}
              onClick={(e) => doCraft(r, e.shiftKey)}
              onMouseEnter={() => previewStation(r.station)}
              disabled={!affordable}
              title={r.cat === 'process' ? 'Shift-click: craft ×5 batch' : undefined}
            >
              <Icon id={r.out} size={34} />
              <div className="recipe-body">
                <b>{r.def?.name}</b>
                {(r.durSec || 0) >= 2 && <span className="craft-time"> ⏱ {r.durSec}s</span>}
                <div className="recipe-cost">
                  {Object.entries(r.cost).map(([id, n]) => (
                    <span key={id} className={countItem(id) >= n ? 'have' : 'need'}>{getItem(id)?.name}×{n}</span>
                  ))}
                </div>
                {r.compare && r.compare.equippedId && (
                  <span className="compare-line">
                    vs equipped: <span className={(r.compare.dmgDelta ?? r.compare.armorDelta ?? 0) >= 0 ? 'have' : 'need'}>
                      {(r.compare.dmgDelta ?? r.compare.armorDelta ?? 0) >= 0 ? '+' : ''}
                      {r.compare.dmgDelta != null ? `${r.compare.dmgDelta} dmg` : `${r.compare.armorDelta} armor`}
                    </span>
                    {(r.compare.critDelta ?? 0) !== 0 && <span> {(r.compare.critDelta ?? 0) > 0 ? '+' : ''}{((r.compare.critDelta ?? 0) * 100).toFixed(0)}% crit</span>}
                  </span>
                )}
                {r.compare && !r.compare.equippedId && r.compare.note && (
                  <span className="compare-line">{r.compare.note} — pure upgrade</span>
                )}
                {r.reason && <em className="locked-reason">{r.reason}</em>}
              </div>
              <span className="craft-btn">⚒</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Skills ─────────────────────────────────────────────────────────────── */
function SkillsPanel(): JSX.Element {
  const [branch, setBranch] = useState<string>('survival');
  const data = useGameState([CH.PLAYER, CH.INVENTORY], () => ({
    sp: GameState.s?.player?.skillPoints,
    stPts: GameState.s?.player?.statPoints,
    skills: { ...GameState.s?.player?.skills },
    alloc: { ...GameState.s?.player?.alloc },
    level: GameState.s?.player?.level
  })) as { sp: number; stPts: number; skills: Record<string, number>; alloc: Record<string, number>; level?: number };
  const tree = SKILLS.filter((s: SkillDef) => s.branch === branch) as SkillDef[];
  const tSkill = (id: string, def?: unknown, sdata?: unknown): void => {
    if (!sdata) return;
    learnSkill(id);
    void def;
  };
  return (
    <div className="panel skills-panel">
      <h2>Skill Tree <span className="gold">✦ {data.sp} pts</span></h2>
      <div className="branch-tabs">
        {(BRANCHES as BranchDef[]).map((b) => (
          <button key={b.id} className={b.id === branch ? 'on' : ''} style={{ '--branch-c': b.color } as CSSProperties} onClick={() => setBranch(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="skill-list">
        {tree.map((s) => {
          const rank: number = data.skills[s.id] || 0;
          const locked: boolean = !!s.req && Object.entries(s.req).some(([rid, min]: [string, number]) => (data.skills[rid] || 0) < min);
          const maxed: boolean = rank >= s.maxRank;
          return (
            <button key={s.id} className={`skill ${maxed ? 'maxed' : ''} ${!maxed && (locked || data.sp <= 0) ? 'locked' : ''}`}
              onClick={() => !maxed && !locked && tSkill(s.id)}>
              <div className="skill-top">
                <b>{s.name}</b>
                <span className="skill-rank">{'◆'.repeat(rank)}<i>{'◇'.repeat(s.maxRank - rank)}</i></span>
              </div>
              <p>{s.desc}</p>
              {locked && <em className="locked-reason">Requires prerequisite skills</em>}
            </button>
          );
        })}
      </div>
      <h3>Attributes ({data.stPts} to spend)</h3>
      <div className="attr-row">
        {Object.entries(data.alloc).map(([key, v]: [string, number]) => (
          <button key={key} className="attr" onClick={() => spendStat(key)}>
            <b>{STAT_LABEL[key]}</b> <span>{v}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const STAT_LABEL: Record<string, string> = { strength: 'Might', defense: 'Vitality', agility: 'Agility', intellect: 'Intellect', willpower: 'Charisma' };

/* ── Build ──────────────────────────────────────────────────────────────── */
function BuildPanel(): JSX.Element {
  const [cat, setCat] = useState<string>('all');
  const data = useGameState([CH.SETTLEMENT, CH.INVENTORY], () => ({
    founded: GameState.s?.settlement?.founded,
    stage: GameState.s?.settlement?.stageIndex,
    citizens: GameState.s?.settlement?.citizens?.length,
    count: (k: string): number => GameState.s?.settlement?.buildings?.filter((b: { key?: string; complete?: boolean }) => b.key === k && b.complete).length || 0
  })) as { founded?: boolean; stage: number; citizens?: number; count: (k: string) => number };
  const catMap: Record<string, string[]> = {
    all: Object.keys(BUILDINGS),
    survival: ['campfire', 'tent'],
    residential: ['hut', 'house'],
    resource: ['storage_chest', 'farm', 'woodcutter', 'mine'],
    production: ['forge', 'tannery', 'kitchen', 'workshop'],
    military: ['watchtower', 'barracks', 'archery_range', 'stable', 'fortress'],
    defense: ['wall', 'gate'],
    government: ['townhall'],
    special: ['market', 'temple', 'library']
  };
  const list = (catMap[cat] || []).map((k: string) => BUILDINGS[k]) as BuildingDef[];

  const place = (key: string): void => {
    const def: any = getBuildingDef(key);
    if (def.requiresStage && data.stage < def.requiresStage) {
      GameState.toast({ title: def.label, msg: 'Your realm is not ready for this yet.', kind: 'warn', icon: undefined });
      return;
    }
    close();
    sceneCommand('placeBuild', key);
  };

  return (
    <div className="panel build-panel">
      <h2>Build</h2>
      <div className="recipe-tabs">
        {(BUILDING_CATS as string[]).map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="build-grid">
        {list.map((def) => {
          const have: number = data.count(def.key);
          const afford: boolean = Object.entries(def.cost).every(([id, n]: [string, number]) => countItem(id) >= n);
          return (
            <button key={def.key} className={`build-card ${afford ? '' : 'locked'}`} onClick={() => place(def.key)}>
              <b>{def.label}</b>
              <span className="build-cost">
                {Object.entries(def.cost).map(([id, n]: [string, number]) => (
                  <span key={id} className={countItem(id) >= n ? 'have' : 'need'}>{getItem(id)?.name}×{n}</span>
                ))}
              </span>
              <em>{def.desc}</em>
              {have > 0 && <span className="have-count">Owned: {have}</span>}
            </button>
          );
        })}
      </div>
      {!data.founded && <div className="build-hint">Found your realm: place a <b>Town Hall</b> using your Founder's Kit or by building one.</div>}
    </div>
  );
}

/* ── Kingdom ────────────────────────────────────────────────────────────── */
function KingdomPanel(): JSX.Element | null {
  const k = useGameState([CH.SETTLEMENT, CH.PLAYER, CH.FACTIONS, CH.INVENTORY], () => {
    const S: any = GameState.s;
    const K: any = uiSession.kingdom || {};
    const citizens: CitizenInfo[] = S?.settlement?.citizens || [];
    const req: any = (() => { try { return stageRequirementsMissing(); } catch { return {}; } })();
    const pct: number = (() => { try { return territoryPct(); } catch { return 0; } })();
    return { S, K, citizens, req, pct, mil: { ...S?.settlement?.military }, founded: S?.settlement?.founded };
  }) as { S: any; K: any; citizens: CitizenInfo[]; req: any; pct: number; mil: Record<string, number>; founded?: boolean } | null;
  if (!k || !k.S) return null;

  const stageName: string = ['Wanderer','Camp','Village','Town','City','Kingdom','Empire'][k.S.settlement.stageIndex + 1] ?? '';

  return (
    <div className="panel kingdom-panel">
      <div className="k-header">
        <h2>Your Realm — <span className="gold">{k.founded ? stageName : 'Unfounded'}</span></h2>
        {!k.founded && <p>Found a settlement to begin your kingdom. Build a Town Hall.</p>}
      </div>
      {k.founded && <>
        <div className="k-grid">
          <div className="k-stat">👥 <b>{k.S.settlement.citizens.length}</b> <em>People</em></div>
          <div className="k-stat">🍞 <b>{k.K.foodUnits ?? 0}</b> <em>Food ({k.K.foodDays ?? '—'} days)</em></div>
          <div className="k-stat">😊 <b>{k.S.settlement.happiness}</b> <em>Happiness</em></div>
          <div className="k-stat">🪙 <b>{k.S.player.gold}</b> <em>Gold</em></div>
          <div className="k-stat">🛡 <b>{k.K.defenseStructural ?? 0}</b> <em>Defense</em></div>
          <div className="k-stat">⚔ <b>{militaryPowerTotal()}</b> <em>Military</em></div>
          <div className="k-stat">🗺 <b>{k.pct}%</b> <em>Territory</em></div>
          <div className="k-stat">♛ <b>{k.S.player.reputation}</b> <em>Reputation</em></div>
        </div>

        {k.req && k.req.missing?.length > 0 && (
          <div className="stage-req">
            <h4>To next stage ({['','Village','Town','City','Kingdom','Empire','—'][k.S.settlement.stageIndex + 1]}):</h4>
            <ul>{k.req.missing.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
        <h3>Army</h3>
        <div className="army-row">
          {Object.keys(MILITARY_CONFIG.types).map((type) => {
            const cfg: any = MILITARY_CONFIG.types[type as keyof typeof MILITARY_CONFIG.types];
            const chk: any = canRecruitUnit(type);
            return (
              <button key={type} className="army-unit" onClick={() => recruitUnit(type)} disabled={!chk.ok}>
                <b>{type}</b>
                <span>{k.mil[type] || 0} · ⚔{cfg.power}</span>
                {!chk.ok && <em>{chk.reason}</em>}
              </button>
            );
          })}
        </div>
        <h3>People</h3>
        <div className="citizen-list">
          {k.citizens.map((c) => (
            <div key={c.uid} className="citizen">
              <b>{c.name}</b> <span>{c.role} · ♥{(c.skillLv ?? 1) * 10}</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
/* ── Map (live canvas: same shared renderer as the minimap) ── */
const MM_LEGEND: string[][] = Object.values(BIOMES).map((b: { grass: string; label: string }) => [b.grass, b.label]);

interface MapPanelData {
  pois: PoiInfo[];
  factions: FactionInfo[];
  owned: number;
  knownIds: string[];
  ownedIds: string[];
  pct: number;
  settlement: { x: number; y: number } | null;
  px: number;
  py: number;
  seed: number;
  explored: string[];
  buildings: { x: number; y: number }[];
}

function MapPanel(): JSX.Element {
  const waypoint = useGameState([CH.MINIMAP], () => GameState.session.waypoint ?? null);
  const data = useGameState([CH.WORLD, CH.SETTLEMENT, CH.FACTIONS], () => {
    const S: any = GameState.s;
    const known = new Set<string>(S?.world?.discoveredPois || []);
    const owned = new Set<string>(S?.world?.ownedCamps || []);
    const pois: PoiInfo[] = (allPois() as unknown as PoiInfo[]).filter((p: PoiInfo) => known.has(p.id) || owned.has(p.id));
    const factions: FactionInfo[] = Object.keys(FACTIONS).map((k: string) => ({ key: k, name: FACTIONS[k]?.name, status: statusOf(k) }));
    return {
      pois, factions, owned: owned.size,
      knownIds: [...known], ownedIds: [...owned],
      pct: (() => { try { return territoryPct(); } catch { return 0; } })(),
      settlement: S?.settlement?.founded ? { x: Math.round(S.settlement.pos?.x ?? 0), y: Math.round(S.settlement.pos?.y ?? 0) } : null,
      px: S?.world?.px ?? 0, py: S?.world?.py ?? 0,
      seed: S?.meta?.seed ?? 1,
      explored: [...(S?.world?.exploredChunks || [])],
      buildings: (S?.settlement?.buildings || []).filter((b: { complete?: boolean }) => b.complete).slice(0, 60).map((b: { x: number; y: number }) => ({ x: b.x, y: b.y })),
    };
  }) as MapPanelData;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Paint the live world map: shared terrain renderer + synced markers.
  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;
    try { setWorldSeed(data.seed); } catch { /* ignore */ }
    const LW = 520, LH = 300;
    if (canvas.width !== LW * 2) { canvas.width = LW * 2; canvas.height = LH * 2; }
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const cx: number = data.settlement?.x ?? data.px;
    const cy: number = data.settlement?.y ?? data.py;
    const viewRadius = MAP_VIEW_RADIUS;
    const explored = new Set<string>(data.explored);
    const bg: CanvasGradient = ctx.createLinearGradient(0, 0, 0, LH);
    bg.addColorStop(0, '#0d1322');
    bg.addColorStop(1, '#080c15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LW, LH);
    try {
      drawMapTerrain(ctx, {
        centerX: cx, centerY: cy, viewRadius, w: LW, h: LH,
        cell: 13, explored, chunkSize: 512, shimmer: 0,
      });
    } catch { /* terrain never blocks the panel */ }
    const X = (wx: number): number => ((wx - cx) / (viewRadius * 2) + 0.5) * LW;
    const Y = (wy: number): number => ((wy - cy) / (viewRadius * 2) + 0.5) * LH;
    const inView = (mx: number, my: number): boolean => mx >= 0 && mx <= LW && my >= 0 && my <= LH;
    // Buildings: tiny gold ticks.
    try {
      ctx.fillStyle = '#d8b64a';
      for (const b of data.buildings) {
        const mx = X(b.x), my = Y(b.y);
        if (inView(mx, my)) ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    } catch { /* ignore */ }
    // POIs with the shared shape language; off-view ones clamp to the edge.
    const owned = new Set<string>(data.ownedIds);
    try {
      for (const p of data.pois) {
        let mx = X(p.x), my = Y(p.y);
        const off = !inView(mx, my);
        mx = Math.max(10, Math.min(LW - 10, mx));
        my = Math.max(12, Math.min(LH - 10, my));
        const { shape, color }: { shape: string; color: string } = poiStyle(p as any, owned.has(p.id));
        ctx.globalAlpha = off ? 0.55 : 1;
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.2;
        if (shape === 'boss') {
          ctx.beginPath();
          ctx.moveTo(mx, my - 6); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 6); ctx.lineTo(mx - 6, my);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (shape === 'camp') {
          ctx.beginPath();
          ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 5, my + 4); ctx.lineTo(mx - 5, my + 4);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    } catch { /* ignore */ }
    // Settlement + player.
    try {
      if (data.settlement) {
        const mx = X(data.settlement.x), my = Y(data.settlement.y);
        if (inView(mx, my)) {
          ctx.fillStyle = '#ffd66b';
          ctx.fillRect(mx - 4, my - 1, 8, 6);
          ctx.beginPath();
          ctx.moveTo(mx - 5.5, my - 1); ctx.lineTo(mx, my - 7); ctx.lineTo(mx + 5.5, my - 1);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
      const ux = X(data.px), uy = Y(data.py);
      if (inView(ux, uy)) {
        ctx.fillStyle = '#44ff88';
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ux, uy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } catch { /* ignore */ }
    if (waypoint) {
      const mx = Math.max(10, Math.min(LW - 10, X(waypoint.x)));
      const my = Math.max(25, Math.min(LH - 10, Y(waypoint.y)));
      ctx.save(); ctx.strokeStyle = '#7ee8ef'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(X(data.px), Y(data.py)); ctx.lineTo(mx, my); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = '#122c38';
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', mx, my);
      ctx.restore();
    }
    // Compass + vignette.
    ctx.fillStyle = '#e8c94b';
    ctx.font = 'bold 13px serif';
    ctx.fillText('N', 10, 19);
    const vg: CanvasGradient = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.42, LW / 2, LH / 2, Math.max(LW, LH) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, LW, LH);
  }, [data, waypoint]);
  return (
    <div className="panel map-panel">
      <h2>World Map</h2>
      <p className="map-note">Click the map to chart your next destination, or track a discovered location below.</p>
      <canvas ref={canvasRef} className="worldmap-canvas" width="1040" height="600" aria-label="World map: click to set waypoint" onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const point = mapPoint((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height,
          data.settlement?.x ?? data.px, data.settlement?.y ?? data.py);
        setWaypoint(point.x, point.y);
      }} />
      <div className="map-navigation-actions">
        {waypoint && <><span>✦ {waypoint.label} · {waypoint.x}, {waypoint.y}</span><button onClick={clearWaypoint}>Clear waypoint</button></>}
        {data.settlement && <button onClick={() => setWaypoint(data.settlement!.x, data.settlement!.y, 'Home')}>⌂ Track home</button>}
      </div>
      <div className="map-stats">
        <span>🗺 Territory: <b>{data.pct}%</b></span>
        <span>🏕 Camps held: <b>{data.owned}</b></span>
        {data.settlement && <span>🏠 Home: <b>{data.settlement.x}, {data.settlement.y}</b></span>}
      </div>
      <h3>Discovered ({data.pois.length})</h3>
      <div className="poi-list">
        {data.pois.length === 0 && <em>Explore to reveal the realm…</em>}
        {data.pois.map((p) => <div key={p.id} className="poi-row"><b>{p.name || p.id}</b> <span>{Math.round(p.x)}, {Math.round(p.y)}</span><button onClick={() => setWaypoint(p.x, p.y, p.name || p.id)} aria-label={`Track ${p.name || p.id}`}>Track</button></div>)}
      </div>
      <h3>Factions</h3>
      <div className="poi-list">
        {data.factions.map((f) => <div key={f.key} className="poi-row"><b>{f.name}</b> <span>{f.status}</span></div>)}
      </div>
      <h3>Legend</h3>
      <div className="mm-legend">
        {MM_LEGEND.map(([c, n]) => <span key={n}><i style={{ background: c }} />{n}</span>)}
        <span><i style={{ background: '#44ff88', borderRadius: '50%' }} />You</span>
        <span><i style={{ background: '#ff6b5a', transform: 'rotate(45deg)' }} />Boss</span>
        <span><i style={{ background: '#ff9a4a' }} />Bandit camp</span>
        <span><i style={{ background: '#7ae0ff', borderRadius: '50%' }} />Friend</span>
        <span><i style={{ background: '#ffd66b' }} />Held camp / home</span>
      </div>
      <p className="map-note">Dark regions are unexplored — the map fills in as you travel.</p>
    </div>
  );
}

/* ── Journal ──────────────────────────────────────────────────────────── */
function JournalPanel(): JSX.Element {
  const snap = useGameState([CH.QUESTS, CH.STORY], (): JournalSnapshot => {
    try { return questStateSnapshot() as JournalSnapshot; } catch { return { none: true } as JournalSnapshot; }
  }) as JournalSnapshot;
  if (snap.none) return <div className="panel journal-panel"><h2>Journal</h2><em>No active quest.</em></div>;
  return (
    <div className="panel journal-panel">
      <h2>Journal</h2>
      <div className="quest-main">
        <b>{snap.chapter ? `Ch. ${snap.chapter} — ` : ''}{snap.title}</b>
        <ul>{snap.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}>{s.done ? '✓' : '○'} {s.text} ({s.have}/{s.need})</li>)}</ul>
      </div>
      {(snap.side?.length ?? 0) > 0 && (<><h3>Side quests</h3>
        {(snap.side ?? []).map((q) => (
          <div key={q.id} className="quest-main"><b>{q.title}</b>
            <ul>{q.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}>{s.done ? '✓' : '○'} {s.text} ({s.have}/{s.need})</li>)}</ul>
          </div>
        ))}
      </>)}
    </div>
  );
}

/* ── Character ────────────────────────────────────────────────────────── */
interface CharacterSnapshot {
  name: string;
  level: number;
  xp: number;
  xpNext: number;
  statPoints: number;
  gold: number;
  reputation: number;
  hp: number;
  maxHp?: number;
  stamina: number;
  maxStamina?: number;
  alloc: Record<string, number>;
  profs: { k: string; lv: number }[];
  dmg: number;
  redux: number;
  eq: Record<string, EquippedItem | undefined>;
}

function CharacterPanel(): JSX.Element | null {
  const c = useGameState([CH.PLAYER, CH.EQUIPMENT], () => {
    const p: any = GameState.s?.player;
    if (!p) return null;
    return {
      name: p.name, level: p.level, xp: p.xp, xpNext: xpToNext(p.level),
      statPoints: p.statPoints ?? 0,
      gold: p.gold, reputation: p.reputation,
      hp: Math.round(p.hp), maxHp: p.derived?.maxHp, stamina: Math.round(p.stamina), maxStamina: p.derived?.maxStamina,
      alloc: { ...p.alloc }, profs: Object.entries(p.professions || {}).map(([k, v]: [string, any]) => ({ k, lv: v?.lv ?? v ?? 1 })),
      dmg: Math.round((p.derived?.meleeDmgMult || 1) * 100), redux: Math.round((p.derived?.damageReduction || 0) * 100),
      eq: { ...p.equipment },
    };
  }) as CharacterSnapshot | null;
  if (!c) return null;

  const handleUnequip = (slot: string): void => {
    unequip(slot);
    import('../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
    import('../../game/main.ts').then((m: any) => m.worldScene()?.refreshPlayerSkin?.());
  };

  return (
    <div className="panel character-panel">
      <h2>{c.name} <span className="gold">Lv {c.level}</span></h2>
      <div style={{ margin: '4px 0 10px', fontSize: '12px', color: '#9fb4cc' }}>
        Experience: <b>{c.xp}</b> / <b>{c.xpNext}</b> XP
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden', marginTop: 4 }}>
          <div style={{ background: '#ffd66b', height: '100%', width: `${Math.min(100, Math.round((c.xp / (c.xpNext || 1)) * 100))}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>
      <div className="k-grid">
        <div className="k-stat">❤ <b>{c.hp}/{c.maxHp}</b> <em>Health</em></div>
        <div className="k-stat">⚡ <b>{c.stamina}/{c.maxStamina}</b> <em>Stamina</em></div>
        <div className="k-stat">🪙 <b>{c.gold}</b> <em>Gold</em></div>
        <div className="k-stat">♛ <b>{c.reputation}</b> <em>Renown</em></div>
        <div className="k-stat">⚔ <b>{c.dmg}%</b> <em>Melee</em></div>
        <div className="k-stat">🛡 <b>{c.redux}%</b> <em>Resist</em></div>
      </div>
      <h3>Equipped Gear</h3>
      <div className="equip-strip" style={{ marginBottom: 12 }}>
        {['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet'].map((slot) => {
          const eq: EquippedItem | undefined = c.eq[slot];
          const def: any = eq ? getItem(eq.id) : null;
          return (
            <button key={slot} className="eq-slot" onClick={() => eq && handleUnequip(slot)} title={eq ? `Click to unequip ${def?.name || slot}` : slot}>
              <span className="eq-slot-label">{slot.slice(0, 3).toUpperCase()}</span>
              {def && eq ? <Icon id={eq.id} size={30} /> : <span className="eq-empty">—</span>}
              {def && (
                <span className="drop-hover">
                  <b className="rn">{def.name}</b><br />
                  <span className="rd">{RARITY[def.rarity]?.label || 'Common'}</span>
                  {def.weapon && <><br /><span className="stat-line">⚔ {def.weapon.damage} dmg</span></>}
                  {def.armor != null && def.armor > 0 && <><br /><span className="stat-line">🛡 +{def.armor} armor</span></>}
                  {def.shieldBlock && <><br /><span className="stat-line">🛡 {Math.round(def.shieldBlock * 100)}% block</span></>}
                  <br /><span style={{ fontSize: '10px', color: '#ffb3b3' }}>Click to unequip</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <h3>Attributes {c.statPoints > 0 && <span className="gold">({c.statPoints} unspent points)</span>}</h3>
      <div className="attr-row">
        {Object.entries(c.alloc).map(([k, v]: [string, number]) => (
          <span key={k} className="attr" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <b>{k}</b> <span>{v}</span>
            {c.statPoints > 0 && (
              <button
                className="btn"
                style={{ padding: '2px 7px', fontSize: '11px', lineHeight: 1, minWidth: 'auto', background: '#3b5478', border: '1px solid #6b8bb8' }}
                onClick={() => {
                  spendStat(k);
                  import('../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
                }}
                title={`Increase ${k}`}
              >+</button>
            )}
          </span>
        ))}
      </div>
      <h3>Professions</h3>
      <div className="attr-row">{c.profs.map((p) => <span key={p.k} className="attr"><b>{p.k}</b> <span>Lv {p.lv}</span></span>)}</div>
    </div>
  );
}

/* ── Trade ────────────────────────────────────────────────────────────── */
function TradePanel(): JSX.Element {
  const npc: any = uiSession.tradeNpc;
  const data = useGameState([CH.INVENTORY, CH.PLAYER], () => {
    const S: any = GameState.s;
    let biomeId = 'forest';
    try { biomeId = biomeAt(S.world.px, S.world.py); } catch { /* default */ }
    const ctx: any = makeContext({ biomeId, marketTier: S.settlement?.stageIndex || 0 });
    const stock: TradeOffer[] = merchantStock(ctx);
    const sellable: InventoryEntry[] = (S.inventory || []).filter((e: InventoryEntry) => {
      const d: any = getItem(e.id);
      return d && d.value > 0 && (d.cat === 'resource' || d.cat === 'consumable');
    });
    return { stock, sellable, gold: S.player.gold, ctx };
  }) as { stock: TradeOffer[]; sellable: InventoryEntry[]; gold: number; ctx: PriceContext };
  const doBuy = (s: TradeOffer): void => {
    buyOffer(s); // service owns gold math + failure toast
  };
  const doSell = (e: InventoryEntry): void => {
    sellUnit(e.id, data.ctx); // service owns pricing + gold + toast
  };
  return (
    <div className="panel trade-panel">
      <h2>Trade {npc?.key ? <span className="gold">· {npc.key}</span> : null} <span className="gold">🪙 {data.gold}</span></h2>
      <h3>Merchant stock</h3>
      <div className="recipe-grid">
        {data.stock.length === 0 && <em>Nothing in stock.</em>}
        {data.stock.map((s) => (
          <button key={s.id} className="recipe" onClick={() => doBuy(s)} disabled={data.gold < s.buy}>
            <Icon id={s.id} size={30} />
            <div className="recipe-body"><b>{getItem(s.id)?.name}</b><div className="recipe-cost"><span>🪙 {s.buy}</span></div></div>
          </button>
        ))}
      </div>
      <h3>Sell yours</h3>
      <div className="recipe-grid">
        {data.sellable.length === 0 && <em>Nothing worth selling.</em>}
        {data.sellable.map((e) => (
          <button key={e.iid || e.id} className="recipe" onClick={() => doSell(e)}>
            <Icon id={e.id} size={30} />
            <div className="recipe-body"><b>{getItem(e.id)?.name}×{e.qty}</b></div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Pause ────────────────────────────────────────────────────────────── */
function PausePanel(): JSX.Element {
  const go = (name: string): void => sceneCommand('togglePanel', name);
  const quit = (): void => {
    GameState.session.uiPanel = null;
    GameState.session.paused = false;
        import('../../game/main.ts').then((m: any) => m.setScreen('menu'));
  };
  const saveNow = (): void => {
    saveToSlot('auto', GameState.s);
    GameState.toast({ title: 'Game saved', msg: 'Progress secured.', dur: 1800, icon: undefined });
  };
  return (
    <div className="panel pause-panel">
      <h2>Paused</h2>
      <div className="pause-grid">
        <button className="btn btn-menu" onClick={close}>RESUME</button>
        <button className="btn btn-menu" onClick={() => go('inventory')}>INVENTORY</button>
        <button className="btn btn-menu" onClick={() => go('crafting')}>CRAFTING</button>
        <button className="btn btn-menu" onClick={() => go('journal')}>JOURNAL</button>
        <button className="btn btn-menu" onClick={() => go('map')}>MAP</button>
        <button className="btn btn-menu" onClick={() => go('skills')}>SKILLS</button>
        <button className="btn btn-menu" onClick={() => go('kingdom')}>KINGDOM</button>
        <button className="btn btn-menu" onClick={() => go('character')}>CHARACTER</button>
        <button className="btn btn-menu" onClick={() => go('save')}>SAVE / LOAD</button>
        <button className="btn btn-menu" onClick={saveNow}>QUICK SAVE</button>
        <button className="btn btn-menu" onClick={quit}>QUIT TO MENU</button>
      </div>
    </div>
  );
}

/* ── Save / Load + export / import ────────────────────────────────────── */
function SavePanel(): JSX.Element {
  const [saves, setSaves] = useState<Record<string, SaveSummary | undefined>>(() => listSaves() as Record<string, SaveSummary | undefined>);
  const refresh = (): void => setSaves(listSaves() as Record<string, SaveSummary | undefined>);
  const doSave = (slot: string): void => { saveToSlot(slot, GameState.s); refresh(); };
  const doLoad = (slot: string): void => {
    const data: any = loadFromSlot(slot);
        if (data) import('../../game/main.ts').then((m: any) => m.loadGameIntoWorld(data));
    else refresh();
  };
  const doExport = (slot: string): void => {
    const r: any = exportSlot(slot);
    if (!r.ok) { GameState.toast({ title: 'Export failed', msg: r.msg, kind: 'warn', icon: undefined }); return; }
    const blob = new Blob([r.json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rise-of-the-realm-${slot}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const doImport = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      const r: any = importSlotData(String(reader.result || ''), 'slot1');
      GameState.toast(r.ok
        ? { title: 'Save imported', msg: 'Loaded into Slot 1.', kind: 'quest', icon: undefined }
        : { title: 'Import failed', msg: r.msg, kind: 'warn', icon: undefined });
      refresh();
    };
    reader.readAsText(file);
  };
  return (
    <div className="panel save-panel">
      <h2>Save / Load</h2>
      {['auto', 'slot1', 'slot2', 'slot3'].map((slot) => {
        const s = saves[slot];
        return (
          <div key={slot} className="save-row">
            <div className="save-meta">
              <b>{slot}</b> {s ? <span>· {s.name} · Lv {s.level} · Day {s.day}</span> : <em>Empty</em>}
            </div>
            <div className="save-actions">
              {slot !== 'auto' && <button onClick={() => doSave(slot)}>Save</button>}
              <button onClick={() => doLoad(slot)} disabled={!s}>Load</button>
              <button onClick={() => doExport(slot)} disabled={!s}>Export</button>
              {slot !== 'auto' && <button onClick={() => { deleteSlot(slot); refresh(); }} disabled={!s}>✕</button>}
            </div>
          </div>
        );
      })}
      <label className="import-row">Import save file (→ Slot 1):
        <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); }} />
      </label>
    </div>
  );
}
// ==PANELS_D==
