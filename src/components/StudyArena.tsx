import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, AlertCircle, Volume2, Mic } from 'lucide-react';
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

const cleanString = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "") // remove punctuation
    .replace(/\s+/g, " ") // collaps spaces
    .trim();
};

interface StudyArenaProps {
  deckName: string;
  cardsToStudy: Card[];
  onGradeCard: (card: Card, rating: number) => void;
  onCancel: () => void;
  onFinishSession: (studiedCount: number) => void;
  studyMode?: 'classic' | 'writing' | 'speaking';
  ttsRate?: number;
  ttsVoice?: string;
  autoPlayAudio?: boolean;
}

export const StudyArena: React.FC<StudyArenaProps> = ({
  deckName,
  cardsToStudy,
  onGradeCard,
  onCancel,
  onFinishSession,
  studyMode = 'classic',
  ttsRate = 1.0,
  ttsVoice = '',
  autoPlayAudio = true
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  const [isAudioTextRevealed, setIsAudioTextRevealed] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Interactive Modes States
  const [typedAnswer, setTypedAnswer] = useState('');
  const [hasCheckedAnswer, setHasCheckedAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [spokenText, setSpokenText] = useState('');
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const recognitionRef = useRef<any>(null);

  const totalCards = cardsToStudy.length;
  const currentCard = cardsToStudy[currentIndex];

  const speakText = (text: string, lang: 'en' | 'pt') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn("Speech Synthesis not supported in this browser");
      return;
    }
    
    window.speechSynthesis.cancel();
    
    const cleanText = stripHtmlTags(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'en' ? 'en-US' : 'pt-BR';
    utterance.rate = ttsRate;

    // Apply selected voice if configured
    if (ttsVoice) {
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find(v => v.name === ttsVoice);
      if (matched) {
        utterance.voice = matched;
        utterance.lang = matched.lang;
      }
    }
    
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
    // Reset states for the new card
    setIsAudioTextRevealed(false);
    setTypedAnswer('');
    setHasCheckedAnswer(false);
    setIsAnswerCorrect(null);
    setSpokenText('');
    setIsListeningSpeech(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    let url: string | null = null;

    if (currentCard) {
      // Parar áudio anterior se estiver tocando
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      
      // Cancelar fala em andamento
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      if (currentCard.audio) {
        try {
          url = URL.createObjectURL(currentCard.audio);
          setAudioUrl(url);

          if (autoPlayAudio) {
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
          }
        } catch (err) {
          console.error("Erro ao carregar áudio:", err);
          setIsPlaying(false);
        }
      } else {
        setAudioUrl(null);
        setIsPlaying(false);
        // Auto-play do TTS em inglês (only when enabled)
        if (autoPlayAudio) {
          speakText(currentCard.front, 'en');
        }
      }
    }

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
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
    
    if (currentCard.audio) {
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
    } else {
      // Usar TTS nativo
      speakText(currentCard.front, 'en');
    }
  };

  const handleCheckWritingAnswer = () => {
    if (!typedAnswer.trim()) return;
    const expected = stripHtmlTags(currentCard.front);
    const correct = cleanString(typedAnswer) === cleanString(expected);
    setIsAnswerCorrect(correct);
    setHasCheckedAnswer(true);
    setIsFlipped(true);
  };

  const handleStartSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Reconhecimento de voz não é suportado neste navegador. Use o Chrome ou Edge.");
      return;
    }

    if (isListeningSpeech) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    setSpokenText('');
    setIsListeningSpeech(true);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setSpokenText(resultText);
        
        const expected = stripHtmlTags(currentCard.front);
        const correct = cleanString(resultText) === cleanString(expected);
        setIsAnswerCorrect(correct);
        setHasCheckedAnswer(true);
        setIsFlipped(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event);
        setIsListeningSpeech(false);
      };

      recognition.onend = () => {
        setIsListeningSpeech(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setIsListeningSpeech(false);
    }
  };

  const handleReveal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (studyMode === 'classic') {
      if (currentCard.audio && !isAudioTextRevealed) {
        setIsAudioTextRevealed(true);
      } else {
        setIsFlipped(true);
      }
    } else {
      setHasCheckedAnswer(true);
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

  // ⌨️ Keyboard shortcuts (defined after handlers are ready)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        onCancel();
      } else if ((e.key === ' ' || e.key === 'Spacebar') && !isFlipped) {
        e.preventDefault();
        handleReveal();
      } else if (e.key === '1' && isFlipped) {
        e.preventDefault(); handleGrade(1);
      } else if (e.key === '2' && isFlipped) {
        e.preventDefault(); handleGrade(2);
      } else if (e.key === '3' && isFlipped) {
        e.preventDefault(); handleGrade(3);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFlipped, onCancel]);

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
      <div 
        className="card-perspective w-full max-w-xl mx-auto h-[380px] sm:h-[420px] my-2" 
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('input')) {
            return;
          }
          if (studyMode === 'classic') {
            if (!isFlipped) handleReveal();
          } else {
            if (hasCheckedAnswer) {
              setIsFlipped(!isFlipped);
            }
          }
        }}
      >
        <div className={`flashcard-3d w-full h-full cursor-pointer ${isFlipped ? 'flipped' : ''}`}>
          
          {/* FRENTE DO CARD */}
          <div className="card-face front bg-card border border-border rounded-2xl p-6 flex flex-col shadow-xl relative break-words">
            <span className="self-start text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
              {studyMode === 'writing' ? '✍️ Modo Escrita' : studyMode === 'speaking' ? '🗣️ Modo Fala' : '🎴 Frente'}
            </span>
            
            {/* 1. MODO ESCRITA */}
            {studyMode === 'writing' ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-4 w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-16 h-16 rounded-full border-2 border-primary bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer shadow-md transition-transform duration-200 hover:scale-105"
                  onClick={handlePlayAudio}
                  title="Ouvir pronúncia"
                >
                  <Volume2 size={28} className={isPlaying ? 'animate-bounce text-primary' : 'text-primary'} />
                </Button>
                
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-foreground">Escute e digite o termo:</h3>
                  <p className="text-[10px] text-muted-foreground">O que você ouviu em inglês?</p>
                </div>

                <div className="w-full max-w-xs mt-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                    placeholder="Sua resposta..."
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCheckWritingAnswer();
                      }
                    }}
                    disabled={hasCheckedAnswer}
                    autoFocus
                  />
                </div>

                {hasCheckedAnswer && (
                  <div className="w-full p-2.5 rounded-xl border mt-2 text-left text-xs space-y-1 bg-muted/40 border-border">
                    {isAnswerCorrect ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-center">
                        🎉 Resposta Correta!
                      </span>
                    ) : (
                      <>
                        <span className="font-bold text-red-500 block text-center mb-1">
                          ❌ Ortografia Incorreta
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-zinc-400 block">Você digitou:</span>
                            <span className="font-bold text-foreground line-through decoration-red-500/50">{typedAnswer || '(Vazio)'}</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block">Esperado:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{stripHtmlTags(currentCard.front)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!hasCheckedAnswer ? (
                  <Button
                    type="button"
                    className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-md animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckWritingAnswer();
                    }}
                    disabled={!typedAnswer.trim()}
                  >
                    Verificar
                  </Button>
                ) : (
                  <div className="text-[9px] text-zinc-400 mt-auto">
                    💡 Resposta verificada. Avalie seu desempenho abaixo.
                  </div>
                )}
              </div>
            ) : studyMode === 'speaking' ? (
              /* 2. MODO FALA */
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-4 w-full">
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-14 h-14 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer shadow-sm transition-transform duration-200 hover:scale-105"
                    onClick={handlePlayAudio}
                    title="Ouvir pronúncia"
                  >
                    <Volume2 size={24} className={isPlaying ? 'animate-pulse text-primary' : ''} />
                  </Button>

                  <Button
                    type="button"
                    className={`w-14 h-14 rounded-full border-2 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-200 hover:scale-105 ${
                      isListeningSpeech
                        ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-4 ring-destructive/20'
                        : 'bg-primary/10 border-primary text-primary hover:bg-primary/20'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartSpeechRecognition();
                    }}
                    title={isListeningSpeech ? 'Parar microfone' : 'Gravar pronúncia'}
                  >
                    <Mic size={24} />
                  </Button>
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-foreground">Escute e fale o termo:</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {isListeningSpeech ? 'Ouvindo sua voz... Fale agora!' : 'Clique no microfone para pronunciar'}
                  </p>
                </div>

                {hasCheckedAnswer && (
                  <div className="w-full p-2.5 rounded-xl border mt-2 text-left text-xs space-y-1 bg-muted/40 border-border">
                    {isAnswerCorrect ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-center">
                        ✨ Excelente Pronúncia!
                      </span>
                    ) : (
                      <>
                        <span className="font-bold text-red-500 block text-center mb-1">
                          ❌ Pronúncia incorreta
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-zinc-400 block">Robô ouviu:</span>
                            <span className="font-bold text-foreground italic">"{spokenText || '(Silêncio)'}"</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 block">Esperado:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">"{stripHtmlTags(currentCard.front)}"</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!hasCheckedAnswer ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHasCheckedAnswer(true);
                      setIsFlipped(true);
                    }}
                  >
                    Revelar Resposta
                  </Button>
                ) : (
                  <div className="text-[9px] text-zinc-400 mt-auto">
                    💡 Pronúncia avaliada. Escolha uma nota abaixo para continuar.
                  </div>
                )}
              </div>
            ) : (
              /* 3. MODO CLÁSSICO */
              currentCard.audio && !isAudioTextRevealed ? (
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
                <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 h-8 w-8 text-primary hover:bg-primary/10 rounded-full cursor-pointer shrink-0"
                    onClick={handlePlayAudio}
                    title="Ouvir áudio"
                  >
                    <Volume2 size={16} className={isPlaying ? 'animate-pulse' : ''} />
                  </Button>
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
                  {currentCard.tags && currentCard.tags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mt-1">
                      {currentCard.tags.map((tag, tIdx) => (
                        <span key={tIdx} className="text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-auto flex items-center gap-1">
                    💡 Toque para revelar o significado/tradução
                  </div>
                </div>
              )
            )}
          </div>

          {/* VERSO DO CARD */}
          <div className="card-face back bg-card border border-border rounded-2xl p-6 flex flex-col shadow-xl relative break-words">
            <span className="self-start text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-primary/20">
              Significado
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 h-8 w-8 text-primary hover:bg-primary/10 rounded-full cursor-pointer shrink-0"
              onClick={handlePlayAudio}
              title="Ouvir áudio"
            >
              <Volume2 size={16} className={isPlaying ? 'animate-pulse' : ''} />
            </Button>

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
              {currentCard.tags && currentCard.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  {currentCard.tags.map((tag, tIdx) => (
                    <span key={tIdx} className="text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                      #{tag}
                    </span>
                  ))}
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
          <>
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
            {/* Shortcut hints */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[8px] font-bold">1</kbd> Errei
              </span>
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[8px] font-bold">2</kbd> Difícil
              </span>
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[8px] font-bold">3</kbd> Fácil
              </span>
            </div>
          </>
        )}
        {!isFlipped && (
          <div className="flex items-center justify-center mt-2">
            <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
              <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded text-[8px] font-bold">Espaço</kbd> revelar
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
