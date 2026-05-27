import React, { useState, useEffect } from 'react';
import type { Deck, DeckPreset } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { RotateCcw, Globe, HelpCircle } from 'lucide-react';

interface DeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    description: string,
    presetId: string,
    overrides?: Partial<Deck>,
    presetUpdates?: Partial<DeckPreset>
  ) => void;
  deckToEdit?: Deck | null;
  presets?: DeckPreset[];
}

export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  onClose,
  onSave,
  deckToEdit,
  presets
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [presetId, setPresetId] = useState('default-study-preset');

  // Overrides de Novos Cartões
  const [newCardsLimitType, setNewCardsLimitType] = useState<'preset' | 'deck' | 'today'>('preset');
  const [newCardsLimitValue, setNewCardsLimitValue] = useState(20);
  const [newCardsLimitToday, setNewCardsLimitToday] = useState(20);

  // Overrides de Revisões Máximas
  const [reviewsLimitType, setReviewsLimitType] = useState<'preset' | 'deck' | 'today'>('preset');
  const [reviewsLimitValue, setReviewsLimitValue] = useState(200);
  const [reviewsLimitToday, setReviewsLimitToday] = useState(200);

  // Preset-wide options
  const activePreset = presets?.find(p => p.id === presetId);
  const [presetNewCardsPerDay, setPresetNewCardsPerDay] = useState(20);
  const [presetMaxReviewsPerDay, setPresetMaxReviewsPerDay] = useState(200);
  const [newCardsIgnoreReviewLimit, setNewCardsIgnoreReviewLimit] = useState(false);
  const [limitsStartFromParent, setLimitsStartFromParent] = useState(false);

  useEffect(() => {
    if (deckToEdit) {
      setName(deckToEdit.name);
      setDescription(deckToEdit.description);
      setPresetId(deckToEdit.presetId || 'default-study-preset');
      
      setNewCardsLimitType(deckToEdit.newCardsLimitType || 'preset');
      setNewCardsLimitValue(deckToEdit.newCardsLimitValue ?? 20);
      setNewCardsLimitToday(deckToEdit.newCardsLimitToday ?? 20);

      setReviewsLimitType(deckToEdit.reviewsLimitType || 'preset');
      setReviewsLimitValue(deckToEdit.reviewsLimitValue ?? 200);
      setReviewsLimitToday(deckToEdit.reviewsLimitToday ?? 200);
    } else {
      setName('');
      setDescription('');
      setPresetId('default-study-preset');

      setNewCardsLimitType('preset');
      setNewCardsLimitValue(20);
      setNewCardsLimitToday(20);

      setReviewsLimitType('preset');
      setReviewsLimitValue(200);
      setReviewsLimitToday(200);
    }
  }, [deckToEdit, isOpen]);

  useEffect(() => {
    if (activePreset) {
      setPresetNewCardsPerDay(activePreset.newCardsPerDay);
      setPresetMaxReviewsPerDay(activePreset.maxReviewsPerDay);
      setNewCardsIgnoreReviewLimit(activePreset.newCardsIgnoreReviewLimit);
      setLimitsStartFromParent(activePreset.limitsStartFromParent);
    }
  }, [activePreset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const todayStr = new Date().toISOString().split('T')[0];

    const overrides: Partial<Deck> = {
      newCardsLimitType,
      newCardsLimitValue,
      newCardsLimitToday,
      newCardsLimitTodayDate: newCardsLimitType === 'today' ? todayStr : deckToEdit?.newCardsLimitTodayDate,
      
      reviewsLimitType,
      reviewsLimitValue,
      reviewsLimitToday,
      reviewsLimitTodayDate: reviewsLimitType === 'today' ? todayStr : deckToEdit?.reviewsLimitTodayDate,
    };

    const presetUpdates: Partial<DeckPreset> = {
      newCardsPerDay: presetNewCardsPerDay,
      maxReviewsPerDay: presetMaxReviewsPerDay,
      newCardsIgnoreReviewLimit,
      limitsStartFromParent,
    };

    onSave(name.trim(), description.trim(), presetId, overrides, presetUpdates);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-xs sm:max-w-lg rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="font-semibold text-lg text-foreground flex items-center gap-2">
            {deckToEdit ? '✏️ Editar Deck' : '📁 Novo Deck'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Scrollable Container for Fields */}
          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
            
            {/* Nome do Deck */}
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

            {/* Descrição */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="deck-desc">Descrição</label>
              <Textarea
                id="deck-desc"
                className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary min-h-[60px]"
                placeholder="Descreva brevemente o propósito deste deck..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Preset de Estudo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="deck-preset">
                Preset de Estudo (Opções do Anki)
              </label>
              <select
                id="deck-preset"
                className="w-full bg-background border border-border text-foreground px-3 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer focus:border-primary/50"
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
              >
                {presets && presets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.id === 'default-study-preset' ? '(Padrão)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* --- LIMITES DIÁRIOS CARD --- */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h3 className="text-sm font-bold text-foreground">Limites Diários</h3>
                <span className="text-muted-foreground hover:text-foreground cursor-help" title="Configurações de limites diários de estudos herdadas ou customizadas">
                  <HelpCircle className="w-4 h-4" />
                </span>
              </div>

              {/* 1. Novos cartões/dia */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-foreground">Novos cartões/dia</span>
                  
                  {/* Segmented Control / Tabs */}
                  <div className="flex gap-3 border-b border-border/40 pb-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setNewCardsLimitType('preset')}
                      className={`pb-1 cursor-pointer border-b-2 transition-all duration-150 ${
                        newCardsLimitType === 'preset' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCardsLimitType('deck')}
                      className={`pb-1 cursor-pointer border-b-2 transition-all duration-150 ${
                        newCardsLimitType === 'deck' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Esse baralho
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCardsLimitType('today')}
                      className={`pb-1 cursor-pointer border-b-2 transition-all duration-150 ${
                        newCardsLimitType === 'today' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Somente hoje
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="9999"
                    className="w-full bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs outline-none focus:border-primary/50 font-bold transition-all disabled:opacity-75"
                    value={
                      newCardsLimitType === 'preset'
                        ? presetNewCardsPerDay
                        : newCardsLimitType === 'deck'
                        ? newCardsLimitValue
                        : newCardsLimitToday
                    }
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      if (newCardsLimitType === 'preset') {
                        setPresetNewCardsPerDay(val);
                      } else if (newCardsLimitType === 'deck') {
                        setNewCardsLimitValue(val);
                      } else {
                        setNewCardsLimitToday(val);
                      }
                    }}
                  />
                  <button
                    type="button"
                    title="Restaurar para o preset"
                    onClick={() => setNewCardsLimitType('preset')}
                    className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 2. Revisões máximas/dia */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-foreground">Revisões máximas/dia</span>
                  
                  {/* Segmented Control / Tabs */}
                  <div className="flex gap-3 border-b border-border/40 pb-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setReviewsLimitType('preset')}
                      className={`pb-1 cursor-pointer border-b-2 transition-all duration-150 ${
                        reviewsLimitType === 'preset' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewsLimitType('deck')}
                      className={`pb-1 cursor-pointer border-b-2 transition-all duration-150 ${
                        reviewsLimitType === 'deck' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Esse baralho
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewsLimitType('today')}
                      className={`pb-1 cursor-pointer border-b-2 transition-all duration-150 ${
                        reviewsLimitType === 'today' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Somente hoje
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="9999"
                    className="w-full bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs outline-none focus:border-primary/50 font-bold transition-all disabled:opacity-75"
                    value={
                      reviewsLimitType === 'preset'
                        ? presetMaxReviewsPerDay
                        : reviewsLimitType === 'deck'
                        ? reviewsLimitValue
                        : reviewsLimitToday
                    }
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      if (reviewsLimitType === 'preset') {
                        setPresetMaxReviewsPerDay(val);
                      } else if (reviewsLimitType === 'deck') {
                        setReviewsLimitValue(val);
                      } else {
                        setReviewsLimitToday(val);
                      }
                    }}
                  />
                  <button
                    type="button"
                    title="Restaurar para o preset"
                    onClick={() => setReviewsLimitType('preset')}
                    className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Toggles globais do Preset */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                    <span>Novos cartões ignoram o limite de revisão.</span>
                    <span title="Opção global do preset">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={newCardsIgnoreReviewLimit}
                      onChange={(e) => setNewCardsIgnoreReviewLimit(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                    <span>Os limites começam do deck superior</span>
                    <span title="Opção global do preset">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={limitsStartFromParent}
                      onChange={(e) => setLimitsStartFromParent(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

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
