import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { moveHealthDay } from '../../db/repo';
import { importFrom, TextSource } from './source';

/** Simuliert einen Import an einem bestimmten Kalendertag (Berliner Mittag). */
async function importOn(day: string, json: string) {
  vi.setSystemTime(new Date(`${day}T10:00:00Z`));
  return importFrom(new TextSource(json), day);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Health-Import: Werte nicht von heute (v3.3)', () => {
  it('ein Import für heute ist unauffällig', async () => {
    const r = await importOn('2026-10-16', '{"v":1,"date":"2026-10-16","steps":"4200"}');
    expect(r.ok && r.stale).toBeUndefined();
    expect((await db.health.get('2026-10-16'))?.steps).toBe(4200);
  });

  it('alte Zwischenablage (gleiche Werte, altes Datum) wird abgelehnt statt still „übernommen“', async () => {
    await importOn('2026-10-14', '{"v":1,"date":"2026-10-14","steps":"8423","distanceKm":"6,1"}');
    const r = await importOn('2026-10-16', '{"v":1,"date":"2026-10-14","steps":"8423","distanceKm":"6,1"}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('14.10.2026');
    expect(r.error).toContain('Kurzbefehl starten');
    expect(await db.health.count()).toBe(1);
  });

  it('neue Werte mit altem Datum werden gespeichert, aber als „nicht von heute“ markiert', async () => {
    await importOn('2026-10-14', '{"v":1,"date":"2026-10-14","steps":"5000"}');
    const r = await importOn('2026-10-16', '{"v":1,"date":"2026-10-14","steps":"9100"}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stale).toMatchObject({ date: '2026-10-14', today: '2026-10-16', fixedDate: false });
    expect(r.stale?.previous?.steps).toBe(5000);
  });

  it('erkennt ein fest eingestelltes Datum, wenn derselbe alte Tag an mehreren Tagen kommt', async () => {
    await importOn('2026-10-14', '{"v":1,"date":"2026-10-14","steps":"5000"}');
    await importOn('2026-10-15', '{"v":1,"date":"2026-10-14","steps":"7000"}');
    const r = await importOn('2026-10-16', '{"v":1,"date":"2026-10-14","steps":"3000"}');
    expect(r.ok && r.stale?.fixedDate).toBe(true);
  });

  it('„Für heute speichern“ verschiebt die Werte und stellt den alten Tag wieder her', async () => {
    await importOn('2026-10-14', '{"v":1,"date":"2026-10-14","steps":"5000","distanceKm":"3,2"}');
    const r = await importOn('2026-10-16', '{"v":1,"date":"2026-10-14","steps":"9100","distanceKm":"6,4"}');
    if (!r.ok || !r.stale || !r.saved[0]) throw new Error('erwartet: stale');
    const moved = await moveHealthDay(r.saved[0], r.stale.today, r.stale.previous);
    expect(moved).toMatchObject({ date: '2026-10-16', id: '2026-10-16', steps: 9100, distanceKm: 6.4 });
    expect(await db.health.get('2026-10-14')).toMatchObject({ steps: 5000, distanceKm: 3.2 });
  });

  it('„Für heute speichern“ ohne Vorstand löscht den falschen Tag', async () => {
    const r = await importOn('2026-10-16', '{"v":1,"date":"2026-10-12","steps":"9100"}');
    if (!r.ok || !r.stale || !r.saved[0]) throw new Error('erwartet: stale');
    expect(r.stale.previous).toBeUndefined();
    await moveHealthDay(r.saved[0], r.stale.today, r.stale.previous);
    expect(await db.health.get('2026-10-12')).toBeUndefined();
    expect((await db.health.get('2026-10-16'))?.steps).toBe(9100);
  });

  it('mehrere Tage auf einmal (Nachtragen) bleiben ohne Warnung', async () => {
    const r = await importOn('2026-10-16', '[{"v":1,"date":"2026-10-14","steps":1},{"v":1,"date":"2026-10-15","steps":2}]');
    expect(r.ok && r.stale).toBeUndefined();
    expect(await db.health.count()).toBe(2);
  });
});
