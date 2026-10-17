"use client";
// Original Web Audio synthesis. Muted by default; no audio files.
export type SoundKind = "tick" | "page" | "open";

const KEY = "studio-sound";
const AMBIENT_GAIN = 0.04;
const FADE = 1.5;

let enabled = false;
let inited = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambient: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let suspendTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

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

function buildAmbient(c: AudioContext, out: AudioNode) {
  const g = c.createGain();
  g.gain.value = 0;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 650;
  lp.Q.value = 0.6;
  const cutLfo = c.createOscillator();
  cutLfo.frequency.value = 0.05;
  const cutAmt = c.createGain();
  cutAmt.gain.value = 260;
  cutLfo.connect(cutAmt).connect(lp.frequency);
  cutLfo.start();
  const voices: [number, number, OscillatorType, number][] = [
    [110, -7, "sine", 0.043],
    [164.81, 5, "triangle", 0.061],
    [220.5, -3, "sine", 0.037],
  ];
  for (const [f, det, type, lfoHz] of voices) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = det;
    const l = c.createOscillator();
    l.frequency.value = lfoHz;
    const la = c.createGain();
    la.gain.value = 9;
    l.connect(la).connect(o.detune);
    const vg = c.createGain();
    vg.gain.value = type === "triangle" ? 0.25 : 0.4;
    o.connect(vg).connect(lp);
    o.start();
    l.start();
  }
  lp.connect(g).connect(out);
  return g;
}

function start() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      ambient = buildAmbient(ctx, master);
    }
    clearTimeout(suspendTimer);
    void ctx.resume();
    const now = ctx.currentTime;
    ambient!.gain.cancelScheduledValues(now);
    ambient!.gain.setValueAtTime(ambient!.gain.value, now);
    ambient!.gain.linearRampToValueAtTime(AMBIENT_GAIN, now + FADE);
  } catch {}
}

function stop() {
  if (!ctx || !ambient) return;
  const now = ctx.currentTime;
  ambient.gain.cancelScheduledValues(now);
  ambient.gain.setValueAtTime(ambient.gain.value, now);
  ambient.gain.linearRampToValueAtTime(0, now + FADE);
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    if (!enabled) void ctx?.suspend();
  }, FADE * 1000 + 100);
}

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

function env(g: GainNode, t: number, peak: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

export function playSound(kind: SoundKind = "tick"): void {
  if (!enabled || !ctx || !master || ctx.state !== "running") return;
  const c = ctx;
  const t = c.currentTime;
  try {
    if (kind === "tick") {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(700, t + 0.03);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 2200;
      const g = c.createGain();
      env(g, t, 0.05, 0.003, 0.03);
      o.connect(f).connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.05);
    } else if (kind === "page") {
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource();
      s.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(1800, t + 0.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.16);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      s.connect(f).connect(g).connect(master);
      s.start(t);
      s.stop(t + 0.42);
    } else {
      [659.25, 987.77].forEach((freq, i) => {
        const st = t + i * 0.12;
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        const g = c.createGain();
        env(g, st, 0.05, 0.01, 0.8);
        o.connect(g).connect(master!);
        o.start(st);
        o.stop(st + 0.85);
      });
    }
  } catch {}
}
