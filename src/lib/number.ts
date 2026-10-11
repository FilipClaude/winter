/** Eingabe mit deutschem Komma oder Punkt: "42,5" / "42.5" → 42.5. Leer oder ungültig → null. */
export function parseNumberDE(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || s === '.' || s === '-' || !/^-?\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 42.5 → "42,5" */
export function formatNumberDE(n: number): string {
  return String(n).replace('.', ',');
}
