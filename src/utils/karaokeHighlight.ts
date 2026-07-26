import type { WordTiming } from '../types';

/**
 * Estado de destaque de um token (palavra ou espaço) no karaokê.
 * - `full`: já cantado, aceso por inteiro.
 * - `none`: ainda não cantado.
 * - `partial`: palavra em curso; `highlightLength` caracteres já acesos.
 */
export interface HighlightedToken {
  text: string;
  highlight: 'full' | 'none' | 'partial';
  highlightLength?: number;
}

/**
 * Calcula o estado de destaque de cada token de uma linha, dado o tempo atual de reprodução.
 *
 * É a lógica de sincronia visual do karaokê, extraída do componente para poder ser testada
 * sem renderizar — antes ela vivia inline em `renderHighlightedText` e só era verificável
 * assistindo à tela.
 *
 * Prefere os tempos reais por palavra (`words`) quando a contagem bate com o texto exibido;
 * senão distribui a duração da linha proporcional à contagem de caracteres (estimativa que
 * assume ritmo uniforme e erra em canto, mas é o melhor possível sem tempos medidos).
 */
export const computeWordHighlights = (
  text: string,
  startTime: number,
  endTime: number,
  progress: number,
  words?: WordTiming[]
): HighlightedToken[] => {
  const durationOfLine = endTime - startTime;

  // Divide em tokens de palavras e espaços, preservando os espaços para reconstruir o texto
  const tokens = text.split(/(\s+)/).filter(t => t.length > 0);
  const wordTokens = tokens.filter(t => !/^\s+$/.test(t));

  // Sem palavras ou sem duração válida: um único token cru, sem destaque parcial
  if (wordTokens.length === 0 || durationOfLine <= 0) {
    return tokens.map(t => ({ text: t, highlight: 'none' as const }));
  }

  const lineRatio = Math.min(Math.max((progress - startTime) / durationOfLine, 0), 1);

  // Tempos reais só valem se a contagem bater: o usuário pode ter editado a letra depois
  // da transcrição, e aí os tempos salvos não correspondem mais às palavras exibidas.
  const hasUsableWordTimings = !!words && words.length === wordTokens.length;

  const wordTimeRanges = hasUsableWordTimings
    ? wordTokens.map((_, idx) => ({
        startTimeOfWord: words![idx].startTime,
        endTimeOfWord: words![idx].endTime
      }))
    : (() => {
        const totalWordChars = wordTokens.reduce((sum, w) => sum + w.length, 0);
        let acc = 0;
        return wordTokens.map(w => {
          const startRatio = acc / totalWordChars;
          acc += w.length;
          const endRatio = acc / totalWordChars;
          return {
            startTimeOfWord: startTime + startRatio * durationOfLine,
            endTimeOfWord: startTime + endRatio * durationOfLine
          };
        });
      })();

  const result: HighlightedToken[] = [];
  let wordIndex = 0;
  let charIndex = 0;

  for (const token of tokens) {
    const isWhitespace = /^\s+$/.test(token);

    if (isWhitespace) {
      // Espaço acende quando o cursor da linha já passou pela sua posição no texto
      const tokenRatio = charIndex / text.length;
      charIndex += token.length;
      result.push({ text: token, highlight: lineRatio >= tokenRatio ? 'full' : 'none' });
      continue;
    }

    const range = wordTimeRanges[wordIndex];
    wordIndex++;
    charIndex += token.length;

    if (progress >= range.endTimeOfWord) {
      result.push({ text: token, highlight: 'full' });
    } else if (progress <= range.startTimeOfWord) {
      result.push({ text: token, highlight: 'none' });
    } else {
      const wordDuration = range.endTimeOfWord - range.startTimeOfWord;
      const wordRatio = wordDuration > 0
        ? Math.min(Math.max((progress - range.startTimeOfWord) / wordDuration, 0), 1)
        : 1;
      result.push({
        text: token,
        highlight: 'partial',
        highlightLength: Math.floor(token.length * wordRatio)
      });
    }
  }

  return result;
};
