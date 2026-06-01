import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Volume2, BookOpen, Headphones, PenTool, Award, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import type { CefrExam, CefrExamAttempt } from '../types';
import { toast } from 'sonner';
import { calculateExamScore, getPassingCut } from '../utils/cefrExamHelper';
import { evaluateWritingWithGemini } from '../utils/cefrWritingEvaluator';

interface ExamArenaPageProps {
  exam: CefrExam;
  onSubmitAttempt: (attempt: Omit<CefrExamAttempt, 'id' | 'timestamp'>) => Promise<void>;
  onClose: () => void;
  geminiApiKey?: string;
}

export const ExamArenaPage: React.FC<ExamArenaPageProps> = ({
  exam,
  onSubmitAttempt,
  onClose,
  geminiApiKey = ''
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Instruções, 1: Reading, 2: Listening, 3: Writing, 4: Envio/Resultado
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [writingContent, setWritingContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState<boolean>(false);
  const [finalAttempt, setFinalAttempt] = useState<Omit<CefrExamAttempt, 'id' | 'timestamp'> | null>(null);

  useEffect(() => {
    setCurrentStep(0);
    setAnswers({});
    setWritingContent('');
    setFinalAttempt(null);
    setIsSubmitting(false);
    setIsTtsPlaying(false);
  }, [exam]);

  const readingQuestions = exam.questions.filter(q => q.section === 'reading');
  const listeningQuestions = exam.questions.filter(q => q.section === 'listening');

  // TTS audio playback
  const playTts = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('Navegador não suporta Text-to-Speech.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85; // A bit slower for clarity

    setIsTtsPlaying(true);
    utterance.onend = () => setIsTtsPlaying(false);
    utterance.onerror = () => setIsTtsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleSelectOption = (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      const allAnswered = readingQuestions.every(q => answers[q.id]);
      if (!allAnswered) {
        toast.warning('Por favor, responda a todas as perguntas de leitura.');
        return;
      }
    } else if (currentStep === 2) {
      const allAnswered = listeningQuestions.every(q => answers[q.id]);
      if (!allAnswered) {
        toast.warning('Por favor, responda a todas as perguntas de áudio.');
        return;
      }
    } else if (currentStep === 3) {
      const wordCount = writingContent.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < exam.writingPrompt.minWords) {
        toast.warning(`A redação precisa de no mínimo ${exam.writingPrompt.minWords} palavras. (Atual: ${wordCount})`);
        return;
      }
    }

    setCurrentStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  // Submit test and trigger Gemini grading if API Key is set
  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      let writingScore = 100;
      let aiFeedback = 'Simulação de avaliação offline. A correção inteligente por IA exige uma chave de API do Gemini configurada.';

      const apiKey = localStorage.getItem('memorize_gemini_api_key') || geminiApiKey;

      if (apiKey && apiKey.trim()) {
        try {
          const evalResult = await evaluateWritingWithGemini(
            exam.level,
            exam.writingPrompt.instructions,
            writingContent,
            apiKey
          );
          writingScore = evalResult.score;
          aiFeedback = evalResult.feedback;
        } catch (err) {
          console.warn('Erro ao chamar API do Gemini para correção de redação:', err);
          toast.error('Erro na chamada da IA do Gemini. Usando nota padrão temporária.');
        }
      }

      const {
        readingScore,
        listeningScore,
        overallScore,
        passed
      } = calculateExamScore(answers, exam, writingScore);

      const attempt: Omit<CefrExamAttempt, 'id' | 'timestamp'> = {
        examId: exam.id,
        level: exam.level,
        readingScore,
        listeningScore,
        writingScore,
        overallScore,
        passed,
        aiFeedback
      };

      await onSubmitAttempt(attempt);
      setFinalAttempt(attempt);
      setCurrentStep(4); // View result step
    } catch (err) {
      toast.error('Erro ao processar envio do simulado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col transition-all duration-300">
      
      {/* Immersive Header bar for Exam */}
      <header className="bg-card border-b border-border/80 px-4 md:px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-inner">
            <Award size={20} />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-black tracking-tight text-foreground">{exam.title}</h1>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Certificação Simulada CEFR • Nível {exam.level}
            </p>
          </div>
        </div>

        {/* Status indicator / Exit button */}
        <div className="flex items-center gap-3">
          {currentStep > 0 && currentStep < 4 && (
            <div className="text-[10px] md:text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/40">
              Etapa {currentStep} de 3
            </div>
          )}
          <button
            onClick={() => {
              if (currentStep === 4 || window.confirm('Deseja realmente sair da prova? Seu progresso atual nesta tentativa será perdido.')) {
                onClose();
              }
            }}
            className="text-[10.5px] font-extrabold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
          >
            Sair da Prova
          </button>
        </div>
      </header>

      {/* Full screen main container area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-6 py-8 flex flex-col items-center justify-start w-full max-w-3xl mx-auto pb-24">
        
        {/* STEP 0: INSTRUCTIONS / WELCOME SCREEN */}
        {currentStep === 0 && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="space-y-2">
              <h2 className="text-xl font-black text-foreground">
                Instruções Gerais do Exame
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground font-medium">
                {exam.description} Este simulado segue as diretrizes dos testes de proficiência CEFR, fornecendo um diagnóstico real do seu domínio das competências lexicais de nível <strong className="text-foreground">{exam.level}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-muted/30 p-4 rounded-xl border border-border/30 text-center space-y-1.5">
                <BookOpen size={18} className="mx-auto text-blue-500" />
                <p className="text-[10.5px] font-black uppercase text-foreground">Reading</p>
                <p className="text-[9.5px] text-muted-foreground font-semibold">{readingQuestions.length} questões</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-xl border border-border/30 text-center space-y-1.5">
                <Headphones size={18} className="mx-auto text-emerald-500" />
                <p className="text-[10.5px] font-black uppercase text-foreground">Listening</p>
                <p className="text-[9.5px] text-muted-foreground font-semibold">{listeningQuestions.length} questões (TTS)</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-xl border border-border/30 text-center space-y-1.5">
                <PenTool size={18} className="mx-auto text-amber-500" />
                <p className="text-[10.5px] font-black uppercase text-foreground">Writing</p>
                <p className="text-[9.5px] text-muted-foreground font-semibold">Avaliação por IA</p>
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-[11px] font-semibold text-foreground/80 leading-relaxed space-y-1">
              <p className="text-primary font-bold text-xs">📌 Regras e Requisitos:</p>
              <ul className="list-disc list-inside space-y-0.5 text-foreground/70 font-medium">
                <li>A aprovação exige uma nota geral mínima de <strong className="text-foreground">{getPassingCut(exam.level)}%</strong>.</li>
                <li>A redação (Writing) será corrigida e pontuada de 0 a 100 com feedbacks qualitativos por inteligência artificial.</li>
                <li>Você não poderá pausar a prova, e sair da tela cancelará a tentativa corrente.</li>
              </ul>
            </div>

            <div className="pt-2">
              <Button 
                onClick={handleNextStep}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-11 rounded-xl cursor-pointer shadow-md shadow-primary/10"
              >
                Iniciar Exame
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1: READING & USE OF ENGLISH */}
        {currentStep === 1 && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="border-b border-border/30 pb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-blue-500" />
              <h2 className="text-md font-black uppercase tracking-wider text-foreground">
                Seção 1: Reading & Use of English
              </h2>
            </div>

            <div className="space-y-5">
              {readingQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-3.5 p-4 bg-muted/20 border border-border/40 rounded-xl">
                  <p className="text-xs font-bold text-foreground">
                    Questão {idx + 1}: {q.questionText}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectOption(q.id, opt)}
                        className={`p-3.5 rounded-lg border text-left text-xs font-bold transition-all duration-150 cursor-pointer ${
                          answers[q.id] === opt 
                            ? 'bg-primary/15 border-primary text-primary shadow-sm' 
                            : 'bg-card border-border hover:bg-muted/40 text-foreground/80'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-row justify-between pt-4 border-t border-border/40">
              <Button variant="outline" onClick={handlePrevStep} className="h-10 px-5 rounded-xl font-bold text-xs">
                Voltar
              </Button>
              <Button onClick={handleNextStep} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-black text-xs cursor-pointer shadow-sm">
                Avançar para Listening
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: LISTENING COMPREHENSION */}
        {currentStep === 2 && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="border-b border-border/30 pb-3 flex items-center gap-2">
              <Headphones size={18} className="text-emerald-500" />
              <h2 className="text-md font-black uppercase tracking-wider text-foreground">
                Seção 2: Listening Comprehension
              </h2>
            </div>

            <div className="space-y-6">
              {listeningQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-4 p-4 bg-muted/20 border border-border/40 rounded-xl">
                  {/* TTS Speech Trigger Player */}
                  <div className="flex items-center justify-between bg-card border border-border/40 px-3.5 py-2.5 rounded-xl">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Áudio do Simulado • Questão {idx + 1}</span>
                    <Button
                      type="button"
                      onClick={() => q.audioText && playTts(q.audioText)}
                      className={`h-8 px-4 text-[9.5px] font-black rounded-lg flex items-center gap-1.5 cursor-pointer border border-primary/20 transition-all ${
                        isTtsPlaying ? 'bg-primary/15 text-primary' : 'bg-primary/5 text-primary hover:bg-primary/10'
                      }`}
                    >
                      <Volume2 size={12} className={isTtsPlaying ? 'animate-pulse' : ''} />
                      {isTtsPlaying ? 'Reproduzindo...' : 'Tocar Áudio'}
                    </Button>
                  </div>

                  <p className="text-xs font-bold text-foreground">
                    Questão {idx + 1}: {q.questionText}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectOption(q.id, opt)}
                        className={`p-3.5 rounded-lg border text-left text-xs font-bold transition-all duration-150 cursor-pointer ${
                          answers[q.id] === opt 
                            ? 'bg-primary/15 border-primary text-primary shadow-sm' 
                            : 'bg-card border-border hover:bg-muted/40 text-foreground/80'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-row justify-between pt-4 border-t border-border/40">
              <Button variant="outline" onClick={handlePrevStep} className="h-10 px-5 rounded-xl font-bold text-xs">
                Voltar
              </Button>
              <Button onClick={handleNextStep} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-black text-xs cursor-pointer shadow-sm">
                Avançar para Writing
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: WRITING TASK (REDACÃO) */}
        {currentStep === 3 && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-5 animate-in fade-in duration-300">
            <div className="border-b border-border/30 pb-3 flex items-center gap-2">
              <PenTool size={18} className="text-amber-500" />
              <h2 className="text-md font-black uppercase tracking-wider text-foreground">
                Seção 3: Writing Task
              </h2>
            </div>

            <div className="space-y-3.5 bg-muted/45 p-4 rounded-xl border border-border/40">
              <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Tarefa de Escrita ({exam.writingPrompt.topic})</p>
              <p className="text-[11px] font-semibold leading-relaxed text-foreground/85">
                {exam.writingPrompt.instructions}
              </p>
              <div className="flex justify-between text-[9px] font-extrabold text-muted-foreground uppercase tracking-wide">
                <span>Limite Mínimo: {exam.writingPrompt.minWords} palavras</span>
                <span>Limite Máximo: {exam.writingPrompt.maxWords} palavras</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <textarea
                value={writingContent}
                disabled={isSubmitting}
                onChange={(e) => setWritingContent(e.target.value)}
                placeholder="Type your essay/text here in English..."
                className="w-full h-[200px] bg-muted/15 border border-border hover:border-border/80 focus:border-primary text-foreground text-xs p-4 rounded-xl outline-none font-medium leading-relaxed resize-none transition-all scrollbar-thin focus:ring-1 focus:ring-primary/20"
              />
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground px-1 uppercase tracking-wide">
                <span>Contagem de palavras: {writingContent.trim().split(/\s+/).filter(Boolean).length}</span>
              </div>
            </div>

            <div className="flex flex-row justify-between pt-4 border-t border-border/40">
              <Button variant="outline" onClick={handlePrevStep} className="h-10 px-5 rounded-xl font-bold text-xs" disabled={isSubmitting}>
                Voltar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-md shadow-primary/5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Corrigindo Redação...
                  </>
                ) : (
                  'Concluir e Enviar Prova'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: RESULT / REPORT SCREEN */}
        {currentStep === 4 && finalAttempt && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 animate-in fade-in duration-300 text-center flex flex-col items-center">
            
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 shadow-inner ${
              finalAttempt.passed 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                : 'bg-destructive/10 text-destructive border-destructive/30'
            }`}>
              {finalAttempt.passed ? <Sparkles size={28} /> : <AlertTriangle size={28} />}
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-foreground">
                {finalAttempt.passed ? 'Parabéns, Você foi Aprovado! 🎉' : 'Não foi desta vez.'}
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                Exame CEFR {exam.level} • Pontuação Final: {finalAttempt.overallScore}% (Exigido: {getPassingCut(exam.level)}%)
              </p>
            </div>

            {/* Score detail grid */}
            <div className="grid grid-cols-3 gap-3 w-full">
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border/40 text-center space-y-0.5 shadow-sm">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Reading</p>
                <p className="text-lg font-black text-foreground">{finalAttempt.readingScore}%</p>
              </div>
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border/40 text-center space-y-0.5 shadow-sm">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Listening</p>
                <p className="text-lg font-black text-foreground">{finalAttempt.listeningScore}%</p>
              </div>
              <div className="bg-muted/40 p-3.5 rounded-xl border border-border/40 text-center space-y-0.5 shadow-sm">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Writing</p>
                <p className="text-lg font-black text-foreground">{finalAttempt.writingScore}%</p>
              </div>
            </div>

            {/* AI qualitative feedback card */}
            {finalAttempt.aiFeedback && (
              <div className="w-full text-left p-4 bg-muted/40 border border-border/40 rounded-xl space-y-1.5 shadow-sm">
                <p className="text-[9px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                  <Sparkles size={9} className="text-primary animate-pulse" /> Feedback Detalhado do Examinador IA
                </p>
                <p className="text-[11px] leading-relaxed text-foreground/90 font-semibold whitespace-pre-wrap">
                  {finalAttempt.aiFeedback}
                </p>
              </div>
            )}

            <div className="w-full pt-2">
              <Button 
                onClick={onClose}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-11 rounded-xl cursor-pointer"
              >
                Concluir e Retornar
              </Button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
