import { describe, it, expect } from 'vitest';
import {
  generateExamQuestions,
  buildGeneratedExam,
  type ExamSourceCard,
  type ExamSourceLine
} from './cefrExamGenerator';
import type { CefrExam } from '../types';

const makeCards = (n: number): ExamSourceCard[] =>
  Array.from({ length: n }, (_, i) => ({
    front: `word${i}`,
    back: `significado${i}`,
    context: `This is a sentence using word${i} in context.`
  }));

const lines: ExamSourceLine[] = [
  { original: 'The cat sits on the mat.', translated: 'O gato senta no tapete.' },
  { original: 'She reads a book at night.', translated: 'Ela lê um livro à noite.' },
  { original: 'We travel every summer.', translated: 'Nós viajamos todo verão.' }
];

const baseExam: CefrExam = {
  id: 'exam-b1-default',
  level: 'B1',
  title: 'Simulado B1',
  description: 'desc',
  questions: [
    { id: 'seed-1', section: 'reading', questionText: 'seed?', options: ['a', 'b', 'c', 'd'], correctAnswer: 'a' }
  ],
  writingPrompt: { topic: 'x', instructions: 'y', minWords: 20, maxWords: 60 }
};

describe('generateExamQuestions', () => {
  it('gera questões de reading e listening a partir do material', () => {
    const questions = generateExamQuestions(makeCards(10), lines, { seed: 1 });

    expect(questions.some(q => q.section === 'reading')).toBe(true);
    expect(questions.some(q => q.section === 'listening')).toBe(true);
  });

  it('toda questão tem exatamente 4 alternativas incluindo a correta', () => {
    const questions = generateExamQuestions(makeCards(12), lines, { seed: 7 });

    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.correctAnswer);
      // Sem alternativas duplicadas
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it('faz cloze quando o contexto contém o termo', () => {
    const questions = generateExamQuestions(
      [{ front: 'apple', back: 'maçã', context: 'I ate an apple today.' }, ...makeCards(6)],
      lines,
      { seed: 3 }
    );

    const cloze = questions.find(q => q.questionText.includes('______'));
    expect(cloze).toBeDefined();
    // O termo apagado não deve aparecer na frase com lacuna
    expect(cloze!.questionText.toLowerCase()).not.toContain('apple ');
  });

  it('cai para pergunta de significado quando não há contexto', () => {
    const questions = generateExamQuestions(
      Array.from({ length: 6 }, (_, i) => ({ front: `term${i}`, back: `trad${i}` })),
      [],
      { seed: 2 }
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.every(q => q.section === 'reading')).toBe(true);
    expect(questions.some(q => q.questionText.startsWith('What is the meaning'))).toBe(true);
  });

  it('é determinística com a mesma semente', () => {
    const a = generateExamQuestions(makeCards(10), lines, { seed: 42 });
    const b = generateExamQuestions(makeCards(10), lines, { seed: 42 });
    expect(a).toEqual(b);
  });

  it('varia com sementes diferentes', () => {
    const a = generateExamQuestions(makeCards(10), lines, { seed: 1 });
    const b = generateExamQuestions(makeCards(10), lines, { seed: 999 });
    // Ao menos a ordem ou o conteúdo das questões difere
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('respeita os limites de quantidade por seção', () => {
    const questions = generateExamQuestions(makeCards(30), lines, {
      seed: 1,
      targetReading: 4,
      targetListening: 2
    });

    expect(questions.filter(q => q.section === 'reading').length).toBeLessThanOrEqual(4);
    expect(questions.filter(q => q.section === 'listening').length).toBeLessThanOrEqual(2);
  });

  it('não gera questões sem distratores suficientes', () => {
    // Dois cards só: impossível formar 4 alternativas distintas
    const questions = generateExamQuestions(makeCards(2), [], { seed: 1 });
    expect(questions).toHaveLength(0);
  });

  it('ignora cards sem front ou back', () => {
    const questions = generateExamQuestions(
      [
        { front: '', back: 'x', context: 'a' },
        { front: 'y', back: '', context: 'b' },
        ...makeCards(6)
      ],
      [],
      { seed: 1 }
    );

    for (const q of questions) {
      expect(q.options).not.toContain('');
    }
  });
});

describe('buildGeneratedExam', () => {
  it('preserva nível, título e redação do exame base', () => {
    const exam = buildGeneratedExam(baseExam, makeCards(12), lines, { seed: 1 });

    expect(exam.level).toBe('B1');
    expect(exam.title).toBe('Simulado B1');
    expect(exam.writingPrompt).toEqual(baseExam.writingPrompt);
  });

  it('substitui as questões do seed pelas geradas', () => {
    const exam = buildGeneratedExam(baseExam, makeCards(12), lines, { seed: 1 });

    expect(exam.questions.some(q => q.id === 'seed-1')).toBe(false);
    expect(exam.questions.length).toBeGreaterThanOrEqual(4);
  });

  it('devolve o exame base intacto quando falta material', () => {
    const exam = buildGeneratedExam(baseExam, makeCards(1), [], { seed: 1 });
    expect(exam).toBe(baseExam);
  });

  it('gera id distinto do exame base', () => {
    const exam = buildGeneratedExam(baseExam, makeCards(12), lines, { seed: 5 });
    expect(exam.id).not.toBe(baseExam.id);
    expect(exam.id).toContain(baseExam.id);
  });
});
