/**
 * Notfall-Export ohne Dexie: liest die Datenbank „winter“ direkt über IndexedDB (in der Version, die
 * gerade auf dem Gerät liegt) und erzeugt eine Datei im Backup-Format. Funktioniert auch, wenn das
 * Öffnen mit Dexie scheitert (z. B. fehlgeschlagenes Upgrade). Snapshots werden nicht mitgenommen.
 */
export async function rawExport(name = 'winter'): Promise<{ name: string; json: string; rows: number }> {
  const idb = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB nicht lesbar'));
    req.onblocked = () => reject(new Error('Datenbank blockiert – andere Tabs schließen'));
  });
  try {
    const stores = [...idb.objectStoreNames].filter((s) => s !== 'snapshots');
    const tables: Record<string, unknown[]> = {};
    const kv: Record<string, unknown> = {};
    let rows = 0;
    const tx = idb.transaction(stores, 'readonly');
    await Promise.all(
      stores.map(
        (s) =>
          new Promise<void>((resolve, reject) => {
            const req = tx.objectStore(s).getAll();
            req.onsuccess = () => {
              const all = req.result as unknown[];
              if (s === 'kv') {
                for (const row of all as { key: string; value: unknown }[]) kv[row.key] = row.value;
              } else {
                tables[s] = all;
                rows += all.length;
              }
              resolve();
            };
            req.onerror = () => reject(req.error ?? new Error(`${s} nicht lesbar`));
          }),
      ),
    );
    const exportedAt = new Date().toISOString();
    const schemaVersion = Math.max(1, Math.floor(idb.version / 10));
    const json = JSON.stringify({
      app: 'winter',
      format: 1,
      schemaVersion,
      exportedAt,
      tables,
      kv,
      rescue: true,
    });
    return { name: `winter-rettung-${exportedAt.slice(0, 16).replace(/[:T]/g, '-')}.json`, json, rows };
  } finally {
    idb.close();
  }
}
