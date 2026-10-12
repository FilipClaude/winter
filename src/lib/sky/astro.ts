/**
 * Sonnen- und Mondberechnung ohne Netz (vereinfachte Formeln nach NOAA / Meeus, Genauigkeit ~1–2 min
 * bei Sonnenauf- und -untergang in Mitteleuropa – für den Hintergrund mehr als genug).
 */

export const MUNICH = { lat: 48.14, lon: 11.58 } as const;

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J2000 = 2_451_545;

function toJulian(ms: number): number {
  return ms / DAY_MS + 2_440_587.5;
}

function fromJulian(j: number): number {
  return (j - 2_440_587.5) * DAY_MS;
}

/** Sonnenkoordinaten (Deklination, Rektaszension) und Zeitgleichung für einen Julianischen Tag. */
function sunCoords(jd: number) {
  const d = jd - J2000;
  const M = (357.5291 + 0.98560028 * d) * RAD; // mittlere Anomalie
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD;
  const P = 102.9372 * RAD; // Perihel der Erde
  const L = M + C + P + Math.PI; // ekliptikale Länge
  const e = 23.4397 * RAD; // Schiefe der Ekliptik
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  return { M, L, dec, ra };
}

function siderealTime(jd: number, lonRad: number): number {
  return (280.16 + 360.9856235 * (jd - J2000)) * RAD + lonRad;
}

/** Höhe (Grad) und Azimut (Grad, 0 = Süden, positiv nach Westen) der Sonne. */
export function sunPosition(date: Date, lat: number = MUNICH.lat, lon: number = MUNICH.lon) {
  const jd = toJulian(date.getTime());
  const { dec, ra } = sunCoords(jd);
  const H = siderealTime(jd, lon * RAD) - ra;
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { altitude: alt / RAD, azimuth: az / RAD };
}

/**
 * Zeitpunkte, an denen die Sonne eine bestimmte Höhe kreuzt (Standard −0,833° = Auf-/Untergang mit
 * Refraktion). `date` bestimmt den Tag (Mittag in UTC). Null, wenn die Höhe nie erreicht wird.
 */
export function sunTimes(
  date: Date,
  angle = -0.833,
  lat: number = MUNICH.lat,
  lon: number = MUNICH.lon,
): { rise: Date; set: Date } | null {
  const lw = -lon * RAD;
  const phi = lat * RAD;
  const d = Math.round(toJulian(date.getTime()) - J2000 - 0.0009 - lw / (2 * Math.PI));
  const approxNoon = J2000 + 0.0009 + lw / (2 * Math.PI) + d;
  const { M, L, dec } = sunCoords(approxNoon);
  const noon = approxNoon + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const cosH = (Math.sin(angle * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null;
  const w = Math.acos(cosH) / (2 * Math.PI);
  return { rise: new Date(fromJulian(noon - w)), set: new Date(fromJulian(noon + w)) };
}

const SYNODIC = 29.530588853;
/** Referenz-Neumond 2000-01-06 18:14 UTC. */
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

/**
 * Mondphase: `phase` 0 = Neumond, 0,25 = erstes Viertel, 0,5 = Vollmond, 0,75 = letztes Viertel.
 * `illumination` = beleuchteter Anteil der Scheibe (0–1). Mittlere Phase, Fehler < 1 Tag.
 */
export function moonPhase(date: Date): { phase: number; illumination: number; waxing: boolean } {
  const days = (date.getTime() - NEW_MOON_REF) / DAY_MS;
  const phase = (((days / SYNODIC) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { phase, illumination, waxing: phase < 0.5 };
}
