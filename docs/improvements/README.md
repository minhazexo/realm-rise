# Improvements — Knowledge & Quality Passes

Research-backed audits of the game, followed by implementation passes.
Each audit cites its sources; each plan maps findings to exact files.

| File | What's inside |
|------|---------------|
| `01-GAME-FEEL-AUDIT.md` | What juice exists (hitstop, shake, squash & stretch, telegraphs…), 10 gaps ranked, fixes list. Sources: 12 principles of animation, juice/game-feel guides. |
| `02-COMBAT-BALANCE-AUDIT.md` | Enemy FSM/style inventory, numbers tables, telegraphing/turn-rate/aggro findings. Sources: soulslike combat design, enemy-design essays. |
| `03-PERFORMANCE-AUDIT.md` | Frame-budget anatomy of `WorldScene.update`, hotspots (water foam #1), pooling priorities, GC notes. Sources: Phaser perf guide 2026, Game Programming Patterns. |
| `04-PROGRESSION-RETENTION-AUDIT.md` | XP-curve math vs. quest rewards, goal-ladder holes, citizen/economy loops, fast-travel gap. Sources: power-progression + retention research. |
| `05-IMPLEMENTATION-PLAN.md` | The batch ledger for pass 1 (bugs → feel → performance → balance), files touched, verification gates. |

## Pass 1 status — shipped

All Batch A–D items implemented and verified (`npm run typecheck` clean,
all 7 test suites green). Details in `docs/TODOs.md` → "Fixed in Quality
Pass 1" and `docs/Features.md` → "Game Feel (Quality Pass 1)".

## Candidate next passes (from the audits)

1. **Retention pass**: milestone achievements (early/mid), first-time-event
   toasts, fast-travel UI, consumable stats on item cards.
2. **Performance pass 2**: full offscreen foam-buffer cache; LRU chunk-canvas
   reuse; projectile/loot ring pooling; `player-pos` bus throttle.
3. **Content pass**: 2–3 unlock-style skills per branch, citizen skill
   growth, faction side quests, NPC rumor lines, camp re-capture tension.
4. **Balance pass 2**: death-drop reclaim piles, armor curve review,
   XP streak multiplier, bear/wolf pack tuning.
