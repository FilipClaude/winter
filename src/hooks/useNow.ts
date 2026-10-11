import { useEffect, useState } from 'react';
import { todayISO, type ISODate } from '../lib/date';

/** Aktuelle Zeit, aktualisiert im angegebenen Takt und beim Zurückkehren in die App. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** Heutiger Kalendertag (Berlin); wechselt automatisch um Mitternacht. */
export function useToday(): ISODate {
  return todayISO(useNow(30_000));
}
