import { createContext, useContext, type ReactNode } from 'react';

export interface SheetSpec {
  title: string;
  /** Inhalt; `close` schließt das Sheet. */
  render: (close: () => void) => ReactNode;
}

export interface OverlayApi {
  openSheet: (spec: SheetSpec) => void;
  closeSheet: () => void;
  toast: (
    message: string,
    opts?: { tone?: 'accent' | 'warn'; action?: { label: string; run: () => void } },
  ) => void;
}

export const OverlayContext = createContext<OverlayApi | null>(null);

export function useOverlay(): OverlayApi {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay außerhalb von OverlayProvider');
  return ctx;
}
