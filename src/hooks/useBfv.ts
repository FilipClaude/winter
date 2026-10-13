import { useEffect } from 'react';
import { db } from '../db/db';
import { zBfvData, type BfvData } from '../lib/bfv/bfv';
import { useKV } from './useSettings';

const KEY = 'bfv';
let lastFetch = 0;

/**
 * Lädt `data/bfv.json` (vom BFV-Abgleich, Netz zuerst; der Service Worker hält eine Kopie für offline)
 * und legt den letzten gültigen Stand in kv ab – so ist er auch ohne Netz und ohne Cache da.
 * Höchstens alle 10 Minuten nach einem erfolgreichen Abruf, beim Start, bei Rückkehr in die App und wenn das Netz zurückkommt.
 */
export async function refreshBfv(force = false): Promise<void> {
  if (!force && Date.now() - lastFetch < 10 * 60_000) return;
  lastFetch = Date.now();
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/bfv.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = zBfvData.safeParse(await res.json());
    if (!parsed.success) return;
    const current = (await db.kv.get(KEY))?.value as BfvData | undefined;
    if (current?.fetchedAt !== parsed.data.fetchedAt) await db.kv.put({ key: KEY, value: parsed.data });
  } catch {
    // offline oder Datei fehlt: letzter Stand bleibt. Sperre zurücksetzen, damit es beim nächsten
    // Anlass (Rückkehr, wieder online) sofort neu versucht wird (Review-4-Fund).
    lastFetch = 0;
  }
}

export function useBfv(): BfvData | undefined {
  const raw = useKV<unknown>(KEY);
  useEffect(() => {
    void refreshBfv();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshBfv();
    };
    const onOnline = () => void refreshBfv();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);
  const r = zBfvData.safeParse(raw);
  return r.success ? r.data : undefined;
}
