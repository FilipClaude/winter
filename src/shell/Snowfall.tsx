import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  phase: number;
  alpha: number;
}

/** Ganz dezenter Schneefall. Aus bei prefers-reduced-motion oder in den Einstellungen. */
export function Snowfall({ enabled }: { enabled: boolean }) {
  const reduce = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = enabled && !reduce;

  useEffect(() => {
    const el = canvas.current;
    if (!active || !el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const color =
      getComputedStyle(document.documentElement).getPropertyValue('--color-frost').trim() || 'white';
    let w = 0;
    let h = 0;
    let flakes: Flake[] = [];
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(46, (w * h) / 16000));
      flakes = Array.from({ length: count }, () => spawn(true));
    };
    const spawn = (anywhere: boolean): Flake => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -6,
      r: 0.6 + Math.random() * 1.4,
      vy: 8 + Math.random() * 16,
      drift: 4 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.12 + Math.random() * 0.28,
    });

    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (const f of flakes) {
        f.y += f.vy * dt;
        f.phase += dt * 0.6;
        const x = f.x + Math.sin(f.phase) * f.drift;
        if (f.y > h + 6) Object.assign(f, spawn(false));
        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === 'visible') {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvas} className="snow" aria-hidden data-testid="snow" />;
}
