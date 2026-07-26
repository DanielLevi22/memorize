import { describe, it, expect } from 'vitest';
import { getLevelContentProgress, isTextStudied, LEVEL_TEXT_TARGET } from './cefrLevelContent';
import type { TextResource } from '../types';

const text = (level: string, mastered: boolean[]): Pick<TextResource, 'cefrLevel' | 'lines'> => ({
  cefrLevel: level as any,
  lines: mastered.map(m => ({ original: 'o', translated: 't', highlights: [], mastered: m }))
});

describe('isTextStudied', () => {
  it('é estudado quando todas as linhas estão dominadas', () => {
    expect(isTextStudied(text('A1', [true, true, true]))).toBe(true);
  });

  it('não é estudado se falta dominar alguma linha', () => {
    expect(isTextStudied(text('A1', [true, false, true]))).toBe(false);
  });

  it('texto sem linhas nunca conta', () => {
    expect(isTextStudied({ lines: [] })).toBe(false);
  });
});

describe('getLevelContentProgress', () => {
  const texts = [
    text('A1', [true, true]),   // estudado
    text('A1', [true, false]),  // não
    text('A1', [true]),         // estudado
    text('A2', [true])          // outro nível, ignorado
  ];

  it('conta apenas os textos do nível pedido', () => {
    expect(getLevelContentProgress(texts, 'A1').total).toBe(3);
    expect(getLevelContentProgress(texts, 'A2').total).toBe(1);
  });

  it('conta quantos foram estudados', () => {
    expect(getLevelContentProgress(texts, 'A1').studied).toBe(2);
  });

  it('usa a meta do nível e calcula quanto falta', () => {
    const progress = getLevelContentProgress(texts, 'A1');
    expect(progress.target).toBe(LEVEL_TEXT_TARGET.A1);
    expect(progress.remaining).toBe(LEVEL_TEXT_TARGET.A1 - 2);
  });

  it('calcula o percentual rumo à meta', () => {
    // 2 estudados de meta 8 = 25%
    expect(getLevelContentProgress(texts, 'A1').percent).toBe(25);
  });

  it('trava em 100% quando o aluno estuda além da meta', () => {
    const many = Array.from({ length: 12 }, () => text('A1', [true]));
    const progress = getLevelContentProgress(many, 'A1');
    expect(progress.percent).toBe(100);
    expect(progress.remaining).toBe(0);
  });

  it('nível sem textos dá zero sem quebrar', () => {
    const progress = getLevelContentProgress([], 'C2');
    expect(progress).toMatchObject({ total: 0, studied: 0, percent: 0 });
    expect(progress.remaining).toBe(LEVEL_TEXT_TARGET.C2);
  });

  it('aceita um predicado de estudo customizado', () => {
    // Considera estudado qualquer texto com ao menos uma linha dominada
    const predicate = (t: { lines?: { mastered: boolean }[] }) =>
      (t.lines ?? []).some(l => l.mastered);
    expect(getLevelContentProgress(texts, 'A1', predicate).studied).toBe(3);
  });
});
