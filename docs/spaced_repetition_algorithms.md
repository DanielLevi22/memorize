# Algoritmos de Repetição Espaçada (SRS) no Memorize

Este documento descreve detalhadamente o funcionamento, a matemática e as diferenças práticas dos dois algoritmos de Repetição Espaçada (Spaced Repetition System - SRS) implementados no **Memorize**: o clássico **SM-2** e o moderno **FSRS v4**.

---

## 1. O que é Repetição Espaçada?

A Repetição Espaçada é uma técnica de aprendizado baseada na **Curva do Esquecimento** formulada por Hermann Ebbinghaus no final do século XIX. A curva demonstra que, após adquirir um novo conhecimento, o cérebro humano tende a esquecê-lo de forma exponencial ao longo do tempo.

No entanto, se o conteúdo for revisado logo antes do momento provável de esquecimento, a taxa de perda diminui e a memória torna-se mais estável. O objetivo de um algoritmo de SRS é calcular o momento ideal (intervalo em dias) para realizar cada revisão, maximizando a retenção de longo prazo com o menor número possível de revisões.

```
Retenção %
100% |  /--- Primeira revisão
     | /     \
     |/       \--- Segunda revisão
 90% |         \     \
     |          \     \--- Terceira revisão
     |           \     \
  0% +--------------------------------------> Tempo (dias)
```

---

## 2. Algoritmo SM-2 (SuperMemo 2)

O **SM-2** foi criado por Piotr Woźniak em 1987 para o software SuperMemo. É o algoritmo mais popular do mundo, servindo de motor padrão para o Anki por mais de 15 anos.

### Funcionamento Matemático
O SM-2 gerencia o intervalo de revisão com base em três variáveis:
1. **Repetições consecutivas ($n$)**: Quantas vezes seguidas o cartão foi respondido corretamente.
2. **Fator de Facilidade (Ease Factor - $EF$)**: Um multiplicador que determina a taxa de crescimento do intervalo. O padrão inicial é `2.5`.
3. **Intervalo ($I$)**: O número de dias até a próxima revisão.

Quando o usuário avalia o cartão (notas no Memorize: `1 = Errei`, `2 = Difícil`, `3 = Fácil`), os novos valores são calculados da seguinte forma:

#### A. Cálculo do Intervalo ($I_n$)
*   Se for a **primeira repetição** ($n = 1$):
    $$I_1 = 1 \text{ dia}$$
*   Se for a **segunda repetição** ($n = 2$):
    *   No caso de nota **Fácil (3)**: $I_2 = 6 \text{ dias}$
    *   No caso de nota **Difícil (2)**: $I_2 = 3 \text{ dias}$
*   Para **repetições seguintes** ($n > 2$):
    *   Para nota **Fácil**: $I_n = \text{round}(I_{n-1} \times EF)$
    *   Para nota **Difícil**: $I_n = \text{round}(I_{n-1} \times EF \times 0.75)$ (adaptado para penalizar cards difíceis).

#### B. Atualização do Fator de Facilidade ($EF$)
O $EF$ é atualizado a cada revisão de sucesso e reduzido em caso de erro:
*   **Fácil (3)**: $EF' = EF + 0.15$
*   **Difícil (2)**: $EF' = EF - 0.15$
*   **Errei (1)**: $EF' = EF - 0.20$ e o intervalo é reiniciado para $I = 1$ com repetições $n = 0$.
*   *Nota:* O $EF$ nunca pode cair abaixo do valor mínimo de `1.3`.

### Limitações do SM-2
*   **Efeito "Inferno de Facilidade" (Ease Hell):** Se o usuário erra um cartão várias vezes, o $EF$ cai para o mínimo (1.3). Mesmo que o usuário decore o cartão posteriormente, o intervalo crescerá muito lentamente, forçando revisões excessivas e desnecessárias.
*   **Padrões Fixos de Início:** O SM-2 sempre inicia o primeiro intervalo com 1 dia e o segundo com 6 dias (para Fácil), ignorando que diferentes conteúdos e indivíduos possuem dinâmicas de retenção distintas.

---

## 3. Algoritmo FSRS v4 (Free Spaced Repetition Scheduler)

O **FSRS** é um algoritmo moderno de repetição espaçada baseado no modelo **DSR** (Difficulty, Stability, Retrievability) de memória humana. Ele foi adotado oficialmente pelo Anki a partir do final de 2023 como o novo motor de agendamento de alta performance.

### O Modelo de Três Variáveis (DSR)
1. **Dificuldade ($D$)**: Representa o quão difícil é o cartão. Varia em uma escala linear de `1` (extremamente fácil) a `10` (extremamente difícil).
2. **Estabilidade ($S$)**: Representa a força da memória física. É definida como o número de dias necessários para a probabilidade de lembrar (Retrievability) cair para 90%.
3. **Retrivabilidade/Recall ($R$)**: A probabilidade (de 0% a 100%) de o usuário lembrar do cartão hoje. Ela decai de forma exponencial de acordo com a fórmula:
   $$R(t, S) = 0.9^{\frac{t}{S}}$$
   *Onde $t$ é o número de dias decorridos desde a última revisão.*

### Funcionamento Matemático
O FSRS v4 utiliza 17 parâmetros (pesos $w_0$ a $w_{16}$) otimizados a partir de milhões de logs de revisão. No Memorize, os 3 botões são mapeados para notas de progresso FSRS ($g$):
*   `Errei (1)` $\rightarrow g = 1$ (Again)
*   `Difícil (2)` $\rightarrow g = 2$ (Hard)
*   `Fácil (3)` $\rightarrow g = 4$ (Easy)

#### A. Inicialização (Primeira Revisão de um Card Novo)
Quando o cartão é estudado pela primeira vez ($D$, $S$ e $lastReview$ vazios):
*   **Estabilidade Inicial ($S_0$):**
    $$S_0 = w[g - 1]$$
    *Usando os pesos padrão: $S_{0, Errei} = 0.4$ dias, $S_{0, Difícil} = 0.6$ dias, $S_{0, Fácil} = 5.8$ dias.*
*   **Dificuldade Inicial ($D_0$):**
    $$D_0 = w[4] - w[5] \times (g - 3)$$
    *(Clamped entre 1 e 10. Para Fácil ($g=4$), a dificuldade inicial cai para ~3.99).*
*   **Intervalo ($I$):**
    $$I = \text{round}(S_0)$$ (mínimo de 1 dia).

#### B. Revisões Seguintes (Transição de Estado)
Para cartões que já foram revisados antes, primeiro calcula-se $t$ (dias desde a última revisão) e $R = 0.9^{t/S}$.

1.  **Atualização de Dificuldade ($D'$):**
    $$D_{raw} = D - w[6] \times (g - 3)$$
    $$D' = \text{clamp}(w[7] \times D_0 + (1 - w[7]) \times D_{raw}, \ 1, \ 10)$$
    *Isso aplica uma suavização baseada na dificuldade inicial ($D_0$) para evitar variações extremas.*

2.  **Atualização de Estabilidade ($S'$):**
    *   **Se o cartão foi lembrado com sucesso ($g > 1$):**
        $$S' = S \times \left(1 + e^{w[8]} \times (11 - D') \times S^{-w[9]} \times (e^{w[10] \times (1 - R)} - 1) \times \text{fator\_hard}\right)$$
        *Onde $\text{fator\_hard} = w[15]$ se a nota for Difícil ($g=2$), reduzindo o crescimento da estabilidade, ou $1$ se for Fácil.*
    *   **Se o usuário errou o cartão ($g = 1$):**
        $$S' = w[11] \times (D')^{-w[12]} \times \left( (S + 1)^{w[13]} - 1 \right) \times e^{w[14] \times (1 - R)}$$
        *A estabilidade cai drasticamente em caso de falha, mas preserva uma fração do aprendizado anterior baseada na estabilidade antiga.*

3.  **Intervalo Próximo ($I'$):**
    O intervalo é o arredondamento da estabilidade para o recall alvo de 90%:
    $$I' = \text{round}(S')$$ (mínimo de 1 dia).

---

## 4. Comparação entre SM-2 e FSRS v4

| Característica | SM-2 Clássico | FSRS v4 Moderno |
| :--- | :--- | :--- |
| **Abordagem** | Multiplicador geométrico fixo (Ease Factor) | Modelo matemático DSR (Decaimento Exponencial) |
| **Variáveis Principais** | Intervalo, Ease Factor, Repetições | Estabilidade, Dificuldade, Retrivabilidade, Última Revisão |
| **Recuperação de Erros** | Lenta ("Inferno de Facilidade") | Rápida (Fórmula de esquecimento preserva parte da estabilidade) |
| **Eficiência** | Requer mais revisões para a mesma retenção | ~20-30% menos revisões necessárias para o mesmo nível de retenção |
| **Flexibilidade** | Rígido (sempre 1 dia e depois 6 dias de início) | Adaptativo (estabilidade inicial depende estritamente da resposta) |

---

## 5. Como Usar e Configurar no Memorize

O Memorize permite alternar de forma transparente entre ambos os algoritmos em tempo real:

1.  Acesse o menu lateral e vá em **Configurações**.
2.  No campo **Algoritmo Spaced Repetition**, escolha entre:
    *   `SM-2 (Clássico)`
    *   `FSRS v4 (Moderno - Beta)`
3.  A alteração é gravada instantaneamente no `localStorage`.
4.  Durante as sessões de estudo, o painel inferior dos cartões de revisão mostrará automaticamente os intervalos correspondentes calculados pelo algoritmo ativo.
