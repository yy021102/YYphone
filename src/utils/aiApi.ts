import { readSetting, SETTINGS_KEYS } from './settings';
import { withGlobalWorldBooks } from './worldBookPrompt';
import { parseImageReference } from './imageReference';
import { apiTemperature, textApiConfig } from './textApiConfig';

export interface ApiConnection {
  endpoint: string;
  apiKey: string;
  model?: string;
  temperature?: number;
}

interface ApiPreset extends ApiConnection {
  id: string;
  name: string;
}

const isApiPresetList = (value: unknown): value is ApiPreset[] =>
  Array.isArray(value) &&
  value.every(
    (preset) =>
      !!preset &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      typeof preset.endpoint === 'string' &&
      typeof preset.apiKey === 'string' &&
      (preset.model === undefined || typeof preset.model === 'string')
  );

export const getActiveApiPreset = () => {
  const presets = readSetting(SETTINGS_KEYS.apiPresets, [] as ApiPreset[], isApiPresetList);
  const activeId = readSetting(
    SETTINGS_KEYS.activeApiPreset,
    presets[0]?.id ?? '',
    (value): value is string => typeof value === 'string'
  );
  const preset = presets.find((item) => item.id === activeId) ??
    presets.find((item) => item.endpoint.trim() && item.apiKey.trim());
  if (!preset?.endpoint.trim() || !preset.apiKey.trim()) {
    throw new Error('请先在设置页填写并保存有效的 API 端点与密钥。');
  }
  return preset;
};

const readOpenAiContent = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.flatMap((part) =>
      part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        ? [(part as { text: string }).text]
        : []
    ).join('');
  }
  return '';
};

export const requestConfiguredAiText = async (
  systemPrompt: string,
  userPrompt: string,
  options: {
    json?: boolean;
    temperature?: number;
    maxTokens?: number;
    api?: ApiConnection;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    includeGlobalWorldBooks?: boolean;
    imageUrls?: string[];
    signal?: AbortSignal;
  } = {}
) => {
  if (options.includeGlobalWorldBooks !== false) systemPrompt = withGlobalWorldBooks(systemPrompt, [...(options.history ?? []).map(message => message.content), userPrompt]);
  const preset = options.api ?? getActiveApiPreset();
  if (!preset.endpoint.trim() || !preset.apiKey.trim()) {
    throw new Error('请填写所选 API 的接口地址和密钥。');
  }
  const connection = textApiConfig(preset);
  const temperature = options.temperature ?? apiTemperature(preset.temperature);
  let response: Response;
  let responseText = '';
  const images = (options.imageUrls ?? []).filter(url => /^data:image\/(png|jpeg|webp);base64,/i.test(url)).slice(-4);

  if (connection.google) {
    response = await fetch(connection.url, {
      method: 'POST',
      signal: options.signal,
      headers: connection.headers,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          ...(options.history ?? []).map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          { role: 'user', parts: [{ text: userPrompt }, ...images.map(url => ({ inlineData: { mimeType: url.slice(5, url.indexOf(';')), data: url.slice(url.indexOf(',') + 1) } }))] },
        ],
        ...(options.json || temperature !== undefined || options.maxTokens !== undefined
          ? {
              generationConfig: {
                ...(options.json ? { responseMimeType: 'application/json' } : {}),
                ...(temperature !== undefined ? { temperature } : {}),
                ...(options.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {}),
              },
            }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(`AI 请求失败（HTTP ${response.status}）：${await response.text()}`);
    const payload: unknown = await response.json();
    const candidate = (payload as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }).candidates?.[0];
    responseText = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  } else {
    response = await fetch(connection.url, {
      method: 'POST',
      signal: options.signal,
      headers: connection.headers,
      body: JSON.stringify({
        model: connection.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(options.history ?? []),
          { role: 'user', content: images.length ? [{ type: 'text', text: userPrompt }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))] : userPrompt },
        ],
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      }),
    });
    if (!response.ok) throw new Error(`AI 请求失败（HTTP ${response.status}）：${await response.text()}`);
    responseText = readOpenAiContent(await response.json());
  }

  const trimmed = responseText.trim();
  if (!trimmed) throw new Error('AI 返回了空内容。');
  return trimmed.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
};

export const requestConfiguredImage = async (
  prompt: string,
  options: { model: string; api: ApiConnection; size?: string; referenceImage?: string; referenceImages?: string[]; similarity?: number; signal?: AbortSignal }
): Promise<string> => {
  const endpoint = options.api.endpoint.trim().replace(/\/+$/, '');
  if (!endpoint || !options.api.apiKey.trim() || !options.model.trim()) {
    throw new Error('生图模型缺少接口地址、Key 或模型 ID。');
  }
  if (endpoint.includes('generativelanguage.googleapis.com')) {
    throw new Error('当前生图流程需要 OpenAI 兼容的 /images/generations 接口；Gemini API 不支持此接口格式。');
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(endpoint);
    if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
      throw new Error('生图接口必须使用 HTTP 或 HTTPS。');
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '生图接口地址无效。');
  }
  baseUrl.pathname = baseUrl.pathname
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/images\/generations$/i, '');
  baseUrl.pathname = baseUrl.pathname.replace(/\/images\/edits$/i, '');
  const references = options.referenceImages ?? (options.referenceImage ? [options.referenceImage] : []);
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/images/${references.length ? 'edits' : 'generations'}`;
  baseUrl.search = '';
  baseUrl.hash = '';

  let body: BodyInit;
  if (references.length) {
    const form = new FormData();
    form.set('model', options.model.trim());
    form.set('prompt', prompt);
    form.set('n', '1');
    if (options.size) form.set('size', options.size);
    references.forEach((image, index) => {
      const reference = parseImageReference(image);
      form.append(references.length === 1 ? 'image' : 'image[]', reference.blob, `reference-${index + 1}.${reference.mimeType === 'image/jpeg' ? 'jpg' : reference.mimeType.split('/')[1]}`);
    });
    if (/^gpt-image-1(?:\.5)?$/.test(options.model.trim())) form.set('input_fidelity', (options.similarity ?? 0.7) >= 0.65 ? 'high' : 'low');
    body = form;
  } else body = JSON.stringify({ model: options.model.trim(), prompt, n: 1, ...(options.size ? { size: options.size } : {}) });
  const response = await fetch(baseUrl, {
    signal: options.signal,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.api.apiKey}`,
      ...(!references.length ? { 'Content-Type': 'application/json' } : {}),
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`生图失败（HTTP ${response.status}）：${detail || response.statusText}`);
  }
  const payload: unknown = await response.json();
  const image = payload && typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: unknown[] }).data[0]
    : undefined;
  if (!image || typeof image !== 'object') throw new Error('生图接口没有返回图片。');
  const result = image as { url?: unknown; b64_json?: unknown };
  if (typeof result.url === 'string' && /^https?:\/\//i.test(result.url)) return result.url;
  if (typeof result.b64_json === 'string' && result.b64_json) {
    return `data:image/png;base64,${result.b64_json}`;
  }
  throw new Error('生图接口返回的数据中没有有效的图片 URL 或 base64 图片。');
};
