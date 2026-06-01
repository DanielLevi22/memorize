export type CefrLevelCode = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface CefrTargetGoal {
  vocabGoal: number;
  hoursGoal: number;
}

export const cefrLevelSpecs: Record<CefrLevelCode, CefrTargetGoal> = {
  A1: { vocabGoal: 500, hoursGoal: 100 },
  A2: { vocabGoal: 1000, hoursGoal: 200 },
  B1: { vocabGoal: 2000, hoursGoal: 400 },
  B2: { vocabGoal: 4000, hoursGoal: 600 },
  C1: { vocabGoal: 8000, hoursGoal: 800 },
  C2: { vocabGoal: 12000, hoursGoal: 1100 }
};

export interface JourneyRequirements {
  remainingCards: number;
  remainingHours: number;
  dailyCardsTarget: number;
  dailyMinutesTarget: number;
  isOverloaded: boolean;
  warningMessage?: string;
}

/**
 * Calcula os requisitos de esforço diário para a jornada CEFR.
 * 
 * @param currentCards Total de cartões ativos/estudados atualmente
 * @param startLevel Nível CEFR de partida
 * @param targetLevel Nível CEFR alvo
 * @param remainingDays Prazo restante em dias
 */
export function calculateDailyRequirements(
  currentCards: number,
  startLevel: CefrLevelCode,
  targetLevel: CefrLevelCode,
  remainingDays: number
): JourneyRequirements {
  const days = Math.max(1, remainingDays);
  
  const startSpec = cefrLevelSpecs[startLevel];
  const targetSpec = cefrLevelSpecs[targetLevel];

  // 1. Lacuna de vocabulário (cards)
  const remainingCards = Math.max(0, targetSpec.vocabGoal - currentCards);
  const dailyCardsTarget = Math.ceil(remainingCards / days);

  // 2. Progresso de horas atual estimado proporcional ao nível de partida
  let currentHoursEstimated = 0;
  if (currentCards > 0 && startSpec) {
    const ratio = Math.min(1, currentCards / startSpec.vocabGoal);
    currentHoursEstimated = startSpec.hoursGoal * ratio;
  }

  // 3. Lacuna de horas estimadas e minutos diários
  const remainingHours = Math.max(0, targetSpec.hoursGoal - currentHoursEstimated);
  const dailyMinutesTarget = Math.ceil((remainingHours * 60) / days);

  // 4. Detecção de sobrecarga
  const isOverloaded = dailyMinutesTarget > 90 || dailyCardsTarget > 50;
  let warningMessage: string | undefined = undefined;

  if (isOverloaded) {
    if (dailyMinutesTarget > 90 && dailyCardsTarget > 50) {
      warningMessage = 'Meta extremamente agressiva! Requer mais de 90 minutos de estudo e 50 novos cartões por dia. Sugerimos estender o prazo.';
    } else if (dailyMinutesTarget > 90) {
      warningMessage = 'Carga horária diária elevada (mais de 90 min/dia). Considere estender o prazo.';
    } else {
      warningMessage = 'Ritmo de novos cartões elevado (mais de 50 cards/dia). Considere estender o prazo.';
    }
  }

  return {
    remainingCards,
    remainingHours,
    dailyCardsTarget,
    dailyMinutesTarget,
    isOverloaded,
    warningMessage
  };
}

/**
 * Recalcula o cronograma com base nos desvios e dias decorridos.
 * 
 * @param currentCards Total de cartões ativos/estudados atualmente
 * @param startLevel Nível CEFR de partida
 * @param targetLevel Nível CEFR alvo
 * @param totalDays Prazo total inicial da jornada
 * @param daysElapsed Dias que se passaram desde o início da jornada
 */
export function recalculateSchedule(
  currentCards: number,
  startLevel: CefrLevelCode,
  targetLevel: CefrLevelCode,
  totalDays: number,
  daysElapsed: number
): JourneyRequirements {
  const remainingDays = Math.max(1, totalDays - daysElapsed);
  return calculateDailyRequirements(currentCards, startLevel, targetLevel, remainingDays);
}
