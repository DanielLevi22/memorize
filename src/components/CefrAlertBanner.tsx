import React from 'react';
import { Target, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card as ShadcnCard } from './ui/card';
import { getBannerStatus } from '../utils/cefrBannerHelper';
import type { CefrLevelCode } from '../utils/cefrJourney';

interface CefrAlertBannerProps {
  cards: any[] | undefined;
  cardsStudiedToday: number;
  minutesStudiedToday: number;
}

export const CefrAlertBanner: React.FC<CefrAlertBannerProps> = ({
  cards,
  cardsStudiedToday,
  minutesStudiedToday
}) => {
  // 1. Obter configurações da jornada do localStorage
  const targetLevel = localStorage.getItem('memorize_cefr_target_level') as CefrLevelCode | null;
  if (!targetLevel) return null; // Sem jornada ativa

  const startLevel = (localStorage.getItem('memorize_cefr_start_level') || 'A1') as CefrLevelCode;
  const totalDays = Number(localStorage.getItem('memorize_cefr_target_days') || '90');
  const journeyStart = Number(localStorage.getItem('memorize_cefr_journey_start') || Date.now());

  // 2. Calcular progresso lexical atual (cards com repetições > 0 ou intervalo > 0)
  const studiedCardsList = cards ? cards.filter(c => c.repetitions > 0 || c.interval > 0) : [];
  const currentCardsCount = studiedCardsList.length;

  const daysElapsed = Math.floor((Date.now() - journeyStart) / (24 * 60 * 60 * 1000));

  // 3. Obter status processados
  const {
    status,
    remainingDays,
    currentPlan,
    message
  } = getBannerStatus(
    currentCardsCount,
    startLevel,
    targetLevel,
    totalDays,
    daysElapsed,
    cardsStudiedToday,
    minutesStudiedToday
  );

  const cardPercent = Math.min(100, Math.round((cardsStudiedToday / currentPlan.dailyCardsTarget) * 100));
  const minutePercent = Math.min(100, Math.round((minutesStudiedToday / currentPlan.dailyMinutesTarget) * 100));

  // Cores de estilização dinâmicas baseadas no status
  let bannerBg = 'from-amber-500/10 via-amber-600/5 to-transparent border-amber-500/30';
  let badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400';

  if (status === 'overloaded') {
    bannerBg = 'from-red-500/10 via-red-600/5 to-transparent border-red-500/30';
    badgeColor = 'bg-red-500/10 text-red-600 dark:text-red-400';
  } else if (status === 'completed') {
    bannerBg = 'from-emerald-500/10 via-emerald-600/5 to-transparent border-emerald-500/30';
    badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  } else if (status === 'normal') {
    bannerBg = 'from-muted/40 via-muted/10 to-transparent border-border/60';
    badgeColor = 'bg-muted text-muted-foreground';
  }

  return (
    <ShadcnCard className={`relative bg-gradient-to-r ${bannerBg} border p-4.5 rounded-2xl shadow-md overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Lado Esquerdo: Título e Status */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${badgeColor}`}>
              {status === 'overloaded' ? (
                <AlertTriangle size={15} className="animate-pulse" />
              ) : status === 'completed' ? (
                <CheckCircle size={15} />
              ) : (
                <Target size={15} />
              )}
            </div>
            <h4 className="font-black text-xs uppercase tracking-widest text-foreground flex items-center gap-1.5">
              Jornada de Estudos CEFR: Rumo ao {targetLevel}
              {remainingDays > 0 ? (
                <span className="text-[9px] font-bold text-muted-foreground lowercase">
                  ({remainingDays} dias restantes)
                </span>
              ) : (
                <span className="text-[9px] font-black text-red-500 uppercase">
                  (Prazo Encerrado!)
                </span>
              )}
            </h4>
          </div>

          <p className="text-[11px] text-muted-foreground font-semibold leading-relaxed">
            {message}
          </p>
        </div>

        {/* Lado Direito: Barras de Progresso Diárias */}
        <div className="grid grid-cols-2 gap-4 min-w-[240px] shrink-0">
          {/* Card target */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9.5px] font-bold">
              <span className="text-muted-foreground">Novos Cards:</span>
              <span className="text-foreground">{cardsStudiedToday}/{currentPlan.dailyCardsTarget}</span>
            </div>
            <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${status === 'completed' ? 'bg-emerald-500' : status === 'overloaded' ? 'bg-red-500' : 'bg-primary'}`}
                style={{ width: `${cardPercent}%` }}
              />
            </div>
          </div>

          {/* Minutes target */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9.5px] font-bold">
              <span className="text-muted-foreground">Minutos de Estudo:</span>
              <span className="text-foreground">{minutesStudiedToday}/{currentPlan.dailyMinutesTarget}m</span>
            </div>
            <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${status === 'completed' ? 'bg-emerald-500' : status === 'overloaded' ? 'bg-red-500' : 'bg-primary'}`}
                style={{ width: `${minutePercent}%` }}
              />
            </div>
          </div>
        </div>

      </div>
    </ShadcnCard>
  );
};

