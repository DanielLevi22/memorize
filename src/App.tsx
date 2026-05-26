import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Flame, Plus, Sparkles, Menu, User, 
  Search, Settings, Sun, Moon,
  ChevronLeft, LayoutDashboard, TrendingUp, ClipboardList,
  BookOpen, Info
} from 'lucide-react';

// Banco de Dados e Types
import { db, seedInitialData, ensureDefaultPreset, defaultPreset } from './db/db';
import type { Deck, Card, DeckPreset } from './types';

// Utilitários
import { calculateNextReview } from './utils/srs';
import { getStreak, recordStudy } from './utils/streak';

// Páginas do Projeto
import { DashboardPage } from './pages/DashboardPage';
import { CardsPage } from './pages/CardsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReadingPage } from './pages/ReadingPage';

// Componentes do Projeto
import { DeckModal } from './components/DeckModal';
import { CardModal } from './components/CardModal';
import { StudyArena } from './components/StudyArena';
import { CongratsScreen } from './components/CongratsScreen';
import { CardPreviewModal } from './components/CardPreviewModal';
import { ImportModal } from './components/ImportModal';
import { StatsDashboard } from './components/StatsDashboard';
import { AppGuideDocs } from './components/AppGuideDocs';
import { GlobalSearch } from './components/GlobalSearch';
import { AiGeneratorModal } from './components/AiGeneratorModal';
import { getTagColors } from './utils/tagColors';

// Utilitários
import { setupNotifications, requestNotificationPermission, getNotificationPermission, clearAppBadge } from './utils/notifications';

// Componentes Shadcn UI
import { Button } from './components/ui/button';
import { Sheet, SheetContent } from './components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';

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

function App() {
  // --- ESTADO DE TEMA (CLARO/ESCURO) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('memorize_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // --- ESTADOS DE CONTROLE DE TELA ---
  const [currentView, setCurrentView] = useState<'dashboard' | 'study' | 'congrats'>('dashboard');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  
  // --- ESTADO DA SIDEBAR E NAVEGAÇÃO INTERNA ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stats' | 'cards' | 'profile' | 'settings' | 'history' | 'reading' | 'guide'>('dashboard');
  const [guideInitialTab, setGuideInitialTab] = useState<'overview' | 'shortcuts' | 'reading' | 'srs_presets' | 'srs_math'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSetActiveTab = (
    tab: 'dashboard' | 'stats' | 'cards' | 'profile' | 'settings' | 'history' | 'reading' | 'guide',
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
  const [selectedAlgo, setSelectedAlgo] = useState<'SM-2' | 'FSRS'>(() => {
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

  useEffect(() => {
    localStorage.setItem('memorize_daily_goal', dailyGoal.toString());
  }, [dailyGoal]);

  // --- ESTADOS DE SESSÃO CRAM (REFORÇO) ---
  const [cramSessionCards, setCramSessionCards] = useState<Card[] | null>(null);

  // --- ESTADOS DE MODAIS ---
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState<Deck | null>(null);
  
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [deckForNewCard, setDeckForNewCard] = useState<Deck | null>(null);
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [cardToPreview, setCardToPreview] = useState<Card | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
    if (deck.presetId && presets) {
      const found = presets.find(p => p.id === deck.presetId);
      if (found) return found;
    }
    return defaultPreset;
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
      const hasPriorRevision = deckRevisions.some(r => r.cardId === cardId && r.timestamp < startOfTodayMs);
      if (hasPriorRevision) {
        reviewsStudied++;
      } else {
        newStudied++;
      }
    }
    
    return { newStudied, reviewsStudied };
  };

  const getDeckStudyableCards = (deck: Deck, deckCards: Card[]) => {
    const preset = getDeckPreset(deck);
    const counts = getDeckStudyCountsToday(deck.id);
    
    // Sort reviews according to reviewSorting
    let reviewCards = deckCards.filter(c => c.interval > 0 && c.repetitions > 1 && c.dueDate <= todayStr);
    if (preset.reviewSorting === 'random') {
      reviewCards = [...reviewCards].sort(() => Math.random() - 0.5);
    } else {
      // dateThenRandom
      reviewCards = [...reviewCards].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
    
    // Learning cards (not capped by review limit)
    const learningCards = deckCards.filter(c => c.interval > 0 && c.repetitions <= 1 && c.dueDate <= todayStr);
    
    // Sort new cards according to insertionOrder
    let newCards = deckCards.filter(c => c.interval === 0);
    if (preset.insertionOrder === 'random') {
      newCards = [...newCards].sort(() => Math.random() - 0.5);
    } else {
      newCards = [...newCards].sort((a, b) => a.createdAt - b.createdAt);
    }
    
    const reviewsRemaining = Math.max(0, preset.maxReviewsPerDay - counts.reviewsStudied);
    let newRemaining = Math.max(0, preset.newCardsPerDay - counts.newStudied);
    
    if (!preset.newCardsIgnoreReviewLimit && reviewsRemaining <= 0) {
      newRemaining = 0;
    }
    
    const cappedReviews = reviewCards.slice(0, reviewsRemaining);
    const cappedNew = newCards.slice(0, newRemaining);
    
    // Mix or order them
    let combined = [];
    if (preset.newVsReviewOrder === 'newFirst') {
      combined = [...cappedNew, ...learningCards, ...cappedReviews];
    } else if (preset.newVsReviewOrder === 'reviewFirst') {
      combined = [...learningCards, ...cappedReviews, ...cappedNew];
    } else {
      // 'mix'
      const maxLen = Math.max(cappedNew.length, cappedReviews.length + learningCards.length);
      const reviews = [...learningCards, ...cappedReviews];
      for (let i = 0; i < maxLen; i++) {
        if (i < cappedNew.length) combined.push(cappedNew[i]);
        if (i < reviews.length) combined.push(reviews[i]);
      }
    }
    
    return {
      cards: combined,
      newCount: cappedNew.length,
      learningCount: learningCards.length,
      reviewCount: cappedReviews.length,
      totalCount: cappedNew.length + learningCards.length + cappedReviews.length
    };
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

  const handleSaveDeck = async (name: string, description: string, presetId: string) => {
    if (deckToEdit) {
      await db.decks.update(deckToEdit.id, {
        name,
        description,
        presetId,
        updatedAt: Date.now()
      });
    } else {
      const newDeck: Deck = {
        id: crypto.randomUUID(),
        name,
        description,
        presetId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.decks.add(newDeck);
    }
    setIsDeckModalOpen(false);
    setDeckToEdit(null);
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

  const handleSaveCard = async (front: string, back: string, context: string, audioBlob: Blob | null, tags: string[]) => {
    if (cardToEdit) {
      // Editar Cartão Existente
      await db.cards.update(cardToEdit.id, {
        front,
        back,
        context,
        audio: audioBlob || undefined,
        tags,
        updatedAt: Date.now()
      });
      setIsCardModalOpen(false);
      setCardToEdit(null);
    } else {
      // Criar Novo Cartão
      if (!deckForNewCard) return;

      const newCard: Card = {
        id: crypto.randomUUID(),
        deckId: deckForNewCard.id,
        front,
        back,
        context,
        audio: audioBlob || undefined,
        tags,
        interval: 0,
        ease: 2.5,
        repetitions: 0,
        lapses: 0,
        dueDate: todayStr,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.cards.add(newCard);
      setIsCardModalOpen(false);
      setDeckForNewCard(null);
    }
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

  const handleGradeCard = async (card: Card, rating: number) => {
    if (cramSessionCards) {
      // Sessão Cram não altera agendamento nem registra revisão
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
      interval: nextFields.interval
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

  const handleExportDeck = async (deckId: string) => {
    try {
      const deck = await db.decks.get(deckId);
      if (!deck) {
        alert('Deck não encontrado!');
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
    } catch (err: any) {
      console.error(err);
      alert('Erro ao exportar deck: ' + err.message);
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
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar backup completo: ' + err.message);
    }
  };

  // --- LIMPAR E RESETAR BANCO LOCAL ---
  const handleResetAllData = async () => {
    if (window.confirm("⚠️ ATENÇÃO: Isso apagará permanentemente todos os seus decks, cartões e histórico de estudos deste dispositivo. Deseja prosseguir?")) {
      await db.decks.clear();
      await db.cards.clear();
      await db.revisions.clear();
      localStorage.clear();
      alert("Dados limpos com sucesso! O aplicativo será reiniciado.");
      window.location.reload();
    }
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
  };

  // --- SINCRONIZAÇÃO ANKI SIMULADA ---
  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert('Sincronização concluída! Todos os baralhos, cartões e revisões locais estão 100% atualizados.');
    }, 800);
  };

  // --- FLUXO NAVEGAÇÃO SIDEBAR ---
  const handleNavigateFromSidebar = (tab: 'dashboard' | 'stats' | 'cards' | 'profile' | 'settings' | 'history' | 'reading' | 'guide') => {
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
      
      {/* 1. SIDEBAR FIXA PARA DESKTOP (md:flex) */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-card h-screen sticky top-0 justify-between shrink-0 transition-all duration-300 ${
        isDesktopSidebarOpen && !isReadingZenMode ? 'w-[260px] p-6 opacity-100' : 'w-0 p-0 border-r-0 opacity-0 overflow-hidden'
      }`}>
        <div className="space-y-6">
          {/* User Profile Header & Collapse Button */}
          <div className="flex items-center justify-between pb-5 border-b border-border gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-base border border-border shadow-lg shadow-primary/5">
                {streak > 0 ? '🔥' : '👤'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-foreground truncate">Daniel Oliveira</span>
                <span className="text-[10px] text-muted-foreground font-semibold tracking-wide truncate">daniel.estudos@email.com</span>
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
              className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                  {totalDue}
                </span>
              )}
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'reading' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'stats' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
              className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'cards' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                  {cards.length}
                </span>
              )}
            </Button>

            <Button 
              variant="ghost"
              className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'profile' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'settings' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'history' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
              className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                activeTab === 'guide' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg border border-border shadow-lg shadow-primary/5">
                    {streak > 0 ? '🔥' : '👤'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground">Daniel Oliveira</span>
                    <span className="text-[10px] text-muted-foreground font-semibold tracking-wide">daniel.estudos@email.com</span>
                  </div>
                </div>

                {/* Navigation List */}
                <nav className="flex flex-col gap-2">
                  <Button 
                    variant="ghost"
                    className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'dashboard' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    onClick={() => handleNavigateFromSidebar('dashboard')}
                  >
                    <div className="flex items-center gap-3">
                      <LayoutDashboard size={16} />
                      <span>Dashboard</span>
                    </div>
                    {totalDue > 0 && (
                      <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                        {totalDue}
                      </span>
                    )}
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'reading' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'stats' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                    className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'cards' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    onClick={() => handleNavigateFromSidebar('cards')}
                  >
                    <div className="flex items-center gap-3">
                      <Search size={16} />
                      <span>Banco de Cards</span>
                    </div>
                    {cards && (
                      <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                        {cards.length}
                      </span>
                    )}
                  </Button>

                  <Button 
                    variant="ghost"
                    className={`w-full justify-between font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'profile' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'settings' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'history' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                    className={`w-full justify-start font-semibold text-sm h-11 px-4 rounded-xl cursor-pointer ${
                      activeTab === 'guide' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
                className="text-xs font-extrabold px-3.5 py-1.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 border border-border/80"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar'}
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
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                theme={theme}
                setTheme={setTheme}
                selectedAlgo={selectedAlgo}
                setSelectedAlgo={setSelectedAlgo}
                notificationsEnabled={notificationsEnabled}
                setNotificationsEnabled={setNotificationsEnabled}
                cards={cards}
                handleExportFullBackup={handleExportFullBackup}
                setIsImportModalOpen={setIsImportModalOpen}
                handleResetAllData={handleResetAllData}
                setActiveTab={handleSetActiveTab}
                setCurrentView={setCurrentView}
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

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        decks={decks}
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
