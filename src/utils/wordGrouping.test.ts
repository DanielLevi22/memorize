import { describe, it, expect } from 'vitest';
import { groupWordsIntoLines } from './audioChunker';
import type { WordTiming } from '../types';

/** Monta palavras sequenciais com duração fixa e uma pausa opcional antes de cada uma. */
const buildWords = (specs: Array<[text: string, gapBefore?: number]>): WordTiming[] => {
  const words: WordTiming[] = [];
  let cursor = 0;
  for (const [text, gapBefore = 0] of specs) {
    cursor += gapBefore;
    words.push({ text, startTime: cursor, endTime: cursor + 0.3 });
    cursor += 0.3;
  }
  return words;
};

describe('groupWordsIntoLines', () => {
  it('mantém palavras contínuas na mesma linha', () => {
    const lines = groupWordsIntoLines(buildWords([['never'], ['gonna'], ['give']]));

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('never gonna give');
    expect(lines[0].startTime).toBe(0);
  });

  it('quebra a linha em pausa longa', () => {
    const lines = groupWordsIntoLines(
      buildWords([['never'], ['gonna'], ['give', 1.2], ['you'], ['up']])
    );

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('never gonna');
    expect(lines[1].text).toBe('give you up');
  });

  it('não quebra em pausa curta abaixo do limiar', () => {
    const lines = groupWordsIntoLines(buildWords([['hello'], ['there', 0.2]]));

    expect(lines).toHaveLength(1);
  });

  it('quebra após pontuação forte mesmo sem pausa', () => {
    const lines = groupWordsIntoLines(buildWords([['stop.'], ['now'], ['go']]));

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('stop.');
    expect(lines[1].text).toBe('now go');
  });

  it('respeita o teto de palavras por linha', () => {
    const specs = Array.from({ length: 25 }, (_, i) => [`w${i}`] as [string]);
    const lines = groupWordsIntoLines(buildWords(specs), { maxWordsPerLine: 5 });

    expect(lines).toHaveLength(5);
    lines.forEach(line => expect(line.words).toHaveLength(5));
  });

  it('preserva os tempos originais de cada palavra na linha', () => {
    const lines = groupWordsIntoLines(buildWords([['a'], ['b'], ['c']]));

    expect(lines[0].words).toEqual([
      { text: 'a', startTime: 0, endTime: 0.3 },
      { text: 'b', startTime: 0.3, endTime: 0.6 },
      { text: 'c', startTime: 0.6, endTime: 0.9 }
    ]);
    // startTime/endTime da linha derivam da primeira e da última palavra
    expect(lines[0].startTime).toBe(0);
    expect(lines[0].endTime).toBe(0.9);
  });

  it('descarta palavras vazias sem quebrar a numeração', () => {
    const words = buildWords([['a'], ['b'], ['c']]);
    words.splice(1, 0, { text: '   ', startTime: 0.3, endTime: 0.3 });

    const lines = groupWordsIntoLines(words);

    expect(lines[0].words).toHaveLength(3);
    expect(lines[0].text).toBe('a b c');
  });

  it('retorna lista vazia quando não há palavras', () => {
    expect(groupWordsIntoLines([])).toEqual([]);
    expect(groupWordsIntoLines([{ text: '  ', startTime: 0, endTime: 1 }])).toEqual([]);
  });
});
