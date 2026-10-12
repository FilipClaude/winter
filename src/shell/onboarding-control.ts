/** Schlüssel, mit dem die E2E-Basis die Einführung überspringt (sonst läge sie über jedem Test). */
export const SKIP_ONBOARDING_KEY = 'winter:skip-onboarding';

export function skippedByTest(): boolean {
  try {
    return localStorage.getItem(SKIP_ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

let reopen: (() => void) | null = null;

export function registerOnboarding(fn: () => void): () => void {
  reopen = fn;
  return () => {
    if (reopen === fn) reopen = null;
  };
}

/** Einführung erneut zeigen (Einstellungen). */
export function showOnboarding(): void {
  reopen?.();
}
