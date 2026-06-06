import React, { useState, useEffect } from 'react';
import { BookOpen, Keyboard, Info, Lightbulb, Zap, Laptop, Sliders, Brain, Headphones, AlertTriangle } from 'lucide-react';
import { Card } from './ui/card';
import { SrsAlgorithmsDocs } from './SrsAlgorithmsDocs';

interface AppGuideDocsProps {
  initialTab?: 'overview' | 'study_modes' | 'shortcuts' | 'reading' | 'playlist_transcription' | 'srs_presets' | 'srs_math' | 'ollama_setup';
}

export const AppGuideDocs: React.FC<AppGuideDocsProps> = ({ initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'study_modes' | 'shortcuts' | 'reading' | 'playlist_transcription' | 'srs_presets' | 'srs_math' | 'ollama_setup'>(initialTab);

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
          onClick={() => setActiveTab('playlist_transcription')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'playlist_transcription'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Headphones size={14} />
          Playlist & Transcrição
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
        <button
          onClick={() => setActiveTab('ollama_setup')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeTab === 'ollama_setup'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Laptop size={14} />
          Configurar Ollama (IA Local)
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

          {/* TAB: PLAYLIST & TRANSCRIÇÃO */}
          {activeTab === 'playlist_transcription' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded tracking-wider">
                  Estudo Auditivo Ativo
                </span>
                <h3 className="text-base font-bold text-foreground">Como usar Transcrições e Letras Sincronizadas na Playlist</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A seção de <strong>Playlist</strong> permite que você gerencie seus áudios de estudo (aulas, podcasts, músicas) e os sincronize linha por linha com textos ou traduções para praticar a escuta de forma imersiva.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    🎵 1. Abrir a Transcrição (Estilo Karaokê)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dentro de qualquer álbum de áudio, você verá a lista de faixas cadastradas.
                  </p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
                    <li>Passe o mouse ou toque sobre uma faixa e clique no ícone de documento (<kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">FileText</kbd>) para abrir o painel de transcrição.</li>
                    <li>As faixas que já possuem alguma transcrição salva exibirão um selo verde <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1 rounded font-bold border border-emerald-500/25">T</span>.</li>
                  </ul>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    🤖 2. Criar Transcrições Automaticamente com IA
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Se a sua faixa não tiver letra nem tradução, você pode criá-la instantaneamente usando Inteligência Artificial:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
                    <li>Abra a transcrição da faixa e vá para a aba <strong>Sincronizar / Editar</strong>.</li>
                    <li>Clique no botão roxo <strong>✨ Transcrever com IA</strong>.</li>
                    <li>O sistema enviará o áudio ao modelo <strong>Gemini 2.5 Flash</strong> (usando sua API key configurada nas Opções), que fará a transcrição exata linha por linha, a marcação de tempo automática de início de cada frase e a tradução para o português.</li>
                  </ul>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    ⏱️ 3. Importar ou Sincronizar Manualmente (Sincronizador Live)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Caso prefira um controle manual ou já tenha a letra:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
                    <li><strong>Importar LRC:</strong> Se você tiver o arquivo de legenda no formato standard `.lrc` (ex: <code>[00:12.30] Hello world</code>), basta colar o conteúdo na aba <em>Sincronizar / Editar</em> e clicar em <strong>Importar LRC</strong>.</li>
                    <li><strong>Sincronizador Live:</strong> Se você colar apenas o texto puro (uma frase por linha), pode clicar em <strong>Sincronizar Live (Passo 2)</strong>. Dê Play no áudio e, à medida que ouvir o locutor falar cada linha, aperte a tecla <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">Espaço</kbd>, <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">Enter</kbd> ou clique em <strong>Marcar Tempo</strong>. Isso marcará o timestamp inicial de cada frase de forma interativa.</li>
                  </ul>
                </div>

                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    🎧 4. Praticar com Recursos de Listening
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ao reproduzir o áudio na aba de visualização da transcrição, você tem recursos exclusivos de estudo:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
                    <li><strong>Navegação por Cliques:</strong> A transcrição rola automaticamente mantendo a frase atual no centro. Você pode <strong>clicar em qualquer frase</strong> do texto para pular o áudio diretamente para o momento em que ela é dita.</li>
                    <li><strong>Loop de Frase (Loop Frase):</strong> Ative o botão <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/20">🔁 Loop Frase</span> no topo da transcrição para que a frase atual se repita infinitamente, ajudando você a treinar a escuta e pronúncia daquele trecho específico.</li>
                    <li><strong>Modo Ditado (Auto-Pause):</strong> Ative o botão <span className="text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded text-[10px] border border-sky-500/20">🎙️ Modo Ditado</span> no topo. O áudio pausará automaticamente ao final de cada frase falada. Você pode tentar repetir ou escrever o ditado e dar Play/Espaço novamente para ouvir a próxima.</li>
                    <li><strong>Marcadores de Dificuldade (Pontos Coloridos):</strong> Passe o mouse/toque no canto esquerdo de qualquer linha para revelar um círculo e clique para alternar o nível: `Padrão` &rarr; `Fácil (Verde)` &rarr; `Difícil (Vermelho)`. As linhas com marcação ganham bordas e fundos sombreados para foco visual.</li>
                    <li><strong>Exportar LRC:</strong> Clique no botão <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">Exportar LRC</kbd> no topo para fazer download do arquivo `.lrc` sincronizado com os tempos e traduções das frases.</li>
                    <li><strong>Avanço e Retrocesso Fino:</strong> Use os botões de <strong>retroceder ou avançar 5s</strong> no Media Player da lateral direita para repetir termos ou pular trechos de silêncio rapidamente.</li>
                    <li><strong>Velocidade de Áudio:</strong> Controle o ritmo da fala nas opções do Media Player (de <code>0.5x</code> para diálogos rápidos até <code>2.0x</code> para desafios avançados).</li>
                  </ul>
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

          {/* TAB: OLLAMA SETUP */}
          {activeTab === 'ollama_setup' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded tracking-wider">
                  Guia de Configuração
                </span>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Laptop size={16} className="text-violet-500" /> Como Instalar e Configurar o Ollama (IA Local Grátis)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O <strong>Ollama</strong> é uma ferramenta que permite rodar modelos de linguagem (LMs) poderosos diretamente no seu computador. É 100% gratuito, offline, privado e não exige chave de API.
                </p>
              </div>

              <div className="space-y-5">
                {/* 1. INSTALAR */}
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">📥 Passo 1: Baixar e Instalar o Ollama</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Acesse o site oficial do Ollama em <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline font-bold inline-flex items-center gap-0.5">ollama.com ↗</a>, baixe o instalador adequado para o seu sistema operacional (Windows, macOS ou Linux) e faça a instalação padrão.
                  </p>
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-[11px] leading-relaxed mt-2 space-y-3">
                    <div>
                      <span className="font-bold flex items-center gap-1.5 mb-1 text-red-500">
                        ⚠️ Erro de Política de Controle (AppLocker)?
                      </span>
                      Se o comando PowerShell <code className="bg-muted px-1 rounded font-mono">irm https://ollama.com/install.ps1 | iex</code> falhar com o erro <em>"An Application Control policy has blocked this file"</em>, é porque o Windows bloqueia scripts que executam arquivos da pasta Temp.
                    </div>
                    
                    <div className="pt-2 border-t border-destructive/10">
                      <span className="font-bold flex items-center gap-1.5 mb-1 text-red-500">
                        🛡️ Bloqueado pelo Smart App Control (SAC) ou SmartScreen?
                      </span>
                      No Windows 11, o <strong>Smart App Control (SAC)</strong> pode bloquear o <code className="bg-muted px-1 rounded font-mono">OllamaSetup.exe</code> sem dar a opção de "Executar assim mesmo", alegando não poder verificar o editor.
                    </div>

                    <div className="space-y-2 pt-2 border-t border-destructive/10 text-foreground dark:text-foreground">
                      <span className="font-bold block text-xs">Como contornar esses bloqueios (Escolha uma opção):</span>
                      <ul className="list-decimal pl-4 space-y-2">
                        <li>
                          <strong>Opção A (Via Terminal - Winget):</strong> Use o Gerenciador de Pacotes do Windows (Winget) que possui assinatura confiável. Abra o PowerShell ou Terminal e execute:
                          <pre className="bg-muted px-3 py-1.5 rounded-lg border border-border font-mono text-[10px] mt-1 select-all overflow-x-auto text-foreground">
                            winget install --id Ollama.Ollama -e
                          </pre>
                        </li>
                        <li>
                          <strong>Opção B (Desbloquear Executável):</strong> 
                          <ul className="list-disc pl-4 mt-1 space-y-1">
                            <li>
                              <strong>Via Interface:</strong> Clique com o botão direito no arquivo <code className="bg-muted px-1 rounded font-mono">OllamaSetup.exe</code> baixado → vá em <strong>Propriedades</strong> → na aba Geral (no rodapé), marque a caixa <strong>Desbloquear</strong> (Unblock) → clique em Aplicar/OK.
                            </li>
                            <li>
                              <strong>Via PowerShell:</strong> Execute o comando:
                              <pre className="bg-muted px-3 py-1.5 rounded-lg border border-border font-mono text-[10px] mt-1 select-all overflow-x-auto text-foreground">
                                Unblock-File -Path "$env:USERPROFILE\Downloads\OllamaSetup.exe"
                              </pre>
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>Opção C (Desativar Smart App Control):</strong> Se o Windows ainda bloquear por reputação da nuvem, desative o Smart App Control:
                          <ol className="list-decimal pl-4 mt-1 space-y-1">
                            <li>Abra o menu <strong>Iniciar</strong> e pesquise por <strong>"Segurança do Windows"</strong>.</li>
                            <li>Vá em <strong>Controle de aplicativos e do navegador</strong>.</li>
                            <li>Clique em <strong>Configurações do Smart App Control</strong>.</li>
                            <li>Altere de <em>Ligado</em> (ou <em>Avaliação</em>) para <strong>Desligado</strong>.</li>
                          </ol>
                          <span className="text-[10px] text-muted-foreground block mt-1">
                            <em>Nota: O próprio Windows avisa que, ao desativar permanentemente, não é possível reativá-lo sem reinstalar o Windows, mas desativá-lo é uma prática comum para desenvolvedores que precisam rodar ferramentas de terceiros locais como o Ollama.</em>
                          </span>
                        </li>
                        <li>
                          <strong>Opção D (WSL - Linux no Windows):</strong> Se você tem o WSL instalado, execute o Ollama em ambiente Linux:
                          <pre className="bg-muted px-3 py-1.5 rounded-lg border border-border font-mono text-[10px] mt-1 select-all overflow-x-auto text-foreground">
                            curl -fsSL https://ollama.com/install.sh | sh
                          </pre>
                        </li>
                        <li>
                          <strong>Opção E (SmartScreen clássico):</strong> Se for apenas a tela azul do SmartScreen comum, clique em <strong>"Mais informações"</strong> e depois no botão <strong>"Executar assim mesmo"</strong>.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 2. BAIXAR MODELO */}
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">🤖 Passo 2: Baixar o Modelo de Linguagem</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong>Importante:</strong> Após concluir a instalação do passo anterior, <strong>feche todas as janelas de terminal abertas e abra-as novamente</strong> para recarregar as variáveis de ambiente. Caso o comando continue não sendo reconhecido, reinicie o computador, abra o terminal e tente novamente.
                    <br />
                    Execute o comando abaixo para baixar e iniciar o modelo padrão recomendado (altamente compatível e estável para traduções e análise gramatical):
                  </p>
                  <pre className="bg-muted px-3 py-2 rounded-lg border border-border font-mono text-[11px] select-all overflow-x-auto text-foreground">
                    ollama run llama3.2
                  </pre>
                  <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                    Nota: O download do modelo `llama3.2` tem cerca de 2.0 GB. Quando a instalação terminar no terminal e você ver o prompt de chat, digite <code className="bg-muted px-1 rounded text-red-500 font-mono">/exit</code> e aperte Enter para fechar.
                  </p>
                  <div className="bg-muted/40 border border-border rounded-xl p-3 text-[11px] leading-relaxed mt-2 space-y-1">
                    <span className="font-bold block text-foreground">💡 Dica para Recursos Visuais (Opcional):</span>
                    Se você deseja que o Ollama consiga processar imagens/legendas tiradas da câmera e fazer OCR local, você pode usar um modelo de visão:
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                      <li>
                        <strong>Gemma 3 (Recomendado):</strong> O modelo <code className="bg-muted px-1 rounded font-mono">gemma3</code> (4B, ~2.3 GB) possui excelente suporte a visão e carrega perfeitamente na maioria das GPUs (inclusive CUDA v12) e CPUs. Baixe e teste com uma imagem rodando: <code className="bg-muted px-1 rounded font-mono">ollama run gemma3 ./imagem.png "o que está escrito nesta imagem?"</code>.
                      </li>
                      <li>
                        <strong>Llama 3.2 Vision:</strong> O modelo <code className="bg-muted px-1 rounded font-mono">llama3.2-vision</code> (~2.9 GB) também é de visão, mas exige suporte específico à arquitetura <code className="bg-muted px-1 rounded font-mono">mllama</code>.
                      </li>
                    </ul>
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      <em>Atenção: Se receber o erro <strong>"unknown model architecture: mllama"</strong> ao carregar o Llama 3.2 Vision devido à arquitetura de sua GPU/driver, utilize o <strong>gemma3</strong> no seletor, pois ele é 100% compatível e livre deste erro.</em>
                    </span>
                  </div>
                </div>

                {/* 3. CORS CONFIG */}
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-foreground block flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                    <AlertTriangle size={14} className="flex-shrink-0" /> Passo 3: Configurar o CORS (Obrigatório para Navegadores)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Como o Memorize é executado diretamente no seu navegador de internet, a segurança padrão impede conexões a servidores locais (como a porta padrão do Ollama) sem cabeçalhos CORS liberados.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed font-bold">
                    Importante: Feche o aplicativo do Ollama na barra de tarefas (clique com o botão direito no ícone do Ollama e clique em "Quit Ollama"). Depois, inicie com o comando CORS:
                  </p>
                  <div className="space-y-3 font-mono text-[10px] mt-2">
                    <div>
                      <span className="text-[10px] font-sans font-bold text-muted-foreground">PowerShell (Windows):</span>
                      <pre className="bg-muted px-2.5 py-1.5 rounded-lg border border-border overflow-x-auto mt-1 select-all text-foreground">
                        $env:OLLAMA_ORIGINS="*" ; ollama serve
                      </pre>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans font-bold text-muted-foreground">Terminal (macOS):</span>
                      <pre className="bg-muted px-2.5 py-1.5 rounded-lg border border-border overflow-x-auto mt-1 select-all text-foreground">
                        OLLAMA_ORIGINS="*" open -a Ollama
                      </pre>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans font-bold text-muted-foreground">Terminal (Linux / systemd):</span>
                      <p className="font-sans text-[11px] text-muted-foreground leading-relaxed mb-1">
                        Se você usa o systemd do Linux, execute <code className="bg-muted px-1 rounded font-mono">sudo systemctl edit ollama</code> e adicione:
                      </p>
                      <pre className="bg-muted px-2.5 py-1.5 rounded-lg border border-border overflow-x-auto mt-1 text-foreground">
                        [Service]
                        Environment="OLLAMA_ORIGINS=*"
                      </pre>
                      <p className="font-sans text-[11px] text-muted-foreground leading-relaxed mt-1">
                        Salve o arquivo e depois execute: <code className="bg-muted px-1 rounded font-mono">sudo systemctl daemon-reload && sudo systemctl restart ollama</code>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. CONECTAR */}
                <div className="p-4 bg-muted/10 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">⚙️ Passo 4: Ativar no Memorize</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vá em **Configurações (⚙️)** do Memorize, na seção **Integração com Inteligência Artificial**, escolha o provedor como **Ollama (Local / Grátis)**, verifique o modelo (`llama3.2`) e clique em **Testar Conexão**. Conexão configurada!
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
