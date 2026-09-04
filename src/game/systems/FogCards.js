// ─────────────────────────────────────────────────────────────────────────────
// FogCards (Phase D): world-space drifting fog banks.
//
// Unlike AmbientParticles (screen-space), these are real world objects —
// large soft `pt_smoke` cards that drift with the wind around the player and
// recycle when left behind. Density follows weather + biome: heavy in fog /
// swamp / riverlands, light night mist elsewhere. Respects the particles
// quality setting (off = no cards).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { particleMultiplier } from './SettingsSystem.js';
import { biomeAt } from '../world/worldGen.js';

const POOL = 10;
const SPREAD = 520;

/** Desired card count from weather + biome + time. */
function wantedCount(weather, biome, isNight) {
  let n = 0;
  if (weather === 'fog') n += 8;
  else if (weather === 'drizzle' || weather === 'storm') n += 4;
  else if (weather === 'snow') n += 2;
  if (biome === 'swamp' || biome === 'riverlands') n += 3;
  if (isNight) n += 2;
  if (weather === 'heat') n = Math.min(n, 1);
  return Math.min(POOL, n);
}

function windFor(weather) {
  switch (weather) {
    case 'storm': return { x: 46, y: 6 };
    case 'snow': return { x: 12, y: 4 };
    case 'heat': return { x: 6, y: -8 };
    default: return { x: 14, y: 2 };
  }
}

export function updateFogCards(scene, dt) {
  const S = GameState.s;
  const p = scene.player?.sprite;
  if (!S || !p || particleMultiplier() <= 0) {
    if (scene._fogCards) for (const c of scene._fogCards) c.img.setVisible(false);
    return;
  }
  if (!scene.textures.exists('pt_smoke')) return;

  if (!scene._fogCards) {
    scene._fogCards = [];
    for (let i = 0; i < POOL; i++) {
      const img = scene.add.image(p.x, p.y, 'pt_smoke')
        .setDepth(60)
        .setAlpha(0)
        .setScale(5 + Math.random() * 5)
        .setVisible(false);
      scene._fogCards.push({ img, vx: 0, vy: 0 });
    }
  }

  const t = S.world?.timeOfDay ?? 0.5;
  const isNight = t > 0.78 || t < 0.24;
  const weather = S.world?.activeWeather || scene.env?.weather || 'clear';
  let biome = 'plains';
  try { biome = biomeAt(p.x, p.y); } catch { /* default */ }
  const want = Math.round(wantedCount(weather, biome, isNight) * particleMultiplier());
  const wind = windFor(weather);

  scene._fogCards.forEach((c, i) => {
    const on = i < want;
    c.img.setVisible(on);
    if (!on) return;
    // Recycle cards that drifted too far behind the player.
    const dx = c.img.x - p.x, dy = c.img.y - p.y;
    if (dx * dx + dy * dy > (SPREAD + 120) ** 2 || c.img.alpha <= 0) {
      c.img.setPosition(p.x + (Math.random() - 0.5) * SPREAD * 2, p.y + (Math.random() - 0.5) * SPREAD * 1.4);
      c.vx = wind.x * (0.7 + Math.random() * 0.6);
      c.vy = wind.y * (0.7 + Math.random() * 0.6);
      c.img.setAlpha(0.05 + Math.random() * 0.07);
      c.img.setScale(5 + Math.random() * 6);
      c.img.setTint(weather === 'heat' ? 0xffddaa : isNight ? 0x8a94b8 : 0xdfe4ec);
    }
    c.img.x += c.vx * dt;
    c.img.y += c.vy * dt;
  });
}
