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
import { LittlePPanel } from './components/LittlePPanel';
import { LITTLE_P_VISIBLE_KEY } from './utils/littleP';
import { processPomodoroDeadline } from './utils/pomodoroRuntime';
import { ErrorDialogHost, showYyError } from './components/ErrorDialog';
import { CALENDAR_APPEARANCE_KEY, MUSIC_APPEARANCE_KEY, captureHomeAppearance, isHomeAppearance } from './utils/homeAppearance';
import { FONT_FAMILIES, FontSettings, readFontSettings } from './utils/fontSettings';
import { ChatNotification, ChatRuntimeSettings, isKeepAlivePlaying, readChatRuntimeSettings, startKeepAlive, stopKeepAlive } from './utils/chatRuntime';

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
    Object.values(settings.appIcons).every((url) => typeof url === 'string') &&
    (settings.homeAppearance === undefined || isHomeAppearance(settings.homeAppearance))
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
  const [littlePOpen, setLittlePOpen] = useState(false);
  const [littlePVisible, setLittlePVisible] = useState(() =>
    readSetting(LITTLE_P_VISIBLE_KEY, true, (value): value is boolean => typeof value === 'boolean')
  );
  const handleLittlePVisible = (visible: boolean) => {
    try {
      saveSetting(LITTLE_P_VISIBLE_KEY, visible);
      setLittlePVisible(visible);
      if (!visible) setLittlePOpen(false);
      return true;
    } catch (error) {
      console.error('Could not save Little P visibility.', error);
      showYyError('小P入口设置保存失败，请重试。');
      return false;
    }
  };
  useEffect(() => { if (isLocked || activeApp) setLittlePOpen(false); }, [isLocked, activeApp]);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const emergencyTapTimesRef = useRef<number[]>([]);
  const [showStatusBar, setShowStatusBar] = useState(() =>
    readSetting(SETTINGS_KEYS.statusBarVisible, true, (value): value is boolean => typeof value === 'boolean')
  );
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    readSetting(SETTINGS_KEYS.userProfile, INITIAL_USER_PROFILE, isUserProfile)
  );
  const [fontSettings, setFontSettings] = useState(readFontSettings);
  const [runtimeSettings, setRuntimeSettings] = useState(readChatRuntimeSettings);
  const [keepAliveStatus, setKeepAliveStatus] = useState('');
  const [notification, setNotification] = useState<ChatNotification | null>(null);
  const [requestedChat, setRequestedChat] = useState<{ id: string; at: number } | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontSettings.scale));
  }, [fontSettings.scale]);

  useEffect(() => {
    const fallback = FONT_FAMILIES[fontSettings.family].value;
    document.documentElement.style.setProperty('--app-font-family', fallback);
    if (!fontSettings.url) return;
    let disposed = false;
    const face = new FontFace('YYphoneCustom', `url(${JSON.stringify(fontSettings.url)})`);
    void face.load().then((loaded) => {
      if (disposed) return;
      document.fonts.add(loaded);
      document.documentElement.style.setProperty('--app-font-family', `"YYphoneCustom", ${fallback}`);
    }).catch((error: unknown) => {
      if (disposed) return;
      console.error('Could not load custom font.', error);
      showYyError('字体加载失败，请检查字体直链、文件格式和跨域权限。已暂用系统字体。');
    });
    return () => {
      disposed = true;
      document.fonts.delete(face);
    };
  }, [fontSettings.url, fontSettings.family]);

  useEffect(() => {
    if (!runtimeSettings.keepAlive) {
      stopKeepAlive();
      setKeepAliveStatus('未开启');
      return;
    }
    let disposed = false;
    void startKeepAlive().then(() => {
      if (!disposed) setKeepAliveStatus('静默音频循环播放中');
    }).catch((error: unknown) => {
      console.error('Could not resume keepalive audio.', error);
      if (!disposed) setKeepAliveStatus('播放被浏览器暂停，请点击“恢复保活”');
    });
    return () => { disposed = true; stopKeepAlive(); };
  }, [runtimeSettings.keepAlive]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  useEffect(() => {
    if (!runtimeSettings.keepAlive) return;
    const check = () => setKeepAliveStatus(isKeepAlivePlaying() ? '静默音频循环播放中' : '播放已暂停，请点击“恢复保活”');
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [runtimeSettings.keepAlive]);

  const openNotifiedChat = (chatId: string) => {
    setRequestedChat({ id: chatId, at: Date.now() });
    setActiveApp('wechat');
    setNotification(null);
  };

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (!event.data || typeof event.data !== 'object') return;
      const data = event.data as { type?: unknown; chatId?: unknown };
      if (data.type === 'yyphone:open-chat' && typeof data.chatId === 'string') openNotifiedChat(data.chatId);
    };
    navigator.serviceWorker?.addEventListener('message', receive);
    const chatId = new URL(location.href).searchParams.get('chat');
    if (chatId) openNotifiedChat(chatId);
    return () => navigator.serviceWorker?.removeEventListener('message', receive);
  }, []);

  const handleChatNotification = (message: ChatNotification) => {
    if (runtimeSettings.banners) setNotification(message);
    if (!runtimeSettings.systemNotifications || document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('System chat notifications are enabled but permission is unavailable.');
      return;
    }
    void (async () => {
      try {
        const options: NotificationOptions = {
          body: message.text,
          icon: new URL('pwa-192x192.png', document.baseURI).href,
          tag: `chat-${message.chatId}`,
          data: { chatId: message.chatId },
        };
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration) {
          await registration.showNotification(message.name, options);
        } else {
          const popup = new Notification(message.name, options);
          popup.onclick = () => { window.focus(); openNotifiedChat(message.chatId); popup.close(); };
        }
      } catch (error) {
        console.error('Could not show system chat notification.', error);
        showYyError('系统通知发送失败，请检查浏览器通知权限。');
      }
    })();
  };

  const handleRuntimeSettings = async (next: ChatRuntimeSettings, resumeKeepAlive = false): Promise<boolean> => {
    try {
      if (next.keepAlive && (!runtimeSettings.keepAlive || resumeKeepAlive)) {
        await startKeepAlive();
        setKeepAliveStatus('静默音频循环播放中');
      } else if (!next.keepAlive) {
        stopKeepAlive();
      }
      saveSetting(SETTINGS_KEYS.chatRuntime, next);
      setRuntimeSettings(next);
      return true;
    } catch (error) {
      console.error('Could not update chat runtime settings.', error);
      setKeepAliveStatus('保活启动失败，请点击恢复保活重试');
      showYyError(error instanceof Error ? error.message : '后台与通知设置保存失败。');
      return false;
    }
  };

  const handleSaveFontSettings = (settings: FontSettings): boolean => {
    try {
      saveSetting(SETTINGS_KEYS.font, settings);
      setFontSettings(settings);
      return true;
    } catch (error) {
      console.error('Could not save global font settings.', error);
      return false;
    }
  };

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

  // 让 html/body 的底色和小手机壁纸一致：即使浏览器栏、安全区或动态视口让页面露出一条边，
  // 看到的也是壁纸而不是别的颜色。
  useEffect(() => {
    const homeImage = beautySettings.wallpapers.homeScreen;
    const background = homeImage
      ? `url("${homeImage}") center / cover no-repeat`
      : currentWallpaper.style;
    document.documentElement.style.background = background;
    document.body.style.background = background;
  }, [beautySettings.wallpapers.homeScreen, currentWallpaper.style]);

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

  const handleSelectPresetSettings = (settings: BeautySettings): boolean => {
    try {
      if (settings.homeAppearance) {
        const { calendar, music, profile } = settings.homeAppearance;
        saveSetting(CALENDAR_APPEARANCE_KEY, calendar);
        saveSetting(MUSIC_APPEARANCE_KEY, music);
        const nextProfile = { ...userProfile, ...profile, avatarFrame: profile.avatarFrame };
        saveSetting(SETTINGS_KEYS.userProfile, nextProfile);
        setUserProfile(nextProfile);
      }
      return handleSaveBeautySettings(settings);
    } catch (error) {
      console.error('Could not apply the complete home beauty preset.', error);
      return false;
    }
  };

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
    <div className="h-[100vh] w-full md:h-auto md:static md:w-full md:min-h-[100vh] md:bg-[#080D14] flex items-center justify-center p-0 md:p-3 overflow-hidden select-none">
      {/* 
        Phone Canvas Container:
        - Exact height: 100dvh (dynamic viewport height) on mobile devices
        - Gradient background bleeds 100% to the absolute top and bottom (no black gaps)
        - pt: env(safe-area-inset-top) keeps status bar & sub-page back buttons safely below notch/island
        - pb: env(safe-area-inset-bottom) keeps dock above iPhone Home indicator bar
      */}
      <div
        onPointerDown={handleEmergencyTap}
        className={`w-full md:w-[min(412px,calc(93vh*9/19.5))] h-full md:h-[min(850px,93vh)] md:rounded-[44px] overflow-hidden relative flex flex-col shadow-[0_25px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.14)] transition-all ${
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
          ) : activeApp === 'wechat' ? null : activeApp ? (
            /* Active Sub-App View: Header is safely padded below the notch, back arrow always clickable */
            <div className="w-full h-full flex flex-col overflow-hidden animate-fadeIn">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    正在打开应用…
                  </div>
                }
              >
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
                  littlePVisible={littlePVisible}
                  onSaveLittlePVisible={handleLittlePVisible}
                  runtimeSettings={runtimeSettings}
                  onSaveRuntimeSettings={handleRuntimeSettings}
                  keepAliveStatus={keepAliveStatus}
                  fontSettings={fontSettings}
                  onSaveFontSettings={handleSaveFontSettings}
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
                  currentSettings={{ ...beautySettings, homeAppearance: captureHomeAppearance(userProfile) }}
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
          <div
            className={activeApp === 'wechat' && !isLocked ? 'flex min-h-0 flex-1 flex-col bg-white' : 'hidden'}
            aria-hidden={activeApp !== 'wechat' || isLocked}
          >
            <Suspense fallback={null}>
              <WeChatApp
                onBack={handleBackToHome}
                isVisible={activeApp === 'wechat' && !isLocked}
                runtimeSettings={runtimeSettings}
                requestedChat={requestedChat}
                onMessage={handleChatNotification}
                onIncomingCall={() => setActiveApp('wechat')}
              />
            </Suspense>
          </div>
        </div>
        {!isLocked && !activeApp && littlePVisible && (
          <button type="button" onClick={() => setLittlePOpen(true)} aria-label="打开小P"
            className="absolute bottom-[18%] right-3 z-30 flex h-14 w-14 flex-col items-center justify-center rounded-[22px] border border-white bg-gradient-to-br from-sky-100 to-pink-100 text-sky-700 shadow-lg">
            <span aria-hidden="true" className="text-xl leading-none">✦</span><span className="mt-1 text-[10px] font-bold">小P</span>
          </button>
        )}
        <LittlePPanel open={littlePOpen && littlePVisible && !isLocked && !activeApp}
          onClose={() => setLittlePOpen(false)} onHide={() => handleLittlePVisible(false)} />
        {notification && (
          <div className="absolute left-3 right-3 top-[max(env(safe-area-inset-top,0px),12px)] z-[100] flex items-center gap-3 rounded-3xl border border-white bg-white/95 p-3 shadow-xl backdrop-blur-xl" role="status">
            <button type="button" onClick={() => openNotifiedChat(notification.chatId)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`查看${notification.name}的新消息`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-teal-100 text-teal-700">
                {notification.avatar ? <img src={notification.avatar} alt="" className="h-full w-full object-cover" /> : notification.name.charAt(0)}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-xs text-slate-700">{notification.name}</strong>
                <span className="block truncate text-xs text-slate-500">{notification.text}</span>
              </span>
            </button>
            <button type="button" aria-label="关闭消息提醒" onClick={() => setNotification(null)} className="p-2 text-sm text-slate-400">×</button>
          </div>
        )}
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
