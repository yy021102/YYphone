import type { ApiConnection } from './aiApi';
import { textApiConfig } from './textApiConfig';

export interface ChatOverrides { backgroundUrl?: string; secondaryApi?: ApiConnection }

/** Empty means inherit; partial configuration must never silently send to a different API. */
export function chatSecondaryApi(chat: ChatOverrides): ApiConnection | undefined {
  const source = chat.secondaryApi;
  if (!source) return undefined;
  const endpoint = source.endpoint?.trim() || '', apiKey = source.apiKey?.trim() || '', model = source.model?.trim() || '';
  if (!endpoint && !apiKey && !model) return undefined;
  if (!endpoint || !apiKey || !model) throw new Error('请补齐本对话副 API 的地址、密钥和模型，或恢复使用主 API。');
  const api = { ...source, endpoint, apiKey, model };
  textApiConfig(api);
  return api;
}

export function chatBackground(chat: ChatOverrides | null | undefined, globalBackground: string | undefined, dark: boolean): string {
  return dark ? '' : chat?.backgroundUrl || globalBackground || '';
}
