import React, { useState } from 'react';
import {
  Check,
  Database,
  Download,
  Eye,
  EyeOff,
  Key,
  Lock,
  Plus,
  Save,
  Sliders,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

interface ApiPreset {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model?: string;
}

interface ApiModel {
  id: string;
  label: string;
}

const API_PRESETS_STORAGE_KEY = 'yyphone:api-presets';
const ACTIVE_API_PRESET_STORAGE_KEY = 'yyphone:active-api-preset';
const isApiPresetList = (value: unknown): value is ApiPreset[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      !!item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.endpoint === 'string' &&
      typeof item.apiKey === 'string' &&
      (item.model === undefined || typeof item.model === 'string')
  );

interface SettingsAppProps {
  onBack: () => void;
  showStatusBar: boolean;
  onToggleStatusBar: () => void;
  onLockScreen: () => void;
  lockSettings: { mode: 'none' | 'lock' | 'password'; password: string };
  onSaveLockSettings: (settings: {
    mode: 'none' | 'lock' | 'password';
    password: string;
  }) => boolean;
}

export const SettingsApp: React.FC<SettingsAppProps> = ({
  onBack,
  showStatusBar,
  onToggleStatusBar,
  onLockScreen,
  lockSettings,
  onSaveLockSettings,
}) => {
  const [lockMode, setLockMode] = useState(lockSettings.mode);
  const [passwordDraft, setPasswordDraft] = useState(lockSettings.password);
  const [lockSettingsSaved, setLockSettingsSaved] = useState(false);
  const [lockSettingsError, setLockSettingsError] = useState('');
  const [apiPresets, setApiPresets] = useState(() =>
    readStoredValue(API_PRESETS_STORAGE_KEY, [] as ApiPreset[], isApiPresetList)
  );
  const activeApiPresetId = readStoredValue(
    ACTIVE_API_PRESET_STORAGE_KEY,
    apiPresets[0]?.id ?? '',
    (value): value is string => typeof value === 'string'
  );
  const initialApiPreset =
    apiPresets.find((preset) => preset.id === activeApiPresetId) ?? apiPresets[0];
  const [selectedApiPresetId, setSelectedApiPresetId] = useState(
    () => initialApiPreset?.id ?? ''
  );
  const [apiName, setApiName] = useState(() => initialApiPreset?.name ?? '');
  const [apiEndpoint, setApiEndpoint] = useState(() => initialApiPreset?.endpoint ?? '');
  const [apiKey, setApiKey] = useState(() => initialApiPreset?.apiKey ?? '');
  const [apiModel, setApiModel] = useState(() => initialApiPreset?.model ?? 'gpt-4o-mini');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiModels, setApiModels] = useState<ApiModel[]>([]);
  const [isLoadingApiModels, setIsLoadingApiModels] = useState(false);
  const [apiMessage, setApiMessage] = useState('');
  const [apiError, setApiError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');

  const persistApiPresets = (nextPresets: ApiPreset[]): boolean => {
    try {
      writeStoredValue(API_PRESETS_STORAGE_KEY, nextPresets);
      setApiPresets(nextPresets);
      setApiError('');
      setApiMessage('API 配置预设已保存。');
      return true;
    } catch (error) {
      console.error('Could not save API presets.', error);
      setApiMessage('');
      setApiError('保存失败，请检查浏览器本地存储空间后重试。');
      return false;
    }
  };

  const handleSaveApiPreset = () => {
    const name = apiName.trim();
    if (!name) {
      setApiError('请填写预设名称。');
      setApiMessage('');
      return;
    }
    const preset: ApiPreset = {
      id: selectedApiPresetId || `api-${Date.now()}`,
      name,
      endpoint: apiEndpoint.trim(),
      apiKey,
      model: apiModel.trim() || 'gpt-4o-mini',
    };
    const nextPresets = selectedApiPresetId
      ? apiPresets.map((item) => (item.id === selectedApiPresetId ? preset : item))
      : [...apiPresets, preset];
    if (persistApiPresets(nextPresets)) {
      setSelectedApiPresetId(preset.id);
      writeStoredValue(ACTIVE_API_PRESET_STORAGE_KEY, preset.id);
    }
  };

  const handleSelectApiPreset = (id: string) => {
    const preset = apiPresets.find((item) => item.id === id);
    setSelectedApiPresetId(id);
    setApiName(preset?.name ?? '');
    setApiEndpoint(preset?.endpoint ?? '');
    setApiKey(preset?.apiKey ?? '');
    setApiModel(preset?.model ?? 'gpt-4o-mini');
    setApiModels([]);
    if (preset) writeStoredValue(ACTIVE_API_PRESET_STORAGE_KEY, id);
    setApiMessage('');
    setApiError('');
  };

  const handleNewApiPreset = () => {
    setSelectedApiPresetId('');
    setApiName('');
    setApiEndpoint('');
    setApiKey('');
    setApiModel('gpt-4o-mini');
    setApiModels([]);
    setApiMessage('');
    setApiError('');
  };

  const handleDeleteApiPreset = () => {
    if (!selectedApiPresetId) return;
    const nextPresets = apiPresets.filter((item) => item.id !== selectedApiPresetId);
    if (!persistApiPresets(nextPresets)) return;
    const nextPreset = nextPresets[0];
    setSelectedApiPresetId(nextPreset?.id ?? '');
    setApiName(nextPreset?.name ?? '');
    setApiEndpoint(nextPreset?.endpoint ?? '');
    setApiKey(nextPreset?.apiKey ?? '');
    setApiModel(nextPreset?.model ?? 'gpt-4o-mini');
    if (nextPreset) writeStoredValue(ACTIVE_API_PRESET_STORAGE_KEY, nextPreset.id);
    else window.localStorage.removeItem(ACTIVE_API_PRESET_STORAGE_KEY);
    setApiMessage('API 配置预设已删除。');
  };

  const handleFetchApiModels = async () => {
    const endpointValue = apiEndpoint.trim();
    const key = apiKey;
    if (!endpointValue || !key.trim()) {
      setApiError('请先填写 API 接入端点和 API Key。');
      setApiMessage('');
      return;
    }

    let modelsUrl: URL;
    try {
      modelsUrl = new URL(endpointValue);
      if (modelsUrl.protocol !== 'http:' && modelsUrl.protocol !== 'https:') {
        throw new Error('API 接入端点必须使用 HTTP 或 HTTPS。');
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'API 接入端点格式无效。');
      setApiMessage('');
      return;
    }

    const isGeminiEndpoint =
      modelsUrl.hostname.includes('generativelanguage.googleapis.com') ||
      /\/v1beta(?:\/|$)/i.test(modelsUrl.pathname);
    const path = modelsUrl.pathname.replace(/\/+$/, '');
    if (isGeminiEndpoint) {
      modelsUrl.pathname = path
        .replace(/\/models(?:\/[^/]+)?$/i, '')
        .replace(/\/[^/]+:generateContent$/i, '');
      if (!/\/v1beta$/i.test(modelsUrl.pathname)) {
        modelsUrl.pathname = `${modelsUrl.pathname.replace(/\/+$/, '')}/v1beta`;
      }
      modelsUrl.pathname = `${modelsUrl.pathname}/models`;
      modelsUrl.searchParams.set('key', key);
    } else {
      modelsUrl.pathname = path
        .replace(/\/chat\/completions$/i, '')
        .replace(/\/completions$/i, '')
        .replace(/\/models$/i, '');
      modelsUrl.pathname = `${modelsUrl.pathname.replace(/\/+$/, '')}/models`;
    }
    modelsUrl.hash = '';

    setIsLoadingApiModels(true);
    setApiModels([]);
    setApiError('');
    setApiMessage('');
    try {
      const response = await fetch(modelsUrl.toString(), {
        method: 'GET',
        headers: isGeminiEndpoint
          ? { 'Content-Type': 'application/json' }
          : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`模型拉取失败（HTTP ${response.status}）：${detail || response.statusText}`);
      }

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object') {
        throw new Error('接口返回的数据格式无效。');
      }
      const rawModels = Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : Array.isArray((payload as { models?: unknown }).models)
          ? (payload as { models: unknown[] }).models
          : [];
      const models = rawModels.flatMap((item): ApiModel[] => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        if (
          Array.isArray(record.supportedGenerationMethods) &&
          !record.supportedGenerationMethods.includes('generateContent')
        ) return [];
        const rawId = typeof record.id === 'string'
          ? record.id
          : typeof record.name === 'string'
            ? record.name.replace(/^models\//, '')
            : '';
        if (!rawId) return [];
        const label = typeof record.displayName === 'string'
          ? `${record.displayName} (${rawId})`
          : rawId;
        return [{ id: rawId, label }];
      });
      if (models.length === 0) {
        throw new Error('接口已响应，但没有找到可用模型；请确认反代是否开放模型列表接口。');
      }
      setApiModels(models);
      setApiMessage(`连接成功，已拉取 ${models.length} 个模型。`);
    } catch (error) {
      console.error('Could not fetch API models.', error);
      setApiError(
        error instanceof Error
          ? `${error.message}${error instanceof TypeError ? '；也可能是反代未允许浏览器跨域请求（CORS）。' : ''}`
          : '模型拉取失败，请检查反代地址、密钥及网络。'
      );
    } finally {
      setIsLoadingApiModels(false);
    }
  };

  const handleSaveLockSettings = () => {
    if (lockMode === 'password' && !/^\d{4}$/.test(passwordDraft)) {
      setLockSettingsError('请设置 4 位数字密码。');
      setLockSettingsSaved(false);
      return;
    }

    const saved = onSaveLockSettings({
      mode: lockMode,
      password: lockMode === 'password' ? passwordDraft : '',
    });
    setLockSettingsError(saved ? '' : '保存失败，请检查浏览器本地存储空间后重试。');
    setLockSettingsSaved(saved);
  };

  const handleExportBackup = () => {
    try {
      const data: Record<string, string> = {};
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key !== null) {
          const value = window.localStorage.getItem(key);
          if (value !== null) data[key] = value;
        }
      }
      const content = JSON.stringify(
        { format: 'yyphone-backup', version: 1, exportedAt: new Date().toISOString(), data },
        null,
        2
      );
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'yyphone-backup.json';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setBackupError('');
      setBackupMessage('整机数据已导出。');
    } catch (error) {
      console.error('Could not export device backup.', error);
      setBackupMessage('');
      setBackupError('导出失败，请稍后重试。');
    }
  };

  const handleImportBackup = async (file?: File) => {
    if (!file) return;
    setBackupMessage('');
    setBackupError('');
    try {
      const imported: unknown = JSON.parse(await file.text());
      if (
        !imported ||
        typeof imported !== 'object' ||
        (imported as { format?: unknown }).format !== 'yyphone-backup' ||
        (imported as { version?: unknown }).version !== 1
      ) {
        throw new Error('文件格式不正确或版本不受支持。');
      }

      const data = (imported as { data?: unknown }).data;
      if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        !Object.values(data).every((value) => typeof value === 'string')
      ) {
        throw new Error('备份文件中的数据内容无效。');
      }
      if (!window.confirm('导入将替换当前浏览器中本应用的全部本地数据，确定继续吗？')) return;

      const previousData: Record<string, string> = {};
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key !== null) {
          const value = window.localStorage.getItem(key);
          if (value !== null) previousData[key] = value;
        }
      }

      try {
        window.localStorage.clear();
        Object.entries(data).forEach(([key, value]) => window.localStorage.setItem(key, value));
      } catch (error) {
        try {
          window.localStorage.clear();
          Object.entries(previousData).forEach(([key, value]) =>
            window.localStorage.setItem(key, value)
          );
        } catch (restoreError) {
          console.error('Could not restore local data after backup import failed.', restoreError);
          throw new Error('导入失败，且恢复原有数据也失败；请勿关闭页面并检查浏览器存储空间。');
        }
        throw error;
      }

      setBackupMessage('整机数据导入成功，即将重新载入。');
      window.location.reload();
    } catch (error) {
      console.error('Could not import device backup.', error);
      setBackupError(error instanceof Error ? error.message : '无法导入该备份文件。');
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F6F8] overflow-hidden">
      <AppHeader title="设置 · 系统配置" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <Key className="w-3.5 h-3.5 text-sky-600" />
            <span>API 配置预设</span>
          </div>
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex gap-2">
              <select
                value={selectedApiPresetId}
                onChange={(event) => handleSelectApiPreset(event.target.value)}
                className="min-w-0 flex-1 bg-white/70 border border-white rounded-xl px-3 py-2 text-xs text-[#2C4A5C] outline-none"
                aria-label="选择 API 配置预设"
              >
                <option value="">新建 API 配置</option>
                {apiPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNewApiPreset}
                aria-label="新建 API 配置预设"
                className="shrink-0 rounded-xl bg-white/80 border border-white px-3 text-xs font-semibold text-[#2C4A5C]"
              >
                <Plus className="inline w-3.5 h-3.5 mr-1" />新建
              </button>
            </div>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              预设名称
              <input
                value={apiName}
                onChange={(event) => setApiName(event.target.value)}
                maxLength={50}
                placeholder="例如：我的 API"
                className="mt-1 w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs outline-none"
              />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              API 接入端点
              <input
                type="text"
                inputMode="url"
                value={apiEndpoint}
                onChange={(event) => {
                  setApiEndpoint(event.target.value);
                  setApiModels([]);
                }}
                placeholder="反代 Base URL，例如 https://proxy.example.com/v1"
                className="mt-1 w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs font-mono outline-none"
              />
              <span className="mt-1 block text-[10px] font-normal text-slate-400">
                支持 OpenAI 兼容反代；可填写 Base URL、/v1 或完整的 /chat/completions 地址。
              </span>
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              API Key
              <span className="relative mt-1 flex items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setApiModels([]);
                  }}
                  placeholder="输入 API Key"
                  className="min-w-0 w-full overflow-x-auto bg-white/70 border border-white rounded-xl pl-3 pr-10 py-2 text-xs font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((visible) => !visible)}
                  aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                  className="absolute right-3 text-slate-400"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </span>
            </label>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                模型标识
                <input
                  value={apiModel}
                  onChange={(event) => setApiModel(event.target.value)}
                  placeholder="拉取模型后选择，或手动填写模型 ID"
                  className="mt-1 w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs font-mono outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleFetchApiModels()}
                disabled={isLoadingApiModels}
                className="w-full rounded-xl bg-white/80 border border-white py-2 text-xs font-semibold text-[#2C4A5C] disabled:opacity-50"
              >
                {isLoadingApiModels ? '正在测试并拉取模型…' : '拉取模型'}
              </button>
              {apiModels.length > 0 && (
                <label className="block text-[10px] font-semibold text-slate-600">
                  选择模型
                  <select
                    value={apiModels.some((model) => model.id === apiModel) ? apiModel : ''}
                    onChange={(event) => setApiModel(event.target.value)}
                    className="mt-1 w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="">请选择已拉取的模型</option>
                    {apiModels.map((model) => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveApiPreset}
                className="flex-1 rounded-xl bg-sky-600 text-white py-2 text-xs font-bold"
              >
                <Save className="inline w-3.5 h-3.5 mr-1" />保存预设
              </button>
              {selectedApiPresetId && (
                <button
                  type="button"
                  onClick={handleDeleteApiPreset}
                  className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                >
                  <Trash2 className="inline w-3.5 h-3.5 mr-1" />删除
                </button>
              )}
            </div>
            {apiMessage && <p className="text-[11px] text-emerald-700">{apiMessage}</p>}
            {apiError && <p role="alert" className="text-[11px] text-rose-600">{apiError}</p>}
            <p className="text-[10px] text-slate-400">
              预设保存在当前浏览器；备份文件可能包含 API Key，请妥善保管。
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <Database className="w-3.5 h-3.5 text-sky-600" />
            <span>小手机备份</span>
          </div>
          <div className="glass-card rounded-2xl p-4 space-y-2.5">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              导出整机本地数据为 JSON 文件，或从备份文件恢复。导入会替换当前浏览器中的全部本地数据。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 rounded-xl bg-white/80 border border-white py-2 text-xs font-bold text-[#2C4A5C]"
              >
                <Download className="inline w-3.5 h-3.5 mr-1" />导出数据
              </button>
              <label className="flex-1 cursor-pointer rounded-xl bg-sky-600 py-2 text-center text-xs font-bold text-white">
                <Upload className="inline w-3.5 h-3.5 mr-1" />导入数据
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    void handleImportBackup(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {backupMessage && <p className="text-[11px] text-emerald-700">{backupMessage}</p>}
            {backupError && <p role="alert" className="text-[11px] text-rose-600">{backupError}</p>}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            <span>系统交互偏好</span>
          </div>
          <div className="glass-card rounded-2xl divide-y divide-slate-100/60 overflow-hidden">
            <div className="p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-sky-600" />
                <div>
                  <p className="text-xs font-bold text-[#2C4A5C]">锁屏与密码</p>
                  <span className="text-[10px] text-slate-400">密码仅保存在当前浏览器，用于应用内锁屏</span>
                </div>
              </div>
              <select
                value={lockMode}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'none' || value === 'lock' || value === 'password') {
                    setLockMode(value);
                  }
                  setLockSettingsSaved(false);
                  setLockSettingsError('');
                }}
                className="w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs text-[#2C4A5C] outline-none"
                aria-label="锁屏模式"
              >
                <option value="none">不使用锁屏，直接进入主屏</option>
                <option value="lock">使用锁屏，轻触直接进入</option>
                <option value="password">使用锁屏和数字密码</option>
              </select>
              {lockMode === 'password' && (
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={passwordDraft}
                  onChange={(event) => {
                    setPasswordDraft(event.target.value.replace(/\D/g, '').slice(0, 4));
                    setLockSettingsSaved(false);
                    setLockSettingsError('');
                  }}
                  placeholder="设置 4 位数字密码"
                  aria-label="设置锁屏密码"
                  className="w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs text-[#2C4A5C] outline-none tracking-[0.3em]"
                />
              )}
              <button
                onClick={handleSaveLockSettings}
                className="w-full rounded-xl bg-sky-600 text-white py-2 text-xs font-bold active:scale-[0.98]"
              >
                保存锁屏设置
              </button>
              {lockSettingsSaved && <p className="text-[11px] text-emerald-700">锁屏设置已保存。</p>}
              {lockSettingsError && <p role="alert" className="text-[11px] text-rose-600">{lockSettingsError}</p>}
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <p className="text-xs font-bold text-[#2C4A5C]">顶部状态栏显示</p>
                <span className="text-[10px] text-slate-400">时间、电量、灵动岛指示器</span>
              </div>
              <button
                onClick={onToggleStatusBar}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  showStatusBar ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    showStatusBar ? 'left-5.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {lockSettings.mode !== 'none' && (
              <div className="flex items-center justify-between p-3.5">
                <div>
                  <p className="text-xs font-bold text-[#2C4A5C]">立即锁定屏幕</p>
                  <span className="text-[10px] text-slate-400">返回锁屏界面</span>
                </div>
                <button
                  onClick={onLockScreen}
                  className="px-3 py-1 rounded-lg bg-white/80 border border-slate-200 text-xs font-bold text-[#2C4A5C] hover:bg-white active:scale-95"
                >
                  锁定
                </button>
              </div>
            )}
          </div>
        </section>
        <footer className="pt-2 pb-1 text-center text-[10px] text-slate-400">YYphone</footer>
      </div>
    </div>
  );
};
