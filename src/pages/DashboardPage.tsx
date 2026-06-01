import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, Lock, Compass, Sparkles } from 'lucide-react';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { calculateDailyRequirements } from '../utils/cefrJourney';
import type { CefrLevelCode } from '../utils/cefrJourney';
import type { Deck, Card } from '../types';
import { CefrAlertBanner } from '../components/CefrAlertBanner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createA1VocabularyDeck } from '../db/db';

interface DashboardPageProps {
  decks: Deck[] | undefined;
  cards: Card[] | undefined;
  totalNew: number;
  totalDue: number;
  totalLearned: number;
  activeDeckMenuId: string | null;
  setActiveDeckMenuId: (id: string | null) => void;
  handleOpenNewDeckModal: () => void;
  setIsImportModalOpen: (open: boolean) => void;
  handleStartStudy: (deckId: string) => void;
  handleOpenAddCardModal: (deckId: string) => void;
  handleOpenEditDeckModal: (deck: Deck) => void;
  handleOpenDeckOptionsModal: (deck: Deck) => void;
  handleExportDeck: (deckId: string) => void;
  handleDeleteDeck: (deckId: string) => void;
  stats: {
    count: number;
    minutes: number;
    sPerCard: number;
  };
  handleOpenAiModal: () => void;
  dailyGoal: number;
  getDeckStudyableCounts: (deck: Deck, deckCards: Card[]) => {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCount: number;
  };
  readingStats: {
    minutes: number;
    wordsRead: number;
    sentencesMastered: number;
  };
  handleGoToReading: () => void;
  onNavigateToExams: (level: string) => void;
}

const levelDetailsData = {
  'A1': { title: 'Iniciante', name: 'A1 - Breakthrough', vocabGoal: 500, canDo: ['Compreender/usar expressões familiares cotidianas.', 'Apresentar-se e fazer perguntas pessoais simples.', 'Interagir de forma simples se falarem claro e devagar.'] },
  'A2': { title: 'Básico', name: 'A2 - Waystage', vocabGoal: 1000, canDo: ['Entender frases sobre áreas de relevância direta.', 'Comunicar-se em tarefas rotineiras de informação.', 'Descrever passado, ambiente imediato e necessidades.'] },
  'B1': { title: 'Intermediário I', name: 'B1 - Threshold', vocabGoal: 2000, canDo: ['Compreender pontos principais sobre assuntos familiares.', 'Lidar com situações de viagem no país nativo.', 'Produzir textos simples e coerentes sobre interesses.'] },
  'B2': { title: 'Intermediário II', name: 'B2 - Vantage', vocabGoal: 4000, canDo: ['Entender ideias principais de textos complexos e debates.', 'Interagir com nativos de forma fluida e espontânea.', 'Produzir textos claros, detalhados e defender opiniões.'] },
  'C1': { title: 'Avançado', name: 'C1 - Operational Proficiency', vocabGoal: 8000, canDo: ['Compreender ampla variedade de textos longos e implícitos.', 'Expressar-se de forma fluida sem buscar palavras.', 'Usar idioma de forma flexível para fins profissionais.'] },
  'C2': { title: 'Proficiente', name: 'C2 - Mastery', vocabGoal: 12000, canDo: ['Entender com facilidade tudo o que ouve ou lê.', 'Resumir informações de fontes orais e escritas.', 'Expressar-se com precisão e nuances de significado.'] }
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  cards,
  totalNew,
  totalDue,
  totalLearned,
  stats,
  dailyGoal,
  readingStats,
  handleGoToReading,
  onNavigateToExams,
}) => {
  const levelsKeys = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // CEFR States
  const [unlockedLevel, setUnlockedLevel] = useState<string>(() => {
    return localStorage.getItem('memorize_cefr_unlocked_level') || localStorage.getItem('memorize_cefr_start_level') || 'A1';
  });
  const [startLevel, setStartLevel] = useState<string>(() => {
    return localStorage.getItem('memorize_cefr_start_level') || 'A1';
  });
  const [targetLevel, setTargetLevel] = useState<string>(() => {
    return localStorage.getItem('memorize_cefr_target_level') || 'B2';
  });
  const [targetDays, setTargetDays] = useState<number>(() => {
    return Number(localStorage.getItem('memorize_cefr_target_days') || '90');
  });
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<string>(() => {
    return localStorage.getItem('memorize_cefr_unlocked_level') || 'A1';
  });

  const [cefrCounts, setCefrCounts] = useState<Record<string, number>>({
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0
  });

  const [showQuickStart, setShowQuickStart] = useState<boolean>(() => {
    return localStorage.getItem('memorize_hide_quickstart') !== 'true';
  });

  const hasA1Deck = useLiveQuery(() => db.decks.get('essential-a1-vocabulary'));
  const levelReadings = useLiveQuery(() => db.readings.where('cefrLevel').equals(selectedDetailLevel).toArray(), [selectedDetailLevel]);

  // Sync with localStorage changes
  useEffect(() => {
    const handleStorageSync = () => {
      setUnlockedLevel(localStorage.getItem('memorize_cefr_unlocked_level') || localStorage.getItem('memorize_cefr_start_level') || 'A1');
      setStartLevel(localStorage.getItem('memorize_cefr_start_level') || 'A1');
      setTargetLevel(localStorage.getItem('memorize_cefr_target_level') || 'B2');
      setTargetDays(Number(localStorage.getItem('memorize_cefr_target_days') || '90'));
    };

    window.addEventListener('storage', handleStorageSync);
    const interval = setInterval(handleStorageSync, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageSync);
      clearInterval(interval);
    };
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

  const journeyStart = Number(localStorage.getItem('memorize_cefr_journey_start') || Date.now());
  const daysElapsed = Math.max(0, Math.floor((Date.now() - journeyStart) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(1, targetDays - daysElapsed);
  const requirements = calculateDailyRequirements(
    totalLearned,
    startLevel as CefrLevelCode,
    targetLevel as CefrLevelCode,
    remainingDays
  );

  const selectedLevelDetails = levelDetailsData[selectedDetailLevel as keyof typeof levelDetailsData];
  const activeLevelLearned = cefrCounts[selectedDetailLevel] || 0;
  const isSelectedLevelLocked = levelsKeys.indexOf(selectedDetailLevel) > levelsKeys.indexOf(unlockedLevel);
  const activeLevelPercent = Math.min(100, Math.round((activeLevelLearned / selectedLevelDetails.vocabGoal) * 100));

  return (
    <div className="space-y-6 w-full max-w-none px-2 md:px-6 py-4">
      <CefrAlertBanner 
        cards={cards}
        cardsStudiedToday={stats.count}
        minutesStudiedToday={Math.round(stats.minutes + readingStats.minutes)}
      />

      {/* Onboarding Assistant for Absolute Beginners */}
      {(cards === undefined || cards.length < 15) && (
        <ShadcnCard className="bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-card border-2 border-primary/20 p-5 rounded-2xl shadow-xl space-y-4 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-primary/20 text-primary rounded-xl text-md animate-bounce">🎒</span>
            <div className="space-y-0.5">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                Trilha do Iniciante: Como chegar no nível A1?
              </h3>
              <p className="text-[10px] text-muted-foreground font-semibold">
                Você começou agora e não tem cartões para estudar. Siga estes passos simples para iniciar sua jornada:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            <div className="bg-card border border-border/50 p-4 rounded-xl flex flex-col justify-between space-y-2.5">
              <div>
                <p className="text-[9.5px] font-black text-primary uppercase">Passo 1</p>
                <h4 className="font-bold text-[10.5px] text-foreground mt-0.5">Vocabulário A1 Essencial</h4>
                <p className="text-[9px] text-muted-foreground leading-normal font-medium mt-1">
                  Crie o baralho básico de 20 cards offline (saudações e pronomes) para iniciar suas primeiras revisões diárias.
                </p>
              </div>
              {!hasA1Deck ? (
                <Button
                  size="xs"
                  onClick={async () => {
                    await createA1VocabularyDeck();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-zinc-50 font-bold text-[8.5px] h-7 w-full rounded-lg mt-2 cursor-pointer shadow-sm shadow-indigo-500/20"
                >
                  Criar Baralho A1
                </Button>
              ) : (
                <span className="text-[8.5px] font-bold text-emerald-500 flex items-center justify-center gap-1 mt-2.5 bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/25">
                  ✓ Baralho Criado
                </span>
              )}
            </div>

            <div className="bg-card border border-border/50 p-4 rounded-xl flex flex-col justify-between space-y-2.5">
              <div>
                <p className="text-[9.5px] font-black text-primary uppercase">Passo 2</p>
                <h4 className="font-bold text-[10.5px] text-foreground mt-0.5">Primeira Leitura Ativa</h4>
                <p className="text-[9px] text-muted-foreground leading-normal font-medium mt-1">
                  Abra o texto de diálogo simples "Meeting a New Friend (A1)" para ler com tradução e extrair novos cards.
                </p>
              </div>
              <Button
                size="xs"
                onClick={() => {
                  localStorage.setItem('memorize_active_reading_id', 'seed-reading-a1-friend');
                  handleGoToReading();
                }}
                className="bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[8.5px] h-7 w-full rounded-lg mt-2 cursor-pointer border border-primary/25"
              >
                Ler Texto A1
              </Button>
            </div>

            <div className="bg-card border border-border/50 p-4 rounded-xl flex flex-col justify-between space-y-2.5">
              <div>
                <p className="text-[9.5px] font-black text-primary uppercase">Passo 3</p>
                <h4 className="font-bold text-[10.5px] text-foreground mt-0.5">Treino de Memorização (SRS)</h4>
                <p className="text-[9px] text-muted-foreground leading-normal font-medium mt-1">
                  Acesse seus baralhos e revise os cards criados. O sistema usará repetição espaçada para fixar na memória.
                </p>
              </div>
              <div className="text-[8.5px] font-extrabold text-muted-foreground text-center py-2 bg-muted/40 rounded-lg">
                Vá em "Baralhos" para revisar
              </div>
            </div>
          </div>
        </ShadcnCard>
      )}

      {showQuickStart && (
        <ShadcnCard className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/25 p-5 rounded-2xl shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="absolute top-3.5 right-3.5">
            <button
              onClick={() => {
                localStorage.setItem('memorize_hide_quickstart', 'true');
                setShowQuickStart(false);
              }}
              className="text-[9px] font-extrabold text-muted-foreground hover:text-foreground cursor-pointer bg-muted/40 hover:bg-muted/70 px-2.5 py-1.5 rounded-lg border border-border/40 transition-colors"
              title="Entendi e quero ocultar este guia permanentemente"
            >
              Ocultar Guia
            </button>
          </div>
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl text-xs">💡</span>
              <div>
                <h3 className="font-extrabold text-xs text-foreground">Guia de Início: Como funciona a Plataforma?</h3>
                <p className="text-[9.5px] text-muted-foreground font-semibold">Siga estes 4 passos simples para navegar pela sua jornada de proficiência no inglês:</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md">Passo 1</span>
                  <span className="font-extrabold text-[10px] text-foreground">Diagnóstico Inicial</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-normal font-semibold">
                  Converse com o chatbot <strong className="text-foreground">IA Checkpoint</strong> (painel à direita) por 2 min para estimar seu nível atual (A1-C2).
                </p>
              </div>

              <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md">Passo 2</span>
                  <span className="font-extrabold text-[10px] text-foreground">Defina sua Meta</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-normal font-semibold">
                  Clique nos nós da trilha <strong className="text-foreground">A1 a C2</strong> acima, leia as competências e selecione seu nível alvo como <strong className="text-foreground">Meta</strong>.
                </p>
              </div>

              <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md">Passo 3</span>
                  <span className="font-extrabold text-[10px] text-foreground">Estude Vocabulário</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-normal font-semibold">
                  Crie, importe ou gere decks por IA na aba 🗂️ <strong className="text-foreground">Baralhos</strong> e faça suas revisões diárias para acumular vocabulário.
                </p>
              </div>

              <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md">Passo 4</span>
                  <span className="font-extrabold text-[10px] text-foreground">Faça o Exame</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-normal font-semibold">
                  Ao bater a meta de vocabulário de um nível, clique em <strong className="text-foreground">Prestar Exame</strong> para certificar seu avanço no roadmap!
                </p>
              </div>
            </div>
          </div>
        </ShadcnCard>
      )}

      {/* HERO BANNER: Central de Certificação CEFR */}
      <section className="bg-gradient-to-br from-violet-600/10 via-indigo-600/5 to-card border border-border/80 p-5 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <Award className="text-primary animate-pulse" size={20} />
              Central de Certificação CEFR
            </h2>
            <p className="text-[11px] text-muted-foreground font-semibold leading-normal">
              Seu planejamento de proficiência ativa alimentado por repetição espaçada.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!showQuickStart && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('memorize_hide_quickstart');
                  setShowQuickStart(true);
                }}
                className="text-[9.5px] font-extrabold text-indigo-500 hover:text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm h-10.5"
                title="Mostrar Guia de Boas-Vindas"
              >
                <span>💡</span> Como usar?
              </button>
            )}
            <div className="flex items-center gap-2 bg-muted/40 px-3.5 py-2 rounded-xl border border-border/50 text-[10px] font-bold text-foreground h-10.5">
              <div className="space-y-0.5 text-right">
                <span className="text-muted-foreground text-[8px] uppercase font-bold tracking-wider">Jornada</span>
                <p className="font-extrabold">{remainingDays} dias restantes</p>
              </div>
              <div className="w-px h-6 bg-border mx-2" />
              <div className="space-y-0.5 text-left">
                <span className="text-muted-foreground text-[8px] uppercase font-bold tracking-wider">Meta Ativa</span>
                <p className="font-extrabold text-primary">{targetLevel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trilha Horizontal Compacta */}
        <div className="grid grid-cols-6 gap-2 border-t border-border/40 pt-4">
          {levelsKeys.map((lvl, index) => {
            const isCurrent = unlockedLevel === lvl;
            const isTarget = targetLevel === lvl;
            const isLocked = index > levelsKeys.indexOf(unlockedLevel);
            const progress = cefrCounts[lvl] || 0;
            const goal = levelDetailsData[lvl as keyof typeof levelDetailsData].vocabGoal;
            const pct = Math.min(100, Math.round((progress / goal) * 100));

            let nodeClass = "border-border text-muted-foreground hover:border-border/80";
            if (isCurrent) {
              nodeClass = "bg-primary/10 border-primary text-primary ring-1 ring-primary/20";
            } else if (!isLocked) {
              nodeClass = "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
            }

            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedDetailLevel(lvl)}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-between transition-all cursor-pointer relative hover:scale-103 ${
                  selectedDetailLevel === lvl ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-background' : ''
                } ${nodeClass}`}
              >
                {/* Icons / Status Indicators */}
                <div className="absolute top-1 right-1 flex gap-0.5 items-center">
                  {isLocked && <Lock size={7} className="text-muted-foreground/60" />}
                  {isTarget && <span className="text-[5.5px] font-bold bg-primary text-primary-foreground px-0.5 rounded">OBJ</span>}
                </div>

                <span className="text-xs font-black tracking-tight">{lvl}</span>
                <span className="text-[7.5px] font-bold truncate opacity-85 mt-0.5">{pct}%</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Column (lg:col-span-2) - Details Card */}
        {selectedLevelDetails && (
          <ShadcnCard className="lg:col-span-2 bg-card border border-border/60 p-5 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-3 border-b border-border/20 pb-2">
              <div className="space-y-0.5">
                <span className="text-[9px] text-muted-foreground font-extrabold uppercase tracking-wider">
                  Módulo Selecionado
                </span>
                <h4 className="font-extrabold text-sm text-foreground">
                  {selectedLevelDetails.name} • {levelDetailsData[selectedDetailLevel as keyof typeof levelDetailsData].title}
                </h4>
              </div>
              <span className="text-xs font-black text-foreground shrink-0 bg-muted/60 px-2 py-0.5 rounded-lg">
                {activeLevelLearned} / {selectedLevelDetails.vocabGoal} <span className="text-muted-foreground font-semibold">cards</span>
              </span>
            </div>

            {/* Habilidades e Foco Diário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-semibold text-foreground/80 leading-normal py-1">
              <div className="space-y-1.5">
                <span className="text-[8.5px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-emerald-500" /> Competências do Nível
                </span>
                <ul className="list-disc list-inside pl-1 space-y-1 text-foreground/75 font-medium">
                  {selectedLevelDetails.canDo.map((item, i) => (
                    <li key={i} className="truncate" title={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5">
                <span className="text-[8.5px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                  <Compass size={11} className="text-primary" /> Foco de Estudo Recomendado
                </span>
                <p className="text-foreground/75 leading-relaxed font-semibold pl-1">
                  Este nível requer {requirements.dailyMinutesTarget} min de treino de repetição espaçada e {requirements.dailyCardsTarget} novos cards/dia para concluir a meta de {selectedLevelDetails.vocabGoal} cards.
                </p>
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
                                handleGoToReading();
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

            {/* Progress and Exam buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/20 pt-3.5">
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-[8.5px] font-bold text-muted-foreground">
                  <span>Progresso lexical:</span>
                  <span>{activeLevelPercent}%</span>
                </div>
                <Progress value={activeLevelPercent} className="h-1.5 bg-muted/40" />
              </div>

              {(() => {
                const hasEnoughVocab = activeLevelLearned >= selectedLevelDetails.vocabGoal;
                const isExamDisabled = !isSelectedLevelLocked && !hasEnoughVocab;

                return (
                  <div className="flex items-center gap-2.5 shrink-0 justify-end">
                    {!isSelectedLevelLocked && !hasEnoughVocab && (
                      <span className="text-[8.5px] text-amber-500 font-bold max-w-[155px] leading-snug text-right">
                        ⚠️ Estude mais {selectedLevelDetails.vocabGoal - activeLevelLearned} cards do nível para habilitar o exame.
                      </span>
                    )}
                    <Button
                      size="sm"
                      onClick={() => onNavigateToExams(selectedDetailLevel)}
                      disabled={isExamDisabled}
                      className={`h-8 text-[9.5px] font-black rounded-lg px-4 flex items-center gap-1.5 cursor-pointer ${
                        isSelectedLevelLocked
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                    >
                      {isSelectedLevelLocked ? (
                        <>
                          <Sparkles size={11} /> Nivelar-se (Diagnóstico)
                        </>
                      ) : (
                        <>
                          <Award size={11} /> Prestar Exame
                        </>
                      )}
                    </Button>
                  </div>
                );
              })()}
            </div>
          </ShadcnCard>
        )}

        {/* Right Sidebar Column (lg:col-span-1) - Goals & SRS */}
        <div className="lg:col-span-1 space-y-4 flex flex-col justify-start">
          
          {/* Spaced Repetition Meta Widget */}
          <ShadcnCard className="bg-card/40 border border-border/60 p-4 rounded-xl shadow-sm space-y-2.5">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-foreground">
              <span className="flex items-center gap-1.5">🎯 Meta Diária SRS</span>
              <span>{stats.count} / {dailyGoal} cards</span>
            </div>
            <Progress value={Math.min(100, Math.round((stats.count / dailyGoal) * 100))} className="h-1.5 bg-muted/40" />
            <div className="flex justify-between text-[8px] text-muted-foreground font-bold uppercase tracking-wider">
              <span>Novos: {totalNew}</span>
              <span>Revisões: {totalDue}</span>
              <span>Consolidados: {totalLearned}</span>
            </div>
          </ShadcnCard>

          {/* Reading Stats Widget */}
          <ShadcnCard className="bg-card/40 border border-border/60 p-4 rounded-xl shadow-sm space-y-2 text-[10px] font-bold text-foreground">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-foreground">
              <span className="flex items-center gap-1.5">📖 Prática de Leitura</span>
              {readingStats.minutes === 0 && (
                <Button
                  onClick={handleGoToReading}
                  variant="outline"
                  size="sm"
                  className="text-[8px] h-5.5 font-bold border-border bg-card/60 hover:bg-muted text-foreground cursor-pointer rounded px-1.5"
                >
                  Ir
                </Button>
              )}
            </div>
            {readingStats.minutes > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-center text-[9px] pt-1">
                <div className="bg-muted/20 border border-border/20 px-2 py-0.5 rounded-md">
                  <span className="text-primary">{readingStats.minutes} min</span>
                </div>
                <div className="bg-muted/20 border border-border/20 px-2 py-0.5 rounded-md">
                  <span className="text-primary">{readingStats.wordsRead} pal.</span>
                </div>
              </div>
            ) : (
              <p className="text-[8.5px] text-muted-foreground/80 font-medium italic pl-0.5">
                Consolide seu vocabulário praticando leitura no Reader.
              </p>
            )}
          </ShadcnCard>
        </div>

      </div>
    </div>
  );
};
