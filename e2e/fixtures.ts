import { test as base, expect } from '@playwright/test';

/**
 * Gemeinsame Test-Basis. Einzige Anpassung: In der CI rendert WebKit ohne GPU – Glas-Unschärfe
 * (`backdrop-filter`) auf vielen Karten macht dort jedes Bild so teuer, dass Playwrights
 * Stabilitätsprüfung nie fertig wird und Klicks ins Zeitlimit laufen. Nur dort wird die Unschärfe per
 * Stylesheet abgeschaltet (Farben/Deckkraft bleiben). Lokal und in Chromium läuft alles unverändert.
 */
export const test = base.extend<{ onboarding: boolean }>({
  /** Einführung beim Erststart zeigen? Standard aus – sonst läge sie über jedem Test mit leerer DB. */
  onboarding: [false, { option: true }],
  page: async ({ page, browserName, onboarding }, provide) => {
    if (!onboarding)
      await page.addInitScript(() => {
        try {
          localStorage.setItem('winter:skip-onboarding', '1');
        } catch {
          // ohne localStorage erscheint die Einführung – der Test merkt es dann selbst
        }
      });
    if (process.env.CI && browserName === 'webkit') {
      await page.addInitScript(() => {
        const css = '*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}';
        const add = () => {
          const s = document.createElement('style');
          s.dataset.test = 'no-blur';
          s.textContent = css;
          document.head.append(s);
        };
        if (document.head) add();
        else document.addEventListener('DOMContentLoaded', add, { once: true });
      });
    }
    await provide(page);
  },
});

export { expect };
export type { Page } from '@playwright/test';
