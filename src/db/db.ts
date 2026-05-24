import Dexie, { type Table } from 'dexie';
import type { Deck, Card, Revision } from '../types';

class MemorizeDatabase extends Dexie {
  decks!: Table<Deck>;
  cards!: Table<Card>;
  revisions!: Table<Revision>;

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
