import { upsertHealthDay } from '../../db/repo';
import type { HealthDay } from '../../db/schemas';
import { parseHealthText, type HealthParseResult } from './parse';

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

export type HealthImportResult =
  { ok: true; saved: HealthDay[]; warnings: string[] } | { ok: false; error: string };

/** Liest aus einer Quelle, validiert und speichert. Wirft nie – Fehler kommen als Ergebnis zurück. */
export async function importFrom(source: HealthSource): Promise<HealthImportResult> {
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
  const parsed: HealthParseResult = parseHealthText(text);
  if (!parsed.ok) return parsed;
  try {
    const saved: HealthDay[] = [];
    for (const d of parsed.days) saved.push(await upsertHealthDay({ ...d, source: source.id }));
    return { ok: true, saved, warnings: parsed.warnings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Speichern fehlgeschlagen' };
  }
}

export function shortcutUrl(name: string): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}
