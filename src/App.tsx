/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppId, BeautySettings, CustomWallpapers, UserProfile } from './types';
import {
  INITIAL_USER_PROFILE,
  MAIN_GRID_APPS,
  DOCK_APPS,
  THEMES,
  WALLPAPERS,
} from './data/mockData';
import { readStoredValue, writeStoredValue } from './utils/localStorage';
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

const USER_PROFILE_STORAGE_KEY = 'pocketos:user-profile';
const BEAUTY_SETTINGS_STORAGE_KEY = 'yyphone:beauty-settings';
const LOCK_SETTINGS_STORAGE_KEY = 'yyphone:lock-settings';

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
    (profile.coverImageUrl === undefined || typeof profile.coverImageUrl === 'string')
  );
};

export default function App() {
  const [lockSettings, setLockSettings] = useState<LockSettings>(() =>
    readStoredValue(LOCK_SETTINGS_STORAGE_KEY, DEFAULT_LOCK_SETTINGS, isLockSettings)
  );
  const [isLocked, setIsLocked] = useState(() => lockSettings.mode !== 'none');
  const [activeApp, setActiveApp] = useState<AppId | null>(null);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    readStoredValue(USER_PROFILE_STORAGE_KEY, INITIAL_USER_PROFILE, isUserProfile)
  );

  const [beautySettings, setBeautySettings] = useState<BeautySettings>(() => {
    const legacyWallpapers = readStoredValue<CustomWallpapers>(
      'pocketos:wallpapers',
      { lockScreen: '', homeScreen: '' },
      (value): value is CustomWallpapers =>
        !!value &&
        typeof value === 'object' &&
        typeof (value as CustomWallpapers).lockScreen === 'string' &&
        typeof (value as CustomWallpapers).homeScreen === 'string'
    );
    return readStoredValue(BEAUTY_SETTINGS_STORAGE_KEY, {
      ...DEFAULT_BEAUTY_SETTINGS,
      wallpapers: legacyWallpapers,
    }, isBeautySettings);
  });

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

  const currentTheme = THEMES.find((t) => t.id === beautySettings.themeId) || THEMES[0];
  const currentWallpaper =
    WALLPAPERS.find((w) => w.id === beautySettings.wallpaperId) || WALLPAPERS[0];

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
      writeStoredValue(LOCK_SETTINGS_STORAGE_KEY, normalizedSettings);
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
      writeStoredValue(USER_PROFILE_STORAGE_KEY, profile);
      setUserProfile(profile);
      return true;
    } catch (error) {
      console.error('Could not save the player profile.', error);
      return false;
    }
  };

  const handleSaveBeautySettings = (settings: BeautySettings): boolean => {
    try {
      writeStoredValue(BEAUTY_SETTINGS_STORAGE_KEY, settings);
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
        {showStatusBar && !activeApp && (
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
                  onToggleStatusBar={() => setShowStatusBar(!showStatusBar)}
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
      </div>
    </div>
  );
}
