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
