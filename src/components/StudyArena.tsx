import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, AlertCircle, Volume2, Mic } from 'lucide-react';
import type { Card, DeckPreset } from '../types';
import { getFriendlyInterval, calculateNextReview } from '../utils/srs';
import { areCardSiblings } from '../utils/limits';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { getTagColors } from '../utils/tagColors';
import { KeyboardShortcutCheatsheet } from './KeyboardShortcutCheatsheet';

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
  onGradeCard: (card: Card, rating: number, duration?: number) => void;
  onCancel: () => void;
  onFinishSession: (studiedCount: number) => void;
  studyMode?: 'classic' | 'writing' | 'speaking';
  ttsRate?: number;
  ttsVoice?: string;
  autoPlayAudio?: boolean;
  preset?: DeckPreset;
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
  autoPlayAudio = true,
  preset
}) => {
  const [sessionQueue, setSessionQueue] = useState<Card[]>(() => [...cardsToStudy]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  const [isAudioTextRevealed, setIsAudioTextRevealed] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSessionQueue([...cardsToStudy]);
    setCurrentIndex(0);
    setStudiedCount(0);
  }, [cardsToStudy]);

  // Timer State
  const [seconds, setSeconds] = useState(0);
  // Auto-advance countdown progress (0-100)
  const [autoAdvanceProgress, setAutoAdvanceProgress] = useState<number | null>(null);
  const autoAdvanceStartRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Interactive Modes States
  const [typedAnswer, setTypedAnswer] = useState('');
  const [hasCheckedAnswer, setHasCheckedAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [spokenText, setSpokenText] = useState('');
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const recognitionRef = useRef<any>(null);
  const cardStartTimeRef = useRef<number>(Date.now());

  const totalCards = sessionQueue.length;
  const currentCard = sessionQueue[currentIndex];

  const speakText = (text: string, lang: 'en' | 'pt', onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn("Speech Synthesis not supported in this browser");
      if (onEnd) onEnd();
      return;
    }
    
    window.speechSynthesis.cancel();
    
    const cleanText = stripHtmlTags(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'en' ? 'en-US' : 'pt-BR';
    utterance.rate = ttsRate;

    // Apply selected voice if configured
    if (ttsVoice && lang === 'en') {
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
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      if (onEnd) onEnd();
    };
    
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    // Reset states for the new card
    cardStartTimeRef.current = Date.now();
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
    const shouldAutoplay = preset ? !preset.disableAutoplay : autoPlayAudio;

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

          if (shouldAutoplay) {
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
        if (shouldAutoplay) {
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

  // Autoplay ao revelar a resposta (verso)
  useEffect(() => {
    if (isFlipped && currentCard) {
      const shouldAutoplay = preset ? !preset.disableAutoplay : autoPlayAudio;
      if (shouldAutoplay) {
        // Para parar qualquer áudio em andamento antes de iniciar a resposta
        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
          activeAudioRef.current = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        setIsPlaying(false);

        // Tocar a resposta sequencialmente ou apenas o verso
        const shouldSkipQuestion = preset?.skipQuestionOnReplay;
        if (shouldSkipQuestion) {
          // Apenas o verso
          speakText(currentCard.back, 'pt');
        } else {
          // Frente + Verso sequencial
          if (currentCard.audio) {
            if (audioUrl) {
              try {
                const audio = new Audio(audioUrl);
                activeAudioRef.current = audio;
                setIsPlaying(true);
                audio.play().catch(() => setIsPlaying(false));
                audio.onended = () => {
                  activeAudioRef.current = null;
                  speakText(currentCard.back, 'pt');
                };
              } catch (err) {
                console.error(err);
                setIsPlaying(false);
              }
            }
          } else {
            speakText(currentCard.front, 'en', () => {
              speakText(currentCard.back, 'pt');
            });
          }
        }
      }
    }
  }, [isFlipped, currentCard, audioUrl, preset?.disableAutoplay, preset?.skipQuestionOnReplay, autoPlayAudio]);

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
    if (!currentCard) return;

    // Se já estiver tocando, a gente interrompe a reprodução ativa
    if (isPlaying) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    const shouldSkipQuestion = isFlipped && preset?.skipQuestionOnReplay;

    if (!isFlipped || shouldSkipQuestion) {
      // Frente, ou verso com skipQuestionOnReplay = true (toca apenas o respectivo lado)
      if (!isFlipped) {
        if (currentCard.audio) {
          if (!audioUrl) return;
          try {
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
          speakText(currentCard.front, 'en');
        }
      } else {
        // Verso com skipQuestionOnReplay = true (apenas o verso)
        speakText(currentCard.back, 'pt');
      }
    } else {
      // Verso com skipQuestionOnReplay = false (toca sequencialmente: frente e depois verso)
      if (currentCard.audio) {
        if (!audioUrl) return;
        try {
          const audio = new Audio(audioUrl);
          activeAudioRef.current = audio;
          setIsPlaying(true);
          audio.play().catch(() => setIsPlaying(false));
          audio.onended = () => {
            activeAudioRef.current = null;
            speakText(currentCard.back, 'pt');
          };
        } catch (err) {
          console.error(err);
          setIsPlaying(false);
        }
      } else {
        speakText(currentCard.front, 'en', () => {
          speakText(currentCard.back, 'pt');
        });
      }
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

  const getInsertOffset = (stepDelay: string, remainingCards: number): number => {
    const match = stepDelay.trim().match(/^(\d+)([smhd])$/);
    if (!match) return Math.max(1, remainingCards);

    const val = parseInt(match[1], 10);
    const unit = match[2];

    let minutes = val;
    if (unit === 's') minutes = val / 60;
    if (unit === 'h') minutes = val * 60;
    if (unit === 'd') minutes = val * 24 * 60;

    // 1 minuto = ~3 cards; 10 minutos = ~10 cards
    const offset = Math.ceil(minutes * 3);
    return Math.max(1, Math.min(offset, remainingCards));
  };

  const handleGrade = (rating: number) => {
    stopActiveAudio();
    const elapsedSeconds = (Date.now() - cardStartTimeRef.current) / 1000;
    const maxSec = preset?.maxAnswerSeconds || 60;
    const duration = Math.min(elapsedSeconds, maxSec);

    onGradeCard(currentCard, rating, parseFloat(duration.toFixed(2)));
    setStudiedCount(prev => prev + 1);

    const nextFields = calculateNextReview(currentCard, rating, preset);
    let nextQueue = [...sessionQueue];

    // Se o card continuar em aprendizado (interval === 0) no preset clássico
    if (nextFields.interval === 0 && preset && !preset.fsrsEnabled) {
      const stepsStr = nextFields.lapseInterval !== undefined
        ? (preset.relearningSteps || '10m')
        : (preset.learningSteps || '1m 10m');
      
      const steps = stepsStr.split(/\s+/).filter(Boolean);
      const stepIdx = nextFields.learningStep ?? 0;
      const stepDelay = steps[Math.min(stepIdx, steps.length - 1)] || '1m';

      const updatedCard: Card = {
        ...currentCard,
        ...nextFields,
      };

      const nextIndex = currentIndex + 1;
      const remainingCards = sessionQueue.length - nextIndex;
      const offset = getInsertOffset(stepDelay, remainingCards);
      
      nextQueue.splice(nextIndex + offset, 0, updatedCard);
    }

    const nextIndex = currentIndex + 1;

    // Filtro dinâmico de descarte de cartões irmãos (Bury Siblings)
    if (preset && (preset.buryNewSiblings || preset.buryReviewSiblings || preset.buryLearningSiblings)) {
      const isLearningCard = (c: Card) => (c.interval === 0 && c.learningStep !== undefined) || (c.interval > 0 && c.repetitions <= 1);
      const isReviewCard = (c: Card) => c.interval > 0 && c.repetitions > 1;
      const isNewCard = (c: Card) => c.interval === 0 && c.learningStep === undefined;

      const finalQueue = nextQueue.slice(0, nextIndex);
      const remainingQueue = nextQueue.slice(nextIndex);

      const filteredRemaining = remainingQueue.filter(card => {
        const isSib = areCardSiblings(currentCard, card);
        if (isSib) {
          let shouldBury = false;
          if (isNewCard(card) && preset.buryNewSiblings) shouldBury = true;
          if (isReviewCard(card) && preset.buryReviewSiblings) shouldBury = true;
          if (isLearningCard(card) && preset.buryLearningSiblings) shouldBury = true;

          if (shouldBury) {
            return false; // Remove / enterra
          }
        }
        return true;
      });

      nextQueue = [...finalQueue, ...filteredRemaining];
    }

    setSessionQueue(nextQueue);

    if (nextIndex < nextQueue.length) {
      setIsFlipped(false);
      setIsAudioTextRevealed(false);
      setTimeout(() => {
        setCurrentIndex(nextIndex);
      }, 200);
    } else {
      onFinishSession(studiedCount + 1);
    }
  };

  // 1. Cronômetro de estudo para o cartão atual
  useEffect(() => {
    if (!currentCard) return;
    
    setSeconds(0);
    
    // Se stopTimerOnAnswer for verdadeiro e a carta estiver virada, pausa o tempo
    const shouldTick = !(isFlipped && preset?.stopTimerOnAnswer);
    
    if (!shouldTick) return;
    
    const interval = setInterval(() => {
      setSeconds(prev => {
        const maxSec = preset?.maxAnswerSeconds || 60;
        if (prev >= maxSec) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentIndex, isFlipped, currentCard, preset?.stopTimerOnAnswer, preset?.maxAnswerSeconds]);

  // 2. Avanço Automático
  useEffect(() => {
    // Limpa timers anteriores
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
    autoAdvanceTimerRef.current = null;
    autoAdvanceIntervalRef.current = null;
    setAutoAdvanceProgress(null);

    if (!currentCard) return;
    // Se waitForAudio estiver ativo e áudio ainda estiver tocando, aguardar
    if (preset?.waitForAudio && isPlaying) return;

    const startCountdown = (delaySec: number, onExpire: () => void) => {
      if (delaySec <= 0) return;
      autoAdvanceStartRef.current = Date.now();
      setAutoAdvanceProgress(100);

      autoAdvanceIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - (autoAdvanceStartRef.current ?? Date.now())) / 1000;
        const pct = Math.max(0, ((delaySec - elapsed) / delaySec) * 100);
        setAutoAdvanceProgress(pct);
      }, 50);

      autoAdvanceTimerRef.current = setTimeout(() => {
        if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
        setAutoAdvanceProgress(null);
        onExpire();
      }, delaySec * 1000);
    };

    const executeAnswerAction = () => {
      const action = preset?.answerAction ?? 'good';
      if (action === 'again') handleGrade(1);
      else if (action === 'hard') handleGrade(2);
      else if (action === 'good') handleGrade(3);
      else if (action === 'easy') handleGrade(4);
      else if (action === 'bury') handleGrade(1); // bury: grade as again, sibling logic handles the rest
      // 'skip': just call next without grading — advance index
      else setCurrentIndex(prev => Math.min(prev + 1, sessionQueue.length - 1));
    };

    if (!isFlipped) {
      const delay = preset?.autoShowAnswerSeconds ?? 0;
      startCountdown(delay, () => {
        if (preset?.questionAction === 'bury') {
          handleGrade(1);
        } else {
          handleReveal();
        }
      });
    } else {
      const delay = preset?.autoShowQuestionSeconds ?? 0;
      startCountdown(delay, executeAnswerAction);
    }

    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
      setAutoAdvanceProgress(null);
    };
  }, [currentIndex, isFlipped, isPlaying, preset?.autoShowAnswerSeconds, preset?.autoShowQuestionSeconds, preset?.waitForAudio, preset?.questionAction, preset?.answerAction]);

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
      } else if (e.key === '4' && isFlipped) {
        e.preventDefault(); handleGrade(4);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePlayAudio();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFlipped, onCancel, currentIndex, audioUrl, isPlaying]);

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Navbar de Estudo */}
      <div className="flex items-center justify-between pb-2 border-b border-border gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer h-9 w-9 shrink-0" 
          onClick={onCancel} 
          title="Voltar"
        >
          <ArrowLeft size={18} />
        </Button>

        {preset?.showTimer && (() => {
          const maxSec = preset.maxAnswerSeconds || 60;
          const isNearLimit = seconds >= maxSec * 0.8;
          const isAtLimit = seconds >= maxSec;
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          const display = mins > 0
            ? `${mins}:${String(secs).padStart(2, '0')}`
            : `${secs}s`;
          return (
            <div className={`flex items-center gap-1 border text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 transition-colors ${
              isAtLimit
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : isNearLimit
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-muted/40 border-border text-muted-foreground'
            }`}>
              ⏱️ {display}
            </div>
          );
        })()}
        
        <div className="flex-1 mx-4 space-y-1.5">
          <Progress value={progressPercent} className="h-1.5 bg-muted" />
          <div className="text-[10px] text-muted-foreground text-right font-bold">
            {currentIndex} / {totalCards} cartões
          </div>
          {/* Barra de contagem regressiva do Auto Avanço */}
          {autoAdvanceProgress !== null && (
            <div className="relative w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-none"
                style={{
                  width: `${autoAdvanceProgress}%`,
                  background: isFlipped
                    ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(260 80% 65%))'
                    : 'linear-gradient(90deg, hsl(38 95% 55%), hsl(25 95% 55%))',
                }}
              />
            </div>
          )}
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
                  {currentCard.tags.map((tag, tIdx) => {
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
            <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Button 
                className="flex flex-col h-auto py-3 rounded-xl font-bold bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-zinc-50 text-red-500 dark:text-red-400 text-sm gap-0.5 cursor-pointer"
                onClick={() => handleGrade(1)}
              >
                <span>Errei</span>
                <span className="text-[10px] font-medium opacity-70">
                  {getFriendlyInterval(currentCard, 1, preset)}
                </span>
              </Button>
              <Button 
                className="flex flex-col h-auto py-3 rounded-xl font-bold bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-zinc-950 dark:hover:text-zinc-950 text-amber-500 text-sm gap-0.5 cursor-pointer"
                onClick={() => handleGrade(2)}
              >
                <span>Difícil</span>
                <span className="text-[10px] font-medium opacity-70">
                  {getFriendlyInterval(currentCard, 2, preset)}
                </span>
              </Button>
              <Button 
                className="flex flex-col h-auto py-3 rounded-xl font-bold bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500 hover:text-zinc-50 text-sky-600 dark:text-sky-400 text-sm gap-0.5 cursor-pointer"
                onClick={() => handleGrade(3)}
              >
                <span>Bom</span>
                <span className="text-[10px] font-medium opacity-70">
                  {getFriendlyInterval(currentCard, 3, preset)}
                </span>
              </Button>
              <Button 
                className="flex flex-col h-auto py-3 rounded-xl font-bold bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-zinc-50 text-emerald-600 dark:text-emerald-400 text-sm gap-0.5 cursor-pointer"
                onClick={() => handleGrade(4)}
              >
                <span>Fácil</span>
                <span className="text-[10px] font-medium opacity-70">
                  {getFriendlyInterval(currentCard, 4, preset)}
                </span>
              </Button>
            </div>
            {/* Shortcut hints */}
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[8px] font-bold">1</kbd> Errei
              </span>
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[8px] font-bold">2</kbd> Difícil
              </span>
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[8px] font-bold">3</kbd> Bom
              </span>
              <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[8px] font-bold">4</kbd> Fácil
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

      <KeyboardShortcutCheatsheet
        positionClassName="fixed bottom-6 right-6"
        shortcuts={[
          { keys: ['Espaço', 'Enter'], description: 'Revelar resposta' },
          { keys: ['1'], description: 'Avaliar como "Errei"' },
          { keys: ['2'], description: 'Avaliar como "Difícil"' },
          { keys: ['3'], description: 'Avaliar como "Bom"' },
          { keys: ['4'], description: 'Avaliar como "Fácil"' },
          { keys: ['R'], description: 'Repetir Áudio / TTS' },
          { keys: ['Esc'], description: 'Sair dos estudos' },
        ]}
      />
    </div>
  );
};
