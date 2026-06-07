import { describe, it, expect } from 'vitest';
import type { Note, Card } from '../types';
import {
  getClozeIndexes,
  formatClozePrompt,
  formatClozeAnswer,
  syncNoteCards,
} from './siblings';

describe('Cloze Deletions Parsing and Formatting', () => {
  const clozeText = 'The {{c1::apple::maçã}} is {{c2::red::vermelha}}.';

  it('getClozeIndexes deve extrair corretamente todos os índices', () => {
    const indexes = getClozeIndexes(clozeText);
    expect(indexes).toEqual([1, 2]);
  });

  it('getClozeIndexes deve retornar vazio se não houver clozes', () => {
    expect(getClozeIndexes('Sem clozes aqui.')).toEqual([]);
  });

  it('formatClozePrompt deve ocultar apenas a lacuna ativa com dica se houver', () => {
    // Para c1 (apple)
    const prompt1 = formatClozePrompt(clozeText, 1);
    expect(prompt1).toBe('The [maçã] is red.');

    // Para c2 (red)
    const prompt2 = formatClozePrompt(clozeText, 2);
    expect(prompt2).toBe('The apple is [vermelha].');
  });

  it('formatClozePrompt deve usar [...] se não houver dica', () => {
    const simpleCloze = 'O cachorro {{c1::latia}} no quintal.';
    const prompt = formatClozePrompt(simpleCloze, 1);
    expect(prompt).toBe('O cachorro [...] no quintal.');
  });

  it('formatClozeAnswer deve extrair a resposta correta e incluir o texto extra se houver', () => {
    const extra = 'Dica extra de explicação.';
    const answer1 = formatClozeAnswer(clozeText, 1, extra);
    expect(answer1).toBe('apple\n\n' + extra);

    const answer2 = formatClozeAnswer(clozeText, 2);
    expect(answer2).toBe('red');
  });
});

describe('Note to Cards Synchronization (syncNoteCards)', () => {
  const createMockNote = (overrides?: Partial<Note>): Note => ({
    id: 'note-1',
    deckId: 'deck-1',
    type: 'basic',
    fields: ['Frente original', 'Verso original'],
    tags: ['tag1'],
    context: 'Contexto original',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  it('syncNoteCards para Nota Básica deve criar 1 card', () => {
    const note = createMockNote();
    const result = syncNoteCards(note, []);

    expect(result.toAdd).toHaveLength(1);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);

    const newCard = result.toAdd[0];
    expect(newCard.noteId).toBe('note-1');
    expect(newCard.front).toBe('Frente original');
    expect(newCard.back).toBe('Verso original');
    expect(newCard.cardType).toBe('forward');
  });

  it('syncNoteCards para Nota Reverso deve criar 2 cards', () => {
    const note = createMockNote({ type: 'reversed' });
    const result = syncNoteCards(note, []);

    expect(result.toAdd).toHaveLength(2);
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toDelete).toHaveLength(0);

    expect(result.toAdd[0].cardType).toBe('forward');
    expect(result.toAdd[0].front).toBe('Frente original');
    expect(result.toAdd[0].back).toBe('Verso original');

    expect(result.toAdd[1].cardType).toBe('reversed');
    expect(result.toAdd[1].front).toBe('Verso original');
    expect(result.toAdd[1].back).toBe('Frente original');
  });

  it('syncNoteCards para Invertido Opcional deve criar 1 ou 2 cards baseando-se no campo extra', () => {
    // Caso 1: Terceiro campo vazio -> 1 card
    const note1 = createMockNote({
      type: 'optional_reversed',
      fields: ['Frente', 'Verso', ''],
    });
    const res1 = syncNoteCards(note1, []);
    expect(res1.toAdd).toHaveLength(1);
    expect(res1.toAdd[0].cardType).toBe('forward');

    // Caso 2: Terceiro campo preenchido -> 2 cards
    const note2 = createMockNote({
      type: 'optional_reversed',
      fields: ['Frente', 'Verso', 'y'],
    });
    const res2 = syncNoteCards(note2, []);
    expect(res2.toAdd).toHaveLength(2);
    expect(res2.toAdd[0].cardType).toBe('forward');
    expect(res2.toAdd[1].cardType).toBe('reversed');
  });

  it('syncNoteCards para Cloze com 2 lacunas deve criar 2 cards', () => {
    const note = createMockNote({
      type: 'cloze',
      fields: ['Texto {{c1::l1}} e {{c2::l2}}', 'ExtraInfo'],
    });
    const result = syncNoteCards(note, []);

    expect(result.toAdd).toHaveLength(2);
    expect(result.toAdd[0].clozeIndex).toBe(1);
    expect(result.toAdd[0].front).toBe('Texto [...] e l2');
    expect(result.toAdd[0].back).toBe('l1\n\nExtraInfo');

    expect(result.toAdd[1].clozeIndex).toBe(2);
    expect(result.toAdd[1].front).toBe('Texto l1 e [...]');
    expect(result.toAdd[1].back).toBe('l2\n\nExtraInfo');
  });

  it('syncNoteCards deve sincronizar atualizações em cards existentes e remover órfãos', () => {
    const note = createMockNote({
      type: 'basic',
      fields: ['Frente alterada', 'Verso alterado'],
    });

    const mockCard1: Card = {
      id: 'card-a',
      deckId: 'deck-1',
      noteId: 'note-1',
      front: 'Frente velha',
      back: 'Verso velho',
      context: 'Contexto velho',
      cardType: 'forward',
      interval: 5,
      ease: 2.5,
      repetitions: 2,
      lapses: 0,
      dueDate: '2026-05-30',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
    };

    const mockCard2: Card = {
      id: 'card-b',
      deckId: 'deck-1',
      noteId: 'note-1',
      front: 'Frente reverso velho',
      back: 'Verso reverso velho',
      context: 'Contexto velho',
      cardType: 'reversed',
      interval: 1,
      ease: 2.5,
      repetitions: 1,
      lapses: 0,
      dueDate: '2026-05-28',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
    };

    // A nota agora é básica. Sendo assim, o cartão reverso (card-b) deve ser deletado,
    // e o cartão normal (card-a) deve ser atualizado preservando os dados SRS (intervalo, vencimento, etc).
    const result = syncNoteCards(note, [mockCard1, mockCard2]);

    expect(result.toAdd).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toDelete).toEqual(['card-b']);

    const updatedCard = result.toUpdate[0];
    expect(updatedCard.id).toBe('card-a');
    expect(updatedCard.front).toBe('Frente alterada');
    expect(updatedCard.back).toBe('Verso alterado');
    expect(updatedCard.interval).toBe(5); // preservado
    expect(updatedCard.dueDate).toBe('2026-05-30'); // preservado
  });

  it('syncNoteCards deve propagar o campo explanation da nota para o card ao adicionar ou atualizar', () => {
    const note = createMockNote({
      explanation: 'Esta é uma dica explicativa de teste.',
    });
    
    // Teste para adicionar
    const addResult = syncNoteCards(note, []);
    expect(addResult.toAdd).toHaveLength(1);
    expect(addResult.toAdd[0].explanation).toBe('Esta é uma dica explicativa de teste.');

    // Teste para atualizar
    const existingCard: Card = {
      id: 'card-1',
      deckId: 'deck-1',
      noteId: 'note-1',
      front: 'Frente original',
      back: 'Verso original',
      context: 'Contexto original',
      explanation: 'Dica antiga',
      cardType: 'forward',
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      dueDate: '2026-06-07',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updateResult = syncNoteCards(note, [existingCard]);
    expect(updateResult.toUpdate).toHaveLength(1);
    expect(updateResult.toUpdate[0].explanation).toBe('Esta é uma dica explicativa de teste.');
  });
});
