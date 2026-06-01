import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Volume2, BookOpen, Headphones, PenTool, Award, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import type { CefrExam, CefrExamAttempt } from '../types';
import { toast } from 'sonner';
import { calculateExamScore, getPassingCut } from '../utils/cefrExamHelper';
import { evaluateWritingWithGemini } from '../utils/cefrWritingEvaluator';

interface CefrExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: CefrExam | null;
  onSubmitAttempt: (attempt: Omit<CefrExamAttempt, 'id' | 'timestamp'>) => Promise<void>;
  geminiApiKey?: string;
}

export const CefrExamModal: React.FC<CefrExamModalProps> = ({
  isOpen,
  onClose,
  exam,
  onSubmitAttempt,
  geminiApiKey = ''
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Instruções, 1: Reading, 2: Listening, 3: Writing, 4: Envio/Resultado
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [writingContent, setWritingContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState<boolean>(false);

  // States para resultados
  const [finalAttempt, setFinalAttempt] = useState<Omit<CefrExamAttempt, 'id' | 'timestamp'> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setAnswers({});
      setWritingContent('');
      setFinalAttempt(null);
      setIsSubmitting(false);
      setIsTtsPlaying(false);
    }
  }, [isOpen]);

  if (!exam) return null;

  const readingQuestions = exam.questions.filter(q => q.section === 'reading');
  const listeningQuestions = exam.questions.filter(q => q.section === 'listening');

  // Função de TTS para narrar diálogos
  const playTts = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('Navegador não suporta Text-to-Speech.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Um pouco mais devagar para clareza

    setIsTtsPlaying(true);
    utterance.onend = () => setIsTtsPlaying(false);
    utterance.onerror = () => setIsTtsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleSelectOption = (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };



  const handleNextStep = () => {
    // Validar se todas as questões da etapa atual foram respondidas
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

  // Envio final (Corrigido por IA via Gemini se houver API Key)
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

      // 3. Nota geral ponderada usando o cefrExamHelper
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
      setCurrentStep(4); // Exibe tela de resultado
    } catch (err) {
      toast.error('Erro ao processar envio do simulado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg sm:max-w-2xl rounded-2xl p-6">
        
        {/* PASSO 0: INSTRUÇÕES / INTRO */}
        {currentStep === 0 && (
          <div className="space-y-5 py-2">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Award size={22} />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-foreground">
                    {exam.title}
                  </DialogTitle>
                  <p className="text-[10px] text-muted-foreground font-semibold">
                    Certificação Oficial Simulada CEFR • Nível {exam.level}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {exam.description} Este simulado segue fielmente as estruturas de testes oficiais de Cambridge, avaliando sua leitura, audição e escrita.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 p-3 rounded-xl border border-border/40 text-center space-y-1">
                <BookOpen size={16} className="mx-auto text-blue-500" />
                <p className="text-[10px] font-black uppercase text-foreground">Reading</p>
                <p className="text-[9px] text-muted-foreground">{readingQuestions.length} questões</p>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border border-border/40 text-center space-y-1">
                <Headphones size={16} className="mx-auto text-emerald-500" />
                <p className="text-[10px] font-black uppercase text-foreground">Listening</p>
                <p className="text-[9px] text-muted-foreground">{listeningQuestions.length} questões (TTS)</p>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border border-border/40 text-center space-y-1">
                <PenTool size={16} className="mx-auto text-amber-500" />
                <p className="text-[10px] font-black uppercase text-foreground">Writing</p>
                <p className="text-[9px] text-muted-foreground">Avaliado por IA</p>
              </div>
            </div>

            <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 text-[11px] font-medium text-foreground leading-relaxed">
              📌 <strong>Regras da Prova:</strong><br />
              • A aprovação exige uma nota geral de <strong>{getPassingCut(exam.level)}%</strong> ou superior.<br />
              • A redação (Writing) deve respeitar a quantidade mínima de palavras indicada.<br />
              • Uma vez iniciada, certifique-se de concluir todas as seções.
            </div>

            <DialogFooter className="pt-2">
              <Button 
                onClick={handleNextStep}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-10 rounded-xl cursor-pointer"
              >
                Iniciar Exame
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASSO 1: READING & USE OF ENGLISH */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="text-md font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <BookOpen size={16} className="text-blue-500" /> Seção 1: Reading & Use of English
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {readingQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-2.5 p-4 bg-muted/20 border border-border/40 rounded-xl">
                  <p className="text-xs font-bold text-foreground">
                    {idx + 1}. {q.questionText}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectOption(q.id, opt)}
                        className={`p-3 rounded-lg border text-left text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          answers[q.id] === opt 
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' 
                            : 'bg-card border-border hover:bg-muted/60 text-foreground'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="flex flex-row justify-between pt-3 border-t border-border/40">
              <Button variant="outline" onClick={handlePrevStep} className="h-9 px-4 rounded-xl font-bold text-xs">
                Voltar
              </Button>
              <Button onClick={handleNextStep} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer">
                Próxima Seção
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASSO 2: LISTENING COMPREHENSION */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="text-md font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Headphones size={16} className="text-emerald-500" /> Seção 2: Listening Comprehension
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {listeningQuestions.map((q, idx) => (
                <div key={q.id} className="space-y-3 p-4 bg-muted/20 border border-border/40 rounded-xl">
                  {/* Player de áudio simulado por TTS */}
                  <div className="flex items-center justify-between bg-card border border-border/40 px-3 py-2 rounded-lg">
                    <span className="text-[10px] font-bold text-muted-foreground">Áudio do Exame {idx + 1}</span>
                    <Button
                      type="button"
                      onClick={() => q.audioText && playTts(q.audioText)}
                      className={`h-7 px-3.5 text-[9px] font-bold rounded-md flex items-center gap-1.5 cursor-pointer border border-primary/20 ${
                        isTtsPlaying ? 'bg-primary/15 text-primary' : 'bg-primary/5 text-primary hover:bg-primary/10'
                      }`}
                    >
                      <Volume2 size={11} className={isTtsPlaying ? 'animate-pulse' : ''} />
                      {isTtsPlaying ? 'Tocando...' : 'Ouvir Áudio'}
                    </Button>
                  </div>

                  <p className="text-xs font-bold text-foreground">
                    {idx + 1}. {q.questionText}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectOption(q.id, opt)}
                        className={`p-3 rounded-lg border text-left text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          answers[q.id] === opt 
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm' 
                            : 'bg-card border-border hover:bg-muted/60 text-foreground'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="flex flex-row justify-between pt-3 border-t border-border/40">
              <Button variant="outline" onClick={handlePrevStep} className="h-9 px-4 rounded-xl font-bold text-xs">
                Voltar
              </Button>
              <Button onClick={handleNextStep} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs cursor-pointer">
                Próxima Seção
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASSO 3: WRITING TASK */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="text-md font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <PenTool size={16} className="text-amber-500" /> Seção 3: Writing Task
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border/40">
              <p className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Tarefa de Redação ({exam.writingPrompt.topic})</p>
              <p className="text-[11px] font-semibold leading-relaxed text-foreground/80">
                {exam.writingPrompt.instructions}
              </p>
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                <span>Mínimo: {exam.writingPrompt.minWords} palavras</span>
                <span>Máximo: {exam.writingPrompt.maxWords} palavras</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <textarea
                value={writingContent}
                onChange={(e) => setWritingContent(e.target.value)}
                placeholder="Write your text here in English..."
                className="w-full h-[160px] bg-muted/15 border border-border hover:border-border/80 focus:border-primary text-foreground text-xs p-3.5 rounded-xl outline-none font-medium leading-relaxed resize-none transition-all scrollbar-thin"
              />
              <div className="flex justify-between text-[9px] font-bold text-muted-foreground px-1">
                <span>Total de palavras: {writingContent.trim().split(/\s+/).filter(Boolean).length}</span>
              </div>
            </div>

            <DialogFooter className="flex flex-row justify-between pt-3 border-t border-border/40">
              <Button variant="outline" onClick={handlePrevStep} className="h-9 px-4 rounded-xl font-bold text-xs" disabled={isSubmitting}>
                Voltar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="h-9 px-4.5 rounded-xl bg-primary text-primary-foreground font-black text-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Corrigindo redação...
                  </>
                ) : (
                  'Concluir e Enviar'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* PASSO 4: RESULTADO / VEREDITO */}
        {currentStep === 4 && finalAttempt && (
          <div className="space-y-5 py-2 text-center flex flex-col items-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
              finalAttempt.passed 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                : 'bg-destructive/10 text-destructive border-destructive/30'
            }`}>
              {finalAttempt.passed ? <Sparkles size={28} /> : <AlertTriangle size={28} />}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-foreground">
                {finalAttempt.passed ? 'Parabéns, Você Passou! 🎉' : 'Não foi desta vez.'}
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                Exame CEFR {exam.level} • Média Final: {finalAttempt.overallScore}% (Meta: {getPassingCut(exam.level)}%)
              </p>
            </div>

            {/* Quadro de Notas Detalhado */}
            <div className="grid grid-cols-3 gap-3 w-full pt-1">
              <div className="bg-muted/40 p-3 rounded-xl border border-border/40 text-center space-y-0.5">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Reading</p>
                <p className="text-md font-black text-foreground">{finalAttempt.readingScore}%</p>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border border-border/40 text-center space-y-0.5">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Listening</p>
                <p className="text-md font-black text-foreground">{finalAttempt.listeningScore}%</p>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border border-border/40 text-center space-y-0.5">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Writing Task</p>
                <p className="text-md font-black text-foreground">{finalAttempt.writingScore}%</p>
              </div>
            </div>

            {/* Feedback da Redação */}
            {finalAttempt.aiFeedback && (
              <div className="w-full text-left p-3.5 bg-muted/40 border border-border/40 rounded-xl space-y-1">
                <p className="text-[9px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                  <Sparkles size={9} /> Avaliação de Escrita (Writing Feedback)
                </p>
                <p className="text-[10.5px] leading-relaxed text-foreground/90 font-medium">
                  {finalAttempt.aiFeedback}
                </p>
              </div>
            )}

            <DialogFooter className="w-full pt-2">
              <Button 
                onClick={onClose}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-10 rounded-xl cursor-pointer"
              >
                Concluir
              </Button>
            </DialogFooter>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};
