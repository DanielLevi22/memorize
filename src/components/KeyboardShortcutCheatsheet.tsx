import React, { useState } from 'react';
import { Keyboard, X } from 'lucide-react';

export interface ShortcutItem {
  keys: string[];
  description: string;
}

interface KeyboardShortcutCheatsheetProps {
  shortcuts: ShortcutItem[];
  positionClassName?: string;
}

export const KeyboardShortcutCheatsheet: React.FC<KeyboardShortcutCheatsheetProps> = ({
  shortcuts,
  positionClassName = "fixed bottom-20 right-4"
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`${positionClassName} z-50 flex flex-col items-end gap-2`}>
      {isOpen && (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-xl w-64 animate-in fade-in slide-in-from-bottom-5 duration-200 text-foreground">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Keyboard size={12} /> Atalhos de Teclado
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer rounded-lg p-0.5 hover:bg-muted transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {shortcuts.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] gap-3">
                <span className="text-muted-foreground leading-snug">{item.description}</span>
                <div className="flex gap-0.5 flex-wrap justify-end">
                  {item.keys.map((k, kIdx) => (
                    <React.Fragment key={kIdx}>
                      {kIdx > 0 && <span className="text-muted-foreground/50 self-center text-[9px]">ou</span>}
                      <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[9px] font-black shadow-sm text-foreground">
                        {k}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 rounded-full shadow-lg border cursor-pointer flex items-center justify-center transition-all duration-200 hover:scale-105 ${
          isOpen
            ? 'bg-primary text-primary-foreground border-primary shadow-primary/20'
            : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border'
        }`}
        title="Atalhos de teclado"
      >
        <Keyboard size={16} />
      </button>
    </div>
  );
};
