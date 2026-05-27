import React, { useState, useEffect } from 'react';
import { FileJson, Database, CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { db } from '../db/db';
import { exportDeckToApkg } from '../utils/apkgExporter';
import type { Deck } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckId: string | null;
  onExportJson: (deckId: string) => Promise<void>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  deckId,
  onExportJson
}) => {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [exportComplete, setExportComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && deckId) {
      db.decks.get(deckId).then(d => {
        setDeck(d || null);
      }).catch(err => {
        console.error(err);
      });
      setIsExporting(false);
      setProgressMessage('');
      setExportComplete(false);
      setErrorMsg('');
    }
  }, [isOpen, deckId]);

  if (!deckId || !deck) return null;

  const handleExportJsonClick = async () => {
    setIsExporting(true);
    setProgressMessage('Gerando backup JSON...');
    try {
      await onExportJson(deckId);
      setExportComplete(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao exportar JSON.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportApkgClick = async () => {
    setIsExporting(true);
    setProgressMessage('Carregando dados...');
    setErrorMsg('');
    try {
      // 1. Carregar notas do Dexie
      const notes = await db.notes.where('deckId').equals(deckId).toArray();

      // 2. Carregar cartões do Dexie
      const cards = await db.cards.where('deckId').equals(deckId).toArray();

      // 3. Carregar revisões dos cartões
      const cardIds = cards.map(c => c.id);
      const revisions = await db.revisions
        .filter(r => cardIds.includes(r.cardId))
        .toArray();

      // 4. Executar exportação
      const apkgBlob = await exportDeckToApkg(
        deck,
        notes,
        cards,
        revisions,
        (msg) => setProgressMessage(msg)
      );

      // 5. Iniciar download
      const url = URL.createObjectURL(apkgBlob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = deck.name.replace(/[\\/:*?"<>|]/g, '').trim() || 'deck';
      link.download = `${safeName}.apkg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportComplete(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao gerar pacote .apkg.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isExporting && !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border text-foreground rounded-2xl shadow-xl p-5 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-md font-extrabold flex items-center gap-2">
            📥 Exportar Baralho
          </DialogTitle>
        </DialogHeader>

        {/* ESTADO DE CONCLUÍDO */}
        {exportComplete ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <CheckCircle size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">Exportação Concluída!</h4>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                O arquivo contendo o baralho <strong>{deck.name}</strong> foi gerado e baixado no seu navegador.
              </p>
            </div>
            <DialogFooter className="w-full pt-4">
              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer text-xs h-9 rounded-xl"
                onClick={onClose}
              >
                Fechar Janela
              </Button>
            </DialogFooter>
          </div>
        ) : isExporting ? (
          /* ESTADO DE EXPORTANDO */
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <Loader2 size={36} className="text-primary animate-spin" />
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aguarde um momento</h4>
              <p className="text-xs font-semibold text-foreground animate-pulse">
                {progressMessage}
              </p>
            </div>
          </div>
        ) : (
          /* ESTADO DE SELEÇÃO DE FORMATO */
          <div className="flex flex-col gap-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Selecione o formato de arquivo desejado para exportar o baralho <strong>{deck.name}</strong>:
            </p>

            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold rounded-xl">
                ❌ {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {/* Opção APKG */}
              <button
                type="button"
                className="flex items-start gap-4 p-4 border border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 rounded-2xl text-left cursor-pointer transition-all group"
                onClick={handleExportApkgClick}
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center transition-colors group-hover:bg-blue-500/20">
                  <Database size={20} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                    Pacote do Anki (.apkg)
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 shrink-0">
                      Recomendado
                    </span>
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Total compatibilidade. Exporta notas, cartões reversos, clozes, áudios gravados e todo o <strong>histórico de revisões e progresso</strong>.
                  </p>
                </div>
              </button>

              {/* Opção JSON */}
              <button
                type="button"
                className="flex items-start gap-4 p-4 border border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-primary/5 rounded-2xl text-left cursor-pointer transition-all group"
                onClick={handleExportJsonClick}
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center transition-colors group-hover:bg-emerald-500/20">
                  <FileJson size={20} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-foreground">
                    Backup do Memorize (.json)
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ideal para backups locais simples do aplicativo. Salva cartões e áudios, mas o arquivo JSON não pode ser aberto pelo Anki oficial.
                  </p>
                </div>
              </button>
            </div>

            <DialogFooter className="border-t border-border/50 pt-3 flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer text-xs h-9 px-4 rounded-xl"
                onClick={onClose}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
