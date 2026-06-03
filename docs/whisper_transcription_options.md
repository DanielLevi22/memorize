# Documentação Técnica: Sistema de Transcrição e Sincronização Multiprovedor (Karaokê)

Este documento descreve detalhadamente o funcionamento interno, arquitetura de software, conexões com APIs e o fluxo de dados para a transcrição e tradução de músicas no módulo **Karaokê** do aplicativo Memorize.

---

## 1. Arquitetura do Fluxo de Dados (Fases)

A transcrição inteligente de áudio no Memorize é dividida em quatro fases sequenciais:

```
[Áudio Bruto] 
     │
     ▼
[Fase 1: Preparação de Áudio] (Decodificação, detecção de silêncio e fatiamento)
     │
     ▼
[Fase 2: Speech-to-Text] (Execução via Gemini, OpenAI, Groq ou Whisper Local)
     │
     ▼
[Fase 3: Tradução Híbrida] (Tradução secundária em massa via Gemini ou frase a frase via MyMemory)
     │
     ▼
[Fase 4: Alinhamento e Salvamento] (Ordenação cronológica, salvaguarda e salvamento no IndexedDB)
```

---

## 2. Fase 1: Preparação do Áudio

Antes de enviar o áudio para qualquer inteligência artificial, o arquivo de áudio carregado pelo usuário precisa ser processado localmente no navegador.

### 2.1. Decodificação (`decodeAudioFile` em `src/utils/audioChunker.ts`)
* O arquivo (Blob ou File) é carregado e decodificado na memória do navegador usando a **Web Audio API** (`AudioContext.decodeAudioData`).
* Isso gera um `AudioBuffer` que contém a taxa de amostragem original (geralmente 44.1 kHz ou 48 kHz) e os canais de áudio brutos.

### 2.2. Detecção de Silêncio (`findSilenceSplitPoints` em `src/utils/audioChunker.ts`)
* Para motores de nuvem (Gemini, OpenAI, Groq), enviar áudios muito grandes de uma vez é ineficiente e sujeito a falhas de limite de requisição. Por isso, dividimos o áudio em pedaços menores (chunks) de aproximadamente **10 segundos**.
* O algoritmo analisa a amplitude absoluta do canal 0 do `AudioBuffer` em janelas de 100ms em passos de 50ms para localizar os pontos de menor energia (silêncio ou pausa). Isso evita cortar o áudio no meio de uma palavra cantada.
* Ele gera uma lista de carimbos de tempo (`splitPoints`) indicando onde cortar.

### 2.3. Conversão para WAV (`bufferToWav` em `src/utils/audioChunker.ts`)
* Para cada chunk fatiado, o trecho correspondente do `AudioBuffer` é extraído e convertido para o formato **WAV (PCM 16-bit, amostrado na taxa nativa)** em um buffer binário (`ArrayBuffer`) e encapsulado em um `Blob`. É este arquivo WAV de 10 segundos que é enviado para as APIs externas.

---

## 3. Fase 2: Transcrição (Speech-to-Text)

De acordo com o seletor do usuário, a transcrição é processada por um dos quatro motores.

### 3.1. Provedor 1: Google Gemini 2.5 Flash (API)
* **Como Conecta**: Requisição HTTPS `POST` direto para o endpoint de conteúdo multimodal do Google AI Studio.
* **O que Precisa**: Chave de API `memorize_gemini_api_key` salva nas configurações.
* **Particularidade**: O Gemini é o único modelo que faz a **transcrição e a tradução no mesmo prompt**. Enviamos o arquivo WAV e um prompt do sistema instruindo o modelo a retornar um formato JSON estrito contendo os tempos (`startTime`, `endTime`), a letra original (`text`) e a tradução em português (`translation`).

### 3.2. Provedor 2: OpenAI Whisper (API)
* **Como Conecta**: Requisição HTTPS `POST` para `https://api.openai.com/v1/audio/transcriptions`.
* **O que Precisa**: Chave de API `memorize_openai_api_key` salva nas configurações.
* **Particularidade**: Transcreve o áudio fatiado de 10 segundos. O Whisper retorna um objeto JSON contendo o texto transcrito segmentado em frases (`segments`) com marcações de tempo precisas (`start`, `end`) do idioma falado/cantado na música. **Não inclui tradução**.

### 3.3. Provedor 3: Groq Whisper (API)
* **Como Conecta**: Requisição HTTPS `POST` para `https://api.groq.com/openai/v1/audio/transcriptions`.
* **O que Precisa**: Chave de API `memorize_groq_api_key` salva nas configurações.
* **Particularidade**: Segue o mesmo padrão e protocolo da API da OpenAI, mas é executado nos chips LPU da Groq, o que faz com que cada trecho de 10 segundos seja processado quase instantaneamente (~100ms a 200ms por requisição). **Não inclui tradução**.

### 3.4. Provedor 4: Whisper Local (Navegador via Web Worker)
* **Como Conecta**: Comunicação interna orientada a eventos (`postMessage`) com um **Web Worker** dedicado (`src/workers/whisper.worker.ts`).
* **O que Precisa**: Nenhum dado externo ou chave. Apenas internet na primeira vez para baixar os pesos do modelo (`onnx-community/whisper-tiny` de ~75MB).
* **Como Funciona no Web Worker**:
  1. **Thread Separada**: O runtime do ONNX e a biblioteca `@huggingface/transformers` rodam em uma thread paralela no worker para evitar travar a interface visual (UI) do usuário.
  2. **Reamostragem Dinâmica (`resampleTo16k`)**: O Whisper exige áudio a **16.000 Hz** (16kHz). Como o áudio bruto decodificado pelo navegador geralmente está a 44.1kHz ou 48kHz, o worker executa uma interpolação linear para reamostrar os dados de ponto flutuante (`Float32Array`) para a frequência correta de 16kHz antes da inferência.
  3. **Inferência ONNX**: Roda o modelo Whisper tiny usando aceleração por **WebGPU** (caso o navegador e a GPU suportem) ou via **WebAssembly (WASM)** em modo multithread na CPU.
  4. **Retorno**: Retorna os trechos (`result.chunks`) mapeando o texto e os timestamps originais (`[startTime, endTime]`). **Não inclui tradução**.

---

## 4. Fase 3: Tradução Híbrida (Conexão Secundária)

Como os motores Whisper (OpenAI, Groq e Local) apenas extraem a voz no idioma falado da música (ex: inglês), precisamos de um processo secundário para traduzir as frases resultantes para o português do Brasil. O aplicativo decide qual API de tradução usar de acordo com a disponibilidade das chaves do usuário:

```
                  ┌───────────────────────────────┐
                  │   Whisper finaliza o texto    │
                  └───────────────┬───────────────┘
                                  │
                   Possui API Key do Gemini?
                     /                         \
                   Sim                          Não
                   /                              \
  ┌─────────────────────────────────┐    ┌──────────────────────────────────┐
  │   Tradução via Gemini API       │    │   Tradução via MyMemory API      │
  │   - Uma única chamada em texto  │    │   - Chamadas sequenciais grátis  │
  │   - Muito rápido e alta qualidade│    │   - Phrase-by-phrase loop        │
  └─────────────────────────────────┘    └──────────────────────────────────┘
```

### 4.1. Método de Tradução 1: Otimização em Bloco com Gemini (Ideal)
* Se o usuário configurou uma chave do Gemini nas configurações (`memorize_gemini_api_key`), o aplicativo executa a função `requestGeminiTranslationOnly`.
* Em vez de fazer uma chamada para cada frase (o que gastaria muitos créditos/tempo de rede), juntamos apenas os textos de todas as frases transcritas em uma lista JSON e enviamos em uma **única requisição de texto rápida** para a API do Gemini 2.5 Flash.
* O Gemini devolve um array com as traduções ordenadas. O aplicativo acopla essas traduções aos timestamps originais calculados pelo Whisper.

### 4.2. Método de Tradução 2: Fallback Gratuito com MyMemory (100% Grátis/Offline)
* Se o usuário **não configurou a chave do Gemini** (caso típico do uso do Whisper Local gratuito), a aplicação utiliza o tradutor público e gratuito **MyMemory** (`mymemory.translated.net`).
* O aplicativo realiza um loop sequencial por cada linha transcrita, chamando a API gratuita `translateWithMyMemory(linha.text)`.
* Atualizamos a barra de carregamento no modal com a porcentagem correspondente ao progresso do loop de tradução (`Traduzindo trecho X de Y...`) para dar feedback visual em tempo real.
* Aplicamos um delay de 100ms entre as requisições para evitar limites de taxa (rate limits) da API pública.

---

## 5. Fase 4: Sincronização, Alinhamento e Edição

Após receber os textos e tempos, aplicamos tratamentos para que a letra funcione perfeitamente no player de Karaokê.

### 5.1. Salvaguarda Cronológica (`adjustTimestampsSafeguard` em `src/utils/audioChunker.ts`)
Para garantir que as frases fiquem em ordem e não ocorram sobreposições visuais estranhas na tela:
1. Ordenamos todas as linhas pelo tempo de início (`startTime`).
2. Garantimos um espaço de tempo mínimo de **0.5 segundos** entre o início de uma frase e a próxima.
3. Calculamos o tempo de fim (`endTime`) de cada linha. Se estiver zerado ou inválido, definimos uma duração padrão de 3 segundos, limitando-a obrigatoriamente ao início da próxima frase ou à duração total do áudio para evitar sobreposição de textos na tela.

### 5.2. Preservação de Tempos em Edições (`handleLoadTextToTempLines` em `src/pages/KaraokePage.tsx`)
Quando o usuário decide editar a letra na aba **Letra Texto** (para arrumar palavras que o Whisper entendeu errado):
* O texto do editor é normalizado convertendo quebras de linha Windows (`\r\n` $\rightarrow$ `\n`).
* **Se o número de linhas no editor for igual ao número de frases salvas**: O aplicativo substitui apenas o conteúdo do texto original de cada linha, **mantendo intactos** todos os tempos de início e fim (`startTime`, `endTime`) e traduções obtidos pela IA.
* **Se o número de linhas mudou**: O aplicativo faz uma busca inteligente: para as frases cujo texto é idêntico ao antigo, ele preserva o tempo original. Para as novas frases inseridas, ele herda o tempo da linha correspondente do mesmo índice anterior como fallback, evitando que a música inteira perca a sincronização.

### 5.3. Salvamento Direto e Banco de Dados (IndexedDB)
* Adicionamos o botão verde **"Salvar Letra Sincronizada"** na aba de Texto. 
* Ao clicar, as alterações de texto são sincronizadas com a memória usando o método do item 5.2, os dados são validados, formatados como arquivo LRC internamente, e gravados na tabela `texts` no IndexedDB do navegador. O `textId` da tabela `audioTracks` é atualizado para vincular o áudio à letra sincronizada.
* A Zona de Perigo executa `db.texts.delete(textId)` e limpa o `textId` do áudio, retornando a tela ao estado de introdução inicial.
