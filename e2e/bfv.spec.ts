import { expect, test, type Page } from './fixtures';
import { shot } from './helpers';

/** BFV-Daten relativ zu „jetzt“ – unabhängig vom echten Spielplan und vom Datum des Testlaufs. */
function fakeBfv() {
  const at = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const base = {
    competition: 'Meisterschaften',
    league: 'U 17 (B-Jun.) Landesliga Bayern Süd',
    location: 'Georg Heide Stadion Planegg',
  };
  return {
    format: 1,
    fetchedAt: at(-6),
    team: {
      name: 'SV Planegg-Krailling',
      url: 'https://www.bfv.de/mannschaften/sv-planegg-krailling/x',
      league: base.league,
    },
    season: '2026/27',
    matches: [
      { ...base, id: 'gestern', kickoff: at(-26), home: true, opponent: 'FC Ismaning', status: 'vorbei' },
      { ...base, id: 'naechstes', kickoff: at(50), home: false, opponent: 'ASV Cham', status: 'geplant' },
      { ...base, id: 'danach', kickoff: at(200), home: true, opponent: 'Kirchheimer SC', status: 'geplant' },
    ],
    table: [
      {
        position: 1,
        team: 'TSV 1861 Nördlingen',
        played: 7,
        won: 7,
        drawn: 0,
        lost: 0,
        goals: '32:9',
        diff: 23,
        points: 21,
        own: false,
      },
      {
        position: 4,
        team: 'SV Planegg-Krailling',
        played: 7,
        won: 4,
        drawn: 2,
        lost: 1,
        goals: '17:11',
        diff: 6,
        points: 14,
        own: true,
      },
    ],
    notes: [
      'Ergebnisse und Einzelstatistiken liefert der BFV nicht maschinenlesbar (verschleiert) – bitte nach dem Spiel selbst eintragen.',
    ],
  };
}

async function mockBfv(page: Page) {
  const body = JSON.stringify(fakeBfv());
  await page.route('**/data/bfv.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body }),
  );
}

test('BFV: nächstes Spiel, Tabelle mit Platz, Spiel nach dem Abpfiff mit einem Tap eintragen @screens', async ({
  page,
}) => {
  await mockBfv(page);
  await page.goto('./#/training');
  await expect(page.getByTestId('bfv-next')).toContainText('bei ASV Cham');
  await expect(page.getByTestId('bfv-table')).toContainText('Platz 4');
  await expect(page.getByTestId('bfv-table')).toContainText('verschleiert');
  await shot(page, '15-bfv-training', true);

  const pending = page.getByTestId('pending-matches');
  await expect(pending).toContainText('Spiel gegen FC Ismaning');
  await pending.getByRole('button', { name: 'Eintragen' }).click();
  const d = page.getByRole('dialog', { name: 'Spiel eintragen' });
  await expect(d.getByLabel('Gegner', { exact: true })).toHaveValue('FC Ismaning');
  await expect(d).toContainText('vom BFV · Heimspiel');
  await d.getByLabel('Tore wir').fill('6');
  await d.getByLabel('Tore Gegner').fill('1');
  await d.getByLabel('Tore', { exact: true }).fill('2');
  await shot(page, '15-bfv-spiel-sheet');
  await d.getByRole('button', { name: 'Speichern' }).click();
  await expect(d).toBeHidden();
  // Eingetragen: keine Abfrage mehr; Form zeigt einen Sieg
  await expect(page.getByTestId('pending-matches')).toHaveCount(0);
  await expect(
    page.getByTestId('bfv-card').getByRole('img', { name: /Form der letzten 1 Spiele: Sieg/ }),
  ).toBeVisible();
});

test('BFV auf dem Dashboard: Widget „Nächstes Spiel“ mit Tabellenplatz', async ({ page }) => {
  await mockBfv(page);
  await page.goto('./#/heute');
  const w = page.getByTestId('next-match');
  await expect(w).toContainText('bei ASV Cham');
  await expect(w).toContainText('Platz 4');
});

test('ohne BFV-Datei: Hinweis statt Fehler', async ({ page }) => {
  await page.route('**/data/bfv.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('./#/training');
  await expect(page.getByTestId('bfv-card')).toContainText('Noch keine BFV-Daten');
  await page.goto('./#/heute');
  await expect(page.getByTestId('next-match')).toHaveCount(0);
});
