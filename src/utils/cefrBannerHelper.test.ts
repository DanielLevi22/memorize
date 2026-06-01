import { describe, it, expect } from 'vitest';
import { getBannerStatus } from './cefrBannerHelper';

describe('cefrBannerHelper: Determinação de Status do Banner', () => {
  it('deve retornar status "completed" se o usuário estudou os cartões e minutos da meta diária', () => {
    // Meta para B2 (4000 cards / 600h) em 100 dias = 40 cards/dia e 360 min/dia
    // Usuário estudou 45 cards e 360 minutos hoje
    const result = getBannerStatus(0, 'A1', 'B2', 100, 0, 45, 360);

    expect(result.status).toBe('completed');
    expect(result.isCompleted).toBe(true);
    expect(result.message).toContain('Metas diárias CEFR de hoje batidas');
  });

  it('deve retornar status "overloaded" se a meta diária calculada ultrapassa os limites saudáveis', () => {
    // Aluno iniciante total quer B2 (4000 cards) em 10 dias. Meta diária = 400 cards/dia (overload!)
    const result = getBannerStatus(0, 'A1', 'B2', 10, 0, 0, 0);

    expect(result.status).toBe('overloaded');
    expect(result.message).toContain('Meta extremamente agressiva');
  });

  it('deve retornar status "delayed" se a meta diária aumentou em relação à meta inicial devido a atraso', () => {
    // Meta inicial A1 para A2 (1000 cards / 200h) em 300 dias = 4 cards/dia e 40 min/dia
    // Se passaram 150 dias e o usuário estudou ZERO cards. Nova meta = 1000 / 150 = 7 cards/dia e 80 min/dia (sem overload!)
    const result = getBannerStatus(0, 'A1', 'A2', 300, 150, 0, 0);

    expect(result.status).toBe('delayed');
    expect(result.isDelayed).toBe(true);
    expect(result.message).toContain('Você está um pouco atrás do cronograma');
  });

  it('deve retornar status "normal" se o usuário está no cronograma saudável mas ainda não completou os estudos de hoje', () => {
    // Meta saudável A1 para A2 em 300 dias. Usuário tem 250 cards estudados.
    // Meta diária atual = 3 cards/dia e 36 min/dia. Usuário estudou 2 cards hoje
    const result = getBannerStatus(250, 'A1', 'A2', 300, 50, 2, 5);

    expect(result.status).toBe('normal');
    expect(result.isCompleted).toBe(false);
    expect(result.message).toContain('Continue estudando diariamente');
  });
});
