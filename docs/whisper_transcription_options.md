# Documentação Técnica: Obtenção de Letra e Sincronização (Karaokê)

Este documento descreve como o módulo **Karaokê** do Memorize obtém a letra de uma música, os tempos de cada frase e os tempos de cada palavra.

---

## 1. Princípio: separar "o quê" de "quando"

Uma letra sincronizada tem duas informações independentes:

* **Quais são as palavras** — informação textual, que quase sempre já existe escrita em algum lugar.
* **Quando cada palavra é cantada** — informação temporal, que só pode ser derivada do áudio.

O reconhecimento automático de fala (ASR) é a única ferramenta capaz de produzir as duas ao mesmo tempo, mas é também a menos confiável das opções: o Whisper foi treinado em **fala**, e música com instrumentação está fora da sua distribuição de treino. Por isso o ASR é o **último** recurso da cascata, não o primeiro.

---

## 2. A cascata de obtenção da letra

| Ordem | Método | Custo | Qualidade | Onde |
| :--- | :--- | :--- | :--- | :--- |
| 1 | LRCLIB — letra já sincronizada por pessoas | instantâneo, grátis | humana | `src/utils/lyricsProvider.ts` |
| 2 | LRCLIB — letra simples + sincronia manual | instantâneo, grátis | texto humano, tempo manual | idem |
| 3 | Importação de arquivo `.lrc` | instantâneo | depende do arquivo | `handleImportLRC` |
| 4 | Transcrição automática (ASR) | minutos | irregular | `handleStartAiTranscription` |
| — | Sincronia manual por toque | manual | verdade absoluta | aba **Sincronia** |

Na interface, as três primeiras formas aparecem em **abas** (`LYRICS_SOURCE_TABS` em `src/pages/KaraokePage.tsx`), com "Buscar Letra" como aba inicial.

---

## 3. Fonte 1: LRCLIB (preferencial)

Base pública e colaborativa de letras sincronizadas (<https://lrclib.net>).

* **Autenticação**: nenhuma.
* **CORS**: `access-control-allow-origin: *` — chamável direto do navegador.
* **Busca**: `GET /api/search?q=<texto livre>` (`searchLyrics`).
* **Retorno relevante**:
  - `syncedLyrics` — letra em formato LRC, com marcações de tempo. É o caso ideal.
  - `plainLyrics` — letra sem tempo. Bem mais comum; serve de texto correto para sincronizar depois.
  - `duration` — duração catalogada, exibida ao lado da duração real da faixa para o usuário detectar versão errada (ao vivo, remix, edit).

### 3.1. Parser de LRC (`parseLrcToLines`)

Cobre os casos que aparecem em arquivos LRC reais:

* **Múltiplas marcações na mesma linha** (`[00:10][01:20][02:30] Refrão`) — expande em uma linha por ocorrência. É como o formato representa um verso repetido em vários momentos.
* **Tag `offset`** — ajuste global em milissegundos. Por convenção do formato, offset positivo *adianta* a letra, então o sinal é invertido ao aplicar. Tempos nunca ficam negativos.
* **Tags de metadado** (`[ti:]`, `[ar:]`, `[al:]`…) — descartadas.
* **Entradas fora de ordem** — reordenadas por tempo.
* O `endTime` de cada linha vem do `startTime` da próxima; a última usa a duração da faixa.

### 3.2. Aplicação e salvamento

`handleApplyLyricsResult` aplica o resultado **e salva imediatamente**. O salvamento recebe as linhas por parâmetro (`handleSaveTranscription(linesOverride)`) porque o estado do React ainda não refletiu o `setTempLines` do mesmo handler.

---

## 4. Fonte 2: Transcrição automática (ASR)

Quatro motores, selecionáveis na aba **Transcrever**.

### 4.1. Preparação do áudio

1. **Fonte do áudio** (`resolveTranscriptionSourceAudio`): usa o **vocal isolado** quando disponível. Se a faixa já tem `vocalFile` salvo, é usado sem custo; senão, só separa se o usuário marcar a opção (ver seção 6). Falha na separação não aborta — cai para a mixagem completa com aviso.
2. **Decodificação** (`decodeAudioFile`): Web Audio API → `AudioBuffer`.
3. **Conversão**:
   - **Motores em nuvem**: `bufferToMono16kWav` → WAV PCM mono 16 kHz em requisição única.
   - **Whisper local**: `resampleToMono16k` → `Float32Array` mono 16 kHz via **`OfflineAudioContext`**, que aplica filtro anti-aliasing adequado. A reamostragem manual (interpolação ou decimação) introduz aliasing em 44,1 kHz → 16 kHz e degrada a acurácia. A Web Audio API não existe dentro de Workers, por isso a conversão acontece na thread principal.

**Guarda de tamanho**: WAV PCM mono 16 kHz ocupa ~1,9 MB por minuto. Antes de enviar, o tamanho é checado contra o limite do motor (~14 MB para Gemini, que embute o áudio em base64 com +33% dentro de um teto de ~20 MB; ~24 MB para OpenAI/Groq). Excedeu, erro claro sugerindo o Whisper local — em vez de falhar no servidor depois do upload inteiro.

### 4.2. Idioma do áudio

Seletor na interface (`AUDIO_LANGUAGES`), padrão **inglês**, persistido em `memorize_transcription_audio_language`.

Fixar o idioma importa: em auto-detecção o Whisper pode trocar de idioma no meio da música e produzir linhas em idiomas diferentes na mesma faixa. A opção "Detectar automaticamente" continua disponível.

Propagação: `language` no `postMessage` do worker (`'auto'` → `null`), campo `language` no multipart de OpenAI/Groq (omitido em `'auto'`), e instrução no prompt do Gemini.

> O idioma da **tradução** é independente e permanece fixo em português do Brasil.

### 4.3. Motores

| Motor | Endpoint | Chave | Traduz? |
| :--- | :--- | :--- | :--- |
| Groq Whisper | `api.groq.com/openai/v1/audio/transcriptions` | `memorize_groq_api_key` | não |
| OpenAI Whisper | `api.openai.com/v1/audio/transcriptions` | `memorize_openai_api_key` | não |
| Gemini 2.5 Flash | `generativelanguage.googleapis.com` | `memorize_gemini_api_key` | sim, no mesmo prompt |
| Whisper local | Web Worker + `@huggingface/transformers` | nenhuma | não |

OpenAI e Groq compartilham o mesmo contrato (multipart + `verbose_json` com `segments`) e usam uma única implementação, `requestWhisperCompatibleTranscription`.

A chave do Gemini vai no cabeçalho `x-goog-api-key`, **não** na query string — query params vazam em logs de servidor, histórico e `Referer`.

### 4.4. Whisper local: modelos

Todos os modelos oferecidos são variantes **`_timestamped`**:

```
onnx-community/whisper-tiny_timestamped              (~75MB)
onnx-community/whisper-base_timestamped              (~140MB)
onnx-community/whisper-small_timestamped             (~460MB)
onnx-community/whisper-medium_timestamped            (~1.5GB)
onnx-community/whisper-large-v3-turbo_timestamped    (~1.6GB)
```

**Por quê**: timestamps por palavra são extraídos das *cross-attentions* do decoder. Os modelos padrão são exportados sem esses tensores para economizar tamanho, e o pedido falha com:

> `Model outputs must contain cross attentions to extract timestamps. This is most likely because the model was not exported with output_attentions=True.`

`normalizeWhisperModel` migra automaticamente IDs antigos gravados no `localStorage` (note que `medium` também mudou de repositório: `whisper-medium-ONNX` → `whisper-medium_timestamped`).

O worker guarda `loadedModelName` e recarrega quando o usuário troca de tamanho — sem isso, o modelo antigo continuaria em memória silenciosamente. O worker é **reutilizado** entre transcrições para manter o modelo quente, sendo descartado apenas em erro, cancelamento ou saída da página.

### 4.5. Whisper local: parâmetros de geração

* `return_timestamps: 'word'` — uma palavra por chunk. Se falhar, o worker refaz a chamada com `return_timestamps: true` (nível de frase) e sinaliza `hasWordTimestamps: false`, degradando em vez de quebrar.
* `temperature: 0.0` — decodificação determinística.
* `max_initial_timestamp_index: null` — remove a restrição que força o primeiro timestamp no primeiro segundo, o que causava alucinação em introduções instrumentais longas.
* Parâmetros são passados **direto no objeto de opções** do pipeline; o transformers.js não desempacota `generate_kwargs` como o Python.
* Thresholds nativos do Whisper (`no_speech_threshold`, `logprob_threshold`, `compression_ratio_threshold`) **não são implementados** no transformers.js e são ignorados.

#### Parâmetros deliberadamente removidos

`repetition_penalty` e `no_repeat_ngram_size` eram usados como trava anti-alucinação. **Em música eles produzem o efeito oposto.**

Letra é repetitiva por construção — refrão, hook, verso que retorna. `no_repeat_ngram_size: 8` proíbe a repetição de qualquer sequência de 8 tokens, o que corresponde a cerca de 5 ou 6 palavras: o tamanho de um verso inteiro. Quando o refrão volta, o modelo fica **impedido de transcrevê-lo igual** e a decodificação é empurrada a escolher palavras diferentes para escapar da restrição. É uma causa direta de "palavras que não existem na música", concentrada justamente nas repetições.

A restrição atua na decodificação, então trocar para um modelo maior não resolve.

### 4.6. Agrupamento de palavras em linhas (`groupWordsIntoLines`)

Palavra por chunk é a granularidade certa para o destaque, mas inútil para exibir como letra. As palavras são reagrupadas em frases quebrando em:

* pausa entre palavras ≥ `maxGapSeconds` (padrão 0,6 s);
* pontuação forte (`.`, `!`, `?`, `…`);
* teto de `maxWordsPerLine` (padrão 10) ou `maxLineDuration` (padrão 8 s).

Cada linha preserva os tempos originais em `words[]`. Função pura, coberta por testes em `src/utils/wordGrouping.test.ts`.

### 4.7. Rate limit e retentativas (`fetchWithRetry`)

* **429**: lê o cabeçalho `Retry-After` ou extrai o tempo do corpo do erro por regex (ex.: `"Please try again in 3s."` da Groq).
* **5xx e falhas de rede**: retentativa com backoff exponencial, teto de 30 s.
* A espera é **interrompível**: `isTranscribeCancelledRef` é checado a cada 200 ms, e a mensagem de progresso mostra a contagem regressiva.

---

## 5. Modelo de dados: tempos por palavra

```ts
interface WordTiming { text: string; startTime: number; endTime: number }

interface TranscriptionLine {
  // ...
  words?: WordTiming[];
}
```

`words` também existe em `TextLine`, para persistir junto do texto em `db.texts`. Nenhum desses campos é indexado, então a adição **não exigiu bump de versão do Dexie**.

### 5.1. Uso no destaque (`renderHighlightedText`)

Com `words`, cada palavra acende no tempo medido. Sem `words`, o destaque cai para uma estimativa proporcional à contagem de caracteres da linha — que assume ritmo uniforme e erra bastante em canto (notas longas, melismas).

Os tempos reais só são usados quando `words.length` bate com a contagem de palavras do texto exibido. O usuário pode ter editado a letra depois da transcrição, e aplicar tempos desalinhados acenderia as palavras erradas.

### 5.2. Invalidação em edição

Ao editar o texto de uma linha (`handleLoadTextToTempLines`), os `words` daquela linha são descartados: os tempos foram medidos para outras palavras.

---

## 6. Isolamento de voz (Demucs via HuggingFace Space)

`src/utils/vocalSeparationCloud.ts`, endpoint `/inference` do Space `abidlabs/music-separation`. Saída `[0]` = vocal, `[1]` = instrumental.

Dois usos:

1. **Instrumental para reprodução** — salvo em `audioTracks.instrumentalFile`.
2. **Vocal para transcrição** — salvo em `audioTracks.vocalFile` e reutilizado nas próximas transcrições da mesma faixa.

O parâmetro de áudio é declarado pelo Space como `FileData`, não como arquivo cru: é obrigatório usar `handle_file()` do `@gradio/client` para fazer o upload e passar a referência.

Desligado por padrão na transcrição, por depender de fila pública gratuita e levar alguns minutos. A inspeção `view_api()` é apenas diagnóstica e nunca derruba a separação.

---

## 7. Pós-processamento e edição

### 7.1. Salvaguarda cronológica (`adjustTimestampsSafeguard`)

Ordena as linhas, garante espaçamento mínimo entre inícios e limita o fim de cada linha ao início da próxima ou ao fim da faixa.

**Desativa as heurísticas quando há tempos medidos por palavra.** A estimativa de início por WPM e o empurrão de frases para espaçá-las existem para consertar timestamps grosseiros de nível de frase; com tempos medidos elas só afastariam os valores da realidade e dessincronizariam `line.startTime` dos `words[]` da própria linha.

### 7.2. Preservação de tempos em edições

* **Mesmo número de linhas**: substitui só o texto, preservando os tempos.
* **Número diferente**: casa linhas por texto idêntico quando possível e usa o índice correspondente como fallback.

### 7.3. Exclusão

`handleDeleteLyrics` limpa os três lugares onde a letra pode estar: o registro em `db.texts`, o campo legado `audioTracks.transcriptionLines` e o estado do editor. **O áudio é preservado** — `audioFile`, `instrumentalFile` e `vocalFile` permanecem.

Acessível pelo botão "Excluir Letra" na barra do estúdio, disponível também quando a letra ainda não foi salva.

---

## 8. Estado do alinhamento forçado

O modal de colar a letra oficial (`isAdjustmentModalOpen`) segue implementado, mas **não abre automaticamente** após a transcrição — foi desconectado para permitir avaliar a saída crua do modelo sem correção por cima. Reativar é uma linha: `setIsAdjustmentModalOpen(true)` em `handleStartAiTranscription`.

O alinhamento existente corrige **texto**, não tempo. Um alinhamento forçado de verdade — letra oficial fornecida pelo usuário casada contra âncoras temporais do áudio via DTW — ainda **não está implementado**. `alignLyricsLocal` em `audioChunker.ts` é um esboço nessa direção, atualmente sem uso: é guloso, com ponteiro que só avança, e por isso casa no lugar errado em refrões repetidos sem conseguir voltar atrás.

Com `return_timestamps: 'word'` em produção, as âncoras passaram de uma por frase para uma por palavra, o que torna esse alinhamento consideravelmente mais viável do que era.
