import { describe, it, expect } from 'vitest';
import { calculateDailyRequirements, recalculateSchedule } from './cefrJourney';

describe('cefrJourney: Core Matemático da Jornada CEFR', () => {
  it('deve calcular corretamente para iniciante total rumo ao B2 (4000 cards / 600h em 180 dias - carga horária elevada)', () => {
    const result = calculateDailyRequirements(0, 'A1', 'B2', 180);

    expect(result.remainingCards).toBe(4000);
    expect(result.dailyCardsTarget).toBe(23); // ceil(4000 / 180) = 23
    expect(result.remainingHours).toBe(600);
    expect(result.dailyMinutesTarget).toBe(200); // ceil((600 * 60) / 180) = 200 min/dia
    expect(result.isOverloaded).toBe(true);
    expect(result.warningMessage).toContain('Carga horária diária elevada');
  });

  it('deve disparar alerta de meta extremamente agressiva com prazos curtos', () => {
    const result = calculateDailyRequirements(0, 'A1', 'B2', 60);

    expect(result.isOverloaded).toBe(true);
    expect(result.warningMessage).toContain('Meta extremamente agressiva');
  });

  it('deve calcular corretamente com progresso existente (A2 para B1 em 90 dias)', () => {
    // Usuário já tem 800 cards. Partida de A2 (especificações: 1000 cards / 200h)
    // Horas estimadas atuais: 200h * (800 / 1000) = 160h
    // Alvo B1 (2000 cards / 400h)
    // Horas restantes: 400 - 160 = 240h
    // Minutos diários: ceil((240 * 60) / 90) = 160 min/dia
    const result = calculateDailyRequirements(800, 'A2', 'B1', 90);

    expect(result.remainingCards).toBe(1200); // 2000 - 800 = 1200
    expect(result.dailyCardsTarget).toBe(14); // ceil(1200 / 90) = 14
    expect(result.remainingHours).toBe(240);
    expect(result.dailyMinutesTarget).toBe(160);
  });

  it('deve recalcular cronograma com dias decorridos', () => {
    // Meta original de 100 dias, passaram-se 20 dias (restam 80 dias)
    // A1 para A2 (1000 cards / 200h)
    // Inicialmente restam 1000 cards
    const result = recalculateSchedule(0, 'A1', 'A2', 100, 20);

    expect(result.remainingCards).toBe(1000);
    expect(result.dailyCardsTarget).toBe(13); // ceil(1000 / 80) = 13
  });

  it('não deve disparar alerta de sobrecarga para metas realistas', () => {
    // 200 cards restantes para o A1 (500 cards) em 50 dias
    const result = calculateDailyRequirements(300, 'A1', 'A1', 50);

    expect(result.isOverloaded).toBe(false);
    expect(result.warningMessage).toBeUndefined();
  });
});
