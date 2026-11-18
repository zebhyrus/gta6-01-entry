// render.js — draws one frame: the city, skid marks, mission beacon, cars,
// pedestrians, police, rivals, the player, bullets and particles, then the
// HUD in screen space. The camera follows the player with smooth lag.

import { WORLD_SIZE, clamp, lerp } from './config.js';
import { drawCity } from './city.js';
import { drawCar, drawCars } from './vehicles.js';
import { drawPedestrians } from './pedestrians.js';
import { drawPolice, drawRivals } from './police.js';
import { drawPlayer, drawBullets } from './player.js';
import { drawMissionMarker } from './missions.js';
import { drawHUD, drawTitle, drawPaused, drawBusted, drawWasted } from './hud.js';

export function updateCamera(G, dt) {
  const tx = clamp(G.player.x - G.view.w / 2, 0, Math.max(0, WORLD_SIZE - G.view.w));
  const ty = clamp(G.player.y - G.view.h / 2, 0, Math.max(0, WORLD_SIZE - G.view.h));
  // Fast catch-up when far away, gentle lag when close: feels like a chase cam.
  const k = 1 - Math.exp(-6 * dt);
  G.camera.x = lerp(G.camera.x, tx, k);
  G.camera.y = lerp(G.camera.y, ty, k);
  G.camera.w = G.view.w;
  G.camera.h = G.view.h;
}

export function render(G) {
  const ctx = G.ctx;
  const w = G.view.w;
  const h = G.view.h;
  ctx.clearRect(0, 0, w, h);

  // World space.
  ctx.save();
  ctx.translate(-Math.round(G.camera.x), -Math.round(G.camera.y));
  drawCity(ctx, G.city, G.camera);

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,25,0.5)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const s of G.skids) {
    ctx.globalAlpha = Math.max(0, Math.min(0.5, s.life / 5));
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  drawMissionMarker(ctx, G, G.time);
  drawCars(ctx, G.cars);
  drawCars(ctx, G.policeCars);
  // The player's car is not in G.cars (it is the driven one): draw it here.
  if (G.player.inCar && G.player.car) drawCar(ctx, G.player.car);
  drawPedestrians(ctx, G.peds);
  drawPolice(ctx, G.policeCars, G.cops);
  drawRivals(ctx, G.rivals);
  drawPlayer(ctx, G.player);
  drawBullets(ctx, G.bullets);

  // Particles (sparks).
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Screen space: HUD and menus.
  if (G.mode === 'play' || G.mode === 'paused') {
    drawHUD(ctx, G);
  }
  if (G.mode === 'title') drawTitle(ctx, G);
  if (G.mode === 'paused') drawPaused(ctx, G);
  if (G.mode === 'busted') drawBusted(ctx, G);
  if (G.mode === 'wasted') drawWasted(ctx, G);

  // Vignette: a warm sun-soaked frame.
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(255,220,120,0)');
  grad.addColorStop(1, 'rgba(255,180,60,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}
