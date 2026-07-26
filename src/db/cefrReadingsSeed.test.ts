import { describe, it, expect } from 'vitest';
import { cefrReadingsSeedData } from './cefrReadingsSeed';

describe('cefrReadingsSeedData', () => {
  it('todo texto tem id único', () => {
    const ids = cefrReadingsSeedData.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo texto tem nível CEFR válido', () => {
    const valid = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    for (const t of cefrReadingsSeedData) {
      expect(valid.has(t.cefrLevel as string)).toBe(true);
    }
  });

  it('toda linha tem original e tradução não vazios', () => {
    for (const t of cefrReadingsSeedData) {
      expect(t.lines.length).toBeGreaterThan(0);
      for (const line of t.lines) {
        expect(line.original.trim().length).toBeGreaterThan(0);
        expect(line.translated.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('o texto completo corresponde às linhas', () => {
    for (const t of cefrReadingsSeedData) {
      expect(t.fullTextOriginal).toBe(t.lines.map(l => l.original).join('\n'));
      expect(t.fullTextTranslated).toBe(t.lines.map(l => l.translated).join('\n'));
    }
  });

  it('cobre todos os seis níveis CEFR', () => {
    const levels = new Set(cefrReadingsSeedData.map(t => t.cefrLevel));
    for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      expect(levels.has(lvl as any)).toBe(true);
    }
  });
});
