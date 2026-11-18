// vehicles.js — cars: the player's driveable cars, parked cars and traffic.
// Driving is arcade physics (accelerate, steer, drift, collide); traffic
// cars follow the street grid, turn at intersections and brake for the car
// ahead. Stealing a car is entering a traffic car: its driver flees.

import { CAR, COLORS, WORLD_SIZE, clamp, angleDiff, mulberry32, circleHitsRect, pushCircleOutOfRect } from './config.js';
import { drawChunkyCar } from './style.js';

let carId = 1;

export function makeCar(x, y, angle, color, kind) {
  return {
    id: carId++,
    x, y, angle, speed: 0,
    color: color || COLORS.car[Math.floor(Math.random() * COLORS.car.length)],
    kind: kind || 'traffic', // traffic | parked | player | police
    axis: Math.random() < 0.5 ? 'h' : 'v',
    dir: Math.random() < 0.5 ? 1 : -1,
    targetSpeed: 90 + Math.random() * 90,
    driverFled: false,
    hp: 100,
    honkCd: 0,
  };
}

export function spawnTraffic(city, count, seed) {
  const rand = mulberry32(seed + 101);
  const cars = [];
  const streets = city.streets;
  for (let i = 0; i < count; i++) {
    const axis = rand() < 0.5 ? 'h' : 'v';
    const street = streets[1 + Math.floor(rand() * (streets.length - 2))];
    const along = 100 + rand() * (WORLD_SIZE - 200);
    const lane = (rand() < 0.5 ? -1 : 1) * 26;
    const dir = rand() < 0.5 ? 1 : -1;
    const car = makeCar(
      axis === 'h' ? along : street + lane,
      axis === 'h' ? street + lane : along,
      axis === 'h' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      COLORS.car[Math.floor(rand() * COLORS.car.length)],
      'traffic',
    );
    car.axis = axis;
    car.dir = dir;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, count, seed) {
  const rand = mulberry32(seed + 202);
  const cars = [];
  const streets = city.streets;
  for (let i = 0; i < count; i++) {
    const street = streets[1 + Math.floor(rand() * (streets.length - 2))];
    const along = 150 + rand() * (WORLD_SIZE - 300);
    const side = rand() < 0.5 ? -1 : 1;
    const horizontal = rand() < 0.5;
    const car = makeCar(
      horizontal ? along : street + side * 42,
      horizontal ? street + side * 42 : along,
      horizontal ? (side > 0 ? Math.PI : 0) : side > 0 ? -Math.PI / 2 : Math.PI / 2,
      COLORS.car[Math.floor(rand() * COLORS.car.length)],
      'parked',
    );
    car.speed = 0;
    cars.push(car);
  }
  return cars;
}

// Nearest street centre to a coordinate (for traffic turning).
function nearestStreet(streets, v) {
  let best = streets[0];
  let bd = Infinity;
  for (const s of streets) {
    const d = Math.abs(s - v);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

// Is another car directly ahead of this one on the same lane?
function carAhead(car, cars) {
  let best = null;
  let bestD = 90;
  for (const o of cars) {
    if (o === car || o.kind === 'parked') continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const ahead = car.axis === 'h' ? dx * car.dir : dy * car.dir;
    const side = car.axis === 'h' ? Math.abs(dy) : Math.abs(dx);
    if (ahead > 0 && ahead < bestD && side < 26) {
      best = o;
      bestD = ahead;
    }
  }
  return best;
}

export function updateTraffic(G, dt) {
  const streets = G.city.streets;
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const ahead = carAhead(car, G.cars);
    const want = ahead ? 0 : car.targetSpeed;
    car.speed += clamp(want - car.speed, -260 * dt, 130 * dt);
    const step = car.speed * car.dir * dt;
    if (car.axis === 'h') car.x += step;
    else car.y += step;

    // Turn at an intersection sometimes; wrap at the world edge.
    const pos = car.axis === 'h' ? car.x : car.y;
    const cross = nearestStreet(streets, car.axis === 'h' ? car.y : car.x);
    const onRoad = Math.abs((car.axis === 'h' ? car.y : car.x) - cross) < 3;
    if (onRoad && Math.abs(pos - nearestStreet(streets, pos)) < 14 && Math.random() < dt * 0.35) {
      const ns = nearestStreet(streets, pos);
      if (car.axis === 'h') {
        car.y = ns + (Math.random() < 0.5 ? -26 : 26);
        car.x = ns;
        car.axis = 'v';
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = ns + (Math.random() < 0.5 ? -26 : 26);
        car.y = ns;
        car.axis = 'h';
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
    }
    if (car.axis === 'h' && (car.x < 30 || car.x > WORLD_SIZE - 30)) {
      car.x = clamp(car.x, 30, WORLD_SIZE - 30);
      car.dir *= -1;
      car.angle += Math.PI;
    }
    if (car.axis === 'v' && (car.y < 30 || car.y > WORLD_SIZE - 30)) {
      car.y = clamp(car.y, 30, WORLD_SIZE - 30);
      car.dir *= -1;
      car.angle += Math.PI;
    }
    // Nudge traffic cars out of buildings (they stay on streets by design,
    // but a turn can clip a corner).
    for (const b of G.city.buildings) {
      if (circleHitsRect(car.x, car.y, 20, b)) {
        pushCircleOutOfRect(car, 20, b);
        car.speed *= 0.5;
      }
    }
  }
}

// Player driving: arcade handling with steering that scales with speed.
export function updatePlayerCar(G, dt, input) {
  const car = G.player.car;
  if (!car) return;

  // Screenshot mode: scripted cruise down the street (constant speed, wrap
  // at the world edge) so a staged shot shows the car mid-drive.
  if (G.shotMode) {
    car.speed = 300;
    car.x += car.speed * dt;
    if (car.x > WORLD_SIZE - 300) car.x = 300;
    return;
  }

  const up = input.up;
  const down = input.down;
  const steer = input.steer; // -1 left, +1 right
  if (up) car.speed += CAR.accel * dt;
  if (down) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  }
  // Rolling drag + a little extra when coasting.
  car.speed -= car.speed * CAR.drag * dt;
  if (!up && !down) car.speed -= car.speed * 0.6 * dt;
  car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);

  const speedFactor = clamp(Math.abs(car.speed) / 140, 0, 1);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.steerRate * speedFactor * dirSign * dt;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 24, WORLD_SIZE - 24);
  car.y = clamp(car.y, 24, WORLD_SIZE - 24);

  // Skid marks when cornering hard at speed.
  if (Math.abs(steer) > 0.6 && Math.abs(car.speed) > 320) {
    G.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
    if (G.skids.length > 220) G.skids.shift();
  }

  // Building collisions: bounce off with sparks and a crash sound.
  let hit = false;
  for (const b of G.city.buildings) {
    const depth = pushCircleOutOfRect(car, CAR.radius, b);
    if (depth > 0) {
      hit = true;
      if (Math.abs(car.speed) > 140) {
        spawnSparks(G, car.x, car.y, 10);
        car.speed *= 0.45;
      } else {
        car.speed *= 0.7;
      }
    }
  }
  if (hit && Math.abs(car.speed) > 120) G.events.push('crash');

  // Car-to-car bumps.
  for (const o of G.cars) {
    if (o === car || o.kind === 'player') continue;
    const d = Math.hypot(o.x - car.x, o.y - car.y);
    if (d < 44 && d > 0.01) {
      const nx = (o.x - car.x) / d;
      const ny = (o.y - car.y) / d;
      const push = (44 - d) / 2;
      car.x -= nx * push;
      car.y -= ny * push;
      if (o.kind !== 'parked') {
        o.x += nx * push;
        o.y += ny * push;
      }
      const impact = Math.abs(car.speed);
      if (impact > 180) {
        spawnSparks(G, car.x + nx * 24, car.y + ny * 24, 8);
        G.events.push('crash');
        if (o.kind === 'traffic') G.events.push('rammed-car');
      }
      car.speed *= 0.82;
    }
  }
}

export function spawnSparks(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 220;
    G.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.8,
      color: Math.random() < 0.5 ? '#ffd94f' : '#ff8a3d',
      size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(G, dt) {
  for (const p of G.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.4 * dt;
    p.vy *= 1 - 2.4 * dt;
    p.life -= dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);
}

export function drawCar(ctx, car) {
  // Chunky toy car from style.js: bright body, thick outline, block wheels.
  drawChunkyCar(ctx, car);
}

export function drawCars(ctx, cars) {
  for (const car of cars) drawCar(ctx, car);
}

// Angle helpers used by police steering (re-exported for convenience).
export { angleDiff };
