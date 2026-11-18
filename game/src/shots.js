// shots.js — screenshot mode for the 4 dossier screenshots.
// ?shot=1..4 stages the game into a different system on load and starts it
// immediately (no title screen), so a headless browser render shows the
// game itself: driving with traffic, on foot among pedestrians, a police
// chase with wanted stars, and a mission in progress.

import { makeCar } from './vehicles.js';
import { makeRival, addWanted } from './police.js';
import { startMission } from './missions.js';

export function shotParam() {
  const q = new URLSearchParams(window.location.search);
  const shot = Number.parseInt(q.get('shot') || '', 10);
  return Number.isFinite(shot) && shot >= 1 && shot <= 4 ? shot : 0;
}

export function seedParam() {
  const q = new URLSearchParams(window.location.search);
  const seed = Number.parseInt(q.get('seed') || '', 10);
  return Number.isFinite(seed) ? seed : 7;
}

// Place the player on a street near the city centre, facing along a road.
// The player stands on the south sidewalk (street centre + 52).
function centrePlayer(G) {
  const streets = G.city.streets;
  const s = streets[4];
  G.player.x = streets[4] + 60;
  G.player.y = s + 52;
  G.player.angle = 0;
  G.player.hp = 100;
}

// A car on the eastbound lane (street centre + 26) beside the player.
function putCarBesidePlayer(G, kind, color) {
  const car = makeCar(G.player.x + 130, G.player.y - 26, 0, color, kind);
  car.speed = 0;
  G.cars.push(car);
  return car;
}

export function stageShot(G, shot) {
  G.mode = 'play';
  G.shotMode = shot;
  G.time = 0;
  centrePlayer(G);
  const streets = G.city.streets;

  if (shot === 1) {
    // Cover: driving through the city with traffic, minimap + HUD visible.
    const car = putCarBesidePlayer(G, 'player', '#d94f3d');
    G.cars = G.cars.filter((c) => c !== car);
    G.player.car = car;
    G.player.inCar = true;
    car.speed = 380;
    startMission(G, 0);
    G.toasts = [];
    // A few traffic cars ahead on the opposite lane (street centre - 26),
    // so the cruise never overlaps them.
    for (let i = 0; i < 3; i++) {
      const t = makeCar(G.player.x + 260 + i * 190, streets[4] - 26, 0, ['#3d7bd9', '#e8c832', '#3da66a'][i], 'traffic');
      t.speed = 120;
      t.axis = 'h';
      t.dir = 1;
      G.cars.push(t);
    }
    G.peds.push({ id: 5001, x: G.player.x + 120, y: streets[4] - 52, angle: 0, speed: 40, shirt: '#5a8ae8', skin: '#f2c89b', state: 'walk', stateT: 0, dir: 1, horizontal: true });
    G.peds.push({ id: 5002, x: G.player.x + 320, y: streets[4] - 52, angle: Math.PI, speed: 40, shirt: '#e8c85a', skin: '#d9a066', state: 'walk', stateT: 0, dir: -1, horizontal: true });
  } else if (shot === 2) {
    // On foot among pedestrians, mission 2 in progress.
    startMission(G, 1);
    G.toasts = [];
    G.player.x = streets[4] + 200;
    G.player.y = streets[4] + 52; // south sidewalk
    for (let i = 0; i < 6; i++) {
      G.peds.push({
        id: 5100 + i,
        x: G.player.x - 140 + i * 70,
        y: streets[4] + 52,
        angle: i % 2 === 0 ? 0 : Math.PI,
        speed: 40, shirt: ['#e85a5a', '#5a8ae8', '#e8c85a', '#7ac25a', '#c05ad0', '#5ad0c8'][i],
        skin: '#f2c89b', state: 'walk', stateT: 0, dir: 1, horizontal: true,
      });
    }
    putCarBesidePlayer(G, 'parked', '#3d7bd9');
  } else if (shot === 3) {
    // Police chase: 3 wanted stars, two police cars closing in.
    const car = putCarBesidePlayer(G, 'player', '#d94f3d');
    G.cars = G.cars.filter((c) => c !== car);
    G.player.car = car;
    G.player.inCar = true;
    car.speed = 520;
    addWanted(G, 320); // 3 stars
    startMission(G, 4);
    G.mission.step = 2; // escape step, alarm already tripped
    G.mission.flags.alarmTripped = true;
    G.toasts = [];
    for (let i = 0; i < 2; i++) {
      const pc = makeCar(G.player.x - 180 - i * 120, G.player.y + (i === 0 ? -26 : 52), 0, '#2b4fd8', 'police');
      pc.speed = 480;
      G.policeCars.push(pc);
    }
    const t = makeCar(G.player.x + 420, streets[4] - 26, 0, '#e8c832', 'traffic');
    t.speed = 140;
    t.axis = 'h';
    t.dir = 1;
    G.cars.push(t);
  } else if (shot === 4) {
    // Mission 4 in progress: the Vultures at the Docks, pistol out.
    startMission(G, 3);
    G.mission.step = 1; // combat step
    G.toasts = [];
    const docks = G.city.landmarks.docks;
    G.player.x = docks.x + 40;
    G.player.y = docks.y + 52; // south sidewalk of the Docks street
    G.player.weapon = 'pistol';
    G.player.ammo = 48;
    for (let i = 0; i < 4; i++) {
      G.rivals.push(makeRival(docks.x - 90 + i * 70, docks.y + 52 + (i % 2) * 20));
    }
    putCarBesidePlayer(G, 'parked', '#3da66a');
  }

  // Snap the camera to the player so the first frame is already framed.
  G.camera.x = Math.max(0, Math.min(G.city.size - G.view.w, G.player.x - G.view.w / 2));
  G.camera.y = Math.max(0, Math.min(G.city.size - G.view.h, G.player.y - G.view.h / 2));
  G.camera.w = G.view.w;
  G.camera.h = G.view.h;
}
