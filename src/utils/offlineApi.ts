import type { ApiConnection } from './aiApi';
import { readStoredValue, writeStoredValue } from './localStorage';
import { textApiConfig } from './textApiConfig';

export const OFFLINE_API_KEY = 'yyphone:offline-api';
export interface OfflineApiConfig { endpoint: string; apiKey: string; model: string }
export const EMPTY_OFFLINE_API: OfflineApiConfig = { endpoint: '', apiKey: '', model: '' };
export const readOfflineApi = (): OfflineApiConfig => readStoredValue(OFFLINE_API_KEY, EMPTY_OFFLINE_API,
  (value): value is OfflineApiConfig => !!value && typeof value === 'object' &&
    typeof (value as OfflineApiConfig).endpoint === 'string' && typeof (value as OfflineApiConfig).apiKey === 'string' && typeof (value as OfflineApiConfig).model === 'string');

export function resolveOfflineApi(config = readOfflineApi()): ApiConnection | undefined {
  const api = { endpoint: config.endpoint.trim(), apiKey: config.apiKey.trim(), model: config.model.trim() };
  if (!api.endpoint && !api.apiKey && !api.model) return undefined;
  if (!api.endpoint || !api.apiKey || !api.model) throw new Error('请补齐线下副 API 的地址、密钥和模型，或全部清空以使用主 API。');
  textApiConfig(api);
  return api;
}

export function saveOfflineApi(config: OfflineApiConfig): void {
  const api = resolveOfflineApi(config);
  writeStoredValue(OFFLINE_API_KEY, api ?? { ...EMPTY_OFFLINE_API });
}
