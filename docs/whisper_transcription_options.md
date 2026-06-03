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
* **Como Funciona**:
  1. **Thread Separada**: O runtime do ONNX e a biblioteca `@huggingface/transformers` rodam em uma thread paralela no worker para evitar travar a interface visual (UI) do usuário.
  2. **Parâmetros Anti-Alucinação**: Para evitar palavras inexistentes em silêncios, usamos `temperature: 0.0` (decodificação estritamente determinística).
  3. **Retorno**: Retorna os trechos (`result.chunks`) mapeando o texto e os timestamps originais (`[startTime, endTime]`). **Não inclui tradução**.

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
