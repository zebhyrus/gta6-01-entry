// player.js — Danny Reyes on foot: walking, stealing cars, punching and
// shooting. The player is a green circle with a cap; the pistol is unlocked
// by mission 3 and carries limited ammo.

import { PLAYER, WORLD_SIZE, clamp, dist, circleHitsRect, pushCircleOutOfRect } from './config.js';
import { keyPressed, moveVector, mouse, touchAim } from './input.js';
import { addWanted } from './police.js';
import { spawnSparks } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: PLAYER.hp,
    lastDamage: 99, // seconds since last damage (for regen)
    money: 0,
    car: null, // the car currently driven, or null
    weapon: 'fists', // fists | pistol
    ammo: 0,
    punchCd: 0,
    shootCd: 0,
    inCar: false,
  };
}

function nearestCar(G, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of G.cars) {
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  for (const car of G.policeCars) {
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  p.punchCd -= dt;
  p.shootCd -= dt;
  p.lastDamage += dt;
  // Slow health regen after 6 clean seconds.
  if (p.lastDamage > 6 && p.hp > 0 && p.hp < PLAYER.hp) {
    p.hp = Math.min(PLAYER.hp, p.hp + 6 * dt);
  }

  if (p.inCar) {
    // Sync the player marker to the car; driving lives in vehicles.js.
    const car = p.car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (keyPressed('KeyE')) {
      // Step out beside the car.
      p.inCar = false;
      p.car = null;
      car.kind = 'parked';
      car.speed = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      G.events.push('exit-car');
    }
    return;
  }

  // On foot: WASD / arrows.
  const mv = moveVector();
  if (mv.x !== 0 || mv.y !== 0) {
    p.angle = Math.atan2(mv.y, mv.x);
  }
  p.x += mv.x * PLAYER.walkSpeed * dt;
  p.y += mv.y * PLAYER.walkSpeed * dt;
  p.x = clamp(p.x, 14, WORLD_SIZE - 14);
  p.y = clamp(p.y, 14, WORLD_SIZE - 14);
  for (const b of G.city.buildings) {
    pushCircleOutOfRect(p, PLAYER.radius, b);
  }
  // Bumping into parked/traffic cars pushes the player around them.
  for (const car of G.cars) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < 30 && d > 0.01) {
      p.x += ((p.x - car.x) / d) * (30 - d);
      p.y += ((p.y - car.y) / d) * (30 - d);
    }
  }

  // E near a car: get in. Stealing a traffic car is a crime; its driver flees.
  if (keyPressed('KeyE')) {
    const car = nearestCar(G, 64);
    if (car) {
      if (car.kind === 'traffic') {
        addWanted(G, 70);
        G.events.push('stole-car');
        // The driver bails out and runs away as a pedestrian.
        G.peds.push({
          id: 9000 + Math.floor(Math.random() * 900),
          x: car.x + 30, y: car.y + 30,
          angle: Math.atan2(car.y + 30 - p.y, car.x + 30 - p.x),
          speed: 120, shirt: '#e85a5a', skin: '#f2c89b',
          state: 'flee', stateT: 3, dir: 1, horizontal: true,
        });
      } else if (car.kind === 'police') {
        // Stealing a police car is a much bigger deal.
        addWanted(G, 200);
        G.events.push('stole-police-car');
      }
      // Remove from its old list and make it the player's car.
      G.cars = G.cars.filter((c) => c !== car);
      G.policeCars = G.policeCars.filter((c) => c !== car);
      car.kind = 'player';
      car.driverFled = true;
      p.car = car;
      p.inCar = true;
      G.events.push('enter-car');
      if (G.mission.flags) G.mission.flags.stoleCar = true;
    }
  }

  // F: punch. Hits cops, rivals and pedestrians in front of the player.
  if (keyPressed('KeyF') && p.punchCd <= 0) {
    p.punchCd = PLAYER.punchCooldown;
    G.events.push('punch');
    const hx = p.x + Math.cos(p.angle) * 30;
    const hy = p.y + Math.sin(p.angle) * 30;
    for (const cop of G.cops) {
      if (dist(hx, hy, cop.x, cop.y) < 30) {
        cop.hp -= PLAYER.punchDamage;
        if (cop.hp <= 0) {
          cop.state = 'down';
          cop.stateT = 4;
          addWanted(G, 60);
        }
      }
    }
    for (const r of G.rivals) {
      if (dist(hx, hy, r.x, r.y) < 30) {
        r.hp -= PLAYER.punchDamage;
        if (r.hp <= 0) {
          r.state = 'down';
          r.stateT = 99;
          G.events.push('rival-down');
        }
      }
    }
    for (const ped of G.peds) {
      if (ped.state !== 'down' && dist(hx, hy, ped.x, ped.y) < 30) {
        ped.state = 'down';
        ped.stateT = 2.0;
        addWanted(G, 40);
        G.events.push('hit-pedestrian');
      }
    }
  }

  // G or left mouse click: shoot the pistol (needs ammo).
  const wantShoot = keyPressed('KeyG') || mouse.clicked;
  if (wantShoot && p.weapon === 'pistol' && p.ammo > 0 && p.shootCd <= 0) {
    p.shootCd = PLAYER.shootCooldown;
    p.ammo -= 1;
    let aim = p.angle;
    if (mouse.clicked) {
      const wx = G.camera.x + mouse.x;
      const wy = G.camera.y + mouse.y;
      aim = Math.atan2(wy - p.y, wx - p.x);
    } else if (touchAim.active) {
      // Touch SHOOT: auto-aim was computed by the touch layer this frame.
      aim = touchAim.angle;
    }
    G.bullets.push({
      x: p.x + Math.cos(aim) * 22,
      y: p.y + Math.sin(aim) * 22,
      angle: aim,
      life: 0.9,
    });
    G.events.push('shot');
  }

  // Q: switch weapon (only when the pistol is owned).
  if (keyPressed('KeyQ') && p.ammo >= 0 && G.mission.flags && G.mission.flags.hasPistol) {
    p.weapon = p.weapon === 'fists' ? 'pistol' : 'fists';
    G.events.push('weapon-switch');
  }
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += Math.cos(b.angle) * PLAYER.bulletSpeed * dt;
    b.y += Math.sin(b.angle) * PLAYER.bulletSpeed * dt;
    b.life -= dt;
    // Hit a building: sparks.
    for (const rect of G.city.buildings) {
      if (circleHitsRect(b.x, b.y, 3, rect)) {
        b.life = 0;
        spawnSparks(G, b.x, b.y, 5);
      }
    }
    // Hit a cop or a rival.
    for (const cop of G.cops) {
      if (cop.state !== 'down' && dist(b.x, b.y, cop.x, cop.y) < 16) {
        b.life = 0;
        cop.hp -= 34;
        if (cop.hp <= 0) {
          cop.state = 'down';
          cop.stateT = 4;
          addWanted(G, 90);
        }
      }
    }
    for (const r of G.rivals) {
      if (r.state !== 'down' && dist(b.x, b.y, r.x, r.y) < 16) {
        b.life = 0;
        r.hp -= 34;
        if (r.hp <= 0) {
          r.state = 'down';
          r.stateT = 99;
          G.events.push('rival-down');
        }
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

export function drawPlayer(ctx, p) {
  if (p.inCar) return; // the car is drawn instead
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Green jacket, the getaway driver's colours.
  ctx.fillStyle = '#2e9e5b';
  ctx.beginPath();
  ctx.roundRect(-8, -8, 16, 16, 6);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(11, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e6e3e';
  ctx.fillRect(8, -6, 6, 12); // cap
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, 4, 12, 4); // pistol in hand
  }
  ctx.restore();
}

export function drawBullets(ctx, bullets) {
  ctx.fillStyle = '#ffe14f';
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillRect(-6, -1.5, 12, 3);
    ctx.restore();
  }
}
