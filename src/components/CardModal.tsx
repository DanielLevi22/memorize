import React, { useState, useEffect, useRef } from 'react';
import type { Card } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Volume2, Trash2, Mic, Sparkles, Loader2 } from 'lucide-react';

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (front: string, back: string, context: string, audioBlob: Blob | null, tags: string[]) => void;
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
  const [tags, setTags] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Speech to Text States
  const [isListeningFront, setIsListeningFront] = useState(false);
  const [isListeningBack, setIsListeningBack] = useState(false);
  const [isListeningContext, setIsListeningContext] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  const [isGeneratingTts, setIsGeneratingTts] = useState(false);

  useEffect(() => {
    if (cardToEdit) {
      setFront(cardToEdit.front);
      setBack(cardToEdit.back);
      setContext(cardToEdit.context);
      setAudioBlob(cardToEdit.audio || null);
      setAudioFileName(cardToEdit.audio ? 'Áudio gravado' : '');
      setTags(cardToEdit.tags ? cardToEdit.tags.join(', ') : '');
    } else {
      setFront('');
      setBack('');
      setContext('');
      setAudioBlob(null);
      setAudioFileName('');
      setTags('');
    }
  }, [cardToEdit, isOpen]);

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
      recognitionRef.current = null;
    }
    setIsListeningFront(false);
    setIsListeningBack(false);
    setIsListeningContext(false);
  };

  const stopAllVoiceActivities = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingPreview(false);
    }
    stopSpeechRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error("Error stopping MediaRecorder:", e);
      }
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopAllVoiceActivities();
      setShowRecorder(false);
    }
    return () => {
      stopAllVoiceActivities();
    };
  }, [isOpen]);

  const startSpeechRecognition = (
    lang: string,
    setValue: React.Dispatch<React.SetStateAction<string>>,
    setIsListening: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Reconhecimento de voz não é suportado neste navegador. Tente usar o Google Chrome ou Microsoft Edge.");
      return;
    }

    stopAllVoiceActivities();

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        if (resultText) {
          setValue(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${resultText}` : resultText;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setIsListening(false);
    }
  };

  const startRecording = async () => {
    stopAllVoiceActivities();
    audioChunksRef.current = [];
    setRecordDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/mp4' };
        if (!MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: '' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        
        setAudioBlob(blob);
        setAudioFileName(`Pronúncia Gravada.${extension}`);
        
        stream.getTracks().forEach(track => track.stop());
        
        setIsRecording(false);
        setShowRecorder(false);
        
        if (recordingIntervalRef.current) {
          window.clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Erro ao acessar o microfone. Verifique se deu permissão de uso ao navegador.");
      setIsRecording(false);
      setShowRecorder(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          const stream = mediaRecorderRef.current.stream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }
        setIsRecording(false);
        setShowRecorder(false);
        if (recordingIntervalRef.current) {
          window.clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
      setShowRecorder(false);
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const generateTtsAudio = async (text: string) => {
    if (!text.trim()) {
      alert("Por favor, digite o termo na Frente antes de gerar o áudio.");
      return;
    }

    setIsGeneratingTts(true);
    try {
      const safeText = text.trim().substring(0, 200);
      const encodedText = encodeURIComponent(safeText);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodedText}`;
      
      let response;
      try {
        response = await fetch(`https://corsproxy.io/?${encodeURIComponent(ttsUrl)}`);
        if (!response.ok) throw new Error("corsproxy.io failed");
      } catch (e) {
        console.warn("corsproxy.io failed, trying allorigins...", e);
        response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(ttsUrl)}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch audio from TTS API. Status: ${response.status}`);
      }

      const blob = await response.blob();
      
      if (blob.type.includes("html") || blob.size < 500) {
        throw new Error("O proxy retornou uma página HTML ou áudio inválido.");
      }

      setAudioBlob(blob);
      setAudioFileName(`Pronúncia Gerada (TTS).mp3`);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingPreview(false);
      
    } catch (error) {
      console.error("Error generating TTS audio:", error);
      alert("Erro ao gerar áudio por Text-to-Speech. Verifique sua conexão ou tente gravar a voz manualmente.");
    } finally {
      setIsGeneratingTts(false);
    }
  };

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
    
    const parsedTags = tags.split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    onSave(front.trim(), back.trim(), context.trim(), audioBlob, parsedTags);
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
            <div className="flex gap-1.5 items-center">
              <Input
                id="card-front"
                type="text"
                className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary flex-1"
                placeholder="Ex: Get over"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                required
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`h-9 w-9 border-border shrink-0 cursor-pointer transition-all ${
                  isListeningFront 
                    ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-2 ring-destructive/30' 
                    : 'bg-muted/20 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (isListeningFront) {
                    stopSpeechRecognition();
                  } else {
                    startSpeechRecognition('en-US', setFront, setIsListeningFront);
                  }
                }}
                title={isListeningFront ? 'Parar digitação' : 'Digitar por voz (Inglês)'}
              >
                <Mic size={16} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="card-back">
              Verso (Tradução/Significado) *
            </label>
            <div className="flex gap-1.5 items-center">
              <Input
                id="card-back"
                type="text"
                className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary flex-1"
                placeholder="Ex: Superar / Recuperar-se"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`h-9 w-9 border-border shrink-0 cursor-pointer transition-all ${
                  isListeningBack 
                    ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-2 ring-destructive/30' 
                    : 'bg-muted/20 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (isListeningBack) {
                    stopSpeechRecognition();
                  } else {
                    startSpeechRecognition('pt-BR', setBack, setIsListeningBack);
                  }
                }}
                title={isListeningBack ? 'Parar digitação' : 'Digitar por voz (Português)'}
              >
                <Mic size={16} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="card-context">
              Frase de Exemplo (Contexto)
            </label>
            <div className="flex gap-1.5 items-start">
              <Textarea
                id="card-context"
                className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary min-h-[80px] flex-1"
                placeholder="Ex: It took her a long time to get over her illness."
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`h-9 w-9 border-border shrink-0 cursor-pointer transition-all ${
                  isListeningContext 
                    ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-2 ring-destructive/30' 
                    : 'bg-muted/20 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (isListeningContext) {
                    stopSpeechRecognition();
                  } else {
                    startSpeechRecognition('en-US', setContext, setIsListeningContext);
                  }
                }}
                title={isListeningContext ? 'Parar digitação' : 'Digitar por voz (Inglês)'}
              >
                <Mic size={16} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="card-tags">
              Etiquetas / Tags (separadas por vírgula)
            </label>
            <Input
              id="card-tags"
              type="text"
              className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary"
              placeholder="Ex: verbos, essenciais, viagem"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
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
            ) : showRecorder ? (
              <div className="flex flex-col items-center justify-center p-4 border border-destructive/20 rounded-xl bg-destructive/5 text-center transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-destructive/10 text-destructive mb-2 animate-pulse ring-4 ring-destructive/20">
                  <Mic size={20} />
                </div>
                <span className="text-xs font-semibold text-foreground">Gravando voz...</span>
                <span className="text-base font-mono text-destructive mt-1 font-bold">
                  {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                </span>
                <div className="flex items-center gap-2 mt-4 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs h-8 font-semibold"
                    onClick={cancelRecording}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-destructive hover:bg-destructive/90 text-white cursor-pointer text-xs h-8 font-semibold"
                    onClick={stopRecording}
                  >
                    Parar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                <label 
                  htmlFor="audio-upload" 
                  className="flex flex-col items-center justify-center p-3 border border-border border-dashed rounded-xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-muted-foreground hover:text-foreground text-center h-[90px]"
                >
                  <Volume2 size={18} className="mb-1 text-muted-foreground/80 shrink-0" />
                  <span className="text-[11px] font-bold leading-tight">Upload Áudio</span>
                  <span className="text-[8px] opacity-70 mt-0.5 leading-none">Arquivo local</span>
                </label>
                <input 
                  id="audio-upload"
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  onChange={handleAudioChange} 
                />

                <button 
                  type="button"
                  onClick={() => {
                    setShowRecorder(true);
                    startRecording();
                  }}
                  className="flex flex-col items-center justify-center p-3 border border-border border-dashed rounded-xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-muted-foreground hover:text-foreground text-center h-[90px]"
                >
                  <Mic size={18} className="mb-1 text-muted-foreground/80 shrink-0" />
                  <span className="text-[11px] font-bold leading-tight">Gravar Voz</span>
                  <span className="text-[8px] opacity-70 mt-0.5 leading-none">Microfone</span>
                </button>

                <button 
                  type="button"
                  onClick={() => generateTtsAudio(front)}
                  disabled={isGeneratingTts || !front.trim()}
                  className="flex flex-col items-center justify-center p-3 border border-border border-dashed rounded-xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-muted-foreground hover:text-foreground text-center h-[90px] disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!front.trim() ? "Digite o termo na Frente primeiro" : "Gerar pronúncia automaticamente"}
                >
                  {isGeneratingTts ? (
                    <>
                      <Loader2 size={18} className="mb-1 text-primary animate-spin shrink-0" />
                      <span className="text-[11px] font-bold leading-tight">Gerando...</span>
                      <span className="text-[8px] opacity-70 mt-0.5 leading-none">Carregando</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="mb-1 text-muted-foreground/80 shrink-0" />
                      <span className="text-[11px] font-bold leading-tight">Gerar TTS</span>
                      <span className="text-[8px] opacity-70 mt-0.5 leading-none">Voz da Frente</span>
                    </>
                  )}
                </button>
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
              disabled={!front.trim() || !back.trim() || isRecording || isListeningFront || isListeningBack || isListeningContext || isGeneratingTts}
            >
              {cardToEdit ? 'Salvar' : 'Criar Cartão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
