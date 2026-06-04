# Documentação Técnica: Sistema de Transcrição e Sincronização Multiprovedor (Karaokê)

Este documento descreve detalhadamente o funcionamento interno, arquitetura de software, conexões com APIs, tratamento de limites de taxa e o fluxo de dados para a transcrição e tradução de músicas no módulo **Karaokê** do aplicativo Memorize.

---

## 1. Arquitetura do Fluxo de Dados (Fases)

A transcrição inteligente de áudio no Memorize é dividida em quatro fases sequenciais:

```
[Áudio Bruto] 
     │
     ▼
[Fase 1: Preparação de Áudio] (Decodificação e conversão mono 16kHz WAV compacta)
     │
     ▼
[Fase 2: Speech-to-Text] (Execução via Groq [padrão], OpenAI, Gemini ou Whisper Local)
     │
     ▼
[Fase 3: Tradução Híbrida] (Tradução secundária em massa via Gemini ou frase a frase via MyMemory)
     │
     ▼
[Fase 4: Alinhamento e Salvamento] (Ordenação cronológica, salvaguarda e salvamento no IndexedDB)
```

---

## 2. Fase 1: Preparação do Áudio

Antes de enviar o áudio para qualquer inteligência artificial, o arquivo de áudio carregado pelo usuário é decodificado e reamostrado localmente no navegador.

### 2.1. Decodificação (`decodeAudioFile` em `src/utils/audioChunker.ts`)
* O arquivo (Blob ou File) é carregado e decodificado na memória do navegador usando a **Web Audio API** (`AudioContext.decodeAudioData`).
* Isso gera um `AudioBuffer` que contém a taxa de amostragem original (geralmente 44.1 kHz ou 48 kHz) e os canais de áudio brutos.

### 2.2. Otimização Mono 16kHz WAV (`bufferToMono16kWav` em `src/utils/audioChunker.ts`)
* Para motores de nuvem (Gemini, OpenAI, Groq), enviar áudios muito grandes de uma vez é inviável devido a limites de upload das APIs.
* Em vez de fazer múltiplos fatiamentos de 10 segundos (que causavam estouros rápidos de limites de requisições por minuto - RPM 429), reamostramos o áudio completo para **16.000 Hz** (taxa exigida pelo Whisper) e canal único (**Mono**).
* Isso reduz o tamanho do áudio de uma música inteira de ~30MB para apenas ~4MB a ~6MB, permitindo enviar o áudio em uma **requisição única**.

---

## 3. Fase 2: Transcrição (Speech-to-Text)

De acordo com o seletor do usuário (tendo **Groq Whisper** como padrão), a transcrição é processada por um dos quatro motores.

### 3.1. Provedor 1: Groq Whisper (API) - Padrão do Sistema
* **Como Conecta**: Requisição HTTPS `POST` para `https://api.groq.com/openai/v1/audio/transcriptions`.
* **O que Precisa**: Chave de API `memorize_groq_api_key` salva nas configurações.
* **Particularidade**: Executado nos chips LPU da Groq, o processamento do áudio completo de 4 minutos é feito quase instantaneamente (~1s a 3s). Retorna o texto original segmentado com tempos. **Não inclui tradução**.

### 3.2. Provedor 2: Google Gemini 2.5 Flash (API)
* **Como Conecta**: Requisição HTTPS `POST` direto para o endpoint de conteúdo multimodal do Google AI Studio.
* **O que Precisa**: Chave de API `memorize_gemini_api_key` salva nas configurações.
* **Particularidade**: O Gemini faz a transcrição e tradução no mesmo prompt. Retorna um formato JSON contendo os tempos (`startTime`, `endTime`), a letra original (`text`) e a tradução em português (`translation`).

### 3.3. Provedor 3: OpenAI Whisper (API)
* **Como Conecta**: Requisição HTTPS `POST` para `https://api.openai.com/v1/audio/transcriptions`.
* **O que Precisa**: Chave de API `memorize_openai_api_key` salva nas configurações.
* **Particularidade**: Retorna os segmentos de áudio e tempos. **Não inclui tradução**.

### 3.4. Provedor 4: Whisper Local (Navegador via Web Worker)
* **Como Conecta**: Comunicação interna orientada a eventos (`postMessage`) com um **Web Worker** dedicado (`src/workers/whisper.worker.ts`).
* **Seleção de Tamanho de Modelo**:
  - O usuário pode selecionar o tamanho do modelo diretamente na interface de seleção quando o motor "Whisper Local" está selecionado:
    * `onnx-community/whisper-tiny` (~75MB): Mais rápido e leve.
    * `onnx-community/whisper-base` (~140MB): Excelente equilíbrio e precisão de palavras.
    * `onnx-community/whisper-small` (~460MB): Altíssima precisão e qualidade de transcrição (requer WebGPU ou CPU forte).
* **Como Funciona & Parâmetros de Robustez**:
  1. **Thread Separada**: O runtime do ONNX e a biblioteca `@huggingface/transformers` rodam em uma thread paralela no worker para evitar travar a interface visual (UI) do usuário.
  2. **Parâmetros Anti-Alucinação e Filtro de Silêncio (Particularidades do transformers.js)**:
     - **Parâmetros Planos (Flat)**: Ao contrário do Python, o pipeline do transformers.js não desempacota o objeto aninhado `generate_kwargs`. Os argumentos de geração devem ser passados **diretamente no objeto de opções principal** da chamada do pipeline para serem propagados ao `model.generate()`.
     - **Ausência de Thresholds Nativos**: Parâmetros como `no_speech_threshold`, `logprob_threshold` e `compression_ratio_threshold` não são implementados no gerador do transformers.js e são ignorados.
     - **Prevenção de Repetição (Estratégia Híbrida)**:
       * **`repetition_penalty: 1.1`**: Aplica uma penalização leve a tokens já gerados para desestimular repetições desnecessárias quando o sinal de áudio é fraco ou ausente.
       * **`no_repeat_ngram_size: 8`**: Atua como uma trava de segurança absoluta. Ela proíbe que qualquer sequência de 8 tokens se repita. Sequências curtas legítimas de músicas (como repetir a frase "you made me a" ou palavras como "believer, believer") têm tamanho inferior a 8 e são preservadas. No entanto, loops de repetição infinitos causados por alucinação (ex: repetir *"ooh, ooh..."* ou *"ever did ever did..."*) rapidamente ultrapassam 8 tokens de extensão consecutiva e são imediatamente bloqueados pelo gerador.
     - **Filtro de Silêncio Inicial (`max_initial_timestamp_index: null`)**: Por padrão, o Whisper restringe o carimbo de tempo inicial a estar dentro do primeiro segundo (`max_initial_timestamp_index = 1`, equivalente a 1.0s). Em introduções musicais ou instrumentais longas (como em *Imagine Dragons - Believer*), essa restrição força o modelo a prever texto logo no começo, resultando em alucinações de soletração precoce. Configurar `max_initial_timestamp_index: null` desativa essa restrição, permitindo que o modelo posicione livremente o primeiro timestamp onde o canto de fato se inicia.
     - `temperature: 0.0`: Decodificação estritamente determinística (busca gulosa).
  3. **Mapeamento e Segurança contra Nulos**: O mapeamento de carimbos de tempo dos segmentos convertidos no worker faz a sanitização de `null`/`undefined` nos valores de `timestamp` retornados pelo Whisper antes de realizar formatações numéricas como `.toFixed()`, eliminando travamentos de execução no front-end.
  4. **Retorno**: Retorna os trechos (`result.chunks`) mapeando o texto e os timestamps originais (`[startTime, endTime]`). **Não inclui tradução**.

### 3.5. Tratamento de Rate Limit (HTTP 429) e Retentativa Automática
Durante requisições em lote ou alta frequência de uso, as APIs de nuvem podem retornar o status `429 Too Many Requests`. O Memorize trata isso de forma transparente:
* **Wrapper `fetchWithRetry`**: Todas as chamadas de rede externas passam por um resolvedor inteligente de rate limit.
* **Cálculo de Reset**: A aplicação lê o cabeçalho `Retry-After` ou decodifica o texto do erro da API (como `"Please try again in 3s."` da Groq) usando Regex para determinar os segundos a aguardar.
* **Contagem Regressiva e Cancelabilidade**: Exibe uma mensagem regressiva em tempo real: *"Limite de requisições excedido. Aguardando Xs..."*. A checagem de cancelamento (`isTranscribeCancelledRef`) ocorre a cada 200ms para permitir parar o processo instantaneamente se o usuário clicar em "Cancelar".

---

## 4. Fase 3: Tradução Híbrida (Conexão Secundária)

Como os motores Whisper apenas extraem a voz no idioma falado da música (ex: inglês), traduzimos as frases resultantes para o português:

* **Com API Key do Gemini**: Chamamos `requestGeminiTranslationOnly` enviando todas as frases de uma vez em um **bloco único** JSON para o Gemini 2.5 Flash, que traduz o lote rapidamente e com alta qualidade pedagógica.
* **Sem API Key do Gemini**: Usamos o fallback gratuito **MyMemory API**, traduzindo frase por frase no cliente com um delay de 100ms entre as frases para evitar restrições de limites de taxa.

---

## 5. Fase 4: Sincronização, Alinhamento e Edição

### 5.1. Salvaguarda Cronológica (`adjustTimestampsSafeguard` em `src/utils/audioChunker.ts`)
Garante que as frases fiquem em ordem e não ocorram sobreposições visuais estranhas:
1. Ordena todas as linhas pelo tempo de início (`startTime`).
2. Garante um espaçamento mínimo de **0.5 segundos** entre o início de uma frase e a próxima.
3. Define uma duração padrão de 3 segundos para frases com tempo final zerado, limitando ao início da próxima frase ou fim do áudio.

### 5.2. Preservação de Tempos em Edições (`handleLoadTextToTempLines` em `src/pages/KaraokePage.tsx`)
Quando o usuário edita a letra manualmente (aba **Letra Texto**):
* **Número de Linhas Igual**: O aplicativo substitui apenas as strings de cada linha, **preservando os tempos** de início e fim.
* **Número de Linhas Diferente**: O aplicativo realiza uma busca inteligente e preserva tempos das linhas cujas palavras coincidam com as anteriores, aplicando fallback aproximado às novas linhas criadas.

---

## 6. Simplificação da Transcrição Direta (Depreciação de Alinhamento Forçado)

Anteriormente, o sistema tentava fazer o alinhamento forçado da letra fornecida pelo usuário contra o áudio via I.A (Lyrics Alignment). Devido à alta complexidade, custos extras de prompts, e instabilidade de limites de taxa nas APIs, **a estratégia de alinhamento forçado foi descontinuada**. 

Agora, o Karaokê utiliza **estritamente o fluxo de transcrição direta completa do áudio do zero** (sendo o Groq Whisper o modelo padrão veloz), garantindo 100% de estabilidade de tempos e sincronia limpa obtida direto do modelo Speech-to-Text.

---

## 7. Pós-processamento: Correção Inteligente via LLM (Gemini Corretor)

Para os motores Whisper (especialmente o **Whisper Local**), ruídos instrumentais e efeitos na voz podem causar elisão de sílabas e pequenos erros fonéticos (como transcrever *"sea, oh"* como *"CEO"*, *"sail"* como *"sale"*, etc.) ou distorções severas de frases inteiras.

Para resolver isso sem perder os tempos de marcação do áudio (timestamps), implementamos um fluxo automático de **Correção Inteligente**:
* **Gatilho**: Se o provedor de transcrição não for o Gemini (ex: Whisper Local ou Groq Whisper) e houver uma chave de API do Gemini configurada.
* **Funcionamento**: A lista de frases transcritas (contendo tempos corretos mas textos com pequenos erros) é enviada em lote ao **Gemini 2.5 Flash** através do método `requestGeminiTextCorrection`.
* **Google Search Grounding (Pesquisa em Tempo Real)**: Para eliminar alucinações de memória da IA, a chamada ativa a ferramenta oficial do Google (`tools: [{ google_search: {} }]`). O prompt ordena explicitamente que o Gemini realize uma busca em tempo real na internet pela letra oficial original e completa da música detectada (ex: pesquisando por "lyrics [nome da música] [artista]").
* **Prompt e Exemplos Few-Shot**: O prompt guia o modelo no mapeamento de erros fonéticos leves e na substituição completa de frases inventadas ou distorcidas por versos oficiais, fornecendo exemplos para trechos de alta velocidade (como mapear "Why? You burned me down, you kill me" para "Pain! You break me down and build me up").
* **Esquema de Resposta Estrito (`responseSchema`)**: A API é configurada com um JSON Schema rígido que força o modelo a retornar a estrutura contendo `"detected_song"` e `"corrected_texts"` em correspondência estrita de 1 para 1 (exatamente as mesmas `${lines.length}` linhas), evitando qualquer falha de parsing no frontend.
* **Vantagem**: Garante que o texto exibido e a tradução gerada na sequência fiquem 100% limpos e fiéis à letra real da música, aproveitando os tempos precisos de início e fim mapeados localmente.

---

## 8. Pré-processamento: Isolamento de Voz por IA (Vocals Isolation)

Para melhorar a precisão da transcrição (especialmente no **Whisper Local** ou sob instrumentais com muito ruído/bateria/guitarras), implementamos a funcionalidade opcional de **Isolamento de Voz**:
* **Funcionamento**: Antes de decodificar e enviar o áudio para o Whisper, se habilitado pelo usuário na UI, o áudio original é processado para extrair a trilha vocal a capela através da função `separateVocalsCloud` em `src/utils/vocalSeparationCloud.ts`.
* **Tecnologia Gratuita**: Utiliza APIs de Spaces públicos do HuggingFace executando o modelo de alta precisão **HTDemucs (Meta AI)** via a biblioteca `@gradio/client`. O serviço é 100% gratuito e não necessita de chaves de API.
* **Integração de Fluxo**: O app solicita e baixa a faixa isolada de vocais (`vocals.wav`, correspondente ao índice `0` de saída do Space), decodifica esse resultado limpo em um `AudioBuffer` e passa-o para o motor do Whisper selecionado.
* **Benefício**: Ao transcrever uma trilha de voz isolada e limpa (a capela) livre de baterias ou guitarras, o Whisper reduz drasticamente as alucinações e erros fonéticos causados por ruído instrumental de fundo.
* **Resiliência e Fallback**: Caso os servidores públicos do HuggingFace estejam offline ou apresentem lentidão na fila, o aplicativo exibe um aviso de alerta e faz o fallback automático, decodificando e transcrevendo o áudio original com instrumental para não travar a experiência do usuário.

