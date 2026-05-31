import React, { useState, useEffect } from 'react';
import { BookOpen, Keyboard, Info, Lightbulb, Zap, Laptop, Sliders, Brain } from 'lucide-react';
import { Card } from './ui/card';
import { SrsAlgorithmsDocs } from './SrsAlgorithmsDocs';

interface AppGuideDocsProps {
  initialTab?: 'overview' | 'study_modes' | 'shortcuts' | 'reading' | 'srs_presets' | 'srs_math';
}

export const AppGuideDocs: React.FC<AppGuideDocsProps> = ({ initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'study_modes' | 'shortcuts' | 'reading' | 'srs_presets' | 'srs_math'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b border-border pb-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          💡 Guia de Uso & Central de Ajuda
        </h2>
        <p className="text-xs text-muted-foreground">
          Aprenda a utilizar os recursos de leitura, repetição espaçada (SRS), presets e atalhos de teclado do Memorize.
        </p>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap gap-2 bg-muted/40 p-1 rounded-xl border border-border/60 max-w-max">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'overview'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lightbulb size={14} />
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('study_modes')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'study_modes'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap size={14} />
          Modos de Estudo
        </button>
        <button
          onClick={() => setActiveTab('shortcuts')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'shortcuts'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Keyboard size={14} />
          Atalhos de Teclado
        </button>
        <button
          onClick={() => setActiveTab('reading')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'reading'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen size={14} />
          Leitura & PDF
        </button>
        <button
          onClick={() => setActiveTab('srs_presets')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'srs_presets'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders size={14} />
          Presets de Estudo
        </button>
        <button
          onClick={() => setActiveTab('srs_math')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'srs_math'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Brain size={14} />
          Algoritmos SRS
        </button>
      </div>

      {/* Content Area */}
      {activeTab !== 'srs_math' ? (
        <Card className="p-6 bg-card border-border shadow-md rounded-xl">
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="space-y-3.5">
                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded tracking-wider">
                  Fluxo de Aprendizado
                </span>
                <h3 className="text-base font-bold text-foreground">Como aprender idiomas e memorizar conteúdo?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O <strong>Memorize</strong> combina duas das técnicas de estudo mais eficientes cientificamente: 
                  a <strong>Leitura Contextualizada</strong> e a <strong>Repetição Espaçada (SRS)</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 border border-border bg-muted/10 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500">
                    <BookOpen size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">1. Importe & Pratique Leitura</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Importe textos, artigos ou arquivos PDF. Use o modo <strong>Linha a Linha</strong> para ler com tradução paralela, ou ouça o áudio sincronizado palavra por palavra com o nosso <strong>Karaokê Dinâmico</strong>.
                  </p>
                </div>

                <div className="p-4 border border-border bg-muted/10 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Zap size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">2. Adicione ao Baralho</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Encontrou sentenças úteis ao longo da leitura? Clique em <strong>Adicionar ao Baralho</strong> no cabeçalho do leitor, selecione as frases e crie cartões de memorização instantaneamente.
                  </p>
                </div>

                <div className="p-4 border border-border bg-muted/10 rounded-xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Sliders size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">3. Revise Espaçadamente</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Acesse o seu Dashboard e revise seus cards diariamente. O agendador calcula os intervalos matemáticos exatos com base na sua taxa de retenção de memória, evitando revisões desnecessárias.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex flex-col gap-2.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Info size={14} className="text-primary" />
                  Dica de Ouro
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Use a <strong>Pesquisa Global</strong> (na tela de Biblioteca) para buscar palavras específicas nos seus textos. Isso ajuda você a ver a palavra aplicada em diferentes situações, criando um forte aprendizado baseado em contexto real.
                </p>
              </div>
            </div>
          )}

          {/* TAB: MODOS DE ESTUDO */}
          {activeTab === 'study_modes' && (
            <div className="space-y-6">
              <div className="space-y-3.5">
                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded tracking-wider">
                  Dinâmica de Prática
                </span>
                <h3 className="text-base font-bold text-foreground">Como funcionam os diferentes modos de estudo?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para maximizar seu aprendizado, o Memorize oferece três modos distintos na <strong>Arena de Estudos</strong>. Você pode configurar o modo de estudo de cada baralho individualmente em suas opções.
                </p>
              </div>

              <div className="space-y-5">
                {/* 1. MODO CLÁSSICO */}
                <div className="p-4 border border-border bg-muted/5 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">🎴 Modo Clássico (Manual)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    O método tradicional de flashcards, idêntico ao Anki. Você vê a frente do cartão, pensa na resposta e clica em <strong>Revelar Resposta</strong>.
                  </p>
                  <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-1">
                    <li>Você avalia seu próprio desempenho manualmente selecionando uma das quatro opções de nota: <strong>Errei (1)</strong>, <strong>Difícil (2)</strong>, <strong>Bom (3)</strong> ou <strong>Fácil (4)</strong>.</li>
                    <li>Ideal para revisões gerais onde não há necessidade de digitação ou validação de pronúncia.</li>
                  </ul>
                </div>

                {/* 2. MODO ESCRITA */}
                <div className="p-4 border border-border bg-muted/5 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400">✍️ Modo Escrita (Auto-Grading)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Focado na prática de ortografia e escrita ativa (Writing). O sistema reproduz o áudio do termo em inglês e você deve digitá-lo no campo de entrada.
                  </p>
                  <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-1">
                    <li>Ao clicar em <strong>Verificar</strong> ou pressionar <strong>Enter</strong>, nosso algoritmo compara sua resposta caractere por caractere (usando a Distância de Levenshtein e LCS).</li>
                    <li><strong>Classificação 100% Automática</strong>: O sistema pontua a resposta sem exigir que você escolha as notas manualmente:
                      <ul className="list-circle pl-4 mt-0.5 space-y-0.5">
                        <li><span className="font-semibold">Exato (100% correto)</span>: Avaliado automaticamente como <strong>Bom (3)</strong>.</li>
                        <li><span className="font-semibold">Erro leve (typos)</span>: Se você errar apenas 1 ou 2 letras, o sistema tolera a falha leve, exibe o aviso <em>⚠️ Quase Correto! (Erro de digitação leve)</em> e classifica como <strong>Difícil (2)</strong>.</li>
                        <li><span className="font-semibold">Incorreto / Pulado</span>: Se errar mais caracteres ou pular a questão, classifica automaticamente como <strong>Errei (1)</strong>.</li>
                      </ul>
                    </li>
                    <li>Os botões manuais de avaliação (Errei, Difícil, Bom, Fácil) são desativados para evitar interrupções no fluxo; basta pressionar <strong>Enter</strong> ou <strong>Espaço</strong> novamente no botão <strong>Continuar</strong> para passar para o próximo cartão.</li>
                  </ul>
                </div>

                {/* 3. MODO FALA */}
                <div className="p-4 border border-border bg-muted/5 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🗣️ Modo Fala (Auto-Grading)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Projetado para melhorar sua pronúncia e conversação (Speaking). O sistema exibe o termo e você deve pronunciá-lo no microfone.
                  </p>
                  <ul className="list-disc pl-4 text-[11px] text-muted-foreground space-y-1">
                    <li>O reconhecimento de fala transcreve sua voz e calcula o score de proximidade palavra por palavra:
                      <ul className="list-circle pl-4 mt-0.5 space-y-0.5">
                        <li><span className="font-semibold">Exato (100% correto)</span>: Avaliado como <strong>Bom (3)</strong>.</li>
                        <li><span className="font-semibold">Similaridade &ge; 80%</span>: Tolera pequenas discrepâncias ou desvios de pronúncia, avaliando como <strong>Difícil (2)</strong>.</li>
                        <li><span className="font-semibold">Similaridade &lt; 80%</span>: Classificado como <strong>Errei (1)</strong>.</li>
                      </ul>
                    </li>
                    <li>Assim como no modo Escrita, o fluxo é totalmente automático através do botão único <strong>Continuar</strong>, ocultando a seleção manual de notas.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATALHOS DE TECLADO */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded tracking-wider">
                  Produtividade Extrema
                </span>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Laptop size={16} /> Atalhos Rápidos do Teclado
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Navegue pelas lições e avalie seus cartões rapidamente sem encostar no mouse.
                </p>
              </div>

              {/* Leitores Shortcuts */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-foreground border-b border-border/60 pb-1.5 flex items-center gap-1.5">
                  📖 No Leitor de Leitura e Karaokê
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Iniciar / Pausar áudio</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Espaço</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Reiniciar Áudio da Frase</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">R</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Avançar para Próxima Frase</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Seta p/ Baixo</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Retornar para Frase Anterior</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Seta p/ Cima</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Mover Frase Selecionada (Reordenar)</span>
                    <div className="flex gap-1.5 items-center">
                      <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Alt + Seta ↑ / ↓</kbd>
                      <span className="text-muted-foreground/60 text-[10px]">ou</span>
                      <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Alt + Clique</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Marcar Frase como Dominada</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">D</kbd>
                      <span className="text-muted-foreground/50 self-center">ou</span>
                      <kbd className="px-2 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">M</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Editar Frase Atual</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">E</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Cancelar Edição de Frase</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Esc</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs col-span-1 md:col-span-2">
                    <span className="font-semibold text-foreground">Abrir Ajuda de Pronúncia (IPA / Figurada)</span>
                    <div className="flex gap-1.5 items-center">
                      <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Selecionar Texto</kbd>
                      <span className="text-muted-foreground/60 text-[10px]">ou</span>
                      <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Botão Direito / Clique Longo (Modo Fala)</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arena Shortcuts */}
              <div className="space-y-3.5 pt-2">
                <h4 className="text-xs font-bold text-foreground border-b border-border/60 pb-1.5 flex items-center gap-1.5">
                  🃏 Na Arena de Revisão de Cards (Estudos)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Revelar Resposta (Mostrar Verso)</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Espaço</kbd>
                      <span className="text-muted-foreground/50 self-center">ou</span>
                      <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">Enter</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Avaliar Card como "Errei" (Again)</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">1</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Avaliar Card como "Difícil" (Hard)</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">2</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Avaliar Card como "Bom" (Good)</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">3</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Avaliar Card como "Fácil" (Easy)</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">4</kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border bg-muted/5 rounded-xl text-xs">
                    <span className="font-semibold text-foreground">Ouvir áudio / TTS do Cartão</span>
                    <kbd className="px-2.5 py-1 bg-muted border border-border rounded-lg font-bold text-[10px] shadow-sm text-foreground">R</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LEITURA & PDF */}
          {activeTab === 'reading' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded tracking-wider">
                  Recursos de Imersão
                </span>
                <h3 className="text-base font-bold text-foreground">Guia do Leitor de Idiomas</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tire o máximo proveito das ferramentas integradas da aba Leitura.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">📂 Organização por Pastas (Coleções)</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Crie coleções para agrupar textos do mesmo livro, matéria ou curso. Cada pasta exibe a porcentagem de progresso calculada automaticamente pela média das sentenças dominadas nos textos pertencentes à pasta.
                  </p>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">📄 Importação e Vitrine de Leitura</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ao criar uma lição, você pode fazer upload de um arquivo PDF. O sistema salva o arquivo de forma binária no banco local (IndexedDB) e extrai o texto automaticamente. Na aba <strong>Vitrine de Leitura</strong>, você pode ver o PDF exatamente no layout original da página, abrir em tela cheia ou em uma nova guia para imprimir.
                  </p>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">🧘 Zen Mode (Modo Foco)</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Esconda botões administrativos e distrações da tela ao clicar em "Zen Mode". O texto é reformatado com fontes ampliadas e espaçamentos amplos de e-readers, com temas de cores específicos para o conforto visual como **Sépia** ou **Dark Matte** (fundo cinza escuro fosco de baixíssimo contraste).
                  </p>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">🗣️ Pronúncia Fonética e Aportuguesada (Balão Flutuante)</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Selecione qualquer palavra ou frase curta com o mouse/dedo para abrir o <strong>balão de pronúncia</strong>. Ela exibe a pronúncia oficial <strong>AFI / IPA</strong> (via API de Dicionário) e a <strong>Pronúncia Figurada Aportuguesada</strong> (ex: "compiúter" para <em>computer</em>, gerada via IA Gemini). A partir do balão, você pode adicionar a palavra diretamente como card no Anki.
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                    Nota: No Modo de Treino de Fala (onde o clique do mouse marca a palavra), clique com o <strong>Botão Direito</strong> (ou <strong>pressione e segure</strong> na tela do celular) sobre qualquer palavra para ativar o balão de ajuda.
                  </p>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">🔖 Marcador de Páginas Automático</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nunca mais perca o ponto onde parou. O leitor grava automaticamente a última linha que você focou ao sair do texto. Ao abri-lo novamente, o app realiza uma rolagem suave e foca exatamente nessa frase.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRESETS & ALGORITMOS */}
          {activeTab === 'srs_presets' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded tracking-wider">
                  Configurações Avançadas do Anki
                </span>
                <h3 className="text-base font-bold text-foreground">Como configurar os Presets do Baralho?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Diferencie o comportamento dos seus baralhos associando-os a diferentes perfis (Presets).
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">⚙️ Entendendo as 11 Seções de Configuração</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nas Configurações do app, você pode customizar valores de limites diários, etapas de aprendizagem adicionais para falhas, regras de ocultamento de cartões irmãos (bury siblings), ativar o avanço automático hands-free (revelar resposta e pular card após determinados segundos) e até scripts customizados de JS pós-resposta.
                  </p>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">⚖️ Escolha de Algoritmo SRS por Baralho</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Você pode usar o algoritmo clássico **SM-2** em um baralho comum e ativar o algoritmo moderno **FSRS v4** (estado da arte de inteligência de repetição) em outro baralho específico, apenas configurando isso no Preset associado. Para entender as equações por trás de cada algoritmo, acesse a aba dedicada de <strong>Algoritmos SRS</strong> na barra superior deste guia.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <SrsAlgorithmsDocs hideHeader={true} />
      )}
    </div>
  );
};
