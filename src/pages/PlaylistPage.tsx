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
  RotateCcw,
  Image as ImageIcon,
  FolderHeart,
  FolderPlus,
  Info,
  Pencil,
  Settings2
} from 'lucide-react';
import { db } from '../db/db';
import type { Playlist, AudioTrack } from '../types';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

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
  const [newTrackRepeatTimes, setNewTrackRepeatTimes] = useState<number>(1);
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
  };

  // Handle Play Action
  const handlePlayTrack = (track: AudioTrack) => {
    cleanupAudio();

    try {
      const url = URL.createObjectURL(track.audioFile);
      setActiveAudioUrl(url);
      setCurrentTrack(track);

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      setIsPlaying(true);

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
      }, 250);

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
        <div className="lg:col-span-1 space-y-4 flex flex-col h-full">
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

        {/* COLUNA 2: Lista de Faixas do Álbum Ativo (2 Colunas) */}
        <div className="lg:col-span-2 space-y-4 flex flex-col h-full">
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
                              {track.description && (
                                <span className="text-[9px] text-muted-foreground truncate font-semibold mt-0.5">
                                  {track.description}
                                </span>
                              )}
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
        </div>

        {/* COLUNA 3: Tocador de Mídia Integrado (1 Coluna) */}
        <div className="lg:col-span-1 space-y-4 flex flex-col h-full">
          <ShadcnCard className="bg-card/90 border-border/80 p-5 rounded-3xl shadow-2xl flex flex-col items-center justify-between text-center space-y-5 relative overflow-hidden flex-1 h-full min-h-[495px]">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent pointer-events-none" />

            <div className="flex items-center justify-between w-full border-b border-border/40 pb-2 relative z-10">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                Tocador de Mídia
              </h3>
              {currentTrack && (
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${isPlaying ? '' : 'hidden'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 bg-primary ${isPlaying ? '' : 'opacity-40'}`}></span>
                </span>
              )}
            </div>

            {/* Capa de Vinil Grande */}
            <div className="relative flex items-center justify-center w-full z-10 pt-1">
              <div className={`w-32 h-32 rounded-full bg-zinc-950 border-4 border-zinc-800 shadow-2xl flex items-center justify-center transition-all duration-500 relative ring-4 ring-primary/5 ${
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
            <div className="flex items-center justify-center gap-3 w-full relative z-10">
              {/* Loop toggle — compact, left of skip back */}
              <button
                type="button"
                onClick={() => setIsLooping(prev => !prev)}
                disabled={!currentTrack}
                title={isLooping ? 'Desativar loop' : 'Ativar loop (repetir faixa sempre)'}
                className={`p-2 rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 border flex items-center justify-center ${
                  isLooping
                    ? 'bg-primary/15 border-primary/40 text-primary shadow-sm shadow-primary/20'
                    : 'bg-muted/50 hover:bg-muted border-border/40 text-muted-foreground hover:text-primary'
                }`}
              >
                <Repeat size={13} className={isLooping ? 'animate-pulse' : ''} />
              </button>

              <button
                type="button"
                onClick={() => handlePrevTrack()}
                disabled={tracks.length <= 1}
                className="p-2.5 bg-muted/50 hover:bg-muted text-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 border border-border/40 flex items-center justify-center shadow-inner"
                title="Faixa anterior"
              >
                <SkipBack size={15} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={tracks.length === 0}
                className="p-4 bg-primary hover:bg-primary/95 text-primary-foreground rounded-full cursor-pointer shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed border border-primary/20 flex items-center justify-center shrink-0 w-12 h-12"
                title={isPlaying ? 'Pausar' : 'Tocar'}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} className="ml-0.5" fill="currentColor" />}
              </button>

              <button
                type="button"
                onClick={() => handleNextTrack()}
                disabled={tracks.length <= 1}
                className="p-2.5 bg-muted/50 hover:bg-muted text-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 border border-border/40 flex items-center justify-center shadow-inner"
                title="Próxima faixa"
              >
                <SkipForward size={15} />
              </button>

              {/* Reiniciar — compact, right of skip forward */}
              <button
                type="button"
                onClick={() => handleScrub(0)}
                disabled={!currentTrack}
                title="Reiniciar faixa"
                className="p-2 bg-muted/50 hover:bg-muted border border-border/40 text-muted-foreground hover:text-primary rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-30 flex items-center justify-center"
              >
                <RotateCcw size={13} />
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
