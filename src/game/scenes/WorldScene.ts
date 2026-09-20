// ─────────────────────────────────────────────────────────────────────────────
// WorldScene (spec §51–52): procedural world streaming, player, gathering,
// combat, enemies, POIs, NPCs, settlement building, day/night, economy ticks.
// NOTE: file is assembled across parts; the class opening brace below stays
// open until the final part closes it.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { WORLD_CONFIG, SETTLEMENT_CONFIG, GATHER_CONFIG, DIFFICULTY } from '../core/Constants.ts';
import { setWorldSeed, allPois, biomeAt } from '../world/worldGen.ts';
import { getChunkCanvas, evictFarChunks } from '../world/chunkPainter.ts';
import Player from '../entities/Player.ts';
import Enemy from '../entities/Enemy.ts';
import BossEnemy from '../entities/BossEnemy.ts';
import EnvSystem from '../systems/EnvSystem.ts';
import { buildAllAssets } from '../assets/index.ts';
import { preloadItemArtwork } from '../assets/itemArtwork.ts';
import { recompute, awardXP, profXP, addReputation } from '../systems/ProgressionSystem.ts';
import { addItem } from '../systems/InventorySystem.ts';
import { refresh as kingdomRefresh, recruitCitizen } from '../systems/KingdomSystem.ts';
import { productionTick } from '../systems/KingdomEconomy.ts';
import { getBuildingDef } from '../data/buildings.ts';
import { getNpcDef } from '../data/npcs.ts';
import { saveToSlot } from '../systems/SaveSystem.ts';
import { getSetting } from '../systems/SettingsSystem.ts';
import { getItem } from '../data/items.ts';
import { makePlayerSheet } from '../assets/index.ts';
import WaterSystem from '../systems/WaterSystem.ts';
import PostFXSystem from '../systems/PostFXSystem.ts';
import {
  applyFogToChunk, setAtmosphereState, setFogEnabled, setLastFogBiome
} from '../world/chunkPainter.ts';
import { refreshDynamicLights } from '../systems/DynamicLights.ts';
import * as lootSys from '../systems/LootSystem.ts';
import * as buildSys from '../systems/BuildSystem.ts';
import * as minimapSys from '../systems/MinimapSystem.ts';
import * as inputSys from '../systems/InputSystem.ts';
import { createNpc } from '../systems/EntityFactory.ts';
import { CHEST_POOLS, FALLBACK_CHEST_POOL } from '../data/lootTables.ts';
import { configureSpawning } from '../systems/SpawnDirector.ts';
import * as spawnSys from '../systems/SpawnDirector.ts';
import * as gatherSys from '../systems/GatherSystem.ts';
import { updateNightMask } from '../systems/NightLights.ts';
import { updateFogCards } from '../systems/FogCards.ts';
import { updateAmbientParticles, destroyAmbientParticles } from '../systems/AmbientParticles.ts';

export const AUTOSAVE_INTERVAL_MS: number = 100000;

export default class WorldScene extends Phaser.Scene {
  activeChunks: Map<string, Phaser.GameObjects.Image>;
  lastPcx: number;
  lastPcy: number;
  nodes: Map<any, any>;
  enemies: any[];
  npcs: any[];
  loots: any[];
  projectiles: any[];
  buildings: Map<any, any>;
  needReskin: boolean;
  _frame: number;
  saveAcc: number;
  chunkGroup!: Phaser.GameObjects.Group;
  floats!: Floater;
  poiMarkerLayer!: Phaser.GameObjects.Layer;
  buildingLayer!: Phaser.GameObjects.Layer;
  player!: Player;
  env!: any;
  waterSystem!: any;
  postFX!: any;
  bossUI!: any;
  keys!: any;
  bindKeys!: any;
  pointerWorld!: any;
  _autosaveTimer?: Phaser.Time.TimerEvent;
  _lastPoiDirty: number = 0;
  _lastBiome?: string;

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

  preload(): void {
    preloadItemArtwork(this);
  }

  create(): void {
    const S = GameState.s;
    setWorldSeed(S.meta.seed);
    buildAllAssets(this);

    this.physics.world.setBounds(-WORLD_CONFIG.worldHalfExtent, -WORLD_CONFIG.worldHalfExtent, WORLD_CONFIG.worldHalfExtent * 2, WORLD_CONFIG.worldHalfExtent * 2);
    // SpawnDirector needs the entity constructors (injected so systems/
    // stays Phaser-free). Must run before any spawn call below.
    configureSpawning({ Enemy, BossEnemy });
    this.cameras.main.setBounds(-WORLD_CONFIG.worldHalfExtent, -WORLD_CONFIG.worldHalfExtent, WORLD_CONFIG.worldHalfExtent * 2, WORLD_CONFIG.worldHalfExtent * 2);
    this.cameras.main.setBackgroundColor('#141925');
    // Ensure camera rounds pixel positions to avoid sub-pixel blur on pixel art
    this.cameras.main.roundPixels = true;

    this.chunkGroup = this.add.group();
    this.floats = new Floater(this);
    this.poiMarkerLayer = this.add.layer();
    this.buildingLayer = this.add.layer();

    this.player = new Player(this, S.world.px ?? 0, S.world.py ?? 260);
    recompute();
    const D = S.player.derived!;
    S.player.hp = S.player.hp || D.maxHp;
    S.player.stamina = S.player.stamina ?? D.maxStamina;
    this.cameras.main.startFollow(this.player.sprite, true, 0.14, 0.14);
    this.applyCamZoom();
    (GameState.session as any).floatRenderer = (x: number, y: number, text: string, style: string) => this.floats.add(x, y, text, style);

    this.env = new EnvSystem(this);
    this.env.create();

    // Animated water overlay
    this.waterSystem = new WaterSystem(this);
    this.waterSystem.create();

    // Post-processing pipeline (bloom, vignette, color grade, chromatic
    // aberration). Honours settings.graphicsQuality — "low" disables
    // everything except the always-on vignette.
    this.postFX = new PostFXSystem(this);
    this.postFX.create();

    // Sync the atmosphere module with current game state.
    setFogEnabled(GameState.s?.settings?.distanceFog !== false);
    setAtmosphereState({
      timeOfDay: GameState.s?.world?.timeOfDay || 0.5,
      weather: GameState.s?.world?.activeWeather || 'clear'
    });
    // Switch from menu lullaby to world ambience — soothing explore/day music.
        import('../systems/AudioSystem.ts').then((a: any) => {
      try {
        const ph = (GameState.session as any).timePhase;
        a.setMood(ph === 'day' || ph === 'night' ? ph : 'explore');
      } catch { /* */ }
    });

    // Boss UI (boss bar) — Phase D: actually publishes session.activeBoss
    // so the BossBar overlay (now mounted in App.jsx) has data to render.
    // HP is refreshed every 30 frames in update() via refreshBossBar().
    this.bossUI = {
      _boss: null as any,
      _phase: 1 as number,
      show(boss: any): void {
        this._boss = boss; this._phase = 1;
        (GameState.session as any).activeBoss = { name: boss.def?.name || boss.key, hp: boss.hp, maxHp: boss.maxHp, phase: 1 };
        GameState.notify(CH.BOSSBAR);
        Bus.emit('boss-intro', boss.key);
      },
      setPhase(p: number): void {
        this._phase = p;
        if ((GameState.session as any).activeBoss) {
          (GameState.session as any).activeBoss.phase = p;
          GameState.notify(CH.BOSSBAR);
        }
      },
      hide(): void {
        this._boss = null;
        (GameState.session as any).activeBoss = null;
        GameState.notify(CH.BOSSBAR);
      }
    };

    this.setupInput();
    this.setupProjectiles();
    this.setupLoot();

    this.syncBuildingsFromState();
    this.spawnWildNpcs();
    this.syncPoisMarkers();
    this.refreshPlayerSkin();
    // Phase B: crafting station radius preview for the React panel.
    this.refreshStationsNear();
    (GameState.session as any).showStationRing = (station: any) => this.showStationRadius(station);
    // Phase C: night darkness-with-holes mask carries night lighting.
    if (this.env) this.env.useLightMask = true;

    this.time.addEvent({ delay: SETTLEMENT_CONFIG.productionTickSec * 1000, loop: true, callback: () => productionTick(this.player.pos) });
    // Autosave interval honours the player's setting; default still 100s.
    // We rebuild the timer if the user changes the value mid-session.
    const buildAutosaveTimer = (): void => {
      if (this._autosaveTimer) this._autosaveTimer.remove();
      const sec: number = Math.max(5, Number(getSetting('autosaveSec')) || 100);
      this._autosaveTimer = this.time.addEvent({
        delay: sec * 1000,
        loop: true,
        callback: () => {
          if (getSetting('autosave') !== false) {
            saveToSlot('auto', GameState.s);
            (GameState as any).toast({ title: 'Game saved', msg: 'Progress secured.', dur: 1800 });
          }
        }
      });
    };
    buildAutosaveTimer();
    Bus.on('settings-applied', buildAutosaveTimer);
    // Camera zoom follows the setting live (slider / HUD buttons / keys).
    Bus.on('settings-applied', () => { try { this.applyCamZoom(); } catch { /* ignore */ } });
    Bus.on('cam-zoom', (dir: any) => { try { this.nudgeCamZoom(dir); } catch { /* ignore */ } });

    GameState.notify(CH.WORLD);
    this.cameras.main.fadeIn(600);

    // Redraw screen-space overlays when the browser/canvas resizes.
    this.scale.on('resize', (_gameSize: any) => {
      this.env?.posVignette?.();
      this.env?.skyGlow?.setDisplaySize(this.scale.width * 2, this.scale.height * 2);
      if (this.env?.dangerVignette) this.env.dangerVignette.setDisplaySize(this.scale.width, this.scale.height);
    });
  }

  /* ── Update ─────────────────────────────────────────────────────────── */
  override update(_time: number, delta: number): void {
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
          if (this.player.sprite.body) (this.player.sprite.body as Phaser.Physics.Arcade.Body).enable = true;
        }
      }
    }
    const dt: number = Math.min(0.05, delta / 1000);
    this.env.update(dt);
    if (!S.session_dead) this.player.update(dt, this.envContextInput());

    // Sync atmospheric state so the chunk fog tint tracks time/weather.
    setAtmosphereState({
      timeOfDay: S.world.timeOfDay,
      weather: S.world.activeWeather
    });
    setFogEnabled(S.settings?.distanceFog !== false);

    this.updateChunks();
    const px: number = this.player.sprite.x, py: number = this.player.sprite.y;

    // Refresh dynamic point lights (campfires, torches) — slow cadence.
    if (this._frame % 30 === 0) refreshDynamicLights(this);

    // Update animated water overlay
    if (this.waterSystem) {
      const cam = this.cameras.main;
      this.waterSystem.update(dt, cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2,
        (GameState.session as any).timePhase === 'night', this.env?.weather || 'clear');
    }

    // Ambient particles (pollen, mist, birds) — cheap, throttled by quality.
    updateAmbientParticles(this, _time, dt);
    // Phase D: world-space drifting fog banks around the player.
    try { updateFogCards(this, dt); } catch { /* canvas unavailable */ }
    // Phase D: tutorial hint chain (one hint per 5s tick max).
    if (this._frame % 300 === 0) {
            import('../systems/TutorialSystem.ts').then((m: any) => { try { m.tutorialTick(); } catch { /* hints never crash */ } });
    }

    // Broadcast player world position so follow-the-player lights (torch)
    // can track without polling.
    if (this._frame % 2 === 0) {
      Bus.emit('player-pos', { x: px, y: py });
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      if ((e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2 < 1250 * 1250) e.update(dt, this.envContextInput());
      else if ((e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2 < 1800 * 1800) e.update(dt, this.envContextInput());
      // Phase D: raiders besiege buildings when the player won't engage.
      try { this.enemyRaidTick(e, px, py, dt); } catch { /* raid tick never crashes */ }
    }
    // Phase D: faction raid scheduler (~30s cadence).
    if (this._frame % 1800 === 0) {
            import('../systems/RaidSystem.ts').then((m: any) => { try { m.raidTick(this); } catch { /* raids never crash */ } });
    }
    GameState.session.inCombat = this.enemies.some((e) => !e.dead && e.sprite && (e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2 < 220 * 220);

    this.updateProjectiles(dt);
    this.updateLoot(px, py);
    this.updateGatherProximity(px, py);
    this.updatePoiProximity(px, py);
    this.updateNpcs(dt, px, py);
    this.gatherTick(dt);
    // Building Occlusion Transparency: fade buildings if player is standing behind them
    if (this._frame % 6 === 0 && this.buildings && this.buildings.size > 0) {
      for (const [, img] of this.buildings) {
        if (!img || !img.active) continue;
        const dx = Math.abs(px - img.x);
        const behind = dx < 48 && py < img.y + 10 && py > img.y - 70;
        const targetAlpha = behind ? 0.45 : 1.0;
        if (img.alpha !== targetAlpha) {
          img.setAlpha(targetAlpha);
        }
      }
    }
    this.floats.update(dt);
    if (this._frame % 6 === 0) this.updateMinimap(px, py);
    // Update ambient biome sounds every ~2 seconds
    if (this._frame % 120 === 0) {
      const biome = biomeAt(px, py);
      if (biome !== this._lastBiome) {
        this._lastBiome = biome;
                import('../systems/AudioSystem.ts').then((a: any) => a.updateAmbient(biome));
      }
    }

    if (this._frame++ % 30 === 0) {
      S.world.px = Math.round(this.player.sprite.x);
      S.world.py = Math.round(this.player.sprite.y);
      try { this.refreshBossBar(px, py); } catch { /* boss UI cosmetic */ }
    }
    // Phase C: night lighting mask redraw (every 4th frame, self-skips by day).
    if (this._frame % 4 === 0) {
      try { updateNightMask(this); } catch { /* canvas unavailable */ }
    }
    // Phase B cadence: station proximity follows the player; chunk relight
    // tracks the clock without per-frame tint churn.
    if (this._frame % 60 === 0) {
      try { this.refreshStationsNear(); } catch { /* player may be dead */ }
      try { this.relightChunks(); } catch { /* textures may be gone */ }
    }
    this.saveAcc += dt;
  }

  envContextInput(): any {
    return {
      keys: this.keys,
      bindKeys: this.bindKeys,
      pointer: this.input.activePointer,
      pointerWorld: this.pointerWorld,
      joystick: (GameState.session as any).joystick,
      mobileBlock: (GameState.session as any).mobileBlock,
      mobileSprint: (GameState.session as any).mobileSprint,
      uiBlocked: (GameState.session as any).uiPanel != null,
      ...this.env.envContext
    };
  }

  /* ── Chunk streaming (spec §52) ─────────────────────────────────────── */
  updateChunks(): void {
    const cs = WORLD_CONFIG.chunkSize;
    const pcx: number = Math.floor(this.player.sprite.x / cs);
    const pcy: number = Math.floor(this.player.sprite.y / cs);
    if (pcx === this.lastPcx && pcy === this.lastPcy) return;
    this.lastPcx = pcx;
    this.lastPcy = pcy;
    const r = WORLD_CONFIG.activeChunkRadius;
    const wanted = new Set<string>();
    const px: number = this.player.sprite.x;
    const py: number = this.player.sprite.y;
    // Fog-of-war memory: remember visited chunks so the minimap can dim
    // the unknown (was tracked in state but never written).
    try {
      const seen = GameState.s?.world?.exploredChunks;
      if (Array.isArray(seen)) {
        const known = new Set(seen);
        for (let cy = pcy - r; cy <= pcy + r; cy++) {
          for (let cx = pcx - r; cx <= pcx + r; cx++) {
            const k: string = `${cx},${cy}`;
            if (!known.has(k)) { known.add(k); seen.push(k); }
          }
        }
        // Cap memory: drop oldest while far beyond any reasonable trek.
        if (seen.length > 3000) seen.splice(0, seen.length - 3000);
      }
    } catch { /* minimap memory never blocks streaming */ }
    for (let cy = pcy - r; cy <= pcy + r; cy++) {
      for (let cx = pcx - r; cx <= pcx + r; cx++) {
        const key: string = `${cx},${cy}`;
        wanted.add(key);
        if (!this.activeChunks.has(key)) {
          const canvas = getChunkCanvas(cx, cy);
          // Apply atmospheric perspective (distance fog) right after paint.
          // Baked into the canvas; invalidated by chunkPainter.setAtmosphereState
          // when time-of-day or weather buckets change.
          const cxCenter: number = cx * cs + cs / 2;
          const cyCenter: number = cy * cs + cs / 2;
          applyFogToChunk(canvas, cxCenter - px, cyCenter - py);
          const texKey: string = `chunk_${cx}_${cy}`;
          if (!this.textures.exists(texKey)) {
            const tex = this.textures.createCanvas(texKey, cs, cs);
            const tctx = tex!.getContext();
            tctx.drawImage(canvas, 0, 0);
            tex!.refresh();
          }
          const img = this.add.image(cxCenter, cyCenter, texKey)
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
      const parts: number[] = key.split(',').map(Number);
      const x: number = parts[0] ?? 0;
      const y: number = parts[1] ?? 0;
      if (Math.abs(x - pcx) > r + 1 || Math.abs(y - pcy) > r + 1) {
        img.destroy();
        this.activeChunks.delete(key);
      }
    }
    evictFarChunks(pcx, pcy, r);
  }

  /** Deterministically populate a chunk with gather nodes + enemies + PoIs. */
  populateChunk(cx: number, cy: number): void {
    spawnSys.populateChunk(this, cx, cy);
  }

  spawnNode(type: string, x: number, y: number, stateKey: string, state: any): any {
    return spawnSys.spawnNode(this, type, x, y, stateKey, state);
  }

  rollEnemy(biomeId: string, rnd: number): any {
    return spawnSys.rollEnemy(biomeId, rnd);
  }

  spawnEnemy(key: string, x: number, y: number): any {
    return spawnSys.spawnEnemy(this, key, x, y);
  }

  /* ── Gathering (spec §13) — see systems/GatherSystem.js ─────────────── */
  gatherTick(_dt?: number): void {
    void _dt;
    gatherSys.gatherTick(this);
  }

  updateGatherProximity(px: number, py: number): void {
    gatherSys.updateGatherProximity(this, px, py);
  }

  doGather(): void {
    gatherSys.doGather(this);
  }

  breakNode(n: any, mult: number): void {
    gatherSys.breakNode(this, n, mult);
  }

  /* ── POIs → rewards (spec §35–37) ───────────────────────────────────── */
  updatePoiProximity(px: number, py: number): void {
    if (this._lastPoiDirty === undefined) this._lastPoiDirty = 0;
    if (performance.now() - this._lastPoiDirty < 700) return;
    this._lastPoiDirty = performance.now();
    for (const poi of (allPois() as any[])) {
      if (poi.discovered) continue;
      if ((poi.x - px) ** 2 + (poi.y - py) ** 2 < 260 * 260) this.discoverPoi(poi);
    }
  }

  discoverPoi(poi: any): void {
    if (poi.discovered) return;
    poi.discovered = true;
    GameState.s.world.discoveredPois.push(poi.id);
    (GameState as any).toast({ title: poi.label.toUpperCase(), msg: 'Location discovered · +65 XP', kind: 'discover', dur: 4200 });
    awardXP(65, 'discover');
        import('../systems/QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'discover', poiTag: poi.tag, poiKind: poi.kind, poi }));
    Bus.emit('poi-discovered', { poi });
    this.syncPoisMarkers();
        import('../systems/AchievementSystem.ts').then((a: any) => a.evaluateAll());
    if (poi.boss && !poi.looted) this.spawnEnemy(poi.boss, poi.x, poi.y);
    if (poi.kind === 'bandit_camp' && poi.chestTier) this.spawnChest(poi.x - 20, poi.y + 24, poi.chestTier, poi.id);
  }

  syncPoisMarkers(): void {
    this.poiMarkerLayer.removeAll(true);
    const known = new Set(GameState.s.world.discoveredPois);
    const owned = new Set(GameState.s.world.ownedCamps);
    for (const poi of (allPois() as any[])) {
      if (!known.has(poi.id) && !owned.has(poi.id)) continue;
      this.add.text(poi.x, poi.y - 42, poi.label, {
        fontFamily: 'Cinzel', fontSize: '12px', color: '#ffe9c9',
        stroke: '#241d17', strokeThickness: 3
      }).setDepth(90).setOrigin(0.5).setAlpha(0.9);
    }
  }

  /* ── Chests & loot (spec §70–71) ────────────────────────────────────── */
  spawnChest(x: number, y: number, tier: string, campId?: string): void {
    if (campId && GameState.s.world.poiStates[campId]?.looted) return;
    const img = this.add.image(x, y, tier).setDepth(5);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerdown', () => this.openChest(img, tier, campId));
  }

  openChest(img: Phaser.GameObjects.Image, tier: string, campId?: string): void {
    const S = GameState.s;
    const rng = Math.random;
    const pool = CHEST_POOLS;
    if (campId) S.world.poiStates[campId] = { ...(S.world.poiStates[campId] || {}), looted: true };
    for (const [id, qtyMax, chance] of (pool as any)[tier] || FALLBACK_CHEST_POOL) {
      if (rng() > (chance as number)) continue;
      const qty: number = 1 + Math.floor(rng() * (qtyMax as number));
      const left = addItem(id as string, qty);
      if (left < qty) this.floats.add(img.x, img.y - 30, `+${qty - left} ${itemName_of(id as string)}`, '#ffd66b');
    }
    GameState.notify(CH.INVENTORY);
    Bus.emit('play-sound', 'craft_done');
    img.setAlpha(0.3);
    if (campId && campId.startsWith('bcamp_') && !S.world.ownedCamps.includes(campId)) {
      S.world.ownedCamps.push(campId);
      (GameState as any).toast({ title: 'TERRITORY CAPTURED', msg: 'Your banner rises over this camp.', kind: 'stage', dur: 4200 });
            import('../systems/AchievementSystem.ts').then((a: any) => a.evaluateAll());
      this.add.image(img.x + 24, img.y - 34, 'banner').setDepth(5);
      setTimeout(() => {
                import('../systems/QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'territory-pct', pct: kingdomPct() }));
      }, 300);
    }
  }

  /* ── NPCs & recruitment (spec §21–22) ───────────────────────────────── */
  spawnWildNpcs(): void {
    const forged = GameState.s.settlement.citizens.map((c: any) => c.name);
    for (const poi of (allPois() as any[])) {
      if (poi.kind === 'camp_friend' || poi.kind === 'rescue') {
        const npcDef = getNpcDef(poi.npc);
        if (npcDef && forged.includes(npcDef.name)) continue;
        this.spawnNpc(poi.npc, poi.x + 8, poi.y + 14);
      }
    }
  }

  spawnNpc(key: string, x: number, y: number): any {
    return createNpc(this, key, x, y, (npc: any) => this.interactNpc(npc));
  }

  interactNpc(npc: any): void {
    const S = GameState.s;
    if (npc.def.req && !this.npcRequirementsMet(npc.def)) {
      (GameState as any).toast({ title: npc.def.name, msg: this.reqText(npc.def.req), kind: 'dialogue' });
      return;
    }
        import('../systems/QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'talk', npc: npc.key }));
    const lines = npc.def.dialogue || npc.def.greetLines || ['…'];
    (GameState.session as any).dialogue = { npc: npc.key, name: npc.def.name, portrait: npc.def.portrait, lines, actions: this.npcActions(npc) };
    if (npc.def.questGiver && isSideAvailable(npc.def.questGiver)) {
      (GameState.session as any).dialogue.actions.push({ label: 'Accept quest', fn: 'offerSideQuest', arg: npc.def.questGiver });
    }
    GameState.notify(CH.DIALOGUE);
  }

  npcRequirementsMet(def: any): boolean {
    const R = GameState.s;
    const req = def.req || {};
    if (req.rep && R.player.reputation < req.rep) return false;
    if (req.gold && R.player.gold < req.gold) return false;
    if (req.stage && (R.settlement.stageIndex || 0) < req.stage) return false;
    if (req.buildingNearby && !R.settlement.buildings.some((b: any) => b.key === req.buildingNearby && b.complete)) return false;
    if (req.questFlag && !R.story.flags[req.questFlag]) return false;
    return true;
  }

  reqText(req: any): string {
    const needs: string[] = [];
    if (req.rep) needs.push(`${req.rep} reputation`);
    if (req.gold) needs.push(`${req.gold} gold`);
    if (req.stage) needs.push(`${(['Camp','Camp','Village','Town','City','Kingdom','Empire'] as string[])[req.stage as number]} rank`);
    if (req.buildingNearby) needs.push(`${getBuildingDef(req.buildingNearby)?.label || req.buildingNearby} built`);
    return 'Requires ' + needs.join(' · ');
  }

  npcActions(npc: any): any[] {
    const out: any[] = [];
    if (npc.def.joinAs || npc.def.cost) {
      out.push({ label: npc.def.cost ? `Recruit (${npc.def.cost.gold} gold)` : 'Invite to your realm', fn: 'recruitNpc', arg: npc.key });
    }
    if (npc.def.merchant) out.push({ label: 'Trade', fn: 'openTrade', arg: npc.key });
    return out;
  }

  updateNpcs(dt: number, _px: number, _py: number): void {
    void _px; void _py;
    for (const npc of this.npcs) {
      const s = npc.sprite;
      // Skip AI if NPC is being talked to
      if ((GameState.session as any).dialogue?.npc === npc.key) {
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
            const angle: number = Math.random() * Math.PI * 2;
            const dist: number = 20 + Math.random() * (npc.wanderRadius - 20);
            npc.aiTargetX = npc.homeX + Math.cos(angle) * dist;
            npc.aiTargetY = npc.homeY + Math.sin(angle) * dist;
            // Determine direction
            const dx: number = npc.aiTargetX - s.x;
            const dy: number = npc.aiTargetY - s.y;
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
          const dx: number = npc.aiTargetX - s.x;
          const dy: number = npc.aiTargetY - s.y;
          const dist: number = Math.hypot(dx, dy);
          if (dist < 3 || npc.aiTimer <= 0) {
            // Arrived or timed out — stop and pause
            npc.aiState = 'pausing';
            npc.aiTimer = 2 + Math.random() * 5;  // pause 2–7 seconds
            npc.aiDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
            s.setFrame(`${npc.aiDir}_1`);
          } else {
            const speed = 28;  // pixels/sec — slow wander
            const step: number = Math.min(speed * dt, dist);
            s.x += (dx / dist) * step;
            s.y += (dy / dist) * step;
            // Walk animation cycle: frames 0→1→2→1 at ~6fps
            npc.aiWalkAccum += dt;
            if (npc.aiWalkAccum > 0.16) {
              npc.aiWalkAccum -= 0.16;
              npc.aiWalkFrame = (npc.aiWalkFrame + 1) % 4; // 0,1,2,1
            }
            const phase: number = npc.aiWalkFrame === 3 ? 1 : npc.aiWalkFrame;
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

  recruitNpcFrom(key: string): void {
    const npcDef = getNpcDef(key);
    if (!npcDef) return;
    const cost = npcDef.cost || {};
    if (cost.gold && GameState.s.player.gold < cost.gold) {
      (GameState as any).toast({ title: npcDef.name, msg: 'Not enough gold.', kind: 'warn' });
      return;
    }
    if (cost.gold) GameState.s.player.gold -= cost.gold;
    recruitCitizen({ name: npcDef.name, role: npcDef.joinAs || 'worker', skillLv: npcDef.skillRate ? Math.round(npcDef.skillRate) : 1 });
    addReputation(8);
    (GameState as any).toast({ title: `${npcDef.name} joins you!`, msg: npcDef.dialogue?.[0] || 'Welcome aboard.', kind: 'quest', dur: 4200 });
    const npc = this.npcs.find((n) => n.key === key);
    if (npc) { this.npcs = this.npcs.filter((n) => n !== npc); npc.sprite.destroy(); npc.shadow?.destroy(); }
    (GameState.session as any).dialogue = null;
    GameState.notify(CH.SETTLEMENT, CH.DIALOGUE, CH.PLAYER);
    kingdomRefresh();
  }

  openTradeFor(key: string): void {
    (GameState.session as any).tradeNpc = { key };
    (GameState.session as any).uiPanel = 'trade';
    GameState.notify(CH.SCREEN);
  }

  /* ── Buildings: placement, construction, upgrade (spec §24, §72) ────── */
  /* ── Settlement construction (delegated to systems/BuildSystem) ──── */
  syncBuildingsFromState(): void {
    buildSys.syncBuildingsFromState(this);
  }

  addBuildingSprite(b: any): any {
    return buildSys.addBuildingSprite(this, b);
  }

  buildingTexture(b: any): any {
    return buildSys.buildingTexture(b);
  }

  enterBuildMode(buildKey: string): void {
    buildSys.enterBuildMode(this, buildKey);
  }

  /** Check if a position is valid for building. Returns null if ok, else reason string. */
  canBuildAt(pos: any): any {
    return buildSys.canBuildAt(pos);
  }

  placeBuild(pos: any): void {
    buildSys.placeBuild(this, pos);
  }

  nearMountains(pos: any): any {
    return buildSys.nearMountains(pos);
  }

  animateConstruction(b: any): void {
    buildSys.animateConstruction(this, b);
  }

  upgradeBuilding(uid: string): any {
    return buildSys.upgradeBuilding(this, uid);
  }

  refreshStationsNear(): void {
    buildSys.refreshStationsNear(this);
  }

  /**
   * Phase B: draw the 200px station radius ring around each complete
   * building providing `station` (forge, kitchen, …). Called from the
   * crafting UI via `(GameState.session as any).showStationRing`. Auto-fades.
   */
  showStationRadius(station: any): void {
    buildSys.showStationRadius(this, station);
  }

  /**
   * Phase B: real ground relight. Tints active chunk images toward a cool
   * night blue (or warm dawn/dusk) instead of relying only on the dark
   * overlay — the ground itself now participates in day/night.
   */
  relightChunks(): void {
    const t = GameState.s.world.timeOfDay;
    const DAWN_T = 0.24, DUSK_T = 0.78;
    const isNight: boolean = t > DUSK_T || t < DAWN_T;
    const golden: boolean = (t > 0.2 && t < 0.3) || (t > 0.72 && t < 0.82);
    for (const img of this.activeChunks.values()) {
      if (!img || !img.scene) continue;
      if (isNight) img.setTint(0x8a94c0);
      else if (golden) img.setTint(0xffe2b8);
      else img.clearTint();
    }
  }

  /* ── Projectiles (spec §18) ─────────────────────────────────────────── */
  setupProjectiles(): void {
    this.projectiles = [];
  }

  spawnProjectile(o: any): any {
    const tex: string = o.kind === 'fireball' ? 'proj_fireball' : 'proj_arrow';
    const img = this.add.image(o.x, o.y, tex).setDepth(85).setRotation(o.angle);
    const dirx: number = Math.cos(o.angle), diry: number = Math.sin(o.angle);
    const p = { img, x: o.x, y: o.y, vx: dirx * o.speed, vy: diry * o.speed, dmg: o.dmg, crit: o.crit, pierce: o.pierce || 0, traveled: 0, maxDist: o.maxDist, owner: o.owner, enemy: o.enemy };
    this.projectiles.push(p);
    return p;
  }

  updateProjectiles(dt: number): void {
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
            const crit: boolean = Math.random() < (p.crit || 0);
            // NOTE: takeDamage already floats the number — no second floater (was double).
            e.takeDamage(Math.round(p.dmg * (crit ? 1.8 : 1)), p.x, p.y, this.floats, crit);
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

  destroyProjectile(p: any): void {
    p.img.destroy();
    this.projectiles = this.projectiles.filter((q) => q !== p);
  }

  /* ── Loot drops (delegated to systems/LootSystem — scene stays thin) ─── */
  setupLoot(): void {
    lootSys.setupLoot(this);
  }

  dropLoot(x: number, y: number, id: string, qty: number): any {
    return lootSys.dropLoot(this, x, y, id, qty);
  }

  dropLootGold(x: number, y: number, amount: number): void {
    lootSys.dropLootGold(this, x, y, amount);
  }

  updateLoot(px: number, py: number): void {
    lootSys.updateLoot(this, px, py);
  }

  pickLoot(l: any): void {
    lootSys.pickLoot(this, l);
  }

  /**
   * Phase E: player-remappable keys. WASD + arrows always move (fallbacks);
   * `bindKeys` holds the player's own movement/dodge/sprint alternatives and
   * `registerActionBinds()` wires the action keys. Unknown codes fall back
   * to defaults so a bad bind can never lock the player out.
   * (Delegated to systems/InputSystem — scene stays thin.)
   */
  bindCode(action: string, fallback: string): any {
    return inputSys.bindCode(action, fallback);
  }

  buildBindKeys(): any {
    return inputSys.buildBindKeys(this);
  }

  registerActionBinds(): void {
    inputSys.registerActionBinds(this);
  }

  /* ── Input (spec §5, §41 — delegated to systems/InputSystem) ────────── */
  setupInput(): void {
    inputSys.setupInput(this);
  }

  ghostTexture(): any {
    return buildSys.ghostTexture(this);
  }

  togglePause(): void {
    inputSys.togglePause(this);
  }

  togglePanel(name: string): void {
    inputSys.togglePanel(this, name);
  }

  /* ── Camera zoom (delegated to systems/InputSystem — scene stays thin) ─ */
  applyCamZoom(): any {
    return inputSys.applyCamZoom(this);
  }

  nudgeCamZoom(dir: number): void {
    inputSys.nudgeCamZoom(this, dir);
  }
  /* ── FX helpers (pooled, auto-destroy — fixes image leak) ────────── */
  fxHit(x: number, y: number): void {
    const img = this.add.image(x, y, 'fx_hitflash').setDepth(88).setScale(0.8);
    this.tweens.add({ targets: img, alpha: 0, scale: 1.15, duration: 180, onComplete: () => img.destroy() });
  }
  fxDeath(x: number, y: number): void {
    const img = this.add.image(x, y, 'fx_ring').setDepth(87).setAlpha(0.8);
    this.tweens.add({ targets: img, alpha: 0, scale: 1.6, duration: 300, onComplete: () => img.destroy() });
  }
  fxMelee(x: number, y: number, heavy: boolean): void { this.onMeleeImpact(x, y, heavy); }
  onMeleeImpact(x: number, y: number, heavy: boolean): void {
    this.spawnBurst(x, y, heavy ? 'fx_slash3' : 'fx_hitflash');
  }
  refreshPlayerSkin(): void {
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
  spawnBurst(x: number, y: number, tex: string): void {
    const img = this.add.image(x, y, tex).setDepth(86).setBlendMode('ADD').setAlpha(0.75);
    this.tweens.add({ targets: img, alpha: 0, scale: 1.25, duration: 220, onComplete: () => img.destroy() });
  }
  grantWarmth(sec: number): void {
    this.env.grantWarmth(sec);
  }

  /* ── Minimap (delegated to systems/MinimapSystem — scene stays thin) ─── */
  updateMinimap(px: number, py: number): void {
    minimapSys.updateMinimap(this, px, py);
  }

  /* ── Share helpers to other systems ────────────────────────────────── */
  onEnemyDeath(e: any): void {
    if (e.boss && this.bossUI?._boss === e) this.bossUI.hide();
    if (!e.boss) return;
    // chain quest progress for boss kills
        import('../systems/QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'kill', boss: e.key }));
  }

  /**
   * Phase D: raider siege AI. Raiders (`raider=true`, spawned by announced
   * raid parties) march on the settlement and batter buildings — but only
   * while the player stays away (within 260px the normal combat AI owns
   * them, since Enemy.update already ran this frame).
   */
  enemyRaidTick(e: any, px: number, py: number, dt: number): void {
    if (!e.raider || e.dead || !e.sprite?.body) return;
    const S = GameState.s;
    if (!S.settlement?.founded) return;
    const pd2: number = (e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2;
    if (pd2 < 260 * 260) return; // player engaged — normal AI handles it
    e._raidHitCd = Math.max(0, (e._raidHitCd || 0) - dt);
    // Nearest complete building.
    let best: any = null, bestD2 = 170 * 170;
    for (const b of S.settlement.buildings) {
      if (!b.complete) continue;
      const d2: number = (b.x - e.sprite.x) ** 2 + (b.y - e.sprite.y) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = b; }
    }
    if (!best) {
      // No building in reach — march on the Town Hall.
      const home = S.settlement.pos;
      if (home && bestD2 > 60 * 60) {
        const a: number = Math.atan2(home.y - e.sprite.y, home.x - e.sprite.x);
        (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(a) * e.atkSpd * 0.8, Math.sin(a) * e.atkSpd * 0.8);
      }
      return;
    }
    if (bestD2 > 60 * 60) {
      const a: number = Math.atan2(best.y - e.sprite.y, best.x - e.sprite.x);
      (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(a) * e.atkSpd, Math.sin(a) * e.atkSpd);
      return;
    }
    (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    if (e._raidHitCd > 0) return;
    e._raidHitCd = 1.6;
    const dmg: number = Math.max(2, Math.round(e.atk * 0.7));
    best.hp = Math.max(0, (best.hp ?? 100) - dmg);
    this.floats.add(best.x, best.y - 30, `-${dmg}`, '#ff9a7a', 1);
    this.fxHit(best.x, best.y - 10);
    Bus.emit('play-sound', 'build_thud');
    if (best.hp <= 0) this.destroyBuilding(best);
    else GameState.notify(CH.SETTLEMENT);
  }

  /** Phase D: a building reduced to 0 HP by raiders is destroyed. */
  destroyBuilding(b: any): void {
    buildSys.destroyBuilding(this, b);
  }

  /**
   * Phase E: post-death cleanup. Teleports nearby non-boss enemies away and
   * evades them so the player never respawns inside the pack that killed
   * them. Bosses stay (arena fights are opt-in and positional).
   */
  resetNearbyEnemies(radius = 700): void {
    const px: number = this.player.sprite.x, py: number = this.player.sprite.y;
    for (const e of this.enemies) {
      if (e.dead || !e.sprite || e.boss) continue;
      const d2: number = (e.sprite.x - px) ** 2 + (e.sprite.y - py) ** 2;
      if (d2 > radius * radius) continue;
      const a: number = Math.atan2(e.sprite.y - py, e.sprite.x - px) + (Math.random() - 0.5);
      e.sprite.setPosition(px + Math.cos(a) * (radius + 250), py + Math.sin(a) * (radius + 250));
      e.shadow?.setPosition(e.sprite.x, e.sprite.y + 3);
      e.evade();
    }
  }

  /** Phase D: keep the boss bar HP live; hide when the fight is abandoned. */
  refreshBossBar(px: number, py: number): void {
    const b = this.bossUI?._boss;
    if (!b || !(GameState.session as any).activeBoss) return;
    if (b.dead || !b.sprite) { this.bossUI.hide(); return; }
    const d2: number = (b.sprite.x - px) ** 2 + (b.sprite.y - py) ** 2;
    const leash: number = (b.radius || 520) + 300;
    if (d2 > leash * leash) { this.bossUI.hide(); return; }
    const ab = (GameState.session as any).activeBoss;
    const hp: number = Math.max(0, Math.ceil(b.hp));
    if (ab.hp !== hp) {
      ab.hp = hp;
      GameState.notify(CH.BOSSBAR);
    }
  }

  refreshSurvivalHud(): void {
    GameState.notify('PLAYER');
  }
}

/* ══════════════════ Module-level helpers ══════════════════ */

function itemName_of(id: string): string {
  return getItem(id)?.name || id;
}
function getItem_equip(id: string): any {
  return getItem(id);
}
function isSideAvailable(qid: string): boolean {
  const S = GameState.s;
  if (!S) return false;
  return !S.quests.sideActive.includes(qid) && !S.quests.sideCompleted.includes(qid);
}
function isSideDone(qid: string): boolean {
  return GameState.s?.quests?.sideCompleted?.includes(qid) || false;
}
function kingdomPct(): number {
  const S = GameState.s;
  const owned: number = S.world.ownedCamps.length + (S.settlement.founded ? 1 : 0);
  return Math.round((owned / 18) * 100);
}

/** Simple world-space floating combat/resource text pool. */
class Floater {
  scene: Phaser.Scene;
  items: any[];
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.items = [];
  }
  add(x: number, y: number, text: string, color = '#fff', scale = 1): void {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Spectral', fontSize: `${Math.round(15 * scale)}px`, color,
      stroke: '#241d17', strokeThickness: 3
    }).setOrigin(0.5).setDepth(900);
    // Apply FX per quality tier so critical / rare / heal pop visually.
    try {
      const quality: string = GameState.s?.settings?.graphicsQuality || 'med';
      if (quality !== 'low') {
        // Per-text bloom: a subtle outer glow makes damage numbers & loot
        // feel punchy. The strength scales with quality so 'low' stays cheap.
        const strength: number = quality === 'ultra' ? 1.6 : quality === 'high' ? 1.0 : 0.55;
        t.setBlendMode(Phaser.BlendModes.ADD);
        if ((t as any).postFX) (t as any).postFX.addBloom(parseInt(color.slice(1), 16) || 0xffe9a8, strength, 6, 0.4);
      }
    } catch { /* FX not available — fine */ }
    this.scene.tweens.add({
      targets: t, y: y - 34, alpha: 0, duration: 900,
      onComplete: () => t.destroy()
    });
  }
  update(_dt?: number): void { void _dt; /* tweens handle lifecycle */ }
}
