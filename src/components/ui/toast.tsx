import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'error',
  onClose,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgClass =
    type === 'error'
      ? 'bg-destructive text-destructive-foreground border-destructive/25'
      : type === 'success'
      ? 'bg-emerald-600 text-white border-emerald-500/25'
      : 'bg-primary text-primary-foreground border-primary/25';

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl transition-all duration-300 ${bgClass} max-w-sm`}>
      {type === 'error' && <AlertCircle size={18} className="flex-shrink-0" />}
      {type === 'success' && <CheckCircle2 size={18} className="flex-shrink-0" />}
      <span className="text-xs font-bold leading-normal">{message}</span>
      <button
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-white/10 transition-colors ml-auto cursor-pointer flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};
