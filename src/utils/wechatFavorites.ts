export const WECHAT_FAVORITES_KEY = 'yyphone:wechat-favorites';

export interface FavoriteMessage {
  kind?: string;
  text: string;
  imageUrl?: string;
  title?: string;
  content?: string;
  source?: string;
  amount?: string;
}

export interface WeChatFavorite {
  id: string;
  sourceChatId: string;
  sourceMessageId: string;
  sourceChatTitle: string;
  sourceSenderName: string;
  savedAt: string;
  message: FavoriteMessage;
}

export function isWeChatFavorites(value: unknown): value is WeChatFavorite[] {
  return Array.isArray(value) && value.every(item => item && typeof item === 'object' &&
    ['id', 'sourceChatId', 'sourceMessageId', 'sourceChatTitle', 'sourceSenderName', 'savedAt'].every(key => typeof item[key] === 'string') &&
    item.message && typeof item.message === 'object' && typeof item.message.text === 'string' &&
    ['kind', 'imageUrl', 'title', 'content', 'source', 'amount'].every(key => item.message[key] === undefined || typeof item.message[key] === 'string'));
}

/** Keep an independent content snapshot; do not copy character thoughts or live payment state. */
export function snapshotFavoriteMessage(message: FavoriteMessage): FavoriteMessage {
  const { kind, text, imageUrl, title, content, source, amount } = message;
  return { kind, text, imageUrl, title, content, source, amount };
}

export function favoritePreview(message: FavoriteMessage): string {
  const text = message.content || message.text;
  switch (message.kind) {
    case 'image': return message.text || '[图片]';
    case 'sticker': return message.text || '[表情]';
    case 'voice': return `[语音] ${message.text}`;
    case 'red-packet': return `[红包] ¥${message.amount ?? ''} ${message.text}`;
    case 'transfer': return `[转账] ¥${message.amount ?? ''} ${message.text}`;
    case 'location': return `[位置] ${message.text}`;
    default: return text || message.title || '[收藏内容]';
  }
}

export function favoriteDate(savedAt: string, now = new Date()): string {
  const date = new Date(savedAt);
  if (!Number.isFinite(date.getTime())) return '';
  if (date.toDateString() === now.toDateString()) return '今天';
  return `${date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}年`}${date.getMonth() + 1}月${date.getDate()}日`;
}

/** Sharing a financial or interactive favorite creates a content card, never a payable transfer or invitation. */
export function favoriteShareContent(favorite: WeChatFavorite): {
  kind: 'text' | 'image' | 'sticker' | 'voice' | 'link'; text: string;
  imageUrl?: string; title?: string; content?: string; source?: string;
} {
  const message = favorite.message;
  if (!message.kind || message.kind === 'text') return { kind: 'text', text: message.text };
  if (message.kind === 'image' || message.kind === 'sticker' || message.kind === 'voice') {
    return { kind: message.kind, text: message.text, ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}) };
  }
  return { kind: 'link', text: message.title || favoritePreview(message), title: message.title || '收藏内容',
    content: favoritePreview(message), source: `收藏 · ${favorite.sourceChatTitle}` };
}
