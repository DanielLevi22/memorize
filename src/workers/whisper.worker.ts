import { pipeline, env } from '@huggingface/transformers';

// Configura o cache do transformers para usar caminhos estritamente remotos (downloads serão guardados no Cache Storage do navegador)
env.allowLocalModels = false;

let transcriber: any = null;

/**
 * Reamostra um buffer de áudio Float32Array para 16000Hz (frequência exigida pelo Whisper).
 */
function resampleTo16k(audioBuffer: Float32Array, originalSampleRate: number): Float32Array {
  if (originalSampleRate === 16000) {
    return audioBuffer;
  }
  const ratio = originalSampleRate / 16000;
  const newLength = Math.round(audioBuffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const nextOffset = Math.round(i * ratio);
    result[i] = audioBuffer[Math.min(audioBuffer.length - 1, nextOffset)];
  }
  return result;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, audioData, sampleRate, modelName = 'onnx-community/whisper-tiny' } = event.data;

  if (type === 'start') {
    try {
      if (!transcriber) {
        self.postMessage({ type: 'status', message: 'Carregando modelo Whisper local...' });

        const progress_callback = (data: any) => {
          if (data.status === 'progress') {
            self.postMessage({
              type: 'loading',
              file: data.file,
              progress: data.progress,
              loadedBytes: data.loaded,
              totalBytes: data.total
            });
          }
        };

        // Usa fp16 por padrão em modelos maiores para economizar VRAM/RAM e acelerar o processamento
        let dtype: any = 'fp32';
        if (modelName.includes('small') || modelName.includes('medium') || modelName.includes('large')) {
          dtype = 'fp16';
        }

        try {
          console.log(`[WhisperWorker] Tentando inicializar ${modelName} com WebGPU e dtype ${dtype}...`);
          transcriber = await pipeline('automatic-speech-recognition', modelName, {
            device: 'webgpu',
            dtype: dtype,
            progress_callback
          });
        } catch (webgpuErr: any) {
          console.warn(`[WhisperWorker] Falha ao carregar com WebGPU e dtype ${dtype}. Tentando fallback...`, webgpuErr);
          
          if (dtype === 'fp16') {
            try {
              console.log(`[WhisperWorker] Tentando fallback para WebGPU com dtype fp32...`);
              transcriber = await pipeline('automatic-speech-recognition', modelName, {
                device: 'webgpu',
                dtype: 'fp32',
                progress_callback
              });
            } catch (fp32Err: any) {
              console.warn(`[WhisperWorker] Falha ao carregar com WebGPU e dtype fp32. Tentando CPU...`, fp32Err);
              // Fallback definitivo para CPU (WASM) com fp32
              transcriber = await pipeline('automatic-speech-recognition', modelName, {
                device: 'cpu',
                dtype: 'fp32',
                progress_callback
              });
            }
          } else {
            console.warn(`[WhisperWorker] Falha ao carregar com WebGPU. Tentando CPU...`, webgpuErr);
            // Fallback definitivo para CPU (WASM) com fp32
            transcriber = await pipeline('automatic-speech-recognition', modelName, {
              device: 'cpu',
              dtype: 'fp32',
              progress_callback
            });
          }
        }
      }

      self.postMessage({ type: 'status', message: 'Processando áudio...' });

      // Reamostra o áudio para 16kHz
      const audio16k = resampleTo16k(audioData, sampleRate);

      self.postMessage({ type: 'status', message: 'Transcrevendo áudio localmente...' });

      // Executa a transcrição com carimbo de tempo e parâmetros anti-alucinação
      const result = await transcriber(audio16k, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        language: null, // Auto-detecta o idioma falado/cantado
        task: 'transcribe',
        // Parâmetros passados diretamente no objeto de opções (são espalhados internamente para o model.generate)
        temperature: 0.0,
        repetition_penalty: 1.1,
        no_repeat_ngram_size: 8, // Garante a quebra de loops de repetição longos (hallucination loops) mantendo repetições curtas de músicas
        max_initial_timestamp_index: null, // Permite que a transcrição comece após o silêncio/instrumental inicial sem forçar timestamp em 1.0s
      });

      // Mapeia chunks do Whisper para o formato esperado pelo app
      const lines = (result.chunks || []).map((c: any) => {
        const rawStart = (c.timestamp && c.timestamp[0] !== null && c.timestamp[0] !== undefined) ? c.timestamp[0] : 0;
        const rawEnd = (c.timestamp && c.timestamp[1] !== null && c.timestamp[1] !== undefined) ? c.timestamp[1] : rawStart + 3.0;
        return {
          id: Math.random().toString(36).substring(2, 15),
          text: c.text.trim(),
          startTime: parseFloat(Number(rawStart).toFixed(2)),
          endTime: parseFloat(Number(rawEnd).toFixed(2))
        };
      });

      self.postMessage({ type: 'success', lines });
    } catch (err: any) {
      console.error('[WhisperWorkerError]', err);
      self.postMessage({ type: 'error', error: err.message || 'Erro desconhecido na transcrição local.' });
    }
  }
});
