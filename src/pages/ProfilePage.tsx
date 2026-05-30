import React from 'react';
import { Plus, Flame, Trophy, Sparkles } from 'lucide-react';
import { Card as ShadcnCard } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

interface ProfilePageProps {
  streak: number;
  userLevel: number;
  earnedXp: number;
  xpNeededForNextLevel: number;
  totalRevisionsCount: number;
  decksCount: number;
  userName: string;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  streak,
  userLevel,
  earnedXp,
  xpNeededForNextLevel,
  totalRevisionsCount,
  decksCount,
  userName
}) => {
  return (
    <div className="space-y-6 w-full max-w-none px-2 md:px-6">
      {/* Perfil Compacto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <ShadcnCard className="bg-card border-border p-4 text-center flex flex-row items-center gap-4 rounded-2xl shadow-sm md:col-span-1 justify-center md:justify-start">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center font-black text-xl border border-border shadow-md text-zinc-50 shrink-0">
            {userName ? userName.charAt(0).toUpperCase() : '👤'}
          </div>
          <div className="text-left space-y-0.5">
            <h3 className="font-extrabold text-sm text-foreground">{userName || 'Usuário'}</h3>
            <div className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full inline-block">
              Nível {userLevel} • {earnedXp} XP
            </div>
          </div>
        </ShadcnCard>

        {/* Barra de Progresso de Nível Compacta */}
        <ShadcnCard className="bg-card border-border p-4 flex flex-col justify-center gap-1.5 rounded-2xl shadow-sm md:col-span-2">
          <Progress value={earnedXp % 100} className="h-2 bg-muted" />
          <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
            <span>{earnedXp % 100} / 100 XP</span>
            <span>Falta {xpNeededForNextLevel} XP para Nív. {userLevel + 1}</span>
          </div>
        </ShadcnCard>
      </div>

      {/* Seção Conquistas */}
      <div className="space-y-3 max-w-5xl mx-auto border-t border-border/40 pt-6">
        <h2 className="font-extrabold text-sm text-foreground tracking-tight">🏅 Minhas Conquistas</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {/* Badge 1 */}
          <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
            decksCount > 0 ? '' : 'opacity-40'
          }`}>
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
              <Plus size={18} />
            </div>
            <span className="font-bold text-xs text-foreground">Primeiro Deck</span>
            <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Criou o seu primeiro deck local</span>
          </div>

          {/* Badge 2 */}
          <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
            streak > 0 ? '' : 'opacity-40'
          }`}>
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
              <Flame size={18} />
            </div>
            <span className="font-bold text-xs text-foreground">Hábito de Estudo</span>
            <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Completou 1 dia de ofensiva</span>
          </div>

          {/* Badge 3 */}
          <div className={`p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors shadow-sm ${
            totalRevisionsCount >= 5 ? '' : 'opacity-40'
          }`}>
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-amber-500">
              <Trophy size={18} />
            </div>
            <span className="font-bold text-xs text-foreground">Foco de Aço</span>
            <span className="text-[10px] text-muted-foreground font-semibold leading-snug">Revisou mais de 5 cartões</span>
          </div>

          {/* Badge 4 */}
          <div className="p-4 bg-card border border-border rounded-xl flex flex-col items-center text-center gap-2 hover:bg-muted/30 transition-colors opacity-40 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
              <Sparkles size={18} />
            </div>
            <span className="font-bold text-xs text-muted-foreground">Mestre</span>
            <span className="text-[10px] text-muted-foreground/60 font-semibold leading-snug">Memorizou mais de 100 cards</span>
          </div>
        </div>
      </div>
    </div>
  );
};
