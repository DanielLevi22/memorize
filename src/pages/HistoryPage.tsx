import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, Zap, AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { db } from '../db/db';
import type { Card } from '../types';
import { Button } from '../components/ui/button';

interface HistoryPageProps {
  cards: Card[] | undefined;
  onStartCramSession: (cards: Card[]) => void;
}

type SortKey = 'date' | 'rating' | 'card';
type SortDir = 'asc' | 'desc';

const ratingLabel = (r: number) => {
  if (r === 1) return { label: 'Errei', color: 'text-destructive bg-destructive/10 border-destructive/20' };
  if (r === 2) return { label: 'Difícil', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
  return { label: 'Fácil', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
};

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const HistoryPage: React.FC<HistoryPageProps> = ({ cards, onStartCramSession }) => {
  const revisions = useLiveQuery(() => db.revisions.orderBy('timestamp').reverse().limit(500).toArray(), []);

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState<'all' | 'wrong' | 'hard' | 'easy'>('all');
  const [visibleCount, setVisibleCount] = useState(50);

  // Build card map for quick lookups
  const cardMap = useMemo(() => {
    const map = new Map<string, Card>();
    if (cards) cards.forEach(c => map.set(c.id, c));
    return map;
  }, [cards]);

  // Filtered + sorted revisions
  const processedRevisions = useMemo(() => {
    if (!revisions) return [];
    let list = [...revisions];

    if (filter === 'wrong') list = list.filter(r => r.rating === 1);
    else if (filter === 'hard') list = list.filter(r => r.rating === 2);
    else if (filter === 'easy') list = list.filter(r => r.rating === 3);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = a.timestamp - b.timestamp;
      else if (sortKey === 'rating') cmp = a.rating - b.rating;
      else if (sortKey === 'card') {
        const ca = cardMap.get(a.cardId)?.front ?? '';
        const cb = cardMap.get(b.cardId)?.front ?? '';
        cmp = ca.localeCompare(cb);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [revisions, filter, sortKey, sortDir, cardMap]);

  // Top forgotten cards (most lapses)
  const topForgottenCards = useMemo(() => {
    if (!cards) return [];
    return [...cards]
      .filter(c => c.lapses > 0)
      .sort((a, b) => b.lapses - a.lapses)
      .slice(0, 10);
  }, [cards]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronsUpDown size={12} className="opacity-40" />;
    return sortDir === 'desc'
      ? <ChevronDown size={12} className="text-primary" />
      : <ChevronUp size={12} className="text-primary" />;
  };

  const visible = processedRevisions.slice(0, visibleCount);
  const totalWrong = revisions?.filter(r => r.rating === 1).length ?? 0;
  const totalRevisions = revisions?.length ?? 0;
  const accuracy = totalRevisions > 0
    ? Math.round(((totalRevisions - totalWrong) / totalRevisions) * 100)
    : 0;

  return (
    <div className="space-y-5 w-full max-w-none px-2 md:px-6 pb-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-extrabold text-md text-foreground tracking-tight flex items-center gap-2">
          <History size={18} className="text-primary" />
          Histórico de Revisões
        </h2>
        <div className="text-xs text-muted-foreground font-semibold">
          {totalRevisions} revisões no total
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-foreground">{totalRevisions}</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">Revisões</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-emerald-500">{accuracy}%</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">Acurácia</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-destructive">{totalWrong}</div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">Erros</div>
        </div>
      </div>

      {/* Top forgotten cards */}
      {topForgottenCards.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-destructive/5 border-b border-destructive/10">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-destructive" />
              <span className="text-[10px] text-destructive font-bold uppercase tracking-wider">
                Cards Mais Esquecidos (Lapsos)
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] font-bold border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground cursor-pointer gap-1.5 rounded-lg px-3"
              onClick={() => onStartCramSession(topForgottenCards)}
            >
              <Zap size={11} />
              Sessão de Reforço
            </Button>
          </div>
          <div className="divide-y divide-border/60">
            {topForgottenCards.map((card, i) => (
              <div key={card.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-muted-foreground/50 w-5 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{card.front}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{card.back}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="text-[10px] font-black text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {card.lapses} lapso{card.lapses !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision history table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Filters */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border/60 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mr-1">Filtrar:</span>
          {(['all', 'wrong', 'hard', 'easy'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setVisibleCount(50); }}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border text-muted-foreground hover:border-muted-foreground/40'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'wrong' ? 'Errei' : f === 'hard' ? 'Difícil' : 'Fácil'}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground font-semibold">
            {processedRevisions.length} resultado{processedRevisions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_1fr_auto] px-4 py-2 border-b border-border/60 bg-muted/10">
          <button
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer"
            onClick={() => toggleSort('card')}
          >
            Card <SortIcon k="card" />
          </button>
          <button
            className="hidden sm:flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer"
            onClick={() => toggleSort('date')}
          >
            Data <SortIcon k="date" />
          </button>
          <button
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors text-left cursor-pointer"
            onClick={() => toggleSort('rating')}
          >
            Nota <SortIcon k="rating" />
          </button>
        </div>

        {/* Table rows */}
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm font-semibold">
            {totalRevisions === 0
              ? 'Nenhuma revisão registrada ainda. Comece a estudar! 🎓'
              : 'Nenhuma revisão com esse filtro.'}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {visible.map((rev) => {
              const card = cardMap.get(rev.cardId);
              const { label, color } = ratingLabel(rev.rating);
              return (
                <div key={rev.id} className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[2fr_1fr_auto] px-4 py-2.5 items-center hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {card ? card.front : <span className="text-muted-foreground italic">Card removido</span>}
                    </div>
                    {card && (
                      <div className="text-[11px] text-muted-foreground truncate hidden sm:block">{card.back}</div>
                    )}
                  </div>
                  <div className="hidden sm:block text-[11px] text-muted-foreground font-mono whitespace-nowrap pr-4">
                    {formatDate(rev.timestamp)}
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${color}`}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {processedRevisions.length > visibleCount && (
          <div className="px-4 py-3 border-t border-border/60 text-center">
            <button
              onClick={() => setVisibleCount(v => v + 50)}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              Carregar mais ({processedRevisions.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
