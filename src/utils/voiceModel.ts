import { readSetting, SETTINGS_KEYS } from './settings';

export type VoiceProvider = 'openai' | 'minimax' | 'moss';

export const VOICE_PROVIDER_OPTIONS: Array<{ value: VoiceProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI 兼容（/audio/speech）' },
  { value: 'minimax', label: 'MiniMax TTS（t2a_v2）' },
  { value: 'moss', label: 'MOSS-TTS' },
];

export interface VoiceModelSettings {
  provider?: VoiceProvider;
  id: string;
  key: string;
  model: string;
  domesticEndpoint: string;
  overseasEndpoint: string;
  region: 'domestic' | 'overseas';
}

export const DEFAULT_VOICE_MODEL_SETTINGS: VoiceModelSettings = {
  provider: 'openai',
  id: '',
  key: '',
  model: '',
  domesticEndpoint: '',
  overseasEndpoint: '',
  region: 'domestic',
};

const PROVIDER_DEFAULTS: Record<VoiceProvider, { domestic: string; overseas: string; model: string }> = {
  openai: { domestic: '', overseas: 'https://api.openai.com/v1', model: 'tts-1' },
  minimax: { domestic: 'https://api.minimaxi.com', overseas: 'https://api.minimax.io', model: 'speech-02-hd' },
  moss: { domestic: '', overseas: '', model: '' },
};

export const getVoiceProviderDefaults = (provider: VoiceProvider) => PROVIDER_DEFAULTS[provider];

const isVoiceProvider = (value: unknown): value is VoiceProvider =>
  value === 'openai' || value === 'minimax' || value === 'moss';

export const isVoiceModelSettings = (value: unknown): value is VoiceModelSettings =>
  !!value &&
  typeof value === 'object' &&
  ((value as VoiceModelSettings).provider === undefined || isVoiceProvider((value as VoiceModelSettings).provider)) &&
  typeof (value as VoiceModelSettings).id === 'string' &&
  typeof (value as VoiceModelSettings).key === 'string' &&
  typeof (value as VoiceModelSettings).model === 'string' &&
  typeof (value as VoiceModelSettings).domesticEndpoint === 'string' &&
  typeof (value as VoiceModelSettings).overseasEndpoint === 'string' &&
  ((value as VoiceModelSettings).region === 'domestic' ||
    (value as VoiceModelSettings).region === 'overseas');

export const readVoiceModelSettings = () =>
  readSetting(SETTINGS_KEYS.voiceModel, DEFAULT_VOICE_MODEL_SETTINGS, isVoiceModelSettings);

const LANGUAGE_CODES: Record<string, { iso: string; minimax: string }> = {
  中文: { iso: 'zh', minimax: 'Chinese' },
  粤语: { iso: 'yue', minimax: 'Chinese,Yue' },
  英语: { iso: 'en', minimax: 'English' },
  日语: { iso: 'ja', minimax: 'Japanese' },
  韩语: { iso: 'ko', minimax: 'Korean' },
  法语: { iso: 'fr', minimax: 'French' },
  德语: { iso: 'de', minimax: 'German' },
  西班牙语: { iso: 'es', minimax: 'Spanish' },
};

export const getVoiceLanguageCodes = (language: string) =>
  LANGUAGE_CODES[language.trim()] ?? { iso: language.trim() || 'zh', minimax: 'auto' };

const parseHttpUrl = (value: string, label: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}地址无效。`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label}必须使用 HTTP 或 HTTPS。`);
  }
  return url;
};

export const buildSpeechUrl = (endpoint: string) => {
  const base = endpoint.trim().replace(/\/+$/, '');
  return parseHttpUrl(/\/audio\/speech$/i.test(base) ? base : `${base}/audio/speech`, '语音模型接口');
};

export const buildMinimaxUrl = (endpoint: string, groupId: string) => {
  const base = endpoint.trim().replace(/\/+$/, '');
  const url = parseHttpUrl(
    /\/t2a_v2$/i.test(base) ? base : `${base.replace(/\/v1$/i, '')}/v1/t2a_v2`,
    'MiniMax 接口'
  );
  if (groupId.trim()) url.searchParams.set('GroupId', groupId.trim());
  return url;
};

const base64ToBytes = (value: string) => {
  const binary = atob(value.replace(/^data:[^,]*,/, '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export const hexToBytes = (value: string) => {
  const clean = value.trim();
  if (!clean || clean.length % 2 !== 0 || /[^0-9a-f]/i.test(clean)) {
    throw new Error('语音模型返回的音频数据格式无效。');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const readErrorDetail = async (response: Response) => {
  const detail = await response.text().catch(() => '');
  return `语音合成失败（HTTP ${response.status}）：${detail.slice(0, 300) || response.statusText}`;
};

// Some self-hosted TTS servers return JSON with base64/hex audio or a URL instead of raw audio bytes.
const readAudioFromJson = async (payload: unknown): Promise<Blob> => {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const nested = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : {};
  const candidates = [record.audio, record.audio_data, record.audio_base64, nested.audio, nested.audio_data, record.data];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    if (/^https?:\/\//i.test(candidate)) {
      const audioResponse = await fetch(candidate);
      if (!audioResponse.ok) throw new Error(`下载语音失败（HTTP ${audioResponse.status}）。`);
      return audioResponse.blob();
    }
    const bytes = /^[0-9a-f]+$/i.test(candidate) && candidate.length % 2 === 0
      ? hexToBytes(candidate)
      : base64ToBytes(candidate);
    return new Blob([bytes], { type: 'audio/mpeg' });
  }
  const message = typeof record.message === 'string' ? record.message
    : typeof record.error === 'string' ? record.error : '';
  throw new Error(message ? `语音合成失败：${message}` : '语音模型没有返回音频。');
};

const readAudioResponse = async (response: Response) => {
  if (!response.ok) throw new Error(await readErrorDetail(response));
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) return readAudioFromJson(await response.json());
  return response.blob();
};

export async function synthesizeVoice(
  text: string,
  voiceId: string,
  language: string
): Promise<Blob> {
  const settings = readVoiceModelSettings();
  const provider = settings.provider ?? 'openai';
  const defaults = PROVIDER_DEFAULTS[provider];
  const endpoint = (settings.region === 'domestic' ? settings.domesticEndpoint : settings.overseasEndpoint).trim() ||
    (settings.region === 'domestic' ? defaults.domestic : defaults.overseas);
  const model = settings.model.trim() || defaults.model;
  const key = settings.key.trim();
  const codes = getVoiceLanguageCodes(language);
  if (!endpoint) throw new Error('请先在系统设置中填写语音模型的接口地址。');
  if (!key && provider !== 'moss') throw new Error('请先在系统设置中填写语音模型的 API Key。');
  if (!voiceId.trim()) throw new Error('请先在角色设定中填写语音 ID（音色）。');

  let audio: Blob;
  if (provider === 'minimax') {
    const response = await fetch(buildMinimaxUrl(endpoint, settings.id), {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        text,
        stream: false,
        language_boost: codes.minimax,
        output_format: 'hex',
        voice_setting: { voice_id: voiceId.trim(), speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      }),
    });
    if (!response.ok) throw new Error(await readErrorDetail(response));
    const payload = await response.json() as {
      data?: { audio?: unknown };
      base_resp?: { status_code?: number; status_msg?: string };
    };
    if (payload.base_resp?.status_code) {
      throw new Error(`MiniMax 语音合成失败（${payload.base_resp.status_code}）：${payload.base_resp.status_msg ?? ''}`);
    }
    if (typeof payload.data?.audio !== 'string') throw new Error('MiniMax 没有返回音频。');
    audio = new Blob([hexToBytes(payload.data.audio)], { type: 'audio/mpeg' });
  } else {
    const response = await fetch(buildSpeechUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(settings.id.trim() ? { 'X-API-ID': settings.id.trim() } : {}),
      },
      body: JSON.stringify(provider === 'moss'
        ? {
            ...(model ? { model } : {}),
            text,
            input: text,
            voice_id: voiceId.trim(),
            voice: voiceId.trim(),
            language: codes.iso,
            response_format: 'mp3',
          }
        : {
            model,
            input: text,
            voice: voiceId.trim(),
            language: codes.iso,
            response_format: 'mp3',
          }),
    });
    audio = await readAudioResponse(response);
  }
  if (!audio.size) throw new Error('语音模型返回了空音频。');
  return audio;
}
