/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { AppId, BeautySettings, CustomWallpapers, UserProfile } from './types';
import {
  INITIAL_USER_PROFILE,
  MAIN_GRID_APPS,
  DOCK_APPS,
  THEMES,
  WALLPAPERS,
} from './data/mockData';
import { readSetting, saveSetting, SETTINGS_KEYS } from './utils/settings';
import { StatusBar } from './components/StatusBar';
import { LockScreen } from './components/LockScreen';
import { HomeScreen } from './components/HomeScreen';
import { processPomodoroDeadline } from './utils/pomodoroRuntime';
import { ErrorDialogHost } from './components/ErrorDialog';

const WeChatApp = lazy(() => import('./apps/WeChatApp').then((module) => ({ default: module.WeChatApp })));
const PhoneExplorerApp = lazy(() => import('./apps/PhoneExplorerApp').then((module) => ({ default: module.CheckPhoneApp })));
const AlipayApp = lazy(() => import('./apps/AlipayApp').then((module) => ({ default: module.AlipayApp })));
const TaobaoApp = lazy(() => import('./apps/TaobaoApp').then((module) => ({ default: module.TaobaoApp })));
const ForumApp = lazy(() => import('./apps/ForumApp').then((module) => ({ default: module.ForumApp })));
const PomodoroApp = lazy(() => import('./apps/PomodoroApp').then((module) => ({ default: module.PomodoroApp })));
const OfflineModeApp = lazy(() => import('./apps/OfflineModeApp').then((module) => ({ default: module.OfflineModeApp })));
const CoupleSpaceApp = lazy(() => import('./apps/CoupleSpaceApp').then((module) => ({ default: module.CoupleSpaceApp })));
const SettingsApp = lazy(() => import('./apps/SettingsApp').then((module) => ({ default: module.SettingsApp })));
const ThemeCustomizerApp = lazy(() => import('./apps/ThemeCustomizerApp').then((module) => ({ default: module.ThemeCustomizerApp })));
const WorldBookApp = lazy(() => import('./apps/WorldBookApp').then((module) => ({ default: module.WorldBookApp })));
const MemoryApp = lazy(() => import('./apps/MemoryApp').then((module) => ({ default: module.MemoryApp })));
const InventoryApp = lazy(() => import('./apps/InventoryApp').then((module) => ({ default: module.InventoryApp })));

type LockMode = 'none' | 'lock' | 'password';
interface LockSettings {
  mode: LockMode;
  password: string;
}

const DEFAULT_BEAUTY_SETTINGS: BeautySettings = {
  themeId: 'ocean-dawn',
  wallpaperId: 'dreamy-sky',
  wallpapers: {
    lockScreen: '',
    homeScreen: '',
  },
  appIcons: {},
};

const DEFAULT_LOCK_SETTINGS: LockSettings = { mode: 'none', password: '' };
const isLockSettings = (value: unknown): value is LockSettings => {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<LockSettings>;
  return (
    (settings.mode === 'none' || settings.mode === 'lock' || settings.mode === 'password') &&
    typeof settings.password === 'string' &&
    (settings.mode !== 'password' || /^\d{4}$/.test(settings.password))
  );
};

const isBeautySettings = (value: unknown): value is BeautySettings => {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<BeautySettings>;
  return (
    typeof settings.themeId === 'string' &&
    typeof settings.wallpaperId === 'string' &&
    !!settings.wallpapers &&
    typeof settings.wallpapers.lockScreen === 'string' &&
    typeof settings.wallpapers.homeScreen === 'string' &&
    !!settings.appIcons &&
    typeof settings.appIcons === 'object' &&
    Object.values(settings.appIcons).every((url) => typeof url === 'string')
  );
};

const isUserProfile = (value: unknown): value is UserProfile => {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<UserProfile>;
  return (
    typeof profile.name === 'string' &&
    typeof profile.handle === 'string' &&
    typeof profile.avatarSeed === 'string' &&
    typeof profile.signature === 'string' &&
    typeof profile.level === 'string' &&
    Array.isArray(profile.tags) &&
    typeof profile.battery === 'number' &&
    typeof profile.location === 'string' &&
    typeof profile.mood === 'string' &&
    !!profile.stats &&
    typeof profile.stats.friends === 'number' &&
    typeof profile.stats.moments === 'number' &&
    typeof profile.stats.notes === 'number' &&
    typeof profile.stats.coins === 'number' &&
    (profile.avatarUrl === undefined || typeof profile.avatarUrl === 'string') &&
    (profile.avatarFrameEnabled === undefined || typeof profile.avatarFrameEnabled === 'boolean') &&
    (profile.coverImageUrl === undefined || typeof profile.coverImageUrl === 'string')
  );
};

export default function App() {
  useEffect(() => {
    const checkPomodoroDeadline = () => {
      try {
        processPomodoroDeadline();
      } catch (error) {
        console.error('Could not update the persistent Pomodoro timer.', error);
      }
    };
    checkPomodoroDeadline();
    const timer = window.setInterval(checkPomodoroDeadline, 1000);
    window.addEventListener('focus', checkPomodoroDeadline);
    window.addEventListener('pageshow', checkPomodoroDeadline);
    document.addEventListener('visibilitychange', checkPomodoroDeadline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkPomodoroDeadline);
      window.removeEventListener('pageshow', checkPomodoroDeadline);
      document.removeEventListener('visibilitychange', checkPomodoroDeadline);
    };
  }, []);

  const [lockSettings, setLockSettings] = useState<LockSettings>(() =>
    readSetting(SETTINGS_KEYS.lock, DEFAULT_LOCK_SETTINGS, isLockSettings)
  );
  const [isLocked, setIsLocked] = useState(() => lockSettings.mode !== 'none');
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const emergencyTapTimesRef = useRef<number[]>([]);
  const [showStatusBar, setShowStatusBar] = useState(() =>
    readSetting(SETTINGS_KEYS.statusBarVisible, true, (value): value is boolean => typeof value === 'boolean')
  );
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    readSetting(SETTINGS_KEYS.userProfile, INITIAL_USER_PROFILE, isUserProfile)
  );

  const [beautySettings, setBeautySettings] = useState<BeautySettings>(() => {
    const legacyWallpapers = readSetting<CustomWallpapers>(
      'pocketos:wallpapers',
      { lockScreen: '', homeScreen: '' },
      (value): value is CustomWallpapers =>
        !!value &&
        typeof value === 'object' &&
        typeof (value as CustomWallpapers).lockScreen === 'string' &&
        typeof (value as CustomWallpapers).homeScreen === 'string'
    );
    return readSetting(SETTINGS_KEYS.beauty, {
      ...DEFAULT_BEAUTY_SETTINGS,
      wallpapers: legacyWallpapers,
    }, isBeautySettings);
  });
  // Clock
  const [timeString, setTimeString] = useState('09:41');
  const [dateString, setDateString] = useState('10月13日 星期二');

  useEffect(() => {
    if (navigator.storage?.persist) {
      void navigator.storage.persist().then((granted) => {
        if (!granted) {
          console.info('Persistent browser storage was not granted.');
        }
      }).catch((error: unknown) => {
        console.warn('Could not request persistent browser storage.', error);
      });
    }
  }, []);

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

  const currentTheme = THEMES.find((t) => t.id === beautySettings.themeId) || THEMES[0];
  const currentWallpaper =
    WALLPAPERS.find((w) => w.id === beautySettings.wallpaperId) || WALLPAPERS[0];

  const handleOpenApp = (appId: AppId) => {
    setActiveApp(appId);
  };

  const handleBackToHome = () => {
    setActiveApp(null);
  };

  const handleEmergencyTap = () => {
    if (showEmergencyDialog) return;
    const now = Date.now();
    const recentTaps = emergencyTapTimesRef.current.filter((timestamp) => now - timestamp <= 1500);
    recentTaps.push(now);
    if (recentTaps.length >= 5) {
      emergencyTapTimesRef.current = [];
      setShowEmergencyDialog(true);
      return;
    }
    emergencyTapTimesRef.current = recentTaps;
  };

  const handleEmergencyReturn = () => {
    setActiveApp(null);
    setIsLocked(false);
    setShowEmergencyDialog(false);
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleLock = () => {
    if (lockSettings.mode !== 'none') {
      setIsLocked(true);
      setActiveApp(null);
    }
  };

  const handleSaveLockSettings = (settings: LockSettings): boolean => {
    const normalizedSettings = {
      ...settings,
      password: settings.mode === 'password' ? settings.password : '',
    };
    try {
      saveSetting(SETTINGS_KEYS.lock, normalizedSettings);
      setLockSettings(normalizedSettings);
      if (normalizedSettings.mode === 'none') setIsLocked(false);
      return true;
    } catch (error) {
      console.error('Could not save lock settings.', error);
      return false;
    }
  };

  const handleSaveUserProfile = (profile: UserProfile): boolean => {
    try {
      saveSetting(SETTINGS_KEYS.userProfile, profile);
      setUserProfile(profile);
      return true;
    } catch (error) {
      console.error('Could not save the player profile.', error);
      return false;
    }
  };

  const handleSaveBeautySettings = (settings: BeautySettings): boolean => {
    try {
      saveSetting(SETTINGS_KEYS.beauty, settings);
      setBeautySettings(settings);
      return true;
    } catch (error) {
      console.error('Could not save beauty settings.', error);
      return false;
    }
  };

  const handleSaveCustomWallpapers = (wallpapers: CustomWallpapers): boolean =>
    handleSaveBeautySettings({ ...beautySettings, wallpapers });

  const handleSaveAppIcons = (appIcons: BeautySettings['appIcons']): boolean =>
    handleSaveBeautySettings({ ...beautySettings, appIcons });

  const handleSelectTheme = (themeId: string): boolean => {
    return handleSaveBeautySettings({ ...beautySettings, themeId });
  };

  const handleSelectPresetWallpaper = (wallpaperId: string): boolean => {
    return handleSaveBeautySettings({
      ...beautySettings,
      wallpaperId,
      wallpapers: { lockScreen: '', homeScreen: '' },
    });
  };

  const handleSelectPresetSettings = (settings: BeautySettings): boolean =>
    handleSaveBeautySettings(settings);

  const handleToggleStatusBar = (): boolean => {
    const nextValue = !showStatusBar;
    try {
      saveSetting(SETTINGS_KEYS.statusBarVisible, nextValue);
      setShowStatusBar(nextValue);
      return true;
    } catch (error) {
      console.error('Could not save status bar preference.', error);
      return false;
    }
  };

  return (
    <div className="fixed inset-0 md:static md:w-full md:h-full md:min-h-[100dvh] bg-[#DFF1FA] md:bg-[#080D14] flex items-center justify-center p-0 md:p-3 overflow-hidden select-none">
      {/* 
        Phone Canvas Container:
        - Exact height: 100dvh (dynamic viewport height) on mobile devices
        - Gradient background bleeds 100% to the absolute top and bottom (no black gaps)
        - pt: env(safe-area-inset-top) keeps status bar & sub-page back buttons safely below notch/island
        - pb: env(safe-area-inset-bottom) keeps dock above iPhone Home indicator bar
      */}
      <div
        onPointerDown={handleEmergencyTap}
        className={`w-full md:w-[min(412px,calc(93dvh*9/19.5))] h-full md:h-[min(850px,93dvh)] md:rounded-[44px] overflow-hidden relative flex flex-col shadow-[0_25px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.14)] transition-all ${
          activeApp || isLocked
            ? 'p-0'
            : 'pt-[max(env(safe-area-inset-top,0px),0px)] pb-0'
        }`}
        style={
          beautySettings.wallpapers.homeScreen
            ? {
                backgroundImage: `url("${beautySettings.wallpapers.homeScreen}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { background: currentWallpaper.style }
        }
      >
        {/* Dynamic theme backdrop wash */}
        {!beautySettings.wallpapers.homeScreen && (
          <div
            className={`absolute inset-0 bg-gradient-to-b ${currentTheme.gradient} opacity-90 pointer-events-none transition-all duration-700`}
          />
        )}

        {/* Ambient aesthetic glow patches */}
        {!beautySettings.wallpapers.homeScreen && (
          <>
            <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#DFF1FA] blur-3xl pointer-events-none opacity-70" />
            <div className="absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-[#FAD4E0] blur-3xl pointer-events-none opacity-50" />
            <div className="absolute -bottom-32 right-0 w-80 h-80 rounded-full bg-[#DFF1FA] blur-3xl pointer-events-none opacity-60" />
          </>
        )}

        {/* Top Status Bar (Only on Desktop / Lockscreen or when enabled, with safe top breathing space) */}
        {showStatusBar && !activeApp && !isLocked && (
          <div className="relative z-40 pt-1 shrink-0">
            <StatusBar
              time={timeString}
              onLockClick={isLocked || lockSettings.mode === 'none' ? undefined : handleLock}
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
              wallpaperImage={beautySettings.wallpapers.lockScreen}
              password={lockSettings.mode === 'password' ? lockSettings.password : undefined}
            />
          ) : activeApp ? (
            /* Active Sub-App View: Header is safely padded below the notch, back arrow always clickable */
            <div className="w-full h-full flex flex-col overflow-hidden animate-fadeIn">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    正在打开应用…
                  </div>
                }
              >
              {activeApp === 'wechat' && (
                <WeChatApp
                  onBack={handleBackToHome}
                />
              )}
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
                  onToggleStatusBar={handleToggleStatusBar}
                  onLockScreen={handleLock}
                  lockSettings={lockSettings}
                  onSaveLockSettings={handleSaveLockSettings}
                />
              )}
              {activeApp === 'customizer' && (
                <ThemeCustomizerApp
                  onBack={handleBackToHome}
                  activeThemeId={beautySettings.themeId}
                  onSelectTheme={handleSelectTheme}
                  activeWallpaperId={beautySettings.wallpaperId}
                  onSelectWallpaper={handleSelectPresetWallpaper}
                  customWallpapers={beautySettings.wallpapers}
                  onSaveCustomWallpapers={handleSaveCustomWallpapers}
                  appIcons={beautySettings.appIcons}
                  onSaveAppIcons={handleSaveAppIcons}
                  onApplyPreset={handleSelectPresetSettings}
                  currentSettings={beautySettings}
                />
              )}
              {activeApp === 'world_book' && (
                <WorldBookApp onBack={handleBackToHome} />
              )}
              {activeApp === 'memory' && (
                <MemoryApp onBack={handleBackToHome} />
              )}
              {activeApp === 'inventory' && (
                <InventoryApp onBack={handleBackToHome} />
              )}
              </Suspense>
            </div>
          ) : (
            /* Desktop / Home Screen (Strictly fitted within 1 screen, never scrolls, square blocks) */
            <HomeScreen
              userProfile={userProfile}
              apps={MAIN_GRID_APPS}
              dockApps={DOCK_APPS}
              onOpenApp={handleOpenApp}
              onSaveUserProfile={handleSaveUserProfile}
              appIcons={beautySettings.appIcons}
            />
          )}
        </div>
        {showEmergencyDialog && (
          <div className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-6 backdrop-blur-sm">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="emergency-return-title"
              className="w-full max-w-xs rounded-3xl border border-white/80 bg-white/95 p-5 text-center shadow-2xl"
            >
              <h2 id="emergency-return-title" className="text-sm font-bold text-[#587589]">返回主页？</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">检测到连续点击屏幕五下。确定要离开当前页面并返回主页吗？</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmergencyDialog(false)}
                  className="rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600"
                >
                  继续停留
                </button>
                <button
                  type="button"
                  onClick={handleEmergencyReturn}
                  className="rounded-xl bg-gradient-to-r from-[#9BD2FC] to-[#F7B9D2] py-2.5 text-xs font-bold text-[#456176]"
                >
                  返回主页
                </button>
              </div>
            </section>
          </div>
        )}
        <ErrorDialogHost />
      </div>
    </div>
  );
}
