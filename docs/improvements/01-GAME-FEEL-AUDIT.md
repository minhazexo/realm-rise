# Game Feel Audit — Rise of the Realm

Findings from a full read of `src/game/` (WorldScene, Player, Enemy, BossEnemy,
GatherSystem, LootSystem, EnvSystem, PostFXSystem, NightLights, AmbientParticles,
FogCards, WaterSystem, DynamicLights, AudioSystem) cross-checked against industry
"game juice" research (hitstop, screen shake, squash & stretch, telegraphing,
anticipation, idle micro-animation — see Sources).

---

## What already exists (good baseline — don't regress it)

| Technique | Where |
|---|---|
| Hitstop (freeze frames on hit) | `Player.hitstopTimer`, 35–65 ms by severity |
| Camera shake, settings-aware | `shakeAllowed()` in Player/Enemy/BossEnemy |
| Hit flash + squash & stretch on enemies | `Enemy.takeDamage` (FILL tint + 1.12/0.88 scale tween) |
| Damage numbers with per-quality bloom | `WorldScene.Floater` |
| Enemy health bars, 3-stage color | `Enemy.refreshHealthBar` |
| Attack telegraphs (DETECT tint, windup red tint, `!` floater) | `Enemy.enterChase`, `Enemy.update` |
| Dodge i-frames + after-image trail | `Player.update` (`_dodgeTrailTimer`) |
| Parry window (150 ms) with stamina reward | `Player.takeDamage` |
| Combo finisher (3rd light hit, 1.5×+knockback) | `Player.tryAttack` |
| Loot magnet drift + rarity glow rings | `LootSystem` |
| Gather hit-pips + node wiggle | `GatherSystem.doGather` |
| Day/night: stars twinkle, golden hour grade, night mask w/ light holes | `EnvSystem`, `NightLights` |
| Ambient particles: pollen, leaves, fireflies, birds, mist | `AmbientParticles`, `EnvSystem` |
| Wind sway on trees, footstep dust puffs | `EntityFactory.createResource`, `Player.updateWalkAnim` |
| Procedural SFX w/ shared delay+reverb FX bus | `audioSfx.ts` |
| PostFX: vignette, bloom, chromatic aberration, quality tiers | `PostFXSystem` |
| Danger vignette pulses at low HP (reduced-motion aware) | `EnvSystem.update` |

## Gaps found (ranked by player impact)

### 1. Idle "breathing" is missing (medium impact, tiny cost)
`Player` and `Enemy` when standing still show a **static frame** (`${dir}_1`).
Research (MOCAP/animschool/garagefarm guides) says slow scale-y "breathing"
(±1.5 %, ~0.6 Hz) plus an occasional blink/fidget sells "alive" for near-zero
cost. The sprite sheets are 3-frame walk cycles; we can synthesize breathing on
the *sprite transform* without new art.

### 2. Level-up moment is flat (high impact)
`ProgressionXP.awardXP` emits `level-up` → `AudioSystem` plays a jingle. There
is **no visual ceremony**: no ring burst under the player, no gold shockwave,
no camera zoom-punch, no floating "LEVEL 7!" banner. The Project spec (§8)
explicitly asks for "satisfying XP animation, level-up animation, sound,
notification".

### 3. Kill feedback lacks a "victory beat"
`Enemy.die()` does fxDeath ring + fade. Combat reward loop (kill → stamina
refund → XP) is invisible: no gold/XP float anchored at the corpse, no small
time-scale dip. A 60 ms `hitstop`-style pause on boss kills + an XP orb float
would make kills feel like wins.

### 4. Melee swing has no anticipation
`Player.tryAttack` places the slash FX at the final angle instantly. The 12-
animation-principles read: add a 40–60 ms *backswing* (scale the player sprite
toward -x of the swing direction) before the slash tween. Cheap version: tiny
sprite scaleX pulse before the arc.

### 5. Bow shots have no feedback at the bow
Arrow spawns silently (sound only). No bow "draw" tension, no muzzle-flash
equivalent, no projectile trail. A 2-sprite trail (after-images) on arrows is
cheap and makes ranged combat readable.

### 6. Camera does not "breathe" with action
Fixed follow (`0.14, 0.14` lerp). Industry trick: zoom slightly by state —
zoom-out 4 % in combat, tiny zoom-in punch on heavy hits. `InputSystem`
already has zoom clamps; a `combatZoomBias` tween is ~10 lines.

### 7. Gathering: no per-hit particles
`doGather` shows hit pips and wiggles the node, but wood chips / stone sparks
only appear on the *break*. Per-hit micro-burst (3 particles, tinted by node
resource) is the standard.

### 8. Toasts for combat events spam the same channel
Quest/discover/combat all use `GameState.toast`. HUD-anchored transient text
(e.g. "+6 stamina" on kill) is missing; the float renderer exists and is the
right tool.

### 9. Water overlay redraws whole screen every 3rd frame at full res
`WaterSystem.update` clears + redraws waves, foam (nested per-pixel loop at
FOAM_STEP=16 over 840×840 world area!), sparkles. On 1080p that's ~2000 fill
circles per redraw. Cheaper: render foam to a small offscreen buffer (÷2) once
per second and blit with alpha oscillation.

### 10. Enemy DETECT tint lingers
`Enemy.update` sets `sprite.setTint(0xffd08a)` in DETECT and clears only in
some paths (`IDLE` break sets clearTint, `CHASE` sets 0xff9a6a, ATTACK leaves
whatever was last). If the player dies mid-fight, `S.session_dead` early-return
leaves the tint stuck. A `clearTint()` in the dead/session-exit path fixes
"permanently orange wolf".

## Concrete fixes to implement (this pass)

1. **Idle breathing** — Player + Enemy: subtle `scaleY` oscillation when
   `moving == false` and not dead. Respect `reducedMotion`.
2. **Level-up ceremony** — on `level-up` bus event: `fx_ring` burst ×2 at
   player, gold `fx_light` flash, float `LEVEL {n}!`, brief camera zoom punch.
   All behind `photosensitiveMode()` / `reducedMotion` guards.
3. **Kill reward beat** — in `Enemy.die`, float `+{xp} XP` gold above corpse;
   boss deaths add hitstop 0.12 + bigger shake.
4. **Anticipation backswing** — 50 ms scaleX 0.92 pulse on player sprite at
   attack start (skip when heavy for distinct feel: scale 0.85).
5. **Arrow trail** — after-images every 40 ms while a projectile lives.
6. **Per-hit gather particles** — `spawnBurst` with node-resource tint on
   every swing, not just break.
7. **Camera combat bias** — `inCombat` ⇒ target zoom ×0.96; smooth lerp in
   `applyCamZoom`.
8. **Fix stuck enemy tint** — clear tint on session_dead exit path.
9. **Foam buffer optimization** — cache shore-foam dots to a half-res canvas
   refreshed when camera cell changes.

## Sources

- "The 'Juice' Factor: Designing Game Feel" (hackread, 2026) — hitstop, sound,
  animation, feedback loops as the core of feel.
- Game Developer, "The 12 principles of animation in video games" (2019) —
  squash & stretch, anticipation, follow-through for game actions.
- generalistprogrammer.com "Phaser Performance Optimization Guide" (2026) —
  object pooling, draw-call batching, physics culling, GC avoidance.
- MOCAP / animschool / garagefarm idle-animation guides — breathing loops,
  micro-fidgets, offset timing to avoid robotic feel.
- Game Programming Patterns, "Spatial Partition" — proximity culling for AI.
