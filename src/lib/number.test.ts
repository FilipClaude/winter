import { describe, expect, it } from 'vitest';
import { formatNumberDE, parseNumberDE } from './number';

describe('Zahleneingabe mit deutschem Komma', () => {
  it('akzeptiert Komma und Punkt', () => {
    expect(parseNumberDE('42,5')).toBe(42.5);
    expect(parseNumberDE('42.5')).toBe(42.5);
    expect(parseNumberDE(' 80 ')).toBe(80);
    expect(parseNumberDE('42,')).toBe(42);
  });

  it('lehnt Unsinn ab', () => {
    expect(parseNumberDE('')).toBeNull();
    expect(parseNumberDE('abc')).toBeNull();
    expect(parseNumberDE('1,2,3')).toBeNull();
    expect(parseNumberDE(',')).toBeNull();
  });

  it('formatiert zurück', () => {
    expect(formatNumberDE(42.5)).toBe('42,5');
  });
});
