// input.js — keyboard + mouse state with edge-triggered "just pressed" keys.
// The game loop calls endFrame() once per frame to clear the edge set.

const down = new Set();
const justPressed = new Set();
export const mouse = { x: 0, y: 0, clicked: false, down: false };

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!down.has(e.code)) justPressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    down.delete(e.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    e.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
}

export function keyIsDown(code) {
  return down.has(code);
}

export function keyPressed(code) {
  return justPressed.has(code);
}

export function anyKeyPressed() {
  return justPressed.size > 0;
}

// --- virtual keys (touch layer) -------------------------------------------
// The touch controls drive the same key sets as the keyboard, so every
// consumer (moveVector, drive input, keyPressed actions) works unchanged.
export function pressVirtualKey(code) {
  if (!down.has(code)) justPressed.add(code);
  down.add(code);
}

export function releaseVirtualKey(code) {
  down.delete(code);
}

// Touch auto-aim: the touch layer writes the angle here when the player
// taps SHOOT; player.js uses it when no mouse click is aiming. It is
// consumed within one frame (endFrame clears it).
export const touchAim = { active: false, angle: 0 };

export function setTouchAim(angle) {
  touchAim.active = true;
  touchAim.angle = angle;
}

// WASD / arrows as a normalised movement vector.
export function moveVector() {
  let x = 0;
  let y = 0;
  if (keyIsDown('KeyA') || keyIsDown('ArrowLeft')) x -= 1;
  if (keyIsDown('KeyD') || keyIsDown('ArrowRight')) x += 1;
  if (keyIsDown('KeyW') || keyIsDown('ArrowUp')) y -= 1;
  if (keyIsDown('KeyS') || keyIsDown('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

export function endFrame() {
  justPressed.clear();
  mouse.clicked = false;
  touchAim.active = false;
}
