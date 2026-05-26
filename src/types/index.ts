export interface Deck {
  id: string; // UUID
  name: string;
  description: string;
  presetId?: string; // ID do preset de configurações associado
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

export interface DeckPreset {
  id: string; // UUID
  name: string; // Nome da configuração
  
  // Limites Diários
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  newCardsIgnoreReviewLimit: boolean;
  limitsStartFromParent: boolean;

  // Novos Cartões
  learningSteps: string; // ex: "1m 10m"
  graduatingInterval: number;
  easyInterval: number;
  insertionOrder: 'sequential' | 'random';

  // Falhas
  relearningSteps: string; // ex: "10m"
  minimumInterval: number;
  leechThreshold: number;
  leechAction: 'tag' | 'suspend';

  // Ordem de Exibição
  newCardGrouping: 'deck' | 'cardType';
  newCardSorting: 'template' | 'random';
  newVsReviewOrder: 'mix' | 'newFirst' | 'reviewFirst';
  interdayLearningVsReviewOrder: 'mix' | 'learningFirst' | 'reviewFirst';
  reviewSorting: 'dateThenRandom' | 'random';

  // Ocultar
  buryNewSiblings: boolean;
  buryReviewSiblings: boolean;
  buryLearningSiblings: boolean;

  // Áudio
  disableAutoplay: boolean;
  skipQuestionOnReplay: boolean;

  // Cronômetro
  maxAnswerSeconds: number;
  showTimer: boolean;
  stopTimerOnAnswer: boolean;

  // Avanço Automático
  autoShowAnswerSeconds: number; // 0 = desabilitado
  autoShowQuestionSeconds: number; // 0 = desabilitado
  waitForAudio: boolean;
  questionAction: 'showAnswer' | 'bury';
  answerAction: 'bury' | 'skip';

  // Dias de Descanso
  daysOffMultiplier: number[]; // 7 multiplicadores (seg a dom) entre 0.0 e 1.0

  // FSRS
  fsrsEnabled: boolean;

  // Avançado
  maxInterval: number;
  startingEase: number;
  easyBonus: number;
  intervalModifier: number;
  hardInterval: number;
  lapseMultiplier: number;
  customScheduling: string;
}

/** Um texto/lição de leitura importado */
export interface ReadingText {
  id: string;                   // UUID
  title: string;                // Título do texto
  fullTextOriginal: string;     // Texto completo no idioma original
  fullTextTranslated: string;   // Texto completo traduzido
  rawPdfText?: string;          // Texto bruto original do PDF (inclui notas, explicações e formatação original)
  pdfFile?: Blob;               // O arquivo PDF bruto salvo no IndexedDB
  lines: ReadingLine[];         // Frases separadas (array inline)
  lastLineIndex?: number;       // Última linha lida/ativa (para auto-bookmark)
  collectionId?: string;        // ID da coleção/pasta à qual o texto pertence
  createdAt: number;            // timestamp MS
  updatedAt: number;            // timestamp MS
}

/** Coleção / Pasta de leituras agrupadas */
export interface ReadingCollection {
  id: string;                   // UUID
  title: string;                // Título da coleção (ex: Livro Jack Hannaford)
  description?: string;         // Descrição opcional
  createdAt: number;            // timestamp MS
  updatedAt: number;            // timestamp MS
}

/** Uma linha/frase individual dentro de um ReadingText */
export interface ReadingLine {
  id?: string;                  // Opcional ID único para animações e chaves React
  original: string;             // Frase no idioma original
  translated: string;           // Tradução da frase
  highlights: string[];         // Palavras-chave para destacar (no texto original)
  mastered: boolean;            // Se o usuário marcou como dominada ✅
}

/** Uma sessão de leitura de texto para telemetria e estatísticas */
export interface ReadingSession {
  id: string;                   // UUID
  readingId: string;            // ID do texto lido
  timestamp: number;            // Quando a sessão encerrou (timestamp MS)
  duration: number;             // Tempo lido em segundos
  wordsRead: number;            // Quantidade de palavras lidas
  sentencesMastered: number;     // Saldo de frases dominadas (+1 ou -1)
}
