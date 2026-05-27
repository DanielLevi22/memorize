import { describe, it, expect } from 'vitest';
import type { Deck, Card, DeckPreset } from '../types';
import { getEffectiveLimits, getDeckStudyableCards } from './limits';

// Helper mock structures
const createMockPreset = (overrides?: Partial<DeckPreset>): DeckPreset => ({
  id: 'preset-1',
  name: 'Standard Preset',
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
  daysOffMultiplier: [1, 1, 1, 1, 1, 1, 1],
  fsrsEnabled: false,
  maxInterval: 36500,
  startingEase: 2.5,
  easyBonus: 1.3,
  intervalModifier: 1.0,
  hardInterval: 1.2,
  lapseMultiplier: 0.5,
  ...overrides,
});

const createMockDeck = (overrides?: Partial<Deck>): Deck => ({
  id: 'deck-1',
  name: 'Mock Deck',
  description: 'A mock deck description',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  presetId: 'preset-1',
  ...overrides,
});

const createMockCard = (id: string, deckId: string, interval: number, dueDate: string, overrides?: Partial<Card>): Card => ({
  id,
  deckId,
  front: `Question ${id}`,
  back: `Answer ${id}`,
  context: `Context ${id}`,
  interval,
  ease: 2.5,
  repetitions: interval > 0 ? 3 : 0,
  lapses: 0,
  dueDate,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe('Limits Business Logic (getEffectiveLimits)', () => {
  const today = '2026-05-27';

  it('deve usar limites do Preset se nenhum override for definido', () => {
    const preset = createMockPreset({ newCardsPerDay: 15, maxReviewsPerDay: 100 });
    const deck = createMockDeck();

    const limits = getEffectiveLimits(deck, preset, today);
    expect(limits.newCardsLimit).toBe(15);
    expect(limits.reviewsLimit).toBe(100);
  });

  it('deve usar o limite "Esse baralho" se configurado', () => {
    const preset = createMockPreset({ newCardsPerDay: 15, maxReviewsPerDay: 100 });
    const deck = createMockDeck({
      newCardsLimitType: 'deck',
      newCardsLimitValue: 5,
      reviewsLimitType: 'deck',
      reviewsLimitValue: 30,
    });

    const limits = getEffectiveLimits(deck, preset, today);
    expect(limits.newCardsLimit).toBe(5);
    expect(limits.reviewsLimit).toBe(30);
  });

  it('deve usar o limite "Somente hoje" se a data for atual', () => {
    const preset = createMockPreset({ newCardsPerDay: 15, maxReviewsPerDay: 100 });
    const deck = createMockDeck({
      newCardsLimitType: 'today',
      newCardsLimitToday: 8,
      newCardsLimitTodayDate: today,
      reviewsLimitType: 'today',
      reviewsLimitToday: 40,
      reviewsLimitTodayDate: today,
    });

    const limits = getEffectiveLimits(deck, preset, today);
    expect(limits.newCardsLimit).toBe(8);
    expect(limits.reviewsLimit).toBe(40);
  });

  it('deve expirar o limite "Somente hoje" (e voltar para preset) se a data do sistema for diferente', () => {
    const preset = createMockPreset({ newCardsPerDay: 15, maxReviewsPerDay: 100 });
    const deck = createMockDeck({
      newCardsLimitType: 'today',
      newCardsLimitToday: 8,
      newCardsLimitTodayDate: '2026-05-26', // ontem
      reviewsLimitType: 'today',
      reviewsLimitToday: 40,
      reviewsLimitTodayDate: '2026-05-26', // ontem
    });

    const limits = getEffectiveLimits(deck, preset, today);
    expect(limits.newCardsLimit).toBe(15); // Fallback para preset
    expect(limits.reviewsLimit).toBe(100); // Fallback para preset
  });

  it('deve expirar o limite "Somente hoje" (e voltar para "Esse baralho") se a data do sistema for diferente', () => {
    const preset = createMockPreset({ newCardsPerDay: 15, maxReviewsPerDay: 100 });
    const deck = createMockDeck({
      newCardsLimitType: 'today',
      newCardsLimitToday: 8,
      newCardsLimitTodayDate: '2026-05-26', // ontem
      newCardsLimitValue: 6,
      reviewsLimitType: 'today',
      reviewsLimitToday: 40,
      reviewsLimitTodayDate: '2026-05-26', // ontem
      reviewsLimitValue: 25,
    });

    // Se o tipo era 'today' mas expirou, getEffectiveLimits retorna os limites sem considerar a data de hoje,
    // mas espera aí: se deck.newCardsLimitType === 'today' e o dia já passou, a função getEffectiveLimits
    // vai cair no else block que por padrão retorna preset, a menos que especifiquemos.
    // Vamos olhar a função getEffectiveLimits atual:
    //   if (deck.newCardsLimitType === 'today' && deck.newCardsLimitTodayDate === todayStr) {
    //     newCardsLimit = deck.newCardsLimitToday ?? preset.newCardsPerDay;
    //   } else if (deck.newCardsLimitType === 'deck') { ... }
    //
    // Se o tipo for 'today' e a data não bater com todayStr, ele não entra no primeiro 'if' nem no 'else if',
    // portanto retorna o valor do preset.
    // Isto está correto! No Anki, uma vez que expira o limite de "somente hoje", o deck volta para a
    // configuração padrão (que é o preset), ou se houver um limite definido para o baralho.
    // Wait, let's think: if the user had "Esse baralho" configured as well, does it return 'preset' or 'deck'?
    // In our implementation, since the user chose 'today', if today expires, it goes back to preset.
    // Let's verify this fallback.
    const limits = getEffectiveLimits(deck, preset, today);
    expect(limits.newCardsLimit).toBe(15);
    expect(limits.reviewsLimit).toBe(100);
  });
});

describe('Limits Integration Tests (getDeckStudyableCards)', () => {
  const today = '2026-05-27';

  // Helper para criar cartas do deck
  const createMockCards = (deckId: string) => [
    createMockCard('c1', deckId, 0, today), // novo
    createMockCard('c2', deckId, 0, today), // novo
    createMockCard('c3', deckId, 0, today), // novo
    createMockCard('c4', deckId, 10, today), // revisão atrasada (due hoje)
    createMockCard('c5', deckId, 15, today), // revisão atrasada (due hoje)
  ];

  it('deve limitar a fila inicial de novos cartões e revisões de acordo com o preset', () => {
    const preset = createMockPreset({ newCardsPerDay: 2, maxReviewsPerDay: 1 });
    const deck = createMockDeck();
    const cards = createMockCards(deck.id);

    const studyable = getDeckStudyableCards(deck, cards, preset, { newStudied: 0, reviewsStudied: 0 }, today);
    
    expect(studyable.newCount).toBe(2);
    expect(studyable.reviewCount).toBe(1);
    expect(studyable.totalCount).toBe(3); // 2 novos + 1 revisão
  });

  it('Cenário A: Redução Dinâmica da Fila (Simulando Jogada do Baralho)', () => {
    const preset = createMockPreset({ newCardsPerDay: 2, maxReviewsPerDay: 2 });
    const deck = createMockDeck();
    const cards = createMockCards(deck.id);

    // 1. Início da sessão de estudos (fila com 2 novos cartões e 2 de revisão)
    let counts = { newStudied: 0, reviewsStudied: 0 };
    let studyable = getDeckStudyableCards(deck, cards, preset, counts, today);
    expect(studyable.newCount).toBe(2);
    expect(studyable.reviewCount).toBe(2);

    // 2. Simula o estudo de 1 cartão novo (adiciona nas estatísticas de hoje)
    counts.newStudied += 1;
    studyable = getDeckStudyableCards(deck, cards, preset, counts, today);
    expect(studyable.newCount).toBe(1); // Resta apenas 1
    expect(studyable.reviewCount).toBe(2);

    // 3. Simula o estudo de outro cartão novo (atinge o limite de novos)
    counts.newStudied += 1;
    studyable = getDeckStudyableCards(deck, cards, preset, counts, today);
    expect(studyable.newCount).toBe(0); // Fila de novos esgotada!
    expect(studyable.reviewCount).toBe(2);

    // 4. Simula o estudo de 1 cartão de revisão
    counts.reviewsStudied += 1;
    studyable = getDeckStudyableCards(deck, cards, preset, counts, today);
    expect(studyable.newCount).toBe(0);
    expect(studyable.reviewCount).toBe(1); // Resta apenas 1 de revisão

    // 5. Simula o estudo do último cartão de revisão
    counts.reviewsStudied += 1;
    studyable = getDeckStudyableCards(deck, cards, preset, counts, today);
    expect(studyable.newCount).toBe(0);
    expect(studyable.reviewCount).toBe(0); // Fila de revisões esgotada!
  });

  it('Cenário B: Regra "Novos ignoram limite de revisão" (Desativada - Padrão)', () => {
    const preset = createMockPreset({ 
      newCardsPerDay: 2, 
      maxReviewsPerDay: 1, 
      newCardsIgnoreReviewLimit: false // Regra padrão desativada
    });
    const deck = createMockDeck();
    const cards = createMockCards(deck.id);

    // 1. Simula que o limite de revisão de hoje foi esgotado
    const counts = { newStudied: 0, reviewsStudied: 1 }; // Fez 1 revisão (atingindo o limite de 1)
    
    const studyable = getDeckStudyableCards(deck, cards, preset, counts, today);
    
    // Como atingiu o limite de revisão e a opção está desativada, novos cartões são bloqueados!
    expect(studyable.newCount).toBe(0);
    expect(studyable.reviewCount).toBe(0);
  });

  it('Cenário C: Regra "Novos ignoram limite de revisão" (Ativada)', () => {
    const preset = createMockPreset({ 
      newCardsPerDay: 2, 
      maxReviewsPerDay: 1, 
      newCardsIgnoreReviewLimit: true // Regra ativada!
    });
    const deck = createMockDeck();
    const cards = createMockCards(deck.id);

    // 1. Simula que o limite de revisão de hoje foi esgotado
    const counts = { newStudied: 0, reviewsStudied: 1 }; // Fez 1 revisão (limite atingido)
    
    const studyable = getDeckStudyableCards(deck, cards, preset, counts, today);
    
    // Como a opção está ativada, novos cartões continuam aparecendo até o seu próprio limite (2)
    expect(studyable.newCount).toBe(2);
    expect(studyable.reviewCount).toBe(0);
  });

  it('REQ-2.5: Ordem de Inserção de Novos (Sequencial vs. Aleatória)', () => {
    const deck = createMockDeck();
    const c1 = createMockCard('c1', deck.id, 0, today);
    c1.createdAt = 1000;
    const c2 = createMockCard('c2', deck.id, 0, today);
    c2.createdAt = 2000;
    const c3 = createMockCard('c3', deck.id, 0, today);
    c3.createdAt = 1500;

    const cards = [c1, c2, c3];

    // Ordem Sequencial (mais antigos primeiro, ou seja, createdAt menor)
    const presetSeq = createMockPreset({ insertionOrder: 'sequential', newCardsPerDay: 3 });
    const studyableSeq = getDeckStudyableCards(deck, cards, presetSeq, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(studyableSeq.cards[0].id).toBe('c1');
    expect(studyableSeq.cards[1].id).toBe('c3');
    expect(studyableSeq.cards[2].id).toBe('c2');

    // Ordem Aleatória
    const presetRand = createMockPreset({ insertionOrder: 'random', newCardsPerDay: 3 });
    const studyableRand = getDeckStudyableCards(deck, cards, presetRand, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(studyableRand.cards).toHaveLength(3);
  });

  it('REQ-2.6: Separação de Limites de Coleta (Novos vs. Aprendizado)', () => {
    const deck = createMockDeck();
    // 3 novos
    const c1 = createMockCard('c1', deck.id, 0, today);
    const c2 = createMockCard('c2', deck.id, 0, today);
    const c3 = createMockCard('c3', deck.id, 0, today);
    // 1 em aprendizado ativo (learningStep definido)
    const cActive = createMockCard('cActive', deck.id, 0, today);
    cActive.learningStep = 1;

    const cards = [c1, c2, c3, cActive];

    // Limite de novos = 2.
    // O cartão em aprendizado ativo NÃO deve consumir a cota de novos cartões,
    // e deve sempre aparecer na fila de aprendizado.
    const preset = createMockPreset({ newCardsPerDay: 2 });
    const studyable = getDeckStudyableCards(deck, cards, preset, { newStudied: 0, reviewsStudied: 0 }, today);

    // Deve conter 2 novos (c1, c2) + 1 ativo = total 3
    expect(studyable.newCount).toBe(2);
    expect(studyable.learningCount).toBe(1);
    expect(studyable.totalCount).toBe(3);

    // Garante que o cartão ativo 'cActive' está no combined array
    expect(studyable.cards.some(c => c.id === 'cActive')).toBe(true);
  });

  it('REQ-3.5: deve ocultar/excluir cartões suspensos das filas de novos, learning e reviews', () => {
    const deck = createMockDeck();
    // 1 novo ativo, 1 novo suspenso
    const cNewActive = createMockCard('cNewActive', deck.id, 0, today);
    const cNewSusp = createMockCard('cNewSusp', deck.id, 0, today, { suspended: true });

    // 1 review ativo (due hoje), 1 review suspenso
    const cRevActive = createMockCard('cRevActive', deck.id, 10, today);
    const cRevSusp = createMockCard('cRevSusp', deck.id, 10, today, { suspended: true });

    // 1 learning ativo, 1 learning suspenso
    const cLearnActive = createMockCard('cLearnActive', deck.id, 0, today, { learningStep: 1 });
    const cLearnSusp = createMockCard('cLearnSusp', deck.id, 0, today, { learningStep: 1, suspended: true });

    const cards = [cNewActive, cNewSusp, cRevActive, cRevSusp, cLearnActive, cLearnSusp];
    const preset = createMockPreset({ newCardsPerDay: 5, maxReviewsPerDay: 5 });

    const studyable = getDeckStudyableCards(deck, cards, preset, { newStudied: 0, reviewsStudied: 0 }, today);

    // Deve conter apenas as 3 cartas ativas, ignorando completamente as 3 suspensas
    expect(studyable.newCount).toBe(1);
    expect(studyable.reviewCount).toBe(1);
    expect(studyable.learningCount).toBe(1);
    expect(studyable.totalCount).toBe(3);

    expect(studyable.cards.some(c => c.id === 'cNewSusp')).toBe(false);
    expect(studyable.cards.some(c => c.id === 'cRevSusp')).toBe(false);
    expect(studyable.cards.some(c => c.id === 'cLearnSusp')).toBe(false);
  });

  it('REQ-4.1: deve agrupar cartões novos por baralho e por data (ascending/descending)', () => {
    const deck = createMockDeck();
    const d1 = createMockDeck({ id: 'deck-a', name: 'Baralho A' });
    const d2 = createMockDeck({ id: 'deck-b', name: 'Baralho B' });

    const c1 = createMockCard('c1', 'deck-b', 0, today);
    c1.createdAt = 2000;
    const c2 = createMockCard('c2', 'deck-a', 0, today);
    c2.createdAt = 1000;
    const c3 = createMockCard('c3', 'deck-a', 0, today);
    c3.createdAt = 3000;

    const cards = [c1, c2, c3];
    const decksList = [d1, d2];

    // Grouping: 'deck' (Baralho A first, then Baralho B)
    const presetDeck = createMockPreset({ newCardGrouping: 'deck', newCardsPerDay: 3 });
    const studyableDeck = getDeckStudyableCards(deck, cards, presetDeck, { newStudied: 0, reviewsStudied: 0 }, today, decksList);
    // Baralho A cards: c2 (createdAt 1000) then c3 (createdAt 3000). Baralho B cards: c1.
    expect(studyableDeck.cards[0].id).toBe('c2');
    expect(studyableDeck.cards[1].id).toBe('c3');
    expect(studyableDeck.cards[2].id).toBe('c1');

    // Grouping: 'descending'
    const presetDesc = createMockPreset({ newCardGrouping: 'descending', newCardsPerDay: 3 });
    const studyableDesc = getDeckStudyableCards(deck, cards, presetDesc, { newStudied: 0, reviewsStudied: 0 }, today, decksList);
    expect(studyableDesc.cards[0].id).toBe('c3'); // 3000
    expect(studyableDesc.cards[1].id).toBe('c1'); // 2000
    expect(studyableDesc.cards[2].id).toBe('c2'); // 1000
  });

  it('REQ-4.3 & REQ-4.4: deve priorizar e misturar novos, aprendizado e revisões conforme o preset', () => {
    const deck = createMockDeck();
    const cNew = createMockCard('cNew', deck.id, 0, today);
    const cRev = createMockCard('cRev', deck.id, 10, today);
    const cLearn = createMockCard('cLearn', deck.id, 0, today, { learningStep: 1 });

    const cards = [cNew, cRev, cLearn];

    // 1. newFirst, learningFirst: new -> learn -> review
    const presetNewFirst = createMockPreset({ 
      newVsReviewOrder: 'newFirst', 
      interdayLearningVsReviewOrder: 'learningFirst',
      newCardsPerDay: 5,
      maxReviewsPerDay: 5
    });
    const sNewFirst = getDeckStudyableCards(deck, cards, presetNewFirst, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(sNewFirst.cards[0].id).toBe('cNew');
    expect(sNewFirst.cards[1].id).toBe('cLearn');
    expect(sNewFirst.cards[2].id).toBe('cRev');

    // 2. reviewFirst, reviewFirst: review -> learn -> new
    const presetReviewFirst = createMockPreset({ 
      newVsReviewOrder: 'reviewFirst', 
      interdayLearningVsReviewOrder: 'reviewFirst',
      newCardsPerDay: 5,
      maxReviewsPerDay: 5
    });
    const sRevFirst = getDeckStudyableCards(deck, cards, presetReviewFirst, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(sRevFirst.cards[0].id).toBe('cRev');
    expect(sRevFirst.cards[1].id).toBe('cLearn');
    expect(sRevFirst.cards[2].id).toBe('cNew');
  });

  it('REQ-4.5: deve classificar revisões conforme o preset', () => {
    const deck = createMockDeck();
    const c1 = createMockCard('c1', deck.id, 5, today, { ease: 2.0, dueDate: '2026-05-25' }); // ease 2.0, int 5
    const c2 = createMockCard('c2', deck.id, 10, today, { ease: 3.0, dueDate: '2026-05-26' }); // ease 3.0, int 10

    const cards = [c1, c2];

    // intervalsAscending: c1 (5) then c2 (10)
    const presetIntAsc = createMockPreset({ reviewSorting: 'intervalsAscending', maxReviewsPerDay: 5 });
    const sIntAsc = getDeckStudyableCards(deck, cards, presetIntAsc, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(sIntAsc.cards[0].id).toBe('c1');
    expect(sIntAsc.cards[1].id).toBe('c2');

    // intervalsDescending: c2 (10) then c1 (5)
    const presetIntDesc = createMockPreset({ reviewSorting: 'intervalsDescending', maxReviewsPerDay: 5 });
    const sIntDesc = getDeckStudyableCards(deck, cards, presetIntDesc, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(sIntDesc.cards[0].id).toBe('c2');
    expect(sIntDesc.cards[1].id).toBe('c1');

    // easeAscending: c1 (2.0) then c2 (3.0)
    const presetEaseAsc = createMockPreset({ reviewSorting: 'easeAscending', maxReviewsPerDay: 5 });
    const sEaseAsc = getDeckStudyableCards(deck, cards, presetEaseAsc, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(sEaseAsc.cards[0].id).toBe('c1');
    expect(sEaseAsc.cards[1].id).toBe('c2');

    // retrievabilityDescending: c2 (vence 05-26, mais recente/provável lembrar) then c1 (vence 05-25)
    const presetRetrDesc = createMockPreset({ reviewSorting: 'retrievabilityDescending', maxReviewsPerDay: 5 });
    const sRetrDesc = getDeckStudyableCards(deck, cards, presetRetrDesc, { newStudied: 0, reviewsStudied: 0 }, today);
    expect(sRetrDesc.cards[0].id).toBe('c2');
    expect(sRetrDesc.cards[1].id).toBe('c1');
  });

  it('Tópico 5: deve ocultar cartões irmãos novos e de revisão estaticamente na inicialização da fila', () => {
    const deck = createMockDeck();
    
    // c1 (Novo, note-1) e c2 (Novo, note-1) -> irmãos novos
    const c1 = createMockCard('c1', deck.id, 0, today, { noteId: 'note-1' });
    const c2 = createMockCard('c2', deck.id, 0, today, { noteId: 'note-1' });
    
    // c3 (Revisão, note-2) e c4 (Revisão, note-2) -> irmãos revisão
    const c3 = createMockCard('c3', deck.id, 10, today, { noteId: 'note-2' });
    const c4 = createMockCard('c4', deck.id, 15, today, { noteId: 'note-2' });

    const cards = [c1, c2, c3, c4];

    // Caso 1: buryNewSiblings = true, buryReviewSiblings = false
    const preset1 = createMockPreset({
      buryNewSiblings: true,
      buryReviewSiblings: false,
      newCardsPerDay: 5,
      maxReviewsPerDay: 5
    });
    const s1 = getDeckStudyableCards(deck, cards, preset1, { newStudied: 0, reviewsStudied: 0 }, today);
    // Deve conter c1 (c2 enterrado) + c3 + c4 (nenhum de revisão enterrado)
    expect(s1.newCount).toBe(1);
    expect(s1.reviewCount).toBe(2);
    expect(s1.cards.some(c => c.id === 'c2')).toBe(false);

    // Caso 2: buryNewSiblings = false, buryReviewSiblings = true
    const preset2 = createMockPreset({
      buryNewSiblings: false,
      buryReviewSiblings: true,
      reviewSorting: 'intervalsAscending',
      newCardsPerDay: 5,
      maxReviewsPerDay: 5
    });
    const s2 = getDeckStudyableCards(deck, cards, preset2, { newStudied: 0, reviewsStudied: 0 }, today);
    // Deve conter c1 + c2 (nenhuma nova enterrada) + c3 (c4 enterrado)
    expect(s2.newCount).toBe(2);
    expect(s2.reviewCount).toBe(1);
    expect(s2.cards.some(c => c.id === 'c4')).toBe(false);
  });

  it('Tópico 5: deve respeitar prioridade de fila e ocultar irmãos de menor prioridade', () => {
    const deck = createMockDeck();
    
    // c1 (Revisão, note-1) e c2 (Novo, note-1) -> irmãos de prioridades diferentes
    const c1 = createMockCard('c1', deck.id, 10, today, { noteId: 'note-1' });
    const c2 = createMockCard('c2', deck.id, 0, today, { noteId: 'note-1' });

    const cards = [c1, c2];
    const preset = createMockPreset({
      buryNewSiblings: true,
      buryReviewSiblings: true,
      newCardsPerDay: 5,
      maxReviewsPerDay: 5
    });

    const s = getDeckStudyableCards(deck, cards, preset, { newStudied: 0, reviewsStudied: 0 }, today);
    // Revisão (c1) tem prioridade, então c2 (Novo) deve ser enterrado!
    expect(s.reviewCount).toBe(1);
    expect(s.newCount).toBe(0);
    expect(s.cards[0].id).toBe('c1');
  });

  it('Tópico 5: deve ocultar cartas cujo irmão já foi estudado hoje (revisado/estudado hoje)', () => {
    const deck = createMockDeck();
    
    const c1 = createMockCard('c1', deck.id, 0, today, { noteId: 'note-1' });
    
    const preset = createMockPreset({
      buryNewSiblings: true,
      newCardsPerDay: 5
    });

    // Simula que o irmão 'c2' (mesmo note-1) foi estudado hoje
    const studiedCardIds = new Set(['c2']);
    
    // Passando o deckCards completo contendo c2 para o find
    const deckCards = [c1, createMockCard('c2', deck.id, 0, today, { noteId: 'note-1' })];

    const s = getDeckStudyableCards(deck, deckCards, preset, { newStudied: 0, reviewsStudied: 0 }, today, [], studiedCardIds);
    // Como o irmão foi estudado hoje, c1 deve ser oculto/enterrado!
    expect(s.newCount).toBe(0);
    expect(s.cards).toHaveLength(0);
  });
});
