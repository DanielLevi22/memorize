import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Sparkles, MessageSquare, ClipboardList, ArrowRight, Award, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AiDiagnosticArenaPageProps {
  onClose: () => void;
  geminiApiKey?: string;
}

export const AiDiagnosticArenaPage: React.FC<AiDiagnosticArenaPageProps> = ({
  onClose,
  geminiApiKey = ''
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Instruções, 1: Teste, 2: Resultado
  const [questionCount, setQuestionCount] = useState<number>(0); // 1 a 5
  const [chatMessages, setChatMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [userResponse, setUserResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  
  // Nível extraído para salvamento rápido no final
  const [suggestedLevel, setSuggestedLevel] = useState<string | null>(null);

  // Inicia o teste diagnóstico
  const handleStartDiagnostic = async () => {
    const apiKey = localStorage.getItem('memorize_gemini_api_key') || geminiApiKey || '';
    if (!apiKey.trim()) {
      toast.error('Configure uma chave de API do Gemini nas Configurações para realizar o teste.');
      return;
    }

    setIsLoading(true);
    setChatMessages([]);
    setUserResponse('');
    setQuestionCount(1);
    setAiAnalysis(null);
    setSuggestedLevel(null);
    setCurrentStep(1);

    const initialPrompt = `Você é um examinador especialista no Quadro Europeu Comum (CEFR) para línguas. 
Inicie um teste diagnóstico interativo e rápido para avaliar o nível de inglês do usuário.
Você fará de 4 a 5 perguntas curtas, uma por vez, aumentando a dificuldade a cada resposta.
Mantenha suas perguntas em inglês de forma limpa, direta e curta.
Primeira instrução: Comece se apresentando brevemente em português de forma formal, e em seguida faça a primeira pergunta diagnóstico em inglês em um nível intermediário básico (A2/B1) perguntando sobre a rotina dele ou um interesse simples.`;

    try {
      const responseText = await queryGeminiDirect(initialPrompt, apiKey);
      setChatMessages([{ role: 'ai', text: responseText }]);
    } catch (err) {
      toast.error('Erro ao iniciar comunicação com a IA do Gemini. Verifique sua conexão e chave de API.');
      setCurrentStep(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Envia a resposta do usuário
  const handleSubmitResponse = async () => {
    if (!userResponse.trim() || isLoading) return;

    const apiKey = localStorage.getItem('memorize_gemini_api_key') || geminiApiKey || '';
    if (!apiKey.trim()) {
      toast.error('Chave de API do Gemini não configurada.');
      return;
    }

    setIsLoading(true);
    const userText = userResponse.trim();
    const updatedMessages = [...chatMessages, { role: 'user' as const, text: userText }];
    setChatMessages(updatedMessages);
    setUserResponse('');

    try {
      if (questionCount < 5) {
        const nextPrompt = `Aqui está o histórico do diálogo diagnóstico:
${JSON.stringify(updatedMessages)}

O usuário respondeu: "${userText}".
Avalie a complexidade gramatical e vocabulário da resposta. Faça a pergunta número ${questionCount + 1} em inglês, adaptando a dificuldade para um nível superior se ele foi muito bem, ou inferior/igual se ele errou muito ou deu uma resposta curta. Seja breve na pergunta.`;

        const aiText = await queryGeminiDirect(nextPrompt, apiKey);
        setChatMessages(prev => [...prev, { role: 'ai', text: aiText }]);
        setQuestionCount(prev => prev + 1);
      } else {
        // Encerra e faz análise geral
        const finalPrompt = `Aqui está o histórico completo do teste diagnóstico de nível CEFR:
${JSON.stringify(updatedMessages)}

Analise criticamente as respostas do usuário sob a ótica do CEFR (A1, A2, B1, B2, C1, C2).
Gere um relatório estruturado de veredicto final.
Escreva em Português do Brasil com a seguinte estrutura exatamente:
Nível Sugerido: [A1/A2/B1/B2/C1/C2] - Nome do Nível

Pontos Fortes:
[Descreva pontos fortes]

Pontos de Melhoria:
[Descreva pontos de melhoria]

Recomendação de Estudo:
[Descreva recomendações de estudo]

Seja direto, empático e focado no aprendizado.`;

        const analysisResult = await queryGeminiDirect(finalPrompt, apiKey);
        setAiAnalysis(analysisResult);
        
        // Tenta extrair o nível CEFR para salvamento rápido
        const levelMatch = analysisResult.match(/Nível Sugerido:\s*([A-C][1-2])/i);
        if (levelMatch && levelMatch[1]) {
          setSuggestedLevel(levelMatch[1].toUpperCase());
        }
        
        setCurrentStep(2);
      }
    } catch (err) {
      toast.error('Erro ao processar resposta com a IA. Tente reenviar.');
      // Remove a última mensagem enviada pelo usuário para permitir reenvio limpo
      setChatMessages(updatedMessages.slice(0, -1));
      setUserResponse(userText);
    } finally {
      setIsLoading(false);
    }
  };

  // Método auxiliar para chamar a API
  const queryGeminiDirect = async (promptText: string, apiKey: string): Promise<string> => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      }
    );

    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };

  // Define o nível sugerido no perfil do usuário
  const handleSaveLevel = () => {
    if (!suggestedLevel) return;
    localStorage.setItem('memorize_cefr_unlocked_level', suggestedLevel);
    toast.success(`Parabéns! Seu nível desbloqueado foi definido como ${suggestedLevel}!`);
  };

  // Retorna a pergunta atual da IA (última mensagem da IA no chat)
  const currentQuestionText = chatMessages.filter(m => m.role === 'ai').slice(-1)[0]?.text || '';

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col transition-all duration-300">
      
      {/* Header da Arena */}
      <header className="bg-card border-b border-border/80 px-4 md:px-8 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-inner">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-black tracking-tight text-foreground">Diagnóstico por IA</h1>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Mapeamento Adaptativo CEFR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentStep === 1 && (
            <div className="text-[10px] md:text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/40">
              Questão {questionCount} de 5
            </div>
          )}
          <button
            onClick={() => {
              if (currentStep === 2 || window.confirm('Deseja realmente sair do diagnóstico? Todo o progresso desta sessão será perdido.')) {
                onClose();
              }
            }}
            className="text-[10.5px] font-extrabold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
          >
            Abandonar Diagnóstico
          </button>
        </div>
      </header>

      {/* Área Principal de Conteúdo */}
      <main className="flex-1 overflow-y-auto px-4 md:px-6 py-8 flex flex-col items-center justify-start w-full max-w-3xl mx-auto pb-24">
        
        {/* PASSO 0: INSTRUÇÕES INICIAIS */}
        {currentStep === 0 && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="space-y-2.5">
              <h2 className="text-xl font-black text-foreground">
                Como funciona o Teste Diagnóstico por IA?
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground font-semibold">
                Este teste é um diálogo adaptativo estruturado para aferir suas habilidades no idioma de forma eficiente. O examinador IA irá interagir diretamente com você em inglês.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 bg-muted/30 border border-border/40 rounded-xl">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0 mt-0.5">
                  <ClipboardList size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground">5 Perguntas Dinâmicas</h3>
                  <p className="text-[10.5px] text-muted-foreground font-medium mt-0.5">
                    Você responderá a 5 perguntas curtas. A IA calibrará o nível da pergunta subsequente baseando-se na sua precisão e vocabulário.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-muted/30 border border-border/40 rounded-xl">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0 mt-0.5">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground">Respostas em Inglês</h3>
                  <p className="text-[10.5px] text-muted-foreground font-medium mt-0.5">
                    Escreva suas respostas em inglês da forma mais natural e detalhada possível para que a IA avalie seu potencial lexical.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-muted/30 border border-border/40 rounded-xl">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0 mt-0.5">
                  <Award size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-foreground">Relatório CEFR</h3>
                  <p className="text-[10.5px] text-muted-foreground font-medium mt-0.5">
                    No fim do teste, você receberá sugestão de nível oficial (A1 a C2) e feedbacks de pontos fortes e pontos a melhorar.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                onClick={handleStartDiagnostic}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black text-xs h-11 rounded-xl cursor-pointer shadow-md shadow-primary/10"
              >
                Começar Avaliação Diagnóstica
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 1: TESTE EM ANDAMENTO */}
        {currentStep === 1 && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 pb-3 border-b border-border/30">
              <Sparkles size={16} className="text-primary" />
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Examinador IA do CEFR
              </h2>
            </div>

            {/* Caixa da pergunta da IA */}
            <div className="p-4 bg-muted/40 border border-border/40 rounded-xl relative overflow-hidden">
              <div className="absolute right-3 top-3 text-muted-foreground/10">
                <MessageSquare size={70} />
              </div>
              <div className="space-y-1.5 relative z-10">
                <p className="text-[10px] font-black uppercase text-primary tracking-wider">Pergunta Diagnóstica</p>
                <p className="text-xs md:text-sm font-semibold leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {currentQuestionText || 'Aguardando inicialização do examinador...'}
                </p>
              </div>
            </div>

            {/* Textarea para resposta */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground px-1 uppercase tracking-wide">
                <span>Sua Resposta (Em Inglês)</span>
                <span>{userResponse.trim().split(/\s+/).filter(Boolean).length} palavras</span>
              </div>
              <textarea
                value={userResponse}
                disabled={isLoading}
                onChange={(e) => setUserResponse(e.target.value)}
                placeholder="Type your answer here in English..."
                className="w-full h-[150px] bg-muted/15 border border-border hover:border-border/80 focus:border-primary text-foreground text-xs p-4 rounded-xl outline-none font-medium leading-relaxed resize-none transition-all scrollbar-thin focus:ring-1 focus:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitResponse();
                  }
                }}
              />
              <p className="text-[9px] text-muted-foreground font-semibold italic">
                Dica: Pressione Enter para enviar, Shift+Enter para quebrar linha. Responda com frases completas para melhores resultados.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button 
                onClick={handleSubmitResponse}
                disabled={!userResponse.trim() || isLoading}
                className="h-10 px-6 rounded-xl bg-primary text-primary-foreground font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-md shadow-primary/10"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Analisando Resposta...
                  </>
                ) : (
                  <>
                    Enviar e Avançar <ArrowRight size={13} />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 2: RESULTADO FINAL */}
        {currentStep === 2 && aiAnalysis && (
          <div className="w-full bg-card border border-border/60 p-6 md:p-8 rounded-2xl shadow-xl space-y-6 animate-in fade-in duration-300">
            
            <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-border/20">
              <div className="w-14 h-14 bg-primary/10 text-primary border-2 border-primary/20 rounded-full flex items-center justify-center shadow-inner">
                <Award size={26} className="animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-foreground">
                  Diagnóstico Concluído!
                </h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  Relatório de Classificação de Proficiência Adaptativo
                </p>
              </div>
            </div>

            {/* Relatório formatado da IA */}
            <div className="bg-muted/30 border border-border/40 p-5 rounded-xl space-y-4 shadow-sm text-left">
              <div className="whitespace-pre-wrap text-xs font-semibold leading-relaxed text-foreground/90 space-y-4">
                {aiAnalysis}
              </div>
            </div>

            {/* Ações de salvamento e retorno */}
            <div className="space-y-2 pt-2">
              {suggestedLevel && (
                <Button 
                  onClick={handleSaveLevel}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs h-11 rounded-xl cursor-pointer shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2"
                >
                  <Award size={15} /> Definir Nível {suggestedLevel} no meu Roadmap CEFR
                </Button>
              )}

              <Button 
                onClick={onClose}
                variant="outline"
                className="w-full text-foreground hover:bg-muted font-bold text-xs h-11 rounded-xl border-border/60 cursor-pointer"
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
