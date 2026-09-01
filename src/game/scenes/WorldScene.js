// ─────────────────────────────────────────────────────────────────────────────
// WorldScene (spec §51–52): procedural world streaming, player, gathering,
// combat, enemies, POIs, NPCs, settlement building, day/night, economy ticks.
// NOTE: file is assembled across parts; the class opening brace below stays
// open until the final part closes it.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.js';
import { Bus, CH } from '../core/EventBus.js';
import { WORLD_CONFIG, SETTLEMENT_CONFIG, GATHER_CONFIG, DIFFICULTY, BUILD_RADIUS_FROM_HALL } from '../core/Constants.js';
import { setWorldSeed, allPois, biomeAt, isWaterAt, elevationAt } from '../world/worldGen.js';
import { getChunkCanvas, evictFarChunks } from '../world/chunkPainter.js';
import { getNodeDef, rollNodeType } from '../world/nodeTypes.js';
import { BIOMES } from '../world/biomeTable.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import BossEnemy from '../entities/BossEnemy.js';
import EnvSystem from '../systems/EnvSystem.js';
import { buildAllAssets } from '../assets/index.js';
import { recompute, awardXP, profXP, addReputation } from '../systems/ProgressionSystem.js';
import { addItem, countItem, spendItems, hasItems, removeItem } from '../systems/InventorySystem.js';
import { addGold } from '../systems/ProgressionXP.js';
import { refresh as kingdomRefresh, recruitCitizen, claimRadius } from '../systems/KingdomSystem.js';
import { productionTick } from '../systems/KingdomEconomy.js';
import { setFlag } from '../systems/QuestSystem.js';
import { getBuildingDef } from '../data/buildings.js';
import { getNpcDef } from '../data/npcs.js';
import { getEnemyDef } from '../data/enemies.js';
import { saveToSlot } from '../systems/SaveSystem.js';
import { getSetting, movementKey, particleMultiplier, shadowsEnabled } from '../systems/SettingsSystem.js';
import { getItem } from '../data/items.js';
import { iconFrame } from '../assets/icons.js';
import { makePlayerSheet } from '../assets/index.js';
import WaterSystem from '../systems/WaterSystem.js';

export const AUTOSAVE_INTERVAL_MS = 100000;
let uidSeq = 1;
const nid = () => `w${uidSeq++}`;

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene');
    this.activeChunks = new Map();
    this.lastPcx = -9999;
    this.lastPcy = -9999;
        this.nodes = new Map();
    this.enemies = [];
    this.npcs = [];
    this.loots = [];
    this.projectiles = [];
    this.buildings = new Map();
    this.needReskin = false;
    this._frame = 0;
    this.saveAcc = 0;
  }

  create() {
    const S = GameState.s;
    setWorldSeed(S.meta.seed);
    buildAllAssets(this);

    this.physics.world.setBounds(-WORLD_CONFIG.worldHalfExtent, -WORLD_CONFIG.worldHalfExtent, WORLD_CONFIG.worldHalfExtent * 2, WORLD_CONFIG.worldHalfExtent * 2);
    this.cameras.main.setBounds(-WORLD_CONFIG.worldHalfExtent, -WORLD_CONFIG.worldHalfExtent, WORLD_CONFIG.worldHalfExtent * 2, WORLD_CONFIG.worldHalfExtent * 2);
    this.cameras.main.setBackgroundColor('#141925');

    this.chunkGroup = this.add.group();
    this.floats = new Floater(this);
    this.poiMarkerLayer = this.add.layer();
    this.buildingLayer = this.add.layer();

    this.player = new Player(this, S.world.px ?? 0, S.world.py ?? 260);
    recompute();
    const D = S.player.derived;
    S.player.hp = S.player.hp || D.maxHp;
    S.player.stamina = S.player.stamina ?? D.maxStamina;
    this.cameras.main.startFollow(this.player.sprite, true, 0.14, 0.14);
    GameState.session.floatRenderer = (x, y, text, style) => this.floats.add(x, y, text, style);

    this.env = new EnvSystem(this);
    this.env.create();

    // Animated water overlay
    this.waterSystem = new WaterSystem(this);
    this.waterSystem.create();
    // Switch from menu lullaby to world ambience — soothing explore/day music.
    import('../systems/AudioSystem.js').then((a) => {
      try {
        const ph = GameState.session.timePhase;
        a.setMood(ph === 'day' || ph === 'night' ? ph : 'explore');
      } catch { /* */ }
    });

    // Boss UI (boss bar)
    this.bossUI = {
      _boss: null,
      _phase: 1,
      show(boss) { this._boss = boss; this._phase = 1; Bus.emit('boss-intro', boss.key); },
      setPhase(p) { this._phase = p; },
      hide() { this._boss = null; }
    };

    this.setupInput();
    this.setupProjectiles();
    this.setupLoot();

    this.syncBuildingsFromState();
    this.spawnWildNpcs();
    this.syncPoisMarkers();
    this.refreshPlayerSkin();

    this.time.addEvent({ delay: SETTLEMENT_CONFIG.productionTickSec * 1000, loop: true, callback: () => productionTick(this.player.pos) });
    // Autosave interval honours the player's setting; default still 100s.
    // We rebuild the timer if the user changes the value mid-session.
    const buildAutosaveTimer = () => {
      if (this._autosaveTimer) this._autosaveTimer.remove();
      const sec = Math.max(5, getSetting('autosaveSec') || 100);
      this._autosaveTimer = this.time.addEvent({
        delay: sec * 1000,
        loop: true,
        callback: () => {
          if (getSetting('autosave') !== false) {
            saveToSlot('auto', GameState.s);
            GameState.toast({ title: 'Game saved', msg: 'Progress secured.', dur: 1800 });
          }
        }
      });
    };
    buildAutosaveTimer();
    Bus.on('settings-applied', buildAutosaveTimer);

    GameState.notify(CH.WORLD);
    this.cameras.main.fadeIn(600);

    // Redraw screen-space overlays when the browser/canvas resizes.
    this.scale.on('resize', (gameSize) => {
      this.env?.posVignette?.();
      this.env?.skyGlow?.setDisplaySize(this.scale.width * 2, this.scale.height * 2);
      if (this.env?.dangerVignette) this.env.dangerVignette.setDisplaySize(this.scale.width, this.scale.height);
    });
  }

  /* ── Update ─────────────────────────────────────────────────────────── */
  update(time, delta) {
    const S = GameState.s;
    if (!S) return;
    // Immortal (test-only): keep the player alive even if session_dead was set
    // before the toggle was flipped on. Runs BEFORE the death-skip check.
    if (S.settings?.immortal === true) {
      if ((S.player.hp || 0) < 1) S.player.hp = 1;
      if (S.session_dead) {
        S.session_dead = false;
        if (this.player?.sprite) {
          this.player.sprite.setVisible(true);
          if (this.player.shadow) this.player.shadow.setVisible(true);
          if (this.player.sprite.body) this.player.sprite.body.enable = true;
        }
      }
    }
    const dt = Math.min(0.05, delta / 1000);
    this.env.update(dt);
    if (!S.session_dead) this.player.update(dt, this.envContextInput());

    this.updateChunks();
    const px = this.player.sprite.x, py = this.player.sprite.y;

    // Update animated water overlay
    if (this.waterSystem) {
      const cam = this.cameras.main;
      this.waterSystem.update(dt, cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2,
        GameState.session.timePhase === 'night', this.env?.weather || 'clear');
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      if ((e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2 < 1250 * 1250) e.update(dt, this.envContextInput());
      else if ((e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2 < 1800 * 1800) e.update(dt, this.envContextInput());
    }
    GameState.session.inCombat = this.enemies.some((e) => !e.dead && e.sprite && (e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2 < 220 * 220);

    this.updateProjectiles(dt);
    this.updateLoot(px, py);
    this.updateGatherProximity(px, py);
    this.updatePoiProximity(px, py);
    this.updateNpcs(dt, px, py);
    this.gatherTick(dt);
    this.floats.update(dt);
    if (this._frame % 6 === 0) this.updateMinimap(px, py);
    // Update ambient biome sounds every ~2 seconds
    if (this._frame % 120 === 0) {
      const biome = biomeAt(px, py);
      if (biome !== this._lastBiome) {
        this._lastBiome = biome;
        import('../systems/AudioSystem.js').then((a) => a.updateAmbient(biome));
      }
    }

    if (this._frame++ % 30 === 0) {
      S.world.px = Math.round(this.player.sprite.x);
      S.world.py = Math.round(this.player.sprite.y);
    }
    this.saveAcc += dt;
  }

  envContextInput() {
    return {
      keys: this.keys,
      pointer: this.input.activePointer,
      pointerWorld: this.pointerWorld,
      joystick: GameState.session.joystick,
      mobileBlock: GameState.session.mobileBlock,
      mobileSprint: GameState.session.mobileSprint,
      uiBlocked: GameState.session.uiPanel != null,
      ...this.env.envContext
    };
  }

  /* ── Chunk streaming (spec §52) ─────────────────────────────────────── */
  updateChunks() {
    const cs = WORLD_CONFIG.chunkSize;
    const pcx = Math.floor(this.player.sprite.x / cs);
    const pcy = Math.floor(this.player.sprite.y / cs);
    if (pcx === this.lastPcx && pcy === this.lastPcy) return;
    this.lastPcx = pcx;
    this.lastPcy = pcy;
    const r = WORLD_CONFIG.activeChunkRadius;
    const wanted = new Set();
    for (let cy = pcy - r; cy <= pcy + r; cy++) {
      for (let cx = pcx - r; cx <= pcx + r; cx++) {
        const key = `${cx},${cy}`;
        wanted.add(key);
        if (!this.activeChunks.has(key)) {
          const canvas = getChunkCanvas(cx, cy);
          const texKey = `chunk_${cx}_${cy}`;
          if (!this.textures.exists(texKey)) {
            const tex = this.textures.createCanvas(texKey, cs, cs);
            const tctx = tex.getContext();
            tctx.drawImage(canvas, 0, 0);
            tex.refresh();
          }
          const img = this.add.image(cx * cs + cs / 2, cy * cs + cs / 2, texKey)
            .setOrigin(0.5)
            .setDepth(0);
          img.setDisplaySize(cs, cs);
          this.chunkGroup.add(img);
          this.activeChunks.set(key, img);
          this.populateChunk(cx, cy);
        }
      }
    }
    // remove far chunks & evict painter cache
    for (const [key, img] of [...this.activeChunks]) {
      const [x, y] = key.split(',').map(Number);
      if (Math.abs(x - pcx) > r + 1 || Math.abs(y - pcy) > r + 1) {
        img.destroy();
        this.activeChunks.delete(key);
      }
    }
    evictFarChunks(pcx, pcy, r);
  }

  /** Deterministically populate a chunk with gather nodes + enemies + PoIs. */
  populateChunk(cx, cy) {
    const cs = WORLD_CONFIG.chunkSize;
    const oX = cx * cs;
    const oY = cy * cs;
    const hash = (x, y) => {
      let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
    const biomeId = biomeAt(oX + cs / 2, oY + cs / 2);
    const density = (BIOMES[biomeId]?.decoDensity || 0.2) * 22;

    // nodes
    for (let i = 0; i < density + 6; i++) {
      const nx = oX + hash(cx * 7 + i * 13, cy * 3 + i * 7) * cs;
      const ny = oY + hash(cx * 11 + i * 29, cy * 17 + i * 5) * cs;
      if (nx * nx + ny * ny > WORLD_CONFIG.worldHalfExtent ** 2) continue;
      const type = rollNodeType(biomeId, hash(cx * 31 + i, cy * 41 + i));
      if (!type) continue;
      // persist depletion via poiStates-by-hash key
      const stateKey = `node_${Math.round(nx)},${Math.round(ny)}`;
      const st = GameState.s.world.poiStates[stateKey];
      this.spawnNode(type, nx, ny, stateKey, st);
    }

    // enemies — fewer, fewer near spawn
    const enemyR = hash(cx * 5, cy * 13);
    const distFromSpawn = Math.hypot(oX - 0, oY - 260);
    if (enemyR < 0.12 && distFromSpawn > 900) {
      const key = this.rollEnemy(biomeId, hash(cx * 13 + 3, cy * 5 + 9));
      if (key) this.spawnEnemy(key, oX + cs / 2, oY + cs / 2);
    }
  }

  spawnNode(type, x, y, stateKey, state) {
    const def = getNodeDef(type);
    if (!def) return;
    const depleted = state?.depletedAt && state.regrowIn && state.regrowIn > GameState.s.meta.playSeconds;
    const img = this.add.image(x, y, depleted ? (def.emptyTex || def.tex) : def.tex).setDepth(5);
    if (def.tint) img.setTint(def.tint);
    if (def.solid) img.setName('solid-' + def.solid);
    const node = {
      uid: nid(), type, x, y, def, img, stateKey,
      hp: def.solid ? (Array.isArray(def.solid) ? def.solid[0] : def.solid) : 1, maxHp: def.solid ? (Array.isArray(def.solid) ? def.solid[0] : def.solid) : 1,
      depleted: !!depleted,
      regrowAt: state?.regrowAt || 0,
      ticks: 0
    };
    this.nodes.set(node.uid, node);
  }

  rollEnemy(biomeId, rnd) {
    const table = BIOMES[biomeId]?.enemies || [];
    if (!table.length) return null;
    let total = 0;
    for (const e of table) total += e.w;
    let v = rnd * total;
    for (const e of table) { v -= e.w; if (v <= 0) return e.key; }
    return table[table.length - 1].key;
  }

  spawnEnemy(key, x, y) {
    const def = getEnemyDef(key);
    if (!def) return null;
    // boss uses dedicated class
    const e = def.boss ? new BossEnemy(this, key, x, y) : new Enemy(this, key, x, y);
    if (e.dead) return null;
    this.enemies.push(e);
    return e;
  }

  /* ── Gathering (spec §13) ───────────────────────────────────────────── */
  gatherTick(dt) {
    for (const n of this.nodes.values()) {
      if (n.depleted && n.regrowAt && GameState.s.meta.playSeconds > n.regrowAt) {
        n.depleted = false;
        if (n.img && n.img.scene) {
          n.img.setTexture(n.def.tex);
          if (n.def.tint) n.img.setTint(n.def.tint);
        }
        n.hp = n.maxHp;
      }
    }
  }

  updateGatherProximity(px, py) {
    if (this._lastProxDirty === undefined) this._lastProxDirty = 0;
    if (performance.now() - this._lastProxDirty < 120) return;
    this._lastProxDirty = performance.now();
    let nearest = null;
    let nearestD = 90 * 90;
    for (const n of this.nodes.values()) {
      if (n.depleted) continue;
      const d = (n.x - px) ** 2 + (n.y - py) ** 2;
      if (d < nearestD) { nearestD = d; nearest = n; }
    }
    GameState.session.nearNode = nearest;
  }

  doGather() {
    const n = GameState.session.nearNode;
    if (!n) return;
    const S = GameState.s;
    const D = S.player.derived;
    // tool check
    const needed = n.def.tool;
    const equipped = S.player.equipment.weapon;
    let toolOk = true;
    let mult = 1;
    if (needed && !equipped) toolOk = false;
    else if (needed && equipped) {
      const def = getItem_equip(equipped.id);
      toolOk = def?.tool === needed && (def.tier || 1) >= (n.def.minToolTier || 0);
      mult = def?.gatherMult || 1;
    }
    if (!toolOk) { this.floats.add(n.x, n.y - 30, `Need ${needed}`, '#ff9a7a'); return; }

    n.hp -= 1;
    Bus.emit('play-sound', !needed ? 'pickup' : needed === 'pick' ? 'mine' : 'chop');
    const nodeHasTicks = n.def.solid;
    if (n.hp <= 0) this.breakNode(n, mult);
    else { this.floats.add(n.x, n.y - 30, '…', '#ffe9c9'); this.onMeleeImpact(n.x, n.y, false); }
  }

  breakNode(n, mult) {
    const S = GameState.s;
    const D = S.player.derived;
    const def = n.def;
    const rng = Math.random;
    let gatherAmt = Math.round((def.yieldBase[0] + rng() * (def.yieldBase[1] - def.yieldBase[0])) * mult * D.gatherYield);
    if (def.hardMinProf && (S.player.professions[def.prof]?.lv || 0) < def.hardMinProf) gatherAmt = Math.max(1, Math.floor(gatherAmt * 0.3));
    addItem(def.yRes, gatherAmt);
    this.floats.add(n.x, n.y - 40, `+${gatherAmt} ${itemName_of(def.yRes)}`, '#a8d890', 1.2);
    GameState.notify(CH.INVENTORY);
    profXP(def.prof, def.xpPerHit || 2);
    awardXP(GATHER_CONFIG_TICK_XP, 'gather');
    import('../systems/QuestEngine.js').then((q) => q.handleEvent({ type: 'gather', item: def.yRes, amount: gatherAmt }));
    Bus.emit('play-sound', 'pickup');

    // deplete node for a while if it has a solid block or fast-yield
    if (def.solid) {
      n.depleted = true;
      n.regrowAt = GameState.s.meta.playSeconds + (GATHER_CONFIG.regrowTimeMin + rng() * GATHER_CONFIG.regrowTimeVar);
      GameState.s.world.poiStates[n.stateKey] = { depletedAt: S.meta.playSeconds, regrowIn: n.regrowAt };
      if (n.img && n.img.scene) { n.img.setTexture(def.emptyTex || 'tree_stump').setTint(def.tint || 0xaaaaaa); }
    } else {
      n.depleted = true;
      n.regrowAt = GameState.s.meta.playSeconds + (def.emptyTex ? 80 : 160);
      GameState.s.world.poiStates[n.stateKey] = { depletedAt: S.meta.playSeconds, regrowIn: n.regrowAt };
      if (n.img && n.img.scene) {
        n.img.setTexture(def.emptyTex || def.tex);
        if (n.def.tint) n.img.setTint(n.def.tint);
      }
    }
  }

  /* ── POIs → rewards (spec §35–37) ───────────────────────────────────── */
  updatePoiProximity(px, py) {
    if (this._lastPoiDirty === undefined) this._lastPoiDirty = 0;
    if (performance.now() - this._lastPoiDirty < 700) return;
    this._lastPoiDirty = performance.now();
    for (const poi of allPois()) {
      if (poi.discovered) continue;
      if ((poi.x - px) ** 2 + (poi.y - py) ** 2 < 260 * 260) this.discoverPoi(poi);
    }
  }

  discoverPoi(poi) {
    if (poi.discovered) return;
    poi.discovered = true;
    GameState.s.world.discoveredPois.push(poi.id);
    GameState.toast({ title: poi.label.toUpperCase(), msg: 'Location discovered · +65 XP', kind: 'discover', dur: 4200 });
    awardXP(65, 'discover');
    import('../systems/QuestEngine.js').then((q) => q.handleEvent({ type: 'discover', poiTag: poi.tag, poiKind: poi.kind, poi }));
    Bus.emit('poi-discovered', { poi });
    this.syncPoisMarkers();
    import('../systems/AchievementSystem.js').then((a) => a.evaluateAll());
    if (poi.boss && !poi.looted) this.spawnEnemy(poi.boss, poi.x, poi.y);
    if (poi.kind === 'bandit_camp' && poi.chestTier) this.spawnChest(poi.x - 20, poi.y + 24, poi.chestTier, poi.id);
  }

  syncPoisMarkers() {
    this.poiMarkerLayer.removeAll(true);
    const known = new Set(GameState.s.world.discoveredPois);
    const owned = new Set(GameState.s.world.ownedCamps);
    for (const poi of allPois()) {
      if (!known.has(poi.id) && !owned.has(poi.id)) continue;
      this.add.text(poi.x, poi.y - 42, poi.label, {
        fontFamily: 'Cinzel', fontSize: '12px', color: '#ffe9c9',
        stroke: '#241d17', strokeThickness: 3
      }).setDepth(90).setOrigin(0.5).setAlpha(0.9);
    }
  }

  /* ── Chests & loot (spec §70–71) ────────────────────────────────────── */
  spawnChest(x, y, tier, campId) {
    if (campId && GameState.s.world.poiStates[campId]?.looted) return;
    const img = this.add.image(x, y, tier).setDepth(5);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerdown', () => this.openChest(img, tier, campId));
  }

  openChest(img, tier, campId) {
    const S = GameState.s;
    const rng = Math.random;
    const pool = {
      wooden_chest: [['wood', 12, 0.9], ['stone', 6, 0.8], ['berries', 6, 0.7], ['fiber', 8, 0.8], ['leather_hide', 2, 0.5], ['torch', 2, 0.6]],
      iron_chest: [['iron_ore', 6, 0.9], ['coal', 8, 0.9], ['cooked_meat', 4, 0.7], ['silver', 2, 0.4], ['wooden_sword', 1, 0.2], ['arrows', 12, 0.6]],
      royal_chest: [['gold_nugget', 6, 0.9], ['steel_ingot', 3, 0.7], ['healing_salve', 2, 0.6], ['iron_sword', 1, 0.4], ['repair_kit', 1, 0.5]],
      ancient_chest: [['ancient_core', 1, 1], ['moonstone', 2, 0.8], ['crystal', 4, 0.9], ['ancient_relic', 2, 0.9], ['treasure_map', 1, 0.6]]
    };
    if (campId) S.world.poiStates[campId] = { ...(S.world.poiStates[campId] || {}), looted: true };
    for (const [id, qtyMax, chance] of pool[tier] || [['wood', 5, 1]]) {
      if (rng() > chance) continue;
      const qty = 1 + Math.floor(rng() * qtyMax);
      const left = addItem(id, qty);
      if (left < qty) this.floats.add(img.x, img.y - 30, `+${qty - left} ${itemName_of(id)}`, '#ffd66b');
    }
    GameState.notify(CH.INVENTORY);
    Bus.emit('play-sound', 'craft_done');
    img.setAlpha(0.3);
    if (campId && campId.startsWith('bcamp_') && !S.world.ownedCamps.includes(campId)) {
      S.world.ownedCamps.push(campId);
      GameState.toast({ title: 'TERRITORY CAPTURED', msg: 'Your banner rises over this camp.', kind: 'stage', dur: 4200 });
      import('../systems/AchievementSystem.js').then((a) => a.evaluateAll());
      this.add.image(img.x + 24, img.y - 34, 'banner').setDepth(5);
      setTimeout(() => import('../systems/QuestEngine.js').then((q) => q.handleEvent({ type: 'territory-pct', pct: kingdomPct() })), 300);
    }
  }

  /* ── NPCs & recruitment (spec §21–22) ───────────────────────────────── */
  spawnWildNpcs() {
    const forged = GameState.s.settlement.citizens.map((c) => c.name);
    for (const poi of allPois()) {
      if (poi.kind === 'camp_friend' || poi.kind === 'rescue') {
        const npcDef = getNpcDef(poi.npc);
        if (npcDef && forged.includes(npcDef.name)) continue;
        this.spawnNpc(poi.npc, poi.x + 8, poi.y + 14);
      }
    }
  }

  spawnNpc(key, x, y) {
    const npcDef = getNpcDef(key);
    if (!npcDef) return null;
    const tex = key === 'torvald' ? 'npc_merchant' : 'npc_generic';
    const s = this.add.image(x, y, tex, 'down_1').setDepth(6);
    const sh = this.add.image(x, y + 3, 'fx_shadow').setDepth(5).setAlpha(0.5).setBlendMode('MULTIPLY');
    s.setInteractive({ useHandCursor: true });
    const npc = {
      key, def: npcDef, sprite: s, shadow: sh, x, y,
      // Wander AI state
      homeX: x, homeY: y,
      wanderRadius: 60 + Math.random() * 40,
      aiState: 'idle',    // idle | walking | pausing
      aiDir: 'down',
      aiTimer: 2 + Math.random() * 4,  // seconds until next state change
      aiWalkFrame: 0,
      aiWalkAccum: 0,
      aiTargetX: x,
      aiTargetY: y,
    };
    s.on('pointerdown', () => {
      // Stop wandering briefly when player interacts
      npc.aiState = 'idle';
      npc.aiTimer = 3;
      npc.sprite.setFrame(`${npc.aiDir}_1`);
      this.interactNpc(npc);
    });
    this.npcs.push(npc);
    return npc;
  }

  interactNpc(npc) {
    const S = GameState.s;
    if (npc.def.req && !this.npcRequirementsMet(npc.def)) {
      GameState.toast({ title: npc.def.name, msg: this.reqText(npc.def.req), kind: 'dialogue' });
      return;
    }
    import('../systems/QuestEngine.js').then((q) => q.handleEvent({ type: 'talk', npc: npc.key }));
    const lines = npc.def.dialogue || npc.def.greetLines || ['…'];
    GameState.session.dialogue = { npc: npc.key, name: npc.def.name, portrait: npc.def.portrait, lines, actions: this.npcActions(npc) };
    if (npc.def.questGiver && isSideAvailable(npc.def.questGiver)) {
      GameState.session.dialogue.actions.push({ label: 'Accept quest', fn: 'offerSideQuest', arg: npc.def.questGiver });
    }
    GameState.notify(CH.DIALOGUE);
  }

  npcRequirementsMet(def) {
    const R = GameState.s;
    const req = def.req || {};
    if (req.rep && R.player.reputation < req.rep) return false;
    if (req.gold && R.player.gold < req.gold) return false;
    if (req.stage && (R.settlement.stageIndex || 0) < req.stage) return false;
    if (req.buildingNearby && !R.settlement.buildings.some((b) => b.key === req.buildingNearby && b.complete)) return false;
    if (req.questFlag && !R.story.flags[req.questFlag]) return false;
    return true;
  }

  reqText(req) {
    const needs = [];
    if (req.rep) needs.push(`${req.rep} reputation`);
    if (req.gold) needs.push(`${req.gold} gold`);
    if (req.stage) needs.push(`${['Camp','Camp','Village','Town','City','Kingdom','Empire'][req.stage]} rank`);
    if (req.buildingNearby) needs.push(`${getBuildingDef(req.buildingNearby)?.label || req.buildingNearby} built`);
    return 'Requires ' + needs.join(' · ');
  }

  npcActions(npc) {
    const out = [];
    if (npc.def.joinAs || npc.def.cost) {
      out.push({ label: npc.def.cost ? `Recruit (${npc.def.cost.gold} gold)` : 'Invite to your realm', fn: 'recruitNpc', arg: npc.key });
    }
    if (npc.def.merchant) out.push({ label: 'Trade', fn: 'openTrade', arg: npc.key });
    return out;
  }

  updateNpcs(dt, px, py) {
    for (const npc of this.npcs) {
      const s = npc.sprite;
      // Skip AI if NPC is being talked to
      if (GameState.session.dialogue?.npc === npc.key) {
        s.setDepth(Math.round(s.y));
        npc.shadow?.setPosition(s.x, s.y + 3).setDepth(s.depth - 1);
        continue;
      }

      npc.aiTimer -= dt;

      switch (npc.aiState) {
        case 'idle': {
          // Stand still, countdown to next wander
          if (npc.aiTimer <= 0) {
            // Pick a random walkable target within wander radius of home
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * (npc.wanderRadius - 20);
            npc.aiTargetX = npc.homeX + Math.cos(angle) * dist;
            npc.aiTargetY = npc.homeY + Math.sin(angle) * dist;
            // Determine direction
            const dx = npc.aiTargetX - s.x;
            const dy = npc.aiTargetY - s.y;
            if (Math.abs(dx) > Math.abs(dy)) {
              npc.aiDir = dx < 0 ? 'left' : 'right';
            } else {
              npc.aiDir = dy < 0 ? 'up' : 'down';
            }
            npc.aiState = 'walking';
            npc.aiWalkFrame = 0;
            npc.aiWalkAccum = 0;
          }
          break;
        }
        case 'walking': {
          // Move toward target
          const dx = npc.aiTargetX - s.x;
          const dy = npc.aiTargetY - s.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 3 || npc.aiTimer <= 0) {
            // Arrived or timed out — stop and pause
            npc.aiState = 'pausing';
            npc.aiTimer = 2 + Math.random() * 5;  // pause 2–7 seconds
            npc.aiDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
            s.setFrame(`${npc.aiDir}_1`);
          } else {
            const speed = 28;  // pixels/sec — slow wander
            const step = Math.min(speed * dt, dist);
            s.x += (dx / dist) * step;
            s.y += (dy / dist) * step;
            // Walk animation cycle: frames 0→1→2→1 at ~6fps
            npc.aiWalkAccum += dt;
            if (npc.aiWalkAccum > 0.16) {
              npc.aiWalkAccum -= 0.16;
              npc.aiWalkFrame = (npc.aiWalkFrame + 1) % 4; // 0,1,2,1
            }
            const phase = npc.aiWalkFrame === 3 ? 1 : npc.aiWalkFrame;
            s.setFrame(`${npc.aiDir}_${phase}`);
          }
          break;
        }
        case 'pausing': {
          // Stand still, then go idle
          if (npc.aiTimer <= 0) {
            npc.aiState = 'idle';
            npc.aiTimer = 1 + Math.random() * 3;  // 1–4 sec before next wander
            s.setFrame(`${npc.aiDir}_1`);
          }
          break;
        }
      }

      s.setDepth(Math.round(s.y));
      npc.shadow?.setPosition(s.x, s.y + 3).setDepth(s.depth - 1);
    }
  }

  recruitNpcFrom(key) {
    const npcDef = getNpcDef(key);
    if (!npcDef) return;
    const cost = npcDef.cost || {};
    if (cost.gold && GameState.s.player.gold < cost.gold) {
      GameState.toast({ title: npcDef.name, msg: 'Not enough gold.', kind: 'warn' });
      return;
    }
    if (cost.gold) GameState.s.player.gold -= cost.gold;
    recruitCitizen({ name: npcDef.name, role: npcDef.joinAs || 'worker', skillLv: npcDef.skillRate ? Math.round(npcDef.skillRate) : 1 });
    addReputation(8);
    GameState.toast({ title: `${npcDef.name} joins you!`, msg: npcDef.dialogue?.[0] || 'Welcome aboard.', kind: 'quest', dur: 4200 });
    const npc = this.npcs.find((n) => n.key === key);
    if (npc) { this.npcs = this.npcs.filter((n) => n !== npc); npc.sprite.destroy(); npc.shadow?.destroy(); }
    GameState.session.dialogue = null;
    GameState.notify(CH.SETTLEMENT, CH.DIALOGUE, CH.PLAYER);
    kingdomRefresh();
  }

  openTradeFor(key) {
    GameState.session.tradeNpc = { key };
    GameState.session.uiPanel = 'trade';
    GameState.notify(CH.SCREEN);
  }

  /* ── Buildings: placement, construction, upgrade (spec §24, §72) ────── */
  syncBuildingsFromState() {
    this.buildingLayer.removeAll(true);
    this.buildings.clear();
    for (const b of GameState.s.settlement.buildings) this.addBuildingSprite(b);
    kingdomRefresh();
  }

  addBuildingSprite(b) {
    const def = getBuildingDef(b.key);
    if (!def) return;
    const img = this.add.image(b.x, b.y, this.buildingTexture(b)).setDepth(b.y).setInteractive({ useHandCursor: true });
    img.on('pointerdown', () => {
      GameState.session.selectedBuilding = b.uid;
      GameState.notify(CH.SETTLEMENT);
    });
    this.buildingLayer.add(img);
    this.buildings.set(b.uid, img);
    return img;
  }

  buildingTexture(b) {
    const tier = b.tier || 1;
    switch (b.key) {
      case 'townhall': return `townhall_t${Math.min(tier, 5)}`;
      case 'campfire': return 'campfire';
      case 'tent': return 'tent';
      case 'storage_chest': return 'storage_chest';
      case 'farm': return `farm_stage${b.complete ? 3 : 1}`;
      case 'woodcutter': return 'woodcutter_lodge';
      case 'mine': return 'mine_entrance';
      case 'forge': case 'kitchen': case 'tannery': case 'workshop': return `stn_${b.key}`;
      case 'watchtower': return `watchtower_t${Math.min(tier, 2)}`;
      case 'barracks': return 'barracks';
      case 'archery_range': return 'archery_range';
      case 'stable': return 'stable';
      case 'fortress': return 'fortress';
      case 'wall': return 'wall_seg';
      case 'gate': return 'gate_seg';
      case 'market': return 'market_stalls';
      case 'temple': return 'temple_shrine';
      case 'library': return 'library';
      default: return 'hut_t1';
    }
  }

  enterBuildMode(buildKey) {
    GameState.session.pendingBuild = { key: buildKey };
    GameState.notify(CH.SCREEN);
  }

  /** Check if a position is valid for building. Returns null if ok, else reason string. */
  canBuildAt(pos) {
    const S = GameState.s;
    // World bounds
    const ext = WORLD_CONFIG.worldHalfExtent - 200;
    if (Math.abs(pos.x) > ext || Math.abs(pos.y) > ext) return 'Too close to the world edge';
    // Water
    if (isWaterAt(pos.x, pos.y)) return 'Cannot build in water';
    // Mountain (high elevation + steep biome)
    const elev = elevationAt(pos.x, pos.y);
    const biome = biomeAt(pos.x, pos.y);
    if (biome === 'mountains' && elev > 0.82) return 'Terrain too steep for building';
    if (biome === 'volcanic' && elev > 0.78) return 'Volcanic ground is unstable';
    // Build radius from town hall (if founded)
    if (S.settlement.founded && S.settlement.pos) {
      const radius = BUILD_RADIUS_FROM_HALL[Math.min(S.settlement.stageIndex, BUILD_RADIUS_FROM_HALL.length - 1)] ?? 900;
      const dx = pos.x - S.settlement.pos.x, dy = pos.y - S.settlement.pos.y;
      if (dx * dx + dy * dy > radius * radius) return `Too far from your settlement (max ${Math.round(radius)}px)`;
    }
    // Collision with existing buildings
    for (const b of S.settlement.buildings) {
      if ((b.x - pos.x) ** 2 + (b.y - pos.y) ** 2 < 40 * 40) return 'Too close to another building';
    }
    return null;
  }

  placeBuild(pos) {
    const S = GameState.s;
    const pending = GameState.session.pendingBuild;
    if (!pending) return;
    const def = getBuildingDef(pending.key);
    if (!def) return;
    // Terrain/build validation
    const blockReason = this.canBuildAt(pos);
    if (blockReason) { GameState.toast({ title: def.label, msg: blockReason, kind: 'warn' }); return; }
    // Stage check
    if (S.settlement.founded && def.requiresStage && S.settlement.stageIndex < def.requiresStage) {
      GameState.toast({ title: def.label, msg: `Requires ${['','Camp','Village','Town','City','Kingdom','Empire'][def.requiresStage]} rank`, kind: 'warn' });
      return;
    }
    if (!hasItems(def.cost)) { GameState.toast({ title: def.label, msg: 'Not enough resources', kind: 'warn' }); return; }
    if (pending.key === 'townhall' && S.settlement.founded) { GameState.toast({ title: 'Town Hall', msg: 'A realm may hold but one hall.', kind: 'warn' }); return; }
    spendItems(def.cost);
    const b = {
      uid: nid(), key: pending.key, x: pos.x, y: pos.y,
      tier: 1, builtProgress: 0, complete: (def.buildSec || 0) <= 0,
      hp: def.hpByTier?.[0] ?? def.hp ?? 100, maxHp: def.hpByTier?.[0] ?? def.hp ?? 100
    };
    if (pending.key === 'townhall' && !S.settlement.founded) {
      S.settlement.founded = true;
      S.settlement.pos = { x: pos.x, y: pos.y };
      GameState.toast({ title: 'SETTLEMENT FOUNDED', msg: 'Your realm has a hearth and a hall. This is where it begins.', kind: 'stage', dur: 5200 });
      setFlag('settlement_founded');
      import('../systems/AchievementSystem.js').then((a) => a.evaluateAll());
      spawnIntroFollowers();
    }
    if (def.yieldMultNearMountain) b.mountainAffinity = this.nearMountains(pos);
    S.settlement.buildings.push(b);
    this.addBuildingSprite(b);
    this.animateConstruction(b);
    import('../systems/QuestEngine.js').then((q) => q.handleEvent({ type: 'built', building: pending.key }));
    Bus.emit('play-sound', 'build_thud');
    GameState.notify(CH.SETTLEMENT, CH.INVENTORY);
    kingdomRefresh();
    GameState.session.pendingBuild = null;

    function spawnIntroFollowers() {
      const already = S.settlement.citizens.length > 0;
      if (already) return;
      recruitCitizen({ name: 'Tam', role: 'worker', skillLv: 1 });
      recruitCitizen({ name: 'Mira', role: 'farmer', skillLv: 2 });
      GameState.toast({ title: 'Two souls settle in', msg: 'Travelers who followed the smoke of your first fire.', kind: 'quest' });
    }
  }

  nearMountains(pos) {
    const b = biomeAt(pos.x, pos.y);
    return b === 'mountains' || b === 'volcanic';
  }

  animateConstruction(b) {
    const img = this.buildings.get(b.uid);
    if (!img) return;
    img.setAlpha(0.35);
    const def = getBuildingDef(b.key);
    this.tweens.add({ targets: img, alpha: 0.35, duration: 200, yoyo: true, repeat: -1 });
    this.time.delayedCall((def.buildSec || 4) * 1000, () => {
      b.complete = true;
      this.tweens.killTweensOf(img);
      img.setAlpha(1).setDepth(img.y);
      GameState.notify(CH.SETTLEMENT);
      Bus.emit('built-complete', { key: b.key });
      Bus.emit('play-sound', 'craft_done');
      kingdomRefresh();
      this.refreshStationsNear();
    });
  }

  upgradeBuilding(uid) {
    const S = GameState.s;
    const b = S.settlement.buildings.find((x) => x.uid === uid);
    if (!b) return { ok: false, reason: 'Missing' };
    const def = getBuildingDef(b.key);
    const next = b.tier + 1;
    if (def.maxTier < next || !def.maxTier) return { ok: false, reason: 'Max tier' };
    const cost = def.tierCosts && def.tierCosts[b.tier];
    if (cost && !hasItems(cost)) return { ok: false, reason: 'Missing resources' };
    if (cost) spendItems(cost);
    b.tier = next;
    if (b.hp && def.hpByTier) b.maxHp = def.hpByTier[next - 1] || b.maxHp;
    const img = this.buildings.get(uid);
    if (img) img.setTexture(this.buildingTexture(b)).setAlpha(1);
    GameState.toast({ title: `${def.label} upgraded → Tier ${next}`, kind: 'stage' });
    GameState.notify(CH.SETTLEMENT);
    kingdomRefresh();
    this.refreshStationsNear();
    return { ok: true };
  }

  refreshStationsNear() {
    const near = {};
    const px = this.player.sprite.x, py = this.player.sprite.y;
    for (const b of GameState.s.settlement.buildings) {
      if (!b.complete) continue;
      const def = getBuildingDef(b.key);
      if (def?.station && (b.x - px) ** 2 + (b.y - py) ** 2 < 200 * 200) near[def.station] = true;
    }
    GameState.session.stationsNear = near;
  }

  /* ── Projectiles (spec §18) ─────────────────────────────────────────── */
  setupProjectiles() {
    this.projectiles = [];
  }

  spawnProjectile(o) {
    const tex = o.kind === 'fireball' ? 'proj_fireball' : 'proj_arrow';
    const img = this.add.image(o.x, o.y, tex).setDepth(85).setRotation(o.angle);
    const dirx = Math.cos(o.angle), diry = Math.sin(o.angle);
    const p = { img, x: o.x, y: o.y, vx: dirx * o.speed, vy: diry * o.speed, dmg: o.dmg, crit: o.crit, pierce: o.pierce || 0, traveled: 0, maxDist: o.maxDist, owner: o.owner, enemy: o.enemy };
    this.projectiles.push(p);
    return p;
  }

  updateProjectiles(dt) {
    for (const p of [...this.projectiles]) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.traveled += Math.hypot(p.vx * dt, p.vy * dt);
      p.img.setPosition(p.x, p.y);
      if (p.traveled > p.maxDist || Math.abs(p.x) > WORLD_CONFIG.worldHalfExtent || Math.abs(p.y) > WORLD_CONFIG.worldHalfExtent) {
        this.destroyProjectile(p);
        continue;
      }
      // collide
      if (p.owner === 'player') {
        let hit = false;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if ((e.sprite.x - p.x) ** 2 + (e.sprite.y - p.y) ** 2 < (e.def.radius + 8) ** 2) {
            const crit = Math.random() < (p.crit || 0);
            e.takeDamage(Math.round(p.dmg * (crit ? 1.8 : 1)), p.x, p.y, this.floats, crit);
            this.floats.add(e.sprite.x, e.sprite.y - 30, `${Math.round(p.dmg * (crit ? 1.8 : 1))}`, crit ? '#ffd66b' : '#ffe9c9', crit ? 1.2 : 1);
            hit = true;
            if (p.pierce > 0) { p.pierce--; p.dmg *= 0.85; continue; }
            break;
          }
        }
        if (hit) this.destroyProjectile(p);
      } else if (p.owner === 'enemy') {
        const pl = this.player;
        if (!pl.sprite) return;
        if ((pl.sprite.x - p.x) ** 2 + (pl.sprite.y - p.y) ** 2 < 13 * 13) {
          pl.takeDamage(p.dmg, p.x, p.y);
          this.destroyProjectile(p);
        }
      }
    }
  }

  destroyProjectile(p) {
    p.img.destroy();
    this.projectiles = this.projectiles.filter((q) => q !== p);
  }

  /* ── Loot drops (spec §70) ──────────────────────────────────────────── */
  setupLoot() {
    this.loots = [];
  }

  dropLoot(x, y, id, qty) {
    const img = this.add.image(x, y, iconFrame(id)).setDepth(8).setScale(1.2);
    if (Phaser.Math.Between(0, 1)) img.setAngle(Phaser.Math.Between(-20, 20));
    img.setInteractive();
    const l = { img, id, qty, x, y, t: 0 };
    img.on('pointerdown', () => this.pickLoot(l));
    this.loots.push(l);
  }

  dropLootGold(x, y, amount) {
    this.floats.add(x, y - 34, `+${amount} 🪙`, '#ffd66b', 1.15);
    addGold(amount);
    Bus.emit('play-sound', 'coin');
  }

  updateLoot(px, py) {
    for (const l of [...this.loots]) {
      l.t += 1 / 60;
      if (l.t > 90) { l.img.destroy(); this.loots = this.loots.filter((q) => q !== l); continue; }
      if (l.t > 0.6 && (l.x - px) ** 2 + (l.y - py) ** 2 < 70 * 70) this.pickLoot(l);
    }
  }

  pickLoot(l) {
    if (l.picked) return;
    const left = addItem(l.id, l.qty);
    const gained = l.qty - left;
    if (gained > 0) {
      // ── Loot fly-to-player: item arcs toward player before disappearing ──
      const px = this.player.sprite.x, py = this.player.sprite.y;
      const startX = l.img.x, startY = l.img.y;
      this.tweens.add({
        targets: l.img,
        x: px, y: py - 20,
        scaleX: 0.3, scaleY: 0.3,
        alpha: 0.2,
        duration: 280,
        ease: 'Cubic.easeIn',
        onComplete: () => { l.img.destroy(); }
      });
      // Delay the float text slightly so it appears at the pickup point
      this.time.delayedCall(100, () => {
        this.floats.add(startX, startY - 24, `+${gained} ${itemName_of(l.id)}`, '#dcead0');
      });
    } else {
      l.img.destroy();
    }
    if (left === 0) {
      l.picked = true;
      this.loots = this.loots.filter((q) => q !== l);
    } else l.qty = left;
    Bus.emit('play-sound', 'pickup');
    GameState.notify(CH.INVENTORY);
  }

  /* ── Input (spec §5, §41) ───────────────────────────────────────────── */
  setupInput() {
    this.keys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W, A: 'A', S: 'S', D: 'D',
      UP: Phaser.Input.Keyboard.KeyCodes.UP, DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
      LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT, RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT, SPACE: 'SPACE'
    });
    // movementScheme determines which keyset Player.js treats as "primary".
    // Both sets always work; the primary set is what the HUD hint highlights.
    this.primaryKeys = movementKey() === 'arrows'
      ? ['UP', 'DOWN', 'LEFT', 'RIGHT']
      : ['W', 'A', 'S', 'D'];
    // Re-derive if the player changes movement scheme mid-session.
    Bus.on('settings-applied', () => {
      this.primaryKeys = movementKey() === 'arrows'
        ? ['UP', 'DOWN', 'LEFT', 'RIGHT']
        : ['W', 'A', 'S', 'D'];
    });
    this.input.keyboard.on('keydown-E', () => { if (!GameState.session.uiPanel) this.doGather(); });
    this.input.keyboard.on('keydown-I', () => this.togglePanel('inventory'));
    this.input.keyboard.on('keydown-C', () => this.togglePanel('crafting'));
    this.input.keyboard.on('keydown-M', () => this.togglePanel('map'));
    this.input.keyboard.on('keydown-J', () => this.togglePanel('journal'));
    this.input.keyboard.on('keydown-K', () => this.togglePanel('kingdom'));
    this.input.keyboard.on('keydown-B', () => this.togglePanel('build'));
    this.input.keyboard.on('keydown-P', () => this.togglePanel('skills'));
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-F3', (e) => {
      e.originalEvent.preventDefault();
      GameState.session.debugVisible = !GameState.session.debugVisible;
      GameState.notify(CH.SCREEN);
    });

    // attack on left mouse
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) return;
      if (GameState.session.uiPanel || GameState.session.buildModeGhost || GameState.session.paused) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.pointerWorld = world;
      if (GameState.session.pendingBuild) {
        this.placeBuild({ x: world.x, y: world.y });
        return;
      }
      this.player.holdStart = performance.now();
      this.player.tryAttack({ heavy: false }, world, this.enemies, this.floats);
    });
    this.input.on('pointerup', (pointer) => {
      if (pointer.rightButtonDown()) return;
      if (GameState.session.uiPanel) return;
      this.player.requestHeavyRelease?.((this.pointerWorld), this.enemies, this.floats);
    });
    // heavy attack on left mouse hold (with skill) & block on right or shift-space
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown() && !GameState.session.uiPanel) {
        GameState.session.mobileBlock = true;
      }
    });
    this.input.on('pointerup', (pointer) => {
      if (pointer.rightButtonDown() === false) GameState.session.mobileBlock = false;
    });
    this.input.keyboard.on('keydown-SHIFT', () => {});
    this.input.keyboard.on('keydown-SPACE', () => { this.player.wantDodge = true; });
    this.input.on('pointermove', (pointer) => {
      if (GameState.session.pendingBuild) {
        const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        if (!this.buildGhost) this.buildGhost = this.add.image(w.x, w.y, 'hut_t1').setAlpha(0.6).setDepth(70);
        else this.buildGhost.setPosition(w.x, w.y).setTexture(this.ghostTexture()).setAlpha(0.6);
        // Visual feedback: green tint = valid, red tint = invalid
        const valid = !this.canBuildAt(w);
        this.buildGhost.setTint(valid ? 0x44ff88 : 0xff4444);
        this.pointerWorld = w;
      } else if (this.buildGhost) { this.buildGhost.destroy(); this.buildGhost = null; }
    });
  }

  ghostTexture() {
    const key = GameState.session.pendingBuild?.key;
    const def = getBuildingDef(key);
    if (!def) return 'hut_t1';
    return this.buildingTexture({ key, tier: 1, complete: true });
  }

  togglePause() {
    GameState.session.paused = !GameState.session.paused;
    GameState.session.uiPanel = GameState.session.paused ? 'pause' : null;
    this.scene.pause ? null : null;
    GameState.notify(CH.SCREEN);
  }

  togglePanel(name) {
    const cur = GameState.session.uiPanel;
    GameState.session.uiPanel = cur === name ? null : name;
    GameState.session.paused = GameState.session.uiPanel != null;
    GameState.notify(CH.SCREEN, CH.WORLD);
    Bus.emit('play-sound', cur === name ? 'ui_click' : 'ui_open');
  }

  /* ── FX helpers ────────────────────────────────────────────────────── */
  fxHit(x, y) {
    this.add.image(x, y, 'fx_hitflash').setDepth(88).setScale(0.8);
  }
  fxDeath(x, y) {
    this.add.image(x, y, 'fx_ring').setDepth(87).setAlpha(0.8);
  }
  fxMelee() {}
  onMeleeImpact(x, y, heavy) {
    this.spawnBurst(x, y, heavy ? 'fx_slash3' : 'fx_hitflash');
  }
  refreshPlayerSkin() {
    if (this.player?.sprite) {
      const S = GameState.s;
      makePlayerSheet(this, {
        skin: S.player.appearance?.skin || '#caa27c',
        hairStyle: S.player.appearance?.hairStyle || 'short',
        hairColor: S.player.appearance?.hairColor || '#4a3222',
        gender: S.player.gender || 'm',
        outfitTier: S.player.appearance?.outfitTier ?? 0
      });
      this.player.sprite.setTexture('player_char', `${this.player.dir}_1`);
    }
  }
  spawnBurst(x, y, tex) {
    this.add.image(x, y, tex).setDepth(86).setBlendMode('ADD').setAlpha(0.75);
  }
  grantWarmth(sec) {
    this.env.grantWarmth(sec);
  }

  /* ── Minimap rendering ──────────────────────────────────────────────── */
  updateMinimap(px, py) {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const mw = canvas.width, mh = canvas.height;
    const viewRadius = 2200;

    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, mw, mh);

    // Draw terrain by sampling biome colors at grid points
    const step = 28;
    const biomeColors = {
      riverlands: '#3a6b8a', forest: '#2d5a2d', plains: '#6a8a3a',
      desert: '#c4a65a', frozen: '#b8d4e8', mountains: '#7a7a7a',
      volcanic: '#8a3a1a', swamp: '#4a6a3a'
    };
    for (let my = 0; my < mh; my += step) {
      for (let mx = 0; mx < mw; mx += step) {
        const wx = px + (mx / mw - 0.5) * viewRadius * 2;
        const wy = py + (my / mh - 0.5) * viewRadius * 2;
        const biome = biomeAt(wx, wy);
        ctx.fillStyle = biomeColors[biome] || '#333';
        ctx.fillRect(mx, my, step, step);
      }
    }

    // Draw discovered POIs
    const known = new Set(GameState.s.world.discoveredPois);
    const owned = new Set(GameState.s.world.ownedCamps);
    for (const poi of allPois()) {
      if (!known.has(poi.id) && !owned.has(poi.id)) continue;
      const mx = ((poi.x - px) / (viewRadius * 2) + 0.5) * mw;
      const my = ((poi.y - py) / (viewRadius * 2) + 0.5) * mh;
      if (mx < 0 || mx > mw || my < 0 || my > mh) continue;
      ctx.fillStyle = owned.has(poi.id) ? '#ffd66b' : '#ffe9c9';
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw enemies as red dots
    for (const e of this.enemies) {
      if (e.dead || !e.sprite) continue;
      const mx = ((e.sprite.x - px) / (viewRadius * 2) + 0.5) * mw;
      const my = ((e.sprite.y - py) / (viewRadius * 2) + 0.5) * mh;
      if (mx < 0 || mx > mw || my < 0 || my > mh) continue;
      ctx.fillStyle = e.boss ? '#ff4444' : '#cc3333';
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }

    // Draw player as bright center dot
    ctx.fillStyle = '#44ff88';
    ctx.beginPath();
    ctx.arc(mw / 2, mh / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#88ffbb';
    ctx.beginPath();
    ctx.arc(mw / 2, mh / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── Share helpers to other systems ────────────────────────────────── */
  kingdomPct() {
    const owned = GameState.s.world.ownedCamps.length + (GameState.s.settlement.founded ? 1 : 0);
    return Math.round((owned / 18) * 100);
  }

  onEnemyDeath(e) {
    if (!e.boss) return;
    // chain quest progress for boss kills
    import('../systems/QuestEngine.js').then((q) => q.handleEvent({ type: 'kill', boss: e.key }));
  }

  refreshSurvivalHud() {
    GameState.notify('PLAYER');
  }
}

/* ══════════════════ Module-level helpers ══════════════════ */

const GATHER_CONFIG_TICK_XP = 2;
function itemName_of(id) {
  return getItem(id)?.name || id;
}
function getItem_equip(id) {
  return getItem(id);
}
function isSideAvailable(qid) {
  const S = GameState.s;
  if (!S) return false;
  return !S.quests.sideActive.includes(qid) && !S.quests.sideCompleted.includes(qid);
}
function isSideDone(qid) {
  return GameState.s?.quests?.sideCompleted?.includes(qid) || false;
}
function kingdomPct() {
  const S = GameState.s;
  const owned = S.world.ownedCamps.length + (S.settlement.founded ? 1 : 0);
  return Math.round((owned / 18) * 100);
}

/** Simple world-space floating combat/resource text pool. */
class Floater {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }
  add(x, y, text, color = '#fff', scale = 1) {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Spectral', fontSize: `${Math.round(15 * scale)}px`, color,
      stroke: '#241d17', strokeThickness: 3
    }).setOrigin(0.5).setDepth(900);
    this.scene.tweens.add({
      targets: t, y: y - 34, alpha: 0, duration: 900,
      onComplete: () => t.destroy()
    });
  }
  update() { /* tweens handle lifecycle */ }
}










