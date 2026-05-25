# Modos de Estudo: Especificações e Arquitetura

O **Memorize** oferece três modos de estudo integrados para cobrir diferentes aspectos da aquisição de idiomas: memorização de conceitos, ortografia/escrita (Spelling) e pronúncia (Speaking). Todos os modos estão integrados ao sistema de repetição espaçada (FSRS v4 / SM-2).

---

## 1. Modo Clássico (Active Recall)
O modo padrão de revisão de flashcards.

*   **Objetivo:** Fixação rápida do significado/tradução por meio do esforço mental ativo.
*   **Fluxo de Usuário:**
    1.  O cartão exibe a **Frente** (termo em Inglês).
    2.  O áudio (ou TTS fallback) é executado automaticamente.
    3.  O usuário pensa no significado e clica em **"Mostrar Resposta"**.
    4.  O verso é revelado (Tradução + Exemplo Contextual).
    5.  O usuário avalia sua recordação usando as notas **Errei**, **Difícil** ou **Fácil**.

---

## 2. Modo Escrita (Auditory Spelling)
Treinamento focado em compreensão auditiva (Listening) e escrita correta (Spelling).

*   **Objetivo:** Escrever com precisão o termo que está sendo ouvido, garantindo a fixação de estruturas de palavras e ortografia.
*   **Fluxo de Usuário:**
    1.  A Frente do cartão é exibida **ocultando o termo de texto**. É mostrado um ícone grande de áudio e a mensagem *"Escute e digite o termo"*.
    2.  O áudio/TTS é executado. O usuário pode clicar no alto-falante para ouvi-lo novamente quantas vezes desejar.
    3.  O usuário digita sua resposta em um campo de texto (`input`) e pressiona **Enter** ou clica em **"Verificar"**.
    4.  O sistema executa o **Algoritmo de Normalização de Texto** e valida a resposta.
    5.  **Feedback Visual:**
        *   **Acerto (Verde):** Exibe banner de confirmação.
        *   **Erro (Vermelho):** Mostra um comparativo claro: *Você digitou: "..." | Esperado: "..."*.
    6.  O verso é revelado com as informações de contexto e tradução.
    7.  Os botões de nota do SRS aparecem para que o usuário registre o desempenho da revisão.

### Algoritmo de Normalização de Texto
Para evitar que diferenças insignificantes (como maiúsculas/minúsculas, espaços extras ou pontuação) resultem em erros injustos, ambos os textos (resposta do usuário e termo esperado) são tratados pela seguinte função de limpeza antes da comparação:

```typescript
const cleanString = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "") // Remove pontuações comuns
    .replace(/\s+/g, " ") // Colapsa múltiplos espaços em branco
    .trim();
};
```

---

## 3. Modo Fala (Pronunciation Practice)
Treinamento de pronúncia (Speaking) integrado ao microfone do usuário.

*   **Objetivo:** Praticar a pronúncia ativa do termo em inglês e validar se a articulação está inteligível para o motor de reconhecimento de voz.
*   **Fluxo de Usuário:**
    1.  A Frente do cartão exibe um botão de microfone e a mensagem *"Escute e pronuncie o termo"*. O texto original é ocultado.
    2.  O usuário clica no botão do microfone e fala o termo ouvido.
    3.  O navegador executa o reconhecimento de voz nativo (`webkitSpeechRecognition`) configurado para o idioma `en-US`.
    4.  O texto transcrito é comparado com o termo original usando o mesmo algoritmo de normalização.
    5.  **Feedback Visual:**
        *   **Acerto:** Mensagem de incentivo *"Excelente Pronúncia! ✨"* em verde.
        *   **Erro:** Mostra o que foi compreendido pelo robô de áudio: *O robô ouviu: "..." | Esperado: "..."*.
    6.  O verso é revelado e o usuário escolhe a nota correspondente para o SRS.
    7.  **Escape Hatch:** Caso o motor de voz falhe em entender o sotaque ou o ruído externo atrapalhe, o usuário pode clicar em **"Revelar Resposta"** para avançar sem ficar travado.

---

## Integração Técnica com Repetição Espaçada (SRS)
Independentemente do modo escolhido (Clássico, Escrita ou Fala), o agendamento de repetição espaçada permanece centralizado no mesmo banco de dados Dexie:
1.  O desempenho na digitação (ou fala) serve como guia para o usuário escolher o botão de nota adequado.
2.  Por exemplo, se o usuário errar a escrita, a interface indica visualmente a falha e sugere que ele pressione **Errei** (nota 1) para que o cartão volte a aparecer em intervalos curtos.
3.  A consistência de dados do baralho é mantida intacta, permitindo transições fluidas entre os modos a qualquer momento.
