import React, { useState, useEffect } from 'react';
import { Target, Compass, Award, CheckCircle2, Sparkles, MessageSquare, RefreshCw } from 'lucide-react';
import { Card as ShadcnCard } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import { db } from '../db/db';
import { classifyLocal, classifyWithGemini } from '../utils/cefrClassifier';
import { toast } from 'sonner';

interface CefrPageProps {
  geminiApiKey: string;
}

interface LevelDetails {
  title: string;
  name: string;
  vocabGoal: number;
  canDo: string[];
  grammar: string[];
  recommendation: string;
}

const levelDetailsData: Record<string, LevelDetails> = {
  'A1': {
    title: 'Iniciante',
    name: 'A1 - Breakthrough',
    vocabGoal: 500,
    canDo: [
      'Compreender e usar expressões familiares e cotidianas para satisfazer necessidades básicas.',
      'Apresentar-se e fazer perguntas simples sobre si mesmo (onde mora, quem conhece, coisas que possui).',
      'Interagir de forma simples se a outra pessoa falar devagar e de maneira clara.'
    ],
    grammar: [
      'Verbo To Be (Present Simple)',
      'Pronomes Pessoais e Possessivos',
      'Artigos definidos e indefinidos (a, an, the)',
      'Preposições básicas de tempo e lugar (in, on, at)',
      'Plural dos substantivos regulares e imperativo simples'
    ],
    recommendation: 'Foques em criar álbuns de áudio curtos e ler textos infantis ou diálogos simples de nível iniciante no Reader.'
  },
  'A2': {
    title: 'Básico',
    name: 'A2 - Waystage',
    vocabGoal: 1000,
    canDo: [
      'Compreender frases e expressões frequentes sobre áreas de relevância direta (compras, emprego, geografia local).',
      'Comunicar-se em tarefas simples e rotineiras que exijam apenas troca direta de informações.',
      'Descrever de forma simples aspectos do seu passado, ambiente imediato e assuntos de necessidade imediata.'
    ],
    grammar: [
      'Past Simple (verbos regulares e irregulares)',
      'Future with "going to" and "will"',
      'Comparativos e superlativos (ex: taller than, the best)',
      'Adverbios de frequência (always, often, rarely)',
      'Verbos modais básicos (can, could, should)'
    ],
    recommendation: 'Aproveite histórias curtas com áudio no Reader e tente traduzir expressões de duas ou mais palavras.'
  },
  'B1': {
    title: 'Intermediário I',
    name: 'B1 - Threshold',
    vocabGoal: 2000,
    canDo: [
      'Compreender os pontos principais de assuntos familiares sobre trabalho, escola, lazer, etc.',
      'Lidar com a maioria das situações que podem surgir durante uma viagem em um local onde o idioma é falado.',
      'Produzir textos simples e coerentes sobre temas de interesse pessoal ou de experiências, sonhos e ambições.'
    ],
    grammar: [
      'Present Perfect Simple (ex: I have traveled)',
      'Past Continuous vs Past Simple',
      'Condicionais Zero, Primeira e Segunda (if clauses)',
      'Voz passiva em tempos simples (ex: it is made)',
      'Modais de obrigação e permissão (must, have to, might)'
    ],
    recommendation: 'Use o Modo Ditado nas playlists para treinar a distinção de sons e leia notícias no Reader.'
  },
  'B2': {
    title: 'Intermediário II',
    name: 'B2 - Vantage',
    vocabGoal: 4000,
    canDo: [
      'Compreender as ideias principais de textos complexos sobre temas concretos e abstratos, incluindo discussões técnicas.',
      'Interagir com nativos com um grau de fluência e espontaneidade sem tensão para nenhuma das partes.',
      'Produzir textos claros e detalhados sobre uma ampla variedade de temas e defender opiniões expondo prós e contras.'
    ],
    grammar: [
      'Past Perfect Simple (ex: I had seen)',
      'Terceira condicional (ex: If I had known, I would have...)',
      'Voz passiva avançada (formas contínuas e modais)',
      'Discurso Indireto (Reported Speech)',
      'Orações Relativas (Relative Clauses)'
    ],
    recommendation: 'Tente desativar as traduções nas playlists e assista/ouça palestras. Crie cards de frases inteiras com phrasal verbs.'
  },
  'C1': {
    title: 'Avançado',
    name: 'C1 - Effective Operational Proficiency',
    vocabGoal: 8000,
    canDo: [
      'Compreender uma ampla variedade de textos longos e exigentes, reconhecendo sentidos implícitos.',
      'Expressar-se de forma fluida e espontânea sem precisar buscar palavras de forma muito óbvia.',
      'Usar o idioma de maneira flexível e eficaz para fins sociais, acadêmicos e profissionais.'
    ],
    grammar: [
      'Condicionais mistas (ex: If I had studied, I would be rich now)',
      'Inversões com advérbios negativos (ex: Seldom have I seen...)',
      'Cleft sentences para ênfase (ex: What I need is a break)',
      'Formas modais perfeitas (ex: should have done, must have been)',
      'Conectores e marcadores de discurso sofisticados'
    ],
    recommendation: 'Leia livros de literatura, artigos científicos e podcasts nativos complexos. Adicione expressões idiomáticas raras aos cards.'
  },
  'C2': {
    title: 'Proficiente',
    name: 'C2 - Mastery',
    vocabGoal: 12000,
    canDo: [
      'Compreender com facilidade praticamente tudo o que ouve ou lê.',
      'Resumir informações de diferentes fontes orais e escritas, reconstruindo argumentos e relatos de forma coerente.',
      'Expressar-se espontaneamente, de forma muito fluida e precisa, distinguindo finas nuances de significado.'
    ],
    grammar: [
      'Uso idiomático total e expressões coloquiais complexas',
      'Modo subjuntivo e estruturas hipotéticas avançadas',
      'Duplas inversões e jogos estilísticos na escrita',
      'Domínio completo de gírias, jargões profissionais e sotaques variados'
    ],
    recommendation: 'Pratique debates livres, escreva redações complexas sobre tópicos abstratos e foque em falar no mesmo ritmo e entonação de um nativo.'
  }
};

export const CefrPage: React.FC<CefrPageProps> = ({ geminiApiKey }) => {
  const [cefrCounts, setCefrCounts] = useState<Record<string, number>>({
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0
  });
  const [totalLearned, setTotalLearned] = useState(0);
  const [estimatedLevelCode, setEstimatedLevelCode] = useState('Iniciante');
  const [targetLevel, setTargetLevel] = useState<string>(() => {
    return localStorage.getItem('memorize_cefr_target_level') || 'B2';
  });
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<string>('B2');

  // AI Checkpoint (Diagnostic) States
  const [chatActive, setChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  useEffect(() => {
    const analyzeCards = async () => {
      try {
        const allCards = await db.cards.toArray();
        const studied = allCards.filter(c => c.repetitions > 0 || c.interval > 0);
        setTotalLearned(studied.length);

        const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
        const unclassified: typeof studied = [];

        for (const card of studied) {
          if (card.cefrLevel) {
            counts[card.cefrLevel as keyof typeof counts]++;
          } else {
            const localLvl = classifyLocal(card.front);
            if (localLvl) {
              card.cefrLevel = localLvl;
              counts[localLvl]++;
              await db.cards.update(card.id, { cefrLevel: localLvl });
            } else {
              unclassified.push(card);
            }
          }
        }

        setCefrCounts({ ...counts });
        calculateEstimatedLevel(counts);

        // Background update using Gemini
        const apiKey = localStorage.getItem('memorize_gemini_api_key') || geminiApiKey || '';
        if (apiKey.trim() && unclassified.length > 0) {
          const batch = unclassified.slice(0, 15);
          const words = batch.map(c => c.front.toLowerCase());
          const resolvedMap = await classifyWithGemini(words, apiKey);
          
          let updatedAny = false;
          for (const card of batch) {
            const key = card.front.toLowerCase();
            const resolvedLvl = resolvedMap[key];
            if (resolvedLvl) {
              card.cefrLevel = resolvedLvl;
              counts[resolvedLvl as keyof typeof counts]++;
              await db.cards.update(card.id, { cefrLevel: resolvedLvl });
              updatedAny = true;
            }
          }

          if (updatedAny) {
            setCefrCounts({ ...counts });
            calculateEstimatedLevel(counts);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    analyzeCards();
  }, [geminiApiKey]);

  const calculateEstimatedLevel = (counts: Record<string, number>) => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    let est = 'Iniciante';
    for (let i = levels.length - 1; i >= 0; i--) {
      const lvl = levels[i];
      if (counts[lvl] >= 3) {
        est = lvl;
        break;
      }
    }
    setEstimatedLevelCode(est);
  };

  const handleSelectTarget = (level: string) => {
    setTargetLevel(level);
    localStorage.setItem('memorize_cefr_target_level', level);
    toast.success(`Nova meta definida: Nível ${level}!`);
  };

  // AI Diagnostic Chat Handlers
  const startAiCheckpoint = async () => {
    const apiKey = localStorage.getItem('memorize_gemini_api_key') || geminiApiKey || '';
    if (!apiKey.trim()) {
      toast.error('Configure uma chave de API do Gemini nas Configurações para usar esta ferramenta.');
      return;
    }

    setChatActive(true);
    setChatMessages([]);
    setUserInput('');
    setQuestionCount(0);
    setAiAnalysis(null);
    setChatLoading(true);

    const initialPrompt = `Você é um examinador especialista no Quadro Europeu Comum (CEFR) para línguas. 
Inicie um teste diagnóstico interativo e rápido para avaliar o nível de inglês do usuário.
Você fará de 4 a 5 perguntas curtas, uma por vez, aumentando a dificuldade a cada resposta.
Mantenha suas perguntas em inglês de forma limpa, direta e curta.
Primeira instrução: Comece se apresentando brevemente em português, e em seguida faça a primeira pergunta diagnóstico em inglês em um nível intermediário básico (A2/B1) perguntando sobre a rotina dele ou um interesse simples.`;

    try {
      const responseText = await queryGeminiDirect(initialPrompt, apiKey);
      setChatMessages([{ role: 'ai', text: responseText }]);
      setQuestionCount(1);
    } catch (err) {
      toast.error('Erro ao iniciar chat com a IA.');
    } finally {
      setChatLoading(false);
    }
  };

  const sendUserResponse = async () => {
    const apiKey = localStorage.getItem('memorize_gemini_api_key') || geminiApiKey || '';
    if (!userInput.trim() || chatLoading) return;

    const userText = userInput.trim();
    const updatedMessages = [...chatMessages, { role: 'user' as const, text: userText }];
    setChatMessages(updatedMessages);
    setUserInput('');
    setChatLoading(true);

    let nextPrompt = "";
    if (questionCount < 4) {
      nextPrompt = `Aqui está o histórico do diálogo diagnóstico:
${JSON.stringify(updatedMessages)}

O usuário respondeu: "${userText}".
Avalie a complexidade gramatical e vocabulário da resposta. Faça a pergunta número ${questionCount + 1} em inglês, adaptando a dificuldade para um nível superior se ele foi muito bem, ou inferior/igual se ele errou muito ou deu uma resposta curta. Seja breve na pergunta.`;
      
      try {
        const aiText = await queryGeminiDirect(nextPrompt, apiKey);
        setChatMessages(prev => [...prev, { role: 'ai', text: aiText }]);
        setQuestionCount(prev => prev + 1);
      } catch (err) {
        toast.error('Erro ao enviar mensagem à IA.');
      } finally {
        setChatLoading(false);
      }
    } else {
      // Final analysis prompt
      nextPrompt = `Aqui está o histórico completo do teste diagnóstico de nível CEFR:
${JSON.stringify(updatedMessages)}

Analise criticamente as respostas do usuário sob a ótica do CEFR (A1, A2, B1, B2, C1, C2).
Gere um relatório estruturado de veredicto final.
Escreva em Português do Brasil com a seguinte estrutura:
1. **Nível Sugerido**: [A1/A2/B1/B2/C1/C2] - Nome do Nível
2. **Pontos Fortes**: (O que ele usou de bom: vocabulário, tempos verbais, coerência)
3. **Pontos de Melhoria**: (Onde ele errou ou demonstrou limitação de estruturas)
4. **Recomendação de Estudo**: (Qual a melhor estratégia no Memorize para ele avançar de nível)

Seja direto, empático e focado no aprendizado.`;

      try {
        const analysisResult = await queryGeminiDirect(nextPrompt, apiKey);
        setAiAnalysis(analysisResult);
      } catch (err) {
        toast.error('Erro ao gerar análise de nível.');
      } finally {
        setChatLoading(false);
      }
    }
  };

  const queryGeminiDirect = async (promptText: string, apiKey: string): Promise<string> => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      }
    );

    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };

  // Math for roadmap nodes
  const levelsKeys = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const currentIdx = levelsKeys.indexOf(estimatedLevelCode);
  const targetIdx = levelsKeys.indexOf(targetLevel);

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto px-2 md:px-6 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm">
              <Target size={24} />
            </div>
            Jornada de Proficiência CEFR
          </h2>
          <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
            Trace seus objetivos no inglês, acompanhe seu vocabulário por categoria e teste seu nível com nosso examinador de IA.
          </p>
        </div>
      </div>

      {/* Mini Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ShadcnCard className="bg-card border-border/60 p-4 rounded-xl shadow-md flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
            <Award size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Nível Atual Estimado</p>
            <p className="text-sm font-black text-foreground">
              {estimatedLevelCode === 'Iniciante' ? 'Iniciante (A0)' : `${estimatedLevelCode} - ${levelDetailsData[estimatedLevelCode]?.title || ''}`}
            </p>
          </div>
        </ShadcnCard>

        <ShadcnCard className="bg-card border-border/60 p-4 rounded-xl shadow-md flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg shrink-0">
            <Target size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Meta de Proficiência</p>
            <p className="text-sm font-black text-foreground">
              {targetLevel} - {levelDetailsData[targetLevel]?.title || ''}
            </p>
          </div>
        </ShadcnCard>

        <ShadcnCard className="bg-card border-border/60 p-4 rounded-xl shadow-md flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/10 text-violet-500 rounded-lg shrink-0">
            <Compass size={20} />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total de Frases Estudadas</p>
            <p className="text-sm font-black text-foreground">{totalLearned} cartas</p>
          </div>
        </ShadcnCard>
      </div>

      {/* Grid: Roadmap do Aluno */}
      <ShadcnCard className="bg-card border-border/60 p-5 rounded-2xl shadow-xl space-y-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-2">
          <Compass className="text-primary shrink-0" size={16} />
          <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
            Mapa de Progresso no Idioma
          </h3>
        </div>

        {/* Nodes do Roadmap */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 relative">
          {levelsKeys.map((lvl, index) => {
            const isCurrent = estimatedLevelCode === lvl;
            const isTarget = targetLevel === lvl;
            
            // Check status
            let statusClass = "bg-muted/40 border-border text-muted-foreground";
            if (index <= currentIdx) {
              // Mastered / Current level
              statusClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/15";
            } else if (index <= targetIdx) {
              // Level to reach
              statusClass = "bg-primary/10 border-primary/30 text-primary ring-2 ring-primary/15";
            }

            const details = levelDetailsData[lvl];

            return (
              <div 
                key={lvl}
                onClick={() => setSelectedDetailLevel(lvl)}
                className={`p-4 rounded-xl border flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-300 relative hover:scale-105 hover:shadow-md ${
                  selectedDetailLevel === lvl ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-background scale-102' : ''
                } ${statusClass}`}
              >
                {/* Node Status Indicators */}
                <div className="absolute top-1.5 right-1.5 flex gap-1">
                  {isCurrent && (
                    <span className="text-[7px] font-black uppercase bg-emerald-500 text-white px-1 py-0.2 rounded" title="Nível atual estimado">VOCÊ</span>
                  )}
                  {isTarget && (
                    <span className="text-[7px] font-black uppercase bg-primary text-white px-1 py-0.2 rounded" title="Seu objetivo">META</span>
                  )}
                </div>

                <span className="text-lg font-black tracking-tight">{lvl}</span>
                <span className="text-[9px] font-extrabold truncate w-full mt-1">{details.title}</span>
                
                {/* Micro Progress Bar inside each level */}
                <div className="w-full mt-3.5 space-y-1">
                  <div className="flex justify-between text-[7.5px] font-bold opacity-80">
                    <span>{cefrCounts[lvl] || 0}/{details.vocabGoal}</span>
                    <span>{Math.min(100, Math.round(((cefrCounts[lvl] || 0) / details.vocabGoal) * 100))}%</span>
                  </div>
                  <Progress 
                    value={((cefrCounts[lvl] || 0) / details.vocabGoal) * 100} 
                    className="h-1 bg-muted" 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ShadcnCard>

      {/* Seção Principal de Detalhes e Ações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Painel Esquerdo: Detalhes do Nível Selecionado (2 colunas no desktop) */}
        <div className="lg:col-span-2 space-y-4 flex flex-col">
          <ShadcnCard className="bg-card border-border/60 p-5 rounded-2xl shadow-xl flex-1 flex flex-col justify-between">
            {(() => {
              const details = levelDetailsData[selectedDetailLevel];
              const progressCount = cefrCounts[selectedDetailLevel] || 0;
              const percent = Math.min(100, Math.round((progressCount / details.vocabGoal) * 100));

              return (
                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="space-y-0.5">
                      <h4 className="font-black text-sm text-foreground uppercase tracking-wider">
                        {details.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-semibold">
                        Vocabulário meta: {details.vocabGoal} termos e frases
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSelectTarget(selectedDetailLevel)}
                        disabled={targetLevel === selectedDetailLevel}
                        className="h-8 text-[9px] font-bold rounded-lg px-3.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                      >
                        {targetLevel === selectedDetailLevel ? 'Sua Meta Definida' : 'Definir como Meta'}
                      </Button>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 py-1">
                    {/* Can Do Statements */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 size={11} className="text-emerald-500" /> O que você consegue fazer:
                      </h5>
                      <ul className="space-y-2 pl-1.5">
                        {details.canDo.map((item, i) => (
                          <li key={i} className="text-[10.5px] leading-relaxed text-foreground/85 font-medium flex items-start gap-2">
                            <span className="text-primary mt-1 select-none font-bold">&rarr;</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Gramática Recomendada */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Award size={11} className="text-amber-500" /> Gramática Recomendada:
                      </h5>
                      <ul className="space-y-2 pl-1.5">
                        {details.grammar.map((item, i) => (
                          <li key={i} className="text-[10.5px] leading-relaxed text-foreground/85 font-medium flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recomendação de Estudo */}
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1 mt-2">
                    <p className="text-[9px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                      <Sparkles size={9} /> Dica de Estudo no Memorize:
                    </p>
                    <p className="text-[10px] text-foreground/90 font-semibold leading-relaxed">
                      {details.recommendation}
                    </p>
                  </div>

                  {/* Barra de Progresso do Nível */}
                  <div className="pt-2 border-t border-border/40 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-muted-foreground">Progresso lexical neste nível:</span>
                      <span className="text-foreground">{progressCount} / {details.vocabGoal} cartas ({percent}%)</span>
                    </div>
                    <Progress value={percent} className="h-2 bg-muted/60" />
                  </div>
                </div>
              );
            })()}
          </ShadcnCard>
        </div>

        {/* Painel Direito: Checkpoint de IA (Diagnóstico) */}
        <div className="lg:col-span-1">
          <ShadcnCard className="bg-card border-border/60 p-5 rounded-2xl shadow-xl flex flex-col justify-between h-full min-h-[400px]">
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="space-y-0.5">
                  <h4 className="font-black text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} className="text-primary animate-pulse" /> IA Checkpoint
                  </h4>
                  <p className="text-[9px] text-muted-foreground font-semibold">
                    Avaliação rápida de conversação via Gemini
                  </p>
                </div>
              </div>

              {!chatActive ? (
                /* Tela Inicial de Convite */
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <div className="p-3 bg-muted/50 rounded-2xl border border-border/30 shadow-inner">
                    <MessageSquare size={28} className="text-primary/75 animate-bounce" />
                  </div>
                  <div className="space-y-1.5 max-w-[220px]">
                    <p className="text-xs font-black text-foreground">Teste seu Nível com a IA</p>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Um diálogo diagnóstico de 4 perguntas em inglês para estimar sua proficiência exata no CEFR.
                    </p>
                  </div>
                  <Button
                    onClick={startAiCheckpoint}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-[10px] h-8.5 rounded-lg px-4 cursor-pointer flex items-center gap-1.5"
                  >
                    Começar Avaliação
                  </Button>
                </div>
              ) : aiAnalysis ? (
                /* Tela de Análise Final do Diagnostic */
                <div className="flex-1 flex flex-col justify-between space-y-4 overflow-y-auto pr-1 max-h-[320px] scrollbar-thin">
                  <div className="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl space-y-1.5">
                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={13} /> Veredito de Proficiência
                    </p>
                    <div className="text-[10px] leading-relaxed font-semibold text-foreground/90 whitespace-pre-wrap">
                      {aiAnalysis}
                    </div>
                  </div>

                  <Button
                    onClick={startAiCheckpoint}
                    variant="outline"
                    className="w-full text-[9px] font-black h-8 border-border/60 hover:bg-muted text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} /> Reiniciar Teste
                  </Button>
                </div>
              ) : (
                /* Chat Ativo */
                <div className="flex-1 flex flex-col justify-between min-h-0 space-y-3">
                  {/* Área do Chat Rolável */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[240px] flex flex-col scrollbar-thin py-1">
                    {chatMessages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`max-w-[85%] rounded-xl p-2.5 text-[9.5px] font-semibold leading-relaxed ${
                          msg.role === 'ai' 
                            ? 'bg-muted/60 text-foreground border border-border/40 self-start rounded-tl-none' 
                            : 'bg-primary text-primary-foreground self-end rounded-tr-none shadow-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="bg-muted/40 text-muted-foreground border border-border/30 rounded-xl p-2.5 text-[9.5px] font-semibold italic animate-pulse self-start">
                        Examinador digitando...
                      </div>
                    )}
                  </div>

                  {/* Input do Chat */}
                  <div className="flex items-center gap-1.5 border-t border-border/40 pt-2 shrink-0">
                    <input
                      type="text"
                      disabled={chatLoading}
                      placeholder={questionCount >= 4 ? "Digite sua última resposta..." : "Responda à pergunta da IA..."}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendUserResponse(); }}
                      className="flex-1 bg-muted/40 border border-transparent hover:border-border/60 focus:border-primary text-foreground text-[10px] h-8.5 rounded-xl px-3 outline-none font-semibold transition-all"
                    />
                    <Button
                      size="sm"
                      onClick={sendUserResponse}
                      disabled={!userInput.trim() || chatLoading}
                      className="bg-primary hover:bg-primary/95 text-primary-foreground font-black text-[9px] h-8 rounded-lg cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      {questionCount >= 4 ? 'Finalizar' : 'Responder'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ShadcnCard>
        </div>

      </div>
    </div>
  );
};
