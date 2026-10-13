import { MUNICH } from './astro';

/**
 * Echtes Wetter in München (Open-Meteo, kostenlos, ohne Schlüssel): Schneefall-Intensität
 * (0 = kein Schnee … 3 = starker Schneefall) und Bewölkung in Prozent (für Nebel/Wolken zwischen den
 * Bergen). Gecacht (30 min) im localStorage dieses Geräts; ohne Netz oder bei Fehlern: leichter Schnee,
 * Bewölkung unbekannt.
 */
export type SnowLevel = 0 | 1 | 2 | 3;

export interface Weather {
  level: SnowLevel;
  /** Bewölkung 0–100 %, null = unbekannt. */
  clouds: number | null;
}

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

interface Cached extends Weather {
  at: number;
}

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Cached>;
    if (typeof c.at !== 'number' || ![0, 1, 2, 3].includes(c.level ?? -1)) return null;
    // Alte Einträge (vor der Bewölkung) gelten als unbekannt – nicht verwerfen.
    const clouds = typeof c.clouds === 'number' ? c.clouds : null;
    return { at: c.at, level: c.level as SnowLevel, clouds };
  } catch {
    return null;
  }
}

export async function fetchWeather(
  now = Date.now(),
  fetcher: typeof fetch = (...a) => fetch(...a),
): Promise<Weather> {
  const cached = readCache();
  if (cached && now - cached.at < MAX_AGE_MS && cached.clouds !== null)
    return { level: cached.level, clouds: cached.clouds };
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${MUNICH.lat}&longitude=${MUNICH.lon}&current=weather_code,cloud_cover&timezone=Europe%2FBerlin`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetcher(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { current?: { weather_code?: number; cloud_cover?: number } };
    const code = data.current?.weather_code;
    if (typeof code !== 'number') throw new Error('kein weather_code');
    const cover = data.current?.cloud_cover;
    const weather: Weather = {
      level: snowLevelFromCode(code),
      clouds: typeof cover === 'number' ? Math.max(0, Math.min(100, cover)) : null,
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: now, ...weather } satisfies Cached));
    } catch {
      // Speicher gesperrt (privater Modus): ohne Cache weiter
    }
    return weather;
  } catch {
    return cached
      ? { level: cached.level, clouds: cached.clouds }
      : { level: OFFLINE_FALLBACK, clouds: null };
  }
}
