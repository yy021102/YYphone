/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppId } from './types';
import {
  INITIAL_USER_PROFILE,
  MAIN_GRID_APPS,
  DOCK_APPS,
  THEMES,
  WALLPAPERS,
} from './data/mockData';
import { StatusBar } from './components/StatusBar';
import { LockScreen } from './components/LockScreen';
import { HomeScreen } from './components/HomeScreen';

// App Components
import { WeChatApp } from './apps/WeChatApp';
import { PhoneExplorerApp } from './apps/PhoneExplorerApp';
import { AlipayApp } from './apps/AlipayApp';
import { TaobaoApp } from './apps/TaobaoApp';
import { ForumApp } from './apps/ForumApp';
import { PomodoroApp } from './apps/PomodoroApp';
import { OfflineModeApp } from './apps/OfflineModeApp';
import { CoupleSpaceApp } from './apps/CoupleSpaceApp';
import { SettingsApp } from './apps/SettingsApp';
import { ThemeCustomizerApp } from './apps/ThemeCustomizerApp';
import { WorldBookApp } from './apps/WorldBookApp';
import { MemoryApp } from './apps/MemoryApp';

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [showStatusBar, setShowStatusBar] = useState(true);

  // Theme & Wallpaper State
  const [activeThemeId, setActiveThemeId] = useState('ocean-dawn');
  const [activeWallpaperId, setActiveWallpaperId] = useState('dreamy-sky');

  // Clock
  const [timeString, setTimeString] = useState('09:41');
  const [dateString, setDateString] = useState('10月13日 星期二');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setTimeString(`${hours}:${minutes}`);

      const month = now.getMonth() + 1;
      const day = now.getDate();
      const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const weekDay = weekDays[now.getDay()];
      setDateString(`${month}月${day}日 ${weekDay}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTheme = THEMES.find((t) => t.id === activeThemeId) || THEMES[0];
  const currentWallpaper =
    WALLPAPERS.find((w) => w.id === activeWallpaperId) || WALLPAPERS[0];

  const handleOpenApp = (appId: AppId) => {
    setActiveApp(appId);
  };

  const handleBackToHome = () => {
    setActiveApp(null);
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleLock = () => {
    setIsLocked(true);
    setActiveApp(null);
  };

  return (
    <div className="w-full h-full min-h-[100dvh] bg-[#DFF1FA] md:bg-[#080D14] flex items-center justify-center p-0 md:p-3 overflow-hidden select-none">
      {/* 
        Phone Canvas Container:
        - Exact height: 100dvh (dynamic viewport height) on mobile devices
        - Gradient background bleeds 100% to the absolute top and bottom (no black gaps)
        - pt: env(safe-area-inset-top) keeps status bar & sub-page back buttons safely below notch/island
        - pb: env(safe-area-inset-bottom) keeps dock above iPhone Home indicator bar
      */}
      <div
        className={`w-full md:w-[min(412px,calc(93dvh*9/19.5))] h-[100dvh] md:h-[min(850px,93dvh)] md:rounded-[44px] overflow-hidden relative flex flex-col shadow-[0_25px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.14)] transition-all ${
          activeApp
            ? 'p-0'
            : 'pt-[max(env(safe-area-inset-top,0px),0px)] pb-0'
        }`}
        style={{
          background: `linear-gradient(180deg, #DFF1FA 0%, #FFFFFF 65%, #FAD4E0 100%)`,
        }}
      >
        {/* Dynamic theme backdrop wash */}
        <div
          className={`absolute inset-0 bg-gradient-to-b ${currentTheme.gradient} opacity-90 pointer-events-none transition-all duration-700`}
        />

        {/* Ambient aesthetic glow patches */}
        <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#DFF1FA] blur-3xl pointer-events-none opacity-70" />
        <div className="absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-[#FAD4E0] blur-3xl pointer-events-none opacity-50" />
        <div className="absolute -bottom-32 right-0 w-80 h-80 rounded-full bg-[#DFF1FA] blur-3xl pointer-events-none opacity-60" />

        {/* Top Status Bar (Only on Desktop / Lockscreen or when enabled, with safe top breathing space) */}
        {showStatusBar && !activeApp && (
          <div className="relative z-40 pt-1 shrink-0">
            <StatusBar
              time={timeString}
              isLocked={isLocked}
              onLockClick={isLocked ? undefined : handleLock}
            />
          </div>
        )}

        {/* Screen View Body (Strict flex-1 & min-h-0, overflow-hidden) */}
        <div className="flex-1 min-h-0 w-full relative overflow-hidden flex flex-col z-20">
          {isLocked ? (
            /* Lock Screen */
            <LockScreen
              onUnlock={handleUnlock}
              timeString={timeString}
              dateString={dateString}
              wallpaperStyle={currentWallpaper.style}
            />
          ) : activeApp ? (
            /* Active Sub-App View: Header is safely padded below the notch, back arrow always clickable */
            <div className="w-full h-full flex flex-col overflow-hidden animate-fadeIn">
              {activeApp === 'wechat' && <WeChatApp onBack={handleBackToHome} />}
              {activeApp === 'phone_explorer' && (
                <PhoneExplorerApp onBack={handleBackToHome} />
              )}
              {activeApp === 'alipay' && <AlipayApp onBack={handleBackToHome} />}
              {activeApp === 'taobao' && <TaobaoApp onBack={handleBackToHome} />}
              {activeApp === 'forum' && <ForumApp onBack={handleBackToHome} />}
              {activeApp === 'pomodoro' && <PomodoroApp onBack={handleBackToHome} />}
              {activeApp === 'offline_mode' && (
                <OfflineModeApp onBack={handleBackToHome} />
              )}
              {activeApp === 'couple_space' && (
                <CoupleSpaceApp onBack={handleBackToHome} />
              )}
              {activeApp === 'settings' && (
                <SettingsApp
                  onBack={handleBackToHome}
                  showStatusBar={showStatusBar}
                  onToggleStatusBar={() => setShowStatusBar(!showStatusBar)}
                  onLockScreen={handleLock}
                />
              )}
              {activeApp === 'customizer' && (
                <ThemeCustomizerApp
                  onBack={handleBackToHome}
                  activeThemeId={activeThemeId}
                  onSelectTheme={setActiveThemeId}
                  activeWallpaperId={activeWallpaperId}
                  onSelectWallpaper={setActiveWallpaperId}
                />
              )}
              {activeApp === 'world_book' && (
                <WorldBookApp onBack={handleBackToHome} />
              )}
              {activeApp === 'memory' && (
                <MemoryApp onBack={handleBackToHome} />
              )}
            </div>
          ) : (
            /* Desktop / Home Screen (Strictly fitted within 1 screen, never scrolls, square blocks) */
            <HomeScreen
              userProfile={INITIAL_USER_PROFILE}
              apps={MAIN_GRID_APPS}
              dockApps={DOCK_APPS}
              onOpenApp={handleOpenApp}
            />
          )}
        </div>
      </div>
    </div>
  );
}
