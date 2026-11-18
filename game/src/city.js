// city.js — Solmar, a fictional sun-soaked coastal city.
// A grid of blocks separated by streets, with buildings, parks, palm trees,
// and named landmarks the missions use. Generation is seeded, so the city
// (and every screenshot) is identical on every load for a given seed.

import { CITY, WORLD_SIZE, COLORS, streetCenters, mulberry32, clamp } from './config.js';

// Landmark blocks (bx, by) on the 8x8 grid.
const LANDMARK_BLOCKS = {
  policeHQ: { bx: 0, by: 0, label: 'Solmar PD HQ', color: '#2b4fd8' },
  safehouse: { bx: 7, by: 0, label: 'Safehouse', color: '#3da66a' },
  bank: { bx: 4, by: 3, label: 'Solmar Bank', color: '#e8c832' },
  docks: { bx: 0, by: 7, label: 'The Docks', color: '#54b6d8' },
  marina: { bx: 7, by: 7, label: 'Marina', color: '#54b6d8' },
  plaza: { bx: 3, by: 4, label: 'Plaza del Sol', color: '#e07b2e' },
  hospital: { bx: 6, by: 2, label: 'Solmar General', color: '#e8e8e8' },
};

function blockRect(bx, by) {
  return {
    x: CITY.street + bx * (CITY.block + CITY.street),
    y: CITY.street + by * (CITY.block + CITY.street),
    w: CITY.block,
    h: CITY.block,
  };
}

// A mission target sits on the street just above a landmark block, so a car
// can actually reach it.
function landmarkTarget(bx, by) {
  const r = blockRect(bx, by);
  return { x: r.x + r.w / 2, y: r.y - CITY.street / 2 };
}

export function generateCity(seed) {
  const rand = mulberry32(seed);
  const streets = streetCenters();
  const blocks = [];
  const buildings = [];
  const trees = [];
  const landmarks = {};

  const landmarkAt = {};
  for (const [key, lm] of Object.entries(LANDMARK_BLOCKS)) {
    landmarkAt[`${lm.bx},${lm.by}`] = key;
  }

  for (let by = 0; by < CITY.blocks; by++) {
    for (let bx = 0; bx < CITY.blocks; bx++) {
      const r = blockRect(bx, by);
      const lmKey = landmarkAt[`${bx},${by}`];
      const isPark = !lmKey && rand() < 0.16;
      const block = { ...r, type: lmKey ? 'landmark' : isPark ? 'park' : 'city', label: null };
      if (lmKey) {
        block.label = LANDMARK_BLOCKS[lmKey].label;
        block.landmarkColor = LANDMARK_BLOCKS[lmKey].color;
        landmarks[lmKey] = { ...landmarkTarget(bx, by), bx, by, label: LANDMARK_BLOCKS[lmKey].label };
      }
      if (block.type === 'park') {
        for (let i = 0; i < 7; i++) {
          trees.push({
            x: r.x + 30 + rand() * (r.w - 60),
            y: r.y + 30 + rand() * (r.h - 60),
            size: 14 + rand() * 10,
          });
        }
      } else if (block.type === 'city' || block.type === 'landmark') {
        // 1-3 buildings per block, inset from the block edge (sidewalk ring).
        const count = 1 + Math.floor(rand() * 3);
        const margin = 26;
        for (let i = 0; i < count; i++) {
          const bw = 70 + rand() * 110;
          const bh = 70 + rand() * 110;
          const bx0 = r.x + margin + rand() * Math.max(1, r.w - margin * 2 - bw);
          const by0 = r.y + margin + rand() * Math.max(1, r.h - margin * 2 - bh);
          const b = { x: bx0, y: by0, w: bw, h: bh };
          // Keep buildings from overlapping each other in the same block.
          if (buildings.some((o) => o.x < b.x + b.w + 12 && o.x + o.w + 12 > b.x && o.y < b.y + b.h + 12 && o.y + o.h + 12 > b.y)) {
            continue;
          }
          const ci = Math.floor(rand() * COLORS.building.length);
          b.color = COLORS.building[ci];
          b.roof = COLORS.roof[ci];
          b.height = 8 + rand() * 22; // fake height for the shadow offset
          buildings.push(b);
          block.buildings = block.buildings || [];
          block.buildings.push(b);
        }
      }
      blocks.push(block);
    }
  }

  // Palm trees along the sidewalks, spaced out.
  for (let i = 0; i < 90; i++) {
    const h = streets[Math.floor(rand() * streets.length)];
    const v = streets[Math.floor(rand() * streets.length)];
    const along = rand() * WORLD_SIZE;
    if (rand() < 0.5) {
      trees.push({ x: clamp(along, 20, WORLD_SIZE - 20), y: h + (rand() < 0.5 ? -46 : 46), size: 12 + rand() * 8 });
    } else {
      trees.push({ x: v + (rand() < 0.5 ? -46 : 46), y: clamp(along, 20, WORLD_SIZE - 20), size: 12 + rand() * 8 });
    }
  }

  return { size: WORLD_SIZE, streets, blocks, buildings, trees, landmarks, seed };
}

// --- rendering ---------------------------------------------------------------

export function drawCity(ctx, city, cam) {
  const { x: cx, y: cy, w: vw, h: vh } = cam;
  const x0 = Math.max(0, cx - 60);
  const y0 = Math.max(0, cy - 60);
  const x1 = Math.min(city.size, cx + vw + 60);
  const y1 = Math.min(city.size, cy + vh + 60);

  // Warm sand ground.
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Water along the south edge (the bay Solmar sits on).
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(x0, city.size - 40, x1 - x0, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
    ctx.fillRect(x, city.size - 26, 46, 3);
  }

  // Streets: asphalt bands.
  ctx.fillStyle = COLORS.asphalt;
  for (const s of city.streets) {
    ctx.fillRect(x0, s - CITY.street / 2, x1 - x0, CITY.street);
    ctx.fillRect(s - CITY.street / 2, y0, CITY.street, y1 - y0);
  }

  // Sidewalk rings around each block.
  ctx.fillStyle = COLORS.sidewalk;
  for (const b of city.blocks) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
  }

  // Blocks: parks green, city blocks warm pavement.
  for (const b of city.blocks) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    if (b.type === 'park') {
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = COLORS.parkPath;
      ctx.fillRect(b.x + b.w / 2 - 10, b.y, 20, b.h);
      ctx.fillRect(b.x, b.y + b.h / 2 - 10, b.w, 20);
    } else {
      ctx.fillStyle = b.type === 'landmark' ? '#e6d9b8' : '#d9cba6';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  // Dashed centre lines on the streets.
  ctx.fillStyle = COLORS.asphaltLine;
  for (const s of city.streets) {
    for (let x = Math.floor(x0 / 70) * 70; x < x1; x += 70) {
      ctx.fillRect(x, s - 2, 34, 4);
    }
    for (let y = Math.floor(y0 / 70) * 70; y < y1; y += 70) {
      ctx.fillRect(s - 2, y, 4, 34);
    }
  }

  // Buildings: soft shadow, roof, windows.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + b.height * 0.5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + Math.floor(b.x)) % 3 !== 0) continue;
        ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 9);
      }
    }
  }

  // Landmark signs.
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'center';
  for (const b of city.blocks) {
    if (!b.label) continue;
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = ctx.measureText(b.label).width + 16;
    ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y + b.h / 2 - 12, tw, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
  }

  // Palm trees.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(t.x - 2, t.y - 4, 4, 10);
    ctx.fillStyle = '#3f9e4d';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 6, t.size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(t.x - 4, t.y - 10, t.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
