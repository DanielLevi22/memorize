import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles, Volume2, Plus, X, Loader2, Check } from 'lucide-react';
import { db } from '../db/db';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { syncNoteCards } from '../utils/siblings';
import { toast } from 'sonner';
import type { Note, Card } from '../types';

interface FloatingSelectionLookupProps {
  text: string;
  position: { top: number; left: number };
  onClose: () => void;
  geminiApiKey: string;
  readingTitle?: string;
}

export const FloatingSelectionLookup: React.FC<FloatingSelectionLookupProps> = ({
  text,
  position,
  onClose,
  geminiApiKey,
  readingTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'ipa' | 'figured'>('ipa');
  
  // IPA State
  const [ipaData, setIpaData] = useState<string | null>(null);
  const [ipaLoading, setIpaLoading] = useState(false);
  const [ipaError, setIpaError] = useState<string | null>(null);

  // Figured (IA) State
  const [figuredData, setFiguredData] = useState<{
    figured: string;
    translation: string;
    explanation?: string;
  } | null>(null);
  const [figuredLoading, setFiguredLoading] = useState(false);
  const [figuredError, setFiguredError] = useState<string | null>(null);

  // Deck integration
  const decks = useLiveQuery(() => db.decks.toArray()) || [];
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [cardCreating, setCardCreating] = useState(false);
  const [cardCreated, setCardCreated] = useState(false);

  // Pre-select first deck if available
  useEffect(() => {
    if (decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  // Reset states when lookup text changes
  useEffect(() => {
    setIpaData(null);
    setIpaError(null);
    setIpaLoading(false);
    setFiguredData(null);
    setFiguredError(null);
    setFiguredLoading(false);
    setCardCreated(false);
  }, [text]);

  const handleFetchIpa = async () => {
    const cleanWord = text.trim();
    if (!cleanWord) return;
    
    // Dictionary API is only for single words
    if (cleanWord.includes(' ')) {
      setIpaError('IPA está disponível apenas para palavras simples.');
      return;
    }

    setIpaLoading(true);
    setIpaError(null);

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`);
      if (!response.ok) {
        throw new Error('Palavra não encontrada no dicionário.');
      }
      const data = await response.json();
      
      // Look for phonetic notation
      let foundIpa = '';
      if (Array.isArray(data) && data[0]) {
        if (data[0].phonetic) {
          foundIpa = data[0].phonetic;
        } else if (Array.isArray(data[0].phonetics)) {
          const withText = data[0].phonetics.find((p: any) => p.text);
          if (withText) foundIpa = withText.text;
        }
      }

      if (foundIpa) {
        setIpaData(foundIpa);
      } else {
        setIpaError('Transcrição fonética não disponível.');
      }
    } catch (err: any) {
      setIpaError(err.message || 'Erro ao carregar IPA.');
    } finally {
      setIpaLoading(false);
    }
  };

  const handleFetchFigured = async () => {
    if (!geminiApiKey.trim()) {
      setFiguredError('Chave do Gemini não configurada nas Configurações.');
      return;
    }

    setFiguredLoading(true);
    setFiguredError(null);

    try {
      const promptText = `
Você é um especialista em ensino de idiomas e fonética.
Forneça a transcrição fonética aportuguesada (pronúncia figurada simplificada para brasileiros falantes de português) e a tradução do seguinte termo ou frase: "${text}".

Sua resposta DEVE ser estritamente no formato JSON com as chaves:
- "word": o termo original
- "figured": a pronúncia aportuguesada/figurada sugerida (ex: para "think" vira "fink", para "house" vira "raus", para "computer" vira "compiúter", para "what do you mean" vira "uót du iú mín")
- "translation": a tradução correspondente em português do Brasil
- "explanation": uma explicação bem resumida (opcional, máx 15 palavras) sobre o significado.
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  word: { type: 'STRING' },
                  figured: { type: 'STRING' },
                  translation: { type: 'STRING' },
                  explanation: { type: 'STRING' }
                },
                required: ['word', 'figured', 'translation']
              }
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Falha na resposta da API Gemini.');
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('A IA não retornou um formato estruturado válido.');
      }

      const parsed = JSON.parse(rawText);
      setFiguredData({
        figured: parsed.figured,
        translation: parsed.translation,
        explanation: parsed.explanation
      });
    } catch (err: any) {
      setFiguredError(err.message || 'Erro ao processar com IA.');
    } finally {
      setFiguredLoading(false);
    }
  };

  const handleCreateAnkiCard = async () => {
    if (!selectedDeckId) {
      toast.error('Selecione um baralho.');
      return;
    }

    setCardCreating(true);
    try {
      const noteId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      
      const translationVal = figuredData?.translation || 'Sem tradução';
      const ipaVal = ipaData ? `[AFI/IPA: ${ipaData}]` : '';
      const figuredVal = figuredData?.figured ? `[Pronúncia: "${figuredData.figured}"]` : '';
      const explanationVal = figuredData?.explanation ? `Explicação: ${figuredData.explanation}` : '';

      const detailList = [ipaVal, figuredVal, explanationVal].filter(Boolean).join('\n');

      const newNote: Note = {
        id: noteId,
        deckId: selectedDeckId,
        type: 'basic',
        fields: [
          text, // Frente
          `${translationVal}${detailList ? `\n\n${detailList}` : ''}`, // Verso
          ''
        ],
        tags: ['pronunciacao-flutuante'],
        context: readingTitle || 'Leitura rápida',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const { toAdd } = syncNoteCards(newNote, []);
      await db.notes.add(newNote);
      await db.cards.bulkAdd(toAdd);

      setCardCreated(true);
      toast.success('Card adicionado com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao criar card: ${err.message}`);
    } finally {
      setCardCreating(false);
    }
  };

  // Determine if we can export (if we have at least some loaded pronunciation or translation)
  const canExport = !!(ipaData || figuredData);

  return (
    <div
      id="floating-selection-lookup"
      className="absolute backdrop-blur-md bg-card/95 border border-border/80 shadow-2xl rounded-2xl p-4 w-72 z-50 animate-fadeIn select-none"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-12px'
      }}
    >
      {/* Seta do balão pointing down */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[50%] w-3 h-3 bg-card/95 border-r border-b border-border/80 rotate-45" />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[200px]" title={text}>
          "{text}"
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      {/* Selector Tabs */}
      <div className="flex gap-1 mt-2.5 p-0.5 bg-muted rounded-xl border border-border/30">
        <button
          onClick={() => setActiveTab('ipa')}
          className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
            activeTab === 'ipa'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          🗣️ IPA / AFI
        </button>
        <button
          onClick={() => setActiveTab('figured')}
          className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
            activeTab === 'figured'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ✨ Figurada (IA)
        </button>
      </div>

      {/* Tab Contents */}
      <div className="py-3 min-h-[70px] flex flex-col justify-center">
        {activeTab === 'ipa' ? (
          <div>
            {ipaData ? (
              <div className="space-y-1.5 text-center">
                <span className="text-xs text-muted-foreground font-semibold">Pronúncia AFI / IPA</span>
                <p className="text-base font-extrabold text-primary font-mono tracking-wide">{ipaData}</p>
              </div>
            ) : ipaLoading ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                <Loader2 size={16} className="text-primary animate-spin" />
                <span className="text-[10px] font-semibold text-muted-foreground">Buscando transcrição...</span>
              </div>
            ) : ipaError ? (
              <p className="text-[10px] text-destructive font-medium text-center leading-relaxed">
                {ipaError}
              </p>
            ) : (
              <div className="text-center py-1">
                <Button
                  onClick={handleFetchIpa}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-[10px] font-bold h-7 cursor-pointer"
                >
                  Consultar IPA/AFI
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {figuredData ? (
              <div className="space-y-2">
                <div className="text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold block">Pronúncia Figurada (Aportuguesada)</span>
                  <p className="text-sm font-extrabold text-violet-500 tracking-wide">"{figuredData.figured}"</p>
                </div>
                <div className="border-t border-border/30 pt-1.5 text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold block">Tradução</span>
                  <p className="text-xs font-bold text-foreground">{figuredData.translation}</p>
                  {figuredData.explanation && (
                    <p className="text-[9px] text-muted-foreground/80 mt-0.5 leading-relaxed italic">
                      {figuredData.explanation}
                    </p>
                  )}
                </div>
              </div>
            ) : figuredLoading ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                <Loader2 size={16} className="text-violet-500 animate-spin" />
                <span className="text-[10px] font-semibold text-muted-foreground">IA analisando fonética...</span>
              </div>
            ) : figuredError ? (
              <p className="text-[10px] text-destructive font-medium text-center leading-relaxed">
                {figuredError}
              </p>
            ) : (
              <div className="text-center py-1">
                <Button
                  onClick={handleFetchFigured}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-[10px] font-bold h-7 cursor-pointer border-violet-500/30 hover:bg-violet-500/5 text-violet-500"
                >
                  Consultar IA Gemini
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export to Anki */}
      {canExport && (
        <div className="border-t border-border/40 pt-2.5 mt-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap uppercase tracking-wider">
              Baralho:
            </span>
            <Select value={selectedDeckId} onValueChange={setSelectedDeckId} disabled={cardCreating || cardCreated}>
              <SelectTrigger className="flex-1 bg-muted/60 border-border/60 text-foreground px-2.5 h-6 rounded-lg text-[9px] font-bold">
                <SelectValue placeholder="Baralho..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 shadow-xl max-h-[150px]">
                {decks.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id} className="rounded-lg text-[10px] font-medium cursor-pointer">
                    📚 {deck.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCreateAnkiCard}
            disabled={cardCreating || cardCreated || !selectedDeckId}
            className={`w-full text-[10px] font-black h-8 rounded-xl cursor-pointer transition-all ${
              cardCreated
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {cardCreating ? (
              <><Loader2 size={11} className="animate-spin" /> Criando Card...</>
            ) : cardCreated ? (
              <><Check size={11} /> Card Adicionado!</>
            ) : (
              <><Plus size={11} /> Criar Card no Anki</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
