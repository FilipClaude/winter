// Erkundung der BFV-Mannschaftsseite (einmalig bzw. zur Reparatur, wenn der Abgleich bricht):
// lädt die Seite in Chromium, protokolliert alle JSON-/iCal-Anfragen und sucht Export-Links.
// Aufruf: node scripts/bfv-explore.mjs [Mannschafts-URL]
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const url =
  process.argv[2] ?? 'https://www.bfv.de/mannschaften/sv-planegg-krailling/016PAD8FHK000000VV0AG811VTE5EA5R';
const UA = 'Winter-App/2 (private Nutzung, 1 Abruf/Tag; Kontakt: github.com/FilipClaude/winter)';

const browser = await chromium.launch();
const page = await browser.newPage({ userAgent: UA, locale: 'de-DE' });
const seen = [];
page.on('response', async (res) => {
  const ct = res.headers()['content-type'] ?? '';
  const u = res.url();
  if (/json|calendar|ics/.test(ct) || /\.ics|ical|api|rest|widget/i.test(u)) {
    let sample = '';
    try {
      sample = (await res.text()).slice(0, 600);
    } catch {
      sample = '(nicht lesbar)';
    }
    seen.push({ url: u, status: res.status(), type: ct, sample });
  }
});
await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(3000);
const links = await page.$$eval('a', (as) =>
  as
    .map((a) => ({ text: (a.textContent ?? '').trim().slice(0, 60), href: a.href }))
    .filter((l) => /ical|ics|kalender|export|spielplan|tabelle|spieler/i.test(l.href + l.text)),
);
const text = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
writeFileSync('bfv-explore.json', JSON.stringify({ url, requests: seen, links, text }, null, 2));
console.log(`Anfragen: ${seen.length}, Links: ${links.length} → bfv-explore.json`);
await browser.close();
