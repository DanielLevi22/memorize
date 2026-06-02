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
  minSpacing = 0.5
): TranscriptionLine[] => {
  if (lines.length === 0) return [];
  
  // Cria uma cópia profunda/superficial das linhas e as ordena pelo tempo inicial
  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 1; i < sorted.length; i++) {
    const prevTime = sorted[i - 1].startTime;
    const currTime = sorted[i].startTime;
    
    // Se a diferença de tempo for menor que o distanciamento mínimo, ajustamos
    if (currTime < prevTime + minSpacing) {
      sorted[i] = {
        ...sorted[i],
        startTime: parseFloat((prevTime + minSpacing).toFixed(2))
      };
    }
  }
  
  return sorted;
};
