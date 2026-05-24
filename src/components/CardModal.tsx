import React, { useState, useEffect, useRef } from 'react';
import type { Card } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Volume2, Trash2 } from 'lucide-react';

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (front: string, back: string, context: string, audioBlob?: Blob | null) => void;
  cardToEdit?: Card | null;
  deckName: string;
}

export const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  onSave,
  cardToEdit,
  deckName
}) => {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [context, setContext] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (cardToEdit) {
      setFront(cardToEdit.front);
      setBack(cardToEdit.back);
      setContext(cardToEdit.context);
      setAudioBlob(cardToEdit.audio || null);
      setAudioFileName(cardToEdit.audio ? 'Áudio gravado' : '');
    } else {
      setFront('');
      setBack('');
      setContext('');
      setAudioBlob(null);
      setAudioFileName('');
    }
  }, [cardToEdit, isOpen]);

  useEffect(() => {
    // Parar áudio quando o modal fecha ou desmonta
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingPreview(false);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen]);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      setAudioFileName(file.name);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingPreview(false);
    }
  };

  const playPreview = () => {
    if (!audioBlob) return;
    try {
      // Se já estiver tocando, pausa o áudio de teste
      if (isPlayingPreview && audioRef.current) {
        audioRef.current.pause();
        setIsPlayingPreview(false);
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlayingPreview(true);
      audio.play().catch(err => {
        console.error("Erro ao tocar áudio:", err);
        setIsPlayingPreview(false);
      });
      audio.onended = () => {
        setIsPlayingPreview(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
    } catch (e) {
      console.error(e);
      setIsPlayingPreview(false);
    }
  };

  const removeAudio = () => {
    setAudioBlob(null);
    setAudioFileName('');
    setIsPlayingPreview(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    onSave(front.trim(), back.trim(), context.trim(), audioBlob);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-xs sm:max-w-md rounded-lg">
        <DialogHeader>
          <div>
            <DialogTitle className="font-semibold text-lg text-foreground flex items-center gap-2">
              {cardToEdit ? '✏️ Editar Cartão' : '📇 Novo Cartão'}
            </DialogTitle>
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider block mt-1">
              Deck: {deckName.replace(/[^a-zA-Z0-9\s]/g, '').trim()}
            </span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="card-front">
              Frente (Termo em Inglês) *
            </label>
            <Input
              id="card-front"
              type="text"
              className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary"
              placeholder="Ex: Get over"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="card-back">
              Verso (Tradução/Significado) *
            </label>
            <Input
              id="card-back"
              type="text"
              className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary"
              placeholder="Ex: Superar / Recuperar-se"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="card-context">
              Frase de Exemplo (Contexto)
            </label>
            <Textarea
              id="card-context"
              className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary min-h-[80px]"
              placeholder="Ex: It took her a long time to get over her illness."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Áudio de Pronúncia (Opcional)
            </label>
            
            {audioBlob ? (
              <div className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <Volume2 size={16} className="text-primary shrink-0 animate-pulse" />
                  <span className="text-xs font-medium text-foreground truncate">{audioFileName}</span>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                    onClick={playPreview}
                  >
                    {isPlayingPreview ? 'Tocando...' : 'Ouvir'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                    onClick={removeAudio}
                    title="Remover áudio"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <label 
                  htmlFor="audio-upload" 
                  className="flex flex-col items-center justify-center p-4 border border-border border-dashed rounded-xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-muted-foreground hover:text-foreground text-center"
                >
                  <Volume2 size={24} className="mb-1 text-muted-foreground/80" />
                  <span className="text-xs font-bold">Adicionar Áudio</span>
                  <span className="text-[10px] opacity-70 mt-0.5">Selecione um arquivo de áudio curto (.mp3, .wav)</span>
                </label>
                <input 
                  id="audio-upload"
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  onChange={handleAudioChange} 
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row gap-2 mt-4 sm:justify-end">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1 sm:flex-initial border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer disabled:opacity-50"
              disabled={!front.trim() || !back.trim()}
            >
              {cardToEdit ? 'Salvar' : 'Criar Cartão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
