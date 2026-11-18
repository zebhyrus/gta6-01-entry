// audio.js — all sound is synthesized with WebAudio. No audio files.
// Engine hum, sirens, crash/punch/shot/pickup blips and a small bass loop.

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let engineFilter = null;
let sirenOscA = null;
let sirenOscB = null;
let sirenGain = null;
let sirenOn = false;
let musicTimer = null;
let musicStep = 0;
let musicOn = false;

// Bass line for the cruise loop (A minor, sun-soaked drive vibe).
const BASS_NOTES = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];
const LEAD_NOTES = [220, 0, 261.63, 0, 329.63, 0, 261.63, 0, 220, 0, 196, 0, 246.94, 0, 293.66, 0];

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Engine: a sawtooth through a lowpass, pitch follows speed.
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();

  // Siren: two tones alternating via a square LFO on a gain.
  sirenOscA = ctx.createOscillator();
  sirenOscA.type = 'triangle';
  sirenOscA.frequency.value = 720;
  sirenOscB = ctx.createOscillator();
  sirenOscB.type = 'triangle';
  sirenOscB.frequency.value = 960;
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 1.6;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain);
  // Crossfade A/B by driving two gains in opposite phase.
  const gA = ctx.createGain();
  const gB = ctx.createGain();
  gA.gain.value = 0.5;
  gB.gain.value = 0.5;
  lfoGain.connect(gA.gain);
  const inv = ctx.createGain();
  inv.gain.value = -1;
  lfoGain.connect(inv);
  inv.connect(gB.gain);
  sirenOscA.connect(gA);
  sirenOscB.connect(gB);
  gA.connect(sirenGain);
  gB.connect(sirenGain);
  sirenGain.connect(master);
  sirenOscA.start();
  sirenOscB.start();
  lfo.start();
}

// speedNorm 0..1, inCar true when driving. Call every frame.
export function updateEngine(speedNorm, inCar) {
  if (!ctx || !engineGain) return;
  const t = ctx.currentTime;
  const target = inCar ? 0.05 + speedNorm * 0.09 : 0.0;
  engineGain.gain.setTargetAtTime(target, t, 0.08);
  engineOsc.frequency.setTargetAtTime(52 + speedNorm * 130, t, 0.08);
  engineFilter.frequency.setTargetAtTime(280 + speedNorm * 900, t, 0.1);
}

export function setSiren(on) {
  if (!ctx || !sirenGain) return;
  if (on === sirenOn) return;
  sirenOn = on;
  sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.15);
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq || 1200;
  const g = ctx.createGain();
  g.gain.value = vol || 0.3;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'pickup':
      blip(660, 0.12, 'sine', 0.25, 990);
      break;
    case 'crash':
      noiseBurst(0.25, 0.4, 900);
      blip(90, 0.2, 'square', 0.2, 45);
      break;
    case 'punch':
      noiseBurst(0.08, 0.3, 500);
      break;
    case 'shot':
      noiseBurst(0.12, 0.45, 2400);
      blip(180, 0.1, 'square', 0.18, 60);
      break;
    case 'busted':
      blip(440, 0.5, 'triangle', 0.25, 110);
      break;
    case 'mission':
      blip(523, 0.12, 'sine', 0.25);
      setTimeout(() => blip(659, 0.12, 'sine', 0.25), 120);
      setTimeout(() => blip(784, 0.22, 'sine', 0.28), 240);
      break;
    case 'click':
      blip(880, 0.06, 'sine', 0.15);
      break;
    case 'door':
      blip(300, 0.08, 'square', 0.15, 180);
      break;
    case 'horn':
      blip(370, 0.25, 'square', 0.12, 370);
      break;
    default:
      break;
  }
}

function scheduleMusicStep() {
  if (!ctx || !musicOn) return;
  const step = musicStep % 16;
  const bass = BASS_NOTES[step];
  const lead = LEAD_NOTES[step];
  if (bass) blip(bass, 0.22, 'triangle', 0.16);
  if (lead && step % 2 === 0) blip(lead, 0.3, 'sine', 0.07);
  if (step % 4 === 2) noiseBurst(0.03, 0.05, 6000); // hat tick
  musicStep++;
}

export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  musicStep = 0;
  musicTimer = setInterval(scheduleMusicStep, 240);
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
