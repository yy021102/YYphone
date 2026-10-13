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
  avatarUrl?: string;
  coverImageUrl?: string;
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

export interface UserPersona {
  id: string;
  name: string;
  avatarUrl?: string;
  identity: string;
  personality: string;
  background: string;
  speakingStyle: string;
}

export interface PersonaCollection {
  profiles: UserPersona[];
  activeProfileId: string;
}

export interface CustomWallpapers {
  lockScreen: string;
  homeScreen: string;
}

export type AppIconOverrides = Partial<Record<AppId, string>>;

export interface BeautySettings {
  themeId: string;
  wallpaperId: string;
  wallpapers: CustomWallpapers;
  appIcons: AppIconOverrides;
}

export interface BeautyPreset {
  id: string;
  name: string;
  settings: BeautySettings;
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
