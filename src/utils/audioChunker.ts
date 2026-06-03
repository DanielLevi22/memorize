import type { TranscriptionLine } from '../types';

/**
 * Decodifica um arquivo de áudio (Blob/File) para um AudioBuffer usando a Web Audio API.
 */
export const decodeAudioFile = async (file: Blob): Promise<AudioBuffer> => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API (AudioContext) não é suportado neste navegador.');
  }
  const audioCtx = new AudioContextClass();
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }
};

/**
 * Encontra pontos de corte baseados em silêncio ou baixa energia de áudio próximos ao tamanho de chunk desejado.
 * Evita cortar no meio de palavras ou frases ativas.
 */
export const findSilenceSplitPoints = (
  audioBuffer: AudioBuffer,
  targetChunkSize = 30
): number[] => {
  const duration = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  
  // Usamos apenas o primeiro canal para detecção de silêncio para fins de performance
  const channelData = audioBuffer.getChannelData(0);
  
  const splitPoints: number[] = [0];
  let currentTime = 0;
  
  while (currentTime + targetChunkSize < duration) {
    const targetTime = currentTime + targetChunkSize;
    
    // Procura por silêncio em uma janela de +/- 3 segundos ao redor do tempo desejado
    const searchRange = 3;
    const startSearch = Math.max(0, targetTime - searchRange);
    const endSearch = Math.min(duration, targetTime + searchRange);
    
    const startSample = Math.floor(startSearch * sampleRate);
    const endSample = Math.floor(endSearch * sampleRate);
    
    const windowSize = Math.floor(0.1 * sampleRate); // Janela de análise de 100ms
    const stepSize = Math.floor(0.05 * sampleRate);  // Passos de 50ms
    
    let minEnergy = Infinity;
    let bestSplitTime = targetTime;
    
    // Analisa a energia média absoluta nas janelas de busca
    for (let i = startSample; i < endSample - windowSize; i += stepSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        energy += Math.abs(channelData[i + j]);
      }
      energy /= windowSize;
      
      if (energy < minEnergy) {
        minEnergy = energy;
        bestSplitTime = (i + windowSize / 2) / sampleRate;
      }
    }
    
    splitPoints.push(bestSplitTime);
    currentTime = bestSplitTime;
  }
  
  splitPoints.push(duration);
  return splitPoints;
};

/**
 * Converte um trecho de um AudioBuffer (de startOffset a endOffset em segundos) para um Blob no formato WAV de 16 bits PCM.
 */
export const bufferToWav = (
  buffer: AudioBuffer,
  startOffset: number,
  endOffset: number
): Blob => {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  
  const startSample = Math.max(0, Math.floor(startOffset * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endOffset * sampleRate));
  const length = endSample - startSample;
  
  const bufferLength = length * numChannels * 2; // 16-bit PCM (2 bytes por sample)
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);
  
  const writeString = (dataView: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      dataView.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // File length minus RIFF header size (8 bytes)
  view.setUint32(4, 36 + bufferLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // Format chunk identifier
  writeString(view, 12, 'fmt ');
  // Format chunk size (16)
  view.setUint32(16, 16, true);
  // Sample format (raw PCM = 1)
  view.setUint16(20, 1, true);
  // Channel count
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate = sampleRate * numChannels * bitsPerSample/8
  view.setUint32(28, sampleRate * numChannels * 2, true);
  // Block align = numChannels * bitsPerSample/8
  view.setUint16(32, numChannels * 2, true);
  // Bits per sample (16)
  view.setUint16(34, 16, true);
  // Data chunk identifier
  writeString(view, 36, 'data');
  // Data chunk size
  view.setUint32(40, bufferLength, true);
  
  // Copia as trilhas de canais e as intercala em PCM 16 bits
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = startSample; i < endSample; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      // Clampa os limites
      sample = Math.max(-1, Math.min(1, sample));
      // Converte para Int16
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, val, true);
      offset += 2;
    }
  }
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
};

/**
 * Garante que a lista de linhas de transcrição esteja estritamente ordenada de forma cronológica crescente,
 * aplicando um distanciamento mínimo entre frases para evitar sobreposição ou saltos rápidos indesejados.
 */
export const adjustTimestampsSafeguard = (
  lines: TranscriptionLine[],
  minSpacing = 0.5,
  trackDuration?: number
): TranscriptionLine[] => {
  if (lines.length === 0) return [];
  
  // Ordena pelo tempo de início inicial
  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  
  // 1. Ajusta os tempos de início garantindo o distanciamento mínimo
  for (let i = 1; i < sorted.length; i++) {
    const prevTime = sorted[i - 1].startTime;
    const currTime = sorted[i].startTime;
    
    if (currTime < prevTime + minSpacing) {
      sorted[i] = {
        ...sorted[i],
        startTime: parseFloat((prevTime + minSpacing).toFixed(2))
      };
    }
  }

  // 2. Ajusta os tempos de término para evitar sobreposição de telas e durações negativas
  for (let i = 0; i < sorted.length; i++) {
    const line = sorted[i];
    const nextLine = sorted[i + 1];
    
    let end = line.endTime;
    
    // Se o tempo de término for indefinido ou inconsistente com a início, atribuímos uma duração padrão de 3.0s
    if (end === undefined || end <= line.startTime) {
      end = line.startTime + 3.0;
    }
    
    // Se ultrapassar o início da próxima linha, limita-se a ela
    if (nextLine && end > nextLine.startTime) {
      end = nextLine.startTime;
    }
    
    // Se ultrapassar a duração total da faixa, limita-se a ela
    if (trackDuration !== undefined && end > trackDuration) {
      end = trackDuration;
    }
    
    // Garante que haja pelo menos uma duração minúscula positiva
    if (end <= line.startTime) {
      end = line.startTime + 0.1;
    }
    
    sorted[i] = {
      ...line,
      endTime: parseFloat(end.toFixed(2))
    };
  }
  
  return sorted;
};

/**
 * Converte um AudioBuffer completo para um Blob no formato WAV Mono a 16000Hz (16kHz).
 * Ideal para enviar arquivos comprimidos e leves para APIs de transcrição e alinhamento forçado.
 */
export const bufferToMono16kWav = (buffer: AudioBuffer): Blob => {
  const targetSampleRate = 16000;
  const numChannels = buffer.numberOfChannels;
  const originalSampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  
  // 1. Mescla para Mono se tiver múltiplos canais
  const monoData = new Float32Array(numSamples);
  if (numChannels === 1) {
    monoData.set(buffer.getChannelData(0));
  } else {
    const channelsData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channelsData.push(buffer.getChannelData(c));
    }
    for (let i = 0; i < numSamples; i++) {
      let sum = 0;
      for (let c = 0; c < numChannels; c++) {
        sum += channelsData[c][i];
      }
      monoData[i] = sum / numChannels;
    }
  }
  
  // 2. Reamostra para 16kHz usando interpolação linear
  let resampledData: Float32Array;
  if (originalSampleRate === targetSampleRate) {
    resampledData = monoData;
  } else {
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(numSamples / ratio);
    resampledData = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;
      const indexNext = Math.min(numSamples - 1, index + 1);
      
      const sample = monoData[index];
      const sampleNext = monoData[indexNext];
      resampledData[i] = sample + fraction * (sampleNext - sample);
    }
  }
  
  // 3. Monta cabeçalho WAV (PCM 16-bit, Mono, 16000Hz)
  const bufferLength = resampledData.length * 2;
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);
  
  const writeString = (dataView: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      dataView.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM = 1
  view.setUint16(22, 1, true); // Mono = 1
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 1 * 2, true); // byteRate
  view.setUint16(32, 2, true); // blockAlign
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, bufferLength, true);
  
  // Escreve os samples de áudio reamostrados
  let offset = 44;
  for (let i = 0; i < resampledData.length; i++) {
    let sample = resampledData[i];
    sample = Math.max(-1, Math.min(1, sample));
    const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }
  
  return new Blob([wavBuffer], { type: 'audio/wav' });
};

/**
 * Realiza o alinhamento textual fuzzy (client-side) entre a letra de referência colada pelo usuário
 * e as frases transcritas pelo Whisper, associando os timestamps corretos.
 * Pula alucinações (segmentos com baixo score de overlap) e interpola tempos para linhas não encontradas.
 */
export const alignLyricsLocal = (
  referenceLines: string[],
  transcribedSegments: TranscriptionLine[]
): TranscriptionLine[] => {
  if (referenceLines.length === 0) return [];
  
  const cleanString = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const wordsAreSimilar = (w1: string, w2: string): boolean => {
    if (w1 === w2) return true;
    if (w1.length < 3 || w2.length < 3) return false;
    return w1.includes(w2) || w2.includes(w1);
  };

  // 1. Achatar os segmentos em palavras com timestamps
  const transcribedWords: { text: string; startTime: number; endTime: number }[] = [];
  for (const seg of transcribedSegments) {
    const text = seg.text.trim();
    if (!text) continue;
    const rawWords = text.split(/\s+/);
    const startTime = seg.startTime;
    const endTime = seg.endTime ?? (seg.startTime + 3.0);
    const duration = endTime - startTime;
    const wordDuration = duration / Math.max(1, rawWords.length);

    for (let i = 0; i < rawWords.length; i++) {
      const cleaned = cleanString(rawWords[i]);
      if (cleaned) {
        transcribedWords.push({
          text: cleaned,
          startTime: startTime + i * wordDuration,
          endTime: startTime + (i + 1) * wordDuration
        });
      }
    }
  }

  if (transcribedWords.length === 0) {
    // Se não transcreveu nenhuma palavra, distribui por igual
    return referenceLines.map((line, idx) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      text: line.trim(),
      startTime: idx * 3.0,
      endTime: (idx + 1) * 3.0
    }));
  }

  const aligned: TranscriptionLine[] = [];
  let wordPtr = 0;

  for (let i = 0; i < referenceLines.length; i++) {
    const refLine = referenceLines[i];
    const cleanRef = cleanString(refLine);
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

    if (!cleanRef) {
      aligned.push({ id, text: refLine, startTime: 0, endTime: 0 });
      continue;
    }

    const refWords = cleanRef.split(' ').filter(Boolean);
    const matchedIndices: number[] = [];
    let currentSearchStart = wordPtr;

    // Para cada palavra da linha de referência, procura nos próximos 30 palavras transcritas
    for (const refW of refWords) {
      const searchLimit = Math.min(transcribedWords.length, currentSearchStart + 30);
      let foundIdx = -1;
      for (let k = currentSearchStart; k < searchLimit; k++) {
        if (wordsAreSimilar(refW, transcribedWords[k].text)) {
          foundIdx = k;
          break;
        }
      }
      if (foundIdx !== -1) {
        matchedIndices.push(foundIdx);
        currentSearchStart = foundIdx + 1; // Avança busca para a próxima palavra
      }
    }

    // Se conseguirmos casar pelo menos uma parte significativa (pelo menos 15% das palavras)
    const minMatches = Math.max(1, Math.ceil(refWords.length * 0.15));
    if (matchedIndices.length >= minMatches) {
      const firstIdx = matchedIndices[0];
      const lastIdx = matchedIndices[matchedIndices.length - 1];
      
      aligned.push({
        id,
        text: refLine,
        startTime: parseFloat(transcribedWords[firstIdx].startTime.toFixed(2)),
        endTime: parseFloat(transcribedWords[lastIdx].endTime.toFixed(2))
      });
      
      wordPtr = lastIdx + 1;
    } else {
      // Se não casou, coloca tempo temporário baseado na última linha
      const lastTime = aligned.length > 0 ? (aligned[aligned.length - 1].endTime ?? aligned[aligned.length - 1].startTime) : 0;
      aligned.push({
        id,
        text: refLine,
        startTime: lastTime,
        endTime: lastTime + 2.0
      });
    }
  }

  // Interpolação e salvaguarda: Garante cronologia crescente estrita
  for (let i = 0; i < aligned.length; i++) {
    const line = aligned[i];
    if (i > 0) {
      const prevLine = aligned[i - 1];
      const prevEndTime = prevLine.endTime ?? (prevLine.startTime + 2.0);
      if (line.startTime < prevLine.startTime) {
        aligned[i] = {
          ...line,
          startTime: prevEndTime,
          endTime: prevEndTime + 2.0
        };
      }
    }
  }

  return aligned;
};


