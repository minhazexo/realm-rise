// Central panel hub (spec §39–43): inventory/crafting/skills/build/kingdom/map/
// journal/character/save/trade/pause. Each panel bridges to live systems.
import React, { useMemo, useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getItem, RARITY } from '../../game/data/items.js';
import { iconDataURLs } from '../../game/assets/icons.js';
import { sortedInventory, equip, unequip, countItem, addItem, removeItem, useConsumable } from '../../game/systems/InventorySystem.js';
import { recipesForUI, craft } from '../../game/systems/CraftingSystem.js';
import { BRANCHES, SKILLS } from '../../game/data/skills.js';
import { spendStat, learnSkill } from '../../game/systems/ProgressionSystem.js';
import { BUILDINGS, BUILDING_CATS, getBuildingDef } from '../../game/data/buildings.js';
import { allPois } from '../../game/world/worldGen.js';
import { stageRequirementsMissing, territoryPct, refresh as kingdomRefresh, militaryPowerTotal } from '../../game/systems/KingdomSystem.js';
import { canRecruitUnit, recruitUnit } from '../../game/systems/KingdomEconomy.js';
import { saveToSlot, listSaves, loadFromSlot, deleteSlot, exportSlot, importSlotData } from '../../game/systems/SaveSystem.js';
import { merchantStock, makeContext } from '../../game/systems/EconomySystem.js';
import { biomeAt } from '../../game/world/worldGen.js';
import { statusOf } from '../../game/systems/FactionSystem.js';
import { FACTIONS } from '../../game/data/factions.js';
import { sceneCommand } from '../../game/main.js';
import { questStateSnapshot } from '../../game/systems/QuestSystem.js';
import { MILITARY_CONFIG, SETTLEMENT_CONFIG } from '../../game/core/Constants.js';

export default function Panels({ panel }) {
  const key = panel;
  if (!key) return null;
  return (
    <div className="panel-layer">
      {key === 'inventory' && <InventoryPanel />}
      {key === 'crafting' && <CraftingPanel />}
      {key === 'skills' && <SkillsPanel />}
      {key === 'build' && <BuildPanel />}
      {key === 'kingdom' && <KingdomPanel />}
      {key === 'map' && <MapPanel />}
      {key === 'journal' && <JournalPanel />}
      {key === 'character' && <CharacterPanel />}
      {key === 'save' && <SavePanel />}
      {key === 'trade' && <TradePanel />}
      {key === 'pause' && <PausePanel />}
      <button className="panel-close" onClick={() => { GameState.session.uiPanel = null; GameState.session.paused = false; import('../../game/core/EventBus.js').then(({ Bus }) => Bus.emit('play-sound', 'ui_click')); GameState.notify(CH.SCREEN); }}>✕</button>
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────── */

function Icon({ id, size = 34 }) {
  const url = iconDataURLs[id];
  return url
    ? <img className="inv-icon" src={url} width={size} height={size} style={{ width: size, height: size }} alt={getItem(id)?.name || id} />
    : <span className="inv-icon text" style={{ width: size, height: size }}>?</span>;
}

function close() {
  GameState.session.uiPanel = null;
  GameState.session.paused = false;
  GameState.notify(CH.SCREEN);
}

/* ── Inventory ─────────────────────────────────────────────────────────── */
function InventoryPanel() {
  const [sort, setSort] = useState('rarity');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const inv = useGameState([CH.INVENTORY, CH.EQUIPMENT, CH.SETTLEMENT], () => ({
    list: sortedInventory(sort, cat, q),
    eq: { ...GameState.s?.player?.equipment },
    gold: GameState.s?.player?.gold
  }));
  const R = RARITY;

  const handleClick = (e) => {
    const ref = e.iid || e.id;
    if (e.qty === undefined) {
      // stacked resource/consumable — use if consumable else info toast
      const d = getItem(e.id);
      if (d?.use) {
        const u = useConsumable(e.id, GameState.s.player.derived.healPower);
        import('../../game/main.js').then((m) => m.worldScene()?.player?.applyConsumableEffects?.(u));
        if (d.id === 'treasure_map') import('../../game/systems/QuestEngine.js').then((q2) => q2.handleEvent({ type: 'useItem', itemId: 'treasure_map' }));
        return;
      }
    }
    // gear → equip (equip() itself validates the entry exists)
    import('../../game/systems/InventorySystem.js').then((I) => {
      I.equip(ref);
    });
    import('../../game/systems/ProgressionSystem.js').then((P) => P.recompute());
    import('../../game/main.js').then((m) => m.worldScene()?.refreshPlayerSkin?.());
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
          const eq = inv.eq[slot];
          const def = eq ? getItem(eq.id) : null;
          return (
            <button key={slot} className="eq-slot" onClick={() => eq && unequip(slot)}>
              <span className="eq-slot-label">{slot.slice(0, 3).toUpperCase()}</span>
              {def ? <Icon id={eq.id} size={30} /> : <span className="eq-empty">—</span>}
              {def && (
                <span className="drop-hover">
                  <b className="rn">{def.name}</b><br />
                  <span className="rd">{RARITY[def.rarity]?.label || 'Common'}</span>
                  {def.weapon && <><br /><span className="stat-line">⚔ {def.weapon.damage} dmg</span></>}
                  {def.armor != null && def.armor > 0 && <><br /><span className="stat-line">🛡 +{def.armor} armor</span></>}
                  {def.shieldBlock && <><br /><span className="stat-line">🛡 {Math.round(def.shieldBlock * 100)}% block</span></>}
                  {eq.dur != null && <><br /><span className="stat-line">♻ {eq.dur}/{def.durability}</span></>}
                  {def.desc && <><br /><span>{def.desc}</span></>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid">
        {inv.list.map((e) => {
          const d = getItem(e.id);
          const isGear = !!(e.iid || d?.durability || d?.weapon || d?.slot);
          return (
            <button key={e.iid || e.id} className="cell" style={{ '--rar': R[d.rarity].color }} onClick={() => handleClick(e)} title={d.name}>
              <Icon id={e.id} size={32} />
              {e.qty > 1 && <span className="qty">{e.qty}</span>}
              {isGear && (
                <span
                  className="salvage-btn"
                  title="Salvage for 50% materials (needs forge nearby)"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    import('../../game/systems/CraftingSystem.js').then((C) => {
                      const r = C.salvage(e.iid || e.id);
                      GameState.toast(r.ok
                        ? { title: `Salvaged ${d.name}`, msg: Object.entries(r.refund || {}).map(([id, n]) => `${getItem(id)?.name}×${n}`).join(', ') || 'Scrap.', kind: 'craft' }
                        : { title: 'Cannot salvage', msg: r.reason, kind: 'warn' });
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
function CraftingPanel() {
  const [cat, setCat] = useState('all');
  const [queue, setQueue] = useState(null); // { id, name, total, done }
  const queueRef = React.useRef(null);
  const recipes = useGameState([CH.INVENTORY, CH.WORLD], () => {
    try { return recipesForUI(cat); } catch { return []; }
  });

  const clearQueue = () => {
    if (queueRef.current) clearInterval(queueRef.current);
    queueRef.current = null;
    setQueue(null);
  };
  React.useEffect(() => clearQueue, []);

  const finishQueued = (id) => {
    clearQueue();
    const r = craft(id);
    if (!r.ok) GameState.toast({ title: 'Cannot craft', msg: r.reason, kind: 'warn' });
  };

  const doCraft = (r, shiftKey) => {
    if (queue) return; // one at a time — finish or cancel first
    if (r.cat === 'process' && shiftKey) {
      const res = craft(r.id, { batch: 5 });
      if (!res.ok) GameState.toast({ title: 'Cannot craft', msg: res.reason, kind: 'warn' });
      return;
    }
    // Slow crafts (>2s) run on a visible timer; cancel is free because
    // resources are only spent when the timer completes.
    if ((r.durSec || 0) >= 2) {
      const total = Math.max(1, Math.round(r.durSec * 1000));
      const started = Date.now();
      setQueue({ id: r.id, name: r.def?.name || r.id, total, done: 0 });
      queueRef.current = setInterval(() => {
        const done = Date.now() - started;
        if (done >= total) finishQueued(r.id);
        else setQueue({ id: r.id, name: r.def?.name || r.id, total, done });
      }, 80);
      return;
    }
    const res = craft(r.id);
    if (!res.ok) GameState.toast({ title: 'Cannot craft', msg: res.reason, kind: 'warn' });
  };

  const previewStation = (station) => {
    if (station && GameState.session.showStationRing) {
      try { GameState.session.showStationRing(station); } catch { /* scene not ready */ }
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
          const affordable = !r.reason && !queue;
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
                {r.compare && r.compare.dmgDelta != null && r.compare.equippedId && (
                  <span className="compare-line">
                    vs equipped: <span className={r.compare.dmgDelta >= 0 ? 'have' : 'need'}>
                      {r.compare.dmgDelta >= 0 ? '+' : ''}{r.compare.dmgDelta} dmg
                    </span>
                    {r.compare.critDelta !== 0 && <span> {r.compare.critDelta > 0 ? '+' : ''}{(r.compare.critDelta * 100).toFixed(0)}% crit</span>}
                  </span>
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
function SkillsPanel() {
  const [branch, setBranch] = useState('survival');
  const data = useGameState([CH.PLAYER, CH.INVENTORY], () => ({
    sp: GameState.s?.player?.skillPoints,
    stPts: GameState.s?.player?.statPoints,
    skills: { ...GameState.s?.player?.skills },
    alloc: { ...GameState.s?.player?.alloc },
    level: GameState.s?.player?.level
  }));
  const tree = SKILLS.filter((s) => s.branch === branch);
  const tSkill = (id, def, data) => {
    if (!data) return;
    learnSkill(id);
  };
  return (
    <div className="panel skills-panel">
      <h2>Skill Tree <span className="gold">✦ {data.sp} pts</span></h2>
      <div className="branch-tabs">
        {BRANCHES.map((b) => (
          <button key={b.id} className={b.id === branch ? 'on' : ''} style={{ '--branch-c': b.color }} onClick={() => setBranch(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="skill-list">
        {tree.map((s) => {
          const rank = data.skills[s.id] || 0;
          const locked = s.req && Object.entries(s.req).some(([rid, min]) => (data.skills[rid] || 0) < min);
          const maxed = rank >= s.maxRank;
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
        {Object.entries(data.alloc).map(([key, v]) => (
          <button key={key} className="attr" onClick={() => spendStat(key)}>
            <b>{STAT_LABEL[key]}</b> <span>{v}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const STAT_LABEL = { strength: 'Might', defense: 'Vitality', agility: 'Agility', intellect: 'Intellect', willpower: 'Charisma' };

/* ── Build ──────────────────────────────────────────────────────────────── */
function BuildPanel() {
  const [cat, setCat] = useState('all');
  const data = useGameState([CH.SETTLEMENT, CH.INVENTORY], () => ({
    founded: GameState.s?.settlement?.founded,
    stage: GameState.s?.settlement?.stageIndex,
    citizens: GameState.s?.settlement?.citizens?.length,
    count: (k) => GameState.s?.settlement?.buildings?.filter((b) => b.key === k && b.complete).length || 0
  }));
  const catMap = {
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
  const list = (catMap[cat] || []).map((k) => BUILDINGS[k]);

  const place = (key) => {
    const def = getBuildingDef(key);
    if (def.requiresStage && data.stage < def.requiresStage) {
      GameState.toast({ title: def.label, msg: 'Your realm is not ready for this yet.', kind: 'warn' });
      return;
    }
    close();
    sceneCommand('placeBuild', key);
  };

  return (
    <div className="panel build-panel">
      <h2>Build</h2>
      <div className="recipe-tabs">
        {BUILDING_CATS.map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="build-grid">
        {list.map((def) => {
          const have = data.count(def.key);
          const afford = Object.entries(def.cost).every(([id, n]) => countItem(id) >= n);
          return (
            <button key={def.key} className={`build-card ${afford ? '' : 'locked'}`} onClick={() => place(def.key)}>
              <b>{def.label}</b>
              <span className="build-cost">
                {Object.entries(def.cost).map(([id, n]) => (
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
function KingdomPanel() {
  const k = useGameState([CH.SETTLEMENT, CH.PLAYER, CH.FACTIONS, CH.INVENTORY], () => {
    const S = GameState.s;
    const K = GameState.session.kingdom || {};
    const citizens = S?.settlement?.citizens || [];
    const req = (() => { try { return stageRequirementsMissing(); } catch { return {}; } })();
    const pct = (() => { try { return territoryPct(); } catch { return 0; } })();
    return { S, K, citizens, req, pct, mil: { ...S?.settlement?.military }, founded: S?.settlement?.founded };
  });
  if (!k.S) return null;

  const stageName = ['Wanderer','Camp','Village','Town','City','Kingdom','Empire'][k.S.settlement.stageIndex + 1];

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
            <ul>{k.req.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
        <h3>Army</h3>
        <div className="army-row">
          {Object.keys(MILITARY_CONFIG.types).map((type) => {
            const cfg = MILITARY_CONFIG.types[type];
            const chk = canRecruitUnit(type);
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
/* ── Map (Phase D: was referenced but never defined — crashed on open) ── */
const MM_LEGEND = [
  ['#6a8a3a', 'Plains'], ['#2d5a2d', 'Forest'], ['#c4a65a', 'Desert'],
  ['#b8d4e8', 'Frozen'], ['#4a6a3a', 'Swamp'], ['#7a7a7a', 'Mountains'],
  ['#8a3a1a', 'Volcanic'], ['#3a6b8a', 'Riverlands'],
];
function MapPanel() {
  const data = useGameState([CH.WORLD, CH.SETTLEMENT, CH.FACTIONS], () => {
    const S = GameState.s;
    const known = new Set(S?.world?.discoveredPois || []);
    const owned = new Set(S?.world?.ownedCamps || []);
    const pois = allPois().filter((p) => known.has(p.id) || owned.has(p.id));
    const factions = Object.keys(FACTIONS).map((k) => ({ key: k, name: FACTIONS[k].name, status: statusOf(k) }));
    return {
      pois, factions, owned: owned.size,
      pct: (() => { try { return territoryPct(); } catch { return 0; } })(),
      settlement: S?.settlement?.founded ? { x: Math.round(S.settlement.pos?.x ?? 0), y: Math.round(S.settlement.pos?.y ?? 0) } : null,
    };
  });
  return (
    <div className="panel map-panel">
      <h2>World Map</h2>
      <div className="map-stats">
        <span>🗺 Territory: <b>{data.pct}%</b></span>
        <span>🏕 Camps held: <b>{data.owned}</b></span>
        {data.settlement && <span>🏠 Home: <b>{data.settlement.x}, {data.settlement.y}</b></span>}
      </div>
      <h3>Discovered ({data.pois.length})</h3>
      <div className="poi-list">
        {data.pois.length === 0 && <em>Explore to reveal the realm…</em>}
        {data.pois.map((p) => <div key={p.id} className="poi-row"><b>{p.name || p.id}</b> <span>{Math.round(p.x)}, {Math.round(p.y)}</span></div>)}
      </div>
      <h3>Factions</h3>
      <div className="poi-list">
        {data.factions.map((f) => <div key={f.key} className="poi-row"><b>{f.name}</b> <span>{f.status}</span></div>)}
      </div>
      <h3>Legend</h3>
      <div className="mm-legend">
        {MM_LEGEND.map(([c, n]) => <span key={n}><i style={{ background: c }} />{n}</span>)}
        <span><i style={{ background: '#44ff88' }} />You</span>
        <span><i style={{ background: '#cc3333' }} />Enemy</span>
        <span><i style={{ background: '#ffd66b' }} />Held camp</span>
      </div>
    </div>
  );
}

/* ── Journal ──────────────────────────────────────────────────────────── */
function JournalPanel() {
  const snap = useGameState([CH.QUESTS, CH.STORY], () => {
    try { return questStateSnapshot(); } catch { return { none: true }; }
  });
  if (snap.none) return <div className="panel journal-panel"><h2>Journal</h2><em>No active quest.</em></div>;
  return (
    <div className="panel journal-panel">
      <h2>Journal</h2>
      <div className="quest-main">
        <b>{snap.chapter ? `Ch. ${snap.chapter} — ` : ''}{snap.title}</b>
        <ul>{snap.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}>{s.done ? '✓' : '○'} {s.text} ({s.have}/{s.need})</li>)}</ul>
      </div>
      {snap.side?.length > 0 && (<><h3>Side quests</h3>
        {snap.side.map((q) => (
          <div key={q.id} className="quest-main"><b>{q.title}</b>
            <ul>{q.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}>{s.done ? '✓' : '○'} {s.text} ({s.have}/{s.need})</li>)}</ul>
          </div>
        ))}
      </>)}
    </div>
  );
}

/* ── Character ────────────────────────────────────────────────────────── */
function CharacterPanel() {
  const c = useGameState([CH.PLAYER], () => {
    const p = GameState.s?.player;
    if (!p) return null;
    return {
      name: p.name, level: p.level, xp: p.xp, gold: p.gold, reputation: p.reputation,
      hp: Math.round(p.hp), maxHp: p.derived?.maxHp, stamina: Math.round(p.stamina), maxStamina: p.derived?.maxStamina,
      alloc: { ...p.alloc }, profs: Object.entries(p.professions || {}).map(([k, v]) => ({ k, lv: v?.lv ?? v ?? 1 })),
      dmg: Math.round((p.derived?.meleeDmgMult || 1) * 100), redux: Math.round((p.derived?.damageReduction || 0) * 100),
    };
  });
  if (!c) return null;
  return (
    <div className="panel character-panel">
      <h2>{c.name} <span className="gold">Lv {c.level}</span></h2>
      <div className="k-grid">
        <div className="k-stat">❤ <b>{c.hp}/{c.maxHp}</b> <em>Health</em></div>
        <div className="k-stat">⚡ <b>{c.stamina}/{c.maxStamina}</b> <em>Stamina</em></div>
        <div className="k-stat">🪙 <b>{c.gold}</b> <em>Gold</em></div>
        <div className="k-stat">♛ <b>{c.reputation}</b> <em>Renown</em></div>
        <div className="k-stat">⚔ <b>{c.dmg}%</b> <em>Melee</em></div>
        <div className="k-stat">🛡 <b>{c.redux}%</b> <em>Resist</em></div>
      </div>
      <h3>Attributes</h3>
      <div className="attr-row">{Object.entries(c.alloc).map(([k, v]) => <span key={k} className="attr"><b>{k}</b> <span>{v}</span></span>)}</div>
      <h3>Professions</h3>
      <div className="attr-row">{c.profs.map((p) => <span key={p.k} className="attr"><b>{p.k}</b> <span>Lv {p.lv}</span></span>)}</div>
    </div>
  );
}

/* ── Trade ────────────────────────────────────────────────────────────── */
function TradePanel() {
  const npc = GameState.session.tradeNpc;
  const data = useGameState([CH.INVENTORY, CH.PLAYER], () => {
    const S = GameState.s;
    let biomeId = 'forest';
    try { biomeId = biomeAt(S.world.px, S.world.py); } catch { /* default */ }
    const ctx = makeContext({ biomeId, marketTier: S.settlement?.stageIndex || 0 });
    const stock = merchantStock(ctx);
    const sellable = (S.inventory || []).filter((e) => {
      const d = getItem(e.id);
      return d && d.value > 0 && (d.cat === 'resource' || d.cat === 'consumable');
    });
    return { stock, sellable, gold: S.player.gold, ctx };
  });
  const doBuy = (s) => {
    if (GameState.s.player.gold < s.buy) {
      GameState.toast({ title: 'Merchant', msg: 'Not enough gold.', kind: 'warn' });
      return;
    }
    GameState.s.player.gold -= s.buy;
    addItem(s.id, 1);
    GameState.notify(CH.PLAYER);
  };
  const doSell = (e) => {
    const ctx = data.ctx;
    import('../../game/systems/EconomySystem.js').then(({ sellPrice: sp }) => {
      const p = sp(e.id, ctx);
      if (removeItem(e.id, 1)) {
        GameState.s.player.gold += p;
        GameState.toast({ title: 'Sold', msg: `+${p} 🪙`, kind: 'craft' });
        GameState.notify(CH.PLAYER);
      }
    });
  };
  return (
    <div className="panel trade-panel">
      <h2>Trade {npc?.key ? <span className="gold">· {npc.key}</span> : null} <span className="gold">🪙 {data.gold}</span></h2>
      <h3>Merchant stock</h3>
      <div className="recipe-grid">
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
function PausePanel() {
  const go = (name) => sceneCommand('togglePanel', name);
  const quit = () => {
    GameState.session.uiPanel = null;
    GameState.session.paused = false;
    import('../../game/main.js').then((m) => m.setScreen('menu'));
  };
  const saveNow = () => {
    saveToSlot('auto', GameState.s);
    GameState.toast({ title: 'Game saved', msg: 'Progress secured.', dur: 1800 });
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
function SavePanel() {
  const [saves, setSaves] = useState(() => listSaves());
  const refresh = () => setSaves(listSaves());
  const doSave = (slot) => { saveToSlot(slot, GameState.s); refresh(); };
  const doLoad = (slot) => {
    const data = loadFromSlot(slot);
    if (data) import('../../game/main.js').then((m) => m.loadGameIntoWorld(data));
    else refresh();
  };
  const doExport = (slot) => {
    const r = exportSlot(slot);
    if (!r.ok) { GameState.toast({ title: 'Export failed', msg: r.msg, kind: 'warn' }); return; }
    const blob = new Blob([r.json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rise-of-the-realm-${slot}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const doImport = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = importSlotData(String(reader.result || ''), 'slot1');
      GameState.toast(r.ok
        ? { title: 'Save imported', msg: 'Loaded into Slot 1.', kind: 'quest' }
        : { title: 'Import failed', msg: r.msg, kind: 'warn' });
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
        <input type="file" accept="application/json,.json" onChange={(e) => e.target.files[0] && doImport(e.target.files[0])} />
      </label>
    </div>
  );
}
// ==PANELS_D==



