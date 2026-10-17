import { readStoredValue } from './localStorage';

export interface ChatSticker {
  id: string;
  imageUrl: string;
  description: string;
  category?: string;
}

export const CHAT_STICKERS_STORAGE_KEY = 'yyphone:chat-stickers';
const BUILTIN_STICKER_DATA: Array<[string, string, string]> = [
  ['萌', '小猫爱心', 'https://i.postimg.cc/W1mM4Mxc/IMG-3839.gif'],
  ['萌', '大眼睛注视', 'https://i.postimg.cc/prnjM8D2/IMG-3838.gif'],
  ['萌', '哭哭', 'https://i.postimg.cc/fRs85TNt/IMG-3840.gif'],
  ['萌', '记下了', 'https://i.postimg.cc/fW05N0zP/IMG-3841.gif'],
  ['萌', '悲愤！', 'https://i.postimg.cc/6Q3L18bD/IMG-3847.gif'],
  ['萌', '思考一下', 'https://i.postimg.cc/fWX7FnCG/IMG-3849.png'],
  ['萌', '问号', 'https://i.postimg.cc/GmMvYchw/IMG-3842.gif'],
  ['萌', '萌到无人能敌', 'https://i.postimg.cc/28rWKqV2/IMG-3848.gif'],
  ['抽象', '这个世界有病吧', 'https://i.postimg.cc/2yw1DwVJ/IMG-3828.jpg'],
  ['抽象', '豆包优化一下我的人生', 'https://i.postimg.cc/bYTrdmw1/IMG-3827.jpg'],
  ['抽象', '生活真是爽歪歪', 'https://i.postimg.cc/y8S7hj76/IMG-3835.jpg'],
  ['抽象', '干嘛', 'https://i.postimg.cc/fyrhmtPP/IMG-3837.jpg'],
  ['抽象', '屏幕有水是我的泪', 'https://i.postimg.cc/Fsw4KS0t/IMG-3830.jpg'],
];

export const BUILTIN_STICKERS: ChatSticker[] = BUILTIN_STICKER_DATA.map(([category, description, imageUrl], index) => ({
  id: `builtin-${index + 1}`, imageUrl, description, category,
}));

export const readAvailableChatStickers = (): ChatSticker[] => [
  ...BUILTIN_STICKERS,
  ...readStoredValue(CHAT_STICKERS_STORAGE_KEY, [] as ChatSticker[], (value): value is ChatSticker[] =>
    Array.isArray(value) && value.every((item) => !!item && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.imageUrl === 'string' && typeof item.description === 'string')
  ),
];
