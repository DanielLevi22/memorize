import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, miningDb } from '../db/db';
import type { MiningItem, TextResource, TextLine } from '../types';
import { 
  Camera, Mic, FileText, Check, Trash, RefreshCw, 
  Square, BookOpen, Sparkles, AlertCircle, 
  ChevronDown, PlusCircle, Bot, Tag,
  X, FileSpreadsheet, Loader2, Eye, EyeOff,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { encryptData, decryptData } from '../utils/crypto';
import { findBackupFile, downloadBackupFile, createBackupFile, updateBackupFile, requestAccessToken } from '../utils/drive';
import { exportMiningDatabase, mergeMiningSync } from '../utils/sync';
import { translateWithMyMemory } from '../utils/readingProcessor';
import { Checkbox } from '../components/ui/checkbox';


interface MiningInboxPageProps {
  geminiApiKey: string;
  driveAccessToken: string;
  setDriveAccessToken: (token: string) => void;
  driveClientId: string;
}

export function MiningInboxPage({ 
  geminiApiKey,
  driveAccessToken,
  setDriveAccessToken,
  driveClientId
}: MiningInboxPageProps) {
  const [activeCaptureMode, setActiveCaptureMode] = useState<'photo' | 'voice' | 'text'>('photo');
  
  // States for capturing
  const [capturedText, setCapturedText] = useState('');
  const [themeSuggestions, setThemeSuggestions] = useState<string[]>([]);
  
  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Processing states
  const [isCapturingLoading, setIsCapturingLoading] = useState(false);
  const [processingItemIds, setProcessingItemIds] = useState<Record<string, boolean>>({});

  // Selection states
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

  // Export Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportActionType, setExportActionType] = useState<'create' | 'append'>('create');
  const [newTextTitle, setNewTextTitle] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [selectedTextId, setSelectedTextId] = useState('');

  const [newCollectionName, setNewCollectionName] = useState('');
  const [exportCategory, setExportCategory] = useState<'movie' | 'series' | 'random'>('series');
  const [exportTheme, setExportTheme] = useState('');
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [editingCardIds, setEditingCardIds] = useState<Record<string, boolean>>({});
  
  const toggleEditCard = (itemId: string) => {
    setEditingCardIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Query Reading Collections, and Mining Items
  const collections = useLiveQuery(() => db.readingCollections.toArray()) || [];
  const existingTexts = useLiveQuery(() => db.texts.where('type').equals('reading').toArray()) || [];
  const pendingItems = useLiveQuery(() => 
    miningDb.miningItems
      .where('status')
      .equals('pending')
      .reverse()
      .sortBy('createdAt')
  );

  // Load theme suggestions from existing items in database
  useEffect(() => {
    miningDb.miningItems.toArray().then(items => {
      const themes = new Set<string>();
      items.forEach(i => i.theme && themes.add(i.theme));
      db.texts.toArray().then(texts => {
        texts.forEach(t => t.theme && themes.add(t.theme));
        setThemeSuggestions(Array.from(themes).filter(Boolean) as string[]);
      });
    });
  }, [pendingItems]);

  // States for Mining Queue Sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('memorize_mining_last_sync_time');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [syncPasswordInput, setSyncPasswordInput] = useState('');
  const [showSyncPassword, setShowSyncPassword] = useState(false);
  
  // States for inline editing
  const [editingFields, setEditingFields] = useState<Record<string, { originalText?: string; translation?: string; explanation?: string }>>({});

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- MIGRATION OF LEGACY MINING ITEMS ---
  useEffect(() => {
    async function migrateLegacyItems() {
      try {
        if (db.tables.some(t => t.name === 'miningItems')) {
          const oldItemsCount = await db.table('miningItems').count().catch(() => 0);
          if (oldItemsCount > 0) {
            const oldItems = await db.table('miningItems').toArray();
            if (oldItems.length > 0) {
              await miningDb.miningItems.bulkPut(oldItems);
              await db.table('miningItems').clear();
              toast.success(`${oldItems.length} frase(s) antigas migrada(s) para o novo banco de mineração local.`);
            }
          }
        }
      } catch (err) {
        console.warn('Migration check failed or not needed:', err);
      }
    }
    migrateLegacyItems();
  }, []);

  // --- MINING QUEUE DRIVE SYNC HANDLER ---
  const handleMiningDriveSync = async (password?: string) => {
    if (!driveClientId) {
      toast.error('Google Client ID não configurado.');
      return;
    }

    const cachedPassword = sessionStorage.getItem('memorize_sync_password') || password;
    if (!cachedPassword) {
      setSyncPasswordInput('');
      setIsPasswordModalOpen(true);
      return;
    }

    setIsSyncing(true);
    setSyncProgress(10);
    setSyncStatusMessage('Conectando ao Google Drive...');

    try {
      let token = driveAccessToken;
      if (!token) {
        token = await requestAccessToken(driveClientId);
        setDriveAccessToken(token);
      }

      setSyncProgress(30);
      setSyncStatusMessage('Procurando arquivo de mineração no Drive...');
      const backupFilename = 'memorize_mining_backup.enc';
      const fileInfo = await findBackupFile(token, backupFilename);

      let remotePayload = null;

      if (fileInfo) {
        setSyncProgress(50);
        setSyncStatusMessage('Baixando dados remotos...');
        const envelope = await downloadBackupFile(token, fileInfo.id);

        setSyncProgress(70);
        setSyncStatusMessage('Descriptografando dados de mineração...');
        const decryptedStr = await decryptData(envelope, cachedPassword);
        remotePayload = JSON.parse(decryptedStr);
      }

      setSyncProgress(80);
      setSyncStatusMessage('Mesclando capturas locais e remotas...');
      if (remotePayload) {
        await mergeMiningSync(remotePayload);
      }

      setSyncProgress(90);
      setSyncStatusMessage('Criptografando base unificada...');
      const localExport = await exportMiningDatabase();
      const newEnvelope = await encryptData(JSON.stringify(localExport), cachedPassword);

      if (fileInfo) {
        await updateBackupFile(token, fileInfo.id, newEnvelope);
      } else {
        await createBackupFile(token, newEnvelope, backupFilename);
      }

      // Cache password in sessionStorage for future seamless syncs (shared)
      sessionStorage.setItem('memorize_sync_password', cachedPassword);

      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('memorize_mining_last_sync_time', now.toString());

      setSyncProgress(100);
      setSyncStatusMessage('Sincronização concluída!');
      toast.success('Fila de mineração sincronizada com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Falha na sincronização rápida: ' + err.message);
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
      setSyncStatusMessage('');
    }
  };

  // --- IMAGE COMPRESSION HELPER ---
  const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  // --- PHOTO CAPTURE HANDLER ---
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCapturingLoading(true);
    let processedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });

        const compressed = await compressImage(base64);
        
        // Auto-save photo directly to the queue in pending state
        const newItem: MiningItem = {
          id: crypto.randomUUID(),
          imageUrl: compressed,
          source: 'photo',
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await miningDb.miningItems.add(newItem);
        processedCount++;
      } catch (err) {
        console.error('Image compression failed for file:', file.name, err);
        failedCount++;
      }
    }

    setIsCapturingLoading(false);
    
    // Clear the input value so that the onChange fires even if the user selects the same files again
    e.target.value = '';

    if (processedCount > 0) {
      if (processedCount === 1) {
        toast.success('Foto da legenda adicionada à fila! Processaremos depois.');
      } else {
        toast.success(`${processedCount} fotos adicionadas à fila! Processaremos depois.`);
      }
    }
    if (failedCount > 0) {
      toast.error(`Falha ao processar ${failedCount} imagem(ns).`);
    }
  };

  // --- AUDIO RECORDING HANDLERS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });

        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          
          // Auto-save voice directly to the queue
          const newItem: MiningItem = {
            id: crypto.randomUUID(),
            voiceUrl: base64data,
            source: 'voice',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await miningDb.miningItems.add(newItem);
          toast.success('Mensagem de voz adicionada à fila! Processaremos depois.');
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording initialization failed:', err);
      toast.error('Não foi possível acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // --- MANUAL TEXT HANDLER ---
  const handleAddTextDirect = async () => {
    if (!capturedText.trim()) return;

    setIsCapturingLoading(true);
    try {
      const newItem: MiningItem = {
        id: crypto.randomUUID(),
        originalText: capturedText.trim(),
        translation: '',
        explanation: '',
        source: 'text',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await miningDb.miningItems.add(newItem);
      toast.success('Frase salva na fila!');
      setCapturedText('');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar frase: ' + err.message);
    } finally {
      setIsCapturingLoading(false);
    }
  };

  // --- GEMINI PROCESSOR ---
  const handleAnalyzeWithGemini = async (item: MiningItem) => {
    if (!geminiApiKey.trim()) {
      toast.error('Chave de API do Gemini não configurada! Vá em Configurações para definir.');
      return;
    }

    setProcessingItemIds(prev => ({ ...prev, [item.id]: true }));
    
    try {
      let requestBody = {};
      const themeContext = item.theme 
        ? `Note that the user is studying this sentence under the theme: "${item.theme}". If relevant, emphasize or tailor the translation/explanation vocabulary notes to match this theme.` 
        : '';

      if (item.source === 'photo' && item.imageUrl) {
        const base64Data = item.imageUrl.split(',')[1];
        requestBody = {
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Data
                }
              },
              {
                text: `Below is an image of subtitles from a movie/series or a picture containing English text. Extract the main English sentence/phrase being studied (do not include Portuguese translations or other UI elements, focus on the English text). Translate it to Portuguese, and write a brief grammatical/contextual explanation of key words or expressions in Portuguese. Keep the explanation short and formatted in Markdown bullet points. ${themeContext} Return ONLY a valid JSON object in the following format: {\n  "originalText": "the extracted english sentence",\n  "translation": "tradução em português",\n  "explanation": "explicação curta da frase/palavras novas"\n}`
              }
            ]
          }]
        };
      } else if (item.source === 'voice' && item.voiceUrl) {
        const base64Data = item.voiceUrl.split(',')[1];
        requestBody = {
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/ogg',
                  data: base64Data
                }
              },
              {
                text: `Listen to the English audio. Transcribe the main English sentence spoken, translate it to Portuguese, and write a brief grammatical/contextual explanation of key words or expressions in Portuguese. Keep the explanation short and formatted in Markdown bullet points. ${themeContext} Return ONLY a valid JSON object in the following format: {\n  "originalText": "the transcribed english sentence",\n  "translation": "tradução em português",\n  "explanation": "explicação curta da frase/palavras novas"\n}`
              }
            ]
          }]
        };
      } else {
        // Text mining
        const textToAnalyze = item.originalText || '';
        requestBody = {
          contents: [{
            parts: [{
              text: `Analyze the following English sentence. Translate it to Portuguese, and write a brief grammatical/contextual explanation of key words or expressions in Portuguese. Keep the explanation short and formatted in Markdown bullet points. ${themeContext} Return ONLY a valid JSON object in the following format: {\n  "originalText": "the sentence",\n  "translation": "tradução em português",\n  "explanation": "explicação curta da frase/palavras novas"\n}. The sentence is: "${textToAnalyze}"`
            }]
          }]
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const resData = await response.json();
      const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsedResult = JSON.parse(cleanJson);

      const updatedItem = {
        ...item,
        originalText: parsedResult.originalText || item.originalText || 'Transcription failed',
        translation: parsedResult.translation || '',
        explanation: parsedResult.explanation || '',
        updatedAt: Date.now()
      };

      await miningDb.miningItems.put(updatedItem);
      toast.success('Análise de IA concluída com sucesso!');
    } catch (err) {
      console.error('Gemini Analysis Failed:', err);
      toast.error('Falha ao analisar item com o Gemini. Tente novamente.');
    } finally {
      setProcessingItemIds(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // --- INLINE EDIT HANDLERS ---
  const saveFieldToDb = async (itemId: string, field: 'originalText' | 'translation' | 'explanation', value: string) => {
    try {
      const item = await miningDb.miningItems.get(itemId);
      if (item) {
        item[field] = value;
        item.updatedAt = Date.now();
        await miningDb.miningItems.put(item);
      }
    } catch (err) {
      console.error('Failed to save field to DB:', err);
    }
  };

  const handleFieldChange = (itemId: string, field: 'originalText' | 'translation' | 'explanation', value: string) => {
    setEditingFields(prev => {
      const currentEditing = prev[itemId] || {};
      return {
        ...prev,
        [itemId]: {
          ...currentEditing,
          [field]: value
        }
      };
    });
  };

  // --- APPROVAL / DISCARD HANDLERS ---
  const handleSingleExport = (item: MiningItem) => {
    setSelectedItemIds({ [item.id]: true });
    setExportActionType('create');
    setExportCategory('series');
    setExportTheme('');
    
    const todayStr = new Date().toLocaleDateString('pt-BR');
    let defaultTitle = `Mineração - ${todayStr}`;
    setNewTextTitle(defaultTitle);

    const defaultCollId = collections.length > 0 ? '' : 'new_collection';
    setSelectedCollectionId(defaultCollId);
    setSelectedTextId(existingTexts[0]?.id || '');
    setNewCollectionName('');
    setIsExportModalOpen(true);
  };

  const handleDiscardItem = async (itemId: string) => {
    try {
      await miningDb.miningItems.delete(itemId);
      await miningDb.miningDeletions.put({ id: itemId, deletedAt: Date.now() });
      setSelectedItemIds(prev => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });
      toast.success('Item descartado da fila.');
    } catch (err) {
      console.error('Failed to discard item:', err);
      toast.error('Erro ao descartar item.');
    }
  };

  // --- SELECTION HELPERS ---
  const handleToggleSelectItem = (itemId: string) => {
    setSelectedItemIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleSelectAll = (items: MiningItem[]) => {
    const selectableItems = items.filter(item => !processingItemIds[item.id]);
    const allSelected = selectableItems.every(item => selectedItemIds[item.id]);

    const nextSelection: Record<string, boolean> = { ...selectedItemIds };
    selectableItems.forEach(item => {
      nextSelection[item.id] = !allSelected;
    });
    setSelectedItemIds(nextSelection);
  };

  // Get selected count
  const selectedCount = pendingItems 
    ? Object.keys(selectedItemIds).filter(id => selectedItemIds[id] && pendingItems.some(i => i.id === id)).length
    : 0;

  // --- BULK DISCARD ---
  const handleBulkDiscard = async () => {
    const selectedIds = Object.keys(selectedItemIds).filter(id => selectedItemIds[id]);
    if (selectedIds.length === 0) return;

    if (confirm(`Tem certeza de que deseja descartar ${selectedIds.length} item(ns) selecionado(s)?`)) {
      try {
        await Promise.all(selectedIds.map(async id => {
          await miningDb.miningItems.delete(id);
          await miningDb.miningDeletions.put({ id, deletedAt: Date.now() });
        }));
        setSelectedItemIds({});
        toast.success('Itens descartados com sucesso.');
      } catch (err) {
        console.error('Bulk discard failed:', err);
        toast.error('Erro ao descartar itens em lote.');
      }
    }
  };

  // --- OPEN EXPORT DIALOG ---
  const handleOpenExportModal = () => {
    const selectedIds = Object.keys(selectedItemIds).filter(id => selectedItemIds[id]);
    const selectedList = pendingItems?.filter(i => selectedIds.includes(i.id)) || [];
    const analyzedSelectedList = selectedList.filter(item => !!item.originalText);
    
    if (analyzedSelectedList.length === 0) {
      toast.error('Selecione pelo menos uma frase analisada para exportar.');
      return;
    }

    setExportActionType('create');
    setExportCategory('series');
    setExportTheme('');
    
    const todayStr = new Date().toLocaleDateString('pt-BR');
    let defaultTitle = `Mineração - ${todayStr}`;
    setNewTextTitle(defaultTitle);

    const defaultCollId = collections.length > 0 ? '' : 'new_collection';
    setSelectedCollectionId(defaultCollId);
    setSelectedTextId(existingTexts[0]?.id || '');
    setNewCollectionName('');
    setIsExportModalOpen(true);
  };

  // --- CREATE NEW COLLECTION SUB-FLOW ---
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error('Insira o nome da nova pasta.');
      return '';
    }

    const newId = crypto.randomUUID();
    await db.readingCollections.add({
      id: newId,
      title: newCollectionName.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    toast.success(`Pasta "${newCollectionName.trim()}" criada com sucesso!`);
    setSelectedCollectionId(newId);
    setNewCollectionName('');
    return newId;
  };

  // Handle collection change in modal
  const handleCollectionChange = (collId: string) => {
    setSelectedCollectionId(collId);
    
    if (collId === 'new_collection') {
      setSelectedTextId('new_text');
      setExportActionType('create');
    } else if (collId) {
      const textsInColl = existingTexts.filter(t => t.collectionId === collId);
      if (textsInColl.length === 0) {
        setSelectedTextId('new_text');
        setExportActionType('create');
      } else {
        setSelectedTextId('');
      }
    } else {
      setSelectedTextId('');
    }
  };

  const handleTextChange = (textId: string) => {
    setSelectedTextId(textId);
    if (textId === 'new_text') {
      setExportActionType('create');
    } else if (textId) {
      setExportActionType('append');
    }
  };

  // --- RUN BULK EXPORT TO TEXTS ---
  const handleRunExport = async () => {
    const selectedIds = Object.keys(selectedItemIds).filter(id => selectedItemIds[id]);
    const selectedList = pendingItems?.filter(i => selectedIds.includes(i.id) && !!i.originalText) || [];

    if (selectedList.length === 0) return;

    try {
      let finalCollectionId = selectedCollectionId;
      
      if (exportActionType === 'create') {
        if (selectedCollectionId === 'new_collection') {
          if (!newCollectionName.trim()) {
            toast.error('Insira o nome da nova pasta para o texto.');
            return;
          }
          const id = await handleCreateCollection();
          if (!id) return;
          finalCollectionId = id;
        } else {
          if (!finalCollectionId) {
            toast.error('Selecione uma pasta para salvar o texto.');
            return;
          }
        }
      }

      // Compile lines
      const textLines: TextLine[] = selectedList.map(item => {
        const editing = editingFields[item.id] || {};
        const finalOriginalText = editing.originalText !== undefined ? editing.originalText : item.originalText || '';
        const finalTranslation = editing.translation !== undefined ? editing.translation : item.translation || '';
        const finalExplanation = editing.explanation !== undefined ? editing.explanation : item.explanation || '';
        
        // Context contains both explanation and theme information if available
        let context = finalExplanation;
        if (item.theme) {
          context = `[Tema: ${item.theme}]\n${context}`;
        }

        return {
          id: crypto.randomUUID(),
          original: finalOriginalText.trim(),
          translated: finalTranslation.trim(),
          highlights: [],
          mastered: false,
          // Storing rich grammar notes directly inside the line context for later lookup
          context: context.trim()
        } as any;
      });

      if (exportActionType === 'create') {
        if (!newTextTitle.trim()) {
          toast.error('Insira o título do texto.');
          return;
        }

        const newTextId = crypto.randomUUID();
        const fullOriginal = selectedList.map(item => {
          const editing = editingFields[item.id] || {};
          return editing.originalText !== undefined ? editing.originalText : item.originalText || '';
        }).join('\n');
        
        const fullTranslated = selectedList.map(item => {
          const editing = editingFields[item.id] || {};
          return editing.translation !== undefined ? editing.translation : item.translation || '';
        }).join('\n');

        const newTextResource: TextResource = {
          id: newTextId,
          title: newTextTitle.trim(),
          description: `Texto importado da Fila de Mineração em ${new Date().toLocaleDateString('pt-BR')}`,
          type: 'reading',
          showInReadings: true,
          fullTextOriginal: fullOriginal,
          fullTextTranslated: fullTranslated,
          lines: textLines,
          collectionId: finalCollectionId ? finalCollectionId : undefined,
          category: exportCategory,
          theme: exportTheme.trim() ? exportTheme.trim() : undefined,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await db.texts.add(newTextResource);
        toast.success('Novo texto de leitura criado com sucesso!');
      } else {
        // APPEND to existing text
        if (!selectedTextId) {
          toast.error('Selecione o texto de destino.');
          return;
        }

        const targetText = await db.texts.get(selectedTextId);
        if (!targetText) {
          toast.error('Texto de destino não encontrado.');
          return;
        }

        const appendedLines = [...targetText.lines, ...textLines];
        const newOriginals = selectedList.map(item => {
          const editing = editingFields[item.id] || {};
          return editing.originalText !== undefined ? editing.originalText : item.originalText || '';
        }).join('\n');
        const newTranslations = selectedList.map(item => {
          const editing = editingFields[item.id] || {};
          return editing.translation !== undefined ? editing.translation : item.translation || '';
        }).join('\n');

        const updatedText: TextResource = {
          ...targetText,
          lines: appendedLines,
          fullTextOriginal: (targetText.fullTextOriginal + '\n' + newOriginals).trim(),
          fullTextTranslated: (targetText.fullTextTranslated + '\n' + newTranslations).trim(),
          updatedAt: Date.now()
        };

        await db.texts.put(updatedText);
        toast.success(`Frases anexadas ao texto "${targetText.title}"!`);
      }

      // Delete from mining queue and record tombstone
      await Promise.all(selectedList.map(async item => {
        await miningDb.miningItems.delete(item.id);
        await miningDb.miningDeletions.put({ id: item.id, deletedAt: Date.now() });
      }));

      // Reset states
      setSelectedItemIds({});
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Erro ao realizar a exportação das frases.');
    }
  };

  return (
    <div className="flex-1 w-full max-w-full px-4 md:px-8 py-6 space-y-6 relative min-h-screen pb-24">
      
      {/* Background glowing blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-600/3 rounded-full blur-3xl pointer-events-none -z-10" />
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/60">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-400 to-amber-500 bg-clip-text text-transparent">
            Fila de Mineração
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 font-semibold">
            Capture fotos de legendas, grave áudios ou anote palavras enquanto assiste séries, e estude depois.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {isSyncing && syncStatusMessage && (
            <span className="text-[10px] text-muted-foreground animate-pulse font-semibold">
              {syncStatusMessage}
            </span>
          )}
          {driveClientId && (
            <button
              onClick={() => handleMiningDriveSync()}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer shadow-md ${
                isSyncing 
                  ? 'bg-zinc-900 border-zinc-800 text-muted-foreground cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500/30 text-white hover:from-violet-500 hover:to-indigo-500 hover:scale-[1.02] active:scale-[0.98]'
              }`}
              title={lastSyncTime ? `Último sync: ${new Date(lastSyncTime).toLocaleString('pt-BR')}` : 'Nunca sincronizado'}
            >
              {isSyncing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Sincronizando ({syncProgress}%)</span>
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  <span>Sincronizar Fila</span>
                </>
              )}
            </button>
          )}
          {!geminiApiKey.trim() && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
              <AlertCircle size={14} />
              <span>Chave Gemini ausente</span>
            </div>
          )}
        </div>
      </div>

      {/* Capturing Interface widget */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 backdrop-blur-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-black text-foreground flex items-center gap-2 uppercase tracking-wider">
            <Sparkles className="text-amber-500" size={16} />
            <span>Capturar Instantaneamente</span>
          </h2>
        </div>

        {/* Capture inputs */}
        <div className="space-y-5">

          {/* Capture modes selector tabs */}
          <div className="flex rounded-xl bg-zinc-950/65 p-1 gap-1 border border-zinc-800/40">
            <button
              onClick={() => setActiveCaptureMode('photo')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeCaptureMode === 'photo' 
                  ? 'bg-zinc-800/80 text-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Camera size={14} />
              <span>Tirar Foto / Upload</span>
            </button>
            <button
              onClick={() => setActiveCaptureMode('voice')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeCaptureMode === 'voice' 
                  ? 'bg-zinc-800/80 text-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mic size={14} />
              <span>Gravar Voz</span>
            </button>
            <button
              onClick={() => setActiveCaptureMode('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeCaptureMode === 'text' 
                  ? 'bg-zinc-800/80 text-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText size={14} />
              <span>Digitar Frase</span>
            </button>
          </div>

          {/* Action interfaces based on mode */}
          <div className="min-h-[120px] flex flex-col justify-center items-center pt-2">
            
            {/* CAMERA / PHOTO MODE */}
            {activeCaptureMode === 'photo' && (
              <div className="w-full max-w-xl flex flex-col sm:flex-row gap-4 items-stretch justify-center px-4">
                {/* Upload Input - supports multiple images */}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="mining-upload-input"
                />
                
                {/* Camera Input - opens camera directly on mobile */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="mining-camera-input"
                />
                
                {/* Take Photo button (Camera) */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isCapturingLoading}
                  className="flex-1 flex flex-col items-center justify-center gap-3.5 py-6 px-4 border border-dashed border-zinc-800 hover:border-violet-500/40 rounded-2xl cursor-pointer bg-zinc-950/20 hover:bg-zinc-950/45 transition-all duration-300 group min-w-[200px]"
                >
                  {isCapturingLoading ? (
                    <Loader2 className="animate-spin text-violet-500" size={28} />
                  ) : (
                    <Camera className="text-muted-foreground group-hover:text-violet-400 group-hover:scale-105 transition-all" size={28} />
                  )}
                  <div className="text-center">
                    <span className="block text-xs font-extrabold text-zinc-300 group-hover:text-foreground transition-colors">
                      Tirar Foto da Legenda
                    </span>
                    <span className="block text-[10px] text-zinc-500 mt-1">
                      Abrir câmera no celular
                    </span>
                  </div>
                </button>

                {/* Upload Multiple Images button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCapturingLoading}
                  className="flex-1 flex flex-col items-center justify-center gap-3.5 py-6 px-4 border border-dashed border-zinc-800 hover:border-violet-500/40 rounded-2xl cursor-pointer bg-zinc-950/20 hover:bg-zinc-950/45 transition-all duration-300 group min-w-[200px]"
                >
                  {isCapturingLoading ? (
                    <Loader2 className="animate-spin text-violet-500" size={28} />
                  ) : (
                    <Upload className="text-muted-foreground group-hover:text-violet-400 group-hover:scale-105 transition-all" size={28} />
                  )}
                  <div className="text-center">
                    <span className="block text-xs font-extrabold text-zinc-300 group-hover:text-foreground transition-colors">
                      Upload de Imagens
                    </span>
                    <span className="block text-[10px] text-zinc-500 mt-1">
                      Selecione várias da galeria
                    </span>
                  </div>
                </button>
              </div>
            )}

            {/* VOICE MODE */}
            {activeCaptureMode === 'voice' && (
              <div className="w-full flex flex-col items-center gap-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="w-16 h-16 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 hover:scale-105 transition-all duration-300 cursor-pointer"
                    title="Começar a Gravar"
                  >
                    <Mic size={28} />
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    {/* Animated Pulsing Waveform */}
                    <div className="flex items-center gap-1.5 h-8 justify-center">
                      <span className="w-1.5 h-3 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1.5 h-6 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-8 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      <span className="w-1.5 h-5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      <span className="w-1.5 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                    </div>
                    <button
                      onClick={stopRecording}
                      className="w-16 h-16 bg-zinc-950 text-white border-4 border-rose-500 rounded-full flex items-center justify-center animate-pulse cursor-pointer shadow-lg shadow-rose-500/30 hover:scale-105 transition-all duration-300"
                      title="Parar Gravação"
                    >
                      <Square size={20} className="text-rose-500 fill-rose-500" />
                    </button>
                  </div>
                )}
                <span className="text-xs font-bold text-muted-foreground">
                  {isRecording ? 'Gravando áudio... toque para salvar na fila' : 'Toque no microfone para gravar uma frase'}
                </span>
              </div>
            )}

            {/* MANUAL TEXT MODE */}
            {activeCaptureMode === 'text' && (
              <div className="w-full max-w-lg flex items-center gap-3 bg-zinc-950/45 border border-zinc-800/80 rounded-xl p-2.5 focus-within:border-violet-500/80 focus-within:ring-2 focus-within:ring-violet-500/15 transition-all duration-300">
                <FileText size={16} className="text-muted-foreground/70 ml-2 shrink-0" />
                <input
                  type="text"
                  value={capturedText}
                  onChange={(e) => setCapturedText(e.target.value)}
                  placeholder="Ex: I would have done it if I had the time..."
                  className="flex-1 bg-transparent border-none text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/30 font-semibold"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTextDirect()}
                />
                <button
                  onClick={handleAddTextDirect}
                  disabled={!capturedText.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white font-extrabold rounded-lg text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed cursor-pointer transition-all duration-300 border-none"
                >
                  <PlusCircle size={14} />
                  <span>Salvar</span>
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Floating Bulk actions dock (macOS / dynamic-island inspired bottom dock) */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] sm:w-auto sm:min-w-[580px] bg-zinc-950/85 backdrop-blur-2xl border border-violet-500/30 text-zinc-50 rounded-2xl px-5 py-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 rounded-lg bg-violet-500/25 text-violet-400 border border-violet-500/40 flex items-center justify-center text-xs font-black">
              {selectedCount}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-foreground/90">frase(s) selecionada(s)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              onClick={() => setSelectedItemIds({})}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-muted-foreground hover:text-foreground border border-zinc-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Limpar Seleção
            </button>
            <button
              onClick={handleBulkDiscard}
              className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:scale-[1.01] transition-all cursor-pointer"
            >
              <Trash size={12} />
              <span>Descartar</span>
            </button>
            <button
              onClick={handleOpenExportModal}
              className="px-4.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-indigo-950/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none"
            >
              <FileSpreadsheet size={13} />
              <span>Exportar para Leitura</span>
            </button>
          </div>
        </div>
      )}

      {/* Pending Queue Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground flex items-center gap-2 uppercase tracking-wide">
            <BookOpen size={16} className="text-violet-500" />
            <span>Fila para Estudo ({pendingItems ? pendingItems.length : 0})</span>
          </h2>

          {/* Select all toggle */}
          {pendingItems && pendingItems.length > 0 && (
            <button
              onClick={() => handleSelectAll(pendingItems)}
              className="text-xs text-violet-400 hover:text-violet-300 font-extrabold transition-all cursor-pointer flex items-center gap-1 bg-violet-500/5 px-2.5 py-1 rounded-lg border border-violet-500/10 hover:border-violet-500/25"
            >
              {pendingItems.filter(i => !processingItemIds[i.id]).every(i => selectedItemIds[i.id]) 
                ? 'Desmarcar Todos' 
                : 'Selecionar Todos'
              }
            </button>
          )}
        </div>

        {pendingItems && pendingItems.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-2xl p-12 text-center bg-zinc-950/10">
            <Bot className="mx-auto text-muted-foreground/30 mb-3 animate-pulse" size={42} />
            <h3 className="font-extrabold text-sm text-foreground">Fila de Mineração Vazia</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 leading-relaxed font-medium">
              Capture legendas pelo celular enquanto assiste e elas aparecerão aqui prontas para a extração por IA.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {pendingItems?.map((item) => {
              const isProcessing = processingItemIds[item.id] || false;
              const hasText = !!item.originalText;
              
              // Edit values
              const editVals = editingFields[item.id] || {};
              const origVal = editVals.originalText !== undefined ? editVals.originalText : item.originalText || '';
              const transVal = editVals.translation !== undefined ? editVals.translation : item.translation || '';
              const explVal = editVals.explanation !== undefined ? editVals.explanation : item.explanation || '';
              
              const isSelected = !!selectedItemIds[item.id];
              const isEditing = !!editingCardIds[item.id];

              return (
                <div 
                  key={item.id}
                  className={`rounded-xl border backdrop-blur-xl overflow-hidden flex flex-col transition-all duration-300 relative ${
                    isSelected 
                      ? 'border-violet-500/60 bg-zinc-900/50 shadow-xl shadow-violet-500/5 ring-1 ring-violet-500/20' 
                      : 'border-zinc-800/80 bg-zinc-900/20 hover:bg-zinc-900/30 hover:border-zinc-700/80 shadow-md shadow-black/10'
                  }`}
                >
                  
                  {/* Top Media Block (if photo or voice) */}
                  {item.imageUrl && (
                    <div 
                      onClick={() => setZoomedImageUrl(item.imageUrl || null)}
                      className="w-full h-16 bg-zinc-950/20 relative border-b border-zinc-800/60 overflow-hidden group cursor-zoom-in"
                      title="Clique para ver em tela cheia"
                    >
                      <img 
                        src={item.imageUrl} 
                        alt="Visual Reference" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-80 pointer-events-none" />
                      <div className="absolute bottom-1.5 left-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[7px] font-black text-amber-400 flex items-center gap-1 border border-amber-500/30 shadow-md">
                        <Camera size={8} />
                        <span>FOTO</span>
                      </div>
                      <div className="absolute top-1.5 right-2 bg-black/60 backdrop-blur-md p-1 rounded-full text-white/85 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={10} />
                      </div>
                    </div>
                  )}

                  {item.source === 'voice' && (
                    <div className="w-full h-12 bg-zinc-950/20 relative border-b border-zinc-800/60 flex items-center justify-between px-3 py-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
                          <Mic size={10} />
                        </div>
                        <span className="text-[7px] font-black text-rose-400 bg-rose-500/5 px-1 py-0.5 rounded border border-rose-500/25">ÁUDIO</span>
                      </div>
                      <audio src={item.voiceUrl} controls className="max-w-[120px] filter invert drop-shadow scale-75 origin-right" />
                    </div>
                  )}

                  {/* Main Content Area */}
                  <div className="flex-1 p-3 flex flex-col justify-between gap-2.5">
                    
                    {/* Header Row of the Card */}
                    <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-zinc-800/30">
                      <div className="flex items-center gap-1.5">
                        {/* Checkbox (visible on all cards unless processing) */}
                        {!isProcessing && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelectItem(item.id)}
                          />
                        )}
                        
                        {/* Source Chip */}
                        <span className={`flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[8px] font-black tracking-wider uppercase border ${
                          item.source === 'photo' 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                            : item.source === 'voice' 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                              : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                        }`}>
                          {item.source === 'photo' && <Camera size={8} />}
                          {item.source === 'voice' && <Mic size={8} />}
                          {item.source === 'text' && <FileText size={8} />}
                          <span>{item.source === 'photo' ? 'Foto' : item.source === 'voice' ? 'Áudio' : 'Texto'}</span>
                        </span>
                        
                        {/* AI State Badge */}
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${
                          hasText 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                        }`}>
                          {hasText ? 'Analisado' : 'Aguardando IA'}
                        </span>
                      </div>
                      
                      <span className="text-[8px] text-muted-foreground/60 font-bold">
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {/* Unanalyzed Card Body */}
                    {!hasText && !isProcessing && (
                      <div className="flex-1 flex flex-col items-center justify-center py-3 text-center">
                        <Sparkles size={16} className="text-amber-400 animate-pulse mb-1.5" />
                        <span className="text-[10px] font-bold text-zinc-400 mb-2.5">
                          Transcrições e análises automáticas pendentes
                        </span>
                        <button
                          onClick={() => handleAnalyzeWithGemini(item)}
                          className="w-full py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1 shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border-none"
                        >
                          <Sparkles size={12} className="fill-current" />
                          <span>Analisar com Gemini</span>
                        </button>
                      </div>
                    )}

                    {/* Analyzing Loader Body */}
                    {isProcessing && (
                      <div className="flex-1 flex flex-col items-center justify-center py-4 text-center space-y-1.5">
                        <div className="relative w-7 h-7 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-amber-500/10 border-t-amber-500 animate-spin" />
                          <Bot size={14} className="text-amber-500 animate-pulse" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400">Gemini processando...</span>
                      </div>
                    )}

                    {/* Analyzed Fields (Editable or Read-only) */}
                    {hasText && !isProcessing && (
                      <div className="flex-1 flex flex-col justify-between">
                        {isEditing ? (
                          <div className="space-y-2.5 my-1.5">
                            {/* Frente / Inglês Field Box */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-zinc-405 tracking-wider uppercase flex items-center gap-1">
                                  <Tag size={10} className="text-violet-400" />
                                  <span>Frente / Inglês</span>
                                </label>
                                <span className="text-[8px] font-extrabold text-violet-400 bg-violet-500/10 px-1 py-0.2 rounded border border-violet-500/25">EN</span>
                              </div>
                              <textarea
                                value={origVal}
                                onChange={(e) => handleFieldChange(item.id, 'originalText', e.target.value)}
                                onBlur={(e) => saveFieldToDb(item.id, 'originalText', e.target.value)}
                                rows={2}
                                className="w-full h-11 text-xs font-semibold text-foreground bg-zinc-950/45 border border-zinc-800/80 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 focus:outline-none rounded-lg py-1 px-2.5 resize-none overflow-y-auto transition-all duration-200"
                              />
                            </div>

                            {/* Verso / Tradução Field Box */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-zinc-405 tracking-wider uppercase flex items-center gap-1">
                                  <FileText size={10} className="text-cyan-400" />
                                  <span>Verso / Tradução</span>
                                </label>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!origVal.trim()) return;
                                      try {
                                        toast.loading('Traduzindo...', { id: `translate-${item.id}` });
                                        const translation = await translateWithMyMemory(origVal);
                                        handleFieldChange(item.id, 'translation', translation);
                                        await saveFieldToDb(item.id, 'translation', translation);
                                        toast.success('Tradução atualizada!', { id: `translate-${item.id}` });
                                      } catch (err: any) {
                                        toast.error('Erro ao traduzir: ' + err.message, { id: `translate-${item.id}` });
                                      }
                                    }}
                                    className="text-[8px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-1 py-0.2 rounded border border-cyan-500/25 flex items-center gap-0.5 transition-all cursor-pointer"
                                  >
                                    <RefreshCw size={8} />
                                    <span>Traduzir</span>
                                  </button>
                                  <span className="text-[8px] font-extrabold text-cyan-400 bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/25">PT</span>
                                </div>
                              </div>
                              <textarea
                                value={transVal}
                                onChange={(e) => handleFieldChange(item.id, 'translation', e.target.value)}
                                onBlur={(e) => saveFieldToDb(item.id, 'translation', e.target.value)}
                                rows={2}
                                className="w-full h-11 text-xs font-semibold text-foreground bg-zinc-950/45 border border-zinc-800/80 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 focus:outline-none rounded-lg py-1 px-2.5 resize-none overflow-y-auto transition-all duration-200"
                              />
                            </div>

                            {/* Grammatical Explanation Callout Box */}
                            <div className="border-l-4 border-amber-500/50 bg-amber-500/5 rounded-r-lg p-2 space-y-1 border border-zinc-850">
                              <label className="text-[9px] font-black text-amber-400/90 tracking-wider uppercase flex items-center gap-1">
                                <Bot size={10} className="animate-pulse" />
                                <span>Explicação Gramatical & Dicas</span>
                              </label>
                              <textarea
                                value={explVal}
                                onChange={(e) => handleFieldChange(item.id, 'explanation', e.target.value)}
                                onBlur={(e) => saveFieldToDb(item.id, 'explanation', e.target.value)}
                                rows={2}
                                className="w-full h-11 text-[11px] text-amber-200/90 bg-transparent border-none focus:outline-none focus:ring-0 p-0 resize-none overflow-y-auto font-mono leading-relaxed"
                                placeholder="Notas explicativas geradas..."
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 py-2 flex-1 flex flex-col justify-center">
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-black text-violet-400 bg-violet-500/10 px-1 py-0.2 rounded border border-violet-500/25 select-none uppercase tracking-wider">Frente</span>
                              <p className="font-extrabold text-sm text-zinc-100 leading-snug select-all line-clamp-4">
                                {origVal || <span className="text-zinc-650 italic">Sem texto original</span>}
                              </p>
                            </div>
                            
                            <div className="space-y-0.5 border-t border-zinc-850/50 pt-1.5 mt-1.5">
                              <span className="text-[8px] font-black text-cyan-400 bg-cyan-500/10 px-1 py-0.2 rounded border border-cyan-500/25 select-none uppercase tracking-wider">Verso</span>
                              <p className="text-xs text-zinc-300 leading-normal select-all line-clamp-4">
                                {transVal || <span className="text-zinc-650 italic">Sem tradução</span>}
                              </p>
                            </div>

                            {explVal && (
                              <div className="text-[10px] text-amber-400/80 bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/10 font-mono leading-relaxed line-clamp-3 mt-2">
                                <span className="font-bold text-amber-500 mr-1 select-none font-sans">Dica IA:</span>
                                {explVal}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/40 w-full mt-auto">
                      {isEditing ? (
                        <button
                          onClick={() => toggleEditCard(item.id)}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg flex items-center justify-center gap-1 shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer border-none"
                        >
                          <Check size={12} />
                          <span>Concluir Edição</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDiscardItem(item.id)}
                            className="p-1.5 border border-zinc-850 hover:border-rose-500/30 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 rounded-lg transition-all duration-200 cursor-pointer"
                            title="Descartar"
                          >
                            <Trash size={12} />
                          </button>
                          
                          {hasText && !isProcessing && (
                            <>
                              <button
                                onClick={() => toggleEditCard(item.id)}
                                className="flex-1 py-1.5 border border-zinc-850 hover:border-violet-500/30 hover:bg-violet-500/10 text-muted-foreground hover:text-violet-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all duration-200"
                              >
                                <FileText size={12} />
                                <span>Editar</span>
                              </button>
                              
                              <button
                                onClick={() => handleSingleExport(item)}
                                className="flex-1 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-lg flex items-center justify-center gap-1 shadow-md shadow-indigo-950/20 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer border-none"
                              >
                                <FileSpreadsheet size={12} />
                                <span>Exportar</span>
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- EXPORT TO READING DIALOG (MODAL) --- */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800/80 w-full max-w-md rounded-2xl shadow-2xl p-6 relative overflow-hidden space-y-4 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/40 pb-3">
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2 uppercase tracking-wide">
                <FileSpreadsheet className="text-violet-400" size={18} />
                <span>Exportar para Leitura</span>
              </h3>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content info */}
            <div className="bg-zinc-950/45 border border-zinc-800/40 rounded-xl p-3.5 text-xs text-muted-foreground leading-relaxed font-medium">
              Você está exportando <span className="font-extrabold text-foreground">{selectedCount} frase(s)</span> para o módulo de leitura.
            </div>

            {/* Action options */}
            <div className="space-y-4">
              
              {/* Folder Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Pasta de Destino (Coleção)</label>
                <div className="relative">
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => handleCollectionChange(e.target.value)}
                    className="w-full appearance-none bg-zinc-950/45 border border-zinc-800/80 text-foreground text-sm rounded-xl pl-3.5 pr-10 py-2.5 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 cursor-pointer transition-all font-semibold"
                  >
                    <option value="" disabled>-- Selecione uma Pasta --</option>
                    <option value="new_collection">+ Criar Nova Pasta...</option>
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>
                        📁 {c.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                </div>

                {selectedCollectionId === 'new_collection' && (
                  <div className="pt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Nome da Nova Pasta (ex: The Boys)..."
                      className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/45 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 placeholder:text-muted-foreground/30 font-semibold transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Text Selector (Visible when a folder is selected or being created) */}
              {selectedCollectionId && (
                <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Texto de Destino</label>
                    <div className="relative">
                      <select
                        value={selectedTextId}
                        onChange={(e) => handleTextChange(e.target.value)}
                        className="w-full appearance-none bg-zinc-950/45 border border-zinc-800/80 text-foreground text-sm rounded-xl pl-3.5 pr-10 py-2.5 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 cursor-pointer transition-all font-semibold"
                      >
                        {selectedCollectionId === 'new_collection' ? (
                          <option value="new_text">+ Criar Novo Texto...</option>
                        ) : (
                          <>
                            <option value="" disabled>-- Selecione um Texto --</option>
                            <option value="new_text">+ Criar Novo Texto...</option>
                            {existingTexts
                              .filter(t => t.collectionId === selectedCollectionId)
                              .map(t => (
                                <option key={t.id} value={t.id}>
                                  📖 {t.title} {t.theme ? `(#${t.theme})` : ''}
                                </option>
                              ))
                            }
                          </>
                        )}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                    </div>
                  </div>

                  {/* New Text Inputs (Visible if creating new text) */}
                  {selectedTextId === 'new_text' && (
                    <div className="space-y-4 p-3.5 bg-zinc-950/20 border border-zinc-800/40 rounded-2xl animate-in fade-in slide-in-from-top-1.5 duration-200">
                      
                      {/* Título do Novo Texto */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Título do Novo Texto</label>
                        <input
                          type="text"
                          value={newTextTitle}
                          onChange={(e) => setNewTextTitle(e.target.value)}
                          placeholder="Ex: ep 1"
                          className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/45 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 placeholder:text-muted-foreground/30 font-semibold transition-all"
                        />
                      </div>

                      {/* Category & Theme Review */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Classificação</label>
                          <div className="relative">
                            <select
                              value={exportCategory}
                              onChange={(e) => setExportCategory(e.target.value as any)}
                              className="w-full appearance-none bg-zinc-950/45 border border-zinc-800/80 text-foreground text-xs rounded-xl pl-3.5 pr-8 py-2 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 cursor-pointer transition-all font-semibold"
                            >
                              <option value="series">📺 Seriado</option>
                              <option value="movie">🎬 Filme</option>
                              <option value="random">🔀 Aleatório</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={12} />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Tema do Texto</label>
                          <input
                            list="export-themes-list"
                            type="text"
                            value={exportTheme}
                            onChange={(e) => setExportTheme(e.target.value)}
                            placeholder="Opcional..."
                            className="w-full rounded-xl border border-zinc-800/80 bg-zinc-950/45 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 placeholder:text-muted-foreground/30 font-semibold transition-all"
                          />
                          <datalist id="export-themes-list">
                            {themeSuggestions.map(t => <option key={t} value={t} />)}
                          </datalist>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/40">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 border border-zinc-800 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRunExport}
                disabled={!selectedCollectionId || !selectedTextId || (selectedCollectionId === 'new_collection' && !newCollectionName.trim()) || (selectedTextId === 'new_text' && !newTextTitle.trim())}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors border-none"
              >
                <Check size={14} />
                <span>Confirmar e Enviar</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4 animate-scaleUp">
            <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-lg hover:bg-zinc-850 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
            <div>
              <h3 className="text-lg font-bold text-zinc-50">Senha de Sincronização</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Insira a senha usada para criptografar seus dados de sync do Google Drive.
              </p>
            </div>
            
            <div className="relative">
              <input
                type={showSyncPassword ? 'text' : 'password'}
                value={syncPasswordInput}
                onChange={(e) => setSyncPasswordInput(e.target.value)}
                placeholder="Senha de criptografia..."
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/45 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 placeholder:text-muted-foreground/30 font-semibold text-foreground transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && syncPasswordInput) {
                    setIsPasswordModalOpen(false);
                    handleMiningDriveSync(syncPasswordInput);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowSyncPassword(!showSyncPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showSyncPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setSyncPasswordInput('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-zinc-800 hover:bg-zinc-850 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (syncPasswordInput) {
                    setIsPasswordModalOpen(false);
                    handleMiningDriveSync(syncPasswordInput);
                  }
                }}
                disabled={!syncPasswordInput}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors border-none"
              >
                Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Zoomed Image Modal */}
      {zoomedImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setZoomedImageUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white hover:text-zinc-300 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
            onClick={() => setZoomedImageUrl(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={zoomedImageUrl} 
            alt="Maximized Subtitle" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
          />
        </div>
      )}

    </div>
  );
}
