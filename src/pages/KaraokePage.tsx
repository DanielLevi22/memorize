import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Headphones, Mic, Sparkles, ChevronRight, 
  ArrowLeft, Languages, Volume2, Repeat, FileText, 
  CheckCircle2, Music, Settings2, Download, Upload, RefreshCw,
  Maximize2, Minimize2, Trash2, Plus, HelpCircle, Save
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { db } from '../db/db';
import type { Playlist, AudioTrack, TranscriptionLine } from '../types';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { getWordLevenshteinDistance, diffWords, type DiffWord } from '../utils/srs';
import { separateVocalsCloud } from '../utils/vocalSeparationCloud';
import { decodeAudioFile, findSilenceSplitPoints, bufferToWav, adjustTimestampsSafeguard } from '../utils/audioChunker';

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
  isFullscreenMode?: boolean;
  setIsFullscreenMode?: (fs: boolean) => void;
}

export const KaraokePage: React.FC<KaraokePageProps> = ({ 
  initialTrackId, 
  onClearTrack, 
  setActiveTab,
  isFullscreenMode = false,
  setIsFullscreenMode = () => {}
}) => {
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

  // Lyrics editor states
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [transcriptionTab, setTranscriptionTab] = useState<'view' | 'sync' | 'adjust'>('view');
  const [isSyncInstructionsOpen, setIsSyncInstructionsOpen] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [tempLines, setTempLines] = useState<TranscriptionLine[]>([]);
  const [syncingLineIdx, setSyncingLineIdx] = useState(0);
  const [isTranscribingAi, setIsTranscribingAi] = useState(false);
  const [transcribingProgress, setTranscribingProgress] = useState('');

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
    if (activeLineRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const element = activeLineRef.current;
      const elementTop = element.offsetTop;
      const elementHeight = element.offsetHeight;
      const containerHeight = container.clientHeight;
      const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
  }, [activeLineIdx]);

  // Reset speech states when active line changes
  useEffect(() => {
    setSpeechTranscript('');
    setSpeechSimilarity(null);
    setSpeechWordDiffs([]);
  }, [activeLineIdx]);

  // Whenever tempLines changes, keep transcriptionText updated
  useEffect(() => {
    if (tempLines.length > 0) {
      const text = tempLines.map(l => l.text).join('\n');
      setTranscriptionText(text);
    }
  }, [tempLines]);

  const handleLoadTextToTempLines = () => {
    const rawLines = transcriptionText.split('\n').map(l => l.trim()).filter(Boolean);
    const currentText = tempLines.map(l => l.text).join('\n');
    const newText = rawLines.join('\n');
    if (currentText !== newText || tempLines.length === 0) {
      setTempLines(rawLines.map(text => ({
        id: crypto.randomUUID(),
        text,
        startTime: 0,
        endTime: undefined
      })));
    }
  };

  const adjustLineTime = (idx: number, delta: number) => {
    setTempLines(prev => prev.map((line, i) => {
      if (i === idx) {
        const newTime = Math.max(0, parseFloat((line.startTime + delta).toFixed(2)));
        return { ...line, startTime: newTime };
      }
      return line;
    }));
  };

  const updateLineText = (idx: number, text: string) => {
    setTempLines(prev => prev.map((line, i) => {
      if (i === idx) return { ...line, text };
      return line;
    }));
  };

  const updateLineTranslation = (idx: number, translation: string) => {
    setTempLines(prev => prev.map((line, i) => {
      if (i === idx) return { ...line, translation };
      return line;
    }));
  };

  const updateLineStartTimeDirectly = (idx: number, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setTempLines(prev => prev.map((line, i) => {
        if (i === idx) return { ...line, startTime: Math.max(0, num) };
        return line;
      }));
    }
  };

  const deleteLine = (idx: number) => {
    setTempLines(prev => prev.filter((_, i) => i !== idx));
  };

  const insertLineAfter = (idx: number) => {
    setTempLines(prev => {
      const newLine: TranscriptionLine = {
        id: crypto.randomUUID(),
        text: '',
        startTime: prev[idx] ? parseFloat((prev[idx].startTime + 1.0).toFixed(2)) : 0,
        endTime: undefined
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, newLine);
      return copy;
    });
  };

  const insertLineAtStart = () => {
    setTempLines(prev => {
      const newLine: TranscriptionLine = {
        id: crypto.randomUUID(),
        text: '',
        startTime: 0,
        endTime: undefined
      };
      return [newLine, ...prev];
    });
  };

  const insertLineAtEnd = () => {
    setTempLines(prev => {
      const lastLine = prev[prev.length - 1];
      const newLine: TranscriptionLine = {
        id: crypto.randomUUID(),
        text: '',
        startTime: lastLine ? parseFloat((lastLine.startTime + 1.0).toFixed(2)) : 0,
        endTime: undefined
      };
      return [...prev, newLine];
    });
  };

  const handlePlayFromTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
      if (!isPlaying) {
        audioRef.current.play().catch(e => console.warn(e));
        setIsPlaying(true);
      }
    }
  };

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
    setIsFullscreenMode(false);
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

  // Sincronia de Letra & Editor
  const handleOpenTranscription = (track: AudioTrack) => {
    cleanupAudio();
    setActiveTrack(track);
    setTranscriptionTab('view');
    setProgress(0);
    setDuration(0);
    setTranscriptionText(track.transcriptionLines?.map(l => l.text).join('\n') || '');
    setTempLines(track.transcriptionLines || []);
    setSyncingLineIdx(0);
    setIsEditingLyrics(true);
    handlePlayTrack(track);
  };

  const handleSaveTranscription = async () => {
    if (!activeTrack) return;
    const sortedLines = [...tempLines].sort((a, b) => a.startTime - b.startTime);

    try {
      await db.audioTracks.update(activeTrack.id, {
        transcriptionLines: sortedLines,
        updatedAt: Date.now()
      });
      toast.success('Transcrição e sincronização salvas com sucesso!');
      
      const updatedTrack = { ...activeTrack, transcriptionLines: sortedLines };
      setActiveTrack(updatedTrack);
      setAllTracks(prev => prev.map(t => t.id === activeTrack.id ? updatedTrack : t));
      setIsEditingLyrics(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar transcrição.');
    }
  };

  const handleStartAiTranscription = async () => {
    if (!activeTrack) return;
    const geminiApiKey = localStorage.getItem('memorize_gemini_api_key') || '';
    if (!geminiApiKey.trim()) {
      toast.error('Configuração Requerida: Adicione sua Chave de API do Gemini nas Configurações.');
      return;
    }

    try {
      setIsTranscribingAi(true);
      setTranscribingProgress('Decodificando áudio localmente...');

      const audioBuffer = await decodeAudioFile(activeTrack.audioFile);
      const splitPoints = findSilenceSplitPoints(audioBuffer);

      let finalLines: TranscriptionLine[] = [];
      const totalChunks = splitPoints.length + 1;

      for (let i = 0; i <= splitPoints.length; i++) {
        const start = i === 0 ? 0 : splitPoints[i - 1];
        const end = i === splitPoints.length ? audioBuffer.duration : splitPoints[i];
        
        setTranscribingProgress(`Processando trecho ${i + 1} de ${totalChunks}...`);

        const wavBlob = await bufferToWav(audioBuffer, start, end);
        const chunkLines = await requestGeminiTranscription(wavBlob, geminiApiKey);

        const adjustedLines = chunkLines.map(l => ({
          ...l,
          id: crypto.randomUUID(),
          startTime: l.startTime + start,
          endTime: l.endTime !== undefined ? l.endTime + start : undefined
        }));

        finalLines = [...finalLines, ...adjustedLines];
      }

      const postProcessedLines = adjustTimestampsSafeguard(finalLines, audioBuffer.duration);

      setTempLines(postProcessedLines);
      setTranscriptionText(postProcessedLines.map(l => l.text).join('\n'));
      setSyncingLineIdx(postProcessedLines.length);
      
      toast.success('Áudio transcrito e traduzido com sucesso pelo Gemini 2.5 Flash!');
      setTranscriptionTab('view');
    } catch (err: any) {
      console.error("[TranscriptionError]", err);
      toast.error(err.message || 'Erro durante a transcrição.');
    } finally {
      setIsTranscribingAi(false);
      setTranscribingProgress('');
    }
  };

  const requestGeminiTranscription = async (audioBlob: Blob, apiKey: string): Promise<TranscriptionLine[]> => {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(audioBlob);
    });
    const base64Data = await base64Promise;

    const promptText = `
Você é uma IA especializada em transcrição de áudio e tradução pedagógica de idiomas.
Sua tarefa é transcrever o áudio fornecido e gerar a tradução de cada frase para fins de estudo de idiomas.

Sua resposta deve ser obrigatoriamente um objeto JSON com uma lista de "lines", onde cada linha possui:
1. "startTime": Tempo de início em segundos (float).
2. "endTime": Tempo de fim em segundos (float).
3. "text": Texto transcrito exatamente como falado (em inglês/idioma original do áudio).
4. "translation": Tradução da linha para o português do Brasil.

O JSON deve seguir exatamente este formato:
{
  "lines": [
    { "startTime": 1.2, "endTime": 3.5, "text": "Hello, how are you?", "translation": "Olá, como você está?" }
  ]
}
Não adicione explicações, comentários ou markdown fora do bloco JSON.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: 'audio/wav', data: base64Data } }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Gemini retornou status ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('Resposta vazia da API do Gemini.');
    }

    const parsed = JSON.parse(textResponse);
    return parsed.lines || [];
  };

  // Syncing stamp handlers
  const handleStartManualSync = () => {
    if (!transcriptionText.trim()) {
      toast.error('Escreva ou cole a letra da música primeiro!');
      return;
    }
    setIsSyncInstructionsOpen(true);
  };

  const startManualSyncAfterConfirm = () => {
    setIsSyncInstructionsOpen(false);
    const rawLines = transcriptionText.split('\n').map(l => l.trim()).filter(Boolean);
    const newLines = rawLines.map((text, idx) => {
      const existing = tempLines[idx];
      return {
        id: existing?.text === text ? existing.id : crypto.randomUUID(),
        text,
        startTime: 0,
        endTime: undefined,
        translation: existing?.text === text ? existing.translation : undefined,
        difficulty: existing?.text === text ? existing.difficulty : undefined
      };
    });
    setTempLines(newLines);
    setSyncingLineIdx(0);
    setTranscriptionTab('sync');
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      audioRef.current.play().catch(e => console.warn(e));
      setIsPlaying(true);
    }
  };

  const handleNextSyncStamp = () => {
    if (syncingLineIdx >= tempLines.length) return;
    
    const currentProgress = audioRef.current ? audioRef.current.currentTime : progress;
    
    setTempLines(prev => {
      const copy = [...prev];
      copy[syncingLineIdx] = {
        ...copy[syncingLineIdx],
        startTime: currentProgress
      };
      if (syncingLineIdx > 0 && copy[syncingLineIdx - 1].endTime === undefined) {
        copy[syncingLineIdx - 1] = {
          ...copy[syncingLineIdx - 1],
          endTime: currentProgress
        };
      }
      return copy;
    });
    
    setSyncingLineIdx(prev => prev + 1);
  };

  const undoLastStamp = () => {
    if (syncingLineIdx === 0) return;
    
    setTempLines(prev => {
      const copy = [...prev];
      const prevIdx = syncingLineIdx - 1;
      
      copy[prevIdx] = {
        ...copy[prevIdx],
        startTime: 0,
        endTime: undefined
      };
      
      if (prevIdx > 0) {
        copy[prevIdx - 1] = {
          ...copy[prevIdx - 1],
          endTime: undefined
        };
      }
      return copy;
    });
    
    setSyncingLineIdx(prev => prev - 1);
  };

  const handleImportLRC = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const lines = parseLRC(content);
        if (lines.length === 0) {
          toast.error('Nenhuma linha de letra encontrada no arquivo LRC.');
          return;
        }
        setTempLines(lines);
        setTranscriptionText(lines.map(l => l.text).join('\n'));
        setSyncingLineIdx(lines.length);
        toast.success(`Importado ${lines.length} linhas do arquivo LRC.`);
        setTranscriptionTab('view');
      } catch (err) {
        console.error(err);
        toast.error('Falha ao processar o arquivo LRC.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportLRC = () => {
    if (tempLines.length === 0) {
      toast.error('Não há letras para exportar.');
      return;
    }
    const lrcContent = formatLRC(tempLines, activeTrack?.title || 'audio');
    const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTrack?.title || 'letra'}.lrc`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Letras exportadas como arquivo LRC com sucesso!');
  };

  const parseLRC = (lrcText: string): TranscriptionLine[] => {
    const lines = lrcText.split('\n');
    const result: TranscriptionLine[] = [];
    const timeRegex = /\[(\d+):(\d+(?:\.\d+)?)\]/;

    for (let line of lines) {
      line = line.trim();
      const match = timeRegex.exec(line);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseFloat(match[2]);
        const time = min * 60 + sec;
        const text = line.replace(timeRegex, '').trim();
        result.push({
          id: crypto.randomUUID(),
          text,
          startTime: time
        });
      }
    }

    for (let i = 0; i < result.length; i++) {
      if (i + 1 < result.length) {
        result[i].endTime = result[i + 1].startTime;
      } else if (audioRef.current) {
        result[i].endTime = audioRef.current.duration;
      }
    }

    return result;
  };

  const formatLRC = (lines: TranscriptionLine[], title: string): string => {
    let output = `[ti:${title}]\n`;
    for (const line of lines) {
      const min = Math.floor(line.startTime / 60);
      const sec = (line.startTime % 60).toFixed(2);
      const timeStr = `[${String(min).padStart(2, '0')}:${sec.padStart(5, '0')}]`;
      output += `${timeStr} ${line.text}\n`;
    }
    return output;
  };

  // Hotkey listener for manual sync (Space/Enter to stamp, Backspace to undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditingLyrics || transcriptionTab !== 'sync') return;
      
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNextSyncStamp();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        undoLastStamp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditingLyrics, transcriptionTab, syncingLineIdx, progress, tempLines]);

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
  const renderTranscriptionPanel = () => {
    if (!activeTrack) return null;

    return (
      <div className="flex-1 flex flex-col min-h-0 mt-4 relative z-10">
        {/* Sub-tabs switch between view and adjust, only if not actively syncing */}
        {transcriptionTab !== 'sync' && (
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 border border-border/30 rounded-xl p-1 shrink-0 mb-4 max-w-fit relative z-20">
            <button
              type="button"
              onClick={() => setTranscriptionTab('view')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                transcriptionTab === 'view'
                  ? 'bg-primary text-primary-foreground shadow-sm animate-fadeIn'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <FileText size={12} />
              <span>Letra Texto</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleLoadTextToTempLines();
                setTranscriptionTab('adjust');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                transcriptionTab === 'adjust'
                  ? 'bg-primary text-primary-foreground shadow-sm animate-fadeIn'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Settings2 size={12} />
              <span>Ajustar Frases (Tempos)</span>
            </button>
          </div>
        )}

        {transcriptionTab === 'view' ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn">
            <div className="flex-1 flex flex-col min-h-0 relative">
              <label className="text-xs font-bold text-muted-foreground/80 block mb-1.5 uppercase tracking-widest">
                Letra Original (uma frase por linha)
              </label>
              <textarea
                value={transcriptionText}
                onChange={(e) => setTranscriptionText(e.target.value)}
                placeholder="Cole ou digite a letra da música aqui. Pule uma linha para cada nova frase para que possam ser sincronizadas individualmente no player."
                className="flex-1 w-full bg-muted/20 hover:bg-muted/30 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-2xl p-4 text-xs font-medium leading-relaxed resize-none text-foreground placeholder:text-muted-foreground/50 transition-all select-text"
              />
            </div>

            {/* Ações de Letras */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              <div className="space-y-3">
                <Button
                  onClick={handleStartManualSync}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs h-11 rounded-xl shadow-md shadow-primary/10 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Settings2 size={14} />
                  Iniciar Sincronia Manual
                </Button>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="file"
                      accept=".lrc"
                      onChange={handleImportLRC}
                      id="lrc-import-input"
                      className="hidden"
                    />
                    <Button
                      onClick={() => document.getElementById('lrc-import-input')?.click()}
                      variant="outline"
                      className="w-full border-border/60 hover:bg-muted text-foreground font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload size={13} />
                      Importar LRC
                    </Button>
                  </div>

                  {tempLines.length > 0 && (
                    <Button
                      onClick={handleExportLRC}
                      variant="outline"
                      className="flex-1 border-border/60 hover:bg-muted text-foreground font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download size={13} />
                      Exportar LRC
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={11} className="text-primary animate-pulse" />
                    Transcrição com IA Gemini
                  </h4>
                  <p className="text-[9px] text-muted-foreground leading-normal font-semibold">
                    Use a inteligência artificial do Google para decodificar o áudio em inglês/idioma original e gerar a tradução para o português automaticamente.
                  </p>
                </div>

                <Button
                  onClick={handleStartAiTranscription}
                  disabled={isTranscribingAi}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs h-10 rounded-xl shadow-md shadow-violet-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  <Sparkles size={13} />
                  <span>Auto-Transcrever e Traduzir</span>
                </Button>
              </div>
            </div>
          </div>
        ) : transcriptionTab === 'adjust' ? (
          /* Aba de Ajuste Manual de Tempos e Frases */
          <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn">
            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 border border-border/40 rounded-2xl bg-muted/10 p-4 space-y-3 min-h-[300px]">
              <div className="flex items-center justify-between pb-2 border-b border-border/20">
                <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                  Ajuste Fino de Tempos e Frases
                </h4>
                <Button
                  onClick={insertLineAtStart}
                  variant="outline"
                  size="sm"
                  className="h-8 border-border/60 hover:bg-muted text-foreground font-bold text-[10px] rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />
                  Inserir no Início
                </Button>
              </div>

              {tempLines.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-3.5 border-2 border-dashed border-border/40 rounded-xl bg-card/25 my-4">
                  <div className="p-3 bg-muted/40 rounded-full text-muted-foreground/60 border border-border/20 shadow-inner">
                    <Plus size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">Sem frases configuradas</p>
                    <p className="text-[10px] text-muted-foreground max-w-xs leading-normal">
                      Insira frases individualmente com tempo abaixo, ou volte na aba <strong>Letra Texto</strong> para colar toda a letra de uma vez.
                    </p>
                  </div>
                  <Button
                    onClick={insertLineAtStart}
                    size="sm"
                    className="bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold text-[10px] h-8 px-4 rounded-lg cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={12} />
                    Adicionar Primeira Frase
                  </Button>
                </div>
              ) : (
                <>
                  {tempLines.map((line, idx) => (
                    <div key={line.id || idx} className="bg-card/60 border border-border/40 rounded-xl p-3.5 space-y-3 relative hover:border-border/80 transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black text-muted-foreground/60 bg-muted/50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>

                        {/* Inputs */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider block">Texto da Frase</span>
                            <input
                              type="text"
                              value={line.text}
                              onChange={(e) => updateLineText(idx, e.target.value)}
                              className="w-full bg-muted/20 border border-border/30 rounded-lg px-2.5 py-1 text-xs font-semibold focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider block">Tradução</span>
                            <input
                              type="text"
                              value={line.translation || ''}
                              onChange={(e) => updateLineTranslation(idx, e.target.value)}
                              placeholder="Tradução da frase..."
                              className="w-full bg-muted/20 border border-border/30 rounded-lg px-2.5 py-1 text-xs font-medium focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground"
                            />
                          </div>
                        </div>

                        {/* Direto Tempo Input */}
                        <div className="w-20 space-y-1 shrink-0">
                          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider block">Tempo (s)</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={line.startTime}
                            onChange={(e) => updateLineStartTimeDirectly(idx, e.target.value)}
                            className="w-full bg-muted/20 border border-border/30 rounded-lg px-2.5 py-1 text-xs font-bold font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground text-center"
                          />
                        </div>
                      </div>

                      {/* Ações da Linha */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border/20">
                        <div className="flex items-center gap-1.5">
                          <Button
                            onClick={() => handlePlayFromTime(line.startTime)}
                            variant="ghost"
                            size="sm"
                            className="h-7 text-primary hover:bg-primary/10 text-[9px] font-extrabold rounded-md flex items-center gap-1 px-2.5 shrink-0"
                            title="Ouvir áudio a partir deste ponto"
                          >
                            <Play size={10} className="fill-current" />
                            Ouvir Trecho
                          </Button>

                          {/* Ajustadores Rápidos */}
                          <span className="text-[9px] font-bold text-muted-foreground/40 uppercase select-none px-1">Ajuste rápido:</span>
                          <button
                            type="button"
                            onClick={() => adjustLineTime(idx, -0.5)}
                            className="h-6 px-1.5 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-[9px] font-mono font-bold rounded border border-border/30 cursor-pointer animate-none"
                            title="Voltar 0.5s"
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustLineTime(idx, -0.1)}
                            className="h-6 px-1.5 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-[9px] font-mono font-bold rounded border border-border/30 cursor-pointer animate-none"
                            title="Voltar 0.1s"
                          >
                            -0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustLineTime(idx, 0.1)}
                            className="h-6 px-1.5 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-[9px] font-mono font-bold rounded border border-border/30 cursor-pointer animate-none"
                            title="Avançar 0.1s"
                          >
                            +0.1s
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustLineTime(idx, 0.5)}
                            className="h-6 px-1.5 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-[9px] font-mono font-bold rounded border border-border/30 cursor-pointer animate-none"
                            title="Avançar 0.5s"
                          >
                            +0.5s
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            onClick={() => insertLineAfter(idx)}
                            variant="ghost"
                            size="sm"
                            className="h-7 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-[9px] font-bold rounded-md flex items-center gap-1 px-2"
                            title="Inserir nova frase abaixo"
                          >
                            <Plus size={10} />
                            Inserir
                          </Button>
                          <Button
                            onClick={() => deleteLine(idx)}
                            variant="ghost"
                            size="sm"
                            className="h-7 text-rose-500 hover:bg-rose-500/10 text-[9px] font-bold rounded-md flex items-center gap-1 px-2"
                            title="Excluir esta frase"
                          >
                            <Trash2 size={10} />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-center pt-2">
                    <Button
                      onClick={insertLineAtEnd}
                      variant="outline"
                      className="w-full max-w-xs border-dashed border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground font-bold text-[10px] h-9 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={12} />
                      Adicionar Nova Frase no Final
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Salvar Botão no Ajuste */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/20 shrink-0">
              <span className="text-[10px] text-muted-foreground font-bold leading-normal">
                Dica: Ordene e ajuste os tempos de cada linha. Ao finalizar, salve as alterações.
              </span>
              <Button
                onClick={handleSaveTranscription}
                disabled={tempLines.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-11 rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer px-6"
              >
                <Save size={13} />
                Salvar Sincronia e Frases
              </Button>
            </div>
          </div>
        ) : (
          /* Aba de Sincronia Manual Ativa (sync) */
          <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-fadeIn">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <Settings2 size={11} /> Sincronia Manual Ativa
              </span>
              <span>
                Atalhos: <kbd className="bg-card px-1 rounded border border-border/30 font-mono text-[9px]">ESPAÇO / ENTER</kbd> Carimbar • <kbd className="bg-card px-1 rounded border border-border/30 font-mono text-[9px]">BACKSPACE</kbd> Desfazer
              </span>
            </div>

            {/* Lista de Letras para Carimbagem */}
            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 border border-border/40 rounded-2xl bg-muted/10 p-3 space-y-1.5 min-h-[180px]">
              {tempLines.map((line, idx) => {
                const isCurrent = syncingLineIdx === idx;
                const isStamped = idx < syncingLineIdx;
                
                return (
                  <div
                    key={line.id || idx}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all duration-200 ${
                      isCurrent
                        ? 'bg-primary/10 border-primary/40 text-foreground font-extrabold ring-1 ring-primary/20 scale-[1.01]'
                        : isStamped
                        ? 'bg-emerald-500/[0.03] border-emerald-500/15 text-muted-foreground/80 font-medium'
                        : 'bg-transparent border-transparent text-muted-foreground/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : isStamped
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="truncate">{line.text}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-[9px] font-black">
                      {isStamped ? (
                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                          {formatTime(line.startTime)}
                        </span>
                      ) : isCurrent ? (
                        <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded-md animate-pulse">
                          Aguardando
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">
                          --:--
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Painel de Controles Manuais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 pt-2 border-t border-border/20">
              <Button
                onClick={handleNextSyncStamp}
                disabled={syncingLineIdx >= tempLines.length}
                className="col-span-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs h-11 rounded-xl shadow-lg shadow-primary/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                Carimbar Linha ({syncingLineIdx + 1}/{tempLines.length})
              </Button>

              <Button
                onClick={undoLastStamp}
                disabled={syncingLineIdx === 0}
                variant="outline"
                className="border-border/60 hover:bg-muted text-foreground font-bold text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                Desfazer Marco
              </Button>

              <Button
                onClick={handleSaveTranscription}
                disabled={syncingLineIdx === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-11 rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                Salvar Sincronia
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Rendering components
  const renderDashboard = () => {
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
              Escolha uma música para cantar, praticar a escuta ou sincronizar suas letras em tempo real no estúdio de karaokê.
            </p>
          </div>

          <Button
            onClick={() => setActiveTab('playlist')}
            className="bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 h-10 px-4 shadow-lg shadow-primary/10 cursor-pointer transition-all duration-200 active:scale-95 shrink-0"
          >
            Adicionar / Transcrever Música
          </Button>
        </div>

        {allTracks.length === 0 ? (
          <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
            <div className="p-4 bg-muted/40 rounded-full border border-border/30 shadow-inner">
              <Headphones size={36} className="text-muted-foreground/60 animate-bounce" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-extrabold text-foreground">Nenhuma música cadastrada</p>
              <p className="text-xs text-muted-foreground max-w-sm leading-normal">
                Faça upload de arquivos de áudio no gerenciador de playlists para começar a sincronizar as letras ou cantar.
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
              const playlistTracks = allTracks.filter(t => t.playlistId === playlist.id);
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
                        {playlistTracks.length} faixas disponíveis
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 flex-1 max-h-[190px] overflow-y-auto no-scrollbar pr-1">
                    {playlistTracks.map(track => {
                      const hasTranscription = track.transcriptionLines && track.transcriptionLines.length > 0;
                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            if (!hasTranscription) {
                              handleOpenTranscription(track);
                            } else {
                              setIsEditingLyrics(false);
                              handlePlayTrack(track);
                            }
                          }}
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
                            {!hasTranscription && (
                              <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/15" title="Sem letras prontas">
                                Sem letra 📝
                              </span>
                            )}
                            {track.instrumentalFile && (
                              <span className="text-[8px] font-black text-violet-500 bg-violet-500/10 px-1 py-0.5 rounded border border-violet-500/15" title="Instrumental sem voz pronto">
                                ✦ IA
                              </span>
                            )}
                            <ChevronRight size={12} className="text-muted-foreground/30" />
                          </div>
                        </div>
                      );
                    })}
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
        
        {/* COLUNA 1: Visualizador de Disco de Vinil (Esquerda) — Oculto em mobile ou Tela Cheia */}
        {!isFullscreenMode && (
          <div className="hidden lg:flex lg:col-span-1 flex-col items-center justify-center relative">
            <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-6 rounded-3xl shadow-xl flex flex-col items-center justify-between w-full h-full lg:h-[calc(100vh-180px)] lg:max-h-[calc(100vh-180px)] min-h-[400px] relative overflow-hidden">
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
        )}

        {/* COLUNA 2: Letras & Controles do Estúdio (Direita) */}
        <div className={`${isFullscreenMode ? 'lg:col-span-4' : 'lg:col-span-3'} flex flex-col h-full space-y-4`}>
          <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-5 rounded-2xl shadow-xl flex flex-col flex-1 h-full lg:h-[calc(100vh-180px)] lg:max-h-[calc(100vh-180px)] min-h-[400px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px] pointer-events-none" />

            {/* Cabeçalho do Estúdio */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={isEditingLyrics ? () => setIsEditingLyrics(false) : handleCloseStudio}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40 bg-card/65 shadow-sm"
                  title={isEditingLyrics ? "Voltar ao Player" : "Voltar ao estúdio"}
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

                {/* Editar Letras */}
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingLyrics) {
                      setIsEditingLyrics(false);
                    } else {
                      setTranscriptionText(activeTrack.transcriptionLines?.map(l => l.text).join('\n') || '');
                      setTempLines(activeTrack.transcriptionLines || []);
                      setSyncingLineIdx(0);
                      setTranscriptionTab('view');
                      setIsEditingLyrics(true);
                    }
                  }}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer shadow-sm text-xs font-bold flex items-center gap-1.5 ${
                    isEditingLyrics
                      ? 'bg-primary/15 border-primary/35 text-primary hover:bg-primary/20 shadow-sm shadow-primary/10'
                      : 'border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={isEditingLyrics ? "Sair da Edição" : "Editar Letras"}
                >
                  <Settings2 size={14} />
                  <span className="hidden sm:inline text-[10px]">Editar Letra</span>
                </button>

                {/* Alternar Tela Cheia */}
                <button
                  onClick={() => setIsFullscreenMode(!isFullscreenMode)}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer shadow-sm ${
                    isFullscreenMode
                      ? 'bg-primary/15 border-primary/35 text-primary hover:bg-primary/20 shadow-sm shadow-primary/10'
                      : 'border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={isFullscreenMode ? 'Sair da Tela Cheia' : 'Tela Cheia'}
                >
                  {isFullscreenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>

            {/* Barra de Seleção de Modos */}
            {!isEditingLyrics && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 pb-2 border-b border-border/20 shrink-0 relative z-10 animate-fadeIn">
                <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 border border-border/30 rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTranscriptionViewMode('normal');
                      stopSpeechRecognition();
                      setIsEditingLyrics(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      transcriptionViewMode === 'normal' && !isEditingLyrics
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
                      setIsEditingLyrics(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      transcriptionViewMode === 'playback' && !isEditingLyrics
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
                      setIsEditingLyrics(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      transcriptionViewMode === 'pronunciation' && !isEditingLyrics
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
                      title="Atenuar voz com cancelamento de phase estéreo."
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
            )}

            {isEditingLyrics ? (
              renderTranscriptionPanel()
            ) : (
              /* Painel Central das Letras */
              <div className="flex-1 flex flex-col min-h-0 relative mt-3 pb-2">
              <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-card/30 to-transparent pointer-events-none z-10" />

              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-5 pt-8 pb-36 select-none relative">
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
            )}
          </ShadcnCard>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 w-full px-4 md:px-8 py-4 relative flex flex-col ${
      activeTrack 
        ? 'h-full max-h-full min-h-0 flex-1' 
        : 'min-h-[calc(100vh-100px)]'
    }`}>
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
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
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

      {/* Modal: Instruções da Sincronização Manual */}
      <Dialog open={isSyncInstructionsOpen} onOpenChange={setIsSyncInstructionsOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <HelpCircle size={16} />
              </div>
              Passo a Passo: Sincronização Manual
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Siga as instruções abaixo para sincronizar a letra com o áudio da música.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-3 text-xs leading-relaxed font-medium text-muted-foreground">
            <div className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
              <p>O áudio começará a tocar do início e a primeira frase ficará destacada em roxo/azul aguardando a sua marcação.</p>
            </div>
            <div className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
              <p>No momento exato em que a frase destacada for falada/cantada, pressione a tecla <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/45 font-mono text-[9px] text-foreground font-bold">ESPAÇO</kbd>, <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/45 font-mono text-[9px] text-foreground font-bold">ENTER</kbd> ou clique no botão <strong>Carimbar Linha</strong>.</p>
            </div>
            <div className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
              <p>A frase seguinte ficará destacada automaticamente. Repita o processo até carimbar todas as frases da música.</p>
            </div>
            <div className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">4</span>
              <p>Se errar ou passar do ponto, pressione a tecla <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/45 font-mono text-[9px] text-foreground font-bold">BACKSPACE</kbd> ou clique em <strong>Desfazer Marco</strong> para retroceder e refazer a marcação da frase anterior.</p>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSyncInstructionsOpen(false)}
              className="hover:bg-muted text-foreground font-bold rounded-xl text-xs h-10 cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={startManualSyncAfterConfirm}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl text-xs h-10 px-5 cursor-pointer shadow-lg shadow-primary/15 flex items-center gap-1.5"
            >
              Começar Sincronia 🚀
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Transcrição em Andamento */}
      <Dialog open={isTranscribingAi} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Outer rotating gradient ring */}
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            {/* Inner glowing core */}
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-black tracking-tight text-foreground uppercase">
              Transcrição Inteligente Gemini
            </h3>
            <p className="text-[11px] text-muted-foreground leading-normal max-w-xs font-semibold">
              A inteligência artificial do Google está analisando o áudio para segmentar, transcrever e traduzir cada frase automaticamente.
            </p>
          </div>
          <div className="w-full bg-muted/40 rounded-xl p-3.5 border border-border/30">
            <div className="flex items-center justify-center gap-2 text-xs font-black text-primary">
              <RefreshCw size={12} className="animate-spin" />
              <span>{transcribingProgress || "Iniciando processo..."}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
