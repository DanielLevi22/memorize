import React, { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { Search, BookOpen, Layers, Clock, Zap, X } from 'lucide-react';
import type { Card, Deck } from '../types';
import './GlobalSearch.css';
import { getTagColors } from '../utils/tagColors';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[] | undefined;
  decks: Deck[] | undefined;
  onNavigateToCard: (card: Card) => void;
  onNavigateToDeck: (deck: Deck) => void;
}

const stripHtml = (str: string) => str?.replace(/<[^>]*>/g, '') ?? '';

// Últimas buscas (até 5)
const RECENT_KEY = 'memorize_recent_searches';
const getRecent = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
};
const saveRecent = (term: string) => {
  if (!term.trim()) return;
  const prev = getRecent().filter(t => t !== term);
  localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...prev].slice(0, 5)));
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  cards,
  decks,
  onNavigateToCard,
  onNavigateToDeck,
}) => {
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setRecents(getRecent());
    }
  }, [isOpen]);

  const todayStr = new Date().toISOString().split('T')[0];

  const deckMap = useMemo(() => {
    const m = new Map<string, Deck>();
    (decks ?? []).forEach(d => m.set(d.id, d));
    return m;
  }, [decks]);

  const dueInDeck = (deckId: string) =>
    (cards ?? []).filter(c => c.deckId === deckId && (c.interval === 0 || c.dueDate <= todayStr)).length;

  const handleSelectCard = (card: Card) => {
    saveRecent(query);
    setRecents(getRecent());
    onNavigateToCard(card);
    onClose();
  };

  const handleSelectDeck = (deck: Deck) => {
    saveRecent(query);
    setRecents(getRecent());
    onNavigateToDeck(deck);
    onClose();
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
  };

  const clearRecents = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecents([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="gs-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="gs-backdrop" />
      <Command className="gs-modal" label="Busca Global" shouldFilter={false}>
        {/* Input */}
        <div className="gs-input-wrapper">
          <Search size={15} className="gs-input-icon" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar cards, decks, tags..."
            className="gs-input"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          />
          {query && (
            <button className="gs-clear-btn" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
          <kbd className="gs-esc-badge">Esc</kbd>
        </div>

        <Command.List className="gs-list">
          <Command.Empty className="gs-empty">
            {query.trim()
              ? <>Nenhum resultado para <strong>"{query}"</strong></>
              : <span className="gs-empty-hint"><Search size={28} /><br />Digite para buscar cards, decks ou tags</span>
            }
          </Command.Empty>

          {/* Recent searches — shown when query is empty */}
          {!query.trim() && recents.length > 0 && (
            <Command.Group heading={
              <div className="gs-group-heading">
                <span className="gs-group-label"><Clock size={10} /> Buscas Recentes</span>
                <button className="gs-clear-recents" onClick={clearRecents}>Limpar</button>
              </div>
            }>
              {recents.map(r => (
                <Command.Item
                  key={r}
                  value={`recent:${r}`}
                  onSelect={() => handleSelectRecent(r)}
                  className="gs-item"
                >
                  <div className="gs-item-icon gs-icon-muted">
                    <Clock size={13} />
                  </div>
                  <span className="gs-item-label">{r}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Deck results */}
          {(decks ?? [])
            .filter(d =>
              !query.trim() ? false :
              d.name.toLowerCase().includes(query.toLowerCase()) ||
              d.description?.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 3)
            .length > 0 && (
            <Command.Group heading={<span className="gs-group-label"><Layers size={10} /> Decks</span>}>
              {(decks ?? [])
                .filter(d =>
                  d.name.toLowerCase().includes(query.toLowerCase()) ||
                  d.description?.toLowerCase().includes(query.toLowerCase())
                )
                .slice(0, 3)
                .map(deck => {
                  const due = dueInDeck(deck.id);
                  return (
                    <Command.Item
                      key={deck.id}
                      value={`deck:${deck.name}:${deck.description}`}
                      onSelect={() => handleSelectDeck(deck)}
                      className="gs-item"
                    >
                      <div className="gs-item-icon gs-icon-primary">
                        <Layers size={13} />
                      </div>
                      <div className="gs-item-text">
                        <span className="gs-item-label">{deck.name}</span>
                        {deck.description && <span className="gs-item-sub">{deck.description}</span>}
                      </div>
                      <div className="gs-item-right">
                        {due > 0 && (
                          <span className="gs-badge gs-badge-due">{due} venc.</span>
                        )}
                      </div>
                    </Command.Item>
                  );
                })}
            </Command.Group>
          )}

          {/* Card results */}
          {(cards ?? [])
            .filter(c =>
              !query.trim() ? false :
              stripHtml(c.front).toLowerCase().includes(query.toLowerCase()) ||
              stripHtml(c.back).toLowerCase().includes(query.toLowerCase()) ||
              c.context?.toLowerCase().includes(query.toLowerCase()) ||
              c.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
            )
            .slice(0, 8)
            .length > 0 && (
            <Command.Group heading={<span className="gs-group-label"><BookOpen size={10} /> Cards</span>}>
              {(cards ?? [])
                .filter(c =>
                  stripHtml(c.front).toLowerCase().includes(query.toLowerCase()) ||
                  stripHtml(c.back).toLowerCase().includes(query.toLowerCase()) ||
                  c.context?.toLowerCase().includes(query.toLowerCase()) ||
                  c.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
                )
                .slice(0, 8)
                .map(card => {
                  const deck = deckMap.get(card.deckId);
                  return (
                    <Command.Item
                      key={card.id}
                      value={`card:${stripHtml(card.front)}:${stripHtml(card.back)}:${card.tags?.join(' ')}`}
                      onSelect={() => handleSelectCard(card)}
                      className="gs-item"
                    >
                      <div className="gs-item-icon gs-icon-accent">
                        <BookOpen size={13} />
                      </div>
                      <div className="gs-item-text">
                        <span className="gs-item-label">{stripHtml(card.front)}</span>
                        <span className="gs-item-sub">
                          {stripHtml(card.back)}
                          {deck && <> · <span className="gs-item-deck">{deck.name}</span></>}
                        </span>
                      </div>
                      <div className="gs-item-right">
                        {card.lapses > 0 && (
                          <span className="gs-badge gs-badge-lapse" title={`${card.lapses} lapso(s)`}>
                            <Zap size={9} /> {card.lapses}
                          </span>
                        )}
                        {card.tags?.[0] && (() => {
                          const colors = getTagColors(card.tags[0]);
                          return (
                            <span className={`gs-badge border ${colors.bg} ${colors.text} ${colors.border}`}>
                              #{card.tags[0]}
                            </span>
                          );
                        })()}
                      </div>
                    </Command.Item>
                  );
                })}
            </Command.Group>
          )}
        </Command.List>

        {/* Footer */}
        <div className="gs-footer">
          <div className="gs-footer-hints">
            <span><kbd>↑↓</kbd> navegar</span>
            <span><kbd>↵</kbd> selecionar</span>
            <span><kbd>Esc</kbd> fechar</span>
          </div>
          {query.trim() && (
            <span className="gs-footer-count">
              {
                (
                  (decks ?? []).filter(d =>
                    d.name.toLowerCase().includes(query.toLowerCase()) ||
                    d.description?.toLowerCase().includes(query.toLowerCase())
                  ).length +
                  (cards ?? []).filter(c =>
                    stripHtml(c.front).toLowerCase().includes(query.toLowerCase()) ||
                    stripHtml(c.back).toLowerCase().includes(query.toLowerCase()) ||
                    c.context?.toLowerCase().includes(query.toLowerCase()) ||
                    c.tags?.some(t => t.toLowerCase().includes(query.toLowerCase()))
                  ).length
                )
              } resultado(s)
            </span>
          )}
        </div>
      </Command>
    </div>
  );
};
