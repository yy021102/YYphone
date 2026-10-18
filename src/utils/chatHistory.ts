export const DEFAULT_CHAT_HISTORY_COUNT = 200;

export const resolveChatHistoryCount = (value: unknown, fallback = DEFAULT_CHAT_HISTORY_COUNT): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
