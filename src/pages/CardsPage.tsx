import React from 'react';
import { Search, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import type { Card, Deck } from '../types';

interface CardsPageProps {
  cards: Card[] | undefined;
  decks: Deck[] | undefined;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredCards: Card[];
  paginatedCards: Card[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  ITEMS_PER_PAGE: number;
  handleOpenPreviewModal: (card: Card) => void;
  setCardToEdit: (card: Card | null) => void;
  setIsCardModalOpen: (open: boolean) => void;
  stripHtmlTags: (str: string) => string;
}

export const CardsPage: React.FC<CardsPageProps> = ({
  cards,
  decks,
  searchTerm,
  setSearchTerm,
  filteredCards,
  paginatedCards,
  currentPage,
  setCurrentPage,
  totalPages,
  ITEMS_PER_PAGE,
  handleOpenPreviewModal,
  setCardToEdit,
  setIsCardModalOpen,
  stripHtmlTags
}) => {
  return (
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
                  {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {card.tags.map((tag, tIdx) => (
                        <span key={tIdx} className="text-[8px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                          #{tag}
                        </span>
                      ))}
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
  );
};
