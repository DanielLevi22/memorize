import React, { useState, useEffect } from 'react';
import { Download, Upload, Trash2, Volume2, Eye, EyeOff, Sparkles, Key, ArrowLeft, Plus, Settings, Edit, Save, Cloud, Lock, RefreshCw, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import type { Card, DeckPreset } from '../types';
import { downloadPresetFile, openPresetFile, deserializePreset } from '../utils/presets';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

interface SettingsPageProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  cards: Card[] | undefined;
  handleExportFullBackup: () => void;
  setIsImportModalOpen: (open: boolean) => void;
  handleResetAllData: () => void;
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

  // Google Drive Sync
  driveClientId: string;
  setDriveClientId: (id: string) => void;
  drivePassword: string;
  setDrivePassword: (pw: string) => void;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (v: boolean) => void;
  lastSyncTime: number;
  isSyncing: boolean;
  handleDriveSync: (forceMode?: 'upload' | 'download') => Promise<void>;
  driveAccessToken: string;
  handleDisconnectDrive: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  notificationsEnabled,
  setNotificationsEnabled,
  cards,
  handleExportFullBackup,
  setIsImportModalOpen,
  handleResetAllData,
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
  
  // Google Drive Sync props
  driveClientId,
  setDriveClientId: _setDriveClientId,
  drivePassword,
  setDrivePassword,
  autoSyncEnabled,
  setAutoSyncEnabled,
  lastSyncTime,
  isSyncing,
  handleDriveSync,
  driveAccessToken,
  handleDisconnectDrive,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [showApiKey, setShowApiKey] = useState(false);
  const [localApiKey, setLocalApiKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDrivePassword, setShowDrivePassword] = useState(false);
  const [showDriveHelp, setShowDriveHelp] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    setPasswordInput('');
  }, [drivePassword]);

  const handleSaveSyncCredentials = () => {
    if (passwordInput.trim()) {
      setDrivePassword(passwordInput);
      toast.success('Configurações de Sincronização salvas com sucesso!');
    }
  };

  // Available theme accent colors
  const ACCENT_COLORS = [
    { id: 'zinc', class: 'bg-zinc-500', name: 'Cinza' },
    { id: 'blue', class: 'bg-blue-500', name: 'Azul' },
    { id: 'green', class: 'bg-emerald-500', name: 'Verde' },
    { id: 'violet', class: 'bg-violet-500', name: 'Roxo' },
    { id: 'orange', class: 'bg-orange-500', name: 'Laranja' },
    { id: 'rose', class: 'bg-rose-500', name: 'Rosa' }
  ];

  // Modal states
  const [showRemoveKeyConfirm, setShowRemoveKeyConfirm] = useState(false);
  const [showResetDataConfirm, setShowResetDataConfirm] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<DeckPreset | null>(null);
  
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
      answerAction: 'good',
      daysOffMultiplier: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      fsrsEnabled: false,

      maxInterval: 36500,
      startingEase: 2.50,
      easyBonus: 1.30,
      intervalModifier: 1.00,
      hardInterval: 1.20,
      lapseMultiplier: 0.50
    };
    setActivePresetToEdit(template);
  };

  const handleImportPreset = async () => {
    const jsonContent = await openPresetFile();
    if (!jsonContent) return; // Usuário cancelou

    const result = deserializePreset(jsonContent);
    if (!result.success) {
      toast.error(`Erro ao importar preset:\n${result.error}`);
      return;
    }

    await onSavePreset(result.preset!);
    toast.success(`Preset "${result.preset!.name}" importado com sucesso!`);
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

  const confirmRemoveApiKey = () => {
    setGeminiApiKey('');
    setLocalApiKey('');
    setShowRemoveKeyConfirm(false);
    toast.success("Chave da API removida.");
  };

  const confirmResetData = () => {
    setShowResetDataConfirm(false);
    handleResetAllData();
  };

  const confirmDeletePreset = async () => {
    if (presetToDelete) {
      await onDeletePreset(presetToDelete.id);
      setPresetToDelete(null);
      toast.success("Preset excluído com sucesso.");
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
                  toast.error('Por favor, defina um nome para o preset.');
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
            <div className="px-4 py-2.5 bg-muted/5 border-b border-border/40 text-[10px] text-muted-foreground leading-relaxed flex gap-2">
              <span>💡</span>
              <span>Aqui você edita as regras globais deste Preset. Para configurar limites específicos ou temporários de um baralho (<strong>Esse baralho</strong> ou <strong>Somente hoje</strong>), acesse o menu ⚙️ no card do baralho no Painel e selecione ✏️ <strong>Editar Deck</strong>.</span>
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
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <span className="text-xs font-bold text-foreground">Os limites começam do deck superior</span>
                <span className="text-[10px] text-muted-foreground">Faz com que os limites diários comecem a partir do baralho pai ao invés do sub-baralho selecionado.</span>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={activePresetToEdit.limitsStartFromParent}
                onChange={(e) => setActivePresetToEdit({ ...activePresetToEdit, limitsStartFromParent: e.target.checked })}
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
              <Select value={activePresetToEdit.insertionOrder} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, insertionOrder: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential" className="text-xs font-bold cursor-pointer">Sequencial (Antigos primeiro)</SelectItem>
                  <SelectItem value="random" className="text-xs font-bold cursor-pointer">Aleatório</SelectItem>
                </SelectContent>
              </Select>
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
              <Select value={activePresetToEdit.leechAction} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, leechAction: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag" className="text-xs font-bold cursor-pointer">Somente Etiqueta (tag leech)</SelectItem>
                  <SelectItem value="suspend" className="text-xs font-bold cursor-pointer">Suspender Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 4. ORDEM DE EXIBIÇÃO */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60 shadow-sm h-fit">
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider px-4 pt-4 pb-2 bg-muted/20">
              🔀 Ordem de Exibição
            </div>
            
            {/* Agrupamento de cartões novos */}
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Agrupamento de cartões novos</span>
              </div>
              <Select value={activePresetToEdit.newCardGrouping} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, newCardGrouping: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold max-w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deck" className="text-xs font-bold cursor-pointer">Baralho</SelectItem>
                  <SelectItem value="deckThenRandom" className="text-xs font-bold cursor-pointer">Baralho, em seguida, notas aleatórias</SelectItem>
                  <SelectItem value="ascending" className="text-xs font-bold cursor-pointer">Posição ascendente</SelectItem>
                  <SelectItem value="descending" className="text-xs font-bold cursor-pointer">Posição descendente</SelectItem>
                  <SelectItem value="randomNote" className="text-xs font-bold cursor-pointer">Notas Aleatórias</SelectItem>
                  <SelectItem value="randomCard" className="text-xs font-bold cursor-pointer">Cartões Aleatórios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Classificação de cartões novos */}
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Classificação de cartões novos</span>
              </div>
              <Select value={activePresetToEdit.newCardSorting} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, newCardSorting: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold max-w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template" className="text-xs font-bold cursor-pointer">Modelo do cartão</SelectItem>
                  <SelectItem value="gather" className="text-xs font-bold cursor-pointer">Ordem de agrupamento</SelectItem>
                  <SelectItem value="templateThenRandom" className="text-xs font-bold cursor-pointer">Modelo do cartão, depois aleatório</SelectItem>
                  <SelectItem value="randomNoteThenTemplate" className="text-xs font-bold cursor-pointer">Nota aleatória e, em seguida, modelo do cartão</SelectItem>
                  <SelectItem value="random" className="text-xs font-bold cursor-pointer">Aleatório</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordem de novos vs revisão */}
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ordem de novos vs revisão</span>
              </div>
              <Select value={activePresetToEdit.newVsReviewOrder} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, newVsReviewOrder: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold max-w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mix" className="text-xs font-bold cursor-pointer">Misturar com revisões</SelectItem>
                  <SelectItem value="reviewFirst" className="text-xs font-bold cursor-pointer">Mostrar depois de revisões</SelectItem>
                  <SelectItem value="newFirst" className="text-xs font-bold cursor-pointer">Mostrar antes de revisões</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordem de aprendizado vs revisão entre dias */}
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ordem de aprendizado vs revisão entre dias.</span>
              </div>
              <Select value={activePresetToEdit.interdayLearningVsReviewOrder} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, interdayLearningVsReviewOrder: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold max-w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mix" className="text-xs font-bold cursor-pointer">Misturar com revisões</SelectItem>
                  <SelectItem value="reviewFirst" className="text-xs font-bold cursor-pointer">Mostrar depois de revisões</SelectItem>
                  <SelectItem value="learningFirst" className="text-xs font-bold cursor-pointer">Mostrar antes de revisões</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ordem de classificação de revisões */}
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ordem de classificação de revisões</span>
              </div>
              <Select value={activePresetToEdit.reviewSorting} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, reviewSorting: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold max-w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dateThenRandom" className="text-xs font-bold cursor-pointer">Data de revisão, depois aleatório</SelectItem>
                  <SelectItem value="dateThenDeck" className="text-xs font-bold cursor-pointer">Data de revisão, depois baralho</SelectItem>
                  <SelectItem value="deckThenDate" className="text-xs font-bold cursor-pointer">Baralho, depois data de revisão</SelectItem>
                  <SelectItem value="intervalsAscending" className="text-xs font-bold cursor-pointer">Intervalos ascendentes</SelectItem>
                  <SelectItem value="intervalsDescending" className="text-xs font-bold cursor-pointer">Intervalos descendentes</SelectItem>
                  <SelectItem value="easeAscending" className="text-xs font-bold cursor-pointer">Facilidade ascendente</SelectItem>
                  <SelectItem value="easeDescending" className="text-xs font-bold cursor-pointer">Facilidade descendente</SelectItem>
                  <SelectItem value="retrievabilityAscending" className="text-xs font-bold cursor-pointer">Mais prováveis de esquecer</SelectItem>
                  <SelectItem value="retrievabilityDescending" className="text-xs font-bold cursor-pointer">Mais prováveis de lembrar</SelectItem>
                  <SelectItem value="random" className="text-xs font-bold cursor-pointer">Aleatório</SelectItem>
                  <SelectItem value="oldest" className="text-xs font-bold cursor-pointer">Criados há mais tempo</SelectItem>
                  <SelectItem value="newest" className="text-xs font-bold cursor-pointer">Criados há menos tempo</SelectItem>
                </SelectContent>
              </Select>
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
              <Select value={activePresetToEdit.questionAction} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, questionAction: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="showAnswer" className="text-xs font-bold cursor-pointer">Mostrar Resposta</SelectItem>
                  <SelectItem value="bury" className="text-xs font-bold cursor-pointer">Ocultar Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Ação de Resposta</span>
              </div>
              <Select value={activePresetToEdit.answerAction} onValueChange={(val: any) => setActivePresetToEdit({ ...activePresetToEdit, answerAction: val })}>
                <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1 rounded-lg text-xs font-bold w-[220px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good" className="text-xs font-bold cursor-pointer">Bom (Good)</SelectItem>
                  <SelectItem value="easy" className="text-xs font-bold cursor-pointer">Fácil (Easy)</SelectItem>
                  <SelectItem value="again" className="text-xs font-bold cursor-pointer">Errei (Again)</SelectItem>
                  <SelectItem value="hard" className="text-xs font-bold cursor-pointer">Difícil (Hard)</SelectItem>
                  <SelectItem value="skip" className="text-xs font-bold cursor-pointer">Pular Cartão</SelectItem>
                  <SelectItem value="bury" className="text-xs font-bold cursor-pointer">Ocultar até Amanhã</SelectItem>
                </SelectContent>
              </Select>
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
          <Select value={theme} onValueChange={(val: any) => setTheme(val as 'light' | 'dark')}>
            <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold w-auto h-9 focus:border-muted-foreground/45">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light" className="text-xs font-bold cursor-pointer">Claro ☀️</SelectItem>
              <SelectItem value="dark" className="text-xs font-bold cursor-pointer">Escuro 🌙</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Seletor de Cor de Destaque */}
        <div className="flex items-center justify-between p-4 bg-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">Cor de Destaque</span>
            <span className="text-[11px] text-muted-foreground">Personalize a cor principal</span>
          </div>
          <div className="flex items-center gap-2">
            {ACCENT_COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => setAccentColor(color.id)}
                title={color.name}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${color.class} ${
                  accentColor === color.id 
                    ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110 shadow-sm' 
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
              />
            ))}
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
          <Select value={ttsVoice || "default"} onValueChange={(v) => setTtsVoice(v === "default" ? "" : v)}>
            <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold w-[200px] h-9 focus:border-muted-foreground/45">
              <SelectValue placeholder="Padrão do navegador" />
            </SelectTrigger>
            <SelectContent className="max-h-[250px]">
              <SelectItem value="default" className="text-xs font-bold cursor-pointer">Padrão do navegador</SelectItem>
              {voices.map(v => (
                <SelectItem key={v.name} value={v.name} className="text-[10px] font-bold cursor-pointer">
                  {v.name} ({v.lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                        onClick={() => {
                          setPresetToDelete(preset);
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
                  onClick={() => setShowRemoveKeyConfirm(true)}
                  variant="outline"
                  className="border-destructive/20 hover:bg-destructive/10 text-destructive text-xs font-bold px-3 py-2 rounded-xl h-auto cursor-pointer flex-shrink-0"
                >
                  Remover
                </Button>
              )}
            </div>
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

      {/* CARD DE SINCRONIZAÇÃO NO GOOGLE DRIVE */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Cloud size={12} className="text-primary animate-pulse" /> Sincronização na Nuvem (Google Drive)
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
            onClick={() => setShowDriveHelp(true)}
            title="Como configurar?"
          >
            <HelpCircle size={14} />
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Sincronize seus dados de forma criptografada de ponta a ponta (Zero-Knowledge) usando sua própria conta do Google Drive. Seus dados são cifrados localmente antes de serem enviados.
        </p>

        <div className="space-y-3 pt-1">
          {/* Campo Senha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
              <Lock size={10} /> Senha de Criptografia (Mantenha Segura!)
            </label>
            <div className="relative">
              <input
                type={showDrivePassword ? 'text' : 'password'}
                placeholder={drivePassword ? '•••••••• (Senha Salva - Digite para alterar)' : 'Senha para encriptar seus dados...'}
                className="bg-background border border-border text-foreground pl-3 pr-10 py-1.5 rounded-xl text-xs font-semibold focus:border-primary focus:outline-none w-full h-10 transition-colors"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setShowDrivePassword(!showDrivePassword)}
              >
                {showDrivePassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            {/* Sincronização Automática */}
            <div className="flex items-center gap-2">
              <input
                id="auto-sync-check"
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer rounded-md"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
              />
              <label htmlFor="auto-sync-check" className="text-[11px] text-muted-foreground font-semibold cursor-pointer select-none">
                Sincronizar ao iniciar o aplicativo
              </label>
            </div>

            {/* Salvar credenciais */}
            <div className="flex gap-2 w-full sm:w-auto">
              {drivePassword && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 font-semibold h-9 text-xs rounded-xl cursor-pointer"
                  onClick={() => {
                    setDrivePassword('');
                    setPasswordInput('');
                    _setDriveClientId('754580033922-j6fhjnrhe8gr1c0olic52tkcjp12j70s.apps.googleusercontent.com');
                    localStorage.removeItem('memorize_sync_password');
                    localStorage.removeItem('memorize_sync_client_id');
                    toast.success('Configurações de sincronização removidas.');
                  }}
                  title="Remover senha e desconfigurar sincronização"
                >
                  Remover
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                className="w-full sm:w-auto font-bold h-9 text-xs rounded-xl cursor-pointer transition-all duration-150"
                onClick={handleSaveSyncCredentials}
                disabled={!passwordInput}
              >
                Salvar Credenciais
              </Button>
            </div>
          </div>
        </div>

        {/* Status de Sincronização */}
        {driveClientId && drivePassword && (
          <div className="border-t border-border/60 pt-3 mt-3 space-y-3 animate-in fade-in duration-200">
            {driveAccessToken && (
              <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-[11px] font-medium text-muted-foreground animate-in slide-in-from-top-1 duration-150">
                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Sessão Google Ativa
                </span>
                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  className="text-rose-500 hover:text-rose-600 font-bold text-[10px] cursor-pointer hover:underline"
                >
                  Desconectar / Alterar Conta
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
              <span>Status: <strong className="text-emerald-500 font-bold">Configurado</strong></span>
              <span>Último Sync: <strong className="text-foreground">{lastSyncTime ? new Date(lastSyncTime).toLocaleString('pt-BR') : 'Nunca'}</strong></span>
            </div>

            <div className="space-y-3">
              <Button
                variant="default"
                className="w-full bg-primary hover:bg-primary/95 text-zinc-50 font-bold cursor-pointer h-11 text-xs rounded-xl gap-2 justify-center transition-all duration-150 shadow-md"
                onClick={() => handleDriveSync()}
                disabled={isSyncing}
              >
                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> 
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora (Recomendado)'}
              </Button>
              
              <div className="flex flex-col gap-2 border border-border/40 rounded-xl p-2.5 bg-muted/30">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Ações de Resolução / Substituição</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border border-border bg-background hover:bg-muted text-foreground font-semibold cursor-pointer h-9 text-xs rounded-xl gap-1.5 justify-center transition-all duration-150"
                    onClick={() => handleDriveSync('upload')}
                    disabled={isSyncing}
                    title="Subir base de dados local sobrescrevendo a nuvem"
                  >
                    <Upload size={12} /> Sobrescrever Nuvem (Upload)
                  </Button>

                  <Button
                    variant="outline"
                    className="border border-border bg-background hover:bg-muted text-foreground font-semibold cursor-pointer h-9 text-xs rounded-xl gap-1.5 justify-center transition-all duration-150"
                    onClick={() => handleDriveSync('download')}
                    disabled={isSyncing}
                    title="Baixar base de dados da nuvem sobrescrevendo a local"
                  >
                    <Download size={12} /> Sobrescrever Local (Download)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Ajuda do Drive Client ID */}
      <Dialog open={showDriveHelp} onOpenChange={setShowDriveHelp}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl bg-card border border-border text-foreground p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-1.5 text-foreground">
              <Cloud className="text-primary animate-bounce h-5 w-5" size={18} /> Sincronização Google Drive
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium">
              Informações sobre como funciona o backup seguro na nuvem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed pt-2">
            <p>O Memorize já vem configurado com uma chave de conexão pública padrão (**Google Client ID**). Isso significa que você <strong>não precisa configurar nada no Google Cloud</strong> para usar a sincronização em sua conta pessoal!</p>
            
            <p className="font-bold text-foreground">Como usar:</p>
            <ol className="list-decimal pl-5 space-y-1.5 font-medium">
              <li>Defina uma <strong className="text-foreground">Senha de Criptografia</strong> no painel de sincronização e clique em <strong>Salvar Credenciais</strong>.</li>
              <li>Clique em <strong>Sincronizar Agora</strong>. Uma janela pop-up segura do Google será aberta.</li>
              <li>Escolha a sua conta de e-mail do Google (a mesma do seu navegador) e dê permissão de acesso.</li>
              <li>Pronto! O aplicativo vai criptografar seus dados locais e salvá-los no seu Drive pessoal.</li>
            </ol>

            <div className="bg-primary/5 text-primary border border-primary/10 p-2.5 rounded-xl text-[11px] font-medium leading-relaxed">
              🔒 <strong>Criptografia Zero-Knowledge:</strong> A sua senha de criptografia nunca é enviada ao Google ou a qualquer servidor. Ela é usada exclusivamente no seu navegador para cifrar os dados (usando AES-GCM) antes de subirem para o Drive. Se você perder esta senha, não será possível recuperar os dados em outros dispositivos.
            </div>

            <p className="text-[10px] text-muted-foreground/80">
              💡 <em>Nota para desenvolvedores:</em> Se você clonou este projeto e está hospedando sua própria versão em um domínio diferente, você deve configurar o seu próprio Google Client ID no código-fonte em <code className="bg-muted px-1 rounded font-mono">App.tsx</code> para que o login funcione no seu domínio.
            </p>
          </div>

          <DialogFooter className="pt-4 border-t border-border/40">
            <Button
              className="w-full bg-primary hover:bg-primary/95 text-zinc-50 font-bold h-10 rounded-xl cursor-pointer"
              onClick={() => setShowDriveHelp(false)}
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          onClick={() => setShowResetDataConfirm(true)}
        >
          <Trash2 size={14} className="mr-1.5" />
          Limpar todos os dados locais
        </Button>
      </div>

      {/* Modal: Remover API Key */}
      <Dialog open={showRemoveKeyConfirm} onOpenChange={setShowRemoveKeyConfirm}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Key size={28} />
          </div>
          <DialogHeader className="space-y-2 flex flex-col items-center">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              Remover API Key
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground font-medium max-w-[280px]">
              Deseja remover sua Chave de API do Gemini? O recurso de IA ficará inativo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
            <Button variant="outline" className="flex-1 font-bold h-11 rounded-xl" onClick={() => setShowRemoveKeyConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1 font-bold h-11 rounded-xl shadow-sm" onClick={confirmRemoveApiKey}>
              Sim, remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Resetar Dados */}
      <Dialog open={showResetDataConfirm} onOpenChange={setShowResetDataConfirm}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle size={28} />
          </div>
          <DialogHeader className="space-y-2 flex flex-col items-center">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              Atenção
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground font-medium max-w-[280px]">
              Isso apagará permanentemente todos os seus decks, cartões e histórico de estudos deste dispositivo. Deseja prosseguir?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
            <Button variant="outline" className="flex-1 font-bold h-11 rounded-xl" onClick={() => setShowResetDataConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1 font-bold h-11 rounded-xl shadow-sm" onClick={confirmResetData}>
              Sim, apagar tudo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Excluir Preset */}
      <Dialog open={!!presetToDelete} onOpenChange={(open) => !open && setPresetToDelete(null)}>
        <DialogContent className="sm:max-w-[400px] text-center flex flex-col items-center p-6 gap-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <Trash2 size={28} />
          </div>
          <DialogHeader className="space-y-2 flex flex-col items-center">
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
              Excluir Preset
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground font-medium max-w-[280px]">
              Deseja realmente excluir o preset <strong className="text-foreground">{presetToDelete?.name}</strong>? Os baralhos que usam este preset voltarão ao padrão.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row w-full gap-3 pt-2">
            <Button variant="outline" className="flex-1 font-bold h-11 rounded-xl" onClick={() => setPresetToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1 font-bold h-11 rounded-xl shadow-sm" onClick={confirmDeletePreset}>
              Sim, excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
