import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Flame, Plus, Layers, Sparkles, Menu, User, 
  Search, Settings, Trophy, BookOpen, Trash2, Sun, Moon,
  ChevronLeft, ChevronRight, Pencil, Upload, Download
} from 'lucide-react';

// Banco de Dados e Types
import { db, seedInitialData } from './db/db';
import type { Deck, Card } from './types';

// Utilitários
import { calculateNextReview } from './utils/srs';
import { getStreak, recordStudy } from './utils/streak';

// Componentes do Projeto
import { DeckCard } from './components/DeckCard';
import { DeckModal } from './components/DeckModal';
import { CardModal } from './components/CardModal';
import { StudyArena } from './components/StudyArena';
import { CongratsScreen } from './components/CongratsScreen';
import { CardPreviewModal } from './components/CardPreviewModal';
import { ImportModal } from './components/ImportModal';

// Componentes Shadcn UI
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card as ShadcnCard } from './components/ui/card';
import { Sheet, SheetContent } from './components/ui/sheet';
import { Progress } from './components/ui/progress';

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
  const [activeTab, setActiveTab] = useState<'decks' | 'profile' | 'cards' | 'settings'>('decks');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      setIsDesktopSidebarOpen(prev => !prev);
    } else {
      setIsSidebarOpen(prev => !prev);
    }
  };
  
  // --- ESTADO DE CONFIGURAÇÕES FICTÍCIAS ---
  const [selectedAlgo, setSelectedAlgo] = useState<'SM-2' | 'FSRS'>('SM-2');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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

  // --- ESTADOS DE SESSÃO E STREAK ---
  const [streak, setStreak] = useState(0);
  const [sessionCardsStudied, setSessionCardsStudied] = useState(0);

  // --- QUERIES REATIVAS (INDEXEDDB VIA DEXIE) ---
  const decks = useLiveQuery(() => db.decks.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());
  const revisions = useLiveQuery(() => db.revisions.toArray());

  // --- EFFECT DE TEMA E INITIAL SEED ---
  useEffect(() => {
    seedInitialData();
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

  // --- CÁLCULOS E ESTATÍSTICAS DO DASHBOARD ---
  const todayStr = new Date().toISOString().split('T')[0];

  const totalNew = cards ? cards.filter(c => c.interval === 0).length : 0;
  const totalDue = cards ? cards.filter(c => c.interval > 0 && c.dueDate <= todayStr).length : 0;
  const totalLearned = cards ? cards.filter(c => c.interval > 0 && c.dueDate > todayStr).length : 0;

  // --- OPERAÇÕES CRUD DE DECKS ---
  const handleOpenNewDeckModal = () => {
    setDeckToEdit(null);
    setIsDeckModalOpen(true);
  };

  const handleOpenEditDeckModal = (deck: Deck) => {
    setDeckToEdit(deck);
    setIsDeckModalOpen(true);
  };

  const handleSaveDeck = async (name: string, description: string) => {
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

  const handleSaveCard = async (front: string, back: string, context: string, audioBlob?: Blob | null) => {
    if (cardToEdit) {
      // Editar Cartão Existente
      await db.cards.update(cardToEdit.id, {
        front,
        back,
        context,
        audio: audioBlob || undefined,
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
  const handleStartStudy = (deckId: string) => {
    setSelectedDeckId(deckId);
    setSessionCardsStudied(0);
    setCurrentView('study');
  };

  const handleGradeCard = async (card: Card, rating: number) => {
    const nextFields = calculateNextReview(card, rating);
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

  // --- FLUXO NAVEGAÇÃO SIDEBAR ---
  const handleNavigateFromSidebar = (tab: 'decks' | 'profile' | 'cards' | 'settings') => {
    setActiveTab(tab);
    setCurrentView('dashboard');
    setIsSidebarOpen(false);
  };

  const cardsToStudy = cards && selectedDeckId
    ? cards.filter(c => c.deckId === selectedDeckId && (c.interval === 0 || c.dueDate <= todayStr))
    : [];

  const selectedDeck = decks?.find(d => d.id === selectedDeckId);

  const filteredCards = cards
    ? cards.filter(c => 
        c.front.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.back.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.context.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <div className="app-container min-h-screen flex flex-row bg-background text-foreground relative font-sans w-full">
      
      {/* 1. SIDEBAR FIXA PARA DESKTOP (md:flex) */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-card h-screen sticky top-0 justify-between shrink-0 transition-all duration-300 ${
        isDesktopSidebarOpen ? 'w-[260px] p-6 opacity-100' : 'w-0 p-0 border-r-0 opacity-0 overflow-hidden'
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
                activeTab === 'decks' 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              onClick={() => {
                setActiveTab('decks');
                setCurrentView('dashboard');
              }}
            >
              <div className="flex items-center gap-3">
                <BookOpen size={16} />
                <span>Meus Decks</span>
              </div>
              {totalDue > 0 && (
                <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                  {totalDue}
                </span>
              )}
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
                      activeTab === 'decks' 
                        ? 'bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/10 hover:text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                    onClick={() => handleNavigateFromSidebar('decks')}
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen size={16} />
                      <span>Meus Decks</span>
                    </div>
                    {totalDue > 0 && (
                      <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                        {totalDue}
                      </span>
                    )}
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
        {currentView === 'dashboard' && (
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
          <main className="flex-1 p-5 pb-24 overflow-y-auto w-full">
            
            {/* TAB 1: DECKS */}
            {activeTab === 'decks' && (
              <div className="space-y-6 w-full max-w-none px-2 md:px-6">
                {/* Stats Overview */}
                <section className="grid grid-cols-3 gap-3">
                  <ShadcnCard className="bg-card border-border text-center p-3.5 rounded-2xl shadow-sm">
                    <div className="font-black text-2xl text-blue-500 tracking-tight">{totalNew}</div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Novos</div>
                  </ShadcnCard>
                  <ShadcnCard className="bg-card border-border text-center p-3.5 rounded-2xl shadow-sm">
                    <div className="font-black text-2xl text-amber-500 tracking-tight">{totalDue}</div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">A Revisar</div>
                  </ShadcnCard>
                  <ShadcnCard className="bg-card border-border text-center p-3.5 rounded-2xl shadow-sm">
                    <div className="font-black text-2xl text-emerald-500 tracking-tight">{totalLearned}</div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Ok</div>
                  </ShadcnCard>
                </section>
                {/* Decks Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-md text-foreground tracking-tight">📁 Meus Decks</h2>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 font-semibold border-border bg-card hover:bg-muted text-foreground cursor-pointer rounded-xl gap-1.5 px-3"
                        onClick={() => setIsImportModalOpen(true)}
                        title="Importar decks e progresso"
                      >
                        <Upload size={13} /> Importar Decks
                      </Button>
                      <span className="text-[11px] text-muted-foreground font-bold shrink-0">
                        {decks ? decks.length : 0} decks
                      </span>
                    </div>
                  </div>

                  {decks && decks.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                      {decks.map(deck => (
                        <DeckCard
                          key={deck.id}
                          deck={deck}
                          cards={cards || []}
                          onStudy={handleStartStudy}
                          onAddCard={handleOpenAddCardModal}
                          onEditDeck={handleOpenEditDeckModal}
                          onDeleteDeck={handleDeleteDeck}
                          onExportDeck={handleExportDeck}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-12 gap-4 text-muted-foreground border border-border border-dashed rounded-2xl">
                      <Layers size={40} className="text-muted-foreground/60" />
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm text-foreground">Nenhum deck criado</h3>
                        <p className="text-xs max-w-[240px] mx-auto">Crie um deck de estudos e adicione seus primeiros cartões para começar a aprender.</p>
                      </div>
                      <Button 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 cursor-pointer text-xs h-9 px-4 rounded-lg mt-2" 
                        onClick={handleOpenNewDeckModal}
                      >
                        <Plus size={14} /> Criar Primeiro Deck
                      </Button>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 2: BANCO DE CARDS */}
            {activeTab === 'cards' && (
              <div className="space-y-4 w-full max-w-none px-2 md:px-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-md text-foreground tracking-tight">🔍 Banco de Cards</h2>
                  <span className="text-[11px] text-muted-foreground font-bold">
                    {cards ? cards.length : 0} cartões
                  </span>
                </div>

                {/* Input de Busca */}
                <div className="relative">
                  <Input
                    type="text"
                    className="pl-10 bg-card border-border text-foreground focus-visible:ring-ring focus-visible:border-primary placeholder:text-muted-foreground/60 h-11 rounded-xl"
                    placeholder="Buscar palavra, significado ou contexto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                    <Search size={16} />
                  </div>
                </div>

                {/* Lista de cartões filtrados */}
                {filteredCards.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                      {paginatedCards.map(card => {
                        const deck = decks?.find(d => d.id === card.deckId);
                        return (
                          <div 
                            key={card.id} 
                            className="p-4 bg-card border border-border rounded-xl space-y-2 hover:border-muted-foreground/30 hover:shadow-md transition-all cursor-pointer shadow-sm relative group break-words"
                            onClick={() => handleOpenPreviewModal(card)}
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider text-[9px] truncate max-w-[120px]">
                                {deck ? deck.name.replace(/[^a-zA-Z0-9\s]/g, '').trim() : 'Sem Deck'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground font-medium text-[10px]">
                                  {card.interval === 0 ? 'Novo' : `Int: ${card.interval}d`} (F.Fac: {card.ease.toFixed(1)})
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted p-0 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCardToEdit(card);
                                    setIsCardModalOpen(true);
                                  }}
                                  title="Editar Cartão"
                                >
                                  <Pencil size={11} />
                                </Button>
                              </div>
                            </div>
                            <div className="font-bold text-sm text-foreground">{stripHtmlTags(card.front)}</div>
                            <div className="text-muted-foreground text-xs font-semibold">{stripHtmlTags(card.back)}</div>
                            {card.context && (
                              <div className="text-[10px] text-muted-foreground/80 font-medium italic border-l-2 border-border pl-2 mt-1">
                                {stripHtmlTags(card.context)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Controles de Paginação */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/50 pt-4 mt-2 gap-3">
                        <div className="text-xs font-semibold text-muted-foreground">
                          Mostrando {Math.min(filteredCards.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}-{Math.min(filteredCards.length, currentPage * ITEMS_PER_PAGE)} de {filteredCards.length} cartões
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 cursor-pointer border-border bg-card hover:bg-muted text-foreground font-bold"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            title="Primeira página"
                          >
                            &laquo;
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 cursor-pointer border-border bg-card hover:bg-muted text-foreground"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            title="Página anterior"
                          >
                            <ChevronLeft size={14} />
                          </Button>
                          <span className="text-xs font-bold text-foreground px-2">
                            {currentPage} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 cursor-pointer border-border bg-card hover:bg-muted text-foreground"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            title="Próxima página"
                          >
                            <ChevronRight size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 cursor-pointer border-border bg-card hover:bg-muted text-foreground font-bold"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            title="Última página"
                          >
                            &raquo;
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-14 gap-3 text-muted-foreground">
                    <Search size={32} className="text-muted-foreground/60" />
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-sm text-foreground">Nenhum cartão encontrado</h3>
                      <p className="text-xs max-w-[200px] mx-auto">Nenhum cartão corresponde aos termos de busca inseridos.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MEU PERFIL */}
            {activeTab === 'profile' && (
              <div className="space-y-6 w-full max-w-none px-2 md:px-6">
                <ShadcnCard className="bg-card border-border p-6 text-center flex flex-col items-center gap-3 rounded-2xl shadow-sm max-w-2xl mx-auto">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center font-black text-3xl border-2 border-border shadow-xl text-zinc-50 shadow-violet-600/10">
                    👤
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-lg text-foreground">Daniel Oliveira</h3>
                    <span className="inline-block px-3 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                      Nível {userLevel} • {earnedXp} XP totais
                    </span>
                  </div>
                  
                  {/* Barra de Progresso de Nível */}
                  <div className="w-full space-y-1.5 mt-2">
                    <Progress value={earnedXp % 100} className="h-2 bg-muted" />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
                      <span>{earnedXp % 100} / 100 XP</span>
                      <span>Falta {xpNeededForNextLevel} XP para Nív. {userLevel + 1}</span>
                    </div>
                  </div>
                </ShadcnCard>

                {/* Seção Conquistas */}
                <div className="space-y-3">
                  <h2 className="font-extrabold text-md text-foreground tracking-tight">🏅 Minhas Conquistas</h2>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {/* Badge 1 */}
                    <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
                       (decks && decks.length > 0) ? '' : 'opacity-40'
                    }`}>
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
                        <Plus size={18} />
                      </div>
                      <span className="font-bold text-xs text-foreground">Primeiro Deck</span>
                      <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Criou o seu primeiro deck local</span>
                    </div>

                    {/* Badge 2 */}
                    <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
                      streak > 0 ? '' : 'opacity-40'
                    }`}>
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
                        <Flame size={18} />
                      </div>
                      <span className="font-bold text-xs text-foreground">Hábito de Estudo</span>
                      <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Completou 1 dia de ofensiva</span>
                    </div>

                    {/* Badge 3 */}
                    <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
                      totalRevisionsCount >= 5 ? '' : 'opacity-40'
                    }`}>
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
                        <Trophy size={18} />
                      </div>
                      <span className="font-bold text-xs text-foreground">Foco de Aço</span>
                      <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Revisou mais de 5 cartões</span>
                    </div>

                    {/* Badge 4 */}
                    <div className="p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors opacity-40 shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                        <Sparkles size={18} />
                      </div>
                      <span className="font-bold text-xs text-muted-foreground">Mestre</span>
                      <span className="text-[10px] text-muted-foreground/60 font-semibold leading-snug">Memorizou mais de 100 cards</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CONFIGURAÇÕES */}
            {activeTab === 'settings' && (
              <div className="space-y-4 w-full max-w-none px-2 md:px-6">
                <h2 className="font-extrabold text-md text-foreground tracking-tight">⚙️ Configurações</h2>

                <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
                    Preferências de Interface & SRS
                  </div>
                  
                  {/* Seletor de Tema Claro/Escuro */}
                  <div className="flex items-center justify-between p-4 bg-card">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">Tema do Aplicativo</span>
                      <span className="text-[11px] text-muted-foreground">Alternar entre claro e escuro</span>
                    </div>
                    <select 
                      className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer focus:border-muted-foreground/45"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                    >
                      <option value="light">Claro ☀️</option>
                      <option value="dark">Escuro 🌙</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-card">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">Algoritmo Spaced Repetition</span>
                      <span className="text-[11px] text-muted-foreground">Escolha a fórmula do agendamento</span>
                    </div>
                    <select 
                      className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer focus:border-muted-foreground/45"
                      value={selectedAlgo}
                      onChange={(e) => setSelectedAlgo(e.target.value as 'SM-2' | 'FSRS')}
                    >
                      <option value="SM-2">SM-2 (Clássico)</option>
                      <option value="FSRS">FSRS v4 (Moderno - Beta)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-card">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">Notificações Diárias</span>
                      <span className="text-[11px] text-muted-foreground">Lembrar de revisar cards pendentes</span>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-primary bg-muted border-border rounded cursor-pointer"
                      checked={notificationsEnabled}
                      onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm">
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
                    Sobre & Armazenamento
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-card text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">Banco de Dados Local</span>
                      <span className="text-[11px] text-muted-foreground">Plataforma IndexedDB (Dexie)</span>
                    </div>
                    <span className="text-xs font-bold text-primary">Ativo</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-card text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">Tamanho no Disco</span>
                      <span className="text-[11px] text-muted-foreground">Cards e estatísticas salvas localmente</span>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">
                      ~{(cards ? JSON.stringify(cards).length / 1024 : 0).toFixed(2)} KB
                    </span>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
                  <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
                    Backup & Restauração
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Exporte sua base de dados completa (incluindo áudios e progresso) ou restaure a partir de um arquivo de backup do Memorize.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <Button
                      variant="outline"
                      className="border-border bg-muted/20 hover:bg-muted text-foreground font-semibold cursor-pointer h-10 text-xs rounded-xl gap-2 justify-center"
                      onClick={handleExportFullBackup}
                    >
                      <Download size={14} /> Exportar Backup
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border bg-muted/20 hover:bg-muted text-foreground font-semibold cursor-pointer h-10 text-xs rounded-xl gap-2 justify-center"
                      onClick={() => setIsImportModalOpen(true)}
                    >
                      <Upload size={14} /> Restaurar Backup
                    </Button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
                  <div className="text-[10px] text-destructive font-bold uppercase tracking-wider">
                    Zona de Perigo
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full border-destructive/20 bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground text-destructive font-semibold cursor-pointer py-5 text-xs rounded-xl"
                    onClick={handleResetAllData}
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Limpar todos os dados locais
                  </Button>
                </div>
              </div>
            )}

          </main>
        )}

        {/* Floating Action Button (decks view only, responsive positioning) */}
        {currentView === 'dashboard' && activeTab === 'decks' && decks && decks.length > 0 && (
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
              deckName={selectedDeck ? selectedDeck.name : ''}
              cardsToStudy={cardsToStudy}
              onGradeCard={handleGradeCard}
              onCancel={() => {
                setCurrentView('dashboard');
                setSelectedDeckId(null);
              }}
              onFinishSession={handleFinishStudySession}
            />
          </main>
        )}

        {/* 4. TELA: CONGRATS */}
        {currentView === 'congrats' && (
          <main className="flex-1 p-5 overflow-y-auto w-full flex flex-col justify-center">
            <CongratsScreen
              streak={streak}
              cardsStudied={sessionCardsStudied}
              onBackToDashboard={() => {
                setCurrentView('dashboard');
                setSelectedDeckId(null);
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

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        decks={decks}
      />
    </div>
  );
}

export default App;
