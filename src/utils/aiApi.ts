import { readSetting, SETTINGS_KEYS } from './settings';
import { withGlobalWorldBooks } from './worldBookPrompt';

interface ApiPreset {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model?: string;
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
  options: { json?: boolean } = {}
) => {
  systemPrompt = withGlobalWorldBooks(systemPrompt);
  const preset = getActiveApiPreset();
  const endpoint = preset.endpoint.trim().replace(/\/+$/, '');
  const model = preset.model?.trim() || 'gpt-4o-mini';
  let response: Response;
  let responseText = '';

  if (endpoint.includes('generativelanguage.googleapis.com')) {
    const responseUrl = /:generateContent$/i.test(endpoint)
      ? `${endpoint}?key=${encodeURIComponent(preset.apiKey)}`
      : `${endpoint}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(preset.apiKey)}`;
    response = await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        ...(options.json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    });
    if (!response.ok) throw new Error(`AI 请求失败（HTTP ${response.status}）：${await response.text()}`);
    const payload: unknown = await response.json();
    const candidate = (payload as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }).candidates?.[0];
    responseText = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  } else {
    const chatEndpoint = /\/chat\/completions$/i.test(endpoint)
      ? endpoint
      : `${endpoint}/chat/completions`;
    response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${preset.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!response.ok) throw new Error(`AI 请求失败（HTTP ${response.status}）：${await response.text()}`);
    responseText = readOpenAiContent(await response.json());
  }

  const trimmed = responseText.trim();
  if (!trimmed) throw new Error('AI 返回了空内容。');
  return trimmed.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
};
