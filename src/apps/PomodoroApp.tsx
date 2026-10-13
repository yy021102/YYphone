import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee, Sparkles, CheckCircle2 } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';

interface PomodoroAppProps {
  onBack: () => void;
}

export const PomodoroApp: React.FC<PomodoroAppProps> = ({ onBack }) => {
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(3);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      setCompletedSessions((prev) => prev + 1);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const handleSelectMinutes = (mins: number) => {
    setIsRunning(false);
    setSelectedMinutes(mins);
    setTimeLeft(mins * 60);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(selectedMinutes * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progressPercent = ((selectedMinutes * 60 - timeLeft) / (selectedMinutes * 60)) * 100;

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F7FA] overflow-hidden">
      <AppHeader
        title="番茄钟 · 沉浸专注"
        subtitle="远离干扰 · 呼吸与思考"
        onBack={onBack}
      />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 flex flex-col items-center justify-between pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* Preset Selector */}
        <div className="w-full flex justify-center gap-2">
          {[
            { mins: 25, label: '标准专注 25m' },
            { mins: 15, label: '轻量冲刺 15m' },
            { mins: 5, label: '短时休息 5m' },
          ].map(({ mins, label }) => (
            <button
              key={mins}
              onClick={() => handleSelectMinutes(mins)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedMinutes === mins
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-white/60 text-slate-600 hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Big Circular Focus Dial */}
        <div className="relative w-64 h-64 my-6 flex items-center justify-center">
          {/* Outer circle progress track */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              className="text-white/80"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              className="text-rose-400 transition-all duration-500"
              strokeWidth="6"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - progressPercent / 100)}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          {/* Inner glass dial */}
          <div className="absolute inset-4 rounded-full glass-card flex flex-col items-center justify-center shadow-lg">
            <span className="text-4xl font-extrabold text-[#2C4A5C] font-mono tabular-nums tracking-tight">
              {timeFormatted}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 font-medium">
              {isRunning ? '专注中，保持心境平和' : '点击下方开始'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleReset}
            title="重置计时"
            className="w-12 h-12 rounded-full glass-card flex items-center justify-center text-slate-600 hover:text-slate-900 active:scale-90 transition-all cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-8 py-3.5 rounded-full flex items-center gap-2 font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
              isRunning
                ? 'bg-amber-500 text-white shadow-amber-500/20'
                : 'bg-rose-500 text-white shadow-rose-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-white" />
                <span>暂停</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>开始专注</span>
              </>
            )}
          </button>
        </div>

        {/* Focus Stats Card */}
        <div className="w-full glass-card rounded-2xl p-3.5 mt-3 flex items-center justify-around">
          <div className="text-center">
            <span className="text-[10px] text-slate-400 font-medium">今日已完成</span>
            <p className="text-base font-bold text-rose-600 font-mono">
              {completedSessions} 个番茄钟
            </p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-center">
            <span className="text-[10px] text-slate-400 font-medium">今日累计专注</span>
            <p className="text-base font-bold text-[#2C4A5C] font-mono">
              {completedSessions * 25} 分钟
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
