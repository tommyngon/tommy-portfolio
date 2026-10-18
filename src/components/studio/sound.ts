"use client";
// Generative gallery ambience, synthesised from scratch with Web Audio.
// Muted by default; no audio files; never touches AudioContext before a gesture.
//
// Graph:  pad voices / glass notes -> inBus -> dry + convolution reverb + soft delay -> master
//         room tone + UI sounds -> master -> compressor -> destination
export type SoundKind = "tick" | "page" | "open";

const KEY = "studio-sound";
const MASTER_LEVEL = 0.6; // ambient peaks around -24 dBFS through the chain
const FADE_IN = 4;
const FADE_OUT = 1.5;
const MAX_VOICES = 12;
const LOOKAHEAD = 1.5; // seconds
const TICK_MS = 400;

// D lydian / major-7 add9 voicings, 110-660 Hz.
const CHORDS: number[][] = [
  [146.83, 220.0, 329.63, 369.99], // Dmaj9
  [110.0, 164.81, 207.65, 246.94], // Amaj7
  [196.0, 246.94, 293.66, 369.99], // Gmaj7
  [123.47, 185.0, 220.0, 329.63], // Bm9-ish
  [164.81, 246.94, 369.99, 440.0], // Em7 add11-ish open
  [146.83, 185.0, 246.94, 329.63], // D6/9
];
// D pentatonic (D E F# A B), 440-1760 Hz.
const GLASS = [440, 493.88, 587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98, 1760];

let enabled = false;
let inited = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let inBus: GainNode | null = null;
let whiteBuf: AudioBuffer | null = null;
let suspendTimer: ReturnType<typeof setTimeout> | undefined;
let schedTimer: ReturnType<typeof setTimeout> | undefined;
let nextChordT = 0;
let nextGlassT = 0;
let lastChord = -1;
let active = 0;
let lastTick = 0;
const listeners = new Set<() => void>();

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function emit() {
  listeners.forEach((l) => l());
}

function init() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  try {
    enabled = window.localStorage.getItem(KEY) === "1";
  } catch {}
  window.addEventListener("studio:sound", (e) => setSoundEnabled(Boolean((e as CustomEvent).detail)));
  if (enabled) {
    // Browsers need a gesture before audio can start; resume on the first one.
    const go = () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      if (enabled) start();
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
  }
}

/* ---------- buffers ---------- */

function makeReverbIR(c: AudioContext) {
  const dur = 5;
  const pre = Math.floor(c.sampleRate * 0.02);
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(2, len, c.sampleRate);
  const a = Math.exp((-2 * Math.PI * 6000) / c.sampleRate); // one-pole lowpass ~6k
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / c.sampleRate;
      y = (1 - a) * (Math.random() * 2 - 1) + a * y;
      d[i] = y * Math.exp((-6.9 * t) / dur) * (1 - Math.exp(-t * 60));
    }
  }
  return buf;
}

function makePinkLoop(c: AudioContext) {
  const len = Math.floor(c.sampleRate * 8);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  // short crossfade to hide the loop seam
  const x = Math.floor(c.sampleRate * 0.25);
  for (let i = 0; i < x; i++) {
    const k = i / x;
    d[len - x + i] = d[len - x + i] * (1 - k) + d[i] * k;
  }
  return buf;
}

function makeWhite(c: AudioContext) {
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/* ---------- graph ---------- */

function buildGraph(c: AudioContext) {
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 24;
  comp.ratio.value = 2.5;
  comp.attack.value = 0.05;
  comp.release.value = 0.4;
  comp.connect(c.destination);

  master = c.createGain();
  master.gain.value = 0;
  master.connect(comp);

  inBus = c.createGain();
  const dry = c.createGain();
  dry.gain.value = 0.45;
  inBus.connect(dry).connect(master);

  const conv = c.createConvolver();
  conv.buffer = makeReverbIR(c);
  const wet = c.createGain();
  wet.gain.value = 0.55;
  inBus.connect(conv).connect(wet).connect(master);

  // gentle feed-forward delay, ~dotted, lowpassed, low feedback
  const dl = c.createDelay(2);
  dl.delayTime.value = 0.62;
  const dlp = c.createBiquadFilter();
  dlp.type = "lowpass";
  dlp.frequency.value = 2200;
  const fb = c.createGain();
  fb.gain.value = 0.28;
  const send = c.createGain();
  send.gain.value = 0.3;
  const ret = c.createGain();
  ret.gain.value = 0.5;
  inBus.connect(send).connect(dl);
  dl.connect(dlp);
  dlp.connect(fb).connect(dl);
  dlp.connect(ret);
  ret.connect(master);
  ret.connect(conv);

  // room tone: quiet wandering pink noise
  const src = c.createBufferSource();
  src.buffer = makePinkLoop(c);
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 560;
  bp.Q.value = 0.7;
  const wl = c.createOscillator();
  wl.frequency.value = 0.023;
  const wa = c.createGain();
  wa.gain.value = 240;
  wl.connect(wa).connect(bp.frequency);
  const rg = c.createGain();
  rg.gain.value = 0.007; // ~ -48 dB-ish
  src.connect(bp).connect(rg).connect(master);
  src.start();
  wl.start();

  whiteBuf = makeWhite(c);
}

/* ---------- voices ---------- */

function release(nodes: AudioNode[], src: AudioScheduledSourceNode) {
  active++;
  src.addEventListener("ended", () => {
    active--;
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {}
    }
  });
}

function padVoice(c: AudioContext, bus: AudioNode, f: number, t: number, hold: number) {
  const attack = rnd(6, 10);
  const rel = rnd(6, 10);
  const end = t + attack + hold + rel;
  const peak = 0.02;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.linearRampToValueAtTime(0, end);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 0.4;
  lp.frequency.value = rnd(650, 950);
  const lfo = c.createOscillator();
  lfo.frequency.value = rnd(0.03, 0.08);
  const la = c.createGain();
  la.gain.value = rnd(150, 280);
  lfo.connect(la).connect(lp.frequency);
  const nodes: AudioNode[] = [g, lp, la];
  const types: OscillatorType[] = [Math.random() < 0.5 ? "sine" : "triangle", "sine"];
  let first: OscillatorNode | null = null;
  types.forEach((type, i) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = (i ? 1 : -1) * rnd(4, 7);
    o.connect(lp);
    o.start(t);
    o.stop(end + 0.1);
    nodes.push(o);
    if (!first) first = o;
  });
  lp.connect(g).connect(bus);
  lfo.start(t);
  lfo.stop(end + 0.1);
  nodes.push(lfo);
  release(nodes, first!);
}

function glassNote(c: AudioContext, bus: AudioNode, f: number, t: number, vol: number, pan?: number) {
  if (active >= MAX_VOICES) return;
  const dur = rnd(2.5, 6);
  const ratio = Math.random() < 0.5 ? 2 : 3.5;
  const car = c.createOscillator();
  car.frequency.value = f;
  const mod = c.createOscillator();
  mod.frequency.value = f * ratio;
  const mg = c.createGain();
  const idx = rnd(0.8, 1.8);
  mg.gain.setValueAtTime(idx * f * ratio * 0.5, t);
  mg.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
  mod.connect(mg).connect(car.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = c.createStereoPanner();
  p.pan.value = pan ?? rnd(-0.6, 0.6);
  car.connect(g).connect(p).connect(bus);
  car.start(t);
  mod.start(t);
  car.stop(t + dur + 0.05);
  mod.stop(t + dur + 0.05);
  release([car, mod, mg, g, p], car);
}

function glassGesture(c: AudioContext, t: number) {
  if (!inBus) return;
  if (Math.random() < 0.2) {
    // short falling figure
    let i = 4 + Math.floor(Math.random() * (GLASS.length - 4));
    const n = Math.random() < 0.5 ? 2 : 3;
    const pan = rnd(-0.5, 0.5);
    let tt = t;
    for (let k = 0; k < n && i >= 0; k++) {
      glassNote(c, inBus, GLASS[i], tt, 0.05 - k * 0.008, pan);
      i -= 1 + Math.floor(Math.random() * 2);
      tt += rnd(0.5, 1);
    }
  } else {
    glassNote(c, inBus, pick(GLASS), t, rnd(0.035, 0.055));
  }
}

/* ---------- scheduler ---------- */

function schedule() {
  schedTimer = undefined;
  if (!ctx || !inBus || !enabled) return;
  const c = ctx;
  const now = c.currentTime;
  while (nextChordT < now + LOOKAHEAD) {
    let idx = Math.floor(Math.random() * CHORDS.length);
    if (idx === lastChord) idx = (idx + 1) % CHORDS.length;
    lastChord = idx;
    const gap = rnd(18, 30);
    const t = Math.max(nextChordT, now);
    for (const f of CHORDS[idx]) padVoice(c, inBus, f, t + rnd(0, 1.5), Math.max(0, gap - 8));
    nextChordT = t + gap;
  }
  while (nextGlassT < now + LOOKAHEAD) {
    glassGesture(c, Math.max(nextGlassT, now));
    // Poisson-ish gaps, floored so notes never pile up
    nextGlassT = Math.max(nextGlassT, now) + Math.min(9, 2.5 + -Math.log(1 - Math.random()) * 2.5);
  }
  schedTimer = setTimeout(schedule, TICK_MS);
}

function start() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      buildGraph(ctx);
    }
    clearTimeout(suspendTimer);
    void ctx.resume();
    const now = ctx.currentTime;
    const m = master!.gain;
    m.cancelScheduledValues(now);
    m.setValueAtTime(m.value, now);
    m.linearRampToValueAtTime(MASTER_LEVEL, now + FADE_IN);
    if (schedTimer === undefined) {
      nextChordT = now;
      nextGlassT = now + rnd(2, 4);
      schedule();
    }
  } catch {}
}

function stop() {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(0, now + FADE_OUT);
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    if (!enabled) {
      clearTimeout(schedTimer);
      schedTimer = undefined;
      void ctx?.suspend();
    }
  }, FADE_OUT * 1000 + 100);
}

/* ---------- public API ---------- */

export function setSoundEnabled(on: boolean) {
  init();
  if (on === enabled && (!on || ctx)) return;
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  if (on) start();
  else stop();
  emit();
}

export function isSoundEnabled() {
  init();
  return enabled;
}

export function subscribeSound(cb: () => void) {
  init();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function playSound(kind: SoundKind = "tick"): void {
  if (!enabled || !ctx || !master || !inBus || ctx.state !== "running") return;
  const c = ctx;
  const t = c.currentTime;
  try {
    if (kind === "tick") {
      const nowMs = performance.now();
      if (nowMs - lastTick < 45 || Math.random() < 0.3 || active >= MAX_VOICES || !whiteBuf) return;
      lastTick = nowMs;
      const s = c.createBufferSource();
      s.buffer = whiteBuf;
      s.playbackRate.value = rnd(0.8, 1.25);
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = rnd(1900, 2600);
      const g = c.createGain();
      const d = rnd(0.005, 0.015);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.02, t + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(hp).connect(g).connect(master);
      s.start(t, Math.random() * 0.8, d + 0.01);
      release([s, hp, g], s);
    } else if (kind === "page") {
      if (active >= MAX_VOICES || !whiteBuf) return;
      const s = c.createBufferSource();
      s.buffer = whiteBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 0.6;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(1500, t + 0.6);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      s.connect(f).connect(g).connect(inBus);
      s.start(t);
      s.stop(t + 0.7);
      release([s, f, g], s);
      glassNote(c, inBus, pick(GLASS.slice(0, 7)), t + 0.18, 0.035);
    } else {
      glassNote(c, inBus, pick(GLASS.slice(0, 8)), t, 0.04);
    }
  } catch {}
}
