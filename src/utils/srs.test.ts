import { describe, it, expect } from 'vitest';
import { 
  calculateNextReview, 
  calculateFSRSReview, 
  getFriendlyInterval,
  getLevenshteinDistance,
  getWordLevenshteinDistance,
  diffStrings,
  diffWords
} from './srs';
import type { Card, DeckPreset } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────

/** Cria um cartão base "novo" (nunca estudado) */
function newCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    front: 'Hello',
    back: 'Olá',
    context: 'Hello, how are you?',
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
    dueDate: '2026-01-01',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** Cria um cartão já estudado (com histórico) */
function studiedCard(overrides: Partial<Card> = {}): Card {
  return newCard({
    interval: 10,
    ease: 2.5,
    repetitions: 3,
    lapses: 0,
    dueDate: '2026-02-01',
    ...overrides,
  });
}

/** Cria um cartão já estudado com campos FSRS */
function fsrsStudiedCard(overrides: Partial<Card> = {}): Card {
  return studiedCard({
    difficulty: 5,
    stability: 10,
    lastReview: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 dias atrás
    ...overrides,
  });
}

/** Preset padrão completo para testes */
function defaultPreset(overrides: Partial<DeckPreset> = {}): DeckPreset {
  return {
    id: 'preset-1',
    name: 'Padrão',
    newCardsPerDay: 20,
    maxReviewsPerDay: 200,
    newCardsIgnoreReviewLimit: false,
    limitsStartFromParent: false,
    learningSteps: '',
    graduatingInterval: 1,
    easyInterval: 4,
    insertionOrder: 'sequential',
    relearningSteps: '',
    minimumInterval: 1,
    leechThreshold: 8,
    leechAction: 'tag',
    newCardGrouping: 'deck',
    newCardSorting: 'template',
    newVsReviewOrder: 'mix',
    interdayLearningVsReviewOrder: 'mix',
    reviewSorting: 'dateThenRandom',
    buryNewSiblings: false,
    buryReviewSiblings: false,
    buryLearningSiblings: false,
    disableAutoplay: false,
    skipQuestionOnReplay: false,
    maxAnswerSeconds: 60,
    showTimer: false,
    stopTimerOnAnswer: false,
    autoShowAnswerSeconds: 0,
    autoShowQuestionSeconds: 0,
    waitForAudio: false,
    questionAction: 'showAnswer',
    answerAction: 'bury',
    daysOffMultiplier: [1, 1, 1, 1, 1, 1, 1],
    fsrsEnabled: false,
    maxInterval: 36500,
    startingEase: 2.5,
    easyBonus: 1.3,
    intervalModifier: 1.0,
    hardInterval: 1.2,
    lapseMultiplier: 0.5,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════
// SM-2 — Algoritmo Clássico
// ═════════════════════════════════════════════════════════════════════

describe('SM-2: Cartão Novo', () => {
  it('rating "Errei" (1) → repetitions=0, lapses+1, ease diminui', () => {
    const card = newCard();
    const result = calculateNextReview(card, 1);

    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(1);
    expect(result.ease).toBeLessThan(2.5);
    expect(result.interval).toBeGreaterThanOrEqual(1);
  });

  it('rating "Difícil" (2) → repetitions=1, ease diminui, interval=1', () => {
    const card = newCard();
    const result = calculateNextReview(card, 2);

    expect(result.repetitions).toBe(1);
    expect(result.ease).toBe(2.5 - 0.15); // 2.35
    expect(result.interval).toBe(1);
  });

  it('rating "Fácil" (3) → repetitions+1, ease aumenta', () => {
    const card = newCard();
    const result = calculateNextReview(card, 3);

    expect(result.repetitions).toBe(1);
    expect(result.ease).toBe(2.5 + 0.15); // 2.65
    expect(result.interval).toBeGreaterThanOrEqual(1);
  });
});

describe('SM-2: Cartão com Histórico (repetitions >= 3)', () => {
  it('rating "Errei" (1) → reseta repetitions, incrementa lapses', () => {
    const card = studiedCard({ repetitions: 5, lapses: 2, interval: 30 });
    const result = calculateNextReview(card, 1);

    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(3);
    expect(result.ease).toBe(Math.max(1.3, 2.5 - 0.2));
    expect(result.interval).toBeLessThan(30); // Deve reduzir pelo lapseMultiplier
  });

  it('rating "Difícil" (2) → mantém/incrementa repetitions, intervalo cresce modestamente', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const result = calculateNextReview(card, 2);

    expect(result.repetitions).toBe(3); // não reseta
    expect(result.ease).toBe(2.5 - 0.15);
    // hardInterval padrão = 1.2 → interval = round(10 * 1.2) = 12
    expect(result.interval).toBe(12);
  });

  it('rating "Fácil" (4) → repetitions cresce, intervalo cresce bastante com easyBonus', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const result = calculateNextReview(card, 4);

    expect(result.repetitions).toBe(4);
    expect(result.ease).toBe(2.5 + 0.15);
    // easyBonus padrão = 1.3 → interval = round(10 * 2.65 * 1.3) = round(34.45) = 34
    expect(result.interval).toBe(34);
  });
});

describe('SM-2: Edge Cases', () => {
  it('ease nunca cai abaixo de 1.3', () => {
    const card = newCard({ ease: 1.3 });
    const result = calculateNextReview(card, 1);

    expect(result.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('ease usa startingEase do preset quando fornecido', () => {
    const card = newCard({ ease: 0 }); // ease inválido
    const preset = defaultPreset({ startingEase: 3.0 });
    const result = calculateNextReview(card, 3, preset);

    expect(result.ease).toBe(3.0 + 0.15); // startingEase + bônus fácil
  });

  it('interval nunca é menor que 1', () => {
    const card = newCard({ interval: 0 });
    const result = calculateNextReview(card, 1);

    expect(result.interval).toBeGreaterThanOrEqual(1);
  });

  it('dueDate é uma string no formato YYYY-MM-DD', () => {
    const card = newCard();
    const result = calculateNextReview(card, 3);

    expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('dueDate é no futuro', () => {
    const card = newCard();
    const result = calculateNextReview(card, 3);
    const today = new Date().toISOString().split('T')[0];

    expect(result.dueDate >= today).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// SM-2 — Integração com Presets
// ═════════════════════════════════════════════════════════════════════

describe('SM-2: Aplicação de Preset', () => {
  it('lapseMultiplier customizado afeta intervalo ao errar', () => {
    const card = studiedCard({ interval: 20 });
    const presetA = defaultPreset({ lapseMultiplier: 0.5 });
    const presetB = defaultPreset({ lapseMultiplier: 0.25 });

    const resultA = calculateNextReview(card, 1, presetA);
    const resultB = calculateNextReview(card, 1, presetB);

    expect(resultA.interval).toBe(10); // 20 * 0.5
    expect(resultB.interval).toBe(5);  // 20 * 0.25
  });

  it('minimumInterval impede intervalo de ficar muito baixo ao errar', () => {
    const card = studiedCard({ interval: 2 });
    const preset = defaultPreset({ lapseMultiplier: 0.1, minimumInterval: 3 });
    const result = calculateNextReview(card, 1, preset);

    expect(result.interval).toBeGreaterThanOrEqual(3);
  });

  it('hardInterval customizado escala corretamente no rating "Difícil"', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const preset = defaultPreset({ hardInterval: 1.5 });
    const result = calculateNextReview(card, 2, preset);

    expect(result.interval).toBe(15); // 10 * 1.5
  });

  it('easyBonus customizado escala corretamente no rating "Fácil" (4)', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const preset = defaultPreset({ easyBonus: 2.0 });
    const result = calculateNextReview(card, 4, preset);

    // interval = round(10 * (2.5 + 0.15) * 2.0) = round(53) = 53
    expect(result.interval).toBe(53);
  });

  it('graduatingInterval afeta o primeiro acerto "Fácil"', () => {
    const card = newCard();
    const preset = defaultPreset({ graduatingInterval: 5 });
    const result = calculateNextReview(card, 3, preset);

    expect(result.interval).toBe(5);
  });

  it('easyInterval afeta o segundo acerto "Fácil"', () => {
    const card = newCard({ repetitions: 1, ease: 2.5 });
    const preset = defaultPreset({ easyInterval: 10 });
    const result = calculateNextReview(card, 3, preset);

    expect(result.interval).toBe(10);
  });

  it('intervalModifier escala o intervalo final (rating Fácil/4)', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const preset = defaultPreset({ intervalModifier: 1.5, easyBonus: 1.3 });
    const result = calculateNextReview(card, 4, preset);

    // Base interval = round(10 * 2.65 * 1.3) = round(34.45) = 34
    // Após modifier: round(34 * 1.5) = 51
    expect(result.interval).toBe(51);
  });

  it('maxInterval limita o intervalo final', () => {
    const card = studiedCard({ interval: 100, repetitions: 5 });
    const preset = defaultPreset({ maxInterval: 30 });
    const result = calculateNextReview(card, 3, preset);

    expect(result.interval).toBeLessThanOrEqual(30);
  });

  it('sem preset → usa valores padrão (fallback)', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const withPreset = calculateNextReview(card, 3, defaultPreset());
    const withoutPreset = calculateNextReview(card, 3);

    // Sem preset, easyBonus = 1.3 (hardcoded default = same as defaultPreset)
    expect(withPreset.interval).toBe(withoutPreset.interval);
  });
});

// ═════════════════════════════════════════════════════════════════════
// FSRS v4 — Algoritmo
// ═════════════════════════════════════════════════════════════════════

describe('FSRS v4: Primeira Revisão (cartão novo)', () => {
  it('rating "Errei" (1) → lapses+1, repetitions=0', () => {
    const card = newCard();
    const result = calculateFSRSReview(card, 1);

    expect(result.repetitions).toBe(0);
    expect(result.lapses).toBe(1);
    expect(result.stability).toBeGreaterThan(0);
    expect(result.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.difficulty).toBeLessThanOrEqual(10);
  });

  it('rating "Difícil" (2) → repetitions=1, estabilidade inicial W[1]', () => {
    const card = newCard();
    const result = calculateFSRSReview(card, 2);

    expect(result.repetitions).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.stability).toBeGreaterThan(0);
  });

  it('rating "Bom" (3) → repetitions=1, estabilidade inicial W[2] (2.4)', () => {
    const card = newCard();
    const result = calculateFSRSReview(card, 3);

    expect(result.repetitions).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.stability).toBeCloseTo(2.4);
  });

  it('rating "Fácil" (4) → repetitions=1, estabilidade inicial W[3] (5.8)', () => {
    const card = newCard();
    const result = calculateFSRSReview(card, 4);

    expect(result.repetitions).toBe(1);
    expect(result.lapses).toBe(0);
    expect(result.stability).toBeCloseTo(5.8);
  });

  it('estabilidade cresce com rating mais alto na primeira revisão', () => {
    const card = newCard();
    const r1 = calculateFSRSReview(card, 1);
    const r2 = calculateFSRSReview(card, 2);
    const r3 = calculateFSRSReview(card, 3);
    const r4 = calculateFSRSReview(card, 4);

    expect(r4.stability).toBeGreaterThan(r3.stability);
    expect(r3.stability).toBeGreaterThan(r2.stability);
    expect(r2.stability).toBeGreaterThan(r1.stability);
  });
});

describe('FSRS v4: Revisões Subsequentes', () => {
  it('recall bem-sucedido (rating 3) → estabilidade cresce', () => {
    const card = fsrsStudiedCard({ stability: 10 });
    const result = calculateFSRSReview(card, 3);

    expect(result.stability).toBeGreaterThan(10);
    expect(result.repetitions).toBe(4); // studiedCard tem 3
  });

  it('recall difícil (rating 2) → estabilidade ainda cresce, mas menos', () => {
    const card = fsrsStudiedCard({ stability: 10 });
    const rHard = calculateFSRSReview(card, 2);
    const rEasy = calculateFSRSReview(card, 3);

    expect(rHard.stability).toBeGreaterThan(10);
    expect(rEasy.stability).toBeGreaterThan(rHard.stability);
  });

  it('falha (rating 1) → lapses incrementa, estabilidade reduz', () => {
    const card = fsrsStudiedCard({ stability: 10, lapses: 2 });
    const result = calculateFSRSReview(card, 1);

    expect(result.lapses).toBe(3);
    expect(result.repetitions).toBe(0);
    expect(result.stability).toBeLessThan(10);
  });
});

describe('FSRS v4: Clamping e Limites', () => {
  it('dificuldade fica entre 1 e 10', () => {
    const cardEasy = fsrsStudiedCard({ difficulty: 1 });
    const cardHard = fsrsStudiedCard({ difficulty: 10 });

    const rEasy = calculateFSRSReview(cardEasy, 3); // tende a reduzir
    const rHard = calculateFSRSReview(cardHard, 1); // tende a aumentar

    expect(rEasy.difficulty).toBeGreaterThanOrEqual(1);
    expect(rEasy.difficulty).toBeLessThanOrEqual(10);
    expect(rHard.difficulty).toBeGreaterThanOrEqual(1);
    expect(rHard.difficulty).toBeLessThanOrEqual(10);
  });

  it('estabilidade fica entre 0.1 e 36500', () => {
    const card = fsrsStudiedCard({ stability: 0.01 });
    const result = calculateFSRSReview(card, 1);

    expect(result.stability).toBeGreaterThanOrEqual(0.1);
    expect(result.stability).toBeLessThanOrEqual(36500);
  });

  it('interval nunca é menor que 1', () => {
    const card = newCard();
    const result = calculateFSRSReview(card, 1);

    expect(result.interval).toBeGreaterThanOrEqual(1);
  });

  it('ease retornado mantém o valor original do card', () => {
    const card = fsrsStudiedCard({ ease: 2.8 });
    const result = calculateFSRSReview(card, 3);

    expect(result.ease).toBe(2.8);
  });
});

describe('FSRS v4: Integração com Preset', () => {
  it('intervalModifier do preset escala a estabilidade', () => {
    const card = fsrsStudiedCard({ stability: 10 });
    const presetNormal = defaultPreset({ fsrsEnabled: true, intervalModifier: 1.0 });
    const presetBoosted = defaultPreset({ fsrsEnabled: true, intervalModifier: 1.5 });

    const rNormal = calculateFSRSReview(card, 3, presetNormal);
    const rBoosted = calculateFSRSReview(card, 3, presetBoosted);

    expect(rBoosted.stability).toBeGreaterThan(rNormal.stability);
  });

  it('maxInterval do preset limita o intervalo', () => {
    const card = fsrsStudiedCard({ stability: 100 });
    const preset = defaultPreset({ fsrsEnabled: true, maxInterval: 30 });
    const result = calculateFSRSReview(card, 3, preset);

    expect(result.interval).toBeLessThanOrEqual(30);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Roteamento de Algoritmo
// ═════════════════════════════════════════════════════════════════════

describe('calculateNextReview: Roteamento de Algoritmo', () => {
  it('preset com fsrsEnabled=true → delega para FSRS (retorna campos FSRS)', () => {
    const card = newCard();
    const preset = defaultPreset({ fsrsEnabled: true });
    const result = calculateNextReview(card, 3, preset);

    // FSRS retorna campos difficulty, stability, lastReview
    expect(result.difficulty).toBeDefined();
    expect(result.stability).toBeDefined();
    expect(result.lastReview).toBeDefined();
  });

  it('preset com fsrsEnabled=false → usa SM-2 (não retorna campos FSRS)', () => {
    const card = newCard();
    const preset = defaultPreset({ fsrsEnabled: false });
    const result = calculateNextReview(card, 3, preset);

    // SM-2 não retorna difficulty, stability, lastReview
    expect(result.difficulty).toBeUndefined();
    expect(result.stability).toBeUndefined();
    expect(result.lastReview).toBeUndefined();
  });

  it('sem preset → fallback para SM-2 por padrão', () => {
    const card = newCard();
    const result = calculateNextReview(card, 3);

    // Sem preset, o padrão é SM-2 (localStorage retorna null → 'SM-2')
    expect(result.difficulty).toBeUndefined();
    expect(result.stability).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// getFriendlyInterval
// ═════════════════════════════════════════════════════════════════════

describe('getFriendlyInterval', () => {
  it('intervalo = 1 dia → "Amanhã"', () => {
    // Cartão novo + rating Fácil com graduatingInterval=1 → interval=1
    const card = newCard();
    const preset = defaultPreset({ graduatingInterval: 1, fsrsEnabled: false });
    const result = getFriendlyInterval(card, 3, preset);

    expect(result).toBe('Amanhã');
  });

  it('intervalo = 0 (intra-dia) → formato em minutos "1m", "15m"', () => {
    const card = newCard();
    const preset = defaultPreset({ learningSteps: '1m 15m 30m', graduatingInterval: 3, fsrsEnabled: false });
    
    // Rating 1 (Errei) -> volta pro passo 0 -> '1m'
    const rAgain = getFriendlyInterval(card, 1, preset);
    expect(rAgain).toBe('1m');

    // Rating 3 (Bom) -> avança para o passo 1 -> '15m'
    const rGood = getFriendlyInterval(card, 3, preset);
    expect(rGood).toBe('15m');
  });

  it('intervalo < 30 dias → formato "Xd"', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const result = getFriendlyInterval(card, 2);

    // hardInterval padrão = 1.2 → interval = 12
    expect(result).toMatch(/^\d+d$/);
  });

  it('intervalo >= 30 dias → formato "Xm"', () => {
    const card = studiedCard({ interval: 50, repetitions: 3, ease: 2.5 });
    // Rating 3 → interval = round(50 * 2.65 * 1.3) = 173 → ~6m
    const result = getFriendlyInterval(card, 3);

    expect(result).toMatch(/^\d+m$/);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Testes de Consistência e Propriedades
// ═════════════════════════════════════════════════════════════════════

describe('Propriedades Gerais', () => {
  it('SM-2: rating mais alto → intervalo maior (para cartão com histórico)', () => {
    const card = studiedCard({ interval: 10, repetitions: 3 });
    const r1 = calculateNextReview(card, 1); // Errei
    const r2 = calculateNextReview(card, 2); // Difícil
    const r3 = calculateNextReview(card, 3); // Fácil

    expect(r3.interval).toBeGreaterThan(r2.interval);
    expect(r2.interval).toBeGreaterThan(r1.interval);
  });

  it('SM-2: rating mais alto → ease maior', () => {
    const card = studiedCard({ ease: 2.5 });
    const r1 = calculateNextReview(card, 1);
    const r2 = calculateNextReview(card, 2);
    const r3 = calculateNextReview(card, 3);

    expect(r3.ease).toBeGreaterThan(r2.ease);
    expect(r2.ease).toBeGreaterThan(r1.ease);
  });

  it('FSRS: rating mais alto → intervalo maior (para cartão com histórico)', () => {
    const card = fsrsStudiedCard({ stability: 10 });
    const r1 = calculateFSRSReview(card, 1);
    const r2 = calculateFSRSReview(card, 2);
    const r3 = calculateFSRSReview(card, 3);

    expect(r3.interval).toBeGreaterThanOrEqual(r2.interval);
    expect(r2.interval).toBeGreaterThanOrEqual(r1.interval);
  });

  it('todos os resultados têm dueDate válido', () => {
    const card = studiedCard();
    for (const rating of [1, 2, 3, 4]) {
      const result = calculateNextReview(card, rating);
      expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(result.dueDate).toString()).not.toBe('Invalid Date');
    }
  });

  it('todos os resultados têm lapses >= 0', () => {
    const card = newCard();
    for (const rating of [1, 2, 3, 4]) {
      const result = calculateNextReview(card, rating);
      expect(result.lapses).toBeGreaterThanOrEqual(0);
    }
  });

  it('todos os resultados têm repetitions >= 0', () => {
    const card = newCard();
    for (const rating of [1, 2, 3]) {
      const result = calculateNextReview(card, rating);
      expect(result.repetitions).toBeGreaterThanOrEqual(0);
    }
  });

  describe('SM-2: Etapas de Aprendizagem (Anki Style)', () => {
    it('card novo com rating 2 (Difícil/Hard) permanece no passo 0', () => {
      const card = newCard({ interval: 0, repetitions: 0, learningStep: undefined });
      const preset = defaultPreset({ learningSteps: '1m 10m', graduatingInterval: 3 });
      const result = calculateNextReview(card, 2, preset);

      expect(result.learningStep).toBe(0); // Permanece no passo atual (0)
      expect(result.interval).toBe(0);
      expect(result.repetitions).toBe(0);
    });

    it('card novo com rating 3 (Bom) avança para o passo 1 se learningSteps = "1m 10m"', () => {
      const card = newCard({ interval: 0, repetitions: 0, learningStep: undefined });
      const preset = defaultPreset({ learningSteps: '1m 10m', graduatingInterval: 3 });
      const result = calculateNextReview(card, 3, preset);

      expect(result.learningStep).toBe(1);
      expect(result.interval).toBe(0);
      expect(result.repetitions).toBe(0);
    });

    it('card no passo final com rating 3 (Bom) gradua e vira revisão', () => {
      const card = newCard({ interval: 0, repetitions: 0, learningStep: 1 });
      const preset = defaultPreset({ learningSteps: '1m 10m', graduatingInterval: 3 });
      const result = calculateNextReview(card, 3, preset);

      expect(result.learningStep).toBeUndefined();
      expect(result.interval).toBe(3);
      expect(result.repetitions).toBe(1);
    });

    it('card novo com rating 4 (Fácil) gradua instantaneamente', () => {
      const card = newCard({ interval: 0, repetitions: 0, learningStep: undefined });
      const preset = defaultPreset({ learningSteps: '1m 10m', easyInterval: 8 });
      const result = calculateNextReview(card, 4, preset);

      expect(result.learningStep).toBeUndefined();
      expect(result.interval).toBe(8);
      expect(result.repetitions).toBe(1);
    });

    it('card no passo 1 com rating 1 (Errei) volta para o passo 0', () => {
      const card = newCard({ interval: 0, repetitions: 0, learningStep: 1 });
      const preset = defaultPreset({ learningSteps: '1m 10m' });
      const result = calculateNextReview(card, 1, preset);

      expect(result.learningStep).toBe(0);
      expect(result.interval).toBe(0);
      expect(result.lapses).toBe(1);
    });

    it('card de revisão que erra (1) entra em reaprendizagem se relearningSteps = "10m"', () => {
      const card = studiedCard({ interval: 10, repetitions: 3, lapses: 0 });
      const preset = defaultPreset({ relearningSteps: '10m', lapseMultiplier: 0.5 });
      const result = calculateNextReview(card, 1, preset);

      expect(result.learningStep).toBe(0);
      expect(result.interval).toBe(0);
      expect(result.lapseInterval).toBe(5);
      expect(result.lapses).toBe(1);
    });

    it('card de revisão em reaprendizagem no passo final com rating 3 (Bom) gradua com o intervalo de lapso calculado', () => {
      const card = studiedCard({ interval: 0, repetitions: 0, learningStep: 0, lapseInterval: 5 });
      const preset = defaultPreset({ relearningSteps: '10m', graduatingInterval: 1 });
      const result = calculateNextReview(card, 3, preset);

      expect(result.learningStep).toBeUndefined();
      expect(result.interval).toBe(5);
      expect(result.repetitions).toBe(1);
      expect(result.lapseInterval).toBeUndefined();
    });
  });

  describe('SM-2: Sanguessugas (Leeches)', () => {
    it('REQ-3.3 & REQ-3.4: adquire tag "leech" ao atingir o limite de lapses se leechAction = "tag"', () => {
      const card = studiedCard({ interval: 10, repetitions: 3, lapses: 7 }); // lapses + 1 vai dar 8
      const preset = defaultPreset({ leechThreshold: 8, leechAction: 'tag' });
      const result = calculateNextReview(card, 1, preset);

      expect(result.lapses).toBe(8);
      expect(result.tags).toContain('leech');
      expect(result.suspended).toBeUndefined();
    });

    it('REQ-3.4: adquire tag "leech" e fica suspenso ao atingir o limite de lapses se leechAction = "suspend"', () => {
      const card = studiedCard({ interval: 10, repetitions: 3, lapses: 7 }); // lapses + 1 vai dar 8
      const preset = defaultPreset({ leechThreshold: 8, leechAction: 'suspend' });
      const result = calculateNextReview(card, 1, preset);

      expect(result.lapses).toBe(8);
      expect(result.tags).toContain('leech');
      expect(result.suspended).toBe(true);
    });

    it('não adquire tag leech ou suspensão se estiver abaixo do threshold', () => {
      const card = studiedCard({ interval: 10, repetitions: 3, lapses: 5 }); // lapses + 1 vai dar 6 < 8
      const preset = defaultPreset({ leechThreshold: 8, leechAction: 'suspend' });
      const result = calculateNextReview(card, 1, preset);

      expect(result.lapses).toBe(6);
      expect(result.tags).toBeUndefined();
      expect(result.suspended).toBeUndefined();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// Testes de Distância e Diff de Texto (Levenshtein & LCS)
// ═════════════════════════════════════════════════════════════════════

describe('Distância de Texto e LCS Diff', () => {
  describe('getLevenshteinDistance', () => {
    it('retorna 0 para strings idênticas', () => {
      expect(getLevenshteinDistance('apple', 'apple')).toBe(0);
    });

    it('detecta substituição de 1 caractere', () => {
      expect(getLevenshteinDistance('apple', 'aple')).toBe(1); // remoção
      expect(getLevenshteinDistance('apple', 'apPle')).toBe(1); // substituição case-sensitive ou insertion/deletion
      expect(getLevenshteinDistance('table', 'tabel')).toBe(2); // duas substituições/transposições
    });

    it('detecta inserções e deleções', () => {
      expect(getLevenshteinDistance('cat', 'cats')).toBe(1);
      expect(getLevenshteinDistance('cats', 'cat')).toBe(1);
    });
  });

  describe('getWordLevenshteinDistance', () => {
    it('retorna 0 para listas de palavras idênticas', () => {
      expect(getWordLevenshteinDistance(['how', 'are', 'you'], ['how', 'are', 'you'])).toBe(0);
    });

    it('detecta substituição de palavra', () => {
      expect(getWordLevenshteinDistance(['how', 'are', 'you'], ['how', 'old', 'you'])).toBe(1);
    });

    it('detecta inserção/deleção de palavra', () => {
      expect(getWordLevenshteinDistance(['how', 'are', 'you'], ['how', 'old', 'are', 'you'])).toBe(1);
    });
  });

  describe('diffStrings', () => {
    it('alinha strings com letras corretas, incorretas e faltantes', () => {
      const result = diffStrings('aple', 'apple');
      // Esperado:
      // a (correct), p (missing), p (correct), l (correct), e (correct) ou similar dependendo do dp
      expect(result).toHaveLength(5);
      expect(result.filter(r => r.type === 'correct')).toHaveLength(4);
      expect(result.filter(r => r.type === 'missing')).toHaveLength(1);
    });

    it('alinha strings com letras extras', () => {
      const result = diffStrings('appple', 'apple');
      expect(result).toHaveLength(6);
      expect(result.filter(r => r.type === 'correct')).toHaveLength(5);
      expect(result.filter(r => r.type === 'incorrect')).toHaveLength(1);
    });
  });

  describe('diffWords', () => {
    it('alinha frases com palavras corretas, extras e faltantes', () => {
      const result = diffWords('how you today', 'how are you today');
      expect(result).toHaveLength(4);
      expect(result.filter(r => r.type === 'correct')).toHaveLength(3);
      expect(result.filter(r => r.type === 'missing')).toHaveLength(1);
      expect(result.find(r => r.type === 'missing')?.word).toBe('are');
    });

    it('alinha frases com palavras a mais', () => {
      const result = diffWords('how old are you today', 'how are you today');
      expect(result).toHaveLength(5);
      expect(result.filter(r => r.type === 'correct')).toHaveLength(4);
      expect(result.filter(r => r.type === 'incorrect')).toHaveLength(1);
      expect(result.find(r => r.type === 'incorrect')?.word).toBe('old');
    });
  });
});
