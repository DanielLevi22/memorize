# Requisitos das Opções de Estudo (Estilo Anki) no Memorize

Este documento lista os requisitos formais de comportamento e testes para a implementação das opções de estudo do Anki no aplicativo Memorize, divididos por tópicos.

---

## 📅 Tópico 1: Limites Diários (Daily Limits) — `[x] Concluído`

O sistema deve permitir definir e aplicar limites diários de **Novos cartões/dia** e **Revisões máximas/dia** em três escopos de prioridade:

- [x] **REQ-1.1: Hierarquia de Escopo**
  - O sistema deve resolver os limites do dia na seguinte prioridade de sobrescrita: `Somente hoje` > `Esse baralho` > `Preset`.
- [x] **REQ-1.2: Expiração de Limite Temporário**
  - O limite do tipo `Somente hoje` deve ser redefinido e expirar automaticamente quando a data do sistema mudar (quando a data atual não for igual à data gravada do limite temporário).
- [x] **REQ-1.3: Redução Dinâmica da Fila durante o Estudo**
  - Conforme o usuário estuda cartas na Arena de Estudos, a fila de cartas restantes para hoje deve diminuir em tempo real (reduzindo a quantidade de novos ou revisados disponíveis).
- [x] **REQ-1.4: Bloqueio de Novos Cartões pelo Limite de Revisão**
  - Por padrão (se `newCardsIgnoreReviewLimit` for falso), se o limite de revisões de hoje for alcançado, a fila de novos cartões deve ser automaticamente travada/truncada para 0.
- [x] **REQ-1.5: Independência de Novos Cartões**
  - Se `newCardsIgnoreReviewLimit` estiver ativado no preset, novos cartões continuam aparecendo até o seu próprio limite diário, mesmo se as revisões diárias estiverem esgotadas.
- [x] **REQ-1.6: Controles Segmentados e Reset na UI**
  - A interface de edição do deck (`DeckModal`) deve conter abas de seleção de escopo (`Preset` / `Esse baralho` / `Somente hoje`), botões de reset individual de limites e toggles globais animados para o preset.

---

## 🌱 Tópico 2: Novos Cartões (New Cards Options) — `[x] Concluído`

Este tópico gerencia a introdução de novas cartas no sistema, regulando a ordem de exibição, passos intradiários de aprendizado e intervalos de graduação.

- [x] **REQ-2.1: Etapas de Aprendizagem Intradiária (Learning Steps)**
  - O sistema deve suportar uma sequência de passos em minutos/horas (ex: `1m 10m` ou `15m`).
  - **Nota Errei (Again)**: Reseta o progresso de aprendizado do card para o passo inicial (`learningStep = 0`).
  - **Nota Difícil (Good)**: Avança o card para o próximo passo de aprendizado (`learningStep = current + 1`).
- [x] **REQ-2.2: Graduação de Aprendizagem**
  - Se o card estiver na etapa final das etapas de aprendizagem e receber a nota **Difícil (Good)**, ele deve se **graduar** (virar revisão), recebendo o intervalo inicial de `graduatingInterval` (em dias) e agendando-se para o futuro.
- [x] **REQ-2.3: Graduação Instantânea (Fácil)**
  - Ao receber a nota **Fácil (Easy)** a qualquer momento da fase de aprendizagem, o card deve se graduar instantaneamente, recebendo o intervalo inicial de `easyInterval` (em dias) e agendando-se para o futuro.
- [x] **REQ-2.4: Fila Dinâmica de Estudo (Reinserção)**
  - Durante a Arena de Estudos, se um card novo ou em aprendizado receber uma nota que o mantenha em aprendizado (Again ou Good antes de graduar), ele deve ser **reinserido dinamicamente na fila da sessão ativa** com um espaçamento proporcional ao tempo configurado (ex: `1m` -> 3 cards depois; `10m` -> 10 cards depois).
- [x] **REQ-2.5: Ordem de Inserção de Novos**
  - **Sequencial**: Os cartões novos são mostrados conforme a data de criação (`createdAt` ascendente).
  - **Aleatório**: Os cartões novos são embaralhados na fila de coleta.
- [x] **REQ-2.6: Separação de Limites de Coleta**
  - Cartões em aprendizagem intradiária ativa ou interdiária não devem consumir a cota diária do limite de novos cartões/dia (que é restrita apenas para introduzir novos cartões com `interval = 0` e nunca estudados).

---

## 🪰 Tópico 3: Falhas & Esquecimentos (Lapses & Relearning) — `[x] Concluído`

Este tópico gerencia o comportamento quando um cartão de revisão (já estudado) é esquecido pelo usuário (recebe a nota Errei/Again).

- [x] **REQ-3.1: Etapas de Reaprendizagem (Relearning Steps)**
  - O sistema deve suportar etapas de reaprendizagem configuradas no preset (ex: `10m`).
  - Se configurado, o cartão entra na fila de reaprendizagem intradiária (intervalo = 0, passo = 0).
  - Se o campo de etapas de reaprendizagem for vazio, o cartão pula a fase intradiária e é reagendado diretamente com base no intervalo de lapso calculado.
- [x] **REQ-3.2: Intervalo Mínimo (Minimum Interval)**
  - Ao errar, o novo intervalo do cartão é calculado aplicando o `lapseMultiplier` sobre o intervalo anterior.
  - Se o intervalo calculado for menor que `minimumInterval` do preset, o sistema deve forçar o intervalo para `minimumInterval` (mínimo de 1 dia).
- [x] **REQ-3.3: Limite Sanguessuga (Leech Threshold)**
  - O sistema deve incrementar o contador de falhas (`lapses`) toda vez que um cartão de revisão for avaliado como "Errei" (Again).
  - Se `lapses` atingir ou ultrapassar o `leechThreshold` definido no preset (padrão: 8), o cartão deve ser classificado como sanguessuga.
- [x] **REQ-3.4: Ação Sanguessuga (Leech Action)**
  - **Somente Etiquetas (Tag Only)**: O sistema adiciona a etiqueta `"leech"` nas tags do cartão no banco de dados, mantendo o cartão ativo nos estudos.
  - **Suspender Cartão (Suspend)**: O sistema adiciona a etiqueta `"leech"` nas tags do cartão, marca `suspended = true` e o oculta/remove de todas as filas de estudo diário.
- [x] **REQ-3.5: Gestão de Cartões Suspensos**
  - O banco de cards (`CardsPage`) e o visualizador (`CardPreviewModal`) devem indicar claramente quando um cartão está suspenso.
  - O usuário deve poder alternar manualmente o status de suspensão (Suspender/Reativar) de um cartão a partir do modal de pré-visualização.

---

## 🔀 Tópico 4: Ordem de Exibição (Display Order) — `[x] Concluído`

Este tópico define a forma como as cartas são coletadas e ordenadas do banco de dados para formar a fila de estudos diária.

- [x] **REQ-4.1: Agrupamento de Cartões Novos (Gather Order)**
  - O preset deve suportar e aplicar as seguintes ordens de coleta para novos cartões:
    - `deck` (Baralho): Agrupa os novos cartões por sub-baralhos em ordem alfabética/posicional.
    - `deckThenRandom` (Baralho, em seguida, notas aleatórias): Agrupa por baralhos, mas embaralha as notas dentro de cada baralho.
    - `ascending` (Posição ascendente): Coleta por ordem crescente de criação (`createdAt` ascendente).
    - `descending` (Posição descendente): Coleta por ordem decrescente de criação (`createdAt` descendente).
    - `randomNote` / `randomCard` (Aleatório): Coleta e embaralha de forma completamente aleatória.
- [x] **REQ-4.2: Classificação de Cartões Novos (Sort Order)**
  - O preset deve ordenar os novos cartões coletados de acordo com a regra selecionada:
    - `template` (Modelo do cartão): Classifica os cartões pelo tipo/modelo (ou pela ordem de criação se não houver modelos separados).
    - `gather` (Ordem de agrupamento): Mantém a ordem exata em que foram coletados (gather order).
    - `random` (Aleatório): Embaralha a fila final de novos cartões.
    - Outros valores (`templateThenRandom`, `randomNoteThenTemplate`) devem aplicar a ordenação secundária correspondente.
- [x] **REQ-4.3: Ordem de Novos vs Revisão**
  - O preset deve suportar a ordenação relativa entre cartões novos e revisões:
    - `mix` (Misturar com revisões): Intercala novos cartões e revisões na fila.
    - `newFirst` (Mostrar antes de revisões): Exibe toda a fila de novos cartões antes de mostrar as revisões.
    - `reviewFirst` (Mostrar depois de revisões): Exibe todas as revisões pendentes antes de liberar os cartões novos.
- [x] **REQ-4.4: Ordem de Aprendizado vs Revisões**
  - O preset deve regular a ordem entre cartões em aprendizado intradiário/interdiário e revisões normais:
    - `mix` (Misturar com revisões): Intercala aprendizado e revisões na fila.
    - `learningFirst` (Mostrar antes de revisões): Exibe cartões em aprendizado antes de revisões.
    - `reviewFirst` (Mostrar depois de revisões): Exibe revisões antes de cartões em aprendizado.
- [x] **REQ-4.5: Ordem de Classificação de Revisões**
  - O preset deve classificar as revisões pendentes do dia conforme a regra selecionada:
    - `dateThenRandom` (Data de revisão, depois aleatório): Ordena por vencimento crescente (`dueDate` ascendente) e embaralha cartões do mesmo dia.
    - `dateThenDeck` (Data de revisão, depois baralho): Ordena por vencimento e depois pelo nome do sub-baralho.
    - `deckThenDate` (Baralho, depois data de revisão): Ordena por sub-baralho e depois pelo vencimento.
    - `intervalsAscending` / `intervalsDescending`: Ordena pelo tamanho do intervalo (`interval`) de forma crescente ou decrescente.
    - `easeAscending` / `easeDescending`: Ordena pelo fator de facilidade (`ease`) de forma crescente ou decrescente.
    - `retrievabilityAscending` / `retrievabilityDescending`: Ordena por dias de atraso (`dueDate` ascendente para mais atrasado, ou seja, mais provável de esquecer, ou `dueDate` decrescente para mais provável de lembrar).
    - `random` (Totalmente aleatório): Embaralha completamente a fila de revisões.
    - `oldest` / `newest`: Ordena pela data de criação do cartão (`createdAt` ascendente ou decrescente).
- [x] **REQ-4.6: Integração Visual do Formulário**
  - A interface de Configurações (`SettingsPage`) deve exibir todos os 5 seletores com as opções corretas traduzidas de acordo com as imagens de referência.
