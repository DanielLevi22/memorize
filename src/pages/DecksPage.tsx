import React, { useState } from 'react';
import { Plus, Upload, Layers, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import type { Deck, Card } from '../types';

interface DecksPageProps {
  decks: Deck[] | undefined;
  cards: Card[] | undefined;
  activeDeckMenuId: string | null;
  setActiveDeckMenuId: (id: string | null) => void;
  handleOpenNewDeckModal: () => void;
  setIsImportModalOpen: (open: boolean) => void;
  handleStartStudy: (deckId: string) => void;
  handleOpenAddCardModal: (deckId: string) => void;
  handleOpenEditDeckModal: (deck: Deck) => void;
  handleOpenDeckOptionsModal: (deck: Deck) => void;
  handleExportDeck: (deckId: string) => void;
  handleDeleteDeck: (deckId: string) => void;
  handleOpenAiModal: () => void;
  getDeckStudyableCounts: (deck: Deck, deckCards: Card[]) => {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCount: number;
  };
}

export const DecksPage: React.FC<DecksPageProps> = ({
  decks,
  cards,
  activeDeckMenuId,
  setActiveDeckMenuId,
  handleOpenNewDeckModal,
  setIsImportModalOpen,
  handleStartStudy,
  handleOpenAddCardModal,
  handleOpenEditDeckModal,
  handleOpenDeckOptionsModal,
  handleExportDeck,
  handleDeleteDeck,
  handleOpenAiModal,
  getDeckStudyableCounts,
}) => {
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);

  const getDeckCefrBreakdown = (deckCards: Card[]) => {
    const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    deckCards.forEach(c => {
      if (c.cefrLevel && c.cefrLevel in counts) {
        counts[c.cefrLevel as keyof typeof counts]++;
      }
    });
    return counts;
  };

  return (
    <div className="space-y-6 w-full max-w-none px-2 md:px-6 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm">
              <Layers size={24} />
            </div>
            Treino de Espaçamento Lexical (Baralhos)
          </h2>
          <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
            Seus baralhos de vocabulário e revisões ativas programadas por repetição espaçada.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <span className="text-xs text-muted-foreground font-bold shrink-0">
          {decks ? decks.length : 0} baralhos no total
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="text-xs h-8 font-bold bg-violet-600 text-zinc-50 hover:bg-violet-700 cursor-pointer rounded-xl gap-1.5 px-3 border-none shadow-sm shadow-violet-500/20"
            onClick={handleOpenAiModal}
          >
            <Sparkles size={13} /> Gerar com IA
          </Button>
          <Button
            variant="default"
            size="sm"
            className="text-xs h-8 font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-xl gap-1.5 px-3"
            onClick={handleOpenNewDeckModal}
          >
            <Plus size={13} /> Novo Baralho
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 font-semibold border-border bg-card hover:bg-muted text-foreground cursor-pointer rounded-xl gap-1.5 px-3"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload size={13} /> Importar Decks
          </Button>
        </div>
      </div>

      {decks && decks.length > 0 ? (
        <div className="w-full space-y-4">
          {decks.map(deck => {
            const deckCards = cards ? cards.filter(c => c.deckId === deck.id) : [];
            const { newCount, learningCount, reviewCount, totalCount: totalStudyable } = getDeckStudyableCounts(deck, deckCards);
            const learnedCount = deckCards.length - totalStudyable;
            const progressPercent = deckCards.length > 0 ? (learnedCount / deckCards.length) * 100 : 0;

            return (
              <div 
                key={deck.id}
                className={`relative flex flex-col bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 group cursor-pointer ${activeDeckMenuId === deck.id ? 'z-50' : 'z-0'}`}
                onClick={() => handleStartStudy(deck.id)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl overflow-hidden" />

                <div className="p-5 flex flex-col gap-4 relative z-10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-extrabold text-lg text-foreground truncate group-hover:text-primary transition-colors">
                        {deck.name}
                      </h3>
                      <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                        {deckCards.length} cartões totais
                      </p>

                      {/* CEFR level breakdown tags */}
                      {deckCards.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(getDeckCefrBreakdown(deckCards))
                            .filter(([_, count]) => count > 0)
                            .map(([level, count]) => {
                              let colorClass = "bg-muted/40 border-border text-muted-foreground";
                              if (level === 'A1' || level === 'A2') {
                                colorClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400";
                              } else if (level === 'B1' || level === 'B2') {
                                colorClass = "bg-primary/10 border-primary/20 text-primary";
                              } else if (level === 'C1' || level === 'C2') {
                                colorClass = "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400";
                              }
                              return (
                                <span 
                                  key={level} 
                                  className={`text-[8.5px] font-extrabold uppercase border px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${colorClass}`}
                                  title={`${count} cartões classificados como nível ${level}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {level}: {count}
                                </span>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Study stats count */}
                      <div className="hidden sm:flex items-center gap-3 bg-background border border-border/50 px-3 py-1.5 rounded-xl">
                        <div className="flex items-center gap-1.5" title="Cartões Novos">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span className={`text-xs font-bold ${newCount > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>{newCount} <span className="font-semibold text-muted-foreground ml-0.5 hidden md:inline">Novos</span></span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Cartões em Aprendizado">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span className={`text-xs font-bold ${learningCount > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>{learningCount} <span className="font-semibold text-muted-foreground ml-0.5 hidden md:inline">Aprender</span></span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Cartões para Revisar">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className={`text-xs font-bold ${reviewCount > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>{reviewCount} <span className="font-semibold text-muted-foreground ml-0.5 hidden md:inline">Revisar</span></span>
                        </div>
                      </div>

                      {/* Options menu gear */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer rounded-xl hover:bg-muted border border-transparent group-hover:border-border/50 transition-all z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDeckMenuId(activeDeckMenuId === deck.id ? null : deck.id);
                          }}
                        >
                          ⚙️
                        </Button>

                        {/* Options Dropdown */}
                        {activeDeckMenuId === deck.id && (
                          <div 
                            className="absolute right-0 top-11 w-48 bg-card border border-border/80 rounded-xl shadow-xl z-30 py-1.5 text-left text-xs font-bold text-foreground animate-in fade-in slide-in-from-top-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-muted cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => { handleStartStudy(deck.id); setActiveDeckMenuId(null); }}
                            >
                              📖 Estudar ({totalStudyable})
                            </button>
                            <button 
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-muted cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => { handleOpenAddCardModal(deck.id); setActiveDeckMenuId(null); }}
                            >
                              ➕ Adicionar Cartão
                            </button>
                            <button 
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-muted cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => { handleOpenDeckOptionsModal(deck); setActiveDeckMenuId(null); }}
                            >
                              ⚙️ Opções do Baralho
                            </button>
                            <button 
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-muted cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => { handleOpenEditDeckModal(deck); setActiveDeckMenuId(null); }}
                            >
                              ✏️ Renomear
                            </button>
                            <button 
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-muted cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => { handleExportDeck(deck.id); setActiveDeckMenuId(null); }}
                            >
                              📥 Exportar Backup
                            </button>
                            <hr className="border-border/60 my-1" />
                            <button 
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-destructive/10 text-red-500 hover:text-red-600 cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => { 
                                if (deck) setDeckToDelete(deck);
                              }}
                            >
                              🗑️ Excluir Baralho
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold shrink-0 min-w-[32px] text-right">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deckToDelete} onOpenChange={(open) => !open && setDeckToDelete(null)}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            🗑️
          </div>
          <DialogHeader className="space-y-2 flex flex-col items-center">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              Excluir Baralho
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground font-medium max-w-[280px]">
              Tem certeza que deseja apagar o baralho <strong className="text-foreground">{deckToDelete?.name}</strong>? Todos os cartões dentro dele serão perdidos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 font-bold h-11 rounded-xl"
              onClick={() => setDeckToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1 font-bold h-11 rounded-xl shadow-sm"
              onClick={() => {
                if (deckToDelete) {
                  handleDeleteDeck(deckToDelete.id);
                  setDeckToDelete(null);
                }
              }}
            >
              Sim, excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
