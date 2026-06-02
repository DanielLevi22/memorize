import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Trash2, 
  Plus, 
  Upload, 
  Download,
  Mic,
  Music, 
  Headphones, 
  Clock, 
  ChevronRight, 
  Volume2, 
  Repeat, 
  RotateCcw,
  Image as ImageIcon,
  FolderHeart,
  FolderPlus,
  Info,
  Settings2,
  FileText,
  ArrowLeft,
  Languages,
  BookOpen,
  Sparkles,
  Keyboard
} from 'lucide-react';
import { db } from '../db/db';
import type { Playlist, AudioTrack, TranscriptionLine } from '../types';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { getWordLevenshteinDistance, diffWords, type DiffWord } from '../utils/srs';
import { decodeAudioFile, findSilenceSplitPoints, bufferToWav, adjustTimestampsSafeguard } from '../utils/audioChunker';
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

export const PlaylistPage: React.FC = () => {
  // DB States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  
  // Player States
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  // playCount tracks how many times the current track has played
  const [playCount, setPlayCount] = useState(1);
  // isLooping: global session override — current track repeats forever, ignoring per-track repeatTimes
  const [isLooping, setIsLooping] = useState(false);
  
  // Transcription / Karaoke States
  const [activeTranscriptionTrack, setActiveTranscriptionTrack] = useState<AudioTrack | null>(null);
  const [transcriptionTab, setTranscriptionTab] = useState<'view' | 'edit'>('view');
  const [transcriptionText, setTranscriptionText] = useState('');
  const [showTranslation, setShowTranslation] = useState(true);
  const [isLoopingLine, setIsLoopingLine] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(-1);
  const [syncingLineIdx, setSyncingLineIdx] = useState(0);
  const [tempLines, setTempLines] = useState<TranscriptionLine[]>([]);
  const [isTranscribingAi, setIsTranscribingAi] = useState(false);
  const [isDictationMode, setIsDictationMode] = useState(false);

  // New Modes States
  const [transcriptionViewMode, setTranscriptionViewMode] = useState<'normal' | 'playback' | 'pronunciation'>('normal');
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechSimilarity, setSpeechSimilarity] = useState<number | null>(null);
  const [speechWordDiffs, setSpeechWordDiffs] = useState<DiffWord[]>([]);
  const [lineScores, setLineScores] = useState<Record<number, number>>({});
  const [transcribingProgress, setTranscribingProgress] = useState('');
  const recognitionRef = useRef<any>(null);
  const shouldReconnectSpeechRef = useRef(false);
  const activeLineIdxRef = useRef(-1);
  const activeLinesRef = useRef<TranscriptionLine[]>([]);
  
  // Vocal reduction refs and state
  const vocalReductionSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const vocalReductionInverterRef = useRef<GainNode | null>(null);
  const vocalReductionSumRef = useRef<GainNode | null>(null);
  const [isVocalReductionActive, setIsVocalReductionActive] = useState(false);

  // AI Vocal Separation states
  const [isIaInstrumentalActive, setIsIaInstrumentalActive] = useState(false);

  // Cloud AI Vocal Separation states (HuggingFace Gradio Space — Demucs HTDemucs, grátis)
  const [isProcessingCloudSeparation, setIsProcessingCloudSeparation] = useState(false);
  const [cloudSeparationProgress, setCloudSeparationProgress] = useState(0);
  const [cloudSeparationMessage, setCloudSeparationMessage] = useState('');

  useEffect(() => {
    if (activeTranscriptionTrack) {
      setIsIaInstrumentalActive(!!activeTranscriptionTrack.instrumentalFile);
    } else {
      setIsIaInstrumentalActive(false);
    }
  }, [activeTranscriptionTrack]);
  
  useEffect(() => {
    activeLineIdxRef.current = activeLineIdx;
  }, [activeLineIdx]);

  useEffect(() => {
    activeLinesRef.current = activeTranscriptionTrack?.transcriptionLines || [];
  }, [activeTranscriptionTrack]);
  
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lastPausedLineIdxRef = useRef<number>(-1);
  
  // Revokable Object URLs for memory management
  const [activeAudioUrl, setActiveAudioUrl] = useState<string>('');
  const [playlistCoverUrls, setPlaylistCoverUrls] = useState<Record<string, string>>({});

  // Modals States
  const [isNewPlaylistOpen, setIsNewPlaylistOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [playlistCoverFile, setPlaylistCoverFile] = useState<File | null>(null);
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackDesc, setNewTrackDesc] = useState('');
  const [newTrackFile, setNewFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Edit track modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTrack, setEditTrack] = useState<AudioTrack | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRepeatTimes, setEditRepeatTimes] = useState<number>(1);

  // Generic confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  const openConfirm = (title: string, description: string, onConfirm: () => void, confirmLabel = 'Excluir') => {
    setConfirmModal({ open: true, title, description, confirmLabel, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, open: false }));
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  // Ref to always read latest isLooping inside audio event closures (avoids stale state)
  const isLoopingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Load playlists from DB
  const loadPlaylists = async () => {
    try {
      const allPlaylists = await db.playlists.orderBy('createdAt').toArray();
      setPlaylists(allPlaylists);
      
      // Generate Object URLs for covers to render
      const urls: Record<string, string> = {};
      allPlaylists.forEach(pl => {
        if (pl.coverImage) {
          urls[pl.id] = URL.createObjectURL(pl.coverImage);
        }
      });
      
      // Revoke old urls
      Object.values(playlistCoverUrls).forEach(url => URL.revokeObjectURL(url));
      setPlaylistCoverUrls(urls);

      // Auto-select first playlist if none selected
      if (allPlaylists.length > 0 && !selectedPlaylist) {
        setSelectedPlaylist(allPlaylists[0]);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar álbuns de áudio.');
    }
  };

  // Load tracks for selected playlist
  const loadTracks = async (playlistId: string) => {
    try {
      const playlistTracks = await db.audioTracks
        .where('playlistId')
        .equals(playlistId)
        .toArray();
      setTracks(playlistTracks.sort((a, b) => a.createdAt - b.createdAt));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar faixas deste álbum.');
    }
  };

  useEffect(() => {
    loadPlaylists();
    return () => {
      cleanupAudio();
      Object.values(playlistCoverUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Keep the ref in sync with the state so closures always read current value
  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    if (selectedPlaylist) {
      loadTracks(selectedPlaylist.id);
    } else {
      setTracks([]);
    }
  }, [selectedPlaylist]);

  // Start visualizer loop when playing and canvas is available
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

  const toggleVocalReduction = (active: boolean) => {
    setIsVocalReductionActive(active);
    
    if (!audioContextRef.current || !analyserRef.current) return;
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    
    try {
      analyser.disconnect();
      
      if (active) {
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
        toast.success('Filtro de atenuação vocal ativado!');
      } else {
        analyser.connect(audioContext.destination);
        vocalReductionSplitterRef.current = null;
        vocalReductionInverterRef.current = null;
        vocalReductionSumRef.current = null;
        toast.info('Filtro de atenuação vocal desativado.');
      }
    } catch (e) {
      console.warn('Erro ao alternar roteamento de áudio:', e);
      try {
        analyser.disconnect();
        analyser.connect(audioContext.destination);
      } catch (innerErr) {}
    }
  };

  const toggleIaInstrumental = (active: boolean, trackOverride?: typeof currentTrack) => {
    setIsIaInstrumentalActive(active);
    
    // Se estiver tocando a faixa atual, precisamos recarregar o áudio mantendo o tempo atual.
    // trackOverride is used to avoid stale React state when called right after a setState.
    const trackToUse = trackOverride || currentTrack;
    if (trackToUse && audioRef.current) {
      const currentTime = audioRef.current.currentTime;
      const wasPlaying = isPlaying;
      
      cleanupAudio();
      
      try {
        const fileToPlay = active && trackToUse.instrumentalFile ? trackToUse.instrumentalFile : trackToUse.audioFile;
        const url = URL.createObjectURL(fileToPlay);
        setActiveAudioUrl(url);
        
        const audio = new Audio(url);
        audio.playbackRate = playbackSpeed;
        audioRef.current = audio;
        setupVisualizer(audio);
        
        audio.onloadedmetadata = () => {
          setDuration(audio.duration);
          audio.currentTime = currentTime;
          if (wasPlaying) {
            audio.play().catch(e => console.warn(e));
            setIsPlaying(true);
          }
        };

        audio.onended = () => {
          if (isLoopingRef.current) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn(e));
            return;
          }
          const trackRepeat = trackToUse.repeatTimes ?? 1;
          setPlayCount(prev => {
            const next = prev + 1;
            if (trackRepeat === 0 || next <= trackRepeat) {
              audio.currentTime = 0;
              audio.play().catch(e => console.warn(e));
              return next;
            } else {
              handleNextTrack(trackToUse);
              return 1;
            }
          });
        };

        progressIntervalRef.current = window.setInterval(() => {
          if (audioRef.current) {
            setProgress(audioRef.current.currentTime);
          }
        }, 100);
      } catch (err) {
        console.error('Erro ao alternar para áudio de IA:', err);
      }
    }
  };


  /**
   * Removes vocals using a free HuggingFace Gradio Space (Demucs HTDemucs).
   * No API key required. Quality is significantly better than the local Spleeter model.
   */
  const handleStartCloudVocalSeparation = async () => {
    if (!activeTranscriptionTrack) return;

    setIsProcessingCloudSeparation(true);
    setCloudSeparationProgress(0);
    setCloudSeparationMessage('Conectando ao servidor...');

    try {
      const result = await separateVocalsCloud(
        activeTranscriptionTrack.audioFile,
        (progress, message) => {
          setCloudSeparationProgress(progress);
          setCloudSeparationMessage(message);
        }
      );

      setCloudSeparationMessage('Salvando no banco...');

      // Save to IndexedDB
      await db.audioTracks.update(activeTranscriptionTrack.id, {
        instrumentalFile: result.instrumentalBlob,
        updatedAt: Date.now()
      });

      // Update all relevant state
      const updatedTrack = {
        ...activeTranscriptionTrack,
        instrumentalFile: result.instrumentalBlob,
        updatedAt: Date.now()
      };
      setActiveTranscriptionTrack(updatedTrack);
      setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      if (currentTrack && currentTrack.id === activeTranscriptionTrack.id) {
        setCurrentTrack(updatedTrack);
      }

      setIsIaInstrumentalActive(true);
      toast.success(`Voz removida com Demucs (${result.source})! Qualidade profissional ✨`);

      // If audio is currently playing, reload with the new instrumental immediately
      if (currentTrack && currentTrack.id === activeTranscriptionTrack.id && audioRef.current) {
        toggleIaInstrumental(true, updatedTrack);
      }
    } catch (err: any) {
      console.error('Cloud vocal separation failed:', err);
      toast.error(err?.message || 'Falha na separação via nuvem.');
    } finally {
      setIsProcessingCloudSeparation(false);
      setCloudSeparationProgress(0);
      setCloudSeparationMessage('');
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
        const val = dataArray[dataIdx] || 0;
        const barLength = (val / 255) * 22;

        const xStart = centerX + Math.cos(angle) * radius;
        const yStart = centerY + Math.sin(angle) * radius;
        const xEnd = centerX + Math.cos(angle) * (radius + barLength);
        const yEnd = centerY + Math.sin(angle) * (radius + barLength);

        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.lineWidth = barWidth;
        ctx.lineCap = 'round';

        const alpha = 0.35 + (val / 255) * 0.65;
        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.stroke();
      }

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const avg = sum / bufferLength;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 + (avg / 255) * 0.4})`;
      ctx.stroke();
    };

    draw();
  };

  const stopSpeechRecognition = () => {
    shouldReconnectSpeechRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
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
            // Se já estiver rodando, ignora
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

  // Cleanup current playing audio
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

  // Handle Play Action
  const handlePlayTrack = (track: AudioTrack) => {
    cleanupAudio();

    try {
      const useInstrumental = isIaInstrumentalActive && track.instrumentalFile;
      const fileToPlay = useInstrumental && track.instrumentalFile ? track.instrumentalFile : track.audioFile;
      const url = URL.createObjectURL(fileToPlay);
      setActiveAudioUrl(url);
      setCurrentTrack(track);

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      setIsPlaying(true);
      setupVisualizer(audio);

      audio.play().catch((err) => {
        // AbortError = play() foi interrompido por outro play()/pause() — comportamento normal
        // durante reinício/loop. Não é um erro real, o áudio toca normalmente.
        if (err?.name === 'AbortError') return;
        console.error('Play error:', err);
        toast.error('Não foi possível reproduzir este áudio.');
        setIsPlaying(false);
      });

      // Event listeners
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      // Reset play count when starting a new track
      setPlayCount(1);

      audio.onended = () => {
        // Global loop override takes priority — reads live value via ref (no stale closure)
        if (isLoopingRef.current) {
          audio.currentTime = 0;
          audio.play().catch(e => console.warn(e));
          return;
        }
        // Per-track repeatTimes logic
        const trackRepeat = track.repeatTimes ?? 1;
        setPlayCount(prev => {
          const next = prev + 1;
          if (trackRepeat === 0 || next <= trackRepeat) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn(e));
            return next;
          } else {
            handleNextTrack(track);
            return 1;
          }
        });
      };

      progressIntervalRef.current = window.setInterval(() => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
        }
      }, 100);

      // Lockscreen and Control Panel Metadata Integration (Media Session API)
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        const coverSrc = selectedPlaylist && playlistCoverUrls[selectedPlaylist.id]
          ? playlistCoverUrls[selectedPlaylist.id]
          : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24" fill="none" stroke="%238b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';

        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.description || selectedPlaylist?.name || 'Álbum Personalizado',
          album: selectedPlaylist?.name || 'Playlist Ouvinte',
          artwork: [
            { 
              src: coverSrc,
              sizes: '512x512',
              type: coverSrc.startsWith('data:') ? 'image/svg+xml' : 'image/png'
            }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
          audio.play().catch(e => console.warn(e));
          setIsPlaying(true);
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          audio.pause();
          setIsPlaying(false);
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          handlePrevTrack(track);
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          handleNextTrack(track);
        });
      }

    } catch (err) {
      console.error(err);
      toast.error('Erro ao reproduzir a faixa.');
    }
  };

  // Toggle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) {
      if (tracks.length > 0) {
        handlePlayTrack(tracks[0]);
      }
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.warn(e));
      setIsPlaying(true);
    }
  };

  // Skip Next
  const handleNextTrack = (trackRef = currentTrack) => {
    if (!trackRef || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === trackRef.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    handlePlayTrack(tracks[nextIndex]);
  };

  // Skip Previous
  const handlePrevTrack = (trackRef = currentTrack) => {
    if (!trackRef || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === trackRef.id);
    const prevIndex = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1;
    handlePlayTrack(tracks[prevIndex]);
  };

  // Interactive Scrubbing (Seek Time)
  const handleScrub = (value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setProgress(value);
      lastPausedLineIdxRef.current = -1; // Reset dictation pause ref on manual seek
    }
  };

  // Speed Rate Change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Create Playlist (Album)
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    try {
      const newPlaylist: Playlist = {
        id: crypto.randomUUID(),
        name: playlistName.trim(),
        description: playlistDesc.trim() || undefined,
        coverImage: playlistCoverFile || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.playlists.add(newPlaylist);
      toast.success('Álbum criado com sucesso!');
      
      // Reset Modal Form
      setPlaylistName('');
      setPlaylistDesc('');
      setPlaylistCoverFile(null);
      setIsNewPlaylistOpen(false);

      loadPlaylists();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar álbum.');
    }
  };

  // Delete Playlist (Album)
  const handleDeletePlaylist = (playlist: Playlist, e: React.MouseEvent) => {
    e.stopPropagation();
    openConfirm(
      `Excluir álbum "${playlist.name}"?`,
      `Esta ação é permanente e irá apagar o álbum e todos os áudios salvos dentro dele. Não é possível desfazer.`,
      async () => {
        try {
          const playlistTracks = await db.audioTracks.where('playlistId').equals(playlist.id).toArray();
          const trackIds = playlistTracks.map(t => t.id);
          if (trackIds.length > 0) await db.audioTracks.bulkDelete(trackIds);
          await db.playlists.delete(playlist.id);
          if (currentTrack && trackIds.includes(currentTrack.id)) {
            cleanupAudio();
            setCurrentTrack(null);
            setIsPlaying(false);
            setProgress(0);
            setDuration(0);
          }
          toast.success('Álbum e suas faixas excluídos.');
          if (selectedPlaylist?.id === playlist.id) setSelectedPlaylist(null);
          loadPlaylists();
        } catch (err) {
          console.error(err);
          toast.error('Erro ao excluir álbum.');
        }
      }
    );
  };

  // Delete Individual Track
  const handleDeleteTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const track = tracks.find(t => t.id === id);
    openConfirm(
      `Excluir faixa${track ? ` "${track.title}"` : ''}?`,
      'O arquivo de áudio será removido permanentemente do álbum. Esta ação não pode ser desfeita.',
      async () => {
        try {
          if (currentTrack?.id === id) {
            cleanupAudio();
            setCurrentTrack(null);
            setIsPlaying(false);
            setProgress(0);
            setDuration(0);
          }
          await db.audioTracks.delete(id);
          toast.success('Faixa excluída.');
          if (selectedPlaylist) loadTracks(selectedPlaylist.id);
        } catch (err) {
          console.error(err);
          toast.error('Erro ao excluir faixa de áudio.');
        }
      }
    );
  };

  // Upload Track Submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaylist) return;
    if (!newTrackTitle.trim() || !newTrackFile) {
      toast.error('Preencha o título e escolha um arquivo de áudio.');
      return;
    }

    setIsUploading(true);
    try {
      const newTrack: AudioTrack = {
        id: crypto.randomUUID(),
        playlistId: selectedPlaylist.id,
        title: newTrackTitle.trim(),
        description: newTrackDesc.trim() || undefined,
        audioFile: newTrackFile,
        repeatTimes: 1, // default: play once
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.audioTracks.add(newTrack);
      toast.success('Áudio adicionado! Configure as repetições pelo ícone de engrenagem.');
      
      setNewTrackTitle('');
      setNewTrackDesc('');
      setNewFile(null);
      setIsUploadOpen(false);
      
      loadTracks(selectedPlaylist.id);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar o áudio no banco.');
    } finally {
      setIsUploading(false);
    }
  };

  // Open track settings modal
  const handleOpenTrackSettings = (track: AudioTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTrack(track);
    setEditTitle(track.title);
    setEditDesc(track.description || '');
    setEditRepeatTimes(track.repeatTimes ?? 1);
    setIsEditOpen(true);
  };

  // Save track settings
  const handleSaveTrackSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTrack || !editTitle.trim()) return;
    try {
      await db.audioTracks.update(editTrack.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        repeatTimes: editRepeatTimes,
        updatedAt: Date.now()
      });
      // If this is the currently playing track, update currentTrack state too
      if (currentTrack?.id === editTrack.id) {
        setCurrentTrack(prev => prev ? { ...prev, title: editTitle.trim(), description: editDesc.trim() || undefined, repeatTimes: editRepeatTimes } : prev);
      }
      toast.success('Configurações da faixa salvas!');
      setIsEditOpen(false);
      setEditTrack(null);
      if (selectedPlaylist) loadTracks(selectedPlaylist.id);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configurações.');
    }
  };


  // Helper: Generates beautiful consistent gradient from title string
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

  // ═══════════════════════════════════════════
  // TRANSCRIPTION / KARAOKE LOGIC
  // ═══════════════════════════════════════════

  const handleOpenTranscription = (track: AudioTrack) => {
    setActiveTranscriptionTrack(track);
    setTranscriptionTab('view');
    setTranscriptionText(track.transcriptionLines?.map(l => l.text).join('\n') || '');
    setTempLines(track.transcriptionLines || []);
    setSyncingLineIdx(0);
    setIsLoopingLine(false);
    
    // Play the track if not already playing
    if (currentTrack?.id !== track.id) {
      handlePlayTrack(track);
    }
  };

  const handleCloseTranscription = () => {
    stopSpeechRecognition();
    setActiveTranscriptionTrack(null);
    setIsLoopingLine(false);
  };

  const parseLRC = (lrcText: string): TranscriptionLine[] => {
    const lines = lrcText.split('\n');
    const result: TranscriptionLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

    lines.forEach(line => {
      const match = timeRegex.exec(line);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3], 10) / (match[3].length === 2 ? 100 : 1000) : 0;
        const totalSeconds = min * 60 + sec + ms;
        const text = line.replace(timeRegex, '').trim();
        
        if (text) {
          result.push({
            id: crypto.randomUUID(),
            text,
            startTime: parseFloat(totalSeconds.toFixed(2)),
            translation: ''
          });
        }
      }
    });
    
    return result.sort((a, b) => a.startTime - b.startTime);
  };

  const handleImportLRC = () => {
    if (!transcriptionText.trim()) {
      toast.error('Cole a letra em formato LRC no campo de texto primeiro.');
      return;
    }
    const parsed = parseLRC(transcriptionText);
    if (parsed.length === 0) {
      toast.error('Nenhuma linha sincronizada encontrada no formato LRC. Verifique se possui tags como [00:12.34].');
      return;
    }
    setTempLines(parsed);
    toast.success(`Importado com sucesso! ${parsed.length} linhas carregadas.`);
  };

  const handleStartSync = () => {
    if (!transcriptionText.trim()) {
      toast.error('Insira o texto da transcrição primeiro.');
      return;
    }
    
    const lines = transcriptionText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
      
    if (lines.length === 0) {
      toast.error('Nenhuma frase válida encontrada.');
      return;
    }
    
    const prepared = lines.map(line => ({
      id: crypto.randomUUID(),
      text: line,
      startTime: 0,
      translation: ''
    }));
    
    setTempLines(prepared);
    setSyncingLineIdx(0);
    
    // Start playback if paused to assist sync
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(e => console.warn(e));
      setIsPlaying(true);
    }
    
    toast.info('Sincronização iniciada. Pressione ESPAÇO, ENTER ou clique em "Marcar Tempo" para definir o tempo de cada frase.');
  };

  const stampCurrentTime = () => {
    if (!audioRef.current) return;
    const currentTime = audioRef.current.currentTime;
    
    setTempLines(prev => {
      const updated = [...prev];
      if (syncingLineIdx < updated.length) {
        updated[syncingLineIdx] = {
          ...updated[syncingLineIdx],
          startTime: parseFloat(currentTime.toFixed(2))
        };
      }
      return updated;
    });
    
    if (syncingLineIdx < tempLines.length - 1) {
      setSyncingLineIdx(prev => prev + 1);
    } else {
      toast.success('Todas as linhas foram sincronizadas! Revise e clique em Salvar.');
    }
  };

  const undoLastStamp = () => {
    if (syncingLineIdx < tempLines.length && tempLines[syncingLineIdx].startTime > 0) {
      setTempLines(prev => {
        const updated = [...prev];
        updated[syncingLineIdx] = {
          ...updated[syncingLineIdx],
          startTime: 0
        };
        return updated;
      });
      return;
    }

    if (syncingLineIdx <= 0) return;
    
    const prevIdx = syncingLineIdx - 1;
    setSyncingLineIdx(prevIdx);
    setTempLines(prev => {
      const updated = [...prev];
      updated[prevIdx] = {
        ...updated[prevIdx],
        startTime: 0
      };
      return updated;
    });
  };

  const adjustLineTime = (index: number, amount: number) => {
    setTempLines(prev => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        const newTime = Math.max(0, updated[index].startTime + amount);
        updated[index] = {
          ...updated[index],
          startTime: parseFloat(newTime.toFixed(2))
        };
      }
      return updated;
    });
  };

  const handleUpdateLineText = (index: number, text: string) => {
    setTempLines(prev => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        updated[index] = { ...updated[index], text };
      }
      return updated;
    });
  };

  const handleUpdateLineTranslation = (index: number, translation: string) => {
    setTempLines(prev => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        updated[index] = { ...updated[index], translation };
      }
      return updated;
    });
  };

  const handleSaveTranscription = async () => {
    if (!activeTranscriptionTrack) return;
    
    const sortedLines = [...tempLines]
      .sort((a, b) => a.startTime - b.startTime);
      
    try {
      await db.audioTracks.update(activeTranscriptionTrack.id, {
        transcriptionLines: sortedLines,
        updatedAt: Date.now()
      });
      
      const updatedTrack = {
        ...activeTranscriptionTrack,
        transcriptionLines: sortedLines,
        updatedAt: Date.now()
      };
      
      setActiveTranscriptionTrack(updatedTrack);
      setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      
      if (currentTrack?.id === updatedTrack.id) {
        setCurrentTrack(updatedTrack);
      }
      
      toast.success('Transcrição salva com sucesso!');
      setTranscriptionTab('view');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar transcrição.');
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.substring(base64String.indexOf(',') + 1);
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleTranscribeWithAi = async () => {
    if (!activeTranscriptionTrack) return;
    
    const geminiApiKey = localStorage.getItem('memorize_gemini_api_key') || '';
    if (!geminiApiKey.trim()) {
      toast.error('Configure sua API Key nas Configurações para usar a transcrição por IA.');
      return;
    }

    const audioFile = activeTranscriptionTrack.audioFile;
    
    setIsTranscribingAi(true);
    setTranscribingProgress('Iniciando...');
    
    const parseTimeStringToSeconds = (timeStr: string): number => {
      if (typeof timeStr === 'number') return timeStr;
      if (typeof timeStr !== 'string') return 0;
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        const min = parseInt(parts[0], 10) || 0;
        const secParts = parts[1].split('.');
        const sec = parseInt(secParts[0], 10) || 0;
        const ms = secParts[1] ? parseInt(secParts[1], 10) / Math.pow(10, secParts[1].length) : 0;
        return min * 60 + sec + ms;
      } else if (parts.length === 3) {
        const hr = parseInt(parts[0], 10) || 0;
        const min = parseInt(parts[1], 10) || 0;
        const secParts = parts[2].split('.');
        const sec = parseInt(secParts[0], 10) || 0;
        const ms = secParts[1] ? parseInt(secParts[1], 10) / Math.pow(10, secParts[1].length) : 0;
        return hr * 3600 + min * 60 + sec + ms;
      }
      return parseFloat(timeStr) || 0;
    };

    const saveFinalLines = async (finalLines: TranscriptionLine[]) => {
      await db.audioTracks.update(activeTranscriptionTrack.id, {
        transcriptionLines: finalLines,
        updatedAt: Date.now()
      });
      
      const updatedTrack = {
        ...activeTranscriptionTrack,
        transcriptionLines: finalLines,
        updatedAt: Date.now()
      };
      
      setActiveTranscriptionTrack(updatedTrack);
      setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      if (currentTrack?.id === updatedTrack.id) {
        setCurrentTrack(updatedTrack);
      }
      
      setTempLines(finalLines);
      setTranscriptionText(finalLines.map(l => l.text).join('\n'));
      setTranscriptionTab('view');
    };

    try {
      let allLines: TranscriptionLine[] = [];
      let chunkingSuccess = false;

      // 1. Tenta decodificar o áudio localmente para fazer o chunking
      try {
        setTranscribingProgress('Decodificando áudio localmente...');
        const audioBuffer = await decodeAudioFile(audioFile);
        
        setTranscribingProgress('Analisando pontos de silêncio para divisão...');
        const splitPoints = findSilenceSplitPoints(audioBuffer, 30);
        const totalChunks = splitPoints.length - 1;
        
        for (let i = 0; i < totalChunks; i++) {
          const start = splitPoints[i];
          const end = splitPoints[i + 1];
          const chunkNum = i + 1;
          
          setTranscribingProgress(`Transcrevendo trecho ${chunkNum} de ${totalChunks} (${formatTime(start)} - ${formatTime(end)})...`);
          
          const wavSlice = bufferToWav(audioBuffer, start, end);
          const base64Audio = await blobToBase64(wavSlice);
          
          const promptText = `
Você é um assistente especialista em transcrição e tradução de áudio para aprendizado de idiomas.
O áudio fornecido é um trecho de uma gravação que começa em ${formatTime(start)} e termina em ${formatTime(end)}.
Transcreva este trecho de áudio linha por linha de forma estritamente cronológica, do início ao fim do trecho.

Para cada linha:
1. Forneça o texto exato falado no idioma original ("text").
2. Traduza a linha para o português do Brasil ("translation").
3. Identifique o tempo de início aproximado relativo ao início deste trecho no formato de string "mm:ss" ou "mm:ss.xx" (ex: "00:03", "00:15.50").
`;

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/wav',
                        data: base64Audio
                      }
                    },
                    {
                      text: promptText
                    }
                  ]
                }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: 'OBJECT',
                    properties: {
                      lines: {
                        type: 'ARRAY',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            text: { type: 'STRING' },
                            translation: { type: 'STRING' },
                            startTime: { type: 'STRING' }
                          },
                          required: ['text', 'startTime']
                        }
                      }
                    },
                    required: ['lines']
                  }
                }
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Erro na chamada da API para o trecho ${chunkNum}.`);
          }

          const result = await response.json();
          const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) {
            throw new Error(`Resposta inválida para o trecho ${chunkNum}.`);
          }

          const parsed = JSON.parse(rawText);
          if (parsed.lines && Array.isArray(parsed.lines)) {
            const chunkLines = parsed.lines.map((l: any) => {
              const relSeconds = parseTimeStringToSeconds(l.startTime);
              const absSeconds = start + relSeconds;
              return {
                id: crypto.randomUUID(),
                text: l.text,
                translation: l.translation || '',
                startTime: parseFloat(absSeconds.toFixed(2))
              };
            });
            allLines.push(...chunkLines);
          }
        }
        
        chunkingSuccess = true;
      } catch (chunkErr: any) {
        console.warn('Erro durante o processamento em chunks. Caindo de volta para processamento completo:', chunkErr);
      }

      // 2. Fallback para transcrição direta do áudio completo se o chunking falhar ou não for suportado
      if (!chunkingSuccess) {
        setTranscribingProgress('Processando áudio completo (fallback)...');
        
        const sizeInMB = audioFile.size / (1024 * 1024);
        if (sizeInMB > 12) {
          throw new Error(`O arquivo de áudio é muito grande (${sizeInMB.toFixed(1)}MB) para o processamento em arquivo único. O limite é 12MB.`);
        }
        
        const base64Audio = await blobToBase64(audioFile);
        
        const promptText = `
Você é um assistente especialista em transcrição e tradução de áudio para aprendizado de idiomas.
Transcreva o áudio fornecido linha por linha de forma estritamente cronológica, do início ao fim do áudio.
Se houver partes repetidas (como o refrão), você deve transcrevê-las todas as vezes em que ocorrerem no áudio, respeitando o tempo correto em que são cantadas/faladas. Nunca pule repetições ou agrupe linhas fora de ordem.

Para cada linha:
1. Forneça o texto exato falado no idioma original ("text").
2. Traduza a linha para o português do Brasil ("translation").
3. Identifique o tempo de início aproximado no formato de string "mm:ss" ou "mm:ss.xx" (ex: "00:08", "01:03.50") em que a frase começa a ser dita no áudio. Os tempos devem ser estritamente crescentes.
`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    inlineData: {
                      mimeType: audioFile.type || 'audio/mp3',
                      data: base64Audio
                    }
                  },
                  {
                    text: promptText
                  }
                ]
              }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    lines: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          text: { type: 'STRING' },
                          translation: { type: 'STRING' },
                          startTime: { type: 'STRING' }
                        },
                        required: ['text', 'startTime']
                      }
                    }
                  },
                  required: ['lines']
                }
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error('Falha ao obter resposta do Gemini para a transcrição completa.');
        }

        const result = await response.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('A IA não retornou uma estrutura de transcrição válida.');
        }

        const parsed = JSON.parse(rawText);
        if (!parsed.lines || !Array.isArray(parsed.lines)) {
          throw new Error('Formato inválido retornado pela IA.');
        }

        allLines = parsed.lines.map((l: any) => {
          const seconds = parseTimeStringToSeconds(l.startTime);
          return {
            id: crypto.randomUUID(),
            text: l.text,
            translation: l.translation || '',
            startTime: parseFloat(seconds.toFixed(2))
          };
        });
      }

      // 3. Ordenação final e salvamento com distanciamento mínimo (safeguard)
      const adjustedLines = adjustTimestampsSafeguard(allLines, 0.5);
      
      await saveFinalLines(adjustedLines);
      toast.success(`Transcrição concluída e salva com sucesso! ${adjustedLines.length} frases geradas.`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro na transcrição por IA: ${err.message || err}`);
    } finally {
      setIsTranscribingAi(false);
      setTranscribingProgress('');
    }
  };

  // Find active line index based on progress
  useEffect(() => {
    if (activeTranscriptionTrack && activeTranscriptionTrack.transcriptionLines && activeTranscriptionTrack.transcriptionLines.length > 0) {
      const lines = activeTranscriptionTrack.transcriptionLines;
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
  }, [progress, activeTranscriptionTrack]);

  // Auto-scroll active line in view
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIdx]);

  // Reset speech states when active line changes (keep microphone running)
  useEffect(() => {
    setSpeechTranscript('');
    setSpeechSimilarity(null);
    setSpeechWordDiffs([]);
  }, [activeLineIdx]);

  // Loop active line logic if isLoopingLine is true
  useEffect(() => {
    if (isLoopingLine && activeLineIdx >= 0 && activeTranscriptionTrack?.transcriptionLines && audioRef.current) {
      const lines = activeTranscriptionTrack.transcriptionLines;
      const currentLine = lines[activeLineIdx];
      const nextLine = lines[activeLineIdx + 1];
      const endOfLine = nextLine ? nextLine.startTime : duration;
      
      if (progress >= endOfLine) {
        audioRef.current.currentTime = currentLine.startTime;
        setProgress(currentLine.startTime);
      }
    }
  }, [progress, isLoopingLine, activeLineIdx, activeTranscriptionTrack, duration]);

  // Dictation mode auto-pause logic
  useEffect(() => {
    if (isDictationMode && activeLineIdx >= 0 && activeTranscriptionTrack?.transcriptionLines && audioRef.current && isPlaying) {
      const lines = activeTranscriptionTrack.transcriptionLines;
      const nextLine = lines[activeLineIdx + 1];
      const endOfLine = nextLine ? nextLine.startTime : duration;
      
      if (progress >= endOfLine && lastPausedLineIdxRef.current !== activeLineIdx) {
        audioRef.current.pause();
        setIsPlaying(false);
        lastPausedLineIdxRef.current = activeLineIdx;
      }
    }
  }, [progress, isDictationMode, activeLineIdx, activeTranscriptionTrack, duration, isPlaying]);

  useEffect(() => {
    lastPausedLineIdxRef.current = -1;
  }, [activeTranscriptionTrack]);

  // Export current transcription as standard LRC file
  const handleExportLRC = () => {
    if (!activeTranscriptionTrack || !activeTranscriptionTrack.transcriptionLines || activeTranscriptionTrack.transcriptionLines.length === 0) {
      toast.error('Não há transcrição para exportar.');
      return;
    }
    
    const lines = activeTranscriptionTrack.transcriptionLines;
    const lrcLines = lines.map(line => {
      const minutes = Math.floor(line.startTime / 60);
      const seconds = Math.floor(line.startTime % 60);
      const centiseconds = Math.floor((line.startTime % 1) * 100);
      
      const timeTag = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}]`;
      const text = line.translation ? `${line.text} | ${line.translation}` : line.text;
      return `${timeTag}${text}`;
    });
    
    const lrcContent = lrcLines.join('\n');
    const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = activeTranscriptionTrack.title.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    link.download = `${safeTitle || 'transcricao'}.lrc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Arquivo LRC exportado com sucesso!');
  };

  // Toggle Transcription line difficulty marker and save to DB
  const handleToggleLineDifficulty = async (lineId: string, currentDifficulty?: 'none' | 'easy' | 'hard') => {
    if (!activeTranscriptionTrack || !activeTranscriptionTrack.transcriptionLines) return;
    
    let nextDiff: 'none' | 'easy' | 'hard' = 'none';
    if (!currentDifficulty || currentDifficulty === 'none') {
      nextDiff = 'easy';
    } else if (currentDifficulty === 'easy') {
      nextDiff = 'hard';
    } else {
      nextDiff = 'none';
    }
    
    const updatedLines = activeTranscriptionTrack.transcriptionLines.map(line => {
      if (line.id === lineId) {
        return { ...line, difficulty: nextDiff };
      }
      return line;
    });
    
    try {
      await db.audioTracks.update(activeTranscriptionTrack.id, {
        transcriptionLines: updatedLines,
        updatedAt: Date.now()
      });
      
      const updatedTrack = {
        ...activeTranscriptionTrack,
        transcriptionLines: updatedLines,
        updatedAt: Date.now()
      };
      
      setActiveTranscriptionTrack(updatedTrack);
      setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      
      if (currentTrack?.id === updatedTrack.id) {
        setCurrentTrack(updatedTrack);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar dificuldade da frase.');
    }
  };

  // Keyboard shortcut listener for live sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTranscriptionTrack && transcriptionTab === 'edit' && syncingLineIdx >= 0) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          stampCurrentTime();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          undoLastStamp();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTranscriptionTrack, transcriptionTab, syncingLineIdx, tempLines, undoLastStamp]);

  const renderHighlightedText = (text: string, startTime: number, endTime: number) => {
    const words = text.split(/\s+/);
    const lineDuration = endTime - startTime;
    
    if (lineDuration <= 0 || progress < startTime || progress > endTime) {
      return <span>{text}</span>;
    }
    
    const lineProgress = progress - startTime;
    const percentage = Math.min(1, Math.max(0, lineProgress / lineDuration));
    const activeWordIndex = Math.floor(percentage * words.length);
    
    return (
      <span className="inline-flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
        {words.map((word, wIdx) => {
          const isWordActive = wIdx <= activeWordIndex;
          return (
            <span
              key={wIdx}
              className={`transition-all duration-200 ${
                isWordActive 
                  ? 'text-primary font-black scale-105 drop-shadow-[0_0_8px_hsl(var(--primary)/0.35)]' 
                  : 'text-foreground/80'
              }`}
            >
              {word}
            </span>
          );
        })}
      </span>
    );
  };

  const renderTranscriptionPanel = () => {
    if (!activeTranscriptionTrack) return null;

    const hasTranscription = activeTranscriptionTrack.transcriptionLines && activeTranscriptionTrack.transcriptionLines.length > 0;

    return (
      <ShadcnCard className="bg-card/40 backdrop-blur-md border-border/50 p-5 rounded-2xl shadow-xl flex flex-col flex-1 h-full min-h-[495px] relative overflow-hidden">
        {/* Glow decorativo de fundo */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px] pointer-events-none" />

        {/* Cabeçalho do Painel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40 shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseTranscription}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40 bg-card/65 shadow-sm"
              title="Voltar para a playlist"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs font-black text-foreground truncate max-w-[200px] sm:max-w-xs">
                {activeTranscriptionTrack.title}
              </h3>
              <p className="text-[9px] text-muted-foreground font-semibold truncate">
                Transcrição & Sincronia
              </p>
            </div>
          </div>

          {/* Abas de Visualizar / Editar */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/60 border border-border/40 rounded-xl p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setTranscriptionTab('view')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  transcriptionTab === 'view'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                Visualizar
              </button>
              <button
                type="button"
                onClick={() => {
                  setTranscriptionTab('edit');
                  setTranscriptionText(activeTranscriptionTrack.transcriptionLines?.map(l => l.text).join('\n') || '');
                  setTempLines(activeTranscriptionTrack.transcriptionLines || []);
                  setSyncingLineIdx(0);
                }}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  transcriptionTab === 'edit'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                Sincronizar / Editar
              </button>
            </div>

            {/* Loop de Frase (apenas no modo visualização) */}
            {transcriptionTab === 'view' && hasTranscription && (
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
            )}

            {/* Modo Ditado (apenas no modo visualização) */}
            {transcriptionTab === 'view' && hasTranscription && (
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
            )}

            {/* Alternar tradução (apenas no modo visualização) */}
            {transcriptionTab === 'view' && hasTranscription && (
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
            )}

            {/* Exportar LRC (apenas no modo visualização) */}
            {transcriptionTab === 'view' && hasTranscription && (
              <button
                onClick={handleExportLRC}
                className="p-1.5 rounded-xl border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shadow-sm text-xs font-bold flex items-center gap-1.5"
                title="Exportar transcrição sincronizada como arquivo .lrc"
              >
                <Download size={14} />
                <span className="hidden md:inline text-[10px]">Exportar LRC</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Seleção de Modos de Visualização */}
        {transcriptionTab === 'view' && hasTranscription && (
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

            {/* Controles de Modo e Vocal */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">

              {/* Dica de Modo */}
              {transcriptionViewMode === 'pronunciation' ? (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl text-[10px] font-black shadow-sm">
                  <Headphones size={12} className="shrink-0 animate-bounce" />
                  <span>Use fones — o microfone pode captar o áudio!</span>
                </div>
              ) : transcriptionViewMode === 'playback' ? (
                <div className="hidden md:flex items-center gap-1.5 text-muted-foreground px-2 py-1 text-[10px] font-bold">
                  <Info size={11} className="text-primary" />
                  <span>Cante junto acompanhando as letras!</span>
                </div>
              ) : null}

              {/* Painel de Controle Vocal — visível nos modos playback e pronúncia */}
              {(transcriptionViewMode === 'playback' || transcriptionViewMode === 'pronunciation') && (
                <div className="flex items-center gap-1.5 bg-muted/40 border border-border/30 rounded-xl p-1">
                  {/* Label */}
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 px-1.5 select-none hidden sm:block">
                    Voz
                  </span>
                  <div className="w-px h-4 bg-border/40 hidden sm:block" />

                  {/* Botão: Atenuar (DSP filtro fase) */}
                  <button
                    type="button"
                    onClick={() => toggleVocalReduction(!isVocalReductionActive)}
                    title="Reduz a voz usando cancelamento de fase estéreo (DSP clássico). Funciona melhor com fones."
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

                  {/* Estado: IA ativa (toggle) / processando / botão cloud */}
                  {activeTranscriptionTrack?.instrumentalFile ? (
                    /* Toggle IA Ativo/Desativado */
                    <button
                      type="button"
                      onClick={() => toggleIaInstrumental(!isIaInstrumentalActive)}
                      title="Alterna entre o áudio original e o instrumental sem voz processado por Demucs IA."
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
                    /* Processando: barra de progresso inline */
                    <div className="flex items-center gap-2 px-2.5 py-1.5 min-w-[160px]">
                      <div className="w-2.5 h-2.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-sky-500 truncate">{cloudSeparationMessage}</p>
                        <div className="w-full bg-sky-500/20 rounded-full h-0.5 mt-0.5">
                          <div
                            className="bg-sky-500 h-0.5 rounded-full transition-all duration-500"
                            style={{ width: `${cloudSeparationProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Botão Cloud — Demucs HTDemucs via HuggingFace */
                    <button
                      type="button"
                      onClick={handleStartCloudVocalSeparation}
                      title="Remove a voz com Demucs HTDemucs via HuggingFace (grátis, sem API key). Qualidade profissional. Requer internet."
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-sky-500 dark:text-sky-400 hover:bg-sky-500/10 transition-all cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                      <span>Remover voz</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}


        {/* Corpo principal */}
        {transcriptionTab === 'view' ? (
          /* MODO DE VISUALIZAÇÃO (KARAOKÊ) */
          !hasTranscription ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="p-3 bg-muted/40 rounded-2xl border border-border/30 shadow-inner">
                <FileText size={28} className="text-muted-foreground/60" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">Sem transcrição cadastrada</p>
                <p className="text-[10px] text-muted-foreground max-w-xs leading-normal">
                  Esta faixa ainda não possui transcrição ou letra. Clique no botão de edição para adicionar ou sincronizar.
                </p>
              </div>
              <Button
                onClick={() => {
                  setTranscriptionTab('edit');
                  setTranscriptionText('');
                  setTempLines([]);
                }}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-8 text-[10px] px-4 rounded-lg cursor-pointer"
              >
                Criar Transcrição
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 relative mt-3 pb-2">
              {/* Fade superior decorativo */}
              <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-card/30 to-transparent pointer-events-none z-10" />

              {/* Contêiner de Letras Roláveis */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-6 space-y-5 pt-8 pb-36 select-none scrollbar-thin relative"
              >
                {activeTranscriptionTrack.transcriptionLines?.map((line, idx) => {
                  const isActive = activeLineIdx === idx;
                  
                  let cardStyles = 'border-transparent text-muted-foreground/60 hover:text-foreground hover:scale-[1.01] font-semibold';
                  if (isActive) {
                    if (transcriptionViewMode === 'playback') {
                      cardStyles = 'bg-primary/[0.03] text-primary text-2xl sm:text-3xl font-black py-6 scale-105 drop-shadow-[0_0_12px_rgba(139,92,246,0.35)] border-primary/25 border';
                    } else {
                      cardStyles = 'bg-primary/5 text-primary scale-105 font-extrabold shadow-sm border-primary/20 shadow-primary/5';
                    }
                  } else {
                    if (transcriptionViewMode === 'playback') {
                      cardStyles = 'opacity-20 scale-95 blur-[0.7px] border-transparent text-muted-foreground/40';
                    } else if (line.difficulty === 'hard') {
                      cardStyles = 'bg-rose-500/[0.03] border-rose-500/15 text-muted-foreground/75 hover:text-foreground font-semibold hover:border-rose-500/25';
                    } else if (line.difficulty === 'easy') {
                      cardStyles = 'bg-emerald-500/[0.02] border-emerald-500/15 text-muted-foreground/75 hover:text-foreground font-semibold hover:border-emerald-500/25';
                    }
                  }
                  
                  const isCinematic = transcriptionViewMode === 'playback';
                  const showTranslationsInMode = showTranslation && !isCinematic && line.translation;
                  
                  return (
                    <div
                      key={line.id || idx}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => handleScrub(line.startTime)}
                      className={`group relative text-center py-3 px-12 rounded-2xl transition-all duration-300 cursor-pointer border ${cardStyles}`}
                    >
                      {/* Dificuldades (apenas no modo padrão) */}
                      {!isCinematic && transcriptionViewMode === 'normal' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLineDifficulty(line.id, line.difficulty);
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer z-20"
                            title="Marcar dificuldade da frase (Sem marcacao -> Fácil -> Difícil)"
                          >
                            <div className={`w-3 h-3 rounded-full border transition-all ${
                              line.difficulty === 'hard'
                                ? 'bg-rose-500 border-rose-600 shadow-sm shadow-rose-500/35'
                                : line.difficulty === 'easy'
                                ? 'bg-emerald-500 border-emerald-600 shadow-sm shadow-emerald-500/35'
                                : 'bg-transparent border-muted-foreground/45 hover:border-muted-foreground/70'
                            }`} />
                          </button>
                          
                          {line.difficulty && line.difficulty !== 'none' && (
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:hidden">
                              <div className={`w-2.5 h-2.5 rounded-full ${
                                line.difficulty === 'hard'
                                  ? 'bg-rose-500/80 shadow-sm shadow-rose-500/20'
                                  : 'bg-emerald-500/80 shadow-sm shadow-emerald-500/20'
                              }`} />
                            </div>
                          )}
                        </>
                      )}
                      
                      {/* Best Score Badge (apenas no modo desafio de pronúncia) */}
                      {transcriptionViewMode === 'pronunciation' && lineScores[idx] !== undefined && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[9px] font-black">
                          <span>⭐ {lineScores[idx]}%</span>
                        </div>
                      )}
                      
                      <p className={`transition-all ${isActive && !isCinematic ? 'text-sm sm:text-base' : ''}`}>
                        {isActive ? (
                          (() => {
                            const nextLine = activeTranscriptionTrack.transcriptionLines?.[idx + 1];
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
              
              {/* Fade inferior decorativo */}
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card/30 to-transparent pointer-events-none z-10" />

              {/* Pronunciation Real-time Feedback Panel */}
              {transcriptionViewMode === 'pronunciation' && (
                <div className="mx-6 mb-3 p-4 bg-card border border-border/80 rounded-2xl shadow-xl space-y-3 animate-fadeIn relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-primary/[0.02] pointer-events-none" />
                  
                  <div className="flex items-center justify-between gap-3 relative z-10 border-b border-border/30 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                        <Mic size={14} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-foreground tracking-wider">
                        Desafio de Pronúncia Ativo
                      </span>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={startSpeechRecognition}
                      className={`text-[10px] font-black h-8 px-4 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition-all duration-300 ${
                        isListeningSpeech
                          ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                          : 'bg-primary hover:bg-primary/95 text-primary-foreground'
                      }`}
                    >
                      <Mic size={12} className={isListeningSpeech ? 'animate-bounce' : ''} />
                      <span>{isListeningSpeech ? 'Ouvindo... Parar' : 'Ativar Microfone Contínuo'}</span>
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2.5 relative z-10">
                    {activeLineIdx >= 0 && activeTranscriptionTrack?.transcriptionLines?.[activeLineIdx] ? (
                      <div className="space-y-2">
                        <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">
                          Análise da Frase Ativa
                        </p>
                        
                        <div className="p-3 bg-muted/40 rounded-xl border border-border/40 min-h-[50px] flex items-center justify-center flex-wrap gap-x-2 gap-y-1.5 text-center">
                          {speechWordDiffs.length > 0 ? (
                            speechWordDiffs.map((word, wIdx) => {
                              let colorClass = 'text-muted-foreground/50';
                              let bgClass = 'bg-muted/10 border-border/20';
                              
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
                      <p className="text-[10px] font-bold text-muted-foreground/60 text-center py-2 italic">
                        Dê play na música para iniciar a verificação da pronúncia.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* MODO DE EDIÇÃO & SINCRONIZAÇÃO */
          <div className="flex-1 flex flex-col min-h-0 space-y-4 mt-3">
            {/* Split layout: Text input or sync editor */}
            {tempLines.length === 0 ? (
              /* MODO: COLAR TEXTO RAW OU LRC */
              <div className="flex-1 flex flex-col space-y-3 min-h-0 relative">
                {isTranscribingAi && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center space-y-3 rounded-2xl animate-fadeIn">
                    <Sparkles size={32} className="text-primary animate-bounce" />
                    <p className="text-xs font-black text-foreground">IA Transcrevendo seu Áudio...</p>
                    <p className="text-[10px] text-muted-foreground text-center px-6 leading-relaxed max-w-xs font-semibold">
                      {transcribingProgress || 'Enviando áudio para o Gemini 2.5 Flash. Isso pode levar de 10 a 20 segundos para processar.'}
                    </p>
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                    Passo 1: Cole a transcrição (uma frase por linha) ou use Transcrição por IA
                  </label>
                  <p className="text-[9px] text-muted-foreground">
                    Você pode colar uma transcrição manual, importar letras sincronizadas (.lrc) ou deixar que a inteligência artificial transcreva e traduza automaticamente!
                  </p>
                </div>
                <textarea
                  className="flex-1 w-full bg-muted/30 border border-border/80 text-foreground px-4 py-3 rounded-2xl text-xs outline-none focus:border-primary/50 font-semibold resize-none min-h-[180px] focus:ring-2 focus:ring-primary/10"
                  placeholder="Exemplo LRC:&#10;[00:02.50] Hello and welcome to the English lesson.&#10;[00:08.10] Today we are going to learn phrasal verbs.&#10;&#10;Ou cole apenas o text puro:&#10;Primeira frase do áudio&#10;Segunda frase do áudio"
                  value={transcriptionText}
                  onChange={(e) => setTranscriptionText(e.target.value)}
                  disabled={isTranscribingAi}
                />
                
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleImportLRC}
                      variant="outline"
                      disabled={isTranscribingAi}
                      className="border-border/60 hover:bg-muted text-foreground font-bold text-[10px] h-8 rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <FileText size={11} className="text-muted-foreground" /> Importar LRC
                    </Button>
                    <Button
                      type="button"
                      onClick={handleTranscribeWithAi}
                      disabled={isTranscribingAi}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-[10px] h-8 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      {isTranscribingAi ? (
                        <>Transcrevendo...</>
                      ) : (
                        <><Sparkles size={11} className="text-zinc-50 animate-pulse" /> Transcrever com IA</>
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleStartSync}
                      disabled={isTranscribingAi}
                      className="bg-primary hover:bg-primary/95 text-primary-foreground font-black text-[10px] h-8 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-md shadow-primary/10"
                    >
                      <Play size={11} fill="currentColor" /> Sincronizar Live (Passo 2)
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* MODO: SINCRONIZADOR LIVE & EDITOR DE TRANSLATIONS */
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                {/* Header do Sincronizador */}
                <div className="p-3 bg-muted/40 border border-border/40 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-foreground uppercase tracking-wider">
                      Sincronizador Interativo Ativo
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      Dê play no áudio. A cada frase que ouvir, aperte <kbd className="bg-muted px-1.5 py-0.5 rounded border font-mono font-bold text-[8.5px] shadow-sm">ESPAÇO</kbd> ou <kbd className="bg-muted px-1.5 py-0.5 rounded border font-mono font-bold text-[8.5px] shadow-sm">ENTER</kbd> para registrar o tempo e avançar.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      onClick={stampCurrentTime}
                      disabled={syncingLineIdx >= tempLines.length}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] h-8 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Clock size={11} /> Marcar Tempo
                    </Button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="p-2 bg-primary text-primary-foreground rounded-full shadow-md shadow-primary/10 hover:bg-primary/90 transition-all cursor-pointer w-8 h-8 flex items-center justify-center shrink-0"
                    >
                      {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} className="ml-0.5" fill="currentColor" />}
                    </button>
                  </div>
                </div>

                {/* Atalhos do Teclado */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] font-semibold text-muted-foreground bg-muted/20 px-3.5 py-2 rounded-xl border border-border/30">
                  <span className="font-black uppercase tracking-wider text-[8px] text-primary flex items-center gap-1">
                    <Keyboard size={10} /> Atalhos:
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-muted border border-border/60 px-1 py-0.5 rounded text-[8.5px] font-mono shadow-sm">Espaço</kbd> ou <kbd className="bg-muted border border-border/60 px-1 py-0.5 rounded text-[8.5px] font-mono shadow-sm">Enter</kbd> Marcar frase e avançar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="bg-muted border border-border/60 px-1 py-0.5 rounded text-[8.5px] font-mono shadow-sm">Backspace</kbd> Desfazer e voltar frase
                  </span>
                </div>

                {/* Tabela/Lista para ajuste manual e tradução */}
                <div className="flex-1 overflow-y-auto border border-border/40 rounded-xl min-h-[150px] divide-y divide-border/25">
                  {tempLines.map((line, idx) => {
                    const isSyncing = syncingLineIdx === idx;
                    const isSynced = line.startTime > 0 || idx < syncingLineIdx;
                    
                    return (
                      <div
                        key={line.id}
                        className={`p-3 transition-colors flex flex-col md:flex-row md:items-center gap-3 ${
                          isSyncing
                            ? 'bg-amber-500/[0.04] border-l-2 border-amber-500 shadow-inner'
                            : isSynced
                            ? 'bg-emerald-500/[0.01]'
                            : 'opacity-50'
                        }`}
                      >
                        {/* Num / Status */}
                        <div className="flex items-center gap-2 shrink-0 md:w-16">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isSyncing
                              ? 'bg-amber-500 text-white font-black'
                              : isSynced
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            #{idx + 1}
                          </span>
                        </div>

                        {/* Textos */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">Texto Original</label>
                            <input
                              type="text"
                              value={line.text}
                              onChange={(e) => handleUpdateLineText(idx, e.target.value)}
                              className="w-full bg-muted/40 border border-border/45 text-foreground px-2 py-1 rounded-lg text-xs outline-none focus:border-primary/50 focus:bg-background font-semibold"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-wider">Tradução (Opcional)</label>
                            <input
                              type="text"
                              value={line.translation || ''}
                              onChange={(e) => handleUpdateLineTranslation(idx, e.target.value)}
                              className="w-full bg-muted/40 border border-border/45 text-foreground px-2 py-1 rounded-lg text-xs outline-none focus:border-primary/50 focus:bg-background font-medium"
                              placeholder="Tradução da frase..."
                            />
                          </div>
                        </div>

                        {/* Tempo & Ajustes */}
                        <div className="flex items-center gap-1.5 shrink-0 justify-end pt-1 md:pt-0">
                          <span className="text-[10px] font-mono font-black text-primary bg-primary/5 border border-primary/15 px-2 py-1 rounded-lg tabular-nums">
                            {formatTime(line.startTime)}.{Math.floor((line.startTime % 1) * 100).toString().padStart(2, '0')}
                          </span>
                          
                          <div className="flex items-center bg-muted/65 rounded-lg border border-border/30 p-0.5">
                            <button
                              type="button"
                              onClick={() => adjustLineTime(idx, -0.5)}
                              className="px-1.5 py-1 hover:bg-muted text-[8.5px] font-black text-muted-foreground hover:text-foreground rounded cursor-pointer"
                              title="Voltar 0.5s"
                            >
                              -0.5s
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustLineTime(idx, 0.5)}
                              className="px-1.5 py-1 hover:bg-muted text-[8.5px] font-black text-muted-foreground hover:text-foreground rounded cursor-pointer"
                              title="Avançar 0.5s"
                            >
                              +0.5s
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé do Editor */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTempLines([]);
                      setTranscriptionText(activeTranscriptionTrack.transcriptionLines?.map(l => l.text).join('\n') || '');
                    }}
                    className="border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-[10px] h-9 rounded-xl cursor-pointer"
                  >
                    Recomeçar / Voltar
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTempLines([]);
                        setTranscriptionText('');
                      }}
                      className="border-border/60 hover:bg-destructive/15 text-destructive hover:text-destructive font-semibold text-[10px] h-9 rounded-xl cursor-pointer"
                    >
                      Limpar Tudo
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveTranscription}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-9 rounded-xl cursor-pointer shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
                    >
                      <BookOpen size={11} /> Salvar Transcrição
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ShadcnCard>
    );
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="space-y-6 w-full px-4 md:px-8 py-4 relative flex flex-col min-h-[calc(100vh-100px)]">
      {/* Estilos para o Range Slider e Vinyl spinner */}
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
        @keyframes spin-record {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-record {
          animation: spin-record 4s linear infinite;
        }
      `}} />

      {/* Glow Decorativo de fundo */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm shadow-primary/5">
              <Headphones className="animate-pulse" size={24} />
            </div> 
            Playlist e Álbuns de Áudio
          </h2>
          <p className="text-xs text-muted-foreground font-semibold leading-relaxed max-w-2xl">
            Crie álbuns, adicione capas personalizadas, gerencie suas faixas e treine sua escuta em segundo plano ou com o fone de ouvido.
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <Button
            onClick={() => setIsNewPlaylistOpen(true)}
            variant="outline"
            className="border-border/60 hover:bg-muted/80 text-foreground font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 h-10 px-4 cursor-pointer transition-all duration-200 active:scale-95"
          >
            <FolderPlus size={15} /> Novo Álbum
          </Button>
          
          <Button
            onClick={() => {
              if (!selectedPlaylist) {
                toast.error('Crie ou selecione um álbum primeiro.');
                return;
              }
              setIsUploadOpen(true);
            }}
            disabled={playlists.length === 0}
            className="bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 h-10 px-4 shadow-lg shadow-primary/10 cursor-pointer transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} /> Adicionar Áudio
          </Button>
        </div>
      </div>

      {/* Layout de 3 Colunas Esticadas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch flex-1 min-h-0 w-full">
        
        {/* COLUNA 1: Lista de Álbuns (1 Coluna) */}
        {!activeTranscriptionTrack && (
          <div className="lg:col-span-1 space-y-4 flex flex-col h-full lg:sticky lg:top-4 lg:self-start">
          <ShadcnCard className="bg-card/40 backdrop-blur-md border-border/50 p-4 rounded-2xl shadow-xl flex flex-col flex-1 h-full min-h-[495px]">
            <div className="flex items-center justify-between pb-2 border-b border-border/40 shrink-0">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest block">
                Meus Álbuns ({playlists.length})
              </h3>
            </div>

            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-4 border border-dashed border-border/30 rounded-2xl bg-muted/5 flex-1">
                <FolderHeart size={28} className="text-muted-foreground/60 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-foreground">Nenhum álbum criado</p>
                  <p className="text-[10px] max-w-[160px] leading-normal mx-auto">
                    Crie pastas para organizar seus áudios de estudo.
                  </p>
                </div>
                <Button
                  onClick={() => setIsNewPlaylistOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-8 text-[10px] px-3.5 rounded-lg cursor-pointer"
                >
                  Criar Álbum
                </Button>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 min-h-0 mt-3 pr-1 space-y-2.5">
                {playlists.map(pl => {
                  const isSelected = selectedPlaylist?.id === pl.id;
                  const coverSrc = playlistCoverUrls[pl.id];
                  
                  return (
                    <div
                      key={pl.id}
                      onClick={() => setSelectedPlaylist(pl)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all duration-200 cursor-pointer group relative ${
                        isSelected
                          ? 'bg-primary/10 border-primary/20 shadow-md ring-1 ring-primary/10'
                          : 'hover:bg-muted/30 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Album Art Thumb */}
                        {/* Vinyl disc or cover art — spins when a track from this album is playing */}
                        {(() => {
                          const isThisPlaying = isPlaying && currentTrack?.playlistId === pl.id;
                          return coverSrc ? (
                            <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 shadow-sm transition-all duration-300 relative ${
                              isThisPlaying
                                ? 'border-primary shadow-primary/30 animate-spin-record'
                                : 'border-border/40'
                            }`}>
                              <img src={coverSrc} alt={pl.name} className="w-full h-full object-cover" />
                              {/* Central hole */}
                              <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-card border border-border/60" style={{width:'8px',height:'8px',top:'50%',left:'50%',transform:'translate(-50%,-50%)'}} />
                            </div>
                          ) : (
                            <div className={`w-10 h-10 rounded-full shrink-0 bg-gradient-to-br flex items-center justify-center text-[10px] text-zinc-50 font-black shadow-inner border-2 relative transition-all duration-300 ${
                              isThisPlaying
                                ? `border-primary shadow-primary/30 animate-spin-record ${getGradientFromTitle(pl.name)}`
                                : `border-transparent ${getGradientFromTitle(pl.name)}`
                            }`}>
                              {isThisPlaying ? '' : pl.name.substring(0, 2).toUpperCase()}
                              {/* Central hole when playing */}
                              {isThisPlaying && (
                                <div className="absolute w-2 h-2 rounded-full bg-card border border-white/20" />
                              )}
                            </div>
                          );
                        })()}
                        
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-extrabold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {pl.name}
                          </span>
                          {pl.description && (
                            <span className="text-[9px] text-muted-foreground truncate font-semibold">
                              {pl.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pl-1">
                        <button
                          type="button"
                          onClick={(e) => handleDeletePlaylist(pl, e)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Excluir álbum"
                        >
                          <Trash2 size={12} />
                        </button>
                        <ChevronRight size={13} className="text-muted-foreground/30" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ShadcnCard>
        </div>
        )}

        {/* COLUNA 2: Lista de Faixas do Álbum Ativo (2 Colunas) OU Tela de Transcrição/Karaokê (4 Colunas) */}
        <div className={`${
          activeTranscriptionTrack ? 'lg:col-span-4' : 'lg:col-span-2'
        } space-y-4 flex flex-col h-full`}>
          {activeTranscriptionTrack ? (
            renderTranscriptionPanel()
          ) : (
            <ShadcnCard className="bg-card/40 backdrop-blur-md border-border/50 p-5 rounded-2xl shadow-xl flex flex-col flex-1 h-full min-h-[495px]">
                {selectedPlaylist ? (
                  <>
                    <div className="flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
                      <div className="flex items-center gap-3">
                        {/* Album cover miniatura no cabeçalho de faixas */}
                        {playlistCoverUrls[selectedPlaylist.id] ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-border/40 shrink-0">
                            <img src={playlistCoverUrls[selectedPlaylist.id]} alt={selectedPlaylist.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className={`w-8 h-8 rounded-lg shrink-0 bg-gradient-to-br flex items-center justify-center text-[8px] text-zinc-50 font-black ${getGradientFromTitle(selectedPlaylist.name)}`}>
                            {selectedPlaylist.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <h3 className="text-xs font-black text-foreground">
                            Faixas de {selectedPlaylist.name}
                          </h3>
                          <p className="text-[9px] text-muted-foreground font-semibold">
                            {tracks.length} áudios cadastrados
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => setIsUploadOpen(true)}
                        className="h-8 px-3 text-[10px] font-bold rounded-lg cursor-pointer bg-muted hover:bg-muted/80 text-foreground border border-border/40"
                      >
                        <Plus size={12} /> Adicionar
                      </Button>
                    </div>

                    {tracks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-4 border border-dashed border-border/30 rounded-2xl bg-muted/5 flex-1 mt-4">
                        <Music size={24} className="opacity-80" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-foreground">Álbum vazio</p>
                          <p className="text-[9px] max-w-xs leading-normal px-4">
                            Nenhum arquivo de áudio adicionado neste álbum. Faça upload de arquivos MP3 ou WAV.
                          </p>
                        </div>
                        <Button
                          onClick={() => setIsUploadOpen(true)}
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-8 text-[10px] px-4 rounded-lg cursor-pointer"
                        >
                          Upload de Áudio
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/35 overflow-y-auto pr-1 space-y-1 flex-1 min-h-0 mt-3">
                        {tracks.map((track, idx) => {
                          const isCurrent = currentTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              onClick={() => handlePlayTrack(track)}
                              className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer group border ${
                                isCurrent 
                                  ? 'bg-primary/10 border-primary/20 shadow-sm shadow-primary/5' 
                                  : 'hover:bg-muted/30 border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                  isCurrent 
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/15' 
                                    : 'bg-muted/50 text-muted-foreground border-border/40 group-hover:bg-muted group-hover:text-foreground'
                                }`}>
                                  {isCurrent && isPlaying ? (
                                    <div className="flex items-center gap-0.5 h-2.5">
                                      <span className="w-[1.5px] h-full bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                      <span className="w-[1.5px] h-full bg-current rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                                      <span className="w-[1.5px] h-full bg-current rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className={`text-xs font-bold truncate ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                                    {track.title}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                    {track.description && (
                                      <span className="text-[9px] text-muted-foreground truncate font-semibold">
                                        {track.description}
                                      </span>
                                    )}
                                    {track.transcriptionLines && track.transcriptionLines.length > 0 && (
                                      <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 rounded flex items-center gap-0.5 shrink-0" title="Possui transcrição">
                                        <FileText size={7} />
                                        T
                                      </span>
                                    )}
                                    {track.instrumentalFile && (
                                      <span
                                        className="text-[8px] font-black text-violet-500 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1 rounded flex items-center gap-0.5 shrink-0"
                                        title="Instrumental sem voz processado por Demucs IA — pronto para cantar!"
                                      >
                                        <Sparkles size={7} />
                                        IA
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Repeat badge */}
                                {(track.repeatTimes ?? 1) !== 1 && (
                                  <span className="text-[8px] font-black text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <Repeat size={7} />
                                    {track.repeatTimes === 0 ? '∞' : `${track.repeatTimes}×`}
                                  </span>
                                )}

                                <span className="text-[8px] font-mono font-bold text-muted-foreground bg-muted/60 border border-border/40 px-2 py-0.5 rounded-lg">
                                  {(track.audioFile.size / (1024 * 1024)).toFixed(1)} MB
                                </span>
                                
                                {/* Transcription button */}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenTranscription(track); }}
                                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Ver Transcrição / Karaokê"
                                >
                                  <FileText size={12} />
                                </button>

                                {/* Settings gear button */}
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenTrackSettings(track, e)}
                                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Configurações da faixa"
                                >
                                  <Settings2 size={12} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteTrack(track.id, e)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Excluir faixa"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-4 flex-1">
                    <div className="p-4 bg-muted/40 rounded-2xl border border-border/30 shadow-inner">
                      <FolderHeart size={32} className="opacity-70 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-foreground">Nenhum álbum selecionado</p>
                      <p className="text-xs max-w-xs leading-normal">
                        Selecione um álbum de áudio no painel lateral ou crie um novo para carregar suas aulas.
                      </p>
                    </div>
                  </div>
                )}
              </ShadcnCard>
            )}
          </div>
            
            {/* COLUNA 3: Tocador de Mídia Integrado — ocultado quando a transcrição está aberta */}
            {!activeTranscriptionTrack ? (
              <div className="lg:col-span-1 space-y-4 flex flex-col lg:sticky lg:top-4 lg:self-start">
              <ShadcnCard className="bg-card/90 border-border/80 p-5 rounded-3xl shadow-2xl flex flex-col items-center justify-between text-center space-y-5 relative overflow-hidden min-h-[495px]">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />

                <div className="flex items-center justify-between w-full border-b border-border/40 pb-2 relative z-10">
                  <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Tocador de Mídia
                  </h3>
                  <div className="flex items-center gap-2">
                    {currentTrack && (
                      <button
                        type="button"
                        onClick={() => setIsLooping(prev => !prev)}
                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                          isLooping 
                            ? 'text-primary bg-primary/15 border border-primary/20' 
                            : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                        }`}
                        title={isLooping ? 'Desativar loop da faixa' : 'Ativar loop da faixa'}
                      >
                        <Repeat size={13} className={isLooping ? 'animate-pulse' : ''} />
                      </button>
                    )}
                    {currentTrack && (
                      <button
                        type="button"
                        onClick={() => handleOpenTranscription(currentTrack)}
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        title="Ver Transcrição / Letra"
                      >
                        <FileText size={13} />
                      </button>
                    )}
                    {currentTrack && (
                      <span className="flex h-2 w-2 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${isPlaying ? '' : 'hidden'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 bg-primary ${isPlaying ? '' : 'opacity-40'}`}></span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Capa de Vinil Grande */}
                <div className="relative flex items-center justify-center w-full z-10 pt-1">
                  {/* Visualizador de Ondas Sonoras */}
                  <canvas
                    ref={canvasRef}
                    width={200}
                    height={200}
                    className="absolute pointer-events-none z-0"
                  />
                  <div className={`w-32 h-32 rounded-full bg-zinc-950 border-4 border-zinc-800 shadow-2xl flex items-center justify-center transition-all duration-500 relative ring-4 ring-primary/5 z-10 ${
                    isPlaying ? 'scale-105 shadow-primary/15 animate-spin-slow' : 'scale-95 opacity-80'
                  }`}>
                    <div className="absolute inset-2 rounded-full border border-zinc-700/40 pointer-events-none" />
                    <div className="absolute inset-4 rounded-full border border-zinc-700/30 pointer-events-none" />
                    <div className="absolute inset-7 rounded-full border border-zinc-700/20 pointer-events-none" />
                    
                    {/* Imagem de Capa do Álbum no Centro do Disco */}
                    {selectedPlaylist && playlistCoverUrls[selectedPlaylist.id] ? (
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-lg relative">
                        <img src={playlistCoverUrls[selectedPlaylist.id]} alt="capa" className="w-full h-full object-cover" />
                        {/* Furo central do vinil */}
                        <div className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-zinc-950 border border-primary/45" />
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-full border-2 border-primary bg-gradient-to-br flex items-center justify-center text-[7px] text-zinc-50 font-black relative ${selectedPlaylist ? getGradientFromTitle(selectedPlaylist.name) : 'from-zinc-800 to-zinc-900'}`}>
                        {selectedPlaylist ? selectedPlaylist.name.substring(0, 2).toUpperCase() : 'M'}
                        <div className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-zinc-950 border border-primary/40" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Info da Faixa */}
                <div className="space-y-1 w-full px-2 relative min-h-[48px] z-10">
                  {currentTrack ? (
                    <>
                      <h4 className="font-extrabold text-sm text-foreground truncate px-1" title={currentTrack.title}>
                        {currentTrack.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-semibold truncate px-1">
                        {currentTrack.description || selectedPlaylist?.name || 'Faixa personalizada'}
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-extrabold text-xs text-muted-foreground/80 leading-relaxed">
                        Nenhum áudio selecionado
                      </h4>
                      <p className="text-[9px] text-muted-foreground/60 leading-none">
                        Selecione uma faixa da lista para ouvir
                      </p>
                    </>
                  )}
                </div>

                {/* Barra de Progresso Customizada (Interativa com Scrubbing) */}
                <div className="w-full space-y-1.5 relative px-1 z-10">
                  {/* Visual track container */}
                  <div className="relative w-full h-5 flex items-center group">
                    {/* Track background */}
                    <div className="absolute w-full h-[5px] rounded-full bg-white/10" />
                    {/* Fill (progresso) */}
                    <div
                      className="absolute h-[5px] rounded-full bg-primary pointer-events-none"
                      style={{ width: duration ? `${Math.min((progress / duration) * 100, 100)}%` : '0%' }}
                    />
                    {/* Thumb */}
                    {currentTrack && (
                      <div
                        className="absolute w-3.5 h-3.5 rounded-full bg-primary shadow-lg shadow-primary/60 -translate-x-1/2 pointer-events-none transition-transform group-hover:scale-125"
                        style={{ left: duration ? `${Math.min((progress / duration) * 100, 100)}%` : '0%' }}
                      />
                    )}
                    {/* Invisible range input on top para interação nativa */}
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={progress}
                      step={0.1}
                      onChange={(e) => handleScrub(parseFloat(e.target.value))}
                      disabled={!currentTrack}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/80 font-bold">
                    <span>{formatTime(progress)}</span>
                    <span className="flex items-center gap-1">
                      <Volume2 size={10} />
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>


                {/* Controles de Playback Premium */}
                <div className="flex items-center justify-center gap-2.5 w-full relative z-10">
                  {/* Voltar 5 segundos */}
                  <button
                    type="button"
                    onClick={() => handleScrub(Math.max(0, progress - 5))}
                    disabled={!currentTrack}
                    className="p-2 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 border border-border/40 flex items-center justify-center shadow-inner"
                    title="Voltar 5 segundos"
                  >
                    <RotateCcw size={14} />
                  </button>

                  {/* Faixa Anterior */}
                  <button
                    type="button"
                    onClick={() => handlePrevTrack()}
                    disabled={tracks.length <= 1}
                    className="p-2.5 bg-muted/50 hover:bg-muted text-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 border border-border/40 flex items-center justify-center shadow-inner"
                    title="Faixa anterior"
                  >
                    <SkipBack size={14} />
                  </button>

                  {/* Play / Pause */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={tracks.length === 0}
                    className="p-4 bg-primary hover:bg-primary/95 text-primary-foreground rounded-full cursor-pointer shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed border border-primary/20 flex items-center justify-center shrink-0 w-12 h-12"
                    title={isPlaying ? 'Pausar' : 'Tocar'}
                  >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-0.5" fill="currentColor" />}
                  </button>

                  {/* Próxima Faixa */}
                  <button
                    type="button"
                    onClick={() => handleNextTrack()}
                    disabled={tracks.length <= 1}
                    className="p-2.5 bg-muted/50 hover:bg-muted text-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 border border-border/40 flex items-center justify-center shadow-inner"
                    title="Próxima faixa"
                  >
                    <SkipForward size={14} />
                  </button>

                  {/* Avançar 5 segundos */}
                  <button
                    type="button"
                    onClick={() => handleScrub(Math.min(duration, progress + 5))}
                    disabled={!currentTrack}
                    className="p-2 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 border border-border/40 flex items-center justify-center shadow-inner rotate-180"
                    title="Avançar 5 segundos"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* Status de loop / repetição da faixa atual */}
                {currentTrack && (
                  <div className="w-full pt-3 border-t border-border/40 relative z-10">
                    {isLooping ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/25">
                        <Repeat size={11} className="text-primary animate-pulse shrink-0" />
                        <span className="text-[9px] font-black text-primary">Loop ativo — faixa repetindo infinitamente</span>
                      </div>
                    ) : (() => {
                      const rt = currentTrack.repeatTimes ?? 1;
                      return (
                        <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 border border-border/30">
                          <Repeat size={10} className="text-muted-foreground shrink-0" />
                          <span className="text-[9px] font-semibold text-muted-foreground">
                            {rt === 0 ? 'Faixa em loop infinito (config. da faixa)' : rt === 1 ? 'Tocando uma vez' : `Repetição ${playCount} de ${rt}`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Seletor de Velocidade */}
                <div className="w-full space-y-1.5 text-left relative pt-1 z-10">
                  <span className="text-[9px] font-black text-muted-foreground/80 flex items-center gap-1.5 uppercase tracking-widest">
                    <Clock size={10} /> Velocidade
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 w-full bg-muted/40 p-1 rounded-xl border border-border/30">
                    {speedOptions.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleSpeedChange(option)}
                        className={`py-1 rounded-lg text-[9px] font-mono font-black transition-all duration-200 cursor-pointer ${
                          playbackSpeed === option
                            ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10'
                            : 'hover:bg-muted border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {option.toFixed(1)}x
                      </button>
                    ))}
                  </div>
                </div>
              </ShadcnCard>
            </div>
            ) : null}
      </div>

      {/* ── Mini Player Fixo Flutuante na Base da Tela ── */}
      {activeTranscriptionTrack && currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
          <div className="w-full pointer-events-auto bg-card/65 backdrop-blur-2xl border-t border-border/40 shadow-2xl shadow-black/30 overflow-hidden flex flex-col animate-fadeIn">
            {/* Barra de progresso interativa com overlay invisível de range input */}
            <div className="relative h-1 w-full bg-border/20 group/progress">
              {/* Fill */}
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
                disabled={!currentTrack}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
              {/* Letra Atual / Info (Esquerda) */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {/* Imagem de Capa do Álbum Miniatura */}
                {(() => {
                  const coverSrc = playlistCoverUrls[currentTrack.playlistId];
                  return coverSrc ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/40 shadow-sm hidden sm:block">
                      <img src={coverSrc} alt={currentTrack.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg shrink-0 bg-muted/60 border border-border/30 flex items-center justify-center text-muted-foreground hidden sm:flex">
                      <Music size={16} />
                    </div>
                  );
                })()}

                <div className="flex-1 min-w-0">
                  {activeLineIdx >= 0 && activeTranscriptionTrack?.transcriptionLines?.[activeLineIdx] ? (
                    <p className="text-xs sm:text-sm font-extrabold text-primary truncate animate-fadeIn">
                      {activeTranscriptionTrack.transcriptionLines[activeLineIdx].text}
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-foreground truncate">
                      {currentTrack.title}
                    </p>
                  )}
                  {activeLineIdx >= 0 && activeTranscriptionTrack?.transcriptionLines?.[activeLineIdx]?.translation && showTranslation && (
                    <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.5 animate-fadeIn">
                      {activeTranscriptionTrack.transcriptionLines[activeLineIdx].translation}
                    </p>
                  )}
                </div>
              </div>

              {/* Controles de Áudio & Vocal (Direita) */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Tempo do Áudio */}
                <p className="text-[10px] text-muted-foreground font-mono tabular-nums hidden md:block">
                  {formatTime(progress)} / {formatTime(duration)}
                </p>

                {/* Controles de Redução Vocal / IA integrados na barra */}
                <div className="flex items-center bg-muted/40 border border-border/30 rounded-xl p-0.5 gap-0.5 hidden sm:flex">
                  {/* Atenuar phase cancellation */}
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

                  {/* IA Separation */}
                  {currentTrack.instrumentalFile ? (
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
                      title="Instrumental IA indisponível para esta faixa"
                      className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-muted-foreground/30 cursor-not-allowed"
                    >
                      IA
                    </button>
                  )}
                </div>

                {/* Seletor de Velocidade */}
                <button
                  type="button"
                  onClick={() => {
                    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                    setPlaybackSpeed(next);
                    if (audioRef.current) audioRef.current.playbackRate = next;
                  }}
                  className="text-[9px] sm:text-[10px] font-black text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl px-2.5 py-1.5 transition-all cursor-pointer tabular-nums shrink-0"
                  title="Velocidade de reprodução"
                >
                  {playbackSpeed}×
                </button>

                {/* Botão Play / Pause */}
                <button
                  type="button"
                  onClick={() => {
                    if (audioRef.current) {
                      if (isPlaying) {
                        audioRef.current.pause();
                      } else {
                        audioRef.current.play();
                      }
                      setIsPlaying(!isPlaying);
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Criar Álbum */}
      <Dialog open={isNewPlaylistOpen} onOpenChange={setIsNewPlaylistOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <FolderPlus size={16} />
              </div>
              Criar Novo Álbum de Áudio
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Defina um nome, descrição e adicione uma imagem de capa para o seu novo álbum.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePlaylist} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Nome do Álbum *
              </label>
              <Input
                type="text"
                required
                placeholder="Ex: Aulas de Phrasal Verbs"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Descrição Curta
              </label>
              <Input
                type="text"
                placeholder="Ex: Áudios completos do livro X"
                value={playlistDesc}
                onChange={(e) => setPlaylistDesc(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Imagem de Capa (Opcional)
              </label>
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/80 bg-muted/15 hover:bg-muted/30 rounded-xl cursor-pointer transition-all duration-200 relative group min-h-[100px] hover:border-primary/45">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('A imagem de capa deve ter no máximo 5MB.');
                        return;
                      }
                      setPlaylistCoverFile(file);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                
                <div className="text-center space-y-1.5 relative z-0 flex flex-col items-center">
                  <ImageIcon size={22} className="text-muted-foreground group-hover:text-primary transition-colors duration-200 shrink-0" />
                  {playlistCoverFile ? (
                    <>
                      <span className="text-xs font-extrabold text-primary truncate max-w-xs block px-2">
                        {playlistCoverFile.name}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground block leading-none font-bold">
                        {(playlistCoverFile.size / 1024).toFixed(0)} KB
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-extrabold text-foreground block">
                        Selecione a imagem de capa
                      </span>
                      <span className="text-[9px] text-muted-foreground block leading-none font-semibold">
                        Recomendado: Imagem quadrada JPG/PNG
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPlaylistName('');
                  setPlaylistDesc('');
                  setPlaylistCoverFile(null);
                  setIsNewPlaylistOpen(false);
                }}
                className="w-full sm:w-auto border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold h-10 text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!playlistName.trim()}
                className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-10 text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                Criar Álbum
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Upload de Áudio */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Upload size={16} />
              </div>
              Adicionar Nova Faixa de Estudo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Escolha o arquivo de áudio (MP3/WAV) para salvar no álbum "{selectedPlaylist?.name}".
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Título da Faixa *
              </label>
              <Input
                type="text"
                required
                placeholder="Ex: Diálogo da Aula 4"
                value={newTrackTitle}
                onChange={(e) => setNewTrackTitle(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Descrição/Marcador
              </label>
              <Input
                type="text"
                placeholder="Ex: Podcast de Listening, audiobook, etc."
                value={newTrackDesc}
                onChange={(e) => setNewTrackDesc(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Arquivo de Áudio (MP3 ou WAV) *
              </label>
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/80 bg-muted/15 hover:bg-muted/30 rounded-xl cursor-pointer transition-all duration-200 relative group min-h-[100px] hover:border-primary/45">
                <input
                  type="file"
                  accept="audio/*"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewFile(file);
                      if (!newTrackTitle.trim()) {
                        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        setNewTrackTitle(nameWithoutExt);
                      }
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                
                <div className="text-center space-y-1.5 relative z-0 flex flex-col items-center">
                  <Upload size={22} className="text-muted-foreground group-hover:text-primary transition-colors duration-200 shrink-0" />
                  {newTrackFile ? (
                    <>
                      <span className="text-xs font-extrabold text-primary truncate max-w-xs block px-2">
                        {newTrackFile.name}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground block leading-none font-bold">
                        {(newTrackFile.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-extrabold text-foreground block">
                        Clique ou arraste o arquivo aqui
                      </span>
                      <span className="text-[9px] text-muted-foreground block leading-none font-semibold">
                        Arquivos MP3, WAV, M4A de até 50MB
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/40 border border-border/30 rounded-xl flex items-start gap-2">
              <Info className="text-primary shrink-0 mt-0.5" size={13} />
              <p className="text-[9.5px] text-muted-foreground leading-normal font-semibold">
                O arquivo é armazenado no banco local IndexedDB e a capa do álbum associado será enviada para a tela de bloqueio do seu celular no fundo do player nativo.
              </p>
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewTrackTitle('');
                  setNewTrackDesc('');
                  setNewFile(null);
                  setIsUploadOpen(false);
                }}
                disabled={isUploading}
                className="w-full sm:w-auto border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold h-10 text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isUploading || !newTrackFile || !newTrackTitle.trim()}
                className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-10 text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isUploading ? 'Salvando...' : 'Adicionar Faixa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Configurações da Faixa */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) { setIsEditOpen(false); setEditTrack(null); } }}>
        <DialogContent className="sm:max-w-[480px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Settings2 size={16} />
              </div>
              Configurações da Faixa
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Edite o nome, descrição e quantas vezes esta faixa deve tocar automaticamente antes de avançar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTrackSettings} className="space-y-5 pt-3">
            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">Título da Faixa *</label>
              <Input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">Descrição / Marcador</label>
              <Input
                type="text"
                placeholder="Ex: Podcast de Listening, Aula 5..."
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            {/* Repetições */}
            <div className="space-y-3 p-4 bg-muted/30 border border-border/40 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Repeat size={13} className="text-primary" />
                    Repetições automáticas
                  </p>
                  <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                    Quantas vezes esta faixa toca antes de avançar para a próxima
                  </p>
                </div>
                <span className="text-lg font-black text-primary tabular-nums">
                  {editRepeatTimes === 0 ? '∞' : `${editRepeatTimes}×`}
                </span>
              </div>

              {/* Selector de opções */}
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 5, 10, 0].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEditRepeatTimes(n)}
                    className={`py-2.5 rounded-xl text-[10px] font-black border transition-all duration-200 cursor-pointer ${
                      editRepeatTimes === n
                        ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                        : 'bg-muted/60 hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground'
                    }`}
                    title={n === 0 ? 'Loop infinito' : `Tocar ${n} vez${n > 1 ? 'es' : ''}`}
                  >
                    {n === 0 ? '∞' : `${n}×`}
                  </button>
                ))}
              </div>

              {/* Descrição dinâmica */}
              <p className="text-[9px] text-center text-muted-foreground font-semibold leading-relaxed">
                {editRepeatTimes === 0
                  ? '🔁 A faixa vai repetir infinitamente até você trocar manualmente.'
                  : editRepeatTimes === 1
                  ? '▶️ A faixa toca uma vez e avança para a próxima automaticamente.'
                  : `🔁 A faixa vai tocar ${editRepeatTimes} vezes consecutivas antes de avançar.`}
              </p>
            </div>

            <DialogFooter className="pt-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsEditOpen(false); setEditTrack(null); }}
                className="w-full sm:w-auto border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold h-10 text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!editTitle.trim()}
                className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-10 text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                Salvar Configurações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={confirmModal.open} onOpenChange={(open) => { if (!open) closeConfirm(); }}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-destructive/10 text-destructive rounded-lg">
                <Trash2 size={16} />
              </div>
              {confirmModal.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold leading-relaxed pt-1">
              {confirmModal.description}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeConfirm}
              className="w-full sm:w-auto border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold h-10 text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                confirmModal.onConfirm();
                closeConfirm();
              }}
              className="w-full sm:w-auto flex-1 bg-destructive hover:bg-destructive/90 text-white font-bold h-10 text-xs rounded-xl cursor-pointer shadow-md shadow-destructive/20"
            >
              {confirmModal.confirmLabel ?? 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};
