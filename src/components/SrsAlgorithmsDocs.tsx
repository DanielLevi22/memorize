import React, { useState } from 'react';
import { Brain, Calendar, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import { Card as ShadcnCard } from './ui/card';

interface SrsAlgorithmsDocsProps {
  hideHeader?: boolean;
}

export const SrsAlgorithmsDocs: React.FC<SrsAlgorithmsDocsProps> = ({ hideHeader = false }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'sm2' | 'fsrs' | 'comparison'>('overview');

  return (
    <div className={hideHeader ? "flex flex-col gap-6 w-full animate-in fade-in duration-300" : "flex flex-col gap-6 animate-in fade-in duration-300 w-full max-w-5xl mx-auto"}>
      {/* Cabeçalho */}
      {!hideHeader && (
        <div className="flex flex-col gap-1.5 border-b border-border pb-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            🧠 Algoritmos de Repetição Espaçada (SRS)
          </h2>
          <p className="text-xs text-muted-foreground">
            Entenda o funcionamento, as equações matemáticas e os motores de agendamento por trás do Memorize.
          </p>
        </div>
      )}

      {/* Menu de Abas */}
      <div className="flex flex-wrap gap-2 bg-muted/40 p-1 rounded-xl border border-border/60 max-w-max">
        <button
          onClick={() => setActiveSection('overview')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeSection === 'overview'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Brain size={14} />
          Visão Geral
        </button>
        <button
          onClick={() => setActiveSection('sm2')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeSection === 'sm2'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar size={14} />
          SM-2 Clássico
        </button>
        <button
          onClick={() => setActiveSection('fsrs')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeSection === 'fsrs'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap size={14} />
          FSRS v4 Moderno
        </button>
        <button
          onClick={() => setActiveSection('comparison')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
            activeSection === 'comparison'
              ? 'bg-background text-primary shadow-sm font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp size={14} />
          Comparação Direta
        </button>
      </div>

      {/* Seções de Conteúdo */}
      <ShadcnCard className="p-6 bg-card border-border shadow-md rounded-xl">
        {/* ABA: VISÃO GERAL */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-3.5">
                <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded tracking-wider">
                  Teoria de Ebbinghaus
                </span>
                <h3 className="text-base font-bold text-foreground">Como a nossa memória se comporta?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Quando aprendemos algo novo, a nossa retenção cai de forma <strong>exocentrada exponencial</strong> nas horas seguintes. Este fenômeno é conhecido como a <strong>Curva do Esquecimento</strong>.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A repetição espaçada resolve isso introduzindo revisões logo antes do momento do esquecimento. Cada vez que você revisa um cartão com sucesso, duas coisas acontecem:
                </p>
                <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                  <li>A força da memória é restaurada para 100%.</li>
                  <li>A velocidade com que você esquece o conteúdo <strong>diminui</strong> (o intervalo dobra ou triplica).</li>
                </ul>
              </div>

              {/* Curva de Esquecimento Ilustrativa (SVG) */}
              <div className="flex flex-col items-center justify-center p-4 border border-border/80 bg-muted/10 rounded-xl">
                <span className="text-[10px] font-bold text-muted-foreground mb-3">A Curva de Aprendizado Espaçado</span>
                <svg viewBox="0 0 400 200" className="w-full max-w-[320px] overflow-visible">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="380" y2="20" stroke="var(--border)" strokeDasharray="3,3" />
                  <line x1="40" y1="160" x2="380" y2="160" stroke="var(--border)" strokeDasharray="3,3" />
                  
                  {/* Axis */}
                  <line x1="40" y1="20" x2="40" y2="170" stroke="currentColor" className="text-muted-foreground/60" strokeWidth="2" />
                  <line x1="30" y1="160" x2="390" y2="160" stroke="currentColor" className="text-muted-foreground/60" strokeWidth="2" />
                  
                  {/* Labels */}
                  <text x="35" y="15" textAnchor="end" className="fill-muted-foreground text-[9px] font-semibold">100%</text>
                  <text x="35" y="165" textAnchor="end" className="fill-muted-foreground text-[9px] font-semibold">0%</text>
                  <text x="210" y="185" textAnchor="middle" className="fill-muted-foreground text-[9px] font-semibold">Tempo (Dias)</text>
                  <text x="20" y="90" textAnchor="middle" className="fill-muted-foreground text-[9px] font-semibold" transform="rotate(-90 20 90)">Retenção</text>

                  {/* Curve 1 (Original Forget) */}
                  <path d="M 40,20 Q 80,140 120,160" fill="none" stroke="currentColor" className="text-red-500/40" strokeWidth="2" strokeDasharray="4,4" />
                  
                  {/* Curve 2 (After Review 1) */}
                  <path d="M 40,20 Q 60,110 80,120 M 80,20 Q 140,120 200,140" fill="none" stroke="currentColor" className="text-amber-500/50" strokeWidth="2" strokeDasharray="4,4" />
                  
                  {/* Curve 3 (Actual Spaced Repetition Paths) */}
                  {/* Path 1: 1st review at day 1 */}
                  <path d="M 40,20 Q 55,90 70,100" fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
                  {/* Jump back up */}
                  <line x1="70" y1="100" x2="70" y2="20" stroke="currentColor" className="text-primary" strokeWidth="1.5" strokeDasharray="2,2" />
                  
                  {/* Path 2: 2nd review at day 4 */}
                  <path d="M 70,20 Q 110,70 150,90" fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
                  {/* Jump back up */}
                  <line x1="150" y1="90" x2="150" y2="20" stroke="currentColor" className="text-primary" strokeWidth="1.5" strokeDasharray="2,2" />

                  {/* Path 3: 3rd review at day 14 */}
                  <path d="M 150,20 Q 250,55 350,75" fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" />
                  
                  {/* Review Nodes */}
                  <circle cx="70" cy="100" r="3.5" className="fill-red-500" />
                  <circle cx="150" cy="90" r="3.5" className="fill-amber-500" />
                  <circle cx="350" cy="75" r="3.5" className="fill-emerald-500" />
                </svg>
              </div>
            </div>

            <div className="pt-4 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-muted/20 border border-border/80 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-foreground block">1. Estude o Card</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed block">
                  Veja a pergunta, tente lembrar a resposta e revele o verso do cartão para se avaliar.
                </span>
              </div>
              <div className="p-3.5 bg-muted/20 border border-border/80 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-foreground block">2. Avalie sua Memória</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed block">
                  Escolha "Errei", "Difícil" ou "Fácil" baseando-se no esforço necessário para lembrar.
                </span>
              </div>
              <div className="p-3.5 bg-muted/20 border border-border/80 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-foreground block">3. Deixe o App Agendar</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed block">
                  O algoritmo ativo calcula o prazo ideal para que o cartão volte logo antes do esquecimento.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ABA: SM-2 CLÁSSICO */}
        {activeSection === 'sm2' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded tracking-wider">
                SuperMemo-2 (1987)
              </span>
              <h3 className="text-base font-bold text-foreground">Como funciona o SM-2?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O algoritmo SM-2 calcula o intervalo da próxima revisão multiplicando o intervalo atual por um <strong>Fator de Facilidade (Ease Factor - EF)</strong>. Se você acerta um cartão, o fator aumenta e o intervalo cresce exponencialmente. Se você erra, o fator diminui e o intervalo é resetado para 1 dia.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
                <div className="bg-muted/40 p-2.5 border-b border-border/60 text-xs font-bold text-foreground flex items-center gap-1.5">
                  🔢 Fórmulas do SM-2
                </div>
                <div className="p-3.5 space-y-2.5 text-xs text-muted-foreground font-mono">
                  <div>
                    <span className="text-foreground font-bold block mb-0.5">Primeiro Intervalo (n=1):</span>
                    I(1) = 1 dia
                  </div>
                  <div>
                    <span className="text-foreground font-bold block mb-0.5">Segundo Intervalo (n=2):</span>
                    I(2) = 6 dias (ou 3 dias para Hard)
                  </div>
                  <div>
                    <span className="text-foreground font-bold block mb-0.5">Intervalos Posteriores (n &gt; 2):</span>
                    I(n) = I(n-1) * Ease Factor
                  </div>
                </div>
              </div>

              <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
                <div className="bg-muted/40 p-2.5 border-b border-border/60 text-xs font-bold text-foreground flex items-center gap-1.5">
                  ⚖️ Atualização do Ease Factor (EF)
                </div>
                <div className="p-3.5 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Fácil (3):</span>
                    <span className="font-mono text-foreground font-bold">EF = EF + 0.15</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-1.5">
                    <span className="font-semibold text-amber-500">Difícil (2):</span>
                    <span className="font-mono text-foreground font-bold">EF = EF - 0.15</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-1.5">
                    <span className="font-semibold text-red-500">Errei (1):</span>
                    <span className="font-mono text-foreground font-bold">EF = EF - 0.20</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-2 leading-relaxed">
                    * O EF padrão inicial é <strong>2.5</strong> e o limite mínimo absoluto é <strong>1.3</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 border border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">✓ Vantagens</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Extremamente simples, leve de executar no banco de dados e previsível. É a fórmula padrão clássica mais testada no mundo dos flashcards.
                </p>
              </div>
              <div className="p-3.5 border border-red-500/20 bg-red-500/5 rounded-xl">
                <span className="text-xs font-bold text-red-500 block mb-1">✗ Desvantagens ("Ease Hell")</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Se você errar um cartão várias vezes seguidas, o EF despenca para 1.3. Mesmo após memorizar o cartão, ele continuará aparecendo quase todo dia por muito tempo porque o multiplicador travou no mínimo.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted/30 border border-border rounded-xl text-[11px] text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <span>Quer se aprofundar na matemática original do SM-2?</span>
              <a
                href="https://www.supermemo.com/en/archives1990-2015/english/ol/sm2"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-bold hover:underline shrink-0 text-xs"
              >
                Ler Artigo Original de 1990 ↗
              </a>
            </div>
          </div>
        )}

        {/* ABA: FSRS V4 MODERNO */}
        {activeSection === 'fsrs' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded tracking-wider">
                FSRS v4 (2023 - Estado da Arte)
              </span>
              <h3 className="text-base font-bold text-foreground">O que torna o FSRS superior?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O <strong>FSRS (Free Spaced Repetition Scheduler)</strong> substitui o multiplicador linear simples do SM-2 por um modelo de memória científica composto de 3 pilares (**Dificuldade**, **Estabilidade** e **Retrivabilidade**), utilizando equações de regressão não-linear para estimar o decaimento exocentral exato da memória.
              </p>
            </div>

            {/* Pilares DSR */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 border border-border/80 bg-background rounded-xl space-y-1">
                <span className="text-xs font-black text-foreground block">Dificuldade (D)</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed block">
                  Indica a complexidade intrínseca do conteúdo. Medida de <strong>1</strong> (fácil) a <strong>10</strong> (difícil). É atualizada com base nas suas notas de forma suavizada.
                </span>
              </div>
              <div className="p-3.5 border border-border/80 bg-background rounded-xl space-y-1">
                <span className="text-xs font-black text-foreground block">Estabilidade (S)</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed block">
                  Representa a força da memória física. Corresponde ao **número de dias** até que a probabilidade de você esquecer o cartão atinja exatamente 10%.
                </span>
              </div>
              <div className="p-3.5 border border-border/80 bg-background rounded-xl space-y-1">
                <span className="text-xs font-black text-foreground block">Retrivabilidade (R)</span>
                <span className="text-[11px] text-muted-foreground leading-relaxed block">
                  A probabilidade matemática de lembrar do cartão hoje. Decai a cada dia conforme a fórmula de potência: <strong>R = 0.9^(tempo / estabilidade)</strong>.
                </span>
              </div>
            </div>

            <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
              <div className="bg-muted/40 p-2.5 border-b border-border/60 text-xs font-bold text-foreground flex items-center gap-1.5">
                🧠 A Lógica Matemática de Transição de Estabilidade
              </div>
              <div className="p-4 space-y-3.5 text-xs text-muted-foreground">
                <div>
                  <span className="text-foreground font-semibold block mb-0.5">Em caso de Acerto (Recall):</span>
                  A nova estabilidade aumenta multiplicativamente baseando-se na dificuldade atual ($D$), na estabilidade atual ($S$) e na probabilidade de recall ($R$) que você tinha quando respondeu. Se você acerta um cartão quase esquecido ($R$ baixo), a estabilidade ganha um bônus enorme!
                </div>
                <div className="border-t border-border/50 pt-2.5">
                  <span className="text-foreground font-semibold block mb-0.5">Em caso de Erro (Esquecimento):</span>
                  Ao contrário do SM-2 que reseta totalmente o progresso, o FSRS reduz a estabilidade drasticamente, mas **preserva uma fração** do aprendizado consolidado anterior baseando-se na estabilidade acumulada até ali.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-3.5 border border-emerald-500/20 bg-emerald-500/5 rounded-xl">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">✓ Vantagens (Eficiência Máxima)</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Reduz a carga de revisões diárias em <strong>20% a 30%</strong> para o mesmo nível de retenção, elimina completamente o "Ease Hell" do SM-2 e adapta-se dinamicamente com intervalos iniciais realistas.
                </p>
              </div>
              <div className="p-3.5 border border-amber-500/20 bg-amber-500/5 rounded-xl">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-500 block mb-1">⚠️ Observação</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  As contas envolvem fórmulas de decaimento logarítmico e potências fracionárias, o que requer mais campos no banco de dados para salvar o histórico de estabilidade.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted/30 border border-border rounded-xl text-[11px] text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <span>Quer explorar o projeto de código aberto e artigos científicos do FSRS?</span>
              <a
                href="https://github.com/open-spaced-repetition/fsrs4anki"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-bold hover:underline shrink-0 text-xs"
              >
                Acessar Repositório & Wiki ↗
              </a>
            </div>
          </div>
        )}

        {/* ABA: COMPARAÇÃO DIRETA */}
        {activeSection === 'comparison' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-base font-bold text-foreground mb-2">Tabela Comparativa</h3>
            
            <div className="overflow-x-auto border border-border rounded-xl bg-background">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-3 font-bold text-foreground w-1/4">Característica</th>
                    <th className="p-3 font-bold text-red-500 w-3/8">SM-2 Clássico</th>
                    <th className="p-3 font-bold text-primary w-3/8">FSRS v4 Moderno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-muted-foreground">
                  <tr>
                    <td className="p-3 font-bold text-foreground">Variável de Controle</td>
                    <td className="p-3">Fator de Facilidade (Ease Factor)</td>
                    <td className="p-3">Estabilidade (S) e Dificuldade (D)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Fórmula de Queda</td>
                    <td className="p-3">Geométrica Fixa</td>
                    <td className="p-3">Potência Exponencial da Memória</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Primeira Revisão</td>
                    <td className="p-3">Sempre 1 dia</td>
                    <td className="p-3">Flexível (depende de quão fácil/difícil foi)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Recuperação de Erro</td>
                    <td className="p-3 text-red-500/80 font-semibold">Difícil ("Ease Hell" / Travamento)</td>
                    <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">Suave (Preserva aprendizado residual)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Eficiência Geral</td>
                    <td className="p-3">Moderada (Revisões redundantes)</td>
                    <td className="p-3 text-primary font-bold">Alta (~20 a 30% menos revisões necessárias)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Suporte Científico</td>
                    <td className="p-3">Base Teórica de 1987</td>
                    <td className="p-3">Otimização de Redes Neurais / Big Data (2023)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-3 p-3 bg-primary/10 border border-primary/20 text-primary rounded-xl mt-4">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs text-foreground leading-relaxed">
                <span className="font-bold">Recomendação do Memorize:</span>
                <p className="text-muted-foreground">Recomendamos utilizar o <strong>FSRS v4</strong> se você deseja economizar tempo de estudo e reter conteúdo com mais eficiência. Se preferir a previsibilidade clássica do Anki antigo, opte pelo <strong>SM-2</strong>.</p>
              </div>
            </div>
          </div>
        )}
      </ShadcnCard>
    </div>
  );
};
