import { AlertTriangle, Check, X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SPRING_SHEET } from './motion';
import { OverlayContext, type OverlayApi, type SheetSpec } from './overlay-context';
import { IconButton } from './primitives';

interface ToastItem {
  id: number;
  message: string;
  tone: 'accent' | 'warn';
  action?: { label: string; run: () => void };
}

const SPRING = SPRING_SHEET;

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<(SheetSpec & { key: number }) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const closeSheet = useCallback(() => setSheet(null), []);
  const openSheet = useCallback((spec: SheetSpec) => setSheet({ ...spec, key: ++seq.current }), []);
  const toast = useCallback<OverlayApi['toast']>((message, opts) => {
    const id = ++seq.current;
    setToasts((t) => [
      ...t.slice(-2),
      { id, message, tone: opts?.tone ?? 'accent', ...(opts?.action ? { action: opts.action } : {}) },
    ]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 5000 : 2600);
  }, []);

  const api = useMemo(() => ({ openSheet, closeSheet, toast }), [openSheet, closeSheet, toast]);

  return (
    <OverlayContext.Provider value={api}>
      {children}
      <AnimatePresence>{sheet && <Sheet key="sheet" spec={sheet} onClose={closeSheet} />}</AnimatePresence>
      <div className="toast-host" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast ${t.tone === 'warn' ? 'toast--warn' : ''}`}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              role="status"
            >
              {t.tone === 'warn' ? (
                <AlertTriangle size={18} strokeWidth={1.75} aria-hidden />
              ) : (
                <Check size={18} strokeWidth={2} aria-hidden />
              )}
              <span className="grow">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="btn btn--ghost btn--s accent"
                  onClick={() => {
                    t.action?.run();
                    setToasts((all) => all.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </OverlayContext.Provider>
  );
}

function Sheet({ spec, onClose }: { spec: SheetSpec & { key: number }; onClose: () => void }) {
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const panel = useRef<HTMLDivElement>(null);

  // Fokus nach dem Schließen dorthin zurück, wo er vorher war (Tastatur/VoiceOver).
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => previous?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Fokus ins Sheet, wenn sich der Inhalt ändert (Schnellerfassung → Formular).
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, [spec.key]);

  return (
    <>
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
        onClick={onClose}
      />
      <motion.div
        ref={panel}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        tabIndex={-1}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={reduce ? { duration: 0 } : SPRING}
        drag="y"
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.02, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) onClose();
        }}
      >
        <div className="sheet__grab" onPointerDown={(e) => drag.start(e)} aria-hidden />
        <div className="sheet__head" onPointerDown={(e) => drag.start(e)}>
          <h2 className="sheet__title">{spec.title}</h2>
          <IconButton icon={X} label="Schließen" onClick={onClose} />
        </div>
        <div className="sheet__body" key={spec.key}>
          {spec.render(onClose)}
        </div>
      </motion.div>
    </>
  );
}
