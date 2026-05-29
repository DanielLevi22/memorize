import React, { useState, useEffect, useRef } from 'react';
import type { Card } from '../types';
import { db } from '../db/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Volume2, Trash2, Mic, Sparkles, Loader2 } from 'lucide-react';
import { getTagColors } from '../utils/tagColors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    type: 'basic' | 'reversed' | 'optional_reversed' | 'typing' | 'cloze' | 'listening',
    fields: string[],
    context: string,
    audioBlob: Blob | null,
    tags: string[]
  ) => void;
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
  const [noteType, setNoteType] = useState<'basic' | 'reversed' | 'optional_reversed' | 'typing' | 'cloze' | 'listening'>('basic');
  const [fields, setFields] = useState<string[]>(['', '', '']);
  const [context, setContext] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper setters for fields
  const setField0 = (valOrFn: string | ((prev: string) => string)) => {
    setFields(prev => {
      const next = [...prev];
      next[0] = typeof valOrFn === 'function' ? valOrFn(next[0]) : valOrFn;
      return next;
    });
  };

  const setField1 = (valOrFn: string | ((prev: string) => string)) => {
    setFields(prev => {
      const next = [...prev];
      next[1] = typeof valOrFn === 'function' ? valOrFn(next[1]) : valOrFn;
      return next;
    });
  };

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
    const loadNoteData = async () => {
      if (cardToEdit && isOpen) {
        const note = await db.notes.get(cardToEdit.noteId);
        if (note) {
          setNoteType(note.type);
          const f = [...note.fields];
          while (f.length < 3) f.push('');
          setFields(f);
          setContext(note.context || '');
          setAudioBlob(note.audio || null);
          setAudioFileName(note.audio ? 'Áudio gravado' : '');
          setTagList(note.tags || []);
        } else {
          // Fallback if note not found
          setNoteType('basic');
          setFields([cardToEdit.front || '', cardToEdit.back || '', '']);
          setContext(cardToEdit.context || '');
          setAudioBlob(cardToEdit.audio || null);
          setAudioFileName(cardToEdit.audio ? 'Áudio gravado' : '');
          setTagList(cardToEdit.tags || []);
        }
      } else {
        setNoteType('basic');
        setFields(['', '', '']);
        setContext('');
        setAudioBlob(null);
        setAudioFileName('');
        setTagList([]);
      }
      setTagInput('');

      // Load all available tags
      if (isOpen) {
        try {
          const notes = await db.notes.toArray();
          const tagsSet = new Set<string>();
          notes.forEach(n => {
            if (n.tags) n.tags.forEach(t => tagsSet.add(t));
          });
          setAvailableTags(Array.from(tagsSet).sort());
        } catch (e) {
          console.error("Failed to load available tags", e);
        }
      }
    };

    loadNoteData();
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
    if (!fields[0].trim() || (noteType !== 'cloze' && !fields[1].trim())) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    let allTags = [...tagList];
    if (tagInput.trim()) {
      const pending = tagInput.trim().replace(/,/g, '').toLowerCase();
      if (pending && !allTags.includes(pending)) {
        allTags.push(pending);
      }
    }

    const cleanTags = allTags
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    onSave(noteType, fields, context.trim(), audioBlob, cleanTags);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-border/50 text-foreground max-w-xs sm:max-w-lg rounded-2xl shadow-2xl shadow-primary/5 p-6 overflow-hidden">
        <DialogHeader className="mb-2">
          <div className="flex flex-col gap-2 items-start">
            <span className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              Deck: {deckName.replace(/[^a-zA-Z0-9\s]/g, '').trim()}
            </span>
            <DialogTitle className="font-bold text-xl text-foreground flex items-center gap-2">
              {cardToEdit ? '✏️ Editar Nota' : '📇 Nova Nota'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
          {/* Seletor de Tipo de Nota */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground/80 tracking-wide" htmlFor="note-type">
              Tipo de Nota (Note Type)
            </label>
            <Select value={noteType} onValueChange={(val: any) => setNoteType(val)}>
              <SelectTrigger id="note-type" className="bg-muted/30 border-transparent hover:border-border text-foreground px-3 py-5 rounded-xl text-sm font-semibold focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all duration-200">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50 shadow-xl">
                <SelectItem value="basic" className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary py-2.5">Básico</SelectItem>
                <SelectItem value="reversed" className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary py-2.5">Básico (e cartão invertido)</SelectItem>
                <SelectItem value="optional_reversed" className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary py-2.5">Básico (cartão invertido opcional)</SelectItem>
                <SelectItem value="typing" className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary py-2.5">Básico (digite a resposta)</SelectItem>
                <SelectItem value="cloze" className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary py-2.5">Omissão de Palavras (Cloze)</SelectItem>
                <SelectItem value="listening" className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary py-2.5">Prática de Audição (Listening)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
              {noteType === 'basic' && "Cartão simples. Você vê a frente e tenta lembrar o verso."}
              {noteType === 'reversed' && "Cria 2 cartões. Um normal (Frente ➔ Verso) e outro invertido (Verso ➔ Frente)."}
              {noteType === 'optional_reversed' && "Cria um cartão normal, e permite criar um reverso apenas se preencher o 3º campo."}
              {noteType === 'typing' && "Você vê a frente e precisa digitar exatamente o texto do verso."}
              {noteType === 'cloze' && "Oculta partes do texto marcadas com {{c1::palavra}} para você adivinhar."}
              {noteType === 'listening' && "Oculta o texto inicial, toca o áudio, e revela a resposta só após você responder."}
            </p>
          </div>

          {/* Campo 1: Frente / Texto Cloze */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground/80 tracking-wide" htmlFor="card-front">
              {noteType === 'cloze' ? 'Texto (com clozes) *' : 'Frente (Termo em Inglês) *'}
            </label>
            <div className="flex gap-1.5 items-center">
              {noteType === 'cloze' ? (
                <Textarea
                  id="card-front"
                  className="bg-muted/30 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary flex-1 min-h-[60px] transition-all duration-200 rounded-xl"
                  placeholder="Ex: The {{c1::apple::maçã}} is {{c2::red}}."
                  value={fields[0]}
                  onChange={(e) => setFields([e.target.value, fields[1], fields[2]])}
                  required
                  autoFocus
                />
              ) : (
                <Input
                  id="card-front"
                  type="text"
                  className="bg-muted/30 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary flex-1 transition-all duration-200 rounded-xl h-10"
                  placeholder="Ex: Get over"
                  value={fields[0]}
                  onChange={(e) => setFields([e.target.value, fields[1], fields[2]])}
                  required
                  autoFocus
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`h-10 w-10 rounded-xl shrink-0 cursor-pointer transition-all duration-200 active:scale-95 ${
                  isListeningFront 
                    ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-2 ring-destructive/30' 
                    : 'bg-muted/30 border-transparent hover:border-border text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (isListeningFront) {
                    stopSpeechRecognition();
                  } else {
                    startSpeechRecognition('en-US', setField0, setIsListeningFront);
                  }
                }}
                title={isListeningFront ? 'Parar digitação' : 'Digitar por voz (Inglês)'}
              >
                <Mic size={16} />
              </Button>
            </div>
          </div>

          {/* Campo 2: Verso / Extra Cloze */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground/80 tracking-wide" htmlFor="card-back">
              {noteType === 'cloze' ? 'Texto Extra (Opcional)' : 'Verso (Tradução/Significado) *'}
            </label>
            <div className="flex gap-1.5 items-center">
              {noteType === 'cloze' ? (
                <Textarea
                  id="card-back"
                  className="bg-muted/30 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary flex-1 min-h-[60px] transition-all duration-200 rounded-xl"
                  placeholder="Ex: Explicações ou contexto adicional revelado no verso."
                  value={fields[1]}
                  onChange={(e) => setFields([fields[0], e.target.value, fields[2]])}
                />
              ) : (
                <Input
                  id="card-back"
                  type="text"
                  className="bg-muted/30 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary flex-1 transition-all duration-200 rounded-xl h-10"
                  placeholder="Ex: Superar / Recuperar-se"
                  value={fields[1]}
                  onChange={(e) => setFields([fields[0], e.target.value, fields[2]])}
                  required
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`h-10 w-10 rounded-xl shrink-0 cursor-pointer transition-all duration-200 active:scale-95 ${
                  isListeningBack 
                    ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-2 ring-destructive/30' 
                    : 'bg-muted/30 border-transparent hover:border-border text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  if (isListeningBack) {
                    stopSpeechRecognition();
                  } else {
                    startSpeechRecognition('pt-BR', setField1, setIsListeningBack);
                  }
                }}
                title={isListeningBack ? 'Parar digitação' : 'Digitar por voz (Português)'}
              >
                <Mic size={16} />
              </Button>
            </div>
          </div>

          {/* Campo 3: Adicionar Invertido (apenas para optional_reversed) */}
          {noteType === 'optional_reversed' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground/80 tracking-wide" htmlFor="card-reverse-trigger">
                Adicionar Invertido (opcional)
              </label>
              <Input
                id="card-reverse-trigger"
                type="text"
                className="bg-muted/30 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary w-full transition-all duration-200 rounded-xl h-10"
                placeholder="Ex: Digite algo (ex: 'y') para gerar o cartão invertido"
                value={fields[2] || ''}
                onChange={(e) => setFields([fields[0], fields[1], e.target.value])}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground/80 tracking-wide" htmlFor="card-context">
              Frase de Exemplo (Contexto)
            </label>
            <div className="flex gap-1.5 items-start">
              <Textarea
                id="card-context"
                className="bg-muted/30 border-transparent hover:border-border text-foreground focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:border-primary min-h-[80px] flex-1 transition-all duration-200 rounded-xl"
                placeholder="Ex: It took her a long time to get over her illness."
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={`h-10 w-10 rounded-xl shrink-0 cursor-pointer transition-all duration-200 active:scale-95 ${
                  isListeningContext 
                    ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-2 ring-destructive/30' 
                    : 'bg-muted/30 border-transparent hover:border-border text-muted-foreground hover:text-foreground'
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

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-medium text-muted-foreground/80 tracking-wide">
              Etiquetas / Tags
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 border border-transparent rounded-xl min-h-[42px] items-center focus-within:bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-200">
              {tagList.map((tag) => {
                const colors = getTagColors(tag);
                return (
                  <span
                    key={tag}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${colors.bg} ${colors.text} ${colors.border}`}
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setTagList(prev => prev.filter(t => t !== tag))}
                      className="hover:text-foreground cursor-pointer text-xs font-black leading-none opacity-60 hover:opacity-100"
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                value={tagInput}
                onFocus={() => setIsTagInputFocused(true)}
                onBlur={() => setTimeout(() => setIsTagInputFocused(false), 200)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(',')) {
                    const parts = val.split(',');
                    const newTags = parts.slice(0, -1)
                      .map(t => t.trim().toLowerCase())
                      .filter(t => t && !tagList.includes(t));
                    
                    if (newTags.length > 0) {
                      setTagList(prev => [...prev, ...newTags]);
                    }
                    setTagInput(parts[parts.length - 1].trimStart());
                  } else {
                    setTagInput(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const clean = tagInput.trim().toLowerCase();
                    if (clean && !tagList.includes(clean)) {
                      setTagList(prev => [...prev, clean]);
                    }
                    setTagInput('');
                  }
                }}
                placeholder={tagList.length === 0 ? "Ex: verbos (pressione Enter)" : "Adicionar..."}
                className="bg-transparent border-none outline-none text-xs text-foreground flex-1 min-w-[100px] py-0.5"
              />
            </div>

            {/* Dropdown de Sugestões de Tags */}
            {isTagInputFocused && availableTags.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                {availableTags
                  .filter(t => !tagList.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()))
                  .map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus:bg-muted focus:outline-none cursor-pointer"
                      onClick={() => {
                        setTagList(prev => [...prev, tag]);
                        setTagInput('');
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                {availableTags.filter(t => !tagList.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic">
                    Nenhuma sugestão. Digite para criar nova etiqueta.
                  </div>
                )}
              </div>
            )}

            <p className="text-[9px] text-muted-foreground">
              Pressione <strong>Enter</strong> ou <strong>vírgula</strong> para adicionar uma tag.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground/80 tracking-wide">
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
                  className="flex flex-col items-center justify-center p-3 border border-border/50 rounded-xl bg-muted/30 hover:bg-muted/60 hover:border-border hover:shadow-sm cursor-pointer transition-all duration-200 active:scale-95 text-muted-foreground hover:text-foreground text-center h-[90px]"
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
                  className="flex flex-col items-center justify-center p-3 border border-border/50 rounded-xl bg-muted/30 hover:bg-muted/60 hover:border-border hover:shadow-sm cursor-pointer transition-all duration-200 active:scale-95 text-muted-foreground hover:text-foreground text-center h-[90px]"
                >
                  <Mic size={18} className="mb-1 text-muted-foreground/80 shrink-0" />
                  <span className="text-[11px] font-bold leading-tight">Gravar Voz</span>
                  <span className="text-[8px] opacity-70 mt-0.5 leading-none">Microfone</span>
                </button>

                <button 
                  type="button"
                  onClick={() => generateTtsAudio(fields[0])}
                  disabled={isGeneratingTts || !fields[0].trim()}
                  className="flex flex-col items-center justify-center p-3 border border-border/50 rounded-xl bg-muted/30 hover:bg-muted/60 hover:border-border hover:shadow-sm cursor-pointer transition-all duration-200 active:scale-95 text-muted-foreground hover:text-foreground text-center h-[90px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-none"
                  title={!fields[0].trim() ? "Digite o termo na Frente primeiro" : "Gerar pronúncia automaticamente"}
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

          <DialogFooter className="flex flex-row gap-2 mt-2 sm:justify-end">
            <Button 
              type="button" 
              variant="outline" 
              className="rounded-xl px-5 transition-all duration-200 active:scale-95 border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="rounded-xl px-6 font-bold shadow-md shadow-primary/20 transition-all duration-200 active:scale-95 flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer disabled:opacity-50"
              disabled={!fields[0].trim() || (noteType !== 'cloze' && !fields[1].trim()) || isRecording || isListeningFront || isListeningBack || isListeningContext || isGeneratingTts}
            >
              {cardToEdit ? 'Salvar Alterações' : 'Criar Cartão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
