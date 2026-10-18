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
  | 'memory'
  | 'inventory';

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

export interface AvatarFrameStyle {
  enabled: boolean;
  /** 渐变的两个颜色 */
  color1: string;
  color2: string;
  /** 渐变角度 0-360 */
  angle: number;
  /** 边框粗细（px） */
  width: number;
}

export interface UserProfile {
  name: string;
  handle: string;
  avatarSeed: string;
  avatarUrl?: string;
  avatarFrameEnabled?: boolean;
  avatarFrame?: AvatarFrameStyle;
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

export interface WidgetAppearance {
  background: string;
  disc: string;
  note: string;
}

export interface HomeAppearance {
  calendar: WidgetAppearance;
  music: WidgetAppearance;
  profile: {
    avatarUrl: string;
    coverImageUrl: string;
    avatarFrameEnabled: boolean;
    avatarFrame?: AvatarFrameStyle;
  };
}

export interface BeautySettings {
  themeId: string;
  wallpaperId: string;
  wallpapers: CustomWallpapers;
  appIcons: AppIconOverrides;
  homeAppearance?: HomeAppearance;
  lockScreenAppearance?: LockScreenAppearance;
}

export interface LockScreenAppearance {
  textColor: string;
  subtitle: string;
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
