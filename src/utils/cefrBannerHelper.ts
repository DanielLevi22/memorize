import { calculateDailyRequirements, recalculateSchedule, type CefrLevelCode, type JourneyRequirements } from './cefrJourney';

export interface BannerStatus {
  status: 'completed' | 'overloaded' | 'delayed' | 'normal';
  remainingDays: number;
  isCompleted: boolean;
  isDelayed: boolean;
  currentPlan: JourneyRequirements;
  message: string;
}

/**
 * Computa o estado completo e as mensagens do banner de alerta com base no progresso do usuário.
 */
export function getBannerStatus(
  currentCardsCount: number,
  startLevel: CefrLevelCode,
  targetLevel: CefrLevelCode,
  totalDays: number,
  daysElapsed: number,
  cardsStudiedToday: number,
  minutesStudiedToday: number
): BannerStatus {
  const remainingDays = Math.max(0, totalDays - daysElapsed);
  const initial = calculateDailyRequirements(0, startLevel, targetLevel, totalDays);
  const currentPlan = recalculateSchedule(currentCardsCount, startLevel, targetLevel, totalDays, daysElapsed);

  const isDelayed = currentPlan.dailyCardsTarget > initial.dailyCardsTarget || currentPlan.dailyMinutesTarget > initial.dailyMinutesTarget;
  const isCompleted = cardsStudiedToday >= currentPlan.dailyCardsTarget && minutesStudiedToday >= currentPlan.dailyMinutesTarget;

  let status: BannerStatus['status'] = 'normal';
  let message = 'Continue estudando diariamente para atingir sua meta de proficiência no prazo.';

  if (isCompleted) {
    status = 'completed';
    message = '✓ Metas diárias CEFR de hoje batidas! Excelente ritmo de estudo.';
  } else if (currentPlan.isOverloaded) {
    status = 'overloaded';
    message = currentPlan.warningMessage || '';
  } else if (isDelayed) {
    status = 'delayed';
    message = 'Você está um pouco atrás do cronograma. As metas diárias foram ajustadas para compensar.';
  }

  return {
    status,
    remainingDays,
    isCompleted,
    isDelayed,
    currentPlan,
    message
  };
}
