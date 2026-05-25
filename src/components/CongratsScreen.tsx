import React from 'react';
import { Award, Flame, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface CongratsScreenProps {
  streak: number;
  cardsStudied: number;
  onBackToDashboard: () => void;
  dailyGoal: number;
  studiedTodayCount: number;
}

export const CongratsScreen: React.FC<CongratsScreenProps> = ({
  streak,
  cardsStudied,
  onBackToDashboard,
  dailyGoal,
  studiedTodayCount,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center flex-1 gap-6 py-10 px-5 max-w-sm mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 flex items-center justify-center shadow-lg border border-emerald-500/20">
        <Award size={40} />
      </div>

      <div className="space-y-2">
        <h2 className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-foreground to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent">
          Sessão Concluída!
        </h2>
        <p className="text-muted-foreground text-sm max-w-[280px] mx-auto leading-relaxed">
          Excelente trabalho! Você revisou todos os cartões pendentes deste deck por hoje.
        </p>
      </div>

      {studiedTodayCount >= dailyGoal ? (
        <div className="w-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-emerald-500/5 animate-pulse pointer-events-none" />
          <div className="flex items-center gap-1.5 text-emerald-500 font-extrabold text-sm uppercase tracking-wider relative z-10">
            <span>🎯</span>
            <span>Meta Diária Batida!</span>
          </div>
          <p className="text-xs text-muted-foreground font-semibold relative z-10">
            Você estudou <strong className="text-emerald-500">{studiedTodayCount}</strong> de <strong className="text-foreground">{dailyGoal}</strong> cartões hoje!
          </p>
        </div>
      ) : (
        <div className="w-full bg-muted/40 border border-border rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm">
          <div className="flex items-center gap-1.5 text-primary/80 font-bold text-xs uppercase tracking-wide">
            <span>🎯</span>
            <span>Progresso da Meta Diária</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Você estudou <strong className="text-primary">{studiedTodayCount}</strong> de <strong className="text-foreground">{dailyGoal}</strong> cartões hoje.
          </p>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40 mt-0.5">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round((studiedTodayCount / dailyGoal) * 100))}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
            Faltam apenas {dailyGoal - studiedTodayCount} cards para bater a meta!
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full bg-card p-5 rounded-2xl border border-border my-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Cartões revisados nesta sessão:</span>
          <span className="font-bold text-primary">{cardsStudied}</span>
        </div>
        
        <div className="h-[1px] bg-border/50" />

        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Flame size={15} className="text-amber-500 fill-amber-500/10" /> Ofensiva atual:
          </span>
          <span className="font-bold text-amber-500">
            {streak} {streak === 1 ? 'dia' : 'dias'}
          </span>
        </div>
      </div>

      <Button 
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 cursor-pointer mt-2" 
        onClick={onBackToDashboard}
      >
        <ArrowLeft size={15} />
        Voltar aos Decks
      </Button>
    </div>
  );
};
