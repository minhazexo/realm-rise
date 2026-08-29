// Central panel hub (spec §39–43): inventory/crafting/skills/build/kingdom/map/
// journal/character/save/trade/pause. Each panel bridges to live systems.
import React, { useMemo, useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import { getItem, RARITY } from '../../game/data/items.js';
import { iconDataURLs } from '../../game/assets/icons.js';
import { sortedInventory, equip, unequip, countItem, useConsumable } from '../../game/systems/InventorySystem.js';
import { recipesForUI, craft } from '../../game/systems/CraftingSystem.js';
import { BRANCHES, SKILLS } from '../../game/data/skills.js';
import { spendStat, learnSkill } from '../../game/systems/ProgressionSystem.js';
import { BUILDINGS, BUILDING_CATS, getBuildingDef } from '../../game/data/buildings.js';
import { allPois } from '../../game/world/worldGen.js';
import { stageRequirementsMissing, territoryPct, refresh as kingdomRefresh, militaryPowerTotal } from '../../game/systems/KingdomSystem.js';
import { canRecruitUnit, recruitUnit } from '../../game/systems/KingdomEconomy.js';
import { saveToSlot, listSaves, loadFromSlot, deleteSlot } from '../../game/systems/SaveSystem.js';
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
    // gear → equip
    import('../../game/systems/InventorySystem.js').then((I) => {
      if (I.findEntry(ref)) I.equip(ref);
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
          return (
            <button key={e.iid || e.id} className="cell" style={{ '--rar': R[d.rarity].color }} onClick={() => handleClick(e)} title={d.name}>
              <Icon id={e.id} size={32} />
              {e.qty > 1 && <span className="qty">{e.qty}</span>}
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
function CraftingPanel() {
  const [cat, setCat] = useState('all');
  const recipes = useGameState([CH.INVENTORY, CH.WORLD], () => {
    try { return recipesForUI(cat); } catch { return []; }
  });
  const doCraft = (id) => {
    const r = craft(id);
    if (!r.ok) GameState.toast({ title: 'Cannot craft', msg: r.reason, kind: 'warn' });
  };
  return (
    <div className="panel crafting-panel">
      <h2>Crafting</h2>
      <div className="recipe-tabs">
        {['all', 'survival', 'cooking', 'tools', 'weapons', 'armor', 'process', 'special'].map((c) => (
          <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="recipe-grid">
        {recipes.map((r) => {
          const affordable = !r.reason;
          return (
            <button key={r.id} className={`recipe ${affordable ? '' : 'locked'}`} onClick={() => doCraft(r.id)} disabled={!affordable}>
              <Icon id={r.out} size={34} />
              <div className="recipe-body">
                <b>{r.def?.name}</b>
                <div className="recipe-cost">
                  {Object.entries(r.cost).map(([id, n]) => (
                    <span key={id} className={countItem(id) >= n ? 'have' : 'need'}>{getItem(id)?.name}×{n}</span>
                  ))}
                </div>
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
// ==PANELS_D==



