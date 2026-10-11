export type SaveResult = 'geteilt' | 'heruntergeladen' | 'abgebrochen';

/**
 * Gibt eine Datei aus. Auf dem iPhone über das Teilen-Menü („In Dateien sichern“, AirDrop, Obsidian …),
 * sonst als Download. Muss direkt aus einem Tap aufgerufen werden (iOS verlangt eine Nutzergeste).
 */
export async function saveFile(name: string, content: string, mime: string): Promise<SaveResult> {
  const file = new File([content], name, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'geteilt';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'abgebrochen';
      // Fällt auf Download zurück (z. B. NotAllowedError)
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'heruntergeladen';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
