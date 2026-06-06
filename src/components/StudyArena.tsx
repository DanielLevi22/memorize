import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Eye, AlertCircle, Volume2, Mic, Lock, Languages, RefreshCw, Pause } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import type { Card, DeckPreset } from '../types';
import { 
  getFriendlyInterval, 
  calculateNextReview,
  getLevenshteinDistance,
  getWordLevenshteinDistance,
  diffStrings,
  diffWords,
  type DiffChar,
  type DiffWord
} from '../utils/srs';
import { areCardSiblings } from '../utils/limits';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { getTagColors } from '../utils/tagColors';
import { KeyboardShortcutCheatsheet } from './KeyboardShortcutCheatsheet';


import { translateWithMyMemory } from '../utils/readingProcessor';

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
  preset,
}) => {
  const [sessionQueue, setSessionQueue] = useState<Card[]>(() => [...cardsToStudy]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  const [isAudioTextRevealed, setIsAudioTextRevealed] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const [activeSelectedGrade, setActiveSelectedGrade] = useState<number | null>(null);
  const [animatingGrade, setAnimatingGrade] = useState<number | null>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const mouseDragStartRef = useRef<{ x: number; y: number } | null>(null);


  // Tradução
  const [selectedText, setSelectedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<string | null>(null);

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';
      if (text && text.length < 100) { // Limit length to avoid translating huge blocks
         setSelectedText(text);
      } else {
         setSelectedText('');
      }
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, []);

  useEffect(() => {
    setTranslationResult(null); // Reset when selection changes
  }, [selectedText]);

  const handleTranslateSelection = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedText || isTranslating) return;
    setIsTranslating(true);
    try {
      const res = await translateWithMyMemory(selectedText);
      setTranslationResult(res);
    } catch (err) {
      setTranslationResult('Erro ao traduzir');
    } finally {
      setIsTranslating(false);
    }
  };

  // Inicializa a fila de sessão quando os cartões carregam pela primeira vez.
  // Evita redefinir a fila e resetar o progresso no meio dos estudos quando ocorrem atualizações no banco.
  useEffect(() => {
    if (sessionQueue.length === 0 && cardsToStudy.length > 0) {
      setSessionQueue([...cardsToStudy]);
    }
  }, [cardsToStudy, sessionQueue.length]);

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
  const [isAlmostCorrect, setIsAlmostCorrect] = useState(false);
  const [charDiffs, setCharDiffs] = useState<DiffChar[]>([]);
  const [wordDiffs, setWordDiffs] = useState<DiffWord[]>([]);
  const [speechSimilarity, setSpeechSimilarity] = useState<number | null>(null);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [lockedGrade, setLockedGrade] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const cardStartTimeRef = useRef<number>(Date.now());

  const getRecommendedGrade = (): number | null => {
    if (studyMode === 'classic') return null;
    if (lockedGrade !== null) return lockedGrade;
    if (!hasCheckedAnswer) return null;

    if (studyMode === 'writing') {
      if (!typedAnswer.trim()) {
        return 1; // Errei
      }
      if (isAnswerCorrect) {
        return isAlmostCorrect ? 2 : 3; // 2: Difícil, 3: Bom
      }
      return 1; // Errei
    }

    if (studyMode === 'speaking') {
      if (speechSimilarity === null) {
        return 1; // Errei (no voice recognized or skipped)
      }
      if (speechSimilarity === 100) {
        return 3; // Bom
      }
      if (speechSimilarity >= 80) {
        return 2; // Difícil (almost correct)
      }
      return 1; // Errei (<80%)
    }

    return null;
  };

  const totalCards = sessionQueue.length;
  const currentCard = sessionQueue[currentIndex];

  const isReversed = currentCard?.cardType === 'reversed';
  const termText = currentCard ? (isReversed ? currentCard.back : currentCard.front) : '';
  const meaningText = currentCard ? (isReversed ? currentCard.front : currentCard.back) : '';
  const isListeningFront = currentCard && (currentCard.audio || currentCard.cardType === 'listening') && !isAudioTextRevealed;

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
    setActiveSelectedGrade(null);
    setAnimatingGrade(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTypedAnswer('');
    setHasCheckedAnswer(false);
    setIsAnswerCorrect(null);
    setIsAlmostCorrect(false);
    setCharDiffs([]);
    setWordDiffs([]);
    setSpeechSimilarity(null);
    setIsListeningSpeech(false);
    setLockedGrade(null);
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
              activeAudioRef.current = null;
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
          speakText(termText, 'en');
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



  // Parar qualquer áudio ao revelar a resposta (verso)
  useEffect(() => {
    if (isFlipped && currentCard) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    }
  }, [isFlipped, currentCard]);

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

    // Se já estiver tocando, a gente interrompe a reprodução ativa (pausa)
    if (isPlaying) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
        }
      }
      setIsPlaying(false);
      return;
    }

    // Se já estiver pausado (áudio local ou TTS), retoma de onde parou
    if (activeAudioRef.current && activeAudioRef.current.paused) {
      setIsPlaying(true);
      activeAudioRef.current.play().catch(() => setIsPlaying(false));
      return;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
      setIsPlaying(true);
      window.speechSynthesis.resume();
      return;
    }

    // Toca do início se for a primeira reprodução ou se foi finalizada
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
      speakText(termText, 'en');
    }
  };

  const handleCheckWritingAnswer = () => {
    if (!typedAnswer.trim()) return;
    const expected = stripHtmlTags(termText);
    
    const cleanTyped = cleanString(typedAnswer);
    const cleanExpected = cleanString(expected);

    const isExact = cleanTyped === cleanExpected;
    let correct = isExact;
    let almost = false;

    if (!isExact) {
      const dist = getLevenshteinDistance(cleanTyped, cleanExpected);
      const threshold = cleanExpected.length <= 5 ? 1 : 2;
      
      if (dist <= threshold) {
        correct = true;
        almost = true;
      }
    }

    const diff = diffStrings(typedAnswer, expected);
    setCharDiffs(diff);

    setIsAnswerCorrect(correct);
    setIsAlmostCorrect(almost);
    setHasCheckedAnswer(true);

    setLockedGrade(prev => {
      if (prev !== null) return prev;
      let grade = 1;
      if (correct) {
        grade = almost ? 2 : 3;
      }
      return grade;
    });
  };

  const handleStartSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Reconhecimento de voz não é suportado neste navegador. Use o Chrome ou Edge.");
      return;
    }

    if (isListeningSpeech) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    setIsListeningSpeech(true);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        
        const expected = stripHtmlTags(termText);
        
        const cleanTyped = cleanString(resultText);
        const cleanExpected = cleanString(expected);
        
        const spokenWords = cleanTyped.split(/\s+/).filter(Boolean);
        const expectedWords = cleanExpected.split(/\s+/).filter(Boolean);
        
        let correct = false;
        let similarity = 0;
        if (spokenWords.length > 0 && expectedWords.length > 0) {
          const wordDist = getWordLevenshteinDistance(spokenWords, expectedWords);
          const maxWords = Math.max(spokenWords.length, expectedWords.length);
          similarity = Math.max(0, 1 - wordDist / maxWords) * 100;
          correct = similarity >= 80;
        } else {
          correct = cleanTyped === cleanExpected;
          similarity = correct ? 100 : 0;
        }

        const diff = diffWords(resultText, expected);
        setWordDiffs(diff);
        setSpeechSimilarity(similarity);

        setIsAnswerCorrect(correct);
        setHasCheckedAnswer(true);

        setLockedGrade(prev => {
          if (prev !== null) return prev;
          if (similarity === 100) return 3; // Bom
          if (similarity >= 80) return 2; // Difícil
          return 1; // Errei
        });
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
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (studyMode === 'classic') {
      if (isListeningFront) {
        setIsAudioTextRevealed(true);
      } else {
        setIsFlipped(true);
      }
    } else {
      setLockedGrade(prev => prev ?? 1);
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
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
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
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      onFinishSession(studiedCount + 1);
    }
  };

  const handleGradeWithAnimation = (rating: number) => {
    setAnimatingGrade(rating);
    setActiveSelectedGrade(rating);
    setTimeout(() => {
      handleGrade(rating);
      setAnimatingGrade(null);
      setActiveSelectedGrade(null);
    }, 350);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('textarea')) {
      return;
    }

    // Evita virar se houve arrasto de mouse (seleção de texto)
    if (mouseDragStartRef.current) {
      const dx = Math.abs(e.clientX - mouseDragStartRef.current.x);
      const dy = Math.abs(e.clientY - mouseDragStartRef.current.y);
      mouseDragStartRef.current = null;
      if (dx > 8 || dy > 8) {
        return;
      }
    }

    // Evita virar se houver seleção de texto ativa
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      return;
    }

    if (studyMode === 'classic') {
      if (!isFlipped) handleReveal();
    } else {
      if (hasCheckedAnswer) {
        setIsFlipped(!isFlipped);
      }
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
      } else if ((e.key === ' ' || e.key === 'Spacebar' || (e.key === 'Enter' && studyMode !== 'classic' && hasCheckedAnswer)) && !isFlipped) {
        e.preventDefault();
        handleReveal();
      } else if (e.key === 'Enter' && isFlipped) {
        e.preventDefault();
        const recGrade = getRecommendedGrade();
        if (recGrade !== null) {
          handleGradeWithAnimation(recGrade);
        } else {
          handleGradeWithAnimation(3); // Default to "Bom" (3) like Anki
        }
      } else if (['1', '2', '3', '4'].includes(e.key) && isFlipped) {
        if (studyMode === 'classic') {
          e.preventDefault();
          const keyGrade = parseInt(e.key, 10);
          const now = Date.now();
          const doublePressDelay = 800; // ms
          
          if (activeSelectedGrade === keyGrade && (now - lastKeyTimeRef.current) < doublePressDelay) {
            handleGradeWithAnimation(keyGrade);
          } else {
            setActiveSelectedGrade(keyGrade);
            lastKeyTimeRef.current = now;
          }
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlePlayAudio();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFlipped, onCancel, currentIndex, audioUrl, isPlaying, studyMode, hasCheckedAnswer, typedAnswer, isAnswerCorrect, isAlmostCorrect, speechSimilarity, lockedGrade, activeSelectedGrade]);

  // Calcular contadores de cartões restantes (estilo Anki)
  const remainingQueue = sessionQueue.slice(currentIndex);
  const isLearningCard = (c: Card) => (c.interval === 0 && c.learningStep !== undefined) || (c.interval > 0 && c.repetitions <= 1);
  const isReviewCard = (c: Card) => c.interval > 0 && c.repetitions > 1;
  const isNewCard = (c: Card) => c.interval === 0 && c.learningStep === undefined;

  const newRemainingCount = remainingQueue.filter(isNewCard).length;
  const learningRemainingCount = remainingQueue.filter(isLearningCard).length;
  const reviewRemainingCount = remainingQueue.filter(isReviewCard).length;

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

      <div className="flex items-center justify-center gap-1.5 -mt-2">
        <span className="text-[10px] bg-card border border-border text-muted-foreground px-3 py-1 rounded-full font-bold uppercase tracking-wider">
          {deckName.replace(/[^a-zA-Z0-9\s]/g, '').trim()}
        </span>
        <span className={`text-[10px] border px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm ${
          preset?.fsrsEnabled 
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-extrabold' 
            : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-extrabold'
        }`}>
          ⚡ {preset?.fsrsEnabled ? 'Algoritmo FSRS v4' : 'Algoritmo SM-2 (Legado)'}
        </span>
      </div>

      {/* 3D Card Area */}
      <div 
        className="card-perspective w-full max-w-xl mx-auto h-[380px] sm:h-[420px] my-2" 
        onMouseDown={handleMouseDown}
        onClick={handleCardClick}
      >
        <div className={`flashcard-3d w-full h-full cursor-pointer ${isFlipped ? 'flipped' : ''}`}>
          
          {/* FRENTE DO CARD */}
          <div className="card-face front bg-card border border-border rounded-2xl p-6 flex flex-col shadow-xl relative break-words">
            <span className="self-start text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
              {studyMode === 'writing' ? '✍️ Modo Escrita' : studyMode === 'speaking' ? '🗣️ Modo Fala' : '🎴 Frente'}
            </span>
            
            {/* 1. MODO ESCRITA */}
            {studyMode === 'writing' ? (
              <div className={`flex-1 flex flex-col justify-center items-center text-center ${hasCheckedAnswer ? 'gap-2.5' : 'gap-4'} w-full`}>
                <Button
                  type="button"
                  variant="outline"
                  className={`${hasCheckedAnswer ? 'w-10 h-10' : 'w-16 h-16'} rounded-full border-2 border-primary bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer shadow-md transition-all duration-200 hover:scale-105`}
                  onClick={handlePlayAudio}
                  title="Ouvir pronúncia"
                >
                  {isPlaying ? (
                    <Pause size={hasCheckedAnswer ? 18 : 28} className="text-primary animate-pulse" />
                  ) : (
                    <Volume2 size={hasCheckedAnswer ? 18 : 28} className="text-primary" />
                  )}
                </Button>
                
                {!hasCheckedAnswer && (
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-foreground">Escute e digite o termo:</h3>
                    <p className="text-[10px] text-muted-foreground">O que você ouviu em inglês?</p>
                  </div>
                )}

                <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                    placeholder="Sua resposta..."
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCheckWritingAnswer();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    disabled={hasCheckedAnswer}
                    autoFocus
                  />
                </div>

                {hasCheckedAnswer && (
                  <div className="w-full p-2.5 rounded-xl border mt-2 text-left text-xs space-y-2 bg-muted/40 border-border">
                    {isAnswerCorrect === null ? (
                      <span className="font-bold text-zinc-500 dark:text-zinc-400 block text-center">
                        ℹ️ Resposta Revelada
                      </span>
                    ) : isAnswerCorrect ? (
                      isAlmostCorrect ? (
                        <span className="font-bold text-amber-500 dark:text-amber-400 block text-center">
                          ⚠️ Quase Correto! (Erro de digitação leve)
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-center">
                          🎉 Resposta Correta!
                        </span>
                      )
                    ) : (
                      <span className="font-bold text-red-500 block text-center">
                        ❌ Ortografia Incorreta
                      </span>
                    )}

                    {isAnswerCorrect === null ? (
                      <div className="border-t border-border/40 pt-2 text-center">
                        <span className="text-[10px] text-zinc-400 block mb-0.5">Resposta Esperada:</span>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {stripHtmlTags(termText)}
                        </span>
                      </div>
                    ) : (
                      <div className="border-t border-border/40 pt-2 space-y-2.5">
                        <div>
                          <span className="text-[10px] text-zinc-400 block mb-0.5">Palavra Correta (Esperada):</span>
                          <div className="font-mono font-bold text-sm tracking-wide flex flex-wrap gap-px leading-normal">
                            {charDiffs.length === 0 ? (
                              <span className="text-foreground italic">{stripHtmlTags(termText)}</span>
                            ) : (
                              charDiffs.filter(t => t.type !== 'incorrect').map((token, idx) => (
                                <span 
                                  key={idx} 
                                  className={token.type === 'correct' ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500 border-b border-dashed border-zinc-400 px-0.5'}
                                  title={token.type === 'correct' ? 'Correto' : 'Caractere faltante'}
                                >
                                  {token.char}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {charDiffs.length > 0 && (
                          <div className="pt-1.5 border-t border-border/20">
                            <span className="text-[10px] text-zinc-400 block mb-0.5">Você Digitou:</span>
                            <div className="font-mono font-bold text-sm tracking-wide flex flex-wrap gap-px leading-normal">
                              {charDiffs.filter(t => t.type !== 'missing').map((token, idx) => (
                                <span 
                                  key={idx} 
                                  className={token.type === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 line-through bg-red-500/10 px-0.5 rounded'}
                                  title={token.type === 'correct' ? 'Correto' : 'Caractere incorreto'}
                                >
                                  {token.char}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
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
                  <div className="text-[9px] text-zinc-400 mt-auto flex items-center justify-center gap-1 font-medium">
                    <Lock size={10} className="shrink-0 text-primary/70" /> Pontuação travada na 1ª tentativa.
                  </div>
                )}
              </div>
            ) : studyMode === 'speaking' ? (
              /* 2. MODO FALA */
              <div className={`flex-1 flex flex-col justify-center items-center text-center ${hasCheckedAnswer ? 'gap-2.5' : 'gap-4'} w-full`}>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className={`${hasCheckedAnswer ? 'w-10 h-10' : 'w-14 h-14'} rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer shadow-sm transition-all duration-200 hover:scale-105`}
                    onClick={handlePlayAudio}
                    title="Ouvir pronúncia"
                  >
                    {isPlaying ? (
                      <Pause size={hasCheckedAnswer ? 18 : 24} className="text-primary animate-pulse" />
                    ) : (
                      <Volume2 size={hasCheckedAnswer ? 18 : 24} className="text-primary" />
                    )}
                  </Button>

                  <Button
                    type="button"
                    className={`${hasCheckedAnswer ? 'w-10 h-10' : 'w-14 h-14'} rounded-full border-2 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-200 hover:scale-105 ${
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
                    <Mic size={hasCheckedAnswer ? 18 : 24} />
                  </Button>
                </div>

                {!hasCheckedAnswer && (
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-foreground">Escute e fale o termo:</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {isListeningSpeech ? 'Ouvindo sua voz... Fale agora!' : 'Clique no microfone para pronunciar'}
                    </p>
                  </div>
                )}

                {hasCheckedAnswer && (
                  <div className="w-full p-2.5 rounded-xl border mt-2 text-left text-xs space-y-2 bg-muted/40 border-border animate-in fade-in slide-in-from-top-1">
                    {isAnswerCorrect === null ? (
                      <span className="font-bold text-zinc-500 dark:text-zinc-400 block text-center">
                        ℹ️ Resposta Revelada
                      </span>
                    ) : isAnswerCorrect ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-center">
                        ✨ Excelente Pronúncia!
                      </span>
                    ) : (
                      <span className="font-bold text-red-500 block text-center">
                        ❌ Pronúncia incorreta
                      </span>
                    )}

                    {isAnswerCorrect === null ? (
                      <div className="border-t border-border/40 pt-2 text-center">
                        <span className="text-[10px] text-zinc-400 block mb-0.5">Frase Esperada:</span>
                        <span className="text-sm font-bold text-foreground italic">
                          "{stripHtmlTags(termText)}"
                        </span>
                      </div>
                    ) : (
                      <div className="border-t border-border/40 pt-2 space-y-2.5">
                        <div>
                          <span className="text-[10px] text-zinc-400 block mb-0.5">Frase Correta (Esperada):</span>
                          <div className="font-bold text-[13px] tracking-wide flex flex-wrap gap-x-1 gap-y-0.5 leading-normal">
                            {wordDiffs.length === 0 ? (
                              <span className="text-foreground italic">"{stripHtmlTags(termText)}"</span>
                            ) : (
                              wordDiffs.filter(t => t.type !== 'incorrect').map((token, idx) => (
                                <span 
                                  key={idx} 
                                  className={token.type === 'correct' ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500 border-b border-dashed border-zinc-400 px-0.5'}
                                  title={token.type === 'correct' ? 'Correto' : 'Palavra omitida na pronúncia'}
                                >
                                  {token.word}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {wordDiffs.length > 0 && (
                          <div className="pt-1.5 border-t border-border/20">
                            <span className="text-[10px] text-zinc-400 block mb-0.5">Você Falou:</span>
                            <div className="font-bold text-[13px] tracking-wide flex flex-wrap gap-x-1 gap-y-0.5 leading-normal">
                              {wordDiffs.filter(t => t.type !== 'missing').map((token, idx) => (
                                <span 
                                  key={idx} 
                                  className={token.type === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 line-through bg-red-500/10 px-1 rounded'}
                                  title={token.type === 'correct' ? 'Correto' : 'Palavra extra ou pronunciada incorretamente'}
                                >
                                  {token.word}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!hasCheckedAnswer ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                    onClick={(e) => {
                      handleReveal(e);
                    }}
                  >
                    Revelar Resposta
                  </Button>
                ) : (
                  <div className="text-[9px] text-zinc-400 mt-auto flex items-center justify-center gap-1 font-medium">
                    <Lock size={10} className="shrink-0 text-primary/70" /> Pontuação travada na 1ª tentativa.
                  </div>
                )}
              </div>
            ) : (
              /* 3. MODO CLÁSSICO */
              isListeningFront ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center gap-5">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-20 h-20 rounded-full border-2 border-primary bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center cursor-pointer shadow-md transition-transform duration-200 hover:scale-105"
                    onClick={handlePlayAudio}
                    title="Ouvir pronúncia"
                  >
                    {isPlaying ? (
                      <Pause size={36} className="text-primary animate-pulse" />
                    ) : (
                      <Volume2 size={36} className="text-primary" />
                    )}
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
                    {isPlaying ? (
                      <Pause size={16} className="text-primary animate-pulse" />
                    ) : (
                      <Volume2 size={16} />
                    )}
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
              {isPlaying ? (
                <Pause size={16} className="text-primary animate-pulse" />
              ) : (
                <Volume2 size={16} />
              )}
            </Button>

            <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
              <span 
                className="text-sm text-muted-foreground font-semibold tracking-wide"
                dangerouslySetInnerHTML={{ __html: termText }}
              />
              <h3 
                className="font-bold text-xl text-primary leading-snug"
                dangerouslySetInnerHTML={{ __html: meaningText }}
              />



              {studyMode === 'speaking' && (
                <div className="w-full flex flex-col items-center gap-2 my-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    className={`w-11 h-11 rounded-full border-2 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-200 hover:scale-105 ${
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
                    <Mic size={20} />
                  </Button>
                  
                  {speechSimilarity !== null && (
                    <div className="w-full max-w-sm p-2 rounded-xl border text-left text-xs space-y-1 bg-muted/40 border-border animate-in fade-in slide-in-from-top-1">
                      {isAnswerCorrect ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-center text-[10px]">
                          ✨ Excelente Pronúncia! ({Math.round(speechSimilarity)}%)
                        </span>
                      ) : (
                        <span className="font-bold text-red-500 block text-center text-[10px]">
                          ❌ Pronúncia incorreta ({Math.round(speechSimilarity)}%)
                        </span>
                      )}
                      
                      <div className="border-t border-border/20 pt-1">
                        <span className="text-[9px] text-zinc-400 block mb-0.5">Você Falou:</span>
                        <div className="font-bold text-[11px] tracking-wide flex flex-wrap gap-x-1 gap-y-0.5 leading-normal font-mono">
                          {wordDiffs.length === 0 ? (
                            <span className="text-zinc-500 italic">Sem transcrição</span>
                          ) : (
                            wordDiffs.filter(t => t.type !== 'missing').map((token, idx) => (
                              <span 
                                key={idx} 
                                className={token.type === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 line-through bg-red-500/10 px-0.5 rounded'}
                              >
                                {token.word}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="text-[8px] text-zinc-400 text-center pt-1.5 mt-1.5 border-t border-border/10 flex items-center justify-center gap-0.5 font-medium">
                        <Lock size={9} /> Prática livre: a pontuação válida é a da 1ª tentativa
                      </div>
                    </div>
                  )}
                </div>
              )}
              
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

      {/* Pílula de Tradução de Seleção (Floating) */}
      {selectedText && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-auto">
          <div className="bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 shadow-2xl shadow-black/20 rounded-2xl p-1.5 flex items-center gap-2 max-w-[90vw] w-max border border-zinc-800 dark:border-zinc-200">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 rounded-xl px-3 py-1.5 h-auto text-xs font-bold shrink-0 cursor-pointer"
              onClick={handleTranslateSelection}
              disabled={isTranslating}
            >
              {isTranslating ? (
                <RefreshCw size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Languages size={14} className="mr-1.5" />
              )}
              {isTranslating ? 'Traduzindo...' : 'Traduzir'}
            </Button>
            
            <div className="border-l border-current/20 pl-2 pr-2 max-w-[200px] sm:max-w-[300px]">
              {translationResult ? (
                <span className="text-[11px] font-bold leading-tight line-clamp-3 select-text">
                  {translationResult}
                </span>
              ) : (
                <span className="text-[11px] font-medium opacity-70 truncate block select-none">
                  "{selectedText}"
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls Area */}
      <div className="mt-auto flex flex-col items-center w-full gap-2">
        {currentCard && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-extrabold select-none mb-1 tracking-wide">
            <span 
              className={`text-blue-500 transition-all ${isNewCard(currentCard) ? 'underline decoration-2 underline-offset-4 font-black scale-105' : 'opacity-80'}`}
              title="Novos"
            >
              {newRemainingCount}
            </span>
            <span className="text-muted-foreground/40 font-medium">+</span>
            <span 
              className={`text-red-500 transition-all ${isLearningCard(currentCard) ? 'underline decoration-2 underline-offset-4 font-black scale-105' : 'opacity-80'}`}
              title="Aprendizado"
            >
              {learningRemainingCount}
            </span>
            <span className="text-muted-foreground/40 font-medium">+</span>
            <span 
              className={`text-emerald-500 dark:text-emerald-400 transition-all ${isReviewCard(currentCard) ? 'underline decoration-2 underline-offset-4 font-black scale-105' : 'opacity-80'}`}
              title="Revisões"
            >
              {reviewRemainingCount}
            </span>
          </div>
        )}

        {!isFlipped ? (
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl font-bold gap-2 cursor-pointer shadow-lg text-base" 
            onClick={() => handleReveal()}
          >
            <Eye size={16} />
            {studyMode === 'classic'
              ? (isListeningFront ? 'Revelar Texto (Inglês)' : 'Revelar Resposta')
              : (hasCheckedAnswer ? 'Revelar Significado' : 'Revelar Resposta')
            }
          </Button>
        ) : (
          <>
            {studyMode === 'classic' ? (
              (() => {
                const recommendedGrade = getRecommendedGrade();
                return (
                  <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Button 
                      className={`flex flex-col h-20 items-center justify-center rounded-xl font-bold transition-all duration-300 cursor-pointer ${
                        animatingGrade === 1
                          ? 'animate-grade-confirm-1 bg-red-500/30 border-2 border-red-500 text-red-500 dark:text-red-400 scale-[1.08] shadow-[0_0_20px_rgba(239,68,68,0.7)] z-10'
                          : activeSelectedGrade === 1
                          ? 'bg-red-500/20 border-2 border-red-500 text-red-500 dark:text-red-400 scale-[1.04] shadow-[0_0_15px_rgba(239,68,68,0.5)] z-10 animate-pulse'
                          : recommendedGrade === 1
                          ? 'bg-red-500/20 border-2 border-red-500 text-red-500 dark:text-red-400 scale-[1.04] shadow-[0_0_15px_rgba(239,68,68,0.5)] z-10'
                          : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-zinc-50 text-red-500 dark:text-red-400 text-sm'
                      }`}
                      onClick={() => handleGradeWithAnimation(1)}
                    >
                      <span>Errei</span>
                      <span className="text-[10px] font-medium opacity-70">
                        {getFriendlyInterval(currentCard, 1, preset)}
                      </span>
                      {recommendedGrade === 1 && (
                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-red-500/15 px-1 py-0.5 rounded mt-0.5 animate-pulse">
                          ⭐ Recom.
                        </span>
                      )}
                    </Button>
                    <Button 
                      className={`flex flex-col h-20 items-center justify-center rounded-xl font-bold transition-all duration-300 cursor-pointer ${
                        animatingGrade === 2
                          ? 'animate-grade-confirm-2 bg-amber-500/30 border-2 border-amber-500 text-amber-600 dark:text-amber-400 scale-[1.08] shadow-[0_0_20px_rgba(245,158,11,0.7)] z-10'
                          : activeSelectedGrade === 2
                          ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-600 dark:text-amber-400 scale-[1.04] shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10 animate-pulse'
                          : recommendedGrade === 2
                          ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-600 dark:text-amber-400 scale-[1.04] shadow-[0_0_15px_rgba(245,158,11,0.5)] z-10'
                          : 'bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 hover:text-zinc-950 dark:hover:text-zinc-950 text-amber-500 text-sm'
                      }`}
                      onClick={() => handleGradeWithAnimation(2)}
                    >
                      <span>Difícil</span>
                      <span className="text-[10px] font-medium opacity-70">
                        {getFriendlyInterval(currentCard, 2, preset)}
                      </span>
                      {recommendedGrade === 2 && (
                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-amber-500/15 px-1 py-0.5 rounded mt-0.5 animate-pulse">
                          ⭐ Recom.
                        </span>
                      )}
                    </Button>
                    <Button 
                      className={`flex flex-col h-20 items-center justify-center rounded-xl font-bold transition-all duration-300 cursor-pointer ${
                        animatingGrade === 3
                          ? 'animate-grade-confirm-3 bg-sky-500/30 border-2 border-sky-500 text-sky-600 dark:text-sky-400 scale-[1.08] shadow-[0_0_20px_rgba(14,165,233,0.7)] z-10'
                          : activeSelectedGrade === 3
                          ? 'bg-sky-500/20 border-2 border-sky-500 text-sky-600 dark:text-sky-400 scale-[1.04] shadow-[0_0_15px_rgba(14,165,233,0.5)] z-10 animate-pulse'
                          : recommendedGrade === 3
                          ? 'bg-sky-500/20 border-2 border-sky-500 text-sky-600 dark:text-sky-400 scale-[1.04] shadow-[0_0_15px_rgba(14,165,233,0.5)] z-10'
                          : 'bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500 hover:text-zinc-50 text-sky-600 dark:text-sky-400 text-sm'
                      }`}
                      onClick={() => handleGradeWithAnimation(3)}
                    >
                      <span>Bom</span>
                      <span className="text-[10px] font-medium opacity-70">
                        {getFriendlyInterval(currentCard, 3, preset)}
                      </span>
                      {recommendedGrade === 3 && (
                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-sky-500/15 px-1 py-0.5 rounded mt-0.5 animate-pulse">
                          ⭐ Recom.
                        </span>
                      )}
                    </Button>
                    <Button 
                      className={`flex flex-col h-20 items-center justify-center rounded-xl font-bold transition-all duration-300 cursor-pointer ${
                        animatingGrade === 4
                          ? 'animate-grade-confirm-4 bg-emerald-500/30 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 scale-[1.08] shadow-[0_0_20px_rgba(16,185,129,0.7)] z-10'
                          : activeSelectedGrade === 4
                          ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 scale-[1.04] shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10 animate-pulse'
                          : recommendedGrade === 4
                          ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 scale-[1.04] shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10'
                          : 'bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-zinc-50 text-emerald-600 dark:text-emerald-400 text-sm'
                      }`}
                      onClick={() => handleGradeWithAnimation(4)}
                    >
                      <span>Fácil</span>
                      <span className="text-[10px] font-medium opacity-70">
                        {getFriendlyInterval(currentCard, 4, preset)}
                      </span>
                      {recommendedGrade === 4 && (
                        <span className="text-[7.5px] font-black uppercase tracking-wider bg-emerald-500/15 px-1 py-0.5 rounded mt-0.5 animate-pulse">
                          ⭐ Recom.
                        </span>
                      )}
                    </Button>
                  </div>
                );
              })()
            ) : (
              (() => {
                const recommendedGrade = getRecommendedGrade() ?? 3;
                return (
                  <div className="flex flex-col w-full items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Button
                      className={`w-full py-6 rounded-xl font-bold gap-2 cursor-pointer shadow-lg text-base transition-all duration-300 ${
                        animatingGrade !== null ? 'scale-[1.04] opacity-90 animate-pulse' : ''
                      } ${
                        recommendedGrade === 1
                          ? 'bg-red-600 hover:bg-red-600/90 text-white shadow-red-600/20'
                          : recommendedGrade === 2
                          ? 'bg-amber-600 hover:bg-amber-600/90 text-white shadow-amber-600/20'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                      onClick={() => handleGradeWithAnimation(recommendedGrade)}
                    >
                      <span>Continuar</span>
                      <span className="text-xs opacity-80 font-medium">
                        (Nota: {recommendedGrade === 1 ? 'Errei' : recommendedGrade === 2 ? 'Difícil' : 'Bom'} — {getFriendlyInterval(currentCard, recommendedGrade, preset)})
                      </span>
                    </Button>
                    <span className="text-[9.5px] text-muted-foreground/60 flex items-center gap-1 font-medium select-none">
                      <Lock size={11} className="text-primary/70 shrink-0" /> Pontuação travada na primeira resposta
                    </span>
                  </div>
                );
              })()
            )}
            {/* Shortcut hints */}
            {studyMode === 'classic' ? (
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
            ) : (
              <div className="flex items-center justify-center gap-3 mt-2">
                <span className="text-[9px] text-muted-foreground/50 flex items-center gap-1">
                  <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded text-[8px] font-bold">Enter</kbd> ou <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded text-[8px] font-bold">Espaço</kbd> para continuar
                </span>
              </div>
            )}
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
        shortcuts={
          studyMode === 'classic'
            ? [
                { keys: ['Espaço', 'Enter'], description: 'Revelar resposta' },
                { keys: ['1'], description: 'Avaliar como "Errei"' },
                { keys: ['2'], description: 'Avaliar como "Difícil"' },
                { keys: ['3'], description: 'Avaliar como "Bom"' },
                { keys: ['4'], description: 'Avaliar como "Fácil"' },
                { keys: ['R'], description: 'Repetir Áudio / TTS' },
                { keys: ['Esc'], description: 'Sair dos estudos' },
              ]
            : [
                { keys: ['Enter'], description: !hasCheckedAnswer ? 'Verificar resposta' : 'Continuar estudos' },
                { keys: ['Espaço'], description: !hasCheckedAnswer ? 'Revelar resposta' : 'Continuar estudos' },
                { keys: ['R'], description: 'Repetir Áudio / TTS' },
                { keys: ['Esc'], description: 'Sair dos estudos' },
              ]
        }
      />
    </div>
  );
};
