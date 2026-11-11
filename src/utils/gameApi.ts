import { getActiveApiPreset, type ApiConnection } from './aiApi';
import { readStoredValue, writeStoredValue } from './localStorage';
import { textApiConfig } from './textApiConfig';

export const GAME_API_KEY = 'yyphone:game-api';
export type GameApiConfig = ApiConnection & { model: string };
export const EMPTY_GAME_API: GameApiConfig = { endpoint: '', apiKey: '', model: '' };
export const readGameApi = (): GameApiConfig => readStoredValue(GAME_API_KEY, EMPTY_GAME_API,
  (value): value is GameApiConfig => !!value && typeof value === 'object' &&
    typeof (value as GameApiConfig).endpoint === 'string' && typeof (value as GameApiConfig).apiKey === 'string' && typeof (value as GameApiConfig).model === 'string');

function secondaryGameApi(config: GameApiConfig): GameApiConfig | undefined {
  const api = { ...config, endpoint: config.endpoint.trim(), apiKey: config.apiKey.trim(), model: config.model.trim() };
  if (!api.endpoint && !api.apiKey && !api.model) return undefined;
  if (!api.endpoint || !api.apiKey || !api.model) throw new Error('请补齐游戏副 API 的地址、密钥和模型，或全部清空以使用主 API。');
  textApiConfig(api);
  return api;
}

export const getGameApiConnection = (): ApiConnection => secondaryGameApi(readGameApi()) ?? getActiveApiPreset();
export function saveGameApi(config: GameApiConfig): void {
  writeStoredValue(GAME_API_KEY, secondaryGameApi(config) ?? { ...EMPTY_GAME_API });
}
