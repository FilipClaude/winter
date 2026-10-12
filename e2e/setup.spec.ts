import { expect, test } from './fixtures';
import { shot } from './helpers';

test('Manifest ist installierbar konfiguriert', async ({ request }) => {
  const res = await request.get('./manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const manifest = (await res.json()) as { display: string; lang: string; icons: { sizes: string }[] };
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('de');
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
});

test('App startet @screens', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#root')).not.toBeEmpty();
  await shot(page, '01-setup');
});
