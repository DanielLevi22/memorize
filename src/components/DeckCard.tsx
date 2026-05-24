import React from 'react';
import { BookOpen, Plus, Pencil, Trash2, Download } from 'lucide-react';
import type { Deck, Card } from '../types';
import { Card as ShadcnCard, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Button } from './ui/button';

interface DeckCardProps {
  deck: Deck;
  cards: Card[];
  onStudy: (deckId: string) => void;
  onAddCard: (deckId: string) => void;
  onEditDeck: (deck: Deck) => void;
  onDeleteDeck: (deckId: string) => void;
  onExportDeck: (deckId: string) => void;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  cards,
  onStudy,
  onAddCard,
  onEditDeck,
  onDeleteDeck,
  onExportDeck
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const deckCards = cards.filter(c => c.deckId === deck.id);
  
  const newCount = deckCards.filter(c => c.interval === 0).length;
  const dueCount = deckCards.filter(c => c.interval > 0 && c.dueDate <= todayStr).length;
  const learnedCount = deckCards.filter(c => c.interval > 0 && c.dueDate > todayStr).length;

  const totalStudyable = newCount + dueCount;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir o deck "${deck.name}"? Todos os cartões associados serão apagados permanentemente.`)) {
      onDeleteDeck(deck.id);
    }
  };

  return (
    <ShadcnCard className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-muted-foreground/30 bg-card border-border">
      <div className="absolute left-0 top-0 w-[4px] h-full bg-primary opacity-0 hover:opacity-100 transition-opacity" />
      <CardHeader className="p-5 pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <CardTitle className="font-semibold text-lg text-card-foreground tracking-tight">{deck.name}</CardTitle>
            <CardDescription className="text-muted-foreground text-sm mt-1 line-clamp-2">
              {deck.description || 'Sem descrição.'}
            </CardDescription>
          </div>
          
          <div className="flex gap-1.5 text-xs font-semibold shrink-0">
            {newCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20" title="Novos">
                {newCount} N
              </span>
            )}
            {dueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20" title="Revisões">
                {dueCount} R
              </span>
            )}
            {learnedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Memorizados">
                {learnedCount} ok
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardFooter className="px-5 py-4 border-t border-border/50 flex justify-between items-center bg-muted/10">
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={totalStudyable === 0}
          onClick={() => onStudy(deck.id)}
        >
          <BookOpen size={14} />
          {totalStudyable > 0 ? `Estudar (${totalStudyable})` : 'Revisado'}
        </Button>

        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            onClick={() => onAddCard(deck.id)}
            title="Adicionar cartão"
          >
            <Plus size={15} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            onClick={() => onEditDeck(deck)}
            title="Editar deck"
          >
            <Pencil size={15} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onExportDeck(deck.id);
            }}
            title="Exportar deck"
          >
            <Download size={15} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            onClick={handleDelete}
            title="Excluir deck"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </CardFooter>
    </ShadcnCard>
  );
};
