import Dexie, { type Table } from 'dexie';
import type { Deck, Card, Revision, DeckPreset, ReadingText, ReadingSession, ReadingCollection } from '../types';

class MemorizeDatabase extends Dexie {
  decks!: Table<Deck>;
  cards!: Table<Card>;
  revisions!: Table<Revision>;
  presets!: Table<DeckPreset>;
  readings!: Table<ReadingText>;
  readingSessions!: Table<ReadingSession>;
  readingCollections!: Table<ReadingCollection>;

  constructor() {
    super('MemorizeDatabase');
    
    // Define o schema do banco de dados local
    // Nota: Apenas os campos indexados precisam ser definidos aqui. 
    // Campos não indexados ainda podem ser armazenados nos objetos normalmente.
    this.version(1).stores({
      decks: 'id, name, createdAt, updatedAt',
      cards: 'id, deckId, dueDate, [deckId+dueDate], createdAt, updatedAt',
      revisions: 'id, cardId, timestamp'
    });

    this.version(2).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name'
    });

    this.version(3).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt'
    });

    this.version(4).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt',
      readingSessions: 'id, readingId, timestamp'
    });

    this.version(5).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt, collectionId',
      readingSessions: 'id, readingId, timestamp',
      readingCollections: 'id, title, createdAt'
    });
  }
}

export const db = new MemorizeDatabase();

// --- FUNÇÕES AUXILIARES DE INICIALIZAÇÃO DE DADOS MOCK ---
// Útil para o primeiro carregamento, dando uma boa experiência ao usuário
export async function seedInitialData() {
  const deckCount = await db.decks.count();
  if (deckCount > 0) return; // Se já existirem dados, não faz o seed

  const defaultDeckId = 'essential-phrasal-verbs';
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Criar Deck Padrão
  await db.decks.add({
    id: defaultDeckId,
    name: '📚 Essential Phrasal Verbs',
    description: 'Os phrasal verbs mais comuns do inglês com contexto real e prático.',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  // 2. Criar Cards Iniciais (com dueDate configurado para hoje)
  const initialCards: Card[] = [
    {
      id: 'card-1',
      deckId: defaultDeckId,
      front: 'Go on',
      back: 'Continuar / Acontecer',
      context: 'Please go on speaking, I am listening.',
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      dueDate: todayStr,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'card-2',
      deckId: defaultDeckId,
      front: 'Give up',
      back: 'Desistir / Entregar',
      context: 'Never give up on your dreams.',
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      dueDate: todayStr,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'card-3',
      deckId: defaultDeckId,
      front: 'Look after',
      back: 'Cuidar de',
      context: 'Who will look after the dog while you are away?',
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      dueDate: todayStr,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'card-4',
      deckId: defaultDeckId,
      front: 'Bring up',
      back: 'Mencionar um assunto / Criar filhos',
      context: 'Do not bring up that subject during the meeting.',
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      dueDate: todayStr,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  await db.cards.bulkAdd(initialCards);
  console.log('Seed de dados iniciais do Memorize executado com sucesso.');
}

export const DEFAULT_PRESET_ID = 'default-study-preset';

export const defaultPreset: DeckPreset = {
  id: DEFAULT_PRESET_ID,
  name: 'Padrão',
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  newCardsIgnoreReviewLimit: false,
  limitsStartFromParent: false,
  learningSteps: '1m 10m',
  graduatingInterval: 1,
  easyInterval: 4,
  insertionOrder: 'sequential',
  relearningSteps: '10m',
  minimumInterval: 1,
  leechThreshold: 8,
  leechAction: 'tag',
  newCardGrouping: 'deck',
  newCardSorting: 'template',
  newVsReviewOrder: 'mix',
  interdayLearningVsReviewOrder: 'mix',
  reviewSorting: 'dateThenRandom',
  buryNewSiblings: false,
  buryReviewSiblings: false,
  buryLearningSiblings: false,
  disableAutoplay: false,
  skipQuestionOnReplay: false,
  maxAnswerSeconds: 60,
  showTimer: false,
  stopTimerOnAnswer: false,
  autoShowAnswerSeconds: 0,
  autoShowQuestionSeconds: 0,
  waitForAudio: true,
  questionAction: 'showAnswer',
  answerAction: 'skip',
  daysOffMultiplier: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  fsrsEnabled: false,
  maxInterval: 36500,
  startingEase: 2.50,
  easyBonus: 1.30,
  intervalModifier: 1.00,
  hardInterval: 1.20,
  lapseMultiplier: 0.50,
  customScheduling: ''
};

export async function ensureDefaultPreset() {
  const count = await db.presets.count();
  if (count === 0) {
    await db.presets.add(defaultPreset);
    console.log('Preset padrão criado com sucesso.');
  }
}

