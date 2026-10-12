import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Farben gehören ausschließlich in tokens.css (siehe DESIGN.md). */
describe('Design-System: keine hart codierten Farben', () => {
  const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black)\b(?=['";\s,)])/;
  const candidates = files(SRC).filter(
    (f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('tokens.css'),
  );

  it('findet Dateien', () => {
    expect(candidates.length).toBeGreaterThan(20);
  });

  for (const file of candidates) {
    it(relative(SRC, file), () => {
      const offending = readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        // Kommentare, Rauschtextur-Maske (Data-URI ohne Farbe) und aus Token-Werten zusammengesetzte
        // Farben (`rgba(${…})`, Himmel auf dem Canvas) ausnehmen
        .filter(
          ({ line }) =>
            !line.startsWith('//') &&
            !line.startsWith('*') &&
            !line.startsWith('/*') &&
            !line.includes('data:image/svg+xml') &&
            !/rgba?\(\$\{/.test(line),
        )
        .filter(({ line }) => COLOR.test(line));
      expect(offending, offending.map((o) => `${o.n}: ${o.line}`).join('\n')).toEqual([]);
    });
  }
});
