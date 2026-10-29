import { parseApiEndpoint } from './apiEndpoint';
import { bearerApiKey } from './apiAuthentication';

export function apiTemperature(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2 ? value : undefined;
}

/** Share routing and authentication between normal chat, content generation and connection tests. */
export function textApiConfig(api: { endpoint: string; apiKey: string; model?: string }) {
  const url = parseApiEndpoint(api.endpoint), model = api.model?.trim() || 'gpt-4o-mini';
  const google = url.hostname === 'generativelanguage.googleapis.com' || /\/v1beta(?:\/|$)/i.test(url.pathname);
  const path = url.pathname.replace(/\/+$/, '');
  url.hash = '';
  if (google) {
    if (!/:generateContent$/i.test(path)) {
      const base = path.replace(/\/models$/i, '');
      url.pathname = `${/\/v1beta$/i.test(base) ? base : `${base}/v1beta`}/models/${encodeURIComponent(model.replace(/^models\//, ''))}:generateContent`;
    }
    if (!api.apiKey.trim()) throw new Error('请填写 API Key。');
    url.searchParams.set('key', api.apiKey.trim());
  } else {
    url.pathname = /\/chat\/completions$/i.test(path) ? path : `${path}/chat/completions`;
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!google) {
    const key = bearerApiKey(api.apiKey);
    if (!key) throw new Error('请填写 API Key。');
    headers.Authorization = `Bearer ${key}`;
  }
  return { url: url.toString(), google, headers, model };
}
