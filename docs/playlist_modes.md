# Modos de Reprodução e Prática de Playlist

A funcionalidade de **Playlist e Álbuns de Áudio** do Memorize permite carregar áudios de estudo, músicas ou podcasts e acompanhá-los com transcrições sincronizadas (.lrc). Além da visualização simples e do Modo Ditado, existem dois modos adicionais voltados à prática ativa de fala, escuta e canto.

---

## 1. Modo Playback / Karaokê (Sing Along)

Este modo é projetado para que o usuário acompanhe o áudio cantando ou lendo em voz alta em sincronia com o ritmo da gravação original, focando na fluidez e ritmo da fala.

*   **Processamento 100% Local (Sem Custos de IA)**: O modo playback utiliza apenas o arquivo de áudio carregado pelo usuário e as letras sincronizadas. Nenhuma API de Inteligência Artificial é consultada durante a reprodução, tornando o recurso totalmente offline, privado e sem custos adicionais.
*   **Aparência Cinematográfica**: A interface oculta painéis secundários (como traduções ou guias de edição) e foca unicamente nas letras.
*   **Foco Visual Dinâmico**: 
    *   A frase ativa é exibida em tamanho expandido (`text-2xl` a `text-3xl`), com fonte extra negrito e um brilho suave da cor principal.
    *   As frases anteriores e posteriores são suavemente borradas (`blur-[0.7px]`) e esmaecidas (`opacity-20`), permitindo que a atenção do usuário fique 100% retida na linha atual.
*   **Rolagem Inteligente**: O visualizador centraliza automaticamente a frase ativa na tela através de rolagens suaves.
*   **Destaque Palavra por Palavra**: As palavras individuais da frase ativa acendem na tela conforme são cantadas no áudio.

---

## 2. Modo Desafio de Pronúncia (Pronunciation Challenge)

Este modo utiliza o microfone do usuário e o algoritmo de Speech Recognition (Reconhecimento de Voz) nativo do navegador para verificar se a pronúncia está correta comparada à transcrição oficial da linha ativa de forma **hands-free**.

*   **Microfone Contínuo / Mãos Livres**:
    *   O usuário clica em um botão global para ativar o microfone no início da música.
    *   O microfone permanece ativo continuamente durante todo o playback da faixa. Ele se auto-reconecta durante silêncios ou partes instrumentais longas.
    *   O sistema detecta automaticamente qual frase está ativa na reprodução e compara a fala do usuário a ela em tempo real.
    *   Ao finalizar uma frase (`isFinal = true`), o score daquela frase é gravado no histórico, e o sistema se prepara para a próxima frase da música de forma autônoma.
*   **Comparação e Algoritmo**:
    *   A fala capturada é normalizada (remoção de pontuação, acentuação e conversão para minúsculas).
    *   O algoritmo de distância Levenshtein por palavras (`getWordLevenshteinDistance`) calcula as diferenças entre o texto esperado e o texto pronunciado.
    *   Uma pontuação de precisão de **0% a 100%** é atribuída à tentativa.
*   **Diferenciação Visual das Palavras (Diff)**:
    *   **Verde**: Palavra pronunciada corretamente.
    *   **Vermelho**: Palavra omitida, incorreta ou mal pronunciada.
    *   **Cinza**: Palavras restantes na linha que ainda não foram avaliadas.
*   **Histórico de Desempenho**: As pontuações de cada linha praticada são salvas em memória e exibidas ao lado de cada linha, permitindo ver a evolução na música.
*   **Média do Álbum**: Exibe a precisão média geral de pronúncia na sessão de prática do áudio ativo.

---

## 3. Estratégia de Transcrição por IA: Divisão por Chunks Baseados em Silêncio

Para garantir que a transcrição por IA seja extremamente precisa e que os carimbos de tempo (timestamps) fiquem perfeitamente alinhados, o Memorize utiliza uma estratégia de **divisão inteligente em chunks**:

1.  **Decodificação Local**: O áudio do usuário é decodificado localmente pelo navegador para um buffer de áudio PCM (`AudioBuffer`).
2.  **Detecção de Silêncios**: Em vez de cortar o áudio a cada 30 segundos exatos (o que cortaria palavras ao meio), o sistema analisa a amplitude de onda em uma janela de busca de +/- 3 segundos ao redor de cada marca de 30s. O corte é feito no ponto de menor energia sonora (silêncios ou respirações).
3.  **Conversão e Envio**: Cada pedaço é convertido para um arquivo WAV temporário no formato base64 e enviado sequencialmente à IA.
4.  **Re-offset de Tempos**: O tempo retornado pela IA é somado ao início absoluto do respectivo pedaço de áudio.
5.  **Garantia de Cronologia**: Uma etapa de pós-processamento garante que os tempos sejam estritamente crescentes (mínimo de 0.5s de distância entre frases), eliminando stutters e saltos na tela.
6.  **Auto-Save**: Concluída a transcrição, os dados são salvos imediatamente no banco de dados e a interface abre o modo visualizador com os modos de playback liberados.

---

## ⚠️ Guia de Uso Recomendado: Uso de Fones de Ouvido

Para obter a melhor precisão possível no **Modo Desafio de Pronúncia**, é de suma importância que o usuário utilize **fones de ouvido**.

### Por que isso é importante?
1.  **Eco e Feedback**: Se o áudio/música estiver saindo pelas caixas de som (alto-falantes) do computador ou celular, o microfone captará a voz do cantor original em conjunto com a voz do usuário.
2.  **Poluição de Sinal**: O mecanismo de Speech Recognition do navegador tentará decodificar ambos os sons simultaneamente, resultando em uma taxa alta de falsos negativos (palavras marcadas em vermelho mesmo quando pronunciadas corretamente).
3.  **Cancelamento Passivo**: Ao utilizar fones, apenas a voz do usuário é direcionada ao microfone, isolando a gravação de áudio em segundo plano e garantindo pontuações justas e precisas.

---

## 4. Remoção de Voz por IA Local (WASM - Spleeter)

Para proporcionar uma experiência de karaokê/playback perfeita (com 0% de voz do cantor original e sem quebrar os tempos da transcrição `.lrc`), o Memorize integra um mecanismo de **Isolamento Vocal por Inteligência Artificial rodando 100% no cliente (WebAssembly)**.

### Componentes Técnicos
1. **Inferência e Runtime ONNX (`onnxruntime-web`)**:
   - Utilizamos a biblioteca oficial do ONNX Runtime Web para rodar o modelo em CPU local via WebAssembly.
   - Os binários WebAssembly (`ort-wasm-simd-threaded.*.wasm`) foram movidos para a pasta `public/` do projeto, garantindo que o carregamento ocorra de forma local, offline e gratuita (sem requisições CDNs).
2. **Modelo Spleeter Otimizado (FP16)**:
   - Utilizamos o modelo quantizado em meia-precisão (`accompaniment.fp16.onnx` com tamanho de **19.7 MB**) do release oficial do `sherpa-onnx`. Isso garante downloads rápidos e baixo consumo de memória RAM pelo navegador.
3. **Web Worker em Segundo Plano (`vocalSeparatorWorker.ts`)**:
   - O processamento de áudio exige cálculos pesados que poderiam travar o navegador. O pipeline é executado em um Web Worker, mantendo a interface do usuário responsiva e fluida com atualizações de progresso em tempo real (ex: `Isolando faixa instrumental (40%)...`).
4. **Pipeline de Processamento Digital de Sinais (DSP)**:
   - **Reamostragem**: O áudio do usuário é reamostrado localmente para 44.1 kHz via `OfflineAudioContext` (fator obrigatório para compatibilidade com o modelo).
   - **Duplicação de Canal**: Se o áudio enviado for Mono, ele é duplicado para Estéreo antes do fatiamento.
   - **Short-Time Fourier Transform (STFT)**: A onda é fatiada em quadros de 2048 samples com hop de 512 samples. Cada quadro recebe uma janela de Hann e o FFT Radix-2 Cooley-Tukey é calculado. Os dados são estruturados no formato do tensor de entrada do modelo: `[2, num_splits, 512, 1024]` (canal, splits de 5.94s, quadros, bins de frequência).
   - **Inferencia e Reconstrução de Fase (iSTFT)**: O modelo estima a magnitude espectral da faixa instrumental. Reconstruímos o espectro complexo final multiplicando a fase do sinal original de entrada pela máscara prevista de magnitude. Aplicamos o IFFT e a normalização de janela ponderada por overlap-add (WOLA) para garantir áudio limpo, sem estalos ou distorções.
5. **Persistência IndexedDB e Cache**:
   - O áudio processado é encodado em formato WAV (PCM 16 bits) e gravado na propriedade `instrumentalFile` do registro da música no IndexedDB (Dexie).
   - Ao ativar a opção "Remover Voz (IA)" na barra de controle da playlist, o player carrega o áudio instrumental no lugar do áudio original mantendo o segundo exato onde a música estava tocando.

---

## 5. Compatibilidade de Navegador

O reconhecimento de voz e o processador de IA local dependem de recursos modernos do navegador:
*   **Speech Recognition**: Compatível com Google Chrome, Microsoft Edge, Safari e Opera (em desktop e dispositivos móveis). O Firefox clássico possui suporte limitado (exige ativação manual de flags).
*   **Web Workers & WebAssembly**: Compatível com todos os navegadores modernos estáveis.
*   **WebGPU (Aceleração Futura)**: O ONNX Runtime pode ser configurado para WebGPU para aceleração de hardware (atualmente desativado por padrão para garantir compatibilidade 100% estável via WebAssembly).
