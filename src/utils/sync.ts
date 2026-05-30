import { db } from '../db/db';
import type { Deck, Card, Note, Revision, DeckPreset, ReadingText, ReadingSession, ReadingCollection, ChatMessage } from '../types';

// Helper to convert Blob to base64 data URL
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper to convert base64 data URL back to Blob
async function base64ToBlob(base64DataUrl: string): Promise<Blob> {
  const res = await fetch(base64DataUrl);
  return await res.blob();
}

export interface ExportPayload {
  version: string;
  exportType: string;
  decks: Deck[];
  cards: any[];
  notes: any[];
  revisions: Revision[];
  presets: DeckPreset[];
  readings: any[];
  readingSessions: ReadingSession[];
  readingCollections: ReadingCollection[];
  chatMessages: ChatMessage[];
  exportedAt: number;
}

/**
 * Exporta toda a base de dados do IndexedDB em um único objeto JSON serializável.
 */
export async function exportDatabase(): Promise<ExportPayload> {
  const decks = await db.decks.toArray();
  const rawCards = await db.cards.toArray();
  const rawNotes = await db.notes.toArray();
  const revisions = await db.revisions.toArray();
  const presets = await db.presets.toArray();
  const rawReadings = await db.readings.toArray();
  const readingSessions = await db.readingSessions.toArray();
  const readingCollections = await db.readingCollections.toArray();
  const chatMessages = await db.chatMessages.toArray();

  // Serializa cartões (áudios em base64)
  const cards = [];
  for (const card of rawCards) {
    let audioBase64 = undefined;
    if (card.audio) {
      audioBase64 = await blobToBase64(card.audio);
    }
    const { audio, ...rest } = card;
    cards.push({ ...rest, audioBase64 });
  }

  // Serializa notas (áudios em base64)
  const notes = [];
  for (const note of rawNotes) {
    let audioBase64 = undefined;
    if (note.audio) {
      audioBase64 = await blobToBase64(note.audio);
    }
    const { audio, ...rest } = note;
    notes.push({ ...rest, audioBase64 });
  }

  // Serializa leituras (PDFs em base64)
  const readings = [];
  for (const reading of rawReadings) {
    let pdfFileBase64 = undefined;
    if (reading.pdfFile) {
      pdfFileBase64 = await blobToBase64(reading.pdfFile);
    }
    const { pdfFile, ...rest } = reading;
    readings.push({ ...rest, pdfFileBase64 });
  }

  return {
    version: '1.1',
    exportType: 'full-sync',
    decks,
    cards,
    notes,
    revisions,
    presets,
    readings,
    readingSessions,
    readingCollections,
    chatMessages,
    exportedAt: Date.now(),
  };
}

/**
 * Função genérica para sincronizar tabelas com base no campo updatedAt.
 */
async function mergeTable<T extends { id: string; updatedAt?: number }>(
  table: any,
  remoteItems: any[] | undefined,
  blobConverter?: (item: any) => Promise<T>
) {
  if (!remoteItems) return;

  const localItems = await table.toArray();
  const localMap = new Map<string, T>(localItems.map((item: any) => [item.id, item]));

  for (let remoteItem of remoteItems) {
    if (blobConverter) {
      remoteItem = await blobConverter(remoteItem);
    }

    const localItem = localMap.get(remoteItem.id);
    if (!localItem) {
      // Adiciona o item se não existir localmente
      await table.add(remoteItem);
    } else {
      // Se existir, atualiza apenas se a versão remota for mais recente
      const remoteUpdate = remoteItem.updatedAt || 0;
      const localUpdate = localItem.updatedAt || 0;
      if (remoteUpdate > localUpdate) {
        await table.put(remoteItem);
      }
    }
  }
}

/**
 * Função genérica para tabelas de log (histórico) append-only.
 * Apenas adiciona registros que não existem localmente.
 */
async function mergeLogTable<T extends { id: string }>(table: any, remoteItems: T[] | undefined) {
  if (!remoteItems) return;

  const localItems = await table.toArray();
  const localIds = new Set<string>(localItems.map((item: any) => item.id));

  const itemsToAdd: T[] = [];
  for (const remoteItem of remoteItems) {
    if (!localIds.has(remoteItem.id)) {
      itemsToAdd.push(remoteItem);
    }
  }

  if (itemsToAdd.length > 0) {
    await table.bulkAdd(itemsToAdd);
  }
}

/**
 * Mescla os dados remotos obtidos do Google Drive com o banco de dados IndexedDB local.
 * Implementa a estratégia de sincronização de duas vias (Two-way smart merge).
 */
export async function performMergeSync(remotePayload: ExportPayload): Promise<void> {
  // 1. Sincronizar Presets
  await mergeTable<DeckPreset>(db.presets, remotePayload.presets);

  // 2. Sincronizar Coleções de Leitura
  await mergeTable<ReadingCollection>(db.readingCollections, remotePayload.readingCollections);

  // 3. Sincronizar Decks
  await mergeTable<Deck>(db.decks, remotePayload.decks);

  // 4. Sincronizar Notas (convertendo áudios de base64 de volta para Blob)
  await mergeTable<Note>(db.notes, remotePayload.notes, async (note) => {
    let audio: Blob | undefined = undefined;
    if (note.audioBase64) {
      audio = await base64ToBlob(note.audioBase64);
    }
    const { audioBase64, ...rest } = note;
    return { ...rest, audio } as Note;
  });

  // 5. Sincronizar Cartões (convertendo áudios de base64 de volta para Blob)
  await mergeTable<Card>(db.cards, remotePayload.cards, async (card) => {
    let audio: Blob | undefined = undefined;
    if (card.audioBase64) {
      audio = await base64ToBlob(card.audioBase64);
    }
    const { audioBase64, ...rest } = card;
    return { ...rest, audio } as Card;
  });

  // 6. Sincronizar Textos de Leitura (convertendo PDFs de base64 de volta para Blob)
  await mergeTable<ReadingText>(db.readings, remotePayload.readings, async (reading) => {
    let pdfFile: Blob | undefined = undefined;
    if (reading.pdfFileBase64) {
      pdfFile = await base64ToBlob(reading.pdfFileBase64);
    }
    const { pdfFileBase64, ...rest } = reading;
    return { ...rest, pdfFile } as ReadingText;
  });

  // 7. Sincronizar Histórico/Log (Revisões, Sessões de Leitura, Mensagens de Chat)
  await mergeLogTable<Revision>(db.revisions, remotePayload.revisions);
  await mergeLogTable<ReadingSession>(db.readingSessions, remotePayload.readingSessions);
  await mergeLogTable<ChatMessage>(db.chatMessages, remotePayload.chatMessages);
}
