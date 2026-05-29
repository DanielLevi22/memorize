import React from 'react';
import { Plus, Upload, Layers, Sparkles } from 'lucide-react';
import { Card as ShadcnCard } from '../components/ui/card';
import { Button } from '../components/ui/button';
import type { Deck, Card } from '../types';

interface DashboardPageProps {
  decks: Deck[] | undefined;
  cards: Card[] | undefined;
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
  handleOpenDeckOptionsModal: (deck: Deck) => void;
  handleExportDeck: (deckId: string) => void;
  handleDeleteDeck: (deckId: string) => void;
  stats: {
    count: number;
    minutes: number;
    sPerCard: number;
  };
  handleOpenAiModal: () => void;
  dailyGoal: number;
  getDeckStudyableCounts: (deck: Deck, deckCards: Card[]) => {
    newCount: number;
    learningCount: number;
    reviewCount: number;
    totalCount: number;
  };
  readingStats: {
    minutes: number;
    wordsRead: number;
    sentencesMastered: number;
  };
  handleGoToReading: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  decks,
  cards,
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
  handleOpenDeckOptionsModal,
  handleExportDeck,
  handleDeleteDeck,
  stats,
  handleOpenAiModal,
  dailyGoal,
  getDeckStudyableCounts,
  readingStats,
  handleGoToReading,
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

      {/* Progresso de Leitura de Hoje */}
      <section className="bg-card border border-border p-4.5 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">Leitura de Hoje</span>
              <span className="text-[11px] text-muted-foreground font-semibold">
                Seu progresso nos textos e áudios hoje
              </span>
            </div>
          </div>
          {(readingStats.minutes === 0 && readingStats.wordsRead === 0 && readingStats.sentencesMastered === 0) && (
            <Button
              onClick={handleGoToReading}
              variant="outline"
              size="sm"
              className="text-[10px] h-7 font-bold border-border bg-card hover:bg-muted text-foreground cursor-pointer rounded-lg px-2.5"
            >
              Começar Leitura
            </Button>
          )}
        </div>
        
        {readingStats.minutes > 0 || readingStats.wordsRead > 0 || readingStats.sentencesMastered > 0 ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/30 border border-border/40 p-3 rounded-xl">
              <div className="font-extrabold text-lg text-primary tracking-tight">
                {readingStats.minutes.toString().replace('.', ',')} <span className="text-xs font-semibold text-muted-foreground">min</span>
              </div>
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Tempo</div>
            </div>
            <div className="bg-muted/30 border border-border/40 p-3 rounded-xl">
              <div className="font-extrabold text-lg text-primary tracking-tight">
                {readingStats.wordsRead}
              </div>
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Palavras</div>
            </div>
            <div className="bg-muted/30 border border-border/40 p-3 rounded-xl">
              <div className="font-extrabold text-lg text-primary tracking-tight">
                +{readingStats.sentencesMastered}
              </div>
              <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Dominadas</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground/80 font-medium py-1 px-1">
            Você ainda não praticou leitura hoje. Que tal ler um texto na Biblioteca de Leitura? 📖
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
          <div className="w-full max-w-4xl mx-auto space-y-4">
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
                  {/* Fundo sutil de gradiente ao passar o mouse */}
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
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {/* Estatísticas de Estudo do Dia */}
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

                        {/* Botão de Estudar (Mobile) */}
                        <div className="sm:hidden flex items-center bg-primary/10 text-primary px-3 py-1.5 rounded-xl font-bold text-xs">
                          {totalStudyable} pendentes
                        </div>

                        {/* Engrenagem de Opções */}
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer rounded-xl hover:bg-muted border border-transparent group-hover:border-border/50 transition-all z-20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDeckMenuId(activeDeckMenuId === deck.id ? null : deck.id);
                            }}
                            title="Opções do deck"
                          >
                            ⚙️
                          </Button>

                          {/* Menu Suspenso */}
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
                                  setActiveDeckMenuId(null);
                                  if (window.confirm(`Tem certeza que deseja excluir o deck "${deck.name}"? Todos os cartões associados serão apagados permanentemente.`)) {
                                    handleDeleteDeck(deck.id); 
                                  }
                                }}
                              >
                                🗑️ Excluir Baralho
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barra de Progresso Master (Visual) */}
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
