import { describe, it, expect } from 'vitest';
import { computeWordHighlights } from './karaokeHighlight';
import type { WordTiming } from '../types';

const words = (spec: Array<[text: string, start: number, end: number]>): WordTiming[] =>
  spec.map(([text, startTime, endTime]) => ({ text, startTime, endTime }));

/** Só as palavras (ignora tokens de espaço), para asserções mais legíveis. */
const wordStates = (tokens: ReturnType<typeof computeWordHighlights>) =>
  tokens.filter(t => t.text.trim().length > 0).map(t => t.highlight);

describe('computeWordHighlights — com tempos reais por palavra', () => {
  const w = words([['never', 0, 1], ['gonna', 1, 2], ['give', 2, 3]]);

  it('nada aceso antes do início', () => {
    expect(wordStates(computeWordHighlights('never gonna give', 0, 3, -0.5, w)))
      .toEqual(['none', 'none', 'none']);
  });

  it('acende palavra por palavra conforme o tempo avança', () => {
    expect(wordStates(computeWordHighlights('never gonna give', 0, 3, 1.5, w)))
      .toEqual(['full', 'partial', 'none']);
  });

  it('tudo aceso ao fim da linha', () => {
    expect(wordStates(computeWordHighlights('never gonna give', 0, 3, 3, w)))
      .toEqual(['full', 'full', 'full']);
  });

  it('destaca parcialmente a palavra em curso proporcional ao tempo', () => {
    // 'gonna' (5 letras) na metade do seu intervalo [1,2] → ~2 ou 3 letras acesas
    const tokens = computeWordHighlights('never gonna give', 0, 3, 1.5, w);
    const gonna = tokens.find(t => t.text === 'gonna')!;
    expect(gonna.highlight).toBe('partial');
    expect(gonna.highlightLength).toBeGreaterThan(0);
    expect(gonna.highlightLength).toBeLessThan(5);
  });

  it('ignora os tempos reais se a contagem de palavras não bate (letra editada)', () => {
    // Só 2 tempos para 3 palavras → cai no modo estimado por caracteres, sem quebrar
    const tokens = computeWordHighlights('never gonna give', 0, 3, 3, words([['never', 0, 1], ['gonna', 1, 2]]));
    expect(wordStates(tokens)).toEqual(['full', 'full', 'full']);
  });
});

describe('computeWordHighlights — modo estimado (sem tempos)', () => {
  it('divide a linha proporcional aos caracteres', () => {
    // Sem words: no meio da linha, a primeira metade dos caracteres acende
    const tokens = computeWordHighlights('aaaa bbbb', 0, 2, 1);
    const states = wordStates(tokens);
    expect(states[0]).toBe('full');
    expect(states[1]).not.toBe('full');
  });

  it('nada aceso no tempo zero', () => {
    expect(wordStates(computeWordHighlights('hello world', 0, 2, 0)))
      .toEqual(['none', 'none']);
  });
});

describe('computeWordHighlights — casos de borda', () => {
  it('linha de duração não positiva vira texto cru sem destaque', () => {
    const tokens = computeWordHighlights('hello world', 5, 5, 5);
    expect(tokens.every(t => t.highlight === 'none')).toBe(true);
  });

  it('texto vazio não quebra', () => {
    expect(computeWordHighlights('', 0, 2, 1)).toEqual([]);
  });

  it('preserva os espaços para reconstruir o texto original', () => {
    const tokens = computeWordHighlights('a b', 0, 2, 2);
    expect(tokens.map(t => t.text).join('')).toBe('a b');
  });

  it('espaço acende junto com o avanço da linha', () => {
    const early = computeWordHighlights('a b', 0, 2, 0);
    const spaceEarly = early.find(t => /^\s+$/.test(t.text))!;
    expect(spaceEarly.highlight).toBe('none');

    const late = computeWordHighlights('a b', 0, 2, 2);
    const spaceLate = late.find(t => /^\s+$/.test(t.text))!;
    expect(spaceLate.highlight).toBe('full');
  });
});
