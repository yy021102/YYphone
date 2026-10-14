import React, { useEffect, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Download,
  Image as ImageIcon,
  Palette,
  Upload,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { ALL_APPS, THEMES, WALLPAPERS } from '../data/mockData';
import {
  AppIconOverrides,
  BeautyPreset,
  BeautySettings,
  CustomWallpapers,
} from '../types';
import { compressImageFile } from '../utils/imageFile';
import { readSetting, saveSetting, SETTINGS_KEYS } from '../utils/settings';

interface ThemeCustomizerAppProps {
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
    THEMES.some((theme) => theme.id === settings.themeId) &&
    typeof settings.wallpaperId === 'string' &&
    WALLPAPERS.some((wallpaper) => wallpaper.id === settings.wallpaperId) &&
    !!settings.wallpapers &&
    typeof settings.wallpapers.lockScreen === 'string' &&
    typeof settings.wallpapers.homeScreen === 'string' &&
    !!settings.appIcons &&
    typeof settings.appIcons === 'object' &&
    Object.entries(settings.appIcons).every(
      ([id, url]) => ALL_APPS.some((app) => app.id === id) && typeof url === 'string'
    )
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

export const ThemeCustomizerApp: React.FC<ThemeCustomizerAppProps> = ({
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
  const [presets, setPresets] = useState(() =>
    readSetting(SETTINGS_KEYS.beautyPresets, DEFAULT_PRESETS, isBeautyPresetList)
  );
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const draftSettings: BeautySettings = {
    ...currentSettings,
    wallpapers: wallpaperDraft,
    appIcons: iconDraft,
  };

  useEffect(() => {
    setWallpaperDraft(customWallpapers);
  }, [customWallpapers]);

  useEffect(() => {
    setIconDraft(appIcons);
  }, [appIcons]);

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
      const image = await compressImageFile(file);
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
    <div className="glass-card rounded-2xl p-3 space-y-2">
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
        <span>{label}本地上传</span>
        <input
          type="file"
          accept="image/*"
          disabled={processing !== null}
          onChange={(event) => {
            void handleUpload(field, event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
          className="max-w-[190px] text-[10px]"
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
      ...presets,
      {
        id: 'current-design',
        name: '当前搭配',
        settings: draftSettings,
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
    setStatus('美化搭配已导出为 JSON 文件。');
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
        subtitle="保存、切换与分享你的搭配"
        onBack={onBack}
      />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-[#2C4A5C]">
            <span className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-pink-500" />
              <span>系统主题配色</span>
            </span>
            <span className="text-[10px] text-slate-400">实时生效</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                  className={`glass-card rounded-2xl p-3 text-left transition-all border ${
                    isSelected
                      ? 'border-sky-500 ring-2 ring-sky-300 shadow-md scale-[1.02]'
                      : 'border-white/60 hover:border-sky-300'
                  }`}
                >
                  <div
                    className={`h-14 rounded-xl bg-gradient-to-r ${theme.gradient} border border-white/80 p-2 flex items-start justify-between shadow-inner`}
                  >
                    <span className="text-[10px] font-bold text-slate-700 bg-white/70 px-1.5 py-0.5 rounded shadow-2xs">
                      {theme.name}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-xs font-bold text-[#2C4A5C]">{theme.name}</span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
            <span>锁屏</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {WALLPAPERS.map((wallpaper) => {
              const isSelected = activeWallpaperId === wallpaper.id;
              return (
                <button
                  type="button"
                  key={wallpaper.id}
                  onClick={() => {
                    if (onSelectWallpaper(wallpaper.id)) {
                      setStatus(`已应用壁纸「${wallpaper.name}」。`);
                      setError('');
                    } else {
                      setError('壁纸保存失败。');
                    }
                  }}
                  className={`glass-card rounded-2xl overflow-hidden text-left transition-all border ${
                    isSelected
                      ? 'border-sky-500 ring-2 ring-sky-300 shadow-md scale-[1.02]'
                      : 'border-white/60 hover:border-sky-300'
                  }`}
                >
                  <div
                    className="h-28 relative p-2.5 flex flex-col justify-between"
                    style={{ background: wallpaper.style }}
                  >
                    <div className="flex justify-end">
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-[#2C4A5C] bg-white/70 px-2 py-0.5 rounded-md w-fit shadow-2xs backdrop-blur-xs">
                      {wallpaper.name}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white/60">
                    <p className="text-[10px] text-slate-500 truncate">{wallpaper.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
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
        </section>

        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-bold text-[#2C4A5C]">App 图标</h3>
          <p className="px-1 text-[10px] text-slate-500">
            支持图片链接和本地图片；上传会压缩图片，清除后恢复系统图标。
          </p>
          <div className="space-y-2">
            {ALL_APPS.map((app) => (
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
        </section>

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
              导出文件包含当前搭配和已保存预设；导入后保存全部搭配并应用第一套。
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
