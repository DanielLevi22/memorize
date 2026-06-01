import Dexie, { type Table } from 'dexie';
import type { Deck, Card, Note, Revision, DeckPreset, ReadingText, ReadingSession, ReadingCollection, ChatMessage, AudioTrack, Playlist, CefrExam, CefrExamAttempt } from '../types';

class MemorizeDatabase extends Dexie {
  decks!: Table<Deck>;
  cards!: Table<Card>;
  notes!: Table<Note>;
  revisions!: Table<Revision>;
  presets!: Table<DeckPreset>;
  readings!: Table<ReadingText>;
  readingSessions!: Table<ReadingSession>;
  readingCollections!: Table<ReadingCollection>;
  chatMessages!: Table<ChatMessage>;
  audioTracks!: Table<AudioTrack>;
  playlists!: Table<Playlist>;
  cefrExams!: Table<CefrExam>;
  cefrExamAttempts!: Table<CefrExamAttempt>;

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

    this.version(6).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], noteId, createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt, collectionId',
      readingSessions: 'id, readingId, timestamp',
      readingCollections: 'id, title, createdAt',
      notes: 'id, deckId, createdAt'
    }).upgrade(async tx => {
      const cards = await tx.table('cards').toArray();
      const notesToInsert: any[] = [];
      const cardsToUpdate: any[] = [];

      for (const card of cards) {
        if (!card.noteId) {
          const noteId = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2, 15);
          
          notesToInsert.push({
            id: noteId,
            deckId: card.deckId,
            type: 'basic',
            fields: [card.front || '', card.back || ''],
            tags: card.tags || [],
            audio: card.audio,
            context: card.context || '',
            createdAt: card.createdAt || Date.now(),
            updatedAt: card.updatedAt || Date.now()
          });

          card.noteId = noteId;
          cardsToUpdate.push(card);
        }
      }

      if (notesToInsert.length > 0) {
        await tx.table('notes').bulkAdd(notesToInsert);
      }
      for (const card of cardsToUpdate) {
        await tx.table('cards').put(card);
      }
    });

    this.version(7).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], noteId, createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt, collectionId',
      readingSessions: 'id, readingId, timestamp',
      readingCollections: 'id, title, createdAt',
      notes: 'id, deckId, createdAt',
      chatMessages: 'id, partnerId, timestamp'
    });

    this.version(8).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], noteId, createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt, collectionId',
      readingSessions: 'id, readingId, timestamp',
      readingCollections: 'id, title, createdAt',
      notes: 'id, deckId, createdAt',
      chatMessages: 'id, partnerId, timestamp',
      audioTracks: 'id, title, createdAt'
    });

    this.version(9).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], noteId, createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt, collectionId',
      readingSessions: 'id, readingId, timestamp',
      readingCollections: 'id, title, createdAt',
      notes: 'id, deckId, createdAt',
      chatMessages: 'id, partnerId, timestamp',
      audioTracks: 'id, playlistId, title, createdAt',
      playlists: 'id, name, createdAt'
    }).upgrade(async tx => {
      // Obter todas as faixas que já existiam antes no banco
      const oldTracks = await tx.table('audioTracks').toArray();
      if (oldTracks.length > 0) {
        const defaultPlaylistId = 'default-audio-playlist';
        
        // Criar uma playlist padrão retroativa
        await tx.table('playlists').add({
          id: defaultPlaylistId,
          name: 'Minha Playlist',
          description: 'Playlist padrão contendo seus áudios anteriores.',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });

        // Vincular todos os áudios anteriores à playlist padrão criada
        for (const track of oldTracks) {
          track.playlistId = defaultPlaylistId;
          await tx.table('audioTracks').put(track);
        }
      }
    });

    this.version(10).stores({
      decks: 'id, name, createdAt, updatedAt, presetId',
      cards: 'id, deckId, dueDate, [deckId+dueDate], noteId, createdAt, updatedAt',
      revisions: 'id, cardId, timestamp',
      presets: 'id, name',
      readings: 'id, title, createdAt, collectionId',
      readingSessions: 'id, readingId, timestamp',
      readingCollections: 'id, title, createdAt',
      notes: 'id, deckId, createdAt',
      chatMessages: 'id, partnerId, timestamp',
      audioTracks: 'id, playlistId, title, createdAt',
      playlists: 'id, name, createdAt',
      cefrExams: 'id, level',
      cefrExamAttempts: 'id, examId, level, timestamp'
    });
  }
}

import { cefrExamsSeedData } from './cefrExamSeed';

export const db = new MemorizeDatabase();

export async function seedCefrExams() {
  // Limpa e repovora os exames para forçar a atualização das provas com o novo pool de questões completo.
  await db.cefrExams.clear();
  await db.cefrExams.bulkAdd(cefrExamsSeedData);
}

// --- FUNÇÕES AUXILIARES DE INICIALIZAÇÃO DE DADOS MOCK ---
// Útil para o primeiro carregamento, dando uma boa experiência ao usuário
export async function seedInitialData() {
  await seedCefrExams();
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
  newCardsPerDay: 9999,
  maxReviewsPerDay: 9999,
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
  answerAction: 'bury',
  daysOffMultiplier: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  fsrsEnabled: false,
  maxInterval: 36500,
  startingEase: 2.50,
  easyBonus: 1.30,
  intervalModifier: 1.00,
  hardInterval: 1.20,
  lapseMultiplier: 0.00
};

export async function ensureDefaultPreset() {
  const count = await db.presets.count();
  if (count === 0) {
    await db.presets.add(defaultPreset);
    console.log('Preset padrão criado com sucesso.');
  } else {
    // Atualizar o preset padrão existente no banco para refletir as novas configurações padrão de testes do usuário
    const existing = await db.presets.get(DEFAULT_PRESET_ID);
    if (existing) {
      await db.presets.update(DEFAULT_PRESET_ID, {
        newCardsPerDay: defaultPreset.newCardsPerDay,
        maxReviewsPerDay: defaultPreset.maxReviewsPerDay,
        lapseMultiplier: defaultPreset.lapseMultiplier,
        answerAction: defaultPreset.answerAction
      });
      console.log('Preset padrão existente atualizado com as novas opções.');
    }
  }
}

export async function createTestDeck(): Promise<string> {
  const deckId = 'test-deck-apkg-export-' + Date.now();
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Limpar dados de testes antigos para evitar erros de chaves duplicadas (ConstraintError)
  const oldNotes = ['n-test-1', 'n-test-2', 'n-test-3', 'n-test-4', 'n-test-5', 'n-test-6', 'n-test-7', 'n-test-8', 'n-test-9', 'n-test-10'];
  const oldCards = ['c-test-1', 'c-test-2', 'c-test-3', 'c-test-4a', 'c-test-4b', 'c-test-5a', 'c-test-5b', 'c-test-6', 'c-test-7', 'c-test-8a', 'c-test-8b', 'c-test-9', 'c-test-10'];
  const oldRevisions = ['r-test-1', 'r-test-2', 'r-test-3'];
  
  // Buscar e limpar decks de testes antigos para não acumular baralhos vazios
  const allDecks = await db.decks.toArray();
  const testDeckIds = allDecks
    .filter(d => d.id.startsWith('test-deck-apkg-export-'))
    .map(d => d.id);

  await Promise.all([
    db.notes.bulkDelete(oldNotes),
    db.cards.bulkDelete(oldCards),
    db.revisions.bulkDelete(oldRevisions),
    db.revisions.where('cardId').anyOf(oldCards).delete(),
    ...(testDeckIds.length > 0 ? [db.decks.bulkDelete(testDeckIds)] : [])
  ]);

  // 1. Criar baralho
  await db.decks.add({
    id: deckId,
    name: '🧪 Baralho de Testes Anki',
    description: 'Baralho gerado para testar o exportador .apkg e o algoritmo de agendamento (SM-2/FSRS).',
    presetId: DEFAULT_PRESET_ID,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  // 2. Definir Notas
  const notesData = [
    { id: 'n-test-1', type: 'basic', fields: ['Apple', 'Maçã'], context: 'I eat an apple.' },
    { id: 'n-test-2', type: 'basic', fields: ['Book', 'Livro'], context: 'She reads a book.' },
    { id: 'n-test-3', type: 'basic', fields: ['Dog', 'Cachorro'], context: 'The dog barks.' },
    { id: 'n-test-4', type: 'reversed', fields: ['Car', 'Carro'], context: 'He drives a car.' },
    { id: 'n-test-5', type: 'optional_reversed', fields: ['House', 'Casa', 'yes'], context: 'They live in a house.' },
    { id: 'n-test-6', type: 'optional_reversed', fields: ['Bike', 'Bicicleta', ''], context: 'Ride a bike.' },
    { id: 'n-test-7', type: 'cloze', fields: ['The {{c1::sun::astro}} is hot.', 'Extra Info'], context: 'Sunny day.' },
    { id: 'n-test-8', type: 'cloze', fields: ['A {{c1::cat::animal}} chases a {{c2::mouse}}.', 'Extra Info'], context: 'Cat and mouse.' },
    { id: 'n-test-9', type: 'typing', fields: ['Red', 'Vermelho'], context: 'The sky is red.' },
    { id: 'n-test-10', type: 'basic', fields: ['Suspended Card', 'Cartão Suspenso'], context: 'This card will not show in queues.' }
  ];

  // 3. Inserir Notas no Dexie usando put para evitar qualquer erro de chave duplicada
  for (const n of notesData) {
    await db.notes.put({
      id: n.id,
      deckId,
      type: n.type as any,
      fields: n.fields,
      tags: ['teste_anki', 'algoritmo'],
      context: n.context,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  // 4. Definir e Inserir Cartões no Dexie usando put para evitar erro de chave duplicada
  const cardsData = [
    // 1. Novo básico (nunca estudado)
    { id: 'c-test-1', noteId: 'n-test-1', front: 'Apple', back: 'Maçã', context: 'I eat an apple.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    // 2. Básico em revisão (vence hoje)
    { id: 'c-test-2', noteId: 'n-test-2', front: 'Book', back: 'Livro', context: 'She reads a book.', interval: 4, ease: 2.5, repetitions: 2, lapses: 0, dueDate: todayStr },
    // 3. Básico em revisão (venceu ontem)
    { id: 'c-test-3', noteId: 'n-test-3', front: 'Dog', back: 'Cachorro', context: 'The dog barks.', interval: 15, ease: 2.7, repetitions: 5, lapses: 1, dueDate: yesterdayStr },
    // 4. Reverso (Card A e Card B)
    { id: 'c-test-4a', noteId: 'n-test-4', cardType: 'forward', front: 'Car', back: 'Carro', context: 'He drives a car.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    { id: 'c-test-4b', noteId: 'n-test-4', cardType: 'reversed', front: 'Carro', back: 'Car', context: 'He drives a car.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    // 5. Reverso opcional com AddReverso preenchido (Card A e Card B)
    { id: 'c-test-5a', noteId: 'n-test-5', cardType: 'forward', front: 'House', back: 'Casa', context: 'They live in a house.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    { id: 'c-test-5b', noteId: 'n-test-5', cardType: 'reversed', front: 'Casa', back: 'House', context: 'They live in a house.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    // 6. Reverso opcional com AddReverso vazio (apenas Card A)
    { id: 'c-test-6', noteId: 'n-test-6', cardType: 'forward', front: 'Bike', back: 'Bicicleta', context: 'Ride a bike.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    // 7. Cloze com 1 lacuna
    { id: 'c-test-7', noteId: 'n-test-7', clozeIndex: 1, front: 'The [...] is hot.', back: 'sun', context: 'Sunny day.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    // 8. Cloze com 2 lacunas (Card A e Card B)
    { id: 'c-test-8a', noteId: 'n-test-8', clozeIndex: 1, front: 'A [...] chases a mouse.', back: 'cat', context: 'Cat and mouse.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    { id: 'c-test-8b', noteId: 'n-test-8', clozeIndex: 2, front: 'A cat chases a [...].', back: 'mouse', context: 'Cat and mouse.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    // 9. Digitação
    { id: 'c-test-9', noteId: 'n-test-9', cardType: 'forward', front: 'Red', back: 'Vermelho', context: 'The sky is red.', interval: 0, ease: 2.5, repetitions: 0, lapses: 0, dueDate: todayStr },
    // 10. Suspenso
    { id: 'c-test-10', noteId: 'n-test-10', front: 'Suspended Card', back: 'Cartão Suspenso', context: 'This card will not show in queues.', interval: 5, ease: 2.5, repetitions: 3, lapses: 0, dueDate: todayStr, suspended: true }
  ];

  for (const c of cardsData) {
    await db.cards.put({
      ...c,
      deckId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as any);
  }

  // 5. Adicionar Logs de Revisão fictícios para o Card 2 e Card 3 usando bulkPut
  const now = Date.now();
  await db.revisions.bulkPut([
    // Revisões do Card 2
    { id: 'r-test-1', cardId: 'c-test-2', timestamp: now - 172800000, rating: 3, ease: 2.5, interval: 4, duration: 8, wasNew: true },
    // Revisões do Card 3
    { id: 'r-test-2', cardId: 'c-test-3', timestamp: now - 345600000, rating: 3, ease: 2.5, interval: 4, duration: 12, wasNew: true },
    { id: 'r-test-3', cardId: 'c-test-3', timestamp: now - 172800000, rating: 2, ease: 2.7, interval: 15, duration: 14, wasNew: false }
  ]);

  return deckId;
}

