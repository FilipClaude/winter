import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { addMeal, addMealFromTemplate, saveMealTemplate, ValidationError } from '../../db/repo';
import type { ISODate } from '../../lib/date';
import { NumberField, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button, SectionTitle } from '../../ui/primitives';

/** Mahlzeit erfassen: Vorlage mit einem Tap oder eigene Werte. */
export function MealSheet({ date, close }: { date: ISODate; close: () => void }) {
  const { toast } = useOverlay();
  const templates = useLiveQuery(() => db.mealTemplates.orderBy('order').toArray(), []);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | ''>('');
  const [protein, setProtein] = useState<number | ''>('');
  const [asTemplate, setAsTemplate] = useState(false);
  const [error, setError] = useState<string>();

  async function fromTemplate(id: string, label: string) {
    await addMealFromTemplate(id, date);
    toast(`${label} eingetragen`);
    close();
  }

  async function submit() {
    try {
      const values = { name: name.trim() || 'Mahlzeit', kcal: Math.round(Number(kcal || 0)), proteinG: Number(protein || 0) };
      await addMeal({ date, ...values });
      if (asTemplate) await saveMealTemplate(values);
      toast(`${values.name} eingetragen`);
      close();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen');
    }
  }

  return (
    <div className="form">
      {templates && templates.length > 0 && (
        <div className="stack stack--s">
          <SectionTitle>Vorlagen · ein Tap</SectionTitle>
          <div className="list" data-testid="meal-templates">
            {templates.map((t) => (
              <button key={t.id} type="button" className="list-item" onClick={() => void fromTemplate(t.id, t.name)}>
                <span className="grow">
                  <span className="list-item__title">{t.name}</span>
                  <br />
                  <span className="list-item__meta mono">
                    {t.kcal} kcal · {t.proteinG} g Protein
                  </span>
                </span>
                <Plus size={18} strokeWidth={1.5} className="accent" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}
      <SectionTitle>Eigene Werte</SectionTitle>
      <TextField label="Name" value={name} onValue={setName} placeholder="z. B. Mittagessen Mensa" maxLength={80} />
      <div className="form-row">
        <NumberField label="Kalorien (kcal)" value={kcal} onValue={setKcal} min={0} max={6000} />
        <NumberField label="Protein (g)" value={protein} onValue={setProtein} min={0} max={500} decimal />
      </div>
      <label className="row small muted" style={{ minHeight: 44 }}>
        <input type="checkbox" className="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} />
        Auch als Vorlage speichern
      </label>
      {error && <p className="field__error">{error}</p>}
      <Button variant="primary" block onClick={() => void submit()} disabled={kcal === '' && protein === ''}>
        Eintragen
      </Button>
    </div>
  );
}
