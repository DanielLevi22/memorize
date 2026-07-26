import type { CefrExam } from '../types';

/**
 * Retorna a nota de corte para aprovação baseado no nível CEFR.
 */
export function getPassingCut(level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'): number {
  if (level === 'A1' || level === 'A2') return 60;
  if (level === 'B1' || level === 'B2') return 70;
  return 80;
}

export interface ExamScoreResult {
  readingScore: number;
  listeningScore: number;
  overallScore: number;
  passed: boolean;
}

/**
 * Calcula a nota geral do simulado baseando-se nas respostas e nota de redação.
 * Peso: 60% Objetivas (Reading + Listening) e 40% Redação.
 * 
 * @param answers Dicionário contendo respostas selecionadas (questionId -> answerText)
 * @param exam O simulado correspondente
 * @param writingScore Nota da redação avaliada (de 0 a 100)
 */
export function calculateExamScore(
  answers: Record<string, string>,
  exam: CefrExam,
  writingScore: number
): ExamScoreResult {
  const readingQuestions = exam.questions.filter(q => q.section === 'reading');
  const listeningQuestions = exam.questions.filter(q => q.section === 'listening');

  // 1. Nota de Leitura
  let correctReading = 0;
  readingQuestions.forEach(q => {
    if (answers[q.id] === q.correctAnswer) correctReading++;
  });
  const readingScore = readingQuestions.length > 0 
    ? Math.round((correctReading / readingQuestions.length) * 100) 
    : 100;

  // 2. Nota de Escuta
  let correctListening = 0;
  listeningQuestions.forEach(q => {
    if (answers[q.id] === q.correctAnswer) correctListening++;
  });
  const listeningScore = listeningQuestions.length > 0 
    ? Math.round((correctListening / listeningQuestions.length) * 100) 
    : 100;

  // 3. Média geral ponderada (Peso: Objetivas 60%, Redação 40%)
  const objectiveScore = Math.round((readingScore + listeningScore) / 2);
  const overallScore = Math.round((objectiveScore * 0.6) + (writingScore * 0.4));
  const passed = overallScore >= getPassingCut(exam.level);

  return {
    readingScore,
    listeningScore,
    overallScore,
    passed
  };
}

export interface WrongAnswer {
  questionId: string;
  section: 'reading' | 'listening';
  questionText: string;
  yourAnswer: string;   // vazio se a questão ficou em branco
  correctAnswer: string;
  sourceTerm?: string;  // termo a revisar, quando a questão foi gerada do material do aluno
}

export interface ExamDiagnostic {
  wrong: WrongAnswer[];
  /** Termos únicos de vocabulário ligados aos erros, para virar uma revisão focada. */
  termsToReview: string[];
  wrongReadingCount: number;
  wrongListeningCount: number;
}

/**
 * Diagnóstico pós-prova: lista o que foi errado e — o ponto central — quais termos de
 * vocabulário revisar.
 *
 * Como as questões geradas carregam o termo de origem (`sourceTerm`), cada erro aponta para
 * um card específico. É o que transforma um "68%, reprovado" num plano de estudo acionável e
 * fecha o ciclo estudo → prova → estudo.
 */
export function buildExamDiagnostic(
  answers: Record<string, string>,
  exam: CefrExam
): ExamDiagnostic {
  const wrong: WrongAnswer[] = [];

  for (const q of exam.questions) {
    if (q.section !== 'reading' && q.section !== 'listening') continue;
    const given = answers[q.id] ?? '';
    if (given === q.correctAnswer) continue;

    wrong.push({
      questionId: q.id,
      section: q.section,
      questionText: q.questionText,
      yourAnswer: given,
      correctAnswer: q.correctAnswer,
      sourceTerm: q.sourceTerm
    });
  }

  const termsToReview = Array.from(
    new Set(
      wrong
        .map(w => w.sourceTerm?.trim())
        .filter((t): t is string => !!t)
    )
  );

  return {
    wrong,
    termsToReview,
    wrongReadingCount: wrong.filter(w => w.section === 'reading').length,
    wrongListeningCount: wrong.filter(w => w.section === 'listening').length
  };
}
