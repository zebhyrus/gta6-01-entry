// police.js — the wanted system and the Solmar PD response.
// Crimes add wanted points; stars rise 0-5. Police cars chase and ram the
// player; foot cops chase on foot and can bust the player. Staying clean
// lets the heat decay. Getting busted costs money and resets the wanted.

import { WANTED_STARS, WANTED_DECAY_PER_SEC, WANTED_CRIME_FREEZE, WORLD_SIZE, clamp, dist, circleHitsRect, pushCircleOutOfRect } from './config.js';
import { makeCar } from './vehicles.js';
import { drawBlockyPerson, RBX } from './style.js';

export function wantedStars(points) {
  let stars = 0;
  for (let i = 0; i < WANTED_STARS.length; i++) {
    if (points >= WANTED_STARS[i]) stars = i;
  }
  return stars;
}

export function addWanted(G, points) {
  G.wanted.points = Math.min(1000, G.wanted.points + points);
  G.wanted.stars = wantedStars(G.wanted.points);
  G.wanted.sinceCrime = 0;
}

export function updateWanted(G, dt) {
  G.wanted.sinceCrime += dt;
  if (G.wanted.sinceCrime > WANTED_CRIME_FREEZE && G.wanted.points > 0) {
    G.wanted.points = Math.max(0, G.wanted.points - WANTED_DECAY_PER_SEC * dt);
    G.wanted.stars = wantedStars(G.wanted.points);
  }
}

export function policeCarCount(stars) {
  return Math.min(stars, 3);
}

export function footCopCount(stars) {
  if (stars < 2) return 0;
  return Math.min(stars - 1, 3);
}

function spawnPoliceCar(G) {
  // Spawn on a street near the player, snapped to the nearer road so the
  // cruiser starts on asphalt, not inside a block.
  const a = Math.random() * Math.PI * 2;
  const d = 500 + Math.random() * 200;
  const x = clamp(G.player.x + Math.cos(a) * d, 60, WORLD_SIZE - 60);
  const y = clamp(G.player.y + Math.sin(a) * d, 60, WORLD_SIZE - 60);
  const streets = G.city.streets;
  const nearest = (v) => streets.reduce((p, c) => (Math.abs(c - v) < Math.abs(p - v) ? c : p));
  const dh = Math.abs(nearest(y) - y);
  const dv = Math.abs(nearest(x) - x);
  let px = x;
  let py = y;
  let axis;
  let dir = Math.random() < 0.5 ? 1 : -1;
  if (dh <= dv) {
    axis = 'h';
    py = nearest(y) + 26;
  } else {
    axis = 'v';
    px = nearest(x) + 26;
  }
  const car = makeCar(px, py, axis === 'h' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2, '#2b4fd8', 'police');
  car.axis = axis;
  car.dir = dir;
  car.targetSpeed = 300;
  car.ramCd = 0;
  G.policeCars.push(car);
}

function spawnFootCop(G) {
  const a = Math.random() * Math.PI * 2;
  const d = 260 + Math.random() * 160;
  G.cops.push({
    x: clamp(G.player.x + Math.cos(a) * d, 30, WORLD_SIZE - 30),
    y: clamp(G.player.y + Math.sin(a) * d, 30, WORLD_SIZE - 30),
    hp: 30,
    punchCd: 0,
    state: 'chase',
    stateT: 0,
    angle: 0,
  });
}

export function updatePolice(G, dt) {
  const stars = G.wanted.stars;

  // Keep the right number of police cars on the streets.
  while (G.policeCars.length < policeCarCount(stars)) spawnPoliceCar(G);
  while (G.policeCars.length > policeCarCount(stars)) G.policeCars.pop();
  // No foot cops in screenshot mode: they would run after a driving player.
  if (!G.shotMode) {
    while (G.cops.length < footCopCount(stars)) spawnFootCop(G);
    while (G.cops.length > footCopCount(stars)) G.cops.pop();
  }

  // Police cars: drive the street grid toward the player (they stay on
  // the roads like traffic, turning at intersections), then ram.
  for (let pi = 0; pi < G.policeCars.length; pi++) {
    const car = G.policeCars[pi];
    // Screenshot mode: hold a chase formation behind the player's car so
    // the staged shot shows the pursuit without overlapping sprites.
    if (G.shotMode && G.player.car) {
      const pcar = G.player.car;
      const off = 170 + pi * 110;
      car.x = pcar.x - Math.cos(pcar.angle) * off;
      car.y = pcar.y - Math.sin(pcar.angle) * off + (pi % 2 === 0 ? -52 : 52);
      car.angle = pcar.angle;
      car.speed = pcar.speed;
      continue;
    }
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    const tx = G.player.car ? G.player.car.x : G.player.x;
    const ty = G.player.car ? G.player.car.y : G.player.y;
    const streets = G.city.streets;
    const nearest = (v) => streets.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const along = car.axis === 'h' ? car.x : car.y;
    const cross = nearest(along);
    const gapAlong = car.axis === 'h' ? tx - car.x : ty - car.y;
    const gapCross = car.axis === 'h' ? ty - car.y : tx - car.x;
    // At an intersection, turn onto the cross street when the player is
    // much further across than along it.
    if (Math.abs(along - cross) < 16 && Math.abs(gapCross) > 120 && Math.abs(gapAlong) < Math.abs(gapCross)) {
      const newDir = gapCross >= 0 ? 1 : -1;
      if (car.axis === 'h') {
        car.x = cross + (newDir > 0 ? -26 : 26);
        car.axis = 'v';
        car.dir = newDir;
        car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.y = cross + (newDir > 0 ? 26 : -26);
        car.axis = 'h';
        car.dir = newDir;
        car.angle = newDir > 0 ? 0 : Math.PI;
      }
    } else if (Math.abs(gapAlong) > 200) {
      // The player is well behind on this street: turn around.
      const newDir = gapAlong >= 0 ? 1 : -1;
      if (car.dir !== newDir) {
        car.dir = newDir;
        car.angle = car.axis === 'h' ? (newDir > 0 ? 0 : Math.PI) : newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    const d = dist(car.x, car.y, tx, ty);
    const wantSpeed = d > 60 ? 480 + stars * 30 : 200;
    car.speed += clamp(wantSpeed - car.speed, -500 * dt, 380 * dt);
    if (car.axis === 'h') car.x += car.speed * car.dir * dt;
    else car.y += car.speed * car.dir * dt;
    car.x = clamp(car.x, 24, WORLD_SIZE - 24);
    car.y = clamp(car.y, 24, WORLD_SIZE - 24);
    // Safety net: never cut through a building.
    for (const b of G.city.buildings) {
      if (circleHitsRect(car.x, car.y, 20, b)) {
        pushCircleOutOfRect(car, 20, b);
        car.speed *= 0.6;
      }
    }

    // Ram the player's car: one shove per 0.6 s, so a cruiser slows the
    // player but can never pin them forever.
    const pcar = G.player.car;
    if (pcar) {
      const pd = dist(car.x, car.y, pcar.x, pcar.y);
      if (pd < 46 && car.ramCd <= 0) {
        car.ramCd = 0.6;
        const nx = (pcar.x - car.x) / (pd || 1);
        const ny = (pcar.y - car.y) / (pd || 1);
        pcar.x += nx * 14;
        pcar.y += ny * 14;
        pcar.speed *= 0.88;
        G.events.push('rammed-by-police');
        car.speed *= 0.7;
      }
    }
    // Ram the player on foot: knock them down and build the bust meter.
    if (!pcar && d < 34) {
      G.bustMeter += dt * 1.4;
      G.events.push('police-touch');
    }
  }

  // Foot cops: run at the player, punch up close, build the bust meter.
  for (const cop of G.cops) {
    cop.punchCd -= dt;
    cop.stateT -= dt;
    if (cop.state === 'down') {
      if (cop.stateT <= 0) {
        // A downed cop stays down; remove them from the street.
        cop.gone = true;
      }
      continue;
    }
    const d = dist(cop.x, cop.y, G.player.x, G.player.y);
    cop.angle = Math.atan2(G.player.y - cop.y, G.player.x - cop.x);
    if (d > 26) {
      const sp = 205;
      cop.x += Math.cos(cop.angle) * sp * dt;
      cop.y += Math.sin(cop.angle) * sp * dt;
    } else if (cop.punchCd <= 0) {
      cop.punchCd = 0.9;
      G.player.hp -= 7;
      G.events.push('cop-punch');
      G.player.lastDamage = 0;
    }
    // Standing next to a cop builds the bust meter.
    if (d < 40) G.bustMeter += dt;
  }
  G.cops = G.cops.filter((c) => !c.gone);

  // Bust meter decays when no police is close.
  if (G.policeCars.length === 0 && G.cops.length === 0) G.bustMeter = 0;
  else {
    const nearest = Math.min(
      ...G.policeCars.map((c) => dist(c.x, c.y, G.player.x, G.player.y)),
      ...G.cops.map((c) => dist(c.x, c.y, G.player.x, G.player.y)),
      9999,
    );
    if (nearest > 120) G.bustMeter = Math.max(0, G.bustMeter - dt * 0.7);
  }
  if (G.bustMeter >= 2.2) G.events.push('busted');
}

export function drawPolice(ctx, policeCars, cops) {
  // Police cars are drawn by drawCars (kind 'police'); cops on foot here.
  for (const cop of cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (cop.state === 'down') {
      ctx.rotate(cop.angle + Math.PI / 2);
      drawBlockyPerson(ctx, { shirt: RBX.copShirt, pants: '#1a1a22', skin: RBX.skin[1], down: true });
      ctx.restore();
      continue;
    }
    ctx.rotate(cop.angle);
    // Solmar PD foot cop: dark blue blocky avatar with a cap and a badge.
    drawBlockyPerson(ctx, { shirt: RBX.copShirt, pants: '#1a1a22', skin: RBX.skin[1], cap: '#101a4a' });
    // Gold badge on the chest.
    ctx.fillStyle = '#ffcf00';
    ctx.fillRect(-2, -3, 4, 4);
    ctx.restore();
  }
}

// Rival gang members (mission 4) behave like hostile foot cops in red.
export function makeRival(x, y) {
  return {
    x, y, hp: 40, punchCd: 0, state: 'chase', stateT: 0, angle: 0, rival: true,
  };
}

export function updateRivals(G, dt) {
  for (const r of G.rivals) {
    r.punchCd -= dt;
    if (r.state === 'down') continue;
    const d = dist(r.x, r.y, G.player.x, G.player.y);
    r.angle = Math.atan2(G.player.y - r.y, G.player.x - r.x);
    if (d > 30) {
      r.x += Math.cos(r.angle) * 185 * dt;
      r.y += Math.sin(r.angle) * 185 * dt;
    } else if (r.punchCd <= 0) {
      r.punchCd = 1.0;
      G.player.hp -= 9;
      G.events.push('rival-punch');
      G.player.lastDamage = 0;
    }
  }
  G.rivals = G.rivals.filter((r) => r.state !== 'down' || r.stateT > 0);
}

export function drawRivals(ctx, rivals) {
  for (const r of rivals) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (r.state === 'down') {
      ctx.rotate(r.angle + Math.PI / 2);
      drawBlockyPerson(ctx, { shirt: RBX.rivalShirt, pants: '#1a1a22', skin: RBX.skin[1], down: true });
      ctx.restore();
      continue;
    }
    ctx.rotate(r.angle);
    // Vulture gang member: bright red blocky avatar with a dark bandana.
    drawBlockyPerson(ctx, { shirt: RBX.rivalShirt, pants: '#1a1a22', skin: RBX.skin[1], cap: '#3a0a0a' });
    ctx.restore();
  }
}
