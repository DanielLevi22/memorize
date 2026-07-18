import { pipeline, env } from '@huggingface/transformers';
import { groupWordsIntoLines } from '../utils/audioChunker';

// Configura o cache do transformers para usar caminhos estritamente remotos (downloads serão guardados no Cache Storage do navegador)
env.allowLocalModels = false;

let transcriber: any = null;
// Guarda qual modelo está carregado: sem isso, trocar o tamanho do modelo nas configurações
// continuaria reutilizando silenciosamente o modelo antigo já em memória.
let loadedModelName: string | null = null;

/**
 * Reamostragem defensiva para 16000Hz (frequência exigida pelo Whisper).
 *
 * O caminho normal já entrega o áudio mono em 16kHz reamostrado com anti-aliasing pelo
 * OfflineAudioContext na thread principal (`resampleToMono16k`), então esta função costuma
 * ser um no-op. Ela permanece apenas como rede de segurança e usa interpolação linear,
 * que introduz bem menos aliasing do que a decimação por vizinho mais próximo.
 */
function resampleTo16k(audioBuffer: Float32Array, originalSampleRate: number): Float32Array {
  if (originalSampleRate === 16000) {
    return audioBuffer;
  }
  const ratio = originalSampleRate / 16000;
  const newLength = Math.round(audioBuffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const indexNext = Math.min(audioBuffer.length - 1, index + 1);
    const sample = audioBuffer[index];
    const sampleNext = audioBuffer[indexNext];
    result[i] = sample + fraction * (sampleNext - sample);
  }
  return result;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const {
    type,
    audioData,
    sampleRate,
    modelName = 'onnx-community/whisper-tiny',
    // null = auto-detecta (comportamento anterior); um código ISO-639-1 fixa o idioma
    language = null
  } = event.data;

  if (type === 'start') {
    try {
      if (!transcriber || loadedModelName !== modelName) {
        transcriber = null;
        loadedModelName = null;
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

        loadedModelName = modelName;
      }

      self.postMessage({ type: 'status', message: 'Processando áudio...' });

      // Reamostra o áudio para 16kHz
      const audio16k = resampleTo16k(audioData, sampleRate);

      self.postMessage({ type: 'status', message: 'Transcrevendo áudio localmente...' });

      // Parâmetros anti-alucinação compartilhados pelas duas tentativas
      const baseOptions = {
        chunk_length_s: 30,
        stride_length_s: 5,
        language, // Idioma escolhido pelo usuário; null auto-detecta
        task: 'transcribe',
        // Parâmetros passados diretamente no objeto de opções (são espalhados internamente para o model.generate)
        temperature: 0.0,
        // ATENÇÃO: `repetition_penalty` e `no_repeat_ngram_size` são truques anti-alucinação
        // pensados para FALA, e em música fazem o oposto do pretendido. Letra é repetitiva
        // por natureza — refrão, hook, verso que volta. Ao proibir a repetição de qualquer
        // sequência de 8 tokens, o modelo fica impedido de transcrever o refrão de novo e é
        // empurrado a inventar palavras diferentes para escapar da restrição.
        // É a causa mais provável de "palavras que não existem" na transcrição de músicas.
        max_initial_timestamp_index: null, // Permite que a transcrição comece após o silêncio/instrumental inicial sem forçar timestamp em 1.0s
      };

      // 'word' devolve uma palavra por chunk (via cross-attention/DTW interno) em vez de um
      // timestamp por frase — resolução necessária para o destaque do karaokê. Exige que o
      // modelo tenha sido exportado com `output_attentions=True` (variantes `_timestamped`).
      let result: any;
      let hasWordTimestamps = true;
      try {
        result = await transcriber(audio16k, { ...baseOptions, return_timestamps: 'word' });
      } catch (wordErr: any) {
        console.warn('[WhisperWorker] Modelo sem cross-attentions; caindo para timestamps por frase.', wordErr);
        self.postMessage({
          type: 'status',
          message: 'Modelo sem suporte a tempo por palavra. Transcrevendo com tempo por frase...'
        });
        hasWordTimestamps = false;
        result = await transcriber(audio16k, { ...baseOptions, return_timestamps: true });
      }

      const readTimestamps = (c: any, fallbackDuration: number) => {
        const rawStart = (c.timestamp && c.timestamp[0] !== null && c.timestamp[0] !== undefined) ? c.timestamp[0] : null;
        const rawEnd = (c.timestamp && c.timestamp[1] !== null && c.timestamp[1] !== undefined) ? c.timestamp[1] : null;
        if (rawStart === null) return null;
        // Whisper às vezes deixa o fim do último trecho em aberto
        return { start: Number(rawStart), end: Number(rawEnd ?? rawStart + fallbackDuration) };
      };

      let lines;
      if (hasWordTimestamps) {
        // Cada chunk é uma palavra: normaliza e reagrupa em frases
        const words = (result.chunks || [])
          .map((c: any) => {
            const t = readTimestamps(c, 0.3);
            if (!t) return null;
            return { text: String(c.text ?? '').trim(), startTime: t.start, endTime: t.end };
          })
          .filter((w: any) => w && w.text.length > 0);

        lines = groupWordsIntoLines(words);
      } else {
        // Cada chunk já é uma frase; sem `words`, o destaque cai para o modo estimado
        lines = (result.chunks || [])
          .map((c: any) => {
            const t = readTimestamps(c, 3.0);
            if (!t) return null;
            return {
              id: Math.random().toString(36).substring(2, 15),
              text: String(c.text ?? '').trim(),
              startTime: parseFloat(t.start.toFixed(2)),
              endTime: parseFloat(t.end.toFixed(2))
            };
          })
          .filter((l: any) => l && l.text.length > 0);
      }

      self.postMessage({ type: 'success', lines, hasWordTimestamps });
    } catch (err: any) {
      console.error('[WhisperWorkerError]', err);
      self.postMessage({ type: 'error', error: err.message || 'Erro desconhecido na transcrição local.' });
    }
  }
});
