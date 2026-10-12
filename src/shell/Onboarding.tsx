import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { FlaskConical, LayoutDashboard, Lock, MoonStar, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { needsOnboarding, saveSettings } from '../db/repo';
import { navigate } from '../router';
import { Button } from '../ui/primitives';
import { DUR, EASE_OUT } from '../ui/motion';
import { registerOnboarding, skippedByTest } from './onboarding-control';

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    icon: MoonStar,
    title: 'Willkommen bei Winter',
    text: 'Training, Schule, Körper und Habits an einem Ort. Der Himmel im Hintergrund folgt der echten Tageszeit in München – mit Mond, Sternen und Schnee.',
  },
  {
    icon: Lock,
    title: 'Alles bleibt auf deinem iPhone',
    text: 'Kein Konto, keine Cloud. Winter sichert sich täglich selbst im Gerät. Ein Backup als Datei (Einstellungen → Backup) schützt zusätzlich, falls iOS Website-Daten löscht.',
  },
  {
    icon: Plus,
    title: 'Schnell eintragen',
    text: 'Das Plus unten öffnet die Schnellerfassung. Schritte und Distanz holt der Kurzbefehl aus Health, Spiele kommen automatisch vom BFV.',
  },
  {
    icon: LayoutDashboard,
    title: 'Heute nach deinem Geschmack',
    text: 'Mit „Dashboard anpassen“ ganz unten auf Heute ordnest du Widgets, blendest sie aus und wählst ihre Größe. Diese Einführung findest du jederzeit in den Einstellungen.',
  },
];

/**
 * Einführung beim echten Erststart (keine Einträge, noch nicht gesehen – siehe `needsOnboarding`).
 * Vier kurze Schritte über dem Himmel, jederzeit überspringbar; am Ende optional Demo-Daten.
 */
export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<false | 'leer' | 'demo'>(false);
  const reduce = useReducedMotion();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const unregister = registerOnboarding(() => {
      setStep(0);
      setOpen(true);
    });
    if (!skippedByTest())
      void needsOnboarding().then((need) => {
        if (need) setOpen(true);
      });
    return unregister;
  }, []);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open, step]);

  // Während der Einführung nur Himmel + Einführung: App und Tab-Leiste dahinter ausblenden (auch für VoiceOver).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-onboarding', open);
    return () => document.documentElement.removeAttribute('data-onboarding');
  }, [open]);

  const finish = async (demo: boolean) => {
    setBusy(demo ? 'demo' : 'leer');
    try {
      await saveSettings({ onboarded: true });
      // Demo-Code erst bei Bedarf laden – er gehört nicht ins Start-Bundle.
      if (demo) await (await import('../lib/demo')).insertDemo();
    } finally {
      setBusy(false);
      setOpen(false);
      navigate('heute');
    }
  };

  const current = STEPS[step] ?? STEPS[0];
  if (!current) return null;
  const last = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="onboarding"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          data-testid="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : DUR.slow, ease: EASE_OUT }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && busy === false) void finish(false);
          }}
        >
          <div className="onboarding__top">
            <Button variant="ghost" size="s" onClick={() => void finish(false)} disabled={busy !== false}>
              Überspringen
            </Button>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="onboarding__body"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : DUR.base, ease: EASE_OUT }}
            >
              <span className="onboarding__icon">
                <Icon size={30} strokeWidth={1.25} aria-hidden />
              </span>
              <h1 id="onboarding-title" className="onboarding__title" tabIndex={-1} ref={titleRef}>
                {current.title}
              </h1>
              <p className="onboarding__text">{current.text}</p>
            </motion.div>
          </AnimatePresence>
          <div className="onboarding__foot">
            <div
              className="onboarding__dots"
              aria-label={`Schritt ${step + 1} von ${STEPS.length}`}
              role="img"
            >
              {STEPS.map((s, i) => (
                <span key={s.title} className={i === step ? 'is-active' : undefined} />
              ))}
            </div>
            {last ? (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <Button variant="primary" block onClick={() => void finish(false)} disabled={busy !== false}>
                  Leer starten
                </Button>
                <Button
                  variant="secondary"
                  block
                  icon={FlaskConical}
                  onClick={() => void finish(true)}
                  disabled={busy !== false}
                >
                  {busy === 'demo' ? 'Lege Demo-Daten an …' : 'Mit Demo-Daten umsehen'}
                </Button>
                <p className="xsmall faint" style={{ textAlign: 'center' }}>
                  Demo-Daten lassen sich in den Einstellungen mit einem Schalter wieder entfernen.
                </p>
              </div>
            ) : (
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {step > 0 && (
                  <Button variant="ghost" onClick={() => setStep(step - 1)}>
                    Zurück
                  </Button>
                )}
                <Button variant="primary" block onClick={() => setStep(step + 1)}>
                  Weiter
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
