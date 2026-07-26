import { describe, it, expect } from 'vitest';
import { parseLrcToLines, parsePlainLyricsToLines, formatLrc } from './lyricsProvider';

describe('parseLrcToLines', () => {
  it('converte marcações de tempo em linhas ordenadas', () => {
    const lines = parseLrcToLines(
      '[00:35.66] Look at the stars\n[00:38.46] Look how they shine for you'
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ text: 'Look at the stars', startTime: 35.66, endTime: 38.46 });
    expect(lines[1].startTime).toBe(38.46);
  });

  it('ignora linhas de metadado', () => {
    const lines = parseLrcToLines('[ti:Yellow]\n[ar:Coldplay]\n[00:10.00] Primeira linha');

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Primeira linha');
  });

  it('expande múltiplas marcações na mesma linha', () => {
    // Formato usado para repetir o mesmo verso em vários momentos da música
    const lines = parseLrcToLines('[00:10.00][01:20.00][02:30.00] Refrão');

    expect(lines).toHaveLength(3);
    expect(lines.map(l => l.startTime)).toEqual([10, 80, 150]);
    lines.forEach(l => expect(l.text).toBe('Refrão'));
  });

  it('aplica a tag offset com o sinal invertido', () => {
    // offset:+500 adianta a letra em 0,5s, logo os tempos DIMINUEM
    const lines = parseLrcToLines('[offset:+500]\n[00:10.00] Linha');

    expect(lines[0].startTime).toBe(9.5);
  });

  it('nunca gera tempo negativo por causa do offset', () => {
    const lines = parseLrcToLines('[offset:+5000]\n[00:01.00] Linha');

    expect(lines[0].startTime).toBe(0);
  });

  it('descarta versos sem texto e mantém a cronologia', () => {
    const lines = parseLrcToLines('[00:10.00] Um\n[00:12.00] \n[00:14.00] Dois');

    expect(lines.map(l => l.text)).toEqual(['Um', 'Dois']);
    // O fim da primeira linha acompanha o início da seguinte que sobrou
    expect(lines[0].endTime).toBe(14);
  });

  it('usa a duração da faixa como fim da última linha', () => {
    const lines = parseLrcToLines('[00:10.00] Única', 200);

    expect(lines[0].endTime).toBe(200);
  });

  it('reordena entradas fora de sequência', () => {
    const lines = parseLrcToLines('[00:30.00] Depois\n[00:10.00] Antes');

    expect(lines.map(l => l.text)).toEqual(['Antes', 'Depois']);
  });

  it('aceita minutos com três dígitos e centésimos', () => {
    const lines = parseLrcToLines('[100:05.25] Faixa longa');

    expect(lines[0].startTime).toBe(6005.25);
  });

  it('retorna vazio para entrada vazia ou sem marcações', () => {
    expect(parseLrcToLines('')).toEqual([]);
    expect(parseLrcToLines('linha sem tempo\noutra linha')).toEqual([]);
  });
});

describe('formatLrc', () => {
  it('gera cabeçalho de título e uma marcação por linha', () => {
    const lrc = formatLrc([{ text: 'Look at the stars', startTime: 35.66 }], 'Yellow');

    expect(lrc).toContain('[ti:Yellow]');
    expect(lrc).toContain('[00:35.66] Look at the stars');
  });

  it('formata minutos e segundos com preenchimento', () => {
    const lrc = formatLrc([{ text: 'Linha', startTime: 5.5 }], 't');
    expect(lrc).toContain('[00:05.50] Linha');
  });

  it('sobrevive à ida e volta pelo parser', () => {
    const original = [
      { text: 'Primeira', startTime: 10 },
      { text: 'Segunda', startTime: 22.5 }
    ];
    const reparsed = parseLrcToLines(formatLrc(original, 'Teste'));

    expect(reparsed.map(l => l.text)).toEqual(['Primeira', 'Segunda']);
    expect(reparsed.map(l => l.startTime)).toEqual([10, 22.5]);
  });
});

describe('parsePlainLyricsToLines', () => {
  it('quebra a letra simples em linhas com tempo zerado', () => {
    const lines = parsePlainLyricsToLines('Primeira\n\n  Segunda  \n');

    expect(lines).toHaveLength(2);
    expect(lines.map(l => l.text)).toEqual(['Primeira', 'Segunda']);
    lines.forEach(l => expect(l.startTime).toBe(0));
  });
});
