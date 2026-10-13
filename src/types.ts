export type AppId =
  | 'wechat'
  | 'phone_explorer'
  | 'alipay'
  | 'taobao'
  | 'forum'
  | 'pomodoro'
  | 'offline_mode'
  | 'couple_space'
  | 'settings'
  | 'customizer'
  | 'world_book'
  | 'memory';

export interface AppMetadata {
  id: AppId;
  name: string;
  iconName: string;
  category: string;
  color: string;
  textColor?: string;
  badge?: number | string;
  subtitle?: string;
}

export interface UserProfile {
  name: string;
  handle: string;
  avatarSeed: string;
  signature: string;
  level: string;
  tags: string[];
  battery: number;
  location: string;
  mood: string;
  stats: {
    friends: number;
    moments: number;
    notes: number;
    coins: number;
  };
}

export interface SystemState {
  isLocked: boolean;
  activeApp: AppId | null;
  showStatusBar: boolean;
  timeString: string;
  dateString: string;
  activeThemeId: string;
  activeWallpaperId: string;
  apiConfig: {
    endpoint: string;
    apiKey: string;
    model: string;
    customPrompt: string;
  };
}
