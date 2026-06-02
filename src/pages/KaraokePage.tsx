import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Headphones, Mic, Sparkles, ChevronRight, 
  ArrowLeft, Languages, Volume2, Repeat, FileText, 
  CheckCircle2, Music
} from 'lucide-react';
import { db } from '../db/db';
import type { Playlist, AudioTrack, TranscriptionLine } from '../types';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { getWordLevenshteinDistance, diffWords, type DiffWord } from '../utils/srs';
import { separateVocalsCloud } from '../utils/vocalSeparationCloud';

const cleanString = (str: string) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

interface KaraokePageProps {
  initialTrackId: string | null;
  onClearTrack: () => void;
  setActiveTab: (tab: 'dashboard' | 'stats' | 'cards' | 'profile' | 'settings' | 'history' | 'reading' | 'guide' | 'conversation' | 'playlist' | 'cefr' | 'exams' | 'karaoke') => void;
}

export const KaraokePage: React.FC<KaraokePageProps> = ({ initialTrackId, onClearTrack, setActiveTab }) => {
  // DB States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistCoverUrls, setPlaylistCoverUrls] = useState<Record<string, string>>({});
  const [allTracks, setAllTracks] = useState<AudioTrack[]>([]);

  // Selection state
  const [activeTrack, setActiveTrack] = useState<AudioTrack | null>(null);

  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [playCount, setPlayCount] = useState(1);
  const [isLooping, setIsLooping] = useState(false);

  // Transcription States
  const [showTranslation, setShowTranslation] = useState(true);
  const [isLoopingLine, setIsLoopingLine] = useState(false);
  const [isDictationMode, setIsDictationMode] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(-1);
  const [transcriptionViewMode, setTranscriptionViewMode] = useState<'normal' | 'playback' | 'pronunciation'>('normal');

  // Speech Recognition States
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechSimilarity, setSpeechSimilarity] = useState<number | null>(null);
  const [speechWordDiffs, setSpeechWordDiffs] = useState<DiffWord[]>([]);
  const [lineScores, setLineScores] = useState<Record<number, number>>({});

  // Audio Context and Visualizer Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Web Audio reduction node refs
  const vocalReductionSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const vocalReductionInverterRef = useRef<GainNode | null>(null);
  const vocalReductionSumRef = useRef<GainNode | null>(null);
  const [isVocalReductionActive, setIsVocalReductionActive] = useState(false);

  // AI Separation states
  const [isIaInstrumentalActive, setIsIaInstrumentalActive] = useState(false);
  const [isProcessingCloudSeparation, setIsProcessingCloudSeparation] = useState(false);
  const [cloudSeparationProgress, setCloudSeparationProgress] = useState(0);
  const [cloudSeparationMessage, setCloudSeparationMessage] = useState('');

  // Speech API refs
  const recognitionRef = useRef<any>(null);
  const shouldReconnectSpeechRef = useRef(false);
  const activeLineIdxRef = useRef(-1);
  const activeLinesRef = useRef<TranscriptionLine[]>([]);
  const isLoopingRef = useRef(false);
  const lastPausedLineIdxRef = useRef<number>(-1);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [activeAudioUrl, setActiveAudioUrl] = useState<string>('');

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    activeLineIdxRef.current = activeLineIdx;
  }, [activeLineIdx]);

  useEffect(() => {
    activeLinesRef.current = activeTrack?.transcriptionLines || [];
  }, [activeTrack]);

  // Load playlists and all tracks on mount
  useEffect(() => {
    const initPage = async () => {
      try {
        const pls = await db.playlists.orderBy('createdAt').toArray();
        setPlaylists(pls);
        
        const urls: Record<string, string> = {};
        pls.forEach(pl => {
          if (pl.coverImage) {
            urls[pl.id] = URL.createObjectURL(pl.coverImage);
          }
        });
        setPlaylistCoverUrls(urls);

        const tracks = await db.audioTracks.toArray();
        setAllTracks(tracks.sort((a, b) => b.createdAt - a.createdAt));

        // If an initialTrackId was passed from another page, auto-play it
        if (initialTrackId) {
          const track = tracks.find(t => t.id === initialTrackId);
          if (track) {
            handlePlayTrack(track);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error('Erro ao inicializar o Estúdio de Karaokê.');
      }
    };
    initPage();

    return () => {
      cleanupAudio();
      Object.values(playlistCoverUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [initialTrackId]);

  // Automatically switch toggle states when track changes
  useEffect(() => {
    if (activeTrack) {
      setIsIaInstrumentalActive(!!activeTrack.instrumentalFile);
    } else {
      setIsIaInstrumentalActive(false);
    }
  }, [activeTrack]);

  // Find active line index based on progress
  useEffect(() => {
    if (activeTrack && activeTrack.transcriptionLines && activeTrack.transcriptionLines.length > 0) {
      const lines = activeTrack.transcriptionLines;
      let activeIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startTime <= progress) {
          activeIdx = i;
        } else {
          break;
        }
      }
      setActiveLineIdx(activeIdx);
    } else {
      setActiveLineIdx(-1);
    }
  }, [progress, activeTrack]);

  // Auto-scroll active line in view
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIdx]);

  // Reset speech states when active line changes
  useEffect(() => {
    setSpeechTranscript('');
    setSpeechSimilarity(null);
    setSpeechWordDiffs([]);
  }, [activeLineIdx]);

  // Loop active line logic if isLoopingLine is true
  useEffect(() => {
    if (isLoopingLine && activeLineIdx >= 0 && activeTrack?.transcriptionLines && audioRef.current) {
      const lines = activeTrack.transcriptionLines;
      const currentLine = lines[activeLineIdx];
      const nextLine = lines[activeLineIdx + 1];
      const endOfLine = nextLine ? nextLine.startTime : duration;
      
      if (progress >= endOfLine) {
        audioRef.current.currentTime = currentLine.startTime;
        setProgress(currentLine.startTime);
      }
    }
  }, [progress, isLoopingLine, activeLineIdx, activeTrack, duration]);

  // Dictation mode auto-pause logic
  useEffect(() => {
    if (isDictationMode && activeLineIdx >= 0 && activeTrack?.transcriptionLines && audioRef.current && isPlaying) {
      const lines = activeTrack.transcriptionLines;
      const nextLine = lines[activeLineIdx + 1];
      const endOfLine = nextLine ? nextLine.startTime : duration;
      
      if (progress >= endOfLine && lastPausedLineIdxRef.current !== activeLineIdx) {
        audioRef.current.pause();
        setIsPlaying(false);
        lastPausedLineIdxRef.current = activeLineIdx;
      }
    }
  }, [progress, isDictationMode, activeLineIdx, activeTrack, duration, isPlaying]);

  useEffect(() => {
    lastPausedLineIdxRef.current = -1;
  }, [activeTrack]);

  // Start visualizer loop
  useEffect(() => {
    if (isPlaying && canvasRef.current && analyserRef.current) {
      startDrawing();
    } else {
      cleanupVisualizer();
    }
    return () => cleanupVisualizer();
  }, [isPlaying, canvasRef.current]);

  const cleanupVisualizer = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  const setupVisualizer = (audioElement: HTMLAudioElement) => {
    cleanupVisualizer();
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;
      
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 128;
      }
      const analyser = analyserRef.current;

      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(analyser);
      
      if (isVocalReductionActive) {
        const splitter = audioContext.createChannelSplitter(2);
        const inverter = audioContext.createGain();
        inverter.gain.value = -1;
        const sumNode = audioContext.createGain();
        
        vocalReductionSplitterRef.current = splitter;
        vocalReductionInverterRef.current = inverter;
        vocalReductionSumRef.current = sumNode;
        
        analyser.connect(splitter);
        splitter.connect(sumNode, 0, 0);
        splitter.connect(inverter, 1, 0);
        inverter.connect(sumNode);
        sumNode.connect(audioContext.destination);
      } else {
        analyser.connect(audioContext.destination);
      }

      if (audioContext.state === 'suspended') {
        audioElement.addEventListener('play', () => {
          audioContext.resume();
        }, { once: true });
      }
    } catch (err) {
      console.warn("Visualizer setup failed:", err);
    }
  };

  const startDrawing = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;
      animationFrameIdRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 66;

      const numBars = 60;
      const barWidth = 2.5;

      for (let i = 0; i < numBars; i++) {
        const angle = (i / numBars) * Math.PI * 2;
        const dataIdx = Math.floor((i / numBars) * bufferLength * 0.7);
        const amplitude = dataArray[dataIdx] / 255;
        const barHeight = amplitude * 36;

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.strokeStyle = `rgba(139, 92, 246, ${0.2 + amplitude * 0.8})`;
        ctx.lineWidth = barWidth;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    };
    draw();
  };

  // Toggle standard DSP vocal reduction (Stereo out-of-phase summing)
  const toggleVocalReduction = (active: boolean) => {
    setIsVocalReductionActive(active);
    if (!audioRef.current) return;
    setupVisualizer(audioRef.current);
  };

  // Toggle AI separated voice
  const toggleIaInstrumental = (active: boolean) => {
    setIsIaInstrumentalActive(active);
    if (!activeTrack) return;
    
    const wasPlaying = isPlaying;
    const currentProgress = progress;

    cleanupAudio();

    try {
      const fileToPlay = activeTrack.instrumentalFile && active ? activeTrack.instrumentalFile : activeTrack.audioFile;
      const url = URL.createObjectURL(fileToPlay);
      setActiveAudioUrl(url);

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      audio.currentTime = currentProgress;
      
      setupVisualizer(audio);

      if (wasPlaying) {
        setIsPlaying(true);
        audio.play().catch(e => console.warn(e));
      } else {
        setIsPlaying(false);
      }

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.onended = () => {
        if (isLoopingRef.current) {
          audio.currentTime = 0;
          audio.play().catch(e => console.warn(e));
          return;
        }
        const trackRepeat = activeTrack.repeatTimes ?? 1;
        setPlayCount(prev => {
          const next = prev + 1;
          if (trackRepeat === 0 || next <= trackRepeat) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn(e));
            return next;
          } else {
            handleNextTrack();
            return 1;
          }
        });
      };

      progressIntervalRef.current = window.setInterval(() => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
        }
      }, 100);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao alternar canal de voz por IA.');
    }
  };

  // Cloud Separation triggers
  const handleStartCloudVocalSeparation = async () => {
    if (!activeTrack) return;
    try {
      setIsProcessingCloudSeparation(true);
      setCloudSeparationProgress(10);
      setCloudSeparationMessage('Conectando ao HuggingFace Gradio Space...');

      const result = await separateVocalsCloud(
        activeTrack.audioFile,
        (progress: number, msg: string) => {
          setCloudSeparationProgress(progress);
          setCloudSeparationMessage(msg);
        }
      );

      // Save to IndexedDB
      await db.audioTracks.update(activeTrack.id, {
        instrumentalFile: result.instrumentalBlob,
        updatedAt: Date.now()
      });

      // Update local track state
      const updatedTrack = { ...activeTrack, instrumentalFile: result.instrumentalBlob };
      setActiveTrack(updatedTrack);
      setAllTracks(prev => prev.map(t => t.id === activeTrack.id ? updatedTrack : t));

      toast.success('Separador Cloud: Instrumental WAV processado e salvo no banco com sucesso!');
      
      // Auto-toggle to AI separated track
      toggleIaInstrumental(true);
    } catch (err: any) {
      console.error("[CloudSeparation]", err);
      toast.error(err.message || 'Falha no processador cloud.');
    } finally {
      setIsProcessingCloudSeparation(false);
      setCloudSeparationProgress(0);
      setCloudSeparationMessage('');
    }
  };

  // Playback Control Functions
  const cleanupAudio = () => {
    cleanupVisualizer();
    stopSpeechRecognition();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    vocalReductionSplitterRef.current = null;
    vocalReductionInverterRef.current = null;
    vocalReductionSumRef.current = null;
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (activeAudioUrl) {
      URL.revokeObjectURL(activeAudioUrl);
      setActiveAudioUrl('');
    }
  };

  const handlePlayTrack = (track: AudioTrack) => {
    cleanupAudio();
    try {
      const useInstrumental = isIaInstrumentalActive && track.instrumentalFile;
      const fileToPlay = useInstrumental && track.instrumentalFile ? track.instrumentalFile : track.audioFile;
      const url = URL.createObjectURL(fileToPlay);
      setActiveAudioUrl(url);
      setActiveTrack(track);

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      setIsPlaying(true);
      setupVisualizer(audio);

      audio.play().catch((err) => {
        if (err?.name === 'AbortError') return;
        console.error('Play error:', err);
        toast.error('Não foi possível reproduzir este áudio.');
        setIsPlaying(false);
      });

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      setPlayCount(1);

      audio.onended = () => {
        if (isLoopingRef.current) {
          audio.currentTime = 0;
          audio.play().catch(e => console.warn(e));
          return;
        }
        const trackRepeat = track.repeatTimes ?? 1;
        setPlayCount(prev => {
          const next = prev + 1;
          if (trackRepeat === 0 || next <= trackRepeat) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn(e));
            return next;
          } else {
            handleNextTrack();
            return 1;
          }
        });
      };

      progressIntervalRef.current = window.setInterval(() => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
        }
      }, 100);

      // Media Session API integration
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        const coverSrc = playlistCoverUrls[track.playlistId] || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24" fill="none" stroke="%238b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.description || 'Karaokê Studio',
          album: 'Memorize Playlist',
          artwork: [{ src: coverSrc, sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.setActionHandler('play', () => {
          audio.play().catch(e => console.warn(e));
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audio.pause();
          setIsPlaying(false);
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao inicializar áudio.');
    }
  };

  const handleNextTrack = () => {
    if (!activeTrack) return;
    const albumTracks = allTracks.filter(t => t.playlistId === activeTrack.playlistId);
    const index = albumTracks.findIndex(t => t.id === activeTrack.id);
    if (index === -1) return;
    const nextIndex = (index + 1) % albumTracks.length;
    handlePlayTrack(albumTracks[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (!activeTrack) return;
    const albumTracks = allTracks.filter(t => t.playlistId === activeTrack.playlistId);
    const index = albumTracks.findIndex(t => t.id === activeTrack.id);
    if (index === -1) return;
    const prevIndex = (index - 1 + albumTracks.length) % albumTracks.length;
    handlePlayTrack(albumTracks[prevIndex]);
  };

  const handleScrub = (value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setProgress(value);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Speech Recognition Implementation
  const stopSpeechRecognition = () => {
    shouldReconnectSpeechRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignora se não puder abortar
      }
      recognitionRef.current = null;
    }
    setIsListeningSpeech(false);
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Reconhecimento de voz não é suportado neste navegador. Use o Chrome ou Edge.');
      return;
    }

    if (isListeningSpeech) {
      stopSpeechRecognition();
      return;
    }

    shouldReconnectSpeechRef.current = true;
    setIsListeningSpeech(true);
    setSpeechTranscript('');
    setSpeechSimilarity(null);
    setSpeechWordDiffs([]);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const spokenText = finalTranscript || interimTranscript;
        if (!spokenText.trim()) return;

        const currentIdx = activeLineIdxRef.current;
        const lines = activeLinesRef.current;
        
        if (currentIdx >= 0 && lines[currentIdx]) {
          const expectedText = lines[currentIdx].text;
          setSpeechTranscript(spokenText);

          const cleanSpoken = cleanString(spokenText);
          const cleanExpected = cleanString(expectedText);

          const spokenWords = cleanSpoken.split(/\s+/).filter(Boolean);
          const expectedWords = cleanExpected.split(/\s+/).filter(Boolean);

          let similarity = 0;
          if (spokenWords.length > 0 && expectedWords.length > 0) {
            const wordDist = getWordLevenshteinDistance(spokenWords, expectedWords);
            const maxWords = Math.max(spokenWords.length, expectedWords.length);
            similarity = Math.max(0, 1 - wordDist / maxWords) * 100;
          } else {
            similarity = cleanSpoken === cleanExpected ? 100 : 0;
          }

          const roundedSimilarity = Math.round(similarity);
          setSpeechSimilarity(roundedSimilarity);

          const diffResult = diffWords(spokenText, expectedText);
          setSpeechWordDiffs(diffResult);

          if (finalTranscript) {
            setLineScores(prev => ({
              ...prev,
              [currentIdx]: roundedSimilarity
            }));
            
            if (roundedSimilarity >= 80) {
              toast.success(`Excelente! Precisão de ${roundedSimilarity}%`);
            } else if (roundedSimilarity >= 50) {
              toast.info(`Muito bom! Precisão de ${roundedSimilarity}%`);
            } else {
              toast.error(`Precisão de ${roundedSimilarity}%. Tente novamente!`);
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event);
        if (event.error === 'not-allowed') {
          toast.error('Acesso ao microfone negado.');
          stopSpeechRecognition();
        }
      };

      recognition.onend = () => {
        if (shouldReconnectSpeechRef.current) {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            // Ignora se já estiver rodando
          }
        } else {
          setIsListeningSpeech(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListeningSpeech(false);
    }
  };

  const handleCloseStudio = () => {
    cleanupAudio();
    setActiveTrack(null);
    onClearTrack();
  };

  const getGradientFromTitle = (title: string) => {
    const colors = [
      'from-rose-500 to-orange-500 shadow-rose-500/20',
      'from-emerald-500 to-teal-600 shadow-emerald-500/20',
      'from-blue-500 to-indigo-600 shadow-blue-500/20',
      'from-violet-500 to-purple-600 shadow-violet-500/20',
      'from-amber-500 to-orange-600 shadow-amber-500/20',
      'from-fuchsia-500 to-pink-600 shadow-fuchsia-500/20'
    ];
    let sum = 0;
    for (let i = 0; i < title.length; i++) {
      sum += title.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const renderHighlightedText = (text: string, startTime: number, endTime: number) => {
    const durationOfLine = endTime - startTime;
    if (durationOfLine <= 0) return <span>{text}</span>;
    const progressOfLine = progress - startTime;
    const ratio = Math.min(Math.max(progressOfLine / durationOfLine, 0), 1);

    const chars = text.split('');
    const highlightLength = Math.floor(chars.length * ratio);

    return (
      <span className="relative inline-block text-center select-none leading-relaxed transition-all">
        <span className="text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.6)]">
          {text.slice(0, highlightLength)}
        </span>
        <span className="text-foreground/20 dark:text-foreground/10 select-none">
          {text.slice(highlightLength)}
        </span>
      </span>
    );
  };

  // Rendering components
  const renderDashboard = () => {
    const tracksWithTranscription = allTracks.filter(t => t.transcriptionLines && t.transcriptionLines.length > 0);

    return (
      <div className="space-y-6 w-full animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm shadow-primary/5">
                <Mic size={24} className="animate-pulse" />
              </div> 
              Estúdio de Karaokê e Cantar
            </h2>
            <p className="text-xs text-muted-foreground font-semibold leading-relaxed max-w-2xl">
              Escolha uma música já transcrevida no sistema para cantar, praticar a escuta ou desafiar sua pronúncia em tempo real com avaliação de IA.
            </p>
          </div>

          <Button
            onClick={() => setActiveTab('playlist')}
            className="bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 h-10 px-4 shadow-lg shadow-primary/10 cursor-pointer transition-all duration-200 active:scale-95 shrink-0"
          >
            Adicionar / Transcrever Música
          </Button>
        </div>

        {tracksWithTranscription.length === 0 ? (
          <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
            <div className="p-4 bg-muted/40 rounded-full border border-border/30 shadow-inner">
              <Headphones size={36} className="text-muted-foreground/60 animate-bounce" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-extrabold text-foreground">Nenhuma música pronta para cantar</p>
              <p className="text-xs text-muted-foreground max-w-sm leading-normal">
                Para cantar e praticar pronúncia, você precisa de faixas que já possuam letras sincronizadas. Vá até o gerenciador de playlists para transcrever seus áudios.
              </p>
            </div>
            <Button
              onClick={() => setActiveTab('playlist')}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-9 px-4 rounded-xl cursor-pointer"
            >
              Ir para Playlists
            </Button>
          </ShadcnCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map(playlist => {
              const playlistTracks = tracksWithTranscription.filter(t => t.playlistId === playlist.id);
              if (playlistTracks.length === 0) return null;
              const coverSrc = playlistCoverUrls[playlist.id];

              return (
                <ShadcnCard key={playlist.id} className="bg-card/40 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
                  <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                    {coverSrc ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-border/40 shrink-0 shadow-sm">
                        <img src={coverSrc} alt={playlist.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-[10px] text-zinc-50 font-black shrink-0 ${getGradientFromTitle(playlist.name)}`}>
                        {playlist.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-foreground truncate">{playlist.name}</h4>
                      <p className="text-[10px] text-muted-foreground font-bold truncate leading-relaxed">
                        {playlistTracks.length} faixas com letras prontas
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 flex-1 max-h-[190px] overflow-y-auto pr-1">
                    {playlistTracks.map(track => (
                      <div
                        key={track.id}
                        onClick={() => handlePlayTrack(track)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            <Play size={12} className="fill-current ml-0.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground group-hover:text-primary truncate transition-colors">
                            {track.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-1">
                          {track.instrumentalFile && (
                            <span className="text-[8px] font-black text-violet-500 bg-violet-500/10 px-1 py-0.5 rounded border border-violet-500/15" title="Instrumental sem voz pronto">
                              ✦ IA
                            </span>
                          )}
                          <ChevronRight size={12} className="text-muted-foreground/30" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ShadcnCard>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderActiveStudio = () => {
    if (!activeTrack) return null;
    const isCinematic = transcriptionViewMode === 'playback';
    const showTranslationsInMode = showTranslation && !isCinematic;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch flex-1 min-h-0 w-full animate-fadeIn">
        
        {/* COLUNA 1: Visualizador de Disco de Vinil (Esquerda) — Oculto em mobile */}
        <div className="hidden lg:flex lg:col-span-1 flex-col items-center justify-center relative">
          <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-6 rounded-3xl shadow-xl flex flex-col items-center justify-between w-full h-full min-h-[495px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

            {/* Cabeçalho */}
            <div className="flex items-center justify-between w-full border-b border-border/40 pb-2.5 z-10 shrink-0">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                Karaokê Player
              </h3>
              {playCount > 1 && (
                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-lg animate-pulse shrink-0">
                  Repetindo {playCount}x
                </span>
              )}
            </div>

            {/* Disco de vinil giratório com visualizador */}
            <div className="flex items-center justify-center relative w-full h-56 my-3 shrink-0">
              {/* Canvas para animação de frequências de áudio */}
              <canvas
                ref={canvasRef}
                width="220"
                height="220"
                className="absolute inset-0 m-auto pointer-events-none z-10"
              />

              {/* Disco em si */}
              <div className={`w-36 h-36 rounded-full bg-zinc-950 shadow-2xl flex items-center justify-center border-4 border-zinc-800 transition-all duration-300 select-none relative ${
                isPlaying ? 'animate-spin-slow shadow-primary/20 ring-4 ring-primary/5' : 'scale-95 border-zinc-900 shadow-none'
              }`}>
                <div className="absolute inset-2 rounded-full border border-zinc-700/40 pointer-events-none" />
                <div className="absolute inset-4 rounded-full border border-zinc-700/30 pointer-events-none" />
                <div className="absolute inset-7 rounded-full border border-zinc-700/20 pointer-events-none" />
                
                {/* Imagem de Capa do Álbum no Centro */}
                {(() => {
                  const coverSrc = playlistCoverUrls[activeTrack.playlistId];
                  return coverSrc ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-lg relative shrink-0">
                      <img src={coverSrc} alt="capa" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-zinc-950 border border-primary/45" />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-full border-2 border-primary bg-gradient-to-br flex items-center justify-center text-[7px] text-zinc-50 font-black relative shrink-0 ${getGradientFromTitle(activeTrack.title)}`}>
                      {activeTrack.title.substring(0, 2).toUpperCase()}
                      <div className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-zinc-950 border border-primary/40" />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Nome da Faixa */}
            <div className="space-y-1 w-full px-2 text-center shrink-0 z-10">
              <h4 className="font-extrabold text-sm text-foreground truncate px-1" title={activeTrack.title}>
                {activeTrack.title}
              </h4>
              <p className="text-[9px] text-muted-foreground font-semibold truncate px-1 leading-normal">
                {activeTrack.description || 'Tocando no Estúdio'}
              </p>
            </div>

            <div className="w-full h-px bg-border/40 my-1" />

            {/* Quick Status de Pontuação */}
            <div className="w-full text-left space-y-1.5 shrink-0 z-10 px-2 pb-1">
              <span className="text-[9px] font-black text-muted-foreground/80 flex items-center gap-1.5 uppercase tracking-widest">
                <CheckCircle2 size={10} /> Desempenho
              </span>
              <div className="bg-muted/40 p-2.5 rounded-xl border border-border/30 text-center flex flex-col justify-center space-y-0.5">
                {Object.keys(lineScores).length > 0 ? (
                  <>
                    <span className="text-base font-black text-primary animate-fadeIn">
                      {Math.round(Object.values(lineScores).reduce((a, b) => a + b, 0) / Object.keys(lineScores).length)}%
                    </span>
                    <span className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider">
                      Média do Desafio
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground/60 italic py-1 leading-normal">
                    Nenhuma pontuação registrada.
                  </span>
                )}
              </div>
            </div>
          </ShadcnCard>
        </div>

        {/* COLUNA 2: Letras & Controles do Estúdio (Direita) */}
        <div className="lg:col-span-3 flex flex-col h-full space-y-4">
          <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-5 rounded-2xl shadow-xl flex flex-col flex-1 h-full min-h-[495px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px] pointer-events-none" />

            {/* Cabeçalho do Estúdio */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseStudio}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40 bg-card/65 shadow-sm"
                  title="Voltar ao estúdio"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-xs font-black text-foreground truncate max-w-[200px] sm:max-w-xs">
                    {activeTrack.title}
                  </h3>
                  <p className="text-[9px] text-muted-foreground font-semibold truncate leading-normal">
                    Estudo e Prática
                  </p>
                </div>
              </div>

              {/* Toggles de Estudo no Topo */}
              <div className="flex items-center gap-2">
                {/* Loop de Frase */}
                <button
                  onClick={() => setIsLoopingLine(!isLoopingLine)}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer shadow-sm text-xs font-bold flex items-center gap-1.5 ${
                    isLoopingLine
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-400 shadow-sm shadow-amber-500/10'
                      : 'border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={isLoopingLine ? 'Desativar loop da frase atual' : 'Ativar loop da frase atual'}
                >
                  <Repeat size={14} className={isLoopingLine ? 'animate-pulse' : ''} />
                  <span className="hidden sm:inline text-[10px]">Loop Frase</span>
                </button>

                {/* Modo Ditado */}
                <button
                  onClick={() => setIsDictationMode(!isDictationMode)}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer shadow-sm text-xs font-bold flex items-center gap-1.5 ${
                    isDictationMode
                      ? 'bg-sky-500/15 border-sky-500/35 text-sky-600 dark:text-sky-400 shadow-sm shadow-sky-500/10'
                      : 'border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={isDictationMode ? 'Desativar Modo Ditado (Auto-pause)' : 'Ativar Modo Ditado (Pausar áudio ao final de cada frase)'}
                >
                  <Mic size={14} className={isDictationMode ? 'animate-pulse' : ''} />
                  <span className="hidden sm:inline text-[10px]">Modo Ditado</span>
                </button>

                {/* Alternar tradução */}
                <button
                  onClick={() => setShowTranslation(!showTranslation)}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer shadow-sm ${
                    showTranslation
                      ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                      : 'border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={showTranslation ? 'Ocultar traduções' : 'Mostrar traduções'}
                >
                  <Languages size={14} />
                </button>
              </div>
            </div>

            {/* Barra de Seleção de Modos */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 pb-2 border-b border-border/20 shrink-0 relative z-10">
              <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 border border-border/30 rounded-xl p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTranscriptionViewMode('normal');
                    stopSpeechRecognition();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    transcriptionViewMode === 'normal'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <FileText size={12} />
                  <span>Padrão</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTranscriptionViewMode('playback');
                    stopSpeechRecognition();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    transcriptionViewMode === 'playback'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <Music size={12} />
                  <span>Playback / Karaokê</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTranscriptionViewMode('pronunciation');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    transcriptionViewMode === 'pronunciation'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <Mic size={12} />
                  <span>Desafio de Pronúncia</span>
                </button>
              </div>

              {/* Dica de Modo & Vocal Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                {transcriptionViewMode === 'pronunciation' ? (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl text-[10px] font-black shadow-sm">
                    <Headphones size={12} className="shrink-0 animate-bounce" />
                    <span>Use fones — evite captar a caixa de som!</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-1.5 bg-muted/40 border border-border/30 rounded-xl p-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 px-1.5 select-none hidden sm:block">
                    Voz
                  </span>
                  <div className="w-px h-4 bg-border/40 hidden sm:block" />

                  <button
                    type="button"
                    onClick={() => toggleVocalReduction(!isVocalReductionActive)}
                    title="Atenuar voz com cancelamento de fase estéreo."
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      isVocalReductionActive
                        ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <Volume2 size={11} className={isVocalReductionActive ? 'animate-pulse' : ''} />
                    <span className="hidden sm:inline">Atenuar</span>
                  </button>

                  <div className="w-px h-4 bg-border/40" />

                  {activeTrack.instrumentalFile ? (
                    <button
                      type="button"
                      onClick={() => toggleIaInstrumental(!isIaInstrumentalActive)}
                      title="Alterna para o instrumental sem voz por IA."
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        isIaInstrumentalActive
                          ? 'bg-violet-500/20 text-violet-500 dark:text-violet-400'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                    >
                      <Sparkles size={11} className={isIaInstrumentalActive ? 'animate-pulse' : ''} />
                      <span>{isIaInstrumentalActive ? 'Sem voz ✓' : 'Sem voz'}</span>
                    </button>
                  ) : isProcessingCloudSeparation ? (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 min-w-[160px]">
                      <div className="w-2.5 h-2.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-sky-500 truncate">{cloudSeparationMessage}</p>
                        <div className="w-full bg-sky-500/20 rounded-full h-0.5 mt-0.5">
                          <div className="bg-sky-500 h-0.5 rounded-full transition-all" style={{ width: `${cloudSeparationProgress}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartCloudVocalSeparation}
                      title="Remover a voz usando IA na nuvem (Demucs)."
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-sky-500 dark:text-sky-400 hover:bg-sky-500/10 transition-all cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                      <span>Remover voz</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Painel Central das Letras */}
            <div className="flex-1 flex flex-col min-h-0 relative mt-3 pb-2">
              <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-card/30 to-transparent pointer-events-none z-10" />

              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 space-y-5 pt-8 pb-36 select-none scrollbar-thin relative">
                {activeTrack.transcriptionLines?.map((line, idx) => {
                  const isActive = activeLineIdx === idx;
                  
                  let cardStyles = 'border-transparent text-muted-foreground/60 hover:text-foreground hover:scale-[1.01] font-semibold';
                  if (isActive) {
                    if (isCinematic) {
                      cardStyles = 'bg-primary/[0.03] text-primary text-2xl sm:text-3xl font-black py-6 scale-105 drop-shadow-[0_0_12px_rgba(139,92,246,0.35)] border-primary/25 border';
                    } else {
                      cardStyles = 'bg-primary/5 text-primary scale-105 font-extrabold shadow-sm border-primary/20 shadow-primary/5';
                    }
                  } else {
                    if (isCinematic) {
                      cardStyles = 'opacity-20 scale-95 blur-[0.7px] border-transparent text-muted-foreground/40';
                    } else if (line.difficulty === 'hard') {
                      cardStyles = 'bg-rose-500/[0.03] border-rose-500/15 text-muted-foreground/75 hover:text-foreground font-semibold hover:border-rose-500/25';
                    } else if (line.difficulty === 'easy') {
                      cardStyles = 'bg-emerald-500/[0.02] border-emerald-500/15 text-muted-foreground/75 hover:text-foreground font-semibold hover:border-emerald-500/25';
                    }
                  }

                  return (
                    <div
                      key={line.id || idx}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => handleScrub(line.startTime)}
                      className={`group relative text-center py-3 px-12 rounded-2xl transition-all duration-300 cursor-pointer border ${cardStyles}`}
                    >
                      {transcriptionViewMode === 'pronunciation' && lineScores[idx] !== undefined && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[9px] font-black">
                          <span>⭐ {lineScores[idx]}%</span>
                        </div>
                      )}

                      <p className={`transition-all ${isActive && !isCinematic ? 'text-sm sm:text-base' : ''}`}>
                        {isActive ? (
                          (() => {
                            const nextLine = activeTrack.transcriptionLines?.[idx + 1];
                            const endOfLine = nextLine ? nextLine.startTime : duration;
                            return renderHighlightedText(line.text, line.startTime, endOfLine);
                          })()
                        ) : (
                          line.text
                        )}
                      </p>
                      {showTranslationsInMode && (
                        <p className={`text-[10px] sm:text-xs font-medium mt-1 leading-normal transition-opacity ${isActive ? 'text-primary/75' : 'text-muted-foreground/40'}`}>
                          {line.translation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card/30 to-transparent pointer-events-none z-10" />

              {/* Pronunciation Feedback Panel */}
              {transcriptionViewMode === 'pronunciation' && (
                <div className="mx-6 mb-3 p-4 bg-card border border-border/80 rounded-2xl shadow-xl space-y-3 animate-fadeIn relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-primary/[0.02] pointer-events-none" />
                  
                  <div className="flex items-center justify-between gap-3 relative z-10 border-b border-border/30 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
                      <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                        Reconhecimento de Voz
                      </span>
                    </div>

                    <button
                      onClick={startSpeechRecognition}
                      className={`h-8 px-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 ${
                        isListeningSpeech
                          ? 'bg-rose-500 text-white shadow-rose-500/20 hover:bg-rose-600'
                          : 'bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90'
                      }`}
                    >
                      <Mic size={12} className={isListeningSpeech ? 'animate-pulse' : ''} />
                      {isListeningSpeech ? 'Parar Microfone' : 'Ativar Microfone'}
                    </button>
                  </div>

                  {activeLineIdx >= 0 && activeTrack.transcriptionLines?.[activeLineIdx] ? (
                    <div className="space-y-2 relative z-10 select-none">
                      <div className="flex flex-wrap items-center justify-center gap-1 px-4 py-2 border border-border/40 rounded-xl bg-muted/20 min-h-[46px]">
                        {speechWordDiffs.length > 0 ? (
                          speechWordDiffs.map((word, wIdx) => {
                            let colorClass = 'text-muted-foreground/60 border-transparent';
                            let bgClass = 'bg-transparent';
                            
                            if (word.type === 'correct') {
                              colorClass = 'text-emerald-600 dark:text-emerald-400 font-bold';
                              bgClass = 'bg-emerald-500/10 border-emerald-500/20';
                            } else if (word.type === 'incorrect') {
                              colorClass = 'text-rose-600 dark:text-rose-400 font-bold';
                              bgClass = 'bg-rose-500/10 border-rose-500/20';
                            } else if (word.type === 'missing') {
                              colorClass = 'text-rose-600/80 dark:text-rose-400/80 font-semibold';
                              bgClass = 'bg-rose-500/5 border-rose-500/10';
                            }
                            
                            return (
                              <span
                                key={wIdx}
                                className={`px-2.5 py-1 rounded-lg border text-xs leading-none transition-all ${colorClass} ${bgClass}`}
                              >
                                {word.word}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px] font-extrabold text-muted-foreground/50 italic">
                            {isListeningSpeech ? 'Cante ou fale a frase ativa agora...' : 'Ative o microfone e comece a cantar!'}
                          </span>
                        )}
                      </div>

                      {speechTranscript && (
                        <p className="text-[10px] font-semibold text-muted-foreground leading-normal text-center">
                          Você falou: <span className="text-foreground font-extrabold">"{speechTranscript}"</span>
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-1.5">
                          {speechSimilarity !== null && (
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              speechSimilarity >= 80
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : speechSimilarity >= 50
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}>
                              Precisão: {speechSimilarity}%
                            </span>
                          )}
                        </div>

                        {Object.keys(lineScores).length > 0 && (
                          <span className="text-[9px] font-black uppercase text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-md">
                            Média do Álbum: {Math.round(
                              Object.values(lineScores).reduce((a, b) => a + b, 0) / Object.keys(lineScores).length
                            )}%
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-muted-foreground/60 text-center py-2 italic leading-normal">
                      Dê play na música para iniciar a verificação da pronúncia.
                    </p>
                  )}
                </div>
              )}
            </div>
          </ShadcnCard>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full px-4 md:px-8 py-4 relative flex flex-col min-h-[calc(100vh-100px)]">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
        }
        .custom-slider::-webkit-slider-runnable-track {
          background: linear-gradient(
            to right,
            hsl(var(--primary)) var(--slider-fill, 0%),
            rgba(255, 255, 255, 0.08) var(--slider-fill, 0%)
          );
          height: 5px;
          border-radius: 9999px;
          transition: none;
        }
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: hsl(var(--primary));
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          margin-top: -4.5px;
          cursor: pointer;
          box-shadow: 0 0 10px hsl(var(--primary) / 0.6);
          transition: transform 0.1s ease, background 0.15s ease;
        }
        .custom-slider::-webkit-slider-thumb:hover {
          transform: scale(1.3);
          background: #ffffff;
        }
        .custom-slider::-moz-range-track {
          background: rgba(255, 255, 255, 0.08);
          height: 5px;
          border-radius: 9999px;
        }
        .custom-slider::-moz-range-progress {
          background: hsl(var(--primary));
          height: 5px;
          border-radius: 9999px;
        }
        .custom-slider::-moz-range-thumb {
          background: hsl(var(--primary));
          width: 14px;
          height: 14px;
          border: none;
          border-radius: 9999px;
          cursor: pointer;
          box-shadow: 0 0 10px hsl(var(--primary) / 0.6);
          transition: transform 0.1s ease;
        }
        .custom-slider::-moz-range-thumb:hover {
          transform: scale(1.3);
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}} />

      {/* Background glow decoration */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {activeTrack ? renderActiveStudio() : renderDashboard()}

      {/* Floating Bottom Fixed Player Bar */}
      {activeTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <div className="w-full pointer-events-auto bg-card/65 backdrop-blur-2xl border-t border-border/40 shadow-2xl shadow-black/30 overflow-hidden flex flex-col animate-fadeIn">
            {/* Interactive Progress Bar */}
            <div className="relative h-1 w-full bg-border/20 group/progress">
              <div
                className="absolute h-full bg-primary"
                style={{ width: duration ? `${Math.min((progress / duration) * 100, 100)}%` : '0%' }}
              />
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={progress}
                step={0.1}
                onChange={(e) => handleScrub(parseFloat(e.target.value))}
                disabled={!activeTrack}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
              {/* Left Side: Track details */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {(() => {
                  const coverSrc = playlistCoverUrls[activeTrack.playlistId];
                  return coverSrc ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/40 shadow-sm hidden sm:block">
                      <img src={coverSrc} alt={activeTrack.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg shrink-0 bg-muted/60 border border-border/30 flex items-center justify-center text-muted-foreground hidden sm:flex">
                      <Music size={16} />
                    </div>
                  );
                })()}

                <div className="flex-1 min-w-0">
                  {activeLineIdx >= 0 && activeTrack?.transcriptionLines?.[activeLineIdx] ? (
                    <p className="text-xs sm:text-sm font-extrabold text-primary truncate animate-fadeIn">
                      {activeTrack.transcriptionLines[activeLineIdx].text}
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-foreground truncate">
                      {activeTrack.title}
                    </p>
                  )}
                  {activeLineIdx >= 0 && activeTrack?.transcriptionLines?.[activeLineIdx]?.translation && showTranslation && (
                    <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.5 animate-fadeIn">
                      {activeTrack.transcriptionLines[activeLineIdx].translation}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Side: Player controls */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <p className="text-[10px] text-muted-foreground font-mono tabular-nums hidden md:block">
                  {formatTime(progress)} / {formatTime(duration)}
                </p>

                <div className="flex items-center bg-muted/40 border border-border/30 rounded-xl p-0.5 gap-0.5 hidden sm:flex">
                  <button
                    type="button"
                    onClick={() => toggleVocalReduction(!isVocalReductionActive)}
                    title="Atenuar voz (DSP)"
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      isVocalReductionActive
                        ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    DSP
                  </button>

                  <div className="w-px h-3 bg-border/40" />

                  {activeTrack.instrumentalFile ? (
                    <button
                      type="button"
                      onClick={() => toggleIaInstrumental(!isIaInstrumentalActive)}
                      title="Alternar instrumental sem voz (IA)"
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        isIaInstrumentalActive
                          ? 'bg-violet-500/20 text-violet-500 dark:text-violet-400'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      IA
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Instrumental IA indisivivel para esta faixa"
                      className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-muted-foreground/30 cursor-not-allowed"
                    >
                      IA
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsLooping(!isLooping)}
                  className={`text-[9px] sm:text-[10px] font-black rounded-xl px-2.5 py-1.5 transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                    isLooping 
                      ? 'bg-amber-500/15 border border-amber-500/35 text-amber-600 dark:text-amber-400 font-bold' 
                      : 'text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80'
                  }`}
                  title={isLooping ? 'Desativar repetição da faixa' : 'Repetir faixa continuamente'}
                >
                  <Repeat size={10} className={isLooping ? 'animate-spin-slow' : ''} />
                  <span className="hidden xs:inline">Loop</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                    handleSpeedChange(next);
                  }}
                  className="text-[9px] sm:text-[10px] font-black text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl px-2.5 py-1.5 transition-all cursor-pointer tabular-nums shrink-0"
                  title="Velocidade de reprodução"
                >
                  {playbackSpeed}×
                </button>

                <button
                  type="button"
                  onClick={handlePrevTrack}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer hover:bg-muted shrink-0"
                  title="Faixa Anterior"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="19 20 9 12 19 4 19 20"/>
                    <line x1="5" y1="19" x2="5" y2="5"/>
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (audioRef.current) {
                      if (isPlaying) {
                        audioRef.current.pause();
                        setIsPlaying(false);
                      } else {
                        audioRef.current.play().catch(e => console.warn(e));
                        setIsPlaying(true);
                      }
                    }
                  }}
                  className="w-9 h-9 sm:w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/95 active:scale-95 transition-all cursor-pointer shadow-lg shadow-primary/25 shrink-0"
                  title={isPlaying ? 'Pausar' : 'Reproduzir'}
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer hover:bg-muted shrink-0"
                  title="Proxima Faixa"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                    <line x1="19" y1="5" x2="19" y2="19"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
