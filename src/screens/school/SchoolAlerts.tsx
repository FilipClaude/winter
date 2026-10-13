import { useLiveQuery } from 'dexie-react-hooks';
import { AlarmClock, GraduationCap } from 'lucide-react';
import { db } from '../../db/db';
import { schoolAlerts } from '../../lib/calc/school';
import { addDays, type ISODate } from '../../lib/date';
import { navigate } from '../../router';
import { Banner, Button } from '../../ui/primitives';
import { EXAM_KIND_LABEL } from './school-utils';

/** Schul-Hinweise auf „Heute“: Klausur bald mit offenen Themen, überfällige Aufgaben. */
export function SchoolAlerts({ today }: { today: ISODate }) {
  const alerts = useLiveQuery(async () => {
    const [exams, subjects, todos] = await Promise.all([
      db.exams.where('date').between(today, addDays(today, 3), true, true).toArray(),
      db.subjects.toArray(),
      db.todos.where('due').below(today).toArray(),
    ]);
    const name = new Map(subjects.map((s) => [s.id, s.name]));
    return schoolAlerts({
      today,
      exams: exams
        .filter((e) => e.points === undefined)
        .map((e) => ({ id: e.id, subject: name.get(e.subjectId) ?? 'Fach', kind: EXAM_KIND_LABEL[e.kind], date: e.date, progress: e.progress, topicList: e.topicList })),
      overdueTodos: todos.filter((t) => !t.done).length,
    });
  }, [today]);
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="stack stack--s" data-testid="school-alerts" role="region" aria-label="Schul-Hinweise">
      {alerts.map((a) => (
        <Banner
          key={a.id}
          icon={a.examId ? GraduationCap : AlarmClock}
          tone={a.tone}
          action={
            <Button variant="ghost" size="s" className={a.tone === 'accent' ? 'accent' : undefined} onClick={() => navigate('schule', a.examId ? 'klausuren' : 'aufgaben')}>
              Öffnen
            </Button>
          }
        >
          {a.text}
        </Banner>
      ))}
    </div>
  );
}
