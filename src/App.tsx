import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Flame, Plus, Sparkles, Menu, User, 
  Search, Settings, Sun, Moon,
  ChevronLeft, LayoutDashboard, TrendingUp, ClipboardList,
  BookOpen, Info, MessageSquare, Timer, RefreshCw, Cloud,
  Lock, Key, Eye, EyeOff
} from 'lucide-react';

// Banco de Dados e Types
import { db, seedInitialData, ensureDefaultPreset, defaultPreset } from './db/db';
import type { Deck, Card, Note, DeckPreset } from './types';

// Utilitários
import { calculateNextReview } from './utils/srs';
import { resolveDeckPreset } from './utils/presets';
import { getStreak, recordStudy } from './utils/streak';
import { getDeckStudyableCards as calculateDeckStudyableCards } from './utils/limits';
import { syncNoteCards } from './utils/siblings';

// Páginas do Projeto
import { DashboardPage } from './pages/DashboardPage';
import { CardsPage } from './pages/CardsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReadingPage } from './pages/ReadingPage';
import { ConversationPage } from './pages/ConversationPage';
import { Toaster, toast } from 'sonner';

// Componentes do Projeto
import { DeckModal } from './components/DeckModal';
import { DeckOptionsModal } from './components/DeckOptionsModal';
import { CardModal } from './components/CardModal';
import { StudyArena } from './components/StudyArena';
import { CongratsScreen } from './components/CongratsScreen';
import { CardPreviewModal } from './components/CardPreviewModal';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { StatsDashboard } from './components/StatsDashboard';
import { AppGuideDocs } from './components/AppGuideDocs';
import { GlobalSearch } from './components/GlobalSearch';
import { AiGeneratorModal } from './components/AiGeneratorModal';
import { PomodoroWidget } from './components/PomodoroWidget';
import { getTagColors } from './utils/tagColors';

// Utilitários
import { setupNotifications, requestNotificationPermission, getNotificationPermission, clearAppBadge } from './utils/notifications';

// Sincronização e Criptografia com Google Drive
import { requestAccessToken, findBackupFile, downloadBackupFile, createBackupFile, updateBackupFile, revokeToken, getDriveUserProfile } from './utils/drive';
import { encryptData, decryptData } from './utils/crypto';
import { exportDatabase, performMergeSync } from './utils/sync';

// Componentes Shadcn UI
import { Button } from './components/ui/button';
import { Sheet, SheetContent } from './components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './components/ui/dialog';

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

const DRIVE_CLIENT_ID = '754580033922-j6fhjnrhe8gr1c0olic52tkcjp12j70s.apps.googleusercontent.com';

function App() {
  // --- ESTADO DE TEMA (CLARO/ESCURO) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('memorize_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('memorize_accent') || 'zinc';
  });

  // --- ESTADOS DE CONTROLE DE TELA ---
  const [currentView, setCurrentView] = useState<'dashboard' | 'study' | 'congrats'>('dashboard');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  
  // --- ESTADO DA SIDEBAR E NAVEGAÇÃO INTERNA ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stats' | 'cards' | 'profile' | 'settings' | 'history' | 'reading' | 'guide' | 'conversation'>('dashboard');
  const [guideInitialTab, setGuideInitialTab] = useState<'overview' | 'shortcuts' | 'reading' | 'srs_presets' | 'srs_math'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);

  const handleSetActiveTab = (
    tab: 'dashboard' | 'stats' | 'cards' | 'profile' | 'settings' | 'history' | 'reading' | 'guide' | 'conversation',
    subTab?: 'overview' | 'shortcuts' | 'reading' | 'srs_presets' | 'srs_math'
  ) => {
    setActiveTab(tab);
    if (tab === 'guide') {
      setGuideInitialTab(subTab || 'overview');
    }
  };
  const [isReadingZenMode, setIsReadingZenMode] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      setIsDesktopSidebarOpen(prev => !prev);
    } else {
      setIsSidebarOpen(prev => !prev);
    }
  };
  
  // --- ESTADO DE CONFIGURAÇÕES PERSISTIDAS ---
  const [selectedAlgo] = useState<'SM-2' | 'FSRS'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('memorize_algo');
      if (saved === 'SM-2' || saved === 'FSRS') return saved;
    }
    return 'SM-2';
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // --- CONFIGURAÇÕES DE TTS E ÁUDIO ---
  const [ttsRate, setTtsRate] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('memorize_tts_rate');
      return saved ? parseFloat(saved) : 1.0;
    }
    return 1.0;
  });

  const [ttsVoice, setTtsVoice] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('memorize_tts_voice') || '';
    }
    return '';
  });

  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('memorize_auto_play_audio');
      return saved !== 'false';
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('memorize_tts_rate', ttsRate.toString());
  }, [ttsRate]);

  useEffect(() => {
    localStorage.setItem('memorize_tts_voice', ttsVoice);
  }, [ttsVoice]);

  useEffect(() => {
    localStorage.setItem('memorize_auto_play_audio', autoPlayAudio.toString());
  }, [autoPlayAudio]);

  // --- ESTADO API GEMINI ---
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('memorize_gemini_api_key') || '';
    }
    return '';
  });



  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('memorize_gemini_api_key', geminiApiKey);
  }, [geminiApiKey]);


  // --- CONFIGURAÇÃO DE META DIÁRIA ---
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('memorize_daily_goal');
      return saved ? parseInt(saved, 10) : 20;
    }
    return 20;
  });

  const [userName, setUserName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('memorize_drive_user_profile');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          return parsed.displayName || '';
        } catch (e) {
          return '';
        }
      }
      return '';
    }
    return '';
  });

  const [userPhoto, setUserPhoto] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('memorize_drive_user_profile');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          return parsed.photoLink || '';
        } catch (e) {
          return '';
        }
      }
      return '';
    }
    return '';
  });

  const [userEmail, setUserEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('memorize_drive_user_profile');
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          return parsed.emailAddress || '';
        } catch (e) {
          return '';
        }
      }
      return '';
    }
    return '';
  });

  useEffect(() => {
    localStorage.setItem('memorize_daily_goal', dailyGoal.toString());
  }, [dailyGoal]);

  // --- ESTADOS DE SINCRONIZAÇÃO GOOGLE DRIVE ---
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('memorize_auto_sync') === 'true';
  });
  const [lastSyncTime, setLastSyncTime] = useState<number>(() => {
    return Number(localStorage.getItem('memorize_last_sync_time')) || 0;
  });
  const [driveAccessToken, setDriveAccessToken] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string>('');

  // Estados do Modal de Prompt de Senha
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);
  const [passwordPromptInput, setPasswordPromptInput] = useState('');
  const [pendingSyncMode, setPendingSyncMode] = useState<'upload' | 'download' | undefined>(undefined);
  const [showPromptPassword, setShowPromptPassword] = useState(false);

  useEffect(() => {
    localStorage.setItem('memorize_auto_sync', autoSyncEnabled.toString());
  }, [autoSyncEnabled]);

  // Limpeza de senhas antigas salvas para segurança
  useEffect(() => {
    if (localStorage.getItem('memorize_sync_password')) {
      localStorage.removeItem('memorize_sync_password');
    }
  }, []);

  // --- ESTADOS DE SESSÃO CRAM (REFORÇO) ---
  const [cramSessionCards, setCramSessionCards] = useState<Card[] | null>(null);

  // --- ESTADOS DE MODAIS ---
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState<Deck | null>(null);
  const [isDeckOptionsModalOpen, setIsDeckOptionsModalOpen] = useState(false);
  const [deckForOptions, setDeckForOptions] = useState<Deck | null>(null);
  
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [deckForNewCard, setDeckForNewCard] = useState<Deck | null>(null);
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [cardToPreview, setCardToPreview] = useState<Card | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDeckId, setExportDeckId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;
  const [activeDeckMenuId, setActiveDeckMenuId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- ESTADOS DE SESSÃO E STREAK ---
  const [streak, setStreak] = useState(0);
  const [sessionCardsStudied, setSessionCardsStudied] = useState(0);
  const [isStudyFilterModalOpen, setIsStudyFilterModalOpen] = useState(false);
  const [deckToStudyId, setDeckToStudyId] = useState<string | null>(null);
  const [selectedStudyTags, setSelectedStudyTags] = useState<string[]>([]);
  const [selectedStudyMode, setSelectedStudyMode] = useState<'classic' | 'writing' | 'speaking'>('classic');

  // --- BUSCA GLOBAL ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // --- SUPORTE A PWA ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User choice outcome: ${outcome}`);
    setDeferredPrompt(null);
  };

  // --- QUERIES REATIVAS (INDEXEDDB VIA DEXIE) ---
  const decks = useLiveQuery(() => db.decks.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());
  const revisions = useLiveQuery(() => db.revisions.toArray());
  const presets = useLiveQuery(() => db.presets.toArray());
  const readingSessions = useLiveQuery(() => db.readingSessions?.toArray());

  // --- EFFECT DE TEMA E INITIAL SEED ---
  useEffect(() => {
    seedInitialData().then(() => ensureDefaultPreset());
    const streakData = getStreak();
    setStreak(streakData.currentStreak);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('memorize_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-zinc', 'theme-blue', 'theme-green', 'theme-violet', 'theme-orange', 'theme-rose');
    root.classList.add(`theme-${accentColor}`);
    localStorage.setItem('memorize_accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('memorize_algo', selectedAlgo);
  }, [selectedAlgo]);

  useEffect(() => {
    setIsReadingZenMode(false);
  }, [activeTab]);

  // --- CTRL+K GLOBAL SEARCH LISTENER ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // --- CÁLCULOS E ESTATÍSTICAS DO DASHBOARD ---
  const todayStr = new Date().toISOString().split('T')[0];

  const getDeckPreset = (deck: Deck): DeckPreset => {
    return resolveDeckPreset(deck, presets || [], defaultPreset);
  };

  const getDeckStudyCountsToday = (deckId: string) => {
    if (!revisions || !cards) return { newStudied: 0, reviewsStudied: 0 };
    const deckCardsList = cards.filter(c => c.deckId === deckId);
    const deckCardIds = new Set(deckCardsList.map(c => c.id));
    const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
    
    const deckRevisions = revisions.filter(r => deckCardIds.has(r.cardId));
    const revisionsToday = deckRevisions.filter(r => r.timestamp >= startOfTodayMs);
    const revisedCardIdsToday = new Set(revisionsToday.map(r => r.cardId));
    
    let newStudied = 0;
    let reviewsStudied = 0;
    
    for (const cardId of revisedCardIdsToday) {
      const cardRevsToday = revisionsToday.filter(r => r.cardId === cardId).sort((a, b) => a.timestamp - b.timestamp);
      const firstRevToday = cardRevsToday[0];
      
      if (firstRevToday && firstRevToday.wasNew !== undefined) {
        if (firstRevToday.wasNew) {
          newStudied++;
        } else {
          reviewsStudied++;
        }
      } else {
        const hasPriorRevision = deckRevisions.some(r => r.cardId === cardId && r.timestamp < startOfTodayMs);
        if (hasPriorRevision) {
          reviewsStudied++;
        } else {
          newStudied++;
        }
      }
    }
    
    return { newStudied, reviewsStudied };
  };

  const getDeckStudyableCards = (deck: Deck, deckCards: Card[]) => {
    const preset = getDeckPreset(deck);
    const counts = getDeckStudyCountsToday(deck.id);
    const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
    const studiedCardIds = new Set(
      revisions
        ? revisions.filter(r => r.timestamp >= startOfTodayMs).map(r => r.cardId)
        : []
    );
    return calculateDeckStudyableCards(deck, deckCards, preset, counts, todayStr, decks, studiedCardIds);
  };

  const getDeckStudyableCounts = (deck: Deck, deckCards: Card[]) => {
    const studyable = getDeckStudyableCards(deck, deckCards);
    return {
      newCount: studyable.newCount,
      learningCount: studyable.learningCount,
      reviewCount: studyable.reviewCount,
      totalCount: studyable.totalCount
    };
  };

  // Capped totals for dashboard
  let totalNew = 0;
  let totalDue = 0;
  if (decks && cards) {
    for (const deck of decks) {
      const deckCards = cards.filter(c => c.deckId === deck.id);
      const studyable = getDeckStudyableCards(deck, deckCards);
      totalNew += studyable.newCount;
      totalDue += studyable.learningCount + studyable.reviewCount;
    }
  }

  const totalLearned = cards ? cards.filter(c => c.interval > 0 && c.dueDate > todayStr).length : 0;

  // --- NOTIFICAÇÕES (dispara quando totalDue muda) ---
  useEffect(() => {
    if (notificationsEnabled) {
      setupNotifications(totalNew + totalDue);
    }
  }, [totalNew, totalDue, notificationsEnabled]);

  // Limpa badge ao entrar no estudo
  useEffect(() => {
    if (currentView === 'study') clearAppBadge();
  }, [currentView]);

  // --- OPERAÇÕES CRUD DE DECKS ---
  const handleOpenNewDeckModal = () => {
    setDeckToEdit(null);
    setIsDeckModalOpen(true);
  };

  const handleOpenEditDeckModal = (deck: Deck) => {
    setDeckToEdit(deck);
    setIsDeckModalOpen(true);
  };

  const handleOpenDeckOptionsModal = (deck: Deck) => {
    setDeckForOptions(deck);
    setIsDeckOptionsModalOpen(true);
  };

  const handleSaveDeck = async (
    name: string,
    description: string
  ) => {
    if (deckToEdit) {
      await db.decks.update(deckToEdit.id, {
        name,
        description,
        updatedAt: Date.now()
      });
    } else {
      const newDeck: Deck = {
        id: crypto.randomUUID(),
        name,
        description,
        presetId: 'default-study-preset',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.decks.add(newDeck);
    }

    setIsDeckModalOpen(false);
    setDeckToEdit(null);
  };

  const handleSaveDeckOptions = async (
    presetId: string,
    overrides?: Partial<Deck>,
    presetUpdates?: Partial<DeckPreset>
  ) => {
    if (!deckForOptions) return;

    await db.decks.update(deckForOptions.id, {
      presetId,
      updatedAt: Date.now(),
      ...overrides
    });

    if (presetUpdates && presetId) {
      await db.presets.update(presetId, presetUpdates);
    }

    setIsDeckOptionsModalOpen(false);
    setDeckForOptions(null);
  };

  const handleDeleteDeck = async (deckId: string) => {
    await db.decks.delete(deckId);
    await db.cards.where('deckId').equals(deckId).delete();
    if (selectedDeckId === deckId) {
      setCurrentView('dashboard');
      setSelectedDeckId(null);
    }
  };

  // --- OPERAÇÕES CRUD DE PRESETS ---
  const handleSavePreset = async (preset: DeckPreset) => {
    await db.presets.put(preset);
  };

  const handleDeletePreset = async (presetId: string) => {
    if (presetId === 'default-study-preset') return;
    await db.presets.delete(presetId);
    
    // Decks using this preset should fall back to undefined
    const affectedDecks = await db.decks.where('presetId').equals(presetId).toArray();
    for (const deck of affectedDecks) {
      await db.decks.update(deck.id, { presetId: undefined });
    }
  };

  // --- OPERAÇÕES CRUD DE CARDS ---
  const handleOpenAddCardModal = (deckId: string) => {
    const deck = decks?.find(d => d.id === deckId);
    if (deck) {
      setDeckForNewCard(deck);
      setIsCardModalOpen(true);
    }
  };

  const handleOpenPreviewModal = (card: Card) => {
    setCardToPreview(card);
    setIsPreviewModalOpen(true);
  };

  const handleSaveCard = async (
    type: 'basic' | 'reversed' | 'optional_reversed' | 'typing' | 'cloze' | 'listening',
    fields: string[],
    context: string,
    audioBlob: Blob | null,
    tags: string[]
  ) => {
    if (cardToEdit) {
      // 1. Editar Nota e Sincronizar Cartões
      const note = await db.notes.get(cardToEdit.noteId);
      if (note) {
        const updatedNote: Note = {
          ...note,
          type,
          fields,
          context,
          audio: audioBlob || undefined,
          tags,
          updatedAt: Date.now()
        };
        await db.notes.put(updatedNote);

        const existingCards = await db.cards.where('noteId').equals(note.id).toArray();
        const { toAdd, toUpdate, toDelete } = syncNoteCards(updatedNote, existingCards);

        if (toAdd.length > 0) {
          await db.cards.bulkAdd(toAdd);
        }
        for (const card of toUpdate) {
          await db.cards.put(card);
        }
        if (toDelete.length > 0) {
          await db.cards.bulkDelete(toDelete);
        }
      }
      setIsCardModalOpen(false);
      setCardToEdit(null);
    } else {
      // 2. Criar Nova Nota e Gerar Cartões
      if (!deckForNewCard) return;

      const noteId = crypto.randomUUID();
      const newNote: Note = {
        id: noteId,
        deckId: deckForNewCard.id,
        type,
        fields,
        tags,
        context,
        audio: audioBlob || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.notes.add(newNote);

      const { toAdd } = syncNoteCards(newNote, []);
      if (toAdd.length > 0) {
        await db.cards.bulkAdd(toAdd);
      }

      setIsCardModalOpen(false);
      setDeckForNewCard(null);
    }
  };

  const handleToggleSuspendCard = async (card: Card) => {
    const nextSuspended = !card.suspended;
    await db.cards.update(card.id, {
      suspended: nextSuspended,
      updatedAt: Date.now()
    });
    setCardToPreview(prev => prev && prev.id === card.id ? { ...prev, suspended: nextSuspended } : prev);
  };

  // --- FLUXO DE ESTUDO ---
  const getDeckTags = (deckId: string) => {
    if (!cards) return [];
    const deckCards = cards.filter(c => c.deckId === deckId);
    const allTags = new Set<string>();
    deckCards.forEach(c => {
      if (c.tags) {
        c.tags.forEach(t => allTags.add(t));
      }
    });
    return Array.from(allTags);
  };

  const getFilteredCardsCount = (deckId: string, activeTags: string[]) => {
    if (!cards || !decks) return 0;
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return 0;
    const deckCards = cards.filter(c => c.deckId === deckId);
    const matchedCards = deckCards.filter(c => activeTags.length === 0 || (c.tags && c.tags.some(t => activeTags.includes(t))));
    return getDeckStudyableCards(deck, matchedCards).totalCount;
  };

  // --- FLUXO DE ESTUDO ---
  const handleStartStudy = (deckId: string) => {
    setDeckToStudyId(deckId);
    setSelectedStudyTags([]);
    setIsStudyFilterModalOpen(true);
  };

  const handleGradeCard = async (card: Card, rating: number, duration?: number) => {
    if (cramSessionCards) {
      // Sessão Cram não altera agendamento nem registra revisão
      // (cramSessionCards é uma lista temporária em memória, não salvamos no IndexedDB)
      return;
    }
    const deck = decks?.find(d => d.id === card.deckId);
    const preset = deck ? getDeckPreset(deck) : undefined;
    const nextFields = calculateNextReview(card, rating, preset);
    await db.cards.update(card.id, {
      ...nextFields,
      updatedAt: Date.now()
    });

    await db.revisions.add({
      id: crypto.randomUUID(),
      cardId: card.id,
      timestamp: Date.now(),
      rating,
      ease: nextFields.ease,
      interval: nextFields.interval,
      wasNew: card.interval === 0,
      duration
    });
  };

  const handleFinishStudySession = (studiedCount: number) => {
    const updatedStreak = recordStudy();
    setStreak(updatedStreak.currentStreak);
    setSessionCardsStudied(studiedCount);
    setCurrentView('congrats');
    setCramSessionCards(null);
  };

  // --- EXPORTAÇÃO E BACKUP ---
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const downloadJSON = (data: any, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportDeck = (deckId: string) => {
    setExportDeckId(deckId);
    setIsExportModalOpen(true);
  };

  const handleExportDeckJson = async (deckId: string) => {
    try {
      const deck = await db.decks.get(deckId);
      if (!deck) {
        toast.error('Deck não encontrado!');
        return;
      }

      const deckCards = await db.cards.where('deckId').equals(deckId).toArray();
      const cardsWithBase64 = [];

      for (const card of deckCards) {
        let audioBase64 = undefined;
        if (card.audio) {
          audioBase64 = await blobToBase64(card.audio);
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { audio, ...cardRest } = card;
        cardsWithBase64.push({
          ...cardRest,
          audioBase64
        });
      }

      const data = {
        version: "1.0",
        exportType: "deck",
        decks: [deck],
        cards: cardsWithBase64
      };

      const safeName = deck.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'deck';
      downloadJSON(data, `${safeName}.json`);
      toast.success('Deck exportado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao exportar deck: ' + err.message);
    }
  };

  const handleExportFullBackup = async () => {
    try {
      const allDecks = await db.decks.toArray();
      const allCards = await db.cards.toArray();
      const allRevisions = await db.revisions.toArray();
      const cardsWithBase64 = [];

      for (const card of allCards) {
        let audioBase64 = undefined;
        if (card.audio) {
          audioBase64 = await blobToBase64(card.audio);
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { audio, ...cardRest } = card;
        cardsWithBase64.push({
          ...cardRest,
          audioBase64
        });
      }

      const data = {
        version: "1.0",
        exportType: "full",
        decks: allDecks,
        cards: cardsWithBase64,
        revisions: allRevisions
      };

      const today = new Date().toISOString().split('T')[0];
      downloadJSON(data, `memorize_backup_${today}.json`);
      toast.success('Backup completo gerado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao criar backup completo: ' + err.message);
    }
  };

  // --- LIMPAR E RESETAR BANCO LOCAL ---
  const handleResetAllData = async () => {
    await db.decks.clear();
    await db.cards.clear();
    await db.revisions.clear();
    localStorage.clear();
    toast.success("Dados limpos com sucesso! O aplicativo será reiniciado.");
    setTimeout(() => window.location.reload(), 1500);
  };

  // --- IMPORTAR CARDS GERADOS POR IA ---
  const handleImportGeneratedCards = async (
    deckNameOrId: string,
    isNewDeck: boolean,
    newDeckDescription: string,
    cardsList: Array<{ front: string; back: string; context: string }>
  ) => {
    let deckId = deckNameOrId;

    if (isNewDeck) {
      deckId = crypto.randomUUID();
      await db.decks.add({
        id: deckId,
        name: deckNameOrId,
        description: newDeckDescription,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    const newCards: Card[] = cardsList.map((c) => ({
      id: crypto.randomUUID(),
      deckId,
      front: c.front,
      back: c.back,
      context: c.context,
      interval: 0,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
      dueDate: todayStr,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));

    await db.cards.bulkAdd(newCards);
    toast.success('Cards importados com sucesso!');
  };

  // --- SINCRONIZAÇÃO GOOGLE DRIVE REAL ---
  const handleDriveSync = async (forceMode?: 'upload' | 'download', password?: string) => {
    if (!DRIVE_CLIENT_ID) {
      toast.error('Google Client ID não configurado.');
      return;
    }
    if (!password) {
      setPendingSyncMode(forceMode);
      setPasswordPromptInput('');
      setIsPasswordPromptOpen(true);
      return;
    }

    setIsSyncing(true);
    setSyncProgress(5);
    setSyncStatusMessage('Inicializando sincronização...');
    try {
      let token = driveAccessToken;
      if (!token) {
        setSyncProgress(15);
        setSyncStatusMessage('Conectando ao Google OAuth...');
        token = await requestAccessToken(DRIVE_CLIENT_ID);
        setDriveAccessToken(token);
        
        try {
          const profile = await getDriveUserProfile(token);
          setUserName(profile.displayName);
          setUserPhoto(profile.photoLink || '');
          setUserEmail(profile.emailAddress || '');
          localStorage.setItem('memorize_drive_user_profile', JSON.stringify(profile));
        } catch (profileErr) {
          console.warn('Erro ao obter perfil de usuário:', profileErr);
        }
      }

      setSyncProgress(30);
      setSyncStatusMessage('Pesquisando backup existente no Drive...');
      const fileInfo = await findBackupFile(token);

      if (forceMode === 'upload') {
        setSyncProgress(45);
        setSyncStatusMessage('Exportando base de dados local...');
        const localExport = await exportDatabase();
        
        setSyncProgress(65);
        setSyncStatusMessage('Criptografando com AES-GCM-256...');
        const envelope = await encryptData(JSON.stringify(localExport), password);
        
        setSyncProgress(85);
        setSyncStatusMessage('Enviando para o Google Drive...');
        if (fileInfo) {
          await updateBackupFile(token, fileInfo.id, envelope);
        } else {
          await createBackupFile(token, envelope);
        }
        
        const now = Date.now();
        setLastSyncTime(now);
        localStorage.setItem('memorize_last_sync_time', now.toString());
        setSyncProgress(100);
        setSyncStatusMessage('Upload concluído com sucesso!');
        toast.success('Upload completo concluído. Dados locais salvos no Google Drive!');
        return;
      }

      if (forceMode === 'download') {
        if (!fileInfo) {
          throw new Error('Nenhum backup encontrado no Google Drive para baixar.');
        }
        setSyncProgress(50);
        setSyncStatusMessage('Baixando dados criptografados do Drive...');
        const envelope = await downloadBackupFile(token, fileInfo.id);
        
        setSyncProgress(70);
        setSyncStatusMessage('Descriptografando envelope com sua senha...');
        const decryptedStr = await decryptData(envelope, password);
        const remoteData = JSON.parse(decryptedStr);
        
        setSyncProgress(85);
        setSyncStatusMessage('Importando e substituindo base de dados local...');
        await performMergeSync(remoteData);
        
        const now = Date.now();
        setLastSyncTime(now);
        localStorage.setItem('memorize_last_sync_time', now.toString());
        setSyncProgress(100);
        setSyncStatusMessage('Sincronização de download concluída!');
        toast.success('Download completo concluído. Dados locais substituídos!');
        setTimeout(() => window.location.reload(), 1000);
        return;
      }

      // Modo Padrão: Mesclagem Inteligente de Duas Vias
      if (!fileInfo) {
        setSyncProgress(45);
        setSyncStatusMessage('Nenhum backup remoto. Exportando dados locais...');
        const localExport = await exportDatabase();
        
        setSyncProgress(70);
        setSyncStatusMessage('Criptografando base local...');
        const envelope = await encryptData(JSON.stringify(localExport), password);
        
        setSyncProgress(90);
        setSyncStatusMessage('Criando primeiro backup no Drive...');
        await createBackupFile(token, envelope);
        
        const now = Date.now();
        setLastSyncTime(now);
        localStorage.setItem('memorize_last_sync_time', now.toString());
        setSyncProgress(100);
        setSyncStatusMessage('Sincronização de envio concluída!');
        toast.success('Primeiro backup criptografado criado no Google Drive!');
      } else {
        setSyncProgress(40);
        setSyncStatusMessage('Baixando backup criptografado do Drive...');
        const envelope = await downloadBackupFile(token, fileInfo.id);
        
        setSyncProgress(60);
        setSyncStatusMessage('Descriptografando dados de nuvem...');
        const decryptedStr = await decryptData(envelope, password);
        const remoteData = JSON.parse(decryptedStr);

        setSyncProgress(75);
        setSyncStatusMessage('Executando mesclagem inteligente de tabelas...');
        await performMergeSync(remoteData);

        setSyncProgress(85);
        setSyncStatusMessage('Exportando base de dados unificada...');
        const mergedExport = await exportDatabase();
        
        setSyncProgress(90);
        setSyncStatusMessage('Criptografando dados unificados...');
        const newEnvelope = await encryptData(JSON.stringify(mergedExport), password);
        
        setSyncProgress(95);
        setSyncStatusMessage('Subindo base unificada para o Google Drive...');
        await updateBackupFile(token, fileInfo.id, newEnvelope);

        const now = Date.now();
        setLastSyncTime(now);
        localStorage.setItem('memorize_last_sync_time', now.toString());
        setSyncProgress(100);
        setSyncStatusMessage('Sincronização e unificação concluídas!');
        toast.success('Sincronização com nuvem realizada com sucesso!');
        
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro na sincronização: ' + err.message);
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const handleDisconnectDrive = async () => {
    if (driveAccessToken) {
      try {
        await revokeToken(driveAccessToken);
      } catch (err) {
        console.warn('Erro ao revogar token:', err);
      }
    }
    setDriveAccessToken('');
    setUserName('');
    setUserPhoto('');
    localStorage.removeItem('memorize_drive_user_profile');
    toast.success('Desconectado do Google Drive com sucesso. A sessão foi encerrada.');
  };

  // --- SINCRONIZAÇÃO GERAL (BOTÃO HEADER) ---
  const handleSync = () => {
    if (DRIVE_CLIENT_ID) {
      handleDriveSync();
    } else {
      setIsSyncing(true);
      setSyncProgress(10);
      setSyncStatusMessage('Conectando ao servidor de testes...');
      
      setTimeout(() => {
        setSyncProgress(50);
        setSyncStatusMessage('Verificando integridade dos cartões locais...');
        
        setTimeout(() => {
          setSyncProgress(85);
          setSyncStatusMessage('Consolidando revisões e estatísticas...');
          
          setTimeout(() => {
            setSyncProgress(100);
            setSyncStatusMessage('Simulação finalizada!');
            setIsSyncing(false);
            setSyncProgress(0);
            toast.success('Sincronização simulada com sucesso! Configure seu Google Drive nas opções para backup real.');
          }, 300);
        }, 300);
      }, 300);
    }
  };

  // --- AUTO SINCRONIZAÇÃO NO INÍCIO ---
  useEffect(() => {
    if (autoSyncEnabled && DRIVE_CLIENT_ID) {
      const timer = setTimeout(() => {
        handleDriveSync();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // --- FLUXO NAVEGAÇÃO SIDEBAR ---
  const handleNavigateFromSidebar = (tab: 'dashboard' | 'stats' | 'cards' | 'profile' | 'settings' | 'history' | 'reading' | 'guide' | 'conversation') => {
    setActiveTab(tab);
    setGuideInitialTab('overview');
    setCurrentView('dashboard');
    setIsSidebarOpen(false);
  };

  const handleStartCramSession = (cramCards: Card[]) => {
    setCramSessionCards(cramCards);
    setSessionCardsStudied(0);
    setSelectedStudyMode('classic');
    setCurrentView('study');
  };

  const cardsToStudy = cramSessionCards 
    ? cramSessionCards
    : (cards && selectedDeckId && decks
        ? (() => {
            const deck = decks.find(d => d.id === selectedDeckId);
            if (!deck) return [];
            const deckCards = cards.filter(c => c.deckId === selectedDeckId);
            // Apply tag filtering first
            const matchedCards = deckCards.filter(c => selectedStudyTags.length === 0 || (c.tags && c.tags.some(t => selectedStudyTags.includes(t))));
            return getDeckStudyableCards(deck, matchedCards).cards;
          })()
        : []);

  const selectedDeck = decks?.find(d => d.id === selectedDeckId);

  const filteredCards = cards
    ? cards.filter(c => 
        c.front.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.back.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.context.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.tags && c.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))
      )
    : [];

  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE);
  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Estatísticas de progresso e nível do perfil
  const totalRevisionsCount = revisions ? revisions.length : 0;
  const earnedXp = totalRevisionsCount * 15;
  const userLevel = Math.floor(earnedXp / 100) + 1;
  const xpNeededForNextLevel = 100 - (earnedXp % 100);

  const getTodaysStats = () => {
    if (!revisions) return { count: 0, minutes: 0, sPerCard: 0 };
    const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
    const todaysRevisions = revisions.filter(r => r.timestamp >= startOfTodayMs);
    
    if (todaysRevisions.length === 0) {
      return { count: 0, minutes: 0, sPerCard: 0 };
    }

    // Sort chronologically
    const sorted = [...todaysRevisions].sort((a, b) => a.timestamp - b.timestamp);
    let totalSeconds = 0;
    
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].duration !== undefined) {
        totalSeconds += sorted[i].duration!;
      } else {
        if (i === 0) {
          totalSeconds += 10; // Default estimate
        } else {
          const diff = (sorted[i].timestamp - sorted[i - 1].timestamp) / 1000;
          if (diff < 60) {
            totalSeconds += diff;
          } else {
            totalSeconds += 10; // Cap
          }
        }
      }
    }

    const minutes = totalSeconds / 60;
    const sPerCard = totalSeconds / todaysRevisions.length;

    return {
      count: todaysRevisions.length,
      minutes: parseFloat(minutes.toFixed(2)),
      sPerCard: parseFloat(sPerCard.toFixed(2))
    };
  };

  const stats = getTodaysStats();

  const getTodaysReadingStats = () => {
    if (!readingSessions) return { minutes: 0, wordsRead: 0, sentencesMastered: 0 };
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const todaySessions = readingSessions.filter(s => s.timestamp >= todayStartMs);

    let durationSeconds = 0;
    let wordsRead = 0;
    let sentencesMastered = 0;

    todaySessions.forEach(s => {
      durationSeconds += s.duration;
      wordsRead += s.wordsRead;
      sentencesMastered += s.sentencesMastered;
    });

    return {
      minutes: parseFloat((durationSeconds / 60).toFixed(1)),
      wordsRead,
      sentencesMastered
    };
  };

  const readingStats = getTodaysReadingStats();

  const handleGoToReading = () => {
    setActiveTab('reading');
    setCurrentView('dashboard');
  };

  return (
    <div className="app-container min-h-screen flex flex-row bg-background text-foreground relative font-sans w-full">
      <Toaster position="bottom-right" richColors />
      
      {/* 1. SIDEBAR FIXA PARA DESKTOP (md:flex) */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-card h-screen sticky top-0 justify-between shrink-0 transition-all duration-300 ${
        isDesktopSidebarOpen && !isReadingZenMode ? 'w-[260px] p-6 opacity-100' : 'w-0 p-0 border-r-0 opacity-0 overflow-hidden'
      }`}>
        <div className="space-y-6">
          {/* User Profile Header & Collapse Button */}
          <div className="flex items-center justify-between pb-5 border-b border-border gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center text-base shadow-sm">
                {userPhoto ? (
                  <img src={userPhoto} alt={userName} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                    {userName ? userName.charAt(0).toUpperCase() : (streak > 0 ? '🔥' : '👤')}
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                {userName ? (
                  <>
                    <span className="font-bold text-sm text-foreground truncate">{userName}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold tracking-wide truncate">{userEmail}</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-xs text-muted-foreground uppercase tracking-wide">Modo Local</span>
                    <span className="text-[9px] text-muted-foreground/60 font-semibold tracking-wide truncate">Sem backup na nuvem</span>
                  </>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer shrink-0 rounded-lg hover:bg-muted"
              onClick={() => setIsDesktopSidebarOpen(false)}
              title="Recolher menu"
            >
              <ChevronLeft size={16} />
            </Button>
          </div>

          {/* Navigation List */}
          <nav className="flex flex-col gap-2">
            <Button 
              variant="ghost"
              className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'dashboard' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('dashboard');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </div>
              {totalDue > 0 && (
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm ${activeTab === 'dashboard' ? 'bg-background text-primary' : 'bg-rose-500 text-white shadow-rose-500/20'}`}>
                  {totalDue}
                </span>
              )}
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'reading' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('reading');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <BookOpen size={16} />
                <span>Leitura</span>
              </div>
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'conversation' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('conversation');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={16} />
                <span>Conversação</span>
              </div>
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'stats' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('stats');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <TrendingUp size={16} />
                <span>Estatísticas</span>
              </div>
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'cards' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('cards');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <Search size={16} />
                <span>Banco de Cards</span>
              </div>
              {cards && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTab === 'cards' ? 'bg-background/20 text-primary-foreground' : 'bg-muted border border-border text-muted-foreground'}`}>
                  {cards.length}
                </span>
              )}
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'profile' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('profile');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <User size={16} />
                <span>Meu Perfil</span>
              </div>
              {streak > 0 && (
                <span className="text-[10px] font-bold bg-amber-500 text-zinc-950 px-2 py-0.5 rounded-full">
                  Nív. {userLevel}
                </span>
              )}
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'settings' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('settings');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <Settings size={16} />
                <span>Configurações</span>
              </div>
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'history' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                setActiveTab('history');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={16} />
                <span>Histórico</span>
              </div>
            </Button>


            <Button 
              variant="ghost"
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                activeTab === 'guide' 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => {
                handleSetActiveTab('guide', 'overview');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <Info size={16} />
                <span>Guia & Ajuda</span>
              </div>
            </Button>
          </nav>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-muted-foreground/60 font-bold tracking-wider text-center border-t border-border pt-4">
          MEMORIZE v1.0.0 • LocalDB
        </div>
      </aside>

      {/* 2. CONTEÚDO PRINCIPAL (OCUPA O RESTO DA TELA) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* SIDEBAR DRAWER PARA MOBILE (Sheet - md:hidden) */}
        {currentView === 'dashboard' && (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="left" className="w-[280px] bg-card border-r border-border text-foreground p-6 flex flex-col justify-between md:hidden">
              <div className="space-y-6">
                {/* User Profile Header */}
                <div className="flex items-center gap-3 pb-5 border-b border-border">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center text-lg shadow-sm">
                    {userPhoto ? (
                      <img src={userPhoto} alt={userName} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {userName ? userName.charAt(0).toUpperCase() : (streak > 0 ? '🔥' : '👤')}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    {userName ? (
                      <>
                        <span className="font-bold text-sm text-foreground truncate">{userName}</span>
                        <span className="text-[10px] text-muted-foreground font-semibold tracking-wide truncate">{userEmail}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-xs text-muted-foreground uppercase tracking-wide">Modo Local</span>
                        <span className="text-[9px] text-muted-foreground/60 font-semibold tracking-wide truncate">Sem backup na nuvem</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Navigation List */}
                <nav className="flex flex-col gap-2">
                  <Button 
                    variant="ghost"
                    className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'dashboard' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('dashboard')}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard size={16} />
                      <span>Dashboard</span>
                    </div>
                    {totalDue > 0 && (
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm ${activeTab === 'dashboard' ? 'bg-background text-primary' : 'bg-rose-500 text-white shadow-rose-500/20'}`}>
                        {totalDue}
                      </span>
                    )}
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'reading' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('reading')}
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen size={16} />
                      <span>Leitura</span>
                    </div>
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'conversation' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('conversation')}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare size={16} />
                      <span>Conversação</span>
                    </div>
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'stats' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('stats')}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp size={16} />
                      <span>Estatísticas</span>
                    </div>
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'cards' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('cards')}
                  >
                    <div className="flex items-center gap-3">
                      <Search size={16} />
                      <span>Banco de Cards</span>
                    </div>
                    {cards && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTab === 'cards' ? 'bg-background/20 text-primary-foreground' : 'bg-muted border border-border text-muted-foreground'}`}>
                        {cards.length}
                      </span>
                    )}
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'profile' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('profile')}
                  >
                    <div className="flex items-center gap-3">
                      <User size={16} />
                      <span>Meu Perfil</span>
                    </div>
                    {streak > 0 && (
                      <span className="text-[10px] font-bold bg-amber-500 text-zinc-950 px-2 py-0.5 rounded-full">
                        Nív. {userLevel}
                      </span>
                    )}
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'settings' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('settings')}
                  >
                    <div className="flex items-center gap-3">
                      <Settings size={16} />
                      <span>Configurações</span>
                    </div>
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'history' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('history')}
                  >
                    <div className="flex items-center gap-3">
                      <ClipboardList size={16} />
                      <span>Histórico</span>
                    </div>
                  </Button>


                  <Button 
                    variant="ghost"
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeTab === 'guide' 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                    onClick={() => handleNavigateFromSidebar('guide')}
                  >
                    <div className="flex items-center gap-3">
                      <Info size={16} />
                      <span>Guia & Ajuda</span>

                    </div>
                  </Button>
                </nav>
              </div>

              {/* Footer */}
              <div className="text-[10px] text-muted-foreground/60 font-bold tracking-wider text-center border-t border-border pt-4">
                MEMORIZE v1.0.0 • LocalDB
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Header (Dashboard View) */}
        {currentView === 'dashboard' && !isReadingZenMode && (
          <header className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 w-full">
            {/* O botão hambúrguer do menu controla a sidebar */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer h-9 w-9"
              onClick={toggleSidebar}
              title="Menu"
            >
              <Menu size={22} />
            </Button>
            
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary fill-primary/10" size={18} />
              <h1 className="font-extrabold text-lg text-foreground tracking-tight">Memorize</h1>
            </div>

            {/* Top Navigation Menu (Simplified - Sync only) */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-extrabold px-3.5 py-1.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 border border-border/80 gap-2"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search size={13} />
                Buscar
                <kbd className="hidden sm:inline text-[9px] bg-muted border border-border px-1 rounded font-bold">Ctrl K</kbd>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-extrabold px-3.5 py-1.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 border border-border/80 gap-2 flex items-center"
                onClick={handleSync}
                disabled={isSyncing}
                title={
                  DRIVE_CLIENT_ID 
                    ? `Sincronização na Nuvem ativa (Google Drive)${lastSyncTime ? `\nÚltimo Sync: ${new Date(lastSyncTime).toLocaleString('pt-BR')}` : ''}`
                    : 'Sincronizar localmente (Configure o Google Drive nas opções para backup na nuvem)'
                }
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-primary" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    {DRIVE_CLIENT_ID ? (
                      <Cloud size={13} className="text-primary animate-pulse" />
                    ) : (
                      <RefreshCw size={12} />
                    )}
                    <span>Sincronizar</span>
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Alternador Rápido de Temas */}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer h-8 w-8"
                onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                title={theme === 'light' ? 'Tema Escuro' : 'Tema Claro'}
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`text-muted-foreground hover:text-foreground cursor-pointer h-8 w-8 ${isPomodoroOpen ? 'bg-primary/20 text-primary hover:text-primary hover:bg-primary/30' : 'hover:bg-muted'}`}
                onClick={() => setIsPomodoroOpen(prev => !prev)}
                title="Timer / Pomodoro"
              >
                <Timer size={16} />
              </Button>

              {streak > 0 ? (
                <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/20 shadow-sm">
                  <Flame size={14} className="fill-amber-500" />
                  <span>{streak}d</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-bold border border-border">
                  <Flame size={14} />
                  <span>0d</span>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Main Content Area */}
        {currentView === 'dashboard' && (
          <main className={`flex-1 overflow-y-auto w-full ${isReadingZenMode ? 'p-0 pb-0' : 'p-5 pb-24'}`}>
            
            {/* TAB 1: DASHBOARD (DECKS) */}
            {activeTab === 'dashboard' && (
              <DashboardPage
                decks={decks}
                cards={cards}
                totalNew={totalNew}
                totalDue={totalDue}
                totalLearned={totalLearned}
                activeDeckMenuId={activeDeckMenuId}
                setActiveDeckMenuId={setActiveDeckMenuId}
                handleOpenNewDeckModal={handleOpenNewDeckModal}
                setIsImportModalOpen={setIsImportModalOpen}
                handleStartStudy={handleStartStudy}
                handleOpenAddCardModal={handleOpenAddCardModal}
                handleOpenEditDeckModal={handleOpenEditDeckModal}
                handleOpenDeckOptionsModal={handleOpenDeckOptionsModal}
                handleExportDeck={handleExportDeck}
                handleDeleteDeck={handleDeleteDeck}
                stats={stats}
                handleOpenAiModal={() => setIsAiModalOpen(true)}
                dailyGoal={dailyGoal}
                getDeckStudyableCounts={getDeckStudyableCounts}
                readingStats={readingStats}
                handleGoToReading={handleGoToReading}
              />
            )}

            {/* TAB: LEITURA LINHA A LINHA */}
            {activeTab === 'reading' && (
              <ReadingPage
                geminiApiKey={geminiApiKey}
                ttsRate={ttsRate}
                ttsVoice={ttsVoice}
                isZenMode={isReadingZenMode}
                setIsZenMode={setIsReadingZenMode}
              />
            )}

            {/* TAB: CONVERSAÇÃO COM IA */}
            {activeTab === 'conversation' && (
              <ConversationPage
                geminiApiKey={geminiApiKey}
                ttsRate={ttsRate}
                ttsVoice={ttsVoice}
              />
            )}

            {/* TAB 2: BANCO DE CARDS */}
            {activeTab === 'cards' && (
              <CardsPage
                cards={cards}
                decks={decks}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filteredCards={filteredCards}
                paginatedCards={paginatedCards}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
                ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                handleOpenPreviewModal={handleOpenPreviewModal}
                setCardToEdit={setCardToEdit}
                setIsCardModalOpen={setIsCardModalOpen}
                stripHtmlTags={stripHtmlTags}
              />
            )}

            {/* TAB 3: ESTATÍSTICAS */}
            {activeTab === 'stats' && (
              <StatsDashboard decks={decks} cards={cards} revisions={revisions} selectedAlgo={selectedAlgo} />
            )}

            {/* TAB 5: MEU PERFIL */}
            {activeTab === 'profile' && (
              <ProfilePage
                streak={streak}
                userLevel={userLevel}
                earnedXp={earnedXp}
                xpNeededForNextLevel={xpNeededForNextLevel}
                totalRevisionsCount={totalRevisionsCount}
                decksCount={decks ? decks.length : 0}
                userName={userName}
                userPhoto={userPhoto}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                theme={theme}
                setTheme={setTheme}
                accentColor={accentColor}
                setAccentColor={setAccentColor}
                notificationsEnabled={notificationsEnabled}
                setNotificationsEnabled={setNotificationsEnabled}
                cards={cards}
                handleExportFullBackup={handleExportFullBackup}
                setIsImportModalOpen={setIsImportModalOpen}
                handleResetAllData={handleResetAllData}
                deferredPrompt={deferredPrompt}
                handleInstallApp={handleInstallApp}
                ttsRate={ttsRate}
                setTtsRate={setTtsRate}
                ttsVoice={ttsVoice}
                setTtsVoice={setTtsVoice}
                autoPlayAudio={autoPlayAudio}
                setAutoPlayAudio={setAutoPlayAudio}
                requestNotificationPermission={requestNotificationPermission}
                getNotificationPermission={getNotificationPermission}
                geminiApiKey={geminiApiKey}
                setGeminiApiKey={setGeminiApiKey}

                dailyGoal={dailyGoal}
                setDailyGoal={setDailyGoal}
                presets={presets}
                onSavePreset={handleSavePreset}
                onDeletePreset={handleDeletePreset}
                
                // Google Drive Sync props
                driveClientId={DRIVE_CLIENT_ID}
                autoSyncEnabled={autoSyncEnabled}
                setAutoSyncEnabled={setAutoSyncEnabled}
                lastSyncTime={lastSyncTime}
                isSyncing={isSyncing}
                handleDriveSync={handleDriveSync}
                driveAccessToken={driveAccessToken}
                handleDisconnectDrive={handleDisconnectDrive}
              />
            )}

            {/* TAB 5: HISTÓRICO */}
            {activeTab === 'history' && (
              <HistoryPage
                cards={cards}
                onStartCramSession={handleStartCramSession}
              />
            )}


            {/* TAB 7: GUIA E AJUDA */}
            {activeTab === 'guide' && (
              <AppGuideDocs initialTab={guideInitialTab} />
            )}

          </main>
        )}

        {/* Floating Action Button (decks view only, responsive positioning) */}
        {currentView === 'dashboard' && activeTab === 'dashboard' && decks && decks.length > 0 && (
          <div className="fixed bottom-6 right-6 md:right-8 z-10">
            <Button 
              onClick={handleOpenNewDeckModal}
              className="w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg cursor-pointer flex items-center justify-center p-0"
              title="Novo Deck"
            >
              <Plus size={28} />
            </Button>
          </div>
        )}

        {/* 3. TELA: ARENA DE ESTUDO */}
        {currentView === 'study' && (
          <main className="flex-1 p-5 overflow-y-auto w-full max-w-5xl mx-auto flex flex-col justify-center">
            <StudyArena
              key={selectedDeckId || 'cram'}
              deckName={selectedDeck ? selectedDeck.name : 'Sessão de Reforço'}
              cardsToStudy={cardsToStudy}
              onGradeCard={handleGradeCard}
              onCancel={() => {
                setCurrentView('dashboard');
                setSelectedDeckId(null);
                setCramSessionCards(null);
              }}
              onFinishSession={handleFinishStudySession}
              studyMode={selectedStudyMode}
              ttsRate={ttsRate}
              ttsVoice={ttsVoice}
              autoPlayAudio={autoPlayAudio}
              preset={selectedDeck ? getDeckPreset(selectedDeck) : undefined}
            />
          </main>
        )}

        {/* 4. TELA: CONGRATS */}
        {currentView === 'congrats' && (
          <main className="flex-1 p-5 overflow-y-auto w-full flex flex-col justify-center">
            <CongratsScreen
              streak={streak}
              cardsStudied={sessionCardsStudied}
              dailyGoal={dailyGoal}
              studiedTodayCount={stats.count}
              onBackToDashboard={() => {
                setCurrentView('dashboard');
                setSelectedDeckId(null);
                setCramSessionCards(null);
              }}
            />
          </main>
        )}
      </div>

      {/* --- MODAIS DE GERENCIAMENTO --- */}
      <DeckModal
        isOpen={isDeckModalOpen}
        onClose={() => {
          setIsDeckModalOpen(false);
          setDeckToEdit(null);
        }}
        onSave={handleSaveDeck}
        deckToEdit={deckToEdit}
      />

      <DeckOptionsModal
        isOpen={isDeckOptionsModalOpen}
        onClose={() => {
          setIsDeckOptionsModalOpen(false);
          setDeckForOptions(null);
        }}
        onSave={handleSaveDeckOptions}
        deck={deckForOptions}
        presets={presets}
      />

      <CardModal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setDeckForNewCard(null);
          setCardToEdit(null);
        }}
        onSave={handleSaveCard}
        cardToEdit={cardToEdit}
        deckName={
          deckForNewCard 
            ? deckForNewCard.name 
            : (cardToEdit ? (decks?.find(d => d.id === cardToEdit.deckId)?.name || '') : '')
        }
      />

      <CardPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setCardToPreview(null);
        }}
        onEdit={() => {
          if (cardToPreview) {
            setCardToEdit(cardToPreview);
            setIsPreviewModalOpen(false);
            setCardToPreview(null);
            setIsCardModalOpen(true);
          }
        }}
        card={cardToPreview}
        deckName={cardToPreview ? (decks?.find(d => d.id === cardToPreview.deckId)?.name || '') : ''}
        onToggleSuspend={handleToggleSuspendCard}
      />

      {/* Dialog para Filtrar Estudo por Tags */}
      {isStudyFilterModalOpen && deckToStudyId && (
        <Dialog open={isStudyFilterModalOpen} onOpenChange={(open) => !open && setIsStudyFilterModalOpen(false)}>
          <DialogContent className="bg-card border-border text-foreground max-w-xs sm:max-w-md rounded-lg p-5">
            <DialogHeader>
              <DialogTitle className="font-semibold text-lg text-foreground flex items-center gap-2">
                ⚙️ Configurar Sessão de Estudos
              </DialogTitle>
              <span className="text-[10px] text-primary font-bold uppercase tracking-wider block mt-1">
                Deck: {decks?.find(d => d.id === deckToStudyId)?.name.replace(/[^a-zA-Z0-9\s]/g, '').trim() || ''}
              </span>
            </DialogHeader>

            <div className="flex flex-col gap-4 mt-3">
              {getDeckTags(deckToStudyId).length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Estudar apenas cartões com as tags:
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-border rounded-xl bg-background/50">
                    {getDeckTags(deckToStudyId).map((tag) => {
                      const isSelected = selectedStudyTags.includes(tag);
                      const colors = getTagColors(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedStudyTags(prev => prev.filter(t => t !== tag));
                            } else {
                              setSelectedStudyTags(prev => [...prev, tag]);
                            }
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? `${colors.bg} ${colors.text} border-2 ${colors.border} font-bold scale-105 shadow-sm`
                              : 'bg-muted/30 border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    * Se nenhuma tag for selecionada, você estudará todos os cartões pendentes deste baralho.
                  </span>
                </div>
              )}

              <div className="space-y-2 border-t border-border/60 pt-3">
                <label className="text-xs font-bold text-muted-foreground">
                  Modo de Estudo:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudyMode('classic')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                      selectedStudyMode === 'classic'
                        ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-sm ring-1 ring-primary/30'
                        : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-lg mb-1">🎴</span>
                    <span className="text-xs font-bold block">Clássico</span>
                    <span className="text-[8px] opacity-75 leading-tight block mt-0.5">Frente/Verso</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStudyMode('writing')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                      selectedStudyMode === 'writing'
                        ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-sm ring-1 ring-primary/30'
                        : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-lg mb-1">✍️</span>
                    <span className="text-xs font-bold block">Escrita</span>
                    <span className="text-[8px] opacity-75 leading-tight block mt-0.5">Digitar Resposta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStudyMode('speaking')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                      selectedStudyMode === 'speaking'
                        ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-sm ring-1 ring-primary/30'
                        : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-lg mb-1">🗣️</span>
                    <span className="text-xs font-bold block">Fala</span>
                    <span className="text-[8px] opacity-75 leading-tight block mt-0.5">Pronunciar Mic</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Cartões Selecionados:</span>
                <span className="text-xs font-black bg-primary/20 text-primary px-2.5 py-1 rounded-lg">
                  {getFilteredCardsCount(deckToStudyId, selectedStudyTags)} cartões pendentes
                </span>
              </div>
            </div>

            <DialogFooter className="flex flex-row gap-2 mt-4 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-initial border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => {
                  setIsStudyFilterModalOpen(false);
                  setDeckToStudyId(null);
                  setSelectedStudyTags([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer font-bold disabled:opacity-50"
                disabled={getFilteredCardsCount(deckToStudyId, selectedStudyTags) === 0}
                onClick={() => {
                  setSelectedDeckId(deckToStudyId);
                  setSessionCardsStudied(0);
                  setCurrentView('study');
                  setIsStudyFilterModalOpen(false);
                }}
              >
                Iniciar Estudo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* POMODORO FLUTUANTE */}
      <PomodoroWidget isOpen={isPomodoroOpen} onClose={() => setIsPomodoroOpen(false)} />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        decks={decks}
      />

      {/* DIALOG DE PROGRESSO DE SINCRONIZAÇÃO */}
      <Dialog open={isSyncing && syncProgress > 0} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6 rounded-2xl bg-card border border-border shadow-2xl">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            <RefreshCw size={28} className="animate-spin" />
          </div>
          <DialogHeader className="space-y-2 flex flex-col items-center">
            <DialogTitle className="text-lg font-black text-foreground tracking-tight">
              Sincronizando dados
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Por favor, não feche o aplicativo até que a operação seja concluída.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full space-y-2 pt-2">
            <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
              <span className="truncate max-w-[250px]">{syncStatusMessage}</span>
              <span>{syncProgress}%</span>
            </div>
            {/* Barra de Progresso */}
            <div className="w-full bg-muted border border-border/50 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-300 rounded-full" 
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE SOLICITAÇÃO DE SENHA PARA CRIPTOGRAFIA */}
      <Dialog open={isPasswordPromptOpen} onOpenChange={(open) => {
        if (!open) {
          setIsPasswordPromptOpen(false);
          setPendingSyncMode(undefined);
          setPasswordPromptInput('');
        }
      }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl bg-card border border-border text-foreground p-6 shadow-2xl">
          <DialogHeader className="space-y-1.5 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
              <Lock size={20} />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight text-foreground">
              Senha de Criptografia
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-semibold">
              Digite a senha para descriptografar os dados da nuvem ou criar um novo backup seguro.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            if (!passwordPromptInput) return;
            const p = passwordPromptInput;
            const m = pendingSyncMode;
            
            // Limpa o estado primeiro
            setIsPasswordPromptOpen(false);
            setPendingSyncMode(undefined);
            setPasswordPromptInput('');
            
            // Dispara o sync com a senha fornecida
            handleDriveSync(m, p);
          }} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Key size={10} /> Senha de Segurança
              </label>
              <div className="relative">
                <input
                  type={showPromptPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha de sincronização..."
                  className="bg-background border border-border text-foreground pl-3 pr-10 py-1.5 rounded-xl text-xs font-semibold focus:border-primary focus:outline-none w-full h-10 transition-colors"
                  value={passwordPromptInput}
                  onChange={(e) => setPasswordPromptInput(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setShowPromptPassword(!showPromptPassword)}
                >
                  {showPromptPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-border/40">
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto border border-border hover:bg-muted text-foreground font-semibold h-10 text-xs rounded-xl cursor-pointer"
                onClick={() => {
                  setIsPasswordPromptOpen(false);
                  setPendingSyncMode(undefined);
                  setPasswordPromptInput('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary/95 text-primary-foreground font-bold h-10 text-xs rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!passwordPromptInput}
              >
                Confirmar e Sincronizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => {
          setIsExportModalOpen(false);
          setExportDeckId(null);
        }}
        deckId={exportDeckId}
        onExportJson={handleExportDeckJson}
      />

      <AiGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        geminiApiKey={geminiApiKey}
        decks={decks}
        onImportCards={handleImportGeneratedCards}
        onNavigateToSettings={() => {
          setActiveTab('settings');
          setCurrentView('dashboard');
        }}
      />

      {activeDeckMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setActiveDeckMenuId(null)} />
      )}

      {/* BUSCA GLOBAL (Ctrl+K) */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        cards={cards}
        decks={decks}
        onNavigateToCard={(card) => {
          setActiveTab('cards');
          setCurrentView('dashboard');
          setSearchTerm(card.front.replace(/<[^>]*>/g, ''));
        }}
        onNavigateToDeck={(deck) => {
          setActiveTab('dashboard');
          setCurrentView('dashboard');
          setSelectedDeckId(deck.id);
        }}
      />
    </div>
  );
}

export default App;
