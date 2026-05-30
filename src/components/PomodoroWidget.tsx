import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, X, Target, Coffee, BrainCircuit, GripHorizontal, Clock } from 'lucide-react';
import { Button } from './ui/button';

interface PomodoroWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

type TimerMode = 'focus' | 'shortBreak' | 'longBreak' | 'alarm' | 'custom';

const MODES = {
  focus: { label: 'Foco', minutes: 25, icon: BrainCircuit, color: 'text-primary' },
  shortBreak: { label: 'Pausa Curta', minutes: 5, icon: Coffee, color: 'text-emerald-500' },
  longBreak: { label: 'Pausa Longa', minutes: 15, icon: Coffee, color: 'text-blue-500' },
  alarm: { label: 'Alvo/Alarme', minutes: 0, icon: Target, color: 'text-orange-500' },
  custom: { label: 'Livre', minutes: 10, icon: Clock, color: 'text-violet-500' }
};


export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(MODES['focus'].minutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [targetTimeStr, setTargetTimeStr] = useState(''); // HH:MM for alarm mode
  const [customMinutes, setCustomMinutes] = useState(10); // for custom mode
  
  const timerRef = useRef<number | null>(null);

  // Play a classic digital alarm sound using Web Audio API
  const playBell = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // Toca 3 conjuntos de 4 bipes rápidos
      const playBeep = (time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, time); // A5 (Agudo o suficiente para acordar)
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.setValueAtTime(0.3, time + 0.08);
        gain.gain.linearRampToValueAtTime(0, time + 0.1);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.1);
      };

      let startTime = ctx.currentTime;
      for (let i = 0; i < 3; i++) { // 3 blocos
        for (let j = 0; j < 4; j++) { // 4 bipes por bloco
          playBeep(startTime + (i * 0.8) + (j * 0.12));
        }
      }
    } catch (e) {
      console.error("Audio API error", e);
    }
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playBell();
            setIsRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handleModeChange = (m: TimerMode) => {
    setMode(m);
    setIsRunning(false);
    if (m === 'alarm') {
      setTimeLeft(0);
      setTargetTimeStr('');
    } else if (m === 'custom') {
      setTimeLeft(customMinutes * 60);
    } else {
      setTimeLeft(MODES[m].minutes * 60);
    }
  };

  const calculateAlarmTimeLeft = () => {
    if (!targetTimeStr) return 0;
    const [hours, minutes] = targetTimeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    
    // Se a hora alvo for menor que agora, assume-se amanhã? Ou bloqueia?
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    
    const diffSecs = Math.floor((target.getTime() - now.getTime()) / 1000);
    return diffSecs;
  };

  const toggleTimer = () => {
    if (mode === 'alarm') {
      if (!targetTimeStr) return;
      if (!isRunning && timeLeft === 0) {
        setTimeLeft(calculateAlarmTimeLeft());
      }
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    if (mode === 'alarm') {
      setTimeLeft(calculateAlarmTimeLeft());
    } else if (mode === 'custom') {
      setTimeLeft(customMinutes * 60);
    } else {
      setTimeLeft(MODES[mode].minutes * 60);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-50 w-[300px] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground font-black text-xs uppercase tracking-wider">
          <GripHorizontal size={14} className="opacity-50" />
          Pomodoro & Alarme
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Modes */}
        <div className="grid grid-cols-5 gap-1">
          {(Object.keys(MODES) as TimerMode[]).map(m => {
            const Icon = MODES[m].icon;
            return (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                  mode === m 
                  ? `bg-primary/10 border-primary/30 ${MODES[m].color}` 
                  : 'bg-muted/20 border-transparent text-muted-foreground hover:bg-muted/50'
                }`}
                title={MODES[m].label}
              >
                <Icon size={16} />
              </button>
            )
          })}
        </div>

        {/* Display */}
        <div className="flex flex-col items-center justify-center py-4 space-y-2">
          {mode === 'alarm' && !isRunning && timeLeft === 0 ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Estudar até às:</span>
              <input 
                type="time" 
                value={targetTimeStr}
                onChange={(e) => setTargetTimeStr(e.target.value)}
                className="bg-muted text-foreground font-black text-2xl px-4 py-2 rounded-xl outline-none border border-border focus:border-primary/50 text-center"
              />
            </div>
          ) : mode === 'custom' && !isRunning ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Quantos minutos?</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="1"
                  max="999"
                  value={customMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setCustomMinutes(val);
                    setTimeLeft(val * 60);
                  }}
                  className="bg-muted text-foreground font-black text-3xl w-24 px-2 py-1 rounded-xl outline-none border border-border focus:border-primary/50 text-center"
                />
                <span className="text-xs font-bold text-muted-foreground">min</span>
              </div>
            </div>
          ) : (
            <div className={`text-5xl font-black font-mono tracking-tighter ${timeLeft === 0 ? 'text-red-500 animate-pulse' : 'text-foreground'}`}>
              {formatTime(timeLeft)}
            </div>
          )}
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {MODES[mode].label}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 rounded-full border-border/60 hover:bg-muted"
            onClick={resetTimer}
            title="Zerar"
          >
            <Square size={16} className="fill-muted-foreground/30" />
          </Button>

          <Button 
            variant="default" 
            size="icon" 
            className="h-14 w-14 rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            onClick={toggleTimer}
            disabled={mode === 'alarm' && !targetTimeStr}
          >
            {isRunning ? <Pause size={24} className="fill-primary-foreground" /> : <Play size={24} className="fill-primary-foreground ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
