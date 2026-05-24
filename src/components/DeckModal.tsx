import React, { useState, useEffect } from 'react';
import type { Deck } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

interface DeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  deckToEdit?: Deck | null;
}

export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  onClose,
  onSave,
  deckToEdit
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (deckToEdit) {
      setName(deckToEdit.name);
      setDescription(deckToEdit.description);
    } else {
      setName('');
      setDescription('');
    }
  }, [deckToEdit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-xs sm:max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-semibold text-lg text-foreground flex items-center gap-2">
            {deckToEdit ? '✏️ Editar Deck' : '📁 Novo Deck'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="deck-name">Nome do Deck *</label>
            <Input
              id="deck-name"
              type="text"
              className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary"
              placeholder="Ex: Phrasal Verbs, Business English"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="deck-desc">Descrição</label>
            <Textarea
              id="deck-desc"
              className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary min-h-[80px]"
              placeholder="Descreva brevemente o propósito deste deck..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
              disabled={!name.trim()}
            >
              {deckToEdit ? 'Salvar' : 'Criar Deck'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
