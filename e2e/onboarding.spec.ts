import { expect, test } from './fixtures';

test.describe('Einführung beim Erststart', () => {
  test.use({ onboarding: true });

  test('erscheint bei leerer App, lässt sich durchblättern, kommt danach nicht wieder', async ({ page }) => {
    await page.goto('./#/heute');
    const intro = page.getByTestId('onboarding');
    await expect(intro).toBeVisible();
    await expect(intro.getByRole('heading', { name: 'Willkommen bei Winter' })).toBeFocused();
    await intro.getByRole('button', { name: 'Weiter' }).click();
    // Fokus wandert mit (VoiceOver liest den neuen Schritt vor) – Review-4-Fund
    await expect(intro.getByRole('heading', { name: 'Alles bleibt auf deinem iPhone' })).toBeFocused();
    await intro.getByRole('button', { name: 'Zurück' }).click();
    await expect(intro.getByRole('heading', { name: 'Willkommen bei Winter' })).toBeVisible();
    for (let i = 0; i < 3; i++) await intro.getByRole('button', { name: 'Weiter' }).click();
    await intro.getByRole('button', { name: 'Leer starten' }).click();
    await expect(intro).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByTestId('onboarding')).toBeHidden();
  });

  test('Überspringen, später in den Einstellungen erneut öffnen', async ({ page }) => {
    await page.goto('./#/heute');
    await page.getByTestId('onboarding').getByRole('button', { name: 'Überspringen' }).click();
    await expect(page.getByTestId('onboarding')).toBeHidden();
    await page.goto('./#/einstellungen');
    await page.getByTestId('show-onboarding').click();
    const intro = page.getByTestId('onboarding');
    await expect(intro).toBeVisible();
    // Escape wirkt auch nach dem Blättern; Tab bleibt im Dialog
    await intro.getByRole('button', { name: 'Weiter' }).click();
    await expect(intro.getByRole('heading', { name: 'Alles bleibt auf deinem iPhone' })).toBeFocused();
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    await expect(intro.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(intro).toBeHidden();
    // Fokus zurück auf den Auslöser
    await expect(page.getByTestId('show-onboarding')).toBeFocused();
  });

  test('mit Demo-Daten starten', async ({ page }) => {
    await page.goto('./#/heute');
    const intro = page.getByTestId('onboarding');
    for (let i = 0; i < 3; i++) await intro.getByRole('button', { name: 'Weiter' }).click();
    await intro.getByRole('button', { name: 'Mit Demo-Daten umsehen' }).click();
    // Rund 300 Demo-Einträge – in WebKit dauert das ein paar Sekunden
    await expect(intro).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText('Demo-Daten aktiv')).toBeVisible();
  });
});
