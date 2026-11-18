// main.js — Solmar Heat: a 2D top-down open-world crime game.
// Game loop, mode state machine (title / play / paused / busted / wasted),
// save/load, and the event bus that turns gameplay events into wanted
// points, sounds and toasts.

import { WORLD_SIZE, SAVE_KEY, clamp } from './config.js';
import { initInput, keyPressed, keyIsDown, endFrame, mouse } from './input.js';
import { generateCity } from './city.js';
import { makePlayer, updatePlayer, updateBullets } from './player.js';
import { spawnTraffic, spawnParked, updateTraffic, updatePlayerCar, updateParticles } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updateWanted, updatePolice, updateRivals, addWanted } from './police.js';
import { makeMissionState, startMission, updateMissions } from './missions.js';
import { updateCamera, render } from './render.js';
import { initAudio, updateEngine, setSiren, sfx, startMusic, stopMusic } from './audio.js';
import { shotParam, seedParam, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
initInput(canvas);

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, missionsDone: 0 };
    const s = JSON.parse(raw);
    return { money: Number(s.money) || 0, missionsDone: Number(s.missionsDone) || 0 };
  } catch {
    return { money: 0, missionsDone: 0 };
  }
}

// Missions done is the count of fully completed jobs.
function missionsDoneCount(G) {
  if (G.mission.allDone) return 5;
  return G.mission.index;
}

function saveGameNow(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.player.money,
      missionsDone: missionsDoneCount(G),
    }));
    G.save = { money: G.player.money, missionsDone: missionsDoneCount(G) };
  } catch {
    // ignore
  }
}

function newGame() {
  const seed = seedParam();
  const city = generateCity(seed);
  const save = loadSave();
  const G = {
    ctx,
    view: { w: canvas.width, h: canvas.height },
    camera: { x: 0, y: 0, w: canvas.width, h: canvas.height },
    mode: 'title',
    time: 0,
    city,
    player: makePlayer(city.streets[4] + 60, city.streets[4] + 26),
    cars: [],
    policeCars: [],
    cops: [],
    rivals: [],
    peds: [],
    bullets: [],
    particles: [],
    skids: [],
    events: [],
    toasts: [],
    wanted: { points: 0, stars: 0, sinceCrime: 99 },
    mission: makeMissionState(),
    bustMeter: 0,
    bustedLost: 0,
    save,
  };
  G.player.money = save.money;
  G.cars = [...spawnTraffic(city, 26, seed), ...spawnParked(city, 14, seed)];
  G.peds = spawnPedestrians(city, 34, seed);
  return G;
}

const G = newGame();

// Debug/testing hook: the finalist review and our own play-tests can read
// the live game state (mode, mission, wanted) from the console.
window.__solmar = G;

function startPlaying() {
  initAudio();
  startMusic();
  sfx('click');
  G.mode = 'play';
  if (G.mission.index === 0 && G.mission.step === 0 && !G.mission.started) {
    G.mission.started = true;
    // Resume the next unfinished job (or job 1 on a fresh save).
    const next = Math.min(G.save.missionsDone, 4);
    startMission(G, next);
  }
}

function bustPlayer(kind) {
  const lost = Math.max(50, Math.floor(G.player.money * 0.15));
  G.player.money = Math.max(0, G.player.money - lost);
  G.bustedLost = lost;
  G.wanted.points = 0;
  G.wanted.stars = 0;
  G.bustMeter = 0;
  G.policeCars = [];
  G.cops = [];
  G.rivals = [];
  if (G.player.car) {
    G.player.car.kind = 'parked';
    G.player.car.speed = 0;
    G.player.car = null;
    G.player.inCar = false;
  }
  G.player.hp = 100;
  const spot = kind === 'wasted' ? G.city.landmarks.hospital : G.city.landmarks.policeHQ;
  G.player.x = spot.x;
  G.player.y = spot.y + 60;
  G.mode = kind;
  setSiren(false);
  sfx('busted');
  saveGameNow(G);
}

function handleEvents(G) {
  for (const e of G.events) {
    switch (e) {
      case 'stole-car':
        addWanted(G, 0); // already added in player.js; toast only
        G.toasts.push({ text: 'Car stolen! The owner ran for it.', sub: 'Wanted level up — lose the heat.', t: 4 });
        sfx('door');
        break;
      case 'stole-police-car':
        G.toasts.push({ text: 'You stole a police cruiser!', sub: 'The whole PD is coming.', t: 4 });
        sfx('door');
        break;
      case 'enter-car':
        sfx('door');
        break;
      case 'exit-car':
        sfx('door');
        break;
      case 'hit-pedestrian':
        addWanted(G, 45);
        G.toasts.push({ text: 'You hit a pedestrian!', sub: 'Wanted level up.', t: 3 });
        sfx('crash');
        break;
      case 'rammed-car':
        addWanted(G, 25);
        break;
      case 'rammed-by-police':
        sfx('crash');
        break;
      case 'crash':
        sfx('crash');
        break;
      case 'punch':
        sfx('punch');
        break;
      case 'shot':
        sfx('shot');
        addWanted(G, 15);
        break;
      case 'cop-punch':
      case 'rival-punch':
        sfx('punch');
        break;
      case 'police-touch':
        break;
      case 'busted':
        bustPlayer('busted');
        break;
      case 'pickup':
        sfx('pickup');
        break;
      case 'mission-start':
        sfx('mission');
        break;
      case 'mission-complete':
        sfx('mission');
        break;
      case 'got-pistol':
        G.toasts.push({ text: 'Pistol acquired — 48 rounds', sub: 'G / click to shoot, Q to switch weapon.', t: 5 });
        break;
      case 'weapon-switch':
        sfx('click');
        break;
      case 'rival-down':
        addWanted(G, 20);
        break;
      case 'save':
        saveGameNow(G);
        break;
      default:
        break;
    }
  }
  G.events.length = 0;
}

function update(G, dt) {
  G.time += dt;
  for (const t of G.toasts) t.t -= dt;
  G.toasts = G.toasts.filter((t) => t.t > 0);

  if (G.mode === 'title') {
    // Slow drift over the city behind the title screen.
    G.camera.x = (Math.sin(G.time * 0.05) * 0.5 + 0.5) * Math.max(0, WORLD_SIZE - G.view.w);
    G.camera.y = (Math.cos(G.time * 0.04) * 0.5 + 0.5) * Math.max(0, WORLD_SIZE - G.view.h);
    G.camera.w = G.view.w;
    G.camera.h = G.view.h;
    if (keyPressed('Enter') || mouse.clicked) startPlaying();
    return;
  }
  if (G.mode === 'busted' || G.mode === 'wasted') {
    if (keyPressed('Enter') || mouse.clicked) {
      G.mode = 'play';
      G.toasts.push({ text: 'Back on the street.', sub: 'Mara is waiting for the next job.', t: 4 });
    }
    return;
  }
  if (G.mode === 'paused') {
    if (keyPressed('KeyP') || keyPressed('Escape') || keyPressed('Enter')) {
      G.mode = 'play';
      sfx('click');
    }
    if (keyPressed('KeyR')) {
      // Restart the current job from its first step.
      startMission(G, G.mission.index);
      G.mode = 'play';
    }
    return;
  }

  // --- play mode ---
  if (keyPressed('KeyP') || keyPressed('Escape')) {
    G.mode = 'paused';
    sfx('click');
    return;
  }

  const driveInput = {
    up: keyIsDown('KeyW') || keyIsDown('ArrowUp'),
    down: keyIsDown('KeyS') || keyIsDown('ArrowDown'),
    steer: (keyIsDown('KeyD') || keyIsDown('ArrowRight') ? 1 : 0) - (keyIsDown('KeyA') || keyIsDown('ArrowLeft') ? 1 : 0),
  };

  updatePlayer(G, dt);
  if (G.player.inCar) updatePlayerCar(G, dt, driveInput);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  updateRivals(G, dt);
  updateBullets(G, dt);
  updateMissions(G, dt);
  updateWanted(G, dt);
  updateParticles(G, dt);
  updateCamera(G, dt);

  // Audio follows the action.
  const speedNorm = G.player.car ? Math.abs(G.player.car.speed) / 640 : 0;
  updateEngine(speedNorm, G.player.inCar);
  setSiren(G.wanted.stars >= 1 && G.policeCars.length > 0);

  handleEvents(G);

  // Screenshot mode: the staged scene must not kill or bust the player
  // while the headless browser waits to take the shot.
  if (G.shotMode) {
    G.player.hp = Math.max(G.player.hp, 60);
    G.bustMeter = 0;
  }

  // Wasted: health hit zero.
  if (G.player.hp <= 0) {
    bustPlayer('wasted');
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.view.w = canvas.width;
  G.view.h = canvas.height;
  update(G, dt);
  render(G);
  endFrame();
  requestAnimationFrame(frame);
}

// Screenshot mode: stage the game and start immediately.
const shot = shotParam();
if (shot > 0) {
  initAudio();
  stageShot(G, shot);
  // Mute the music in screenshot mode so headless runs stay deterministic.
  stopMusic();
}
requestAnimationFrame(frame);
