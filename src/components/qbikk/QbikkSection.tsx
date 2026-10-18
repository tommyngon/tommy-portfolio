"use client";

// QBIKK landing page, ported from tommyngon/qbikk-landing-page-claude (index.html) into a
// self-contained section. The markup and shader are unchanged; the script is scoped to this
// section, its theme is local to it, and the cube only renders while the section is on screen.

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useRef } from "react";
import "./qbikk.css";
import { CUBE_FRAG as FRAG, CUBE_VERT as VERT } from "./cube-shader";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono" });

const SCENES = [
  {
    text: "Okay — so Maria sends the revised budget by Thursday, and we move the launch review to the 14th.",
    label: "Remembered · 2 items",
    items: [["Maria", "Revised budget, Thursday"], ["Launch review", "Moved to the 14th"]],
  },
  {
    text: "Idea for onboarding: skip the tutorial, let people talk to it in the first ten seconds.",
    label: "Saved to Ideas",
    items: [["Onboarding", "Voice-first in 10 seconds"]],
  },
  {
    text: "One tablet with breakfast for ten days, and come back if the cough lasts past Friday.",
    label: "Reminders set · 2",
    items: [["Daily", "One tablet with breakfast"], ["Friday", "Follow up if cough persists"]],
  },
  {
    text: "This is Jonas — he runs partnerships at Nordlys and knows the retail buyers in Oslo.",
    label: "New contact",
    items: [["Jonas", "Partnerships, Nordlys"], ["Knows", "Retail buyers in Oslo"]],
  },
  {
    text: "What did Maria say she’d send us?",
    label: "Recalled from your meeting",
    items: [["Maria", "Revised budget, by Thursday"]],
  },
];

const BG = { light: [250, 250, 251], dark: [6, 7, 10] } as const; // = --bg

export default function QbikkSection() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;

    /* ── Theme (local to this section) ─────────────────── */
    const themeBtn = $<HTMLButtonElement>(".theme");
    const applyTheme = (t: string) => {
      root.dataset.theme = t;
      themeBtn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    };
    // framed as an exhibit on the paper page: always opens light (its toggle is hidden there)
    applyTheme("light");
    const onTheme = () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("qbikk-theme", next);
      } catch {}
    };
    themeBtn.addEventListener("click", onTheme);

    /* ── Cube ──────────────────────────────────────────── */
    const canvas = $<HTMLCanvasElement>(".cube");
    const page = $<HTMLElement>(".page");
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
    let prog: WebGLProgram | null = null;
    const U: Record<string, WebGLUniformLocation | null> = {};
    const compile = (g: WebGLRenderingContext, type: number, src: string) => {
      const s = g.createShader(type)!;
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) || "shader");
      return s;
    };
    try {
      if (!gl) throw new Error("no webgl");
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ["uRes", "uTime", "uRot", "uSquash", "uLevel", "uEnergy", "uProc", "uBloom", "uScale", "uBg", "uDark"])
        U[n] = gl.getUniformLocation(prog, n);
    } catch (e) {
      console.warn("Cube unavailable:", e);
      canvas.style.display = "none";
      prog = null;
    }

    // canvas is centred on the stage; the cube spans ~52% of the section height
    const stage = $<HTMLElement>(".stage");
    let cx = 0,
      cy = 0,
      size = 0;
    const resize = () => {
      const r = stage.getBoundingClientRect();
      const p = page.getBoundingClientRect();
      size = Math.round(Math.min(r.height * 1.72, innerWidth * 1.22, 1400));
      cx = r.left - p.left + r.width / 2;
      cy = r.top - p.top + r.height / 2;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.style.width = canvas.style.height = size + "px";
      canvas.width = canvas.height = Math.round(size * dpr);
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    document.fonts?.ready.then(() => alive && resize());
    resize();

    const rotation = (yaw: number, pitch: number, roll: number) => {
      const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch), cR = Math.cos(roll), sR = Math.sin(roll);
      const Ry = [[cY, 0, sY], [0, 1, 0], [-sY, 0, cY]];
      const Rx = [[1, 0, 0], [0, cP, -sP], [0, sP, cP]];
      const Rz = [[cR, -sR, 0], [sR, cR, 0], [0, 0, 1]];
      const mul = (A: number[][], B: number[][]) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
      const M = mul(Rz, mul(Rx, Ry));
      return new Float32Array([M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]]);
    };

    const S = { level: 0, energy: 0, proc: 0, bloom: 0, dark: root.dataset.theme === "dark" ? 1 : 0, yaw: 0.72 };
    const T = { energy: 0, proc: 0 };
    const voice = {
      env: 0,
      kick() {
        this.env = 0.6 + Math.random() * 0.4;
      },
    };
    const approach = (c: number, t: number, rate: number, dt: number) => c + (t - c) * (1 - Math.exp(-rate * dt));
    let state = "idle";

    const mic = $<HTMLButtonElement>(".mic");
    const line = $<HTMLElement>(".line");
    const textbox = $<HTMLElement>(".text");
    const timeEl = $<HTMLElement>(".time");
    const memo = $<HTMLElement>(".memo");
    let startedAt = 0;

    const tickTime = () => {
      if (state !== "listening") return;
      const s = Math.floor((performance.now() - startedAt) / 1000);
      const txt = "0:" + String(s).padStart(2, "0");
      if (timeEl.textContent !== txt) timeEl.textContent = txt;
    };

    // only animate while the section is on screen
    let visible = false;
    let raf = 0;
    let last = performance.now(),
      clock = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!visible || !alive) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const motion = reduceMotion ? 0.35 : 1;
      clock += dt * motion;

      voice.env *= Math.exp(-dt * 3.2);
      const syll = 0.55 + 0.45 * Math.abs(Math.sin(clock * 17 + Math.sin(clock * 5)));
      const raw = state === "listening" ? voice.env * syll : 0;
      S.level = approach(S.level, raw, raw > S.level ? 16 : 6, dt);
      S.energy = approach(S.energy, T.energy, 3, dt);
      S.proc = approach(S.proc, T.proc, 4, dt);
      S.bloom = approach(S.bloom, 0, 1.4, dt);
      S.dark = approach(S.dark, root.dataset.theme === "dark" ? 1 : 0, 6, dt);
      root.style.setProperty("--lvl", S.level.toFixed(3));

      const speed = (0.34 + 0.35 * S.energy + 0.7 * S.level * S.energy + 0.25 * S.proc) * motion;
      S.yaw += dt * speed;
      const pitch = 0.5 + 0.17 * Math.sin(clock * 0.37) + 0.07 * Math.sin(clock * 0.83 + 1.3) + 0.06 * S.level * S.energy;
      const roll = 0.13 * Math.sin(clock * 0.29) + 0.06 * Math.sin(clock * 0.71 + 2.0);
      const sq = [1 + 0.035 * Math.sin(clock * 1.13), 1 + 0.035 * Math.sin(clock * 1.13 + 2.1), 1 + 0.035 * Math.sin(clock * 1.13 + 4.2)];
      const scale = 1 + 0.025 * Math.sin(clock * 0.95) + 0.07 * S.level * S.energy - 0.05 * S.proc + 0.035 * S.bloom;

      const bobY = Math.sin(clock * 0.9) * 8 + Math.sin(clock * 0.37) * 4;
      const bobX = Math.sin(clock * 0.53) * 4;
      canvas.style.transform = `translate(${(cx - size / 2 + bobX).toFixed(1)}px, ${(cy - size / 2 + bobY).toFixed(1)}px)`;

      if (gl && prog) {
        const th = BG[root.dataset.theme === "dark" ? "dark" : "light"];
        gl.uniform2f(U.uRes, canvas.width, canvas.height);
        gl.uniform1f(U.uTime, clock);
        gl.uniformMatrix3fv(U.uRot, false, rotation(S.yaw, pitch, roll));
        gl.uniform3f(U.uSquash, sq[0], sq[1], sq[2]);
        gl.uniform1f(U.uLevel, S.level);
        gl.uniform1f(U.uEnergy, S.energy);
        gl.uniform1f(U.uProc, S.proc);
        gl.uniform1f(U.uBloom, S.bloom);
        gl.uniform1f(U.uScale, scale);
        gl.uniform3f(U.uBg, th[0] / 255, th[1] / 255, th[2] / 255);
        gl.uniform1f(U.uDark, S.dark);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      tickTime();
      raf = requestAnimationFrame(frame);
    };
    let inView = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        inView = entry.intersectionRatio > 0.6;
        if (visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      },
      { threshold: [0, 0.6] },
    );
    io.observe(root);

    /* ── Scripted preview: capture → remember → recall ─── */
    let scene = 0,
      run = 0,
      skip = false;
    const sleep = (ms: number) =>
      new Promise<void>((r) => {
        timers.push(setTimeout(r, reduceMotion ? ms * 0.6 : ms));
      });

    const setState = (next: string) => {
      state = next;
      root.dataset.state = next;
      T.energy = next === "listening" ? 1 : 0;
      T.proc = next === "processing" ? 1 : 0;
      if (next === "done") S.bloom = 1;
      const listening = next === "listening";
      mic.setAttribute("aria-pressed", String(listening));
      mic.setAttribute("aria-label", listening ? "Stop preview" : "Play preview");
      if (!listening) timeEl.textContent = "";
    };

    // keep the newest words in view, fading the start of the line
    const fit = () => {
      const over = line.scrollWidth - textbox.clientWidth;
      line.style.transform = `translateX(${over > 0 ? -over : 0}px)`;
      textbox.classList.toggle("overflow", over > 0);
    };

    const renderWords = (words: string[], committed: number) => {
      line.textContent = "";
      const f = document.createElement("span");
      f.className = "final";
      f.textContent = words.slice(0, committed).join(" ");
      const i = document.createElement("span");
      i.className = "interim";
      const rest = words.slice(committed).join(" ");
      i.textContent = rest ? (f.textContent ? " " : "") + rest : "";
      line.append(f, i);
      fit();
    };

    const showDone = (label: string) => {
      line.innerHTML =
        '<span class="done"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5"/></svg></span>';
      line.firstChild!.appendChild(document.createTextNode(label));
      line.style.transition = "none";
      fit();
      requestAnimationFrame(() => (line.style.transition = ""));
    };

    const play = async () => {
      const my = ++run;
      skip = false;
      const sc = SCENES[scene++ % SCENES.length];

      memo.textContent = "";
      renderWords([], 0);
      startedAt = performance.now();
      setState("listening");
      await sleep(420);

      const words = sc.text.split(" ");
      let committed = 0;
      for (let i = 0; i < words.length; i++) {
        if (my !== run || !alive) return;
        if (skip) break;
        voice.kick();
        committed = Math.max(committed, i + 1 - 2 - Math.floor(Math.random() * 2));
        renderWords(words.slice(0, i + 1), committed);
        const w = words[i];
        let d = 90 + w.length * 34 + Math.random() * 70;
        if (/[,:;—]$/.test(w) || w === "—") d += 280;
        await sleep(d);
      }
      if (my !== run || !alive) return;
      renderWords(words, Math.max(0, words.length - 2));
      await sleep(skip ? 80 : 320);
      if (my !== run || !alive) return;

      setState("processing");
      renderWords(words, words.length);
      await sleep(1100);
      if (my !== run || !alive) return;

      showDone(sc.label);
      sc.items.forEach(([k, v]) => {
        const c = document.createElement("div");
        c.className = "chip glass";
        const a = document.createElement("span");
        a.className = "k";
        a.textContent = k;
        const b = document.createElement("span");
        b.className = "v";
        b.textContent = v;
        c.append(a, b);
        memo.append(c);
      });
      setState("done");
      [...memo.children].forEach((c, n) => timers.push(setTimeout(() => c.classList.add("in"), 120 + n * 130)));
    };

    const toggle = () => {
      if (state === "listening") skip = true;
      else if (state !== "processing") play();
    };
    mic.addEventListener("click", toggle);
    // Space plays the preview only while this section fills the screen, so it never
    // hijacks page scrolling elsewhere
    const onKey = (e: KeyboardEvent) => {
      if (!inView) return;
      if ((e.target as Element | null)?.closest?.("button, a, input, textarea")) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        toggle();
      }
    };
    addEventListener("keydown", onKey);

    return () => {
      alive = false;
      run++;
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      io.disconnect();
      removeEventListener("keydown", onKey);
      mic.removeEventListener("click", toggle);
      themeBtn.removeEventListener("click", onTheme);
      // keep the context alive: React can re-attach this same canvas (StrictMode, back/forward)
      // and a lost context would leave the cube unable to compile its shaders
    };
  }, []);

  return (
    <section
      ref={rootRef}
      id="qbikk"
      className={`qbikk ${geist.variable} ${geistMono.variable}`}
      data-theme="light"
      data-state="idle"
      aria-label="QBIKK"
    >
      <div className="page">
        <canvas className="cube" aria-hidden="true" />

        <header>
          <a className="logo" href="#qbikk" role="img" aria-label="QBIKK" />
          <div className="actions">
            <button className="theme glass" type="button" aria-label="Switch to dark mode">
              <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
              </svg>
              <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
              </svg>
            </button>
            <a className="cta" href="https://qbikk.com" target="_blank" rel="noopener noreferrer">
              <span>
                Visit<span className="long"> qbikk.com</span>
              </span>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </a>
          </div>
        </header>

        <div className="intro">
          <p className="slogan">Your pocket-sized perfect memory.</p>
        </div>

        <div className="stage" aria-hidden="true" />

        <div className="dock" role="group" aria-label="Preview">
          <div className="pill glass">
            <div className="memo" />
            <i className="dot" />
            <div className="text" aria-live="polite">
              <div className="line">
                <span className="ph">Tap to preview QBIKK</span>
              </div>
            </div>
            <span className="time" />
            <div className="mic-wrap">
              <span className="ring" aria-hidden="true" />
              <button className="mic" type="button" aria-label="Play preview" aria-pressed="false">
                <svg className="i-mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11.5" rx="3" />
                  <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
                </svg>
                <svg className="i-stop" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="7" y="7" width="10" height="10" rx="2.4" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
          <p className="note">Scripted preview · no audio is recorded</p>
        </div>
      </div>
    </section>
  );
}
