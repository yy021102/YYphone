import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already in standalone mode, show friendly installed badge or hide
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
        <Check className="w-3.5 h-3.5" />
        <span>已作为 PWA 原生应用运行</span>
      </div>
    );
  }

  return (
    <>
      {/* Chromium / Android install */}
      {isInstallable && (
        <button
          onClick={install}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>安装为原生桌面 App</span>
        </button>
      )}

      {/* iOS Safari Guide Button */}
      {isIOS && !isInstallable && (
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <Share className="w-3.5 h-3.5" />
          <span>添加到主屏幕 (iOS)</span>
        </button>
      )}

      {/* Fallback button for testing / other browsers */}
      {!isInstallable && !isIOS && (
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>添加到主屏幕指南</span>
        </button>
      )}

      {/* Modal Guide for iOS or Generic Add to Homescreen */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-white/60 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#2C4A5C]">
                  添加到手机主屏幕
                </h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-200 text-sky-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  在手机浏览器（Safari 或 Chrome）中点击底部的<strong>『分享』</strong>或右上角<strong>『菜单 (⋮)』</strong>按钮。
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-200 text-sky-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  在弹出菜单中向下滑动，找到并轻触<strong>『添加到主屏幕』</strong>。
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-200 text-sky-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  点击右上角<strong>『添加』</strong>，即可在桌面拥有免浏览器地址栏、全屏运行的真机体验！
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-xs active:scale-95"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
};
