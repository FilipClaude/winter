import { useLiveQuery } from 'dexie-react-hooks';
import type { LucideIcon } from 'lucide-react';
import { BookOpenCheck, Dumbbell, GraduationCap, HeartPulse, ListTodo, Moon, NotebookPen, Smile, Timer } from 'lucide-react';
import { db } from '../../db/db';
import { emptyDay, updateDay } from '../../db/repo';
import { useSettings } from '../../hooks/useSettings';
import { todayISO } from '../../lib/date';
import { Scale } from '../../ui/controls';
import { useOverlay, type OverlayApi } from '../../ui/overlay-context';
import { Button } from '../../ui/primitives';
import { SleepSheet } from '../body/SleepSheet';
import { openHealthSheet } from '../health/openHealth';
import { ExamSheet, StudySheet, TodoSheet } from '../school/SchoolSheets';
import { JournalSheet } from '../today/JournalSheet';
import { openSessionSheet } from '../training/openSession';

interface Entry {
  id: string;
  label: string;
  icon: LucideIcon;
  run: (api: OverlayApi, ctx: { shortcutName: string }) => void | Promise<void>;
}

const ENTRIES: Entry[] = [
  { id: 'training', label: 'Training', icon: Dumbbell, run: (api) => openSessionSheet(api.openSheet, { date: todayISO() }) },
  { id: 'schlaf', label: 'Schlaf', icon: Moon, run: (api) => api.openSheet({ title: 'Schlaf', render: (close) => <SleepSheet date={todayISO()} close={close} /> }) },
  { id: 'lernen', label: 'Lernzeit', icon: Timer, run: (api) => api.openSheet({ title: 'Lernzeit', render: (close) => <StudySheet close={close} /> }) },
  { id: 'aufgabe', label: 'Aufgabe', icon: ListTodo, run: (api) => api.openSheet({ title: 'Aufgabe', render: (close) => <TodoSheet close={close} /> }) },
  { id: 'klausur', label: 'Klausur', icon: GraduationCap, run: (api) => api.openSheet({ title: 'Klausur', render: (close) => <ExamSheet close={close} /> }) },
  { id: 'stimmung', label: 'Stimmung', icon: Smile, run: (api) => api.openSheet({ title: 'Stimmung & Energie', render: (close) => <MoodSheet close={close} /> }) },
  {
    id: 'notiz',
    label: 'Tagesnotiz',
    icon: NotebookPen,
    run: async (api) => {
      const day = (await db.days.get(todayISO())) ?? emptyDay(todayISO());
      api.openSheet({ title: 'Tagesnotiz', render: (close) => <JournalSheet day={day} close={close} /> });
    },
  },
  { id: 'health', label: 'Health holen', icon: HeartPulse, run: (api, ctx) => openHealthSheet(api.openSheet, ctx.shortcutName) },
  { id: 'habits', label: 'Habits', icon: BookOpenCheck, run: (api) => { api.closeSheet(); window.location.hash = '#/habits'; } },
];

export function QuickAddSheet() {
  const api = useOverlay();
  const settings = useSettings();
  return (
    <div className="quick-grid" data-testid="quick-add">
      {ENTRIES.map((e) => (
        <button key={e.id} type="button" className="quick-tile" onClick={() => void e.run(api, { shortcutName: settings.shortcutName })} data-testid={`qa-${e.id}`}>
          <e.icon size={22} strokeWidth={1.5} aria-hidden />
          <span>{e.label}</span>
        </button>
      ))}
    </div>
  );
}

function MoodSheet({ close }: { close: () => void }) {
  const date = todayISO();
  const day = useLiveQuery(() => db.days.get(date), [date]);
  return (
    <div className="form">
      <div className="field">
        <span className="field__label">Stimmung</span>
        <Scale label="Stimmung" value={day?.mood} onChange={(v) => void updateDay(date, { mood: v })} allowClear fill />
      </div>
      <div className="field">
        <span className="field__label">Energie</span>
        <Scale label="Energie" value={day?.energy} onChange={(v) => void updateDay(date, { energy: v })} allowClear fill />
      </div>
      <Button variant="primary" block onClick={close}>
        Fertig
      </Button>
    </div>
  );
}
