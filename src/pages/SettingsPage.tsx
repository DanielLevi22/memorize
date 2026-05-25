import React, { useState, useEffect } from 'react';
import { HelpCircle, Download, Upload, Trash2, Volume2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { Card } from '../types';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  selectedAlgo: 'SM-2' | 'FSRS';
  setSelectedAlgo: (algo: 'SM-2' | 'FSRS') => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  cards: Card[] | undefined;
  handleExportFullBackup: () => void;
  setIsImportModalOpen: (open: boolean) => void;
  handleResetAllData: () => void;
  setActiveTab: (tab: "cards" | "stats" | "algorithms" | "dashboard" | "profile" | "settings") => void;
  setCurrentView: (view: "dashboard" | "study" | "congrats") => void;
  deferredPrompt: any;
  handleInstallApp: () => void;
  // TTS
  ttsRate: number;
  setTtsRate: (rate: number) => void;
  ttsVoice: string;
  setTtsVoice: (voice: string) => void;
  autoPlayAudio: boolean;
  setAutoPlayAudio: (v: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  setTheme,
  selectedAlgo,
  setSelectedAlgo,
  notificationsEnabled,
  setNotificationsEnabled,
  cards,
  handleExportFullBackup,
  setIsImportModalOpen,
  handleResetAllData,
  setActiveTab,
  setCurrentView,
  deferredPrompt,
  handleInstallApp,
  ttsRate,
  setTtsRate,
  ttsVoice,
  setTtsVoice,
  autoPlayAudio,
  setAutoPlayAudio,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const all = window.speechSynthesis?.getVoices() ?? [];
      // Show English voices first, then all others
      const sorted = [
        ...all.filter(v => v.lang.startsWith('en')),
        ...all.filter(v => !v.lang.startsWith('en')),
      ];
      setVoices(sorted);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const previewVoice = () => {
    window.speechSynthesis?.cancel();
    const utt = new SpeechSynthesisUtterance('This is how I sound. Keep going!');
    utt.rate = ttsRate;
    if (ttsVoice) {
      const matched = voices.find(v => v.name === ttsVoice);
      if (matched) { utt.voice = matched; utt.lang = matched.lang; }
    }
    window.speechSynthesis?.speak(utt);
  };

  return (
    <div className="space-y-4 w-full max-w-none px-2 md:px-6">
      <h2 className="font-extrabold text-md text-foreground tracking-tight">⚙️ Configurações</h2>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm">
        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
          Preferências de Interface & SRS
        </div>
        
        {/* Seletor de Tema Claro/Escuro */}
        <div className="flex items-center justify-between p-4 bg-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Tema do Aplicativo</span>
            <span className="text-[11px] text-muted-foreground">Alternar entre claro e escuro</span>
          </div>
          <select 
            className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer focus:border-muted-foreground/45"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
          >
            <option value="light">Claro ☀️</option>
            <option value="dark">Escuro 🌙</option>
          </select>
        </div>

        <div className="flex items-center justify-between p-4 bg-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Algoritmo Spaced Repetition</span>
            <span className="text-[11px] text-muted-foreground">Escolha a fórmula do agendamento</span>
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer focus:border-muted-foreground/45 h-9"
              value={selectedAlgo}
              onChange={(e) => setSelectedAlgo(e.target.value as 'SM-2' | 'FSRS')}
            >
              <option value="SM-2">SM-2 (Clássico)</option>
              <option value="FSRS">FSRS v4 (Moderno)</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
              title="Como funcionam os algoritmos?"
              onClick={() => {
                setActiveTab('algorithms');
                setCurrentView('dashboard');
              }}
            >
              <HelpCircle size={16} />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Notificações Diárias</span>
            <span className="text-[11px] text-muted-foreground">Lembrar de revisar cards pendentes</span>
          </div>
          <input 
            type="checkbox" 
            className="w-4 h-4 accent-primary bg-muted border-border rounded cursor-pointer"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
          />
        </div>
      </div>

      {/* TTS SETTINGS */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <Volume2 size={12} className="text-primary" />
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Voz &amp; Áudio (TTS)
            </span>
          </div>
          <button
            onClick={previewVoice}
            className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
          >
            Prévia de voz ▶
          </button>
        </div>

        {/* Rate slider */}
        <div className="flex items-center justify-between p-4 bg-card gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Velocidade da Fala</span>
            <span className="text-[11px] text-muted-foreground">Taxa da síntese de voz (TTS)</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <input
              type="range"
              min="0.5" max="2" step="0.1"
              value={ttsRate}
              onChange={e => setTtsRate(parseFloat(e.target.value))}
              className="w-28 accent-primary cursor-pointer"
            />
            <span className="text-xs font-black text-primary w-8 text-right">{ttsRate.toFixed(1)}x</span>
          </div>
        </div>

        {/* Voice selector */}
        <div className="flex items-center justify-between p-4 bg-card gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Voz / Sotaque</span>
            <span className="text-[11px] text-muted-foreground">Escolha entre as vozes do seu dispositivo</span>
          </div>
          <select
            className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer focus:border-muted-foreground/45 max-w-[200px]"
            value={ttsVoice}
            onChange={e => setTtsVoice(e.target.value)}
          >
            <option value="">Padrão do navegador</option>
            {voices.map(v => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        {/* Autoplay toggle */}
        <div className="flex items-center justify-between p-4 bg-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Reproduzir Áudio Automaticamente</span>
            <span className="text-[11px] text-muted-foreground">Tocar áudio ao exibir cada cartão</span>
          </div>
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary bg-muted border-border rounded cursor-pointer"
            checked={autoPlayAudio}
            onChange={e => setAutoPlayAudio(e.target.checked)}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm">
        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
          Sobre & Armazenamento
        </div>
        
        <div className="flex items-center justify-between p-4 bg-card text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">Banco de Dados Local</span>
            <span className="text-[11px] text-muted-foreground">Plataforma IndexedDB (Dexie)</span>
          </div>
          <span className="text-xs font-bold text-primary">Ativo</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-card text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">Tamanho no Disco</span>
            <span className="text-[11px] text-muted-foreground">Cards e estatísticas salvas localmente</span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            ~{(cards ? JSON.stringify(cards).length / 1024 : 0).toFixed(2)} KB
          </span>
        </div>
      </div>

      {deferredPrompt && (
        <div className="bg-card border border-primary/25 bg-primary/5 rounded-2xl p-5 space-y-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="text-[10px] text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
            📱 Instalar Aplicativo
          </div>
          <p className="text-[11px] text-muted-foreground">
            Instale o Memorize no seu dispositivo para ter acesso instantâneo pela tela inicial, melhor performance e suporte offline completo.
          </p>
          <Button
            variant="outline"
            className="w-full border-primary/30 bg-primary/10 hover:bg-primary hover:text-zinc-50 text-primary font-bold cursor-pointer h-10 text-xs rounded-xl transition-all duration-200"
            onClick={handleInstallApp}
          >
            Instalar Memorize
          </Button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
          Backup & Restauração
        </div>
        <p className="text-[11px] text-muted-foreground">
          Exporte sua base de dados completa (incluindo áudios e progresso) ou restaure a partir de um arquivo de backup do Memorize.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Button
            variant="outline"
            className="border-border bg-muted/20 hover:bg-muted text-foreground font-semibold cursor-pointer h-10 text-xs rounded-xl gap-2 justify-center"
            onClick={handleExportFullBackup}
          >
            <Download size={14} /> Exportar Backup
          </Button>
          <Button
            variant="outline"
            className="border-border bg-muted/20 hover:bg-muted text-foreground font-semibold cursor-pointer h-10 text-xs rounded-xl gap-2 justify-center"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload size={14} /> Restaurar Backup
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="text-[10px] text-destructive font-bold uppercase tracking-wider">
          Zona de Perigo
        </div>
        <Button 
          variant="outline"
          className="w-full border-destructive/20 bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground text-destructive font-semibold cursor-pointer py-5 text-xs rounded-xl"
          onClick={handleResetAllData}
        >
          <Trash2 size={14} className="mr-1.5" />
          Limpar todos os dados locais
        </Button>
      </div>
    </div>
  );
};
