import React, { useState } from 'react';
import { Flashlight, Camera, Lock, Delete, Unlock, ChevronUp } from 'lucide-react';

interface LockScreenProps {
  onUnlock: () => void;
  timeString: string;
  dateString: string;
  wallpaperStyle: string;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  onUnlock,
  timeString,
  dateString,
  wallpaperStyle,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [pin, setPin] = useState<string>('');
  const [flashlightOn, setFlashlightOn] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Unlock immediately on 4 digits or let user click unlock
        setTimeout(() => {
          onUnlock();
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div
      className="relative w-full h-full flex flex-col justify-between p-6 select-none overflow-hidden transition-all duration-500"
      style={{ background: wallpaperStyle }}
    >
      {/* Subtle background ambient overlays */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-pink-200/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sky-200/50 blur-3xl pointer-events-none" />

      {/* Main Lock Screen content */}
      {!showKeypad ? (
        <div className="relative z-10 flex flex-col items-center h-full justify-between pt-8 pb-4">
          {/* Top section: Lock indicator, Time, Date */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center text-[#2C4A5C] mb-3 shadow-sm">
              <Lock className="w-4 h-4 stroke-[2.2]" />
            </div>
            <p className="text-sm font-medium text-[#2C4A5C]/80 tracking-wide mb-1">
              {dateString}
            </p>
            <h1 className="text-6xl font-bold tracking-tight text-[#2C4A5C] font-mono tabular-nums drop-shadow-sm">
              {timeString}
            </h1>
            <p className="text-xs text-[#2C4A5C]/70 mt-2 font-medium">
              丙午年 菊月 · 微风渐起
            </p>
          </div>

          {/* Middle section: Lockscreen Notification / Inspiration Widget */}
          <div className="w-full max-w-[340px] flex flex-col gap-3 my-auto">
            {/* Widget Card */}
            <div className="glass-card rounded-2xl p-3.5 flex items-start gap-3 transition-transform hover:scale-[1.02] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 to-teal-300 flex items-center justify-center text-white shrink-0 shadow-sm text-sm">
                🫧
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] text-[#2C4A5C]/80 mb-0.5">
                  <span className="font-semibold">微信 · 剧本研讨组</span>
                  <span className="text-[10px]">10分钟前</span>
                </div>
                <p className="text-xs text-[#2C4A5C] font-medium leading-relaxed truncate">
                  林汐：“今晚要不要一起来世界书整理NPC的背景设定？”
                </p>
              </div>
            </div>

            {/* Weather / Status Pill */}
            <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-2xl px-3.5 py-2 flex items-center justify-between text-xs text-[#2C4A5C]">
              <span className="flex items-center gap-1.5 font-medium">
                <span>🌤️ 22°C</span>
                <span className="text-slate-400">·</span>
                <span>轻度薄云</span>
              </span>
              <span className="text-[11px] text-[#2C4A5C]/75 bg-white/50 px-2 py-0.5 rounded-full font-mono">
                灵感充盈
              </span>
            </div>
          </div>

          {/* Bottom section: Unlock swipe button & Utility controls */}
          <div className="w-full flex flex-col items-center gap-6">
            <button
              onClick={() => setShowKeypad(true)}
              className="flex flex-col items-center gap-1.5 text-xs font-semibold text-[#2C4A5C]/85 hover:text-[#2C4A5C] active:scale-95 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-md flex items-center justify-center border border-white/70 shadow-sm group-hover:bg-white/80 transition-all">
                <ChevronUp className="w-4 h-4 animate-bounce text-[#2C4A5C]" />
              </div>
              <span className="text-[12px] tracking-wide">轻触或上滑解锁</span>
            </button>

            {/* Quick action buttons */}
            <div className="w-full flex items-center justify-between px-3">
              <button
                onClick={() => setFlashlightOn(!flashlightOn)}
                title="手电筒"
                className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border border-white/70 shadow-sm transition-all active:scale-90 ${
                  flashlightOn
                    ? 'bg-amber-300/90 text-amber-900 shadow-[0_0_15px_rgba(252,211,77,0.7)]'
                    : 'bg-white/40 text-[#2C4A5C] hover:bg-white/60'
                }`}
              >
                <Flashlight className="w-5 h-5 stroke-[2]" />
              </button>

              <button
                onClick={() => setShowKeypad(true)}
                title="相机"
                className="w-12 h-12 rounded-full bg-white/40 hover:bg-white/60 backdrop-blur-xl border border-white/70 flex items-center justify-center text-[#2C4A5C] shadow-sm transition-all active:scale-90"
              >
                <Camera className="w-5 h-5 stroke-[2]" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Keypad Unlock Overlay */
        <div className="relative z-10 flex flex-col items-center justify-between h-full pt-8 pb-4 animate-fadeIn">
          {/* Top Keypad Header */}
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md border border-white/70 flex items-center justify-center text-[#2C4A5C] mb-3 shadow-sm">
              <Lock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h2 className="text-base font-bold text-[#2C4A5C] tracking-tight">
              输入密码
            </h2>
            <p className="text-xs text-[#2C4A5C]/70 mt-1">
              可输入任意数字，或直接点击解锁
            </p>

            {/* PIN indicators */}
            <div className="flex items-center gap-3 mt-6">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                    pin.length > idx
                      ? 'bg-[#2C4A5C] border-[#2C4A5C] scale-110 shadow-sm'
                      : 'bg-white/40 border-slate-400/50'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Numeric Keypad Grid */}
          <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-[clamp(8px,2vh,16px)] gap-x-5 my-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleKeyPress(digit)}
                className="w-[clamp(50px,13vw,62px)] h-[clamp(50px,13vw,62px)] mx-auto rounded-full bg-white/45 hover:bg-white/70 active:bg-white/90 active:scale-90 border border-white/70 backdrop-blur-xl flex flex-col items-center justify-center text-[#2C4A5C] font-semibold text-lg shadow-sm transition-all"
              >
                <span>{digit}</span>
              </button>
            ))}
            <div className="flex items-center justify-center">
              <button
                onClick={() => setShowKeypad(false)}
                className="text-xs font-semibold text-[#2C4A5C]/80 hover:text-[#2C4A5C] py-2 px-3 rounded-full hover:bg-white/30 transition-colors"
              >
                取消
              </button>
            </div>
            <button
              onClick={() => handleKeyPress('0')}
              className="w-[clamp(50px,13vw,62px)] h-[clamp(50px,13vw,62px)] mx-auto rounded-full bg-white/45 hover:bg-white/70 active:bg-white/90 active:scale-90 border border-white/70 backdrop-blur-xl flex flex-col items-center justify-center text-[#2C4A5C] font-semibold text-lg shadow-sm transition-all"
            >
              <span>0</span>
            </button>
            <div className="flex items-center justify-center">
              {pin.length > 0 ? (
                <button
                  onClick={handleDelete}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[#2C4A5C] hover:bg-white/40 active:scale-90 transition-all"
                >
                  <Delete className="w-5 h-5 stroke-[2]" />
                </button>
              ) : (
                <button
                  onClick={onUnlock}
                  title="免密直接解锁"
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sky-700 hover:bg-white/40 active:scale-90 transition-all"
                >
                  <Unlock className="w-5 h-5 stroke-[2]" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Direct Unlock Button */}
          <div className="w-full flex justify-center pb-2 shrink-0">
            <button
              onClick={onUnlock}
              className="px-5 py-2 rounded-full bg-white/60 hover:bg-white/80 active:scale-95 border border-white/80 text-xs font-bold text-[#2C4A5C] backdrop-blur-md shadow-sm transition-all flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>直接进入主屏</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
