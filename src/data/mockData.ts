import { AppMetadata, UserProfile } from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  name: '星野 遥',
  handle: '@hoshino_haruka',
  avatarSeed: 'haruka',
  signature: '在数字微澜与水蓝晨光之间，收集未完待续的梦境。',
  level: 'Lv.9 灵识观测者',
  tags: ['深蓝偏执', '漫游中', '番茄钟狂热'],
  battery: 88,
  location: '新川市立虚拟图书馆 · 3F',
  mood: '🫧 正在构思下一篇剧本',
  stats: {
    friends: 42,
    moments: 128,
    notes: 36,
    coins: 9820,
  },
};

// Top Screen Grid Apps (8 Apps)
export const MAIN_GRID_APPS: AppMetadata[] = [
  {
    id: 'wechat',
    name: '微信',
    iconName: 'MessageCircle',
    category: '通讯',
    color: 'from-emerald-400/30 to-teal-500/20',
    textColor: 'text-teal-600',
    badge: 3,
  },
  {
    id: 'phone_explorer',
    name: '查手机',
    iconName: 'Smartphone',
    category: '秘密',
    color: 'from-sky-400/30 to-blue-500/20',
    textColor: 'text-sky-600',
  },
  {
    id: 'alipay',
    name: '支付宝',
    iconName: 'Coins',
    category: '金融',
    color: 'from-blue-500/30 to-indigo-600/20',
    textColor: 'text-blue-600',
  },
  {
    id: 'taobao',
    name: '淘宝',
    iconName: 'ShoppingBag',
    category: '生活',
    color: 'from-orange-400/30 to-amber-500/20',
    textColor: 'text-orange-600',
  },
  {
    id: 'forum',
    name: '论坛',
    iconName: 'Flame',
    category: '社区',
    color: 'from-rose-400/30 to-pink-500/20',
    textColor: 'text-rose-600',
  },
  {
    id: 'pomodoro',
    name: '番茄钟',
    iconName: 'Timer',
    category: '专注',
    color: 'from-red-400/30 to-rose-500/20',
    textColor: 'text-red-500',
  },
  {
    id: 'offline_mode',
    name: '线下',
    iconName: 'Compass',
    category: '现实',
    color: 'from-cyan-400/30 to-teal-500/20',
    textColor: 'text-cyan-600',
  },
  {
    id: 'couple_space',
    name: '情侣空间',
    iconName: 'HeartHandshake',
    category: '伴侣',
    color: 'from-pink-400/30 to-rose-400/20',
    textColor: 'text-pink-500',
  },
];

// Bottom Dock Apps (4 Apps: 设置, 美化, 世界书, 记忆)
export const DOCK_APPS: AppMetadata[] = [
  {
    id: 'settings',
    name: '设置',
    iconName: 'Settings',
    category: '系统',
    color: 'from-slate-400/30 to-slate-600/20',
    textColor: 'text-slate-600',
  },
  {
    id: 'customizer',
    name: '美化',
    iconName: 'Palette',
    category: '系统',
    color: 'from-pink-400/30 to-rose-400/20',
    textColor: 'text-pink-600',
  },
  {
    id: 'world_book',
    name: '世界书',
    iconName: 'BookOpen',
    category: '设定',
    color: 'from-violet-400/30 to-purple-600/20',
    textColor: 'text-purple-600',
  },
  {
    id: 'memory',
    name: '记忆',
    iconName: 'Sparkles',
    category: '回忆',
    color: 'from-amber-400/30 to-sky-400/20',
    textColor: 'text-amber-600',
  },
];

export const ALL_APPS: AppMetadata[] = [...MAIN_GRID_APPS, ...DOCK_APPS];

export const THEMES = [
  {
    id: 'ocean-dawn',
    name: '晨曦冰蓝',
    gradient: 'from-[#DFF1FA] via-[#EDF7FC] to-[#FFFFFF]',
    accentColor: '#3888B8',
    glowColor: 'rgba(223, 241, 250, 0.8)',
    tagColor: 'bg-sky-100/80 text-sky-800',
  },
  {
    id: 'peach-sakura',
    name: '蜜桃落樱',
    gradient: 'from-[#FCE8F0] via-[#FDF5F8] to-[#FFFFFF]',
    accentColor: '#E07A9A',
    glowColor: 'rgba(250, 212, 224, 0.8)',
    tagColor: 'bg-pink-100/80 text-pink-800',
  },
  {
    id: 'mint-breeze',
    name: '薄荷晨露',
    gradient: 'from-[#E1F7EF] via-[#F0FAF5] to-[#FFFFFF]',
    accentColor: '#38A179',
    glowColor: 'rgba(225, 247, 239, 0.8)',
    tagColor: 'bg-emerald-100/80 text-emerald-800',
  },
  {
    id: 'twilight-lilac',
    name: '暮光丁香',
    gradient: 'from-[#EBE7FA] via-[#F5F2FD] to-[#FFFFFF]',
    accentColor: '#7E63C4',
    glowColor: 'rgba(235, 231, 250, 0.8)',
    tagColor: 'bg-purple-100/80 text-purple-800',
  },
];

export const WALLPAPERS = [
  {
    id: 'dreamy-sky',
    name: '浮云与微光',
    style: 'linear-gradient(135deg, #DFF1FA 0%, #FAD4E0 60%, #FFFFFF 100%)',
    description: '温柔水蓝与粉霞渐变',
  },
  {
    id: 'clear-morning',
    name: '晴空冰晶',
    style: 'linear-gradient(180deg, #CEE9F7 0%, #E8F5FD 50%, #FFFFFF 100%)',
    description: '澄澈透明的晨曦天际',
  },
  {
    id: 'sweet-blossom',
    name: '浅绯梦境',
    style: 'linear-gradient(135deg, #FAD4E0 0%, #F5E8FF 50%, #FFFFFF 100%)',
    description: '如春日花瓣般的暖意',
  },
  {
    id: 'deep-sea-frost',
    name: '琉璃深滩',
    style: 'linear-gradient(180deg, #D7EEF8 0%, #DCECF5 40%, #F4F8FA 100%)',
    description: '水波柔影与微风拂面',
  },
];
