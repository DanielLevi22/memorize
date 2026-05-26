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

