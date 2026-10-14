import { beforeEach, describe, expect, it } from 'vitest';
import { generateDemo } from '../lib/demo';
import { db } from './db';
import {
  deleteEarning,
  deleteExam,
  deleteMockExam,
  restoreRow,
  saveEarning,
  saveExam,
  saveExamWithGrade,
  saveMockExam,
  saveSession,
  ValidationError,
} from './repo';
import { zMockExam } from './schemas';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function mathe() {
  const s = (await db.subjects.toArray()).find((x) => x.name === 'Mathe');
  if (!s) throw new Error('Mathe fehlt');
  return saveExam({ date: '2026-10-20', subjectId: s.id, kind: 'klausur', topics: '', progress: 0 });
}

describe('Probe-Klausuren (Datenschicht)', () => {
  it('speichert Kommazahlen, prüft BE und löscht mit Rückgängig', async () => {
    const exam = await mathe();
    const m = await saveMockExam({
      date: '2026-10-12',
      examId: exam.id,
      subjectId: exam.subjectId,
      points: 15.5,
      maxPoints: 22,
      durationMin: 45,
    });
    expect((await db.mockExams.get(m.id))?.points).toBe(15.5);
    await expect(
      saveMockExam({
        date: '2026-10-12',
        examId: exam.id,
        subjectId: exam.subjectId,
        points: 23,
        maxPoints: 22,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      saveMockExam({
        date: '2026-10-12',
        examId: exam.id,
        subjectId: exam.subjectId,
        points: 1,
        maxPoints: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const gone = await deleteMockExam(m.id);
    expect(await db.mockExams.count()).toBe(0);
    if (!gone) throw new Error('nicht zurückgegeben');
    await restoreRow('mockExams', gone);
    expect(await db.mockExams.get(m.id)).toEqual(m);
  });

  it('Klausur löschen entfernt ihre Probe-Durchgänge, andere bleiben', async () => {
    const a = await mathe();
    const b = await mathe();
    await saveMockExam({
      date: '2026-10-12',
      examId: a.id,
      subjectId: a.subjectId,
      points: 10,
      maxPoints: 20,
    });
    await saveMockExam({
      date: '2026-10-12',
      examId: b.id,
      subjectId: b.subjectId,
      points: 10,
      maxPoints: 20,
    });
    await deleteExam(a.id);
    expect((await db.mockExams.toArray()).map((m) => m.examId)).toEqual([b.id]);
  });

  it('Demo-Daten enthalten gültige Probe-Durchgänge zu vorhandenen Klausuren', () => {
    const d = generateDemo(
      [
        { id: 'm', name: 'Mathe' },
        { id: 'p', name: 'PuG' },
      ],
      '2026-10-13',
    );
    expect(d.mockExams.length).toBe(5);
    for (const m of d.mockExams) {
      expect(zMockExam.safeParse(m).success).toBe(true);
      expect(d.exams.some((e) => e.id === m.examId)).toBe(true);
    }
  });
});

describe('Verdienst (Datenschicht)', () => {
  it('nur ganze, positive Cent-Beträge; Bearbeiten behält id und createdAt', async () => {
    const e = await saveEarning({ date: '2026-10-13', amountCents: 1250, note: 'Nachhilfe' });
    await expect(saveEarning({ date: '2026-10-13', amountCents: 12.5 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(saveEarning({ date: '2026-10-13', amountCents: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveEarning({ date: '2026-10-13', amountCents: -100 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    const edited = await saveEarning({
      id: e.id,
      createdAt: e.createdAt,
      date: '2026-10-14',
      amountCents: 2000,
    });
    expect(edited.id).toBe(e.id);
    expect(edited.createdAt).toBe(e.createdAt);
    expect(await db.earnings.count()).toBe(1);
    expect((await db.earnings.get(e.id))?.amountCents).toBe(2000);
    const gone = await deleteEarning(e.id);
    expect(await db.earnings.count()).toBe(0);
    if (!gone) throw new Error('nicht zurückgegeben');
    await restoreRow('earnings', gone);
    expect(await db.earnings.get(e.id)).toEqual(edited);
  });
});

describe('Gym-Split (Datenschicht)', () => {
  it('Split bleibt nur bei Gym-Einheiten, alte Einheiten ohne Split bleiben gültig', async () => {
    const gym = await saveSession({
      date: '2026-10-13',
      type: 'gym',
      durationMin: 60,
      rpe: 7,
      note: '',
      split: 'pull',
    });
    expect((await db.sessions.get(gym.id))?.split).toBe('pull');
    const old = await saveSession({ date: '2026-10-13', type: 'gym', durationMin: 60, rpe: 7, note: '' });
    expect((await db.sessions.get(old.id))?.split).toBeUndefined();
    const run = await saveSession({
      date: '2026-10-13',
      type: 'run',
      durationMin: 30,
      rpe: 5,
      note: '',
      split: 'legs',
    });
    expect((await db.sessions.get(run.id))?.split).toBeUndefined();
  });
});

describe('Review 2 (Datenschicht)', () => {
  it('Fachwechsel der Klausur nimmt ihre Probe-Durchgänge mit', async () => {
    const exam = await mathe();
    await saveMockExam({
      date: '2026-10-12',
      examId: exam.id,
      subjectId: exam.subjectId,
      points: 10,
      maxPoints: 20,
    });
    const bio = (await db.subjects.toArray()).find((s) => s.name === 'Bio');
    if (!bio) throw new Error('Bio fehlt');
    await saveExamWithGrade({ ...exam, subjectId: bio.id });
    expect((await db.mockExams.toArray()).map((m) => m.subjectId)).toEqual([bio.id]);
  });
});
