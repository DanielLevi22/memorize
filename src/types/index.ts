export interface Deck {
  id: string; // UUID
  name: string;
  description: string;
  createdAt: number; // timestamp MS
  updatedAt: number; // timestamp MS
}

export interface Card {
  id: string; // UUID
  deckId: string; // ID do Deck correspondente
  front: string; // Termo/Pergunta em inglês
  back: string; // Tradução/Resposta
  context: string; // Exemplo em contexto
  audio?: Blob; // Áudio de pronúncia opcional
  
  // SRS (Spaced Repetition System) Fields
  interval: number; // Intervalo atual em dias (0 = novo/não estudado)
  ease: number; // Fator de facilidade (Ease Factor, padrão = 2.5)
  repetitions: number; // Contagem de repetições acertadas consecutivas
  lapses: number; // Contagem de falhas (Erros)
  dueDate: string; // Data da próxima revisão no formato "YYYY-MM-DD"

  // FSRS (Free Spaced Repetition Scheduler) Fields
  difficulty?: number; // D (dificuldade) no FSRS, de 1 a 10
  stability?: number;  // S (estabilidade) no FSRS, em dias
  lastReview?: number; // timestamp MS da última revisão realizada
  
  // Organização e Categorização
  tags?: string[]; // Etiquetas/Tags do cartão
  
  createdAt: number;
  updatedAt: number;
}

export interface Revision {
  id: string;
  cardId: string;
  timestamp: number; // quando a revisão ocorreu
  rating: number; // Nota dada pelo usuário (1 = Errei, 2 = Difícil, 3 = Fácil)
  ease: number; // Fator de facilidade do cartão após essa revisão
  interval: number; // Novo intervalo do cartão após essa revisão
}

export interface Streak {
  currentStreak: number;
  lastStudyDate: string; // "YYYY-MM-DD"
  history: string[]; // lista de datas estudadas ["2026-05-23", "2026-05-24"]
}
