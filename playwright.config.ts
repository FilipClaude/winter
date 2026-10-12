import { defineConfig } from '@playwright/test';

/**
 * Unterordner wie auf GitHub Pages (BASE_PATH=/winter/). Die CI testet genau den Build, der danach
 * veröffentlicht wird; lokal ohne BASE_PATH unter „/“. Tests navigieren deshalb relativ („./#/heute“).
 */
const BASE = process.env.BASE_PATH ?? '/';
const ORIGIN = 'http://localhost:4173';

const iphone = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  colorScheme: 'dark' as const,
};

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  // In CI zusätzlich ein HTML-Report (wird bei Fehlern als Artefakt hochgeladen).
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `${ORIGIN}${BASE}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    ...iphone,
  },
  projects: [
    { name: 'iphone', testIgnore: /offline\.spec\.ts/, use: { browserName: 'chromium' } },
    // WebKit = Safari-Engine (Annäherung ans iPhone). Screenshots nur einmal (Chromium), sonst doppelt.
    {
      name: 'webkit',
      testIgnore: /offline\.spec\.ts|visual\.spec\.ts/,
      // CI-Runner rendern WebKit ohne GPU: Glas-Unschärfe über animiertem Schnee macht jedes Bild so
      // langsam, dass Klicks ins Zeitlimit laufen. Dort statischer Himmel (Bewegung reduzieren).
      use: {
        browserName: 'webkit',
        contextOptions: { reducedMotion: process.env.CI ? 'reduce' : 'no-preference' },
      },
    },
    {
      name: 'offline',
      testMatch: /offline\.spec\.ts/,
      use: { browserName: 'chromium', serviceWorkers: 'allow' },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: `${ORIGIN}${BASE}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
