import { MUNICH } from './astro';

/**
 * Schneefall-Intensität nach dem echten Wetter in München (Open-Meteo, kostenlos, ohne Schlüssel).
 * Ergebnis 0 = kein Schnee … 3 = starker Schneefall. Gecacht (30 min) im localStorage dieses Geräts;
 * ohne Netz oder bei Fehlern: „leicht“ (1).
 */
export type SnowLevel = 0 | 1 | 2 | 3;

const CACHE_KEY = 'winter:weather';
const MAX_AGE_MS = 30 * 60_000;
export const OFFLINE_FALLBACK: SnowLevel = 1;

/** WMO-Wettercode → Schneestufe (71/73/75 Schneefall, 77 Schneegriesel, 85/86 Schneeschauer). */
export function snowLevelFromCode(code: number): SnowLevel {
  if (code === 75 || code === 86) return 3;
  if (code === 73 || code === 85) return 2;
  if (code === 71 || code === 77) return 1;
  return 0;
}

interface Cached {
  at: number;
  level: SnowLevel;
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return typeof c.at === 'number' && [0, 1, 2, 3].includes(c.level) ? c : null;
  } catch {
    return null;
  }
}

export async function fetchSnowLevel(
  now = Date.now(),
  fetcher: typeof fetch = (...a) => fetch(...a),
): Promise<SnowLevel> {
  const cached = readCache();
  if (cached && now - cached.at < MAX_AGE_MS) return cached.level;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${MUNICH.lat}&longitude=${MUNICH.lon}&current=weather_code&timezone=Europe%2FBerlin`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetcher(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { current?: { weather_code?: number } };
    const code = data.current?.weather_code;
    if (typeof code !== 'number') throw new Error('kein weather_code');
    const level = snowLevelFromCode(code);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: now, level } satisfies Cached));
    } catch {
      // Speicher gesperrt (privater Modus): ohne Cache weiter
    }
    return level;
  } catch {
    return cached?.level ?? OFFLINE_FALLBACK;
  }
}
