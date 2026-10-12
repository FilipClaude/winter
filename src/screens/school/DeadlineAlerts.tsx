import { useLiveQuery } from 'dexie-react-hooks';
import { AlarmClock, CalendarClock, GraduationCap } from 'lucide-react';
import { db } from '../../db/db';
import { toggleDeadline } from '../../db/repo';
import { countdownLabel, type DeadlineLevel } from '../../lib/calc/school';
import { diffDays, formatDE, type ISODate } from '../../lib/date';
import { navigate } from '../../router';
import { FrostCheck } from '../../ui/controls';
import { Card } from '../../ui/primitives';
import { DEADLINE_KIND_LABEL, EXAM_KIND_LABEL, useUrgentDeadlines } from './school-utils';

const LEVEL_TEXT: Record<DeadlineLevel, string> = {
  ueberfaellig: 'Überfällig',
  kritisch: 'Kritisch',
  nah: 'Diese Woche',
  bald: 'In 2 Wochen',
  spaeter: '',
};

export function DeadlineAlerts({ today }: { today: ISODate }) {
  const urgent = useUrgentDeadlines(today);
  if (!urgent || urgent.length === 0) return null;
  return (
    <div className="stack stack--s" data-testid="deadline-alerts" role="region" aria-label="Fristen">
      {urgent.map((d) => {
        const strong = d.level === 'ueberfaellig' || d.level === 'kritisch';
        return (
          <div key={d.id} className={`deadline deadline--${d.level}`} role={strong ? 'alert' : undefined}>
            <AlarmClock size={20} strokeWidth={1.75} aria-hidden className="deadline__icon" />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="deadline__level">
                {LEVEL_TEXT[d.level]} · {DEADLINE_KIND_LABEL[d.kind]}
              </div>
              <div className="deadline__title">
                {d.title} <span className="deadline__when">{countdownLabel(d.date, today)}</span>
              </div>
              <div className="deadline__when truncate">
                {d.moduleName} · {formatDE(d.date)}
                {d.time ? `, ${d.time}` : ''}
              </div>
            </div>
            <FrostCheck checked={false} label={`${d.title} erledigt`} onChange={() => void toggleDeadline(d.id)} />
          </div>
        );
      })}
    </div>
  );
}

/** Nächste Klausur oder Frist mit Countdown. */
export function NextDateCard({ today }: { today: ISODate }) {
  const next = useLiveQuery(async () => {
    const [exams, deadlines, subjects, modules] = await Promise.all([
      db.exams.where('date').aboveOrEqual(today).toArray(),
      db.deadlines.where('date').aboveOrEqual(today).toArray(),
      db.subjects.toArray(),
      db.modules.toArray(),
    ]);
    const sName = new Map(subjects.map((s) => [s.id, s.name]));
    const mName = new Map(modules.map((m) => [m.id, m.name]));
    const items = [
      ...exams
        .filter((e) => e.points === undefined)
        .map((e) => ({ id: e.id, date: e.date, title: sName.get(e.subjectId) ?? 'Fach', kind: EXAM_KIND_LABEL[e.kind], progress: e.progress as number | undefined, exam: true })),
      ...deadlines.filter((d) => !d.done).map((d) => ({ id: d.id, date: d.date, title: `${mName.get(d.moduleId) ?? 'Modul'}: ${d.title}`, kind: DEADLINE_KIND_LABEL[d.kind], progress: undefined, exam: false })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    return items.slice(0, 3);
  }, [today]);

  if (!next) return null;
  const first = next[0];
  return (
    <Card label="Nächster Termin" icon={CalendarClock} ariaLabel="Nächster Termin" onClick={() => navigate('schule')} warn={first !== undefined && diffDays(today, first.date) <= 2}>
      {first ? (
        <div className="stack stack--s">
          <div className="row row--between" style={{ alignItems: 'flex-end' }}>
            <div className="grow">
              <div className="xsmall faint">{first.kind}</div>
              <div className="list-item__title truncate">{first.title}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="big big--s num">{Math.max(0, diffDays(today, first.date))}</div>
              <div className="xsmall faint">{diffDays(today, first.date) === 1 ? 'Tag' : 'Tage'}</div>
            </div>
          </div>
          {first.progress !== undefined && (
            <div className="xsmall muted">
              Lernstand <span className="mono">{first.progress} %</span>
            </div>
          )}
          {next.slice(1).map((n) => (
            <div key={n.id} className="row row--between xsmall faint">
              <span className="truncate">
                {n.kind} · {n.title}
              </span>
              <span className="mono">{countdownLabel(n.date, today)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="row small faint">
          <GraduationCap size={16} strokeWidth={1.5} aria-hidden /> Keine anstehenden Klausuren oder Fristen.
        </div>
      )}
    </Card>
  );
}
