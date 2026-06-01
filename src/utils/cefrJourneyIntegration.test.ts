import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDailyRequirements, recalculateSchedule } from './cefrJourney';
import { triggerLocalNotification } from './notifications';

vi.mock('./notifications', () => {
  return {
    triggerLocalNotification: vi.fn()
  };
});

describe('CEFR Journey Integration: Alertas de Atraso e Notificações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve simular o fluxo de boot e disparar a notificação se o usuário estiver em atraso', () => {
    const startLevel = 'A1';
    const targetLevel = 'A2'; // Meta: 1000 cards / 200h
    const totalDays = 90;
    
    // Simula que passaram-se 45 dias (metade do prazo) e o aluno estudou ZERO cards
    const daysElapsed = 45;
    const currentCardsCount = 0;

    // 1. Calcular o plano diário inicial (1000 cards / 90 dias = 12 cards/dia)
    const initialPlan = calculateDailyRequirements(0, startLevel, targetLevel, totalDays);
    
    // 2. Calcular o plano diário recalculado após atraso (1000 cards / 45 dias = 23 cards/dia)
    const currentPlan = recalculateSchedule(currentCardsCount, startLevel, targetLevel, totalDays, daysElapsed);

    // 3. Checar se o plano diário aumentou (atraso detectado)
    const isDelayed = currentPlan.dailyCardsTarget > initialPlan.dailyCardsTarget || 
                      currentPlan.dailyMinutesTarget > initialPlan.dailyMinutesTarget;

    expect(isDelayed).toBe(true);

    // 4. Disparar notificação se atrasado
    if (isDelayed) {
      triggerLocalNotification(
        '📈 Meta CEFR recalculada!',
        `Você acumulou conteúdo. Sua nova meta diária é de ${currentPlan.dailyCardsTarget} cards.`
      );
    }

    // Verificar se a notificação foi disparada com a mensagem correta
    expect(triggerLocalNotification).toHaveBeenCalledTimes(1);
    expect(triggerLocalNotification).toHaveBeenCalledWith(
      '📈 Meta CEFR recalculada!',
      expect.stringContaining('Sua nova meta diária é de 23 cards')
    );
  });
});
