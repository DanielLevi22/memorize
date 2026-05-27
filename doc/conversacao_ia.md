# Arena de Conversação por Voz (Gemini AI)

Este documento explica o funcionamento técnico e prático da **Arena de Conversação por Voz** com Inteligência Artificial integrada ao Memorize.

## Como Funciona

A funcionalidade permite que o usuário pratique a conversação livre e digitação em inglês de forma interativa. O fluxo funciona da seguinte forma:

```
[ Usuário Fala / Digita ]
           │
           ▼
[ Reconhecimento de Voz (SpeechRecognition) ] ──(Transcreve áudio)──► [ Texto ]
                                                                        │
                                                                        ▼
[ Gemini AI API ] ◄──(Histórico de mensagens + Prompt do Parceiro)──────┘
       │
       ▼
(Retorna resposta estruturada em JSON)
       │
       ├─► [ Texto da resposta da IA ] ──► [ Síntese de Voz (SpeechSynthesis) ] ──► [ Áudio lido ]
       │                                                                                │
       └─► [ Dica de Correção Gramatical ] ──► (Painel na bolha do chat)                │
                                                                                        ▼
[ Próximo Turno ] ◄──(Ativa microfone automaticamente se Viva-Voz ativo)────────────────┘
```

---

## Recursos e Funcionalidades Principais

### 1. Perfis de Parceiros de Conversação
A arena disponibiliza três parceiros de conversação simulados, cada um com comportamentos específicos ajustados via *System Prompt* da IA:
- **Alice (Professora de Inglês)**: Foca em dar boas-vindas acolhedoras, falar de forma pausada e didática, e sempre corrigir erros de gramática do usuário em português.
- **John (Companheiro de Viagens)**: Linguagem casual, animada, cheia de abreviações naturais em inglês. Focado em viagens, passeios, curiosidades e hobbies.
- **David (Recrutador Formal)**: Simula uma entrevista de emprego de forma profissional. Faz perguntas desafiadoras sobre conquistas, pontos fortes/fracos e planos de carreira.

### 2. Feedback Gramatical em Tempo Real
Ao enviar uma frase em inglês com erros (ex: *"She don't like apples"*), a resposta da IA retorna estruturada trazendo a resposta e um campo de correção. 
O aplicativo detecta este campo e exibe um alerta de gramática do tipo *"Dica Gramatical"* logo abaixo da mensagem do usuário explicando o erro (ex: *"Para 'she', use 'doesn't' em vez de 'don't'."*).

### 3. Modo Viva-Voz (Hands-Free Mode)
Permite uma conversação contínua puramente por áudio:
1. O usuário clica em gravar uma vez ou envia a mensagem.
2. A IA gera a resposta e a síntese de voz (TTS) do navegador lê o texto em voz alta.
3. O app captura o evento `onend` da fala do navegador e **inicia a gravação do microfone imediatamente**, aguardando o usuário responder.
4. O ciclo se repete continuamente sem que o usuário precise tocar na tela.

### 4. Persistência Local (Dexie.js)
Toda a conversa com cada parceiro é salva localmente em uma tabela IndexedDB (`chatMessages`), de modo que as mensagens não são perdidas quando o usuário troca de aba ou fecha o aplicativo. Há também um botão para limpar o histórico do chat de cada parceiro a qualquer momento.

---

## Requisitos Técnicos

- **Navegador**: Google Chrome ou Microsoft Edge (necessário para suporte completo ao motor da API nativa do Web Speech do navegador).
- **Gemini API Key**: Chave de API configurada na aba de Configurações do Memorize.
