// hud.js — the HUD (wanted stars, health, money, objective, speed, weapon),
// the minimap, and the title / pause / busted / wasted screens. All drawn
// on the main canvas in screen space, after the world is rendered.

import { WORLD_SIZE, COLORS } from './config.js';
import { missionObjectiveText, missionTarget, MISSIONS } from './missions.js';
import { isTouchDevice } from './touch.js';

function drawStar(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd94f' : 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawMinimap(ctx, G) {
  const size = 168;
  const x = G.view.w - size - 16;
  const y = 16;
  const s = size / WORLD_SIZE;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, size + 8, size + 8, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();

  // Streets.
  ctx.fillStyle = '#4a5064';
  for (const st of G.city.streets) {
    ctx.fillRect(x, y + st * s - 2, size, 4);
    ctx.fillRect(x + st * s - 2, y, 4, size);
  }
  // Water at the south edge.
  ctx.fillStyle = '#54b6d8';
  ctx.fillRect(x, y + size - 3, size, 3);
  // Landmarks.
  ctx.fillStyle = '#e8c832';
  for (const lm of Object.values(G.city.landmarks)) {
    ctx.fillRect(x + lm.x * s - 2, y + lm.y * s - 2, 4, 4);
  }
  // Traffic cars (white dots), police (flashing blue/red), player (green).
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const car of G.cars) {
    if (car.kind === 'traffic' || car.kind === 'parked') {
      ctx.fillRect(x + car.x * s - 1.5, y + car.y * s - 1.5, 3, 3);
    }
  }
  const flash = Math.floor(Date.now() / 300) % 2 === 0;
  ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
  for (const car of G.policeCars) {
    ctx.beginPath();
    ctx.arc(x + car.x * s, y + car.y * s, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target: a pulsing yellow star.
  const target = missionTarget(G);
  if (target) {
    const pulse = 4 + Math.sin(Date.now() / 200) * 1.5;
    ctx.fillStyle = '#ffdc50';
    ctx.beginPath();
    ctx.arc(x + target.x * s, y + target.y * s, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(x + G.player.x * s, y + G.player.y * s);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#2eff7a';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
  // "N" compass tick.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x + size / 2, y + size + 16);
}

export function drawHUD(ctx, G) {
  const w = G.view.w;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Wanted stars, top-left.
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, 30 + i * 30, 32, 12, i < G.wanted.stars);
  }
  if (G.wanted.stars > 0) {
    ctx.fillStyle = '#ff5a4f';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText('WANTED', 24, 58);
  }

  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(20, 66, 150, 14, 7);
  ctx.fill();
  ctx.fillStyle = G.player.hp > 35 ? '#3ddc6a' : '#ff5a4f';
  ctx.beginPath();
  ctx.roundRect(20, 66, 150 * Math.max(0, G.player.hp / 100), 14, 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillText(`HP ${Math.ceil(G.player.hp)}`, 26, 77);

  // Money.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(20, 88, 150, 26, 7);
  ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText(`$${G.player.money.toLocaleString('en-US')}`, 30, 107);

  // Mission objective, top-centre. Shrink the font on narrow screens so
  // the whole objective stays readable instead of running off the edges.
  // On a narrow screen the bar would run under the minimap, so drop it
  // below the minimap instead.
  const obj = missionObjectiveText(G);
  let objSize = 15;
  ctx.font = `bold ${objSize}px Arial, sans-serif`;
  let tw = ctx.measureText(obj).width;
  while (tw + 32 > w - 16 && objSize > 11) {
    objSize -= 1;
    ctx.font = `bold ${objSize}px Arial, sans-serif`;
    tw = ctx.measureText(obj).width;
  }
  const objY = (w / 2 + tw / 2 + 16 > w - 184) ? 206 : 12;
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - tw / 2 - 16, objY, tw + 32, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe14f';
  ctx.textAlign = 'center';
  ctx.fillText(obj, w / 2, objY + 20);
  ctx.textAlign = 'left';

  // Bust meter warning.
  if (G.bustMeter > 0.3) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE POLICE ARE GRABBING YOU — RUN!', w / 2, 64);
    ctx.textAlign = 'left';
  }

  // Speed + vehicle, bottom-left.
  if (G.player.inCar && G.player.car) {
    const kmh = Math.round(Math.abs(G.player.car.speed) * 0.18);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(20, G.view.h - 66, 170, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(`${kmh} km/h`, 32, G.view.h - 40);
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#cfd6e4';
    ctx.fillText(G.player.car.kind === 'police' ? 'Solmar PD Cruiser' : 'Street car', 32, G.view.h - 24);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(20, G.view.h - 66, 250, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '13px Arial, sans-serif';
    if (isTouchDevice()) {
      ctx.fillText('Stick — move · CAR — get in', 32, G.view.h - 44);
      ctx.fillText(G.player.weapon === 'pistol' ? `SHOOT — fire (${G.player.ammo} ammo) · SWITCH` : 'PUNCH — hit · SWITCH — weapon', 32, G.view.h - 26);
    } else {
      ctx.fillText('E — get in a car    F — punch', 32, G.view.h - 44);
      ctx.fillText(G.player.weapon === 'pistol' ? `G / click — shoot (${G.player.ammo} ammo)  Q — switch` : 'F — punch    Q — switch weapon', 32, G.view.h - 26);
    }
  }

  // Toasts (mission briefings, rewards), bottom-centre. Shrink the font
  // on narrow screens so a long toast stays on screen. On touch devices
  // they sit above the button cluster so the buttons never cover the text.
  let ty = isTouchDevice() ? G.view.h - 260 : G.view.h - 120;
  for (const toast of G.toasts) {
    if (toast.t <= 0) continue;
    let tSize = 16;
    ctx.font = `bold ${tSize}px Arial, sans-serif`;
    let ttw = Math.max(ctx.measureText(toast.text).width, toast.sub ? ctx.measureText(toast.sub).width : 0);
    while (ttw + 36 > w - 16 && tSize > 12) {
      tSize -= 1;
      ctx.font = `bold ${tSize}px Arial, sans-serif`;
      ttw = Math.max(ctx.measureText(toast.text).width, toast.sub ? ctx.measureText(toast.sub).width : 0);
    }
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - ttw / 2 - 18, ty - 22, ttw + 36, toast.sub ? 52 : 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe14f';
    ctx.textAlign = 'center';
    ctx.fillText(toast.text, w / 2, ty);
    if (toast.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(11, tSize - 3)}px Arial, sans-serif`;
      ctx.fillText(toast.sub, w / 2, ty + 20);
    }
    ctx.textAlign = 'left';
    ty -= toast.sub ? 66 : 46;
  }

  drawMinimap(ctx, G);
  ctx.restore();
}

function wrapLine(ctx, text, maxW) {
  // Greedy word wrap for the overlay panels, so long lines fit a narrow
  // phone screen instead of running off its edges.
  const words = text.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function overlayPanel(ctx, G, title, lines, accent) {
  const w = G.view.w;
  const h = G.view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,20,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,14,24,0.88)';
  const pw = Math.min(640, w - 60);
  // Wrap the body lines to the panel width; shrink the font on short
  // screens (landscape phones) so the panel still fits vertically.
  let wrapped = lines;
  let fontSize = 15;
  for (const size of [15, 13, 11]) {
    ctx.font = `${size}px Arial, sans-serif`;
    const attempt = lines.flatMap((line) => wrapLine(ctx, line, pw - 32));
    if (110 + attempt.length * 30 <= h - 24 || size === 11) {
      wrapped = attempt;
      fontSize = size;
      break;
    }
  }
  const ph = 110 + wrapped.length * 30;
  ctx.beginPath();
  ctx.roundRect(w / 2 - pw / 2, h / 2 - ph / 2, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = accent || '#ffd94f';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd94f';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillText(title, w / 2, h / 2 - ph / 2 + 52);
  ctx.fillStyle = '#fff';
  ctx.font = `${fontSize}px Arial, sans-serif`;
  wrapped.forEach((line, i) => {
    ctx.fillText(line, w / 2, h / 2 - ph / 2 + 92 + i * 30);
  });
  ctx.restore();
}

export function drawTitle(ctx, G) {
  const done = G.save ? G.save.missionsDone : 0;
  const touch = isTouchDevice();
  overlayPanel(ctx, G, 'SOLMAR HEAT', [
    'You are Danny Reyes, getaway driver for Mara Solis and her Solmar crew.',
    'Steal cars, outrun the Solmar PD, and finish all five jobs.',
    `Progress saved: ${done} of ${MISSIONS.length} jobs done · $${(G.save ? G.save.money : 0).toLocaleString('en-US')} banked`,
    touch
      ? 'Left stick — move & drive · CAR — get in / out of a car · PUNCH'
      : 'WASD / arrows — move & drive · E — get in / out of a car · F — punch',
    touch
      ? 'SHOOT — fire (auto-aim) · SWITCH — weapon · PAUSE'
      : 'G / click — shoot (pistol) · Q — switch weapon · P / Esc — pause',
    touch ? 'Tap anywhere to start' : 'Press ENTER or click to start',
  ], '#ffd94f');
}

export function drawPaused(ctx, G) {
  const touch = isTouchDevice();
  overlayPanel(ctx, G, 'PAUSED', [
    'Progress saves automatically after every job.',
    touch
      ? 'Left stick — move & drive · CAR — car · PUNCH · SHOOT'
      : 'WASD / arrows — move & drive · E — car · F — punch · G — shoot',
    touch ? 'Tap anywhere or PAUSE to resume' : 'P / Esc — resume · R — restart the current job',
  ]);
}

export function drawBusted(ctx, G) {
  overlayPanel(ctx, G, 'BUSTED!', [
    `The Solmar PD caught you and took $${G.bustedLost.toLocaleString('en-US')}.`,
    'Your wanted level is cleared. The crew is not happy.',
    'Press ENTER to get back on the street',
  ], '#ff5a4f');
}

export function drawWasted(ctx, G) {
  overlayPanel(ctx, G, 'WASTED', [
    'Danny is down. The crew patched him up at Solmar General.',
    `The hospital bill was $${G.bustedLost.toLocaleString('en-US')}.`,
    'Press ENTER to get back on the street',
  ], '#ff5a4f');
}

export function drawAllDone(ctx, G) {
  // Small banner shown once when the final job completes.
  if (!G.mission.allDone) return;
}
