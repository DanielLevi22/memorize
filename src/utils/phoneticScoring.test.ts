import { describe, it, expect } from 'vitest';
import {
  toPhoneticKey,
  phoneticWordDistance,
  pronunciationSimilarity,
  classifyWordAccuracy
} from './phoneticScoring';

describe('toPhoneticKey', () => {
  it('reduz dígrafos a um símbolo de som', () => {
    expect(toPhoneticKey('think')).toBe('TiNk');
    expect(toPhoneticKey('ship')).toBe('Sip');
    expect(toPhoneticKey('church')).toBe('CurC');
    expect(toPhoneticKey('phone')).toBe('fon');
  });

  it('trata o e mudo final', () => {
    expect(toPhoneticKey('make')).toBe('mak');
    // Mantém quando a letra anterior é vogal ("see" não perde som)
    expect(toPhoneticKey('see')).toBe('se');
  });

  it('colapsa letras dobradas', () => {
    expect(toPhoneticKey('letter')).toBe('leter');
  });

  it('resolve c e g conforme a vogal seguinte', () => {
    expect(toPhoneticKey('city')).toBe('siti');
    expect(toPhoneticKey('cat')).toBe('kat');
    expect(toPhoneticKey('gentle')).toBe('Jentl');
    expect(toPhoneticKey('got')).toBe('got');
  });

  it('ignora pontuação e maiúsculas', () => {
    expect(toPhoneticKey('Think!')).toBe(toPhoneticKey('think'));
  });
});

describe('phoneticWordDistance', () => {
  it('dá zero para palavras iguais', () => {
    expect(phoneticWordDistance('think', 'think')).toBe(0);
  });

  it('cobra pouco pelas trocas típicas de brasileiro', () => {
    // th -> s/t/d é a confusão mais clássica
    expect(phoneticWordDistance('think', 'sink')).toBeLessThan(0.2);
    expect(phoneticWordDistance('the', 'de')).toBeLessThan(0.3);
    // vogal curta x longa
    expect(phoneticWordDistance('ship', 'sheep')).toBeLessThan(0.3);
    // H aspirado omitido
    expect(phoneticWordDistance('hear', 'ear')).toBeLessThan(0.3);
  });

  it('cobra caro por palavras sem relação sonora', () => {
    // O que importa é ficar acima do limiar de "palavra diferente" (0.5), onde a nota
    // deixa de dar crédito parcial. A normalização por comprimento impede que pares de
    // tamanhos muito distintos cheguem perto de 1.
    expect(phoneticWordDistance('think', 'elephant')).toBeGreaterThan(0.5);
    expect(phoneticWordDistance('yellow', 'stars')).toBeGreaterThan(0.5);
    expect(classifyWordAccuracy('elephant', 'think')).toBe('incorrect');
    expect(classifyWordAccuracy('stars', 'yellow')).toBe('incorrect');
  });

  it('ordena quase-acerto abaixo de erro real — o ponto central da mudança', () => {
    const quaseAcerto = phoneticWordDistance('think', 'sink');
    const erroReal = phoneticWordDistance('think', 'elephant');

    expect(quaseAcerto).toBeLessThan(erroReal);
    // Antes ambos custavam exatamente 1.0
    expect(quaseAcerto).toBeLessThan(1);
  });

  it('é simétrica', () => {
    expect(phoneticWordDistance('think', 'sink')).toBe(phoneticWordDistance('sink', 'think'));
  });

  it('nunca ultrapassa 1', () => {
    expect(phoneticWordDistance('a', 'strengths')).toBeLessThanOrEqual(1);
  });
});

describe('pronunciationSimilarity', () => {
  it('dá 100 para a frase idêntica', () => {
    expect(pronunciationSimilarity(['look', 'at', 'the', 'stars'], ['look', 'at', 'the', 'stars'])).toBe(100);
  });

  it('mantém nota alta quando só o sotaque difere', () => {
    // "I think so" falado como "I sink so"
    const score = pronunciationSimilarity(['i', 'sink', 'so'], ['i', 'think', 'so']);
    expect(score).toBeGreaterThan(90);
  });

  it('penaliza palavra realmente trocada', () => {
    const score = pronunciationSimilarity(['i', 'elephant', 'so'], ['i', 'think', 'so']);
    expect(score).toBeLessThan(75);
  });

  it('penaliza palavra faltando', () => {
    const score = pronunciationSimilarity(['look', 'stars'], ['look', 'at', 'the', 'stars']);
    expect(score).toBeLessThan(60);
  });

  it('dá zero quando nada foi falado', () => {
    expect(pronunciationSimilarity([], ['look', 'at', 'the', 'stars'])).toBe(0);
  });

  it('separa sotaque de erro de conteúdo', () => {
    const sotaque = pronunciationSimilarity(['sink', 'de', 'ting'], ['think', 'the', 'thing']);
    const conteudo = pronunciationSimilarity(['dog', 'car', 'blue'], ['think', 'the', 'thing']);

    expect(sotaque).toBeGreaterThan(conteudo + 30);
  });
});

describe('classifyWordAccuracy', () => {
  it('marca acerto exato', () => {
    expect(classifyWordAccuracy('stars', 'stars')).toBe('correct');
  });

  it('marca quase-acerto de sotaque', () => {
    expect(classifyWordAccuracy('sink', 'think')).toBe('close');
  });

  it('marca palavra errada', () => {
    expect(classifyWordAccuracy('elephant', 'think')).toBe('incorrect');
  });
});
