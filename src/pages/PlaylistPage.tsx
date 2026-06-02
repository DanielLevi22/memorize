import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, FolderPlus, Trash2, FolderHeart, Music, FileText, 
  Settings2, RefreshCw, Repeat, 
  Sparkles, ChevronRight, Mic
} from 'lucide-react';
import { db } from '../db/db';
import type { Playlist, AudioTrack } from '../types';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

interface PlaylistPageProps {
  onPlayTrackInKaraoke?: (trackId: string) => void;
}

export const PlaylistPage: React.FC<PlaylistPageProps> = ({ onPlayTrackInKaraoke }) => {
  // DB States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  
  // Basic Audio States for sync editor
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Custom states for normal player on PlaylistPage
  const [currentPlayTrack, setCurrentPlayTrack] = useState<AudioTrack | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const isLoopingRef = useRef(false);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);
  
  // Audio Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
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

  // Load playlists from DB
  const loadPlaylists = async () => {
    try {
      const allPlaylists = await db.playlists.orderBy('createdAt').toArray();
      setPlaylists(allPlaylists);
      
      const urls: Record<string, string> = {};
      allPlaylists.forEach(pl => {
        if (pl.coverImage) {
          urls[pl.id] = URL.createObjectURL(pl.coverImage);
        }
      });
      
      Object.values(playlistCoverUrls).forEach(url => URL.revokeObjectURL(url));
      setPlaylistCoverUrls(urls);

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

  useEffect(() => {
    if (selectedPlaylist) {
      loadTracks(selectedPlaylist.id);
    } else {
      setTracks([]);
    }
  }, [selectedPlaylist]);

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
    if (activeAudioUrl) {
      URL.revokeObjectURL(activeAudioUrl);
      setActiveAudioUrl('');
    }
    setIsPlaying(false);
  };

  const handleNextTrack = () => {
    if (!currentPlayTrack) return;
    const index = tracks.findIndex(t => t.id === currentPlayTrack.id);
    if (index === -1) return;
    const nextIndex = (index + 1) % tracks.length;
    handlePlayTrack(tracks[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (!currentPlayTrack) return;
    const index = tracks.findIndex(t => t.id === currentPlayTrack.id);
    if (index === -1) return;
    const prevIndex = (index - 1 + tracks.length) % tracks.length;
    handlePlayTrack(tracks[prevIndex]);
  };

  const handlePlayTrack = (track: AudioTrack) => {
    cleanupAudio();
    setCurrentPlayTrack(track);
    try {
      const url = URL.createObjectURL(track.audioFile);
      setActiveAudioUrl(url);

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      setIsPlaying(true);

      audio.play().catch((err) => {
        if (err?.name === 'AbortError') return;
        console.error('Play error:', err);
        toast.error('Não foi possível reproduzir este áudio.');
        setIsPlaying(false);
      });

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.onended = () => {
        if (isLoopingRef.current) {
          audio.currentTime = 0;
          audio.play().catch(e => console.warn(e));
          return;
        }
        // Auto play next track in playlist page
        const index = tracks.findIndex(t => t.id === track.id);
        if (index !== -1 && index + 1 < tracks.length) {
          handlePlayTrack(tracks[index + 1]);
        } else {
          setIsPlaying(false);
        }
      };

      progressIntervalRef.current = window.setInterval(() => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
        }
      }, 100);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao inicializar áudio.');
    }
  };





  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    try {
      const newPl: Playlist = {
        id: crypto.randomUUID(),
        name: playlistName.trim(),
        description: playlistDesc.trim() || undefined,
        coverImage: playlistCoverFile || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.playlists.add(newPl);
      toast.success('Álbum criado com sucesso!');
      setIsNewPlaylistOpen(false);
      setPlaylistName('');
      setPlaylistDesc('');
      setPlaylistCoverFile(null);
      loadPlaylists();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar álbum.');
    }
  };

  const handleDeletePlaylist = async (pl: Playlist, e: React.MouseEvent) => {
    e.stopPropagation();
    openConfirm(
      'Excluir Álbum?',
      `Tem certeza que deseja excluir o álbum "${pl.name}"? Todos os áudios e letras dele serão apagados permanentemente.`,
      async () => {
        try {
          await db.playlists.delete(pl.id);
          const albumTracks = await db.audioTracks.where('playlistId').equals(pl.id).toArray();
          for (const track of albumTracks) {
            await db.audioTracks.delete(track.id);
          }
          toast.success('Álbum e faixas excluídos com sucesso.');
          if (selectedPlaylist?.id === pl.id) {
            setSelectedPlaylist(null);
          }
          loadPlaylists();
        } catch (err) {
          console.error(err);
          toast.error('Erro ao excluir álbum.');
        } finally {
          closeConfirm();
        }
      }
    );
  };

  const handleUploadTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaylist) {
      toast.error('Selecione ou crie um álbum primeiro.');
      return;
    }
    if (!newTrackTitle.trim() || !newTrackFile) {
      toast.error('Forneça um título e o arquivo de áudio.');
      return;
    }

    try {
      setIsUploading(true);
      const newTrack: AudioTrack = {
        id: crypto.randomUUID(),
        playlistId: selectedPlaylist.id,
        title: newTrackTitle.trim(),
        description: newTrackDesc.trim() || undefined,
        audioFile: newTrackFile,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.audioTracks.add(newTrack);
      toast.success('Áudio adicionado com sucesso!');
      setIsUploadOpen(false);
      setNewTrackTitle('');
      setNewTrackDesc('');
      setNewFile(null);
      loadTracks(selectedPlaylist.id);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao fazer upload do arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteTrack = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openConfirm(
      'Excluir Faixa?',
      'Tem certeza que deseja excluir este áudio permanentemente? As letras sincronizadas também serão apagadas.',
      async () => {
        try {
          await db.audioTracks.delete(trackId);
          toast.success('Faixa excluída com sucesso.');
          if (currentPlayTrack?.id === trackId) {
            cleanupAudio();
            setCurrentPlayTrack(null);
          }
          if (selectedPlaylist) {
            loadTracks(selectedPlaylist.id);
          }
        } catch (err) {
          console.error(err);
          toast.error('Erro ao excluir faixa.');
        } finally {
          closeConfirm();
        }
      }
    );
  };

  const handleOpenTrackSettings = (track: AudioTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTrack(track);
    setEditTitle(track.title);
    setEditDesc(track.description || '');
    setEditRepeatTimes(track.repeatTimes ?? 1);
    setIsEditOpen(true);
  };

  const handleSaveTrackSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTrack) return;

    try {
      await db.audioTracks.update(editTrack.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        repeatTimes: editRepeatTimes,
        updatedAt: Date.now()
      });
      toast.success('Configurações da faixa salvas com sucesso!');
      setIsEditOpen(false);
      setEditTrack(null);
      if (selectedPlaylist) {
        loadTracks(selectedPlaylist.id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configurações.');
    }
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



  return (
    <div className="space-y-6 w-full px-4 md:px-8 py-4 relative flex flex-col min-h-[calc(100vh-100px)]">
      {/* Glow Decorativo de fundo */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm shadow-primary/5">
              <Settings2 size={24} />
            </div> 
            Gerenciar Playlists e Letras
          </h2>
          <p className="text-xs text-muted-foreground font-semibold leading-relaxed max-w-2xl">
            Crie álbuns, gerencie seus arquivos de áudio e use inteligência artificial para transcrever e sincronizar as letras para cantar no Karaokê.
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

      {/* Layout de 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch flex-1 min-h-0 w-full">
        
        {/* COLUNA 1: Lista de Álbuns (1 Coluna) */}
        <div className="lg:col-span-1 space-y-4 flex flex-col h-full lg:sticky lg:top-4 lg:self-start">
          <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-xl flex flex-col flex-1 h-full min-h-[495px]">
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
                        {coverSrc ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-border/40 shadow-sm relative">
                            <img src={coverSrc} alt={pl.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-full shrink-0 bg-gradient-to-br flex items-center justify-center text-[10px] text-zinc-50 font-black shadow-inner border-2 relative transition-all duration-300 border-transparent ${getGradientFromTitle(pl.name)}`}>
                            {pl.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        
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

        {/* COLUNA 2: Lista de Faixas do Álbum Ativo (3 Colunas) */}
        <div className="lg:col-span-3 space-y-4 flex flex-col h-full">
          <ShadcnCard className="bg-card/40 backdrop-blur-md border border-border/50 p-5 rounded-2xl shadow-xl flex flex-col flex-1 h-full min-h-[495px]">
                {selectedPlaylist ? (
                  <>
                    <div className="flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
                      <div className="flex items-center gap-3">
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
                          const isPlayingThis = currentPlayTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              onClick={() => handlePlayTrack(track)}
                              className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 group border border-transparent hover:bg-muted/30 cursor-pointer ${
                                isPlayingThis ? 'bg-primary/5 border-primary/20 shadow-sm' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                  isPlayingThis 
                                    ? 'bg-primary text-primary-foreground border-primary' 
                                    : 'bg-muted/50 text-muted-foreground border-border/40'
                                }`}>
                                  {isPlayingThis && isPlaying ? (
                                    <div className="flex gap-0.5 items-end justify-center h-2.5">
                                      <div className="w-0.5 bg-current animate-bounce h-2" style={{ animationDelay: '0.1s' }} />
                                      <div className="w-0.5 bg-current animate-bounce h-3" style={{ animationDelay: '0.3s' }} />
                                      <div className="w-0.5 bg-current animate-bounce h-1.5" style={{ animationDelay: '0.5s' }} />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold truncate text-foreground">
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
                                        title="Instrumental sem voz processado por IA"
                                      >
                                        <Sparkles size={7} />
                                        IA
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                {(track.repeatTimes ?? 1) !== 1 && (
                                  <span className="text-[8px] font-black text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <Repeat size={7} />
                                    {track.repeatTimes === 0 ? '∞' : `${track.repeatTimes}×`}
                                  </span>
                                )}

                                <span className="text-[8px] font-mono font-bold text-muted-foreground bg-muted/60 border border-border/40 px-2 py-0.5 rounded-lg hidden sm:inline-block">
                                  {(track.audioFile.size / (1024 * 1024)).toFixed(1)} MB
                                </span>
                                
                                {/* Cantar no Estúdio (Se tiver transcrição) */}
                                {track.transcriptionLines && track.transcriptionLines.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onPlayTrackInKaraoke?.(track.id); }}
                                    className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="Praticar / Cantar no Karaokê 🎤"
                                  >
                                    <Mic size={12} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => handleOpenTrackSettings(track, e)}
                                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Configurações"
                                >
                                  <Settings2 size={12} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteTrack(track.id, e)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Excluir"
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
          </div>
      </div>

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
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPlaylistCoverFile(e.target.files?.[0] || null)}
                  className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold flex-1 pt-2"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsNewPlaylistOpen(false)}
                className="hover:bg-muted text-foreground font-bold rounded-xl text-xs h-10 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl text-xs h-10 px-5 cursor-pointer shadow-lg shadow-primary/15"
              >
                Criar Álbum
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Upload Áudio */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Music size={16} />
              </div>
              Upload de Áudio para o Álbum
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Selecione um arquivo de áudio (MP3 ou WAV) e atribua um título.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadTrack} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Álbum Selecionado
              </label>
              <Input
                type="text"
                disabled
                value={selectedPlaylist?.name || ''}
                className="bg-muted/30 border-transparent text-muted-foreground rounded-xl h-10 text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Título da Faixa *
              </label>
              <Input
                type="text"
                required
                placeholder="Ex: Diálogo 01 - Apresentações"
                value={newTrackTitle}
                onChange={(e) => setNewTrackTitle(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Descrição Opcional
              </label>
              <Input
                type="text"
                placeholder="Ex: Treino de escuta passiva"
                value={newTrackDesc}
                onChange={(e) => setNewTrackDesc(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Arquivo de Áudio *
              </label>
              <Input
                type="file"
                accept="audio/*"
                required
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold pt-2"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsUploadOpen(false)}
                className="hover:bg-muted text-foreground font-bold rounded-xl text-xs h-10 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isUploading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl text-xs h-10 px-5 cursor-pointer shadow-lg shadow-primary/15 flex items-center gap-1.5"
              >
                {isUploading ? <RefreshCw size={12} className="animate-spin" /> : null}
                {isUploading ? 'Salvando...' : 'Adicionar Faixa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Editar Faixa */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Settings2 size={16} />
              </div>
              Configurações da Faixa
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Edite as metadados e comportamento de repetição da faixa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTrackSettings} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Título da Faixa *
              </label>
              <Input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Descrição Curta
              </label>
              <Input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">
                Repetir Faixa (SRS)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editRepeatTimes}
                  onChange={(e) => setEditRepeatTimes(parseInt(e.target.value) || 1)}
                  className="bg-muted/40 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary rounded-xl h-10 transition-all text-xs font-semibold"
                />
                <span className="text-[10px] text-muted-foreground leading-normal self-center font-semibold">
                  0 = Infinito (loop)<br />
                  1 = Toca uma vez (padrão)
                </span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setIsEditOpen(false); setEditTrack(null); }}
                className="hover:bg-muted text-foreground font-bold rounded-xl text-xs h-10 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl text-xs h-10 px-5 cursor-pointer shadow-lg shadow-primary/15"
              >
                Salvar Configurações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmModal.open} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border text-foreground p-5 rounded-2xl shadow-2xl select-none animate-scaleUp">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-foreground">
              {confirmModal.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold pt-1 leading-relaxed">
              {confirmModal.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 gap-2 flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={closeConfirm}
              className="hover:bg-muted text-foreground font-bold rounded-xl text-xs h-9 cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmModal.onConfirm}
              className="bg-destructive hover:bg-destructive/90 text-white font-extrabold rounded-xl text-xs h-9 px-4 cursor-pointer shadow-md shadow-destructive/15"
            >
              {confirmModal.confirmLabel || 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Bottom Fixed Player Bar */}
      {currentPlayTrack && (
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
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setProgress(val);
                  if (audioRef.current) {
                    audioRef.current.currentTime = val;
                  }
                }}
                disabled={!currentPlayTrack}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
              {/* Left Side: Track details */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {(() => {
                  const coverSrc = selectedPlaylist ? playlistCoverUrls[selectedPlaylist.id] : null;
                  return coverSrc ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/40 shadow-sm hidden sm:block">
                      <img src={coverSrc} alt={currentPlayTrack.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg shrink-0 bg-muted/60 border border-border/30 flex items-center justify-center text-muted-foreground hidden sm:flex">
                      <Music size={16} />
                    </div>
                  );
                })()}

                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold text-foreground truncate">
                    {currentPlayTrack.title}
                  </p>
                  {currentPlayTrack.description && (
                    <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">
                      {currentPlayTrack.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Side: Player controls */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <p className="text-[10px] text-muted-foreground font-mono tabular-nums hidden md:block">
                  {(() => {
                    const format = (seconds: number) => {
                      if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
                      const m = Math.floor(seconds / 60);
                      const s = Math.floor(seconds % 60);
                      return `${m}:${String(s).padStart(2, '0')}`;
                    };
                    return `${format(progress)} / ${format(duration)}`;
                  })()}
                </p>

                <div className="flex items-center bg-muted/40 border border-border/30 rounded-xl p-0.5 gap-0.5 hidden sm:flex">
                  <button
                    type="button"
                    onClick={() => setIsLooping(!isLooping)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      isLooping
                        ? 'bg-amber-500/15 border border-amber-500/35 text-amber-600 dark:text-amber-400 font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title={isLooping ? 'Desativar repetição' : 'Repetir faixa continuamente'}
                  >
                    Repetir
                  </button>

                  <div className="w-px h-3 bg-border/40" />

                  <button
                    type="button"
                    onClick={() => {
                      const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                      const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                      setPlaybackSpeed(next);
                      if (audioRef.current) {
                        audioRef.current.playbackRate = next;
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Velocidade de reprodução"
                  >
                    {playbackSpeed}×
                  </button>
                </div>

                <div className="flex items-center gap-1">
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
                    title="Próxima Faixa"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 4 15 12 5 20 5 4"/>
                      <line x1="19" y1="5" x2="19" y2="19"/>
                    </svg>
                  </button>

                  <div className="w-px h-4 bg-border/40 mx-1 hidden sm:block" />

                  <button
                    type="button"
                    onClick={() => {
                      cleanupAudio();
                      setCurrentPlayTrack(null);
                    }}
                    className="w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-all cursor-pointer shrink-0"
                    title="Fechar Player"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
