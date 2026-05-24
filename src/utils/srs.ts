import type { Card } from '../types';

/**
 * Calcula o próximo agendamento do cartão usando uma adaptação simplificada do algoritmo SM-2.
 * Projetado para 3 botões na UI:
 * 1 = Errei (Again)
 * 2 = Difícil (Hard)
 * 3 = Fácil (Easy)
 * 
 * @param card O estado atual do cartão
 * @param rating A nota de revisão dada pelo usuário (1, 2 ou 3)
 * @returns Um objeto contendo os campos atualizados do cartão
 */
export function calculateNextReview(card: Card, rating: number): {
  interval: number;
  ease: number;
  repetitions: number;
  lapses: number;
  dueDate: string;
} {
  let { interval, ease, repetitions, lapses } = card;

  // Valor padrão de facilidade mínima e máxima
  const minEase = 1.3;
  const defaultEase = 2.5;

  if (ease < minEase) ease = defaultEase;

  if (rating === 1) {
    // --- ERREI (AGAIN) ---
    repetitions = 0;
    lapses += 1;
    // Reduz significativamente a facilidade do cartão
    ease = Math.max(minEase, ease - 0.2);
    // Deve ser revisado amanhã (1 dia)
    interval = 1;
  } else if (rating === 2) {
    // --- DIFÍCIL (HARD) ---
    // Estabelece repetições consecutivas caso estivesse zerado, senão mantém
    repetitions = repetitions === 0 ? 1 : repetitions;
    // Reduz ligeiramente a facilidade
    ease = Math.max(minEase, ease - 0.15);
    
    // Cálculo do intervalo com fator moderado
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 3; // Menor que o padrão de acertos fáceis
    } else {
      interval = Math.max(2, Math.round(interval * ease * 0.75));
    }
  } else {
    // --- FÁCIL (EASY) ---
    repetitions += 1;
    // Aumenta a facilidade do cartão (tornando revisões futuras mais espaçadas)
    ease = ease + 0.15;

    // Cálculo do intervalo no SM-2 clássico
    if (repetitions === 1) {
      interval = 1; // 1 dia
    } else if (repetitions === 2) {
      interval = 6; // 6 dias
    } else {
      interval = Math.max(6, Math.round(interval * ease));
    }
  }

  // Calcular a data de vencimento (dueDate) com base no novo intervalo em dias
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + interval);
  const dueDateStr = nextDueDate.toISOString().split('T')[0];

  return {
    interval,
    ease,
    repetitions,
    lapses,
    dueDate: dueDateStr
  };
}

/**
 * Retorna o rótulo de tempo estimado do próximo intervalo formatado para a UI do botão.
 * Útil para dar feedback ao usuário sobre quando o cartão voltará (ex: "Amanhã", "3 dias", "10 dias").
 */
export function getFriendlyInterval(card: Card, rating: number): string {
  const next = calculateNextReview(card, rating);
  const days = next.interval;
  
  if (days <= 1) return 'Amanhã';
  if (days < 30) return `${days}d`;
  
  const months = Math.round(days / 30);
  return `${months}m`;
}
