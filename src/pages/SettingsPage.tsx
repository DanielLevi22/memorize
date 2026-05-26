import React, { useState, useEffect } from 'react';
import { HelpCircle, Download, Upload, Trash2, Volume2, Eye, EyeOff, Sparkles, Key, ArrowLeft, Plus, Settings, Edit, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import type { Card, DeckPreset } from '../types';
import { downloadPresetFile, openPresetFile, deserializePreset } from '../utils/presets';

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
  setActiveTab: (tab: "cards" | "stats" | "guide" | "dashboard" | "profile" | "settings", subTab?: "overview" | "shortcuts" | "reading" | "srs_presets" | "srs_math") => void;
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
  // Notifications
  requestNotificationPermission: () => Promise<NotificationPermission>;
  getNotificationPermission: () => NotificationPermission | 'unsupported';
  // Gemini API Key
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  // Daily Goal
  dailyGoal: number;
  setDailyGoal: (goal: number) => void;
  // Presets
  presets: DeckPreset[] | undefined;
  onSavePreset: (preset: DeckPreset) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
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
  requestNotificationPermission,
  getNotificationPermission,
  geminiApiKey,
  setGeminiApiKey,
  dailyGoal,
  setDailyGoal,
  presets,
  onSavePreset,
  onDeletePreset,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [showApiKey, setShowApiKey] = useState(false);
  const [localApiKey, setLocalApiKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [activePresetToEdit, setActivePresetToEdit] = useState<DeckPreset | null>(null);

  const handleCreateNewPreset = () => {
    const template: DeckPreset = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      name: 'Nova Configuração',
      newCardsPerDay: 20,
      maxReviewsPerDay: 200,
      newCardsIgnoreReviewLimit: false,
      limitsStartFromParent: false,
      learningSteps: '1m 10m',
      graduatingInterval: 1,
      easyInterval: 4,
      insertionOrder: 'sequential',
      relearningSteps: '10m',
      minimumInterval: 1,
      leechThreshold: 8,
      leechAction: 'tag',
      newCardGrouping: 'deck',
      newCardSorting: 'template',
      newVsReviewOrder: 'mix',
      interdayLearningVsReviewOrder: 'mix',
      reviewSorting: 'dateThenRandom',
      buryNewSiblings: false,
      buryReviewSiblings: false,
      buryLearningSiblings: false,
      disableAutoplay: false,
      skipQuestionOnReplay: false,
      maxAnswerSeconds: 60,
      showTimer: false,
      stopTimerOnAnswer: false,
      autoShowAnswerSeconds: 0,
      autoShowQuestionSeconds: 0,
      waitForAudio: true,
      questionAction: 'showAnswer',
      answerAction: 'skip',
      daysOffMultiplier: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      fsrsEnabled: false,
      maxInterval: 36500,
      startingEase: 2.50,
      easyBonus: 1.30,
      intervalModifier: 1.00,
      hardInterval: 1.20,
      lapseMultiplier: 0.50,
      customScheduling: ''
    };
    setActivePresetToEdit(template);
  };

  const handleImportPreset = async () => {
    const jsonContent = await openPresetFile();
    if (!jsonContent) return; // Usuário cancelou

    const result = deserializePreset(jsonContent);
    if (!result.success) {
      alert(`❌ Erro ao importar preset:\n${result.error}`);
      return;
    }

    await onSavePreset(result.preset);
    alert(`✅ Preset "${result.preset.name}" importado com sucesso!`);
  };

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

  const handleSaveApiKey = () => {
    if (!localApiKey.trim()) return;
    setGeminiApiKey(localApiKey.trim());
    setLocalApiKey(''); // Limpa o campo
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleRemoveApiKey = () => {
    if (window.confirm("Deseja remover sua Chave de API do Gemini? O recurso de IA ficará inativo.")) {
      setGeminiApiKey('');
      setLocalApiKey('');
    }
  };

  if (activePresetToEdit) {
    return (
      <div className="space-y-6 w-full max-w-none px-2 md:px-6 py-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActivePresetToEdit(null)}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm"
              title="Voltar para configurações"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex flex-col">
              <h2 className="font-extrabold text-lg text-foreground tracking-tight flex items-center gap-1.5">
                <Settings size={18} className="text-primary" /> Preset de Estudos
              </h2>
              <span className="text-xs text-muted-foreground">Configure as opções para o baralho</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setActivePresetToEdit(null)}
              className="text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!activePresetToEdit.name.trim()) {
                  alert('Por favor, defina um nome para o preset.');
                  return;
                }
                await onSavePreset(activePresetToEdit);
                setActivePresetToEdit(null);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl cursor-pointer gap-1.5"
            >
              <Save size={14} /> Salvar Preset
            </Button>
          </div>
        </div>

        {/* Preset Name Input */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Nome do Preset
          </label>
          <input
            type="text"
            className="w-full bg-muted border border-border text-foreground px-4 py-2.5 rounded-xl text-sm outline-none focus:border-primary/50 font-bold transition-colors"
            placeholder="Ex: Inglês Avançado, Termos Médicos..."
            value={activePresetToEdit.name}
            onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, name: e.target.value })}
            disabled={activePresetToEdit.id === 'default-study-preset'}
          />
        </div>

        {/* Grid for settings groups */}
        <div className="flex flex-col gap-6">

          {/* 1. LIMITES DIÁRIOS */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              📅 Limites Diários
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Novos cartões/dia</span>
                <span className="text-[10px] text-muted-foreground">Quantidade máxima de novos cartões por dia.</span>
              </div>
              <input
                type="number"
                min="0"
                max="9999"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.newCardsPerDay}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, newCardsPerDay: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Revisões máximas/dia</span>
                <span className="text-[10px] text-muted-foreground">Quantidade máxima de revisões diárias.</span>
              </div>
              <input
                type="number"
                min="0"
                max="9999"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.maxReviewsPerDay}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, maxReviewsPerDay: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Novos ignoram limite de revisão</span>
                <span className="text-[10px] text-muted-foreground">Sempre introduz novos cards, mesmo atingindo o limite de revisão.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.newCardsIgnoreReviewLimit}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, newCardsIgnoreReviewLimit: e.target.checked })}
              />
            </div>
          </div>

          {/* 2. NOVOS CARTÕES */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🌱 Novos Cartões
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Etapas de aprendizagem</span>
                <span className="text-[10px] text-muted-foreground">Ex: 1m 10m (intervalo em minutos).</span>
              </div>
              <input
                type="text"
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none w-28 text-center h-8"
                value={activePresetToEdit.learningSteps}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, learningSteps: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Intervalo de graduação</span>
                <span className="text-[10px] text-muted-foreground">Dias para revisão após etapas iniciais.</span>
              </div>
              <input
                type="number"
                min="1"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.graduatingInterval}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, graduatingInterval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Intervalo fácil</span>
                <span className="text-[10px] text-muted-foreground">Dias para revisão ao acertar como Fácil de primeira.</span>
              </div>
              <input
                type="number"
                min="1"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.easyInterval}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, easyInterval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ordem de inserção</span>
                <span className="text-[10px] text-muted-foreground">Sequencial ou aleatória.</span>
              </div>
              <select
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none h-8 cursor-pointer"
                value={activePresetToEdit.insertionOrder}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, insertionOrder: e.target.value as any })}
              >
                <option value="sequential">Sequencial (Antigos primeiro)</option>
                <option value="random">Aleatório</option>
              </select>
            </div>
          </div>

          {/* 3. FALHAS */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              ⚠️ Falhas & Esquecimentos
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Etapas de reaprendizagem</span>
                <span className="text-[10px] text-muted-foreground">Intervalo para rever cartões errados.</span>
              </div>
              <input
                type="text"
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none w-28 text-center h-8"
                value={activePresetToEdit.relearningSteps}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, relearningSteps: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Intervalo mínimo (dias)</span>
                <span className="text-[10px] text-muted-foreground">Menor intervalo após errar/re-graduar.</span>
              </div>
              <input
                type="number"
                min="1"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.minimumInterval}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, minimumInterval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Limite de sanguessuga</span>
                <span className="text-[10px] text-muted-foreground">Erros permitidos antes de marcar como sanguessuga.</span>
              </div>
              <input
                type="number"
                min="1"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.leechThreshold}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, leechThreshold: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ação de sanguessuga</span>
                <span className="text-[10px] text-muted-foreground">O que fazer com o card problemático.</span>
              </div>
              <select
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none h-8 cursor-pointer"
                value={activePresetToEdit.leechAction}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, leechAction: e.target.value as any })}
              >
                <option value="tag">Somente Etiqueta (tag leech)</option>
                <option value="suspend">Suspender Cartão</option>
              </select>
            </div>
          </div>

          {/* 4. ORDEM DE EXIBIÇÃO */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🔀 Ordem de Exibição
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ordem de novos vs revisão</span>
              </div>
              <select
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none h-8 cursor-pointer"
                value={activePresetToEdit.newVsReviewOrder}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, newVsReviewOrder: e.target.value as any })}
              >
                <option value="mix">Misturar com revisões</option>
                <option value="newFirst">Mostrar novos primeiro</option>
                <option value="reviewFirst">Mostrar revisões primeiro</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ordem de aprendizado vs revisões</span>
              </div>
              <select
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none h-8 cursor-pointer"
                value={activePresetToEdit.interdayLearningVsReviewOrder}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, interdayLearningVsReviewOrder: e.target.value as any })}
              >
                <option value="mix">Misturar com revisões</option>
                <option value="learningFirst">Mostrar aprendizado primeiro</option>
                <option value="reviewFirst">Mostrar revisões primeiro</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ordem de classificação de revisões</span>
              </div>
              <select
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none h-8 cursor-pointer"
                value={activePresetToEdit.reviewSorting}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, reviewSorting: e.target.value as any })}
              >
                <option value="dateThenRandom">Data de revisão, depois aleatório</option>
                <option value="random">Totalmente aleatório</option>
              </select>
            </div>
          </div>

          {/* 5. OCULTAR */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🙈 Ocultar (Bury Siblings)
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Ocultar novos irmãos até o dia seguinte</span>
                <span className="text-[10px] text-muted-foreground">Enterrar cartões irmãos na fase de novos.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.buryNewSiblings}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, buryNewSiblings: e.target.checked })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Ocultar irmãos de revisão até o dia seguinte</span>
                <span className="text-[10px] text-muted-foreground">Evita ver o verso do mesmo conteúdo no mesmo dia.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.buryReviewSiblings}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, buryReviewSiblings: e.target.checked })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Ocultar irmãos em aprendizado até o dia seguinte</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.buryLearningSiblings}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, buryLearningSiblings: e.target.checked })}
              />
            </div>
          </div>

          {/* 6. ÁUDIO */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🔊 Áudio
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Não reproduzir áudio automaticamente</span>
                <span className="text-[10px] text-muted-foreground">Silencia a pronúncia inicial ao virar a carta.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.disableAutoplay}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, disableAutoplay: e.target.checked })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Pular pergunta ao repetir a resposta</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.skipQuestionOnReplay}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, skipQuestionOnReplay: e.target.checked })}
              />
            </div>
          </div>

          {/* 7. CRONÔMETRO */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              ⏱️ Cronômetro
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Máximo de segundos para resposta</span>
                <span className="text-[10px] text-muted-foreground">Tempo limite a registrar na revisão.</span>
              </div>
              <input
                type="number"
                min="5"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.maxAnswerSeconds}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, maxAnswerSeconds: Math.max(5, parseInt(e.target.value, 10) || 5) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Mostrar cronômetro de resposta</span>
                <span className="text-[10px] text-muted-foreground">Exibe um cronômetro ativo na arena de estudos.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.showTimer}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, showTimer: e.target.checked })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Parar o temporizador ao responder</span>
                <span className="text-[10px] text-muted-foreground">Congela o relógio ao revelar a resposta.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.stopTimerOnAnswer}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, stopTimerOnAnswer: e.target.checked })}
              />
            </div>
          </div>

          {/* 8. AVANÇO AUTOMÁTICO */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🚀 Avanço Automático
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Segundos para mostrar a pergunta</span>
                <span className="text-[10px] text-muted-foreground">Tempo antes de revelar a resposta automaticamente (0 = desativado).</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.5"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.autoShowAnswerSeconds}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, autoShowAnswerSeconds: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[70%]">
                <span className="text-xs font-bold text-foreground">Segundos para mostrar a resposta</span>
                <span className="text-[10px] text-muted-foreground">Tempo antes de passar para o próximo card (0 = desativado).</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.5"
                className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none w-20 text-center h-8"
                value={activePresetToEdit.autoShowQuestionSeconds}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, autoShowQuestionSeconds: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Esperando pelo Áudio</span>
                <span className="text-[10px] text-muted-foreground">Aguardar a voz terminar de falar antes de passar adiante.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.waitForAudio}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, waitForAudio: e.target.checked })}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ação da Questão</span>
              </div>
              <select
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none h-8 cursor-pointer"
                value={activePresetToEdit.questionAction}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, questionAction: e.target.value as any })}
              >
                <option value="showAnswer">Mostrar Resposta</option>
                <option value="bury">Ocultar Cartão</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ação de Resposta</span>
              </div>
              <select
                className="bg-muted border border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold outline-none h-8 cursor-pointer"
                value={activePresetToEdit.answerAction}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, answerAction: e.target.value as any })}
              >
                <option value="skip">Próximo Cartão (Pular)</option>
                <option value="bury">Ocultar Cartão</option>
              </select>
            </div>
          </div>

          {/* 9. DIAS DE DESCANSO */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit col-span-1 md:col-span-2">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🌴 Dias de Descanso (Workload Balancer)
            </div>
            <div className="p-4 bg-card space-y-4">
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                Ajuste a carga de trabalho de cada dia da semana de 0% (dia livre) a 100% (normal). O algoritmo distribuirá revisões de forma balanceada.
              </div>
              <div className="grid grid-cols-7 gap-2 text-center">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, idx) => (
                  <div key={day} className="flex flex-col items-center gap-1.5 p-2 bg-muted/40 border border-border/60 rounded-xl">
                    <span className="text-[10px] font-bold text-foreground">{day}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      className="w-12 h-1.5 accent-primary cursor-pointer"
                      value={activePresetToEdit.daysOffMultiplier[idx]}
                      onChange={(e) => {
                        const newMultipliers = [...activePresetToEdit.daysOffMultiplier];
                        newMultipliers[idx] = parseFloat(e.target.value);
                        setActivePresetToEdit({ ...activePresetToEdit, daysOffMultiplier: newMultipliers });
                      }}
                    />
                    <span className="text-[9px] font-black text-primary">
                      {Math.round(activePresetToEdit.daysOffMultiplier[idx] * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 10. ALGORITMO FSRS */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit col-span-1 md:col-span-2">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🧠 Algoritmo FSRS
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Habilitar FSRS para este baralho</span>
                <span className="text-[10px] text-muted-foreground">Usa o agendador inteligente avançado em vez do SM-2 clássico.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.fsrsEnabled}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, fsrsEnabled: e.target.checked })}
              />
            </div>
          </div>

          {/* 11. AVANÇADO */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit col-span-1 md:col-span-2">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              ⚙️ Opções Avançadas (Algoritmo & Parâmetros)
            </div>
            <div className="p-4 bg-card grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-foreground">Intervalo máximo (dias)</span>
                <input
                  type="number"
                  min="1"
                  className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-center h-8"
                  value={activePresetToEdit.maxInterval}
                  onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, maxInterval: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-foreground">Facilidade inicial (SM-2)</span>
                <input
                  type="number"
                  min="1.3"
                  step="0.1"
                  className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-center h-8"
                  value={activePresetToEdit.startingEase}
                  onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, startingEase: Math.max(1.3, parseFloat(e.target.value) || 1.3) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-foreground">Bônus fácil</span>
                <input
                  type="number"
                  min="1.0"
                  step="0.05"
                  className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-center h-8"
                  value={activePresetToEdit.easyBonus}
                  onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, easyBonus: Math.max(1.0, parseFloat(e.target.value) || 1.0) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-foreground">Modificador de intervalo</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.05"
                  className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-center h-8"
                  value={activePresetToEdit.intervalModifier}
                  onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, intervalModifier: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-foreground">Intervalo árduo</span>
                <input
                  type="number"
                  min="1.0"
                  step="0.05"
                  className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-center h-8"
                  value={activePresetToEdit.hardInterval}
                  onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, hardInterval: Math.max(1.0, parseFloat(e.target.value) || 1.0) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-foreground">Multiplicador de lapso</span>
                <input
                  type="number"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  className="bg-muted border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-bold outline-none text-center h-8"
                  value={activePresetToEdit.lapseMultiplier}
                  onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, lapseMultiplier: Math.max(0.0, Math.min(1.0, parseFloat(e.target.value) || 0.0)) })}
                />
              </div>
            </div>
            <div className="p-4 bg-card border-t border-border/40 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-foreground">Agendamento personalizado (JavaScript)</span>
              <textarea
                className="w-full bg-muted border border-border text-foreground p-3 rounded-xl text-xs outline-none focus:border-primary/50 font-mono min-h-[80px]"
                placeholder="// Insira seu código JavaScript personalizado para agendamento aqui..."
                value={activePresetToEdit.customScheduling}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, customScheduling: e.target.value })}
              />
            </div>
          </div>

        </div>
      </div>
    );
  }

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
                setActiveTab('guide', 'srs_math');
                setCurrentView('dashboard');
              }}
            >
              <HelpCircle size={16} />
            </Button>
          </div>
        </div>

        {/* Meta Diária */}
        <div className="flex items-center justify-between p-4 bg-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Meta Diária de Cards</span>
            <span className="text-[11px] text-muted-foreground">Quantidade de cartões para estudar por dia</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="number"
              min="1"
              max="500"
              className="bg-muted border border-border text-foreground px-2 py-1 rounded-lg text-xs font-bold outline-none cursor-pointer focus:border-muted-foreground/45 w-16 text-center h-9"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <span className="text-xs text-muted-foreground font-semibold">cards</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Notificações Diárias</span>
            <span className="text-[11px] text-muted-foreground">Lembrar de revisar cards pendentes</span>
          </div>
          <div className="flex items-center gap-2">
            {notifPermission === 'unsupported' && (
              <span className="text-[10px] font-bold text-muted-foreground">Não suportado</span>
            )}
            {notifPermission === 'denied' && (
              <span className="text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
                Bloqueado — libere no navegador
              </span>
            )}
            {notifPermission === 'granted' && (
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                ✅ Ativo
              </span>
            )}
            {notifPermission === 'default' && (
              <button
                className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={async () => {
                  const result = await requestNotificationPermission();
                  setNotifPermission(result);
                  setNotificationsEnabled(result === 'granted');
                }}
              >
                Ativar permissão
              </button>
            )}
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary bg-muted border-border rounded cursor-pointer"
              checked={notificationsEnabled}
              onChange={(e) => {
                setNotificationsEnabled(e.target.checked);
                if (e.target.checked && notifPermission === 'default') {
                  requestNotificationPermission().then(r => setNotifPermission(r));
                }
              }}
              disabled={notifPermission !== 'granted'}
            />
          </div>
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

      {/* PRESETS DE ESTUDO */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <Settings size={12} className="text-primary" />
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Presets de Estudo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleImportPreset}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Upload size={10} /> Importar
            </button>
            <button
              onClick={handleCreateNewPreset}
              className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus size={10} /> Criar Novo Preset
            </button>
          </div>
        </div>

        <div className="p-4 bg-card space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Personalize limites diários, etapas de aprendizagem, ordem de exibição, e configurações avançadas do algoritmo para cada baralho.
          </p>
          <div className="space-y-2">
            {presets && presets.map((preset) => {
              const isDefault = preset.id === 'default-study-preset';
              return (
                <div key={preset.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border/60 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{preset.name}</span>
                    {isDefault && (
                      <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">
                        Padrão
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => downloadPresetFile(preset)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm flex items-center justify-center h-7 w-7"
                      title="Exportar preset como JSON"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={() => setActivePresetToEdit(preset)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border bg-card shadow-sm flex items-center justify-center h-7 w-7"
                      title="Editar configurações"
                    >
                      <Edit size={12} />
                    </button>
                    {!isDefault && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Deseja realmente excluir o preset "${preset.name}"? Os baralhos que usam este preset voltarão ao padrão.`)) {
                            await onDeletePreset(preset.id);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer border border-border bg-card shadow-sm flex items-center justify-center h-7 w-7"
                        title="Excluir preset"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {(!presets || presets.length === 0) && (
              <p className="text-[10px] text-muted-foreground text-center py-2">
                Nenhum preset carregado.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* GEMINI IA INTEGRATION */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-violet-500" />
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Integração com Inteligência Artificial
            </span>
          </div>
          <a
            href="https://aistudio.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-violet-500 hover:underline flex items-center gap-0.5"
          >
            Obter chave grátis ↗
          </a>
        </div>

        <div className="p-4 bg-card space-y-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Key size={14} className="text-muted-foreground" /> Chave de API do Gemini
              </span>
              <div className="flex items-center gap-3">
                {geminiApiKey && (
                  <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Configurada ✅
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 font-semibold"
                >
                  {showApiKey ? (
                    <>
                      <EyeOff size={13} /> Ocultar
                    </>
                  ) : (
                    <>
                      <Eye size={13} /> Revelar
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder={geminiApiKey ? "•••••••••••••••• (Chave Salva - Digite para alterar)" : "Cole sua API Key do Gemini aqui..."}
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  className="w-full bg-muted border border-border text-foreground px-3 py-2 rounded-xl text-xs outline-none focus:border-violet-500/50 pr-10 font-mono transition-colors"
                />
                <div className="absolute right-3 top-2.5 text-muted-foreground pointer-events-none">
                  🔑
                </div>
              </div>
              <Button
                onClick={handleSaveApiKey}
                disabled={!localApiKey.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-zinc-50 text-xs font-bold px-4 py-2 rounded-xl h-auto cursor-pointer flex-shrink-0"
              >
                Salvar
              </Button>
              {geminiApiKey && (
                <Button
                  onClick={handleRemoveApiKey}
                  variant="outline"
                  className="border-destructive/20 hover:bg-destructive/10 text-destructive text-xs font-bold px-3 py-2 rounded-xl h-auto cursor-pointer flex-shrink-0"
                >
                  Remover
                </Button>
              )}
            </div>
            {saveSuccess && (
              <p className="text-[10px] text-emerald-500 font-bold animate-pulse">
                ✅ Chave de API salva com sucesso!
              </p>
            )}
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
              Sua chave é salva <strong>somente no seu navegador (localStorage)</strong> de forma 100% segura e privada. Ela é enviada diretamente para a API oficial da Google para gerar os cartões.
            </p>
          </div>
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
