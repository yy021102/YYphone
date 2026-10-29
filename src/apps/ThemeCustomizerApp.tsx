import React, { useEffect, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Type,
  Upload,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { GlobalFontSettings } from '../components/GlobalFontSettings';
import { BirthdaySettings } from '../components/BirthdaySettings';
import type { FontSettings } from '../utils/fontSettings';
import { useErrorDialog } from '../components/ErrorDialog';
import { ALL_APPS, THEMES, WALLPAPERS } from '../data/mockData';
import {
  AppIconOverrides,
  BeautyPreset,
  BeautySettings,
  CustomWallpapers,
} from '../types';
import { compressImageFile, compressWallpaper } from '../utils/imageFile';
import { readSetting, saveSetting, SETTINGS_KEYS } from '../utils/settings';
import { isHomeAppearance } from '../utils/homeAppearance';
import { DEFAULT_LOCK_APPEARANCE, isLockScreenAppearance } from '../utils/lockAppearance';

interface ThemeCustomizerAppProps {
  fontSettings: FontSettings;
  onSaveFontSettings: (settings: FontSettings) => boolean;
  onBack: () => void;
  activeThemeId: string;
  onSelectTheme: (themeId: string) => boolean;
  activeWallpaperId: string;
  onSelectWallpaper: (wallpaperId: string) => boolean;
  customWallpapers: CustomWallpapers;
  onSaveCustomWallpapers: (wallpapers: CustomWallpapers) => boolean;
  appIcons: AppIconOverrides;
  onSaveAppIcons: (appIcons: AppIconOverrides) => boolean;
  onApplyPreset: (settings: BeautySettings) => boolean;
  currentSettings: BeautySettings;
}

const DEFAULT_PRESETS: BeautyPreset[] = [];

const isBeautySettings = (value: unknown): value is BeautySettings => {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Partial<BeautySettings>;
  return (
    typeof settings.themeId === 'string' &&
    (settings.homeStyle === undefined || settings.homeStyle === 'classic' || settings.homeStyle === 'minimal' || settings.homeStyle === 'moonlit') &&
    THEMES.some((theme) => theme.id === settings.themeId) &&
    typeof settings.wallpaperId === 'string' &&
    (WALLPAPERS.some((wallpaper) => wallpaper.id === settings.wallpaperId) || settings.wallpaperId === 'deep-sea-frost') &&
    !!settings.wallpapers &&
    typeof settings.wallpapers.lockScreen === 'string' &&
    typeof settings.wallpapers.homeScreen === 'string' &&
    !!settings.appIcons &&
    typeof settings.appIcons === 'object' &&
    Object.entries(settings.appIcons).every(
      ([id, url]) => (id === 'little-p' || ALL_APPS.some((app) => app.id === id)) && typeof url === 'string'
    ) &&
    (settings.homeAppearance === undefined || isHomeAppearance(settings.homeAppearance)) &&
    (settings.lockScreenAppearance === undefined || isLockScreenAppearance(settings.lockScreenAppearance))
  );
};

const isBeautyPresetList = (value: unknown): value is BeautyPreset[] =>
  Array.isArray(value) &&
  value.every(
    (preset) =>
      !!preset &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      isBeautySettings(preset.settings)
  );

// Retired wallpapers fall back without invalidating the rest of an old preset.
export const normalizeWallpaper = (settings: BeautySettings): BeautySettings =>
  settings.wallpaperId === 'deep-sea-frost' ? { ...settings, wallpaperId: WALLPAPERS[0].id } : settings;

export const ThemeCustomizerApp: React.FC<ThemeCustomizerAppProps> = ({
  fontSettings,
  onSaveFontSettings,
  onBack,
  activeThemeId,
  onSelectTheme,
  activeWallpaperId,
  onSelectWallpaper,
  customWallpapers,
  onSaveCustomWallpapers,
  appIcons,
  onSaveAppIcons,
  onApplyPreset,
  currentSettings,
}) => {
  const [wallpaperDraft, setWallpaperDraft] = useState(customWallpapers);
  const [iconDraft, setIconDraft] = useState<AppIconOverrides>(appIcons);
  const [lockAppearanceDraft, setLockAppearanceDraft] = useState(currentSettings.lockScreenAppearance ?? DEFAULT_LOCK_APPEARANCE);
  const [presets, setPresets] = useState(() =>
    readSetting(SETTINGS_KEYS.beautyPresets, DEFAULT_PRESETS, isBeautyPresetList)
      .map((preset) => ({ ...preset, settings: normalizeWallpaper(preset.settings) }))
  );
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useErrorDialog(error);
  const [processing, setProcessing] = useState<string | null>(null);
  const draftSettings: BeautySettings = {
    ...normalizeWallpaper(currentSettings),
    wallpapers: wallpaperDraft,
    appIcons: iconDraft,
    lockScreenAppearance: lockAppearanceDraft,
  };

  useEffect(() => {
    setWallpaperDraft(customWallpapers);
  }, [customWallpapers]);

  useEffect(() => {
    setIconDraft(appIcons);
  }, [appIcons]);
  useEffect(() => {
    setLockAppearanceDraft(currentSettings.lockScreenAppearance ?? DEFAULT_LOCK_APPEARANCE);
  }, [currentSettings.lockScreenAppearance]);

  const clearFeedback = () => {
    setStatus('');
    setError('');
  };

  const updateWallpaper = (field: keyof CustomWallpapers, value: string) => {
    setWallpaperDraft((current) => ({ ...current, [field]: value }));
    clearFeedback();
  };

  const handleUpload = async (field: keyof CustomWallpapers, file?: File) => {
    if (!file) return;
    setProcessing(field);
    setError('');
    try {
      const image = await compressWallpaper(file);
      setWallpaperDraft((current) => ({ ...current, [field]: image }));
      setStatus('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片处理失败。');
    } finally {
      setProcessing(null);
    }
  };

  const handleIconUpload = async (appId: string, file?: File) => {
    if (!file) return;
    setProcessing(`icon:${appId}`);
    setError('');
    try {
      const image = await compressImageFile(file);
      setIconDraft((current) => ({ ...current, [appId]: image }));
      setStatus('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图标处理失败。');
    } finally {
      setProcessing(null);
    }
  };

  const wallpaperInput = (field: keyof CustomWallpapers, label: string) => (
    <div className="rounded-2xl border border-white/80 bg-white/55 p-3 space-y-2">
      <label className="block text-[11px] font-semibold text-[#2C4A5C]">
        {label}壁纸链接
        <input
          type="url"
          value={wallpaperDraft[field]}
          onChange={(event) => updateWallpaper(field, event.target.value)}
          placeholder="留空则使用预设渐变"
          className="mt-1 w-full bg-white/75 border border-white rounded-xl px-3 py-2 text-xs outline-none"
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-[11px] text-[#2C4A5C]">
        <span className="shrink-0">{label}本地上传</span>
        <input
          type="file"
          aria-label={`${label}本地上传`}
          accept="image/*"
          disabled={processing !== null}
          onChange={(event) => {
            void handleUpload(field, event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
          className="min-w-0 max-w-[190px] flex-1 text-[10px]"
        />
      </label>
      {wallpaperDraft[field] && (
        <button
          type="button"
          onClick={() => updateWallpaper(field, '')}
          className="text-[10px] font-semibold text-rose-600"
        >
          清除自定义壁纸
        </button>
      )}
    </div>
  );

  const persistPresets = (nextPresets: BeautyPreset[]) => {
    try {
      saveSetting(SETTINGS_KEYS.beautyPresets, nextPresets);
      setPresets(nextPresets);
      return true;
    } catch (storageError) {
      console.error('Could not save beauty presets.', storageError);
      setError('预设保存失败，本地存储空间可能不足。');
      return false;
    }
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setError('请先输入预设名称。');
      return;
    }
    if (!onApplyPreset(draftSettings)) {
      setError('保存搭配失败，本地存储空间可能不足。请减少图片数量或尺寸。');
      return;
    }
    const preset: BeautyPreset = {
      id: `beauty-${Date.now()}`,
      name,
      settings: draftSettings,
    };
    if (persistPresets([...presets, preset])) {
      setPresetName('');
      setSelectedPresetId(preset.id);
      setStatus(`已保存预设「${name}」。`);
      setError('');
    }
  };

  const handleApplyPreset = () => {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setError('请选择要应用的预设。');
      return;
    }
    if (onApplyPreset(preset.settings)) {
      setStatus(`已应用预设「${preset.name}」。`);
      setError('');
    } else {
      setError('应用预设失败，设置未能保存。');
    }
  };

  const handleDeletePreset = () => {
    const nextPresets = presets.filter((item) => item.id !== selectedPresetId);
    if (nextPresets.length === presets.length) return;
    if (persistPresets(nextPresets)) {
      setSelectedPresetId('');
      setStatus('预设已删除。');
      setError('');
    }
  };

  const handleExport = () => {
    const exportPresets: BeautyPreset[] = [
      {
        id: 'current-design',
        name: '当前搭配',
        settings: normalizeWallpaper(currentSettings),
      },
    ];
    const content = JSON.stringify(
      { format: 'yyphone-beauty', version: 1, presets: exportPresets },
      null,
      2
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'yyphone-beauty.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus('当前已应用的美化已导出为 JSON 文件，不包含其他预设或未保存修改。');
    setError('');
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    clearFeedback();
    try {
      const imported: unknown = JSON.parse(await file.text());
      if (
        !imported ||
        typeof imported !== 'object' ||
        (imported as { format?: unknown }).format !== 'yyphone-beauty' ||
        (imported as { version?: unknown }).version !== 1 ||
        !isBeautyPresetList((imported as { presets?: unknown }).presets)
      ) {
        throw new Error('文件格式不正确或版本不受支持。');
      }

      const importedPresets = (imported as { presets: BeautyPreset[] }).presets;
      if (importedPresets.length === 0) {
        throw new Error('文件中没有可导入的美化预设。');
      }

      const additions = importedPresets.map((preset, index) => ({
        ...preset,
        settings: normalizeWallpaper(preset.settings),
        id: `import-${Date.now()}-${index}`,
      }));
      if (!persistPresets([...presets, ...additions])) return;

      const firstPreset = additions[0];
      if (!onApplyPreset(firstPreset.settings)) {
        setError('预设已导入，但应用失败；请手动从预设列表应用。');
        return;
      }
      setSelectedPresetId(firstPreset.id);
      setStatus(`成功导入 ${additions.length} 套搭配，并应用「${firstPreset.name}」。`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '无法导入该文件。');
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F7FA] overflow-hidden">
      <AppHeader
        title="美化 · 主题与壁纸"
        subtitle="壁纸、图标、组件与资料卡整套保存"
        onBack={onBack}
      />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-4">
        <details className="glass-card group rounded-2xl p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[#2C4A5C]">
            <Palette className="h-3.5 w-3.5 shrink-0 text-pink-500" />
            <span className="flex-1">内置主题与锁屏</span>
            <span className={`h-4 w-4 rounded-full bg-gradient-to-r ${THEMES.find((theme) => theme.id === activeThemeId)?.gradient}`} />
            <span className="text-[10px] font-normal text-slate-400">一键切换</span>
            <ChevronDown size={13} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <h3 className="mt-4 px-0.5 text-[11px] font-semibold text-[#2C4A5C]">主页面风格</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">{([{ id: 'classic', name: '清新 · 轻透', colors: ['#dcecf8', '#f3dce7'], description: '渐变毛玻璃 · 组件桌面' }, { id: 'minimal', name: '素简 · 纸白', colors: ['#f4f2ee', '#55544f'], description: '暖白与石墨 · 简约布局' }, { id: 'moonlit', name: '月光 · 花笺', colors: ['#ede9f4', '#b7a5d0'], description: '月白雾紫 · 花枝信笺' }] as const).map(style => <button type="button" key={style.id} aria-pressed={(currentSettings.homeStyle ?? 'classic') === style.id} onClick={() => { if (onApplyPreset({ ...currentSettings, homeStyle: style.id })) { setStatus(`已应用主页面风格「${style.name}」。`); setError(''); } else setError('主页面风格保存失败。'); }} className={`rounded-xl border p-3 text-left ${(currentSettings.homeStyle ?? 'classic') === style.id ? 'border-slate-400 ring-1 ring-slate-300' : 'border-white bg-white/50'}`}><div className="mb-3 flex h-16 items-center justify-center gap-1 rounded-lg" style={{ background: style.colors[0] }}>{[0, 1, 2, 3].map(i => <span key={i} className="h-5 w-5 rounded-md border border-white/80" style={{ background: style.colors[1], opacity: .4 + i * .15 }} />)}</div><strong className="block text-[11px] font-semibold text-slate-600">{style.name}</strong><span className="mt-1 block text-[9px] text-slate-400">{style.description}</span></button>)}</div>
          <h3 className="mt-4 px-0.5 text-[11px] font-semibold text-[#2C4A5C]">系统主题配色</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {THEMES.map((theme) => {
              const isSelected = activeThemeId === theme.id;
              return (
                <button
                  type="button"
                  key={theme.id}
                  onClick={() => {
                    if (onSelectTheme(theme.id)) {
                      setStatus(`已应用主题「${theme.name}」。`);
                      setError('');
                    } else {
                      setError('主题保存失败。');
                    }
                  }}
                  aria-pressed={isSelected}
                  className={`glass-card rounded-xl p-1.5 text-left transition-all border ${
                    isSelected
                      ? 'border-sky-500 ring-2 ring-sky-300 shadow-sm'
                      : 'border-white/60 hover:border-sky-300'
                  }`}
                >
                  <div
                    className={`h-7 rounded-lg bg-gradient-to-r ${theme.gradient} border border-white/80 p-1 flex items-center justify-end shadow-inner`}
                  >
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1.5 px-0.5">
                    <span className="text-[10px] font-bold text-[#2C4A5C]">{theme.name}</span>
                    <span
                      className="w-2.5 h-2.5 shrink-0 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
          <h3 className="mt-4 flex items-center gap-1.5 border-t border-white/80 px-0.5 pt-3 text-[11px] font-semibold text-[#2C4A5C]">
            <ImageIcon className="w-3.5 h-3.5 shrink-0 text-sky-500" />
            <span className="flex-1">锁屏样式</span>
            <span className="text-[10px] font-normal text-slate-400">{customWallpapers.lockScreen ? '自定义壁纸' : (WALLPAPERS.find((wallpaper) => wallpaper.id === activeWallpaperId) ?? WALLPAPERS[0]).name}</span>
          </h3>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {WALLPAPERS.map((wallpaper) => {
                const isSelected = normalizeWallpaper(currentSettings).wallpaperId === wallpaper.id;
                return (
                  <button
                    type="button"
                    key={wallpaper.id}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (onSelectWallpaper(wallpaper.id)) {
                        setStatus(`已应用壁纸「${wallpaper.name}」。`);
                        setError('');
                      } else {
                        setError('壁纸保存失败。');
                      }
                    }}
                    className={`glass-card rounded-xl overflow-hidden text-left transition-all border ${
                      isSelected
                        ? 'border-sky-500 ring-2 ring-sky-300 shadow-md'
                        : 'border-white/60 hover:border-sky-300'
                    }`}
                  >
                    <div
                      className="h-9 relative p-1.5 flex flex-col justify-between"
                      style={{ background: wallpaper.style }}
                    >
                      <div className="flex justify-end">
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-1.5 py-1 bg-white/60">
                      <p className="text-[10px] font-bold text-[#2C4A5C] truncate">{wallpaper.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">点击即用。内置壁纸同步用于锁屏与桌面，会替换当前的自定义壁纸。</p>
          </div>
        </details>

        <BirthdaySettings />
        <details className="glass-card group rounded-2xl p-3 space-y-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[#2C4A5C]">
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-500" /><span className="flex-1">自定义壁纸</span>
            <ChevronDown size={13} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <p className="text-[10px] leading-relaxed text-slate-500">上传图片或填写链接，分别设置你的锁屏与桌面。</p>
          {wallpaperInput('lockScreen', '锁屏')}
          {wallpaperInput('homeScreen', '桌面')}
          <button
            type="button"
            onClick={() => {
              if (!onSaveCustomWallpapers(wallpaperDraft)) {
                setError('壁纸保存失败，本地存储空间可能不足。请换用较小图片后重试。');
                setStatus('');
                return;
              }
              setStatus('锁屏和桌面壁纸已保存。');
              setError('');
            }}
            disabled={processing !== null}
            className="w-full rounded-xl bg-sky-600 text-white py-2 text-xs font-bold disabled:opacity-50"
          >
            保存壁纸
          </button>
        </details>
        <details className="glass-card group rounded-2xl p-3 space-y-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[#2C4A5C]">
            <Type className="h-3.5 w-3.5 shrink-0 text-sky-500" /><span className="flex-1">锁屏文字</span>
            <ChevronDown size={13} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <label className="flex items-center justify-between text-xs text-slate-600">
            锁屏字体颜色
            <input type="color" value={lockAppearanceDraft.textColor}
              onChange={(event) => setLockAppearanceDraft({ ...lockAppearanceDraft, textColor: event.target.value })} />
          </label>
          <label className="block text-xs text-slate-600">
            时间下方文字
            <textarea aria-label="时间下方文字" rows={3} maxLength={200} value={lockAppearanceDraft.subtitle}
              onChange={(event) => setLockAppearanceDraft({ ...lockAppearanceDraft, subtitle: event.target.value })}
              placeholder="留空则不显示文字"
              className="mt-1 w-full rounded-xl border border-white bg-white/75 p-2 text-xs" />
          </label>
          <div aria-label="锁屏文字预览" className="rounded-2xl bg-slate-200 p-4 text-center"
            style={{ color: lockAppearanceDraft.textColor }}>
            <p className="text-3xl font-mono font-bold">21:08</p>
            <p className="mt-2 text-xs whitespace-pre-wrap break-words">{lockAppearanceDraft.subtitle}</p>
          </div>
          <p className="text-[10px] text-slate-500">修改日期、时间及解锁界面的字体颜色；下方文字支持换行，留空可隐藏。会随美化预设保存与导出。</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => {
              if (!onApplyPreset({ ...currentSettings, lockScreenAppearance: lockAppearanceDraft })) {
                setError('锁屏文字保存失败，请重试。');
                return;
              }
              setStatus('锁屏文字已保存。');
              setError('');
            }} className="flex-1 rounded-xl bg-sky-600 py-2 text-xs font-bold text-white">保存锁屏文字</button>
            <button type="button" onClick={() => setLockAppearanceDraft(DEFAULT_LOCK_APPEARANCE)}
              className="rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-600">恢复默认文字</button>
          </div>
        </details>
        <GlobalFontSettings fontSettings={fontSettings} onSaveFontSettings={onSaveFontSettings} />
        <details className="glass-card group rounded-2xl p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[#2C4A5C]">
            <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-pink-500" />
            <span className="flex-1">App 图标</span>
            <ChevronDown size={13} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2.5">
            <p className="px-1 text-[10px] text-slate-500">
              支持图片链接和本地图片；自定义图片会铺满整个 App 图标，替换默认背景与图案，保留图标圆角；非正方形图片会居中裁切。上传会压缩图片，清除后恢复系统图标。
            </p>
            <div className="space-y-2">
              {[...ALL_APPS, { id: 'little-p' as const, name: '小P' }].map((app) => (
                <div key={app.id} className="glass-card rounded-2xl p-3 space-y-2">
                  <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                    {app.name}图标链接
                    <input
                      type="url"
                      value={iconDraft[app.id] ?? ''}
                      onChange={(event) => {
                        setIconDraft((current) => ({
                          ...current,
                          [app.id]: event.target.value,
                        }));
                        clearFeedback();
                      }}
                      placeholder="留空使用系统默认图标"
                      className="mt-1 w-full bg-white/75 border border-white rounded-xl px-3 py-2 text-xs outline-none"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-[11px] text-[#2C4A5C]">
                    <span>本地上传</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={processing !== null}
                      onChange={(event) => {
                        void handleIconUpload(app.id, event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                      className="max-w-[190px] text-[10px]"
                    />
                  </label>
                  {iconDraft[app.id] && (
                    <button
                      type="button"
                      onClick={() => {
                        setIconDraft((current) => {
                          const updated = { ...current };
                          delete updated[app.id];
                          return updated;
                        });
                        clearFeedback();
                      }}
                      className="text-[10px] font-semibold text-rose-600"
                    >
                      清除自定义图标
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!onSaveAppIcons(iconDraft)) {
                  setError('图标保存失败，本地存储空间可能不足。');
                  return;
                }
                setStatus('App 图标已保存。');
                setError('');
              }}
              disabled={processing !== null}
              className="w-full rounded-xl bg-sky-600 text-white py-2 text-xs font-bold disabled:opacity-50"
            >
              保存 App 图标
            </button>
          </div>
        </details>

        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-bold text-[#2C4A5C]">预设</h3>
          <div className="glass-card rounded-2xl p-3 space-y-2">
            <div className="flex gap-2">
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="输入搭配名称"
                maxLength={40}
                className="min-w-0 flex-1 bg-white/75 border border-white rounded-xl px-3 py-2 text-xs outline-none"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                className="shrink-0 flex items-center gap-1 rounded-xl bg-violet-100 px-3 py-2 text-xs font-bold text-violet-800"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                保存搭配
              </button>
            </div>
            {presets.length > 0 ? (
              <>
                <select
                  value={selectedPresetId}
                  onChange={(event) => setSelectedPresetId(event.target.value)}
                  className="w-full bg-white/75 border border-white rounded-xl px-3 py-2 text-xs outline-none"
                  aria-label="已保存的美化预设"
                >
                  <option value="">选择已保存的搭配</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApplyPreset}
                    className="flex-1 rounded-xl bg-violet-600 text-white py-2 text-xs font-bold"
                  >
                    应用预设
                  </button>
                  <button
                    type="button"
                    onClick={handleDeletePreset}
                    disabled={!selectedPresetId}
                    className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-40"
                  >
                    删除
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-slate-500">还没有保存的搭配。</p>
            )}
          </div>
        </section>

        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-bold text-[#2C4A5C]">导入、导出美化</h3>
          <div className="glass-card rounded-2xl p-3 space-y-2">
            <p className="text-[10px] text-slate-500">
              只导出当前已应用的美化，不包含已保存的其他预设或未保存修改；导入后保存文件中的搭配并应用第一套，仍兼容旧版多预设文件。
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-sky-100 py-2 text-xs font-bold text-sky-800"
            >
              <Download className="w-3.5 h-3.5" />
              导出美化文件
            </button>
            <label className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-violet-100 py-2 text-xs font-bold text-violet-800 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              导入美化文件
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  void handleImport(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </section>

        {processing && <p className="text-[11px] text-sky-700">正在压缩图片…</p>}
        {status && <p role="status" className="text-[11px] text-emerald-700">{status}</p>}
        {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
      </div>
    </div>
  );
};
