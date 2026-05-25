import React from 'react';
import { Plus, Upload, Layers, Sparkles } from 'lucide-react';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import type { Deck, Card } from '../types';

interface DashboardPageProps {
  decks: Deck[] | undefined;
  cards: Card[] | undefined;
  todayStr: string;
  totalNew: number;
  totalDue: number;
  totalLearned: number;
  activeDeckMenuId: string | null;
  setActiveDeckMenuId: (id: string | null) => void;
  handleOpenNewDeckModal: () => void;
  setIsImportModalOpen: (open: boolean) => void;
  handleStartStudy: (deckId: string) => void;
  handleOpenAddCardModal: (deckId: string) => void;
  handleOpenEditDeckModal: (deck: Deck) => void;
  handleExportDeck: (deckId: string) => void;
  handleDeleteDeck: (deckId: string) => void;
  stats: {
    count: number;
    minutes: number;
    sPerCard: number;
  };
  handleOpenAiModal: () => void;
  dailyGoal: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  decks,
  cards,
  todayStr,
  totalNew,
  totalDue,
  totalLearned,
  activeDeckMenuId,
  setActiveDeckMenuId,
  handleOpenNewDeckModal,
  setIsImportModalOpen,
  handleStartStudy,
  handleOpenAddCardModal,
  handleOpenEditDeckModal,
  handleExportDeck,
  handleDeleteDeck,
  stats,
  handleOpenAiModal,
  dailyGoal,
}) => {
  return (
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

      {/* Barra de Progresso da Meta Diária */}
      <section className="bg-card border border-border p-4.5 rounded-2xl shadow-sm relative overflow-hidden">
        {/* Glow de Meta Batida */}
        {stats.count >= dailyGoal && (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-emerald-500/5 animate-pulse pointer-events-none" />
        )}
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">Meta Diária</span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                {stats.count >= dailyGoal 
                  ? "Parabéns! Meta diária batida hoje. 🎉" 
                  : "Mantenha o foco e complete sua meta diária!"}
              </span>
            </div>
          </div>
          <span className="text-xs font-black text-foreground">
            {stats.count} / {dailyGoal} <span className="text-muted-foreground font-semibold">cards</span>
          </span>
        </div>
        
        <div className="mt-3.5 relative w-full h-3 bg-muted rounded-full overflow-hidden border border-border/40 z-10">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              stats.count >= dailyGoal 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-500'
            }`}
            style={{ width: `${Math.min(100, Math.round((stats.count / dailyGoal) * 100))}%` }}
          />
        </div>

        {stats.count >= dailyGoal && (
          <div className="mt-2 text-[10px] text-emerald-500 font-extrabold tracking-wide uppercase text-right relative z-10 flex items-center justify-end gap-1">
            <span>✨</span> Meta Diária Batida!
          </div>
        )}
      </section>

      {/* Decks Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-md text-foreground tracking-tight">📁 Baralhos</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8 font-bold bg-violet-600 text-zinc-50 hover:bg-violet-700 cursor-pointer rounded-xl gap-1.5 px-3 border-none shadow-sm shadow-violet-500/20"
              onClick={handleOpenAiModal}
              title="Gerar baralho inteligente com Inteligência Artificial"
            >
              <Sparkles size={13} /> Gerar com IA
            </Button>
            <Button
              variant="default"
              size="sm"
              className="text-xs h-8 font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-xl gap-1.5 px-3"
              onClick={handleOpenNewDeckModal}
              title="Criar novo baralho"
            >
              <Plus size={13} /> Novo Baralho
            </Button>
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
          <div className="w-full max-w-4xl mx-auto space-y-3">
            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider items-center text-center">
              <div className="col-span-5 sm:col-span-6 text-left pl-2">Baralho</div>
              <div className="col-span-2">Novo</div>
              <div className="col-span-2">Aprender</div>
              <div className="col-span-2 sm:col-span-1">Revisar</div>
              <div className="col-span-1"></div>
            </div>

            {/* Decks Cards List */}
            {decks.map(deck => {
              const deckCards = cards ? cards.filter(c => c.deckId === deck.id) : [];
              const newCount = deckCards.filter(c => c.interval === 0).length;
              const learningCount = deckCards.filter(c => c.interval > 0 && c.repetitions <= 1 && c.dueDate <= todayStr).length;
              const reviewCount = deckCards.filter(c => c.interval > 0 && c.repetitions > 1 && c.dueDate <= todayStr).length;
              const totalStudyable = newCount + learningCount + reviewCount;

              return (
                <div 
                  key={deck.id}
                  className="grid grid-cols-12 p-4 bg-card border border-border rounded-xl shadow-sm hover:border-muted-foreground/25 hover:shadow-md transition-all hover:bg-muted/5 items-center text-center relative text-sm font-semibold"
                >
                  {/* Deck Name */}
                  <div className="col-span-5 sm:col-span-6 text-left pl-2 flex items-center gap-2">
                    <button
                      className="font-bold text-foreground hover:text-primary transition-colors text-left cursor-pointer truncate max-w-full"
                      onClick={() => handleStartStudy(deck.id)}
                      title="Estudar este deck"
                    >
                      {deck.name}
                    </button>
                  </div>

                  {/* Novo Count */}
                  <div className="col-span-2">
                    <span className={newCount > 0 ? "text-blue-500 font-bold" : "text-muted-foreground/40 font-medium"}>
                      {newCount}
                    </span>
                  </div>

                  {/* Aprender Count */}
                  <div className="col-span-2">
                    <span className={learningCount > 0 ? "text-red-500 font-bold" : "text-muted-foreground/40 font-medium"}>
                      {learningCount}
                    </span>
                  </div>

                  {/* Revisar Count */}
                  <div className="col-span-2 sm:col-span-1">
                    <span className={reviewCount > 0 ? "text-emerald-500 font-bold" : "text-muted-foreground/40 font-medium"}>
                      {reviewCount}
                    </span>
                  </div>

                  {/* Actions Gear */}
                  <div className="col-span-1 flex justify-end pr-2 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDeckMenuId(activeDeckMenuId === deck.id ? null : deck.id);
                      }}
                      title="Opções do deck"
                    >
                      ⚙️
                    </Button>

                    {/* Dropdown Popover */}
                    {activeDeckMenuId === deck.id && (
                      <div className="absolute right-2 top-9 w-44 bg-card border border-border rounded-xl shadow-lg z-20 py-1 text-left text-xs font-bold text-foreground">
                        <button 
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                          onClick={() => { handleStartStudy(deck.id); setActiveDeckMenuId(null); }}
                        >
                          📖 Estudar ({totalStudyable})
                        </button>
                        <button 
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                          onClick={() => { handleOpenAddCardModal(deck.id); setActiveDeckMenuId(null); }}
                        >
                          ➕ Adicionar Cartão
                        </button>
                        <button 
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                          onClick={() => { handleOpenEditDeckModal(deck); setActiveDeckMenuId(null); }}
                        >
                          ✏️ Editar Deck
                        </button>
                        <button 
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                          onClick={() => { handleExportDeck(deck.id); setActiveDeckMenuId(null); }}
                        >
                          📥 Exportar Deck
                        </button>
                        <hr className="border-border my-1" />
                        <button 
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted text-red-500 hover:text-red-600 cursor-pointer flex items-center gap-2"
                          onClick={() => { 
                            setActiveDeckMenuId(null);
                            if (window.confirm(`Tem certeza que deseja excluir o deck "${deck.name}"? Todos os cartões associados serão apagados permanentemente.`)) {
                              handleDeleteDeck(deck.id); 
                            }
                          }}
                        >
                          🗑️ Excluir Deck
                        </button>
                      </div>
                    )}
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

        {/* Estatísticas de Estudo do Rodapé */}
        {decks && decks.length > 0 && (
          <div className="text-center text-xs text-muted-foreground/80 font-bold mt-8 border-t border-border/40 pt-4 tracking-wide max-w-xl mx-auto">
            Estudado(s) {stats.count} cartões em {stats.minutes.toString().replace('.', ',')} minutos hoje ({stats.sPerCard.toString().replace('.', ',')}s/card)
          </div>
        )}
      </section>
    </div>
  );
};
