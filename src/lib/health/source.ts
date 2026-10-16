import { getHealthDay, upsertHealthDay } from '../../db/repo';
import type { HealthDay } from '../../db/schemas';
import { formatDE, todayISO, toISODate, type ISODate } from '../date';
import { parseHealthText, type HealthParseResult, type HealthPayload } from './parse';

/**
 * Eine Quelle für Health-Daten. Heute: Zwischenablage (Kurzbefehl), Textfeld, Datei.
 * Später andockbar: Sync-Server, Smartwatch-Export – sie müssen nur Rohtext (JSON v1) liefern.
 */
export interface HealthSource {
  readonly id: string;
  readonly label: string;
  /** Liefert den Rohtext (JSON). Darf werfen, z. B. wenn der Zugriff verweigert wird. */
  read(): Promise<string>;
}

export class ClipboardSource implements HealthSource {
  readonly id = 'kurzbefehl';
  readonly label = 'Zwischenablage';
  async read(): Promise<string> {
    if (!navigator.clipboard?.readText)
      throw new Error('Dieser Browser erlaubt kein Lesen der Zwischenablage. Bitte unten einfügen.');
    return navigator.clipboard.readText();
  }
}

export class TextSource implements HealthSource {
  readonly id = 'manuell';
  readonly label = 'Eingefügter Text';
  private readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
  read(): Promise<string> {
    return Promise.resolve(this.text);
  }
}

export class FileSource implements HealthSource {
  readonly id = 'datei';
  readonly label = 'Datei';
  private readonly file: File;
  constructor(file: File) {
    this.file = file;
  }
  async read(): Promise<string> {
    if (this.file.size > 2_000_000) throw new Error('Datei ist größer als 2 MB.');
    return this.file.text();
  }
}

/** Ein Import mit einem Datum vor heute – meist alte Zwischenablage oder festes Datum im Kurzbefehl. */
export interface StaleImport {
  date: ISODate;
  today: ISODate;
  /** Für diesen alten Tag wurde schon an einem späteren Tag importiert → Datum im Kurzbefehl vermutlich fest eingestellt. */
  fixedDate: boolean;
  /** Stand des Tages vor dem Import, damit „Für heute speichern“ ihn wiederherstellen kann. */
  previous: HealthDay | undefined;
}

export type HealthImportResult =
  { ok: true; saved: HealthDay[]; warnings: string[]; stale?: StaleImport } | { ok: false; error: string };

function sameValues(a: HealthDay, b: HealthPayload): boolean {
  return (
    a.steps === b.steps &&
    a.distanceKm === b.distanceKm &&
    a.flights === b.flights &&
    a.sleepStart === b.sleepStart &&
    a.sleepEnd === b.sleepEnd
  );
}

/** Liest aus einer Quelle, validiert und speichert. Wirft nie – Fehler kommen als Ergebnis zurück. */
export async function importFrom(source: HealthSource, today: ISODate = todayISO()): Promise<HealthImportResult> {
  let text: string;
  try {
    text = await source.read();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: /denied|not allowed|NotAllowed/i.test(msg)
        ? 'Zugriff auf die Zwischenablage verweigert. Erneut tippen und „Einfügen“ bestätigen – oder unten einfügen.'
        : msg,
    };
  }
  const parsed: HealthParseResult = parseHealthText(text, today);
  if (!parsed.ok) return parsed;
  try {
    // Ein einzelner Tag vor heute ist verdächtig – der Kurzbefehl nimmt sonst immer das aktuelle Datum.
    // Bis v3.2 hieß das still „übernommen“, und Heute blieb beim alten Stand hängen.
    let stale: StaleImport | undefined;
    const single = parsed.days.length === 1 ? parsed.days[0] : undefined;
    if (single && single.date < today) {
      const previous = await getHealthDay(single.date);
      const fixedDate = previous !== undefined && toISODate(previous.importedAt) > single.date;
      if (previous && sameValues(previous, single)) {
        return {
          ok: false,
          error:
            `Das sind noch die Werte vom ${formatDE(single.date)}, in der Zwischenablage lag der alte Inhalt. ` +
            'Erst „1 · Kurzbefehl starten“ und warten, bis er durchgelaufen ist, dann zurück und „2 · Werte einfügen“.' +
            (fixedDate
              ? ' Kommt jeden Tag dasselbe Datum, ist im Kurzbefehl bei „Datum formatieren“ ein festes Datum eingestellt statt „Aktuelles Datum“.'
              : ''),
        };
      }
      stale = { date: single.date, today, fixedDate, previous };
    }
    const saved: HealthDay[] = [];
    for (const d of parsed.days) saved.push(await upsertHealthDay({ ...d, source: source.id }));
    return stale ? { ok: true, saved, warnings: parsed.warnings, stale } : { ok: true, saved, warnings: parsed.warnings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Speichern fehlgeschlagen' };
  }
}

export function shortcutUrl(name: string): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}
