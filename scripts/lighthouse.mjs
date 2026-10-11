// Lighthouse-Audit des Produktions-Builds (mobile). Aufruf: npm run lighthouse
// Startet `vite preview`, öffnet Chromium über Playwright mit Debug-Port und misst mit Lighthouse.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

const PORT = 9223;
const URL = 'http://localhost:4173/';

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'],
  { stdio: 'ignore' },
);
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
try {
  const result = await lighthouse(URL, {
    port: PORT,
    output: 'html',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'mobile',
  });
  if (!result) throw new Error('Lighthouse lieferte kein Ergebnis');
  writeFileSync('lighthouse-report.html', result.report);
  const { categories, audits } = result.lhr;
  for (const c of Object.values(categories))
    console.log(`${c.title.padEnd(16)} ${Math.round((c.score ?? 0) * 100)}`);
  for (const id of [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
  ]) {
    console.log(`${audits[id].title}: ${audits[id].displayValue}`);
  }
  for (const c of Object.values(categories)) {
    for (const ref of c.auditRefs) {
      const a = audits[ref.id];
      if (ref.weight > 0 && a.score !== null && a.score < 0.9)
        console.log(`  [${c.title}] ${a.id}: ${a.score} ${a.displayValue ?? ''}`);
    }
  }
} finally {
  await browser.close();
  server.kill();
}
