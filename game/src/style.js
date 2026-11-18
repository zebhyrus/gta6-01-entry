// style.js — the Roblox look, in one place: the bright toy palette and the
// shared blocky drawing helpers (people, cars, trees, buildings, studs).
// Every renderer imports its look from here, so the whole game stays one
// consistent toy world. No logic lives here — only drawing.

import { CAR } from './config.js';

// Classic toy palette: bright, saturated, playful.
export const RBX = {
  outline: '#1a1a22', // thick dark outline on everything
  grass: '#5fbd3f', // baseplate green
  parkGrass: '#46b832',
  sidewalk: '#bdbdbd',
  plot: '#e8e8e8', // studded plot under buildings
  street: '#7d7d7d',
  streetLine: '#ffe14f',
  path: '#e8d27a',
  water: '#0099ff',
  skin: ['#f5cd30', '#f2c89b', '#d9a066', '#8a5a2e', '#f7d7b0'], // classic yellow first
  pants: ['#1f4fd8', '#222222', '#d94f3d', '#3da66a', '#8a5fd0', '#e07b2e'],
  shirt: ['#ff3b30', '#0078ff', '#ffcf00', '#00c853', '#ff5fa2', '#8a5fd0', '#00b8d4', '#ff8a00'],
  car: ['#ff2e2e', '#0055ff', '#ffcf00', '#00c853', '#ff8a00', '#8a5fd0', '#ffffff', '#222222'],
  building: ['#ff3b30', '#0078ff', '#ffcf00', '#ff8a00', '#00c853', '#ff5fa2', '#8a5fd0', '#00b8d4'],
  roof: ['#b81f18', '#004a99', '#b8900a', '#b85c00', '#007a36', '#b8326a', '#5a3a99', '#007a99'],
  treeTrunk: '#8a5a2e',
  treeLeaf: '#3fd43f',
  treeLeafHi: '#7de87d',
  policeBlue: '#0055ff',
  copShirt: '#1e2a6e',
  rivalShirt: '#d41f1f',
  yellow: '#ffcf00',
  red: '#ff2e2e',
  blue: '#0055ff',
  green: '#00c853',
  white: '#ffffff',
};

// A filled rect with a thick dark outline — the toy look's basic stroke.
export function blockRect(ctx, x, y, w, h, fill, lw = 2) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = RBX.outline;
  ctx.lineWidth = lw;
  ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
}

// Classic baseplate studs: a grid of small lighter dots inside a rect.
export function drawStuds(ctx, x, y, w, h, gap = 26, color = 'rgba(255,255,255,0.28)') {
  ctx.fillStyle = color;
  const x0 = x + gap / 2;
  const y0 = y + gap / 2;
  for (let sx = x0; sx < x + w - 4; sx += gap) {
    for (let sy = y0; sy < y + h - 4; sy += gap) {
      ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5);
    }
  }
}

// --- blocky people ----------------------------------------------------------
// A classic blocky avatar, drawn facing +x (the caller rotates to `angle`):
// legs at the back, torso in the middle, arms at the sides, a square head
// at the front with two dot eyes and a small smile on top of it. From
// above it reads as a toy figure, not a circle.
export function drawBlockyPerson(ctx, opts) {
  const { shirt, pants, skin, cap = null, bob = 0, down = false, weapon = null } = opts;
  if (down) {
    // Lying flat on the ground: torso + head as flat blocks.
    ctx.save();
    blockRect(ctx, -14, -6, 28, 12, shirt);
    blockRect(ctx, 14, -6, 12, 12, skin);
    ctx.restore();
    return;
  }
  // Walking legs: two blocks that alternate forward/back with the bob.
  const legSwing = Math.max(-1, Math.min(1, bob)) * 3;
  blockRect(ctx, -15, -9 + legSwing * 0.4, 7, 6, pants);
  blockRect(ctx, -15, 3 - legSwing * 0.4, 7, 6, pants);
  // Torso.
  blockRect(ctx, -8, -9, 14, 18, shirt);
  // Arms: shirt sleeves with skin hands at the front edge.
  blockRect(ctx, -6, -14, 10, 5, shirt);
  blockRect(ctx, -6, 9, 10, 5, shirt);
  ctx.fillStyle = skin;
  ctx.fillRect(4, -14, 3, 5);
  ctx.fillRect(4, 9, 3, 5);
  // Head: a square with a face on it (two dot eyes + a small smile).
  blockRect(ctx, 6, -7, 12, 14, skin);
  ctx.fillStyle = RBX.outline;
  ctx.fillRect(12, -3.5, 2.4, 2.4);
  ctx.fillRect(12, 1.5, 2.4, 2.4);
  ctx.beginPath();
  ctx.arc(13.5, -0.5, 3, Math.PI * 0.15, Math.PI * 0.85);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = RBX.outline;
  ctx.stroke();
  // Cap: a coloured band over the back of the head + a small brim.
  if (cap) {
    ctx.fillStyle = cap;
    ctx.fillRect(6, -7, 7, 14);
    ctx.strokeStyle = RBX.outline;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6.5, -6.5, 6, 13);
    ctx.fillStyle = cap;
    ctx.fillRect(18, -4, 3.5, 8);
  }
  // Pistol in hand, pointing where the figure faces.
  if (weapon === 'pistol') {
    ctx.fillStyle = '#222222';
    ctx.fillRect(18, 3, 12, 4);
  }
}

// --- blocky trees -----------------------------------------------------------
export function drawBlockyTree(ctx, x, y, size) {
  // Brown trunk.
  ctx.fillStyle = RBX.treeTrunk;
  ctx.fillRect(x - 3, y, 6, size * 0.55);
  ctx.strokeStyle = RBX.outline;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 3, y, 6, size * 0.55);
  // Bright green cube canopy with a thick outline + a lighter top-left.
  const s = size * 1.35;
  blockRect(ctx, x - s / 2, y - s * 0.85, s, s, RBX.treeLeaf);
  ctx.fillStyle = RBX.treeLeafHi;
  ctx.fillRect(x - s / 2 + 3, y - s * 0.85 + 3, s * 0.4, s * 0.4);
}

// --- chunky buildings -------------------------------------------------------
// A bright solid block with a thick outline, a contrasting flat roof and
// simple square windows. `b` carries x, y, w, h, color, roof.
export function drawBlockyBuilding(ctx, b) {
  // Soft shadow, offset down-right.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
  // Body.
  blockRect(ctx, b.x, b.y, b.w, b.h, b.color, 3);
  // Flat roof, inset, in the contrasting colour.
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
  ctx.strokeStyle = RBX.outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
  // Simple windows: pale blue squares in a grid, every third one skipped.
  ctx.fillStyle = '#dff4ff';
  const cols = Math.max(1, Math.floor(b.w / 28));
  const rows = Math.max(1, Math.floor(b.h / 28));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 3 + Math.floor(b.x)) % 3 !== 0) continue;
      ctx.fillRect(b.x + 11 + i * 28, b.y + 11 + j * 28, 12, 10);
    }
  }
}

// --- chunky cars ------------------------------------------------------------
// A toy car: bright body with a thick outline, dark block wheels, a dark
// cabin, a light-blue windshield and head/taillights. Police cruisers get
// a black-and-white body with a flashing light bar.
export function drawChunkyCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = CAR.length;
  const W = CAR.width;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-L / 2 + 4, -W / 2 + 5, L, W);
  // Wheels: dark blocks at the four corners.
  ctx.fillStyle = '#1a1a22';
  for (const [wx, wy] of [[-14, -W / 2 - 2], [14, -W / 2 - 2], [-14, W / 2 - 3], [14, W / 2 - 3]]) {
    ctx.fillRect(wx, wy, 9, 5);
  }
  // Body.
  const body = car.kind === 'police' ? RBX.white : car.color;
  blockRect(ctx, -L / 2, -W / 2, L, W, body, 2.5);
  if (car.kind === 'police') {
    // Black-and-white cruiser: black hood and trunk bands.
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(-L / 2, -W / 2, 8, W);
    ctx.fillRect(L / 2 - 8, -W / 2, 8, W);
  }
  // Cabin: dark navy block in the middle.
  blockRect(ctx, -9, -W / 2 + 4, 18, W - 8, '#1e3a5f', 2);
  // Windshield: light blue strip at the front of the cabin.
  ctx.fillStyle = '#bfe8ff';
  ctx.fillRect(9, -W / 2 + 5, 4, W - 10);
  // Headlights (front) and taillights (rear).
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-L / 2 - 1, -W / 2 + 3, 3, 5);
  ctx.fillRect(-L / 2 - 1, W / 2 - 8, 3, 5);
  if (car.kind === 'police') {
    // Light bar, flashing red/blue.
    const flash = Math.floor(Date.now() / 180) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -W / 2 + 2, 8, 8);
    ctx.fillStyle = flash ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, W / 2 - 10, 8, 8);
  }
  ctx.restore();
}
