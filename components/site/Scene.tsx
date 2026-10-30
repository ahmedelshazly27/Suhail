"use client";
// One shared animation loop for every ASCII scene on the page, as in the prototype: ~9 fps, only for visible
// canvases, and a single static frame under prefers-reduced-motion.
import { useEffect, useRef, type CSSProperties } from "react";
import { DRAW, RAMP } from "./scene-draw";

export type SceneKind = "home" | "skyline" | "astrolabe" | "tent" | "pattern" | "house" | "dhow" | "dallah" | "rise";

type S = { cv: HTMLCanvasElement; kind: SceneKind; hi: HTMLCanvasElement; lo: HTMLCanvasElement; vis: boolean; cols: number; rows: number; cw: number; ch: number; dpr: number; font: string; sc: string; hi2: string; ac: string };
const list = new Set<S>();
let started = false;
let last = 0;
const reduce = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function size(s: S) {
  const r = s.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (!r.width) return false;
  const cw = r.width < 600 ? 5.5 : 6.2, ch = cw * 1.7;
  s.cols = Math.floor(r.width / cw); s.rows = Math.floor(r.height / ch); s.cw = r.width / s.cols; s.ch = r.height / s.rows;
  s.cv.width = Math.round(r.width * dpr); s.cv.height = Math.round(r.height * dpr); s.dpr = dpr;
  s.hi.width = Math.round(r.width); s.hi.height = Math.round(r.height); s.lo.width = s.cols; s.lo.height = s.rows;
  // Colours and font only change with theme, language or size, which all reset cols, so read them here, not every frame.
  const cs = getComputedStyle(s.cv);
  s.font = `${(s.ch * 0.82).toFixed(1)}px ${cs.getPropertyValue("--f-mono").trim()}`;
  s.sc = cs.getPropertyValue("--scene").trim(); s.hi2 = cs.getPropertyValue("--scene-hi").trim(); s.ac = cs.getPropertyValue("--accent").trim();
  return true;
}

function render(s: S, t: number) {
  if (!s.cols && !size(s)) return;
  const hc = s.hi.getContext("2d")!;
  hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, s.hi.width, s.hi.height); hc.fillStyle = "black"; hc.fillRect(0, 0, s.hi.width, s.hi.height);
  (DRAW as Record<string, (c: CanvasRenderingContext2D, w: number, h: number, t: number) => void>)[s.kind](hc, s.hi.width, s.hi.height, t);
  hc.globalCompositeOperation = "destination-over"; hc.fillStyle = "black"; hc.fillRect(0, 0, s.hi.width, s.hi.height); hc.globalCompositeOperation = "source-over";
  const lc = s.lo.getContext("2d", { willReadFrequently: true })!;
  lc.imageSmoothingEnabled = true; lc.imageSmoothingQuality = "high"; lc.clearRect(0, 0, s.cols, s.rows); lc.drawImage(s.hi, 0, 0, s.cols, s.rows);
  const d = lc.getImageData(0, 0, s.cols, s.rows).data;
  const c = s.cv.getContext("2d")!;
  c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0); c.clearRect(0, 0, s.cv.width, s.cv.height);
  c.font = s.font;
  c.textBaseline = "top";
  const { sc, hi2: hi, ac } = s;
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
    const i = (y * s.cols + x) * 4, r = d[i], g = d[i + 1];
    const v = Math.pow(Math.max(r, g) / 255, 0.62);
    if (v < 0.16) continue;
    const chr = RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))];
    if (chr === " ") continue;
    c.fillStyle = r - g > 50 ? ac : v > 0.55 ? hi : sc;
    c.fillText(chr, x * s.cw, y * s.ch);
  }
}

function refresh() {
  requestAnimationFrame(() => list.forEach((s) => { if (s.cv.offsetParent) { s.cols = 0; render(s, performance.now() / 1000); } }));
}

function loop(ts: number) {
  if (ts - last > 110) { last = ts; const t = ts / 1000; list.forEach((s) => { if (s.vis && s.cv.offsetParent) render(s, t); }); }
  if (!reduce()) requestAnimationFrame(loop);
}

// The first frames are CPU heavy, so they wait until the page has painted its text (the largest paint).
const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));

function start() {
  if (started) return;
  started = true;
  addEventListener("resize", () => { list.forEach((s) => (s.cols = 0)); refresh(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refresh);
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "lang"] });
  document.fonts?.ready.then(refresh);
  if (!reduce()) requestAnimationFrame(loop);
}

export function Scene({ kind, className = "scene", style }: { kind: SceneKind; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const s: S = { cv, kind, hi: document.createElement("canvas"), lo: document.createElement("canvas"), vis: false, cols: 0, rows: 0, cw: 0, ch: 0, dpr: 1, font: "", sc: "", hi2: "", ac: "" };
    list.add(s);
    const io = new IntersectionObserver((es) => { s.vis = es[0].isIntersecting; });
    io.observe(cv);
    let alive = true;
    idle(() => { if (!alive) return; start(); requestAnimationFrame(() => { if (cv.offsetParent) render(s, performance.now() / 1000); }); });
    return () => { alive = false; io.disconnect(); list.delete(s); };
  }, [kind]);
  return <canvas ref={ref} className={className} data-scene={kind} style={style} aria-hidden="true" />;
}
