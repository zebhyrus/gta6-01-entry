// pedestrians.js — people walking the sidewalks of Solmar.
// They stroll along block edges, flee from danger, and fall (then get up)
// when a car hits them — which is a crime and raises the wanted level.

import { COLORS, WORLD_SIZE, clamp, mulberry32, dist, pushCircleOutOfRect } from './config.js';
import { drawBlockyPerson, RBX } from './style.js';

let pedId = 1;

export function spawnPedestrians(city, count, seed) {
  const rand = mulberry32(seed + 303);
  const peds = [];
  const streets = city.streets;
  for (let i = 0; i < count; i++) {
    // Walk on a sidewalk: just off a street centre line (52 px out, past
    // the 55 px road edge, so cars in the ±26 lanes never run them over).
    const street = streets[1 + Math.floor(rand() * (streets.length - 2))];
    const along = 120 + rand() * (WORLD_SIZE - 240);
    const horizontal = rand() < 0.5;
    const side = rand() < 0.5 ? -1 : 1;
    peds.push({
      id: pedId++,
      x: horizontal ? along : street + side * 52,
      y: horizontal ? street + side * 52 : along,
      angle: horizontal ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2,
      speed: 34 + rand() * 30,
      shirt: COLORS.pedShirt[Math.floor(rand() * COLORS.pedShirt.length)],
      skin: ['#f2c89b', '#d9a066', '#8a5a2e', '#f7d7b0'][Math.floor(rand() * 4)],
      state: 'walk', // walk | flee | down
      stateT: 0,
      dir: rand() < 0.5 ? 1 : -1,
      horizontal,
    });
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  const px = G.player.x;
  const py = G.player.y;
  const playerCar = G.player.car;
  for (const p of G.peds) {
    p.stateT -= dt;
    if (p.state === 'down') {
      if (p.stateT <= 0) {
        p.state = 'flee';
        p.stateT = 3;
      }
      continue;
    }

    // Flee: run away from the player / the danger.
    const dangerD = dist(p.x, p.y, px, py);
    const playerSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
    const scared = dangerD < 110 && (playerCar ? playerSpeed > 120 : true);
    if (scared && p.state !== 'flee') {
      p.state = 'flee';
      p.stateT = 2.5;
      p.angle = Math.atan2(p.y - py, p.x - px);
    }
    if (p.state === 'flee') {
      const sp = 150;
      p.x += Math.cos(p.angle) * sp * dt;
      p.y += Math.sin(p.angle) * sp * dt;
      if (p.stateT <= 0) p.state = 'walk';
    } else {
      // Stroll along the sidewalk; turn around at the block ends.
      const sp = p.speed * p.dir;
      if (p.horizontal) p.x += sp * dt;
      else p.y += sp * dt;
      const streets = G.city.streets;
      const lo = streets[0] + 20;
      const hi = streets[streets.length - 1] - 20;
      if (p.horizontal && (p.x < lo || p.x > hi)) p.dir *= -1;
      if (!p.horizontal && (p.y < lo || p.y > hi)) p.dir *= -1;
      p.angle = p.horizontal ? (p.dir > 0 ? 0 : Math.PI) : p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      // Small chance to switch to a cross street at an intersection:
      // snap onto the nearest street's sidewalk so peds never cut
      // through a block.
      if (Math.random() < dt * 0.02) {
        const streets = G.city.streets;
        const nearest = (v) => streets.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
        if (p.horizontal) {
          p.x = nearest(p.x) + (Math.random() < 0.5 ? -52 : 52);
        } else {
          p.y = nearest(p.y) + (Math.random() < 0.5 ? -52 : 52);
        }
        p.horizontal = !p.horizontal;
        p.angle = p.horizontal ? (p.dir > 0 ? 0 : Math.PI) : p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }

    p.x = clamp(p.x, 16, WORLD_SIZE - 16);
    p.y = clamp(p.y, 16, WORLD_SIZE - 16);

    // Never walk through a building (fleeing peds can be pushed off the
    // sidewalk, so push them back out every frame).
    for (const b of G.city.buildings) {
      pushCircleOutOfRect(p, 10, b);
    }

    // Hit by the player's car: fall down, crime committed.
    if (playerCar && Math.abs(playerCar.speed) > 60 && dist(p.x, p.y, playerCar.x, playerCar.y) < 24) {
      p.state = 'down';
      p.stateT = 2.2;
      G.events.push('hit-pedestrian');
    }
    // Hit by a traffic car: same fall, no wanted (not the player's fault).
    for (const car of G.cars) {
      if (car.kind === 'traffic' && Math.abs(car.speed) > 60 && dist(p.x, p.y, car.x, car.y) < 24) {
        p.state = 'down';
        p.stateT = 2.2;
      }
    }
  }
}

export function drawPedestrians(ctx, peds) {
  for (const p of peds) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // Soft shadow under the toy figure.
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.state === 'down') {
      // Lying on the ground: flat blocks, same colours.
      ctx.rotate(p.angle + Math.PI / 2);
      drawBlockyPerson(ctx, { shirt: p.shirt, pants: RBX.pants[p.id % RBX.pants.length], skin: p.skin, down: true });
      ctx.restore();
      continue;
    }
    ctx.rotate(p.angle);
    // Walking legs bob with the step.
    const bob = Math.sin(Date.now() / 130 + p.id * 2);
    drawBlockyPerson(ctx, {
      shirt: p.shirt,
      pants: RBX.pants[p.id % RBX.pants.length],
      skin: p.skin,
      bob,
    });
    ctx.restore();
  }
}
