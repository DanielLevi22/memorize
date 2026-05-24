import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, AlertCircle, Volume2 } from 'lucide-react';
import type { Card } from '../types';
import { getFriendlyInterval } from '../utils/srs';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

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

interface StudyArenaProps {
  deckName: string;
  cardsToStudy: Card[];
  onGradeCard: (card: Card, rating: number) => void;
  onCancel: () => void;
  onFinishSession: (studiedCount: number) => void;
}

export const StudyArena: React.FC<StudyArenaProps> = ({
  deckName,
  cardsToStudy,
  onGradeCard,
  onCancel,
  onFinishSession
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  const [isAudioTextRevealed, setIsAudioTextRevealed] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const totalCards = cardsToStudy.length;
  const currentCard = cardsToStudy[currentIndex];

  useEffect(() => {
    // Reset da revelação de texto para o novo card
    setIsAudioTextRevealed(false);

    let url: string | null = null;

    if (currentCard && currentCard.audio) {
      try {
        url = URL.createObjectURL(currentCard.audio);
        setAudioUrl(url);

        // Parar áudio anterior se estiver tocando
        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
          activeAudioRef.current = null;
        }

        const audio = new Audio(url);
        activeAudioRef.current = audio;
        setIsPlaying(true);
        audio.play().catch(e => {
          console.log("Auto-play impedido pelo navegador ou erro:", e);
          setIsPlaying(false);
        });

        audio.onended = () => {
          setIsPlaying(false);
        };
      } catch (err) {
        console.error("Erro ao carregar áudio:", err);
        setIsPlaying(false);
      }
    } else {
      setAudioUrl(null);
      setIsPlaying(false);
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
  }, [currentIndex, currentCard]);

  if (totalCards === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-10 gap-4 text-muted-foreground h-full">
        <AlertCircle size={44} className="text-muted-foreground/60" />
        <h3 className="font-bold text-lg text-foreground">Sem cartões para estudar</h3>
        <p className="text-sm max-w-[280px]">Este deck não possui cartões pendentes de revisão para hoje.</p>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer mt-2" onClick={onCancel}>
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const progressPercent = (currentIndex / totalCards) * 100;

  const handlePlayAudio = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!audioUrl) return;
    try {
      // Se já estiver tocando, pausa o áudio atual
      if (isPlaying && activeAudioRef.current) {
        activeAudioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      // Caso contrário, reinicia/toca o áudio
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
  };

  const handleReveal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentCard.audio && !isAudioTextRevealed) {
      setIsAudioTextRevealed(true);
    } else {
      setIsFlipped(true);
    }
  };

  const stopActiveAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleGrade = (rating: number) => {
    stopActiveAudio();
    onGradeCard(currentCard, rating);
    setStudiedCount(prev => prev + 1);

    const nextIndex = currentIndex + 1;
    if (nextIndex < totalCards) {
      setIsFlipped(false);
      setIsAudioTextRevealed(false);
      setTimeout(() => {
        setCurrentIndex(nextIndex);
      }, 200);
    } else {
      onFinishSession(studiedCount + 1);
    }
  };

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Navbar de Estudo */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer h-9 w-9" 
          onClick={onCancel} 
          title="Voltar"
        >
          <ArrowLeft size={18} />
        </Button>
        
        <div className="flex-1 mx-4 space-y-1.5">
          <Progress value={progressPercent} className="h-1.5 bg-muted" />
          <div className="text-[10px] text-muted-foreground text-right font-bold">
            {currentIndex} / {totalCards} cartões
          </div>
        </div>
      </div>

      <div className="text-center -mt-2">
        <span className="text-[10px] bg-card border border-border text-muted-foreground px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          {deckName.replace(/[^a-zA-Z0-9\s]/g, '').trim()}
        </span>
      </div>

      {/* 3D Card Area */}
      <div className="card-perspective w-full max-w-xl mx-auto h-[380px] sm:h-[420px] my-2" onClick={!isFlipped ? () => handleReveal() : undefined}>
        <div className={`flashcard-3d w-full h-full cursor-pointer ${isFlipped ? 'flipped' : ''}`}>
          
          {/* FRENTE DO CARD */}
          <div className="card-face front bg-card border border-border rounded-2xl p-6 flex flex-col shadow-xl relative break-words">
            <span className="self-start text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
              Frente
            </span>
            
            {/* Se tiver áudio e ainda não foi revelado o texto (Etapa 1) */}
            {currentCard.audio && !isAudioTextRevealed ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-20 h-20 rounded-full border-2 border-primary bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer shadow-md transition-transform duration-200 hover:scale-105"
                  onClick={handlePlayAudio}
                  title="Ouvir pronúncia"
                >
                  <Volume2 size={36} className={isPlaying ? 'animate-bounce text-primary' : 'text-primary'} />
                </Button>
                <div className="space-y-1">
                  <h2 className="font-extrabold text-lg text-foreground">Ouça a pronúncia</h2>
                  <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">Tente adivinhar a palavra/frase em inglês ao ouvir.</p>
                </div>
                <div className="text-[11px] text-muted-foreground mt-auto flex items-center gap-1">
                  💡 Toque na tela ou no botão abaixo para revelar o texto
                </div>
              </div>
            ) : (
              /* Caso contrário, mostra o texto normal em inglês (Etapa 2 ou sem áudio) */
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
                {audioUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 h-8 w-8 text-primary hover:bg-primary/10 rounded-full cursor-pointer shrink-0"
                    onClick={handlePlayAudio}
                    title="Ouvir áudio novamente"
                  >
                    <Volume2 size={16} className={isPlaying ? 'animate-pulse' : ''} />
                  </Button>
                )}
                <h2 
                  className="font-extrabold text-2xl tracking-tight text-foreground leading-snug"
                  dangerouslySetInnerHTML={{ __html: currentCard.front }}
                />
                {currentCard.context && (
                  <div 
                    className="text-sm text-muted-foreground font-medium italic p-3 bg-muted/30 border-l-2 border-primary rounded w-full leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const plainFront = stripHtmlTags(currentCard.front).trim();
                        try {
                          return plainFront 
                            ? currentCard.context.replace(new RegExp(`\\b${plainFront}\\b`, 'gi'), '______')
                            : currentCard.context;
                        } catch (e) {
                          return currentCard.context;
                        }
                      })()
                    }}
                  />
                )}
                <div className="text-[11px] text-muted-foreground mt-auto flex items-center gap-1">
                  💡 Toque para revelar o significado/tradução
                </div>
              </div>
            )}
          </div>

          {/* VERSO DO CARD */}
          <div className="card-face back bg-card border border-border rounded-2xl p-6 flex flex-col shadow-xl relative break-words">
            <span className="self-start text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-primary/20">
              Significado
            </span>
            
            {audioUrl && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 h-8 w-8 text-primary hover:bg-primary/10 rounded-full cursor-pointer shrink-0"
                onClick={handlePlayAudio}
                title="Ouvir áudio novamente"
              >
                <Volume2 size={16} className={isPlaying ? 'animate-pulse' : ''} />
              </Button>
            )}

            <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
              <span 
                className="text-sm text-muted-foreground font-semibold tracking-wide"
                dangerouslySetInnerHTML={{ __html: currentCard.front }}
              />
              <h3 
                className="font-bold text-xl text-primary leading-snug"
                dangerouslySetInnerHTML={{ __html: currentCard.back }}
              />
              
              {currentCard.context && (
                <div className="text-sm text-foreground font-medium italic p-3 bg-muted/30 border-l-2 border-primary rounded w-full text-left leading-relaxed">
                  <strong className="text-primary text-xs uppercase not-italic block mb-1">Exemplo:</strong>
                  <span dangerouslySetInnerHTML={{ __html: currentCard.context }} />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Controls Area */}
      <div className="mt-auto">
        {!isFlipped ? (
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl font-bold gap-2 cursor-pointer shadow-lg text-base" 
            onClick={() => handleReveal()}
          >
            <Eye size={16} />
            {currentCard.audio && !isAudioTextRevealed ? 'Revelar Texto (Inglês)' : 'Revelar Resposta'}
          </Button>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Button 
              className="flex flex-col h-auto py-3 rounded-xl font-bold bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-zinc-50 text-red-500 dark:text-red-400 text-sm gap-0.5 cursor-pointer"
              onClick={() => handleGrade(1)}
            >
              <span>Errei</span>
              <span className="text-[10px] font-medium opacity-70">
                {getFriendlyInterval(currentCard, 1)}
              </span>
            </Button>
            
            <Button 
              className="flex flex-col h-auto py-3 rounded-xl font-bold bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-zinc-950 dark:hover:text-zinc-950 text-amber-500 text-sm gap-0.5 cursor-pointer"
              onClick={() => handleGrade(2)}
            >
              <span>Difícil</span>
              <span className="text-[10px] font-medium opacity-70">
                {getFriendlyInterval(currentCard, 2)}
              </span>
            </Button>
            
            <Button 
              className="flex flex-col h-auto py-3 rounded-xl font-bold bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-zinc-50 text-emerald-600 dark:text-emerald-400 text-sm gap-0.5 cursor-pointer"
              onClick={() => handleGrade(3)}
            >
              <span>Fácil</span>
              <span className="text-[10px] font-medium opacity-70">
                {getFriendlyInterval(currentCard, 3)}
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
