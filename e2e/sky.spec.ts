import { expect, test, type Page } from './fixtures';
import { enableDemo, shot } from './helpers';

async function simulate(page: Page, label: 'Echt' | 'Nacht' | 'Morgen' | 'Tag' | 'Abend') {
  await page.goto('./#/einstellungen');
  await page
    .getByRole('group', { name: 'Tageszeit simulieren' })
    .getByRole('button', { name: label, exact: true })
    .click();
}

test('Winterhimmel: alle Phasen per Entwickler-Schalter, Glas passt sich an @screens', async ({ page }) => {
  test.setTimeout(120_000);
  await enableDemo(page);
  const phases = [
    ['Nacht', 'night'],
    ['Morgen', 'dawn'],
    ['Tag', 'day'],
    ['Abend', 'dusk'],
  ] as const;
  const glass: number[] = [];
  for (const [label, id] of phases) {
    await simulate(page, label);
    await page.goto('./#/heute');
    await expect(page.locator('html')).toHaveAttribute('data-sky', id);
    glass.push(
      await page.evaluate(() =>
        Number(getComputedStyle(document.documentElement).getPropertyValue('--glass-alpha')),
      ),
    );
    await shot(page, `03-himmel-${id}`);
  }
  // Am Tag ist das Glas am dichtesten (Lesbarkeit auf hellerem Himmel)
  expect(Math.max(...glass)).toBe(glass[2]);
  await simulate(page, 'Echt');
});

test('Bewegung reduzieren: statischer Himmel, kein Animations-Loop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#/heute');
  await expect(page.getByTestId('sky')).toBeVisible();
  const frames = await page.evaluate(async () => {
    let n = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      n++;
      return orig(cb);
    };
    await new Promise((r) => setTimeout(r, 1500));
    return n;
  });
  // Einzelne Frames anderer Komponenten sind erlaubt, aber kein 30-fps-Loop (≈ 45 in 1,5 s).
  expect(frames).toBeLessThan(3);
  // Nebel steht still (keine CSS-Animation)
  await expect(page.locator('.sky-fog--moving')).toHaveCount(0);
});

test('Nebel zieht zwischen den Bergketten (zwei Bänder), mit Schnee „Aus“ steht er still', async ({
  page,
}) => {
  await page.goto('./#/heute');
  await expect(page.locator('.sky-fog')).toHaveCount(2);
  // CI-WebKit läuft mit „Bewegung reduzieren“ (playwright.config) – dann steht der Nebel zu Recht still
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await expect(page.locator('.sky-fog--moving')).toHaveCount(reduced ? 0 : 2);
  await page.goto('./#/einstellungen');
  await page.getByRole('group', { name: 'Schnee' }).getByRole('button', { name: 'Aus' }).click();
  await page.goto('./#/heute');
  await expect(page.locator('.sky-fog--moving')).toHaveCount(0);
});

test('Leerlauf-CPU des Himmels messen (Chromium, CDP) @perf', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'CDP-Messung nur in Chromium');
  // Messung auf geteilten CI-Runnern ist zu unruhig für eine harte Schranke – nur lokal.
  test.skip(!!process.env.CI, 'CPU-Messung nur lokal');
  test.setTimeout(90_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const measure = async () => {
    const metric = async () => {
      const { metrics } = (await cdp.send('Performance.getMetrics')) as {
        metrics: { name: string; value: number }[];
      };
      return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
    };
    await page.waitForTimeout(1500);
    const a = await metric();
    await page.waitForTimeout(10_000);
    const b = await metric();
    const wall = (b.Timestamp ?? 0) - (a.Timestamp ?? 0);
    return {
      cpuPercent: Math.round((((b.TaskDuration ?? 0) - (a.TaskDuration ?? 0)) / wall) * 1000) / 10,
      scriptPercent: Math.round((((b.ScriptDuration ?? 0) - (a.ScriptDuration ?? 0)) / wall) * 1000) / 10,
    };
  };
  await page.goto('./#/heute');
  const snow = await measure();
  await page.goto('./#/einstellungen');
  await page.getByRole('group', { name: 'Schnee' }).getByRole('button', { name: 'Aus' }).click();
  await page.goto('./#/heute');
  const still = await measure();
  const result = { snow, still, note: 'Hauptthread-Anteil im Leerlauf, 10 s, Chromium Desktop (Windows)' };
  await info.attach('sky-cpu.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  console.warn('SKY-CPU', JSON.stringify(result));
  // Schranke gegen Rückschritte: Schnee < 8 % Hauptthread (gemessen allein 5,8–6,1 % inkl. Nebel/Funkeln;
  // parallel zu anderen Tests bis ~7,4 %), ohne Schnee < 2 % (0 %).
  expect(snow.cpuPercent).toBeLessThan(8);
  expect(still.cpuPercent).toBeLessThan(2);
});

test('Schnee aus: kein Dauer-Loop (Akku)', async ({ page }) => {
  await page.goto('./#/einstellungen');
  await page.getByRole('group', { name: 'Schnee' }).getByRole('button', { name: 'Aus' }).click();
  await page.goto('./#/heute');
  await page.waitForTimeout(500);
  const frames = await page.evaluate(async () => {
    let n = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      n++;
      return orig(cb);
    };
    await new Promise((r) => setTimeout(r, 1500));
    return n;
  });
  // Ohne Schnee nur Einzelbilder bei Scroll/Minutenwechsel – im Leerlauf (fast) keine.
  expect(frames).toBeLessThan(5);
});
