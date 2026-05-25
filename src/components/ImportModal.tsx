import React, { useState, useEffect } from 'react';
import type { Deck, Card } from '../types';
import { db } from '../db/db';
import { parseCSV } from '../utils/csv';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Upload, AlertTriangle, Plus, Layers } from 'lucide-react';
import JSZip from 'jszip';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: Deck[] | undefined;
}

const loadSqlJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).initSqlJs) {
      resolve((window as any).initSqlJs);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js';
    script.async = true;
    script.onload = () => {
      resolve((window as any).initSqlJs);
    };
    script.onerror = () => reject(new Error('Falha ao carregar biblioteca SQLite (sql.js).'));
    document.body.appendChild(script);
  });
};

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  decks = []
}) => {
  const [activeTab, setActiveTab] = useState<'csv' | 'json'>('csv');
  const [isImporting, setIsImporting] = useState(false);

  // --- ESTADOS DO IMPORTADOR CSV/TXT/APKG ---
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [skipHeader, setSkipHeader] = useState(true);
  const [importDestinationMode, setImportDestinationMode] = useState<'create' | 'append'>('create');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');

  // Estados específicos de APKG
  const [isApkg, setIsApkg] = useState(false);
  const [apkgZip, setApkgZip] = useState<JSZip | null>(null);
  const [apkgAudioMap, setApkgAudioMap] = useState<{ [rowIdx: number]: string }>({});
  const [reverseMediaMap, setReverseMediaMap] = useState<{ [filename: string]: string }>({});

  // Mapeamento de colunas
  const [colMappings, setColMappings] = useState({
    front: 0,
    back: 1,
    context: -1,
    interval: -1,
    ease: -1,
    repetitions: -1,
    lapses: -1,
    dueDate: -1
  });

  // --- ESTADOS DO RESTAURADOR JSON ---
  const [jsonFileName, setJsonFileName] = useState('');
  const [jsonContent, setJsonContent] = useState('');

  // Reset de estados ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setParsedData([]);
      setJsonFileName('');
      setJsonContent('');
      setIsImporting(false);
      setImportDestinationMode('create');
      setNewDeckName('');
      setNewDeckDesc('');
      setIsApkg(false);
      setApkgZip(null);
      setApkgAudioMap({});
      setReverseMediaMap({});
      if (decks && decks.length > 0) {
        setSelectedDeckId(decks[0].id);
      } else {
        setSelectedDeckId('');
      }
    }
  }, [isOpen, decks]);

  // --- PARSEAR ARQUIVO CSV/TXT OU APKG ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (file.name.endsWith('.apkg')) {
      setIsApkg(true);
      setIsImporting(true);
      try {
        // 1. Carregar biblioteca sql.js dinamicamente
        const initSqlJs = await loadSqlJs();
        const SQL = await initSqlJs({
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });

        // 2. Descompactar o arquivo APKG
        const zip = await JSZip.loadAsync(file);
        setApkgZip(zip);

        // 3. Ler o mapeamento de arquivos de mídia
        const revMediaMap: { [filename: string]: string } = {};
        const mediaFile = zip.file('media');
        if (mediaFile) {
          const mediaText = await mediaFile.async('text');
          const mediaJson = JSON.parse(mediaText);
          Object.keys(mediaJson).forEach(zipKey => {
            const filename = mediaJson[zipKey];
            revMediaMap[filename.toLowerCase()] = zipKey;
          });
          setReverseMediaMap(revMediaMap);
        }

        // 4. Ler o banco de dados SQLite
        const dbFile = zip.file('collection.anki21') || zip.file('collection.anki2');
        if (!dbFile) {
          throw new Error('Banco de dados do Anki não encontrado no pacote .apkg.');
        }

        const dbBuffer = await dbFile.async('uint8array');
        const db = new SQL.Database(dbBuffer);

        // Tentar extrair o nome do baralho do SQLite do Anki
        let extractedDeckName = '';
        try {
          const colDecksResult = db.exec("SELECT decks FROM col");
          if (colDecksResult.length > 0 && colDecksResult[0].values.length > 0) {
            const decksJsonStr = colDecksResult[0].values[0][0] as string;
            const decksObj = JSON.parse(decksJsonStr);
            const deckNames = Object.values(decksObj)
              .map((d: any) => d.name)
              .filter(name => name && name.toLowerCase() !== 'default');
            if (deckNames.length > 0) {
              const rawName = deckNames[0];
              const parts = rawName.split('::');
              extractedDeckName = parts[parts.length - 1];
            }
          }
        } catch (err) {
          console.warn("Falha ao extrair nome do baralho das tabelas do Anki", err);
        }

        if (!extractedDeckName) {
          extractedDeckName = file.name.replace(/\.apkg$/i, '');
        }
        setNewDeckName(extractedDeckName);

        // 5. Ler timestamp de criação para converter devidamente o vencimento
        let crt = 0;
        try {
          const crtResult = db.exec("SELECT crt FROM col");
          if (crtResult.length > 0 && crtResult[0].values.length > 0) {
            crt = crtResult[0].values[0][0] as number;
          }
        } catch (err) {
          console.warn("Falha ao ler crt de col", err);
        }

        // 6. Consultar dados estruturados de cartões e notas
        const query = `
          SELECT 
            n.flds,
            c.ivl,
            c.factor,
            c.reps,
            c.lapses,
            c.due
          FROM cards c
          JOIN notes n ON c.nid = n.id
        `;

        const queryResult = db.exec(query);
        if (queryResult.length === 0 || queryResult[0].values.length === 0) {
          throw new Error('Nenhum cartão válido encontrado no pacote do Anki.');
        }

        const values = queryResult[0].values;
        const rows: string[][] = [];
        const audioMap: { [rowIdx: number]: string } = {};
        const todayStr = new Date().toISOString().split('T')[0];

        values.forEach((val: any, rIdx: number) => {
          const flds = val[0] as string;
          const ivl = val[1] as number;
          const factor = val[2] as number;
          const reps = val[3] as number;
          const lapses = val[4] as number;
          const due = val[5] as number;

          const fields = flds.split('\x1f');
          
          // Procurar e limpar som
          let soundFilename = '';
          const soundRegex = /\[sound:([^\]]+)\]/;
          for (let f = 0; f < fields.length; f++) {
            const match = fields[f].match(soundRegex);
            if (match) {
              soundFilename = match[1];
              fields[f] = fields[f].replace(soundRegex, '').trim();
            }
          }

          if (soundFilename) {
            audioMap[rIdx] = soundFilename;
          }

          // Calcular vencimento
          let dueDateStr = todayStr;
          if (ivl > 0) {
            if (due > 1000000000) {
              dueDateStr = new Date(due * 1000).toISOString().split('T')[0];
            } else {
              const dueTimeMs = (crt + (due * 86400)) * 1000;
              dueDateStr = new Date(dueTimeMs).toISOString().split('T')[0];
            }
          }

          const rowData = [
            ...fields,
            ivl.toString(),
            (factor / 1000).toString(),
            reps.toString(),
            lapses.toString(),
            dueDateStr
          ];
          rows.push(rowData);
        });

        setParsedData(rows);
        setApkgAudioMap(audioMap);

        if (rows.length > 0) {
          const firstRow = rows[0];
          const fieldsCount = firstRow.length - 5;

          setColMappings({
            front: 0,
            back: fieldsCount > 1 ? 1 : 0,
            context: fieldsCount > 2 ? 2 : -1,
            interval: fieldsCount,
            ease: fieldsCount + 1,
            repetitions: fieldsCount + 2,
            lapses: fieldsCount + 3,
            dueDate: fieldsCount + 4
          });
        }
      } catch (err: any) {
        console.error(err);
        alert('Erro ao processar pacote APKG: ' + err.message);
        setIsApkg(false);
      } finally {
        setIsImporting(false);
      }
    } else {
      setIsApkg(false);
      const cleanFileName = file.name.replace(/\.(csv|txt)$/i, '');
      setNewDeckName(cleanFileName);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        setParsedData(parsed);

        if (parsed.length > 0) {
          const header = parsed[0];
          let frontIdx = 0;
          let backIdx = 1 < header.length ? 1 : 0;
          let contextIdx = -1;
          let intervalIdx = -1;
          let easeIdx = -1;
          let repsIdx = -1;
          let lapsesIdx = -1;
          let dueIdx = -1;

          header.forEach((col, idx) => {
            const cleanCol = col.toLowerCase();
            if (cleanCol.includes('front') || cleanCol.includes('frente') || cleanCol.includes('term') || cleanCol.includes('english') || cleanCol.includes('inglês')) {
              frontIdx = idx;
            } else if (cleanCol.includes('back') || cleanCol.includes('verso') || cleanCol.includes('meaning') || cleanCol.includes('tradução') || cleanCol.includes('portugues')) {
              backIdx = idx;
            } else if (cleanCol.includes('context') || cleanCol.includes('exemplo') || cleanCol.includes('sentence') || cleanCol.includes('frase')) {
              contextIdx = idx;
            } else if (cleanCol.includes('interval') || cleanCol.includes('intervalo')) {
              intervalIdx = idx;
            } else if (cleanCol.includes('ease') || cleanCol.includes('facilidade') || cleanCol.includes('factor')) {
              easeIdx = idx;
            } else if (cleanCol.includes('repetition') || cleanCol.includes('repetição') || cleanCol.includes('reps')) {
              repsIdx = idx;
            } else if (cleanCol.includes('lapse') || cleanCol.includes('falha') || cleanCol.includes('lapses')) {
              lapsesIdx = idx;
            } else if (cleanCol.includes('due') || cleanCol.includes('vencimento') || cleanCol.includes('vence')) {
              dueIdx = idx;
            }
          });

          setColMappings({
            front: frontIdx,
            back: backIdx,
            context: contextIdx,
            interval: intervalIdx,
            ease: easeIdx,
            repetitions: repsIdx,
            lapses: lapsesIdx,
            dueDate: dueIdx
          });
        }
      };
      reader.readAsText(file);
    }
  };

  // --- EXECUTAR IMPORTAÇÃO CSV/TXT OU APKG ---
  const executeCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedData.length === 0) return;

    try {
      setIsImporting(true);
      let targetDeckId = '';
      const todayStr = new Date().toISOString().split('T')[0];

      if (importDestinationMode === 'create') {
        const deckNameClean = newDeckName.trim();
        if (!deckNameClean) {
          alert('Por favor, digite o nome do novo baralho.');
          setIsImporting(false);
          return;
        }

        const newDeck: Deck = {
          id: crypto.randomUUID(),
          name: '📚 ' + deckNameClean.replace(/^[📚📁]\s*/, ''),
          description: newDeckDesc.trim() || (isApkg ? 'Importado via Anki (.apkg).' : 'Importado via planilha/Anki.'),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await db.decks.add(newDeck);
        targetDeckId = newDeck.id;
      } else {
        if (!selectedDeckId) {
          alert('Por favor, selecione um baralho existente para anexar os cartões.');
          setIsImporting(false);
          return;
        }
        targetDeckId = selectedDeckId;
      }

      const startIndex = isApkg ? 0 : (skipHeader ? 1 : 0);
      const cardsToInsert: Card[] = [];

      for (let i = startIndex; i < parsedData.length; i++) {
        const row = parsedData[i];
        
        // Pular linhas sem Frente ou Verso definidos
        const frontVal = row[colMappings.front];
        const backVal = row[colMappings.back];
        if (!frontVal || !backVal) continue;

        // Mapeia os campos SRS se as colunas estiverem definidas, caso contrário usa padrões do Anki/SM-2
        const srsInterval = colMappings.interval !== -1 && row[colMappings.interval] ? parseInt(row[colMappings.interval], 10) : 0;
        const srsEase = colMappings.ease !== -1 && row[colMappings.ease] ? parseFloat(row[colMappings.ease]) : 2.5;
        const srsRepetitions = colMappings.repetitions !== -1 && row[colMappings.repetitions] ? parseInt(row[colMappings.repetitions], 10) : 0;
        const srsLapses = colMappings.lapses !== -1 && row[colMappings.lapses] ? parseInt(row[colMappings.lapses], 10) : 0;
        const srsDueDate = colMappings.dueDate !== -1 && row[colMappings.dueDate] ? row[colMappings.dueDate].trim() : todayStr;

        // Se for APKG e tiver áudio associado a essa linha, extrai do ZIP
        let audioBlob: Blob | undefined = undefined;
        if (isApkg && apkgZip) {
          const soundFilename = apkgAudioMap[i];
          if (soundFilename) {
            const zipKey = reverseMediaMap[soundFilename.toLowerCase()];
            if (zipKey) {
              const fileInZip = apkgZip.file(zipKey);
              if (fileInZip) {
                audioBlob = await fileInZip.async('blob');
              }
            }
          }
        }

        const card: Card = {
          id: crypto.randomUUID(),
          deckId: targetDeckId,
          front: frontVal.trim(),
          back: backVal.trim(),
          context: colMappings.context !== -1 && row[colMappings.context] ? row[colMappings.context].trim() : '',
          audio: audioBlob,
          interval: isNaN(srsInterval) ? 0 : srsInterval,
          ease: isNaN(srsEase) ? 2.5 : srsEase,
          repetitions: isNaN(srsRepetitions) ? 0 : srsRepetitions,
          lapses: isNaN(srsLapses) ? 0 : srsLapses,
          dueDate: srsDueDate || todayStr,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        cardsToInsert.push(card);
      }

      if (cardsToInsert.length > 0) {
        await db.cards.bulkAdd(cardsToInsert);
        alert(`Sucesso: ${cardsToInsert.length} cartões importados!`);
      } else {
        alert('Nenhum cartão válido encontrado para importar.');
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro na importação: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // --- ARQUIVO BACKUP JSON ---
  const handleJsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  // --- RESTAURAR BACKUP JSON ---
  const executeJsonRestore = async () => {
    if (!jsonContent) return;
    try {
      setIsImporting(true);
      const backup = JSON.parse(jsonContent);

      if (!backup.decks || !backup.cards) {
        throw new Error('Formato inválido. Chaves "decks" e "cards" são necessárias.');
      }

      // Adiciona decks
      for (const deck of backup.decks) {
        const exists = await db.decks.get(deck.id);
        if (exists) {
          await db.decks.put(deck);
        } else {
          await db.decks.add(deck);
        }
      }

      // Adiciona cards (convertendo Base64 de volta para Blob)
      for (const card of backup.cards) {
        let audioBlob: Blob | undefined = undefined;
        if (card.audioBase64) {
          const res = await fetch(card.audioBase64);
          audioBlob = await res.blob();
        }

        const cardData: Card = {
          id: card.id,
          deckId: card.deckId,
          front: card.front,
          back: card.back,
          context: card.context || '',
          audio: audioBlob,
          interval: typeof card.interval === 'number' ? card.interval : 0,
          ease: typeof card.ease === 'number' ? card.ease : 2.5,
          repetitions: typeof card.repetitions === 'number' ? card.repetitions : 0,
          lapses: typeof card.lapses === 'number' ? card.lapses : 0,
          dueDate: card.dueDate,
          createdAt: card.createdAt || Date.now(),
          updatedAt: card.updatedAt || Date.now()
        };

        const exists = await db.cards.get(card.id);
        if (exists) {
          await db.cards.put(cardData);
        } else {
          await db.cards.add(cardData);
        }
      }

      // Opcional: Adiciona histórico de revisões
      if (backup.revisions) {
        for (const rev of backup.revisions) {
          const exists = await db.revisions.get(rev.id);
          if (!exists) {
            await db.revisions.add(rev);
          }
        }
      }

      alert('Backup completo restaurado com sucesso!');
      onClose();
      window.location.reload(); // Recarrega para atualizar reativamente as live queries do app
    } catch (err: any) {
      console.error(err);
      alert('Erro ao restaurar backup: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const previewRows = parsedData.slice(0, 5);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm sm:max-w-2xl rounded-lg p-5">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="font-semibold text-lg text-foreground flex items-center gap-2">
            📥 Importar Dados & Backups
          </DialogTitle>
        </DialogHeader>

        {/* Abas */}
        <div className="flex gap-2 border-b border-border/60 pb-2">
          <Button
            type="button"
            variant="ghost"
            className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
              activeTab === 'csv' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('csv')}
          >
            Planilha CSV / Anki (TXT, APKG)
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
              activeTab === 'json' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            }`}
            onClick={() => setActiveTab('json')}
          >
            Restaurar Backup (.json)
          </Button>
        </div>

        {/* CONTEÚDO DA ABA CSV/TXT */}
        {activeTab === 'csv' && (
          <form onSubmit={executeCSVImport} className="flex flex-col gap-4 mt-3">
            {/* Escolha do Arquivo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Selecionar Arquivo (.csv, .txt, .apkg)</label>
              <label
                htmlFor="csv-file-upload"
                className="flex flex-col items-center justify-center p-5 border border-border border-dashed rounded-xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-muted-foreground hover:text-foreground text-center"
              >
                <Upload size={22} className="mb-1 text-muted-foreground/80" />
                <span className="text-xs font-bold">{fileName ? fileName : 'Clique para selecionar o arquivo'}</span>
                <span className="text-[9px] opacity-70 mt-0.5">CSV, TXT do Anki ou pacotes de decks compactados (.apkg) com áudios</span>
              </label>
              <input
                id="csv-file-upload"
                type="file"
                accept=".csv,.txt,.apkg"
                className="hidden"
                onChange={handleFileChange}
                required
              />
            </div>

            {parsedData.length > 0 && (
              <>
                {/* Visualização de Pré-visualização do Arquivo */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-muted-foreground">Amostra de Linhas ({parsedData.length} identificadas)</span>
                  <div className="overflow-x-auto border border-border rounded-lg max-h-28 text-[10px] bg-background">
                    <table className="w-full border-collapse divide-y divide-border text-left">
                      <thead className="bg-muted/40">
                        <tr>
                          {parsedData[0].map((_, idx) => (
                            <th key={idx} className="p-1.5 font-bold border-r border-border/50">Col {idx}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {previewRows.map((row, rIdx) => (
                          <tr key={rIdx} className={rIdx === 0 && skipHeader && !isApkg ? 'opacity-40 italic' : ''}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-1.5 truncate max-w-[120px] border-r border-border/50">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!isApkg && (
                    <div className="flex items-center gap-1.5">
                      <input
                        id="skip-header-check"
                        type="checkbox"
                        className="w-3.5 h-3.5 accent-primary cursor-pointer"
                        checked={skipHeader}
                        onChange={(e) => setSkipHeader(e.target.checked)}
                      />
                      <label htmlFor="skip-header-check" className="text-[10px] text-muted-foreground font-semibold cursor-pointer">
                        Ignorar primeira linha (Cabeçalho da Planilha)
                      </label>
                    </div>
                  )}
                </div>

                {/* Destino da Importação (Anexar ou Criar Novo) */}
                <div className="space-y-3.5">
                  <label className="text-xs font-bold text-muted-foreground block">
                    Onde deseja salvar os cartões?
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opção Criar Novo Baralho */}
                    <button
                      type="button"
                      onClick={() => setImportDestinationMode('create')}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                        importDestinationMode === 'create'
                          ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                          : 'border-border bg-background hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        importDestinationMode === 'create' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Plus size={16} />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold block text-foreground">Criar novo baralho</span>
                        <span className="text-[10px] leading-snug block text-muted-foreground">
                          Cria um baralho novo com o nome do arquivo ou conteúdo.
                        </span>
                      </div>
                    </button>

                    {/* Opção Anexar a Existente */}
                    <button
                      type="button"
                      disabled={!decks || decks.length === 0}
                      onClick={() => setImportDestinationMode('append')}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        importDestinationMode === 'append'
                          ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                          : 'border-border bg-background hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        importDestinationMode === 'append' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Layers size={16} />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold block text-foreground">Anexar a baralho existente</span>
                        <span className="text-[10px] leading-snug block text-muted-foreground">
                          Adiciona os cartões importados a um baralho existente.
                        </span>
                      </div>
                    </button>
                  </div>

                  {importDestinationMode === 'create' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-muted-foreground">Nome do Novo Baralho *</label>
                        <Input
                          type="text"
                          placeholder="Nome do baralho..."
                          className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary text-xs h-9"
                          value={newDeckName}
                          onChange={(e) => setNewDeckName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-muted-foreground">Descrição (Opcional)</label>
                        <Input
                          type="text"
                          placeholder="Descrição do baralho..."
                          className="bg-background border-border text-foreground focus-visible:ring-primary focus-visible:border-primary text-xs h-9"
                          value={newDeckDesc}
                          onChange={(e) => setNewDeckDesc(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="text-xs font-bold text-muted-foreground">Selecionar Baralho Existente *</label>
                      <select
                        className="bg-background border border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer focus:border-primary w-full h-9"
                        value={selectedDeckId}
                        onChange={(e) => setSelectedDeckId(e.target.value)}
                        required
                      >
                        {decks.map(deck => (
                          <option key={deck.id} value={deck.id}>{deck.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Mapeamento de Colunas */}
                <div className="space-y-2 border border-border/80 p-3.5 rounded-xl bg-muted/10">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    🛠️ Mapeamento de Campos
                  </h4>
                  <p className="text-[10px] text-muted-foreground">Indique em qual coluna da sua planilha está cada informação:</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground">Frente (Inglês) *</span>
                      <select
                        className="bg-background border border-border text-foreground px-2 py-1 rounded text-[10px] outline-none cursor-pointer focus:border-primary"
                        value={colMappings.front}
                        onChange={(e) => setColMappings(prev => ({ ...prev, front: parseInt(e.target.value, 10) }))}
                      >
                        {parsedData[0].map((_, idx) => (
                          <option key={idx} value={idx}>Coluna {idx}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground">Verso (Tradução) *</span>
                      <select
                        className="bg-background border border-border text-foreground px-2 py-1 rounded text-[10px] outline-none cursor-pointer focus:border-primary"
                        value={colMappings.back}
                        onChange={(e) => setColMappings(prev => ({ ...prev, back: parseInt(e.target.value, 10) }))}
                      >
                        {parsedData[0].map((_, idx) => (
                          <option key={idx} value={idx}>Coluna {idx}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground">Contexto/Exemplo</span>
                      <select
                        className="bg-background border border-border text-foreground px-2 py-1 rounded text-[10px] outline-none cursor-pointer focus:border-primary"
                        value={colMappings.context}
                        onChange={(e) => setColMappings(prev => ({ ...prev, context: parseInt(e.target.value, 10) }))}
                      >
                        <option value="-1">[Nenhuma / Em Branco]</option>
                        {parsedData[0].map((_, idx) => (
                          <option key={idx} value={idx}>Coluna {idx}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Agendamento SRS do Anki */}
                  <div className="pt-2 border-t border-border/40 mt-2 space-y-2">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                      Agendamento & Progresso (Anki)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Intervalo</span>
                        <select
                          className="bg-background border border-border text-foreground px-1.5 py-0.5 rounded text-[9px] outline-none cursor-pointer"
                          value={colMappings.interval}
                          onChange={(e) => setColMappings(prev => ({ ...prev, interval: parseInt(e.target.value, 10) }))}
                        >
                          <option value="-1">[Padrão (Novo)]</option>
                          {parsedData[0].map((_, idx) => (
                            <option key={idx} value={idx}>Coluna {idx}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Facilidade (Ease)</span>
                        <select
                          className="bg-background border border-border text-foreground px-1.5 py-0.5 rounded text-[9px] outline-none cursor-pointer"
                          value={colMappings.ease}
                          onChange={(e) => setColMappings(prev => ({ ...prev, ease: parseInt(e.target.value, 10) }))}
                        >
                          <option value="-1">[Padrão (2.5)]</option>
                          {parsedData[0].map((_, idx) => (
                            <option key={idx} value={idx}>Coluna {idx}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Repetições</span>
                        <select
                          className="bg-background border border-border text-foreground px-1.5 py-0.5 rounded text-[9px] outline-none cursor-pointer"
                          value={colMappings.repetitions}
                          onChange={(e) => setColMappings(prev => ({ ...prev, repetitions: parseInt(e.target.value, 10) }))}
                        >
                          <option value="-1">[Padrão (0)]</option>
                          {parsedData[0].map((_, idx) => (
                            <option key={idx} value={idx}>Coluna {idx}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Vencimento (Due)</span>
                        <select
                          className="bg-background border border-border text-foreground px-1.5 py-0.5 rounded text-[9px] outline-none cursor-pointer"
                          value={colMappings.dueDate}
                          onChange={(e) => setColMappings(prev => ({ ...prev, dueDate: parseInt(e.target.value, 10) }))}
                        >
                          <option value="-1">[Padrão (Hoje)]</option>
                          {parsedData[0].map((_, idx) => (
                            <option key={idx} value={idx}>Coluna {idx}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="flex flex-row gap-2 sm:justify-end border-t border-border/50 pt-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-initial border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs h-9 px-4 rounded-xl"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer text-xs h-9 px-4 rounded-xl font-bold disabled:opacity-50"
                disabled={isImporting || parsedData.length === 0}
              >
                {isImporting ? 'Importando...' : 'Iniciar Importação'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* CONTEÚDO DA ABA JSON BACKUP */}
        {activeTab === 'json' && (
          <div className="flex flex-col gap-4 mt-3">
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5 text-xs">
                <span className="font-bold">Aviso de Restauração</span>
                <p className="leading-relaxed font-medium">Restaurar um backup de sistema irá sobrescrever decks e cartões locais que possuam o mesmo ID de identificação.</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Arquivo de Backup do Memorize (.json)</label>
              <label
                htmlFor="json-file-upload"
                className="flex flex-col items-center justify-center p-5 border border-border border-dashed rounded-xl bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-muted-foreground hover:text-foreground text-center"
              >
                <Upload size={22} className="mb-1 text-muted-foreground/80" />
                <span className="text-xs font-bold">{jsonFileName ? jsonFileName : 'Clique para selecionar o backup'}</span>
                <span className="text-[9px] opacity-70 mt-0.5">Selecione arquivos JSON exportados por este aplicativo</span>
              </label>
              <input
                id="json-file-upload"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleJsonChange}
              />
            </div>

            <DialogFooter className="flex flex-row gap-2 sm:justify-end border-t border-border/50 pt-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-initial border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs h-9 px-4 rounded-xl"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer text-xs h-9 px-4 rounded-xl font-bold disabled:opacity-50"
                onClick={executeJsonRestore}
                disabled={isImporting || !jsonContent}
              >
                {isImporting ? 'Restaurando...' : 'Restaurar Backup'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
