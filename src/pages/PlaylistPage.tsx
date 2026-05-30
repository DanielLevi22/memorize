import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Trash2, 
  Plus, 
  Upload, 
  Music, 
  Headphones, 
  Clock, 
  ChevronRight, 
  Volume2, 
  Repeat, 
  RotateCcw
} from 'lucide-react';
import { db } from '../db/db';
import type { AudioTrack } from '../types';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export const PlaylistPage: React.FC = () => {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [activeUrl, setActiveUrl] = useState<string>('');

  // Upload/Modal States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Load tracks from Dexie on mount
  const loadTracks = async () => {
    try {
      const allTracks = await db.audioTracks.orderBy('createdAt').toArray();
      setTracks(allTracks);
    } catch (e) {
      console.error('Failed to load audio tracks:', e);
      toast.error('Falha ao carregar faixas de áudio.');
    }
  };

  useEffect(() => {
    loadTracks();
    return () => {
      cleanupAudio();
    };
  }, []);

  // Cleanup current playing audio
  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (activeUrl) {
      URL.revokeObjectURL(activeUrl);
      setActiveUrl('');
    }
  };

  // Play a specific track
  const handlePlayTrack = (track: AudioTrack) => {
    cleanupAudio();

    try {
      const url = URL.createObjectURL(track.audioFile);
      setActiveUrl(url);
      setCurrentTrack(track);

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      setIsPlaying(true);

      audio.play().catch((err) => {
        console.error('Play error:', err);
        toast.error('Não foi possível reproduzir este áudio.');
        setIsPlaying(false);
      });

      // Event Listeners
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.onended = () => {
        if (isLooping) {
          audio.currentTime = 0;
          audio.play().catch(e => console.warn(e));
        } else {
          handleNextTrack(track);
        }
      };

      // Progress Tracker Interval
      progressIntervalRef.current = window.setInterval(() => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
        }
      }, 250);

      // Media Session API Setup for lockscreen and earphone buttons
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.description || 'Playlist Memorize',
          album: 'Modo Ouvinte',
          artwork: [
            { 
              src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24" fill="none" stroke="%238b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
              sizes: '512x512',
              type: 'image/svg+xml'
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
      console.error('Audio initialization error:', err);
      toast.error('Falha ao inicializar o player.');
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

  // Go to next track
  const handleNextTrack = (trackRef = currentTrack) => {
    if (!trackRef || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === trackRef.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    handlePlayTrack(tracks[nextIndex]);
  };

  // Go to previous track
  const handlePrevTrack = (trackRef = currentTrack) => {
    if (!trackRef || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === trackRef.id);
    const prevIndex = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1;
    handlePlayTrack(tracks[prevIndex]);
  };

  // Handle Scrubbing (seek through track)
  const handleScrub = (value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setProgress(value);
    }
  };

  // Handle Speed Adjustment
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Delete Track
  const handleDeleteTrack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (currentTrack?.id === id) {
        cleanupAudio();
        setCurrentTrack(null);
        setIsPlaying(false);
        setProgress(0);
        setDuration(0);
      }
      await db.audioTracks.delete(id);
      toast.success('Faixa excluída com sucesso.');
      loadTracks();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao excluir faixa de áudio.');
    }
  };

  // Handle Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newFile) {
      toast.error('Preencha o título e selecione um arquivo.');
      return;
    }

    setIsUploading(true);
    try {
      const newTrack: AudioTrack = {
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        audioFile: newFile,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.audioTracks.add(newTrack);
      toast.success('Áudio adicionado à playlist com sucesso!');
      
      // Reset Upload states
      setNewTitle('');
      setNewDescription('');
      setNewFile(null);
      setIsUploadOpen(false);
      
      loadTracks();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar o áudio no banco de dados.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto px-2 md:px-6 py-2">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Headphones className="text-primary animate-pulse" size={24} /> Playlist e Modo Ouvinte
          </h2>
          <p className="text-xs text-muted-foreground font-medium">
            Suba faixas de áudio (aulas, podcasts, textos) e estude passivamente com fone de ouvido ou tela desligada.
          </p>
        </div>
        
        <Button
          onClick={() => setIsUploadOpen(true)}
          className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 h-10 px-4 shadow-md shadow-primary/10 cursor-pointer transition-all duration-150 active:scale-95"
        >
          <Plus size={16} /> Adicionar Áudio
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Lado Esquerdo: Lista de Áudios (2 colunas no desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <ShadcnCard className="bg-card/70 border-border p-4 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest block pb-2 border-b border-border/50">
              Minhas Faixas ({tracks.length})
            </h3>

            {tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/55 shadow-sm">
                  <Music size={20} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">Nenhuma faixa de áudio</p>
                  <p className="text-xs max-w-xs leading-normal">
                    Faça upload de arquivos MP3 ou WAV locais para começar a criar sua playlist de estudo.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/40 max-h-[460px] overflow-y-auto pr-1 space-y-1">
                {tracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer group border ${
                        isCurrent 
                          ? 'bg-primary/5 border-primary/20 shadow-sm ring-1 ring-primary/10' 
                          : 'hover:bg-muted/40 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                          isCurrent 
                            ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' 
                            : 'bg-muted/60 text-muted-foreground border-border/50 group-hover:bg-muted'
                        }`}>
                          {isCurrent && isPlaying ? (
                            <Volume2 size={15} className="animate-bounce" />
                          ) : (
                            <span className="text-xs font-bold font-mono">{idx + 1}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-bold truncate ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                            {track.title}
                          </span>
                          {track.description && (
                            <span className="text-[10px] text-muted-foreground truncate font-medium">
                              {track.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[9px] font-mono text-muted-foreground bg-muted border border-border/50 px-1.5 py-0.5 rounded-md">
                          {(track.audioFile.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTrack(track.id, e)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Excluir faixa"
                        >
                          <Trash2 size={13} />
                        </button>

                        <ChevronRight size={14} className="text-muted-foreground/50" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ShadcnCard>
        </div>

        {/* Lado Direito: Player (1 coluna no desktop) */}
        <div className="lg:col-span-1 space-y-4">
          <ShadcnCard className="bg-card border-border/80 p-5 rounded-2xl shadow-md flex flex-col items-center text-center space-y-5 relative overflow-hidden">
            {/* Background Blur Efeito Vidro */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest w-full text-left border-b border-border/50 pb-2 relative">
              Tocador de Mídia
            </h3>

            {/* Capa do Player */}
            <div className={`w-32 h-32 rounded-2xl bg-gradient-to-br from-violet-600/10 to-violet-500/20 border border-violet-500/20 shadow-lg flex items-center justify-center transition-all duration-300 relative ${
              isPlaying ? 'scale-105 shadow-violet-500/5 border-primary/30 ring-2 ring-primary/5' : 'scale-95'
            }`}>
              <Headphones size={48} className={`text-primary ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>

            {/* Info da Faixa */}
            <div className="space-y-1 w-full px-2 relative min-h-[48px]">
              {currentTrack ? (
                <>
                  <h4 className="font-extrabold text-sm text-foreground truncate px-1" title={currentTrack.title}>
                    {currentTrack.title}
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-semibold truncate px-1">
                    {currentTrack.description || 'Faixa personalizada'}
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-extrabold text-xs text-muted-foreground leading-relaxed">
                    Nenhum áudio selecionado
                  </h4>
                  <p className="text-[9px] text-muted-foreground/60 leading-none">
                    Selecione uma faixa da lista para ouvir
                  </p>
                </>
              )}
            </div>

            {/* Barra de Progresso */}
            <div className="w-full space-y-1.5 relative px-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={progress}
                onChange={(e) => handleScrub(parseFloat(e.target.value))}
                disabled={!currentTrack}
                className="w-full h-1.5 accent-primary bg-muted rounded-lg appearance-none cursor-pointer outline-none transition-all disabled:opacity-50"
              />
              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/80 font-bold">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controles de Playback */}
            <div className="flex items-center justify-center gap-5 w-full relative">
              <button
                type="button"
                onClick={() => handlePrevTrack()}
                disabled={tracks.length <= 1}
                className="p-3 bg-muted/40 hover:bg-muted text-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 border border-border/40"
                title="Faixa anterior"
              >
                <SkipBack size={16} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={tracks.length === 0}
                className="p-5 bg-primary hover:bg-primary/95 text-primary-foreground rounded-2xl cursor-pointer shadow-lg shadow-primary/10 transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-primary/20 border border-primary/20 flex items-center justify-center"
                title={isPlaying ? 'Pausar' : 'Tocar'}
              >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
              </button>

              <button
                type="button"
                onClick={() => handleNextTrack()}
                disabled={tracks.length <= 1}
                className="p-3 bg-muted/40 hover:bg-muted text-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 border border-border/40"
                title="Próxima faixa"
              >
                <SkipForward size={16} />
              </button>
            </div>

            {/* Ajustes de Loop e Velocidade */}
            <div className="grid grid-cols-2 gap-2.5 w-full pt-2 border-t border-border/50 relative">
              {/* Loop Switch */}
              <button
                type="button"
                onClick={() => setIsLooping(!isLooping)}
                disabled={!currentTrack}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all duration-150 cursor-pointer ${
                  isLooping 
                    ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' 
                    : 'bg-muted/40 hover:bg-muted border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Repeat size={12} className={isLooping ? 'animate-spin' : ''} /> 
                {isLooping ? 'Repetição Ativa' : 'Repetir Faixa'}
              </button>

              {/* Reset Progress */}
              <button
                type="button"
                onClick={() => handleScrub(0)}
                disabled={!currentTrack}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold bg-muted/40 hover:bg-muted border border-transparent text-muted-foreground hover:text-foreground cursor-pointer active:scale-95 transition-all"
              >
                <RotateCcw size={12} /> Reiniciar
              </button>
            </div>

            {/* Seletor de Velocidade */}
            <div className="w-full space-y-1.5 text-left relative pt-1">
              <span className="text-[9px] font-bold text-muted-foreground/80 flex items-center gap-1 uppercase tracking-wider">
                <Clock size={10} /> Velocidade de Estudo
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 w-full">
                {speedOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSpeedChange(option)}
                    className={`py-1.5 px-1 text-[9px] font-mono font-bold rounded-lg border text-center transition-all duration-150 cursor-pointer ${
                      playbackSpeed === option
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.toFixed(2)}x
                  </button>
                ))}
              </div>
            </div>
          </ShadcnCard>
        </div>
      </div>

      {/* Modal Dialog de Upload de Áudio */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-1.5">
              <Upload className="text-primary" size={18} /> Adicionar Nova Faixa de Estudo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Insira um arquivo de áudio local completo e preencha as informações para organizar sua playlist.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground/90 block">
                Título da Faixa *
              </label>
              <Input
                type="text"
                required
                placeholder="Ex: Diálogo da Aula 4 - Inglês Fluente"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground/90 block">
                Descrição ou Marcador (Opcional)
              </label>
              <Input
                type="text"
                placeholder="Ex: Podcast de Listening, audiobook, etc."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground/90 block">
                Arquivo de Áudio (MP3 ou WAV) *
              </label>
              <div className="flex flex-col items-center justify-center p-5 border border-dashed border-border/80 bg-muted/20 hover:bg-muted/40 rounded-xl cursor-pointer transition-all duration-200 relative group min-h-[90px]">
                <input
                  type="file"
                  accept="audio/*"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewFile(file);
                      if (!newTitle.trim()) {
                        // Sugere o nome do arquivo sem extensão como título
                        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        setNewTitle(nameWithoutExt);
                      }
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                
                <div className="text-center space-y-1 relative z-0 flex flex-col items-center">
                  <Upload size={20} className="text-muted-foreground group-hover:text-primary transition-colors duration-150 shrink-0" />
                  {newFile ? (
                    <>
                      <span className="text-xs font-extrabold text-primary truncate max-w-xs block px-2">
                        {newFile.name}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground block leading-none">
                        {(newFile.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-foreground block">
                        Clique ou arraste o arquivo aqui
                      </span>
                      <span className="text-[9px] text-muted-foreground block leading-none">
                        Suporta arquivos MP3, WAV, M4A de até 50MB
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
                  setNewTitle('');
                  setNewDescription('');
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
                disabled={isUploading || !newFile || !newTitle.trim()}
                className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-10 text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isUploading ? 'Salvando...' : 'Adicionar Faixa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
