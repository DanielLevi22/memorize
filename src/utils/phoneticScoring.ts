/**
 * Pontuação de pronúncia com tolerância fonética.
 *
 * A comparação anterior era binária: a palavra reconhecida casava exatamente com a esperada
 * ou custava uma substituição inteira. Isso pune o estudante justamente onde ele mais acerta
 * — o quase-acerto. Falar "sink" no lugar de "think" custava o mesmo que falar "elephant".
 *
 * Aqui a substituição custa proporcionalmente à distância SONORA entre as palavras, com
 * atenção especial às trocas típicas de quem fala português e está aprendendo inglês.
 *
 * Limite honesto: isto continua sendo estimativa sobre o TEXTO devolvido pelo reconhecedor,
 * não medição de fonemas no áudio. Serve para deixar de punir quase-acertos, não para
 * avaliar pronúncia de verdade — para isso seria preciso pontuação por fonema (GOP).
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Converte a grafia inglesa numa sequência aproximada de sons.
 *
 * Não é transcrição fonética real (o inglês não permite isso sem dicionário): é uma
 * normalização que aproxima palavras que soam parecido e afasta as que não soam.
 *
 * Símbolos especiais: T = "th", S = "sh", C = "ch", J = "j/dge", N = "ng".
 */
export const toPhoneticKey = (word: string): string => {
  let w = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');

  if (!w) return '';

  // 'e' mudo no final ("time", "make") não soa. Só remove se o que sobra ainda tiver
  // vogal: em "the" o 'e' é o único núcleo vocálico e removê-lo destrói a palavra.
  if (w.length > 2 && w.endsWith('e') && !VOWELS.has(w[w.length - 2])) {
    const stem = w.slice(0, -1);
    if ([...stem].some(c => VOWELS.has(c))) {
      w = stem;
    }
  }

  let out = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    const next = w[i + 1] ?? '';
    const pair = ch + next;

    // Dígrafos primeiro — a ordem importa
    if (pair === 'th') { out += 'T'; i++; continue; }
    if (pair === 'sh') { out += 'S'; i++; continue; }
    if (pair === 'ch') { out += 'C'; i++; continue; }
    if (pair === 'ph') { out += 'f'; i++; continue; }
    if (pair === 'ck') { out += 'k'; i++; continue; }
    if (pair === 'qu') { out += 'kw'; i++; continue; }
    if (pair === 'wh') { out += 'w'; i++; continue; }
    if (pair === 'ng') { out += 'N'; i++; continue; }
    // 'gh' é mudo em "night", "through"
    if (pair === 'gh') { i++; continue; }

    // Nasal velar por assimilação: o 'n' de "think"/"bank" soa como o 'ng' de "sing"
    if (ch === 'n' && (next === 'k' || next === 'g')) { out += 'N'; continue; }

    if (ch === 'c') {
      out += 'eiy'.includes(next) ? 's' : 'k';
      continue;
    }
    if (ch === 'g') {
      out += 'eiy'.includes(next) ? 'J' : 'g';
      continue;
    }
    if (ch === 'j') { out += 'J'; continue; }
    if (ch === 'x') { out += 'ks'; continue; }
    // 'y' consoante no início, vogal no resto
    if (ch === 'y') { out += i === 0 ? 'j' : 'i'; continue; }

    out += ch;
  }

  // Letras dobradas soam uma vez só ("letter", "supper")
  return out.replace(/(.)\1+/g, '$1');
};

/**
 * Custo de trocar um som por outro, de 0 (igual) a 1 (sem relação).
 *
 * Os pares listados são as confusões clássicas de falante de português em inglês. Cobrá-las
 * como erro cheio é o que produz nota injusta para uma fala perfeitamente compreensível.
 */
const SUBSTITUTION_COSTS: Record<string, number> = {};

const registerPair = (a: string, b: string, cost: number) => {
  SUBSTITUTION_COSTS[`${a}|${b}`] = cost;
  SUBSTITUTION_COSTS[`${b}|${a}`] = cost;
};

// "th" não existe em português e vira t, s, f ou d
registerPair('T', 't', 0.2);
registerPair('T', 's', 0.25);
registerPair('T', 'd', 0.25);
registerPair('T', 'f', 0.3);
registerPair('T', 'z', 0.3);
// R inglês x R português (gutural)
registerPair('r', 'h', 0.35);
// Sonorização final: "dogs" x "docs"
registerPair('s', 'z', 0.2);
registerPair('t', 'd', 0.3);
registerPair('p', 'b', 0.35);
registerPair('k', 'g', 0.35);
registerPair('f', 'v', 0.3);
registerPair('v', 'b', 0.35);
// Chiados
registerPair('S', 'C', 0.3);
registerPair('J', 'C', 0.3);
registerPair('S', 's', 0.35);
registerPair('J', 'z', 0.35);
// "ng" final costuma virar n
registerPair('N', 'n', 0.2);
registerPair('N', 'g', 0.35);
// Vogais curtas x longas: "ship" x "sheep", "full" x "fool"
registerPair('i', 'e', 0.25);
registerPair('u', 'o', 0.25);
registerPair('a', 'e', 0.35);
registerPair('a', 'o', 0.35);
// H aspirado é frequentemente omitido
registerPair('h', 'r', 0.35);

/** Custo de inserir ou remover um som. */
const indelCost = (symbol: string): number => {
  // Omitir o H inicial é erro leve e muito comum
  if (symbol === 'h') return 0.4;
  // Vogal epentética: brasileiro tende a acrescentar vogal após consoante final ("dogui").
  // Não pode ficar barato demais, senão palavras longas e sem relação nenhuma passam a
  // parecer próximas só porque sobra vogal para descartar de graça.
  if (VOWELS.has(symbol)) return 0.7;
  return 1;
};

const substitutionCost = (a: string, b: string): number => {
  if (a === b) return 0;
  const known = SUBSTITUTION_COSTS[`${a}|${b}`];
  if (known !== undefined) return known;
  // Duas vogais diferentes ainda estão mais próximas do que vogal x consoante
  if (VOWELS.has(a) && VOWELS.has(b)) return 0.6;
  return 1;
};

/**
 * Distância sonora entre duas palavras, normalizada de 0 (soam igual) a 1 (sem relação).
 */
export const phoneticWordDistance = (a: string, b: string): number => {
  const keyA = toPhoneticKey(a);
  const keyB = toPhoneticKey(b);

  if (keyA === keyB) return 0;
  if (!keyA || !keyB) return 1;

  const rows = keyA.length + 1;
  const cols = keyB.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 1; i < rows; i++) {
    matrix[i][0] = matrix[i - 1][0] + indelCost(keyA[i - 1]);
  }
  for (let j = 1; j < cols; j++) {
    matrix[0][j] = matrix[0][j - 1] + indelCost(keyB[j - 1]);
  }

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + substitutionCost(keyA[i - 1], keyB[j - 1]),
        matrix[i - 1][j] + indelCost(keyA[i - 1]),
        matrix[i][j - 1] + indelCost(keyB[j - 1])
      );
    }
  }

  const distance = matrix[keyA.length][keyB.length];
  const normalizer = Math.max(keyA.length, keyB.length);
  return Math.min(1, distance / normalizer);
};

/**
 * Acima desta distância sonora, as palavras deixam de ser variação de pronúncia da mesma
 * palavra e passam a ser palavras diferentes.
 */
const DIFFERENT_WORD_THRESHOLD = 0.5;

/**
 * Custo de uma palavra dentro da frase.
 *
 * Abaixo do limiar vale crédito parcial — é o objetivo desta mudança, não punir o
 * quase-acerto. Acima dele o custo vira integral: dar crédito parcial a uma palavra
 * simplesmente trocada tornaria a nota generosa demais e esconderia erro de conteúdo.
 */
const sequenceWordCost = (spoken: string, expected: string): number => {
  const distance = phoneticWordDistance(spoken, expected);
  return distance > DIFFERENT_WORD_THRESHOLD ? 1 : distance;
};

/**
 * Distância entre a sequência falada e a esperada, usando custo parcial por palavra.
 * Inserir ou faltar uma palavra continua custando 1 — é um erro de conteúdo, não de sotaque.
 */
export const phoneticSequenceDistance = (spoken: string[], expected: string[]): number => {
  const rows = spoken.length + 1;
  const cols = expected.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 1; i < rows; i++) matrix[i][0] = i;
  for (let j = 1; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + sequenceWordCost(spoken[i - 1], expected[j - 1]),
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1
      );
    }
  }

  return matrix[spoken.length][expected.length];
};

/** Similaridade de pronúncia de 0 a 100. */
export const pronunciationSimilarity = (spoken: string[], expected: string[]): number => {
  if (spoken.length === 0 && expected.length === 0) return 100;
  if (spoken.length === 0 || expected.length === 0) return 0;

  const distance = phoneticSequenceDistance(spoken, expected);
  const normalizer = Math.max(spoken.length, expected.length);
  return Math.round(Math.max(0, 1 - distance / normalizer) * 100);
};

/**
 * Classifica uma palavra falada contra a esperada, para o retorno visual.
 * `close` marca o quase-acerto: som próximo, típico de sotaque e não de erro de palavra.
 */
export type WordAccuracy = 'correct' | 'close' | 'incorrect';

export const classifyWordAccuracy = (spoken: string, expected: string): WordAccuracy => {
  const distance = phoneticWordDistance(spoken, expected);
  // 'correct' exige som praticamente idêntico: trocar o "th" por "s" rende nota alta,
  // mas continua sendo um erro de pronúncia que o estudante precisa enxergar.
  if (distance <= 0.05) return 'correct';
  if (distance <= DIFFERENT_WORD_THRESHOLD) return 'close';
  return 'incorrect';
};
