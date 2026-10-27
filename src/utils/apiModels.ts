import type { ApiConnection } from './aiApi';

export interface ApiModel { id: string; label: string }
export interface ModelListConnection extends ApiConnection { protocol?: 'auto' | 'openai' | 'google'; purpose?: 'decision' | 'image'; unsupported?: boolean }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function modelListRequest(connection: ModelListConnection) {
  if (connection.unsupported) throw new Error('当前服务未提供可拉取的生图模型列表，请手动填写模型 ID。');
  if (!connection.endpoint.trim() || !connection.apiKey.trim()) throw new Error('请先填写接口地址和 API Key。');
  let url: URL;
  try { url = new URL(connection.endpoint.trim()); } catch { throw new Error('接口地址无效，请填写 HTTP(S) 地址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请使用不含账号密码的 HTTP(S) 接口地址。');
  const google = connection.protocol === 'google' || connection.protocol !== 'openai' &&
    (url.hostname === 'generativelanguage.googleapis.com' || /\/v1beta(?:\/|$)/i.test(url.pathname)) && !/\/openai(?:\/|$)/i.test(url.pathname);
  let path = url.pathname.replace(/\/+$/, '');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (google) {
    path = path.replace(/\/models(?:\/.*)?$/i, '');
    if (!/\/v1(?:beta)?$/i.test(path)) path += '/v1beta';
    url.pathname = `${path}/models`;
    url.searchParams.delete('key'); url.searchParams.delete('pageToken'); url.searchParams.set('pageSize', '1000');
    headers['x-goog-api-key'] = connection.apiKey.trim();
  } else {
    path = path.replace(/\/(?:chat\/completions|completions|images\/(?:generations|edits)|models(?:\/[^/]+)?)$/i, '');
    if (url.hostname === 'api.openai.com' && !path) path = '/v1';
    url.pathname = `${path}/models`;
    headers.Authorization = `Bearer ${connection.apiKey.trim()}`;
  }
  url.hash = '';
  return { url, headers, google };
}

export function parseModelList(payload: unknown, purpose: ModelListConnection['purpose'] = 'decision'): ApiModel[] {
  if (record(payload) && (payload.error || payload.success === false)) throw new Error('服务未返回有效的模型列表，请检查配置。');
  const list = Array.isArray(payload) ? payload : record(payload) && Array.isArray(payload.data) ? payload.data : record(payload) && Array.isArray(payload.models) ? payload.models : [];
  const seen = new Set<string>();
  const models = list.flatMap((item): ApiModel[] => {
    if (record(item) && purpose !== 'image' && Array.isArray(item.supportedGenerationMethods) && !item.supportedGenerationMethods.includes('generateContent')) return [];
    const id = (typeof item === 'string' ? item : record(item) ? typeof item.id === 'string' ? item.id : typeof item.name === 'string' ? item.name.replace(/^models\//, '') : '' : '').trim();
    if (!id || id.length > 300 || seen.has(id)) return [];
    seen.add(id);
    return [{ id, label: record(item) && typeof item.displayName === 'string' ? `${item.displayName.slice(0, 120)} (${id})` : id }];
  });
  if (purpose === 'image') models.sort((a, b) => Number(/image|imagen|dall|flux|diffusion/i.test(b.id)) - Number(/image|imagen|dall|flux|diffusion/i.test(a.id)));
  return models;
}

/** Query only the catalog; never creates an image or sends chat content. */
export async function fetchApiModels(connection: ModelListConnection, signal?: AbortSignal): Promise<ApiModel[]> {
  const request = modelListRequest(connection);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 20000);
  const result = new Map<string, ApiModel>(); const tokens = new Set<string>();
  try {
    for (let page = 0; page < 10; page++) {
      const response = await fetch(request.url.toString(), { method: 'GET', headers: request.headers, credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error(`模型拉取失败（HTTP ${response.status}）。${response.status === 401 || response.status === 403 ? '请检查 Key 和权限。' : '服务可能未开放模型列表，也可手动填写模型 ID。'}`);
      let data: unknown;
      try { data = await response.json(); } catch { throw new Error('接口返回的不是有效模型列表，可继续手动填写模型 ID。'); }
      for (const model of parseModelList(data, connection.purpose)) result.set(model.id, model);
      const token = request.google && record(data) && typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      if (!token) break;
      if (tokens.has(token) || page === 9) throw new Error('模型列表分页异常，请手动填写模型 ID。');
      tokens.add(token); request.url.searchParams.set('pageToken', token);
    }
    if (controller.signal.aborted) throw new DOMException('模型拉取已取消或超时。', 'AbortError');
    if (!result.size) throw new Error('接口已响应，但没有返回可用模型，可继续手动填写模型 ID。');
    return [...result.values()];
  } catch (cause) {
    if (signal?.aborted) throw new DOMException('已取消拉取', 'AbortError');
    if (controller.signal.aborted) throw new Error('拉取模型超时，请稍后重试或手动填写模型 ID。');
    if (cause instanceof TypeError) throw new Error('无法读取模型列表，请检查网络及服务的跨域设置；仍可手动填写模型 ID。');
    throw cause;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
