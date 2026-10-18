import React, { useState } from 'react';
import { Flashlight, Camera, Lock, Delete, ChevronUp } from 'lucide-react';
import type { LockScreenAppearance } from '../types';
import { DEFAULT_LOCK_APPEARANCE } from '../utils/lockAppearance';

interface LockScreenProps {
  onUnlock: () => void;
  timeString: string;
  dateString: string;
  wallpaperStyle: string;
  wallpaperImage?: string;
  password?: string;
  appearance?: LockScreenAppearance;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  onUnlock,
  timeString,
  dateString,
  wallpaperStyle,
  wallpaperImage,
  password,
  appearance = DEFAULT_LOCK_APPEARANCE,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [pin, setPin] = useState<string>('');
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        if (password && nextPin === password) {
          setTimeout(onUnlock, 200);
        } else {
          setPasswordError('密码错误，请重试。');
          setTimeout(() => {
            setPin('');
            setPasswordError('');
          }, 700);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div
      className="relative w-full h-full min-h-0 flex flex-col justify-between p-6 select-none overflow-hidden transition-all duration-500"
      style={{
        color: appearance.textColor,
        ...(wallpaperImage
          ? {
              backgroundImage: `url("${wallpaperImage}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { background: wallpaperStyle }),
      }}
    >
      {/* Subtle background ambient overlays */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px] pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-pink-200/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-sky-200/50 blur-3xl pointer-events-none" />

      {/* Main Lock Screen content */}
      {!showKeypad ? (
        <div className="relative z-10 flex flex-col items-center h-full justify-between         pt-[max(env(safe-area-inset-top,0px),32px)] pb-4">          {/* Top section: Lock indicator, Time, Date */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white/40 backdrop-blur-md border border-white/60 flex items-center justify-center text-current mb-3 shadow-sm">
              <Lock className="w-4 h-4 stroke-[2.2]" />
            </div>
            <p className="text-sm font-medium text-current opacity-80 tracking-wide mb-1">
              {dateString}
            </p>
            <h1 className="text-6xl font-bold tracking-tight text-current font-mono tabular-nums drop-shadow-sm">
              {timeString}
            </h1>
            <p className="text-xs text-current opacity-70 mt-2 font-medium whitespace-pre-wrap break-words max-w-full text-center">
              {appearance.subtitle}
            </p>
          </div>

          {/* Bottom section: Unlock swipe button & Utility controls */}
          <div className="w-full flex flex-col items-center gap-6">
            <button
              onClick={() => (password ? setShowKeypad(true) : onUnlock())}
              className="flex flex-col items-center gap-1.5 text-xs font-semibold text-current active:scale-95 transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-md flex items-center justify-center border border-white/70 shadow-sm group-hover:bg-white/80 transition-all">
                <ChevronUp className="w-4 h-4 animate-bounce text-current" />
              </div>
              <span className="text-[12px] tracking-wide">
                {password ? '轻触或上滑解锁' : '轻触进入主屏'}
              </span>
            </button>

            {/* Quick action buttons */}
            <div className="w-full flex items-center justify-between px-3">
              <button
                onClick={() => setFlashlightOn(!flashlightOn)}
                title="手电筒"
                className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border border-white/70 shadow-sm transition-all active:scale-90 ${
                  flashlightOn
                    ? 'bg-amber-300/90 text-amber-900 shadow-[0_0_15px_rgba(252,211,77,0.7)]'
                    : 'bg-white/40 text-current hover:bg-white/60'
                }`}
              >
                <Flashlight className="w-5 h-5 stroke-[2]" />
              </button>

              <button
                onClick={() => (password ? setShowKeypad(true) : onUnlock())}
                title="相机"
                className="w-12 h-12 rounded-full bg-white/40 hover:bg-white/60 backdrop-blur-xl border border-white/70 flex items-center justify-center text-current shadow-sm transition-all active:scale-90"
              >
                <Camera className="w-5 h-5 stroke-[2]" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Keypad Unlock Overlay */
        <div className="relative z-10 flex flex-col items-center justify-between h-full pt-[max(env(safe-area-inset-top,0px),32px)] pb-4 animate-fadeIn">
          {/* Top Keypad Header */}
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md border border-white/70 flex items-center justify-center text-current mb-3 shadow-sm">
              <Lock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <h2 className="text-base font-bold text-current tracking-tight">
              输入密码
            </h2>
            {/* PIN indicators */}
            <div className="flex items-center gap-3 mt-6">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                    pin.length > idx
                      ? 'bg-current border-current scale-110 shadow-sm'
                      : 'bg-white/40 border-slate-400/50'
                  }`}
                />
              ))}
            </div>
            {passwordError && (
              <p role="alert" className="text-xs text-rose-700 font-semibold">
                {passwordError}
              </p>
            )}
          </div>

          {/* Numeric Keypad Grid */}
          <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-[clamp(8px,2vh,16px)] gap-x-5 my-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleKeyPress(digit)}
                className="w-[clamp(50px,13vw,62px)] h-[clamp(50px,13vw,62px)] mx-auto rounded-full bg-white/45 hover:bg-white/70 active:bg-white/90 active:scale-90 border border-white/70 backdrop-blur-xl flex flex-col items-center justify-center text-current font-semibold text-lg shadow-sm transition-all"
              >
                <span>{digit}</span>
              </button>
            ))}
            <div className="flex items-center justify-center">
              <button
                onClick={() => setShowKeypad(false)}
                className="text-xs font-semibold text-current py-2 px-3 rounded-full hover:bg-white/30 transition-colors"
              >
                取消
              </button>
            </div>
            <button
              onClick={() => handleKeyPress('0')}
              className="w-[clamp(50px,13vw,62px)] h-[clamp(50px,13vw,62px)] mx-auto rounded-full bg-white/45 hover:bg-white/70 active:bg-white/90 active:scale-90 border border-white/70 backdrop-blur-xl flex flex-col items-center justify-center text-current font-semibold text-lg shadow-sm transition-all"
            >
              <span>0</span>
            </button>
            <div className="flex items-center justify-center">
              {pin.length > 0 ? (
                <button
                  onClick={handleDelete}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-current hover:bg-white/40 active:scale-90 transition-all"
                >
                  <Delete className="w-5 h-5 stroke-[2]" />
                </button>
              ) : <span className="w-11 h-11" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
