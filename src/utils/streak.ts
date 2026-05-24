import type { Streak } from '../types';

const STREAK_KEY = 'memorize_streak_data';

function getLocalDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

/**
 * Carrega os dados de streak do localStorage ou inicializa um novo
 */
export function getStreak(): Streak {
  const data = localStorage.getItem(STREAK_KEY);
  if (!data) {
    return {
      currentStreak: 0,
      lastStudyDate: '',
      history: []
    };
  }

  try {
    const streak: Streak = JSON.parse(data);
    
    // Validar se o streak expirou (se o último estudo foi antes de ontem, o streak quebrou)
    const yesterdayStr = getYesterdayDateString();
    const todayStr = getLocalDateString();
    
    if (
      streak.lastStudyDate && 
      streak.lastStudyDate !== todayStr && 
      streak.lastStudyDate !== yesterdayStr
    ) {
      // Streak quebrado, zera o contador atual mas mantém o histórico
      streak.currentStreak = 0;
      localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    }
    
    return streak;
  } catch (e) {
    return {
      currentStreak: 0,
      lastStudyDate: '',
      history: []
    };
  }
}

/**
 * Registra um estudo para o dia atual e atualiza o streak
 */
export function recordStudy(): Streak {
  const streak = getStreak();
  const todayStr = getLocalDateString();
  const yesterdayStr = getYesterdayDateString();

  // Se já estudou hoje, nada muda
  if (streak.lastStudyDate === todayStr) {
    return streak;
  }

  if (streak.lastStudyDate === yesterdayStr) {
    // Estudou ontem e está estudando hoje: incrementa o streak
    streak.currentStreak += 1;
  } else if (streak.currentStreak === 0 || streak.lastStudyDate !== todayStr) {
    // Primeiro estudo de todos ou quebrou o streak: inicia em 1
    streak.currentStreak = 1;
  }

  streak.lastStudyDate = todayStr;
  
  if (!streak.history.includes(todayStr)) {
    streak.history.push(todayStr);
  }

  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  return streak;
}
