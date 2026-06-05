import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, BookOpen, Plus, Trash2, Play, Pause, Square,
  Copy, Check, ChevronRight, FileText, Volume2, HelpCircle,
  Maximize2, Eye, EyeOff, Folder, FolderOpen, FolderPlus, Edit, Upload, Sparkles, Loader2, ExternalLink,
  Mic, Keyboard, Pencil, Film, Tv
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { db } from '../db/db';
import type { ReadingText, ReadingCollection, Note, Card } from '../types';
import { toast } from 'sonner';

interface DraftCard {
  id: string; // Temporary UI id
  originalLineIdx: number;
  field0: string; // Frente ou Cloze
  field1: string; // Verso ou Extra
  field2: string; // Gatilho Inverso (para optional_reversed)
}
import { ReadingImportModal } from '../components/ReadingImportModal';
import { KeyboardShortcutCheatsheet } from '../components/KeyboardShortcutCheatsheet';
import { FloatingSelectionLookup } from '../components/FloatingSelectionLookup';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import { extractTextFromPdf, processTextWithAI, segmentTextManually, segmentAndTranslateWithFreeAPI, translateWithMyMemory } from '../utils/readingProcessor';
import { motion } from 'framer-motion';
import { getWordLevenshteinDistance, diffWords, type DiffWord, getLevenshteinDistance, diffStrings, type DiffChar } from '../utils/srs';
import { syncNoteCards } from '../utils/siblings';

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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

interface ReadingPageProps {
  geminiApiKey: string;
  ttsRate: number;
  ttsVoice: string;
  isZenMode: boolean;
  setIsZenMode: (zen: boolean) => void;
}

export const ReadingPage: React.FC<ReadingPageProps> = ({
  geminiApiKey,
  ttsRate,
  ttsVoice,
  isZenMode,
  setIsZenMode,
}) => {
  const readings = useLiveQuery(() => db.texts.orderBy('createdAt').reverse().filter(t => t.showInReadings !== false).toArray());
  const collections = useLiveQuery(() => db.readingCollections?.orderBy('createdAt').reverse().toArray()) || [];
  const decks = useLiveQuery(() => db.decks.orderBy('name').toArray()) || [];
  
  
  const [selectedTextId, setSelectedTextId] = useState<string | null>(() => {
    return localStorage.getItem('memorize_active_reading_id') || null;
  });

  useEffect(() => {
    if (selectedTextId) {
      localStorage.setItem('memorize_active_reading_id', selectedTextId);
    } else {
      localStorage.removeItem('memorize_active_reading_id');
    }
  }, [selectedTextId]);

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [activeReaderTab, setActiveReaderTab] = useState<'lineByLine' | 'textAudio' | 'vitrine'>('lineByLine');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [copiedLineIdx, setCopiedLineIdx] = useState<number | null>(null);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<'all' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('all');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('all');

  // Compute unique themes from all reading texts
  const availableThemes = React.useMemo(() => {
    const themes = new Set<string>();
    readings?.forEach(r => r.theme && themes.add(r.theme));
    return Array.from(themes).sort();
  }, [readings]);

  // Collection creation states
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [textToDelete, setTextToDelete] = useState<string | null>(null);

  // Reading text editing states
  const [editingReading, setEditingReading] = useState<{ id: string; title: string; description?: string } | null>(null);
  const [editReadingTitle, setEditReadingTitle] = useState('');
  const [editReadingDescription, setEditReadingDescription] = useState('');

  // Collection editing states
  const [editingCollection, setEditingCollection] = useState<ReadingCollection | null>(null);
  const [editCollectionTitle, setEditCollectionTitle] = useState('');
  const [editCollectionDescription, setEditCollectionDescription] = useState('');

  // Collection deletion states
  const [deletingCollection, setDeletingCollection] = useState<ReadingCollection | null>(null);
  const [associatedReadingsCount, setAssociatedReadingsCount] = useState<number>(0);

  // Inside-text editor/importer states for empty lessons
  // Append sentence states
  const [appendOriginal, setAppendOriginal] = useState('');
  const [appendTranslated, setAppendTranslated] = useState('');
  const [isAppending, setIsAppending] = useState(false);

  // Append Block (PDF / Text / IA) states
  const [isAppendBlockModalOpen, setIsAppendBlockModalOpen] = useState(false);
  const [appendBlockOriginalText, setAppendBlockOriginalText] = useState('');
  const [appendBlockTranslatedText, setAppendBlockTranslatedText] = useState('');
  const [appendBlockMode, setAppendBlockMode] = useState<'manual' | 'gemini' | 'mymemory'>(() => {
    const key = localStorage.getItem('memorize_gemini_api_key') || '';
    return key.trim() ? 'gemini' : 'mymemory';
  });
  const [appendBlockIsProcessing, setAppendBlockIsProcessing] = useState(false);
  const [appendBlockProcessingStep, setAppendBlockProcessingStep] = useState('');
  const [appendBlockErrorMsg, setAppendBlockErrorMsg] = useState('');
  const [appendBlockPdfBlob, setAppendBlockPdfBlob] = useState<Blob | null>(null);
  const [appendBlockIsPdfLoading, setAppendBlockIsPdfLoading] = useState(false);

  // Suggested Title states
  const [, setPdfSuggestedTitle] = useState<string | null>(null);
  const [pdfSuggestedTitleInput, setPdfSuggestedTitleInput] = useState('');
  const [isTitleSuggestionModalOpen, setIsTitleSuggestionModalOpen] = useState(false);

  // Selection phonetic lookup states
  const readerContainerRef = useRef<HTMLDivElement>(null);
  const isClickingTooltip = useRef(false);
  const [lookupText, setLookupText] = useState('');
  const [lookupPosition, setLookupPosition] = useState({ top: 0, left: 0 });
  const [isLookupVisible, setIsLookupVisible] = useState(false);

  // Search global
  const [searchQuery, setSearchQuery] = useState('');

  // Edit line
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [editLineOriginal, setEditLineOriginal] = useState('');
  const [editLineTranslated, setEditLineTranslated] = useState('');

  // Drag and drop reorder
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  // Add to deck
  const [isAddToDeckOpen, setIsAddToDeckOpen] = useState(false);
  const [addToDeckId, setAddToDeckId] = useState('');
  const [addToDeckNoteType, setAddToDeckNoteType] = useState<'basic' | 'reversed' | 'optional_reversed' | 'typing' | 'cloze' | 'listening'>('basic');
  const [selectedLineIdxs, setSelectedLineIdxs] = useState<Set<number>>(new Set());
  const [draftCards, setDraftCards] = useState<Record<number, DraftCard>>({});
  const [isAddingToDeck, setIsAddingToDeck] = useState(false);
  const [addToDeckSuccess, setAddToDeckSuccess] = useState('');

  // Delete line confirmation
  const [deletingLineIdx, setDeletingLineIdx] = useState<number | null>(null);

  // Fullscreen PDF Viewer state
  const [isFullscreenPdfOpen, setIsFullscreenPdfOpen] = useState(false);

  // Karaoke state
  const [activeCharIndex, setActiveCharIndex] = useState<number>(-1);
  const [activeLineIdx, setActiveLineIdx] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showTranslation, setShowTranslation] = useState(false);

  // Click-to-reveal translation states
  const [hideActiveTranslation, setHideActiveTranslation] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('memorize_hide_active_translation') === 'true';
    }
    return false;
  });
  const [revealedLines, setRevealedLines] = useState<Set<number>>(new Set());

  useEffect(() => {
    localStorage.setItem('memorize_hide_active_translation', String(hideActiveTranslation));
  }, [hideActiveTranslation]);

  // Reset revealed lines when active sentence changes
  useEffect(() => {
    setRevealedLines(new Set());
  }, [activeLineIdx]);

  // Practice Mode states
  const [readingPracticeMode, setReadingPracticeMode] = useState<'none' | 'speaking' | 'writing'>('none');
  const isPronunciationMode = readingPracticeMode === 'speaking';
  const isWritingMode = readingPracticeMode === 'writing';
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechSimilarity, setSpeechSimilarity] = useState<number | null>(null);
  const [speechIsCorrect, setSpeechIsCorrect] = useState<boolean | null>(null);
  const [speechWordDiffs, setSpeechWordDiffs] = useState<DiffWord[]>([]);
  const [speechTargetSnippet, setSpeechTargetSnippet] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [selectedWordIndices, setSelectedWordIndices] = useState<Set<number>>(new Set());
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);


  const handleWordMouseDown = (wordIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSelection(true);
    setSelectedWordIndices(prev => {
      const next = new Set(prev);
      if (next.has(wordIndex) && next.size === 1) {
        next.delete(wordIndex);
      } else {
        next.add(wordIndex);
      }
      return next;
    });
  };

  const handleWordMouseEnter = (wordIndex: number) => {
    if (isDraggingSelection) {
      setSelectedWordIndices(prev => {
        const next = new Set(prev);
        next.add(wordIndex);
        return next;
      });
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingSelection(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Writing Mode states
  const [writingInput, setWritingInput] = useState('');
  const [writingCharDiffs, setWritingCharDiffs] = useState<DiffChar[]>([]);
  const [writingIsCorrect, setWritingIsCorrect] = useState<boolean | null>(null);
  
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const currentWordIdxRef = useRef<number>(-1);
  const isPlayingRef = useRef(false);
  const receivedBoundaryRef = useRef(false);
  const sessionStartTime = useRef<number>(0);
  const readWordsSet = useRef<Set<string>>(new Set());
  const sessionMasteredCount = useRef<number>(0);
  const lastActiveLineIdxRef = useRef<number>(-1);
  const restoredRef = useRef<string | null>(null);

  const [zenTheme, setZenTheme] = useState<'default' | 'sepia' | 'dark-matte'>(() => {
    return (localStorage.getItem('memorize_zen_theme') as any) || 'default';
  });

  const handleSetZenTheme = (theme: 'default' | 'sepia' | 'dark-matte') => {
    setZenTheme(theme);
    localStorage.setItem('memorize_zen_theme', theme);
  };

  const selectedText = readings?.find((r) => r.id === selectedTextId) || null;

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Manage PDF Object URL for the Vitrine view
  useEffect(() => {
    if (selectedText?.pdfFile && activeReaderTab === 'vitrine') {
      const url = URL.createObjectURL(selectedText.pdfFile);
      setPdfUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setPdfUrl(null);
      };
    } else {
      setPdfUrl(null);
    }
  }, [selectedText, activeReaderTab]);

  // Monitor text selections for floating pronunciation lookup
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const tooltip = document.getElementById('floating-selection-lookup');
      if (tooltip && tooltip.contains(e.target as Node)) {
        isClickingTooltip.current = true;
      } else {
        isClickingTooltip.current = false;
      }
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        if (isClickingTooltip.current) return;
        setIsLookupVisible(false);
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 0 && text.length < 60) {
        if (readerContainerRef.current && readerContainerRef.current.contains(selection.anchorNode)) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setLookupText(text);
          setLookupPosition({
            top: rect.top + window.scrollY - 8,
            left: rect.left + rect.width / 2 + window.scrollX
          });
          setIsLookupVisible(true);
        }
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [selectedTextId]);

  // Keyboard shortcuts for reading and karaoke
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ignore if typing in input/textarea/editable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape' && editingLineIdx !== null) {
          setEditingLineIdx(null);
        }
        return;
      }

      if (!selectedText) return;

      // 2. Ignore reading shortcuts if currently editing
      if (editingLineIdx !== null) {
        if (e.key === 'Escape') {
          setEditingLineIdx(null);
        }
        return;
      }

      // 3. Handle specific shortcuts
      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          togglePlayPause();
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          if (e.altKey) {
            if (activeLineIdx >= 0 && activeLineIdx < selectedText.lines.length) {
              handleMoveLine(activeLineIdx, 'down');
            }
          } else {
            setActiveLineIdx(prev => {
              const nextIdx = prev + 1;
              if (nextIdx < selectedText.lines.length) {
                const el = document.getElementById(`line-card-${nextIdx}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                return nextIdx;
              }
              return prev;
            });
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (e.altKey) {
            if (activeLineIdx >= 0 && activeLineIdx < selectedText.lines.length) {
              handleMoveLine(activeLineIdx, 'up');
            }
          } else {
            setActiveLineIdx(prev => {
              const nextIdx = prev - 1;
              if (nextIdx >= 0) {
                const el = document.getElementById(`line-card-${nextIdx}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                return nextIdx;
              }
              return prev;
            });
          }
          break;
        }
        case 'KeyD':
        case 'KeyM': {
          e.preventDefault();
          if (activeLineIdx >= 0 && activeLineIdx < selectedText.lines.length) {
            handleToggleMastered(activeLineIdx);
          }
          break;
        }
        case 'KeyE': {
          e.preventDefault();
          if (activeLineIdx >= 0 && activeLineIdx < selectedText.lines.length) {
            handleStartEditLine(activeLineIdx);
          }
          break;
        }
        case 'KeyR': {
          e.preventDefault();
          if (activeLineIdx >= 0) {
            const currentIdx = activeLineIdx;
            stopPlayback();
            setTimeout(() => {
              startFromSentence(currentIdx);
            }, 50);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedText, activeLineIdx, editingLineIdx]);


  // Compute character ranges for each line in the clean text
  const linesWithRanges = React.useMemo(() => {
    if (!selectedText) return [];
    let currentOffset = 0;
    return selectedText.lines.map((line, index) => {
      const start = currentOffset;
      const end = start + line.original.length;
      // Account for the space between sentences
      currentOffset = end + 1;
      return {
        index,
        line,
        start,
        end
      };
    });
  }, [selectedText]);

  // Telemetry session tracking & bookmarking
  useEffect(() => {
    if (selectedTextId) {
      sessionStartTime.current = Date.now();
      readWordsSet.current.clear();
      sessionMasteredCount.current = 0;
    }
    return () => {
      if (selectedTextId) {
        const duration = (Date.now() - sessionStartTime.current) / 1000;
        
        // Save session telemetry if duration >= 5s
        if (duration >= 5) {
          const readingId = selectedTextId;
          const wordsCount = readWordsSet.current.size;
          const masteredCount = sessionMasteredCount.current;
          
          db.readingSessions.add({
            id: crypto.randomUUID(),
            readingId,
            timestamp: Date.now(),
            duration: Math.round(duration),
            wordsRead: wordsCount,
            sentencesMastered: masteredCount
          }).catch(err => console.error('Erro ao salvar sessão de leitura:', err));
        }

        // Save page bookmark position (always save index if valid)
        if (lastActiveLineIdxRef.current >= 0) {
          db.texts.update(selectedTextId, { lastLineIndex: lastActiveLineIdxRef.current })
            .catch(err => console.error('Erro ao salvar marcador de página:', err));
        }
      }
    };
  }, [selectedTextId]);

  // Track last active line for bookmarking
  useEffect(() => {
    lastActiveLineIdxRef.current = activeLineIdx;
  }, [activeLineIdx]);

  // Backfill unique IDs for reading lines if they don't have them
  useEffect(() => {
    if (selectedTextId && selectedText) {
      const hasMissingId = selectedText.lines.some(l => !l.id);
      if (hasMissingId) {
        const updatedLines = selectedText.lines.map(l => ({
          ...l,
          id: l.id || crypto.randomUUID()
        }));
        db.texts.update(selectedTextId, { lines: updatedLines })
          .catch(err => console.error('Erro ao migrar IDs de linha:', err));
      }
    }
  }, [selectedTextId, selectedText]);

  // Restore position from bookmark
  useEffect(() => {
    if (selectedTextId && selectedText) {
      if (restoredRef.current === selectedTextId) return;
      restoredRef.current = selectedTextId;

      const idx = selectedText.lastLineIndex;
      const targetIdx = (idx !== undefined && idx >= 0 && idx < selectedText.lines.length) ? idx : 0;
      setActiveLineIdx(targetIdx);
      if (linesWithRanges[targetIdx]) {
        setActiveCharIndex(linesWithRanges[targetIdx].start);
      }
      setTimeout(() => {
        const lineEl = document.querySelector(`[data-line-index="${targetIdx}"]`);
        lineEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    } else if (!selectedTextId) {
      restoredRef.current = null;
      setActiveLineIdx(-1);
      setActiveCharIndex(-1);
    }
  }, [selectedTextId, selectedText, linesWithRanges]);

  // Migrate standalone texts to the first available collection (or create one)
  useEffect(() => {
    const migrateStandaloneTexts = async () => {
      try {
        const standalone = await db.texts.filter(r => r.showInReadings !== false && !r.collectionId).toArray();
        if (standalone.length === 0) return;

        let targetCollectionId = '';
        const existingCollections = await db.readingCollections.toArray();
        
        if (existingCollections.length > 0) {
          // Use the oldest/first collection
          const sorted = existingCollections.sort((a, b) => a.createdAt - b.createdAt);
          targetCollectionId = sorted[0].id;
        } else {
          // Create a default collection
          const id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15);
          
          await db.readingCollections.add({
            id,
            title: 'Biblioteca Geral',
            description: 'Coleção criada para agrupar seus textos existentes.',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          targetCollectionId = id;
        }

        // Update all standalone texts
        for (const reading of standalone) {
          await db.texts.update(reading.id, { collectionId: targetCollectionId });
        }
        console.log(`Migrados ${standalone.length} textos para a coleção ${targetCollectionId}`);
      } catch (error) {
        console.error('Erro na migração de textos avulsos:', error);
      }
    };

    if (readings) {
      migrateStandaloneTexts();
    }
  }, [readings]);

  // Track words read based on activeLineIdx
  useEffect(() => {
    if (selectedText && activeLineIdx >= 0 && linesWithRanges[activeLineIdx]) {
      const words = linesWithRanges[activeLineIdx].line.original.split(/\s+/).filter(Boolean);
      words.forEach((_, i) => {
        readWordsSet.current.add(`${activeLineIdx}-${i}`);
      });
    }
  }, [activeLineIdx, linesWithRanges, selectedText]);

  // Find active line index based on character index
  useEffect(() => {
    if (isPlaying && selectedText && linesWithRanges.length > 0 && activeCharIndex >= 0) {
      const activeIdx = linesWithRanges.findIndex(
        ({ start, end }) => activeCharIndex >= start && activeCharIndex < end
      );
      if (activeIdx >= 0) {
        setActiveLineIdx(activeIdx);
      }
    }
  }, [activeCharIndex, linesWithRanges, selectedText, isPlaying]);

  // Auto-scroll active line smoothly
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setSelectedWordIndices(new Set());
  }, [activeLineIdx]);

  // Stop TTS and clear timer on unmount or view/lesson change
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      window.speechSynthesis?.cancel();
      clearTimeout(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      setReadingPracticeMode('none');
      setIsListeningSpeech(false);
      setSpeechTranscript('');
      setSpeechSimilarity(null);
      setSpeechIsCorrect(null);
      setSpeechWordDiffs([]);
      setSpeechTargetSnippet(null);
      setSelectedWordIndices(new Set());

      // Reset writing states
      setWritingInput('');
      setWritingCharDiffs([]);
      setWritingIsCorrect(null);
    };
  }, [selectedTextId, activeReaderTab]);

  const speakText = (text: string) => {
    window.speechSynthesis?.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = playbackSpeed * ttsRate;
    if (ttsVoice) {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      const matched = voices.find((v) => v.name === ttsVoice);
      if (matched) { utt.voice = matched; utt.lang = matched.lang; }
    }
    window.speechSynthesis?.speak(utt);
  };

  const speakSentenceOrSelection = (lineText: string) => {
    const rawOriginal = stripHtmlTags(lineText);
    const sentenceWords: string[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(rawOriginal)) !== null) {
      sentenceWords.push(match[0]);
    }
    const hasSnippetSelection = selectedWordIndices.size > 0;
    const selectedSnippetWords = Array.from(selectedWordIndices)
      .sort((a, b) => a - b)
      .map(idx => sentenceWords[idx]);
    const speakTargetText = hasSnippetSelection ? selectedSnippetWords.join(' ') : lineText;
    speakText(speakTargetText);
  };

  const playSuccessChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = ctx.currentTime;
      playTone(523.25, now, 0.4); // C5
      playTone(659.25, now + 0.12, 0.5); // E5
    } catch (e) {
      console.error("Web Audio API not supported or blocked:", e);
    }
  };

  const togglePronunciationMode = () => {
    if (isPronunciationMode) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      setReadingPracticeMode('none');
      setIsListeningSpeech(false);
      setSpeechTranscript('');
      setSpeechSimilarity(null);
      setSpeechIsCorrect(null);
      setSpeechWordDiffs([]);
      setSpeechTargetSnippet(null);
      setSelectedWordIndices(new Set());
    } else {
      stopPlayback();
      setReadingPracticeMode('speaking');
      if (activeLineIdx < 0) {
        setActiveLineIdx(0);
      }
    }
  };

  const handleStartSpeechRecognition = (targetIndexOverride?: number) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Reconhecimento de voz não é suportado neste navegador. Use o Chrome ou Edge.");
      return;
    }

    if (isListeningSpeech) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      return;
    }

    const targetIdx = targetIndexOverride !== undefined ? targetIndexOverride : activeLineIdx;

    if (!selectedText || targetIdx < 0 || targetIdx >= selectedText.lines.length) {
      toast.error("Por favor, selecione uma frase para ler.");
      return;
    }

    const currentLine = selectedText.lines[targetIdx];
    const rawExpected = stripHtmlTags(currentLine.original);

    // Reconstruct target expected based on clicked word indices if there is any selection
    const sentenceWords: string[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(rawExpected)) !== null) {
      sentenceWords.push(match[0]);
    }

    const hasSnippetSelection = selectedWordIndices.size > 0;
    const selectedSnippetWords = Array.from(selectedWordIndices)
      .sort((a, b) => a - b)
      .map(idx => sentenceWords[idx]);
    const targetExpected = hasSnippetSelection ? selectedSnippetWords.join(' ') : rawExpected;

    setIsListeningSpeech(true);
    setSpeechTranscript('');
    setSpeechSimilarity(null);
    setSpeechIsCorrect(null);
    setSpeechWordDiffs([]);
    setSpeechTargetSnippet(hasSnippetSelection ? targetExpected : null);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setSpeechTranscript(resultText);

        const cleanTyped = cleanString(resultText);
        const cleanExpected = cleanString(targetExpected);

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

        const diff = diffWords(resultText, targetExpected);
        setSpeechWordDiffs(diff);
        setSpeechSimilarity(similarity);
        setSpeechIsCorrect(correct);

        if (correct) {
          playSuccessChime();

          if (!hasSnippetSelection) {
            if (!currentLine.mastered) {
              handleToggleMastered(targetIdx);
            }

            setTimeout(() => {
              setActiveLineIdx(prev => {
                const nextIdx = prev + 1;
                if (nextIdx < selectedText.lines.length) {
                  setSpeechTranscript('');
                  setSpeechSimilarity(null);
                  setSpeechIsCorrect(null);
                  setSpeechWordDiffs([]);
                  setSpeechTargetSnippet(null);

                  setTimeout(() => {
                    const el = document.getElementById(`line-card-${nextIdx}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    handleStartSpeechRecognition(nextIdx);
                  }, 100);

                  return nextIdx;
                } else {
                  toast.success("Parabéns! Você concluiu a leitura e pronúncia de todas as frases do texto!");
                  return prev;
                }
              });
            }, 1500);
          }
        }
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

  const startSentenceTimer = (index: number, wordOffset = 0) => {
    clearTimeout(timerRef.current);
    if (!selectedText || linesWithRanges.length === 0 || index >= linesWithRanges.length) return;

    const lr = linesWithRanges[index];
    const startCharOffset = lr.start;

    const words: { word: string; start: number; end: number }[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(lr.line.original)) !== null) {
      words.push({
        word: match[0],
        start: startCharOffset + match.index,
        end: startCharOffset + match.index + match[0].length
      });
    }

    const playNext = (wIdx: number) => {
      if (!isPlayingRef.current) return;
      if (wIdx >= words.length) {
        return;
      }

      currentWordIdxRef.current = wIdx;
      const word = words[wIdx];
      setActiveCharIndex(word.start);

      // Speed calibrated for standard TTS rate
      const charDuration = 24;
      const baseDuration = 150;
      const duration = ((word.word.length * charDuration) + baseDuration) / (playbackSpeed * ttsRate);

      timerRef.current = setTimeout(() => {
        playNext(wIdx + 1);
      }, duration);
    };

    playNext(wordOffset);
  };

  const startFromSentence = (index: number) => {
    window.speechSynthesis?.cancel();
    clearTimeout(timerRef.current);
    if (!selectedText || linesWithRanges.length === 0 || index >= linesWithRanges.length) return;

    currentWordIdxRef.current = 0;
    receivedBoundaryRef.current = false;

    const lr = linesWithRanges[index];
    const sentenceText = lr.line.original;
    const startCharOffset = lr.start;

    // Tokenize words for this sentence
    const words: { word: string; start: number; end: number }[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(sentenceText)) !== null) {
      words.push({
        word: match[0],
        start: startCharOffset + match.index,
        end: startCharOffset + match.index + match[0].length
      });
    }

    const utt = new SpeechSynthesisUtterance(sentenceText);
    utt.lang = 'en-US';
    utt.rate = playbackSpeed * ttsRate;
    
    if (ttsVoice) {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      const matched = voices.find((v) => v.name === ttsVoice);
      if (matched) { utt.voice = matched; utt.lang = matched.lang; }
    }

    utt.onboundary = (event) => {
      if (event.name === 'word') {
        receivedBoundaryRef.current = true;
        clearTimeout(timerRef.current);

        // Find the tokenized word matching event.charIndex
        const word = words.find(w => {
          const localStart = w.start - startCharOffset;
          const localEnd = w.end - startCharOffset;
          return event.charIndex >= localStart && event.charIndex < localEnd;
        }) || words.find(w => {
          const localStart = w.start - startCharOffset;
          return event.charIndex <= localStart;
        });

        if (word) {
          setActiveCharIndex(word.start);
          currentWordIdxRef.current = words.indexOf(word);
        }
      }
    };

    utt.onstart = () => {
      if (!isPlayingRef.current) {
        window.speechSynthesis?.pause();
        return;
      }
      setIsPlaying(true);
      setActiveLineIdx(index);

      // Start fallback timer after 350ms if no boundaries were received
      timerRef.current = setTimeout(() => {
        if (!receivedBoundaryRef.current) {
          startSentenceTimer(index, 0);
        }
      }, 350);
    };

    utt.onend = () => {
      if (isPlayingRef.current) {
        if (activeReaderTab === 'lineByLine') {
          stopPlayback();
        } else {
          const nextIndex = index + 1;
          if (nextIndex < linesWithRanges.length) {
            startFromSentence(nextIndex);
          } else {
            stopPlayback();
          }
        }
      }
    };

    utt.onerror = () => {
      stopPlayback();
    };

    setIsPlaying(true);
    isPlayingRef.current = true;
    window.speechSynthesis?.speak(utt);
  };

  // Restart playback if speed changes during playback
  useEffect(() => {
    if (isPlaying) {
      const startIdx = activeLineIdx >= 0 ? activeLineIdx : 0;
      startFromSentence(startIdx);
    }
  }, [playbackSpeed]);

  const togglePlayPause = () => {
    if (isPronunciationMode) {
      handleStartSpeechRecognition();
      return;
    }
    if (isWritingMode) {
      if (activeLineIdx >= 0 && selectedText) {
        speakText(selectedText.lines[activeLineIdx].original);
      }
      return;
    }
    if (isPlaying) {
      window.speechSynthesis?.pause();
      clearTimeout(timerRef.current);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else if (window.speechSynthesis?.paused) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      window.speechSynthesis?.resume();
      if (!receivedBoundaryRef.current && activeLineIdx >= 0) {
        startSentenceTimer(activeLineIdx, currentWordIdxRef.current);
      }
    } else if (selectedText) {
      const startIdx = activeLineIdx >= 0 ? activeLineIdx : 0;
      startFromSentence(startIdx);
    }
  };

  const stopPlayback = () => {
    if (isPronunciationMode) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      setIsListeningSpeech(false);
      setSpeechTranscript('');
      setSpeechSimilarity(null);
      setSpeechIsCorrect(null);
      setSpeechWordDiffs([]);
      setSpeechTargetSnippet(null);
      setSelectedWordIndices(new Set());
      return;
    }
    if (isWritingMode) {
      window.speechSynthesis?.cancel();
      clearTimeout(timerRef.current);
      setIsPlaying(false);
      setWritingInput('');
      setWritingCharDiffs([]);
      setWritingIsCorrect(null);
      return;
    }
    isPlayingRef.current = false;
    window.speechSynthesis?.cancel();
    clearTimeout(timerRef.current);
    setActiveCharIndex(-1);
    setIsPlaying(false);
    currentWordIdxRef.current = -1;
  };

  const handleCheckWritingPracticeAnswer = () => {
    if (!selectedText || activeLineIdx < 0) return;
    const currentLine = selectedText.lines[activeLineIdx];
    const expected = stripHtmlTags(currentLine.original);

    const cleanTyped = cleanString(writingInput);
    const cleanExpected = cleanString(expected);

    const dist = getLevenshteinDistance(cleanTyped, cleanExpected);
    const maxLen = Math.max(cleanTyped.length, cleanExpected.length);
    const similarity = maxLen > 0 ? Math.max(0, 1 - dist / maxLen) * 100 : (cleanTyped === cleanExpected ? 100 : 0);

    const isCorrect = similarity >= 90;
    
    const diff = diffStrings(writingInput, expected);
    setWritingCharDiffs(diff);
    setWritingIsCorrect(isCorrect);

    if (isCorrect) {
      playSuccessChime();

      if (!currentLine.mastered) {
        handleToggleMastered(activeLineIdx);
      }

      setTimeout(() => {
        setActiveLineIdx(prev => {
          const nextIdx = prev + 1;
          if (nextIdx < selectedText.lines.length) {
            setWritingInput('');
            setWritingCharDiffs([]);
            setWritingIsCorrect(null);

            setTimeout(() => {
              const el = document.getElementById(`line-card-${nextIdx}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              const nextInput = document.getElementById(`writing-input-${nextIdx}`);
              if (nextInput) {
                nextInput.focus();
              }
              speakText(selectedText.lines[nextIdx].original);
            }, 100);

            return nextIdx;
          } else {
            toast.success("Parabéns! Você concluiu a escrita de todas as frases do texto!");
            return prev;
          }
        });
      }, 1500);
    }
  };

  const handleRevealWritingAnswer = () => {
    if (!selectedText || activeLineIdx < 0) return;
    const currentLine = selectedText.lines[activeLineIdx];
    const expected = stripHtmlTags(currentLine.original);
    
    const diff = diffStrings("", expected);
    setWritingCharDiffs(diff);
    setWritingIsCorrect(false);
  };

  const handleNextWritingSentence = () => {
    if (!selectedText || activeLineIdx < 0) return;
    const nextIdx = activeLineIdx + 1;
    if (nextIdx < selectedText.lines.length) {
      setWritingInput('');
      setWritingCharDiffs([]);
      setWritingIsCorrect(null);
      setActiveLineIdx(nextIdx);
      setTimeout(() => {
        const el = document.getElementById(`line-card-${nextIdx}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const nextInput = document.getElementById(`writing-input-${nextIdx}`);
        if (nextInput) {
          nextInput.focus();
        }
        speakText(selectedText.lines[nextIdx].original);
      }, 100);
    } else {
      toast.success("Parabéns! Você concluiu a escrita de todas as frases do texto!");
    }
  };

  const handleSaveReading = async (reading: ReadingText) => {
    await db.texts.put(reading);
  };

  const handleDeleteReading = (id: string) => {
    setTextToDelete(id);
  };

  const confirmDeleteReading = async () => {
    if (textToDelete) {
      await db.texts.delete(textToDelete);
      if (selectedTextId === textToDelete) setSelectedTextId(null);
      setTextToDelete(null);
      toast.success("Texto excluído com sucesso!");
    }
  };

  const handleOpenEditReading = (e: React.MouseEvent, reading: ReadingText) => {
    e.stopPropagation();
    setEditingReading({ id: reading.id, title: reading.title, description: reading.description });
    setEditReadingTitle(reading.title);
    setEditReadingDescription(reading.description || '');
  };

  const handleSaveEditReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReading || !editReadingTitle.trim()) return;
    await db.texts.update(editingReading.id, {
      title: editReadingTitle.trim(),
      description: editReadingDescription.trim() || undefined,
      updatedAt: Date.now()
    });
    toast.success('Texto atualizado!');
    setEditingReading(null);
  };

  const handleCreateCollection = async () => {
    if (!newCollectionTitle.trim()) return;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);
    await db.readingCollections.add({
      id,
      title: newCollectionTitle.trim(),
      description: newCollectionDescription.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    setNewCollectionTitle('');
    setNewCollectionDescription('');
    setIsCreatingCollection(false);
  };

  const handleOpenEditCollection = (e: React.MouseEvent, collection: ReadingCollection) => {
    e.stopPropagation();
    setEditingCollection(collection);
    setEditCollectionTitle(collection.title);
    setEditCollectionDescription(collection.description || '');
  };

  const handleSaveEditCollection = async () => {
    if (!editingCollection || !editCollectionTitle.trim()) return;
    await db.readingCollections.update(editingCollection.id, {
      title: editCollectionTitle.trim(),
      description: editCollectionDescription.trim() || undefined,
      updatedAt: Date.now()
    });
    setEditingCollection(null);
  };

  const handleOpenDeleteCollection = async (e: React.MouseEvent, collection: ReadingCollection) => {
    e.stopPropagation();
    const count = readings ? readings.filter(r => r.collectionId === collection.id).length : 0;
    setAssociatedReadingsCount(count);
    setDeletingCollection(collection);
  };

  const handleDeleteCollection = async (cascade: boolean) => {
    if (!deletingCollection) return;
    const id = deletingCollection.id;
    if (cascade) {
      const associated = readings ? readings.filter(r => r.collectionId === id) : [];
      for (const r of associated) {
        await db.texts.delete(r.id);
      }
    } else {
      const associated = readings ? readings.filter(r => r.collectionId === id) : [];
      for (const r of associated) {
        await db.texts.update(r.id, { collectionId: undefined });
      }
    }
    await db.readingCollections.delete(id);
    setDeletingCollection(null);
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null);
    }
  };
  const handleAppendSentence = async () => {
    if (!selectedText || !appendOriginal.trim()) return;
    const newSentence = {
      id: crypto.randomUUID(),
      original: appendOriginal.trim(),
      translated: appendTranslated.trim(),
      highlights: [],
      mastered: false
    };
    const updatedLines = [...selectedText.lines, newSentence];
    const fullOriginal = updatedLines.map(s => s.original).join(' ');
    const fullTranslated = updatedLines.map(s => s.translated).join(' ');

    await db.texts.update(selectedText.id, {
      lines: updatedLines,
      fullTextOriginal: fullOriginal,
      fullTextTranslated: fullTranslated,
      updatedAt: Date.now()
    });
    
    setAppendOriginal('');
    setAppendTranslated('');
    setIsAppending(false);
  };

  const handleAppendBlockPdfUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setAppendBlockErrorMsg('Por favor, selecione um arquivo PDF.');
      return;
    }
    setAppendBlockIsPdfLoading(true);
    setAppendBlockErrorMsg('');
    try {
      const text = await extractTextFromPdf(file);
      if (!text.trim()) {
        setAppendBlockErrorMsg('Não foi possível extrair texto do PDF.');
        return;
      }
      setAppendBlockOriginalText(text);
      setAppendBlockPdfBlob(file);

      // Tentar obter a primeira linha não vazia do texto
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let suggested = '';
      if (lines.length > 0) {
        // Encontra a primeira linha com tamanho razoável (ex: entre 3 e 80 caracteres)
        for (const line of lines) {
          if (line.length > 2 && line.length < 80) {
            // Se a linha não começar com números de página ou caracteres de layout típicos
            if (!/^(page|pág|p\.)\s*\d+/i.test(line) && !/^\d+$/i.test(line)) {
              suggested = line;
              break;
            }
          }
        }
      }
      if (!suggested) {
        // Se não encontrar no texto, usa o nome do arquivo limpo
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        suggested = nameWithoutExt.replace(/[_-]/g, ' ').trim();
      }

      if (suggested) {
        setPdfSuggestedTitle(suggested);
        setPdfSuggestedTitleInput(suggested);
        setIsTitleSuggestionModalOpen(true);
      }
    } catch (err: any) {
      setAppendBlockErrorMsg(`Erro ao processar PDF: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setAppendBlockIsPdfLoading(false);
    }
  };

  const handleConfirmSuggestedTitle = async () => {
    if (!selectedTextId || !pdfSuggestedTitleInput.trim()) return;
    try {
      await db.texts.update(selectedTextId, {
        title: pdfSuggestedTitleInput.trim(),
        updatedAt: Date.now()
      });
      toast.success('Título do texto atualizado com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao atualizar o título: ${err.message}`);
    } finally {
      setIsTitleSuggestionModalOpen(false);
      setPdfSuggestedTitle(null);
      setPdfSuggestedTitleInput('');
    }
  };

  const handleAppendBlockProcess = async () => {
    if (!selectedText || !appendBlockOriginalText.trim()) return;
    setAppendBlockErrorMsg('');
    setAppendBlockIsProcessing(true);
    
    try {
      let newLines;
      
      if (appendBlockMode === 'gemini') {
        if (!geminiApiKey.trim()) {
          throw new Error('Chave de API do Gemini não configurada.');
        }
        setAppendBlockProcessingStep('🤖 Gemini está segmentando e traduzindo o texto...');
        const aiResult = await processTextWithAI(appendBlockOriginalText, geminiApiKey);
        newLines = aiResult.lines;
      } else if (appendBlockMode === 'mymemory') {
        setAppendBlockProcessingStep('🌐 Traduzindo e segmentando gratuitamente...');
        const freeResult = await segmentAndTranslateWithFreeAPI(
          appendBlockOriginalText,
          (curr, tot) => {
            setAppendBlockProcessingStep(`🌐 Traduzindo frase ${curr} de ${tot} com MyMemory API...`);
          }
        );
        newLines = freeResult.lines;
      } else {
        setAppendBlockProcessingStep('📝 Segmentando texto por linhas...');
        newLines = segmentTextManually(appendBlockOriginalText, appendBlockTranslatedText);
      }
      
      const updatedLines = [...selectedText.lines, ...newLines];
      const fullOriginal = updatedLines.map(s => s.original).join(' ');
      const fullTranslated = updatedLines.map(s => s.translated).join(' ');
      
      const currentRaw = selectedText.rawPdfText || '';
      const updatedRaw = currentRaw ? `${currentRaw}\n\n${appendBlockOriginalText.trim()}` : appendBlockOriginalText.trim();
      const pdfFileToSave = appendBlockPdfBlob || selectedText.pdfFile;
      
      await db.texts.update(selectedText.id, {
        lines: updatedLines,
        fullTextOriginal: fullOriginal,
        fullTextTranslated: fullTranslated,
        rawPdfText: updatedRaw || undefined,
        pdfFile: pdfFileToSave || undefined,
        updatedAt: Date.now()
      });
      
      closeAppendBlockModal();
    } catch (err: any) {
      setAppendBlockErrorMsg(err.message || 'Erro ao processar e anexar o texto.');
    } finally {
      setAppendBlockIsProcessing(false);
      setAppendBlockProcessingStep('');
    }
  };

  const closeAppendBlockModal = () => {
    setIsAppendBlockModalOpen(false);
    setAppendBlockOriginalText('');
    setAppendBlockTranslatedText('');
    setAppendBlockPdfBlob(null);
    setAppendBlockErrorMsg('');
    setAppendBlockIsProcessing(false);
    setAppendBlockProcessingStep('');
  };

  // ── Edit line handlers ──────────────────────────────────────
  const handleStartEditLine = (idx: number) => {
    if (!selectedText) return;
    setEditingLineIdx(idx);
    setEditLineOriginal(selectedText.lines[idx].original);
    setEditLineTranslated(selectedText.lines[idx].translated);
  };

  const handleSaveEditLine = async () => {
    if (!selectedText || editingLineIdx === null) return;
    const updatedLines = [...selectedText.lines];
    updatedLines[editingLineIdx] = {
      ...updatedLines[editingLineIdx],
      original: editLineOriginal.trim(),
      translated: editLineTranslated.trim(),
    };
    await db.texts.update(selectedText.id, { lines: updatedLines, updatedAt: Date.now() });
    setEditingLineIdx(null);
    setEditLineOriginal('');
    setEditLineTranslated('');
  };

  const handleDeleteLine = async (idx: number) => {
    if (!selectedText) return;
    const updatedLines = selectedText.lines.filter((_, i) => i !== idx);
    await db.texts.update(selectedText.id, { lines: updatedLines, updatedAt: Date.now() });
    if (editingLineIdx === idx) setEditingLineIdx(null);
  };

  // ── Drag-and-drop handlers ──────────────────────────────────
  const handleDragStart = (idx: number) => {
    dragSrcIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (!selectedText || dragSrcIdx.current === null || dragSrcIdx.current === dropIdx) return;
    const updatedLines = [...selectedText.lines];
    const [moved] = updatedLines.splice(dragSrcIdx.current, 1);
    updatedLines.splice(dropIdx, 0, moved);
    dragSrcIdx.current = null;
    await db.texts.update(selectedText.id, { lines: updatedLines, updatedAt: Date.now() });
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragSrcIdx.current = null;
  };

  const handleMoveLineTo = async (fromIdx: number, toIdx: number) => {
    if (!selectedText) return;
    if (toIdx < 0 || toIdx >= selectedText.lines.length || fromIdx === toIdx) return;

    const updatedLines = [...selectedText.lines];
    const [moved] = updatedLines.splice(fromIdx, 1);
    updatedLines.splice(toIdx, 0, moved);

    setActiveLineIdx(toIdx);
    await db.texts.update(selectedText.id, { lines: updatedLines, updatedAt: Date.now() });

    setTimeout(() => {
      const el = document.getElementById(`line-card-${toIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  const handleMoveLine = async (fromIdx: number, direction: 'up' | 'down') => {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    await handleMoveLineTo(fromIdx, toIdx);
  };

  // ── Add to deck handlers ────────────────────────────────────
  const handleOpenAddToDeck = () => {
    if (!selectedText) return;
    const allIdxs = new Set(selectedText.lines.map((_, i) => i));
    setSelectedLineIdxs(allIdxs);
    setAddToDeckId(decks[0]?.id || '');
    setAddToDeckSuccess('');

    const initialDrafts: Record<number, DraftCard> = {};
    selectedText.lines.forEach((line, idx) => {
      initialDrafts[idx] = {
        id: `draft_${idx}_${Date.now()}`,
        originalLineIdx: idx,
        field0: line.original,
        field1: line.translated,
        field2: ''
      };
    });
    setDraftCards(initialDrafts);

    setIsAddToDeckOpen(true);
  };

  const handleToggleLineIdx = (idx: number) => {
    setSelectedLineIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAddToDeck = async () => {
    if (!selectedText || !addToDeckId || selectedLineIdxs.size === 0) return;
    setIsAddingToDeck(true);
    try {
      const newNotes: Note[] = [];
      const newCards: Card[] = [];

      for (const idx of selectedLineIdxs) {
        const draft = draftCards[idx];
        if (!draft) continue;

        const noteId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        
        const newNote: Note = {
          id: noteId,
          deckId: addToDeckId,
          type: addToDeckNoteType,
          fields: [draft.field0, draft.field1, draft.field2],
          tags: selectedText.theme 
            ? ['reading', `tema-${selectedText.theme.toLowerCase().trim().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`] 
            : ['reading'],
          context: selectedText.title,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        newNotes.push(newNote);

        const { toAdd } = syncNoteCards(newNote, []);
        newCards.push(...toAdd);
      }

      await db.notes.bulkAdd(newNotes);
      await db.cards.bulkAdd(newCards);

      setAddToDeckSuccess(`${newCards.length} card${newCards.length !== 1 ? 's' : ''} adicionado${newCards.length !== 1 ? 's' : ''} ao baralho!`);
      setTimeout(() => {
        setIsAddToDeckOpen(false);
        setAddToDeckSuccess('');
      }, 1800);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsAddingToDeck(false);
    }
  };

  const handleToggleMastered = async (lineIndex: number) => {
    if (!selectedText) return;
    const updatedLines = [...selectedText.lines];
    const newMasteredState = !updatedLines[lineIndex].mastered;
    updatedLines[lineIndex] = { ...updatedLines[lineIndex], mastered: newMasteredState };
    
    // Update session mastered count balance (+1 if mastered, -1 if unmastered)
    sessionMasteredCount.current += newMasteredState ? 1 : -1;

    await db.texts.update(selectedText.id, {
      lines: updatedLines,
      updatedAt: Date.now(),
    });
  };

  const handleCopyLine = (text: string, idx: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedLineIdx(idx);
    setTimeout(() => setCopiedLineIdx(null), 2000);
  };

  const renderHighlightedText = (text: string, highlights: string[]) => {
    if (!highlights || highlights.length === 0) {
      return <span>{text}</span>;
    }
    const escapedHighlights = highlights.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedHighlights.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isHighlight = highlights.some((h) => h.toLowerCase() === part.toLowerCase());
      return isHighlight ? (
        <span key={i} className="text-primary font-bold">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  };

  const renderSentenceWithWordHighlights = (lineText: string, lineStartOffset: number, isActiveLine: boolean) => {
    const words: { word: string; start: number; end: number }[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(lineText)) !== null) {
      const wordStart = lineStartOffset + match.index;
      words.push({
        word: match[0],
        start: wordStart,
        end: wordStart + match[0].length
      });
    }

    return words.map(({ word, start, end }, i) => {
      const isActiveWord = activeCharIndex >= start && activeCharIndex < end;
      const isPastWord = activeCharIndex >= end;

      let wordClass = '';

      if (isZenMode && zenTheme === 'sepia') {
        if (isPlaying) {
          if (isActiveLine) {
            if (isActiveWord) {
              wordClass = 'bg-[#8b5a2b] text-[#f4ecd8] border-[#8b5a2b] font-bold shadow-sm px-1 py-0.5 rounded border';
            } else if (isPastWord) {
              wordClass = 'text-[#8b5a2b]/85 font-bold border-transparent px-1 py-0.5 rounded border';
            } else {
              wordClass = 'text-[#5c4033] font-bold border-transparent px-1 py-0.5 rounded border';
            }
          } else {
            wordClass = 'text-[#5c4033]/50 border-transparent px-1 py-0.5 rounded border';
          }
        } else {
          if (isActiveLine) {
            if (isActiveWord) {
              wordClass = 'bg-[#8b5a2b] text-[#f4ecd8] border-[#8b5a2b] font-bold shadow-sm px-1 py-0.5 rounded border';
            } else {
              wordClass = 'text-[#5c4033] font-bold border-transparent px-1 py-0.5 rounded border';
            }
          } else {
            wordClass = 'text-[#5c4033] font-semibold border-transparent px-1 py-0.5 rounded border';
          }
        }
      } else if (isZenMode && zenTheme === 'dark-matte') {
        if (isPlaying) {
          if (isActiveLine) {
            if (isActiveWord) {
              wordClass = 'bg-[#51afef] text-[#1a1c23] border-[#51afef] font-bold shadow-sm px-1 py-0.5 rounded border';
            } else if (isPastWord) {
              wordClass = 'text-[#51afef]/85 font-bold border-transparent px-1 py-0.5 rounded border';
            } else {
              wordClass = 'text-[#cbd5e1] font-bold border-transparent px-1 py-0.5 rounded border';
            }
          } else {
            wordClass = 'text-[#cbd5e1]/45 border-transparent px-1 py-0.5 rounded border';
          }
        } else {
          if (isActiveLine) {
            if (isActiveWord) {
              wordClass = 'bg-[#51afef] text-[#1a1c23] border-[#51afef] font-bold shadow-sm px-1 py-0.5 rounded border';
            } else {
              wordClass = 'text-[#cbd5e1] font-bold border-transparent px-1 py-0.5 rounded border';
            }
          } else {
            wordClass = 'text-[#cbd5e1] font-semibold border-transparent px-1 py-0.5 rounded border';
          }
        }
      } else {
        // Default theme
        if (isPlaying) {
          if (isActiveLine) {
            if (isActiveWord) {
              wordClass = 'bg-primary text-primary-foreground border-primary font-bold shadow-sm px-1 py-0.5 rounded border';
            } else if (isPastWord) {
              wordClass = 'text-primary/80 font-bold border-transparent px-1 py-0.5 rounded border';
            } else {
              wordClass = 'text-foreground font-bold border-transparent px-1 py-0.5 rounded border';
            }
          } else {
            wordClass = 'text-muted-foreground/60 border-transparent px-1 py-0.5 rounded border';
          }
        } else {
          if (isActiveLine) {
            if (isActiveWord) {
              wordClass = 'bg-primary text-primary-foreground border-primary font-bold shadow-sm px-1 py-0.5 rounded border';
            } else {
              wordClass = 'text-foreground font-bold border-transparent px-1 py-0.5 rounded border';
            }
          } else {
            wordClass = 'text-foreground font-semibold border-transparent px-1 py-0.5 rounded border';
          }
        }
      }

      const isWordClickable = isActiveLine && isPronunciationMode;
      const isSelectedForPractice = isActiveLine && isPronunciationMode && selectedWordIndices.has(i);
      
      if (isSelectedForPractice) {
        if (isZenMode && zenTheme === 'sepia') {
          wordClass = 'bg-[#8b5a2b]/25 text-[#5c4033] border-[#8b5a2b]/50 border rounded px-1 py-0.5 shadow-sm font-black';
        } else if (isZenMode && zenTheme === 'dark-matte') {
          wordClass = 'bg-[#51afef]/25 text-[#cbd5e1] border-[#51afef]/50 border rounded px-1 py-0.5 shadow-sm font-black';
        } else {
          wordClass = 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 border rounded px-1 py-0.5 shadow-sm font-black';
        }
      }

      return (
        <span
          key={i}
          ref={isActiveWord ? activeWordRef : undefined}
          className={`inline-block transition-all duration-150 ${wordClass} ${
            isWordClickable ? 'cursor-pointer hover:bg-amber-500/5 hover:border-amber-500/20 select-none' : ''
          }`}
          onMouseDown={(e) => {
            if (isWordClickable) {
              handleWordMouseDown(i, e);
            }
          }}
          onMouseEnter={() => {
            if (isWordClickable) {
              handleWordMouseEnter(i);
            }
          }}
          onContextMenu={(e) => {
            if (isWordClickable) {
              e.preventDefault();
              e.stopPropagation();
              const cleanedWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").trim();
              if (cleanedWord) {
                const rect = e.currentTarget.getBoundingClientRect();
                setLookupText(cleanedWord);
                setLookupPosition({
                  top: rect.top + window.scrollY - 8,
                  left: rect.left + rect.width / 2 + window.scrollX
                });
                setIsLookupVisible(true);
              }
            }
          }}
        >
          {word}
        </span>
      );
    });
  };

  const renderVitrineText = (rawText: string | undefined) => {
    if (!rawText) {
      return (
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-2 shadow-sm">
          <HelpCircle size={32} className="mx-auto text-muted-foreground/40 animate-pulse" />
          <p className="text-sm font-semibold text-foreground">Sem conteúdo brutas do PDF</p>
          <p className="text-xs text-muted-foreground">
            Esta lição não possui texto bruto do PDF disponível.
          </p>
        </div>
      );
    }

    // Split by page marker "--- PAGE \d+ ---"
    const pages = rawText.split(/--- PAGE \d+ ---/gi);
    const matches = [...rawText.matchAll(/--- PAGE (\d+) ---/gi)];
    const pageNumbers = matches.map((m) => m[1]);

    if (pages.length <= 1) {
      return (
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm leading-relaxed whitespace-pre-wrap text-sm text-foreground font-sans font-medium tracking-wide">
          {rawText}
        </div>
      );
    }

    // If first chunk is empty (which happens if file starts with page marker), remove it
    const hasEmptyFirst = !pages[0].trim();
    const cleanPages = hasEmptyFirst ? pages.slice(1) : pages;
    const cleanPageNumbers = hasEmptyFirst ? pageNumbers : ['', ...pageNumbers];

    return (
      <div className="space-y-6">
        {cleanPages.map((pageContent, idx) => {
          const pageNum = cleanPageNumbers[idx] || (idx + 1).toString();
          if (!pageContent.trim()) return null;
          return (
            <div
              key={idx}
              className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-xs font-black text-foreground uppercase tracking-widest">
                    PÁGINA {pageNum}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase bg-muted px-2 py-0.5 rounded border border-border">
                  Layout Original do PDF
                </span>
              </div>
              <div className="text-sm leading-[1.8] text-foreground whitespace-pre-line font-sans font-medium tracking-wide">
                {pageContent.trim()}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ═══════════════════════════════════════════
  // READER VIEW
  // ═══════════════════════════════════════════

  if (selectedText) {
    const masteredCount = selectedText.lines.filter((l) => l.mastered).length;

    const speedSelector = (
      <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground select-none">
        <Volume2 size={14} className={
          isZenMode && zenTheme === 'sepia'
            ? 'text-[#5c4033]/70'
            : isZenMode && zenTheme === 'dark-matte'
            ? 'text-[#cbd5e1]/70'
            : 'text-muted-foreground'
        } />
        <span className={
          isZenMode && zenTheme === 'sepia'
            ? 'text-[#5c4033]/70'
            : isZenMode && zenTheme === 'dark-matte'
            ? 'text-[#cbd5e1]/70'
            : 'text-muted-foreground'
        }>Velocidade:</span>
        <div className="flex items-center gap-1">
          {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-all ${
                playbackSpeed === speed
                  ? (
                      isZenMode && zenTheme === 'sepia'
                        ? 'bg-[#8b5a2b] text-[#f4ecd8]'
                        : isZenMode && zenTheme === 'dark-matte'
                        ? 'bg-[#51afef] text-[#1a1c23]'
                        : 'bg-primary text-primary-foreground'
                    )
                  : (
                      isZenMode && zenTheme === 'sepia'
                        ? 'hover:bg-[#8b5a2b]/10 text-[#5c4033]/70'
                        : isZenMode && zenTheme === 'dark-matte'
                        ? 'hover:bg-white/10 text-[#cbd5e1]/70'
                        : 'hover:bg-muted text-muted-foreground'
                    )
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    );

    return (
      <div ref={readerContainerRef} className="space-y-0 w-full max-w-none relative">
        {/* Header */}
        {!isZenMode && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 md:px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedTextId(null); stopPlayback(); }}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="flex flex-col">
                <h2 className="font-extrabold text-md text-foreground tracking-tight">{selectedText.title}</h2>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Frases {masteredCount}/{selectedText.lines.length}
                </span>
              </div>
            </div>

            {/* Tabs & Focus button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/50 border border-border rounded-xl p-1 gap-1">
                <button
                  onClick={() => { setActiveReaderTab('lineByLine'); stopPlayback(); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReaderTab === 'lineByLine'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Linha a Linha
                </button>
                <button
                  onClick={() => { setActiveReaderTab('textAudio'); stopPlayback(); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReaderTab === 'textAudio'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Texto + Áudio
                </button>
                <button
                  onClick={() => { setActiveReaderTab('vitrine'); stopPlayback(); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeReaderTab === 'vitrine'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Vitrine de Leitura
                </button>
              </div>
              
              {activeReaderTab === 'textAudio' && (
                <button
                  onClick={() => setIsZenMode(true)}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm h-[38px] w-[38px] flex items-center justify-center"
                  title="Modo Foco (Zen Mode)"
                >
                  <EyeOff size={15} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating header when in Zen Mode */}
        {isZenMode && (
          <div className={`flex justify-between items-center px-4 py-3 border-b sticky top-0 z-30 animate-fadeIn transition-all duration-300 ${
            zenTheme === 'sepia'
              ? 'bg-[#f4ecd8] border-[#8b5a2b]/20 text-[#5c4033]'
              : zenTheme === 'dark-matte'
              ? 'bg-[#1a1c23] border-white/10 text-[#cbd5e1]'
              : 'bg-card/65 backdrop-blur-md border-border text-foreground'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                zenTheme === 'sepia'
                  ? 'bg-[#8b5a2b]'
                  : zenTheme === 'dark-matte'
                  ? 'bg-[#51afef]'
                  : 'bg-primary'
              }`} />
              <span className="text-xs font-black uppercase tracking-widest truncate max-w-[150px] sm:max-w-xs">{selectedText.title}</span>
            </div>
            
            {/* Theme Selector & Exit Button */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center rounded-lg p-0.5 gap-1 border ${
                zenTheme === 'sepia'
                  ? 'bg-[#8b5a2b]/5 border-[#8b5a2b]/20'
                  : zenTheme === 'dark-matte'
                  ? 'bg-white/5 border-white/10'
                  : 'bg-muted border-border'
              }`}>
                {(['default', 'sepia', 'dark-matte'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleSetZenTheme(t)}
                    className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                      zenTheme === t
                        ? (
                            t === 'sepia'
                              ? 'bg-[#8b5a2b] text-[#f4ecd8]'
                              : t === 'dark-matte'
                              ? 'bg-[#51afef] text-[#1a1c23]'
                              : 'bg-primary text-primary-foreground'
                          )
                        : (
                            t === 'sepia'
                              ? 'text-[#5c4033]/70 hover:text-[#5c4033]'
                              : t === 'dark-matte'
                              ? 'text-[#cbd5e1]/70 hover:text-[#cbd5e1]'
                              : 'text-muted-foreground hover:text-foreground'
                          )
                    }`}
                  >
                    {t === 'default' ? 'Padrão' : t === 'sepia' ? 'Sépia' : 'Matte'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsZenMode(false)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer border shadow-sm flex items-center gap-1 uppercase tracking-wider ${
                  zenTheme === 'sepia'
                    ? 'bg-[#8b5a2b] text-[#f4ecd8] border-[#8b5a2b] hover:bg-[#8b5a2b]/90'
                    : zenTheme === 'dark-matte'
                    ? 'bg-[#51afef] text-[#1a1c23] border-[#51afef] hover:bg-[#51afef]/90'
                    : 'bg-primary text-primary-foreground border-border hover:bg-primary/95'
                }`}
              >
                <Maximize2 size={10} /> Sair do Foco
              </button>
            </div>
          </div>
        )}

        {/* TAB: Linha a Linha */}
        {activeReaderTab === 'lineByLine' && (
          <div className="px-2 md:px-6 py-4 space-y-3">
            {/* Header actions */}
            {selectedText.lines.length > 0 && (
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {selectedText.lines.length} frase{selectedText.lines.length !== 1 ? 's' : ''} · arraste para reordenar
                </span>
                <Button
                  onClick={handleOpenAddToDeck}
                  disabled={decks.length === 0}
                  title={decks.length === 0 ? 'Crie um baralho primeiro em Baralhos' : undefined}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-xl cursor-pointer gap-1.5 h-8"
                >
                  <BookOpen size={12} /> Adicionar ao Baralho
                </Button>
              </div>
            )}

            {selectedText.lines.length === 0 ? (
              <div className="bg-card border border-border border-dashed rounded-2xl p-10 text-center space-y-3 shadow-inner">
                <BookOpen size={36} className="mx-auto text-muted-foreground/30 animate-pulse" />
                <h3 className="text-sm font-bold text-foreground">Este texto está vazio</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Adicione frases manualmente ou importe o conteúdo de um PDF/texto (com tradução via IA) para começar a estudar.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => setIsAppending(true)}
                    variant="outline"
                    className="text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-9"
                  >
                    <Plus size={14} /> Adicionar Frase Manual
                  </Button>
                  <Button
                    onClick={() => setIsAppendBlockModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-9"
                  >
                    <Upload size={14} /> Importar do PDF / Texto em Lote
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedText.lines.map((line, idx) => (
                  editingLineIdx === idx ? (
                    /* ── EDIT MODE ── */
                    <div
                      key={idx}
                      className="bg-primary/5 border border-primary/30 rounded-2xl p-4 space-y-3 animate-fadeIn"
                    >
                      <span className="text-[10px] font-black uppercase text-primary tracking-wider">Editar frase #{idx + 1}</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Original</label>
                          <textarea
                            className="w-full bg-muted border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:border-primary/50 font-semibold resize-none min-h-[60px]"
                            value={editLineOriginal}
                            onChange={e => setEditLineOriginal(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Tradução</label>
                          <textarea
                            className="w-full bg-muted border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:border-primary/50 font-semibold resize-none min-h-[60px]"
                            value={editLineTranslated}
                            onChange={e => setEditLineTranslated(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setEditingLineIdx(null)}
                          className="text-[10px] font-bold rounded-lg cursor-pointer h-8"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSaveEditLine}
                          disabled={!editLineOriginal.trim()}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold rounded-lg cursor-pointer h-8"
                        >
                          <Check size={12} /> Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      layout
                      key={line.id || `line-${idx}`}
                      id={`line-card-${idx}`}
                      onClick={(e) => {
                        if (e.altKey && activeLineIdx >= 0 && activeLineIdx !== idx) {
                          handleMoveLineTo(activeLineIdx, idx);
                        } else {
                          setActiveLineIdx(idx);
                        }
                      }}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200 group cursor-pointer ${
                        dragOverIdx === idx
                          ? 'border-primary/60 bg-primary/5 scale-[1.01]'
                          : activeLineIdx === idx
                          ? 'border-violet-500 bg-violet-500/[0.03] shadow-sm ring-1 ring-violet-500/30'
                          : line.mastered
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-card border-border hover:border-border/80'
                      }`}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    >
                      {/* Drag handle */}
                      <div className="flex-shrink-0 pt-1 cursor-grab opacity-30 group-hover:opacity-70 transition-opacity select-none">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-muted-foreground">
                          <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
                          <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
                          <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
                        </svg>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-relaxed">
                          {renderHighlightedText(line.original, line.highlights)}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {line.translated}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); speakText(line.original); }}
                          className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-colors cursor-pointer border border-border bg-card shadow-sm"
                          title="Ouvir frase"
                        >
                          <Play size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyLine(line.original, idx); }}
                          className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm"
                          title="Copiar frase"
                        >
                          {copiedLineIdx === idx ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEditLine(idx); }}
                          className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm"
                          title="Editar frase"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingLineIdx(idx); }}
                          className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer border border-border bg-card shadow-sm"
                          title="Deletar frase"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleMastered(idx); }}
                          className={`p-2 rounded-xl transition-colors cursor-pointer border shadow-sm ${
                            line.mastered
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20'
                              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                          title={line.mastered ? 'Desmarcar dominada' : 'Marcar como dominada'}
                        >
                          <Check size={13} />
                        </button>
                      </div>
                    </motion.div>
                  )
                ))}
              </div>
            )}

            {isAppending && (
              <div className="bg-card border border-border border-dashed rounded-2xl p-4 space-y-3 animate-fadeIn mt-3">
                <span className="text-[10px] font-black uppercase text-primary tracking-wider">Adicionar Nova Frase</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Frase original..."
                    className="w-full bg-muted border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:border-primary/50 font-semibold"
                    value={appendOriginal}
                    onChange={(e) => setAppendOriginal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.currentTarget.parentElement?.querySelector('input[placeholder="Tradução..."]') as HTMLInputElement | null)?.focus();
                      }
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Tradução..."
                    className="w-full bg-muted border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:border-primary/50 font-semibold"
                    value={appendTranslated}
                    onChange={(e) => setAppendTranslated(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAppendSentence();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAppending(false);
                      setAppendOriginal('');
                      setAppendTranslated('');
                    }}
                    className="text-[10px] font-bold rounded-lg cursor-pointer h-8"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAppendSentence}
                    disabled={!appendOriginal.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold rounded-lg cursor-pointer h-8"
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            {!isAppending && selectedText.lines.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => setIsAppending(true)}
                  className="py-3 bg-muted/30 border border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Adicionar Frase Manual
                </button>
                <button
                  onClick={() => setIsAppendBlockModalOpen(true)}
                  className="py-3 bg-muted/30 border border-dashed border-border rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload size={14} /> Importar do PDF / Texto em Lote
                </button>
              </div>
            )}
          </div>
        )}


        {/* TAB: Texto + Áudio (Karaokê) */}
        {activeReaderTab === 'textAudio' && (
          selectedText.lines.length === 0 ? (
            <div className="px-2 md:px-6 py-10">
              <div className="bg-card border border-border border-dashed rounded-2xl p-10 text-center space-y-3 shadow-inner">
                <BookOpen size={36} className="mx-auto text-muted-foreground/30 animate-pulse" />
                <h3 className="text-sm font-bold text-foreground">Sem áudio para reproduzir</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Adicione frases na aba "Linha a Linha" para poder praticar a escuta com áudio/karaokê.
                </p>
                <div className="pt-2">
                  <Button
                    onClick={() => setActiveReaderTab('lineByLine')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-9"
                  >
                    Ir para Linha a Linha
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={
              isZenMode
                ? `fixed inset-0 z-50 overflow-y-auto pb-28 flex flex-col transition-all duration-300 ${
                    zenTheme === 'sepia'
                      ? 'bg-[#f4ecd8] text-[#5c4033]'
                      : zenTheme === 'dark-matte'
                      ? 'bg-[#1a1c23] text-[#cbd5e1]'
                      : 'bg-background text-foreground'
                  }`
                : `py-4 space-y-4 pb-28 animate-fadeIn ${isZenMode ? 'px-4' : 'px-2 md:px-6'}`
            }>
            {/* Toggle Tradução */}
            {!isZenMode && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  {readingPracticeMode === 'speaking' ? 'Modo Treino de Pronúncia Ativo' : readingPracticeMode === 'writing' ? 'Modo Treino de Escrita Ativo' : 'Destaque Interativo (Clique para ouvir de onde quiser)'}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border/60">
                    <button
                      onClick={() => {
                        stopPlayback();
                        setReadingPracticeMode('none');
                      }}
                      className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        readingPracticeMode === 'none'
                          ? 'bg-card text-foreground shadow-sm shadow-black/5 dark:shadow-white/5 border border-border/40'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50 border border-transparent'
                      }`}
                    >
                      <BookOpen size={11} />
                      Leitura
                    </button>
                    <button
                      onClick={() => {
                        stopPlayback();
                        setReadingPracticeMode('speaking');
                        if (activeLineIdx < 0) setActiveLineIdx(0);
                      }}
                      className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        readingPracticeMode === 'speaking'
                          ? 'bg-card text-foreground shadow-sm shadow-black/5 dark:shadow-white/5 border border-border/40'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50 border border-transparent'
                      }`}
                    >
                      <Mic size={11} className={isListeningSpeech ? 'animate-pulse text-destructive' : ''} />
                      Modo Fala
                    </button>
                    <button
                      onClick={() => {
                        stopPlayback();
                        setReadingPracticeMode('writing');
                        const startIdx = activeLineIdx >= 0 ? activeLineIdx : 0;
                        if (activeLineIdx < 0) setActiveLineIdx(0);
                        // Auto-speak the line
                        setTimeout(() => {
                          if (selectedText) {
                            speakText(selectedText.lines[startIdx].original);
                            const input = document.getElementById(`writing-input-${startIdx}`);
                            if (input) input.focus();
                          }
                        }, 100);
                      }}
                      className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        readingPracticeMode === 'writing'
                          ? 'bg-card text-foreground shadow-sm shadow-black/5 dark:shadow-white/5 border border-border/40'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/50 border border-transparent'
                      }`}
                    >
                      <Keyboard size={11} />
                      Modo Escrita
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                        showTranslation
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                      title={showTranslation ? 'Ocultar a tradução de todas as frases do texto' : 'Mostrar a tradução de todas as frases do texto'}
                    >
                      <Eye size={11} />
                      <span>{showTranslation ? 'Tradução Geral: Visível' : 'Tradução Geral: Oculta'}</span>
                    </button>

                    <button
                      onClick={() => setHideActiveTranslation(!hideActiveTranslation)}
                      className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                        hideActiveTranslation
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                          : 'border-border bg-card text-zinc-500 hover:text-foreground hover:bg-muted'
                      }`}
                      title="Se ativado, a tradução da frase selecionada ficará oculta por padrão até que você clique nela"
                    >
                      {hideActiveTranslation ? <EyeOff size={11} /> : <Eye size={11} />}
                      <span>{hideActiveTranslation ? 'Ocultar Frase Ativa: Sim' : 'Ocultar Frase Ativa: Não'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Texto com Karaokê */}
            <div className={`mx-auto w-full transition-all duration-300 ${isZenMode ? 'max-w-2xl py-6 md:py-12' : ''}`}>
              <div className={`transition-all duration-300 ${isZenMode ? 'bg-transparent border-none shadow-none p-0' : 'bg-card border border-border rounded-2xl p-6 shadow-sm'}`}>
                <div className={isZenMode ? 'space-y-6 md:space-y-8' : 'space-y-4'}>
                  {linesWithRanges.map(({ index, line, start }) => {
                    const isActiveLine = activeLineIdx === index;
                    
                    let containerClass = '';
                    if (isActiveLine) {
                      if (isZenMode && zenTheme === 'sepia') {
                        containerClass = 'bg-[#8b5a2b]/10 border-[#8b5a2b]/25 shadow-sm opacity-100';
                      } else if (isZenMode && zenTheme === 'dark-matte') {
                        containerClass = 'bg-[#51afef]/10 border-[#51afef]/25 shadow-sm opacity-100';
                      } else {
                        containerClass = 'bg-primary/5 border-primary/20 shadow-sm opacity-100 dark:bg-primary/10 dark:border-primary/30';
                      }
                    } else {
                      if (isPlaying) {
                        containerClass = 'bg-transparent border-transparent opacity-40 hover:opacity-75 transition-opacity duration-300';
                      } else {
                        if (isZenMode && zenTheme === 'sepia') {
                          containerClass = 'bg-transparent border-transparent opacity-100 hover:bg-[#8b5a2b]/5';
                        } else if (isZenMode && zenTheme === 'dark-matte') {
                          containerClass = 'bg-transparent border-transparent opacity-100 hover:bg-[#51afef]/5';
                        } else {
                          containerClass = 'bg-transparent border-transparent opacity-100 hover:bg-muted/30';
                        }
                      }
                    }

                    const displayOriginalText = readingPracticeMode === 'writing' &&
                      (!isActiveLine || writingIsCorrect === null)
                      ? line.original.replace(/[a-zA-Z0-9]/g, '•')
                      : line.original;

                    return (
                      <div
                        key={index}
                        ref={isActiveLine ? activeLineRef : undefined}
                        onClick={() => {
                          if (isPronunciationMode) {
                            if (isListeningSpeech && recognitionRef.current) {
                              try { recognitionRef.current.abort(); } catch (e) {}
                            }
                            setActiveLineIdx(index);
                            setSpeechTranscript('');
                            setSpeechSimilarity(null);
                            setSpeechIsCorrect(null);
                            setSpeechWordDiffs([]);
                          } else if (readingPracticeMode === 'writing') {
                            setActiveLineIdx(index);
                            setWritingInput('');
                            setWritingCharDiffs([]);
                            setWritingIsCorrect(null);
                            speakText(line.original);
                            setTimeout(() => {
                              const input = document.getElementById(`writing-input-${index}`);
                              if (input) input.focus();
                            }, 100);
                          } else {
                            startFromSentence(index);
                          }
                        }}
                        data-line-index={index}
                        className={`p-3 rounded-xl transition-all duration-200 cursor-pointer border ${containerClass}`}
                      >
                        <p className={`font-semibold text-foreground flex flex-wrap gap-x-1 items-center transition-all ${
                          isZenMode
                            ? 'text-lg md:text-2xl leading-[2] md:leading-[2.2]'
                            : 'text-sm md:text-base leading-relaxed'
                        }`}>
                          {renderSentenceWithWordHighlights(displayOriginalText, start, isActiveLine)}
                        </p>
                        {(() => {
                          const isTranslationVisible = showTranslation || revealedLines.has(index) || (isActiveLine && !hideActiveTranslation);
                          
                          if (isTranslationVisible) {
                            if (line.translated) {
                              return (
                                <p 
                                  onClick={(e) => {
                                    if (revealedLines.has(index)) {
                                      e.stopPropagation();
                                      const newSet = new Set(revealedLines);
                                      newSet.delete(index);
                                      setRevealedLines(newSet);
                                    }
                                  }}
                                  className={`text-muted-foreground mt-1.5 font-medium leading-relaxed animate-fadeIn pl-2 border-l border-primary/30 hover:opacity-80 transition-opacity ${
                                    isZenMode ? 'text-sm md:text-base pl-3' : 'text-xs'
                                  } ${revealedLines.has(index) ? 'cursor-pointer' : ''}`}
                                  title={revealedLines.has(index) ? "Clique para ocultar tradução" : undefined}
                                >
                                  {line.translated}
                                </p>
                              );
                            } else {
                              return (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const translatedText = await translateWithMyMemory(line.original);
                                      if (translatedText && selectedText?.id) {
                                        const updatedLines = [...selectedText.lines];
                                        updatedLines[index].translated = translatedText;
                                        await db.texts.update(selectedText.id, { lines: updatedLines, updatedAt: Date.now() });
                                      }
                                    } catch (err) {
                                      console.error("Failed on-the-fly translation:", err);
                                    }
                                  }}
                                  className="text-[10px] text-primary font-bold hover:underline mt-1.5 flex items-center gap-1 cursor-pointer"
                                >
                                  <span>🌐 Traduzir frase gratuitamente</span>
                                </button>
                              );
                            }
                          } else {
                            if (line.translated) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newSet = new Set(revealedLines);
                                    newSet.add(index);
                                    setRevealedLines(newSet);
                                  }}
                                  className="text-[10px] text-amber-500/80 hover:text-amber-500 font-bold hover:underline mt-1.5 flex items-center gap-1.5 cursor-pointer animate-fadeIn bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/10 w-fit"
                                >
                                  <Eye size={10} />
                                  <span>Mostrar tradução</span>
                                </button>
                              );
                            } else {
                              return (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const translatedText = await translateWithMyMemory(line.original);
                                      if (translatedText && selectedText?.id) {
                                        const updatedLines = [...selectedText.lines];
                                        updatedLines[index].translated = translatedText;
                                        await db.texts.update(selectedText.id, { lines: updatedLines, updatedAt: Date.now() });
                                      }
                                    } catch (err) {
                                      console.error("Failed on-the-fly translation:", err);
                                    }
                                  }}
                                  className="text-[10px] text-primary font-bold hover:underline mt-1.5 flex items-center gap-1 cursor-pointer"
                                >
                                  <span>🌐 Traduzir frase gratuitamente</span>
                                </button>
                              );
                            }
                          }
                        })()}

                        {isActiveLine && isPronunciationMode && (
                          <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-col gap-2.5 w-full animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                className={`h-8 px-3 rounded-lg border-2 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-xs font-bold transition-all duration-200 ${
                                  isListeningSpeech
                                    ? 'bg-destructive/10 text-destructive border-destructive animate-pulse ring-4 ring-destructive/20'
                                    : 'bg-primary/10 border-primary text-primary hover:bg-primary/20'
                                }`}
                                onClick={() => handleStartSpeechRecognition()}
                              >
                                <Mic size={13} />
                                {isListeningSpeech ? 'Ouvindo...' : 'Gravar Pronúncia'}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 px-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                onClick={() => speakSentenceOrSelection(line.original)}
                                title="Ouvir pronúncia correta"
                              >
                                <Volume2 size={12} />
                                Ouvir Frase
                              </Button>

                              {selectedWordIndices.size > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-8 px-2.5 rounded-lg border border-dashed border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                  onClick={() => {
                                    setSelectedWordIndices(new Set());
                                    setSpeechTargetSnippet(null);
                                  }}
                                  title="Limpar seleção e praticar frase inteira"
                                >
                                  Limpar Seleção
                                </Button>
                              )}

                              {line.mastered && (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  ✓ Pronunciado
                                </span>
                              )}
                            </div>

                            {/* Speech feedback box */}
                            {speechSimilarity !== null && (
                              <div className="w-full max-w-xl p-2 rounded-xl border text-left text-xs space-y-1 bg-muted/40 border-border animate-in fade-in slide-in-from-top-1" title={speechTranscript}>
                                {speechIsCorrect ? (
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[11px]">
                                    {speechTargetSnippet ? '✨ Excelente Pronúncia do Trecho!' : '✨ Excelente Pronúncia!'} ({Math.round(speechSimilarity)}%)
                                  </span>
                                ) : (
                                  <span className="font-bold text-red-500 block text-[11px]">
                                    ❌ Pronúncia incorreta ({Math.round(speechSimilarity)}%)
                                  </span>
                                )}

                                {speechTargetSnippet && (
                                  <div className="border-t border-border/20 pt-1">
                                    <span className="text-[9px] text-zinc-400 block mb-0.5">Trecho Esperado:</span>
                                    <span className="font-bold text-foreground text-[11px] bg-primary/10 px-1.5 py-0.5 rounded font-mono inline-block mb-1">
                                      "{speechTargetSnippet}"
                                    </span>
                                  </div>
                                )}
                                
                                <div className="border-t border-border/20 pt-1">
                                  <span className="text-[9px] text-zinc-400 block mb-0.5">Você Falou:</span>
                                  <div className="font-bold text-[12px] tracking-wide flex flex-wrap gap-x-1 gap-y-0.5 leading-normal font-mono">
                                    {speechWordDiffs.length === 0 ? (
                                      <span className="text-zinc-500 italic">Sem transcrição</span>
                                    ) : (
                                      speechWordDiffs.filter(t => t.type !== 'missing').map((token, idx) => (
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
                                
                                {speechIsCorrect && (
                                  <div className="text-[8.5px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 animate-pulse pt-0.5">
                                    {speechTargetSnippet ? '🚀 Trecho correto! Continue praticando ou limpe a seleção para avançar.' : '🚀 Pronúncia correta! Avançando para a próxima frase...'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {isActiveLine && readingPracticeMode === 'writing' && (
                          <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-col gap-2.5 w-full animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 px-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                onClick={() => speakText(line.original)}
                                title="Ouvir áudio da frase"
                              >
                                <Volume2 size={12} />
                                Ouvir Frase
                              </Button>

                              {line.mastered && (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                  ✓ Masterizado
                                </span>
                              )}
                            </div>

                            {/* Input typing field */}
                            <div className="flex items-center gap-2 w-full max-w-xl">
                              <input
                                id={`writing-input-${index}`}
                                type="text"
                                value={writingInput}
                                onChange={(e) => setWritingInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCheckWritingPracticeAnswer();
                                  }
                                }}
                                placeholder="Digite a frase em inglês..."
                                className="flex-1 h-9 px-3 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                                autoFocus={isActiveLine}
                                disabled={writingIsCorrect === true}
                              />
                              <Button
                                type="button"
                                className="h-9 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold cursor-pointer"
                                onClick={handleCheckWritingPracticeAnswer}
                                disabled={writingIsCorrect === true}
                              >
                                Verificar
                              </Button>
                              {writingIsCorrect !== true && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-9 px-2.5 rounded-xl border border-border hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={handleRevealWritingAnswer}
                                >
                                  Revelar
                                </Button>
                              )}
                              {writingIsCorrect !== null && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-9 px-2.5 rounded-xl border border-border hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={handleNextWritingSentence}
                                >
                                  Pular
                                </Button>
                              )}
                            </div>

                            {/* Writing feedback box */}
                            {writingIsCorrect !== null && (
                              <div className="w-full max-w-xl p-3 rounded-xl border text-left text-xs space-y-2 bg-muted/40 border-border animate-in fade-in slide-in-from-top-1">
                                {writingIsCorrect ? (
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[11px]">
                                    ✨ Excelente Escrita!
                                  </span>
                                ) : (
                                  <span className="font-bold text-red-500 block text-[11px]">
                                    ❌ Resposta incorreta - compare abaixo:
                                  </span>
                                )}

                                {/* Compare side-by-side or stacked layout */}
                                <div className="space-y-1.5">
                                  <div>
                                    <span className="text-[9px] text-zinc-400 block mb-0.5">Esperado (Correto):</span>
                                    <div className="font-bold text-[12px] tracking-wide leading-normal font-mono text-foreground">
                                      {line.original}
                                    </div>
                                  </div>
                                  
                                  <div className="border-t border-border/20 pt-1.5">
                                    <span className="text-[9px] text-zinc-400 block mb-0.5">Você Digitou:</span>
                                    <div className="font-bold text-[12px] tracking-wide flex flex-wrap gap-x-0.5 gap-y-0.5 leading-normal font-mono whitespace-pre-wrap">
                                      {writingCharDiffs.length === 0 ? (
                                        <span className="text-zinc-500 italic">Vazio</span>
                                      ) : (
                                        writingCharDiffs.map((token, idx) => {
                                          if (token.type === 'correct') {
                                            return (
                                              <span key={idx} className="text-emerald-600 dark:text-emerald-400">
                                                {token.char}
                                              </span>
                                            );
                                          } else if (token.type === 'incorrect') {
                                            return (
                                              <span key={idx} className="text-red-500 line-through bg-red-500/10 px-0.5 rounded">
                                                {token.char}
                                              </span>
                                            );
                                          } else {
                                            // missing
                                            return (
                                              <span key={idx} className="text-amber-500 bg-amber-500/10 px-0.5 rounded font-black">
                                                {token.char}
                                              </span>
                                            );
                                          }
                                        })
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {writingIsCorrect && (
                                  <div className="text-[8.5px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 animate-pulse pt-0.5">
                                    🚀 Resposta correta! Avançando para a próxima frase...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Player fixo na base */}
            <div className={`fixed bottom-0 left-0 right-0 border-t px-4 py-3 z-50 shadow-lg transition-all duration-300 ${
              isZenMode && zenTheme === 'sepia'
                ? 'bg-[#f4ecd8]/95 backdrop-blur-lg border-[#8b5a2b]/20 text-[#5c4033]'
                : isZenMode && zenTheme === 'dark-matte'
                ? 'bg-[#1a1c23]/95 backdrop-blur-lg border-white/10 text-[#cbd5e1]'
                : 'bg-card/95 backdrop-blur-lg border-border'
            }`}>
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 w-full">
                {isPronunciationMode ? (
                  /* --- PRONUNCIATION CONTROLS --- */
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartSpeechRecognition()}
                          className={`p-3 rounded-full transition-colors cursor-pointer shadow-lg ${
                            isListeningSpeech
                              ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-600/30'
                              : (
                                  isZenMode && zenTheme === 'sepia'
                                    ? 'bg-[#8b5a2b] text-[#f4ecd8] hover:bg-[#8b5a2b]/90'
                                    : isZenMode && zenTheme === 'dark-matte'
                                    ? 'bg-[#51afef] text-[#1a1c23] hover:bg-[#51afef]/90'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                )
                          }`}
                          title={isListeningSpeech ? 'Parar microfone' : 'Gravar pronúncia'}
                        >
                          <Mic size={18} />
                        </button>
                        <button
                          onClick={() => {
                            if (activeLineIdx >= 0 && selectedText) {
                              speakSentenceOrSelection(selectedText.lines[activeLineIdx].original);
                            }
                          }}
                          className={`p-2 rounded-xl transition-colors cursor-pointer border ${
                            isZenMode && zenTheme === 'sepia'
                              ? 'border-[#8b5a2b]/30 hover:bg-[#8b5a2b]/10 text-[#5c4033]'
                              : isZenMode && zenTheme === 'dark-matte'
                              ? 'border-white/10 hover:bg-white/10 text-[#cbd5e1]'
                              : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                          title="Ouvir frase atual"
                          disabled={activeLineIdx < 0}
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>
                      {speedSelector}
                    </div>

                    <div className="flex-1 text-center hidden md:flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Modo Pronúncia: leia a frase ativa. (Dica: clique com botão direito ou segure para ver a transcrição/tradução)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePronunciationMode}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isZenMode && zenTheme === 'sepia'
                            ? 'bg-[#8b5a2b]/10 border-[#8b5a2b]/20 text-[#5c4033] hover:bg-[#8b5a2b]/20'
                            : isZenMode && zenTheme === 'dark-matte'
                            ? 'bg-white/5 border-white/10 text-[#cbd5e1] hover:bg-white/10'
                            : 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/15'
                        }`}
                      >
                        Parar Pronúncia
                      </button>
                    </div>
                  </div>
                ) : readingPracticeMode === 'writing' ? (
                  /* --- WRITING PRACTICE CONTROLS --- */
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (activeLineIdx >= 0 && selectedText) {
                              speakText(selectedText.lines[activeLineIdx].original);
                            }
                          }}
                          className={`p-3 rounded-full transition-colors cursor-pointer shadow-lg ${
                            isZenMode && zenTheme === 'sepia'
                              ? 'bg-[#8b5a2b] text-[#f4ecd8] hover:bg-[#8b5a2b]/90'
                              : isZenMode && zenTheme === 'dark-matte'
                              ? 'bg-[#51afef] text-[#1a1c23] hover:bg-[#51afef]/90'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          }`}
                          title="Ouvir frase atual"
                          disabled={activeLineIdx < 0}
                        >
                          <Volume2 size={18} />
                        </button>
                      </div>
                      {speedSelector}
                    </div>

                    <div className="flex-1 text-center hidden md:flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span>Modo Escrita: ouça o áudio e digite o que ouviu.</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          stopPlayback();
                          setReadingPracticeMode('none');
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isZenMode && zenTheme === 'sepia'
                            ? 'bg-[#8b5a2b]/10 border-[#8b5a2b]/20 text-[#5c4033] hover:bg-[#8b5a2b]/20'
                            : isZenMode && zenTheme === 'dark-matte'
                            ? 'bg-white/5 border-white/10 text-[#cbd5e1] hover:bg-white/10'
                            : 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/15'
                        }`}
                      >
                        Parar Escrita
                      </button>
                    </div>
                  </div>
                ) : (
                  /* --- STANDARD KARAOKE CONTROLS --- */
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePlayPause}
                        className={`p-3 rounded-full transition-colors cursor-pointer shadow-lg ${
                          isZenMode && zenTheme === 'sepia'
                            ? 'bg-[#8b5a2b] text-[#f4ecd8] hover:bg-[#8b5a2b]/90'
                            : isZenMode && zenTheme === 'dark-matte'
                            ? 'bg-[#51afef] text-[#1a1c23] hover:bg-[#51afef]/90'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                        title={isPlaying ? 'Pausar' : 'Play'}
                      >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <button
                        onClick={stopPlayback}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          isZenMode && zenTheme === 'sepia'
                            ? 'hover:bg-[#8b5a2b]/15 text-[#5c4033]/70 hover:text-[#5c4033]'
                            : isZenMode && zenTheme === 'dark-matte'
                            ? 'hover:bg-white/10 text-[#cbd5e1]/70 hover:text-[#cbd5e1]'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                        title="Parar"
                      >
                        <Square size={16} />
                      </button>
                    </div>
                    {speedSelector}
                  </>
                )}
              </div>
            </div>
            </div>
          )
        )}

        {/* TAB: Vitrine de Leitura */}
        {activeReaderTab === 'vitrine' && (
          <div className="px-2 md:px-6 py-4 space-y-4 animate-fadeIn">
            {selectedText.pdfFile ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 border border-border p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Layout Original (PDF)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setIsFullscreenPdfOpen(true)}
                      variant="outline"
                      className="text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-8 border-border bg-card hover:bg-muted"
                    >
                      <Maximize2 size={12} /> Tela Cheia
                    </Button>
                    <Button
                      onClick={() => window.open(pdfUrl || '', '_blank')}
                      variant="outline"
                      className="text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-8 border-border bg-card hover:bg-muted"
                    >
                      <ExternalLink size={12} /> Abrir em Nova Guia
                    </Button>
                  </div>
                </div>
                <div className="w-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <iframe
                    src={pdfUrl || ''}
                    className="w-full h-[78vh] border-0"
                    title={selectedText.title}
                  />
                </div>
              </div>
            ) : (
              renderVitrineText(selectedText.rawPdfText)
            )}
          </div>
        )}

        {/* Delete Line Confirmation Dialog */}
        <Dialog open={deletingLineIdx !== null} onOpenChange={(open) => !open && setDeletingLineIdx(null)}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-black">
                <Trash2 className="text-destructive" size={16} />
                Excluir frase?
              </DialogTitle>
            </DialogHeader>
            {deletingLineIdx !== null && selectedText?.lines[deletingLineIdx] && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
                  A seguinte frase será removida permanentemente:
                </p>
                <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground leading-relaxed line-clamp-3">
                    {selectedText.lines[deletingLineIdx].original}
                  </p>
                  {selectedText.lines[deletingLineIdx].translated && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {selectedText.lines[deletingLineIdx].translated}
                    </p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="flex justify-end gap-3 pt-3 border-t border-border/40 mt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingLineIdx(null)}
                className="rounded-xl font-bold text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (deletingLineIdx !== null) {
                    handleDeleteLine(deletingLineIdx);
                    setDeletingLineIdx(null);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-bold text-xs gap-1.5"
              >
                <Trash2 size={12} /> Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add to Deck Dialog */}
        <Dialog open={isAddToDeckOpen} onOpenChange={(open) => !open && setIsAddToDeckOpen(false)}>

          <DialogContent className="bg-card border-border sm:max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden p-0">
            <DialogHeader className="p-6 pb-4 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-foreground font-black">
                <BookOpen className="text-violet-500" size={18} />
                Adicionar Frases ao Baralho
              </DialogTitle>
            </DialogHeader>

            {addToDeckSuccess ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center animate-fadeIn p-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check size={28} className="text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-foreground">{addToDeckSuccess}</p>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Scrollable body content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[60vh]">
                  {/* Deck and Type selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Baralho de destino
                      </label>
                      <Select value={addToDeckId} onValueChange={setAddToDeckId}>
                        <SelectTrigger className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-semibold h-11 focus:border-primary/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {decks.map(d => (
                            <SelectItem key={d.id} value={d.id} className="text-sm font-semibold cursor-pointer">
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Modelo de Cartão
                      </label>
                      <Select value={addToDeckNoteType} onValueChange={(val: any) => setAddToDeckNoteType(val)}>
                        <SelectTrigger className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-semibold h-11 focus:border-primary/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic" className="text-sm font-semibold cursor-pointer">Básico</SelectItem>
                          <SelectItem value="reversed" className="text-sm font-semibold cursor-pointer">Básico + Reverso</SelectItem>
                          <SelectItem value="optional_reversed" className="text-sm font-semibold cursor-pointer">Básico (Invertido Opcional)</SelectItem>
                          <SelectItem value="typing" className="text-sm font-semibold cursor-pointer">Básico (Digite a Resposta)</SelectItem>
                          <SelectItem value="cloze" className="text-sm font-semibold cursor-pointer">Omissão de Palavras (Cloze)</SelectItem>
                          <SelectItem value="listening" className="text-sm font-semibold cursor-pointer">Prática de Audição (Listening)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
                        {addToDeckNoteType === 'basic' && "Cartão simples. Você vê a frente e tenta lembrar o verso."}
                        {addToDeckNoteType === 'reversed' && "Cria 2 cartões. Um normal (Frente ➔ Verso) e outro invertido (Verso ➔ Frente)."}
                        {addToDeckNoteType === 'optional_reversed' && "Cria um cartão normal, e permite criar um reverso apenas se preencher o 3º campo."}
                        {addToDeckNoteType === 'typing' && "Você vê a frente e precisa digitar exatamente o texto do verso."}
                        {addToDeckNoteType === 'cloze' && "Oculta partes do texto marcadas com {{c1::palavra}} para você adivinhar."}
                        {addToDeckNoteType === 'listening' && "Oculta o texto inicial, toca o áudio, e revela a resposta só após você responder."}
                      </p>
                    </div>
                  </div>

                  {/* Select all / Deselect all */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">
                      {selectedLineIdxs.size} de {selectedText?.lines.length} frases selecionadas
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedLineIdxs(new Set(selectedText?.lines.map((_, i) => i) || []))}
                        className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Selecionar todas
                      </button>
                      <span className="text-muted-foreground/40">·</span>
                      <button
                        onClick={() => setSelectedLineIdxs(new Set())}
                        className="text-[10px] font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  {/* Lines list */}
                  <div className="space-y-4">
                    {selectedText?.lines.map((line, idx) => {
                      const isSelected = selectedLineIdxs.has(idx);
                      const draft = draftCards[idx];
                      if (!draft) return null;

                      return (
                        <div
                          key={idx}
                          className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
                            isSelected
                              ? 'border-violet-500/40 bg-violet-500/5'
                              : 'border-border hover:border-border/80 hover:bg-muted/30 opacity-60'
                          }`}
                        >
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 w-4 h-4 accent-violet-500 cursor-pointer flex-shrink-0"
                              checked={isSelected}
                              onChange={() => handleToggleLineIdx(idx)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground leading-relaxed break-words line-clamp-1">{line.original}</p>
                            </div>
                          </label>

                          {isSelected && (
                            <div className="pl-7 grid gap-3 md:grid-cols-2">
                              {/* Campo 0: Frente / Cloze */}
                              <div className="space-y-1 col-span-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  {addToDeckNoteType === 'cloze' ? 'Texto com Omissão (use {{c1::palavra}})' : 'Frente (Idioma de Estudo)'}
                                </label>
                                <textarea
                                  className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg text-xs outline-none focus:border-violet-500 resize-y min-h-[60px]"
                                  value={draft.field0}
                                  onChange={(e) => setDraftCards(prev => ({ ...prev, [idx]: { ...prev[idx], field0: e.target.value } }))}
                                />
                              </div>

                              {/* Campo 1: Verso / Extra */}
                              <div className={`space-y-1 ${addToDeckNoteType === 'optional_reversed' ? 'col-span-1' : 'col-span-1 md:col-span-2'}`}>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                  {addToDeckNoteType === 'cloze' ? 'Texto Extra (Opcional)' : 'Verso (Tradução/Significado)'}
                                </label>
                                <textarea
                                  className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg text-xs outline-none focus:border-violet-500 resize-y min-h-[60px]"
                                  value={draft.field1}
                                  onChange={(e) => setDraftCards(prev => ({ ...prev, [idx]: { ...prev[idx], field1: e.target.value } }))}
                                />
                              </div>

                              {/* Campo 2: Gatilho Inverso (apenas optional_reversed) */}
                              {addToDeckNoteType === 'optional_reversed' && (
                                <div className="space-y-1 col-span-1">
                                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Adicionar Reverso? (Digite "y" p/ criar)
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-lg text-xs outline-none focus:border-violet-500 h-[60px]"
                                    value={draft.field2}
                                    placeholder='Ex: "y"'
                                    onChange={(e) => setDraftCards(prev => ({ ...prev, [idx]: { ...prev[idx], field2: e.target.value } }))}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter className="mx-0 mb-0 px-6 py-4 border-t border-border/40 bg-muted/30 flex justify-end gap-3 mt-auto">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddToDeckOpen(false)}
                    disabled={isAddingToDeck}
                    className="rounded-xl font-bold text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddToDeck}
                    disabled={isAddingToDeck || selectedLineIdxs.size === 0 || !addToDeckId}
                    className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs gap-1.5"
                  >
                    {isAddingToDeck ? (
                      <><Loader2 size={14} className="animate-spin" /> Adicionando...</>
                    ) : (
                      `Adicionar ${selectedLineIdxs.size} card${selectedLineIdxs.size !== 1 ? 's' : ''}`
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Fullscreen PDF Dialog */}
        <Dialog open={isFullscreenPdfOpen} onOpenChange={(open) => !open && setIsFullscreenPdfOpen(false)}>
          <DialogContent className="bg-card border-none ring-0 gap-0 max-w-none sm:max-w-none w-screen h-screen flex flex-col p-0 m-0 rounded-none top-0 left-0 translate-x-0 translate-y-0">
            <DialogHeader className="p-4 border-b border-border/40 pr-12 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-foreground font-black text-sm md:text-base">
                <BookOpen className="text-violet-500" size={18} />
                Visualizador de PDF · {selectedText?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 w-full bg-[#525659] overflow-hidden">
              <iframe
                src={pdfUrl || ''}
                className="w-full h-full border-0"
                title={selectedText?.title}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Append Block Dialog */}
        <Dialog open={isAppendBlockModalOpen} onOpenChange={(open) => !open && closeAppendBlockModal()}>

          <DialogContent className="bg-card border-border sm:max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-black">
                <Upload className="text-primary" size={18} />
                Importar e Anexar Frases (PDF / Texto)
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <span className="text-[11px] font-semibold text-muted-foreground block leading-relaxed">
                As frases extraídas abaixo serão anexadas ao final do texto atual: <strong className="text-foreground">{selectedText.title}</strong>.
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Texto Original e Tradução */}
                <div className="space-y-4 flex flex-col">
                  {/* Texto Original */}
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Texto Original (Idioma de estudo)
                    </label>
                    <textarea
                      placeholder="Cole aqui o texto em inglês, espanhol, etc..."
                      className="w-full bg-muted border border-border text-foreground p-3.5 rounded-xl text-xs outline-none focus:border-primary/50 flex-1 min-h-[150px] resize-y font-mono leading-relaxed transition-colors"
                      value={appendBlockOriginalText}
                      onChange={(e) => setAppendBlockOriginalText(e.target.value)}
                      disabled={appendBlockIsProcessing}
                    />
                  </div>

                  {/* Tradução */}
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Tradução (Seu idioma nativo)
                      </label>
                      {appendBlockMode !== 'manual' && (
                        <span className="text-[10px] font-bold text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 animate-fadeIn">
                          {appendBlockMode === 'gemini' ? 'Preenchida pela IA ✨' : 'Traduzido gratuitamente 🌐'}
                        </span>
                      )}
                    </div>
                    <textarea
                      placeholder="Cole aqui a tradução (ou deixe vazio se usar IA/MyMemory)..."
                      className="w-full bg-muted border border-border text-foreground p-3.5 rounded-xl text-xs outline-none focus:border-primary/50 flex-1 min-h-[150px] resize-y font-mono leading-relaxed transition-colors disabled:opacity-50"
                      value={appendBlockTranslatedText}
                      onChange={(e) => setAppendBlockTranslatedText(e.target.value)}
                      disabled={appendBlockIsProcessing || appendBlockMode !== 'manual'}
                    />
                  </div>
                </div>

                {/* Right Column: PDF e Métodos */}
                <div className="space-y-6 flex flex-col">
                  {/* PDF Dropzone */}
                  <div className="space-y-1.5">
                    <div className="relative flex items-center justify-center py-1 mb-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/60" />
                      </div>
                      <span className="relative bg-card px-4 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                        Extraia de um PDF
                      </span>
                    </div>

                    <div
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                        appendBlockIsPdfLoading
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'
                      }`}
                      onClick={() => !appendBlockIsPdfLoading && !appendBlockIsProcessing && document.getElementById('append-pdf-file-input')?.click()}
                    >
                      {appendBlockIsPdfLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={24} className="text-primary animate-spin" />
                          <span className="text-xs font-bold text-primary">Extraindo texto do PDF...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <Upload size={24} className="text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground">
                            {appendBlockPdfBlob ? `PDF Selecionado: ${(appendBlockPdfBlob as File).name}` : 'Arraste um PDF aqui ou clique para selecionar'}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60">
                            O texto extraído preencherá o campo "Texto Original"
                          </span>
                        </div>
                      )}
                      <input
                        id="append-pdf-file-input"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAppendBlockPdfUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                  {/* Método de Processamento / Tradução */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Método de Tradução e Segmentação
                    </label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {/* Gemini Option */}
                      <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                        appendBlockMode === 'gemini'
                          ? 'border-violet-500 bg-violet-500/5 dark:bg-violet-500/10'
                          : 'border-border/60 hover:bg-muted/30'
                      }`}>
                        <input
                          type="radio"
                          name="appendBlockMode"
                          value="gemini"
                          checked={appendBlockMode === 'gemini'}
                          onChange={() => setAppendBlockMode('gemini')}
                          disabled={appendBlockIsProcessing || !geminiApiKey.trim()}
                          className="mt-1.5 w-4 h-4 text-violet-600 border-zinc-300 dark:border-zinc-700 bg-background focus:ring-violet-500 cursor-pointer"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Sparkles size={12} className="text-violet-500" />
                            Segmentação e Tradução por IA (Gemini)
                          </span>
                          {!geminiApiKey.trim() ? (
                            <span className="text-[9px] text-destructive font-semibold">
                              Requer chave de API nas Configurações (Permite destacar palavras-chave)
                            </span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">
                              A IA segmenta por frases de forma contextualizada, traduz e destaca palavras difíceis
                            </span>
                          )}
                        </div>
                      </label>

                      {/* MyMemory Option */}
                      <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                        appendBlockMode === 'mymemory'
                          ? 'border-primary bg-primary/5'
                          : 'border-border/60 hover:bg-muted/30'
                      }`}>
                        <input
                          type="radio"
                          name="appendBlockMode"
                          value="mymemory"
                          checked={appendBlockMode === 'mymemory'}
                          onChange={() => setAppendBlockMode('mymemory')}
                          disabled={appendBlockIsProcessing}
                          className="mt-1.5 w-4 h-4 text-primary border-zinc-300 dark:border-zinc-700 bg-background focus:ring-primary cursor-pointer"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Upload size={12} className="text-primary" />
                            Tradução Automática Gratuita (MyMemory API)
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            Gratuito, sem necessidade de chave de API. Divide o texto em frases e traduz de forma independente
                          </span>
                        </div>
                      </label>

                      {/* Manual Option */}
                      <label className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                        appendBlockMode === 'manual'
                          ? 'border-border bg-muted/40'
                          : 'border-border/60 hover:bg-muted/30'
                      }`}>
                        <input
                          type="radio"
                          name="appendBlockMode"
                          value="manual"
                          checked={appendBlockMode === 'manual'}
                          onChange={() => setAppendBlockMode('manual')}
                          disabled={appendBlockIsProcessing}
                          className="mt-1.5 w-4 h-4 text-zinc-500 border-zinc-300 dark:border-zinc-700 bg-background focus:ring-zinc-400 cursor-pointer"
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground">
                            Manual (Segmentar por linha original ↔ tradução)
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            Crie cartões alinhando as linhas digitadas no campo original com as linhas do campo de tradução
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error */}
              {appendBlockErrorMsg && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold p-3 rounded-xl">
                  ❌ {appendBlockErrorMsg}
                </div>
              )}

              {/* Processing step */}
              {appendBlockIsProcessing && appendBlockProcessingStep && (
                <div className="bg-primary/10 border border-primary/20 text-primary text-xs font-bold p-3 rounded-xl flex items-center gap-2 animate-pulse">
                  <Loader2 size={14} className="animate-spin" />
                  {appendBlockProcessingStep}
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-border/40 mt-4">
              <Button
                variant="outline"
                onClick={closeAppendBlockModal}
                disabled={appendBlockIsProcessing}
                className="rounded-xl font-bold text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAppendBlockProcess}
                disabled={appendBlockIsProcessing || !appendBlockOriginalText.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs gap-1.5"
              >
                {appendBlockIsProcessing ? (
                  <><Loader2 size={14} className="animate-spin" /> Processando...</>
                ) : (
                  'Processar e Anexar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Título Sugerido */}
        <Dialog open={isTitleSuggestionModalOpen} onOpenChange={(open) => !open && setIsTitleSuggestionModalOpen(false)}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-black">
                <Sparkles className="text-primary animate-pulse" size={18} />
                Usar Título Sugerido?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Foi detectado um título no PDF extraído. Deseja atualizar o título do texto atual (<strong>{selectedText?.title}</strong>) para o sugerido?
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Título Sugerido do PDF
                </label>
                <input
                  type="text"
                  className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
                  value={pdfSuggestedTitleInput}
                  onChange={(e) => setPdfSuggestedTitleInput(e.target.value)}
                  placeholder="Ex: Título do PDF..."
                />
              </div>
              <DialogFooter className="flex justify-end gap-3 pt-3 border-t border-border/40 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTitleSuggestionModalOpen(false);
                    setPdfSuggestedTitle(null);
                    setPdfSuggestedTitleInput('');
                  }}
                  className="rounded-xl font-bold text-xs"
                >
                  Manter Atual
                </Button>
                <Button
                  onClick={handleConfirmSuggestedTitle}
                  disabled={!pdfSuggestedTitleInput.trim()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs"
                >
                  Usar Novo Título
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {activeReaderTab !== 'vitrine' && (
          <KeyboardShortcutCheatsheet
            positionClassName="fixed bottom-20 right-4"
            shortcuts={[
              { keys: ['Espaço'], description: 'Iniciar / Pausar áudio' },
              { keys: ['R'], description: 'Reiniciar áudio da frase' },
              { keys: ['Seta ↓'], description: 'Próxima frase' },
              { keys: ['Seta ↑'], description: 'Frase anterior' },
              { keys: ['Alt + ↓ / ↑', 'Alt + Clique'], description: 'Mover frase ativa' },
              { keys: ['D', 'M'], description: 'Marcar como Dominada' },
              { keys: ['E'], description: 'Editar frase ativa' },
              { keys: ['Esc'], description: 'Cancelar edição' },
              { keys: ['Seleção de Texto'], description: 'Pronúncia IPA / Figurada' },
              { keys: ['Botão Direito / Long Press'], description: 'Pronúncia no modo fala' },
            ]}
          />
        )}

        {isLookupVisible && lookupText && (
          <FloatingSelectionLookup
            text={lookupText}
            position={lookupPosition}
            onClose={() => setIsLookupVisible(false)}
            geminiApiKey={geminiApiKey}
            readingTitle={selectedText.title}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // COLLECTION DETAIL VIEW
  // ═══════════════════════════════════════════
  if (selectedCollectionId !== null) {
    const activeCollection = collections.find(c => c.id === selectedCollectionId);
    const collectionReadings = (readings?.filter(r => r.collectionId === selectedCollectionId) || [])
      .filter(r => selectedThemeFilter === 'all' || r.theme === selectedThemeFilter);
    const totalTexts = collectionReadings.length;
    const totalLines = collectionReadings.reduce((sum, r) => sum + r.lines.length, 0);
    const masteredLines = collectionReadings.reduce((sum, r) => sum + r.lines.filter(l => l.mastered).length, 0);
    const progress = totalLines > 0 ? Math.round((masteredLines / totalLines) * 100) : 0;

    return (
      <div className="space-y-5 w-full max-w-none px-2 md:px-6">
        {/* Detail view Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/85 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCollectionId(null)}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm"
              title="Voltar para Biblioteca"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20 flex-shrink-0" />
                <h2 className="font-extrabold text-md text-foreground tracking-tight truncate">
                  {activeCollection?.title || 'Coleção'}
                </h2>
              </div>
              {activeCollection?.description && (
                <span className="text-xs text-muted-foreground font-semibold mt-0.5 line-clamp-1">
                  {activeCollection.description}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {activeCollection && (
              <>
                <Button
                  variant="outline"
                  onClick={(e) => handleOpenEditCollection(e, activeCollection)}
                  className="text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-9"
                >
                  <Edit size={14} /> Editar Pasta
                </Button>
                <Button
                  variant="outline"
                  onClick={(e) => handleOpenDeleteCollection(e, activeCollection)}
                  className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-9 border border-border"
                >
                  <Trash2 size={14} /> Excluir Pasta
                </Button>
              </>
            )}
            <Button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-9"
            >
              <Plus size={14} /> Adicionar Texto
            </Button>
          </div>
        </div>

        {/* Consolidated stats card */}
        {totalTexts > 0 && (
          <div className="bg-muted/30 border border-border/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-inner animate-fadeIn">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] font-black text-muted-foreground/80 uppercase tracking-widest">Progresso Consolidado</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-foreground">{progress}%</span>
                <span className="text-xs text-muted-foreground font-semibold">
                  ({masteredLines} de {totalLines} frases dominadas)
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground border-t md:border-t-0 md:border-l border-border/60 pt-3 md:pt-0 md:pl-6 flex-shrink-0">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Textos</span>
                <p className="text-sm font-extrabold text-foreground">{totalTexts}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Criada em</span>
                <p className="text-sm font-extrabold text-foreground">
                  {activeCollection ? new Date(activeCollection.createdAt).toLocaleDateString('pt-BR') : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Texts in collection */}
        <div className="space-y-3">
          {collectionReadings.length > 0 ? (
            collectionReadings.map((reading) => {
              const masteredCount = reading.lines.filter((l) => l.mastered).length;
              const totalLines = reading.lines.length;
              const progress = totalLines > 0 ? Math.round((masteredCount / totalLines) * 100) : 0;
              const preview = reading.lines[0]?.original || reading.fullTextOriginal.slice(0, 80);

              return (
                <div
                  key={reading.id}
                  className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer group shadow-sm"
                  onClick={() => setSelectedTextId(reading.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {reading.category === 'movie' ? (
                          <span title="Filme" className="inline-flex"><Film size={14} className="text-cyan-400 flex-shrink-0 animate-fadeIn" /></span>
                        ) : reading.category === 'series' ? (
                          <span title="Seriado" className="inline-flex"><Tv size={14} className="text-violet-400 flex-shrink-0 animate-fadeIn" /></span>
                        ) : (
                          <FileText size={14} className="text-primary flex-shrink-0" />
                        )}
                        <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {reading.title}
                        </h3>
                        {reading.theme && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold">
                            #{reading.theme}
                          </span>
                        )}
                        {reading.cefrLevel && (
                          <span className={`text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-none shrink-0 ${
                            reading.cefrLevel === 'A1' || reading.cefrLevel === 'A2'
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-extrabold'
                              : reading.cefrLevel === 'B1' || reading.cefrLevel === 'B2'
                                ? 'bg-primary/10 border-primary/25 text-primary font-extrabold'
                                : 'bg-violet-500/10 border-violet-500/25 text-violet-600 dark:text-violet-400 font-extrabold'
                          }`}>
                            {reading.cefrLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                        {preview}...
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {new Date(reading.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-black text-muted-foreground">
                            {masteredCount}/{totalLines}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => handleOpenEditReading(e, reading)}
                        className="p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer border border-border bg-card shadow-sm"
                        title="Editar texto"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteReading(reading.id); }}
                        className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer border border-border bg-card shadow-sm"
                        title="Excluir texto"
                      >
                        <Trash2 size={13} />
                      </button>
                      <div className="p-2 rounded-xl text-muted-foreground group-hover:text-primary transition-colors">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3 shadow-sm">
              <FolderOpen size={40} className="mx-auto text-muted-foreground/30" />
              <h3 className="text-sm font-bold text-foreground">Esta coleção está vazia</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Adicione textos nesta pasta para começar a estudá-los.
              </p>
              <Button
                onClick={() => setIsImportModalOpen(true)}
                variant="outline"
                className="mt-2 text-xs font-bold rounded-xl cursor-pointer gap-1.5 animate-pulse"
              >
                <Plus size={14} /> Importar Texto
              </Button>
            </div>
          )}
        </div>

        <ReadingImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSave={handleSaveReading}
          preselectedCollectionId={selectedCollectionId || undefined}
        />

        {/* Criar Coleção Dialog */}
        <Dialog open={isCreatingCollection} onOpenChange={setIsCreatingCollection}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-black">
                <FolderPlus className="text-primary" size={18} />
                Criar Nova Coleção
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nome da Coleção
                </label>
                <input
                  type="text"
                  placeholder="Ex: Livro Jack Hannaford, Curso de Inglês..."
                  className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
                  value={newCollectionTitle}
                  onChange={(e) => setNewCollectionTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Descrição (Opcional)
                </label>
                <textarea
                  placeholder="Ex: Textos para estudar durante esta semana..."
                  className="w-full bg-muted border border-border text-foreground p-3 rounded-xl text-sm outline-none focus:border-primary/50 min-h-[80px] resize-none leading-relaxed transition-colors"
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-border/40 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingCollection(false);
                  setNewCollectionTitle('');
                  setNewCollectionDescription('');
                }}
                className="rounded-xl font-bold text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCollection}
                disabled={!newCollectionTitle.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs"
              >
                Criar Coleção
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Editar Coleção Dialog */}
        <Dialog open={!!editingCollection} onOpenChange={(open) => !open && setEditingCollection(null)}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-black">
                <Edit className="text-primary" size={18} />
                Editar Coleção
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nome da Coleção
                </label>
                <input
                  type="text"
                  className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
                  value={editCollectionTitle}
                  onChange={(e) => setEditCollectionTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Descrição (Opcional)
                </label>
                <textarea
                  className="w-full bg-muted border border-border text-foreground p-3 rounded-xl text-sm outline-none focus:border-primary/50 min-h-[80px] resize-none leading-relaxed transition-colors"
                  value={editCollectionDescription}
                  onChange={(e) => setEditCollectionDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-border/40 mt-4">
              <Button
                variant="outline"
                onClick={() => setEditingCollection(null)}
                className="rounded-xl font-bold text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEditCollection}
                disabled={!editCollectionTitle.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs"
              >
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Excluir Coleção Dialog */}
        <Dialog open={!!deletingCollection} onOpenChange={(open) => !open && setDeletingCollection(null)}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-black">
                <Trash2 className="text-destructive" size={18} />
                Excluir Coleção
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-foreground">
              <p className="text-sm font-semibold">
                Tem certeza de que deseja excluir a coleção <strong className="text-primary">{deletingCollection?.title}</strong>?
              </p>
              {associatedReadingsCount > 0 ? (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold p-3.5 rounded-xl space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    ⚠️ Atenção: Esta coleção contém {associatedReadingsCount} texto{associatedReadingsCount > 1 ? 's' : ''}.
                  </p>
                  <p className="font-medium text-muted-foreground leading-relaxed">
                    Você pode excluir tudo (incluindo todos os textos dentro dela) ou excluir apenas a pasta e manter os textos na biblioteca principal.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-semibold">
                  Esta coleção está vazia. Nenhuma lição será afetada.
                </p>
              )}
            </div>
            <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2.5 pt-4 border-t border-border/40 mt-4">
              <Button
                variant="outline"
                onClick={() => setDeletingCollection(null)}
                className="rounded-xl font-bold text-xs w-full sm:w-auto order-3 sm:order-1"
              >
                Cancelar
              </Button>
              
              {associatedReadingsCount > 0 && (
                <Button
                  onClick={() => handleDeleteCollection(false)}
                  className="bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl font-bold text-xs w-full sm:w-auto order-2"
                >
                  Excluir apenas a pasta
                </Button>
              )}
              
              <Button
                onClick={() => handleDeleteCollection(true)}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-bold text-xs w-full sm:w-auto order-1 sm:order-3"
              >
                {associatedReadingsCount > 0 ? 'Excluir tudo' : 'Excluir pasta'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Edição de Texto */}
        <Dialog open={!!editingReading} onOpenChange={(open) => !open && setEditingReading(null)}>
          <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                  <Pencil size={15} />
                </div>
                Editar Texto
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-semibold">
                Altere o título ou a descrição do texto. O conteúdo das frases não será alterado.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEditReading} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">Título *</label>
                <input
                  type="text"
                  required
                  value={editReadingTitle}
                  onChange={(e) => setEditReadingTitle(e.target.value)}
                  className="w-full bg-muted/40 border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground rounded-xl h-10 px-3 text-sm font-semibold transition-all"
                  placeholder="Título do texto"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground block">Descrição <span className="font-normal opacity-60">(opcional)</span></label>
                <textarea
                  value={editReadingDescription}
                  onChange={(e) => setEditReadingDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-muted/40 border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground rounded-xl px-3 py-2.5 text-sm font-semibold transition-all resize-none"
                  placeholder="Descrição ou anotação sobre este texto..."
                />
              </div>

              <DialogFooter className="pt-1 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingReading(null)}
                  className="w-full sm:w-auto border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold h-10 text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!editReadingTitle.trim()}
                  className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-10 text-xs rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Exclusão de Texto */}
        <Dialog open={!!textToDelete} onOpenChange={(open) => !open && setTextToDelete(null)}>
          <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <Trash2 size={28} />
            </div>
            <DialogHeader className="space-y-2 flex flex-col items-center">
              <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
                Excluir Texto
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground font-medium max-w-[280px]">
                Tem certeza que deseja apagar este texto? Essa ação é permanente.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 font-bold h-11 rounded-xl"
                onClick={() => setTextToDelete(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 font-bold h-11 rounded-xl shadow-sm"
                onClick={confirmDeleteReading}
              >
                Sim, excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ROOT VIEW
  const searchResults = searchQuery.trim().length >= 2
    ? (readings || []).flatMap(reading =>
        reading.lines
          .map((line, lineIdx) => ({ reading, line, lineIdx }))
          .filter(({ reading, line }) =>
            reading.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            line.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
            line.translated.toLowerCase().includes(searchQuery.toLowerCase())
          )
      ).slice(0, 40)
    : [];

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part)
            ? <mark key={i} className="bg-primary/20 text-primary font-bold rounded px-0.5">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4 w-full max-w-none px-2 md:px-6">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-md text-foreground tracking-tight flex items-center gap-2">
          <BookOpen size={18} className="text-primary" />
          Biblioteca de Leitura
        </h2>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCreatingCollection(true)}
            className="text-xs font-bold rounded-xl cursor-pointer gap-1.5 h-9"
          >
            <FolderPlus size={14} /> Nova Coleção
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted-foreground">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <input
          type="text"
          placeholder="Pesquisar em todos os textos e frases..."
          className="w-full bg-muted border border-border text-foreground pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* CEFR Level Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none animate-fadeIn">
        <span className="text-[10px] font-black uppercase text-muted-foreground mr-1.5 shrink-0">Filtrar CEFR:</span>
        {(['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => {
          const isSelected = selectedLevelFilter === lvl;
          return (
            <button
              key={lvl}
              onClick={() => setSelectedLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary border-primary text-primary-foreground font-black'
                  : 'bg-muted/40 hover:bg-muted border-border/80 text-muted-foreground hover:text-foreground font-semibold'
              }`}
            >
              {lvl === 'all' ? 'TODOS' : lvl}
            </button>
          );
        })}
      </div>

      {/* Theme Filter */}
      {availableThemes.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none animate-fadeIn mt-1">
          <span className="text-[10px] font-black uppercase text-muted-foreground mr-1.5 shrink-0">Filtrar Tema:</span>
          <button
            onClick={() => setSelectedThemeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
              selectedThemeFilter === 'all'
                ? 'bg-primary border-primary text-primary-foreground font-black'
                : 'bg-muted/40 hover:bg-muted border-border/80 text-muted-foreground hover:text-foreground font-semibold'
            }`}
          >
            TODOS
          </button>
          {availableThemes.map((theme) => {
            const isSelected = selectedThemeFilter === theme;
            return (
              <button
                key={theme}
                onClick={() => setSelectedThemeFilter(theme)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary border-primary text-primary-foreground font-black'
                    : 'bg-muted/40 hover:bg-muted border-border/80 text-muted-foreground hover:text-foreground font-semibold'
                }`}
              >
                #{theme}
              </button>
            );
          })}
        </div>
      )}

      {/* Search results */}
      {searchQuery.trim().length >= 2 && (
        <div className="space-y-2 animate-fadeIn">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{searchQuery}"
          </span>
          {searchResults.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-2 shadow-sm">
              <p className="text-sm font-bold text-foreground">Nenhum resultado encontrado</p>
              <p className="text-xs text-muted-foreground">Tente buscar por palavras diferentes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map(({ reading, line, lineIdx }) => (
                <div
                  key={`${reading.id}-${lineIdx}`}
                  className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all cursor-pointer group shadow-sm"
                  onClick={() => setSelectedTextId(reading.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <FileText size={12} className="text-primary flex-shrink-0" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-wider truncate">
                          {reading.title}
                        </span>
                        {reading.cefrLevel && (
                          <span className={`text-[7.5px] font-black uppercase px-1.2 py-0.2 rounded border leading-none shrink-0 ${
                            reading.cefrLevel === 'A1' || reading.cefrLevel === 'A2'
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-extrabold'
                              : reading.cefrLevel === 'B1' || reading.cefrLevel === 'B2'
                                ? 'bg-primary/10 border-primary/25 text-primary font-extrabold'
                                : 'bg-violet-500/10 border-violet-500/25 text-violet-600 dark:text-violet-400 font-extrabold'
                          }`}>
                            {reading.cefrLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-relaxed">
                        {highlightMatch(line.original, searchQuery)}
                      </p>
                      {line.translated && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {highlightMatch(line.translated, searchQuery)}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedLevelFilter === 'all' ? (
        collections.length > 0 ? (
          <div className="space-y-6">
            {/* Folders Section */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-black tracking-wider text-muted-foreground/80 pl-1">
                Coleções ({collections.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fadeIn">
                {collections.map((col) => {
                  const colReadings = (readings?.filter(r => r.collectionId === col.id) || [])
                    .filter(r => selectedThemeFilter === 'all' || r.theme === selectedThemeFilter);
                  
                  if (selectedThemeFilter !== 'all' && colReadings.length === 0) return null;
                  
                  const totalTexts = colReadings.length;
                  const totalLines = colReadings.reduce((sum, r) => sum + r.lines.length, 0);
                  const masteredLines = colReadings.reduce((sum, r) => sum + r.lines.filter(l => l.mastered).length, 0);
                  const progress = totalLines > 0 ? Math.round((masteredLines / totalLines) * 100) : 0;
                  
                  return (
                    <div
                      key={col.id}
                      onClick={() => setSelectedCollectionId(col.id)}
                      className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer group shadow-sm flex flex-col justify-between min-h-[140px] relative animate-fadeIn"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 rounded-xl group-hover:scale-105 transition-transform duration-200 flex-shrink-0">
                            <Folder className="w-5 h-5 fill-amber-500/20" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                              {col.title}
                            </h4>
                            {col.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1 font-medium leading-normal">
                                {col.description}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleOpenEditCollection(e, col)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm"
                            title="Editar Coleção"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={(e) => handleOpenDeleteCollection(e, col)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer border border-border bg-card shadow-sm"
                            title="Excluir Coleção"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black text-muted-foreground">
                          <span>{totalTexts} texto{totalTexts !== 1 ? 's' : ''}</span>
                          {totalTexts > 0 && <span>{progress}% concluído</span>}
                        </div>
                        {totalTexts > 0 ? (
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 italic font-semibold pl-0.5 block">Coleção vazia</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3 shadow-sm">
            <BookOpen size={40} className="mx-auto text-muted-foreground/30" />
            <h3 className="text-sm font-bold text-foreground">Nenhuma coleção adicionada</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Crie uma coleção para organizar seus textos de estudos.
            </p>
            <div className="flex justify-center gap-3 mt-4">
              <Button
                onClick={() => setIsCreatingCollection(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl cursor-pointer gap-1.5"
              >
                <FolderPlus size={14} /> Criar Coleção
              </Button>
            </div>
          </div>
        )
      ) : (
        /* RENDER FLAT LIST OF LEVEL-MATCHED READINGS */
        <div className="space-y-3 animate-fadeIn">
          <h3 className="text-xs uppercase font-black tracking-wider text-muted-foreground/80 pl-1">
            Textos de Nível {selectedLevelFilter}
          </h3>
          {(() => {
            const filteredReadings = (readings?.filter(r => r.cefrLevel === selectedLevelFilter) || [])
              .filter(r => selectedThemeFilter === 'all' || r.theme === selectedThemeFilter);
            if (filteredReadings.length === 0) {
              return (
                <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3 shadow-sm">
                  <BookOpen size={40} className="mx-auto text-muted-foreground/30" />
                  <p className="text-sm font-bold text-foreground">Nenhum texto encontrado</p>
                  <p className="text-xs text-muted-foreground">Não há textos cadastrados no nível {selectedLevelFilter} ainda.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReadings.map((reading) => {
                  const masteredCount = reading.lines.filter((l) => l.mastered).length;
                  const totalLines = reading.lines.length;
                  const progress = totalLines > 0 ? Math.round((masteredCount / totalLines) * 100) : 0;
                  const preview = reading.lines[0]?.original || reading.fullTextOriginal.slice(0, 80);

                  return (
                    <div
                      key={reading.id}
                      className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer group shadow-sm flex flex-col justify-between"
                      onClick={() => setSelectedTextId(reading.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {reading.category === 'movie' ? (
                              <span title="Filme" className="inline-flex"><Film size={14} className="text-cyan-400 flex-shrink-0 animate-fadeIn" /></span>
                            ) : reading.category === 'series' ? (
                              <span title="Seriado" className="inline-flex"><Tv size={14} className="text-violet-400 flex-shrink-0 animate-fadeIn" /></span>
                            ) : (
                              <FileText size={14} className="text-primary flex-shrink-0" />
                            )}
                            <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {reading.title}
                            </h4>
                            {reading.theme && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold">
                                #{reading.theme}
                              </span>
                            )}
                            <span className="text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-none shrink-0 bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400">
                              {reading.cefrLevel}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {preview}...
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={(e) => handleOpenEditReading(e, reading)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer border border-border bg-card shadow-sm"
                            title="Editar texto"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteReading(reading.id); }}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer border border-border bg-card shadow-sm"
                            title="Excluir texto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 border-t border-border/20 pt-3">
                        <div className="flex items-center justify-between text-[10px] font-black text-muted-foreground">
                          <span>{new Date(reading.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span>{masteredCount}/{totalLines} frases ({progress}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Criar Coleção Dialog */}
      <Dialog open={isCreatingCollection} onOpenChange={setIsCreatingCollection}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-black">
              <FolderPlus className="text-primary" size={18} />
              Criar Nova Coleção
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Nome da Coleção
              </label>
              <input
                type="text"
                placeholder="Ex: Livro Jack Hannaford, Curso de Inglês..."
                className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
                value={newCollectionTitle}
                onChange={(e) => setNewCollectionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Descrição (Opcional)
              </label>
              <textarea
                placeholder="Ex: Textos para estudar durante esta semana..."
                className="w-full bg-muted border border-border text-foreground p-3 rounded-xl text-sm outline-none focus:border-primary/50 min-h-[80px] resize-none leading-relaxed transition-colors"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-border/40 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreatingCollection(false);
                setNewCollectionTitle('');
                setNewCollectionDescription('');
              }}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCollection}
              disabled={!newCollectionTitle.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs"
            >
              Criar Coleção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar Coleção Dialog */}
      <Dialog open={!!editingCollection} onOpenChange={(open) => !open && setEditingCollection(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-black">
              <Edit className="text-primary" size={18} />
              Editar Coleção
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Nome da Coleção
              </label>
              <input
                type="text"
                className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
                value={editCollectionTitle}
                onChange={(e) => setEditCollectionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Descrição (Opcional)
              </label>
              <textarea
                className="w-full bg-muted border border-border text-foreground p-3 rounded-xl text-sm outline-none focus:border-primary/50 min-h-[80px] resize-none leading-relaxed transition-colors"
                value={editCollectionDescription}
                onChange={(e) => setEditCollectionDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-border/40 mt-4">
            <Button
              variant="outline"
              onClick={() => setEditingCollection(null)}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEditCollection}
              disabled={!editCollectionTitle.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs"
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir Coleção Dialog */}
      <Dialog open={!!deletingCollection} onOpenChange={(open) => !open && setDeletingCollection(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-black">
              <Trash2 className="text-destructive" size={18} />
              Excluir Coleção
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-foreground">
            <p className="text-sm font-semibold">
              Tem certeza de que deseja excluir a coleção <strong className="text-primary">{deletingCollection?.title}</strong>?
            </p>
            {associatedReadingsCount > 0 ? (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold p-3.5 rounded-xl space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  ⚠️ Atenção: Esta coleção contém {associatedReadingsCount} texto{associatedReadingsCount > 1 ? 's' : ''}.
                </p>
                <p className="font-medium text-muted-foreground leading-relaxed">
                  Você pode excluir tudo (incluindo todos os textos dentro dela) ou excluir apenas a pasta e manter os textos na biblioteca principal.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-semibold">
                Esta coleção está vazia. Nenhuma lição será afetada.
              </p>
            )}
          </div>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2.5 pt-4 border-t border-border/40 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingCollection(null)}
              className="rounded-xl font-bold text-xs w-full sm:w-auto order-3 sm:order-1"
            >
              Cancelar
            </Button>
            
            {associatedReadingsCount > 0 && (
              <Button
                onClick={() => handleDeleteCollection(false)}
                className="bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl font-bold text-xs w-full sm:w-auto order-2"
              >
                Excluir apenas a pasta
              </Button>
            )}
            
            <Button
              onClick={() => handleDeleteCollection(true)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl font-bold text-xs w-full sm:w-auto order-1 sm:order-3"
            >
              {associatedReadingsCount > 0 ? 'Excluir tudo' : 'Excluir pasta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão de Texto */}
      {/* Modal de Edição de Texto */}
      <Dialog open={!!editingReading} onOpenChange={(open) => !open && setEditingReading(null)}>
        <DialogContent className="sm:max-w-[460px] bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Pencil size={15} />
              </div>
              Editar Texto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Altere o título ou a descrição do texto. O conteúdo das frases não será alterado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditReading} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">Título *</label>
              <input
                type="text"
                required
                value={editReadingTitle}
                onChange={(e) => setEditReadingTitle(e.target.value)}
                className="w-full bg-muted/40 border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground rounded-xl h-10 px-3 text-sm font-semibold transition-all"
                placeholder="Título do texto"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground block">Descrição <span className="font-normal opacity-60">(opcional)</span></label>
              <textarea
                value={editReadingDescription}
                onChange={(e) => setEditReadingDescription(e.target.value)}
                rows={3}
                className="w-full bg-muted/40 border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground rounded-xl px-3 py-2.5 text-sm font-semibold transition-all resize-none"
                placeholder="Descrição ou anotação sobre este texto..."
              />
            </div>

            <DialogFooter className="pt-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingReading(null)}
                className="w-full sm:w-auto border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold h-10 text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!editReadingTitle.trim()}
                className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-10 text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!textToDelete} onOpenChange={(open) => !open && setTextToDelete(null)}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Trash2 size={28} />
          </div>
          <DialogHeader className="space-y-2 flex flex-col items-center">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              Excluir Texto
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground font-medium max-w-[280px]">
              Tem certeza que deseja apagar este texto? Essa ação é permanente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 font-bold h-11 rounded-xl"
              onClick={() => setTextToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-bold h-11 rounded-xl shadow-sm"
              onClick={confirmDeleteReading}
            >
              Sim, excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
