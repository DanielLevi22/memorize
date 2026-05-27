import type { Card, DeckPreset } from '../types';

// FSRS v4 default parameters
const FSRS_W = [
  0.4, 0.6, 2.4, 5.8,      // w[0]-w[3]: initial stability for grades 1, 2, 3, 4
  4.93, 0.94, 0.86, 0.01,  // w[4]-w[7]: difficulty parameters
  1.49, 0.14, 0.94,        // w[8]-w[10]: successful recall stability parameters
  2.18, 0.05, 0.34, 1.26,  // w[11]-w[14]: forgetting stability parameters
  0.29, 2.61               // w[15]-w[16]: scaling parameters
];

/**
 * Calcula o agendamento de revisão baseado no algoritmo FSRS v4.
 */
export function calculateFSRSReview(card: Card, rating: number, preset?: DeckPreset): {
  interval: number;
  ease: number;
  repetitions: number;
  lapses: number;
  dueDate: string;
  difficulty: number;
  stability: number;
  lastReview: number;
} {
  // Mapeamento: 1 (Errei) -> 1 (Again), 2 (Difícil) -> 2 (Hard), 3 (Bom) -> 3 (Good), 4 (Fácil) -> 4 (Easy)
  const g = Math.max(1, Math.min(4, Math.round(rating)));
  
  let difficulty = card.difficulty;
  let stability = card.stability;
  let lastReview = card.lastReview;
  let { repetitions, lapses } = card;

  const nowMs = Date.now();
  const isFirstReview = difficulty === undefined || stability === undefined || lastReview === undefined;

  let nextDifficulty = 5;
  let nextStability = 1;

  if (isFirstReview) {
    // --- PRIMEIRA REVISÃO (CARD NOVO) ---
    nextStability = FSRS_W[g - 1];
    nextDifficulty = FSRS_W[4] - FSRS_W[5] * (g - 3);
    nextDifficulty = Math.max(1, Math.min(10, nextDifficulty));
    
    if (g === 1) {
      repetitions = 0;
      lapses += 1;
    } else {
      repetitions = 1;
    }
  } else {
    // --- REVISÕES SEGUINTES ---
    const elapsedMs = Math.max(0, nowMs - lastReview);
    const t = elapsedMs / (24 * 60 * 60 * 1000); // tempo decorrido em dias

    // Calcular probabilidade de recall R
    const R = Math.pow(0.9, t / stability);

    // Atualizar Dificuldade
    const diffDelta = -FSRS_W[6] * (g - 3);
    const initialDiff = FSRS_W[4] - FSRS_W[5] * (g - 3);
    nextDifficulty = difficulty + diffDelta;
    // Mean reversion
    nextDifficulty = FSRS_W[7] * initialDiff + (1 - FSRS_W[7]) * nextDifficulty;
    nextDifficulty = Math.max(1, Math.min(10, nextDifficulty));

    // Atualizar Estabilidade
    if (g > 1) {
      // Recall bem-sucedido
      const hardnessFactor = g === 2 ? FSRS_W[15] : 1;
      const baseStab = 1 + Math.exp(FSRS_W[8]) * (11 - nextDifficulty) * Math.pow(stability, -FSRS_W[9]) * (Math.exp(FSRS_W[10] * (1 - R)) - 1) * hardnessFactor;
      nextStability = stability * baseStab;
      repetitions += 1;
    } else {
      // Falha de recall (forgetting)
      const baseStab = FSRS_W[11] * Math.pow(nextDifficulty, -FSRS_W[12]) * (Math.pow(stability + 1, FSRS_W[13]) - 1) * Math.exp(FSRS_W[14] * (1 - R));
      nextStability = Math.max(0.1, baseStab);
      repetitions = 0;
      lapses += 1;
    }
  }

  // Modificador de intervalo geral
  if (preset) {
    nextStability = nextStability * preset.intervalModifier;
  }

  nextStability = Math.max(0.1, Math.min(36500, nextStability));
  let nextInterval = Math.max(1, Math.round(nextStability));

  // Limitar ao intervalo máximo
  if (preset) {
    nextInterval = Math.min(preset.maxInterval, nextInterval);
  }

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + nextInterval);
  const dueDateStr = nextDueDate.toISOString().split('T')[0];

  return {
    interval: nextInterval,
    ease: card.ease || 2.5,
    repetitions,
    lapses,
    dueDate: dueDateStr,
    difficulty: nextDifficulty,
    stability: nextStability,
    lastReview: nowMs
  };
}

/**
 * Calcula o próximo agendamento do cartão usando uma adaptação simplificada do algoritmo SM-2 ou FSRS v4.
 * Dependendo de qual está ativo no localStorage ou no preset.
 */
export function calculateNextReview(card: Card, rating: number, preset?: DeckPreset): {
  interval: number;
  ease: number;
  repetitions: number;
  lapses: number;
  dueDate: string;
  difficulty?: number;
  stability?: number;
  lastReview?: number;
  learningStep?: number;
  lapseInterval?: number;
  suspended?: boolean;
  tags?: string[];
} {
  const selectedAlgo = preset 
    ? (preset.fsrsEnabled ? 'FSRS' : 'SM-2')
    : (typeof window !== 'undefined' ? (localStorage.getItem('memorize_algo') || 'SM-2') : 'SM-2');
    
  if (selectedAlgo === 'FSRS') {
    const fsrsResult = calculateFSRSReview(card, rating, preset);
    if (preset && rating === 1 && card.interval > 0) {
      const nextLapses = card.lapses + 1;
      if (nextLapses >= preset.leechThreshold) {
        const currentTags = card.tags || [];
        const nextTags = currentTags.includes('leech') ? undefined : [...currentTags, 'leech'];
        const nextSuspended = preset.leechAction === 'suspend' ? true : undefined;
        return {
          ...fsrsResult,
          ...(nextTags !== undefined ? { tags: nextTags } : {}),
          ...(nextSuspended !== undefined ? { suspended: nextSuspended } : {})
        };
      }
    }
    return fsrsResult;
  }

  // --- INICIALIZAÇÃO DE VARIÁVEIS DE SANGUESSUGA ---
  let nextTags: string[] | undefined = undefined;
  let nextSuspended: boolean | undefined = undefined;

  if (preset && rating === 1 && card.interval > 0) {
    const nextLapses = card.lapses + 1;
    if (nextLapses >= preset.leechThreshold) {
      const currentTags = card.tags || [];
      if (!currentTags.includes('leech')) {
        nextTags = [...currentTags, 'leech'];
      }
      if (preset.leechAction === 'suspend') {
        nextSuspended = true;
      }
    }
  }

  // --- CONTROLE DE PASSOS DE APRENDIZADO INTRA-DIA (ANKI STYLE) ---
  const isLearning = card.interval === 0 || card.learningStep !== undefined;

  if (isLearning && preset) {
    const isRelearning = card.lapseInterval !== undefined;
    const stepsStr = isRelearning
      ? (preset.relearningSteps !== undefined ? preset.relearningSteps.trim() : '10m')
      : (preset.learningSteps !== undefined ? preset.learningSteps.trim() : '1m 10m');
    const steps = stepsStr.split(/\s+/).filter(Boolean);

    if (steps.length > 0) {
      const currentStep = card.learningStep !== undefined ? card.learningStep : 0;
      let nextLearningStep: number | undefined = currentStep;
      let nextInterval = 0;
      let nextRepetitions = card.repetitions;
      let nextLapses = card.lapses;
      let nextLapseInterval = card.lapseInterval;

      if (rating === 1) {
        // Errei (Again): Volta para o primeiro passo
        nextLearningStep = 0;
        nextInterval = 0;
        nextRepetitions = 0;
        nextLapses += 1;
      } else if (rating === 2) {
        // Difícil (Hard): Permanece no passo atual (Anki style)
        nextLearningStep = currentStep;
        nextInterval = 0;
        nextRepetitions = 0;
      } else if (rating === 3) {
        // Bom (Good): Avança de passo
        const nextStep = currentStep + 1;
        if (nextStep < steps.length) {
          nextLearningStep = nextStep;
          nextInterval = 0;
          nextRepetitions = 0;
        } else {
          // Gradua!
          nextLearningStep = undefined;
          if (card.lapseInterval !== undefined) {
            nextInterval = card.lapseInterval;
          } else {
            nextInterval = preset.graduatingInterval;
          }
          nextRepetitions = 1;
          nextLapseInterval = undefined;
        }
      } else {
        // Fácil (Easy) - rating 4: Gradua imediatamente
        nextLearningStep = undefined;
        nextInterval = preset.easyInterval;
        nextRepetitions = 1;
        nextLapseInterval = undefined;
      }

      const nextDueDate = new Date();
      if (nextInterval > 0) {
        nextDueDate.setDate(nextDueDate.getDate() + nextInterval);
      }
      const dueDateStr = nextDueDate.toISOString().split('T')[0];

      return {
        interval: nextInterval,
        ease: card.ease || preset.startingEase || 2.5,
        repetitions: nextRepetitions,
        lapses: nextLapses,
        dueDate: dueDateStr,
        learningStep: nextLearningStep,
        lapseInterval: nextLapseInterval,
        ...(nextTags !== undefined ? { tags: nextTags } : {}),
        ...(nextSuspended !== undefined ? { suspended: nextSuspended } : {})
      };
    }
  }

  // --- RECONTAGEM DE FALHAS DE CARTÕES DE REVISÃO (RELEARNING) ---
  if (rating === 1 && preset && card.interval > 0) {
    const relearningStepsStr = preset.relearningSteps !== undefined ? preset.relearningSteps.trim() : '10m';
    const relearningSteps = relearningStepsStr.split(/\s+/).filter(Boolean);

    const lapseMult = preset.lapseMultiplier;
    const minInt = preset.minimumInterval;
    const nextLapseInt = Math.max(minInt, Math.round(card.interval * lapseMult));

    if (relearningSteps.length > 0) {
      // Entra em reaprendizagem
      const nextDueDate = new Date();
      const dueDateStr = nextDueDate.toISOString().split('T')[0];
      return {
        interval: 0,
        ease: Math.max(1.3, (card.ease || preset.startingEase || 2.5) - 0.2),
        repetitions: 0,
        lapses: card.lapses + 1,
        dueDate: dueDateStr,
        learningStep: 0, // Primeiro passo
        lapseInterval: nextLapseInt,
        ...(nextTags !== undefined ? { tags: nextTags } : {}),
        ...(nextSuspended !== undefined ? { suspended: nextSuspended } : {})
      };
    } else {
      // Sem passos de reaprendizagem, agenda direto para os dias calculados
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + nextLapseInt);
      const dueDateStr = nextDueDate.toISOString().split('T')[0];
      return {
        interval: nextLapseInt,
        ease: Math.max(1.3, (card.ease || preset.startingEase || 2.5) - 0.2),
        repetitions: 0,
        lapses: card.lapses + 1,
        dueDate: dueDateStr,
        learningStep: undefined,
        lapseInterval: undefined,
        ...(nextTags !== undefined ? { tags: nextTags } : {}),
        ...(nextSuspended !== undefined ? { suspended: nextSuspended } : {})
      };
    }
  }

  // --- ALGORITMO SM-2 CLÁSSICO PARA REVISÃO GERAL ---
  let { interval, ease, repetitions, lapses } = card;
  const minEase = 1.3;
  const startingEase = preset ? preset.startingEase : 2.5;

  if (!ease || ease < minEase) {
    ease = startingEase;
  }

  if (rating === 1) {
    repetitions = 0;
    lapses += 1;
    ease = Math.max(minEase, ease - 0.2);
    
    const lapseMult = preset ? preset.lapseMultiplier : 0.5;
    const minInt = preset ? preset.minimumInterval : 1;
    interval = Math.max(minInt, Math.round(interval * lapseMult));
    if (isNaN(interval) || interval < minInt) {
      interval = minInt;
    }
  } else if (rating === 2) {
    // Difícil (Hard)
    repetitions = repetitions === 0 ? 1 : repetitions;
    ease = Math.max(minEase, ease - 0.15);
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 3;
    } else {
      const hardMultiplier = preset ? preset.hardInterval : 1.2;
      interval = Math.max(2, Math.round(interval * hardMultiplier));
    }
  } else if (rating === 3) {
    // Bom (Good)
    repetitions += 1;
    ease = ease + 0.15;
    if (repetitions === 1) {
      interval = preset ? preset.graduatingInterval : 1;
    } else if (repetitions === 2) {
      interval = preset ? preset.easyInterval : 4;
    } else {
      interval = Math.max(6, Math.round(interval * ease));
    }
  } else {
    // Fácil (Easy) — rating 4
    repetitions += 1;
    ease = ease + 0.15;
    if (repetitions <= 2) {
      interval = preset ? preset.easyInterval : 4;
    } else {
      const easyBonus = preset ? preset.easyBonus : 1.3;
      interval = Math.max(6, Math.round(interval * ease * easyBonus));
    }
  }

  // Modificador de intervalo geral
  if (preset) {
    interval = Math.round(interval * preset.intervalModifier);
  }

  // Limitar ao intervalo máximo
  if (preset) {
    interval = Math.min(preset.maxInterval, interval);
  }

  interval = Math.max(1, interval);

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + interval);
  const dueDateStr = nextDueDate.toISOString().split('T')[0];

  return {
    interval,
    ease,
    repetitions,
    lapses,
    dueDate: dueDateStr,
    ...(nextTags !== undefined ? { tags: nextTags } : {}),
    ...(nextSuspended !== undefined ? { suspended: nextSuspended } : {})
  };
}

/**
 * Retorna o rótulo de tempo estimado do próximo intervalo formatado para a UI do botão.
 */
export function getFriendlyInterval(card: Card, rating: number, preset?: DeckPreset): string {
  const next = calculateNextReview(card, rating, preset);
  
  // Se for aprendizado intra-dia (intervalo = 0)
  if (next.interval === 0) {
    if (preset) {
      const isRelearning = next.lapseInterval !== undefined;
      const stepsStr = isRelearning
        ? (preset.relearningSteps || '10m')
        : (preset.learningSteps || '1m 10m');
      const steps = stepsStr.split(/\s+/).filter(Boolean);
      const stepIdx = next.learningStep !== undefined ? next.learningStep : 0;
      return steps[Math.min(stepIdx, steps.length - 1)] || '1m';
    }
    return '1m';
  }

  const days = next.interval;
  if (days <= 1) return 'Amanhã';
  if (days < 30) return `${days}d`;
  
  const months = Math.round(days / 30);
  return `${months}m`;
}

export interface DiffChar {
  char: string;
  type: 'correct' | 'incorrect' | 'missing';
}

export interface DiffWord {
  word: string;
  type: 'correct' | 'incorrect' | 'missing';
}

/**
 * Calcula a distância de Levenshtein entre duas strings de caracteres.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calcula a distância de Levenshtein entre duas listas de palavras.
 */
export function getWordLevenshteinDistance(a: string[], b: string[]): number {
  const clean = (s: string) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").toLowerCase().trim();
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (clean(b[i - 1]) === clean(a[j - 1])) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Realiza um diff de caracteres usando Longest Common Subsequence (LCS).
 */
export function diffStrings(typed: string, expected: string): DiffChar[] {
  const m = typed.length;
  const n = expected.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (typed[i - 1].toLowerCase() === expected[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffChar[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && typed[i - 1].toLowerCase() === expected[j - 1].toLowerCase()) {
      diff.unshift({ char: expected[j - 1], type: 'correct' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ char: expected[j - 1], type: 'missing' });
      j--;
    } else {
      diff.unshift({ char: typed[i - 1], type: 'incorrect' });
      i--;
    }
  }

  return diff;
}

/**
 * Realiza um diff de palavras usando Longest Common Subsequence (LCS).
 */
export function diffWords(spoken: string, expected: string): DiffWord[] {
  const clean = (s: string) => s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").toLowerCase().trim();
  const spokenWords = spoken.split(/\s+/).filter(Boolean);
  const expectedWords = expected.split(/\s+/).filter(Boolean);

  const m = spokenWords.length;
  const n = expectedWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (clean(spokenWords[i - 1]) === clean(expectedWords[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffWord[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && clean(spokenWords[i - 1]) === clean(expectedWords[j - 1])) {
      diff.unshift({ word: expectedWords[j - 1], type: 'correct' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ word: expectedWords[j - 1], type: 'missing' });
      j--;
    } else {
      diff.unshift({ word: spokenWords[i - 1], type: 'incorrect' });
      i--;
    }
  }

  return diff;
}
