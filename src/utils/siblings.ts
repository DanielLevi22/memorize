import type { Card, Note } from '../types';

/**
 * Encontra todos os índices distintos de cloze no formato {{c1::palavra}}
 * Exemplo: "O cachorro {{c1::latia}} no {{c2::quintal}}." -> [1, 2]
 */
export function getClozeIndexes(text: string): number[] {
  const regex = /\{\{c(\d+)::/g;
  const indexes = new Set<number>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    indexes.add(parseInt(match[1], 10));
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

/**
 * Formata o texto da frente (pergunta) para um determinado cloze index.
 * Exemplo para index 1:
 * "O cachorro {{c1::latia::dica}} no {{c2::quintal}}." -> "O cachorro [dica] no quintal."
 */
export function formatClozePrompt(text: string, activeIndex: number): string {
  const regex = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;
  return text.replace(regex, (_, idxStr, word, hint) => {
    const idx = parseInt(idxStr, 10);
    if (idx === activeIndex) {
      return hint ? `[${hint}]` : '[...]';
    } else {
      return word;
    }
  });
}

/**
 * Formata a resposta (verso) para um determinado cloze index.
 * Exemplo para index 1:
 * "O cachorro {{c1::latia::dica}} no {{c2::quintal}}." -> "latia"
 */
export function formatClozeAnswer(text: string, activeIndex: number, extraText: string = ''): string {
  const regex = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;
  const answers: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const idx = parseInt(match[1], 10);
    if (idx === activeIndex) {
      answers.push(match[2]);
    }
  }
  
  const mainAnswer = answers.join(', ');
  if (!mainAnswer) return extraText;
  return extraText ? `${mainAnswer}\n\n${extraText}` : mainAnswer;
}

interface RequiredCardDef {
  cardType: 'forward' | 'reversed';
  clozeIndex?: number;
  front: string;
  back: string;
}

/**
 * Compara a nota atual com seus cartões existentes e calcula quais cartões devem ser
 * adicionados, atualizados ou removidos do banco.
 */
export function syncNoteCards(
  note: Note,
  existingCards: Card[]
): { toAdd: Card[]; toUpdate: Card[]; toDelete: string[] } {
  const reqDefs: RequiredCardDef[] = [];

  if (note.type === 'basic' || note.type === 'typing') {
    reqDefs.push({
      cardType: 'forward',
      front: note.fields[0] || '',
      back: note.fields[1] || '',
    });
  } else if (note.type === 'reversed') {
    reqDefs.push({
      cardType: 'forward',
      front: note.fields[0] || '',
      back: note.fields[1] || '',
    });
    reqDefs.push({
      cardType: 'reversed',
      front: note.fields[1] || '',
      back: note.fields[0] || '',
    });
  } else if (note.type === 'optional_reversed') {
    reqDefs.push({
      cardType: 'forward',
      front: note.fields[0] || '',
      back: note.fields[1] || '',
    });
    const addReverse = note.fields[2]?.trim() || '';
    if (addReverse !== '') {
      reqDefs.push({
        cardType: 'reversed',
        front: note.fields[1] || '',
        back: note.fields[0] || '',
      });
    }
  } else if (note.type === 'cloze') {
    const text = note.fields[0] || '';
    const extra = note.fields[1] || '';
    const clozeIndexes = getClozeIndexes(text);

    // Se nenhum cloze for encontrado, gera pelo menos 1 card para evitar erros
    if (clozeIndexes.length === 0) {
      reqDefs.push({
        cardType: 'forward',
        clozeIndex: 1,
        front: text,
        back: extra,
      });
    } else {
      clozeIndexes.forEach((idx) => {
        reqDefs.push({
          cardType: 'forward',
          clozeIndex: idx,
          front: formatClozePrompt(text, idx),
          back: formatClozeAnswer(text, idx, extra),
        });
      });
    }
  }

  const toAdd: Card[] = [];
  const toUpdate: Card[] = [];
  const matchedExistingIds = new Set<string>();

  // Mapeia os required definitions para cartões existentes
  reqDefs.forEach((def) => {
    // Procura por um card existente compatível
    const foundCard = existingCards.find((exc) => {
      if (matchedExistingIds.has(exc.id)) return false;

      if (note.type === 'cloze') {
        return exc.clozeIndex === def.clozeIndex;
      } else {
        return exc.cardType === def.cardType;
      }
    });

    if (foundCard) {
      matchedExistingIds.add(foundCard.id);
      
      // Atualiza os campos derivados da Nota
      const updatedCard: Card = {
        ...foundCard,
        deckId: note.deckId,
        front: def.front,
        back: def.back,
        context: note.context,
        audio: note.audio,
        tags: note.tags,
        updatedAt: Date.now(),
      };
      toUpdate.push(updatedCard);
    } else {
      // Cria um novo cartão
      const todayStr = new Date().toISOString().split('T')[0];
      const newCard: Card = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 15),
        deckId: note.deckId,
        noteId: note.id,
        front: def.front,
        back: def.back,
        context: note.context,
        audio: note.audio,
        tags: note.tags,
        clozeIndex: def.clozeIndex,
        cardType: def.cardType,
        
        // SRS fields iniciais
        interval: 0,
        ease: 2.5,
        repetitions: 0,
        lapses: 0,
        dueDate: todayStr,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      toAdd.push(newCard);
    }
  });

  // Todos os cartões existentes que não foram pareados devem ser excluídos
  const toDelete = existingCards
    .filter((exc) => !matchedExistingIds.has(exc.id))
    .map((exc) => exc.id);

  return { toAdd, toUpdate, toDelete };
}
