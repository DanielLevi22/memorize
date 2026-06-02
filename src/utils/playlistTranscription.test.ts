import { describe, it, expect } from 'vitest';
import { findSilenceSplitPoints, bufferToWav, adjustTimestampsSafeguard } from './audioChunker';
import type { TranscriptionLine } from '../types';

/**
 * Utilitário para criar um AudioBuffer simulado para os testes.
 */
const createMockAudioBuffer = (
  duration: number,
  sampleRate: number,
  numberOfChannels: number,
  fillVal = 0.5
): AudioBuffer => {
  const length = duration * sampleRate;
  const channelDataArray = Array.from(
    { length: numberOfChannels },
    () => new Float32Array(length).fill(fillVal)
  );

  return {
    duration,
    sampleRate,
    numberOfChannels,
    length,
    getChannelData: (channel: number) => channelDataArray[channel],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
};

describe('audioChunker Unit Tests', () => {
  describe('findSilenceSplitPoints', () => {
    it('deve retornar pontos de início e fim corretos e lidar com áudio curto', () => {
      const mockBuffer = createMockAudioBuffer(15, 8000, 1);
      const splitPoints = findSilenceSplitPoints(mockBuffer, 30);
      
      // Para duração menor que o targetChunkSize (15s < 30s), deve conter apenas [0, 15]
      expect(splitPoints).toEqual([0, 15]);
    });

    it('deve identificar pontos de silêncio (menor amplitude)', () => {
      const sampleRate = 8000;
      const duration = 45; // 45 segundos
      const mockBuffer = createMockAudioBuffer(duration, sampleRate, 1, 0.8); // Áudio com barulho
      
      // Injetamos um silêncio (amplitude = 0) na janela de busca ao redor de 30s (de 27s a 33s)
      // Vamos colocar silêncio de 29s a 31s
      const channelData = mockBuffer.getChannelData(0);
      const silenceStart = 29 * sampleRate;
      const silenceEnd = 31 * sampleRate;
      for (let i = silenceStart; i < silenceEnd; i++) {
        channelData[i] = 0.0;
      }

      const splitPoints = findSilenceSplitPoints(mockBuffer, 30);
      
      // O splitPoint deve estar próximo do meio da nossa janela de silêncio (aproximadamente 30s)
      expect(splitPoints.length).toBe(3); // [0, bestSplitTime, 45]
      expect(splitPoints[0]).toBe(0);
      expect(splitPoints[1]).toBeGreaterThanOrEqual(28.5);
      expect(splitPoints[1]).toBeLessThanOrEqual(31.5);
      expect(splitPoints[2]).toBe(45);
    });
  });

  describe('bufferToWav', () => {
    it('deve codificar uma porção do AudioBuffer para um Blob WAV com cabeçalho RIFF válido', async () => {
      const sampleRate = 8000;
      const duration = 2; // 2 segundos
      const mockBuffer = createMockAudioBuffer(duration, sampleRate, 1, 0.1);
      
      // Extrai 1 segundo de áudio (de 0.5s a 1.5s)
      const start = 0.5;
      const end = 1.5;
      const wavBlob = bufferToWav(mockBuffer, start, end);
      
      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');

      // Tamanho esperado do WAV: 44 bytes de cabeçalho + (1 segundo * 8000 samples * 1 canal * 2 bytes/sample)
      const expectedSize = 44 + (1 * sampleRate * 1 * 2);
      expect(wavBlob.size).toBe(expectedSize);

      // Valida os bytes iniciais do cabeçalho RIFF/WAVE
      const arrayBuffer = await wavBlob.arrayBuffer();
      const view = new DataView(arrayBuffer);
      
      // Byte 0-3: 'RIFF'
      const chunkId = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      expect(chunkId).toBe('RIFF');

      // Byte 8-11: 'WAVE'
      const format = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      expect(format).toBe('WAVE');

      // Byte 12-15: 'fmt '
      const subchunk1Id = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
      expect(subchunk1Id).toBe('fmt ');

      // Byte 20-21: AudioFormat (1 para PCM linear)
      expect(view.getUint16(20, true)).toBe(1);

      // Byte 22-23: NumChannels
      expect(view.getUint16(22, true)).toBe(1);

      // Byte 24-27: SampleRate
      expect(view.getUint32(24, true)).toBe(sampleRate);
    });
  });

  describe('adjustTimestampsSafeguard', () => {
    it('deve ordenar as frases por tempo inicial', () => {
      const lines: TranscriptionLine[] = [
        { id: '1', text: 'Linha 3', startTime: 15.0 },
        { id: '2', text: 'Linha 1', startTime: 5.0 },
        { id: '3', text: 'Linha 2', startTime: 10.0 }
      ];

      const adjusted = adjustTimestampsSafeguard(lines);
      
      expect(adjusted[0].text).toBe('Linha 1');
      expect(adjusted[1].text).toBe('Linha 2');
      expect(adjusted[2].text).toBe('Linha 3');
      expect(adjusted[0].startTime).toBe(5.0);
      expect(adjusted[1].startTime).toBe(10.0);
      expect(adjusted[2].startTime).toBe(15.0);
    });

    it('deve forçar distanciamento mínimo cronológico em frases simultâneas ou sobrepostas', () => {
      const lines: TranscriptionLine[] = [
        { id: '1', text: 'A', startTime: 5.0 },
        { id: '2', text: 'B', startTime: 5.0 }, // Mesmo tempo que A
        { id: '3', text: 'C', startTime: 4.8 }, // Tempo menor que A (deve ir antes de A após ordenar, mas vamos ver)
        { id: '4', text: 'D', startTime: 5.2 }  // Tempo ligeiramente superior que A
      ];

      // Ordenação inicial esperada por tempo bruto:
      // C (4.8), A (5.0), B (5.0), D (5.2)
      
      const adjusted = adjustTimestampsSafeguard(lines, 0.5);
      
      // Resultados após ajuste:
      // Index 0: C -> 4.8 (mantido)
      // Index 1: A -> 5.0 (5.0 > 4.8 + 0.5? Não, 5.0 < 5.3, então vira 4.8 + 0.5 = 5.3)
      // Index 2: B -> 5.0 (inicialmente 5.0, ajustado para ser > anterior(5.3) + 0.5 = 5.8)
      // Index 3: D -> 5.2 (inicialmente 5.2, ajustado para ser > anterior(5.8) + 0.5 = 6.3)
      
      expect(adjusted[0].text).toBe('C');
      expect(adjusted[0].startTime).toBe(4.8);
      
      expect(adjusted[1].text).toBe('A');
      expect(adjusted[1].startTime).toBe(5.3);
      
      expect(adjusted[2].text).toBe('B');
      expect(adjusted[2].startTime).toBe(5.8);
      
      expect(adjusted[3].text).toBe('D');
      expect(adjusted[3].startTime).toBe(6.3);
    });
  });
});
