import type { Deck, Card, DeckPreset } from '../types';

/**
 * Calcula os limites diários efetivos aplicados a um baralho específico hoje.
 * Segue a hierarquia: Somente hoje (se a data for atual) > Esse baralho > Preset.
 */
export function getEffectiveLimits(
  deck: Deck,
  preset: DeckPreset,
  todayStr: string
): { newCardsLimit: number; reviewsLimit: number } {
  // 1. Novos Cartões
  let newCardsLimit = preset.newCardsPerDay;
  if (deck.newCardsLimitType === 'today' && deck.newCardsLimitTodayDate === todayStr) {
    newCardsLimit = deck.newCardsLimitToday ?? preset.newCardsPerDay;
  } else if (deck.newCardsLimitType === 'deck') {
    newCardsLimit = deck.newCardsLimitValue ?? preset.newCardsPerDay;
  }

  // 2. Revisões Máximas
  let reviewsLimit = preset.maxReviewsPerDay;
  if (deck.reviewsLimitType === 'today' && deck.reviewsLimitTodayDate === todayStr) {
    reviewsLimit = deck.reviewsLimitToday ?? preset.maxReviewsPerDay;
  } else if (deck.reviewsLimitType === 'deck') {
    reviewsLimit = deck.reviewsLimitValue ?? preset.maxReviewsPerDay;
  }

  return { newCardsLimit, reviewsLimit };
}

/**
 * Verifica se dois cartões são irmãos (siblings).
 * No modelo Anki, cartões irmãos são gerados pela mesma Nota base.
 */
export function areCardSiblings(cardA: Card, cardB: Card): boolean {
  if (!cardA.noteId || !cardB.noteId) return false;
  return cardA.noteId === cardB.noteId;
}

/**
 * Filtra, ordena e limita as cartas de um deck para gerar a fila de estudos atual.
 */
export function getDeckStudyableCards(
  deck: Deck,
  deckCards: Card[],
  preset: DeckPreset,
  counts: { newStudied: number; reviewsStudied: number },
  todayStr: string,
  decks?: Deck[],
  studiedCardIds?: Set<string>
) {
  const { newCardsLimit, reviewsLimit } = getEffectiveLimits(deck, preset, todayStr);

  const getDeckName = (card: Card): string => {
    if (!decks) return '';
    const d = decks.find((dk) => dk.id === card.deckId);
    return d ? d.name : '';
  };

  // 1. Ordenar revisões conforme reviewSorting
  let reviewCards = deckCards.filter(c => c.interval > 0 && c.repetitions > 1 && c.dueDate <= todayStr && !c.suspended);
  const sorting = preset.reviewSorting || 'dateThenRandom';

  if (sorting === 'random') {
    reviewCards = [...reviewCards].sort(() => Math.random() - 0.5);
  } else if (sorting === 'dateThenRandom') {
    reviewCards = [...reviewCards].sort((a, b) => {
      const cmp = a.dueDate.localeCompare(b.dueDate);
      if (cmp !== 0) return cmp;
      return Math.random() - 0.5;
    });
  } else if (sorting === 'dateThenDeck') {
    reviewCards = [...reviewCards].sort((a, b) => {
      const cmp = a.dueDate.localeCompare(b.dueDate);
      if (cmp !== 0) return cmp;
      return getDeckName(a).localeCompare(getDeckName(b));
    });
  } else if (sorting === 'deckThenDate') {
    reviewCards = [...reviewCards].sort((a, b) => {
      const cmp = getDeckName(a).localeCompare(getDeckName(b));
      if (cmp !== 0) return cmp;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sorting === 'intervalsAscending') {
    reviewCards = [...reviewCards].sort((a, b) => a.interval - b.interval);
  } else if (sorting === 'intervalsDescending') {
    reviewCards = [...reviewCards].sort((a, b) => b.interval - a.interval);
  } else if (sorting === 'easeAscending') {
    reviewCards = [...reviewCards].sort((a, b) => a.ease - b.ease);
  } else if (sorting === 'easeDescending') {
    reviewCards = [...reviewCards].sort((a, b) => b.ease - a.ease);
  } else if (sorting === 'retrievabilityAscending') {
    reviewCards = [...reviewCards].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  } else if (sorting === 'retrievabilityDescending') {
    reviewCards = [...reviewCards].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  } else if (sorting === 'oldest') {
    reviewCards = [...reviewCards].sort((a, b) => a.createdAt - b.createdAt);
  } else if (sorting === 'newest') {
    reviewCards = [...reviewCards].sort((a, b) => b.createdAt - a.createdAt);
  }
  
  // 2. Cartões em aprendizado (intradiário com interval === 0 e learningStep definido OR interdiário com interval > 0 mas repetições <= 1)
  const learningCards = deckCards.filter(c => 
    !c.suspended && (
      (c.interval === 0 && c.learningStep !== undefined) ||
      (c.interval > 0 && c.repetitions <= 1 && c.dueDate <= todayStr)
    )
  );
  
  // 3. Ordenar novos cartões (apenas os nunca estudados com interval === 0 e sem learningStep) conforme newCardGrouping / insertionOrder
  let newCards = deckCards.filter(c => c.interval === 0 && c.learningStep === undefined && !c.suspended);
  const grouping = preset.newCardGrouping || 'deck';

  if (grouping === 'deck' || grouping === 'deckThenRandom') {
    const groups: { [deckName: string]: Card[] } = {};
    newCards.forEach(c => {
      const name = getDeckName(c);
      if (!groups[name]) groups[name] = [];
      groups[name].push(c);
    });
    const sortedNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    let gathered: Card[] = [];
    sortedNames.forEach(name => {
      let groupCards = groups[name];
      if (grouping === 'deckThenRandom') {
        groupCards = [...groupCards].sort(() => Math.random() - 0.5);
      } else {
        // Fallback para ordenar por data de criação dentro de cada deck
        groupCards = [...groupCards].sort((a, b) => a.createdAt - b.createdAt);
      }
      gathered.push(...groupCards);
    });
    newCards = gathered;
  } else if (grouping === 'ascending') {
    newCards = [...newCards].sort((a, b) => a.createdAt - b.createdAt);
  } else if (grouping === 'descending') {
    newCards = [...newCards].sort((a, b) => b.createdAt - a.createdAt);
  } else {
    // randomNote ou randomCard ou preset.insertionOrder === 'random'
    newCards = [...newCards].sort(() => Math.random() - 0.5);
  }
  
  // 3.5. Filtro de Ocultação de Irmãos (Bury Siblings)
  const isLearningCard = (c: Card) => (c.interval === 0 && c.learningStep !== undefined) || (c.interval > 0 && c.repetitions <= 1 && c.dueDate <= todayStr);
  const isReviewCard = (c: Card) => c.interval > 0 && c.repetitions > 1 && c.dueDate <= todayStr;
  const isNewCard = (c: Card) => c.interval === 0 && c.learningStep === undefined;

  let keptLearning: Card[] = [...learningCards];
  let keptReviews: Card[] = [...reviewCards];
  let keptNew: Card[] = [...newCards];

  if (preset.buryNewSiblings || preset.buryReviewSiblings || preset.buryLearningSiblings) {
    const uncappedPriorityQueue = [...learningCards, ...reviewCards, ...newCards];
    const keptCards: Card[] = [];

    for (const card of uncappedPriorityQueue) {
      const hasStudiedSibling = Array.from(studiedCardIds || []).some(id => {
        const studiedCard = deckCards.find(c => c.id === id);
        return studiedCard ? areCardSiblings(card, studiedCard) : false;
      });

      const hasKeptSibling = keptCards.some(keptCard => areCardSiblings(card, keptCard));

      if (hasStudiedSibling || hasKeptSibling) {
        let shouldBury = false;
        if (isNewCard(card) && preset.buryNewSiblings) shouldBury = true;
        if (isReviewCard(card) && preset.buryReviewSiblings) shouldBury = true;
        if (isLearningCard(card) && preset.buryLearningSiblings) shouldBury = true;

        if (shouldBury) {
          continue; // Pula / enterra
        }
      }

      keptCards.push(card);
    }

    keptLearning = keptCards.filter(isLearningCard);
    keptReviews = keptCards.filter(isReviewCard);
    keptNew = keptCards.filter(isNewCard);
  }

  const reviewsRemaining = Math.max(0, reviewsLimit - counts.reviewsStudied);
  let newRemaining = Math.max(0, newCardsLimit - counts.newStudied);
  
  // Se novos cartões NÃO ignoram o limite de revisão e o limite de revisões foi atingido
  if (!preset.newCardsIgnoreReviewLimit && reviewsRemaining <= 0) {
    newRemaining = 0;
  }
  
  const cappedReviews = keptReviews.slice(0, reviewsRemaining);
  let cappedNew = keptNew.slice(0, newRemaining);

  // 4. Classificação de cartões novos conforme newCardSorting
  const sortingNew = preset.newCardSorting || 'template';
  if (sortingNew === 'random' || sortingNew === 'templateThenRandom') {
    cappedNew = [...cappedNew].sort(() => Math.random() - 0.5);
  }

  // Helper para misturar dois arrays de forma alternada
  const mixArrays = <T>(arr1: T[], arr2: T[]): T[] => {
    const mixed: T[] = [];
    const maxLen = Math.max(arr1.length, arr2.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < arr1.length) mixed.push(arr1[i]);
      if (i < arr2.length) mixed.push(arr2[i]);
    }
    return mixed;
  };
  
  // 5. Combinar de acordo com a ordem do preset
  // A: Combinar aprendizado e revisões conforme interdayLearningVsReviewOrder
  let learningAndReviews: Card[] = [];
  const learnOrder = preset.interdayLearningVsReviewOrder || 'mix';
  if (learnOrder === 'learningFirst') {
    learningAndReviews = [...keptLearning, ...cappedReviews];
  } else if (learnOrder === 'reviewFirst') {
    learningAndReviews = [...cappedReviews, ...keptLearning];
  } else {
    learningAndReviews = mixArrays(keptLearning, cappedReviews);
  }

  // B: Combinar com novos conforme newVsReviewOrder
  let combined: Card[] = [];
  const newOrder = preset.newVsReviewOrder || 'mix';
  if (newOrder === 'newFirst') {
    combined = [...cappedNew, ...learningAndReviews];
  } else if (newOrder === 'reviewFirst') {
    combined = [...learningAndReviews, ...cappedNew];
  } else {
    combined = mixArrays(cappedNew, learningAndReviews);
  }
  
  return {
    cards: combined,
    newCount: cappedNew.length,
    learningCount: keptLearning.length,
    reviewCount: cappedReviews.length,
    totalCount: cappedNew.length + keptLearning.length + cappedReviews.length
  };
}
