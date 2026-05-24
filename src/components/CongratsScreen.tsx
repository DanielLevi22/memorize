import React from 'react';
import { Award, Flame, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

interface CongratsScreenProps {
  streak: number;
  cardsStudied: number;
  onBackToDashboard: () => void;
}

export const CongratsScreen: React.FC<CongratsScreenProps> = ({
  streak,
  cardsStudied,
  onBackToDashboard
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center flex-1 gap-6 py-10 px-5 max-w-sm mx-auto">
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

      <div className="flex flex-col gap-3 w-full bg-card p-5 rounded-2xl border border-border my-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Cartões revisados:</span>
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
