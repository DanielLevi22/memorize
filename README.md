# Memorize — Alternativa Moderna ao Anki para Inglês

Este documento serve como especificação técnica e de produto para o desenvolvimento do **Memorize**. Nosso foco inicial está na construção de uma infraestrutura sólida e em uma experiência do usuário (UX) muito superior à do Anki tradicional, adiando recursos de Inteligência Artificial para fases posteriores.

---

## 🎯 Visão Geral do Projeto (Fase 1)

O objetivo do **Memorize** na primeira fase é recriar o núcleo de valor do Anki — a repetição espaçada eficiente — focando em:
*   **UX/UI Premium & Moderna:** Design limpo, interações fluidas e micro-animações.
*   **Mobile-First / PWA:** Interface otimizada para toques rápidos e navegação por gestos.
*   **Infraestrutura Offline-First:** Funcionamento local instantâneo com sincronização delta robusta e econômica.
*   **Zero IA no MVP:** Toda a criação de cards, digitação de exemplos e áudios será manual (feita pelo usuário ou via decks pré-prontos estáticos), garantindo estabilidade e custo de infraestrutura previsível no lançamento.

---

## 🏗️ Arquitetura e Engenharia de Software (Infraestrutura)

A arquitetura do Memorize é projetada para ser resiliente a falhas de conexão, rápida e altamente escalável.

```
+--------------------------------------------------------+
|                      DISPOSITIVO                       |
|  +------------------+            +------------------+  |
|  |   Interface UI   |<---------->| Banco de Dados   |  |
|  | (React / Native) |            | Local (SQLite/IDB|  |
|  +------------------+            +------------------+  |
+-------------------------------------------^------------+
                                            | (Sincronização Delta)
                                            v
+--------------------------------------------------------+
|                       SERVIDOR                         |
|  +------------------+            +------------------+  |
|  |     API REST     |<---------->|  Banco Central   |  |
|  |    (NestJS)      |            |   (PostgreSQL)   |  |
|  +------------------+            +------------------+  |
|           |                                            |
|           v                                            |
|  +------------------+                                  |
|  | Storage / CDN    |                                  |
|  | (Cloudflare R2)  |                                  |
|  +------------------+                                  |
+--------------------------------------------------------+
```

### 1. Banco de Dados Local (Offline-First)
Todo dado inserido ou revisado é salvo instantaneamente no dispositivo.
*   **Web/PWA:** Utilização do IndexedDB (via **Dexie.js** ou **RxDB**).
*   **Mobile:** Utilização do **SQLite** (via expo-sqlite ou biblioteca nativa correspondente).
*   **Regra de Ouro:** A interface nunca bloqueia esperando resposta da rede. Todas as mutações na UI atualizam o banco local de forma síncrona e disparam uma sincronização assíncrona em segundo plano (*optimistic updates*).

### 2. Fluxo de Sincronização Eficiente (Delta Sync)
Para minimizar o tráfego de dados e permitir que o aplicativo seja gratuito ou de baixo custo de manutenção, implementamos um modelo de sincronização delta:

*   **Rastreamento de Mudanças:** Cada tabela importante (decks, cards, revisões) possui as colunas `createdAt`, `updatedAt` e `deletedAt` (soft delete).
*   **Histórico de Sincronização:** O dispositivo armazena a data/hora da última sincronização bem-sucedida (`lastSyncTime`).
*   **Envio (Upstream):** O cliente envia apenas registros onde `updatedAt > lastSyncTime`.
*   **Recebimento (Downstream):** O servidor retorna apenas os registros modificados por outros dispositivos após `lastSyncTime`.

### 3. Resolução de Conflitos
Se o usuário revisar ou editar cartões em múltiplos dispositivos sem conexão com a internet, os conflitos serão resolvidos usando as seguintes estratégias:
*   **Para Revisões:** Históricos de estudo não se sobrescrevem. O banco central acumula os logs de revisão de ambos os dispositivos e atualiza os parâmetros do algoritmo de repetição espaçada combinando esses dados históricos.
*   **Para Alterações de Conteúdo (Texto/Mídia do Card):** Adota-se a política *Last-Write-Wins* (LWW) baseada no timestamp `updatedAt` mais recente.

### 4. Deduplicação e Armazenamento de Mídia
*   Arquivos de áudio ou imagem adicionados manualmente são nomeados a partir do hash SHA-256 do seu conteúdo.
*   Antes de fazer o upload de um arquivo de mídia para o **Cloudflare R2**, o cliente verifica com o servidor se um arquivo com aquele hash já existe no storage global. Se sim, apenas a referência é vinculada ao cartão do usuário, economizando espaço em disco no servidor e consumo de banda de upload.

---

## ⚡ Funcionalidades do MVP (Fase 1)

Nosso foco é ter as mesmas capacidades essenciais do Anki tradicional, mas com uma roupagem visual espetacular e fluxos de uso simplificados.

### 1. Gerenciamento de Decks e Cards
*   Criação, edição e exclusão de Decks.
*   Criação manual de cards (frente, verso, inserção de imagens locais e gravação/upload manual de áudios).
*   Suporte a tags para organização e busca rápida.

### 2. Algoritmo de Repetição Espaçada (SRS)
*   Implementação local do algoritmo **SM-2** (ou o moderno **FSRS** simplificado) para calcular os próximos intervalos de revisão.
*   Campos calculados localmente: `interval` (intervalo em dias), `ease` (fator de facilidade), `repetitions` (contagem de revisões) e `dueDate` (data de vencimento).

### 3. Tela de Revisão Premium
*   **UI Estilo Swipe ou Botões Rápidos:** Três opções de resposta bem definidas: **Errei / Difícil / Fácil** (simplificando as quatro opções confusas do Anki).
*   **Micro-animações:** Deslizamentos suaves do card para fora da tela com cores indicativas (vermelho para erro, verde para acerto).
*   **Layout Adaptável:** Focado em uso com apenas uma mão na tela do celular.

### 4. Estatísticas Visuais
*   Painel simples mostrando o progresso diário.
*   Indicador de Ofensiva (*Streak*) para incentivar a consistência diária.
*   Contador rápido de cards: *A aprender*, *A revisar* e *Aprendidos*.

---

## 💻 Stack Tecnológica Proposta (Fase 1)

### Frontend (Web / PWA)
*   **Tecnologia:** React + Vite + TypeScript.
*   **Estilização:** CSS Vanilla para máximo controle de design, transições e performance.
*   **Banco Local:** Dexie.js (para IndexedDB).

### Backend (Serviço de Sincronização)
*   **Tecnologia:** Node.js (com Express ou NestJS) + TypeScript.
*   **Banco de Dados Principal:** PostgreSQL (armazenamento relacional dos cards, decks e logs de revisão do usuário).
*   **Armazenamento de Mídia:** Cloudflare R2 ou AWS S3.

---

## 🔮 Funcionalidades Postergaras (Fase 2 - Futuro)
Estas funcionalidades **não** serão abordadas no desenvolvimento inicial do projeto:
*   Integração com Inteligência Artificial (geração automática de cartões, TTS por IA, etc.).
*   Processamento automático de PDFs e vídeos.
*   Aspectos sociais e compartilhamento avançado de decks (ranks, colaboração em tempo real).
