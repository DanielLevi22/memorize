import type { TranscriptionLine } from '../types';

/**
 * Busca de letras já sincronizadas no LRCLIB (https://lrclib.net).
 *
 * Base pública, sem autenticação e com CORS liberado (`access-control-allow-origin: *`).
 * As letras são sincronizadas por pessoas, então a qualidade de tempo e de texto é
 * superior a qualquer transcrição automática — quando a música está catalogada.
 */

const LRCLIB_BASE = 'https://lrclib.net/api';

export interface LyricsSearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  /** Duração da faixa catalogada, em segundos — útil para conferir se é a versão certa */
  duration?: number;
  instrumental?: boolean;
  /** Letra em formato LRC com marcações de tempo. Ausente quando só há letra simples. */
  syncedLyrics?: string | null;
  /** Letra sem marcações de tempo */
  plainLyrics?: string | null;
}

/** Busca por texto livre (título, artista ou os dois juntos). */
export const searchLyrics = async (
  query: string,
  options: { signal?: AbortSignal; limit?: number } = {}
): Promise<LyricsSearchResult[]> => {
  const { signal, limit = 12 } = options;

  const trimmed = query.trim();
  if (!trimmed) return [];

  const response = await fetch(
    `${LRCLIB_BASE}/search?q=${encodeURIComponent(trimmed)}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(`LRCLIB retornou status ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.slice(0, limit).map((item: any) => ({
    id: item.id,
    trackName: item.trackName ?? item.name ?? '',
    artistName: item.artistName ?? '',
    albumName: item.albumName ?? undefined,
    duration: typeof item.duration === 'number' ? item.duration : undefined,
    instrumental: !!item.instrumental,
    syncedLyrics: item.syncedLyrics ?? null,
    plainLyrics: item.plainLyrics ?? null
  }));
};

/** Linha de metadado do LRC: [ti:...], [ar:...], [offset:...] etc. */
const METADATA_TAG = /^\[(ti|ar|al|au|by|re|ve|length|offset):(.*)\]$/i;
/** Marcação de tempo: [mm:ss.xx] — pode haver várias na mesma linha */
const TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

/**
 * Converte texto LRC em linhas com tempo.
 *
 * Trata o que o parser inline anterior ignorava: múltiplas marcações na mesma linha
 * (usado para repetir o mesmo verso em vários momentos), a tag `offset` (ajuste global
 * em milissegundos, com sinal invertido por convenção do formato) e linhas de metadado.
 */
export const parseLrcToLines = (
  lrcText: string,
  trackDuration?: number
): TranscriptionLine[] => {
  if (!lrcText) return [];

  const newId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);

  const rawLines = lrcText.replace(/\r\n/g, '\n').split('\n');
  const collected: { text: string; startTime: number }[] = [];
  let offsetSeconds = 0;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    const metadata = METADATA_TAG.exec(line);
    if (metadata) {
      if (metadata[1].toLowerCase() === 'offset') {
        const ms = parseFloat(metadata[2]);
        // Por convenção do LRC, offset positivo ADIANTA a letra, então o sinal inverte
        if (!isNaN(ms)) offsetSeconds = -ms / 1000;
      }
      continue;
    }

    TIME_TAG.lastIndex = 0;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = TIME_TAG.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2].replace(':', '.'));
      if (!isNaN(minutes) && !isNaN(seconds)) {
        timestamps.push(minutes * 60 + seconds);
      }
    }

    if (timestamps.length === 0) continue;

    const text = line.replace(TIME_TAG, '').trim();
    // Versos vazios existem no LRC para marcar pausas; não viram linha de letra
    if (!text) continue;

    for (const timestamp of timestamps) {
      collected.push({ text, startTime: Math.max(0, timestamp + offsetSeconds) });
    }
  }

  collected.sort((a, b) => a.startTime - b.startTime);

  return collected.map((entry, idx) => {
    const next = collected[idx + 1];
    const endTime = next ? next.startTime : trackDuration;
    return {
      id: newId(),
      text: entry.text,
      startTime: parseFloat(entry.startTime.toFixed(2)),
      endTime: endTime !== undefined ? parseFloat(endTime.toFixed(2)) : undefined
    };
  });
};

/**
 * Serializa linhas com tempo de volta para o formato LRC (exportação).
 * Inverte `parseLrcToLines` para os casos simples (uma marcação por linha).
 */
export const formatLrc = (
  lines: { text: string; startTime: number }[],
  title: string
): string => {
  const stamp = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = (seconds % 60).toFixed(2);
    return `[${String(min).padStart(2, '0')}:${sec.padStart(5, '0')}]`;
  };

  const header = `[ti:${title}]\n`;
  const body = lines.map(l => `${stamp(l.startTime)} ${l.text}`).join('\n');
  return `${header}${body}\n`;
};

/** Converte letra simples (sem tempo) em linhas, para alinhar ou sincronizar depois. */
export const parsePlainLyricsToLines = (plainText: string): TranscriptionLine[] => {
  const newId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);

  return plainText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(text => ({ id: newId(), text, startTime: 0, endTime: undefined }));
};
