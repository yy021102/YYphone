import { AppMetadata, UserProfile } from '../types';

// 统一内容源：这里的数组和描述都可以直接替换为真实玩家资料、聊天记录、帖子与世界观内容。
export const INITIAL_USER_PROFILE: UserProfile = {
  name: 'user',
  handle: '@user',
  avatarSeed: 'user',
  signature: '天天开心',
  level: 'Lv.9 灵识观测者',
  tags: ['深蓝偏执', '漫游中', '番茄钟狂热'],
  battery: 88,
  location: '家',
  mood: '懒懒的',
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

export const WECHAT_MOMENTS = [
  {
    id: 1,
    author: '林汐',
    avatar: '汐',
    time: '1小时前',
    content:
      '雨后的云层像棉花糖一样，把今天的第一份剧本大纲写完了。大家记得按时喝水🫧',
    likes: 18,
    comments: 4,
    images: ['#DFF1FA', '#FAD4E0'],
  },
  {
    id: 2,
    author: '苏子言',
    avatar: '言',
    time: '3小时前',
    content:
      '在工位边放了一盆小薄荷，连敲代码都带着草木香气。今天番茄钟已经达成 4 个循环！',
    likes: 24,
    comments: 7,
    images: ['#E1F7EF'],
  },
];

export const FORUM_CATEGORIES = ['全部', '树洞', '剧本围读', '同人二创', '技术探索'];

export const FORUM_POSTS = [
  {
    id: 1,
    title: '关于主线第 3 幕的结局走向，大家更倾向于哪个开放结局？',
    author: '深海观星者',
    tag: '剧本围读',
    time: '25分钟前',
    content:
      '在第3幕中，旅人终于解开了掌心小手机的终极法则。究竟是选择将虚拟记忆永久固化在云端，还是携带着最初的温存回归现世？想听听大家的看法！',
    upvotes: 89,
    replies: 34,
    isHot: true,
  },
  {
    id: 2,
    title: '【树洞】在数字浮岛独居的第 100 天，今天给自己做了一杯草莓生椰',
    author: '棉花糖云朵',
    tag: '树洞',
    time: '1小时前',
    content:
      '虽然偶尔会觉得整个世界只有自己一个角色，但每次打开微信收到林汐和子言的消息，又觉得生活其实格外真实。希望大家今天也开心！',
    upvotes: 142,
    replies: 56,
    isHot: true,
  },
  {
    id: 3,
    title: '关于世界书角色卡数值与属性设定的平衡性测算表',
    author: '数据观测员07',
    tag: '技术探索',
    time: '3小时前',
    content:
      '基于现有的12个职业标签做了多维雷达图测算，目前敏捷系角色在第三轮交互中的触发概率略高，附上详细数据公式供大家参考。',
    upvotes: 63,
    replies: 19,
    isHot: false,
  },
];

export const PHONE_PHOTOS = [
  { id: 1, title: '初秋午后的蔚蓝天际', tag: '风景', color: 'from-sky-200 to-blue-300' },
  { id: 2, title: '剧本围读会议草稿纸', tag: '工作', color: 'from-amber-100 to-orange-200' },
  { id: 3, title: '雨天路过的街角咖啡屋', tag: '随拍', color: 'from-teal-100 to-emerald-200' },
  { id: 4, title: '世界书第一纪元草图', tag: '设定', color: 'from-purple-200 to-indigo-300' },
  { id: 5, title: '落日微光里的水波', tag: '风景', color: 'from-rose-200 to-pink-300' },
  { id: 6, title: '新川图书馆三楼窗景', tag: '日常', color: 'from-cyan-100 to-sky-200' },
];

export const PHONE_DIARIES = [
  {
    id: 1,
    date: '10月12日 星期一 · 晴',
    title: '关于“灵识网络”的灵感记录',
    mood: '✨ 灵感迸发',
    preview:
      '今天在整理世界书的法则时，突然想到如果每一个AI旅人都拥有一部可以折叠进胸口的掌心小手机，那么他们之间的连接就不再是冰冷的代码，而是一串串带着晨光色泽的便签……',
  },
  {
    id: 2,
    date: '10月09日 星期五 · 微雨',
    title: '在街角咖啡馆度过的两小时',
    mood: '☕ 安静舒适',
    preview:
      '外面的小雨敲打在遮雨棚上，番茄钟响了三次。林汐发来新设定的审核反馈，提议把第二章的对话节奏放慢一点，我也觉得这样更能展现角色之间的微妙心绪。',
  },
  {
    id: 3,
    date: '10月05日 星期一 · 晴',
    title: '新川图书馆开馆日',
    mood: '📖 宁静平和',
    preview:
      '三楼靠窗的位置终于开放了，阳光透过双层玻璃洒在橡木桌上，很适合一整个下午都沉浸在故事世界里。',
  },
];

export const PHONE_NOTES = [
  { id: 1, text: '核对世界书第三章节 NPC 技能设定与平衡性', done: true },
  { id: 2, text: '准备下周线上剧情研讨会的讲稿框架', done: false },
  { id: 3, text: '给番茄钟增加白噪音环境声预设', done: false },
  { id: 4, text: '去淘宝买一本新的点阵网格手账本', done: true },
  { id: 5, text: '晚上记得备份虚拟手机里的日记与相册', done: false },
];

export const COUPLE_NOTES = [
  { id: 1, author: '沐晴', time: '今日 11:20', text: '下午记得别喝太多冰生椰拿铁，降温啦要带件薄外套哦！🧣' },
  { id: 2, author: '星野 遥', time: '昨日 22:45', text: '晚安，今晚的月色很美，明天见。🌙' },
];

export const MEMORY_FRAGMENTS = [
  {
    id: 1,
    title: '初遇新川虚拟图书馆',
    category: 'milestones',
    categoryLabel: '重大里程碑',
    date: '2026年08月15日 · 晴',
    excerpt: '初次开机的清晨，第一道水蓝微光在屏幕正中凝聚。与林汐和子言交换了第一张电子名片。',
    mood: '🌸 温暖感动',
    color: 'from-sky-300/30 to-blue-400/20',
    tag: '#最初的起点',
  },
  {
    id: 2,
    title: '浮岛暴雨夜的围炉剧本研讨',
    category: 'dialogue',
    categoryLabel: '对话共鸣',
    date: '2026年09月04日 · 暴雨',
    excerpt: '雷声隔绝在玻璃窗外，咖啡香气弥漫了一整晚。我们敲定了世界书第三律的草案。',
    mood: '☕ 静谧专注',
    color: 'from-amber-300/30 to-orange-400/20',
    tag: '#羁绊加深',
  },
  {
    id: 3,
    title: '浮光浅滩的落日快照',
    category: 'snapshots',
    categoryLabel: '时光快照',
    date: '2026年09月28日 · 霞光',
    excerpt: '粉白与水蓝交织的天际线，微风掠过水面留下细小的涟漪。那一刻时间仿佛彻底静止。',
    mood: '🌅 宁静永恒',
    color: 'from-pink-300/30 to-rose-400/20',
    tag: '#浅滩留影',
  },
  {
    id: 4,
    title: 'PocketOS 掌心终端正式激活',
    category: 'milestones',
    categoryLabel: '重大里程碑',
    date: '2026年10月12日 · 晨曦',
    excerpt: '所有模块组装完毕，轻触小白条即可无缝穿梭于每一个精心编织的应用之间。',
    mood: '✨ 晶莹闪耀',
    color: 'from-teal-300/30 to-emerald-400/20',
    tag: '#系统新生',
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
