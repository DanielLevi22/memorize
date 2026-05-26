import { describe, it, expect } from 'vitest';
import { segmentTextManually, parseAIResponse } from './readingProcessor';

// ═════════════════════════════════════════════════════════════════════
// segmentTextManually
// ═════════════════════════════════════════════════════════════════════

describe('segmentTextManually', () => {
  it('divide texto com N linhas original ↔ N linhas tradução', () => {
    const original = 'Hello world.\nHow are you?\nI am fine.';
    const translated = 'Olá mundo.\nComo vai você?\nEu estou bem.';
    const result = segmentTextManually(original, translated);

    expect(result).toHaveLength(3);
    expect(result[0].original).toBe('Hello world.');
    expect(result[0].translated).toBe('Olá mundo.');
    expect(result[1].original).toBe('How are you?');
    expect(result[1].translated).toBe('Como vai você?');
    expect(result[2].original).toBe('I am fine.');
    expect(result[2].translated).toBe('Eu estou bem.');
  });

  it('original com mais linhas que tradução → linhas extras recebem tradução vazia', () => {
    const original = 'Line 1\nLine 2\nLine 3';
    const translated = 'Linha 1';
    const result = segmentTextManually(original, translated);

    expect(result).toHaveLength(3);
    expect(result[0].translated).toBe('Linha 1');
    expect(result[1].translated).toBe('');
    expect(result[2].translated).toBe('');
  });

  it('tradução com mais linhas que original → linhas extras ignoradas', () => {
    const original = 'Line 1';
    const translated = 'Linha 1\nLinha 2\nLinha 3';
    const result = segmentTextManually(original, translated);

    expect(result).toHaveLength(1);
    expect(result[0].original).toBe('Line 1');
    expect(result[0].translated).toBe('Linha 1');
  });

  it('texto vazio → array vazio', () => {
    expect(segmentTextManually('', '')).toEqual([]);
  });

  it('texto só com espaços/quebras → array vazio', () => {
    expect(segmentTextManually('  \n  \n  ', '  \n  ')).toEqual([]);
  });

  it('linhas em branco são filtradas', () => {
    const original = 'Line 1\n\n\nLine 2\n\n';
    const translated = 'Linha 1\n\nLinha 2';
    const result = segmentTextManually(original, translated);

    expect(result).toHaveLength(2);
    expect(result[0].original).toBe('Line 1');
    expect(result[1].original).toBe('Line 2');
  });

  it('cada ReadingLine tem mastered = false', () => {
    const result = segmentTextManually('Hello\nWorld', 'Olá\nMundo');
    result.forEach((line) => {
      expect(line.mastered).toBe(false);
    });
  });

  it('cada ReadingLine tem highlights = []', () => {
    const result = segmentTextManually('Hello\nWorld', 'Olá\nMundo');
    result.forEach((line) => {
      expect(line.highlights).toEqual([]);
    });
  });

  it('preserva espaços e pontuação do original', () => {
    const original = '  Hello, world!  How are you? ';
    const translated = 'Olá, mundo! Como vai?';
    const result = segmentTextManually(original, translated);

    expect(result).toHaveLength(1);
    expect(result[0].original).toBe('Hello, world!  How are you?');
  });
});

// ═════════════════════════════════════════════════════════════════════
// parseAIResponse
// ═════════════════════════════════════════════════════════════════════

describe('parseAIResponse', () => {
  it('JSON válido com todas as chaves → sucesso', () => {
    const json = JSON.stringify({
      title: 'Test Title',
      lines: [
        { original: 'Hello', translated: 'Olá', highlights: ['Hello'] },
        { original: 'World', translated: 'Mundo', highlights: ['World'] },
      ],
    });
    const result = parseAIResponse(json);

    expect(result.title).toBe('Test Title');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].original).toBe('Hello');
    expect(result.lines[0].translated).toBe('Olá');
    expect(result.lines[0].highlights).toEqual(['Hello']);
    expect(result.lines[0].mastered).toBe(false);
  });

  it('translatedText é a concatenação das traduções', () => {
    const json = JSON.stringify({
      title: 'T',
      lines: [
        { original: 'A', translated: 'X', highlights: [] },
        { original: 'B', translated: 'Y', highlights: [] },
      ],
    });
    const result = parseAIResponse(json);
    expect(result.translatedText).toBe('X\nY');
  });

  it('JSON sem campo lines → erro', () => {
    const json = JSON.stringify({ title: 'No Lines' });
    expect(() => parseAIResponse(json)).toThrow('não contém o campo "lines"');
  });

  it('JSON com lines vazio → retorna array vazio', () => {
    const json = JSON.stringify({ title: 'Empty', lines: [] });
    const result = parseAIResponse(json);
    expect(result.lines).toEqual([]);
    expect(result.translatedText).toBe('');
  });

  it('linha sem highlights → fallback para array vazio', () => {
    const json = JSON.stringify({
      title: 'T',
      lines: [{ original: 'A', translated: 'X' }],
    });
    const result = parseAIResponse(json);
    expect(result.lines[0].highlights).toEqual([]);
  });

  it('título ausente → fallback para "Texto sem título"', () => {
    const json = JSON.stringify({
      lines: [{ original: 'A', translated: 'X', highlights: [] }],
    });
    const result = parseAIResponse(json);
    expect(result.title).toBe('Texto sem título');
  });

  it('JSON inválido → erro', () => {
    expect(() => parseAIResponse('not json!!!')).toThrow('não é um JSON válido');
  });

  it('null → erro', () => {
    expect(() => parseAIResponse('null')).toThrow('formato inesperado');
  });

  it('highlights com tipos mistos → filtra não-strings', () => {
    const json = JSON.stringify({
      title: 'T',
      lines: [{ original: 'A', translated: 'X', highlights: ['valid', 123, null, 'also valid'] }],
    });
    const result = parseAIResponse(json);
    expect(result.lines[0].highlights).toEqual(['valid', 'also valid']);
  });
});
