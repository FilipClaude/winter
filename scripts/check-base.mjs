// Prüft einen Build mit BASE_PATH (z. B. /winter/): App startet, Service Worker übernimmt, Offline-Neuladen klappt.
// Aufruf: BASE_PATH=/winter/ npm run build, dann node scripts/check-base.mjs /winter/
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? '/winter/';
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', '4174', '--strictPort', '--host', '127.0.0.1'],
  { stdio: 'ignore' },
);
const url = `http://127.0.0.1:4174${base}`;

try {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* Server startet noch */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}#/heute`);
  await page.waitForSelector('nav', { timeout: 10000 });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('nav', { timeout: 10000 });
  const heading = await page.locator('h1').first().textContent();
  console.log(JSON.stringify({ scope, offlineHeading: heading, errors }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
} finally {
  server.kill();
}
