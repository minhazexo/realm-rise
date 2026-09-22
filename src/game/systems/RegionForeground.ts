// ─────────────────────────────────────────────────────────────────────────────
// RegionForeground — the near-camera band of an authored region.
//
// Foreground foliage is authored ON the walkable path, so it draws above the
// hero (RegionLayout.FOREGROUND_DEPTH). The band reads as depth only if it can
// never hide your own character, so whatever the player is actually behind
// fades out — dt-scaled, allocation-free, and touching only that prop.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import { FOREGROUND_FADED_ALPHA, fadeAlpha, isBehind } from './RegionLayout.ts';
import { regionState } from './RegionState.ts';
import type { RegionScene } from './RegionState.ts';

/** Called by placement for every prop authored in the 'fg' band. */
export function registerForegroundProp(scene: RegionScene, img: Phaser.GameObjects.Image, base: number): void {
  regionState(scene).foreground.push({
    img,
    hw: img.displayWidth * 0.5,
    hh: img.displayHeight * 0.5,
    base,
  });
}

/** One frame of the fade: ease each prop toward (or back from) faded. */
export function tickForeground(scene: RegionScene, px: number, py: number, dt: number): void {
  for (const f of regionState(scene).foreground) {
    const behind: boolean = isBehind(px, py, { x: f.img.x, y: f.img.y, hw: f.hw, hh: f.hh });
    const next: number = fadeAlpha(f.img.alpha, behind ? FOREGROUND_FADED_ALPHA : f.base, dt);
    if (Math.abs(next - f.img.alpha) > 0.004) f.img.setAlpha(next);
  }
}
