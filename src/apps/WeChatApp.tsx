import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Users,
  Compass,
  User,
  Search,
  Plus,
  Heart,
  MessageCircle,
  MoreVertical,
  Star,
  Upload,
  Trash2,
  X,
  Menu,
  Pin,
  Download,
  Send,
  ImagePlus,
  Camera,
  Video,
  MapPin,
  Gift,
  RefreshCw,
  Wallet,
  Link,
  Smile,
  Mic,
  WandSparkles,
  Phone,
  Pencil,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { WECHAT_MOMENTS } from '../data/mockData';
import { PersonaCollection, UserPersona } from '../types';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { compressImageFile } from '../utils/imageFile';
import { buildPrompt } from '../utils/buildPrompt';

interface WeChatAppProps {
  onBack: () => void;
}

type WeChatTab = 'chats' | 'contacts' | 'moments' | 'me';

interface ContactWorldBookLink {
  bookId: string;
  entryId?: string;
}

interface ContactPersona {
  id: string;
  avatarUrl: string;
  name: string;
  persona: string;
  worldBooks: ContactWorldBookLink[];
  group: string;
  starred: boolean;
}

interface ContactWorldBookEntry {
  id: string;
  title: string;
  content: string;
}

interface ContactWorldBook {
  id: string;
  name: string;
  entries: ContactWorldBookEntry[];
}

type ChatType = 'direct' | 'group' | 'observer';

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  kind?: 'text' | 'image' | 'voice' | 'sticker' | 'video-call' | 'location' | 'red-packet' | 'transfer' | 'link';
  imageUrl?: string;
  title?: string;
  source?: string;
  content?: string;
  amount?: string;
  quantity?: number;
  recipientId?: string;
  thought?: string;
}

interface ChatSticker {
  id: string;
  imageUrl: string;
  description: string;
}

interface ApiPreset {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model?: string;
}

interface ChatContextPreset {
  id: string;
  name: string;
  context: string;
}

interface ChatAppearancePreset {
  id: string;
  name: string;
  backgroundUrl: string;
  userBubbleColor?: string;
  characterBubbleColor?: string;
  bubbleCss?: string;
  layoutCss?: string;
  sendIconUrl?: string;
  generateIconUrl?: string;
}

interface BubbleCssPreset {
  id: string;
  name: string;
  css: string;
}

interface ChatAppearance {
  backgroundUrl: string;
  userBubbleColor: string;
  characterBubbleColor: string;
  bubbleCss?: string;
  layoutCss?: string;
  sendIconUrl?: string;
  generateIconUrl?: string;
  presets: ChatAppearancePreset[];
  bubblePresets?: BubbleCssPreset[];
}

interface ChatConversation {
  id: string;
  type: ChatType;
  participantIds: string[];
  noteName: string;
  context: string;
  narratorEnabled: boolean;
  blocked: boolean;
  pinned: boolean;
  avatars: Record<string, string>;
  messages: ChatMessage[];
  updatedAt: string;
  groupTitle?: string;
  groupNicknames?: Record<string, string>;
  allowAgentGroupRename?: boolean;
  attachHistory?: boolean;
  attachedHistoryContactId?: string;
  attachedHistoryCount?: number;
  attachedHistoryChatIds?: string[];
}

const PERSONA_STORAGE_KEY = 'pocketos:personas';
const CONTACTS_STORAGE_KEY = 'pocketos:wechat-contacts';
const CONTACT_EXPORT_FORMAT = 'yyphone-contacts';
const CHATS_STORAGE_KEY = 'yyphone:wechat-chats';
const CHAT_CONTEXT_PRESETS_STORAGE_KEY = 'yyphone:chat-context-presets';
const CHAT_STICKERS_STORAGE_KEY = 'yyphone:chat-stickers';
const API_PRESETS_STORAGE_KEY = 'yyphone:api-presets';
const ACTIVE_API_PRESET_STORAGE_KEY = 'yyphone:active-api-preset';
const CHAT_APPEARANCE_STORAGE_KEY = 'yyphone:chat-appearance';
const BASIC_EMOJIS = ['😀', '😂', '🥰', '😍', '😎', '😭', '🥺', '😡', '🤔', '👍', '👎', '❤️', '💕', '🎉', '🙏', '🌹'];
const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  backgroundUrl: '',
  userBubbleColor: '#d1fae5',
  characterBubbleColor: '#ffffff',
  bubbleCss: '',
  layoutCss: '',
  sendIconUrl: '',
  generateIconUrl: '',
  presets: [],
  bubblePresets: [],
};
const DEFAULT_PERSONA: UserPersona = {
  id: 'persona-default',
  name: '默认人设',
  avatarUrl: '',
  identity: '',
  personality: '',
  background: '',
  speakingStyle: '',
};
const DEFAULT_PERSONAS: PersonaCollection = {
  profiles: [DEFAULT_PERSONA],
  activeProfileId: DEFAULT_PERSONA.id,
};

const isPersonaCollection = (value: unknown): value is PersonaCollection => {
  if (!value || typeof value !== 'object') return false;
  const collection = value as Partial<PersonaCollection>;
  return (
    Array.isArray(collection.profiles) &&
    typeof collection.activeProfileId === 'string' &&
    collection.profiles.every(
      (profile) =>
        !!profile &&
        typeof profile.id === 'string' &&
        typeof profile.name === 'string' &&
        (profile.avatarUrl === undefined || typeof profile.avatarUrl === 'string') &&
        typeof profile.identity === 'string' &&
        typeof profile.personality === 'string' &&
        typeof profile.background === 'string' &&
        typeof profile.speakingStyle === 'string'
    ) &&
    collection.profiles.some((profile) => profile.id === collection.activeProfileId)
  );
};

const isContactList = (value: unknown): value is ContactPersona[] =>
  Array.isArray(value) &&
  value.every(
    (contact) =>
      !!contact &&
      typeof contact === 'object' &&
      typeof contact.id === 'string' &&
      typeof contact.avatarUrl === 'string' &&
      typeof contact.name === 'string' &&
      typeof contact.persona === 'string' &&
      typeof contact.group === 'string' &&
      typeof contact.starred === 'boolean' &&
      Array.isArray(contact.worldBooks) &&
      contact.worldBooks.every(
        (link: ContactWorldBookLink) =>
          !!link &&
          typeof link.bookId === 'string' &&
          (link.entryId === undefined || typeof link.entryId === 'string')
      )
  );

const isChatList = (value: unknown): value is ChatConversation[] =>
  Array.isArray(value) &&
  value.every(
    (chat) =>
      !!chat &&
      typeof chat === 'object' &&
      typeof chat.id === 'string' &&
      (chat.type === 'direct' || chat.type === 'group' || chat.type === 'observer') &&
      Array.isArray(chat.participantIds) &&
      chat.participantIds.every((id: unknown) => typeof id === 'string') &&
      typeof chat.noteName === 'string' &&
      typeof chat.context === 'string' &&
      typeof chat.narratorEnabled === 'boolean' &&
      typeof chat.blocked === 'boolean' &&
      typeof chat.pinned === 'boolean' &&
      !!chat.avatars &&
      typeof chat.avatars === 'object' &&
      Object.values(chat.avatars).every((url: unknown) => typeof url === 'string') &&
      Array.isArray(chat.messages) &&
      chat.messages.every(
        (message: ChatMessage) =>
          !!message &&
          typeof message.id === 'string' &&
          typeof message.senderId === 'string' &&
          typeof message.text === 'string' &&
          typeof message.createdAt === 'string' &&
          (message.kind === undefined ||
            ['text', 'image', 'voice', 'sticker', 'video-call', 'location', 'red-packet', 'transfer', 'link'].includes(message.kind)) &&
          (message.imageUrl === undefined || typeof message.imageUrl === 'string') &&
          (message.title === undefined || typeof message.title === 'string') &&
          (message.source === undefined || typeof message.source === 'string') &&
          (message.content === undefined || typeof message.content === 'string') &&
          (message.amount === undefined || typeof message.amount === 'string') &&
          (message.quantity === undefined || typeof message.quantity === 'number') &&
          (message.recipientId === undefined || typeof message.recipientId === 'string') &&
          (message.thought === undefined || typeof message.thought === 'string')
      ) &&
      (chat.groupTitle === undefined || typeof chat.groupTitle === 'string') &&
      (chat.groupNicknames === undefined ||
        (!!chat.groupNicknames &&
          typeof chat.groupNicknames === 'object' &&
          Object.values(chat.groupNicknames).every((name: unknown) => typeof name === 'string'))) &&
      (chat.allowAgentGroupRename === undefined || typeof chat.allowAgentGroupRename === 'boolean') &&
      (chat.attachHistory === undefined || typeof chat.attachHistory === 'boolean') &&
      (chat.attachedHistoryContactId === undefined || typeof chat.attachedHistoryContactId === 'string') &&
      (chat.attachedHistoryCount === undefined || typeof chat.attachedHistoryCount === 'number') &&
      (chat.attachedHistoryChatIds === undefined ||
        (Array.isArray(chat.attachedHistoryChatIds) &&
          chat.attachedHistoryChatIds.every((id: unknown) => typeof id === 'string'))) &&
      typeof chat.updatedAt === 'string'
  );

const isChatStickerList = (value: unknown): value is ChatSticker[] =>
  Array.isArray(value) &&
  value.every(
    (sticker) =>
      !!sticker &&
      typeof sticker === 'object' &&
      typeof sticker.id === 'string' &&
      typeof sticker.imageUrl === 'string' &&
      typeof sticker.description === 'string'
  );

const isApiPresetList = (value: unknown): value is ApiPreset[] =>
  Array.isArray(value) &&
  value.every(
    (preset) =>
      !!preset &&
      typeof preset === 'object' &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      typeof preset.endpoint === 'string' &&
      typeof preset.apiKey === 'string' &&
      (preset.model === undefined || typeof preset.model === 'string')
  );
const isChatContextPresetList = (value: unknown): value is ChatContextPreset[] =>
  Array.isArray(value) &&
  value.every(
    (preset) =>
      !!preset &&
      typeof preset === 'object' &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      typeof preset.context === 'string'
  );

const isChatAppearance = (value: unknown): value is ChatAppearance =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as ChatAppearance).backgroundUrl === 'string' &&
  typeof (value as ChatAppearance).userBubbleColor === 'string' &&
  typeof (value as ChatAppearance).characterBubbleColor === 'string' &&
  ((value as ChatAppearance).bubbleCss === undefined || typeof (value as ChatAppearance).bubbleCss === 'string') &&
  ((value as ChatAppearance).layoutCss === undefined || typeof (value as ChatAppearance).layoutCss === 'string') &&
  ((value as ChatAppearance).sendIconUrl === undefined || typeof (value as ChatAppearance).sendIconUrl === 'string') &&
  ((value as ChatAppearance).generateIconUrl === undefined || typeof (value as ChatAppearance).generateIconUrl === 'string') &&
  Array.isArray((value as ChatAppearance).presets) &&
  (value as ChatAppearance).presets.every(
    (preset) =>
      !!preset &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      typeof preset.backgroundUrl === 'string' &&
      (preset.userBubbleColor === undefined || typeof preset.userBubbleColor === 'string') &&
      (preset.characterBubbleColor === undefined || typeof preset.characterBubbleColor === 'string') &&
      (preset.bubbleCss === undefined || typeof preset.bubbleCss === 'string') &&
      (preset.layoutCss === undefined || typeof preset.layoutCss === 'string') &&
      (preset.sendIconUrl === undefined || typeof preset.sendIconUrl === 'string') &&
      (preset.generateIconUrl === undefined || typeof preset.generateIconUrl === 'string')
  ) &&
  ((value as ChatAppearance).bubblePresets === undefined ||
    (Array.isArray((value as ChatAppearance).bubblePresets) &&
      (value as ChatAppearance).bubblePresets!.every(
        (preset) =>
          !!preset &&
          typeof preset.id === 'string' &&
          typeof preset.name === 'string' &&
          typeof preset.css === 'string'
      )));

const splitCssSelectors = (selectorText: string) => {
  const selectors: string[] = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const character of selectorText) {
    if (quote) {
      current += character;
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth -= 1;
    if (character === ',' && depth === 0) {
      selectors.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) selectors.push(current.trim());
  return selectors;
};

const scopeChatCss = (css: string) => {
  if (!css.trim()) return '';
  if (css.length > 20000) throw new Error('CSS 最多支持 20000 个字符。');
  if (/@|url\s*\(|expression\s*\(|javascript\s*:/i.test(css)) {
    throw new Error('CSS 不支持 @ 规则、外部资源链接或脚本表达式。');
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return Array.from(sheet.cssRules).map((rule) => {
    if (!(rule instanceof CSSStyleRule)) {
      throw new Error('仅支持普通 CSS 选择器和样式声明，不支持 @ 规则。');
    }
    for (let index = 0; index < rule.style.length; index += 1) {
      const property = rule.style.item(index);
      const value = rule.style.getPropertyValue(property);
      if (/url\s*\(|expression\s*\(|javascript\s*:/i.test(value)) {
        throw new Error('CSS 样式声明中不能引用外部资源或脚本。');
      }
    }
    const scopedSelectors = splitCssSelectors(rule.selectorText)
      .map((selector) => `.yy-chat-surface ${selector}`)
      .join(', ');
    return `${scopedSelectors} { ${rule.style.cssText} }`;
  }).join('\n');
};

const readContactWorldBooks = (): ContactWorldBook[] => {
  try {
    const raw = window.localStorage.getItem('yyphone:world-books');
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((book): ContactWorldBook[] => {
      if (
        !book ||
        typeof book !== 'object' ||
        typeof book.id !== 'string' ||
        typeof book.name !== 'string' ||
        !Array.isArray(book.entries)
      ) {
        return [];
      }
      const entries = book.entries.flatMap((entry: unknown): ContactWorldBookEntry[] => {
        if (!entry || typeof entry !== 'object') return [];
        const record = entry as Record<string, unknown>;
        return typeof record.id === 'string' && typeof record.title === 'string'
          ? [{ id: record.id, title: record.title, content: typeof record.content === 'string' ? record.content : '' }]
          : [];
      });
      return [{ id: book.id, name: book.name, entries }];
    });
  } catch (error) {
    console.error('Could not read world books for contacts.', error);
    return [];
  }
};

export const WeChatApp: React.FC<WeChatAppProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<WeChatTab>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [personaCollection, setPersonaCollection] = useState(() =>
    readStoredValue(PERSONA_STORAGE_KEY, DEFAULT_PERSONAS, isPersonaCollection)
  );
  const selectedPersona =
    personaCollection.profiles.find(
      (persona) => persona.id === personaCollection.activeProfileId
    ) ?? DEFAULT_PERSONA;
  const [personaDraft, setPersonaDraft] = useState(selectedPersona);
  const [personaStatus, setPersonaStatus] = useState('');
  const [personaError, setPersonaError] = useState('');
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [chatAppearance, setChatAppearance] = useState(() =>
    readStoredValue(CHAT_APPEARANCE_STORAGE_KEY, DEFAULT_CHAT_APPEARANCE, isChatAppearance)
  );
  const [chatAppearancePresetName, setChatAppearancePresetName] = useState('');
  const [selectedChatAppearancePresetId, setSelectedChatAppearancePresetId] = useState('');
  const [bubbleCssPresetName, setBubbleCssPresetName] = useState('');
  const [selectedBubbleCssPresetId, setSelectedBubbleCssPresetId] = useState('');
  const [chatAppearanceMessage, setChatAppearanceMessage] = useState('');
  const [chatAppearanceError, setChatAppearanceError] = useState('');
  const chatAppearanceImportRef = useRef<HTMLInputElement>(null);
  const bubbleCssImportRef = useRef<HTMLInputElement>(null);
  const sendIconUploadRef = useRef<HTMLInputElement>(null);
  const generateIconUploadRef = useRef<HTMLInputElement>(null);
  const [activeCallMode, setActiveCallMode] = useState<'voice' | 'video' | null>(null);
  const [callChoiceOpen, setCallChoiceOpen] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [contacts, setContacts] = useState(() =>
    readStoredValue(CONTACTS_STORAGE_KEY, [] as ContactPersona[], isContactList)
  );
  const [contactsMenuOpen, setContactsMenuOpen] = useState(false);
  const [isContactEditorOpen, setIsContactEditorOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactPersona>({
    id: '',
    avatarUrl: '',
    name: '',
    persona: '',
    worldBooks: [],
    group: '',
    starred: false,
  });
  const [contactWorldBooks, setContactWorldBooks] = useState<ContactWorldBook[]>([]);
  const [contactError, setContactError] = useState('');
  const [activeContactMenuId, setActiveContactMenuId] = useState('');
  const [importError, setImportError] = useState('');
  const contactImportRef = useRef<HTMLInputElement>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextChatClickRef = useRef(false);
  const [chats, setChats] = useState(() =>
    readStoredValue(CHATS_STORAGE_KEY, [] as ChatConversation[], isChatList)
  );
  const [chatCreateMenuOpen, setChatCreateMenuOpen] = useState(false);
  const [chatCreateMode, setChatCreateMode] = useState<ChatType | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [chatError, setChatError] = useState('');
  const [activeChatId, setActiveChatId] = useState('');
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsDraft, setChatSettingsDraft] = useState<ChatConversation | null>(null);
  const [chatMessageDraft, setChatMessageDraft] = useState('');
  const [activeChatMenuId, setActiveChatMenuId] = useState('');
  const [isProcessingChatImage, setIsProcessingChatImage] = useState(false);
  const chatImportRef = useRef<HTMLInputElement>(null);
  const [contextPresets, setContextPresets] = useState(() =>
    readStoredValue(CHAT_CONTEXT_PRESETS_STORAGE_KEY, [] as ChatContextPreset[], isChatContextPresetList)
  );
  const [selectedContextPresetId, setSelectedContextPresetId] = useState('');
  const [contextPresetName, setContextPresetName] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [attachmentMode, setAttachmentMode] = useState<
    'photo' | 'camera' | 'location' | 'red-packet' | 'transfer' | 'link' | null
  >(null);
  const [attachmentDraft, setAttachmentDraft] = useState({
    imageUrl: '',
    text: '',
    title: '',
    source: '',
    content: '',
    amount: '',
    quantity: '1',
    recipientId: '',
  });
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState('');
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const [stickers, setStickers] = useState(() =>
    readStoredValue(CHAT_STICKERS_STORAGE_KEY, [] as ChatSticker[], isChatStickerList)
  );
  const [stickerDrafts, setStickerDrafts] = useState<ChatSticker[]>([]);
  const stickerUploadRef = useRef<HTMLInputElement>(null);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [activeThought, setActiveThought] = useState<{ name: string; thought: string } | null>(null);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.dataset.yyphoneChatAppearance = 'true';
    try {
      styleElement.textContent = [
        '.yy-chat-surface .yy-chat-message-bubble:not(.is-special) { background-color: var(--yy-character-bubble-color); }',
        '.yy-chat-surface .yy-chat-message-bubble.is-user:not(.is-special) { background-color: var(--yy-user-bubble-color); }',
        scopeChatCss(chatAppearance.bubbleCss ?? ''),
        scopeChatCss(chatAppearance.layoutCss ?? ''),
      ].filter(Boolean).join('\n');
      document.head.appendChild(styleElement);
      setChatAppearanceError('');
    } catch (error) {
      console.error('Could not apply chat appearance CSS.', error);
      setChatAppearanceError(error instanceof Error ? error.message : 'CSS 样式无效，无法应用。');
    }
    return () => styleElement.remove();
  }, [chatAppearance.bubbleCss, chatAppearance.layoutCss]);

  const moments = WECHAT_MOMENTS;

  const savePersonaCollection = (updatedCollection: PersonaCollection) => {
    try {
      writeStoredValue(PERSONA_STORAGE_KEY, updatedCollection);
      setPersonaCollection(updatedCollection);
      setPersonaError('');
      return true;
    } catch (error) {
      console.error('Could not save player personas.', error);
      setPersonaError('保存失败，请检查浏览器本地存储空间后重试。');
      setPersonaStatus('');
      return false;
    }
  };

  const handleSavePersona = () => {
    const updatedPersona = {
      ...personaDraft,
      name: personaDraft.name.trim() || '未命名人设',
    };
    const updatedCollection = {
      ...personaCollection,
      profiles: personaCollection.profiles.map((persona) =>
        persona.id === updatedPersona.id ? updatedPersona : persona
      ),
    };
    if (savePersonaCollection(updatedCollection)) {
      setPersonaDraft(updatedPersona);
      setPersonaStatus('人设已保存。');
    }
  };

  const handleSelectPersona = (id: string) => {
    const persona = personaCollection.profiles.find((item) => item.id === id);
    if (!persona) return;
    const updatedCollection = { ...personaCollection, activeProfileId: id };
    if (savePersonaCollection(updatedCollection)) {
      setPersonaDraft(persona);
      setPersonaStatus('已切换当前人设。');
    }
  };

  const handleSavePersonaAsPreset = () => {
    const name = presetNameDraft.trim();
    if (!name) {
      setPersonaError('请填写人设预设名称。');
      setPersonaStatus('');
      return;
    }
    const newPersona: UserPersona = {
      ...personaDraft,
      id: `persona-${Date.now()}`,
      name,
    };
    const updatedCollection = {
      profiles: [...personaCollection.profiles, newPersona],
      activeProfileId: newPersona.id,
    };
    if (savePersonaCollection(updatedCollection)) {
      setPersonaDraft(newPersona);
      setPresetNameDraft('');
      setPersonaStatus('当前人设已保存为预设并应用。');
    }
  };

  const handleDeletePersonaPreset = () => {
    if (personaCollection.profiles.length <= 1) {
      setPersonaError('至少保留一个人设预设。');
      setPersonaStatus('');
      return;
    }
    const nextProfiles = personaCollection.profiles.filter(
      (persona) => persona.id !== personaCollection.activeProfileId
    );
    const nextActivePersona = nextProfiles[0];
    const updatedCollection = {
      profiles: nextProfiles,
      activeProfileId: nextActivePersona.id,
    };
    if (savePersonaCollection(updatedCollection)) {
      setPersonaDraft(nextActivePersona);
      setPersonaStatus('当前人设预设已删除，并切换到另一个预设。');
    }
  };

  const updatePersonaField = (field: keyof UserPersona, value: string) => {
    setPersonaDraft((current) => ({ ...current, [field]: value }));
    setPersonaStatus('');
    setPersonaError('');
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    setIsProcessingAvatar(true);
    setPersonaError('');
    try {
      const avatarUrl = await compressImageFile(file);
      updatePersonaField('avatarUrl', avatarUrl);
    } catch (uploadError) {
      setPersonaError(uploadError instanceof Error ? uploadError.message : '图片处理失败。');
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  const updateChatAppearance = (updates: Partial<ChatAppearance>) => {
    setChatAppearance((current) => ({ ...current, ...updates }));
    setChatAppearanceMessage('');
    setChatAppearanceError('');
  };

  const persistChatAppearance = (nextAppearance: ChatAppearance) => {
    try {
      writeStoredValue(CHAT_APPEARANCE_STORAGE_KEY, nextAppearance);
      setChatAppearance(nextAppearance);
      setChatAppearanceError('');
      setChatAppearanceMessage('聊天美化已保存。');
      return true;
    } catch (error) {
      console.error('Could not save chat appearance.', error);
      setChatAppearanceMessage('');
      setChatAppearanceError('保存失败，请检查本地存储空间。');
      return false;
    }
  };

  const handleChatBackgroundUpload = async (file?: File) => {
    if (!file) return;
    setIsProcessingChatImage(true);
    setChatAppearanceError('');
    try {
      const backgroundUrl = await compressImageFile(file);
      updateChatAppearance({ backgroundUrl });
    } catch (error) {
      setChatAppearanceError(error instanceof Error ? error.message : '背景图片处理失败。');
    } finally {
      setIsProcessingChatImage(false);
    }
  };

  const handleAppearanceIconUpload = async (
    key: 'sendIconUrl' | 'generateIconUrl',
    file?: File
  ) => {
    if (!file) return;
    setIsProcessingChatImage(true);
    setChatAppearanceError('');
    try {
      const iconUrl = await compressImageFile(file);
      updateChatAppearance({ [key]: iconUrl });
    } catch (error) {
      setChatAppearanceError(error instanceof Error ? error.message : '图标处理失败。');
    } finally {
      setIsProcessingChatImage(false);
    }
  };

  const saveChatAppearancePreset = () => {
    const name = chatAppearancePresetName.trim();
    if (!name) {
      setChatAppearanceError('请填写美化预设名称。');
      return;
    }
    const preset: ChatAppearancePreset = {
      id: `chat-style-${Date.now()}`,
      name,
      backgroundUrl: chatAppearance.backgroundUrl,
      userBubbleColor: chatAppearance.userBubbleColor,
      characterBubbleColor: chatAppearance.characterBubbleColor,
      bubbleCss: chatAppearance.bubbleCss ?? '',
      layoutCss: chatAppearance.layoutCss ?? '',
      sendIconUrl: chatAppearance.sendIconUrl ?? '',
      generateIconUrl: chatAppearance.generateIconUrl ?? '',
    };
    const nextAppearance = { ...chatAppearance, presets: [...chatAppearance.presets, preset] };
    if (persistChatAppearance(nextAppearance)) {
      setChatAppearancePresetName('');
      setSelectedChatAppearancePresetId(preset.id);
    }
  };

  const applyChatAppearancePreset = (presetId: string) => {
    setSelectedChatAppearancePresetId(presetId);
    const preset = chatAppearance.presets.find((item) => item.id === presetId);
    if (!preset) return;
    updateChatAppearance({
      backgroundUrl: preset.backgroundUrl,
      userBubbleColor: preset.userBubbleColor ?? DEFAULT_CHAT_APPEARANCE.userBubbleColor,
      characterBubbleColor: preset.characterBubbleColor ?? DEFAULT_CHAT_APPEARANCE.characterBubbleColor,
      bubbleCss: preset.bubbleCss ?? '',
      layoutCss: preset.layoutCss ?? '',
      sendIconUrl: preset.sendIconUrl ?? '',
      generateIconUrl: preset.generateIconUrl ?? '',
    });
  };

  const deleteChatAppearancePreset = () => {
    if (!selectedChatAppearancePresetId) return;
    const nextAppearance = {
      ...chatAppearance,
      presets: chatAppearance.presets.filter(
        (preset) => preset.id !== selectedChatAppearancePresetId
      ),
    };
    if (persistChatAppearance(nextAppearance)) setSelectedChatAppearancePresetId('');
  };

  const saveBubbleCssPreset = () => {
    const name = bubbleCssPresetName.trim();
    if (!name) {
      setChatAppearanceError('请填写气泡预设名称。');
      return;
    }
    const preset: BubbleCssPreset = {
      id: `bubble-css-${Date.now()}`,
      name,
      css: chatAppearance.bubbleCss ?? '',
    };
    if (persistChatAppearance({
      ...chatAppearance,
      bubblePresets: [...(chatAppearance.bubblePresets ?? []), preset],
    })) {
      setBubbleCssPresetName('');
    }
  };

  const applyBubbleCssPreset = (presetId: string) => {
    setSelectedBubbleCssPresetId(presetId);
    const preset = chatAppearance.bubblePresets?.find((item) => item.id === presetId);
    if (!preset) return;
    scopeChatCss(preset.css);
    updateChatAppearance({ bubbleCss: preset.css });
  };

  const deleteBubbleCssPreset = (presetId: string) => {
    setSelectedBubbleCssPresetId('');
    persistChatAppearance({
      ...chatAppearance,
      bubblePresets: (chatAppearance.bubblePresets ?? []).filter((item) => item.id !== presetId),
    });
  };

  const exportChatAppearance = () => {
    const content = JSON.stringify({
      format: 'yyphone-chat-appearance',
      version: 1,
      style: {
        backgroundUrl: chatAppearance.backgroundUrl,
        userBubbleColor: chatAppearance.userBubbleColor,
        characterBubbleColor: chatAppearance.characterBubbleColor,
        bubbleCss: chatAppearance.bubbleCss ?? '',
        layoutCss: chatAppearance.layoutCss ?? '',
        sendIconUrl: chatAppearance.sendIconUrl ?? '',
        generateIconUrl: chatAppearance.generateIconUrl ?? '',
      },
    }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'yyphone-chat-appearance.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importChatAppearance = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as { format?: unknown }).format !== 'yyphone-chat-appearance' ||
        (parsed as { version?: unknown }).version !== 1
      ) {
        throw new Error('美化文件格式不正确。');
      }
      const style = (parsed as { style?: unknown }).style;
      if (
        !style ||
        typeof style !== 'object' ||
        typeof (style as ChatAppearancePreset).backgroundUrl !== 'string' ||
        ((style as ChatAppearancePreset).userBubbleColor !== undefined && typeof (style as ChatAppearancePreset).userBubbleColor !== 'string') ||
        ((style as ChatAppearancePreset).characterBubbleColor !== undefined && typeof (style as ChatAppearancePreset).characterBubbleColor !== 'string') ||
        ((style as ChatAppearancePreset).bubbleCss !== undefined && typeof (style as ChatAppearancePreset).bubbleCss !== 'string') ||
        ((style as ChatAppearancePreset).layoutCss !== undefined && typeof (style as ChatAppearancePreset).layoutCss !== 'string') ||
        ((style as ChatAppearancePreset).sendIconUrl !== undefined && typeof (style as ChatAppearancePreset).sendIconUrl !== 'string') ||
        ((style as ChatAppearancePreset).generateIconUrl !== undefined && typeof (style as ChatAppearancePreset).generateIconUrl !== 'string')
      ) {
        throw new Error('美化文件内容缺失或无效。');
      }
      const nextAppearance = {
        ...chatAppearance,
        backgroundUrl: (style as ChatAppearancePreset).backgroundUrl,
        userBubbleColor: (style as ChatAppearancePreset).userBubbleColor ?? DEFAULT_CHAT_APPEARANCE.userBubbleColor,
        characterBubbleColor: (style as ChatAppearancePreset).characterBubbleColor ?? DEFAULT_CHAT_APPEARANCE.characterBubbleColor,
        bubbleCss: (style as ChatAppearancePreset).bubbleCss ?? '',
        layoutCss: (style as ChatAppearancePreset).layoutCss ?? '',
        sendIconUrl: (style as ChatAppearancePreset).sendIconUrl ?? '',
        generateIconUrl: (style as ChatAppearancePreset).generateIconUrl ?? '',
      };
      scopeChatCss(nextAppearance.bubbleCss);
      scopeChatCss(nextAppearance.layoutCss);
      if (persistChatAppearance(nextAppearance)) setChatAppearanceMessage('美化样式已导入并应用。');
    } catch (error) {
      console.error('Could not import chat appearance.', error);
      setChatAppearanceError(error instanceof Error ? error.message : '导入美化失败。');
    }
  };

  const exportBubbleCss = () => {
    const content = JSON.stringify({
      format: 'yyphone-chat-bubble-css',
      version: 1,
      bubbleCss: chatAppearance.bubbleCss ?? '',
    }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'yyphone-chat-bubbles.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importBubbleCss = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as { format?: unknown }).format !== 'yyphone-chat-bubble-css' ||
        (parsed as { version?: unknown }).version !== 1 ||
        typeof (parsed as { bubbleCss?: unknown }).bubbleCss !== 'string'
      ) {
        throw new Error('气泡 CSS 预设文件格式不正确。');
      }
      const bubbleCss = (parsed as { bubbleCss: string }).bubbleCss;
      scopeChatCss(bubbleCss);
      updateChatAppearance({ bubbleCss });
      setChatAppearanceMessage('气泡 CSS 预设已导入。');
    } catch (error) {
      console.error('Could not import bubble CSS preset.', error);
      setChatAppearanceError(error instanceof Error ? error.message : '导入气泡预设失败。');
    }
  };

  const persistContacts = (nextContacts: ContactPersona[]) => {
    try {
      writeStoredValue(CONTACTS_STORAGE_KEY, nextContacts);
      setContacts(nextContacts);
      setContactError('');
      return true;
    } catch (error) {
      console.error('Could not save WeChat contacts.', error);
      setContactError('联系人保存失败，请检查浏览器本地存储空间后重试。');
      return false;
    }
  };

  const openContactEditor = (contact?: ContactPersona) => {
    setContactWorldBooks(readContactWorldBooks());
    setContactDraft(contact ? { ...contact, worldBooks: [...contact.worldBooks] } : {
      id: '',
      avatarUrl: '',
      name: '',
      persona: '',
      worldBooks: [],
      group: '',
      starred: false,
    });
    setContactError('');
    setIsContactEditorOpen(true);
    setContactsMenuOpen(false);
  };

  const handleContactAvatarUpload = async (file?: File) => {
    if (!file) return;
    setIsProcessingAvatar(true);
    setContactError('');
    try {
      const avatarUrl = await compressImageFile(file);
      setContactDraft((draft) => ({ ...draft, avatarUrl }));
    } catch (uploadError) {
      setContactError(uploadError instanceof Error ? uploadError.message : '头像处理失败。');
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  const handleSaveContact = () => {
    if (!contactDraft.name.trim()) {
      setContactError('请填写角色姓名。');
      return;
    }
    const contact: ContactPersona = {
      ...contactDraft,
      id: contactDraft.id || `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: contactDraft.name.trim(),
      persona: contactDraft.persona.trim(),
      group: contactDraft.group.trim() || '未分组',
    };
    const nextContacts = contactDraft.id
      ? contacts.map((existing) => existing.id === contact.id ? contact : existing)
      : [...contacts, contact];
    if (persistContacts(nextContacts)) {
      setIsContactEditorOpen(false);
      setContactError('');
    }
  };

  const handleImportContacts = async (file?: File) => {
    if (!file) return;
    setImportError('');
    try {
      const parsed: unknown = JSON.parse(await file.text());
      let rawContacts: unknown;
      if (Array.isArray(parsed)) {
        rawContacts = parsed;
      } else if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed as { format?: unknown }).format === CONTACT_EXPORT_FORMAT &&
        (parsed as { version?: unknown }).version === 1
      ) {
        rawContacts = (parsed as { contacts?: unknown }).contacts;
      } else {
        throw new Error('文件格式不正确。请选择 YYphone 通讯录 JSON 或角色数组。');
      }
      if (!Array.isArray(rawContacts)) throw new Error('导入文件中没有角色列表。');
      const importedContacts = rawContacts.map((item, index): ContactPersona => {
        if (!item || typeof item !== 'object') {
          throw new Error(`第 ${index + 1} 个角色数据无效。`);
        }
        const record = item as Record<string, unknown>;
        if (typeof record.name !== 'string' || !record.name.trim()) {
          throw new Error(`第 ${index + 1} 个角色缺少姓名。`);
        }
        const links = Array.isArray(record.worldBooks)
          ? record.worldBooks.filter(
              (link): link is ContactWorldBookLink =>
                !!link &&
                typeof link === 'object' &&
                typeof (link as ContactWorldBookLink).bookId === 'string' &&
                ((link as ContactWorldBookLink).entryId === undefined ||
                  typeof (link as ContactWorldBookLink).entryId === 'string')
            )
          : [];
        return {
          id: `contact-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          avatarUrl: typeof record.avatarUrl === 'string' ? record.avatarUrl : '',
          name: record.name.trim(),
          persona:
            typeof record.persona === 'string'
              ? record.persona
              : typeof record.description === 'string'
                ? record.description
                : '',
          worldBooks: links,
          group: typeof record.group === 'string' && record.group.trim() ? record.group.trim() : '未分组',
          starred: record.starred === true,
        };
      });
      if (importedContacts.length === 0) throw new Error('没有可导入的角色。');
      if (persistContacts([...contacts, ...importedContacts])) {
        setImportError('');
        setContactsMenuOpen(false);
      }
    } catch (error) {
      console.error('Could not import WeChat contacts.', error);
      setImportError(error instanceof Error ? error.message : '导入角色失败。');
    }
  };

  const toggleContactWorldBook = (link: ContactWorldBookLink) => {
    setContactDraft((draft) => {
      const exists = draft.worldBooks.some(
        (item) => item.bookId === link.bookId && item.entryId === link.entryId
      );
      if (exists) {
        return {
          ...draft,
          worldBooks: draft.worldBooks.filter(
            (item) => item.bookId !== link.bookId || item.entryId !== link.entryId
          ),
        };
      }
      return {
        ...draft,
        worldBooks: [
          ...draft.worldBooks.filter(
            (item) =>
              item.bookId !== link.bookId ||
              (!!link.entryId && !!item.entryId)
          ),
          link,
        ],
      };
    });
  };

  const handleLongPress = (contactId: string) => {
    setActiveContactMenuId(contactId);
  };

  const startContactPress = (contactId: string) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => handleLongPress(contactId), 550);
  };

  const clearContactPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  };

  const toggleStarContact = (contactId: string) => {
    const updatedContacts = contacts.map((contact) =>
      contact.id === contactId ? { ...contact, starred: !contact.starred } : contact
    );
    persistContacts(updatedContacts);
    setActiveContactMenuId('');
  };

  const deleteContact = (contactId: string) => {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact || !window.confirm(`删除角色「${contact.name}」？`)) return;
    persistContacts(contacts.filter((item) => item.id !== contactId));
    setActiveContactMenuId('');
  };

  const contactsByGroup = contacts.reduce<Record<string, ContactPersona[]>>((groups, contact) => {
    const group = contact.group.trim() || '未分组';
    (groups[group] ??= []).push(contact);
    return groups;
  }, {});

  const persistChats = (nextChats: ChatConversation[]) => {
    try {
      writeStoredValue(CHATS_STORAGE_KEY, nextChats);
      setChats(nextChats);
      setChatError('');
      return true;
    } catch (error) {
      console.error('Could not save WeChat conversations.', error);
      setChatError('聊天数据保存失败，请检查浏览器本地存储空间后重试。');
      return false;
    }
  };

  const contactName = (contactId: string) =>
    contacts.find((contact) => contact.id === contactId)?.name ?? '已删除的角色';

  const getChatTitle = (chat: ChatConversation) => {
    if (chat.type === 'direct') {
      return chat.noteName.trim() || contactName(chat.participantIds[0] ?? '');
    }
    if (chat.groupTitle?.trim()) return chat.groupTitle.trim();
    const names = chat.participantIds.map(contactName);
    return names.join('、');
  };

  const getChatAvatar = (chat: ChatConversation) => {
    if (chat.type === 'direct') {
      return chat.avatars[chat.participantIds[0]] || contacts.find((item) => item.id === chat.participantIds[0])?.avatarUrl || '';
    }
    return chat.avatars.group ?? '';
  };

  const getChatParticipantName = (chat: ChatConversation, participantId: string) => {
    const nickname = chat.groupNicknames?.[participantId]?.trim();
    if (nickname) return nickname;
    return participantId === 'user' ? personaDraft.name.trim() || '我' : contactName(participantId);
  };

  const getAttachedHistoryChatIds = (chat: ChatConversation) => {
    if (chat.attachedHistoryChatIds) return chat.attachedHistoryChatIds;
    if (!chat.attachHistory || !chat.attachedHistoryContactId) return [];
    const contactId = chat.attachedHistoryContactId;
    return chats
      .filter((candidate) =>
        candidate.type === 'direct' &&
        candidate.participantIds.includes(contactId)
      )
      .map((candidate) => candidate.id);
  };

  const createConversation = () => {
    const minimumParticipants = chatCreateMode === 'direct' ? 1 : 2;
    if (!chatCreateMode || selectedParticipantIds.length < minimumParticipants) {
      setChatError(chatCreateMode === 'direct' ? '请选择一位角色。' : '请选择至少两位角色。');
      return;
    }
    if (chatCreateMode === 'direct') {
      const existing = chats.find(
        (chat) =>
          chat.type === 'direct' &&
          chat.participantIds.length === 1 &&
          chat.participantIds[0] === selectedParticipantIds[0]
      );
      if (existing) {
        setActiveChatId(existing.id);
        setChatCreateMode(null);
        setSelectedParticipantIds([]);
        return;
      }
    }
    const newChat: ChatConversation = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: chatCreateMode,
      participantIds: [...selectedParticipantIds],
      noteName: '',
      context: '',
      narratorEnabled: false,
      blocked: false,
      pinned: false,
      avatars: {},
      messages: [],
      updatedAt: new Date().toISOString(),
      groupTitle: '',
      groupNicknames: {},
      allowAgentGroupRename: false,
      attachHistory: false,
      attachedHistoryContactId: selectedParticipantIds[0] ?? '',
      attachedHistoryCount: 10,
    };
    if (persistChats([newChat, ...chats])) {
      setActiveChatId(newChat.id);
      setChatCreateMode(null);
      setSelectedParticipantIds([]);
      setChatError('');
    }
  };

  const updateChat = (chatId: string, update: (chat: ChatConversation) => ChatConversation) => {
    const nextChats = chats.map((chat) => (chat.id === chatId ? update(chat) : chat));
    return persistChats(nextChats);
  };

  const startChatLongPress = (chatId: string) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    suppressNextChatClickRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      suppressNextChatClickRef.current = true;
      setActiveChatMenuId(chatId);
    }, 550);
  };

  const toggleChatPinned = (chat: ChatConversation) => {
    updateChat(chat.id, (item) => ({ ...item, pinned: !item.pinned }));
    setActiveChatMenuId('');
  };

  const deleteChat = (chat: ChatConversation) => {
    if (!window.confirm(`删除与「${getChatTitle(chat)}」的对话？聊天记录也会删除。`)) return;
    if (persistChats(chats.filter((item) => item.id !== chat.id))) setActiveChatMenuId('');
  };

  const openChatSettings = (chat: ChatConversation) => {
    setChatSettingsDraft({ ...chat, avatars: { ...chat.avatars } });
    setChatSettingsOpen(true);
  };

  const saveChatSettings = () => {
    if (!chatSettingsDraft) return;
    const attachedHistoryChatIds = getAttachedHistoryChatIds(chatSettingsDraft);
    if (chatSettingsDraft.attachHistory &&
      (!Number.isInteger(chatSettingsDraft.attachedHistoryCount) ||
        (chatSettingsDraft.attachedHistoryCount ?? 0) < 1 ||
        (chatSettingsDraft.attachedHistoryCount ?? 0) > 1000)
    ) {
      setChatError('挂载条数请输入 1 到 1000 之间的整数。');
      return;
    }
    const savedDraft = {
      ...chatSettingsDraft,
      attachedHistoryChatIds,
      attachHistory: chatSettingsDraft.attachHistory && attachedHistoryChatIds.length > 0,
    };
    if (updateChat(savedDraft.id, () => savedDraft)) {
      setChatSettingsOpen(false);
      setChatSettingsDraft(null);
    }
  };

  const handleChatAvatarUpload = async (key: string, file?: File) => {
    if (!file || !chatSettingsDraft) return;
    setIsProcessingChatImage(true);
    setChatError('');
    try {
      const avatarUrl = await compressImageFile(file);
      setChatSettingsDraft((draft) =>
        draft ? { ...draft, avatars: { ...draft.avatars, [key]: avatarUrl } } : draft
      );
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '图片处理失败。');
    } finally {
      setIsProcessingChatImage(false);
    }
  };

  const sendChatMessage = () => {
    const text = chatMessageDraft.trim();
    const chat = chats.find((item) => item.id === activeChatId);
    if (!text || !chat || chat.type === 'observer' || chat.blocked) return;
    const message: ChatMessage = {
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: 'user',
      text,
      createdAt: new Date().toISOString(),
    };
    if (
      updateChat(chat.id, (current) => ({
        ...current,
        messages: [...current.messages, message],
        updatedAt: message.createdAt,
      }))
    ) {
      setChatMessageDraft('');
    }
  };

  const sendObserverNarration = () => {
    const text = chatMessageDraft.trim();
    const chat = chats.find((item) => item.id === activeChatId);
    if (!text || !chat || chat.type !== 'observer') return;
    const message: ChatMessage = {
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: 'narrator',
      text,
      createdAt: new Date().toISOString(),
    };
    if (updateChat(chat.id, (current) => ({
      ...current,
      messages: [...current.messages, message],
      updatedAt: message.createdAt,
    }))) {
      setChatMessageDraft('');
      setChatError('');
    }
  };

  const saveContextPreset = () => {
    if (!chatSettingsDraft) return;
    const name = contextPresetName.trim();
    if (!name) {
      setChatError('请填写预设名称。');
      return;
    }
    const preset: ChatContextPreset = {
      id: `context-${Date.now()}`,
      name,
      context: chatSettingsDraft.context,
    };
    const nextPresets = [...contextPresets, preset];
    try {
      writeStoredValue(CHAT_CONTEXT_PRESETS_STORAGE_KEY, nextPresets);
      setContextPresets(nextPresets);
      setSelectedContextPresetId(preset.id);
      setContextPresetName('');
      setChatError('');
    } catch (error) {
      console.error('Could not save chat context preset.', error);
      setChatError('预设保存失败，请检查浏览器本地存储空间后重试。');
    }
  };

  const applyContextPreset = (presetId: string) => {
    setSelectedContextPresetId(presetId);
    const preset = contextPresets.find((item) => item.id === presetId);
    if (preset && chatSettingsDraft) {
      setChatSettingsDraft({ ...chatSettingsDraft, context: preset.context });
    }
  };

  const deleteContextPreset = () => {
    if (!selectedContextPresetId) return;
    const nextPresets = contextPresets.filter((preset) => preset.id !== selectedContextPresetId);
    try {
      writeStoredValue(CHAT_CONTEXT_PRESETS_STORAGE_KEY, nextPresets);
      setContextPresets(nextPresets);
      setSelectedContextPresetId('');
      setChatError('');
    } catch (error) {
      console.error('Could not delete chat context preset.', error);
      setChatError('删除预设失败，请检查浏览器本地存储空间后重试。');
    }
  };

  const saveAttachmentMessage = (
    kind: NonNullable<ChatMessage['kind']>,
    text: string,
    extra: Partial<ChatMessage> = {}
  ) => {
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat || chat.type === 'observer' || chat.blocked) return false;
    const message: ChatMessage = {
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: 'user',
      text,
      createdAt: new Date().toISOString(),
      kind,
      ...extra,
    };
    return updateChat(chat.id, (current) => ({
      ...current,
      messages: [...current.messages, message],
      updatedAt: message.createdAt,
    }));
  };

  const openAttachment = (
    mode: NonNullable<typeof attachmentMode>
  ) => {
    setAttachmentDraft({
      imageUrl: '',
      text: '',
      title: '',
      source: '',
      content: '',
      amount: '',
      quantity: mode === 'red-packet' && activeChat?.type === 'group'
        ? String(activeChat.participantIds.length + 1)
        : '1',
      recipientId: '',
    });
    setAttachmentMode(mode);
    setComposerOpen(false);
    setChatError('');
    if (mode === 'camera') attachmentInputRef.current?.click();
  };

  const handleAttachmentImage = async (file?: File) => {
    if (!file || !attachmentMode) return;
    setIsProcessingChatImage(true);
    setChatError('');
    try {
      const imageUrl = await compressImageFile(file);
      if (attachmentMode === 'camera') {
        if (saveAttachmentMessage('image', '拍摄的照片', { imageUrl })) {
          setAttachmentMode(null);
        }
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '图片处理失败。');
      setAttachmentMode(null);
    } finally {
      setIsProcessingChatImage(false);
    }
  };

  const submitAttachment = () => {
    if (!attachmentMode) return;
    let saved = false;
    if (attachmentMode === 'photo') {
      if (!attachmentDraft.text.trim()) {
        setChatError('请用文字描述这张图片。');
        return;
      }
      saved = saveAttachmentMessage('image', attachmentDraft.text.trim());
    } else if (attachmentMode === 'location') {
      if (!attachmentDraft.title.trim()) {
        setChatError('请填写位置。');
        return;
      }
      saved = saveAttachmentMessage('location', attachmentDraft.title.trim());
    } else if (attachmentMode === 'red-packet' || attachmentMode === 'transfer') {
      if (!attachmentDraft.amount.trim() || !/^\d+(\.\d{1,2})?$/.test(attachmentDraft.amount.trim())) {
        setChatError('请输入有效金额。');
        return;
      }
      if (attachmentMode === 'red-packet' && Number(attachmentDraft.amount) <= 0) {
        setChatError('红包金额必须大于 0。');
        return;
      }
      if (attachmentMode === 'red-packet' && activeChat?.type === 'group') {
        const quantity = Number(attachmentDraft.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
          setChatError('红包数量请输入 1 到 100 的整数。');
          return;
        }
      }
      if (
        attachmentMode === 'transfer' &&
        activeChat?.type === 'group' &&
        !activeChat.participantIds.includes(attachmentDraft.recipientId)
      ) {
        setChatError('请选择一位收款角色。');
        return;
      }
      saved = saveAttachmentMessage(
        attachmentMode,
        attachmentDraft.text.trim() || (attachmentMode === 'red-packet' ? '恭喜发财，大吉大利' : '转账'),
        {
          amount: attachmentDraft.amount.trim(),
          ...(attachmentMode === 'red-packet' && activeChat?.type === 'group'
            ? { quantity: Number(attachmentDraft.quantity) }
            : {}),
          ...(attachmentMode === 'transfer' && activeChat?.type === 'group'
            ? { recipientId: attachmentDraft.recipientId }
            : {}),
        }
      );
    } else if (attachmentMode === 'link') {
      if (!attachmentDraft.title.trim()) {
        setChatError('请填写链接标题。');
        return;
      }
      saved = saveAttachmentMessage('link', attachmentDraft.title.trim(), {
        title: attachmentDraft.title.trim(),
        source: attachmentDraft.source.trim(),
        content: attachmentDraft.content.trim(),
      });
    }
    if (saved) {
      setAttachmentMode(null);
      setAttachmentDraft({ imageUrl: '', text: '', title: '', source: '', content: '', amount: '', quantity: '1', recipientId: '' });
      setChatError('');
    }
  };

  const handleRegenerate = () => {
    setComposerOpen(false);
    void generateAiReply(true);
  };

  const startCall = (mode: 'voice' | 'video') => {
    setActiveCallMode(mode);
    setCallChoiceOpen(false);
    setComposerOpen(false);
    setChatError('');
  };

  const endCall = () => {
    setActiveCallMode(null);
    setChatError('');
  };

  const sendVoiceMessage = () => {
    const text = voiceDraft.trim();
    if (!text) {
      setChatError('请输入语音内容。');
      return;
    }
    if (saveAttachmentMessage('voice', text)) {
      setVoiceDraft('');
      setVoiceModalOpen(false);
      setChatError('');
    }
  };

  const sendSticker = (sticker: ChatSticker) => {
    if (saveAttachmentMessage('sticker', sticker.description, { imageUrl: sticker.imageUrl })) {
      setEmojiPanelOpen(false);
    }
  };

  const uploadStickers = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsProcessingChatImage(true);
    setChatError('');
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => ({
          id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          imageUrl: await compressImageFile(file),
          description: '',
        }))
      );
      setStickerDrafts((drafts) => [...drafts, ...uploaded]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : '表情包上传失败。');
    } finally {
      setIsProcessingChatImage(false);
    }
  };

  const saveSticker = (sticker: ChatSticker) => {
    if (!sticker.description.trim()) {
      setChatError('请为每个表情包填写简短介绍。');
      return;
    }
    const nextStickers = [...stickers, { ...sticker, description: sticker.description.trim() }];
    try {
      writeStoredValue(CHAT_STICKERS_STORAGE_KEY, nextStickers);
      setStickers(nextStickers);
      setStickerDrafts((drafts) => drafts.filter((item) => item.id !== sticker.id));
      setChatError('');
    } catch (error) {
      console.error('Could not save chat sticker.', error);
      setChatError('表情包保存失败，本地存储空间可能不足，请选择更小的图片。');
    }
  };

  const generateAiReply = async (regenerate = false) => {
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat || chat.blocked || isGeneratingReply) return;

    const apiPresets = readStoredValue(API_PRESETS_STORAGE_KEY, [] as ApiPreset[], isApiPresetList);
    const activePresetId = readStoredValue(
      ACTIVE_API_PRESET_STORAGE_KEY,
      apiPresets[0]?.id ?? '',
      (value): value is string => typeof value === 'string'
    );
    const apiPreset =
      apiPresets.find((preset) => preset.id === activePresetId) ??
      apiPresets.find((preset) => preset.endpoint.trim() && preset.apiKey.trim());
    if (!apiPreset?.endpoint.trim() || !apiPreset.apiKey.trim()) {
      setChatError('请先在设置页保存包含端点和 API Key 的 API 配置预设。');
      return;
    }

    const chatContacts = chat.participantIds
      .map((participantId) => contacts.find((item) => item.id === participantId))
      .filter((contact): contact is ContactPersona => !!contact);
    const contact = chatContacts[0];
    if (!contact) {
      setChatError('此对话关联的角色已不存在，请检查通讯录。');
      return;
    }

    setIsGeneratingReply(true);
    setChatError('');
    const previousReply = chat.messages.at(-1);
    const replacedMessageId =
      regenerate && previousReply && previousReply.senderId !== 'user' && previousReply.senderId !== 'narrator'
        ? previousReply.id
        : undefined;
    try {
      const currentInput = [...chat.messages].reverse().find((message) => message.senderId === 'user')?.text ?? '';
      const promptMessages = buildPrompt({
        chatId: chat.id,
        currentInput,
        historyLimit: 30,
        regenerate,
      });
      const responseInstructions = [
        `以${chat.type === 'direct' ? `${contact.name}的` : '其中一位参与角色的'}身份自然回复。只返回 JSON：{"reply":"给用户看的消息","thought":"角色未说出口的心声","speakerId":"发言角色ID"${chat.type === 'group' && chat.allowAgentGroupRename ? ',"groupTitle":"建议群名，可省略","groupNicknames":{"角色ID":"建议群昵称"}' : ''}}。群聊的 speakerId 必须从以下 ID 中选择：${chatContacts.map((chatContact) => chatContact.id).join(', ')}。${chat.type === 'group' && chat.allowAgentGroupRename ? '群名或群昵称只有在情节自然需要时才修改，可仅返回其中需要修改的字段；groupNicknames 的键只能使用上方角色 ID。' : ''}${chat.type === 'observer' ? '这是旁观群聊，user不在群里；根据角色之间的对话和旁白提供的情境，继续以某个角色的身份发言。' : ''}`,
        ...(activeCallMode === 'video'
          ? ['当前为视频通话，请在角色的每次回复最前方先写一段用小括号包裹的可视动作描写，再接角色说的话。']
          : []),
      ].join('\n');
      promptMessages.splice(promptMessages.length - 1, 0, {
        role: 'system',
        content: responseInstructions,
      });

      const endpoint = apiPreset.endpoint.trim().replace(/\/+$/, '');
      const model = apiPreset.model?.trim() || 'gpt-4o-mini';
      let responseText: string;
      if (endpoint.includes('generativelanguage.googleapis.com')) {
        const systemInstruction = promptMessages
          .filter((message) => message.role === 'system')
          .map((message) => message.content)
          .join('\n\n');
        const contents = promptMessages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          }));
        const response = await fetch(
          `${endpoint}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiPreset.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents,
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );
        if (!response.ok) throw new Error(`AI 请求失败（${response.status}）：${await response.text()}`);
        const data: unknown = await response.json();
        const candidate = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0];
        responseText = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      } else {
        const chatEndpoint = /\/chat\/completions$/i.test(endpoint)
          ? endpoint
          : `${endpoint}/chat/completions`;
        const response = await fetch(chatEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiPreset.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: promptMessages,
            response_format: { type: 'json_object' },
          }),
        });
        if (!response.ok) throw new Error(`AI 请求失败（${response.status}）：${await response.text()}`);
        const data: unknown = await response.json();
        const choice = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0];
        responseText = choice?.message?.content ?? '';
      }

      let reply = responseText.trim();
      let thought = '';
      let speakerId = contact.id;
      let generatedGroupTitle: string | undefined;
      let generatedGroupNicknames: Record<string, string> | undefined;
      try {
        const result: unknown = JSON.parse(reply.replace(/^```(?:json)?\s*|\s*```$/g, ''));
        if (result && typeof result === 'object') {
          const record = result as Record<string, unknown>;
          if (typeof record.reply === 'string') reply = record.reply.trim();
          if (typeof record.thought === 'string') thought = record.thought.trim();
          if (typeof record.speakerId === 'string' && chatContacts.some((item) => item.id === record.speakerId)) {
            speakerId = record.speakerId;
          }
          if (chat.type === 'group' && chat.allowAgentGroupRename) {
            if (typeof record.groupTitle === 'string' && record.groupTitle.trim()) {
              generatedGroupTitle = record.groupTitle.trim().slice(0, 80);
            }
            if (record.groupNicknames && typeof record.groupNicknames === 'object') {
              generatedGroupNicknames = Object.fromEntries(
                Object.entries(record.groupNicknames).flatMap(([id, nickname]) =>
                  chat.participantIds.includes(id) &&
                  typeof nickname === 'string' &&
                  nickname.trim()
                    ? [[id, nickname.trim().slice(0, 40)]]
                    : []
                )
              );
            }
          }
        }
      } catch {
        // Some compatible endpoints ignore JSON response mode and return plain text.
      }
      if (!reply) throw new Error('AI 返回了空消息，请检查模型配置后重试。');
      if (activeCallMode === 'video' && !/^\s*[（(].*[）)]/.test(reply)) {
        reply = `（${getChatParticipantName(chat, speakerId)}看向镜头，轻轻开口）${reply}`;
      }
      const message: ChatMessage = {
        id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: speakerId,
        text: reply,
        thought,
        createdAt: new Date().toISOString(),
      };
      updateChat(chat.id, (current) => ({
        ...current,
        messages: [
          ...current.messages.filter((item) => item.id !== replacedMessageId),
          message,
        ],
        updatedAt: message.createdAt,
        ...(generatedGroupTitle ? { groupTitle: generatedGroupTitle } : {}),
        ...(generatedGroupNicknames
          ? { groupNicknames: { ...(current.groupNicknames ?? {}), ...generatedGroupNicknames } }
          : {}),
      }));
    } catch (error) {
      console.error('Could not generate AI chat reply.', error);
      setChatError(error instanceof Error ? error.message : 'AI 回复失败，请检查网络与 API 配置。');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const exportChatHistory = (chat: ChatConversation) => {
    const content = JSON.stringify(
      {
        format: 'yyphone-chat-history',
        version: 1,
        title: getChatTitle(chat),
        messages: chat.messages,
      },
      null,
      2
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${getChatTitle(chat)}-chat.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importChatHistory = async (file?: File) => {
    if (!file || !chatSettingsDraft) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as { format?: unknown }).format !== 'yyphone-chat-history' ||
        (parsed as { version?: unknown }).version !== 1
      ) {
        throw new Error('聊天记录文件格式不正确。');
      }
      const importedMessages = (parsed as { messages?: unknown }).messages;
      if (
        !Array.isArray(importedMessages) ||
        !importedMessages.every(
          (message) =>
            !!message &&
            typeof message.id === 'string' &&
            typeof message.senderId === 'string' &&
            typeof message.text === 'string' &&
            typeof message.createdAt === 'string'
        )
      ) {
        throw new Error('聊天记录内容无效。');
      }
      const messages = importedMessages.map((message) => ({
        ...message,
        id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }));
      const nextDraft = {
        ...chatSettingsDraft,
        messages: [...chatSettingsDraft.messages, ...messages],
        updatedAt: new Date().toISOString(),
      };
      if (updateChat(nextDraft.id, () => nextDraft)) {
        setChatSettingsDraft(nextDraft);
        setChatError('');
      }
    } catch (error) {
      console.error('Could not import chat history.', error);
      setChatError(error instanceof Error ? error.message : '导入聊天记录失败。');
    }
  };

  const clearChatHistory = () => {
    if (!chatSettingsDraft || !window.confirm('确定清空这段对话的全部聊天记录？')) return;
    const nextDraft = { ...chatSettingsDraft, messages: [], updatedAt: new Date().toISOString() };
    if (updateChat(nextDraft.id, () => nextDraft)) setChatSettingsDraft(nextDraft);
  };

  const dissolveChat = () => {
    if (!chatSettingsDraft) return;
    const title = getChatTitle(chatSettingsDraft);
    if (!window.confirm(`确定解散「${title}」？群聊和其中的聊天记录都会删除。`)) return;
    const remainingChats = chats.filter((chat) => chat.id !== chatSettingsDraft.id);
    if (!persistChats(remainingChats)) return;
    setActiveChatId('');
    setChatSettingsOpen(false);
    setChatSettingsDraft(null);
  };

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  return (
    <div className="relative flex-1 w-full flex flex-col bg-[#F3F7FA] overflow-hidden">
      <AppHeader
        title={
          activeChat
            ? getChatTitle(activeChat)
            : activeTab === 'chats'
            ? '微信'
            : activeTab === 'contacts'
            ? '通讯录'
            : activeTab === 'moments'
            ? '朋友圈'
            : '我'
        }
        onBack={() => (activeChat ? setActiveChatId('') : onBack())}
        rightAction={
          activeChat ? (
            <button
              type="button"
              aria-label="对话设置"
              onClick={() => openChatSettings(activeChat)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-[#2C4A5C]"
            >
              <Menu className="w-5 h-5" />
            </button>
          ) : activeTab === 'chats' ? (
            <button
              type="button"
              aria-label="发起聊天"
              onClick={() => {
                setChatError('');
                setChatCreateMenuOpen((open) => !open);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-[#2C4A5C]"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : activeTab === 'contacts' ? (
            <button
              type="button"
              aria-label="新增或导入角色"
              onClick={() => {
                setImportError('');
                setContactsMenuOpen((open) => !open);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-[#2C4A5C]"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : (
            <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 text-[#2C4A5C]">
              <Plus className="w-5 h-5" />
            </button>
          )
        }
      />
      {!activeChat && activeTab === 'chats' && chatCreateMenuOpen && (
        <div className="absolute top-12 right-3 z-40 w-44 rounded-2xl bg-white/95 shadow-xl border border-white p-1.5">
          {([
            ['direct', '发起聊天'],
            ['group', '发起群聊'],
            ['observer', '旁观群聊'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => {
                setChatCreateMode(mode);
                setSelectedParticipantIds([]);
                setChatCreateMenuOpen(false);
                setChatError('');
              }}
              className="w-full px-3 py-2.5 text-xs text-left text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {activeTab === 'contacts' && contactsMenuOpen && (
        <div className="absolute top-12 right-3 z-40 w-40 rounded-2xl bg-white/95 shadow-xl border border-white p-1.5">
          <button
            onClick={() => openContactEditor()}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            <Plus className="w-4 h-4" />新增角色
          </button>
          <button
            onClick={() => {
              setContactsMenuOpen(false);
              contactImportRef.current?.click();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            <Upload className="w-4 h-4" />导入角色
          </button>
        </div>
      )}
      <input
        ref={contactImportRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          void handleImportContacts(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {/* Main Content Area */}
      <div className={`flex-1 min-h-0 ${activeChat ? 'overflow-hidden flex flex-col' : 'overflow-y-auto no-scrollbar'}`}>
        {/* TAB 1: CHATS */}
        {activeTab === 'chats' && activeChat && (
          <div
            className="yy-chat-surface flex-1 min-h-0 flex flex-col bg-[#F3F6FA]"
            style={{
              '--yy-user-bubble-color': chatAppearance.userBubbleColor,
              '--yy-character-bubble-color': chatAppearance.characterBubbleColor,
            } as React.CSSProperties}
          >
            {activeChat.type === 'observer' && (
              <p className="px-4 py-2 text-center text-[10px] text-slate-500 bg-white/50">
                旁观群聊 · 你不在此对话中
              </p>
            )}
            <div
              className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 space-y-3"
              style={chatAppearance.backgroundUrl ? {
                backgroundImage: `linear-gradient(rgba(243,246,250,.38), rgba(243,246,250,.38)), url("${chatAppearance.backgroundUrl}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'local',
              } : undefined}
            >
              {activeChat.messages.length === 0 && (
                <p className="mt-8 text-center text-xs text-slate-400">暂无聊天记录</p>
              )}
              {activeChat.messages.map((message) => {
                if (message.senderId === 'narrator') {
                  if (!activeChat.narratorEnabled && activeChat.type !== 'observer') return null;
                  return (
                    <div key={message.id} className="py-1 text-center">
                      <p className="mb-0.5 text-[9px] font-semibold text-slate-400">旁白</p>
                      <p className="mx-auto max-w-[90%] text-[10px] leading-relaxed text-slate-400">{message.text}</p>
                    </div>
                  );
                }
                const isUserMessage = message.senderId === 'user';
                const sender = contacts.find((contact) => contact.id === message.senderId);
                const isSpecialBubble = ['video-call', 'location', 'red-packet', 'transfer', 'link'].includes(message.kind ?? '');
                return (
                  <div
                    key={message.id}
                    className={`yy-chat-message-row flex items-start gap-2 ${isUserMessage ? 'is-user flex-row-reverse' : 'is-character'}`}
                  >
                    {isUserMessage ? (
                      <div className="yy-chat-avatar h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-sky-100 text-xs font-bold text-sky-800 flex items-center justify-center">
                        {(activeChat.avatars.user || personaDraft.avatarUrl)
                          ? <img src={activeChat.avatars.user || personaDraft.avatarUrl} alt="" className="h-full w-full object-cover" />
                          : personaDraft.name.trim().charAt(0) || '我'}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveThought({
                          name: sender?.name ?? '角色',
                          thought: message.thought || '这条消息没有记录角色心声。',
                        })}
                        aria-label={`查看${sender?.name ?? '角色'}的心声`}
                        className="yy-chat-avatar h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-sky-100 text-xs font-bold text-sky-800 flex items-center justify-center"
                      >
                        {(activeChat.avatars[message.senderId] || sender?.avatarUrl)
                          ? <img src={activeChat.avatars[message.senderId] || sender?.avatarUrl} alt="" className="h-full w-full object-cover" />
                          : sender?.name.trim().charAt(0) || '?'}
                      </button>
                    )}
                    <div
                      className={`yy-chat-message-bubble ${isSpecialBubble ? 'is-special' : ''} ${isUserMessage ? 'is-user text-slate-800' : 'is-character text-slate-700'} max-w-[78%] min-w-[5rem] rounded-2xl px-3 py-2 text-xs leading-relaxed`}
                    >
                      {(activeChat.type === 'group' || !isUserMessage) && (
                        <p className="mb-1 text-[9px] text-slate-400">
                          {activeChat.type === 'group'
                            ? getChatParticipantName(activeChat, message.senderId)
                            : sender?.name ?? '角色'}
                        </p>
                      )}
                      {message.kind === 'video-call' ? (
                        <div className="flex items-center gap-2"><Video className="h-4 w-4" />{message.text}</div>
                      ) : message.kind === 'location' ? (
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-rose-500" />{message.text}</div>
                      ) : message.kind === 'red-packet' ? (
                        <div className="min-w-36 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 p-3 text-white">
                          <div className="flex items-center gap-2 font-semibold"><Gift className="h-5 w-5" />{activeChat.type === 'group' ? '拼手气红包' : '微信红包'}</div>
                          <p className="mt-2 text-lg font-bold">¥{message.amount}</p>
                          {message.quantity && <p className="text-[10px] opacity-90">共 {message.quantity} 个</p>}
                          <p className="text-[10px] opacity-90">{message.text}</p>
                        </div>
                      ) : message.kind === 'transfer' ? (
                        <div className="min-w-36 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-3 text-white">
                          <div className="flex items-center gap-2 font-semibold"><Wallet className="h-5 w-5" />微信转账</div>
                          <p className="mt-2 text-lg font-bold">¥{message.amount}</p>
                          {message.recipientId && <p className="text-[10px] opacity-90">给 {getChatParticipantName(activeChat, message.recipientId)}</p>}
                          <p className="text-[10px] opacity-90">{message.text}</p>
                        </div>
                      ) : message.kind === 'link' ? (
                        <div className="min-w-40 rounded-xl bg-white/80 p-2.5">
                          <div className="flex items-center gap-1.5 font-semibold"><Link className="h-3.5 w-3.5 text-sky-600" />{message.title}</div>
                          {message.content && <p className="mt-1 line-clamp-3 text-[10px] text-slate-500">{message.content}</p>}
                          {message.source && <p className="mt-1 text-[9px] text-slate-400">{message.source}</p>}
                        </div>
                      ) : message.kind === 'sticker' && message.imageUrl ? (
                        <div className="space-y-1">
                          <img src={message.imageUrl} alt={message.text} className="h-24 w-24 rounded-xl object-contain" />
                          <p className="text-[10px] text-slate-500">{message.text}</p>
                        </div>
                      ) : message.kind === 'voice' ? (
                        <div className="min-w-32">
                          <div className="flex items-center gap-2"><Mic className="h-4 w-4" /><span className="tracking-[2px]">▂▅▃▇▂</span><span>语音</span></div>
                          <p className="mt-1 border-t border-slate-200/70 pt-1 text-[10px]">{message.text}</p>
                        </div>
                      ) : message.kind === 'image' ? (
                        message.imageUrl ? (
                          <img src={message.imageUrl} alt="聊天图片" className="max-h-52 max-w-full rounded-xl object-contain" />
                        ) : (
                          <div className="flex aspect-square w-40 max-w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-sky-100 p-3 text-center text-xs leading-relaxed text-slate-700">
                            {message.text}
                          </div>
                        )
                      ) : message.text}
                    </div>
                  </div>
                );
              })}
            </div>
            {activeChat.blocked ? (
              <p className="border-t border-slate-200 bg-white/70 p-3 text-center text-xs text-rose-600">
                此对话已拉黑，无法发送消息。
              </p>
            ) : activeChat.type === 'observer' ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendObserverNarration();
                }}
                className="yy-chat-composer relative flex items-center gap-2 border-t border-white/70 bg-white/80 p-3"
              >
                <span className="shrink-0 rounded-lg bg-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-600">旁白</span>
                <input
                  value={chatMessageDraft}
                  onChange={(event) => setChatMessageDraft(event.target.value)}
                  placeholder="以旁白身份描述场景或情境"
                  aria-label="输入旁白"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                />
                <button type="submit" aria-label="发送旁白" className="yy-chat-send flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
                  {chatAppearance.sendIconUrl
                    ? <img src={chatAppearance.sendIconUrl} alt="" className="h-5 w-5 object-contain" />
                    : <Send className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  disabled={isGeneratingReply}
                  onClick={() => void generateAiReply()}
                  className="yy-chat-generate h-9 shrink-0 rounded-xl bg-violet-600 px-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {isGeneratingReply ? '生成中' : chatAppearance.generateIconUrl
                    ? <img src={chatAppearance.generateIconUrl} alt="生成" className="h-5 w-5 object-contain" />
                    : '生成'}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendChatMessage();
                }}
                className="yy-chat-composer relative flex items-center gap-2 border-t border-white/70 bg-white/70 p-3"
              >
                <button
                  type="button"
                  aria-label="更多聊天功能"
                  onClick={() => setComposerOpen((open) => !open)}
                  className={`yy-chat-attachments h-9 w-9 shrink-0 rounded-full border flex items-center justify-center transition-colors ${
                    composerOpen ? 'rotate-45 bg-slate-200 border-slate-300' : 'bg-white border-slate-200'
                  }`}
                >
                  <Plus className="h-5 w-5 text-slate-600" />
                </button>
                <button
                  type="button"
                  aria-label="发送语音"
                  onClick={() => { setVoiceDraft(''); setVoiceModalOpen(true); }}
                  className="yy-chat-voice h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <input
                  value={chatMessageDraft}
                  onChange={(event) => setChatMessageDraft(event.target.value)}
                  placeholder="输入消息"
                  aria-label="输入聊天消息"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                />
                <button
                  type="button"
                  aria-label="打开表情面板"
                  onClick={() => setEmojiPanelOpen((open) => !open)}
                  className="yy-chat-emoji h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <button type="submit" aria-label="发送消息"                 className="yy-chat-send h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
                {chatAppearance.sendIconUrl
                  ? <img src={chatAppearance.sendIconUrl} alt="" className="h-5 w-5 object-contain" />
                  : <Send className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  aria-label="生成角色回复"
                  disabled={isGeneratingReply}
                  onClick={() => void generateAiReply()}
                  className="yy-chat-generate h-9 shrink-0 rounded-xl bg-violet-600 px-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {isGeneratingReply ? '生成中' : chatAppearance.generateIconUrl
                    ? <img src={chatAppearance.generateIconUrl} alt="生成" className="h-5 w-5 object-contain" />
                    : '生成'}
                </button>
                {emojiPanelOpen && (
                  <div className="absolute bottom-full right-2 z-40 mb-2 w-64 rounded-2xl border border-slate-100 bg-white p-3 shadow-xl">
                    <div className="grid grid-cols-8 gap-1">
                      {BASIC_EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => {
                          if (saveAttachmentMessage('text', emoji)) setEmojiPanelOpen(false);
                        }} className="rounded-lg py-1 text-lg hover:bg-slate-100" aria-label={`发送${emoji}`}>{emoji}</button>
                      ))}
                    </div>
                    <div className="my-2 border-t border-slate-100" />
                    <div className="grid max-h-32 grid-cols-4 gap-2 overflow-y-auto">
                      {stickers.map((sticker) => (
                        <button key={sticker.id} type="button" onClick={() => sendSticker(sticker)} className="rounded-lg p-1 hover:bg-slate-100">
                          <img src={sticker.imageUrl} alt={sticker.description} className="mx-auto h-10 w-10 object-contain" />
                          <span className="block truncate text-[9px] text-slate-500">{sticker.description}</span>
                        </button>
                      ))}
                      {stickerDrafts.map((sticker) => (
                        <div key={sticker.id} className="col-span-4 flex items-center gap-2 rounded-lg bg-slate-50 p-1.5">
                          <img src={sticker.imageUrl} alt="" className="h-9 w-9 object-contain" />
                          <input
                            value={sticker.description}
                            onChange={(event) => setStickerDrafts((drafts) => drafts.map((item) =>
                              item.id === sticker.id ? { ...item, description: event.target.value } : item
                            ))}
                            placeholder="必填：简短介绍"
                            aria-label="表情包介绍"
                            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] outline-none"
                          />
                          <button type="button" onClick={() => saveSticker(sticker)} className="text-[10px] font-semibold text-teal-700">保存</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => stickerUploadRef.current?.click()} disabled={isProcessingChatImage} className="mt-2 w-full rounded-lg bg-slate-100 py-2 text-[10px] font-semibold text-slate-600">
                      {isProcessingChatImage ? '正在压缩…' : '上传表情包（可多选）'}
                    </button>
                  </div>
                )}
                {composerOpen && (
                  <div className="absolute bottom-full left-0 right-0 z-30 grid grid-cols-4 gap-y-4 border-t border-slate-100 bg-white/95 px-4 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                    {([
                      { title: '照片', icon: ImagePlus, run: () => openAttachment('photo') },
                      { title: '拍摄', icon: Camera, run: () => openAttachment('camera') },
                      { title: '视频通话', icon: Video, run: () => {
                        setComposerOpen(false);
                        setCallChoiceOpen(true);
                      } },
                      { title: '位置', icon: MapPin, run: () => openAttachment('location') },
                      { title: '红包', icon: Gift, run: () => openAttachment('red-packet') },
                      { title: '重新生成', icon: RefreshCw, run: handleRegenerate },
                      { title: '转账', icon: Wallet, run: () => openAttachment('transfer') },
                      { title: '链接', icon: Link, run: () => openAttachment('link') },
                    ]).map(({ title, icon: Icon, run }) => (
                      <button key={title} type="button" onClick={run} className="flex flex-col items-center gap-1.5 text-[10px] text-slate-600">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
                          <Icon className="h-5 w-5" />
                        </span>
                        {title}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            )}
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*"
              capture={attachmentMode === 'camera' ? 'environment' : undefined}
              className="hidden"
              onChange={(event) => {
                void handleAttachmentImage(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <input
              ref={stickerUploadRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void uploadStickers(event.target.files);
                event.currentTarget.value = '';
              }}
            />
            {chatError && <p role="alert" className="px-3 pb-2 text-center text-[11px] text-rose-600">{chatError}</p>}
          </div>
        )}
        {activeTab === 'chats' && !activeChat && (
          <div className="flex flex-col pb-4">
            <div className="p-3 pb-1">
              <div className="flex items-center gap-2 bg-white/70 border border-white/80 rounded-xl px-3 py-1.5 shadow-2xs">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索聊天"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-[#2C4A5C] placeholder-slate-400 w-full"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100/70 mt-1">
              {[...chats]
                .filter((chat) => {
                  const title = getChatTitle(chat);
                  const last = chat.messages.at(-1)?.text ?? '';
                  return `${title} ${last}`.toLowerCase().includes(searchQuery.toLowerCase());
                })
                .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
                .map((chat) => {
                  const avatarUrl = getChatAvatar(chat);
                  const lastMessage = chat.messages.at(-1)?.text ?? '暂无消息';
                  return (
                    <div key={chat.id}>
                      <div
                        onClick={() => {
                          if (suppressNextChatClickRef.current) {
                            suppressNextChatClickRef.current = false;
                            return;
                          }
                          setActiveChatId(chat.id);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setActiveChatMenuId(chat.id);
                        }}
                        onTouchStart={() => startChatLongPress(chat.id)}
                        onTouchEnd={clearContactPress}
                        onTouchMove={clearContactPress}
                        onMouseDown={() => startChatLongPress(chat.id)}
                        onMouseUp={clearContactPress}
                        onMouseLeave={clearContactPress}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/40 active:bg-white/60 select-none"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-tr from-sky-300 to-teal-200 text-sky-900 font-bold flex items-center justify-center text-sm">
                          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : chat.type === 'direct' ? contactName(chat.participantIds[0]).charAt(0) : <Users className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {chat.pinned && <Pin className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" />}
                            <h3 className="truncate text-xs font-bold text-[#2C4A5C]">{getChatTitle(chat)}</h3>
                            {chat.type === 'observer' && <span className="text-[9px] text-slate-400">旁观</span>}
                            {chat.blocked && <span className="text-[9px] text-rose-500">已拉黑</span>}
                          </div>
                          <p className="truncate text-[11px] text-slate-500">{lastMessage}</p>
                        </div>
                        <span className="text-[9px] text-slate-400">
                          {new Date(chat.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {activeChatMenuId === chat.id && (
                        <div className="flex justify-end gap-2 bg-slate-50/80 px-4 py-2">
                          <button onClick={() => toggleChatPinned(chat)} className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-amber-700 shadow-sm">
                            <Pin className="mr-1 inline h-3 w-3" />{chat.pinned ? '取消置顶' : '置顶'}
                          </button>
                          <button onClick={() => deleteChat(chat)} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700">
                            <Trash2 className="mr-1 inline h-3 w-3" />删除
                          </button>
                          <button onClick={() => setActiveChatMenuId('')} aria-label="关闭对话操作" className="p-1 text-slate-400">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              {chats.length === 0 && (
                <p className="px-4 py-10 text-center text-xs text-slate-400">还没有聊天，点击右上角 + 发起聊天。</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CONTACTS */}
        {activeTab === 'contacts' && (
          <div className="flex flex-col p-3 space-y-3 pb-4">
            {Object.keys(contactsByGroup).sort((a, b) => a.localeCompare(b, 'zh-CN')).map((group) => (
              <section key={group} className="space-y-1.5">
                <h3 className="px-1 text-[11px] font-bold text-slate-400">{group}</h3>
                <div className="glass-card rounded-2xl divide-y divide-slate-100/60 overflow-hidden">
                  {contactsByGroup[group].map((contact) => (
                    <div key={contact.id}>
                      <div
                        onContextMenu={(event) => {
                          event.preventDefault();
                          handleLongPress(contact.id);
                        }}
                        onTouchStart={() => startContactPress(contact.id)}
                        onTouchEnd={clearContactPress}
                        onTouchMove={clearContactPress}
                        onMouseDown={() => startContactPress(contact.id)}
                        onMouseUp={clearContactPress}
                        onMouseLeave={clearContactPress}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/40 select-none"
                      >
                        <div className="w-10 h-10 shrink-0 overflow-hidden rounded-xl bg-gradient-to-tr from-sky-300 to-teal-200 text-sky-900 font-bold flex items-center justify-center text-sm">
                          {contact.avatarUrl ? (
                            <img src={contact.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : contact.name.trim().charAt(0) || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-[#2C4A5C]">
                              {contact.name}
                            </span>
                            {contact.starred && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" />}
                          </div>
                          {contact.persona && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">{contact.persona}</p>
                          )}
                        </div>
                        {contact.worldBooks.length > 0 && (
                          <span className="shrink-0 text-[9px] text-slate-400">
                            世界书 {contact.worldBooks.length}
                          </span>
                        )}
                        <MoreVertical className="h-4 w-4 shrink-0 text-slate-300" />
                      </div>
                      {activeContactMenuId === contact.id && (
                        <div className="flex items-center justify-end gap-2 bg-slate-50/80 px-3 py-2">
                          <button
                            onClick={() => {
                              setActiveContactMenuId('');
                              openContactEditor(contact);
                            }}
                            className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-sky-700 shadow-sm"
                          >
                            <Pencil className="mr-1 inline h-3 w-3" />编辑角色
                          </button>
                          <button
                            onClick={() => toggleStarContact(contact.id)}
                            className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-amber-700 shadow-sm"
                          >
                            <Star className="mr-1 inline h-3 w-3" />
                            {contact.starred ? '取消星标' : '设为星标'}
                          </button>
                          <button
                            onClick={() => deleteContact(contact.id)}
                            className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700"
                          >
                            <Trash2 className="mr-1 inline h-3 w-3" />删除角色
                          </button>
                          <button
                            onClick={() => setActiveContactMenuId('')}
                            aria-label="关闭角色操作"
                            className="p-1 text-slate-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {contacts.length === 0 && (
              <div className="glass-card rounded-2xl p-8 text-center">
                <p className="text-sm font-semibold text-slate-600">通讯录还是空的</p>
                <p className="mt-1 text-xs text-slate-400">点击右上角 + 新增或导入角色人设</p>
              </div>
            )}
            {importError && <p role="alert" className="px-1 text-center text-[11px] text-rose-600">{importError}</p>}
          </div>
        )}

        {/* TAB 3: MOMENTS */}
        {activeTab === 'moments' && (
          <div className="flex flex-col pb-2">
            {/* Moments Cover Banner */}
            <div className="relative h-36 bg-gradient-to-r from-sky-200 via-pink-100 to-blue-200 flex items-end justify-end p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#2C4A5C] drop-shadow-xs">{personaDraft.name}</span>
                <div className="w-12 h-12 rounded-2xl bg-white p-0.5 shadow-md">
                  {personaDraft.avatarUrl ? (
                    <img
                      src={personaDraft.avatarUrl}
                      alt={`${personaDraft.name} 的头像`}
                      className="w-full h-full rounded-[14px] object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-[14px] bg-gradient-to-tr from-sky-400 to-teal-300 flex items-center justify-center text-white font-bold text-sm">
                      {personaDraft.name.trim().charAt(0) || '?'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Moments Feed */}
            <div className="p-4 space-y-4">
              {moments.map((item) => (
                <div key={item.id} className="glass-card rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-pink-200 text-pink-700 font-bold flex items-center justify-center text-xs">
                        {item.avatar}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2C4A5C]">{item.author}</h4>
                        <span className="text-[10px] text-slate-400">{item.time}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#2C4A5C] leading-relaxed">
                    {item.content}
                  </p>

                  <div className="flex gap-2">
                    {item.images.map((color, idx) => (
                      <div
                        key={idx}
                        className="w-20 h-20 rounded-xl border border-white/60 shadow-2xs"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1 text-slate-500 text-xs">
                    <button className="flex items-center gap-1 hover:text-rose-500">
                      <Heart className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono">{item.likes}</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-sky-500">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono">{item.comments}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ME */}
        {activeTab === 'me' && (
          <div className="p-4 space-y-3 pb-4">
            <section className="glass-card rounded-2xl p-3.5 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-[#2C4A5C]">我的 AI 人设</h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  这是 AI 聊天时使用的身份面具，与桌面装饰资料相互独立。
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={personaCollection.activeProfileId}
                  onChange={(event) => handleSelectPersona(event.target.value)}
                  className="min-w-0 flex-1 bg-white/75 border border-white rounded-xl px-3 py-2 text-xs text-[#2C4A5C] outline-none"
                  aria-label="选择人设预设"
                >
                  {personaCollection.profiles.map((persona) => (
                    <option key={persona.id} value={persona.id}>{persona.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDeletePersonaPreset}
                  disabled={personaCollection.profiles.length <= 1}
                  className="shrink-0 rounded-xl bg-rose-50 px-3 text-xs font-semibold text-rose-700 disabled:opacity-40"
                  aria-label="删除当前人设预设"
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />删除
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-tr from-sky-400 to-pink-300 p-0.5 shadow-sm">
                  {personaDraft.avatarUrl ? (
                    <img src={personaDraft.avatarUrl} alt="AI 人设头像" className="w-full h-full rounded-[14px] object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-lg font-bold text-[#2C4A5C]">
                      {personaDraft.name.trim().charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <label className="min-w-0 flex-1 block text-[11px] font-semibold text-[#2C4A5C]">
                  头像链接
                  <input
                    type="url"
                    value={personaDraft.avatarUrl ?? ''}
                    onChange={(event) => updatePersonaField('avatarUrl', event.target.value)}
                    placeholder="粘贴头像图片链接"
                    className="mt-1 w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs outline-none"
                  />
                </label>
              </div>
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                本地上传头像
                <input
                  type="file"
                  accept="image/*"
                  disabled={isProcessingAvatar}
                  onChange={(event) => {
                    void handleAvatarUpload(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  className="mt-1 block max-w-full text-[10px]"
                />
              </label>
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                名称
                <input
                  value={personaDraft.name}
                  onChange={(event) => updatePersonaField('name', event.target.value)}
                  maxLength={40}
                  className="mt-1 w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs outline-none"
                />
              </label>
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                简单介绍
                <textarea
                  value={personaDraft.identity}
                  onChange={(event) => updatePersonaField('identity', event.target.value)}
                  placeholder="简单介绍这个人设，让 AI 了解你希望呈现的身份"
                  maxLength={1000}
                  rows={3}
                  className="mt-1 w-full resize-y bg-white/70 border border-white rounded-xl px-3 py-2 text-xs outline-none placeholder:text-slate-400"
                />
              </label>
              {isProcessingAvatar && <p className="text-[11px] text-sky-700">正在压缩图片…</p>}
              <button
                onClick={handleSavePersona}
                className="w-full rounded-xl bg-teal-600 text-white py-2 text-xs font-bold active:scale-[0.98]"
              >
                保存人设
              </button>
              <div className="border-t border-slate-200/70 pt-3 space-y-2">
                <p className="text-[11px] font-semibold text-[#2C4A5C]">保存当前人设为预设</p>
                <div className="flex gap-2">
                  <input
                    value={presetNameDraft}
                    onChange={(event) => setPresetNameDraft(event.target.value)}
                    maxLength={40}
                    placeholder="输入预设名称"
                    className="min-w-0 flex-1 bg-white/70 border border-white rounded-xl px-3 py-2 text-xs outline-none"
                  />
                  <button
                    onClick={handleSavePersonaAsPreset}
                    className="shrink-0 rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-800"
                  >
                    新建预设
                  </button>
                </div>
              </div>
              {personaStatus && <p role="status" className="text-[11px] text-emerald-700">{personaStatus}</p>}
              {personaError && <p role="alert" className="text-[11px] text-rose-600">{personaError}</p>}
            </section>
            <section className="glass-card rounded-2xl p-3.5 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-[#2C4A5C]">聊天美化</h3>
                <p className="mt-1 text-[10px] text-slate-500">自定义聊天背景、气泡 CSS、小图标与页面布局，并保存或导入导出美化预设。</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedChatAppearancePresetId}
                  onChange={(event) => applyChatAppearancePreset(event.target.value)}
                  aria-label="切换聊天美化预设"
                  className="min-w-0 flex-1 rounded-xl border border-white bg-white/75 px-3 py-2 text-xs text-[#2C4A5C] outline-none"
                >
                  <option value="">选择已保存的美化预设</option>
                  {chatAppearance.presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={deleteChatAppearancePreset}
                  disabled={!selectedChatAppearancePresetId}
                  className="shrink-0 rounded-xl bg-rose-50 px-3 text-[10px] font-semibold text-rose-700 disabled:opacity-40"
                  aria-label="删除聊天美化预设"
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />删除
                </button>
              </div>
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                聊天背景图片链接
                <input
                  type="url"
                  value={chatAppearance.backgroundUrl.startsWith('data:') ? '' : chatAppearance.backgroundUrl}
                  onChange={(event) => updateChatAppearance({ backgroundUrl: event.target.value })}
                  placeholder="粘贴图片链接"
                  className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs outline-none"
                />
              </label>
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                本地上传聊天背景
                <input
                  type="file"
                  accept="image/*"
                  disabled={isProcessingChatImage}
                  onChange={(event) => {
                    void handleChatBackgroundUpload(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  className="mt-1 block max-w-full text-[10px]"
                />
              </label>
              <section className="space-y-2 rounded-xl border border-white/80 bg-white/50 p-3">
                <div>
                  <h4 className="text-[11px] font-bold text-[#2C4A5C]">气泡 CSS 美化</h4>
                  <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                    支持 CSS 选择器和样式声明，自动限制在聊天窗口内。可使用 .yy-chat-message-bubble、.is-user、.is-character。
                  </p>
                </div>
                <textarea
                  value={chatAppearance.bubbleCss ?? ''}
                  onChange={(event) => updateChatAppearance({ bubbleCss: event.target.value })}
                  rows={6}
                  maxLength={20000}
                  spellCheck={false}
                  placeholder={`.yy-chat-message-bubble {\n  border-radius: 18px;\n  box-shadow: 0 4px 12px #0002;\n}\n.yy-chat-message-bubble.is-user {\n  background: #d1fae5;\n}`}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-[10px] leading-relaxed outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={selectedBubbleCssPresetId}
                    onChange={(event) => applyBubbleCssPreset(event.target.value)}
                    aria-label="切换气泡 CSS 预设"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] text-slate-700"
                  >
                    <option value="">选择气泡预设</option>
                    {(chatAppearance.bubblePresets ?? []).map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedBubbleCssPresetId}
                    onClick={() => deleteBubbleCssPreset(selectedBubbleCssPresetId)}
                    className="rounded-lg bg-rose-50 px-2 text-[10px] font-semibold text-rose-600 disabled:opacity-40"
                  >
                    删除
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={bubbleCssPresetName}
                    onChange={(event) => setBubbleCssPresetName(event.target.value)}
                    placeholder="输入气泡预设名称"
                    aria-label="气泡预设名称"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px]"
                  />
                  <button
                    type="button"
                    onClick={saveBubbleCssPreset}
                    className="rounded-lg bg-teal-600 px-3 text-[10px] font-semibold text-white"
                  >
                    新建预设
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportBubbleCss} className="rounded-lg bg-slate-100 py-2 text-[10px] font-semibold text-slate-700">
                    <Download className="mr-1 inline h-3.5 w-3.5" />导出气泡预设
                  </button>
                  <button onClick={() => bubbleCssImportRef.current?.click()} className="rounded-lg bg-slate-100 py-2 text-[10px] font-semibold text-slate-700">
                    <Upload className="mr-1 inline h-3.5 w-3.5" />导入气泡预设
                  </button>
                  <input
                    ref={bubbleCssImportRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      void importBubbleCss(event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </div>
              </section>
              <section className="space-y-2 rounded-xl border border-white/80 bg-white/50 p-3">
                <div>
                  <h4 className="text-[11px] font-bold text-[#2C4A5C]">聊天布局 CSS</h4>
                  <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                    可用 .yy-chat-message-row、.yy-chat-avatar、.yy-chat-composer、.yy-chat-attachments、.yy-chat-voice、.yy-chat-emoji、.yy-chat-send、.yy-chat-generate 调整布局。
                  </p>
                </div>
                <textarea
                  value={chatAppearance.layoutCss ?? ''}
                  onChange={(event) => updateChatAppearance({ layoutCss: event.target.value })}
                  rows={5}
                  maxLength={20000}
                  spellCheck={false}
                  placeholder={`.yy-chat-message-row {\n  align-items: flex-end;\n}\n.yy-chat-avatar {\n  border-radius: 50%;\n}`}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-[10px] leading-relaxed outline-none"
                />
              </section>
              <section className="space-y-2 rounded-xl border border-white/80 bg-white/50 p-3">
                <h4 className="text-[11px] font-bold text-[#2C4A5C]">聊天小图标</h4>
                {([
                  ['sendIconUrl', '发送图标', sendIconUploadRef],
                  ['generateIconUrl', '生成图标', generateIconUploadRef],
                ] as const).map(([key, label, uploadRef]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="block text-[10px] font-semibold text-slate-600">
                      {label}链接
                      <input
                        type="url"
                        value={chatAppearance[key] ?? ''}
                        onChange={(event) => updateChatAppearance({ [key]: event.target.value })}
                        placeholder="图片链接（支持 GIF/SVG/PNG）"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] outline-none"
                      />
                    </label>
                    <button type="button" onClick={() => uploadRef.current?.click()} className="w-full rounded-lg bg-slate-100 py-2 text-[10px] font-semibold text-slate-600">
                      本地上传{label}
                    </button>
                    <input
                      ref={uploadRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProcessingChatImage}
                      onChange={(event) => {
                        void handleAppearanceIconUpload(key, event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </div>
                ))}
              </section>
              <div className="flex gap-2">
                <input
                  value={chatAppearancePresetName}
                  onChange={(event) => setChatAppearancePresetName(event.target.value)}
                  maxLength={40}
                  placeholder="预设名称"
                  className="min-w-0 flex-1 rounded-xl border border-white bg-white/70 px-3 py-2 text-xs outline-none"
                />
                <button onClick={saveChatAppearancePreset} className="shrink-0 rounded-xl bg-sky-100 px-3 py-2 text-[10px] font-bold text-sky-800">
                  新建预设
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => persistChatAppearance(chatAppearance)} className="rounded-xl bg-teal-600 py-2 text-xs font-bold text-white">保存美化</button>
                <button onClick={exportChatAppearance} className="rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700">
                  <Download className="mr-1 inline h-3.5 w-3.5" />导出
                </button>
                <button onClick={() => chatAppearanceImportRef.current?.click()} className="col-span-2 rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700">
                  <Upload className="mr-1 inline h-3.5 w-3.5" />导入并应用
                </button>
                <input
                  ref={chatAppearanceImportRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    void importChatAppearance(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
              </div>
              {isProcessingChatImage && <p className="text-[10px] text-sky-700">正在压缩图片…</p>}
              {chatAppearanceMessage && <p role="status" className="text-[10px] text-emerald-700">{chatAppearanceMessage}</p>}
              {chatAppearanceError && <p role="alert" className="text-[10px] text-rose-600">{chatAppearanceError}</p>}
            </section>
          </div>
        )}
      </div>
      {chatCreateMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-5">
          <section role="dialog" aria-modal="true" aria-labelledby="chat-create-title" className="w-full max-w-sm max-h-[85%] overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-2xl space-y-3">
            <header className="flex items-center justify-between">
              <h2 id="chat-create-title" className="text-base font-bold text-[#2C4A5C]">
                {chatCreateMode === 'direct' ? '发起聊天' : chatCreateMode === 'group' ? '发起群聊' : '发起旁观群聊'}
              </h2>
              <button onClick={() => { setChatCreateMode(null); setSelectedParticipantIds([]); setChatError(''); }} aria-label="关闭" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            <p className="text-[11px] text-slate-500">
              {chatCreateMode === 'direct' ? '选择一位通讯录角色。' : '选择至少两位通讯录角色。'}
            </p>
            <div className="space-y-1">
              {contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedParticipantIds.includes(contact.id)}
                    onChange={() => {
                      setSelectedParticipantIds((ids) =>
                        ids.includes(contact.id)
                          ? ids.filter((id) => id !== contact.id)
                          : chatCreateMode === 'direct'
                            ? [contact.id]
                            : [...ids, contact.id]
                      );
                      setChatError('');
                    }}
                  />
                  <div className="h-9 w-9 overflow-hidden rounded-xl bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-800">
                    {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" className="h-full w-full object-cover" /> : contact.name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-[#2C4A5C]">{contact.name}</span>
                  <span className="ml-auto text-[10px] text-slate-400">{contact.group}</span>
                </label>
              ))}
              {contacts.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">通讯录暂无角色，请先添加角色。</p>
              )}
            </div>
            {chatError && <p role="alert" className="text-[11px] text-rose-600">{chatError}</p>}
            <button onClick={createConversation} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white">
              创建对话
            </button>
          </section>
        </div>
      )}
      {chatSettingsOpen && chatSettingsDraft && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="chat-settings-title" className="w-full max-w-sm max-h-[90%] overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-2xl space-y-3">
            <header className="flex items-center justify-between">
              <h2 id="chat-settings-title" className="text-base font-bold text-[#2C4A5C]">对话设置</h2>
              <button onClick={() => { setChatSettingsOpen(false); setChatSettingsDraft(null); setChatError(''); }} aria-label="关闭" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            {chatSettingsDraft.type === 'direct' && (
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                备注名（仅自己可见）
                <input
                  value={chatSettingsDraft.noteName}
                  onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, noteName: event.target.value })}
                  maxLength={80}
                  placeholder={contactName(chatSettingsDraft.participantIds[0] ?? '')}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
              </label>
            )}
            {chatSettingsDraft.type === 'group' && (
              <section className="space-y-3 rounded-xl bg-slate-50 p-3">
                <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  群聊名称
                  <input
                    value={chatSettingsDraft.groupTitle ?? ''}
                    onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, groupTitle: event.target.value })}
                    maxLength={80}
                    placeholder={chatSettingsDraft.participantIds.map(contactName).join('、')}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[11px] font-semibold text-[#2C4A5C]">群聊头像</span>
                  <input
                    type="url"
                    value={chatSettingsDraft.avatars.group ?? ''}
                    onChange={(event) => setChatSettingsDraft({
                      ...chatSettingsDraft,
                      avatars: { ...chatSettingsDraft.avatars, group: event.target.value },
                    })}
                    placeholder="头像图片链接（可留空）"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none"
                  />
                  <label className="cursor-pointer rounded-lg bg-white p-2 text-slate-600" title="本地上传群聊头像">
                    <Upload className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProcessingChatImage}
                      onChange={(event) => {
                        void handleChatAvatarUpload('group', event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <label className="flex items-start gap-2 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={chatSettingsDraft.allowAgentGroupRename ?? false}
                    onChange={(event) => setChatSettingsDraft({
                      ...chatSettingsDraft,
                      allowAgentGroupRename: event.target.checked,
                    })}
                  />
                  <span>允许群内角色在 AI 回复时主动修改群聊名称和群昵称</span>
                </label>
              </section>
            )}
            {chatSettingsDraft.type === 'observer' && (
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                群名称（留空使用角色名称）
                <input
                  value={chatSettingsDraft.groupTitle ?? ''}
                  onChange={(event) => setChatSettingsDraft({
                    ...chatSettingsDraft,
                    groupTitle: event.target.value,
                  })}
                  maxLength={80}
                  placeholder={chatSettingsDraft.participantIds.map(contactName).join('、')}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
              </label>
            )}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[#2C4A5C]">
                {chatSettingsDraft.type === 'direct' ? '双方在此聊天中的头像' : '参与者在此聊天中的头像'}
              </p>
              {[
                ...(chatSettingsDraft.type === 'observer'
                  ? []
                  : [{ key: 'user', label: '我', fallback: personaDraft.avatarUrl }]),
                ...chatSettingsDraft.participantIds.map((id) => ({
                  key: id,
                  label: contactName(id),
                  fallback: contacts.find((contact) => contact.id === id)?.avatarUrl ?? '',
                })),
              ].map(({ key, label, fallback }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 truncate text-[10px] text-slate-500">{label}</span>
                  <input
                    type="url"
                    value={chatSettingsDraft.avatars[key] ?? ''}
                    onChange={(event) =>
                      setChatSettingsDraft({
                        ...chatSettingsDraft,
                        avatars: { ...chatSettingsDraft.avatars, [key]: event.target.value },
                      })
                    }
                    placeholder={fallback ? '留空使用默认头像' : '图片链接'}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] outline-none"
                  />
                  <label className="cursor-pointer rounded-lg bg-slate-100 p-2 text-slate-600" title="本地上传">
                    <Upload className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProcessingChatImage}
                      onChange={(event) => {
                        void handleChatAvatarUpload(key, event.target.files?.[0]);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
            {chatSettingsDraft.type === 'group' && (
              <section className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-[#2C4A5C]">群聊昵称</p>
                {[
                  { id: 'user', label: '我' },
                  ...chatSettingsDraft.participantIds.map((id) => ({ id, label: contactName(id) })),
                ].map(({ id, label }) => (
                  <label key={id} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 truncate text-[10px] text-slate-500">{label}</span>
                    <input
                      value={chatSettingsDraft.groupNicknames?.[id] ?? ''}
                      onChange={(event) => setChatSettingsDraft({
                        ...chatSettingsDraft,
                        groupNicknames: {
                          ...(chatSettingsDraft.groupNicknames ?? {}),
                          [id]: event.target.value,
                        },
                      })}
                      maxLength={40}
                      placeholder={`群内显示名（默认${label}）`}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                    />
                  </label>
                ))}
              </section>
            )}
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              {chatSettingsDraft.type === 'observer' ? '此聊天的补充（AI 会读取）' : '我和角色的补充（将提供给 AI）'}
              <textarea
                value={chatSettingsDraft.context}
                onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, context: event.target.value })}
                rows={3}
                maxLength={5000}
                placeholder={chatSettingsDraft.type === 'observer'
                  ? '补充群聊背景、角色关系或旁观情境'
                  : '补充双方关系、相处背景或本次对话设定'}
                className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed outline-none"
              />
            </label>
            {chatSettingsDraft.type === 'direct' && (
              <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] font-semibold text-[#2C4A5C]">补充预设</p>
                <select
                  value={selectedContextPresetId}
                  onChange={(event) => applyContextPreset(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                  aria-label="切换对话补充预设"
                >
                  <option value="">选择已保存的预设</option>
                  {contextPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={deleteContextPreset}
                  disabled={!selectedContextPresetId}
                  className="w-full rounded-lg bg-rose-50 py-2 text-[10px] font-semibold text-rose-700 disabled:opacity-40"
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />删除所选预设
                </button>
                <div className="flex gap-2">
                  <input
                    value={contextPresetName}
                    onChange={(event) => setContextPresetName(event.target.value)}
                    maxLength={50}
                    placeholder="输入预设名称"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                  />
                  <button
                    onClick={saveContextPreset}
                    className="shrink-0 rounded-lg bg-sky-100 px-3 py-2 text-[11px] font-semibold text-sky-800"
                  >
                    新建预设
                  </button>
                </div>
              </div>
            )}
            <section className="space-y-2 rounded-xl bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[#2C4A5C]">
                <input
                  type="checkbox"
                  checked={chatSettingsDraft.attachHistory ?? false}
                  onChange={(event) => setChatSettingsDraft({
                    ...chatSettingsDraft,
                    attachHistory: event.target.checked,
                  })}
                />
                挂载消息页面中的聊天记录
              </label>
              {chatSettingsDraft.attachHistory && (
                <>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                    {chats.map((conversation) => (
                      <label key={conversation.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[10px] text-slate-600 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={getAttachedHistoryChatIds(chatSettingsDraft).includes(conversation.id)}
                          onChange={(event) => {
                            const selectedIds = getAttachedHistoryChatIds(chatSettingsDraft);
                            const nextIds = event.target.checked
                              ? [...selectedIds, conversation.id]
                              : selectedIds.filter((id) => id !== conversation.id);
                            setChatSettingsDraft({
                              ...chatSettingsDraft,
                              attachedHistoryChatIds: nextIds,
                            });
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{getChatTitle(conversation)}</span>
                        <span className="shrink-0 text-slate-400">{conversation.messages.length} 条</span>
                      </label>
                    ))}
                    {chats.length === 0 && <p className="p-2 text-center text-[10px] text-slate-400">消息列表中还没有聊天记录</p>}
                  </div>
                  <label className="block text-[10px] text-slate-500">
                    每个聊天挂载最近多少条
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      value={chatSettingsDraft.attachedHistoryCount ?? 10}
                      onChange={(event) => setChatSettingsDraft({
                        ...chatSettingsDraft,
                        attachedHistoryCount: event.target.value === '' ? 0 : Number(event.target.value),
                      })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                    />
                  </label>
                  <p className="text-[9px] leading-relaxed text-slate-400">可多选任意单聊、群聊或旁观群聊。每个所选对话各取最近指定条数供 AI 参考，不修改原记录。</p>
                </>
              )}
            </section>
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="text-xs font-semibold text-[#2C4A5C]">旁白</span>
              <input
                type="checkbox"
                checked={chatSettingsDraft.narratorEnabled}
                onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, narratorEnabled: event.target.checked })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => exportChatHistory(chatSettingsDraft)} className="rounded-xl bg-slate-100 py-2 text-[11px] font-semibold text-slate-700">
                <Download className="mr-1 inline h-3.5 w-3.5" />导出聊天记录
              </button>
              <label className="cursor-pointer rounded-xl bg-slate-100 py-2 text-center text-[11px] font-semibold text-slate-700">
                <Upload className="mr-1 inline h-3.5 w-3.5" />导入聊天记录
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    void importChatHistory(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            <button onClick={clearChatHistory} className="w-full rounded-xl bg-rose-50 py-2 text-xs font-semibold text-rose-700">
              清空聊天记录
            </button>
            {chatSettingsDraft.type === 'direct' ? (
              <button
                onClick={() => setChatSettingsDraft({ ...chatSettingsDraft, blocked: !chatSettingsDraft.blocked })}
                className={`w-full rounded-xl py-2 text-xs font-semibold ${chatSettingsDraft.blocked ? 'bg-slate-100 text-slate-700' : 'bg-rose-50 text-rose-700'}`}
              >
                {chatSettingsDraft.blocked ? '取消拉黑' : '拉黑'}
              </button>
            ) : (
              <button onClick={dissolveChat} className="w-full rounded-xl bg-rose-50 py-2 text-xs font-semibold text-rose-700">
                解散群聊
              </button>
            )}
            {isProcessingChatImage && <p className="text-[10px] text-sky-700">正在压缩图片…</p>}
            {chatError && <p role="alert" className="text-[11px] text-rose-600">{chatError}</p>}
            <button onClick={saveChatSettings} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white">
              保存设置
            </button>
          </section>
        </div>
      )}
      {attachmentMode && attachmentMode !== 'camera' && activeChat && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-5">
          <section role="dialog" aria-modal="true" aria-labelledby="attachment-title" className="w-full max-w-sm max-h-[85%] overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-2xl space-y-3">
            <header className="flex items-center justify-between">
              <h2 id="attachment-title" className="text-base font-bold text-[#2C4A5C]">
                {attachmentMode === 'photo'
                  ? '发送照片'
                  : attachmentMode === 'location'
                    ? '发送位置'
                    : attachmentMode === 'red-packet'
                      ? '发红包'
                      : attachmentMode === 'transfer'
                        ? '转账'
                        : '发送链接'}
              </h2>
              <button onClick={() => { setAttachmentMode(null); setChatError(''); }} aria-label="关闭" className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            {attachmentMode === 'photo' && (
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  图片描述
                  <textarea
                    value={attachmentDraft.text}
                    onChange={(event) => setAttachmentDraft({ ...attachmentDraft, text: event.target.value })}
                    maxLength={500}
                    rows={5}
                    placeholder="用文字描述你想发送的图片，发送后会以方形文字卡片显示"
                    className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
                  />
                </label>
            )}
            {attachmentMode === 'location' && (
              <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                位置名称
                <input
                  autoFocus
                  value={attachmentDraft.title}
                  onChange={(event) => setAttachmentDraft({ ...attachmentDraft, title: event.target.value })}
                  maxLength={120}
                  placeholder="输入或模拟选择一个位置"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                />
              </label>
            )}
            {(attachmentMode === 'red-packet' || attachmentMode === 'transfer') && (
              <>
                {attachmentMode === 'transfer' && activeChat.type === 'group' && (
                  <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                    收款角色
                    <select
                      value={attachmentDraft.recipientId}
                      onChange={(event) => setAttachmentDraft({ ...attachmentDraft, recipientId: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="">请选择收款角色</option>
                      {activeChat.participantIds.map((id) => (
                        <option key={id} value={id}>{contactName(id)}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  {attachmentMode === 'red-packet' ? '红包总金额（元）' : '转账金额（元）'}
                  <input
                    autoFocus
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={attachmentDraft.amount}
                    onChange={(event) => setAttachmentDraft({ ...attachmentDraft, amount: event.target.value })}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>
                {attachmentMode === 'red-packet' && activeChat.type === 'group' && (
                  <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                    红包个数
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={attachmentDraft.quantity}
                      onChange={(event) => setAttachmentDraft({ ...attachmentDraft, quantity: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>
                )}
                <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  {attachmentMode === 'red-packet' ? '祝福语' : '转账说明'}（选填）
                  <input
                    value={attachmentDraft.text}
                    onChange={(event) => setAttachmentDraft({ ...attachmentDraft, text: event.target.value })}
                    maxLength={100}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
                  />
                </label>
                {attachmentMode === 'red-packet' && activeChat.type === 'group' && (
                  <p className="text-[10px] text-slate-400">拼手气红包会在群聊中显示总金额和红包个数，仅为模拟卡片。</p>
                )}
                <p className="text-[10px] text-slate-400">仅生成聊天中的模拟卡片，不涉及真实支付。</p>
              </>
            )}
            {attachmentMode === 'link' && (
              <>
                <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  标题
                  <input
                    autoFocus
                    value={attachmentDraft.title}
                    onChange={(event) => setAttachmentDraft({ ...attachmentDraft, title: event.target.value })}
                    maxLength={160}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  来源（选填）
                  <input
                    value={attachmentDraft.source}
                    onChange={(event) => setAttachmentDraft({ ...attachmentDraft, source: event.target.value })}
                    maxLength={160}
                    placeholder="例如：网页、文件或转发来源"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  内容（选填）
                  <textarea
                    value={attachmentDraft.content}
                    onChange={(event) => setAttachmentDraft({ ...attachmentDraft, content: event.target.value })}
                    rows={3}
                    maxLength={2000}
                    placeholder="添加摘要或文件内容"
                    className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
                  />
                </label>
              </>
            )}
            {isProcessingChatImage && <p className="text-[11px] text-sky-700">正在压缩图片…</p>}
            {chatError && <p role="alert" className="text-[11px] text-rose-600">{chatError}</p>}
            <button onClick={submitAttachment} disabled={isProcessingChatImage} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              发送
            </button>
          </section>
        </div>
      )}
      {isContactEditorOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsContactEditorOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-editor-title"
            className="w-full max-w-sm max-h-[88%] overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-2xl space-y-3"
          >
            <header className="flex items-center justify-between">
              <h2 id="contact-editor-title" className="text-base font-bold text-[#2C4A5C]">
                {contactDraft.id ? '编辑角色人设' : '新增角色人设'}
              </h2>
              <button
                type="button"
                onClick={() => setIsContactEditorOpen(false)}
                aria-label="关闭"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-tr from-sky-300 to-teal-200 text-sky-900 font-bold flex items-center justify-center">
                {contactDraft.avatarUrl ? (
                  <img src={contactDraft.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : contactDraft.name.trim().charAt(0) || '?'}
              </div>
              <label className="min-w-0 flex-1 block text-[11px] font-semibold text-[#2C4A5C]">
                头像链接
                <input
                  type="url"
                  value={contactDraft.avatarUrl}
                  onChange={(event) =>
                    setContactDraft((draft) => ({ ...draft, avatarUrl: event.target.value }))
                  }
                  placeholder="粘贴头像图片链接"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
                />
              </label>
            </div>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              本地上传头像
              <input
                type="file"
                accept="image/*"
                disabled={isProcessingAvatar}
                onChange={(event) => {
                  void handleContactAvatarUpload(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
                className="mt-1 block max-w-full text-[10px]"
              />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              姓名
              <input
                autoFocus
                value={contactDraft.name}
                onChange={(event) =>
                  setContactDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                maxLength={80}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
              />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              人设
              <textarea
                value={contactDraft.persona}
                onChange={(event) =>
                  setContactDraft((draft) => ({ ...draft, persona: event.target.value }))
                }
                rows={4}
                maxLength={5000}
                placeholder="填写角色身份、性格和背景等设定"
                className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-sky-400"
              />
            </label>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#2C4A5C]">世界书关联</p>
              {contactWorldBooks.length === 0 ? (
                <p className="text-[10px] text-slate-400">世界书 App 中还没有可关联的世界书。</p>
              ) : (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-2">
                  {contactWorldBooks.map((book) => {
                    const bookSelected = contactDraft.worldBooks.some(
                      (link) => link.bookId === book.id && !link.entryId
                    );
                    return (
                      <div key={book.id} className="space-y-1">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={bookSelected}
                            onChange={() => toggleContactWorldBook({ bookId: book.id })}
                          />
                          整本：{book.name}
                        </label>
                        {book.entries.map((entry) => {
                          const entrySelected = contactDraft.worldBooks.some(
                            (link) => link.bookId === book.id && link.entryId === entry.id
                          );
                          return (
                            <label key={entry.id} className="ml-5 flex items-center gap-2 text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={entrySelected}
                                onChange={() =>
                                  toggleContactWorldBook({ bookId: book.id, entryId: entry.id })
                                }
                              />
                              条目：{entry.title}
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              分组
              <input
                value={contactDraft.group}
                onChange={(event) =>
                  setContactDraft((draft) => ({ ...draft, group: event.target.value }))
                }
                maxLength={60}
                placeholder="例如：朋友、同事（留空为未分组）"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
              />
            </label>
            {isProcessingAvatar && <p className="text-[11px] text-sky-700">正在压缩图片…</p>}
            {contactError && <p role="alert" className="text-[11px] text-rose-600">{contactError}</p>}
            <button
              type="button"
              onClick={handleSaveContact}
              disabled={isProcessingAvatar}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              完成
            </button>
          </section>
        </div>
      )}
      {callChoiceOpen && activeChat && (
        <div className="absolute inset-0 z-[75] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="call-choice-title" className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-2xl">
            <header className="flex items-center justify-between">
              <h2 id="call-choice-title" className="text-base font-bold text-[#2C4A5C]">选择通话方式</h2>
              <button type="button" aria-label="关闭" onClick={() => setCallChoiceOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            <button type="button" onClick={() => startCall('voice')} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left hover:bg-slate-100">
              <Phone className="h-5 w-5 text-teal-700" />
              <span><strong className="block text-sm text-slate-700">语音通话</strong><small className="text-[10px] text-slate-500">模拟通话界面，以文字进行对话</small></span>
            </button>
            <button type="button" onClick={() => startCall('video')} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left hover:bg-slate-100">
              <Video className="h-5 w-5 text-sky-700" />
              <span><strong className="block text-sm text-slate-700">视频通话</strong><small className="text-[10px] text-slate-500">角色回复会附带括号动作描写</small></span>
            </button>
            <p className="text-center text-[10px] text-slate-400">均为本地模拟，不会实际拨出</p>
          </section>
        </div>
      )}
      {activeCallMode && activeChat && (
        <div className="absolute inset-0 z-[80] flex flex-col overflow-hidden bg-slate-950 text-white">
          <header className="z-10 flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-sm font-bold">{activeCallMode === 'voice' ? '语音通话' : '视频通话'}</h2>
              <p className="text-[10px] text-white/65">{getChatTitle(activeChat)} · 模拟中</p>
            </div>
            <button type="button" onClick={endCall} aria-label="结束通话" className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold">
              结束
            </button>
          </header>
          {activeCallMode === 'video' && (
            <div className="relative grid min-h-0 flex-1 grid-rows-2 gap-1 bg-black">
              {[
                {
                  id: 'user',
                  name: getChatParticipantName(activeChat, 'user'),
                  imageUrl: activeChat.avatars.user || personaDraft.avatarUrl,
                },
                {
                  id: activeChat.participantIds[0],
                  name: getChatParticipantName(activeChat, activeChat.participantIds[0] ?? ''),
                  imageUrl: activeChat.participantIds[0]
                    ? activeChat.avatars[activeChat.participantIds[0]] || contacts.find((item) => item.id === activeChat.participantIds[0])?.avatarUrl || ''
                    : '',
                },
              ].map((person) => (
                <div key={person.id} className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900">
                  {person.imageUrl && <img src={person.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />}
                  <div className="relative flex flex-col items-center gap-2 drop-shadow-lg">
                    {!person.imageUrl && <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-3xl font-bold">{person.name.charAt(0) || '?'}</span>}
                    <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold">{person.name || '角色'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeCallMode === 'voice' && (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-800 to-slate-950">
              {(() => {
                const participantId = activeChat.participantIds[0] ?? '';
                const avatar = activeChat.avatars[participantId] || contacts.find((item) => item.id === participantId)?.avatarUrl || '';
                return avatar
                  ? <img src={avatar} alt="" className="h-28 w-28 rounded-full object-cover shadow-xl" />
                  : <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/15 text-4xl font-bold">{contactName(participantId).charAt(0)}</div>;
              })()}
              <p className="text-lg font-semibold">{getChatTitle(activeChat)}</p>
              <p className="text-xs text-white/60">语音通话中 · 文字模拟</p>
              <div className="mt-4 flex gap-4 text-2xl text-white/80"><span>◖</span><span>◖</span><span>◖</span></div>
            </div>
          )}
          <div className="max-h-[34%] space-y-2 overflow-y-auto bg-black/55 p-3">
            {activeChat.messages.slice(-6).map((message) => (
              <p key={message.id} className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${message.senderId === 'user' ? 'ml-8 bg-emerald-900/80' : 'mr-8 bg-white/15'}`}>
                <span className="mb-0.5 block text-[9px] text-white/55">
                  {message.senderId === 'user' ? getChatParticipantName(activeChat, 'user') : getChatParticipantName(activeChat, message.senderId)}
                </span>
                {message.text}
              </p>
            ))}
          </div>
          {activeChat.type !== 'observer' && !activeChat.blocked && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendChatMessage();
              }}
              className="flex items-center gap-2 bg-slate-950 p-3 pb-[max(env(safe-area-inset-bottom,0px),12px)]"
            >
              <input
                value={chatMessageDraft}
                onChange={(event) => setChatMessageDraft(event.target.value)}
                placeholder="输入文字模拟语音"
                aria-label="通话中输入消息"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/45"
              />
              <button type="submit" className="rounded-xl bg-teal-600 px-3 py-2.5 text-xs font-bold">发送</button>
              <button type="button" disabled={isGeneratingReply} onClick={() => void generateAiReply()} className="rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold disabled:opacity-50">
                {isGeneratingReply ? '生成中' : 'AI 回复'}
              </button>
            </form>
          )}
          {chatError && <p role="alert" className="bg-slate-950 px-3 pb-2 text-center text-[10px] text-rose-300">{chatError}</p>}
        </div>
      )}
      {voiceModalOpen && activeChat && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="voice-title" className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-2xl">
            <header className="flex items-center justify-between">
              <h2 id="voice-title" className="text-base font-bold text-[#2C4A5C]">模拟语音</h2>
              <button type="button" aria-label="关闭" onClick={() => setVoiceModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            <p className="text-[11px] text-slate-500">输入语音内容，发出后会显示为语音气泡和文字转写。</p>
            <textarea
              autoFocus
              value={voiceDraft}
              onChange={(event) => setVoiceDraft(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="输入要模拟的语音内容"
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
            />
            {chatError && <p role="alert" className="text-[11px] text-rose-600">{chatError}</p>}
            <button type="button" onClick={sendVoiceMessage} className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white">发送语音</button>
          </section>
        </div>
      )}
      {activeThought && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="thought-title" className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-2xl">
            <header className="flex items-center justify-between">
              <h2 id="thought-title" className="text-base font-bold text-[#2C4A5C]">{activeThought.name}的心声</h2>
              <button type="button" aria-label="关闭" onClick={() => setActiveThought(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            <p className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{activeThought.thought}</p>
          </section>
        </div>
      )}
      {/* WeChat Bottom Sub-Tab Bar */}
      {!activeChat && <div className="glass-nav border-t border-white/60 px-2 pt-1 pb-[max(env(safe-area-inset-bottom,0px),8px)] flex items-center justify-around z-20 shrink-0 mt-auto">
        {[
        { key: 'chats', label: '消息', icon: MessageSquare },
          { key: 'contacts', label: '通讯录', icon: Users },
          { key: 'moments', label: '朋友圈', icon: Compass },
          { key: 'me', label: '我', icon: User },
      ].map(({ key, label, icon: TabIcon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key as WeChatTab);
                setActiveChatId('');
                setChatSettingsOpen(false);
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-teal-700 font-bold scale-105' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <TabIcon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[10px] mt-0.5">{label}</span>
            </button>
          );
        })}
      </div>}
    </div>
  );
};
