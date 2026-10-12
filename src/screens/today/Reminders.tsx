import { useLiveQuery } from 'dexie-react-hooks';
import { FlaskConical, HardDrive } from 'lucide-react';
import { db } from '../../db/db';
import { useKV } from '../../hooks/useSettings';
import { diffDays, toISODate, type ISODate } from '../../lib/date';
import { navigate } from '../../router';
import { Banner, Button } from '../../ui/primitives';

/** Erinnerung, wenn echte Daten existieren und das letzte Backup älter als 7 Tage ist (oder fehlt). */
export function BackupReminder({ today }: { today: ISODate }) {
  const last = useKV<string>('lastBackupAt');
  const hasRealData = useLiveQuery(async () => {
    const real = (x: { demo?: number }) => x.demo !== 1;
    const counts = await Promise.all([db.days.filter(real).count(), db.sessions.filter(real).count(), db.meals.filter(real).count()]);
    return counts.some((c) => c > 0);
  }, []);
  const age = last ? diffDays(toISODate(last), today) : null;
  if (!hasRealData || (age !== null && age <= 7)) return null;
  return (
    <Banner
      icon={HardDrive}
      tone="warn"
      testId="backup-reminder"
      action={
        <Button variant="ghost" size="s" onClick={() => navigate('einstellungen')}>
          Sichern
        </Button>
      }
    >
      {age === null ? 'Noch kein Backup.' : `Letztes Backup vor ${age} Tagen.`}
    </Banner>
  );
}

export function DemoNotice() {
  const active = useKV<boolean>('demoActive') === true;
  if (!active) return null;
  return (
    <Banner
      icon={FlaskConical}
      testId="demo-notice"
      action={
        <Button variant="ghost" size="s" onClick={() => navigate('einstellungen')}>
          Verwalten
        </Button>
      }
    >
      Demo-Daten aktiv.
    </Banner>
  );
}
