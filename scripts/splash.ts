/**
 * iOS-Startbildschirme als vollflächiger Nachthimmel (Mond, Sterne, Alpen) statt Icon-Kachel.
 * Läuft nach `pwa-assets-generator` (`npm run icons`) und überschreibt dessen Splash-PNGs in gleicher
 * Größe – Dateinamen und `<link>`-Tags in index.html bleiben unverändert.
 * Farben = Tokens --sky-night-* / --color-accent (PNG-Assets können keine CSS-Variablen lesen).
 */
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const DIR = 'public';

/** Deterministische Pseudozufallszahlen, damit die Sterne bei jedem Lauf gleich liegen. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function splashSvg(w: number, h: number): string {
  const rand = rng(7);
  const stars = Array.from({ length: 38 }, () => {
    const x = rand() * w;
    const y = rand() * h * 0.58;
    const r = (0.6 + rand() * 1.4) * (w / 400);
    const o = 0.35 + rand() * 0.6;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${o.toFixed(2)}"/>`;
  }).join('');
  const mx = w * 0.64;
  const my = h * 0.26;
  const mr = w * 0.085;
  const base = h * 0.78;
  const u = w / 100;
  const far = `M0 ${base} L${18 * u} ${base - 16 * u} L${30 * u} ${base - 8 * u} L${47 * u} ${base - 26 * u} L${62 * u} ${base - 10 * u} L${74 * u} ${base - 18 * u} L${w} ${base - 2 * u} V${h} H0Z`;
  const near = `M0 ${base + 9 * u} L${24 * u} ${base - 3 * u} L${42 * u} ${base + 7 * u} L${66 * u} ${base - 5 * u} L${w} ${base + 10 * u} V${h} H0Z`;
  const cap = `M${47 * u} ${base - 26 * u} L${53 * u} ${base - 20 * u} L${50 * u} ${base - 20.6 * u} L${47 * u} ${base - 17.6 * u} L${44 * u} ${base - 20.2 * u} L${41 * u} ${base - 19.6 * u}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04060B"/>
      <stop offset="0.6" stop-color="#070B13"/>
      <stop offset="0.8" stop-color="#0D1422"/>
      <stop offset="1" stop-color="#0D1422"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#A9D8F5" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#A9D8F5" stop-opacity="0"/>
    </radialGradient>
    <mask id="moon">
      <rect width="${w}" height="${h}" fill="#000"/>
      <circle cx="${mx}" cy="${my}" r="${mr}" fill="#fff"/>
      <circle cx="${mx + mr * 0.48}" cy="${my - mr * 0.32}" r="${mr * 0.9}" fill="#000"/>
    </mask>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <circle cx="${mx}" cy="${my}" r="${mr * 3}" fill="url(#halo)"/>
  <rect width="${w}" height="${h}" fill="#E4F2FC" mask="url(#moon)"/>
  <g fill="#E4ECF4">${stars}</g>
  <path d="${far}" fill="#142034"/>
  <path d="${cap}" fill="#CFE6FA" opacity="0.55"/>
  <path d="${near}" fill="#090E17"/>
</svg>`;
}

// Die App ist nur im Hochformat (Manifest `orientation: portrait`) – Querformat-Bilder wären Ballast.
for (const f of readdirSync(DIR).filter((x) => x.startsWith('apple-splash-landscape-'))) rmSync(join(DIR, f));

const files = readdirSync(DIR).filter((f) => /^apple-splash-portrait-\d+x\d+\.png$/.test(f));
for (const f of files) {
  const m = /(\d+)x(\d+)/.exec(f);
  if (!m) continue;
  const w = Number(m[1]);
  const h = Number(m[2]);
  await sharp(Buffer.from(splashSvg(w, h)))
    // Keine Palette: Die Quantisierung erzeugt im dunklen Verlauf sichtbare Stufen. Splashes sind nicht im Precache.
    .png({ compressionLevel: 9 })
    .toFile(join(DIR, f));
}
console.log(`${files.length} Startbildschirme geschrieben.`);
