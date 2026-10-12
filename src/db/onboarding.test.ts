import { beforeEach, describe, expect, it } from 'vitest';
import { todayISO } from '../lib/date';
import { db } from './db';
import { getSettings, needsOnboarding, saveSettings, saveTodo } from './repo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Einführung nur beim echten Erststart', () => {
  it('leere App ohne Einstellungen → Einführung', async () => {
    expect(await needsOnboarding()).toBe(true);
  });

  it('v1-Einstellungen ohne Feld „onboarded“ → keine Einführung', async () => {
    await db.kv.put({ key: 'settings', value: { snow: true } });
    expect(await needsOnboarding()).toBe(false);
  });

  it('vorhandene Einträge (z. B. v1 ohne gespeicherte Einstellungen) → keine Einführung, wird vermerkt', async () => {
    await saveTodo({ date: todayISO(), title: 'Mathe', done: false });
    expect(await needsOnboarding()).toBe(false);
    expect((await getSettings()).onboarded).toBe(true);
  });

  it('einmal gesehen → nie wieder automatisch', async () => {
    await saveSettings({ onboarded: true });
    expect(await needsOnboarding()).toBe(false);
  });
});
