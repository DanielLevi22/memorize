import React, { useState, useEffect } from 'react';
import type { Deck } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Sparkles, CheckCircle2, ChevronRight, ArrowLeft, Loader2, Key } from 'lucide-react';
import { Toast } from './ui/toast';

interface AiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiApiKey: string;
  decks: Deck[] | undefined;
  onImportCards: (
    deckNameOrId: string,
    isNewDeck: boolean,
    newDeckDescription: string,
    cards: Array<{ front: string; back: string; context: string }>
  ) => Promise<void>;
  onNavigateToSettings: () => void;
}

interface GeneratedCard {
  id: string;
  front: string;
  back: string;
  context: string;
  selected: boolean;
}

export const AiGeneratorModal: React.FC<AiGeneratorModalProps> = ({
  isOpen,
  onClose,
  geminiApiKey,
  decks,
  onImportCards,
  onNavigateToSettings,
}) => {
  const [step, setStep] = useState<'input' | 'generating' | 'preview'>('input');
  const [topic, setTopic] = useState('');
  const [cardCount, setCardCount] = useState(10);
  const [instructions, setInstructions] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('new');
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDescription, setNewDeckDescription] = useState('');
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);

  // Loading text animations
  const loadingTexts = [
    '🧠 Gemini está analisando o tema...',
    '✍️ Escrevendo termos e traduções...',
    '💡 Criando exemplos em contexto real...',
    '✨ Formatando seus cartões...',
  ];

  useEffect(() => {
    let interval: any;
    if (step === 'generating') {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingTexts.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step]);

  // Clean form on open
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setTopic('');
      setCardCount(10);
      setInstructions('');
      setNewDeckName('');
      setNewDeckDescription('');
      setGeneratedCards([]);
      setErrorMsg('');
      setToastMsg('');
      if (decks && decks.length > 0) {
        setSelectedDeckId(decks[0].id);
      } else {
        setSelectedDeckId('new');
      }
    }
  }, [isOpen, decks]);

  useEffect(() => {
    if (selectedDeckId === 'new' && topic && !newDeckName) {
      setNewDeckName(topic.charAt(0).toUpperCase() + topic.slice(1));
    }
  }, [selectedDeckId, topic]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (!geminiApiKey.trim()) {
      setErrorMsg('Configure sua chave de API nas configurações primeiro!');
      return;
    }

    setStep('generating');
    setErrorMsg('');

    try {
      const promptText = `
Você é um gerador de flashcards especialista no ensino de idiomas, especialmente inglês.
Crie exatamente ${cardCount} cartões de memorização (flashcards) sobre o tema/tópico: "${topic}".
${instructions.trim() ? `Siga também estas instruções adicionais de customização: "${instructions.trim()}".` : ''}

Cada cartão DEVE conter:
- "front": O termo, palavra ou expressão em inglês (ou pergunta sobre o tema).
- "back": A tradução, explicação ou resposta curta em português do Brasil.
- "context": Uma frase de exemplo curta e clara em inglês demonstrando como o termo na frente é utilizado, contendo o próprio termo em destaque (ou usado de forma natural).

Gere resultados realistas, focados em conversação cotidiana e gramática prática.
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: promptText,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    front: { type: 'STRING', description: 'Frente do cartão (pergunta ou termo em inglês)' },
                    back: { type: 'STRING', description: 'Verso do cartão (tradução ou resposta)' },
                    context: { type: 'STRING', description: 'Exemplo prático do termo em contexto em inglês' },
                  },
                  required: ['front', 'back', 'context'],
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || `Erro da API (código ${response.status})`;
        const isQuotaExceeded = response.status === 429 || (message && /quota|limit|exhausted/i.test(message));
        const isHighDemand = response.status === 503 || (message && /high demand|try again later/i.test(message));
        
        if (isQuotaExceeded) {
          throw new Error('Seu limite diário foi atingido');
        } else if (isHighDemand) {
          throw new Error('Este modelo está enfrentando alta demanda no momento. Picos de demanda geralmente são temporários. Por favor, tente novamente mais tarde.');
        } else if (response.status === 400 || response.status === 403) {
          throw new Error('Chave de API inválida ou sem permissão. Verifique sua chave nas configurações.');
        }
        throw new Error(message);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('A IA respondeu, mas não retornou um conteúdo estruturado válido. Tente outro tema.');
      }

      const parsed: Array<{ front: string; back: string; context: string }> = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('A resposta gerada não contém cartões válidos. Tente refazer a busca.');
      }

      const formatted: GeneratedCard[] = parsed.map((c, idx) => ({
        id: `gen-${Date.now()}-${idx}`,
        front: c.front || '',
        back: c.back || '',
        context: c.context || '',
        selected: true,
      }));

      setGeneratedCards(formatted);
      setStep('preview');
    } catch (err: any) {
      if (err.message === 'Seu limite diário foi atingido' || err.message.includes('alta demanda')) {
        setToastMsg(err.message);
      } else {
        setErrorMsg(err.message || 'Erro inesperado ao gerar os cartões.');
      }
      setStep('input');
    }
  };

  const handleCardFieldChange = (id: string, field: 'front' | 'back' | 'context', value: string) => {
    setGeneratedCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const toggleCardSelect = (id: string) => {
    setGeneratedCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleImport = async () => {
    const selected = generatedCards.filter((c) => c.selected);
    if (selected.length === 0) {
      setErrorMsg('Selecione pelo menos um cartão para importar.');
      return;
    }

    const isNew = selectedDeckId === 'new';
    const target = isNew ? newDeckName.trim() : selectedDeckId;
    if (isNew && !newDeckName.trim()) {
      setErrorMsg('Dê um nome para o novo baralho.');
      return;
    }

    try {
      await onImportCards(
        target,
        isNew,
        newDeckDescription.trim(),
        selected.map((c) => ({ front: c.front, back: c.back, context: c.context }))
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao importar os cartões.');
    }
  };

  const selectedCount = generatedCards.filter((c) => c.selected).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg sm:max-w-2xl rounded-2xl p-0 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-muted/10">
          <DialogTitle className="font-extrabold text-md text-foreground flex items-center gap-2">
            <Sparkles size={18} className="text-violet-500 animate-pulse" />
            Modo Deck Inteligente
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold p-3 rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Form Step */}
          {step === 'input' && (
            <div className="space-y-4">
              {!geminiApiKey.trim() ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 p-4 rounded-2xl flex flex-col gap-3">
                  <div className="flex gap-2 items-start text-xs font-bold">
                    <Key size={16} className="shrink-0 mt-0.5" />
                    <div>
                      Chave de API do Gemini não configurada!
                      <p className="font-normal text-muted-foreground mt-1">
                        Para usar a geração de IA gratuita, você precisa registrar sua própria chave nas configurações do app.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-amber-500/30 hover:bg-amber-500/20 text-amber-600 dark:text-amber-500 cursor-pointer text-xs h-9 rounded-xl font-bold"
                    onClick={() => {
                      onClose();
                      onNavigateToSettings();
                    }}
                  >
                    ⚙️ Configurar Chave nas Configurações
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="ai-topic">
                  Tema ou Assunto dos Flashcards *
                </label>
                <Input
                  id="ai-topic"
                  type="text"
                  placeholder="Ex: Frases comuns de viagem, Expressões de negócios, Verbos em inglês"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={!geminiApiKey.trim()}
                  className="bg-background border-border text-foreground focus-visible:ring-violet-500 focus-visible:border-violet-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="ai-count">
                    Quantidade de Cartões
                  </label>
                  <select
                    id="ai-count"
                    value={cardCount}
                    onChange={(e) => setCardCount(parseInt(e.target.value))}
                    disabled={!geminiApiKey.trim()}
                    className="bg-background border border-border text-foreground px-3 py-2 rounded-xl text-xs font-semibold outline-none cursor-pointer focus:border-violet-500/50 h-10"
                  >
                    <option value={5}>5 cartões</option>
                    <option value={10}>10 cartões</option>
                    <option value={15}>15 cartões</option>
                    <option value={20}>20 cartões (Max)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="ai-deck">
                    Destino (Salvar em)
                  </label>
                  <select
                    id="ai-deck"
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    disabled={!geminiApiKey.trim()}
                    className="bg-background border border-border text-foreground px-3 py-2 rounded-xl text-xs font-semibold outline-none cursor-pointer focus:border-violet-500/50 h-10"
                  >
                    <option value="new">[+] Criar Novo Baralho</option>
                    {decks?.map((d) => (
                      <option key={d.id} value={d.id}>
                        📁 {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedDeckId === 'new' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/20 border border-border rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="ai-new-deck-name">
                      Nome do Novo Baralho *
                    </label>
                    <Input
                      id="ai-new-deck-name"
                      type="text"
                      placeholder="Ex: Viagem, Business"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      disabled={!geminiApiKey.trim()}
                      className="bg-background border-border"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground" htmlFor="ai-new-deck-desc">
                      Descrição do Baralho (Opcional)
                    </label>
                    <Input
                      id="ai-new-deck-desc"
                      type="text"
                      placeholder="Ex: Vocabulário para usar nas férias"
                      value={newDeckDescription}
                      onChange={(e) => setNewDeckDescription(e.target.value)}
                      disabled={!geminiApiKey.trim()}
                      className="bg-background border-border"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="ai-instructions">
                  Instruções Adicionais / Foco (Opcional)
                </label>
                <Textarea
                  id="ai-instructions"
                  placeholder="Ex: Focar em gírias americanas, Usar vocabulário avançado C1, Manter frases bem curtas, Foco em gastronomia..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={!geminiApiKey.trim()}
                  className="bg-background border-border min-h-[70px] max-h-[140px] focus-visible:ring-violet-500 focus-visible:border-violet-500"
                />
              </div>
            </div>
          )}

          {/* Generating Step */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-6 animate-in fade-in duration-300">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin flex items-center justify-center" />
                <Sparkles size={24} className="text-violet-500 absolute top-5 left-5 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-md text-foreground tracking-tight">Gemini está pensando...</h3>
                <p className="text-xs text-violet-500 font-bold animate-pulse transition-all duration-500">
                  {loadingTexts[loadingStep]}
                </p>
              </div>
              <p className="text-[10.5px] text-muted-foreground max-w-xs leading-relaxed">
                Isso pode levar de 3 a 8 segundos dependendo da velocidade de conexão e tamanho do prompt.
              </p>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
                <span>Revise e edite os cartões antes de importar:</span>
                <span className="font-bold text-violet-500">
                  {selectedCount} de {generatedCards.length} selecionados
                </span>
              </div>

              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {generatedCards.map((card, index) => (
                  <div
                    key={card.id}
                    className={`border rounded-2xl p-4 transition-all relative ${
                      card.selected
                        ? 'border-violet-500/20 bg-violet-500/5'
                        : 'border-border bg-card opacity-60'
                    }`}
                  >
                    {/* Badge & Checkbox */}
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={card.selected}
                          onChange={() => toggleCardSelect(card.id)}
                          className="w-4 h-4 accent-violet-600 bg-muted border-border rounded cursor-pointer"
                        />
                        <span className="text-[10px] font-black text-muted-foreground">
                          CARD #{index + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCardSelect(card.id)}
                        className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                        title={card.selected ? 'Desativar este card' : 'Ativar este card'}
                      >
                        {card.selected ? 'Desmarcar' : 'Marcar'}
                      </button>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground">Frente (Inglês)</span>
                          <Input
                            value={card.front}
                            onChange={(e) => handleCardFieldChange(card.id, 'front', e.target.value)}
                            disabled={!card.selected}
                            className="bg-background border-border text-xs h-8 py-1 focus-visible:ring-violet-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground">Verso (Tradução)</span>
                          <Input
                            value={card.back}
                            onChange={(e) => handleCardFieldChange(card.id, 'back', e.target.value)}
                            disabled={!card.selected}
                            className="bg-background border-border text-xs h-8 py-1 focus-visible:ring-violet-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-muted-foreground">Contexto / Exemplo</span>
                        <Input
                          value={card.context}
                          onChange={(e) => handleCardFieldChange(card.id, 'context', e.target.value)}
                          disabled={!card.selected}
                          className="bg-background border-border text-xs h-8 py-1 focus-visible:ring-violet-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-5 border-t border-border bg-muted/10 flex flex-row gap-2.5 sm:justify-end">
          {step === 'input' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 sm:flex-initial border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer h-10 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!topic.trim() || !geminiApiKey.trim()}
                className="flex-1 sm:flex-initial bg-violet-600 hover:bg-violet-700 text-zinc-50 cursor-pointer h-10 text-xs rounded-xl gap-1"
              >
                Gerar com Gemini <ChevronRight size={14} />
              </Button>
            </>
          )}

          {step === 'generating' && (
            <Button
              type="button"
              variant="outline"
              disabled
              className="w-full border-border bg-muted/40 text-muted-foreground h-10 text-xs rounded-xl gap-1.5"
            >
              <Loader2 size={14} className="animate-spin" /> Aguardando resposta...
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('input')}
                className="flex-1 sm:flex-initial border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer h-10 text-xs rounded-xl gap-1"
              >
                <ArrowLeft size={13} /> Voltar
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="flex-1 sm:flex-initial bg-violet-600 hover:bg-violet-700 text-zinc-50 cursor-pointer h-10 text-xs rounded-xl gap-1 font-bold"
              >
                <CheckCircle2 size={13} /> Importar {selectedCount} Cartões
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      {toastMsg && (
        <Toast message={toastMsg} onClose={() => setToastMsg('')} type="error" />
      )}
    </Dialog>
  );
};
