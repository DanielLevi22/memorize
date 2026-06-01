import { describe, it, expect } from 'vitest';
import { getPassingCut, calculateExamScore } from './cefrExamHelper';
import type { CefrExam } from '../types';

// Mock do simulado B2 para testes
const mockB2Exam: CefrExam = {
  id: 'exam-b2-test',
  level: 'B2',
  title: 'Test Exam',
  description: 'Desc',
  questions: [
    { id: 'q1', section: 'reading', questionText: 'Q1', options: ['A', 'B'], correctAnswer: 'A' },
    { id: 'q2', section: 'reading', questionText: 'Q2', options: ['A', 'B'], correctAnswer: 'A' },
    { id: 'q3', section: 'listening', questionText: 'Q3', options: ['A', 'B'], correctAnswer: 'A' },
    { id: 'q4', section: 'listening', questionText: 'Q4', options: ['A', 'B'], correctAnswer: 'A' }
  ],
  writingPrompt: {
    topic: 'Tech',
    instructions: 'Write',
    minWords: 50,
    maxWords: 100
  }
};

describe('cefrExamHelper: Lógica de Correção de Provas', () => {
  it('deve retornar a nota de corte correta baseada no nível do exame', () => {
    expect(getPassingCut('A1')).toBe(60);
    expect(getPassingCut('A2')).toBe(60);
    expect(getPassingCut('B1')).toBe(70);
    expect(getPassingCut('B2')).toBe(70);
    expect(getPassingCut('C1')).toBe(80);
    expect(getPassingCut('C2')).toBe(80);
  });

  it('deve calcular pontuação máxima com todas as respostas corretas e redação 100', () => {
    const answers = {
      q1: 'A',
      q2: 'A',
      q3: 'A',
      q4: 'A'
    };

    const result = calculateExamScore(answers, mockB2Exam, 100);

    expect(result.readingScore).toBe(100);
    expect(result.listeningScore).toBe(100);
    expect(result.overallScore).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('deve calcular reprovação com 50% nas objetivas e redação 50 no nível B2 (nota corte: 70)', () => {
    const answers = {
      q1: 'A', // Certo (Reading 1/2 = 50%)
      q2: 'B', // Errado
      q3: 'A', // Certo (Listening 1/2 = 50%)
      q4: 'B'  // Errado
    };

    const result = calculateExamScore(answers, mockB2Exam, 50);

    expect(result.readingScore).toBe(50);
    expect(result.listeningScore).toBe(50);
    
    // Média objetivas = 50. Ponderação: (50 * 0.6) + (50 * 0.4) = 30 + 20 = 50.
    expect(result.overallScore).toBe(50);
    expect(result.passed).toBe(false);
  });

  it('deve calcular aprovação se compensar nas objetivas mesmo com redação baixa (B2)', () => {
    const answers = {
      q1: 'A', // Certo (Reading 2/2 = 100%)
      q2: 'A', // Certo
      q3: 'A', // Certo (Listening 2/2 = 100%)
      q4: 'A'  // Certo
    };

    // Média objetivas = 100. Ponderação: (100 * 0.6) + (30 * 0.4) = 60 + 12 = 72 (corte B2 é 70)
    const result = calculateExamScore(answers, mockB2Exam, 30);

    expect(result.readingScore).toBe(100);
    expect(result.listeningScore).toBe(100);
    expect(result.overallScore).toBe(72);
    expect(result.passed).toBe(true);
  });
});
