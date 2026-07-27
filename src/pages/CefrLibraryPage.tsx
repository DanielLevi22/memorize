import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, CheckCircle2, Lock, GraduationCap, ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { Card as ShadcnCard } from '../components/ui/card';
import { buildStudyLibrary, isTextStudied, type CefrLevel } from '../utils/cefrLevelContent';
import type { TextResource } from '../types';

interface CefrLibraryPageProps {
  /** Abre uma história na tela de Leitura. */
  onOpenText: (textId: string) => void;
}

const LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: 'Iniciante',
  A2: 'Básico',
  B1: 'Intermediário',
  B2: 'Intermediário Superior',
  C1: 'Avançado',
  C2: 'Proficiente'
};

// Gradiente estável derivado do título — a mesma história sempre recebe a mesma capa
const gradientForTitle = (title: string): string => {
  const gradients = [
    'from-rose-500 to-orange-500',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-fuchsia-500 to-pink-600',
    'from-cyan-500 to-blue-600'
  ];
  let sum = 0;
  for (let i = 0; i < title.length; i++) sum += title.charCodeAt(i);
  return gradients[sum % gradients.length];
};

export const CefrLibraryPage: React.FC<CefrLibraryPageProps> = ({ onOpenText }) => {
  // Textos com nível CEFR definido — o conteúdo de estudo graduado
  const leveledTexts = useLiveQuery(
    () => db.texts.filter(t => !!t.cefrLevel && t.showInReadings !== false).toArray(),
    []
  );

  const shelves = buildStudyLibrary(leveledTexts || []);
  const [expandedLevel, setExpandedLevel] = useState<CefrLevel | null>('A1');

  const totalTexts = (leveledTexts || []).length;
  const totalStudied = shelves.reduce((sum, s) => sum + s.progress.studied, 0);

  return (
    <div className="space-y-6 w-full max-w-none px-2 md:px-6 py-4">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40 shrink-0">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-sm">
              <GraduationCap size={24} />
            </div>
            Trilha de Leitura
          </h2>
          <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
            Histórias graduadas por nível CEFR. Escolha um texto para estudar e avance rumo à conclusão de cada nível.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl self-start">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <div className="text-[10px] font-black text-foreground uppercase tracking-wider">
            {totalStudied} / {totalTexts} textos concluídos
          </div>
        </div>
      </div>

      {/* Prateleiras por nível */}
      <div className="space-y-4">
        {shelves.map(shelf => {
          const isExpanded = expandedLevel === shelf.level;
          const isEmpty = shelf.texts.length === 0;

          return (
            <ShadcnCard key={shelf.level} className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
              {/* Cabeçalho do nível — clicável para expandir/recolher */}
              <button
                type="button"
                onClick={() => setExpandedLevel(isExpanded ? null : shelf.level)}
                className="w-full flex items-center justify-between gap-3 p-5 cursor-pointer hover:bg-muted/20 transition-colors text-left"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientForTitle(shelf.level)} flex items-center justify-center shrink-0 shadow-sm`}>
                    <span className="text-lg font-black text-white">{shelf.level}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-foreground">{LEVEL_LABELS[shelf.level]}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold">
                      {shelf.progress.studied} de {shelf.progress.target} textos • {shelf.texts.length} disponíveis
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Barra de progresso do nível */}
                  <div className="hidden sm:block w-28">
                    <div className="flex justify-between text-[8px] font-black text-muted-foreground mb-1">
                      <span>PROGRESSO</span>
                      <span>{shelf.progress.percent}%</span>
                    </div>
                    <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${shelf.progress.percent}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {/* Grade de textos do nível */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-border/30">
                  {isEmpty ? (
                    <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-2 text-muted-foreground">
                      <Lock size={20} className="opacity-40" />
                      <p className="text-[11px] font-semibold">
                        Ainda não há textos para {shelf.level}. Novos conteúdos aparecem aqui conforme forem adicionados.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                      {shelf.texts.map((text: TextResource) => {
                        const studied = isTextStudied(text);
                        return (
                          <button
                            key={text.id}
                            type="button"
                            onClick={() => onOpenText(text.id)}
                            className="group text-left bg-muted/20 hover:bg-muted/40 border border-border/40 rounded-xl overflow-hidden transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer"
                          >
                            <div className={`h-16 bg-gradient-to-br ${gradientForTitle(text.title)} relative flex items-end p-2.5`}>
                              <BookOpen size={16} className="text-white/90 drop-shadow" />
                              {studied && (
                                <span className="absolute top-2 right-2 bg-white/90 text-emerald-600 rounded-full p-0.5 shadow-sm">
                                  <CheckCircle2 size={13} />
                                </span>
                              )}
                            </div>
                            <div className="p-3 space-y-1">
                              <h4 className="text-xs font-black text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                {text.title}
                              </h4>
                              <p className="text-[9px] text-muted-foreground font-semibold">
                                {text.lines?.length ?? 0} frases
                                {studied && <span className="text-emerald-500"> • concluído</span>}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </ShadcnCard>
          );
        })}
      </div>
    </div>
  );
};
