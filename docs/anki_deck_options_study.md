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
