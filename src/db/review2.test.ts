import { beforeEach, describe, expect, it } from 'vitest';
import { buildStudyPlan } from '../lib/calc/studyplan';
import { bussUndBettag, nextBreak, schoolFreeReason, semesterForDate } from '../lib/calc/calendar-by';
import { todayISO, addDays } from '../lib/date';
import { db } from './db';
import {
  deleteExam,
  replaceExamPlan,
  saveExamWithGrade,
  saveGrade,
  saveStudyBlock,
  saveTodo,
  toggleTodo,
} from './repo';

/** Regressionstests zu den Funden aus dem unabhängigen Review der Phasen 4–6. */

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const examBase = { kind: 'klausur' as const, date: '2026-10-20', topics: '', progress: 0 };

describe('Klausur ↔ Note (kritische Funde 1–3)', () => {
  it('mehrfaches Speichern derselben Klausur: genau eine Klausur, genau eine Note', async () => {
    const first = await saveExamWithGrade({ ...examBase, subjectId: 'mathe', points: 11 });
    await saveExamWithGrade({
      ...examBase,
      id: first.id,
      createdAt: first.createdAt,
      subjectId: 'mathe',
      points: 12,
    });
    await saveExamWithGrade({
      ...examBase,
      id: first.id,
      createdAt: first.createdAt,
      subjectId: 'mathe',
      points: 12,
    });
    expect(await db.exams.count()).toBe(1);
    const grades = await db.grades.toArray();
    expect(grades).toHaveLength(1);
    expect(grades[0]).toMatchObject({ examId: first.id, points: 12, size: 'gross', semester: '12/1' });
  });

  it('Fachwechsel verschiebt die Note, statt eine verwaiste im alten Fach zu lassen', async () => {
    const e = await saveExamWithGrade({ ...examBase, subjectId: 'deutsch', points: 9 });
    await saveExamWithGrade({ ...examBase, id: e.id, createdAt: e.createdAt, subjectId: 'mathe', points: 9 });
    const grades = await db.grades.toArray();
    expect(grades).toHaveLength(1);
    expect(grades[0]?.subjectId).toBe('mathe');
  });

  it('bearbeitete Note behält die Verknüpfung: kein Duplikat beim nächsten Speichern der Klausur', async () => {
    const e = await saveExamWithGrade({ ...examBase, subjectId: 'mathe', points: 10 });
    const g = (await db.grades.toArray())[0];
    if (!g) throw new Error('Note fehlt');
    // Wie im Noten-Sheet: Gewicht ändern, examId bleibt erhalten
    await saveGrade({ ...g, weight: 2 });
    await saveExamWithGrade({
      ...examBase,
      id: e.id,
      createdAt: e.createdAt,
      subjectId: 'mathe',
      points: 13,
    });
    const grades = await db.grades.toArray();
    expect(grades).toHaveLength(1);
    expect(grades[0]).toMatchObject({ points: 13, weight: 2 });
  });

  it('Kurzarbeit wird kleiner Leistungsnachweis; ohne Punkte keine Note', async () => {
    const e = await saveExamWithGrade({ ...examBase, kind: 'kurzarbeit', subjectId: 'mathe', points: 8 });
    expect((await db.grades.toArray())[0]?.size).toBe('klein');
    await saveExamWithGrade({
      ...examBase,
      kind: 'kurzarbeit',
      id: e.id,
      createdAt: e.createdAt,
      subjectId: 'mathe',
    });
    expect(await db.grades.count()).toBe(0);
  });

  it('Halbjahr der Klausur steuert die Note; Löschen räumt Note und offene Lerneinheiten weg', async () => {
    const e = await saveExamWithGrade({ ...examBase, subjectId: 'mathe', points: 10, semester: '12/2' });
    expect((await db.grades.toArray())[0]?.semester).toBe('12/2');
    await saveStudyBlock({
      date: '2026-10-15',
      subjectId: 'mathe',
      examId: e.id,
      topic: 'A',
      kind: 'lernen',
      minutes: 30,
      done: true,
    });
    await saveStudyBlock({
      date: '2026-10-16',
      subjectId: 'mathe',
      examId: e.id,
      topic: 'B',
      kind: 'lernen',
      minutes: 30,
      done: false,
    });
    await deleteExam(e.id);
    expect(await db.exams.count()).toBe(0);
    expect(await db.grades.count()).toBe(0);
    expect((await db.studyBlocks.toArray()).map((b) => b.topic)).toEqual(['A']);
  });
});

describe('Lernplan neu erstellen (Fund 10)', () => {
  it('erledigte Einheiten bleiben, bereits gelernte Themen werden nicht erneut zum Lernen geplant', async () => {
    await saveStudyBlock({
      date: todayISO(),
      subjectId: 'm',
      examId: 'x',
      topic: 'Integrale',
      kind: 'lernen',
      minutes: 30,
      done: true,
    });
    await replaceExamPlan('x', [
      {
        date: todayISO(),
        subjectId: 'm',
        examId: 'x',
        topic: 'Integrale',
        kind: 'lernen',
        minutes: 30,
        done: false,
      },
      {
        date: todayISO(),
        subjectId: 'm',
        examId: 'x',
        topic: 'Stochastik',
        kind: 'lernen',
        minutes: 30,
        done: false,
      },
    ]);
    const blocks = await db.studyBlocks.toArray();
    expect(blocks.filter((b) => b.topic === 'Integrale')).toHaveLength(1);
    expect(blocks.some((b) => b.topic === 'Stochastik')).toBe(true);
  });

  it('bei Überbuchung kommt keine Wiederholung vor dem Lernen desselben Themas', () => {
    const topics = Array.from({ length: 8 }, (_, i) => ({ title: `T${i}`, level: 0 }));
    const p = buildStudyPlan('2026-10-19', '2026-10-13', topics, { minutesPerSchoolDay: 30 });
    for (const t of topics) {
      const mine = p.blocks.filter((b) => b.topic === t.title);
      const learn = mine.find((b) => b.kind === 'lernen');
      if (!learn) continue;
      for (const r of mine.filter((b) => b.kind === 'wiederholen')) expect(r.date >= learn.date).toBe(true);
    }
  });
});

describe('Wiederkehrende Aufgaben (Fund 9)', () => {
  it('seit Wochen überfällig: Folgeaufgabe liegt in der Zukunft, nicht wieder überfällig', async () => {
    const today = todayISO();
    const t = await saveTodo({
      date: addDays(today, -30),
      title: 'Vokabeln',
      due: addDays(today, -21),
      done: false,
      repeat: 'weekly',
    });
    await toggleTodo(t.id);
    const next = (await db.todos.toArray()).find((x) => x.id !== t.id);
    expect(next?.due && next.due > today).toBe(true);
    expect(next?.due && next.due <= addDays(today, 7)).toBe(true);
  });

  it('ist die Folgeaufgabe schon erledigt, entsteht beim erneuten Abhaken keine Dublette', async () => {
    const t = await saveTodo({
      date: '2026-10-12',
      title: 'Vokabeln',
      due: addDays(todayISO(), 2),
      done: false,
      repeat: 'weekly',
    });
    await toggleTodo(t.id);
    const follow = (await db.todos.toArray()).find((x) => x.id !== t.id);
    if (!follow) throw new Error('keine Folgeaufgabe');
    await toggleTodo(follow.id); // Folgeaufgabe erledigt (legt ihrerseits die übernächste an)
    await toggleTodo(t.id); // Original wieder öffnen
    await toggleTodo(t.id); // und erneut abhaken
    const sameDue = (await db.todos.toArray()).filter((x) => x.due === follow.due);
    expect(sameDue).toHaveLength(1);
  });
});

describe('Kalender (Fund 11)', () => {
  it('Ferien 2027/28 (Q13, Abiturjahr) aus der Ferienordnung', () => {
    expect(schoolFreeReason('2027-11-03')).toBe('Allerheiligen');
    expect(schoolFreeReason('2028-03-01')).toBe('Frühjahrsferien');
    expect(schoolFreeReason('2028-04-12')).toBe('Osterferien');
    expect(schoolFreeReason('2028-06-14')).toBe('Pfingstferien');
    expect(nextBreak('2027-09-20')).toMatchObject({ name: 'Allerheiligen', from: '2027-11-02' });
  });

  it('Buß- und Bettag: Mittwoch vor dem 23.11.', () => {
    expect(bussUndBettag(2026)).toBe('2026-11-18');
    expect(bussUndBettag(2027)).toBe('2027-11-17');
    expect(bussUndBettag(2028)).toBe('2028-11-22');
    expect(schoolFreeReason('2027-11-17')).toBe('Buß- und Bettag');
  });

  it('Halbjahr aus dem Datum', () => {
    expect(semesterForDate('2026-09-15')).toBe('12/1');
    expect(semesterForDate('2027-02-14')).toBe('12/1');
    expect(semesterForDate('2027-02-15')).toBe('12/2');
    expect(semesterForDate('2027-07-30')).toBe('12/2');
    expect(semesterForDate('2027-09-14')).toBe('13/1');
    expect(semesterForDate('2028-03-01')).toBe('13/2');
  });
});

describe('Review 3: Wiederholung ohne Fälligkeit, an verschiedenen Tagen abgehakt', () => {
  it('keine Dublette, auch wenn das Original mehrfach abgehakt wird', async () => {
    const t = await saveTodo({
      date: addDays(todayISO(), -3),
      title: 'Lesen',
      done: false,
      repeat: 'weekly',
    });
    await toggleTodo(t.id);
    await toggleTodo(t.id);
    await toggleTodo(t.id);
    const all = await db.todos.toArray();
    expect(all.filter((x) => x.id !== t.id)).toHaveLength(1);
  });
});

describe('Review 4: zwei Serien mit gleichem Titel', () => {
  it('Montags- und Donnerstagsserie beenden sich nicht gegenseitig', async () => {
    const mo = await saveTodo({
      date: '2026-10-05',
      due: '2026-10-12',
      title: 'Vokabeln',
      done: false,
      repeat: 'weekly',
    });
    await saveTodo({
      date: '2026-10-05',
      due: '2026-10-15',
      title: 'Vokabeln',
      done: false,
      repeat: 'weekly',
    });
    await toggleTodo(mo.id);
    const dues = (await db.todos.toArray()).map((t) => t.due).sort();
    expect(dues.length).toBe(3);
    expect(dues).toContain('2026-10-15');
    // Folgeaufgabe der Montagsserie liegt wieder auf einem Montag nach heute
    const next = dues.find((d) => d !== '2026-10-12' && d !== '2026-10-15') ?? '';
    expect(new Date(`${next}T12:00:00Z`).getUTCDay()).toBe(1);
  });
});
