import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addMealFromTemplate,
  addWater,
  getDay,
  getSettings,
  getTimer,
  saveSession,
  saveSettings,
  saveSleep,
  startTimer,
  stopTimer,
  toggleHabit,
  saveHabit,
  upsertHealthDay,
  updateDay,
  ValidationError,
} from './repo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Erststart', () => {
  it('legt Standardfächer, Übungen und eine Mahlzeitvorlage an', async () => {
    const subjects = await db.subjects.orderBy('order').toArray();
    expect(subjects.map((s) => s.name)).toContain('PuG');
    expect(subjects.at(-1)?.name).toBe('FernUni');
    expect(subjects.find((s) => s.name === 'PuG')?.major).toBe(true);
    expect(await db.exerciseTemplates.count()).toBeGreaterThan(5);
    expect(await db.mealTemplates.count()).toBe(1);
  });

  it('Einstellungen haben Standardwerte und lassen sich speichern', async () => {
    expect((await getSettings()).goals.waterGlasses).toBe(10);
    await saveSettings({ snow: false });
    expect((await getSettings()).snow).toBe(false);
    await expect(saveSettings({ glassMl: 5 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('Tageswerte', () => {
  it('Wasser zählt hoch und nie unter null', async () => {
    await addWater('2026-10-11', 1);
    await addWater('2026-10-11', 1);
    expect((await getDay('2026-10-11')).water).toBe(2);
    await addWater('2026-10-11', -5);
    expect((await getDay('2026-10-11')).water).toBe(0);
  });

  it('Stimmung wird validiert', async () => {
    await updateDay('2026-10-11', { mood: 4 });
    expect((await getDay('2026-10-11')).mood).toBe(4);
    await expect(updateDay('2026-10-11', { mood: 9 })).rejects.toThrow(ValidationError);
  });

  it('Mahlzeit aus Vorlage mit einem Aufruf', async () => {
    const t = await db.mealTemplates.toCollection().first();
    if (!t) throw new Error('Vorlage fehlt');
    const meal = await addMealFromTemplate(t.id, '2026-10-11');
    expect(meal.proteinG).toBe(38);
    expect(meal.templateId).toBe(t.id);
  });
});

describe('Training', () => {
  it('Gym-Einheit merkt sich die letzten Sätze, auch für neue Übungen', async () => {
    await saveSession({
      date: '2026-10-11',
      type: 'gym',
      durationMin: 60,
      rpe: 7,
      note: '',
      gym: { exercises: [{ name: 'kniebeuge', sets: [{ reps: 5, weightKg: 80 }] }, { name: 'Face Pulls', sets: [{ reps: 15, weightKg: 20 }] }] },
    });
    const all = await db.exerciseTemplates.toArray();
    expect(all.find((t) => t.name === 'Kniebeuge')?.lastSets).toEqual([{ reps: 5, weightKg: 80 }]);
    expect(all.find((t) => t.name === 'Face Pulls')).toBeTruthy();
  });

  it('entfernt fremde Zusatzdaten (Spiel-Daten bei Gym)', async () => {
    const s = await saveSession({
      date: '2026-10-11',
      type: 'run',
      durationMin: 30,
      rpe: 5,
      note: '',
      match: { opponent: 'X', goalsFor: 0, goalsAgainst: 0, minutes: 0, goals: 0, assists: 0, shots: 0, rating: 5, reflection: '' },
    });
    expect((await db.sessions.get(s.id))?.match).toBeUndefined();
  });

  it('lehnt unplausible Werte ab', async () => {
    await expect(saveSession({ date: '2026-10-11', type: 'gym', durationMin: 0, rpe: 11, note: '' })).rejects.toThrow(
      ValidationError,
    );
  });
});

describe('Health-Import', () => {
  it('überschreibt Health-Werte, aber nie den manuellen Schlaf', async () => {
    await saveSleep('2026-10-11', '23:00', '07:00', 4);
    await upsertHealthDay({ date: '2026-10-11', steps: 5000, source: 'kurzbefehl' });
    await upsertHealthDay({
      date: '2026-10-11',
      steps: 8423,
      distanceKm: 6.1,
      sleepStart: '2026-10-10T22:30:00Z',
      sleepEnd: '2026-10-11T05:30:00Z',
      source: 'kurzbefehl',
    });
    const h = await db.health.get('2026-10-11');
    expect(h?.steps).toBe(8423);
    expect(await db.health.count()).toBe(1);
    const manual = await db.sleep.where('date').equals('2026-10-11').toArray();
    expect(manual).toHaveLength(1);
    expect(manual[0]?.quality).toBe(4);
  });
});

describe('Lern-Timer', () => {
  it('übersteht Neuladen (gespeicherte Startzeit) und teilt an Mitternacht', async () => {
    const subject = await db.subjects.toCollection().first();
    if (!subject) throw new Error('Fach fehlt');
    await startTimer(subject.id, new Date('2026-12-01T22:30:00Z')); // 23:30 MEZ
    // „Neuladen“: neue DB-Verbindung
    db.close();
    await db.open();
    expect((await getTimer())?.subjectId).toBe(subject.id);
    const total = await stopTimer(new Date('2026-12-01T23:45:00Z')); // 00:45 MEZ
    expect(total).toBe(75);
    const rows = await db.studySessions.orderBy('date').toArray();
    expect(rows.map((r) => [r.date, r.minutes])).toEqual([
      ['2026-12-01', 30],
      ['2026-12-02', 45],
    ]);
    expect(await getTimer()).toBeNull();
  });
});

describe('Habits', () => {
  it('Abhaken ist umschaltbar', async () => {
    const h = await saveHabit({ name: 'Dehnen', schedule: { kind: 'daily' }, archived: false, startDate: '2026-10-01' });
    expect(await toggleHabit(h.id, '2026-10-11')).toBe(true);
    expect(await db.habitChecks.count()).toBe(1);
    expect(await toggleHabit(h.id, '2026-10-11')).toBe(false);
    expect(await db.habitChecks.count()).toBe(0);
  });
});
