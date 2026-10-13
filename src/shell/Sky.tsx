import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { Settings, SkyPhase } from '../db/schemas';
import { skyState, type SkyState } from '../lib/sky/phase';
import { blendPalette, readPalettes, rgbString, type RGB, type SkyPalette } from '../lib/sky/palette';
import { fetchSnowLevel, type SnowLevel } from '../lib/sky/weather';

/**
 * Winterhimmel hinter der UI: Verlauf nach echter Tageszeit (München), Sterne, Mond in der echten
 * Phase, Horizontlicht, Alpensilhouette in drei Ebenen (Parallaxe) und Schnee in drei Tiefen.
 *
 * Akku/Leistung: eine Canvas, statische Teile vorgerendert (nur jede Minute neu), Animation nur für
 * Schnee mit max. 30 fps, Pause bei verdecktem Tab, Pixeldichte ≤ 1,5. Bei „Bewegung reduzieren“
 * ein einziges statisches Bild ohne Schnee und Parallaxe.
 */

const FPS = 30;
const MAX_DPR = 1.5;

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  phase: number;
  alpha: number;
}

interface Layer {
  depth: 0 | 1 | 2;
  flakes: Flake[];
}

/** Deterministischer Zufall (gleicher Sternenhimmel bei jedem Start). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const lerp = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Alpenkamm als Punkte (x 0–1, y 0–1 = Anteil der Ebenenhöhe), aus überlagerten Zacken. */
function ridge(seed: number, peaks: number, jag: number, width: [number, number]): [number, number][] {
  const rnd = seeded(seed);
  const pts: [number, number][] = [];
  const n = 120;
  // Breite Massive statt Nadeln: Die Ebenen sind hoch (bis 60 % des Hochformats), schmale Gipfel
  // sähen dort wie Stalagmiten aus.
  const tops = Array.from({ length: peaks }, () => ({
    x: rnd(),
    h: 0.45 + rnd() * 0.55,
    w: width[0] + rnd() * (width[1] - width[0]),
  }));
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    let y = 0.18;
    for (const p of tops) {
      const d = Math.abs(x - p.x) / p.w;
      if (d < 1) y = Math.max(y, p.h * (1 - d ** 1.15));
    }
    y += (rnd() - 0.5) * jag;
    pts.push([x, Math.min(1, Math.max(0.05, y))]);
  }
  return pts;
}

const RIDGES = [
  ridge(7, 6, 0.012, [0.22, 0.4]),
  ridge(19, 5, 0.016, [0.25, 0.45]),
  ridge(31, 4, 0.02, [0.3, 0.55]),
];
/**
 * Höhe der Alpen-Ebenen (Anteil der Bildschirmhöhe, fern → nah). Die ferne Kette reicht bis 60 % hinauf –
 * vorher (20/15/10 %) lagen die Berge fast ganz hinter Tab-Leiste und Karten (Filips Fund am iPhone).
 */
const ALP_HEIGHT = [0.6, 0.42, 0.26];
/** Parallaxe: Beim Scrollen wandern die Ebenen langsamer als der Inhalt nach oben (nah = schneller). */
const PARALLAX = [0.03, 0.06, 0.1];
/** Höchstens so weit (px) verschiebt die Parallaxe; so viel Fläche liegt unter jeder Ebene in Reserve. */
const PARALLAX_MAX = 80;
/** Anteil der Schneefarbe auf den Gipfeln je Ebene (fern → nah). */
const SNOW_MIX = [1, 0.7, 0.45];

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function Sky({ settings }: { settings: Pick<Settings, 'snowMode' | 'skySimulate' | 'tilt'> }) {
  const reduce = useReducedMotion() ?? false;
  const canvas = useRef<HTMLCanvasElement>(null);
  const snowCanvas = useRef<HTMLCanvasElement>(null);
  const { snowMode, skySimulate, tilt } = settings;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d', { alpha: false });
    if (!ctx) return;
    const snowEl = snowCanvas.current;
    const snowCtx = snowEl?.getContext('2d') ?? null;
    let snowDpr = 1;
    const palettes = readPalettes(readCssVar);
    const bgColor = readCssVar('--color-bg');
    const bgRgb = parseRgb(bgColor);
    const starColor = readCssVar('--color-star');
    const moonColor = readCssVar('--color-moon');
    const frost = readCssVar('--color-frost');
    const root = document.documentElement;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let state: SkyState = skyState(new Date(), skySimulate);
    let pal: SkyPalette = blendPalette(palettes, state.weights, bgRgb);
    const back = document.createElement('canvas');
    const alps = [0, 1, 2].map(() => document.createElement('canvas'));
    let snowFactor = snowMode === 'off' || reduce ? 0 : 1;
    let layers: Layer[] = [];
    let scrollY = window.scrollY;
    let tiltX = 0;
    let raf = 0;
    let last = 0;
    let dirty = true;

    const applyRootVars = (phase: SkyPhase, glass: number) => {
      root.dataset.sky = phase;
      root.style.setProperty('--glass-alpha', glass.toFixed(3));
    };

    const renderBack = () => {
      const b = back.getContext('2d');
      if (!b) return;
      back.width = Math.round(w * dpr);
      back.height = Math.round(h * dpr);
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = pal.colors;
      const g = b.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgbString(c.top));
      g.addColorStop(0.45, rgbString(c.mid));
      g.addColorStop(0.82, rgbString(c.horizon));
      g.addColorStop(1, rgbString(c.horizon));
      b.fillStyle = g;
      b.fillRect(0, 0, w, h);

      // Horizontlicht: dort, wo die Sonne steht (Azimut −90…+90° ≙ links…rechts), sonst mittig.
      const glowStrength = 1 - state.weights.night;
      if (glowStrength > 0.01) {
        const az = Math.max(-100, Math.min(100, state.sun.azimuth));
        const gx = w * (0.5 + az / 200);
        const gy = h * 0.86;
        const rg = b.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.55);
        rg.addColorStop(0, rgbString(c.glow, 0.9 * glowStrength));
        rg.addColorStop(0.5, rgbString(c.glow, 0.35 * glowStrength));
        rg.addColorStop(1, rgbString(c.glow, 0));
        b.fillStyle = rg;
        b.fillRect(0, 0, w, h);
      }

      // Sterne (fest verteilt, Dichte nach Phase)
      if (state.stars > 0.02) {
        const rnd = seeded(42);
        const count = Math.round(((w * h) / 2600) * state.stars);
        b.fillStyle = starColor;
        for (let i = 0; i < count; i++) {
          const x = rnd() * w;
          const y = rnd() * h * 0.7;
          const r = 0.35 + rnd() ** 3 * 0.9;
          b.globalAlpha = (0.15 + rnd() * 0.55) * state.stars * (1 - y / (h * 0.85));
          b.beginPath();
          b.arc(x, y, r, 0, Math.PI * 2);
          b.fill();
        }
        b.globalAlpha = 1;
      }

      // Mond in der echten Phase (Position stilisiert oben rechts hinter dem Kopfbereich)
      const moonVis = Math.max(0, 1 - state.weights.day * 1.4) * Math.min(1, state.moon.illumination * 4);
      if (moonVis > 0.02) {
        const mx = w * 0.8;
        const my = h * 0.13;
        const mr = 13;
        const halo = b.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
        halo.addColorStop(0, rgbString(parseRgb(moonColor), 0.1 * moonVis));
        halo.addColorStop(1, rgbString(parseRgb(moonColor), 0));
        b.fillStyle = halo;
        b.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
        drawMoon(b, mx, my, mr, state.moon.phase, moonColor, 0.75 * moonVis);
      }
    };

    /**
     * Jede Ebene: Bergkamm (Höhe `ridgeH`) + darunter PARALLAX_MAX px Reserve, damit beim Hochwandern
     * unten keine Lücke entsteht. Gipfel mit Schneekuppen (Token `snow`, nach unten in die Bergfarbe).
     */
    const renderAlps = () => {
      alps.forEach((cv, i) => {
        const a = cv.getContext('2d');
        if (!a) return;
        const ridgeH = Math.round(h * (ALP_HEIGHT[i] ?? 0.1));
        const lh = ridgeH + PARALLAX_MAX;
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(lh * dpr);
        a.setTransform(dpr, 0, 0, dpr, 0, 0);
        const col = pal.colors[`alp-${i + 1}` as 'alp-1'];
        a.fillStyle = rgbString(col);
        a.beginPath();
        a.moveTo(0, lh);
        for (const [x, y] of RIDGES[i] ?? []) a.lineTo(x * w * 1.1 - w * 0.05, ridgeH - y * ridgeH);
        a.lineTo(w, lh);
        a.closePath();
        a.fill();
        a.globalCompositeOperation = 'source-atop';
        const snowCap = lerp(col, pal.colors.snow, SNOW_MIX[i] ?? 0.5);
        const sg = a.createLinearGradient(0, 0, 0, ridgeH * 0.55);
        sg.addColorStop(0, rgbString(snowCap));
        sg.addColorStop(0.35, rgbString(lerp(col, snowCap, 0.5)));
        sg.addColorStop(1, rgbString(col));
        a.fillStyle = sg;
        a.fillRect(0, 0, w, ridgeH * 0.55);
        a.globalCompositeOperation = 'source-over';
      });
    };

    const spawnLayers = () => {
      const area = (w * h) / 100_000;
      const rnd = Math.random;
      const make = (depth: 0 | 1 | 2, n: number): Layer => ({
        depth,
        flakes: Array.from({ length: Math.round(n * area * snowFactor) }, () => newFlake(depth, true)),
      });
      const newFlake = (depth: 0 | 1 | 2, anywhere: boolean): Flake => {
        const spec = [
          { r: [0.4, 0.9], v: [5, 10], a: [0.12, 0.22] },
          { r: [0.9, 1.6], v: [11, 20], a: [0.16, 0.3] },
          { r: [1.4, 2.2], v: [24, 38], a: [0.12, 0.2] },
        ][depth] ?? { r: [1, 1], v: [10, 10], a: [0.2, 0.2] };
        const pick = ([a, b]: number[]) => (a ?? 0) + rnd() * ((b ?? 0) - (a ?? 0));
        return {
          x: rnd() * w,
          y: anywhere ? rnd() * h : -8,
          r: pick(spec.r),
          vy: pick(spec.v),
          drift: 3 + rnd() * (6 + depth * 6),
          phase: rnd() * Math.PI * 2,
          alpha: pick(spec.a),
        };
      };
      layers = [make(0, 9), make(1, 5), make(2, 1.4)];
      respawn = newFlake;
    };
    let respawn: (depth: 0 | 1 | 2, anywhere: boolean) => Flake = () => ({
      x: 0,
      y: 0,
      r: 1,
      vy: 1,
      drift: 0,
      phase: 0,
      alpha: 0,
    });

    // Weiche Schneeflocke für die nahe Ebene (vorgerendert statt teurem shadowBlur).
    const soft = document.createElement('canvas');
    soft.width = soft.height = 32;
    const sctx = soft.getContext('2d');
    if (sctx) {
      const rg = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      rg.addColorStop(0, rgbString(parseRgb(frost), 1));
      rg.addColorStop(0.45, rgbString(parseRgb(frost), 0.55));
      rg.addColorStop(1, rgbString(parseRgb(frost), 0));
      sctx.fillStyle = rg;
      sctx.fillRect(0, 0, 32, 32);
    }

    /** Ruhende Ebene: Himmel, Alpen (mit Parallaxe), Abdunklung. Nur bei Änderungen neu. */
    const composeSky = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(back, 0, 0, w, h);
      alps.forEach((cv, i) => {
        const lh = cv.height / dpr;
        // Nach oben (wie ein ferner Hintergrund beim Scrollen) – vorher wanderten sie nach unten weg.
        const off = reduce ? 0 : Math.min(PARALLAX_MAX, Math.max(0, scrollY) * (PARALLAX[i] ?? 0));
        const tx = reduce ? 0 : tiltX * (i + 1) * 3;
        ctx.drawImage(cv, tx - 12, h - (lh - PARALLAX_MAX) - off, w + 24, lh);
      });
      if (pal.veil > 0.001) {
        ctx.fillStyle = rgbString(parseRgb(bgColor), pal.veil);
        ctx.fillRect(0, 0, w, h);
      }
    };

    /** Animierte Ebene: nur die Flocken auf einer durchsichtigen Canvas darüber. */
    const drawSnow = (dt: number) => {
      if (!snowCtx) return;
      snowCtx.setTransform(snowDpr, 0, 0, snowDpr, 0, 0);
      snowCtx.clearRect(0, 0, w, h);
      if (snowFactor <= 0) return;
      snowCtx.fillStyle = frost;
      for (const layer of layers) {
        for (const f of layer.flakes) {
          f.y += f.vy * dt;
          f.phase += dt * (0.4 + layer.depth * 0.2);
          if (f.y > h + 10) Object.assign(f, respawn(layer.depth, false));
          const x = f.x + Math.sin(f.phase) * f.drift;
          snowCtx.globalAlpha = f.alpha;
          if (layer.depth === 2) {
            const s = f.r * 4;
            snowCtx.drawImage(soft, x - s / 2, f.y - s / 2, s, s);
          } else {
            snowCtx.beginPath();
            snowCtx.arc(x, f.y, f.r, 0, Math.PI * 2);
            snowCtx.fill();
          }
        }
      }
      snowCtx.globalAlpha = 1;
    };

    const refreshSky = () => {
      state = skyState(new Date(), skySimulate);
      pal = blendPalette(palettes, state.weights, bgRgb);
      applyRootVars(state.phase, pal.glass);
      renderBack();
      renderAlps();
      dirty = true;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      // iOS meldet beim Start im Hintergrund kurz 0 × 0 – eine leere Canvas ließe drawImage werfen.
      if (w < 1 || h < 1) return;
      dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      if (snowEl) {
        // Flocken sind weich – volle Pixeldichte bringt nichts, kostet aber Füllrate.
        snowDpr = 1;
        snowEl.width = w;
        snowEl.height = h;
      }
      refreshSky();
      spawnLayers();
      composeSky();
      dirty = false;
      drawSnow(0);
    };

    const animating = () => snowFactor > 0 && !reduce;
    const frame = (t: number) => {
      raf = 0;
      if (document.visibilityState !== 'visible' || back.width < 1 || back.height < 1) return;
      if (dirty) {
        composeSky();
        dirty = false;
      }
      if (animating()) {
        const elapsed = t - last;
        if (elapsed >= 1000 / FPS - 2) {
          drawSnow(Math.min(0.1, elapsed / 1000));
          last = t;
        }
        raf = requestAnimationFrame(frame);
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onScroll = () => {
      scrollY = window.scrollY;
      dirty = true;
      kick();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (back.width < 1) resize();
        else refreshSky();
        last = performance.now();
        loadWeather();
        kick();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      tiltX = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30));
      dirty = true;
      kick();
    };

    let cancelled = false;
    // Echtes Wetter: beim Start und bei jeder Rückkehr in die App (der Cache hält 30 min).
    function loadWeather() {
      if (snowMode !== 'weather' || reduce) return;
      void fetchSnowLevel().then((level: SnowLevel) => {
        if (cancelled) return;
        const next = [0, 1, 1.8, 2.6][level] ?? 1;
        if (next === snowFactor) return;
        snowFactor = next;
        spawnLayers();
        root.dataset.snow = String(level);
        kick();
      });
    }

    resize();
    kick();
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    if (tilt && !reduce) window.addEventListener('deviceorientation', onTilt);
    const minute = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshSky();
      kick();
    }, 60_000);

    loadWeather();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearInterval(minute);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [reduce, snowMode, skySimulate, tilt]);

  return (
    <>
      <canvas ref={canvas} className="sky" aria-hidden data-testid="sky" />
      <canvas ref={snowCanvas} className="sky sky--snow" aria-hidden />
    </>
  );
}

function parseRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as RGB;
}

/**
 * Mond als beleuchtete Sichel/Scheibe: Die Scheibe wird auf einer eigenen kleinen Ebene gezeichnet und
 * der Schattenteil herausgeschnitten (durchsichtig) – so bleibt dort der Himmel sichtbar.
 * phase 0 = Neumond, 0,5 = Vollmond. Zunehmend = rechts beleuchtet (Nordhalbkugel).
 */
function drawMoon(
  b: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: number,
  color: string,
  alpha: number,
) {
  const size = Math.ceil(r * 2 + 4);
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size * 2;
  const m = sprite.getContext('2d');
  if (!m) return;
  m.scale(2, 2);
  const c = size / 2;
  m.fillStyle = color;
  m.beginPath();
  m.arc(c, c, r, 0, Math.PI * 2);
  m.fill();
  const waxing = phase < 0.5;
  const k = Math.cos(phase * 2 * Math.PI); // 1 = neu, −1 = voll
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  // dunkle Hälfte: links bei zunehmendem, rechts bei abnehmendem Mond
  const start = waxing ? Math.PI / 2 : -Math.PI / 2;
  m.arc(c, c, r + 1, start, start + Math.PI);
  // Terminator: halbe Ellipse mit Halbachse |k|·r; k > 0 (Sichel) ragt in die helle Hälfte
  m.ellipse(c, c, Math.abs(k) * (r + 1), r + 1, 0, start + Math.PI, start, k < 0);
  m.closePath();
  m.fill();
  b.save();
  b.globalAlpha = alpha;
  b.drawImage(sprite, x - c, y - c, size, size);
  b.restore();
}
