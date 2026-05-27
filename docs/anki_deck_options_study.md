# Estudo Aprofundado: Opções de Baralho do Anki

Este documento serve como base teórica e técnica detalhada sobre o funcionamento das opções de baralho (presets de estudo) do Anki. Ele descreve as regras de negócio, as fórmulas e os fluxos lógicos de cada funcionalidade para que possamos mapear e ajustar perfeitamente o comportamento do nosso aplicativo.

---

## Tópico 1: Limites Diários (Daily Limits)

A seção de **Limites Diários** controla a quantidade de cartões que o usuário pode estudar por dia no baralho. O objetivo é evitar a sobrecarga de estudos e equilibrar a introdução de novos conteúdos com a retenção de revisões antigas.

---

### 1. Novos cartões/dia (New Cards / Day)

* **O que é**: O número máximo de cartões novos (`interval = 0`, nunca revisados) a serem introduzidos em um único dia, caso estes estejam disponíveis.
* **Carga de Revisão no Curto Prazo**: Visto que novos materiais aumentarão sua carga de revisão no curto prazo, esta opção, tipicamente, deveria, pelo menos, ser **10x menor** do que seu limite de revisões.
* **Comportamento Técnico**: 
  - O sistema calcula quantos novos cartões já foram estudados hoje para este baralho específico.
  - Se esse número atingir o limite definido, os cartões novos adicionais contidos no baralho ficam temporariamente ocultos/indisponíveis até a virada de dia (o "próximo dia" no ciclo do SRS).
* **Comportamento em Sub-baralhos**:
  - Ao estudar um baralho que contenha sub-baralhos, os limites definidos em cada sub-baralho controlam o número máximo de cartões que serão retirados do respectivo sub-baralho.
  - Os limites do baralho selecionado controlam o total de cartões que serão mostrados no final.
* **Escopo das Abas**:
  * **Preset**: O limite é compartilhado com todos os baralhos que utilizam este mesmo preset.
  * **Esse baralho (This deck)**: O limite é específico para este baralho (sobrescreve o preset).
  * **Somente hoje (Today only)**: Faz uma mudança temporária e excepcional no limite deste baralho, expirando na virada do dia.

---

### 2. Revisões máximas/dia (Maximum Reviews / Day)

* **O que é**: O número máximo de cartões "A revisar" (`repetitions > 0` e `dueDate <= hoje`) a serem mostrados em um dia, caso os cartões estejam prontos para serem revisados.
* **Comportamento de Prioridade de Fila (Learning -> Review -> New)**:
  - O limite de revisão também afeta os cartões de aprendizagem dos dias subsequentes (*interday learning*).
  - Ao aplicar o limite, os cartões de aprendizagem dos dias anteriores são buscados primeiro, depois as revisões e, finalmente, os novos cartões.
* **Comportamento em Sub-baralhos**:
  - Ao estudar um baralho que contenha sub-baralhos, os limites definidos em cada sub-baralho controlam o número máximo de cartões que serão retirados do respectivo sub-baralho.
  - Os limites do baralho selecionado controlam o total de cartões que serão mostrados no final.
* **Por que o padrão é `9999`?**: 
  - Limitar revisões diárias quebra a integridade matemática da repetição espaçada (SRS). Se o usuário tem 100 revisões acumuladas e limita para 50, as outras 50 atrasam, gerando uma queda exponencial na taxa de retenção de memória e uma bola de neve de revisões acumuladas.
* **Escopo das Abas**:
  * **Preset**: O limite é compartilhado com todos os baralhos que utilizam este preset.
  * **Esse baralho (This deck)**: O limite é específico para este baralho.
  * **Somente hoje (Today only)**: Faz uma mudança temporária no limite deste baralho para o dia de hoje.

---

### 3. Novos cartões ignoram o limite de revisão (New cards ignore review limit)

* **O que é**: Seletor global de prioridade entre novos cartões e revisões.
* **Escopo**: Afeta toda a coleção.
* **Comportamento Técnico (Desativado - Padrão do Anki)**:
  - Por padrão, o limite de revisão também se aplica aos novos cartões, e nenhum novo cartão será mostrado quando o limite de revisão for alcançado.
  - **Fórmula Lógica**:
    $$\text{Limite de Novos Efetivo} = \begin{cases} 0 & \text{se } \text{Revisões Concluídas Hoje} \ge \text{Limite de Revisões Diário} \\ \text{Limite Novos} & \text{caso contrário} \end{cases}$$
* **Comportamento Técnico (Ativado)**:
  - Se essa opção estiver ativada, novos cartões serão mostrados independentemente de o limite de revisões diário ter sido alcançado ou ultrapassado.

---

### 4. Os limites começam do deck superior (Limits start from the parent deck)

* **O que é**: Controla a origem da herança hierárquica dos limites diários quando há decks aninhados.
* **Escopo**: Afeta toda a coleção.
* **Comportamento Técnico (Desativado - Padrão do Anki)**:
  - Por padrão, os limites começam a partir do baralho que você selecionar. Se você clica em um sub-baralho, as cotas do baralho pai de nível superior não são impostas se você estiver estudando apenas o filho.
* **Comportamento Técnico (Ativado)**:
  - Os limites começarão a partir do baralho de nível superior, o que é extremamente útil se você deseja estudar sub-baralhos individuais, enquanto impõe um limite total agregador de cartões por dia.
  - Qualquer estudo realizado em um sub-baralho consome a cota diária do baralho pai em tempo real.

---

## Tópico 2: Novos Cartões (New Cards Options)

Esta seção define as etapas pelas quais os novos cartões passam antes de se tornarem cartões de revisão permanentes, bem como a ordem de exibição inicial.

![Novos Cartões](file:///C:/Users/danie/.gemini/antigravity/brain/3a0e2451-4768-4ce6-801d-c8611370b952/media__1779809768894.png)

---

### 1. Etapas de aprendizagem (Learning Steps)

* **O que é**: Um ou mais atrasos temporais (delays), separados por espaços, que representam os estágios de memorização inicial de um novo cartão antes de sua graduação.
* **Comportamento Técnico**:
  - **Errei (Again)**: Reseta o cartão para a primeira etapa (atraso de `1m` por padrão). O cartão volta para a fila imediata.
  - **Bom (Good)**: Avança o cartão para a próxima etapa de aprendizagem (atraso de `10m` por padrão).
  - **Graduação**: Após passar com sucesso por todas as etapas de aprendizagem consecutivamente (sem errar), o cartão se torna um **cartão de revisão** (se gradua), saindo do modo intradiário e agendando-se para um dia diferente.
  - **Unidades Suportadas**: Segundos (`s`), minutos (`m`), horas (`h`), dias (`d`). Exemplo: `30s`, `1m`, `1h`, `2d`.

---

### 2. Intervalo de graduação (Graduating Interval)

* **O que é**: O número de dias de espera antes de mostrar o cartão novamente após o usuário pressionar o botão **Bom (Good)** na etapa final de aprendizagem.
* **Comportamento Técnico**: 
  - Determina o valor inicial de `interval` (em dias) quando o cartão se converte em revisão.
  - Por exemplo, se configurado para `1`, quando o cartão se gradua hoje, sua próxima revisão será amanhã (`dueDate = hoje + 1 dia`).

---

### 3. Intervalo fácil (Easy Interval)

* **O que é**: O número de dias de espera antes de mostrar o cartão novamente após o botão **Fácil (Easy)** ser pressionado em um cartão de aprendizagem (novo ou em aprendizado).
* **Comportamento Técnico**:
  - Ao clicar em "Fácil", o cartão **pula todas as etapas de aprendizagem restantes** e se gradua instantaneamente.
  - Ele é removido do modo de aprendizagem e agendado diretamente para o futuro usando este intervalo de dias (padrão: `4` dias).

---

### 4. Ordem de inserção (Insertion Order)

* **O que é**: Controla a atribuição de posições (`revisar#` ou número de índice do cartão) quando novos cartões são adicionados ao baralho.
* **Opções**:
  * **Sequencial (cartões mais antigos primeiro)**: Cartões com número de posição menor são mostrados primeiro (ordem cronológica de adição).
  * **Aleatório**: Atribui posições e ordenações aleatórias aos novos cartões, misturando-os durante as sessões de estudo.
  * **Comportamento Técnico**: Ao alterar esta opção nas configurações, a posição existente dos cartões novos no banco de dados deve ser reordenada/atualizada automaticamente de acordo com o novo critério selecionado.

---

## Tópico 3: Falhas (Failures / Lapses Options)

Esta seção define as regras aplicadas quando o usuário erra um cartão que já havia sido graduado (cartão de revisão), iniciando a fase de reaprendizagem.

![Falhas](file:///C:/Users/danie/.gemini/antigravity/brain/3a0e2451-4768-4ce6-801d-c8611370b952/media__1779801133391.png)

---

### 1. Etapas de reaprendizagem (Relearning Steps)

* **O que é**: Um ou mais atrasos temporais (delays), separados por espaços, que representam as etapas intradiárias que um cartão de revisão deve passar após receber a nota **Errei (Again)**.
* **Comportamento Técnico**:
  - **Pressionar Errei**: O cartão de revisão perde o seu estado de revisão ativa e é reenviado para a fila de reaprendizagem intradiária (por padrão, `10m` de espera).
  - **Se o campo estiver vazio (Zero atrasos)**: O cartão não entra em etapas intradiárias. Ele é imediatamente reagendado com um novo intervalo diário (aplicando-se o multiplicador de lapso do algoritmo SRS), pulando a reaprendizagem imediata.
  - **Unidades Suportadas**: Segundos (`s`), minutos (`m`), horas (`h`), dias (`d`). Exemplo: `10m`, `1d`.

---

### 2. Intervalo mínimo (Minimum Interval)

* **O que é**: O limite inferior (em dias) que pode ser atribuído a um cartão de revisão após ele receber a nota **Errei (Again)**.
* **Comportamento Técnico**:
  - Quando um cartão falha, o algoritmo SRS calcula seu novo intervalo baseado em um multiplicador de lapso (ex: `intervalo anterior * 0.2`).
  - Se o resultado deste cálculo for menor do que o intervalo mínimo definido, o sistema força o intervalo a ser exatamente este valor mínimo (por padrão: `1` dia).

---

### 3. Limite sanguessuga (Leech Threshold)

* **O que é**: O limite de falhas acumuladas (vezes que o botão **Errei** foi pressionado) que um cartão de revisão pode sofrer antes de ser classificado como um "sanguessuga" (*leech*).
* **Comportamento Técnico**:
  - O sistema incrementa o contador de falhas (`lapses`) de cada cartão individualmente toda vez que o usuário erra um cartão de revisão.
  - Quando `lapses >= limite sanguessuga` (padrão: `8` falhas), o sistema dispara a ação configurada para cartões sanguessugas.
  - **Conceito SRS**: Cartões sanguessugas são cartões que consomem tempo excessivo por falharem constantemente. É recomendado reescrevê-los, usar mnemônicos ou excluí-los da coleção.

---

### 4. Ação sanguessuga (Leech Action)

* **O que é**: A ação tomada pelo sistema assim que o cartão alcança o limite de falhas sanguessuga.
* **Opções**:
  * **Somente Etiquetas (Tag Only)**: Adiciona a etiqueta `"leech"` nas tags do cartão no banco de dados e exibe uma notificação ou pop-up. O cartão continua ativo na fila de estudos diários.
  * **Ocultar Cartão / Suspender Cartão (Suspend Card)**: Adiciona a etiqueta `"leech"` e altera o status do cartão para suspenso (ex: `suspended = true`). O cartão é ocultado/removido de todas as filas de estudo diárias até que o usuário o retire manualmente da suspensão.


---

## Tópico 4: Ordem de Exibição (Display Order)

Esta seção define como o sistema reúne e ordena os cartões antes de apresentá-los na fila diária de estudos.

### 1. Agrupamento de cartões novos (New card gather order)

* **O que é**: Define como o sistema seleciona quais cartões novos serão extraídos do banco de dados para formar a fila do dia.
* **Comportamento Técnico das Opções**:
  * **Deck (Baralho)**: Reúne os cartões de cada baralho em ordem, começando pelo topo. Os cartões de cada baralho são reunidos em posição ascendente. Se o limite diário do baralho selecionado for atingido, a coleta pode parar antes que todos os decks sejam verificados. É mais rápido em coleções grandes e permite priorizar subdecks do topo.
  * **Posição ascendente**: Reúne os cartões pelo número de posição ascendente (ordem cronológica), buscando os cartões mais antigos adicionados primeiro, independentemente do sub-baralho.
  * **Posição descendente**: Reúne os cartões pelo número de posição descendente, buscando os cartões mais recentes adicionados primeiro.
  * **Notas aleatórias**: Reúne cartões de notas (notes) selecionadas aleatoriamente. Quando o recurso de "enterrar irmãos" (bury) é desabilitado, permite que todos os cartões derivados de uma mesma nota sejam vistos em uma sessão (ex: cartão frente->verso e verso->frente).
  * **Cartões aleatórios**: Reúne os cartões novos de forma completamente aleatória em toda a coleção do baralho/sub-baralhos.

---

## Tópico 5: Ocultar (Burying / Hiding Siblings)

Esta seção controla o comportamento de "enterrar" (adiar para o dia seguinte) cartões irmãos, ou seja, cartões gerados a partir da mesma nota base (como cartões invertidos ou com múltiplas omissões).

**Hierarquia de Coleta de Cartões:**
Quando o sistema coleta cartões para a sessão diária, a prioridade da fila segue estritamente a seguinte ordem:
1. **Aprendizado Intradiário** (Cartões em etapas iniciais de minutos/horas ou que falharam recentemente).
2. **Aprendizado Interdiário** (Cartões de aprendizado aguardando 1 ou mais dias).
3. **Revisões** (Cartões já graduados agendados para hoje).
4. **Novos Cartões** (Cartões nunca estudados).

**Regras Gerais de Ocultação:**
- Se todas as opções de ocultação estiverem ativadas, o cartão irmão que aparecer **primeiro** na fila de prioridades será o escolhido para exibição, e ele ocultará/adiará os outros cartões da mesma nota. Por exemplo, um cartão de revisão terá preferência e forçará a ocultação de um cartão novo irmão.
- Cartões irmãos de prioridade mais baixa não podem ocultar cartões de prioridade mais alta. Se a ocultação de cartões novos estiver desativada e você estudar um cartão novo, esse estudo não irá ocultar um cartão de revisão irmão que já estava na fila para hoje.

### 1. Ocultar novos irmãos até o dia seguinte (Bury new siblings)

* **O que é**: Adia até o dia seguinte os cartões **novos** que pertencem à mesma nota de um cartão já visto ou programado para hoje.
* **Comportamento Técnico**: 
  - Evita introduzir múltiplos cartões novos do mesmo contexto no mesmo dia, o que poderia dar pistas fáceis sobre a resposta.

### 2. Ocultar irmãos de revisão até o dia seguinte (Bury review siblings)

* **O que é**: Adia até o dia seguinte outros cartões **de revisão** pertencentes à mesma nota.
* **Comportamento Técnico**:
  - Impede que você revise a mesma informação por ângulos diferentes na mesma sessão (ex: Frente->Verso e Verso->Frente no mesmo dia). Isso maximiza o efeito de espaçamento na retenção de memória.

### 3. Ocultar irmãos em aprendizado até o dia seguinte (Bury interday learning siblings)

* **O que é**: Adia para o próximo dia outras cartas de **aprendizado interdiário** (cartões em aprendizado com intervalos maiores que 1 dia) da mesma nota.
* **Comportamento Técnico**:
  - Aplica o isolamento diário a cartões que ainda não se graduaram completamente, mas que possuem etapas em dias diferentes.

---

## Tópico 6: Áudio

Esta seção gerencia como os arquivos de áudio (geralmente anexados aos cartões para prática de pronúncia, audição ou idiomas) se comportam durante as sessões de revisão.

### 1. Não reproduzir o áudio automaticamente (Don't play audio automatically)

* **O que é**: Controla o comportamento de *autoplay* dos arquivos de áudio presentes no cartão exibido.
* **Comportamento Técnico**:
  - Por padrão (se a opção estiver desativada), quando o usuário acessa um cartão (ou revela o seu verso), qualquer mídia de áudio contida nele é reproduzida automaticamente.
  - Se a opção estiver **ativada**, o *autoplay* é bloqueado. Para ouvir a mídia, o usuário deve disparar o evento de áudio de forma manual (ex: clicando em um ícone de alto-falante ou usando um atalho de teclado designado para repetir áudio).

### 2. Pular pergunta ao repetir a resposta (Skip question when replaying answer)

* **O que é**: Define se o áudio associado à parte da **pergunta** (frente do cartão) deve ser reproduzido quando a ação "Repetir" é acionada enquanto o usuário já está visualizando a **resposta** (verso).
* **Comportamento Técnico**:
  - Quando o usuário está no lado da resposta e pressiona o botão/tecla de "Repetir Áudio", o sistema precisa decidir quais mídias tocar.
  - Se **desativado**, o sistema toca todo o pacote de áudios daquele cartão sequencialmente (primeiro o áudio da frente/pergunta, e em seguida o áudio do verso/resposta).
  - Se **ativado**, o sistema pula o áudio da pergunta. Apenas os arquivos de áudio pertencentes estritamente ao lado da resposta (verso) serão tocados.

---

## Tópico 7: Cronômetro (Timer)

Esta seção gerencia o rastreamento do tempo que o usuário gasta em cada revisão de cartão. Esse tempo é fundamental para gerar estatísticas precisas de ritmo e dedicação de estudos.

### 1. Máximo de segundos para resposta (Maximum answer seconds)

* **O que é**: Define um teto rígido (limite máximo em segundos) de tempo que o sistema aceita registrar para a revisão de um único cartão.
* **Comportamento Técnico**:
  - O sistema inicia um cronômetro no momento em que o cartão é apresentado.
  - Se o usuário se distrair, bloquear a tela do dispositivo, ou simplesmente demorar, e o tempo total da revisão ultrapassar este limite (ex: `60` segundos), o sistema fará um truncamento.
  - O tempo registrado no log de revisão no banco de dados será igual a este limite estabelecido. Isso garante que longas ausências não distorçam a estatística de "Tempo médio por cartão".

### 2. Mostrar cronômetro de resposta (Show answer timer)

* **O que é**: Alterna a visibilidade visual de um cronômetro na interface durante a sessão de estudos.
* **Comportamento Técnico**:
  - Se **ativado**, a tela renderizará um contador de segundos rodando em tempo real, ajudando a criar senso de urgência e manter o foco do usuário.
  - Se **desativado**, a contagem é invisível para o usuário (roda silenciosamente no background), mas os dados continuam sendo calculados e persistidos normalmente no banco de dados.

### 3. Parar o temporizador ao responder (Stop timer on answer)

* **O que é**: Interrompe a contagem do cronômetro visual na interface assim que o usuário revela o verso do cartão (resposta).
* **Comportamento Técnico**:
  - Se **ativado**, ao clicar no botão "Mostrar Resposta", a interface congela o timer visual, permitindo ao usuário ler o verso do cartão sem a pressão psicológica do cronômetro rodando.
  - **Importante**: Essa configuração afeta apenas a camada visual (UI/UX). Internamente, o motor estatístico continuará medindo o tempo total real até que um botão de avaliação (Bom, Difícil, etc) seja pressionado, para manter a fidelidade das estatísticas.

---

## Tópico 8: Avanço Automático (Auto Advance)

O recurso de avanço automático permite que o usuário estude de forma contínua sem precisar interagir manualmente (clicar/tocar) para revelar respostas ou avaliar cartões (estudo "hands-free" ou modo de reprodução).

### 1. Segundos para mostrar a pergunta (Seconds to show question)

* **O que é**: O tempo de espera em segundos, a partir do momento em que a frente do cartão (pergunta) é carregada, antes que o sistema revele automaticamente a resposta.
* **Comportamento Técnico**:
  - Quando o modo de avanço automático está ativo e o valor é maior que zero (`> 0`), um timer interno é disparado ao exibir a pergunta.
  - Ao esgotar o tempo, o sistema dispara programmaticamente a ação "Mostrar Resposta" e revela o verso.
  - Se configurado como `0`, o temporizador para a pergunta é desativado, e a tela aguardará a interação manual do usuário.

### 2. Segundos para mostrar a resposta (Seconds to show answer)

* **O que é**: O tempo de espera em segundos após o verso (resposta) ser revelado, antes que o sistema tome uma ação automática de avaliação e siga para o próximo cartão.
* **Comportamento Técnico**:
  - Quando o valor é `> 0`, o sistema inicia a contagem assim que o lado da resposta é renderizado na tela.
  - Ao esgotar o tempo, ele executa a **Ação de resposta** pré-configurada e carrega o próximo cartão da fila.
  - Se configurado como `0`, o avanço após a resposta fica desativado.

### 3. Esperando pelo Áudio (Wait for audio)

* **O que é**: Intertrava (vincula) o cronômetro do avanço automático à duração do arquivo de áudio sendo reproduzido no cartão.
* **Comportamento Técnico**:
  - Se **ativado**, o sistema "escuta" o estado do player de áudio (`isPlaying`). A contagem regressiva para mostrar a resposta ou passar de cartão fica pausada até que a mídia termine de tocar, garantindo que frases longas não sejam cortadas no meio.
  - Se **desativado**, o temporizador obedece estritamente aos segundos configurados, mesmo que o áudio ainda esteja tocando no fundo.

### 4. Ação da Questão (Question action)

* **O que é**: Qual evento o sistema deve engatilhar quando o tempo da pergunta ("Segundos para mostrar a pergunta") acaba.
* **Comportamento Técnico**:
  - A ação padrão esperada é **"Mostrar Resposta"** (Reveal Answer). O sistema altera o estado da UI para exibir o verso do cartão.

### 5. Ação de resposta (Answer action)

* **O que é**: Define qual nota de avaliação o sistema deve registrar no banco de dados automaticamente quando o tempo da resposta se esgota.
* **Comportamento Técnico**:
  - Para prosseguir sem intervenção humana, o sistema precisa submeter uma resposta para o algoritmo de Repetição Espaçada.
  - O usuário pode configurar qual botão o sistema vai "apertar" por ele. Geralmente as opções mapeiam para os botões do SRS: **Errei**, **Difícil**, **Bom** ou **Fácil**. Pode haver também a opção de suspender ou ocultar.
  - O sistema salva essa avaliação, recalcula o intervalo de revisão do cartão e puxa o próximo item da fila, reiniciando o ciclo.

---

## Tópico 9: Avançado (Advanced)

Esta seção lida diretamente com os parâmetros e variáveis centrais do algoritmo de Repetição Espaçada (SRS). Modificar estes valores afeta a inclinação da curva de esquecimento, a agressividade dos espaçamentos e a carga de trabalho geral das revisões a médio e longo prazo.

### 1. Intervalo máximo (Maximum interval)

* **O que é**: Um limite rígido (em dias) que um cartão pode alcançar de espera até a próxima revisão.
* **Comportamento Técnico**:
  - O cálculo de intervalos é exponencial. Ao longo dos anos, intervalos podem chegar a milhares de dias.
  - Se o cálculo matemático do algoritmo resultar em um valor maior que o limite configurado (ex: `36500` dias, aprox. 100 anos), o sistema o trunca para este limite.
  - Quando um cartão atinge esse teto, pressionar *Difícil*, *Bom* ou *Fácil* aplicará essencialmente o mesmo atraso fixo máximo definido aqui.
  - **Dica Prática**: Reduzir este número drasticamente (ex: `180` dias) forçará o aplicativo a lhe mostrar cartões muito conhecidos repetidamente a cada 6 meses, inflando a carga de trabalho diária desnecessariamente.

### 2. Facilidade inicial (Starting ease)

* **O que é**: O multiplicador base de "facilidade" (`Ease Factor`) atribuído a todos os cartões recém-criados.
* **Comportamento Técnico**:
  - Este é o motor do espaçamento. O valor padrão geralmente é `2,50` (ou 250%).
  - Isso significa que, na primeira vez que um cartão se graduar da fase de aprendizado e o botão *Bom* for pressionado, o próximo intervalo será aproximadamente `2,5 vezes` maior que o anterior.
  - Os botões *Fácil* ou *Errei* ajustam esse fator dinamicamente ao longo da vida do cartão. O valor definido aqui é apenas a linha de partida padrão.

### 3. Bônus por ser Fácil (Easy bonus)

* **O que é**: Um fator extra multiplicador aplicado na fórmula do intervalo quando o botão *Fácil (Easy)* é pressionado em um cartão de revisão.
* **Comportamento Técnico**:
  - O sistema recompensa a fluência do usuário. Se a memória está forte, o intervalo cresce agressivamente.
  - Fórmula base simplificada para o botão Fácil: `Novo Intervalo = Intervalo Atual * Fator de Facilidade * Bônus Fácil`.
  - O valor padrão `1,30` significa que um bônus adicional de 30% no tempo é somado ao cálculo padrão.

### 4. Modificador de intervalo (Interval modifier)

* **O que é**: Um multiplicador global aplicado em **todas** as revisões de cartões maduros. Serve como um ajuste universal de retenção.
* **Comportamento Técnico**:
  - Este multiplicador entra no final do cálculo do SRS: `Intervalo Final = Intervalo SRS Calculado * Modificador de intervalo`.
  - Um valor padrão de `1,00` não causa impacto.
  - Se configurado para `1,20`, os intervalos serão estendidos em 20% artificialmente (agendamento mais agressivo, poupa tempo, reduz taxa de retenção).
  - Se configurado para `0,80`, os intervalos serão encurtados em 20% (agendamento conservador, sobrecarrega o usuário com mais estudos, mas maximiza retenção da memória).

### 5. Intervalo árduo (Hard interval)

* **O que é**: O fator aplicado ao intervalo atual de um cartão quando o botão *Difícil (Hard)* é pressionado.
* **Comportamento Técnico**:
  - Pressionar *Difícil* significa que você lembrou, mas foi muito custoso; logo, o cartão não falha (não volta à etapa de reaprendizado), mas não deve saltar o intervalo como faria normalmente.
  - O sistema abandona temporariamente o "Fator de Facilidade" do cartão e o multiplica por este `Intervalo Árduo`.
  - Exemplo com `1,20`: O cartão ganha apenas 20% de incremento de tempo em relação ao intervalo atual.

### 6. Novo intervalo (New interval)

* **O que é**: O multiplicador de sobrevivência ou "multiplicador de lapso". Define o quanto do intervalo anterior é preservado quando o usuário aperta *Errei (Again)* em um cartão de revisão.
* **Comportamento Técnico**:
  - Quando um cartão bem maduro falha, a neurociência indica que a fundação da memória existe, ela só perdeu o elo imediato. Portanto, o intervalo não precisa voltar a zero dias.
  - Se o valor for `0,50` e o cartão estava com intervalo de 100 dias, após errar e passar pelo reaprendizado intradiário, o novo intervalo base para continuar os estudos começará em 50 dias.

### 7. Agendamento personalizado (Custom scheduling)

* **O que é**: Uma caixa de texto avançada que permite injetar código (tipicamente JavaScript) para injetar ou sobrescrever as lógicas nativas do agendamento.
* **Comportamento Técnico**:
  - Modifica a execução do motor de SRS da coleção inteira.
  - Usado geralmente por *power users* para importar scripts que ajustam comportamentos (como dispersão de carga e dispersão de revisões). Por poder quebrar a integridade do banco de dados se mal utilizado, carrega o aviso de "uso por conta e risco".
