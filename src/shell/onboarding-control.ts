/** Schlüssel, mit dem die E2E-Basis die Einführung überspringt (sonst läge sie über jedem Test). */
export const SKIP_ONBOARDING_KEY = 'winter:skip-onboarding';

export function skippedByTest(): boolean {
  try {
    return localStorage.getItem(SKIP_ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

let reopen: ((trigger: HTMLElement | null) => void) | null = null;

export function registerOnboarding(fn: (trigger: HTMLElement | null) => void): () => void {
  reopen = fn;
  return () => {
    if (reopen === fn) reopen = null;
  };
}

/** Einführung erneut zeigen (Einstellungen). `trigger` bekommt danach den Fokus zurück. */
export function showOnboarding(trigger: HTMLElement | null = null): void {
  reopen?.(trigger);
}
