import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Sparkles,
  Utensils,
  Tag,
  Menu,
  Plus,
  Pencil,
  Trash2,
  Gift,
  MessageCircle,
  Store,
  Upload,
  Download,
  X,
  Send,
  Image as ImageIcon,
  User,
  Palette,
  Save,
  Shuffle,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import {
  AlipayContact,
  AlipayData,
  chargeAlipay,
  readAlipayContacts,
  readAlipayData,
} from '../utils/alipayData';
import { requestConfiguredAiText } from '../utils/aiApi';
import { appendCharacterContextEvent } from '../utils/characterContext';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

interface TaobaoAppProps {
  onBack: () => void;
}

// 三大主板块：购物 | 饿了么 | 闲鱼
type MainTab = 'shopping' | 'eleme' | 'xianyu';
// 闲鱼子板块：逛闲置 | 消息
type XianyuSubTab = 'market' | 'messages';

// 通用商品结构（购物 & 饿了么）
export interface MarketProduct {
  id: string;
  category: 'shopping' | 'eleme';
  title: string;
  desc: string;
  price: number;
  origPrice?: number;
  emoji: string;
  imageUrl?: string;
  store?: string;
  badge?: string;
  fromCharName?: string;
}

// 闲鱼二手商品结构
export interface XianyuProduct {
  id: string;
  title: string;
  desc: string;
  price: number;
  freeShipping: boolean;
  emoji: string;
  imageUrl?: string;
  sellerName: string;
  sellerAvatar?: string;
  isPlayerItem?: boolean;
  linkedCharId?: string;
  isAltAccount?: boolean;
}

// 闲鱼聊天会话结构
export interface XianyuChatThread {
  id: string;
  itemId: string;
  itemTitle: string;
  itemPrice: number;
  peerName: string;
  linkedCharId?: string;
  isAltAccount?: boolean;
  isPlayerItem?: boolean;
  messages: {
    id: string;
    sender: 'me' | 'peer';
    text: string;
    time: string;
  }[];
}

// 玩家自己的闲鱼账号资料
export interface PlayerXianyuProfile {
  nickname: string;
  xianyuId: string;
  avatarUrl: string;
  bio: string;
}

// 淘宝 App 专属美化预设结构
export interface TaobaoThemePreset {
  id: string;
  name: string;
  bgGradient: string;
  wallpaperUrl: string;
  primaryGradient: string;
  cardBg: string;
  textColor: string;
  layoutMode: 'list' | 'grid';
  cardRadius: string;
  customCss: string;
}

const DEFAULT_TAOBAO_PRESET: TaobaoThemePreset = {
  id: 'default',
  name: '默认预设',
  bgGradient: 'linear-gradient(180deg, #F0F7FF 0%, #F7F4FC 50%, #FFF2F7 100%)',
  wallpaperUrl: '',
  primaryGradient: 'linear-gradient(90deg, #8EC5FC 0%, #F5B8D1 100%)',
  cardBg: 'rgba(255, 255, 255, 0.72)',
  textColor: '#3A5064',
  layoutMode: 'list',
  cardRadius: '24px',
  customCss: '/* 可在此粘贴或修改额外样式，例如修改字体或边框 */',
};

const STORAGE_KEYS = {
  marketProducts: 'yyphone:taobao-market-products',
  xianyuItems: 'yyphone:taobao-xianyu-items',
  xianyuThreads: 'yyphone:taobao-xianyu-threads',
  playerProfile: 'yyphone:taobao-player-profile',
  themePresets: 'yyphone:taobao-theme-presets',
  activePresetId: 'yyphone:taobao-active-preset-id',
  currentTheme: 'yyphone:taobao-current-theme',
  wechatChats: 'yyphone:wechat-chats',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isMarketProductList = (value: unknown): value is MarketProduct[] =>
  Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item.id === 'string' &&
    (item.category === 'shopping' || item.category === 'eleme') &&
    typeof item.title === 'string' &&
    typeof item.desc === 'string' &&
    typeof item.price === 'number' &&
    typeof item.emoji === 'string'
  );

const isXianyuProductList = (value: unknown): value is XianyuProduct[] =>
  Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.desc === 'string' &&
    typeof item.price === 'number' &&
    typeof item.freeShipping === 'boolean' &&
    typeof item.emoji === 'string' &&
    typeof item.sellerName === 'string'
  );

const isXianyuThreadList = (value: unknown): value is XianyuChatThread[] =>
  Array.isArray(value) && value.every((thread) =>
    isRecord(thread) &&
    typeof thread.id === 'string' &&
    typeof thread.itemId === 'string' &&
    typeof thread.itemTitle === 'string' &&
    typeof thread.itemPrice === 'number' &&
    typeof thread.peerName === 'string' &&
    (thread.isPlayerItem === undefined || typeof thread.isPlayerItem === 'boolean') &&
    Array.isArray(thread.messages) &&
    thread.messages.every((message) =>
      isRecord(message) &&
      typeof message.id === 'string' &&
      (message.sender === 'me' || message.sender === 'peer') &&
      typeof message.text === 'string' &&
      typeof message.time === 'string'
    )
  );

const isPlayerXianyuProfile = (value: unknown): value is PlayerXianyuProfile =>
  isRecord(value) &&
  typeof value.nickname === 'string' &&
  typeof value.xianyuId === 'string' &&
  typeof value.avatarUrl === 'string' &&
  typeof value.bio === 'string';

const isThemePreset = (value: unknown): value is TaobaoThemePreset =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.bgGradient === 'string' &&
  typeof value.wallpaperUrl === 'string' &&
  typeof value.primaryGradient === 'string' &&
  typeof value.cardBg === 'string' &&
  typeof value.textColor === 'string' &&
  (value.layoutMode === 'list' || value.layoutMode === 'grid') &&
  typeof value.cardRadius === 'string' &&
  typeof value.customCss === 'string';

const isThemePresetList = (value: unknown): value is TaobaoThemePreset[] =>
  Array.isArray(value) && value.every(isThemePreset);

const getCharacterPersona = (charId: string) => {
  const contacts = readStoredValue<unknown[]>(
    'pocketos:wechat-contacts',
    [],
    (value): value is unknown[] => Array.isArray(value)
  );
  const character = contacts.find((item) => isRecord(item) && item.id === charId);
  return isRecord(character) && typeof character.persona === 'string' ? character.persona : '';
};

export const TaobaoApp: React.FC<TaobaoAppProps> = ({ onBack }) => {
  // ==================== 1. 导航与子页面状态 ====================
  const [activeTab, setActiveTab] = useState<MainTab>('shopping');
  const [xianyuSubTab, setXianyuSubTab] = useState<XianyuSubTab>('market');

  // ==================== 2. 支付宝与通讯录联动状态 ====================
  const [financeData, setFinanceData] = useState<AlipayData>(() => readAlipayData());
  const [contacts] = useState<AlipayContact[]>(() => readAlipayContacts());

  // ==================== 3. 淘宝专属美化与预设管理状态 ====================
  const [themePresets, setThemePresets] = useState<TaobaoThemePreset[]>(() => {
    const stored = readStoredValue(STORAGE_KEYS.themePresets, [] as TaobaoThemePreset[], isThemePresetList);
    return stored.some((preset) => preset.id === 'default')
      ? stored
      : [DEFAULT_TAOBAO_PRESET, ...stored];
  });
  const [activePresetId, setActivePresetId] = useState<string>(() =>
    readStoredValue(STORAGE_KEYS.activePresetId, 'default', (value): value is string => typeof value === 'string')
  );
  const [currentTheme, setCurrentTheme] = useState<TaobaoThemePreset>(() =>
    readStoredValue(STORAGE_KEYS.currentTheme, DEFAULT_TAOBAO_PRESET, isThemePreset)
  );
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [menuTab, setMenuTab] = useState<'theme' | 'data'>('theme');

  // ==================== 4. 三大板块商品列表 ====================
  const [marketProducts, setMarketProducts] = useState<MarketProduct[]>(() =>
    readStoredValue(STORAGE_KEYS.marketProducts, [] as MarketProduct[], isMarketProductList)
  );

  const [xianyuItems, setXianyuItems] = useState<XianyuProduct[]>(() =>
    readStoredValue(STORAGE_KEYS.xianyuItems, [] as XianyuProduct[], isXianyuProductList)
  );

  const [xianyuThreads, setXianyuThreads] = useState<XianyuChatThread[]>(() =>
    readStoredValue(STORAGE_KEYS.xianyuThreads, [] as XianyuChatThread[], isXianyuThreadList)
  );
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');

  const [playerProfile, setPlayerProfile] = useState<PlayerXianyuProfile>({
    ...readStoredValue(STORAGE_KEYS.playerProfile, {
      nickname: '',
      xianyuId: '',
      avatarUrl: '',
      bio: '',
    }, isPlayerXianyuProfile),
  });

  // ==================== 5. 各类弹窗开关与表单状态 ====================
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isXianyuReplying, setIsXianyuReplying] = useState(false);

  // 闲鱼 AI 上新配置弹窗状态（选择是否包含角色、随机或指定角色）
  const [showXianyuAiModal, setShowXianyuAiModal] = useState(false);
  const [includeCharInXianyuAi, setIncludeCharInXianyuAi] = useState<boolean>(true);
  const [xianyuAiCharTarget, setXianyuAiCharTarget] = useState<string>('random'); // 'random' 或 具体角色 id

  // 商品新增/编辑弹窗（玩家手动挂闲置默认就是玩家自己）
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formEmoji, setFormEmoji] = useState('🎁');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formFreeShipping, setFormFreeShipping] = useState(true);

  // 购买/送礼结算弹窗
  const [checkoutProduct, setCheckoutProduct] = useState<{
    id: string;
    title: string;
    price: number;
    type: MainTab;
  } | null>(null);
  const [buyForWho, setBuyForWho] = useState<'self' | 'char'>('self');
  const [targetCharId, setTargetCharId] = useState<string>(contacts[0]?.id || '');
  const [notifyCharIds, setNotifyCharIds] = useState<string[]>([]);
  const [paymentSelection, setPaymentSelection] = useState('balance');
  const [paymentError, setPaymentError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');

  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    try {
      writeStoredValue(STORAGE_KEYS.marketProducts, marketProducts);
      writeStoredValue(STORAGE_KEYS.xianyuItems, xianyuItems);
      writeStoredValue(STORAGE_KEYS.xianyuThreads, xianyuThreads);
      writeStoredValue(STORAGE_KEYS.playerProfile, playerProfile);
      writeStoredValue(STORAGE_KEYS.themePresets, themePresets);
      writeStoredValue(STORAGE_KEYS.activePresetId, activePresetId);
      writeStoredValue(STORAGE_KEYS.currentTheme, currentTheme);
    } catch (error) {
      console.error('Could not persist Taobao app data.', error);
      setAiError('淘宝数据保存失败，请检查设备存储空间。');
    }
  }, [
    marketProducts,
    xianyuItems,
    xianyuThreads,
    playerProfile,
    themePresets,
    activePresetId,
    currentTheme,
  ]);

  useEffect(() => {
    if (themePresets.some((preset) => preset.id === activePresetId)) return;
    const defaultPreset = themePresets.find((preset) => preset.id === 'default') ?? DEFAULT_TAOBAO_PRESET;
    setActivePresetId(defaultPreset.id);
    setCurrentTheme(defaultPreset);
  }, [activePresetId, themePresets]);

  // ==================== 6. 工具函数：本地上传图片转 Base64 ====================
  const handleLocalImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        onSuccess(String(ev.target.result));
      }
    };
    reader.readAsDataURL(file);
  };

  // ==================== 7. 美化预设切换、保存、删除逻辑 ====================
  const handleSelectPreset = (presetId: string) => {
    setActivePresetId(presetId);
    const found = themePresets.find((p) => p.id === presetId);
    if (found) {
      setCurrentTheme({ ...found });
    }
  };

  const handleSaveAsNewPreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const newId = `preset-${Date.now()}`;
    const newPreset: TaobaoThemePreset = {
      ...currentTheme,
      id: newId,
      name,
    };
    setThemePresets((prev) => [...prev, newPreset]);
    setActivePresetId(newId);
    setNewPresetName('');
  };

  const handleUpdateCurrentPreset = () => {
    setThemePresets((prev) =>
      prev.map((p) => (p.id === activePresetId ? { ...currentTheme, id: p.id, name: p.name } : p))
    );
  };

  const handleDeletePreset = (id: string) => {
    if (id === 'default') return;
    const nextList = themePresets.filter((p) => p.id !== id);
    setThemePresets(nextList);
    setActivePresetId('default');
    setCurrentTheme(nextList.find((p) => p.id === 'default') || DEFAULT_TAOBAO_PRESET);
  };

  // ==================== 8. 商品增删改与 AI 生成逻辑 ====================
  const openCreateModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormPrice('');
    setFormEmoji(activeTab === 'shopping' ? '🛍️' : activeTab === 'eleme' ? '🍱' : '📦');
    setFormImageUrl('');
    setFormFreeShipping(true);
    setShowEditorModal(true);
  };

  const openEditMarketProduct = (p: MarketProduct) => {
    setEditingId(p.id);
    setFormTitle(p.title);
    setFormDesc(p.desc);
    setFormPrice(String(p.price));
    setFormEmoji(p.emoji || '🎁');
    setFormImageUrl(p.imageUrl || '');
    setShowEditorModal(true);
  };

  const openEditXianyuProduct = (item: XianyuProduct) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDesc(item.desc);
    setFormPrice(String(item.price));
    setFormEmoji(item.emoji || '📦');
    setFormImageUrl(item.imageUrl || '');
    setFormFreeShipping(item.freeShipping);
    setShowEditorModal(true);
  };

  const handleSaveProduct = () => {
    const priceNum = parseFloat(formPrice);
    if (!formTitle.trim() || isNaN(priceNum) || priceNum < 0) return;

    if (activeTab === 'shopping' || activeTab === 'eleme') {
      if (editingId) {
        setMarketProducts((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  title: formTitle.trim(),
                  desc: formDesc.trim(),
                  price: priceNum,
                  emoji: formEmoji || '🎁',
                  imageUrl: formImageUrl.trim() || undefined,
                }
              : item
          )
        );
      } else {
        const newProd: MarketProduct = {
          id: `${activeTab}-${Date.now()}`,
          category: activeTab,
          title: formTitle.trim(),
          desc: formDesc.trim() || '精选好物，品质保障',
          price: priceNum,
          origPrice: Math.round(priceNum * 1.25),
          emoji: formEmoji || (activeTab === 'shopping' ? '🛍️' : '🍱'),
          imageUrl: formImageUrl.trim() || undefined,
          store: activeTab === 'shopping' ? '心动优选自营' : '同城热送专营',
          badge: activeTab === 'shopping' ? '新品' : '热销',
        };
        setMarketProducts((prev) => [newProd, ...prev]);
      }
    } else {
      // 玩家手动挂闲置：默认卖家就是玩家自己！
      if (editingId) {
        setXianyuItems((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  title: formTitle.trim(),
                  desc: formDesc.trim(),
                  price: priceNum,
                  freeShipping: formFreeShipping,
                  emoji: formEmoji || '📦',
                  imageUrl: formImageUrl.trim() || undefined,
                }
              : item
          )
        );
      } else {
        const newXy: XianyuProduct = {
          id: `xy-${Date.now()}`,
          title: formTitle.trim(),
          desc: formDesc.trim() || '个人闲置诚心出，拍下当天发货~',
          price: priceNum,
          freeShipping: formFreeShipping,
          emoji: formEmoji || '📦',
          imageUrl: formImageUrl.trim() || undefined,
          sellerName: playerProfile.nickname || '玩家',
          isPlayerItem: true,
        };
        setXianyuItems((prev) => [newXy, ...prev]);
      }
    }
    setShowEditorModal(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (activeTab === 'xianyu') {
      setXianyuItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setMarketProducts((prev) => prev.filter((i) => i.id !== id));
    }
  };

  // 点击顶部“AI 上新”按钮：如果是闲鱼，先弹出角色彩蛋选择框；如果是购物/饿了么，直接生成
  const handleClickAiButton = () => {
    if (activeTab === 'xianyu') {
      setShowXianyuAiModal(true);
    } else {
      runAiGeneration();
    }
  };

  // 执行 AI 生成商品
  const runAiGeneration = async () => {
    setShowXianyuAiModal(false);
    setIsAiGenerating(true);
    setAiError('');
    try {
      let chosenChar: AlipayContact | undefined;
      if (activeTab === 'xianyu' && includeCharInXianyuAi && contacts.length > 0) {
        if (xianyuAiCharTarget === 'random') {
          chosenChar = contacts[Math.floor(Math.random() * contacts.length)];
        } else {
          chosenChar = contacts.find((contact) => contact.id === xianyuAiCharTarget);
          if (!chosenChar) throw new Error('选择的通讯录角色已不存在，请重新选择。');
        }
      }

      const systemPrompt = chosenChar
        ? `你是闲鱼二手卖家，正在以角色${chosenChar.name}的小号上架闲置商品。角色人设：${getCharacterPersona(chosenChar.id) || '根据聊天角色的生活习惯自然创作'}。商品必须像角色真实拥有并可能出售的物品。`
        : '你是虚拟商城商品编辑，生成符合板块且真实自然的中文商品。闲鱼商品必须是普通路人卖家的二手闲置，不能关联任何通讯录角色。';
      const userPrompt = activeTab === 'xianyu'
        ? '生成 2 到 3 件闲鱼二手闲置商品，文案像真实卖家发布，包含成色、转卖原因或交易语气。只返回 JSON：{"products":[{"title":"标题","desc":"描述","price":数字,"freeShipping":true或false,"emoji":"契合商品的emoji"}]}。'
        : `为${activeTab === 'shopping' ? '淘宝购物' : '饿了么外卖'}板块生成 2 到 3 件符合板块主题的虚拟商品。只返回 JSON：{"products":[{"title":"标题","desc":"描述","price":数字,"emoji":"契合商品的emoji"}]}。`;
      const content = await requestConfiguredAiText(systemPrompt, userPrompt, { json: true });
      const parsed: unknown = JSON.parse(content);
      const rawProducts = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed) && Array.isArray(parsed.products)
          ? parsed.products
          : [];
      const validProducts = rawProducts.filter((product): product is Record<string, unknown> =>
        isRecord(product) &&
        typeof product.title === 'string' &&
        !!product.title.trim() &&
        typeof product.desc === 'string' &&
        !!product.desc.trim() &&
        typeof product.price === 'number' &&
        Number.isFinite(product.price) &&
        product.price > 0
      ).slice(0, 3);
      if (validProducts.length < 2) {
        throw new Error('AI 至少需要返回两件有效商品，请重试。');
      }

      if (activeTab === 'xianyu') {
        const generatedItems: XianyuProduct[] = validProducts.map((product, index) => ({
          id: `xy-ai-${Date.now()}-${index}`,
          title: (product.title as string).trim(),
          desc: (product.desc as string).trim(),
          price: product.price as number,
          freeShipping: typeof product.freeShipping === 'boolean' ? product.freeShipping : true,
          emoji: typeof product.emoji === 'string' ? product.emoji : '📦',
          sellerName: chosenChar
            ? `${chosenChar.name.slice(0, 1)}***的小号`
            : `闲置卖家_${Math.floor(100 + Math.random() * 900)}`,
          linkedCharId: chosenChar?.id,
          isAltAccount: chosenChar ? true : undefined,
          isPlayerItem: false,
        }));
        setXianyuItems((previous) => [...generatedItems, ...previous]);
      } else {
        const category = activeTab;
        const generatedItems: MarketProduct[] = validProducts.map((product, index) => ({
          id: `${category}-ai-${Date.now()}-${index}`,
          category,
          title: (product.title as string).trim(),
          desc: (product.desc as string).trim(),
          price: product.price as number,
          emoji: typeof product.emoji === 'string' ? product.emoji : category === 'shopping' ? '🛍️' : '🍱',
          store: category === 'shopping' ? 'AI 灵感好物店' : 'AI 今日推荐',
          badge: 'AI上新',
        }));
        setMarketProducts((previous) => [...generatedItems, ...previous]);
      }
    } catch (error) {
      console.error('Could not generate Taobao products.', error);
      setAiError(error instanceof Error ? error.message : 'AI 上新失败，请检查 API 配置后重试。');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const sendCharacterDeliveryNotification = async (charId: string, eventText: string) => {
    const character = contacts.find((contact) => contact.id === charId);
    if (!character) throw new Error('找不到要通知的通讯录角色。');
    const rawChats = window.localStorage.getItem(STORAGE_KEYS.wechatChats);
    const parsedChats: unknown = rawChats ? JSON.parse(rawChats) : [];
    if (!Array.isArray(parsedChats)) throw new Error('微信聊天数据格式无效。');
    const chats = parsedChats as Array<Record<string, unknown>>;
    let chat = chats.find((item) =>
      item.type === 'direct' &&
      Array.isArray(item.participantIds) &&
      item.participantIds.length === 1 &&
      item.participantIds[0] === charId
    );
    const timestamp = new Date().toISOString();
    const triggerMessage = {
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: 'user',
      text: `【系统提示：礼物已立即送达】${eventText} 请以角色身份自然地向玩家发一条感谢或互动消息。`,
      createdAt: timestamp,
    };
    if (!chat) {
      chat = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'direct',
        participantIds: [charId],
        noteName: '',
        context: '',
        narratorEnabled: false,
        blocked: false,
        pinned: false,
        avatars: {},
        messages: [],
        updatedAt: timestamp,
        groupTitle: '',
        groupNicknames: {},
        allowAgentGroupRename: false,
        attachHistory: false,
        attachedHistoryCount: 10,
      };
      chats.unshift(chat);
    }
    if (!Array.isArray(chat.messages)) throw new Error('角色微信会话的消息列表格式无效。');
    chat.messages.push(triggerMessage);
    chat.updatedAt = timestamp;
    window.localStorage.setItem(STORAGE_KEYS.wechatChats, JSON.stringify(chats));

    const reply = await requestConfiguredAiText(
      `你正在扮演${character.name}。角色设定：${getCharacterPersona(character.id) || '保持自然、亲切且符合上下文。'}。你刚收到玩家送来的商品，请用微信消息自然感谢或互动。只返回一条简短纯文本消息，不要 JSON。`,
      triggerMessage.text
    );
    const latestRaw = window.localStorage.getItem(STORAGE_KEYS.wechatChats);
    const latestChats: unknown = latestRaw ? JSON.parse(latestRaw) : [];
    if (!Array.isArray(latestChats)) throw new Error('微信聊天数据格式无效，无法保存 AI 回复。');
    const currentChat = (latestChats as Array<Record<string, unknown>>).find((item) => item.id === chat?.id);
    if (!currentChat || !Array.isArray(currentChat.messages)) {
      throw new Error('保存 AI 回复时找不到角色微信会话。');
    }
    const replyTimestamp = new Date().toISOString();
    currentChat.messages.push({
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: charId,
      text: reply,
      thought: '',
      createdAt: replyTimestamp,
    });
    currentChat.updatedAt = replyTimestamp;
    window.localStorage.setItem(STORAGE_KEYS.wechatChats, JSON.stringify(latestChats));
  };

  // ==================== 9. 结算支付与送礼/通知角色 ====================
  const handleConfirmPurchase = async () => {
    if (!checkoutProduct) return;
    if (buyForWho === 'char' && !contacts.some((contact) => contact.id === targetCharId)) {
      setPaymentError('请先选择有效的收礼角色。');
      return;
    }
    const source =
      paymentSelection === 'balance'
        ? { type: 'balance' as const }
        : { type: 'intimate' as const, charId: paymentSelection.slice('intimate:'.length) };

    let purchaseResult: ReturnType<typeof chargeAlipay>;
    try {
      const targetNote =
        buyForWho === 'char'
          ? `送给角色礼物(${contacts.find((c) => c.id === targetCharId)?.name || 'TA'})`
          : '自购';
      purchaseResult = chargeAlipay(
        Number(checkoutProduct.price),
        `${checkoutProduct.type === 'eleme' ? '饿了么' : checkoutProduct.type === 'xianyu' ? '闲鱼' : '淘宝'} · ${checkoutProduct.title} [${targetNote}]`,
        source,
        { recordLedger: false, notifyIntimatePayer: false }
      );
      setFinanceData(purchaseResult.data);
      setPaymentError('');
      setPaymentNotice(
        buyForWho === 'char'
          ? `🎁 已为 TA 买下「${checkoutProduct.title}」并立即送达！`
          : `✨ 已支付「${checkoutProduct.title}」¥${Number(checkoutProduct.price).toFixed(2)}，已立即送达！`
      );
      setCheckoutProduct(null);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : '支付失败，请检查余额或亲密付额度。');
      setPaymentNotice('');
      return;
    }

    try {
      if (buyForWho === 'char') {
        const recipient = contacts.find((contact) => contact.id === targetCharId);
        if (!recipient) throw new Error('找不到收礼角色。');
        const event = `玩家立即送达礼物「${checkoutProduct.title}」（¥${Number(checkoutProduct.price).toFixed(2)}），收礼对象：${recipient.name}。`;
        appendCharacterContextEvent(recipient.id, event, 'taobao');
        await sendCharacterDeliveryNotification(recipient.id, event);
      } else {
        const event = `玩家购买了「${checkoutProduct.title}」（¥${Number(checkoutProduct.price).toFixed(2)}），并选择让你知道。`;
        notifyCharIds.forEach((charId) => appendCharacterContextEvent(charId, event, 'taobao'));
      }
    } catch (error) {
      console.error('Purchase succeeded, but character notification failed.', error);
      setPaymentNotice((notice) =>
        `${notice} 订单已成功，但角色互动通知失败：${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  };

  // ==================== 10. 闲鱼聊一聊会话逻辑 ====================
  const handleStartXianyuChat = (item: XianyuProduct) => {
    setXianyuSubTab('messages');
    const existing = xianyuThreads.find((t) => t.itemId === item.id);
    if (existing) {
      setActiveThreadId(existing.id);
      return;
    }
    const newThread: XianyuChatThread = {
      id: `thread-${Date.now()}`,
      itemId: item.id,
      itemTitle: item.title,
      itemPrice: item.price,
      peerName: item.sellerName,
      linkedCharId: item.linkedCharId,
      isAltAccount: item.isAltAccount,
      isPlayerItem: item.isPlayerItem,
      messages: [],
    };
    setXianyuThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  const handleSendXianyuMessage = async () => {
    if (!chatInput.trim() || !activeThreadId || isXianyuReplying) return;
    const thread = xianyuThreads.find((item) => item.id === activeThreadId);
    if (!thread) return;
    const text = chatInput.trim();
    setChatInput('');
    const userMessage = { id: `m-${Date.now()}`, sender: 'me' as const, text, time: '刚刚' };
    setXianyuThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId
          ? {
              ...t,
              messages: [...t.messages, userMessage],
            }
          : t
      )
    );
    setAiError('');
    setIsXianyuReplying(true);
    const linkedCharacter = thread.linkedCharId
      ? contacts.find((contact) => contact.id === thread.linkedCharId)
      : undefined;
    const history = thread.messages
      .map((message) => `${message.sender === 'me' ? '玩家' : thread.peerName}：${message.text}`)
      .join('\n');
    const playerIdContext = `玩家闲鱼 ID：${playerProfile.xianyuId || '未设置'}。`;
    try {
      if (thread.linkedCharId) {
        appendCharacterContextEvent(
          thread.linkedCharId,
          `闲鱼对话（${thread.isAltAccount ? '小号' : '角色账号'}「${thread.peerName}」）：玩家：${text}`,
          'xianyu'
        );
      }
      const reply = await requestConfiguredAiText(
        linkedCharacter
          ? `你正在闲鱼上扮演角色${linkedCharacter.name}${thread.isAltAccount ? '的小号' : ''}回复买家。角色人设：${getCharacterPersona(linkedCharacter.id) || '自然、可信地交流'}。回复要像真实闲鱼聊天，简洁有生活感，只返回消息正文。`
          : thread.isPlayerItem
            ? `你是闲鱼用户「${thread.peerName}」，正在作为买家咨询玩家发布的二手商品。请像真实买家一样自然简短回复，只返回消息正文。`
            : `你正在扮演闲鱼卖家「${thread.peerName}」，围绕商品自然、简短地回复买家，只返回消息正文。`,
        `${playerIdContext}\n商品「${thread.itemTitle}」（¥${thread.itemPrice}）。\n此前对话：\n${history || '暂无'}\n玩家最新消息：${text}`
      );
      setXianyuThreads((previous) =>
        previous.map((item) =>
          item.id === activeThreadId
            ? {
                ...item,
                messages: [
                  ...item.messages,
                  { id: `m-${Date.now()}`, sender: 'peer', text: reply, time: '刚刚' },
                ],
              }
            : item
        )
      );
      if (thread.linkedCharId) {
        appendCharacterContextEvent(
          thread.linkedCharId,
          `闲鱼对话（${thread.isAltAccount ? '小号' : '角色账号'}「${thread.peerName}」）：${thread.peerName}：${reply}`,
          'xianyu'
        );
      }
    } catch (error) {
      console.error('Could not generate Xianyu chat reply.', error);
      setAiError(error instanceof Error ? error.message : '闲鱼 AI 回复失败，请检查 API 配置。');
    } finally {
      setIsXianyuReplying(false);
    }
  };

  const currentMarketProducts = marketProducts.filter((p) => p.category === activeTab);
  const activeThread = xianyuThreads.find((t) => t.id === activeThreadId) || null;

  const handleExportBackup = () => {
    const dataStr = JSON.stringify(
      { marketProducts, xianyuItems, xianyuThreads, playerProfile, themePresets, activePresetId, currentTheme },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taobao_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="taobao-custom-scope relative flex-1 w-full flex flex-col overflow-hidden select-none"
      style={{
        background: currentTheme.wallpaperUrl
          ? `url(${currentTheme.wallpaperUrl}) center / cover no-repeat`
          : currentTheme.bgGradient,
        color: currentTheme.textColor,
      }}
    >
      {currentTheme.customCss && <style>{currentTheme.customCss}</style>}

      {!currentTheme.wallpaperUrl && (
        <>
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-sky-200/25 blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -right-20 w-64 h-64 rounded-full bg-pink-200/20 blur-3xl pointer-events-none" />
        </>
      )}

      {/* 顶栏：淘宝 */}
      <AppHeader
        title="淘宝"
        onBack={onBack}
        rightAction={
          <button
            onClick={() => setShowTopMenu(true)}
            className="w-8 h-8 flex items-center justify-center text-sky-600 bg-white/70 hover:bg-white/90 backdrop-blur-md border border-white/90 rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="美化预设与数据管理"
          >
            <Menu className="w-4 h-4 stroke-[2]" />
          </button>
        }
      />

      {/* 三大主板块切换胶囊：购物 | 饿了么 | 闲鱼 */}
      <div className="px-4 py-2 z-10 shrink-0">
        <div className="grid grid-cols-3 p-1 bg-white/55 backdrop-blur-xl border border-white/85 rounded-2xl shadow-[0_4px_14px_rgba(148,163,184,0.06)]">
          {[
            { key: 'shopping', label: '购物', icon: ShoppingBag },
            { key: 'eleme', label: '饿了么', icon: Utensils },
            { key: 'xianyu', label: '闲鱼', icon: Tag },
          ].map(({ key, label, icon: TabIcon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key as MainTab)}
                style={isActive ? { background: currentTheme.primaryGradient } : undefined}
                className={`py-2 flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'text-white shadow-xs scale-[1.01]'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 主内容滚动区 */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-1 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),20px)]">
        {paymentNotice && (
          <div
            role="status"
            className="flex items-center justify-between rounded-2xl bg-white/85 backdrop-blur-md border border-emerald-200 px-3.5 py-2.5 text-[11px] font-bold text-emerald-600 shadow-2xs"
          >
            <span>{paymentNotice}</span>
            <button onClick={() => setPaymentNotice('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {aiError && (
          <p role="alert" className="rounded-xl bg-rose-50/90 px-3 py-2 text-[10px] font-semibold text-rose-500">
            {aiError}
          </p>
        )}

        {/* 简洁双按钮栏：“AI 上新”与“加商品/挂闲置”平分整行 */}
        {!(activeTab === 'xianyu' && xianyuSubTab === 'messages') && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleClickAiButton}
              disabled={isAiGenerating}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#9BD2FC] to-[#B6C8F8] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs border border-white/60 active:scale-98 transition-transform cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
              <span>{isAiGenerating ? 'AI 生成中...' : 'AI 上新'}</span>
            </button>

            <button
              onClick={openCreateModal}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#F7B9D2] to-[#F9C6D9] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs border border-white/60 active:scale-98 transition-transform cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{activeTab === 'xianyu' ? '挂闲置' : '加商品'}</span>
            </button>
          </div>
        )}

        {/* ==================== 板块 1 & 2：购物 / 饿了么 ==================== */}
        {(activeTab === 'shopping' || activeTab === 'eleme') && (
          <div className="space-y-2.5">
            {currentMarketProducts.length === 0 ? (
              <div
                style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
                className="backdrop-blur-xl border border-white/85 p-8 text-center space-y-2"
              >
                <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-400 flex items-center justify-center mx-auto text-xl">
                  {activeTab === 'shopping' ? '🛍️' : '🧋'}
                </div>
                <p className="text-xs font-bold opacity-80">还没有商品哦~</p>
                <p className="text-[10px] opacity-55">
                  点击上方「AI 上新」或「加商品」开始布置你的小商城吧！
                </p>
              </div>
            ) : (
              <div
                className={
                  currentTheme.layoutMode === 'grid'
                    ? 'grid grid-cols-2 gap-2.5'
                    : 'space-y-2.5'
                }
              >
                {currentMarketProducts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      backgroundColor: currentTheme.cardBg,
                      borderRadius: currentTheme.cardRadius,
                    }}
                    className={`backdrop-blur-xl p-3.5 border border-white/85 shadow-[0_6px_18px_-6px_rgba(148,163,184,0.12)] transition-all ${
                      currentTheme.layoutMode === 'grid'
                        ? 'flex flex-col justify-between space-y-2'
                        : 'flex gap-3.5'
                    }`}
                  >
                    <div
                      className={`${
                        currentTheme.layoutMode === 'grid' ? 'w-full h-28' : 'w-20 h-20'
                      } rounded-2xl bg-gradient-to-br from-[#E6F3FF] to-[#FDECF3] border border-white shrink-0 flex items-center justify-center text-3xl overflow-hidden`}
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <span>{p.emoji || '🎁'}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[9px] bg-sky-100/80 text-sky-600 font-bold px-1.5 py-0.5 rounded-md shrink-0">
                              {p.badge || (activeTab === 'shopping' ? '好物' : '专送')}
                            </span>
                            {p.fromCharName && (
                              <span className="text-[9px] bg-pink-100 text-pink-500 font-bold px-1.5 py-0.5 rounded-md shrink-0">
                                💝 {p.fromCharName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => openEditMarketProduct(p)}
                              className="p-1 text-slate-400 hover:text-sky-500 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-xs font-extrabold truncate">{p.title}</h4>
                        <p className="text-[10px] opacity-65 line-clamp-2 mt-0.5 leading-relaxed">
                          {p.desc}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/70">
                        <span className="text-sm font-extrabold text-[#E882A6] font-mono">
                          ¥{Number(p.price).toFixed(2)}
                        </span>

                        <button
                          onClick={() => {
                            setPaymentSelection('balance');
                            setBuyForWho('self');
                            setPaymentError('');
                            setCheckoutProduct({
                              id: p.id,
                              title: p.title,
                              price: Number(p.price),
                              type: activeTab,
                            });
                          }}
                          style={{ background: currentTheme.primaryGradient }}
                          className="px-2.5 py-1 rounded-full text-white text-[11px] font-bold active:scale-95 shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <Gift className="w-3 h-3" />
                          <span>下单</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== 板块 3：闲鱼 (商品页 + 消息页) ==================== */}
        {activeTab === 'xianyu' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/55 backdrop-blur-xl border border-white/80 p-1 rounded-2xl">
              <button
                onClick={() => {
                  setXianyuSubTab('market');
                  setActiveThreadId(null);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  xianyuSubTab === 'market'
                    ? 'bg-white text-slate-700 shadow-2xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-sky-400" />
                <span>商品 ({xianyuItems.length})</span>
              </button>

              <button
                onClick={() => setXianyuSubTab('messages')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  xianyuSubTab === 'messages'
                    ? 'bg-white text-slate-700 shadow-2xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 text-pink-400" />
                <span>消息 ({xianyuThreads.length})</span>
              </button>
            </div>

            {/* 闲鱼子页 A：商品集市 */}
            {xianyuSubTab === 'market' && (
              <div
                className={
                  currentTheme.layoutMode === 'grid'
                    ? 'grid grid-cols-2 gap-2.5'
                    : 'space-y-2.5'
                }
              >
                {xianyuItems.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: currentTheme.cardBg,
                      borderRadius: currentTheme.cardRadius,
                    }}
                    className="col-span-2 backdrop-blur-xl border border-white/85 p-8 text-center space-y-2"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-400 flex items-center justify-center mx-auto text-xl">
                      📦
                    </div>
                    <p className="text-xs font-bold opacity-80">闲鱼还没有商品~</p>
                    <p className="text-[10px] opacity-55">
                      点「AI 上新」刷刷角色闲置，或点「挂闲置」自己卖东西！
                    </p>
                  </div>
                ) : (
                  xianyuItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: currentTheme.cardBg,
                        borderRadius: currentTheme.cardRadius,
                      }}
                      className="backdrop-blur-xl p-3.5 border border-white/85 shadow-[0_6px_18px_-6px_rgba(148,163,184,0.1)] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {item.sellerName.slice(0, 1)}
                          </div>
                          <span className="text-[11px] font-bold truncate">@{item.sellerName}</span>
                          {item.isPlayerItem && (
                            <span className="text-[9px] bg-sky-50 text-sky-500 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                              我发布的
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              item.freeShipping
                                ? 'bg-emerald-50 text-emerald-500'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {item.freeShipping ? '包邮' : '自理'}
                          </span>
                          <button
                            onClick={() => openEditXianyuProduct(item)}
                            className="p-1 text-slate-400 hover:text-sky-500 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E6F3FF] to-[#FDECF3] border border-white shrink-0 flex items-center justify-center text-2xl overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <span>{item.emoji || '📦'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-extrabold line-clamp-1">{item.title}</h4>
                          <p className="text-[10px] opacity-65 line-clamp-2 mt-1 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100/70">
                        <span className="text-sm font-extrabold text-[#E882A6] font-mono">
                          ¥{Number(item.price).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStartXianyuChat(item)}
                            className="px-2.5 py-1 rounded-full bg-white border border-sky-100 text-sky-500 text-[10px] font-bold active:scale-95 cursor-pointer"
                          >
                            聊一聊
                          </button>
                          <button
                            onClick={() => {
                              setPaymentSelection('balance');
                              setBuyForWho('self');
                              setCheckoutProduct({
                                id: item.id,
                                title: item.title,
                                price: Number(item.price),
                                type: 'xianyu',
                              });
                            }}
                            style={{ background: currentTheme.primaryGradient }}
                            className="px-2.5 py-1 rounded-full text-white text-[10px] font-bold active:scale-95 cursor-pointer"
                          >
                            拍下
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 闲鱼子页 B：消息列表 + 玩家自己的闲鱼号 */}
            {xianyuSubTab === 'messages' && (
              <div className="space-y-3">
                <div
                  style={{
                    backgroundColor: currentTheme.cardBg,
                    borderRadius: currentTheme.cardRadius,
                  }}
                  className="backdrop-blur-xl border border-white p-3.5 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-white flex items-center justify-center font-extrabold text-sm overflow-hidden border border-white">
                      {playerProfile.avatarUrl ? (
                        <img
                          src={playerProfile.avatarUrl}
                          alt={playerProfile.nickname}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold">{playerProfile.nickname}</span>
                        <span className="text-[10px] font-mono bg-white/80 text-sky-500 px-2 py-0.5 rounded-full border border-sky-100">
                          ID: {playerProfile.xianyuId}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-60 mt-0.5">{playerProfile.bio}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/85 border border-white text-[11px] font-bold text-sky-500 hover:bg-white cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>编辑</span>
                  </button>
                </div>

                {activeThread ? (
                  <div
                    style={{
                      backgroundColor: currentTheme.cardBg,
                      borderRadius: currentTheme.cardRadius,
                    }}
                    className="backdrop-blur-xl border border-white p-4 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <p className="text-xs font-extrabold flex items-center gap-1.5">
                          <span>@{activeThread.peerName}</span>
                          {activeThread.linkedCharId && (
                            <span className="text-[9px] bg-pink-50 text-pink-500 px-1.5 py-0.5 rounded-full">
                              已连通角色记忆
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] opacity-60">
                          宝贝：{activeThread.itemTitle} (¥{activeThread.itemPrice})
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveThreadId(null)}
                        className="text-[11px] text-sky-500 font-bold bg-sky-50 px-2.5 py-1 rounded-full cursor-pointer"
                      >
                        返回
                      </button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto py-1">
                      {activeThread.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            m.sender === 'me' ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            style={
                              m.sender === 'me'
                                ? { background: currentTheme.primaryGradient }
                                : undefined
                            }
                            className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                              m.sender === 'me'
                                ? 'text-white rounded-br-xs'
                                : 'bg-white border border-slate-100 text-slate-700 rounded-bl-xs'
                            }`}
                          >
                            {m.text}
                          </div>
                          <span className="text-[9px] opacity-45 mt-0.5 px-1">{m.time}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendXianyuMessage()}
                        placeholder="发送消息..."
                        className="flex-1 px-3 py-2 rounded-2xl bg-white border border-slate-200 text-xs outline-none"
                      />
                      <button
                        onClick={handleSendXianyuMessage}
                        disabled={isXianyuReplying}
                        style={{ background: currentTheme.primaryGradient }}
                        className="p-2 rounded-2xl text-white cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isXianyuReplying
                          ? <Sparkles className="w-4 h-4 animate-spin" />
                          : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : xianyuThreads.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: currentTheme.cardBg,
                      borderRadius: currentTheme.cardRadius,
                    }}
                    className="backdrop-blur-xl border border-white/85 p-8 text-center space-y-1.5"
                  >
                    <MessageCircle className="w-6 h-6 text-pink-300 mx-auto" />
                    <p className="text-xs font-bold opacity-80">暂无闲鱼消息</p>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: currentTheme.cardBg,
                      borderRadius: currentTheme.cardRadius,
                    }}
                    className="backdrop-blur-xl border border-white/85 divide-y divide-slate-100 overflow-hidden"
                  >
                    {xianyuThreads.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setActiveThreadId(t.id)}
                        className="p-3.5 flex items-center justify-between hover:bg-white/80 cursor-pointer transition-colors"
                      >
                        <div className="space-y-0.5">
                          <span className="text-xs font-extrabold">@{t.peerName}</span>
                          <p className="text-[11px] opacity-60 line-clamp-1">
                            {t.messages[t.messages.length - 1]?.text}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-sky-500 bg-sky-50 px-2.5 py-1 rounded-full">
                          查看
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== 弹窗 0：闲鱼 AI 上新配置窗（选择是否包含角色彩蛋 & 指定/随机角色） ==================== */}
      {showXianyuAiModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-4 text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>闲鱼 AI 上新设置</span>
              </h3>
              <button
                onClick={() => setShowXianyuAiModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 选择本次生成是否包含角色 */}
            <div className="space-y-2">
              <span className="text-xs font-bold block">本次生成是否包含角色闲置彩蛋？</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIncludeCharInXianyuAi(true)}
                  className={`py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                    includeCharInXianyuAi
                      ? 'bg-gradient-to-r from-[#9BD2FC] to-[#F7B9D2] text-white border-transparent shadow-2xs'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  ✨ 是，包含角色
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeCharInXianyuAi(false)}
                  className={`py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                    !includeCharInXianyuAi
                      ? 'bg-sky-400 text-white border-transparent shadow-2xs'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  🌿 否，纯路人闲置
                </button>
              </div>
            </div>

            {/* 如果选择包含角色：出现随机生成 or 角色点选列表 */}
            {includeCharInXianyuAi && (
              <div className="space-y-2 bg-pink-50/50 p-3.5 rounded-2xl border border-pink-100">
                <span className="text-[11px] font-bold text-slate-600 block">
                  选择要偶遇哪位角色的闲置（本人或小号）：
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setXianyuAiCharTarget('random')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 cursor-pointer ${
                      xianyuAiCharTarget === 'random'
                        ? 'bg-pink-400 text-white border-transparent shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>随机角色</span>
                  </button>

                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setXianyuAiCharTarget(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        xianyuAiCharTarget === c.id
                          ? 'bg-sky-400 text-white border-transparent shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {contacts.length === 0 && (
                  <p className="text-[10px] text-slate-400">
                    当前通讯录暂无角色，将默认生成神秘路人闲置~
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowXianyuAiModal(false)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={runAiGeneration}
                disabled={isAiGenerating}
                style={{ background: currentTheme.primaryGradient }}
                className="flex-1 py-2.5 rounded-2xl text-xs font-bold text-white shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiGenerating ? 'AI 生成中...' : '立即生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 1：购买 / 送给角色 / 选择支付方式弹窗 ==================== */}
      {checkoutProduct && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm space-y-3.5 rounded-3xl border border-white bg-white/95 backdrop-blur-2xl p-5 shadow-xl text-slate-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold">确认下单</h2>
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                  {checkoutProduct.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutProduct(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-2xl font-extrabold text-[#E882A6] font-mono">
              ¥{Number(checkoutProduct.price).toFixed(2)}
            </p>

            <div className="space-y-2 bg-slate-50/90 p-3 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold block">收件人与互动方式</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBuyForWho('self')}
                  className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    buyForWho === 'self'
                      ? 'bg-[#8EC5FC] text-white border-transparent'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  🛍️ 买给自己
                </button>
                <button
                  type="button"
                  onClick={() => setBuyForWho('char')}
                  className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    buyForWho === 'char'
                      ? 'bg-[#F5B8D1] text-white border-transparent'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  🎁 送给角色
                </button>
              </div>

              {buyForWho === 'self' && contacts.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  <span className="text-[10px] text-slate-400 block">
                    给自己买时，要让谁知道？（可多选或不选）
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {contacts.map((c) => {
                      const checked = notifyCharIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setNotifyCharIds((prev) =>
                              checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                            checked
                              ? 'bg-sky-50 text-sky-600 border-sky-200'
                              : 'bg-white text-slate-400 border-slate-200'
                          }`}
                        >
                          {checked ? '✓ ' : ''}{c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {buyForWho === 'char' && (
                <div className="pt-1.5 space-y-1">
                  <span className="text-[10px] text-pink-400 font-medium block">
                    选择收礼物的角色（立即到货并触发 TA 主动发信息）：
                  </span>
                  <select
                    value={targetCharId}
                    onChange={(e) => setTargetCharId(e.target.value)}
                    className="w-full rounded-xl border border-pink-100 bg-white px-2.5 py-1.5 text-xs outline-none"
                  >
                    {contacts.length === 0 ? (
                      <option value="">暂无通讯录角色</option>
                    ) : (
                      contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          送给：{c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            <label className="block text-[11px] font-bold">
              选择付款方式
              <select
                value={paymentSelection}
                onChange={(event) => setPaymentSelection(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
              >
                <option value="balance">
                  支付宝个人余额 · ¥{financeData.balance.toFixed(2)}
                </option>
                {financeData.intimateCards.map((card) => {
                  const contact = contacts.find((item) => item.id === card.charId);
                  const displayName = contact?.name || 'TA';
                  const avail = Math.max(0, card.monthlyLimit - card.usedAmount);
                  return (
                    <option
                      key={card.id}
                      value={`intimate:${card.charId}`}
                      disabled={avail < Number(checkoutProduct.price)}
                    >
                      {displayName} 的亲密付 · 可用 ¥{avail.toFixed(2)}
                    </option>
                  );
                })}
              </select>
            </label>

            {paymentError && (
              <p role="alert" className="text-[11px] text-rose-500 font-bold">
                {paymentError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCheckoutProduct(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                style={{ background: currentTheme.primaryGradient }}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white shadow-2xs cursor-pointer"
              >
                确认支付
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ==================== 弹窗 2：新增 / 编辑商品弹窗（玩家挂闲置仅保留“是否包邮”开关，默认玩家本人） ==================== */}
      {showEditorModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3 max-h-[90%] overflow-y-auto text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">
                {editingId ? '编辑商品' : activeTab === 'xianyu' ? '挂出我的闲置' : '上架新商品'}
              </h3>
              <button
                onClick={() => setShowEditorModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="商品名称"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs font-bold"
            />

            <textarea
              placeholder="商品简介 / 闲置描述..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="价格 (¥)"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs font-mono font-bold"
              />
              <input
                type="text"
                placeholder="默认 Emoji (如 🎁)"
                value={formEmoji}
                onChange={(e) => setFormEmoji(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs text-center"
              />
            </div>

            <div className="space-y-1.5 bg-sky-50/50 p-3 rounded-2xl border border-sky-100">
              <span className="text-[11px] font-bold flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>商品图片（支持 URL 或本地上传）</span>
              </span>
              <input
                type="text"
                placeholder="粘贴图片 URL..."
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-sky-100 text-sky-500 text-[11px] font-bold cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>从本地相册上传</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLocalImageUpload(e, (b64) => setFormImageUrl(b64))}
                />
              </label>
            </div>

            {/* 闲鱼专属：仅保留清爽的“是否包邮”开关，默认就是玩家自己的闲置 */}
            {activeTab === 'xianyu' && (
              <div className="flex items-center justify-between bg-pink-50/40 p-3 rounded-2xl border border-pink-100">
                <span className="text-xs font-bold">是否包邮</span>
                <button
                  type="button"
                  onClick={() => setFormFreeShipping(!formFreeShipping)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                    formFreeShipping ? 'bg-emerald-400 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {formFreeShipping ? '✓ 包邮' : '邮费自理'}
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowEditorModal(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveProduct}
                style={{ background: currentTheme.primaryGradient }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 3：玩家闲鱼号资料编辑 ==================== */}
      {showProfileModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3 text-slate-700">
            <h3 className="text-sm font-extrabold">编辑我的闲鱼号</h3>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">闲鱼昵称</label>
              <input
                type="text"
                value={playerProfile.nickname}
                onChange={(e) => setPlayerProfile({ ...playerProfile, nickname: e.target.value })}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-sky-500 font-bold">闲鱼 ID（AI 仅需读取此 ID）</label>
              <input
                type="text"
                value={playerProfile.xianyuId}
                onChange={(e) => setPlayerProfile({ ...playerProfile, xianyuId: e.target.value })}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">个人简介</label>
              <input
                type="text"
                value={playerProfile.bio}
                onChange={(e) => setPlayerProfile({ ...playerProfile, bio: e.target.value })}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs"
              />
            </div>
            <div className="space-y-1.5 bg-sky-50/50 p-3 rounded-2xl border border-sky-100">
              <span className="text-[11px] font-bold block">头像图片 (URL 或本地上传)</span>
              <input
                type="text"
                placeholder="输入头像图床 URL..."
                value={playerProfile.avatarUrl}
                onChange={(e) => setPlayerProfile({ ...playerProfile, avatarUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-sky-100 text-sky-500 text-[11px] font-bold cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>上传本地头像</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleLocalImageUpload(e, (b64) =>
                      setPlayerProfile({ ...playerProfile, avatarUrl: b64 })
                    )
                  }
                />
              </label>
            </div>
            <button
              onClick={() => setShowProfileModal(false)}
              style={{ background: currentTheme.primaryGradient }}
              className="w-full py-2.5 rounded-2xl text-white text-xs font-bold cursor-pointer"
            >
              完成保存
            </button>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 4：右上角编辑页面（美化预设 + 壁纸 + 数据管理） ==================== */}
      {showTopMenu && (
        <div className="absolute inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 max-h-[92%] overflow-y-auto text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">淘宝 · 美化与数据中心</h3>
              <button
                onClick={() => setShowTopMenu(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setMenuTab('theme')}
                className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  menuTab === 'theme' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>淘宝美化与预设</span>
              </button>
              <button
                onClick={() => setMenuTab('data')}
                className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  menuTab === 'data' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>数据导入/导出</span>
              </button>
            </div>

            {menuTab === 'theme' && (
              <div className="space-y-3 text-xs">
                <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">当前美化预设</span>
                    {activePresetId !== 'default' && (
                      <button
                        onClick={() => handleDeletePreset(activePresetId)}
                        className="text-[10px] text-rose-500 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>删除此预设</span>
                      </button>
                    )}
                  </div>

                  <select
                    value={activePresetId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-sky-200 text-xs font-bold outline-none"
                  >
                    {themePresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="输入新预设名称（如：黑银、奶油白）"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
                    />
                    <button
                      onClick={handleSaveAsNewPreset}
                      className="px-2.5 py-1.5 rounded-xl bg-sky-400 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      存为预设
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-2">
                  <span className="font-bold block">各栏目商品布局</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentTheme({ ...currentTheme, layoutMode: 'list' })}
                      className={`py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${
                        currentTheme.layoutMode === 'list'
                          ? 'bg-sky-400 text-white border-transparent'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      单列精致列表
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentTheme({ ...currentTheme, layoutMode: 'grid' })}
                      className={`py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${
                        currentTheme.layoutMode === 'grid'
                          ? 'bg-sky-400 text-white border-transparent'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      双列瀑布网格
                    </button>
                  </div>
                </div>

                <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">淘宝专属背景壁纸</span>
                    {currentTheme.wallpaperUrl && (
                      <button
                        onClick={() => setCurrentTheme({ ...currentTheme, wallpaperUrl: '' })}
                        className="text-[10px] text-rose-400 font-bold cursor-pointer"
                      >
                        清除壁纸
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="粘贴壁纸图床 URL..."
                    value={currentTheme.wallpaperUrl}
                    onChange={(e) =>
                      setCurrentTheme({ ...currentTheme, wallpaperUrl: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-pink-200 text-pink-500 text-[11px] font-bold cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>本地上传壁纸</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleLocalImageUpload(e, (b64) =>
                          setCurrentTheme({ ...currentTheme, wallpaperUrl: b64 })
                        )
                      }
                    />
                  </label>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-2">
                  <span className="font-bold block">配色与样式参数（可直接参照原参数修改）</span>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block">
                      背景渐变色 (原值: linear-gradient(180deg, #F0F7FF 0%, #F7F4FC 50%, #FFF2F7 100%))
                    </label>
                    <input
                      type="text"
                      value={currentTheme.bgGradient}
                      onChange={(e) =>
                        setCurrentTheme({ ...currentTheme, bgGradient: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block">
                      高亮/按钮渐变色 (原值: linear-gradient(90deg, #8EC5FC 0%, #F5B8D1 100%))
                    </label>
                    <input
                      type="text"
                      value={currentTheme.primaryGradient}
                      onChange={(e) =>
                        setCurrentTheme({ ...currentTheme, primaryGradient: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block">卡片底色</label>
                      <input
                        type="text"
                        value={currentTheme.cardBg}
                        onChange={(e) =>
                          setCurrentTheme({ ...currentTheme, cardBg: e.target.value })
                        }
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">文字色</label>
                      <input
                        type="text"
                        value={currentTheme.textColor}
                        onChange={(e) =>
                          setCurrentTheme({ ...currentTheme, textColor: e.target.value })
                        }
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">圆角</label>
                      <input
                        type="text"
                        value={currentTheme.cardRadius}
                        onChange={(e) =>
                          setCurrentTheme({ ...currentTheme, cardRadius: e.target.value })
                        }
                        className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] text-slate-400 block">
                      进阶自定义 CSS（选填）
                    </label>
                    <textarea
                      rows={2}
                      value={currentTheme.customCss}
                      onChange={(e) =>
                        setCurrentTheme({ ...currentTheme, customCss: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-mono"
                    />
                  </div>

                  <button
                    onClick={handleUpdateCurrentPreset}
                    style={{ background: currentTheme.primaryGradient }}
                    className="w-full py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer mt-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>保存修改到「{themePresets.find((p) => p.id === activePresetId)?.name}」</span>
                  </button>
                </div>
              </div>
            )}

            {menuTab === 'data' && (
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={handleExportBackup}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 hover:bg-sky-50/50 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>导出数据</span>
                </button>

                <label className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 hover:bg-sky-50/50 text-xs font-bold text-slate-600 cursor-pointer">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>导入数据</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        try {
                          const data: unknown = JSON.parse(String(ev.target?.result));
                          if (!isRecord(data)) throw new Error('导入文件内容必须是对象。');
                          if (isMarketProductList(data.marketProducts)) setMarketProducts(data.marketProducts);
                          if (isXianyuProductList(data.xianyuItems)) setXianyuItems(data.xianyuItems);
                          if (isXianyuThreadList(data.xianyuThreads)) setXianyuThreads(data.xianyuThreads);
                          if (isPlayerXianyuProfile(data.playerProfile)) setPlayerProfile(data.playerProfile);
                          if (isThemePresetList(data.themePresets)) {
                            const presets = data.themePresets.some((preset) => preset.id === 'default')
                              ? data.themePresets
                              : [DEFAULT_TAOBAO_PRESET, ...data.themePresets];
                            setThemePresets(presets);
                            const selectedId = typeof data.activePresetId === 'string' &&
                              presets.some((preset) => preset.id === data.activePresetId)
                              ? data.activePresetId
                              : 'default';
                            setActivePresetId(selectedId);
                            setCurrentTheme(
                              isThemePreset(data.currentTheme)
                                ? data.currentTheme
                                : presets.find((preset) => preset.id === selectedId) ?? DEFAULT_TAOBAO_PRESET
                            );
                          }
                          setShowTopMenu(false);
                        } catch (error) {
                          console.error('Could not import Taobao backup.', error);
                          alert(error instanceof Error ? error.message : '导入文件格式错误');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>

                <button
                  onClick={() => {
                    if (window.confirm('确定要清空所有淘宝、饿了么和闲鱼商品及聊天数据吗？')) {
                      setMarketProducts([]);
                      setXianyuItems([]);
                      setXianyuThreads([]);
                      setShowTopMenu(false);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-rose-50/70 border border-rose-100 hover:bg-rose-100/60 text-xs font-bold text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>清除数据</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};