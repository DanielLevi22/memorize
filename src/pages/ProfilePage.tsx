import React, { useState, useEffect } from 'react';
import { Plus, Flame, Trophy, Sparkles, Award, Loader2, CheckCircle2 } from 'lucide-react';
import { Card as ShadcnCard } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { db } from '../db/db';
import { classifyLocal, classifyWithGemini } from '../utils/cefrClassifier';
import { useAI } from '../services/ai/AIContext';

interface ProfilePageProps {
  streak: number;
  userLevel: number;
  earnedXp: number;
  xpNeededForNextLevel: number;
  totalRevisionsCount: number;
  decksCount: number;
  userName: string;
  userPhoto: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  streak,
  userLevel,
  earnedXp,
  xpNeededForNextLevel,
  totalRevisionsCount,
  decksCount,
  userName,
  userPhoto
}) => {
  const { aiService, aiProvider, geminiApiKey } = useAI();
  const [cefrCounts, setCefrCounts] = useState<Record<string, number>>({
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0
  });
  const [totalLearned, setTotalLearned] = useState(0);
  const [estimatedLevel, setEstimatedLevel] = useState('Iniciante');
  const [estimatedLevelCode, setEstimatedLevelCode] = useState('-');

  const [totalCards, setTotalCards] = useState(0);
  const [classifiedCards, setClassifiedCards] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');

  useEffect(() => {
    const analyzeCards = async () => {
      try {
        setIsAnalyzing(true);
        setAnalysisStatus("Lendo cartões do banco de dados...");
        
        const allCards = await db.cards.toArray();
        setTotalCards(allCards.length);

        // 1. Process local classification for ALL unclassified cards in DB
        let classifiedLocalCount = 0;
        const unclassifiedAll: typeof allCards = [];

        for (const card of allCards) {
          if (!card.cefrLevel) {
            const localLvl = classifyLocal(card.front);
            if (localLvl) {
              card.cefrLevel = localLvl;
              await db.cards.update(card.id, { cefrLevel: localLvl });
              classifiedLocalCount++;
            } else {
              unclassifiedAll.push(card);
            }
          }
        }

        // Update counts of classified cards
        let currentClassified = allCards.filter(c => c.cefrLevel).length;
        setClassifiedCards(currentClassified);

        // Cards marked as learned (at least 1 success repetition or active interval)
        const studied = allCards.filter(c => c.repetitions > 0 || c.interval > 0);
        setTotalLearned(studied.length);

        const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
        for (const card of studied) {
          if (card.cefrLevel) {
            counts[card.cefrLevel as keyof typeof counts]++;
          }
        }

        // Set counts from local/cached classification first
        setCefrCounts({ ...counts });
        updateEstimatedLevelState(counts);

        // 2. Background query for remaining unclassified cards via AI (if configured)
        const hasAI = aiProvider === 'ollama' || geminiApiKey.trim().length > 0;
        if (hasAI && unclassifiedAll.length > 0) {
          const providerName = aiProvider === 'ollama' ? 'Ollama' : 'Gemini';
          setAnalysisStatus(`Analisando com I.A. ${providerName} (${unclassifiedAll.length} pendentes)...`);
          
          // Take first 20 unclassified cards to avoid huge prompts
          const batch = unclassifiedAll.slice(0, 20);
          const wordsToClassify = batch.map(c => c.front.toLowerCase());
          
          const resolvedMap = await classifyWithGemini(wordsToClassify, aiService);
          
          let updatedAny = false;
          for (const card of batch) {
            const wordKey = card.front.toLowerCase();
            const resolvedLvl = resolvedMap[wordKey];
            if (resolvedLvl) {
              card.cefrLevel = resolvedLvl;
              if (card.repetitions > 0 || card.interval > 0) {
                counts[resolvedLvl as keyof typeof counts]++;
              }
              await db.cards.update(card.id, { cefrLevel: resolvedLvl });
              updatedAny = true;
            }
          }
          
          if (updatedAny) {
            setCefrCounts({ ...counts });
            updateEstimatedLevelState(counts);
            currentClassified = (await db.cards.toArray()).filter(c => c.cefrLevel).length;
            setClassifiedCards(currentClassified);
          }
        }
      } catch (err) {
        console.error("CEFR calculation error:", err);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeCards();
  }, []);

  const updateEstimatedLevelState = (counts: Record<string, number>) => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const descriptions: Record<string, string> = {
      'A1': 'Iniciante (A1)',
      'A2': 'Básico (A2)',
      'B1': 'Intermediário I (B1)',
      'B2': 'Intermediário II (B2)',
      'C1': 'Avançado (C1)',
      'C2': 'Proficiente (C2)',
      'Iniciante': 'Iniciante'
    };

    let est = 'Iniciante';
    // If user has at least 3 cards in a category, that represents their current active ceiling
    for (let i = levels.length - 1; i >= 0; i--) {
      const lvl = levels[i];
      if (counts[lvl] >= 3) {
        est = lvl;
        break;
      }
    }
    setEstimatedLevel(descriptions[est]);
    setEstimatedLevelCode(est === 'Iniciante' ? '-' : est);
  };

  return (
    <div className="space-y-6 w-full max-w-none px-2 md:px-6">
      {/* Perfil Compacto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-none">
        <ShadcnCard className="bg-card border-border p-4 text-center flex flex-row items-center gap-4 rounded-2xl shadow-sm md:col-span-1 justify-center md:justify-start">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-border shadow-md shrink-0 bg-muted flex items-center justify-center">
            {userPhoto ? (
              <img src={userPhoto} alt={userName} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center font-black text-xl text-zinc-50 rounded-full">
                {userName ? userName.charAt(0).toUpperCase() : '👤'}
              </div>
            )}
          </div>
          <div className="text-left space-y-0.5">
            {userName && (
              <h3 className="font-extrabold text-sm text-foreground">{userName}</h3>
            )}
            <div className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full inline-block">
              Nível {userLevel} • {earnedXp} XP
            </div>
          </div>
        </ShadcnCard>

        {/* Barra de Progresso de Nível Compacta */}
        <ShadcnCard className="bg-card border-border p-4 flex flex-col justify-center gap-1.5 rounded-2xl shadow-sm md:col-span-2">
          <Progress value={earnedXp % 100} className="h-2 bg-muted" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
            <span>{earnedXp % 100} / 100 XP</span>
            <span>Falta {xpNeededForNextLevel} XP para Nív. {userLevel + 1}</span>
          </div>
        </ShadcnCard>
      </div>

      {/* Nível de Proficiência CEFR */}
      <div className="max-w-none space-y-3">
        <h2 className="font-extrabold text-sm text-foreground tracking-tight flex items-center gap-2">
          <Award size={16} className="text-primary" /> Proficiência Vocabular (CEFR)
        </h2>

        <ShadcnCard className="bg-card/45 backdrop-blur-md border-border/60 p-5 rounded-2xl shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Bloco de Destaque do Nível */}
            <div className="flex flex-col items-center justify-center text-center p-4 bg-muted/20 border border-border/30 rounded-xl space-y-2.5 h-full">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">
                Nível Estimado
              </span>
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-black text-2xl shadow-inner animate-pulse">
                {estimatedLevelCode}
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-black text-foreground">
                  {estimatedLevel}
                </p>
                <p className="text-[9px] text-muted-foreground font-bold">
                  {totalLearned} frases/termos aprendidos
                </p>
              </div>
            </div>

            {/* Progresso por Categoria CEFR */}
            <div className="md:col-span-2 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* A1 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-foreground">A1 (Básico I)</span>
                    <span className="text-muted-foreground">{cefrCounts.A1} cartas</span>
                  </div>
                  <Progress value={totalLearned > 0 ? (cefrCounts.A1 / totalLearned) * 100 : 0} className="h-1.5 bg-muted/60" />
                </div>

                {/* A2 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-foreground">A2 (Básico II)</span>
                    <span className="text-muted-foreground">{cefrCounts.A2} cartas</span>
                  </div>
                  <Progress value={totalLearned > 0 ? (cefrCounts.A2 / totalLearned) * 100 : 0} className="h-1.5 bg-muted/60" />
                </div>

                {/* B1 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-foreground">B1 (Intermediário I)</span>
                    <span className="text-muted-foreground">{cefrCounts.B1} cartas</span>
                  </div>
                  <Progress value={totalLearned > 0 ? (cefrCounts.B1 / totalLearned) * 100 : 0} className="h-1.5 bg-muted/60" />
                </div>

                {/* B2 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-foreground">B2 (Intermediário II)</span>
                    <span className="text-muted-foreground">{cefrCounts.B2} cartas</span>
                  </div>
                  <Progress value={totalLearned > 0 ? (cefrCounts.B2 / totalLearned) * 100 : 0} className="h-1.5 bg-muted/60" />
                </div>

                {/* C1 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-foreground">C1 (Avançado I)</span>
                    <span className="text-muted-foreground">{cefrCounts.C1} cartas</span>
                  </div>
                  <Progress value={totalLearned > 0 ? (cefrCounts.C1 / totalLearned) * 100 : 0} className="h-1.5 bg-muted/60" />
                </div>

                {/* C2 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-foreground">C2 (Avançado II)</span>
                    <span className="text-muted-foreground">{cefrCounts.C2} cartas</span>
                  </div>
                  <Progress value={totalLearned > 0 ? (cefrCounts.C2 / totalLearned) * 100 : 0} className="h-1.5 bg-muted/60" />
                </div>
              </div>
              <p className="text-[8.5px] text-muted-foreground font-semibold leading-normal">
                * As estimativas são baseadas nas cartas do seu baralho em que você já realizou revisões bem-sucedidas. Cartas novas ou em fase de re-aprendizado não são contabilizadas.
              </p>
            </div>

            {/* Status da Análise em Background */}
            <div className="md:col-span-3 border-t border-border/30 pt-4 mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[10px]">
              <div className="flex items-center gap-2 text-muted-foreground font-bold">
                {isAnalyzing ? (
                  <>
                    <Loader2 size={13} className="text-primary animate-spin shrink-0" />
                    <span>{analysisStatus}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    <span>Análise de complexidade concluída. {classifiedCards} de {totalCards} cartas analisadas.</span>
                  </>
                )}
              </div>
              
              {/* Barra de Progresso de Classificação */}
              {totalCards > 0 && classifiedCards < totalCards && (
                <div className="flex items-center gap-2 w-full sm:max-w-[200px]">
                  <Progress value={(classifiedCards / totalCards) * 100} className="h-1 bg-muted flex-1" />
                  <span className="font-bold text-foreground text-[9px] whitespace-nowrap">
                    {Math.round((classifiedCards / totalCards) * 100)}%
                  </span>
                </div>
              )}
            </div>

          </div>
        </ShadcnCard>
      </div>

      {/* Seção Conquistas */}
      <div className="space-y-3 max-w-none border-t border-border/40 pt-6">
        <h2 className="font-extrabold text-sm text-foreground tracking-tight">🏅 Minhas Conquistas</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {/* Badge 1 */}
          <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
            decksCount > 0 ? '' : 'opacity-40'
          }`}>
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
              <Plus size={18} />
            </div>
            <span className="font-bold text-xs text-foreground">Primeiro Deck</span>
            <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Criou o seu primeiro deck local</span>
          </div>

          {/* Badge 2 */}
          <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
            streak > 0 ? '' : 'opacity-40'
          }`}>
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
              <Flame size={18} />
            </div>
            <span className="font-bold text-xs text-foreground">Hábito de Estudo</span>
            <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Completou 1 dia de ofensiva</span>
          </div>

          {/* Badge 3 */}
          <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
            totalRevisionsCount >= 5 ? '' : 'opacity-40'
          }`}>
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
              <Trophy size={18} />
            </div>
            <span className="font-bold text-xs text-foreground">Foco de Aço</span>
            <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Revisou mais de 5 cartões</span>
          </div>

          {/* Badge 4 */}
          <div className="p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors opacity-40 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
              <Sparkles size={18} />
            </div>
            <span className="font-bold text-xs text-muted-foreground">Mestre</span>
            <span className="text-[10px] text-muted-foreground/60 font-semibold leading-snug">Memorizou mais de 100 cards</span>
          </div>
        </div>
      </div>
    </div>
  );
};
