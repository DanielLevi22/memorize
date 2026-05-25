import React, { useState, useEffect, useRef } from 'react';
import type { Card } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Volume2, Eye } from 'lucide-react';
import { getTagColors } from '../utils/tagColors';

const stripHtmlTags = (str: string) => {
  if (!str) return '';
  let clean = str.replace(/&nbsp;/g, ' ');
  clean = clean.replace(/<[^>]*>/g, '');
  try {
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    return doc.documentElement.textContent || clean;
  } catch (e) {
    return clean;
  }
};

interface CardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  card: Card | null;
  deckName: string;
}

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({
  isOpen,
  onClose,
  onEdit,
  card,
  deckName
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAudioTextRevealed, setIsAudioTextRevealed] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = (text: string, lang: 'en' | 'pt') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn("Speech Synthesis not supported in this browser");
      return;
    }
    
    window.speechSynthesis.cancel();
    
    const cleanText = stripHtmlTags(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'en' ? 'en-US' : 'pt-BR';
    
    setIsPlaying(true);
    utterance.onend = () => {
      setIsPlaying(false);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // Reset da revelação e flip ao abrir novo card
    setIsFlipped(false);
    setIsAudioTextRevealed(false);
    setIsPlaying(false);

    let url: string | null = null;
    if (card && card.audio && isOpen) {
      try {
        url = URL.createObjectURL(card.audio);
        setAudioUrl(url);

        // Auto-play do áudio ao abrir a pré-visualização
        const audio = new Audio(url);
        activeAudioRef.current = audio;
        setIsPlaying(true);
        audio.play().catch(e => {
          console.log("Auto-play blocked or failed:", e);
          setIsPlaying(false);
        });

        audio.onended = () => {
          setIsPlaying(false);
        };
      } catch (err) {
        console.error("Erro ao carregar áudio de pré-visualização:", err);
      }
    } else {
      setAudioUrl(null);
    }

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, [card, isOpen]);

  if (!card) return null;

  const handlePlayAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (card.audio) {
      if (!audioUrl) return;
      try {
        if (isPlaying && activeAudioRef.current) {
          activeAudioRef.current.pause();
          setIsPlaying(false);
          return;
        }

        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
          activeAudioRef.current = null;
        }

        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;
        setIsPlaying(true);
        audio.play().catch(() => setIsPlaying(false));
        audio.onended = () => {
          setIsPlaying(false);
          activeAudioRef.current = null;
        };
      } catch (err) {
        console.error(err);
        setIsPlaying(false);
      }
    } else {
      speakText(card.front, 'en');
    }
  };

  const handleReveal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (card.audio && !isAudioTextRevealed) {
      setIsAudioTextRevealed(true);
    } else {
      setIsFlipped(prev => !prev);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm sm:max-w-lg rounded-lg p-5">
        <DialogHeader className="pb-2 border-b border-border">
          <div>
            <DialogTitle className="font-semibold text-lg text-foreground">
              🔍 Pré-visualização do Card
            </DialogTitle>
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider block mt-0.5">
              Deck: {deckName.replace(/[^a-zA-Z0-9\s]/g, '').trim()}
            </span>
          </div>
        </DialogHeader>

        {/* 3D Card Area inside Modal */}
        <div className="card-perspective w-full max-w-md mx-auto h-[320px] my-3" onClick={() => handleReveal()}>
          <div className={`flashcard-3d w-full h-full cursor-pointer ${isFlipped ? 'flipped' : ''}`}>
            
            {/* FRENTE DO CARD */}
            <div className="card-face front bg-muted/40 border border-border rounded-2xl p-5 flex flex-col shadow-md relative break-words">
              <span className="self-start text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                Frente
              </span>
              
              {card.audio && !isAudioTextRevealed ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-16 h-16 rounded-full border border-primary bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105"
                    onClick={handlePlayAudio}
                    title="Ouvir pronúncia"
                  >
                    <Volume2 size={28} className={isPlaying ? 'animate-bounce text-primary' : 'text-primary'} />
                  </Button>
                  <div className="space-y-0.5">
                    <h2 className="font-bold text-base text-foreground">Ouça a pronúncia</h2>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">Toque no botão para ouvir o termo em inglês.</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 h-7 w-7 text-primary hover:bg-primary/10 rounded-full cursor-pointer"
                    onClick={handlePlayAudio}
                    title="Ouvir áudio"
                  >
                    <Volume2 size={14} className={isPlaying ? 'animate-pulse' : ''} />
                  </Button>
                  <h2 
                    className="font-extrabold text-xl tracking-tight text-foreground leading-snug"
                    dangerouslySetInnerHTML={{ __html: card.front }}
                  />
                  {card.context && (
                    <div 
                      className="text-xs text-muted-foreground font-medium italic p-2.5 bg-muted/30 border-l-2 border-primary rounded w-full leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: (() => {
                          const plainFront = stripHtmlTags(card.front).trim();
                          try {
                            return plainFront 
                              ? card.context.replace(new RegExp(`\\b${plainFront}\\b`, 'gi'), '______')
                              : card.context;
                          } catch (e) {
                            return card.context;
                          }
                        })()
                      }}
                    />
                  )}
                  {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mt-1">
                      {card.tags.map((tag, tIdx) => {
                        const colors = getTagColors(tag);
                        return (
                          <span key={tIdx} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                            #{tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* VERSO DO CARD */}
            <div className="card-face back bg-muted/40 border border-border rounded-2xl p-5 flex flex-col shadow-md relative break-words">
              <span className="self-start text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-primary/20">
                Significado
              </span>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 h-7 w-7 text-primary hover:bg-primary/10 rounded-full cursor-pointer"
                onClick={handlePlayAudio}
                title="Ouvir áudio"
              >
                <Volume2 size={14} className={isPlaying ? 'animate-pulse' : ''} />
              </Button>

              <div className="flex-1 flex flex-col justify-center items-center text-center gap-3">
                <span 
                  className="text-xs text-muted-foreground font-semibold tracking-wide"
                  dangerouslySetInnerHTML={{ __html: card.front }}
                />
                <h3 
                  className="font-bold text-lg text-primary leading-snug"
                  dangerouslySetInnerHTML={{ __html: card.back }}
                />
                
                {card.context && (
                  <div className="text-xs text-foreground font-medium italic p-2.5 bg-muted/30 border-l-2 border-primary rounded w-full text-left leading-relaxed">
                    <strong className="text-primary text-[10px] uppercase not-italic block mb-0.5">Exemplo:</strong>
                    <span dangerouslySetInnerHTML={{ __html: card.context }} />
                  </div>
                )}
                {card.tags && card.tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-1">
                    {card.tags.map((tag, tIdx) => {
                      const colors = getTagColors(tag);
                      return (
                        <span key={tIdx} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                          #{tag}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <DialogFooter className="flex flex-row gap-2 mt-2 sm:justify-end border-t border-border/50 pt-3">
          <Button 
            type="button"
            variant="outline"
            className="flex-1 sm:flex-initial border-border hover:bg-muted text-foreground cursor-pointer text-xs h-9 px-4 rounded-xl"
            onClick={onEdit}
          >
            ✏️ Editar
          </Button>
          <Button 
            type="button"
            variant="outline"
            className="flex-1 sm:flex-initial border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs h-9 px-4 rounded-xl"
            onClick={() => handleReveal()}
          >
            <Eye size={14} className="mr-1" />
            {isFlipped ? 'Ver Frente' : (card.audio && !isAudioTextRevealed ? 'Revelar Texto' : 'Ver Resposta')}
          </Button>
          <Button 
            type="button" 
            className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer text-xs h-9 px-4 rounded-xl font-bold"
            onClick={onClose}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
