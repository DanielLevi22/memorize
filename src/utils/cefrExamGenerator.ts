import type { CefrExam } from '../types';

/**
 * Geração de exames CEFR a partir do material que o próprio aluno estudou.
 *
 * O problema que isto resolve: os exames eram um seed fixo. Como aprovar num exame é o portão
 * para subir de nível, e ao reprovar o aluno via exatamente as mesmas perguntas, da segunda
 * tentativa em diante a prova media a memória do gabarito, não o inglês. Um exame que se
 * decora não certifica nada.
 *
 * Aqui cada prova é montada a partir dos cards de vocabulário e das frases de leitura do
 * aluno — variável a cada tentativa, pessoalmente relevante e 100% local (sem API, sem custo).
 * As questões objetivas saem daqui; a redação continua vindo do template original.
 */

export interface ExamSourceCard {
  front: string;       // termo em inglês
  back: string;        // tradução
  context?: string;    // frase de exemplo contendo o termo
}

export interface ExamSourceLine {
  original: string;    // frase no idioma estudado
  translated: string;  // tradução
}

export type GeneratedQuestion = CefrExam['questions'][number];

export interface GenerateExamOptions {
  targetReading?: number;
  targetListening?: number;
  /** Semente para embaralhamento determinístico (testes e reprodutibilidade). */
  seed?: number;
}

/** PRNG determinístico (mulberry32): mesmo seed, mesma sequência. */
const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T>(items: T[], rng: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Escolhe até `n` distratores de um pool, excluindo qualquer um que colida com a resposta
 * correta (mesmo texto normalizado) e deduplicando. Sem distratores suficientes, retorna
 * menos que `n` — e a questão que depende deles é descartada, para nunca gerar múltipla
 * escolha com menos de quatro alternativas.
 */
const pickDistractors = (
  pool: string[],
  correct: string,
  n: number,
  rng: () => number
): string[] => {
  const seen = new Set<string>([normalize(correct)]);
  const unique: string[] = [];
  for (const candidate of shuffle(pool, rng)) {
    const key = normalize(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
    if (unique.length === n) break;
  }
  return unique;
};

/** Monta a lista final de 4 alternativas embaralhadas, ou null se não houver distratores. */
const buildOptions = (
  correct: string,
  pool: string[],
  rng: () => number
): string[] | null => {
  const distractors = pickDistractors(pool, correct, 3, rng);
  if (distractors.length < 3) return null;
  return shuffle([correct, ...distractors], rng);
};

/** Substitui a primeira ocorrência do termo na frase por uma lacuna, ignorando caixa. */
const blankOut = (sentence: string, term: string): string | null => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  if (!regex.test(sentence)) return null;
  return sentence.replace(regex, '______');
};

/**
 * Gera as questões objetivas (reading + listening) a partir dos cards e frases.
 *
 * - Reading por cloze: quando o card tem uma frase de exemplo contendo o termo, apaga o termo.
 * - Reading por vocabulário: senão, pergunta o significado do termo.
 * - Listening: apresenta uma frase (via TTS no app) e pede o significado correto.
 */
export const generateExamQuestions = (
  cards: ExamSourceCard[],
  lines: ExamSourceLine[],
  options: GenerateExamOptions = {}
): GeneratedQuestion[] => {
  const { targetReading = 5, targetListening = 3, seed = 1 } = options;
  const rng = makeRng(seed);

  const usableCards = cards.filter(c => c.front?.trim() && c.back?.trim());
  const frontPool = usableCards.map(c => c.front);
  const backPool = usableCards.map(c => c.back);

  const questions: GeneratedQuestion[] = [];

  // --- Reading ---
  let readingIdx = 0;
  for (const card of shuffle(usableCards, rng)) {
    if (questions.filter(q => q.section === 'reading').length >= targetReading) break;

    const cloze = card.context ? blankOut(card.context, card.front) : null;
    if (cloze) {
      const opts = buildOptions(card.front, frontPool, rng);
      if (!opts) continue;
      questions.push({
        id: `gen-r-${++readingIdx}`,
        section: 'reading',
        questionText: `Complete: "${cloze}"`,
        options: opts,
        correctAnswer: card.front,
        sourceTerm: card.front
      });
    } else {
      const opts = buildOptions(card.back, backPool, rng);
      if (!opts) continue;
      questions.push({
        id: `gen-r-${++readingIdx}`,
        section: 'reading',
        questionText: `What is the meaning of "${card.front}"?`,
        options: opts,
        correctAnswer: card.back,
        sourceTerm: card.front
      });
    }
  }

  // --- Listening ---
  // Prefere frases de leitura reais; completa com o contexto dos cards (que carregam o termo).
  const listeningSources: (ExamSourceLine & { sourceTerm?: string })[] = [
    ...lines.filter(l => l.original?.trim() && l.translated?.trim()),
    ...usableCards
      .filter(c => c.context?.trim())
      .map(c => ({ original: c.context as string, translated: c.back, sourceTerm: c.front }))
  ];
  const translationPool = [
    ...lines.map(l => l.translated),
    ...backPool
  ].filter(Boolean);

  let listeningIdx = 0;
  for (const source of shuffle(listeningSources, rng)) {
    if (listeningIdx >= targetListening) break;
    const opts = buildOptions(source.translated, translationPool, rng);
    if (!opts) continue;
    questions.push({
      id: `gen-l-${++listeningIdx}`,
      section: 'listening',
      audioText: source.original,
      questionText: 'Listen and choose the correct meaning.',
      options: opts,
      correctAnswer: source.translated,
      ...(source.sourceTerm ? { sourceTerm: source.sourceTerm } : {})
    });
  }

  return questions;
};

/** Mínimo de questões objetivas para valer a pena gerar em vez de usar o seed fixo. */
export const MIN_GENERATED_QUESTIONS = 4;

/**
 * Monta um exame a partir do material do aluno, reaproveitando `base` para título, nível e
 * redação. Se não houver material suficiente para uma prova decente, devolve o `base` intacto
 * — melhor um seed fixo do que uma prova de duas perguntas.
 */
export const buildGeneratedExam = (
  base: CefrExam,
  cards: ExamSourceCard[],
  lines: ExamSourceLine[],
  options: GenerateExamOptions = {}
): CefrExam => {
  const questions = generateExamQuestions(cards, lines, options);

  if (questions.length < MIN_GENERATED_QUESTIONS) {
    return base;
  }

  return {
    ...base,
    id: `${base.id}-gen-${options.seed ?? Date.now()}`,
    questions,
    writingPrompt: base.writingPrompt
  };
};
