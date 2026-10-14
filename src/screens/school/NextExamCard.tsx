import { useLiveQuery } from 'dexie-react-hooks';
import { GraduationCap, Plus } from 'lucide-react';
import { db } from '../../db/db';
import type { Exam } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import { examCountdown, formatExamDay, lastMock, mockResults, pickNextExams, upcomingExams, type MockResult } from '../../lib/calc/exams';
import { formatDecimal } from '../../lib/calc/insights';
import { topicStatus } from '../../lib/calc/school';
import { isUniSubject } from '../../lib/calc/subjects';
import { addDays, diffDays, formatMinutes, type ISODate } from '../../lib/date';
import { useOverlay } from '../../ui/overlay-context';
import { Button, Card, ProgressBar } from '../../ui/primitives';
import { EXAM_KIND_LABEL } from './school-utils';
import { ExamSheet } from './SchoolSheets';

/** Lernzeit-Fenster vor der Klausur. */
const STUDY_WINDOW = 14;

interface Item {
  exam: Exam;
  subject: string;
  topics: { done: number; total: number } | null;
  mock: MockResult | undefined;
  studyMin: number;
}

function useNextExams(today: ISODate) {
  const settings = useSettings();
  return useLiveQuery(async () => {
    const [exams, subjects] = await Promise.all([db.exams.where('date').aboveOrEqual(today).toArray(), db.subjects.toArray()]);
    const hidden = new Set(subjects.filter(isUniSubject).map((s) => s.id));
    const name = new Map(subjects.map((s) => [s.id, s.name]));
    const { next, also } = pickNextExams(upcomingExams(exams.filter((e) => !hidden.has(e.subjectId)), today));
    const pick = [next, also].filter((e): e is Exam => e !== null);
    const [mocks, study] = await Promise.all([
      db.mockExams.where('examId').anyOf(pick.map((e) => e.id)).toArray(),
      db.studySessions.where('date').between(addDays(today, -(STUDY_WINDOW - 1)), today, true, true).toArray(),
    ]);
    const results = mockResults(mocks, settings.npScale);
    const item = (exam: Exam): Item => ({
      exam,
      subject: name.get(exam.subjectId) ?? 'Fach',
      topics: topicStatus(exam.topicList),
      mock: lastMock(results, exam.id),
      studyMin: study.filter((s) => s.subjectId === exam.subjectId).reduce((a, s) => a + s.minutes, 0),
    });
    return { next: next ? item(next) : null, also: also ? item(also) : null };
  }, [today, settings.npScale]);
}

function mockText(m: MockResult): string {
  return `Probe ${formatDecimal(m.percent, m.percent % 1 ? 1 : 0)} % · ≈ ${m.points} P`;
}

/**
 * Nächste Klausur mit Countdown, Themenstand, letztem Probe-Ergebnis und Lernzeit der letzten 14 Tage.
 * `hero` = große Karte oben im Schule-Tab, sonst Widget auf „Heute“. Ein Tap öffnet die Klausur.
 */
export function NextExamCard({ today, hero = false }: { today: ISODate; hero?: boolean }) {
  const data = useNextExams(today);
  const { openSheet } = useOverlay();
  const open = (exam?: Exam) => openSheet({ title: 'Klausur', render: (close) => <ExamSheet close={close} {...(exam ? { exam } : {})} /> });
  // Platz schon beim Laden reservieren (eine Zeile wie der Leerzustand) – sonst springt das Dashboard,
  // sobald die Daten da sind (Lighthouse-Fund im Abschluss-Audit v3, CLS 0,14).
  if (!data)
    return (
      <Card label="Nächste Klausur" icon={GraduationCap} ariaLabel="Nächste Klausur" className={hero ? 'next-exam next-exam--hero' : 'next-exam'}>
        <div className="next-exam__empty" aria-busy="true">
          <p className="small skeleton__text">&nbsp;</p>
        </div>
      </Card>
    );
  const { next, also } = data;
  return (
    <Card
      label="Nächste Klausur"
      icon={GraduationCap}
      ariaLabel="Nächste Klausur"
      testId={hero ? 'next-exam-hero' : 'next-exam'}
      className={hero ? 'next-exam next-exam--hero' : 'next-exam'}
      warn={next !== null && diffDays(today, next.exam.date) <= 1}
    >
      {next === null ? (
        <div className="next-exam__empty">
          <p className="small faint">Keine Klausur geplant.</p>
          <Button variant="secondary" size="s" icon={Plus} onClick={() => open()}>
            Klausur eintragen
          </Button>
        </div>
      ) : (
        <>
          <button type="button" className="next-exam__main" onClick={() => open(next.exam)} data-testid="next-exam-main">
            <span className="next-exam__head">
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="next-exam__subject truncate">{next.subject}</span>
                <span className="next-exam__meta">
                  {EXAM_KIND_LABEL[next.exam.kind]} · {formatExamDay(next.exam.date)}
                </span>
              </span>
              <span className={`next-exam__count ${diffDays(today, next.exam.date) <= 1 ? 'warn' : ''}`}>{examCountdown(next.exam.date, today)}</span>
            </span>
            <span className="next-exam__facts">
              <span>{next.topics ? `${next.topics.done}/${next.topics.total} Themen sitzen` : `Lernstand ${next.exam.progress} %`}</span>
              {next.mock && <span>{mockText(next.mock)}</span>}
              <span>{next.studyMin > 0 ? `${formatMinutes(next.studyMin)} gelernt (14 T.)` : 'noch nicht gelernt (14 T.)'}</span>
            </span>
            <ProgressBar
              value={next.topics ? next.topics.done / next.topics.total : next.exam.progress / 100}
              label="Lernstand"
              decorative
              warn={diffDays(today, next.exam.date) <= 3 && (next.topics ? next.topics.done < next.topics.total : next.exam.progress < 60)}
            />
          </button>
          {also && (
            <button type="button" className="next-exam__also" onClick={() => open(also.exam)} data-testid="next-exam-also">
              <span className="faint">danach</span>
              <span className="grow truncate">
                {also.subject} · {EXAM_KIND_LABEL[also.exam.kind]} · {formatExamDay(also.exam.date)}
              </span>
              <span className="mono faint">{examCountdown(also.exam.date, today)}</span>
            </button>
          )}
        </>
      )}
    </Card>
  );
}
