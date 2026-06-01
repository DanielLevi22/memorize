import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, Lock, Sparkles, Compass, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { db, createA1VocabularyDeck } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CefrExam, CefrExamAttempt, Card as AppCard } from '../types';

interface ExamsPageProps {
  cards: AppCard[] | undefined;
  onStartExam: (exam: CefrExam) => void;
  onStartDiagnostic: () => void;
  onGoToReading: () => void;
}

const levelDetailsData = {
  'A1': { title: 'Iniciante', name: 'A1 - Breakthrough', vocabGoal: 500, canDo: ['Compreender/usar expressões familiares cotidianas.', 'Apresentar-se e fazer perguntas pessoais simples.', 'Interagir de forma simples se falarem claro e devagar.'] },
  'A2': { title: 'Básico', name: 'A2 - Waystage', vocabGoal: 1000, canDo: ['Entender frases sobre áreas de relevância direta.', 'Comunicar-se em tarefas rotineiras de informação.', 'Descrever passado, ambiente imediato e necessidades.'] },
  'B1': { title: 'Intermediário I', name: 'B1 - Threshold', vocabGoal: 2000, canDo: ['Compreender pontos principais sobre assuntos familiares.', 'Lidar com situações de viagem no país nativo.', 'Produzir textos simples e coerentes sobre interesses.'] },
  'B2': { title: 'Intermediário II', name: 'B2 - Vantage', vocabGoal: 4000, canDo: ['Entender ideias principais de textos complexos e debates.', 'Interagir com nativos de forma fluida e espontânea.', 'Produzir textos claros, detalhados e defender opiniões.'] },
  'C1': { title: 'Avançado', name: 'C1 - Operational Proficiency', vocabGoal: 8000, canDo: ['Compreender ampla variedade de textos logos e implícitos.', 'Expressar-se de forma fluida sem buscar palavras.', 'Usar idioma de forma flexível para fins profissionais.'] },
  'C2': { title: 'Proficiente', name: 'C2 - Mastery', vocabGoal: 12000, canDo: ['Entender com facilidade tudo o que ouve ou lê.', 'Resumir informações de fontes orais e escritas.', 'Expressar-se com precisão e nuances de significado.'] }
};

export const ExamsPage: React.FC<ExamsPageProps> = ({
  cards,
  onStartExam,
  onStartDiagnostic,
  onGoToReading,
}) => {
  const levelsKeys = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // CEFR States
  const [unlockedLevel, setUnlockedLevel] = useState<string>(() => {
    return localStorage.getItem('memorize_cefr_unlocked_level') || localStorage.getItem('memorize_cefr_start_level') || 'A1';
  });
  
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<string>(() => {
    return localStorage.getItem('memorize_cefr_selected_exam_level') || localStorage.getItem('memorize_cefr_unlocked_level') || 'A1';
  });

  const [cefrCounts, setCefrCounts] = useState<Record<string, number>>({
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0
  });

  const [selectedExam, setSelectedExam] = useState<CefrExam | null>(null);
  const [attempts, setAttempts] = useState<CefrExamAttempt[]>([]);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  const hasA1Deck = useLiveQuery(() => db.decks.get('essential-a1-vocabulary'));
  const levelReadings = useLiveQuery(() => db.readings.where('cefrLevel').equals(selectedDetailLevel).toArray(), [selectedDetailLevel]);

  // Sync with localStorage changes
  useEffect(() => {
    const handleStorageSync = () => {
      setUnlockedLevel(localStorage.getItem('memorize_cefr_unlocked_level') || localStorage.getItem('memorize_cefr_start_level') || 'A1');
      const selected = localStorage.getItem('memorize_cefr_selected_exam_level');
      if (selected && levelsKeys.includes(selected)) {
        setSelectedDetailLevel(selected);
      }
    };

    window.addEventListener('storage', handleStorageSync);
    const interval = setInterval(handleStorageSync, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageSync);
      clearInterval(interval);
    };
  }, []);

  const loadAttempts = async () => {
    try {
      const list = await db.cefrExamAttempts.toArray();
      list.sort((a, b) => b.timestamp - a.timestamp);
      setAttempts(list);
    } catch (err) {
      console.error('Erro ao carregar tentativas no ExamsPage:', err);
    }
  };

  useEffect(() => {
    loadAttempts();
  }, []);

  // Load cefrCounts by counting card.cefrLevel
  useEffect(() => {
    if (!cards) return;
    const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    cards.forEach(c => {
      if (c.cefrLevel && c.cefrLevel in counts) {
        counts[c.cefrLevel as keyof typeof counts]++;
      }
    });
    setCefrCounts(counts);
  }, [cards]);

  // Load selected level exam
  useEffect(() => {
    const loadExam = async () => {
      try {
        const exam = await db.cefrExams.where('level').equals(selectedDetailLevel).first();
        setSelectedExam(exam || null);
      } catch (err) {
        console.error('Erro ao carregar simulado no ExamsPage:', err);
      }
    };
    loadExam();
  }, [selectedDetailLevel]);

  const selectedLevelDetails = levelDetailsData[selectedDetailLevel as keyof typeof levelDetailsData];
  const activeLevelLearned = cefrCounts[selectedDetailLevel] || 0;
  const isSelectedLevelLocked = levelsKeys.indexOf(selectedDetailLevel) > levelsKeys.indexOf(unlockedLevel);
  const activeLevelPercent = Math.min(100, Math.round((activeLevelLearned / selectedLevelDetails.vocabGoal) * 100));

  return (
    <div className="space-y-6 w-full max-w-none px-2 md:px-6 py-4">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm animate-pulse">
              <ClipboardList size={24} />
            </div>
            Exames & Diagnósticos CEFR
          </h2>
          <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
            Faça testes de nivelamento, simule exames oficiais baseados no CEFR e certifique sua proficiência no idioma.
          </p>
        </div>
      </div>

      {/* 1. SELETOR DE NÍVEL E ROADMAP CEFR */}
      <ShadcnCard className="bg-card border border-border/60 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/20 pb-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
              <Compass size={16} className="text-primary" /> Roadmap & Seletor de Nível CEFR
            </h3>
            <p className="text-xs text-muted-foreground font-semibold">
              Explore o quadro europeu, veja o vocabulário necessário para cada nível e faça a prova para subir no roadmap.
            </p>
          </div>
          
          {/* Status Geral */}
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl self-start">
            <Award size={14} className="text-emerald-500" />
            <div className="text-[10px] font-black text-foreground uppercase tracking-wider">
              Nível Desbloqueado: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{unlockedLevel}</strong>
            </div>
          </div>
        </div>

        {/* Timeline Horizontal de Progresso */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-1">
          {levelsKeys.map((lvl, index) => {
            const isCurrent = unlockedLevel === lvl;
            const isLocked = index > levelsKeys.indexOf(unlockedLevel);
            const progress = cefrCounts[lvl] || 0;
            const goal = levelDetailsData[lvl as keyof typeof levelDetailsData].vocabGoal;
            const pct = Math.min(100, Math.round((progress / goal) * 100));
            const isSelected = selectedDetailLevel === lvl;

            return (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setSelectedDetailLevel(lvl);
                  localStorage.setItem('memorize_cefr_selected_exam_level', lvl);
                }}
                className={`p-4 rounded-xl border text-center flex flex-col items-center justify-between transition-all duration-200 cursor-pointer relative hover:scale-102 hover:shadow-md ${
                  isSelected 
                    ? 'border-primary ring-2 ring-primary/25 shadow-md shadow-primary/5 bg-primary/5 scale-102' 
                    : isCurrent
                      ? 'bg-primary/10 border-primary/45 text-primary'
                      : isLocked
                        ? 'bg-muted/15 border-border/45 text-muted-foreground/60 opacity-75'
                        : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {/* Indicador de Cadeado */}
                <div className="absolute top-2 right-2">
                  {isLocked ? (
                    <Lock size={9} className="text-muted-foreground/45" />
                  ) : (
                    <CheckCircle2 size={10} className="text-emerald-500" />
                  )}
                </div>

                <span className="text-[9px] text-muted-foreground/60 font-black uppercase tracking-wide">Nível</span>
                <span className="text-xl font-black tracking-tight mt-0.5">{lvl}</span>
                
                {/* Mini Progresso de Vocabulário */}
                <div className="w-full mt-3 space-y-1">
                  <div className="flex justify-between text-[8px] font-black opacity-80">
                    <span>VOCAB</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-muted/50 rounded-full h-1 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isLocked ? 'bg-muted-foreground/35' : isCurrent ? 'bg-primary' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ShadcnCard>

      {/* Grid Principal de Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Lado Esquerdo: Foco do Nível Selecionado */}
        {selectedLevelDetails && (
          <ShadcnCard className="lg:col-span-2 bg-card border border-border/60 p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-5">
            
            <div className="flex items-start justify-between gap-3 border-b border-border/20 pb-4 shrink-0">
              <div className="space-y-1">
                <span className="text-[10px] text-primary font-black uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full">
                  Foco do Nível • {selectedDetailLevel}
                </span>
                <h4 className="font-black text-lg text-foreground mt-1">
                  {selectedLevelDetails.name} • {levelDetailsData[selectedDetailLevel as keyof typeof levelDetailsData].title}
                </h4>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-foreground bg-muted border border-border px-3 py-1 rounded-xl shadow-sm block">
                  {activeLevelLearned} / {selectedLevelDetails.vocabGoal} <span className="text-muted-foreground font-semibold">cards</span>
                </span>
              </div>
            </div>

            {/* Habilidades Avaliadas & Instruções */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-[11px] font-semibold text-foreground/80 leading-relaxed py-1">
              
              <div className="space-y-3 p-4 bg-muted/15 border border-border/40 rounded-xl">
                <span className="text-[9px] uppercase font-black text-muted-foreground flex items-center gap-1.5 border-b border-border/20 pb-1.5">
                  <CheckCircle2 size={12} className="text-emerald-500" /> Competências deste nível
                </span>
                <ul className="pl-1.5 space-y-2 text-foreground/75 font-medium">
                  {selectedLevelDetails.canDo.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 leading-normal">
                      <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <span className="text-[9px] uppercase font-black text-primary flex items-center gap-1.5 border-b border-primary/10 pb-1.5">
                  📋 Formato do Simulado
                </span>
                <div className="space-y-2.5 text-[10px] text-foreground/75 font-medium leading-relaxed">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span><strong>Reading:</strong> Múltipla escolha de uso do inglês.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span><strong>Listening:</strong> Compreensão por áudio TTS.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span><strong>Writing:</strong> Redação corrigida por Gemini IA.</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground italic border-t border-border/20 pt-1.5 mt-1.5">
                    * Média para aprovação: 60%. Duração livre.
                  </p>
                </div>
              </div>
            </div>
            
            {/* 🎒 Trilha de Estudos Recomendados */}
            <div className="border-t border-border/20 pt-4 space-y-3 shrink-0">
              <span className="text-[10px] uppercase font-black text-primary flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary" /> Trilha de Estudos Recomendados ({selectedDetailLevel})
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Leituras Sugeridas */}
                <div className="bg-muted/10 border border-border/30 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-black text-muted-foreground uppercase block border-b border-border/20 pb-1 flex items-center gap-1">
                      📖 Leituras Sugeridas ({selectedDetailLevel})
                    </span>
                    {levelReadings && levelReadings.length > 0 ? (
                      <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1 mt-1.5">
                        {levelReadings.map(r => (
                          <div key={r.id} className="flex items-center justify-between gap-2 bg-card border border-border/40 p-2 rounded-lg text-[9.5px] font-semibold hover:border-primary/30 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground truncate font-bold">{r.title}</p>
                              <p className="text-muted-foreground text-[8px] truncate font-medium">{r.description}</p>
                            </div>
                            <Button
                              size="xs"
                              onClick={() => {
                                localStorage.setItem('memorize_active_reading_id', r.id);
                                onGoToReading();
                              }}
                              className="bg-primary/10 hover:bg-primary/20 text-primary text-[8px] h-6 px-2.5 rounded-md cursor-pointer shrink-0 border-none font-bold"
                            >
                              Ler
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-muted-foreground italic font-medium mt-2 pl-0.5">Nenhum texto sugerido para este nível no momento.</p>
                    )}
                  </div>
                </div>

                {/* Vocabulário Recomendado */}
                <div className="bg-muted/10 border border-border/30 rounded-xl p-3.5 space-y-2 flex flex-col justify-between min-h-[120px]">
                  <div>
                    <span className="text-[9px] font-black text-muted-foreground uppercase block border-b border-border/20 pb-1">
                      🗂️ Vocabulário & Baralhos
                    </span>
                    {selectedDetailLevel === 'A1' ? (
                      <p className="text-[9.5px] text-foreground/80 leading-normal font-medium mt-2">
                        {hasA1Deck ? (
                          <span className="text-emerald-500 font-extrabold flex items-center gap-1 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/25 justify-center">
                            ✓ Baralho A1 Essencial criado!
                          </span>
                        ) : (
                          "Para começar do zero, adicione o baralho essencial A1 de 20 cards offline (saudações e pronomes básicos)."
                        )}
                      </p>
                    ) : (
                      <p className="text-[9.5px] text-muted-foreground leading-normal font-medium mt-2">
                        Use o leitor para coletar palavras de nível {selectedDetailLevel} ou use o gerador de IA na aba de Baralhos para estudar temas específicos.
                      </p>
                    )}
                  </div>

                  {selectedDetailLevel === 'A1' && !hasA1Deck && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await createA1VocabularyDeck();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-zinc-50 font-bold text-[9px] h-7.5 rounded-lg cursor-pointer mt-2.5 shadow-sm shadow-indigo-500/25 border-none"
                    >
                      Gerar Baralho A1 Offline
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Barra de Progresso de Vocabulário & CTAs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/20 pt-4 mt-auto">
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase">
                  <span>Progresso Lexical</span>
                  <span>{activeLevelPercent}%</span>
                </div>
                <Progress value={activeLevelPercent} className="h-2 bg-muted border border-border/30" />
              </div>

              {(() => {
                const hasEnoughVocab = activeLevelLearned >= selectedLevelDetails.vocabGoal;
                const isExamDisabled = !isSelectedLevelLocked && !hasEnoughVocab;

                return (
                  <div className="flex items-center gap-3 shrink-0 justify-end">
                    {!isSelectedLevelLocked && !hasEnoughVocab && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[9px] text-amber-500 font-extrabold max-w-[170px] leading-snug text-right uppercase tracking-wide">
                          ⚠️ Estude mais {selectedLevelDetails.vocabGoal - activeLevelLearned} cards para liberar
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedExam) onStartExam(selectedExam);
                          }}
                          className="text-[8px] text-primary hover:text-primary/80 font-black uppercase tracking-wider underline cursor-pointer"
                        >
                          Ignorar Requisitos (Dev Mode)
                        </button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        if (selectedExam) onStartExam(selectedExam);
                      }}
                      disabled={isExamDisabled}
                      className={`h-10 text-xs font-black rounded-xl px-5 flex items-center gap-2 cursor-pointer transition-all ${
                        isSelectedLevelLocked
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/10 hover:scale-102'
                          : 'bg-primary hover:bg-primary/95 text-primary-foreground shadow-md shadow-primary/10 hover:scale-102'
                      }`}
                    >
                      {isSelectedLevelLocked ? (
                        <>
                          <Sparkles size={14} /> Nivelar-se (Diagnóstico)
                        </>
                      ) : (
                        <>
                          <Award size={14} /> Prestar Exame Oficial
                        </>
                      )}
                    </Button>
                  </div>
                );
              })()}
            </div>
          </ShadcnCard>
        )}

        {/* Lado Direito: IA Checkpoint (Diagnostic Call to Action) */}
        <div className="lg:col-span-1 flex flex-col justify-between">
          <ShadcnCard className="bg-card border border-border/60 p-6 rounded-2xl shadow-xl flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between border-b border-border/20 pb-3 shrink-0">
              <span className="text-[10px] font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary animate-pulse" /> IA Checkpoint (Diagnóstico)
              </span>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-6">
              <div className="p-4 bg-primary/10 rounded-full text-primary shadow-inner">
                <Sparkles size={28} className="animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-black text-foreground uppercase tracking-wide">
                  Diagnóstico Adaptativo
                </p>
                <p className="text-[10.5px] text-muted-foreground font-semibold leading-relaxed max-w-[200px] mx-auto">
                  Deixe a Inteligência Artificial mapear seu nível CEFR ideal em 5 minutos através de perguntas sob medida.
                </p>
              </div>
            </div>

            <Button
              onClick={onStartDiagnostic}
              className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-10 rounded-xl cursor-pointer shadow-md shadow-primary/10 hover:scale-102 transition-all"
            >
              Iniciar Diagnóstico por IA
            </Button>
          </ShadcnCard>
        </div>

      </div>

      {/* Histórico de Simulados */}
      <ShadcnCard className="bg-card border border-border/60 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <Award className="text-primary shrink-0" size={18} />
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
              Histórico de Simulados Prestados
            </h3>
          </div>
          <span className="text-[9px] text-muted-foreground font-extrabold uppercase bg-muted border border-border/40 px-2 py-0.5 rounded-md">
            {attempts.length} {attempts.length === 1 ? 'tentativa' : 'tentativas'}
          </span>
        </div>

        {attempts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-10">Nenhum simulado prestado ainda. Seus resultados de simulados aparecerão aqui.</p>
        ) : (
          <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground text-[8.5px] uppercase tracking-wider font-extrabold">
                  <th className="pb-3 pl-3">Nível</th>
                  <th className="pb-3 text-center">Reading</th>
                  <th className="pb-3 text-center">Listening</th>
                  <th className="pb-3 text-center">Writing</th>
                  <th className="pb-3 text-center font-bold">Média Geral</th>
                  <th className="pb-3 text-center">Resultado</th>
                  <th className="pb-3 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-medium">
                {attempts.map((att) => {
                  const isExpanded = expandedAttemptId === att.id;
                  return (
                    <React.Fragment key={att.id}>
                      <tr className={`hover:bg-muted/10 transition-colors ${isExpanded ? 'bg-muted/5' : ''}`}>
                        <td className="py-3 pl-3 text-foreground font-black text-sm">
                          <span className="bg-primary/10 text-primary border border-primary/20 rounded-lg px-2.5 py-0.5 shadow-sm">
                            {att.level}
                          </span>
                        </td>
                        <td className="py-3 text-center text-foreground/80 font-bold">{att.readingScore}%</td>
                        <td className="py-3 text-center text-foreground/80 font-bold">{att.listeningScore}%</td>
                        <td className="py-3 text-center text-foreground/80 font-bold">{att.writingScore}%</td>
                        <td className="py-3 text-center text-foreground font-black text-xs">{att.overallScore}%</td>
                        <td className="py-3 text-center">
                          <span className={`text-[8.5px] font-black px-2.5 py-1 rounded-lg shadow-sm border ${
                            att.passed 
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400' 
                              : 'bg-destructive/10 text-destructive border-destructive/25'
                          }`}>
                            {att.passed ? 'APROVADO' : 'REPROVADO'}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <button
                            onClick={() => setExpandedAttemptId(isExpanded ? null : att.id)}
                            className="text-[9.5px] font-black text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 border border-primary/15 px-2.5 py-1 rounded-xl flex items-center gap-1 ml-auto cursor-pointer transition-all"
                          >
                            {isExpanded ? 'Ocultar Feedback' : 'Ver Feedback'}
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-muted/5">
                          <td colSpan={7} className="p-4 border-t border-border/10">
                            <div className="bg-card border border-border p-4 rounded-xl space-y-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                              <p className="text-[9px] font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                                <Sparkles size={11} className="text-primary animate-pulse" /> Relatório Detalhado do Examinador IA:
                              </p>
                              <p className="text-[10.5px] text-foreground/90 font-semibold leading-relaxed whitespace-pre-wrap">
                                {att.aiFeedback || 'Sem feedback adicional disponível para esta tentativa.'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ShadcnCard>
    </div>
  );
};
