import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performMergeSync } from './sync';
import { db } from '../db/db';

// Mock variables for tables
let mockDecks: any[] = [];
let mockCards: any[] = [];
let mockNotes: any[] = [];
let mockRevisions: any[] = [];
let mockPresets: any[] = [];
let mockReadings: any[] = [];
let mockReadingSessions: any[] = [];
let mockReadingCollections: any[] = [];
let mockChatMessages: any[] = [];

vi.mock('../db/db', () => {
  const createMockTable = (store: { value: any[] }) => {
    return {
      toArray: vi.fn().mockImplementation(async () => store.value),
      add: vi.fn().mockImplementation(async (item) => {
        store.value.push(item);
        return item.id;
      }),
      put: vi.fn().mockImplementation(async (item) => {
        const idx = store.value.findIndex((x) => x.id === item.id);
        if (idx !== -1) {
          store.value[idx] = item;
        } else {
          store.value.push(item);
        }
        return item.id;
      }),
      bulkAdd: vi.fn().mockImplementation(async (items) => {
        store.value.push(...items);
        return items.map((x: any) => x.id);
      }),
    };
  };

  const decksStore = { value: [] as any[] };
  const cardsStore = { value: [] as any[] };
  const notesStore = { value: [] as any[] };
  const revisionsStore = { value: [] as any[] };
  const presetsStore = { value: [] as any[] };
  const readingsStore = { value: [] as any[] };
  const sessionsStore = { value: [] as any[] };
  const collectionsStore = { value: [] as any[] };
  const chatStore = { value: [] as any[] };

  return {
    db: {
      decks: createMockTable(decksStore),
      cards: createMockTable(cardsStore),
      notes: createMockTable(notesStore),
      revisions: createMockTable(revisionsStore),
      presets: createMockTable(presetsStore),
      readings: createMockTable(readingsStore),
      readingSessions: createMockTable(sessionsStore),
      readingCollections: createMockTable(collectionsStore),
      chatMessages: createMockTable(chatStore),
    },
  };
});

describe('sync: Sincronização e Mesclagem de Banco de Dados', () => {
  beforeEach(() => {
    // Resetting inside arrays
    mockDecks = [];
    mockCards = [];
    mockNotes = [];
    mockRevisions = [];
    mockPresets = [];
    mockReadings = [];
    mockReadingSessions = [];
    mockReadingCollections = [];
    mockChatMessages = [];

    // Vitest vi.mock can capture closures, let's redirect mock getters or rewrite stores:
    // we bypass by just mutating the arrays we returned in the closure
    // @ts-ignore
    db.decks.toArray.mockImplementation(async () => mockDecks);
    // @ts-ignore
    db.decks.add.mockImplementation(async (item) => { mockDecks.push(item); return item.id; });
    // @ts-ignore
    db.decks.put.mockImplementation(async (item) => {
      const idx = mockDecks.findIndex(x => x.id === item.id);
      if (idx !== -1) mockDecks[idx] = item;
      else mockDecks.push(item);
      return item.id;
    });

    // @ts-ignore
    db.presets.toArray.mockImplementation(async () => mockPresets);
    // @ts-ignore
    db.presets.add.mockImplementation(async (item) => { mockPresets.push(item); return item.id; });
    // @ts-ignore
    db.presets.put.mockImplementation(async (item) => {
      const idx = mockPresets.findIndex(x => x.id === item.id);
      if (idx !== -1) mockPresets[idx] = item;
      else mockPresets.push(item);
      return item.id;
    });

    // @ts-ignore
    db.readingCollections.toArray.mockImplementation(async () => mockReadingCollections);
    // @ts-ignore
    db.readingCollections.add.mockImplementation(async (item) => { mockReadingCollections.push(item); return item.id; });
    // @ts-ignore
    db.readingCollections.put.mockImplementation(async (item) => {
      const idx = mockReadingCollections.findIndex(x => x.id === item.id);
      if (idx !== -1) mockReadingCollections[idx] = item;
      else mockReadingCollections.push(item);
      return item.id;
    });

    // @ts-ignore
    db.notes.toArray.mockImplementation(async () => mockNotes);
    // @ts-ignore
    db.notes.add.mockImplementation(async (item) => { mockNotes.push(item); return item.id; });
    // @ts-ignore
    db.notes.put.mockImplementation(async (item) => {
      const idx = mockNotes.findIndex(x => x.id === item.id);
      if (idx !== -1) mockNotes[idx] = item;
      else mockNotes.push(item);
      return item.id;
    });

    // @ts-ignore
    db.cards.toArray.mockImplementation(async () => mockCards);
    // @ts-ignore
    db.cards.add.mockImplementation(async (item) => { mockCards.push(item); return item.id; });
    // @ts-ignore
    db.cards.put.mockImplementation(async (item) => {
      const idx = mockCards.findIndex(x => x.id === item.id);
      if (idx !== -1) mockCards[idx] = item;
      else mockCards.push(item);
      return item.id;
    });

    // @ts-ignore
    db.readings.toArray.mockImplementation(async () => mockReadings);
    // @ts-ignore
    db.readings.add.mockImplementation(async (item) => { mockReadings.push(item); return item.id; });
    // @ts-ignore
    db.readings.put.mockImplementation(async (item) => {
      const idx = mockReadings.findIndex(x => x.id === item.id);
      if (idx !== -1) mockReadings[idx] = item;
      else mockReadings.push(item);
      return item.id;
    });

    // @ts-ignore
    db.revisions.toArray.mockImplementation(async () => mockRevisions);
    // @ts-ignore
    db.revisions.bulkAdd.mockImplementation(async (items) => { mockRevisions.push(...items); return items.map(x => x.id); });

    // @ts-ignore
    db.readingSessions.toArray.mockImplementation(async () => mockReadingSessions);
    // @ts-ignore
    db.readingSessions.bulkAdd.mockImplementation(async (items) => { mockReadingSessions.push(...items); return items.map(x => x.id); });

    // @ts-ignore
    db.chatMessages.toArray.mockImplementation(async () => mockChatMessages);
    // @ts-ignore
    db.chatMessages.bulkAdd.mockImplementation(async (items) => { mockChatMessages.push(...items); return items.map(x => x.id); });
  });

  it('deve adicionar um registro remoto se ele não existir localmente', async () => {
    // Local: vazio
    // Remoto: possui 1 deck
    const remotePayload = {
      version: '1.1',
      exportType: 'full-sync',
      presets: [],
      readingCollections: [],
      decks: [{ id: 'deck-1', name: 'Deck Remoto', createdAt: 100, updatedAt: 100, description: '' }],
      notes: [],
      cards: [],
      readings: [],
      revisions: [],
      readingSessions: [],
      chatMessages: [],
      exportedAt: Date.now(),
    };

    await performMergeSync(remotePayload);

    expect(mockDecks.length).toBe(1);
    expect(mockDecks[0].name).toBe('Deck Remoto');
    expect(mockDecks[0].id).toBe('deck-1');
  });

  it('deve sobrescrever um registro local se a versão remota for mais recente (updatedAt maior)', async () => {
    // Local: possui deck com updatedAt = 100
    mockDecks = [{ id: 'deck-1', name: 'Deck Local Antigo', createdAt: 100, updatedAt: 100, description: '' }];

    // Remoto: possui deck com o mesmo ID, mas updatedAt = 200
    const remotePayload = {
      version: '1.1',
      exportType: 'full-sync',
      presets: [],
      readingCollections: [],
      decks: [{ id: 'deck-1', name: 'Deck Remoto Atualizado', createdAt: 100, updatedAt: 200, description: '' }],
      notes: [],
      cards: [],
      readings: [],
      revisions: [],
      readingSessions: [],
      chatMessages: [],
      exportedAt: Date.now(),
    };

    await performMergeSync(remotePayload);

    expect(mockDecks.length).toBe(1);
    expect(mockDecks[0].name).toBe('Deck Remoto Atualizado');
    expect(mockDecks[0].updatedAt).toBe(200);
  });

  it('deve manter o registro local se ele for mais recente do que o remoto (updatedAt local maior)', async () => {
    // Local: possui deck com updatedAt = 300
    mockDecks = [{ id: 'deck-1', name: 'Deck Local Mais Recente', createdAt: 100, updatedAt: 300, description: '' }];

    // Remoto: possui deck com o mesmo ID, mas updatedAt = 200
    const remotePayload = {
      version: '1.1',
      exportType: 'full-sync',
      presets: [],
      readingCollections: [],
      decks: [{ id: 'deck-1', name: 'Deck Remoto Desatualizado', createdAt: 100, updatedAt: 200, description: '' }],
      notes: [],
      cards: [],
      readings: [],
      revisions: [],
      readingSessions: [],
      chatMessages: [],
      exportedAt: Date.now(),
    };

    await performMergeSync(remotePayload);

    expect(mockDecks.length).toBe(1);
    expect(mockDecks[0].name).toBe('Deck Local Mais Recente');
    expect(mockDecks[0].updatedAt).toBe(300);
  });

  it('deve unir registros de logs históricos (revisions) sem criar duplicatas', async () => {
    // Local: possui revisões r1 e r2
    mockRevisions = [
      { id: 'rev-1', cardId: 'c1', timestamp: 1000, rating: 3, ease: 2.5, interval: 4 },
      { id: 'rev-2', cardId: 'c2', timestamp: 1100, rating: 2, ease: 2.4, interval: 2 }
    ];

    // Remoto: possui revisões rev-2 (repetida) e rev-3 (nova)
    const remotePayload = {
      version: '1.1',
      exportType: 'full-sync',
      presets: [],
      readingCollections: [],
      decks: [],
      notes: [],
      cards: [],
      readings: [],
      revisions: [
        { id: 'rev-2', cardId: 'c2', timestamp: 1100, rating: 2, ease: 2.4, interval: 2 },
        { id: 'rev-3', cardId: 'c3', timestamp: 1200, rating: 4, ease: 2.6, interval: 8 }
      ],
      readingSessions: [],
      chatMessages: [],
      exportedAt: Date.now(),
    };

    await performMergeSync(remotePayload);

    // Deve ter adicionado apenas a 'rev-3'
    expect(mockRevisions.length).toBe(3);
    const ids = mockRevisions.map(r => r.id);
    expect(ids).toContain('rev-1');
    expect(ids).toContain('rev-2');
    expect(ids).toContain('rev-3');
  });
});
