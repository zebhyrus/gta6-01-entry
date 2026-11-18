// touch.js — touch controls for phones: a virtual joystick (bottom-left)
// plus action buttons (bottom-right). The touch layer drives the SAME code
// paths as the keyboard: it presses virtual keys (input.js) and, for SHOOT,
// writes an auto-aim angle the pistol code reads that frame. Nothing here
// runs on a desktop: setupTouch() returns immediately when the device has
// no touch input, so keyboard/mouse play is untouched.

import { pressVirtualKey, releaseVirtualKey, setTouchAim } from './input.js';

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  if ('ontouchstart' in window) return true;
  if (navigator.maxTouchPoints > 0) return true;
  return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

const JOY_RADIUS = 44; // px the knob may travel from the base centre
const JOY_DEAD = 0.18; // stick deflection below this is ignored
const JOY_KEY = 0.3; // per-axis deflection above this engages that key
const AIM_RANGE = 620; // world px: auto-aim only picks targets this close

// Nearest hostile in range (rivals and cops first, then pedestrians the
// player would hit); null when nothing is close enough.
function nearestAimTarget(G) {
  const p = G.player;
  let best = null;
  let bestD = AIM_RANGE;
  const consider = (x, y) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestD) { bestD = d; best = { x, y }; }
  };
  for (const r of G.rivals) if (r.state !== 'down') consider(r.x, r.y);
  for (const c of G.cops) if (c.state !== 'down') consider(c.x, c.y);
  if (best) return best;
  for (const ped of G.peds) if (ped.state !== 'down') consider(ped.x, ped.y);
  return best;
}

function aimAngle(G) {
  const t = nearestAimTarget(G);
  if (!t) return G.player.angle; // nothing near: shoot where Danny faces
  return Math.atan2(t.y - G.player.y, t.x - G.player.x);
}

export function setupTouch(G) {
  if (!isTouchDevice()) return;

  // --- styles -------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
#touch-ui { position: fixed; inset: 0; z-index: 20; pointer-events: none;
  font-family: Arial, Helvetica, sans-serif; -webkit-user-select: none;
  user-select: none; -webkit-tap-highlight-color: transparent; }
#touch-joy { position: absolute; left: 20px; bottom: 96px; width: 124px;
  height: 124px; border-radius: 50%; background: rgba(10,14,24,0.35);
  border: 2px solid rgba(255,255,255,0.55); pointer-events: auto;
  touch-action: none; }
#touch-knob { position: absolute; left: 34px; top: 34px; width: 56px;
  height: 56px; border-radius: 50%; background: rgba(255,255,255,0.75);
  border: 2px solid rgba(10,14,24,0.4); }
#touch-btns { position: absolute; right: 14px; bottom: 14px; display: flex;
  flex-direction: column; align-items: flex-end; gap: 10px;
  pointer-events: none; }
#touch-btns .trow { display: flex; gap: 10px; pointer-events: none; }
.tbtn { pointer-events: auto; touch-action: none; width: 64px; height: 64px;
  border-radius: 50%; border: 2px solid rgba(255,255,255,0.65);
  background: rgba(10,14,24,0.55); color: #fff; display: flex;
  flex-direction: column; align-items: center; justify-content: center;
  padding: 0; margin: 0; font-family: inherit; cursor: pointer; }
.tbtn.small { width: 56px; height: 56px; }
.tbtn.big { width: 76px; height: 76px; background: rgba(180,40,20,0.6);
  border-color: rgba(255,220,120,0.8); }
.tbtn.active { background: rgba(255,217,79,0.9); color: #111;
  border-color: #fff; }
.tbtn .tlabel { font-size: 13px; font-weight: bold; line-height: 1.1; }
.tbtn.small .tlabel { font-size: 11px; }
.tbtn .tsub { font-size: 9px; opacity: 0.85; line-height: 1.1; }
`;
  document.head.appendChild(style);

  // --- overlay ------------------------------------------------------------
  const ui = document.createElement('div');
  ui.id = 'touch-ui';
  document.body.appendChild(ui);

  // Held buttons, keyed by touch identifier: a window-level fallback
  // releases a button if its touch ends without the button seeing it
  // (interrupted touch stream), so a virtual key can never stick down
  // and block the next tap's edge trigger.
  const heldButtons = new Map();
  function releaseButton(id) {
    const held = heldButtons.get(id);
    if (!held) return;
    heldButtons.delete(id);
    releaseVirtualKey(held.code);
    held.el.classList.remove('active');
  }
  const releaseButtonTouch = (e) => {
    for (const t of e.changedTouches) releaseButton(t.identifier);
  };
  window.addEventListener('touchend', releaseButtonTouch);
  window.addEventListener('touchcancel', releaseButtonTouch);

  // --- virtual joystick ---------------------------------------------------
  const joyBase = document.createElement('div');
  joyBase.id = 'touch-joy';
  const knob = document.createElement('div');
  knob.id = 'touch-knob';
  joyBase.appendChild(knob);
  ui.appendChild(joyBase);

  let joyId = null; // active touch identifier, or null
  let joyKeys = []; // virtual keys currently held by the stick
  let joyCX = 0; // base centre in client coords
  let joyCY = 0;

  function setJoyKeys(nx, ny) {
    // nx, ny in [-1, 1]: engage one virtual key per axis past the threshold.
    const want = [];
    if (ny < -JOY_KEY) want.push('KeyW');
    else if (ny > JOY_KEY) want.push('KeyS');
    if (nx < -JOY_KEY) want.push('KeyA');
    else if (nx > JOY_KEY) want.push('KeyD');
    for (const k of joyKeys) if (!want.includes(k)) releaseVirtualKey(k);
    for (const k of want) if (!joyKeys.includes(k)) pressVirtualKey(k);
    joyKeys = want;
  }

  function joyMoveTo(cx, cy) {
    let dx = cx - joyCX;
    let dy = cy - joyCY;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / JOY_RADIUS;
    const ny = dy / JOY_RADIUS;
    if (Math.hypot(nx, ny) < JOY_DEAD) setJoyKeys(0, 0);
    else setJoyKeys(nx, ny);
  }

  function joyReset() {
    joyId = null;
    knob.style.transform = 'translate(0px, 0px)';
    setJoyKeys(0, 0);
  }

  joyBase.addEventListener('touchstart', (e) => {
    if (joyId !== null) return; // one finger owns the stick
    const t = e.changedTouches[0];
    joyId = t.identifier;
    const r = joyBase.getBoundingClientRect();
    joyCX = r.left + r.width / 2;
    joyCY = r.top + r.height / 2;
    joyMoveTo(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (joyId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyMoveTo(t.clientX, t.clientY);
        e.preventDefault();
      }
    }
  }, { passive: false });

  const joyEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) joyReset();
    }
  };
  window.addEventListener('touchend', joyEnd);
  window.addEventListener('touchcancel', joyEnd);
  window.addEventListener('blur', () => {
    joyReset();
    for (const id of [...heldButtons.keys()]) releaseButton(id);
  });

  // --- action buttons -----------------------------------------------------
  // A tap presses the matching virtual key for exactly as long as the
  // finger is down, so a button is the same as holding that keyboard key.
  function makeButton(label, sub, code, size, extra) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tbtn${size ? ` ${size}` : ''}`;
    b.innerHTML = `<span class="tlabel">${label}</span>` +
      (sub ? `<span class="tsub">${sub}</span>` : '');
    const press = (e) => {
      e.preventDefault();
      heldButtons.set(e.changedTouches[0].identifier, { code, el: b });
      if (extra) extra();
      pressVirtualKey(code);
      b.classList.add('active');
    };
    const release = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) releaseButton(t.identifier);
    };
    b.addEventListener('touchstart', press, { passive: false });
    b.addEventListener('touchend', release, { passive: false });
    b.addEventListener('touchcancel', release, { passive: false });
    return b;
  }

  const btns = document.createElement('div');
  btns.id = 'touch-btns';
  const rowTop = document.createElement('div');
  rowTop.className = 'trow';
  rowTop.append(
    makeButton('PAUSE', '', 'KeyP', 'small'),
    makeButton('SWITCH', 'weapon', 'KeyQ', 'small'),
  );
  const rowMid = document.createElement('div');
  rowMid.className = 'trow';
  rowMid.append(
    makeButton('CAR', 'in / out', 'KeyE', ''),
    makeButton('PUNCH', '', 'KeyF', ''),
  );
  const rowBot = document.createElement('div');
  rowBot.className = 'trow';
  // SHOOT auto-aims: the angle is written this frame, the pistol reads it.
  rowBot.append(makeButton('SHOOT', 'auto-aim', 'KeyG', 'big', () => setTouchAim(aimAngle(G))));
  btns.append(rowTop, rowMid, rowBot);
  ui.appendChild(btns);

  // --- tap anywhere to start / continue -----------------------------------
  // Tap anywhere to start / continue: the title, busted and wasted screens
  // accept Enter, and pause accepts Enter too — inject one on any tap
  // while the game is not in play mode. (In play mode this does nothing,
  // so joystick and button taps are safe.) Release the key at once: the
  // edge lives in justPressed until the frame consumes it, and releasing
  // here keeps the next tap able to fire a fresh edge — without it, Enter
  // would stick in the held set and later taps would do nothing.
  window.addEventListener('touchstart', () => {
    if (G.mode !== 'play') {
      pressVirtualKey('Enter');
      releaseVirtualKey('Enter');
    }
  }, true);
}
