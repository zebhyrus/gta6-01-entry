// missions.js — the story: Danny Reyes, getaway driver for Mara Solis's
// Solmar crew. Five jobs, each with steps, a target on the map and a cash
// reward. Completing a job saves progress to localStorage.

import { dist } from './config.js';
import { makeRival, addWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'first-job',
    title: 'Job 1 — First Job',
    briefing: 'Mara: "Meet me at the Docks, Danny. The crew needs a driver it can trust."',
    reward: 300,
    steps: [
      { type: 'goto', target: 'docks', text: 'Drive to the Docks and meet Mara' },
    ],
  },
  {
    id: 'package-run',
    title: 'Job 2 — Package Run',
    briefing: 'Mara: "Pick up the package at the Marina, drop it at Plaza del Sol. No detours."',
    reward: 500,
    steps: [
      { type: 'pickup', target: 'marina', text: 'Pick up the package at the Marina' },
      { type: 'deliver', target: 'plaza', text: 'Deliver the package to Plaza del Sol' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Job 3 — Hot Wheels',
    briefing: 'Mara: "The crew needs wheels. Steal a car, then lose the heat — 30 seconds clean, then get to the Safehouse."',
    reward: 800,
    steps: [
      { type: 'steal', text: 'Steal any car on the street (press E near one)' },
      { type: 'survive', seconds: 30, text: 'Survive the heat for 30 seconds' },
      { type: 'goto', target: 'safehouse', text: 'Reach the Safehouse' },
    ],
  },
  {
    id: 'turf-war',
    title: 'Job 4 — Turf War',
    briefing: 'Mara: "The Vultures are moving on the Docks. Take them down. I left you a pistol — use it."',
    reward: 1000,
    steps: [
      { type: 'goto', target: 'docks', text: 'Go to the Docks' },
      { type: 'combat', target: 'docks', text: 'Take down the Vultures (4)' },
    ],
  },
  {
    id: 'big-score',
    title: 'Job 5 — The Big Score',
    briefing: 'Mara: "Last one. Hit Solmar Bank, grab the cash, and bring it home. The whole PD will be on you."',
    reward: 2000,
    steps: [
      { type: 'goto', target: 'bank', text: 'Drive to Solmar Bank' },
      { type: 'pickup', target: 'bank', text: 'Grab the cash from the Bank' },
      { type: 'escape', target: 'safehouse', text: 'Escape to the Safehouse — 3 stars and counting' },
    ],
  },
];

export function makeMissionState() {
  return {
    index: 0, // which mission (0..4); 5 means all done
    step: 0,
    timer: 0,
    flags: { stoleCar: false, hasPistol: false },
    done: false,
    allDone: false,
  };
}

function currentMission(G) {
  return MISSIONS[G.mission.index] || null;
}

function currentStep(G) {
  const m = currentMission(G);
  return m ? m.steps[G.mission.step] : null;
}

export function missionTarget(G) {
  const step = currentStep(G);
  if (!step || !step.target) return null;
  return G.city.landmarks[step.target] || null;
}

export function missionObjectiveText(G) {
  const m = currentMission(G);
  if (!m) return 'All jobs done — Solmar is yours. Free roam!';
  const step = currentStep(G);
  let text = `${m.title}: ${step.text}`;
  if (step.type === 'survive') {
    text += ` — ${Math.ceil(step.seconds - G.mission.timer)}s left`;
  }
  if (step.type === 'combat') {
    const left = G.rivals.filter((r) => r.state !== 'down').length;
    text += ` — ${left} left`;
  }
  return text;
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  G.mission.index = index;
  G.mission.step = 0;
  G.mission.timer = 0;
  G.mission.flags.stoleCar = false;
  if (index === 3 && !G.mission.flags.hasPistol) {
    // Mara leaves Danny a pistol for the turf war.
    G.mission.flags.hasPistol = true;
    G.player.weapon = 'pistol';
    G.player.ammo += 48;
    G.events.push('got-pistol');
  }
  if (index === 4) {
    G.player.ammo += 24;
  }
  G.toasts.push({ text: m.title, sub: m.briefing, t: 6 });
  G.events.push('mission-start');
}

export function advanceStep(G) {
  const m = currentMission(G);
  G.mission.step++;
  G.mission.timer = 0;
  if (G.mission.step >= m.steps.length) {
    // Mission complete: pay up, save, move on.
    G.player.money += m.reward;
    G.mission.done = true;
    G.toasts.push({ text: `Job complete! +$${m.reward}`, sub: 'Progress saved.', t: 5 });
    G.events.push('mission-complete');
    G.events.push('save');
    if (G.mission.index + 1 >= MISSIONS.length) {
      G.mission.allDone = true;
      G.mission.index = MISSIONS.length;
      G.toasts.push({ text: 'CREW LEGEND', sub: 'All five jobs done. Solmar is yours — free roam!', t: 8 });
    } else {
      startMission(G, G.mission.index + 1);
    }
  }
}

export function updateMissions(G, dt) {
  const m = currentMission(G);
  if (!m) return;
  const step = currentStep(G);
  if (!step) return;
  const target = step.target ? G.city.landmarks[step.target] : null;

  switch (step.type) {
    case 'goto':
    case 'pickup':
    case 'deliver':
    case 'escape': {
      if (target && dist(G.player.x, G.player.y, target.x, target.y) < 70) {
        if (step.type === 'pickup') G.events.push('pickup');
        // Job 5: grabbing the bank cash trips the alarm — 3 stars instantly.
        if (m.id === 'big-score' && step.type === 'pickup' && !G.mission.flags.alarmTripped) {
          G.mission.flags.alarmTripped = true;
          addWanted(G, 320);
          G.toasts.push({ text: 'ALARM! The Bank job is hot!', sub: '3 stars — get to the Safehouse!', t: 5 });
        }
        advanceStep(G);
      }
      break;
    }
    case 'steal': {
      if (G.mission.flags.stoleCar) advanceStep(G);
      break;
    }
    case 'survive': {
      G.mission.timer += dt;
      if (G.mission.timer >= step.seconds) advanceStep(G);
      break;
    }
    case 'combat': {
      if (G.rivals.length === 0) {
        // Spawn the Vultures at the Docks when the player arrives.
        const t = G.city.landmarks.docks;
        for (let i = 0; i < 4; i++) {
          G.rivals.push(makeRival(t.x + (Math.random() - 0.5) * 220, t.y + (Math.random() - 0.5) * 220));
        }
        G.toasts.push({ text: 'The Vultures are here!', sub: 'Take them down — F to punch, G to shoot.', t: 5 });
      }
      if (G.rivals.length > 0 && G.rivals.every((r) => r.state === 'down')) {
        G.rivals = [];
        advanceStep(G);
      }
      break;
    }
    default:
      break;
  }
}

// The 'survive' and 'combat' steps above are handled in updateMissions;
// nothing else to hook here.

// Draw the mission beacon: a column of light and a bouncing diamond.
export function drawMissionMarker(ctx, G, time) {
  const target = missionTarget(G);
  if (!target) return;
  const bob = Math.sin(time * 3) * 10;
  ctx.save();
  // Light column.
  const grad = ctx.createLinearGradient(target.x, target.y - 260, target.x, target.y);
  grad.addColorStop(0, 'rgba(255,220,80,0)');
  grad.addColorStop(1, 'rgba(255,220,80,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(target.x - 14, target.y - 260, 28, 260);
  // Ground ring: thick yellow with a dark edge.
  ctx.strokeStyle = '#ffcf00';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 34 + Math.sin(time * 3) * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#1a1a22';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 34 + Math.sin(time * 3) * 6, 0, Math.PI * 2);
  ctx.stroke();
  // Diamond.
  ctx.fillStyle = '#ffdc50';
  ctx.beginPath();
  ctx.moveTo(target.x, target.y - 44 + bob);
  ctx.lineTo(target.x + 14, target.y - 26 + bob);
  ctx.lineTo(target.x, target.y - 8 + bob);
  ctx.lineTo(target.x - 14, target.y - 26 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
