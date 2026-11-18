// config.js — tuning, palette and small math helpers for Solmar Heat.
// Solmar is a fictional sun-soaked coastal city. Nothing here is from any
// commercial game: all names, colours and numbers are original to this entry.

export const CITY = {
  blocks: 8, // blocks per side
  block: 280, // block size in world pixels
  street: 110, // street width in world pixels
};
// World is square: blocks * block + (blocks + 1) * street = 3230 px.
export const WORLD_SIZE = CITY.blocks * CITY.block + (CITY.blocks + 1) * CITY.street;

export const COLORS = {
  ground: '#e9d9a4', // warm sand outside the road grid
  asphalt: '#3d4250',
  asphaltLine: '#e8d44f',
  sidewalk: '#cfc3a4',
  grass: '#7ec25e',
  parkPath: '#d8c690',
  water: '#54b6d8',
  building: ['#f2a65a', '#e07856', '#7fb5a8', '#e8c85a', '#c97b9b', '#8fa8d8', '#f0e0c0', '#9bbf6a'],
  roof: ['#b96a3a', '#8f4a3a', '#4f7a6e', '#a8873a', '#8f4a6a', '#5a6f96', '#b09a6a', '#5f7a3a'],
  car: ['#d94f3d', '#3d7bd9', '#e8c832', '#3da66a', '#8a5fd0', '#e8e8e8', '#2b2b2b', '#e07b2e'],
  police: '#2b4fd8',
  player: '#2e9e5b',
  pedShirt: ['#e85a5a', '#5a8ae8', '#e8c85a', '#7ac25a', '#c05ad0', '#e8e8e8', '#5ad0c8'],
};

// Street centre lines (one per gap between blocks, plus the two edges).
export function streetCenters() {
  const centers = [];
  for (let i = 0; i <= CITY.blocks; i++) {
    centers.push(i * (CITY.block + CITY.street) + CITY.street / 2);
  }
  return centers;
}

export const PLAYER = {
  walkSpeed: 235,
  radius: 14,
  hp: 100,
  punchRange: 46,
  punchDamage: 16,
  punchCooldown: 0.35,
  shootCooldown: 0.28,
  bulletSpeed: 950,
};

export const CAR = {
  accel: 460,
  brake: 700,
  maxSpeed: 640,
  reverseMax: 220,
  steerRate: 2.9,
  drag: 0.55,
  length: 48,
  width: 26,
  radius: 24,
};

// Wanted points at which each star level starts (0..5 stars).
export const WANTED_STARS = [0, 60, 150, 300, 550, 800];
export const WANTED_DECAY_PER_SEC = 9; // points lost while staying clean
export const WANTED_CRIME_FREEZE = 5; // seconds after a crime before decay starts

export const SAVE_KEY = 'solmar-heat-save-v1';

// --- small helpers shared by the modules ------------------------------------

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Deterministic RNG so the city (and the screenshots) are stable per seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Circle vs axis-aligned rect: true when they overlap.
export function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Push a circle out of a rect; returns the impact depth (0 when no overlap).
export function pushCircleOutOfRect(pos, r, rect) {
  const nx = clamp(pos.x, rect.x, rect.x + rect.w);
  const ny = clamp(pos.y, rect.y, rect.y + rect.h);
  let dx = pos.x - nx;
  let dy = pos.y - ny;
  let d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return 0;
  if (d2 < 0.0001) {
    // Centre is inside the rect: push out along the smallest penetration.
    const left = pos.x - rect.x;
    const right = rect.x + rect.w - pos.x;
    const top = pos.y - rect.y;
    const bottom = rect.y + rect.h - pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = rect.x - r;
    else if (m === right) pos.x = rect.x + rect.w + r;
    else if (m === top) pos.y = rect.y - r;
    else pos.y = rect.y + rect.h + r;
    return r;
  }
  const d = Math.sqrt(d2);
  const push = r - d;
  pos.x += (dx / d) * push;
  pos.y += (dy / d) * push;
  return push;
}
