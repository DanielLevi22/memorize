import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { FileText, FolderPlus, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { ReadingText } from '../types';

interface ReadingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: ReadingText) => Promise<void>;
  preselectedCollectionId?: string;
}

export const ReadingImportModal: React.FC<ReadingImportModalProps> = ({
  isOpen,
  onClose,
  onSave,
  preselectedCollectionId,
}) => {
  const [title, setTitle] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const collections = useLiveQuery(() => db.readingCollections?.toArray()) || [];

  useEffect(() => {
    if (isOpen) {
      if (preselectedCollectionId) {
        setCollectionId(preselectedCollectionId);
      } else if (collections.length > 0) {
        setCollectionId(collections[0].id);
      } else {
        setCollectionId('__new__');
      }
      setNewCollectionName('');
      setTitle('');
      setErrorMsg('');
    }
  }, [isOpen, preselectedCollectionId, collections.length]);

  const handleClose = () => {
    setTitle('');
    setCollectionId('');
    setNewCollectionName('');
    setErrorMsg('');
    onClose();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMsg('O título é obrigatório.');
      return;
    }
    if (!collectionId) {
      setErrorMsg('A seleção de uma coleção é obrigatória.');
      return;
    }
    if (collectionId === '__new__' && !newCollectionName.trim()) {
      setErrorMsg('O nome da nova coleção é obrigatório.');
      return;
    }

    setErrorMsg('');
    setIsSaving(true);

    try {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

      let finalCollectionId = collectionId;

      // Create new collection inline if requested
      if (collectionId === '__new__') {
        const newCollId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15);
        
        await db.readingCollections.add({
          id: newCollId,
          title: newCollectionName.trim(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        finalCollectionId = newCollId;
      }

      const reading: ReadingText = {
        id: newId,
        title: title.trim(),
        type: 'reading',
        showInReadings: true,
        fullTextOriginal: '',
        fullTextTranslated: '',
        lines: [],
        collectionId: finalCollectionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await onSave(reading);
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar o texto.');
    } finally {
      setIsSaving(false);
    }
  };

  const preselectedCollection = collections.find(c => c.id === preselectedCollectionId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md w-full bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-black">
            <FileText size={18} className="text-primary" />
            Adicionar Novo Texto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Destination Badge if preselected */}
          {preselectedCollection && (
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/50 p-2.5 rounded-xl border border-border/60">
              <span>Pasta de destino:</span>
              <span className="bg-amber-500/10 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                📁 {preselectedCollection.title}
              </span>
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Título do Texto
            </label>
            <input
              type="text"
              placeholder="Ex: Capítulo 1 - The Adventure..."
              className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>

          {/* Coleção Selection (Only if not preselected) */}
          {!preselectedCollectionId && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Coleção (Pasta)
                </label>
                <Select value={collectionId} onValueChange={setCollectionId} disabled={isSaving}>
                  <SelectTrigger className="w-full bg-muted border-border text-foreground px-4 py-5 rounded-xl text-sm font-semibold focus:border-primary/50 transition-colors">
                    <SelectValue placeholder="Selecione uma Coleção..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-xl max-h-[250px]">
                    <SelectItem value="__new__" className="rounded-lg cursor-pointer font-bold focus:bg-primary/10 focus:text-primary text-primary">+ Criar Nova Coleção...</SelectItem>
                    {collections.map((col) => (
                      <SelectItem key={col.id} value={col.id} className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary">
                        📁 {col.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nome da Nova Coleção */}
              {collectionId === '__new__' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-xs font-bold text-violet-500 uppercase tracking-wider flex items-center gap-1">
                    <FolderPlus size={12} /> Nome da Nova Coleção
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Livro Sherlock Holmes..."
                    className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-semibold transition-colors"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              )}
            </>
          )}

          {/* Erro */}
          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold p-3 rounded-xl">
              ❌ {errorMsg}
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
              className="rounded-xl cursor-pointer font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer font-bold text-xs gap-1.5"
            >
              {isSaving ? (
                <><Loader2 size={14} className="animate-spin" /> Criando...</>
              ) : (
                'Criar Texto'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
