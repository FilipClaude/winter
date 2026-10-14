import type { LucideIcon } from 'lucide-react';
import { BarChart3, CalendarCheck, Dumbbell, GraduationCap, Plus, Sun } from 'lucide-react';
import { navigate, type RouteId, type TabId } from '../router';
import { useOverlay } from '../ui/overlay-context';
import { QuickAddSheet } from '../screens/quickadd/QuickAddSheet';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'heute', label: 'Heute', icon: Sun },
  { id: 'training', label: 'Training', icon: Dumbbell },
  { id: 'schule', label: 'Schule', icon: GraduationCap },
  { id: 'alltag', label: 'Alltag', icon: CalendarCheck },
  { id: 'rueckblick', label: 'Rückblick', icon: BarChart3 },
];

export function TabBar({ active }: { active: RouteId }) {
  const { openSheet } = useOverlay();
  return (
    <>
      <button
        type="button"
        className="fab"
        aria-label="Schnellerfassung"
        data-testid="fab"
        onClick={() => openSheet({ title: 'Was willst du eintragen?', render: () => <QuickAddSheet /> })}
      >
        <Plus size={26} strokeWidth={2} aria-hidden />
      </button>
      <nav className="tabbar" aria-label="Hauptnavigation">
        <div className="tabbar__inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tab"
              aria-current={active === t.id ? 'page' : undefined}
              onClick={() => navigate(t.id)}
            >
              <t.icon size={22} strokeWidth={1.5} aria-hidden />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
