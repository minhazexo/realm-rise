# Attacks & Weapons Upgrade

> Sources: `Player.js:161-230`, `WorldScene.js:1058-1086,910-962,1123-1148`, `itemsGear.js`, `enemiesWild/Human.js`, `Enemy.js`, `BossEnemy.js`.
> Research: game-feel stacks (hit-flash 50–100ms → particles → shake → hitstop), VFX 4-lane readability (telegraph / impact / status / ambient), intensity presets per tier.

## 1. Today

| Attack | Input | State |
|---|---|---|
| Light slash | LMB | Works: 114° arc, `fx_slash2`, hitstop 35ms, shake 0.004, +1.5 stamina refund |
| Heavy slash | — dead code | `tryAttack({heavy:true})` exists but `WorldScene` always passes `heavy:false`; `requestHeavyRelease` doesn't exist; `war_heavy` skill never checked |
| Bow | LMB if `style==bow` | Works, no draw/hold, consumes arrows |
| Block | RMB hold + stationary | Works, shield-only, no moving block / parry |
| Dodge | SPACE | Works: 0.42s i-frames, 0.8s fixed cd, ghost trail |

Weapons: 13 (wood→dawnbreaker 6–36 dmg) + 3 shields + 7 tools. `slash/crush/pierce` share the same arc path — only `reachBonusVsAnimals` differs (and it's applied blindly, not per-target). `crossbow pierce:1` is the only real differentiator.
Enemies: 7 wild + 4 bandits + 4 bosses. FSM `IDLE→PATROL→CHASE→ATTACK→RETREAT→SEARCH→DEAD` but `DETECT` never entered, `kiter/charger/brute/pounce` tags ignored except `ranged`. Boss `beam_sweep` has no `runMove` case → 0.5s stall.

FX bugs: `spawnBurst/fxHit/fxDeath` never destroy (leak), `fxMelee(){}` empty, double damage floaters in `updateProjectiles`, arrows pass through walls.

## 2. Upgrade plan

### Phase A — done in this patch
- [x] **Hold-to-heavy:** `holdStart` on `pointerdown`; `pointerup` after >280ms + `heavyUnlocked` (or greatsword) → `tryAttack({heavy:true})`. Tap = light (no behavior change for existing players). Hint floater when locked.
- [x] **Style identity:** `slash` = 114° arc / balanced; `crush` (axe/greatsword) = 150° wide arc, 1.15× dmg, small self-slow, screen shake 1.5×; `pierce` (spear) = 40° narrow thrust, 1.35× range, 1.12× vs animals (per-target now), faster cd.
- [x] **FX leak fix:** `fxHit/fxDeath/spawnBurst` auto-fade + destroy (180–300ms). `fxMelee` wired to `onMeleeImpact`.
- [x] **Projectile double-floater fix:** single floater path via `takeDamage` only.
- [x] **Armor wear:** blocking / taking hits wears `offhand/chest/helmet` slowly; weapons wear as before. Repair kits now matter for armor.

### Phase B — implemented
- [x] Combos: light→light→finisher (3rd consecutive light within 0.9s: 1.5× dmg + 320 knockback shove + `Finisher!` floater + heavy-tier hitstop/shake). Heavy resets the chain.
- [x] Parry: block tapped within 150ms of impact → full negate + 6 stamina + `Parried!` floater (no stat check — reads as skill).
- [x] Moving block at 50% speed with tower-shield `movePenalty` applied (tooltip-visible stat, now mechanically real).
- [x] Enemy roles: `kiter`/archers hold `preferredRange` with strafe; `charger` (boar) 0.4s red telegraph then `chargeSpeedMult` dash; `brute` (bear/brute) AoE slam ring (`slamRadius`+30); `pounce` (wolves) leap with landing check.
- [x] Boss fixes: `beam_sweep` implemented (telegraph + 300px zap), shuffled move selection with `swipe` fallback (no more 0.5s stalls), `DETECT` `!` telegraph 0.35s before chase (graceful leash-break too).

### Phase C — feel tiers (per weapon JSON)
```
light chip:  hitstop 0 / shake 0 / flash 50ms / tick sound
medium:      hitstop 35ms / shake 0.004 / burst+debris / layered thud
heavy/crit:  hitstop 65–100ms / shake 0.008 directional / multi-layer + stinger
```
- VFX lanes: danger = red-orange only; player power = cyan-purple; ambient lowest priority + quality toggle.
- Accessibility: shake intensity slider, photosensitivity-safe flashes (target-only, never fullscreen).

## 3. Acceptance
- Hold LMB 300ms with `war_heavy` → heavy slash `fx_slash3` + 65ms hitstop; without skill → hint.
- Spear outranges sword; axe hits 3 clustered goblins where sword hits 2.
- 5-min spawn-camp: no leaked images (`scene.children.length` stable), no double numbers.
- Blind callout test: threat direction + hit confirm called correctly in a 3-enemy fight.
