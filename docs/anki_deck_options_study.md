# Estudo Aprofundado: Opções de Baralho do Anki

Este documento serve como base teórica e técnica detalhada sobre o funcionamento das opções de baralho (presets de estudo) do Anki. Ele descreve as regras de negócio, as fórmulas e os fluxos lógicos de cada funcionalidade para que possamos mapear e ajustar perfeitamente o comportamento do nosso aplicativo.

---

## Tópico 1: Limites Diários (Daily Limits)

A seção de **Limites Diários** controla a quantidade de cartões que o usuário pode estudar por dia no baralho. O objetivo é evitar a sobrecarga de estudos e equilibrar a introdução de novos conteúdos com a retenção de revisões antigas.

---

### 1. Novos cartões/dia (New Cards / Day)

* **O que é**: O limite de cartões novos (`interval = 0`, nunca revisados) que serão inseridos no fluxo de estudos por dia.
* **Comportamento Técnico**: 
  - O sistema calcula quantos novos cartões já foram estudados hoje para este baralho específico.
  - Se esse número atingir o limite definido, os cartões novos adicionais contidos no baralho ficam temporariamente ocultos/indisponíveis até a virada de dia (o "próximo dia" no ciclo do SRS).
* **Escopo das Abas**:
  * **Preset**: O valor digitado (ex: `9999` ou `20`) é salvo no preset. Todos os baralhos que compartilham este mesmo preset respeitam esse limite comum.
  * **Esse baralho (This deck)**: Cria uma sobreposição (*override*) persistente no banco de dados para este baralho em particular. Apenas este baralho usará o novo valor, enquanto os outros associados ao mesmo preset continuam com o valor geral del preset.
  * **Somente hoje (Today only)**: Cria uma sobreposição temporária na memória (ou em um campo volátil do banco) que expira automaticamente no momento da virada diária do SRS. É usado quando o usuário quer limpar um acúmulo de novos cartões de forma excepcional em um único dia.

---

### 2. Revisões máximas/dia (Maximum Reviews / Day)

* **O que é**: O limite superior de cartões a revisar (`repetitions > 0` e `dueDate <= hoje`) apresentados ao usuário no dia.
* **Comportamento Técnico**:
  - O sistema filtra todos os cartões agendados para hoje ou datas passadas.
  - O número de cartões exibidos na fila de revisões é limitado pela diferença entre este limite e a quantidade de revisões que o usuário já concluiu hoje.
* **Por que o padrão é `9999`?**: 
  - O criador do Anki recomenda fortemente manter este valor no máximo (`9999`). 
  - Limitar revisões diárias quebra a integridade matemática da repetição espaçada (SRS). Se o usuário tem 100 revisões acumuladas e limita para 50, os outros 50 cartões atrasam, gerando uma queda exponencial na taxa de retenção de memória e uma bola de neve de revisões acumuladas.
* **Escopo das Abas**:
  * **Preset**: Limite geral aplicado a todos os decks sob o preset.
  * **Esse baralho**: Sobrescrita definitiva para este deck.
  * **Somente hoje**: Sobrescrita que dura apenas até a próxima virada de dia, permitindo ao usuário "limpar" filas acumuladas temporariamente.

---

### 3. Novos cartões ignoram o limite de revisão (New cards ignore review limit)

* **O que é**: Um seletor de prioridade entre novos cartões e revisões.
* **Comportamento Técnico (Desativado - Padrão do Anki)**:
  - Se o usuário já atingiu seu limite diário de revisões (ex: revisou 50 de um limite de 50 revisões), o aplicativo **bloqueia a exibição de novos cartões**, mesmo se o limite de novos cartões ainda não tiver sido atingido.
  - **Fórmula Lógica**:
    $$\text{Limite de Novos Efetivo} = \begin{cases} 0 & \text{se } \text{Revisões Concluídas Hoje} \ge \text{Limite de Revisões Diário} \\ \text{Limite Novos} & \text{caso contrário} \end{cases}$$
* **Comportamento Técnico (Ativado)**:
  - O limite de novos cartões é independente. Mesmo se o limite de revisões for atingido ou esgotado, os novos cartões continuam aparecendo até atingirem o seu próprio limite.
* **Por que existe?**: Serve como freio de segurança. Se o usuário já está sobrecarregado com revisões pendentes, introduzir cartões novos só aumentaria a bola de neve de revisões para os dias seguintes.

---

### 4. Os limites começam do deck superior (Limits start from the parent deck)

* **O que é**: Controla a herança e o compartilhamento de limites diários em estruturas hierárquicas de sub-baralhos (ex: `Idiomas::Inglês`).
* **Comportamento Técnico (Desativado - Padrão do Anki)**:
  - Se você clica diretamente em um sub-baralho (`Inglês`), ele usa os limites individuais definidos para ele ou para o seu preset.
  - Se você clica no baralho pai (`Idiomas`), o limite do baralho pai atua como um teto geral para a soma dos estudos dos sub-baralhos.
* **Comportamento Técnico (Ativado)**:
  - Os limites diários do baralho pai (`Idiomas`) são aplicados primeiro e começam a ser decrementados mesmo se o usuário estiver estudando diretamente os sub-baralhos (`Inglês`).
  - O progresso de estudo em qualquer sub-baralho consome a cota diária do baralho pai em tempo real, impedindo que o usuário ultrapasse a meta agregada ao alternar entre os decks filhos.
* **Ícone do Globo**: 🌐 Indica que este comportamento afeta globalmente o preset em toda a sua estrutura de herança hierárquica.
