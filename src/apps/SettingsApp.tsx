import React, { useState } from 'react';
import { McpSettingsPanel } from '../components/McpSettingsPanel';
import {
  Check,
  ChevronDown,
  Database,
  Download,
  Eye,
  EyeOff,
  ImageDown,
  Image as ImageIcon,
  Key,
  Lock,
  Plus,
  Bell,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { VoiceConnectionTest, ImageConnectionTest } from '../components/MediaConnectionTests';
import { ChatRuntimeSettings } from '../utils/chatRuntime';
import { useErrorDialog } from '../components/ErrorDialog';
import {
  readSetting,
  removeSetting,
  resetAllSettings,
  saveSetting,
  SETTINGS_KEYS,
} from '../utils/settings';
import {
  getAllCachedStorageItems,
  initializeDbStorage,
  replaceDbStorage,
} from '../utils/dbStorage';
import { compressUploadedImages } from '../utils/bulkImageCompression';
import {
  getVoiceProviderDefaults,
  readVoiceModelSettings,
  VOICE_PROVIDER_OPTIONS,
  VoiceModelSettings,
} from '../utils/voiceModel';
import {
  IMAGE_PROVIDER_DEFAULTS,
  IMAGE_PROVIDER_OPTIONS,
  ImageGenerationSettings,
  isImageGenerationProvider,
  readImageGenerationSettings,
  defaultImageSize,
  imageSizeOptions,
  isImageSizePreset,
} from '../utils/imageGeneration';

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
  littlePVisible: boolean;
  onSaveLittlePVisible: (visible: boolean) => boolean;
  runtimeSettings: ChatRuntimeSettings;
  onSaveRuntimeSettings: (settings: ChatRuntimeSettings, resumeKeepAlive?: boolean) => Promise<boolean>;
  keepAliveStatus: string;
  onBack: () => void;
  showStatusBar: boolean;
  onToggleStatusBar: () => boolean;
  followSystemDark: boolean;
  onToggleFollowSystemDark: () => boolean;
  onLockScreen: () => void;
  lockSettings: { mode: 'none' | 'lock' | 'password'; password: string };
  onSaveLockSettings: (settings: {
    mode: 'none' | 'lock' | 'password';
    password: string;
  }) => boolean;
}

export const SettingsApp: React.FC<SettingsAppProps> = ({
  littlePVisible,
  onSaveLittlePVisible,
  runtimeSettings,
  onSaveRuntimeSettings,
  keepAliveStatus,
  onBack,
  showStatusBar,
  onToggleStatusBar,
  followSystemDark,
  onToggleFollowSystemDark,
  onLockScreen,
  lockSettings,
  onSaveLockSettings,
}) => {
  const [apiConfigExpanded, setApiConfigExpanded] = useState(() =>
    readSetting(SETTINGS_KEYS.apiConfigExpanded, true, (value): value is boolean => typeof value === 'boolean')
  );
  const [voiceConfigExpanded, setVoiceConfigExpanded] = useState(() =>
    readSetting(SETTINGS_KEYS.voiceConfigExpanded, true, (value): value is boolean => typeof value === 'boolean')
  );
  const [imageConfigExpanded, setImageConfigExpanded] = useState(() =>
    readSetting(SETTINGS_KEYS.imageConfigExpanded, true, (value): value is boolean => typeof value === 'boolean')
  );
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const [lockMode, setLockMode] = useState(lockSettings.mode);
  const [passwordDraft, setPasswordDraft] = useState(lockSettings.password);
  const [lockSettingsSaved, setLockSettingsSaved] = useState(false);
  const [lockSettingsError, setLockSettingsError] = useState('');
  useErrorDialog(lockSettingsError);
  const [apiPresets, setApiPresets] = useState(() =>
    readSetting(SETTINGS_KEYS.apiPresets, [] as ApiPreset[], isApiPresetList)
  );
  const activeApiPresetId = readSetting(
    SETTINGS_KEYS.activeApiPreset,
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
  useErrorDialog(apiError, 'API 配置出错了');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  useErrorDialog(backupError, '备份出错了');
  const [statusBarError, setStatusBarError] = useState('');
  useErrorDialog(statusBarError);
  const [voiceModelDraft, setVoiceModelDraft] = useState<VoiceModelSettings>(readVoiceModelSettings);
  const [voiceModelMessage, setVoiceModelMessage] = useState('');
  const voiceProvider = voiceModelDraft.provider ?? 'openai';
  const voiceDefaults = getVoiceProviderDefaults(voiceProvider);
  const [imageGenerationDraft, setImageGenerationDraft] = useState<ImageGenerationSettings>(readImageGenerationSettings);
  const [imageGenerationMessage, setImageGenerationMessage] = useState('');
  const imageDefaults = IMAGE_PROVIDER_DEFAULTS[imageGenerationDraft.provider];
  const [imageCompressionBusy, setImageCompressionBusy] = useState(false);
  const [imageCompressionMessage, setImageCompressionMessage] = useState('');

  const updateRuntime = async (patch: Partial<ChatRuntimeSettings>) => {
    setRuntimeBusy(true);
    try {
      if (patch.systemNotifications) {
        if (!('Notification' in window)) throw new Error('此浏览器不支持系统通知；iPhone 通常需要先添加到主屏幕。');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('系统通知未获授权，请在浏览器或系统设置中允许通知。机内横幅可单独开启。');
      }
      await onSaveRuntimeSettings({ ...runtimeSettings, ...patch }, patch.keepAlive === true);
    } catch (error) {
      console.error('Could not enable notification permission.', error);
      setStatusBarError(error instanceof Error ? error.message : '功能开启失败，请重试。');
    } finally {
      setRuntimeBusy(false);
    }
  };

  const persistApiPresets = (nextPresets: ApiPreset[]): boolean => {
    try {
      saveSetting(SETTINGS_KEYS.apiPresets, nextPresets);
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
      saveSetting(SETTINGS_KEYS.activeApiPreset, preset.id);
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
    if (preset) saveSetting(SETTINGS_KEYS.activeApiPreset, id);
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
    if (nextPreset) saveSetting(SETTINGS_KEYS.activeApiPreset, nextPreset.id);
    else removeSetting(SETTINGS_KEYS.activeApiPreset);
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

  const handleSaveImageGeneration = () => {
    const endpoint = imageGenerationDraft.endpoint.trim();
    if (endpoint) {
      try {
        const url = new URL(endpoint);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid protocol');
      } catch {
        setImageGenerationMessage('生图接口地址无效，请填写 http(s):// 开头的地址或留空。');
        return;
      }
    }
    try {
      saveSetting(SETTINGS_KEYS.imageGeneration, { ...imageGenerationDraft, endpoint });
      setImageGenerationMessage('生图模型配置已保存。');
      setStatusBarError('');
    } catch (error) {
      console.error('Could not save image generation settings.', error);
      setImageGenerationMessage('');
      setStatusBarError('生图模型配置保存失败，请检查浏览器本地存储空间。');
    }
  };

  const handleSaveVoiceModel = () => {
    try {
      saveSetting(SETTINGS_KEYS.voiceModel, voiceModelDraft);
      setVoiceModelMessage('语音模型配置已保存。');
      setStatusBarError('');
    } catch (error) {
      console.error('Could not save voice model settings.', error);
      setVoiceModelMessage('');
      setStatusBarError('语音模型配置保存失败，请检查浏览器本地存储空间。');
    }
  };

  const handleCompressUploadedImages = async () => {
    setImageCompressionBusy(true);
    setImageCompressionMessage('');
    try {
      const count = await compressUploadedImages();
      setImageCompressionMessage(count > 0
        ? `已压缩 ${count} 张聊天、朋友圈或论坛图片。`
        : '没有需要压缩的图片。');
    } catch (error) {
      console.error('Could not compress uploaded images.', error);
      setImageCompressionMessage(error instanceof Error ? `压缩失败：${error.message}` : '图片压缩失败，请重试。');
    } finally {
      setImageCompressionBusy(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      await initializeDbStorage();
      const data = getAllCachedStorageItems();
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
      const backupData = data as Record<string, string>;
      if (!window.confirm('导入将替换当前浏览器中本应用的全部本地数据，确定继续吗？')) return;

      await initializeDbStorage();
      const previousData = getAllCachedStorageItems();

      try {
        await replaceDbStorage(backupData);
      } catch (error) {
        try {
          await replaceDbStorage(previousData);
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

  const handleFactoryReset = async () => {
    if (!window.confirm('恢复出厂设置将永久清除本浏览器中歪歪机的全部本地数据（包括聊天、角色、设置、API 配置和备份），且无法撤销。建议先导出备份。确定继续吗？')) {
      return;
    }
    try {
      await resetAllSettings();
      window.location.reload();
    } catch (error) {
      console.error('Could not reset local app data.', error);
      setBackupError(error instanceof Error ? `恢复出厂设置失败：${error.message}` : '恢复出厂设置失败，请稍后重试。');
      setBackupMessage('');
    }
  };

  return (
    <div className="settings-app flex-1 w-full flex flex-col overflow-hidden">
      <AppHeader title="设置" subtitle="把小手机调成你喜欢的样子" onBack={onBack} />

      <div className="settings-content flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3 flex flex-col">
        <h2 className="settings-section-label">连接与模型<span>让每一次互动都有回应</span></h2>
        <details open={apiConfigExpanded} onToggle={(event) => {
          const expanded = event.currentTarget.open;
          if (expanded === apiConfigExpanded) return;
          try {
            saveSetting(SETTINGS_KEYS.apiConfigExpanded, expanded);
            setApiConfigExpanded(expanded);
          } catch (error) {
            event.currentTarget.open = apiConfigExpanded;
            console.error('Could not save API panel state.', error);
            setApiError('API 配置折叠状态保存失败，请重试。');
          }
        }} className="settings-card settings-model-panel" data-tone="blue">
          <summary className="settings-panel-heading">
            <span className="settings-icon"><Key size={18} strokeWidth={1.7} /></span>
            <span className="settings-heading-copy"><strong>API 配置预设</strong><small>聊天与内容生成</small></span>
            <ChevronDown size={16} className="settings-chevron" />
          </summary>
          <div className="settings-panel-body space-y-3">
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
                className="flex-1 rounded-xl settings-primary bg-sky-600 text-white py-2 text-xs font-bold"
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
        </details>
        <McpSettingsPanel />
        <details open={voiceConfigExpanded} onToggle={(event) => {
          const expanded = event.currentTarget.open;
          if (expanded === voiceConfigExpanded) return;
          try {
            saveSetting(SETTINGS_KEYS.voiceConfigExpanded, expanded);
            setVoiceConfigExpanded(expanded);
          } catch (error) {
            event.currentTarget.open = voiceConfigExpanded;
            console.error('Could not save voice panel state.', error);
            setApiError('语音模型折叠状态保存失败，请重试。');
          }
        }} className="settings-card settings-model-panel" data-tone="pink">
          <summary className="settings-panel-heading">
            <span className="settings-icon"><Volume2 size={18} strokeWidth={1.7} /></span>
            <span className="settings-heading-copy"><strong>语音模型</strong><small>朗读消息与语音通话</small></span>
            <ChevronDown size={16} className="settings-chevron" />
          </summary>
          <div className="settings-panel-body space-y-3">
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              服务商
              <select value={voiceProvider}
                onChange={(event) => setVoiceModelDraft({
                  ...voiceModelDraft,
                  provider: VOICE_PROVIDER_OPTIONS.find((option) => option.value === event.target.value)?.value ?? 'openai',
                })}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs">
                {VOICE_PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              {voiceProvider === 'minimax' ? 'Group ID（选填，旧版账号需要）' : 'API ID（选填）'}
              <input value={voiceModelDraft.id} onChange={(event) => setVoiceModelDraft({ ...voiceModelDraft, id: event.target.value })}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono outline-none" />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              API Key{voiceProvider === 'moss' ? '（自部署可留空）' : ''}
              <input type="password" autoComplete="off" value={voiceModelDraft.key}
                onChange={(event) => setVoiceModelDraft({ ...voiceModelDraft, key: event.target.value })}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono outline-none" />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              模型
              <input value={voiceModelDraft.model} onChange={(event) => setVoiceModelDraft({ ...voiceModelDraft, model: event.target.value })}
                placeholder={voiceDefaults.model ? `留空默认：${voiceDefaults.model}` : '选填'}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono outline-none" />
            </label>
            {([
              ['domesticEndpoint', '国内接口地址'],
              ['overseasEndpoint', '海外接口地址'],
            ] as const).map(([field, label]) => (
              <label key={field} className="block text-[11px] font-semibold text-[#2C4A5C]">
                {label}
                <input type="url" value={voiceModelDraft[field]}
                  onChange={(event) => setVoiceModelDraft({ ...voiceModelDraft, [field]: event.target.value })}
                  placeholder={(field === 'domesticEndpoint' ? voiceDefaults.domestic : voiceDefaults.overseas)
                    ? `留空默认：${field === 'domesticEndpoint' ? voiceDefaults.domestic : voiceDefaults.overseas}`
                    : '接口 Base URL'}
                  className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono outline-none" />
              </label>
            ))}
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              使用区域
              <select value={voiceModelDraft.region}
                onChange={(event) => setVoiceModelDraft({ ...voiceModelDraft, region: event.target.value === 'overseas' ? 'overseas' : 'domestic' })}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs">
                <option value="domestic">国内</option>
                <option value="overseas">海外</option>
              </select>
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              <span className="flex justify-between">语速<span>{(voiceModelDraft.speed ?? 1).toFixed(2)} 倍</span></span>
              <input type="range" aria-label="语速" min="0.5" max="2" step="0.05" value={voiceModelDraft.speed ?? 1}
                onChange={(event) => setVoiceModelDraft({ ...voiceModelDraft, speed: Number(event.target.value) })} className="mt-2 w-full" />
              <span className="mt-1 flex justify-between text-[10px] font-normal text-slate-400"><span>慢速 · 0.5×</span><span>正常 · 1×</span><span>快速 · 2×</span></span>
            </label>
            <p className="text-[10px] leading-relaxed text-slate-400">音色 ID 在角色设定中填写。语速保存后用于新生成的语音；MOSS 自部署接口需支持 speed 参数。密钥保存在本地。</p>
            <VoiceConnectionTest settings={voiceModelDraft} />
            <button type="button" onClick={handleSaveVoiceModel} className="w-full rounded-xl settings-primary bg-sky-600 py-2 text-xs font-bold text-white">保存语音模型</button>
            {voiceModelMessage && <p role="status" className="text-[11px] text-emerald-700">{voiceModelMessage}</p>}
          </div>
        </details>
        <details open={imageConfigExpanded} onToggle={(event) => {
          const expanded = event.currentTarget.open;
          if (expanded === imageConfigExpanded) return;
          try {
            saveSetting(SETTINGS_KEYS.imageConfigExpanded, expanded);
            setImageConfigExpanded(expanded);
          } catch (error) {
            event.currentTarget.open = imageConfigExpanded;
            console.error('Could not save image panel state.', error);
            setApiError('生图模型折叠状态保存失败，请重试。');
          }
        }} className="settings-card settings-model-panel" data-tone="lavender">
          <summary className="settings-panel-heading">
            <span className="settings-icon"><ImageIcon size={18} strokeWidth={1.7} /></span>
            <span className="settings-heading-copy"><strong>生图模型</strong><small>把聊天里的想象变成画面</small></span>
            <ChevronDown size={16} className="settings-chevron" />
          </summary>
          <div className="settings-panel-body space-y-3">
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              服务商
              <select value={imageGenerationDraft.provider}
                onChange={(event) => setImageGenerationDraft({
                  ...imageGenerationDraft,
                  provider: isImageGenerationProvider(event.target.value) ? event.target.value : 'openai',
                })}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs">
                {IMAGE_PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              接口地址（选填）
              <input type="url" value={imageGenerationDraft.endpoint}
                onChange={(event) => setImageGenerationDraft({ ...imageGenerationDraft, endpoint: event.target.value })}
                placeholder={imageDefaults.endpoint ? `留空默认：${imageDefaults.endpoint}` : '留空使用当前 API 地址'}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono outline-none" />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              API Key{imageGenerationDraft.provider === 'novelai' ? '' : '（选填）'}
              <input type="password" autoComplete="off" value={imageGenerationDraft.apiKey}
                onChange={(event) => setImageGenerationDraft({ ...imageGenerationDraft, apiKey: event.target.value })}
                placeholder={imageGenerationDraft.provider === 'novelai' ? 'NovelAI 必填（pst-...）' : '留空则在格式匹配时使用当前 API 的 Key'}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono outline-none" />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              模型（选填）
              <input value={imageGenerationDraft.model}
                onChange={(event) => setImageGenerationDraft({ ...imageGenerationDraft, model: event.target.value })}
                placeholder={`留空默认：${imageDefaults.model}`}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono outline-none" />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">图片尺寸
              <select aria-label="图片尺寸" value={imageGenerationDraft.size ?? defaultImageSize(imageGenerationDraft.provider)}
                onChange={(event) => { if (isImageSizePreset(event.target.value)) setImageGenerationDraft({ ...imageGenerationDraft, size: event.target.value }); }}
                className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs">
                {imageSizeOptions(imageGenerationDraft.provider).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {(imageGenerationDraft.provider === 'gemini' || imageGenerationDraft.provider === 'imagen') && <p className="text-[10px] text-slate-400">Google 接口按画面比例控制尺寸，实际像素由所选模型决定。</p>}
            <p className="text-[10px] leading-relaxed text-slate-400">在聊天的对话设置中开启“生图”后生效。留空地址或 Key 时，按服务商匹配规则复用已保存的主 API 配置。密钥保存在本地。</p>
            <ImageConnectionTest settings={imageGenerationDraft} />
            <button type="button" onClick={handleSaveImageGeneration} className="w-full rounded-xl settings-primary bg-sky-600 py-2 text-xs font-bold text-white">保存生图模型</button>
            {imageGenerationMessage && <p role="status" className={`text-[11px] ${imageGenerationMessage.includes('无效') ? 'text-red-600' : 'text-emerald-700'}`}>{imageGenerationMessage}</p>}
          </div>
        </details>
        <h2 className="settings-section-label">日常与体验<span>照顾你的使用习惯</span></h2>
        <section className="settings-card settings-preferences space-y-3">
          <h3 className="settings-card-heading">
            <span className="settings-icon" data-tone="lavender"><Sliders size={17} strokeWidth={1.7} /></span>
            <span>系统交互偏好</span>
          </h3>
          <div className="divide-y divide-slate-100/60">
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
                className="w-full rounded-xl settings-primary bg-sky-600 text-white py-2 text-xs font-bold active:scale-[0.98]"
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
              <input
                type="checkbox"
                aria-label="顶部状态栏显示"
                checked={showStatusBar}
                onChange={() => {
                  const saved = onToggleStatusBar();
                  setStatusBarError(saved ? '' : '状态栏设置保存失败，请检查浏览器本地存储空间。');
                }}
              />
            </div>
            <div className="flex items-center justify-between p-3.5">
              <div>
                  <p className="text-xs font-bold text-[#2C4A5C]">跟随系统深色模式</p>
                  <span className="text-[10px] text-slate-400">仅在设备启用深色外观时切换聊天界面</span>
              </div>
              <input type="checkbox" checked={followSystemDark} onChange={() => {
                  const saved = onToggleFollowSystemDark();
                  setStatusBarError(saved ? '' : '深色模式偏好保存失败，请检查浏览器本地存储空间。');
              }} aria-label="跟随系统深色模式" />
            </div>
            {statusBarError && <p role="alert" className="px-3.5 pb-2 text-[11px] text-rose-600">{statusBarError}</p>}

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
        <section className="settings-card space-y-3">
          <h3 className="settings-card-heading"><span className="settings-icon" data-tone="blue"><Bell size={17} strokeWidth={1.7} /></span>后台与消息提醒</h3>
          {([
            ['keepAlive', '后台保活（循环播放静默音频）'],
            ['banners', '新消息顶部弹窗'],
            ['systemNotifications', '浏览器系统通知'],
          ] as const).map(([key, label]) => (
            <label key={key} className="settings-toggle-row flex items-center justify-between gap-3 text-xs text-slate-600">
              <span>{label}</span>
              <input type="checkbox" checked={runtimeSettings[key]} disabled={runtimeBusy} onChange={(event) => void updateRuntime({ [key]: event.target.checked })} />
            </label>
          ))}
          <p className="text-[11px] leading-relaxed text-slate-500">
            主动消息及角色来电请在微信私聊右上角的对话设置中单独调整。保活只尝试降低网页暂停概率，不能保证锁屏、系统冻结或关闭网页后仍运行，也可能增加耗电。系统通知需授权，是否展示取决于浏览器与系统。
          </p>
          <p className="text-[11px] text-sky-700" role="status">保活状态：{keepAliveStatus || '未开启'}</p>
          {runtimeSettings.keepAlive && <button type="button" disabled={runtimeBusy} onClick={() => void updateRuntime({ keepAlive: true })} className="text-xs font-semibold text-sky-600">恢复保活</button>}
        </section>
        <section className="settings-card space-y-3">
          <h3 className="settings-card-heading"><span className="settings-icon" data-tone="pink"><Sparkles size={17} strokeWidth={1.7} /></span>小P · YYphone 小精灵</h3>
          <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
            在主页显示小精灵入口
            <input type="checkbox" checked={littlePVisible} onChange={(event) => onSaveLittlePVisible(event.target.checked)} aria-label="显示小P主页入口" />
          </label>
          <p className="text-[11px] leading-relaxed text-slate-500">可答疑、指路、日常聊天和发表情包，不代操作。功能指南离线可看；AI 回复使用当前主 API，默认携带最近 100 条小P消息，没有长期记忆配置，不读取角色聊天或全局世界书。隐藏入口不删除聊天。</p>
        </section>
        <h2 className="settings-section-label">数据与维护<span>给小世界留一份存档</span></h2>
        <section className="settings-card space-y-3">
          <h3 className="settings-card-heading"><span className="settings-icon" data-tone="blue"><ImageDown size={17} strokeWidth={1.7} /></span>图片空间整理</h3>
          <p className="text-[10px] leading-relaxed text-slate-500">压缩聊天消息、朋友圈和论坛帖子中的已发送图片；不会处理 App 图标、壁纸、锁屏、聊天背景或头像。</p>
          <button type="button" disabled={imageCompressionBusy} onClick={() => void handleCompressUploadedImages()}
            className="w-full rounded-xl bg-white/80 py-2 text-xs font-bold text-[#2C4A5C] disabled:opacity-50">
            {imageCompressionBusy ? '正在压缩图片…' : '一键压缩已发送图片'}
          </button>
          {imageCompressionMessage && <p role="status" className="text-[11px] text-sky-700">{imageCompressionMessage}</p>}
        </section>
        <section className="settings-card space-y-3">
          <h3 className="settings-card-heading">
            <span className="settings-icon" data-tone="lavender"><Database size={17} strokeWidth={1.7} /></span>
            <span>小手机备份</span>
          </h3>
          <div className="space-y-2.5">
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
              <label className="flex-1 cursor-pointer rounded-xl settings-primary bg-sky-600 py-2 text-center text-xs font-bold text-white">
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
            <button
              type="button"
              onClick={handleFactoryReset}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-bold text-rose-700"
            >
              <RotateCcw className="inline w-3.5 h-3.5 mr-1" />恢复出厂设置
            </button>
          </div>
        </section>
        <footer className="settings-footer">YYphone · 你的随身小世界</footer>
      </div>
    </div>
  );
};
