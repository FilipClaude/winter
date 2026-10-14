import { useSyncExternalStore } from 'react';

export type TabId = 'heute' | 'training' | 'schule' | 'alltag' | 'rueckblick';
export type RouteId = TabId | 'einstellungen';

const ROUTES: RouteId[] = ['heute', 'training', 'schule', 'alltag', 'rueckblick', 'einstellungen'];

/** v3: „Körper“ und „Habits“ sind im Tab „Alltag“ aufgegangen – alte Adressen und Lesezeichen leiten dorthin. */
const LEGACY: Record<string, Route> = {
  koerper: { id: 'alltag', param: 'schlaf' },
  habits: { id: 'alltag', param: 'habits' },
};

export interface Route {
  id: RouteId;
  /** Optionaler Parameter, z. B. ein Datum (#/heute/2026-10-11). */
  param?: string;
}

export function parseHash(hash: string): Route {
  const [, id, param] = hash.replace(/^#/, '').split('/');
  const legacy = id !== undefined ? LEGACY[id] : undefined;
  if (legacy) return param ? { ...legacy, param: decodeURIComponent(param) } : legacy;
  const route = ROUTES.find((r) => r === id) ?? 'heute';
  return param ? { id: route, param: decodeURIComponent(param) } : { id: route };
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
  return parseHash(hash);
}

export function navigate(id: RouteId, param?: string): void {
  const next = `#/${id}${param ? `/${encodeURIComponent(param)}` : ''}`;
  if (window.location.hash !== next) window.location.hash = next;
}
