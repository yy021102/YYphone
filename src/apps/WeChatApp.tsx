import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Users,
  Compass,
  User,
  Search,
  Plus,
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
  Timer,
  Wallet,
  Link,
  Smile,
  Mic,
  Archive,
  Phone,
  Pencil,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { MomentsTab } from '../components/MomentsTab';
import { ColorWheel, hexToRgba } from '../components/ColorWheel';
import { musicPlayer } from '../utils/musicPlayer';
import { findMusicTrackByTitle, readMusicPlaybackSnapshot } from '../utils/musicPlayback';
import { PersonaCollection, UserPersona } from '../types';
import { readStorageString, readStoredValue, writeStorageString, writeStoredValue } from '../utils/localStorage';
import { readSetting, saveSetting, SETTINGS_KEYS } from '../utils/settings';
import { compressChatPhoto, compressImageFile } from '../utils/imageFile';
import { buildPrompt } from '../utils/buildPrompt';
import { buildGroupPrivateContext } from '../utils/chatHistory';
import { deleteGroupJournal, invalidateGroupJournal, maybeAutoGroupJournal } from '../utils/groupJournal';
import { GroupJournalPanel } from '../components/GroupJournalPanel';
import { requestChatReply, withChatResponseFormat } from '../utils/chatReply';
import { generateImage, readImageGenerationSettings } from '../utils/imageGeneration';
import { showYyError, useErrorDialog } from '../components/ErrorDialog';
import { AvatarFrameEditor } from '../components/AvatarFrameEditor';
import { CallScreen } from '../components/CallScreen';
import { normalizeForumHandle, readGeneratedForumHandles } from '../utils/forumIdentity';
import { estimateConversationTokens, estimatePromptTokens } from '../utils/chatTokens';
import { buildCharacterExport, parsePortableWorldBooks, remapImportedWorldBooks } from '../utils/characterExport';
import { applySocialWrites, buildSocialInstructions, parseSocialActions, type SocialContext } from '../utils/chatSocial';
import { BUILTIN_STICKERS, CHAT_STICKERS_STORAGE_KEY, type ChatSticker } from '../utils/chatStickers';
import { ChatNotification, ChatRuntimeSettings, getRoundThought, isProactiveDue, permittedSticker, preserveRoundThoughts } from '../utils/chatRuntime';
import { readBlockedInteractions, updateBlockedInteraction, type BlockedInteraction } from '../utils/blockedContact';
import { AvatarFrameStyle, avatarFrameWrapStyle } from '../utils/avatarFrame';
import {
  chargeAlipay,
  settleIncomingChatPayment,
  writeAlipayData,
  grantIntimatePay,
  readAlipayData,
  sendIntimatePayInteraction,
} from '../utils/alipayData';
import { appendCharacterContextEvent, readPendingHighPriorityEvents } from '../utils/characterContext';
import {
  applyCoupleSeenAfterChat,
  buildCoupleSpaceInjection,
  CoupleInjection,
  localDateString,
  readCoupleSpaces,
  updateCoupleSpace,
} from '../utils/coupleSpaceData';
import { applyPlantSeenAfterChat, buildPlantInjection, PlantInjection } from '../utils/plantData';
import { buildMemoryInjection, markMemoriesRecalled } from '../utils/memoryData';
import { deleteCharacterMemoryArchives, deleteMemoryArchive, invalidateMemoryArchive, prepareMemoryArchiveSwitch } from '../utils/memoryArchives';
import { maybeAutoExtractMemory } from '../utils/memoryAi';
import { maybeAutoGrowth, maybeAutoJournal } from '../utils/journalAi';
import { addInventoryItem } from '../utils/inventoryData';
import {
  applyMomentsAfterChat,
  buildMomentsInjection,
  MomentChatAction,
  MomentsInjection,
} from '../utils/momentsData';
import {
  CharacterNpc,
  getNpcByParticipantId,
  npcParticipantId,
  readCharacterNpcs,
  writeCharacterNpcs,
} from '../utils/characterNpcs';
import { synthesizeVoice } from '../utils/voiceModel';

interface WeChatAppProps {
  onBack: () => void;
  isVisible: boolean;
  runtimeSettings: ChatRuntimeSettings;
  requestedChat: { id: string; at: number } | null;
  onMessage: (message: ChatNotification) => void;
  onIncomingCall: () => void;
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
  forumNickname?: string;
  forumHandle?: string;
  stickerCategories?: string[];
  /** 通讯录里显示在名字下面的简介，不发给 AI */
  bio?: string;
  persona: string;
  worldBooks: ContactWorldBookLink[];
  group: string;
  starred: boolean;
  linkedNpcIds?: string[];
  voiceEnabled?: boolean;
  voiceId?: string;
  voiceLanguage?: string;
}

interface ContactWorldBookEntry {
  id: string;
  title: string;
  content: string;
}

interface ContactWorldBook {
  id: string;
  name: string;
  isGlobal?: boolean;
  entries: ContactWorldBookEntry[];
}

type ChatType = 'direct' | 'group' | 'observer';

interface ForumCardDetails {
  boardName: string;
  author: string;
  title: string;
  body: string;
  comments: Array<{ authorName: string; content: string }>;
}

interface PomodoroCardDetails {
  totalMinutes: number;
  sessionCount: number;
  tasks: string[];
  companionNames: string[];
  sessions: Array<{
    time: string;
    durationMinutes: number;
    taskTitle: string;
    companionCharName: string;
  }>;
}

const TIMESTAMP_GAP_MS = 10 * 60 * 1000;

const shouldShowTimestamp = (previous: string | undefined, current: string) => {
  const currentTime = Date.parse(current);
  if (Number.isNaN(currentTime)) return false;
  if (!previous) return true;
  const previousTime = Date.parse(previous);
  return Number.isNaN(previousTime) || currentTime - previousTime >= TIMESTAMP_GAP_MS;
};

const formatChatTimestamp = (value: string, timeZone?: string): string => {
  const date = new Date(value);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const makeDateParts = (d: Date) => Object.fromEntries(
    new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d).map((part) => [part.type, part.value])
  );
  let dateFields: Record<string, string>;
  let nowFields: Record<string, string>;
  try {
    dateFields = makeDateParts(date);
    nowFields = makeDateParts(now);
  } catch (error) {
    console.error('Could not format chat timestamp for the selected time zone.', error);
    return timeZone ? formatChatTimestamp(value) : value;
  }
  const clock = `${pad(Number(dateFields.hour))}:${pad(Number(dateFields.minute))}`;
  const dayStart = (fields: Record<string, string>) =>
    Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day));
  const dayDiff = Math.round((dayStart(nowFields) - dayStart(dateFields)) / 86400000);
  if (dayDiff === 0) return clock;
  if (dayDiff === 1) return `昨天 ${clock}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = { Sun: '周日', Mon: '周一', Tue: '周二', Wed: '周三', Thu: '周四', Fri: '周五', Sat: '周六' }[dateFields.weekday];
    return `${weekday ?? dateFields.weekday} ${clock}`;
  }
  if (dateFields.year === nowFields.year) return `${dateFields.month}月${dateFields.day}日 ${clock}`;
  return `${dateFields.year}年${dateFields.month}月${dateFields.day}日 ${clock}`;
};

interface ChatMessage {
  id: string;
  replyBatchId?: string;
  senderId: string;
  text: string;
  createdAt: string;
  kind?: 'text' | 'image' | 'voice' | 'sticker' | 'video-call' | 'location' | 'red-packet' | 'transfer' | 'link' | 'forum-forward' |     'pomodoro-share' |   'pat' | 'order' | 'couple-invite' | 'phone-share' | 'context-note' | 'intimate-pay';
        shareMode?: 'found' | 'memory';
      inviteFrom?: 'user' | 'char';
      inviteStatus?: 'pending' | 'accepted' | 'declined' | 'withdrawn';
    productEmoji?: string;
    orderCategory?: 'shopping' | 'eleme' | 'xianyu';
    orderMode?: 'self' | 'gift';
    forumForwardTargetId?: string;
  imageUrl?: string;
  title?: string;
  source?: string;
  content?: string;
  aiContext?: string;
  forumDetails?: ForumCardDetails;
  pomodoroDetails?: PomodoroCardDetails;
  amount?: string;
  quantity?: number;
  recipientId?: string;
  payerId?: string;
  thought?: string;
  callStatus?: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';
  paymentStatus?: 'pending' | 'received' | 'returned';
  intimateStatus?: 'pending' | 'granted' | 'declined';
  replyTo?: { id: string; senderName: string; text: string };
  reactions?: Array<{ by: string; emoji: string }>;
}

const MESSAGE_REACTIONS = ['🥰', '😋', '🥺', '❤️', '😔', '😡', '🤣', '😥'] as const;

interface GeneratedAiMessage {
  intimateStatus?: ChatMessage['intimateStatus'];
  text: string;
  quoteText?: string;
  kind?: Exclude<ChatMessage['kind'], 'forum-forward' | 'pomodoro-share' | 'couple-invite' | 'phone-share' | 'context-note'> | 'narration';
  title?: string;
  source?: string;
  content?: string;
  amount?: string;
  quantity?: number;
  recipientId?: string;
  imageUrl?: string;
  productEmoji?: string;
  orderCategory?: 'shopping' | 'eleme' | 'xianyu';
  orderMode?: 'self' | 'gift';
}

interface PendingShare {
  targetCharId: string;
  message: ChatMessage;
}

const isPendingShareQueue = (value: unknown): value is PendingShare[] =>
  Array.isArray(value) &&
  value.every((item) =>
    !!item &&
    typeof item === 'object' &&
    typeof (item as PendingShare).targetCharId === 'string' &&
    !!(item as PendingShare).message &&
    typeof (item as PendingShare).message.id === 'string' &&
    typeof (item as PendingShare).message.text === 'string' &&
    typeof (item as PendingShare).message.createdAt === 'string'
  );

const DEFAULT_STICKER_CATEGORY = '默认';
const CHAT_STICKER_CATEGORIES_KEY = 'yyphone:chat-sticker-categories';

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
  userBubbleOpacity?: number;
  characterBubbleOpacity?: number;
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
  userBubbleOpacity?: number;
  characterBubbleOpacity?: number;
  bubbleCss?: string;
  layoutCss?: string;
  sendIconUrl?: string;
  generateIconUrl?: string;
  presets: ChatAppearancePreset[];
  bubblePresets?: BubbleCssPreset[];
  userAvatarFrame?: AvatarFrameStyle;
  characterAvatarFrame?: AvatarFrameStyle;
}

interface ChatArchive {
  id: string;
  name: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface ChatConversation {
  id: string;
  archives?: ChatArchive[];
  activeArchiveId?: string;
  type: ChatType;
  participantIds: string[];
  noteName: string;
  context: string;
  narratorEnabled: boolean;
  blocked: boolean;
  blockedSince?: string;
  blockedNextAt?: string;
  blockedDelayMinutes?: number;
  blockedTiming?: 'after' | 'within';
  blockedActivity?: 'friend' | 'paper' | 'both';
  blockedActivityCount?: number;
  blockedBacklogGeneratedAt?: string;
  blockedBacklogRetryAt?: string;
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
  currentChatHistoryCount?: number;
  attachedHistoryCounts?: Record<string, number>;
  replyMessageMin?: number;
  replyMessageMax?: number;
  includeLatestThought?: boolean;
  allowGroupPrivate?: boolean;
  allowAutoMoments?: boolean;
  allowAutoCouple?: boolean;
  fontSize?: number;
  proactiveEnabled?: boolean;
  proactiveIntervalMinutes?: number;
  lastProactiveAt?: string;
  timeAwarenessEnabled?: boolean;
  timeZone?: string;
  imageGenerationEnabled?: boolean;
  imageGenerationPrompt?: string;
}

const CONTACTS_STORAGE_KEY = 'pocketos:wechat-contacts';
const CONTACT_EXPORT_FORMAT = 'yyphone-contacts';
const CHATS_STORAGE_KEY = 'yyphone:wechat-chats';
const BASIC_EMOJIS = ['😀', '😂', '🥰', '😍', '😎', '😭', '🥺', '😡', '🤔', '👍', '👎', '❤️', '💕', '🎉', '🙏', '🌹'];
const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  backgroundUrl: '',
  userBubbleColor: '#e3e6eb',
  characterBubbleColor: '#f1f3f6',
  userBubbleOpacity: 0.78,
  characterBubbleOpacity: 0.78,
  bubbleCss: '',
  layoutCss: '',
  sendIconUrl: '',
  generateIconUrl: '',
  presets: [],
  bubblePresets: [],
};

const getDefaultReplyMessageRange = (chat: ChatConversation) => ({
  min: chat.type === 'direct'
    ? 1
    : Math.max(1, chat.participantIds.length + (chat.type === 'group' ? 1 : 0)),
  max: chat.type === 'direct'
    ? 6
    : Math.max(1, (chat.participantIds.length + (chat.type === 'group' ? 1 : 0)) * 2),
});

const getReplyMessageRange = (chat: ChatConversation) => {
  const defaults = getDefaultReplyMessageRange(chat);
  return {
    min: chat.replyMessageMin ?? defaults.min,
    max: chat.replyMessageMax ?? defaults.max,
  };
};

const getAttachedHistoryCount = (chat: ChatConversation, sourceChatId: string) =>
  chat.attachedHistoryCounts?.[sourceChatId] ?? chat.attachedHistoryCount ?? 200;

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
      (contact.forumHandle === undefined || typeof contact.forumHandle === 'string') &&
      (contact.stickerCategories === undefined ||
        (Array.isArray(contact.stickerCategories) && contact.stickerCategories.every((category: unknown) => typeof category === 'string'))) &&
      typeof contact.persona === 'string' &&
      typeof contact.group === 'string' &&
      typeof contact.starred === 'boolean' &&
      (contact.linkedNpcIds === undefined ||
        (Array.isArray(contact.linkedNpcIds) &&
          contact.linkedNpcIds.every((id: unknown) => typeof id === 'string'))) &&
      (contact.voiceEnabled === undefined || typeof contact.voiceEnabled === 'boolean') &&
      (contact.voiceId === undefined || typeof contact.voiceId === 'string') &&
      (contact.voiceLanguage === undefined || typeof contact.voiceLanguage === 'string') &&
      Array.isArray(contact.worldBooks) &&
      contact.worldBooks.every(
        (link: ContactWorldBookLink) =>
          !!link &&
          typeof link.bookId === 'string' &&
          (link.entryId === undefined || typeof link.entryId === 'string')
      )
  );

// 宽松校验：单条异常数据不应导致整个聊天列表被判无效而“被清空”。
const isChatList = (value: unknown): value is ChatConversation[] =>
  Array.isArray(value) &&
  value.every(
    (chat) =>
      !!chat &&
      typeof chat === 'object' &&
      typeof chat.id === 'string' &&
      Array.isArray(chat.participantIds) &&
      Array.isArray(chat.messages) &&
      chat.messages.every((message: unknown) => !!message && typeof message === 'object' && typeof (message as ChatMessage).id === 'string')
  );

export const isStrictChatList = (value: unknown): value is ChatConversation[] =>
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
      (chat.blockedSince === undefined || typeof chat.blockedSince === 'string') &&
      (chat.blockedNextAt === undefined || typeof chat.blockedNextAt === 'string') &&
      (chat.blockedDelayMinutes === undefined || Number.isInteger(chat.blockedDelayMinutes)) &&
      (chat.blockedTiming === undefined || chat.blockedTiming === 'after' || chat.blockedTiming === 'within') &&
      (chat.blockedActivity === undefined || chat.blockedActivity === 'friend' ||
        chat.blockedActivity === 'paper' || chat.blockedActivity === 'both') &&
      (chat.blockedActivityCount === undefined || Number.isInteger(chat.blockedActivityCount)) &&
      (chat.blockedBacklogGeneratedAt === undefined || typeof chat.blockedBacklogGeneratedAt === 'string') &&
      (chat.blockedBacklogRetryAt === undefined || typeof chat.blockedBacklogRetryAt === 'string') &&
      typeof chat.pinned === 'boolean' &&
      !!chat.avatars &&
      typeof chat.avatars === 'object' &&
      Object.values(chat.avatars).every((url: unknown) => typeof url === 'string') &&
      Array.isArray(chat.messages) &&
      chat.messages.every(
        (message: ChatMessage) =>
          !!message &&
          typeof message.id === 'string' &&
          (message.replyBatchId === undefined || typeof message.replyBatchId === 'string') &&
          typeof message.senderId === 'string' &&
          typeof message.text === 'string' &&
          typeof message.createdAt === 'string' &&
          (message.paymentStatus === undefined || ['pending', 'received', 'returned'].includes(message.paymentStatus)) &&
          (message.intimateStatus === undefined || ['pending', 'granted', 'declined'].includes(message.intimateStatus)) &&
          (message.kind === undefined ||
            ['text', 'image', 'voice', 'sticker', 'video-call', 'location', 'red-packet', 'transfer', 'link', 'forum-forward', 'pomodoro-share', 'pat', 'order', 'couple-invite', 'phone-share', 'context-note', 'intimate-pay'].includes(message.kind)) &&
          (message.forumForwardTargetId === undefined || typeof message.forumForwardTargetId === 'string') &&
          (message.imageUrl === undefined || typeof message.imageUrl === 'string') &&
          (message.title === undefined || typeof message.title === 'string') &&
          (message.source === undefined || typeof message.source === 'string') &&
          (message.content === undefined || typeof message.content === 'string') &&
          (message.aiContext === undefined || typeof message.aiContext === 'string') &&
          (message.forumDetails === undefined ||
            (!!message.forumDetails &&
              typeof message.forumDetails.boardName === 'string' &&
              typeof message.forumDetails.author === 'string' &&
              typeof message.forumDetails.title === 'string' &&
              typeof message.forumDetails.body === 'string' &&
              Array.isArray(message.forumDetails.comments) &&
              message.forumDetails.comments.every((comment) =>
                typeof comment.authorName === 'string' && typeof comment.content === 'string'
              ))) &&
          (message.pomodoroDetails === undefined ||
            (!!message.pomodoroDetails &&
              typeof message.pomodoroDetails.totalMinutes === 'number' &&
              typeof message.pomodoroDetails.sessionCount === 'number' &&
              Array.isArray(message.pomodoroDetails.tasks) &&
              message.pomodoroDetails.tasks.every((task) => typeof task === 'string') &&
              Array.isArray(message.pomodoroDetails.companionNames) &&
              message.pomodoroDetails.companionNames.every((name) => typeof name === 'string') &&
              Array.isArray(message.pomodoroDetails.sessions) &&
              message.pomodoroDetails.sessions.every((session) =>
                typeof session.time === 'string' &&
                typeof session.durationMinutes === 'number' &&
                typeof session.taskTitle === 'string' &&
                typeof session.companionCharName === 'string'
              ))) &&
          (message.amount === undefined || typeof message.amount === 'string') &&
          (message.quantity === undefined || typeof message.quantity === 'number') &&
          (message.recipientId === undefined || typeof message.recipientId === 'string') &&
          (message.payerId === undefined || typeof message.payerId === 'string') &&
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
      (chat.currentChatHistoryCount === undefined || typeof chat.currentChatHistoryCount === 'number') &&
      (chat.attachedHistoryCounts === undefined ||
        (!!chat.attachedHistoryCounts &&
          typeof chat.attachedHistoryCounts === 'object' &&
          Object.values(chat.attachedHistoryCounts).every((count) => typeof count === 'number'))) &&
      (chat.replyMessageMin === undefined || typeof chat.replyMessageMin === 'number') &&
      (chat.replyMessageMax === undefined || typeof chat.replyMessageMax === 'number') &&
      (chat.includeLatestThought === undefined || typeof chat.includeLatestThought === 'boolean') &&
      (chat.allowGroupPrivate === undefined || typeof chat.allowGroupPrivate === 'boolean') &&
      (chat.allowAutoMoments === undefined || typeof chat.allowAutoMoments === 'boolean') &&
      (chat.allowAutoCouple === undefined || typeof chat.allowAutoCouple === 'boolean') &&
      (chat.timeAwarenessEnabled === undefined || typeof chat.timeAwarenessEnabled === 'boolean') &&
      (chat.timeZone === undefined || typeof chat.timeZone === 'string') &&
      (chat.imageGenerationEnabled === undefined || typeof chat.imageGenerationEnabled === 'boolean') &&
      (chat.imageGenerationPrompt === undefined || typeof chat.imageGenerationPrompt === 'string') &&
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
    const raw = readStorageString('yyphone:world-books');
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
      return [{ id: book.id, name: book.name, isGlobal: book.isGlobal === true, entries }];
    });
  } catch (error) {
    console.error('Could not read world books for contacts.', error);
    return [];
  }
};

export const WeChatApp: React.FC<WeChatAppProps> = ({
  onBack, isVisible, runtimeSettings, requestedChat, onMessage, onIncomingCall,
}) => {
  const generationRunning = useRef(false);
  const scheduledTick = useRef<() => Promise<void>>(async () => {});
  const delivery = useRef({ isVisible, activeChatId: '', onMessage, onIncomingCall, runtimeSettings });
  const [activeTab, setActiveTab] = useState<WeChatTab>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [personaCollection, setPersonaCollection] = useState(() =>
    readSetting(SETTINGS_KEYS.personas, DEFAULT_PERSONAS, isPersonaCollection)
  );
  const selectedPersona =
    personaCollection.profiles.find(
      (persona) => persona.id === personaCollection.activeProfileId
    ) ?? DEFAULT_PERSONA;
  const [personaDraft, setPersonaDraft] = useState(selectedPersona);
  const [personaStatus, setPersonaStatus] = useState('');
  const [personaError, setPersonaError] = useState('');
  useErrorDialog(personaError);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const [chatAppearance, setChatAppearance] = useState(() => {
    const stored = readSetting(SETTINGS_KEYS.chatAppearance, DEFAULT_CHAT_APPEARANCE, isChatAppearance);
    // 旧版默认的绿/白气泡视为未自定义，升级为新的浅灰默认。
    return {
      ...stored,
      userBubbleColor: stored.userBubbleColor.toLowerCase() === '#d1fae5' ? DEFAULT_CHAT_APPEARANCE.userBubbleColor : stored.userBubbleColor,
      characterBubbleColor: stored.characterBubbleColor.toLowerCase() === '#ffffff' ? DEFAULT_CHAT_APPEARANCE.characterBubbleColor : stored.characterBubbleColor,
    };
  });
  const [chatAppearancePresetName, setChatAppearancePresetName] = useState('');
  const [selectedChatAppearancePresetId, setSelectedChatAppearancePresetId] = useState('');
  const [bubbleCssPresetName, setBubbleCssPresetName] = useState('');
  const [selectedBubbleCssPresetId, setSelectedBubbleCssPresetId] = useState('');
  const [chatAppearanceMessage, setChatAppearanceMessage] = useState('');
  const [chatAppearanceError, setChatAppearanceError] = useState('');
  useErrorDialog(chatAppearanceError);
  const chatAppearanceImportRef = useRef<HTMLInputElement>(null);
  const bubbleCssImportRef = useRef<HTMLInputElement>(null);
  const sendIconUploadRef = useRef<HTMLInputElement>(null);
  const generateIconUploadRef = useRef<HTMLInputElement>(null);
  const [activeCallMode, setActiveCallMode] = useState<'voice' | 'video' | null>(null);
  const [callStartedAt, setCallStartedAt] = useState('');
  const [callConnectedAt, setCallConnectedAt] = useState<number | null>(null);
  const [incomingCallMessageId, setIncomingCallMessageId] = useState('');
  const [expandedVoiceIds, setExpandedVoiceIds] = useState<string[]>([]);
  const [callChoiceOpen, setCallChoiceOpen] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [contacts, setContacts] = useState(() =>
    readStoredValue(CONTACTS_STORAGE_KEY, [] as ContactPersona[], isContactList)
  );
  const [blockedInteractions, setBlockedInteractions] = useState<BlockedInteraction[]>(readBlockedInteractions);
  const [characterNpcs, setCharacterNpcs] = useState<CharacterNpc[]>(() => readCharacterNpcs());
  const [contactsMenuOpen, setContactsMenuOpen] = useState(false);
  const [characterExportOpen, setCharacterExportOpen] = useState(false);
  const [exportWorldBookIds, setExportWorldBookIds] = useState<string[]>([]);
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
  const [isNewContactDraft, setIsNewContactDraft] = useState(false);
  const [npcSectionOpen, setNpcSectionOpen] = useState(false);
  const [npcDraft, setNpcDraft] = useState({ id: '', name: '', avatarUrl: '', persona: '' });
  const [selectedSharedNpcIds, setSelectedSharedNpcIds] = useState<string[]>([]);
  const [contactWorldBooks, setContactWorldBooks] = useState<ContactWorldBook[]>([]);
  const [contactError, setContactError] = useState('');
  useErrorDialog(contactError);
  const [importError, setImportError] = useState('');
  useErrorDialog(importError, '导入失败');
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
  useEffect(() => {
    if (chatError) {
      showYyError(chatError);
      setChatError('');
    }
  }, [chatError]);
  const [activeChatId, setActiveChatId] = useState('');
  useEffect(() => {
    delivery.current = { isVisible, activeChatId, onMessage, onIncomingCall, runtimeSettings };
  }, [isVisible, activeChatId, onMessage, onIncomingCall, runtimeSettings]);

  useEffect(() => {
    if (!requestedChat) return;
    setChats(readStoredValue(CHATS_STORAGE_KEY, [], isChatList));
    setActiveChatId(requestedChat.id);
  }, [requestedChat]);

  useEffect(() => {
    if (!isVisible) return;
    setChats(readStoredValue(CHATS_STORAGE_KEY, [], isChatList));
    setContacts(readStoredValue(CONTACTS_STORAGE_KEY, [], isContactList));
    setCharacterNpcs(readCharacterNpcs());
    setPersonaCollection(readSetting(SETTINGS_KEYS.personas, DEFAULT_PERSONAS, isPersonaCollection));
  }, [isVisible]);

  useEffect(() => {
    const refreshBlockedInteractions = () => {
      setBlockedInteractions(readBlockedInteractions());
      setChats(readStoredValue(CHATS_STORAGE_KEY, [], isChatList));
    };
    refreshBlockedInteractions();
    window.addEventListener('yyphone:blocked-interactions', refreshBlockedInteractions);
    return () => window.removeEventListener('yyphone:blocked-interactions', refreshBlockedInteractions);
  }, []);

  useEffect(() => {
    const tick = () => {
      void scheduledTick.current().catch((error: unknown) => {
        console.error('Proactive message scheduling failed.', error);
        showYyError(error instanceof Error ? error.message : '主动消息调度失败。');
      });
    };
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsDraft, setChatSettingsDraft] = useState<ChatConversation | null>(null);
  const [tokenPreview, setTokenPreview] = useState<{ chatId: string; input: number } | null>(null);
  const [tokenPreviewBusy, setTokenPreviewBusy] = useState(false);
  const [tokenPreviewError, setTokenPreviewError] = useState('');
  const [chatMessageDraft, setChatMessageDraft] = useState('');
  const [activeChatMenuId, setActiveChatMenuId] = useState('');
  const [isProcessingChatImage, setIsProcessingChatImage] = useState(false);
  const chatImportRef = useRef<HTMLInputElement>(null);
  const [contextPresets, setContextPresets] = useState(() =>
    readSetting(SETTINGS_KEYS.chatContextPresets, [] as ChatContextPreset[], isChatContextPresetList)
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
    paymentSelection: 'balance',
  });
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState('');
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const [stickers, setStickers] = useState(() =>
    readStoredValue(CHAT_STICKERS_STORAGE_KEY, [] as ChatSticker[], isChatStickerList)
  );
  const [stickerDrafts, setStickerDrafts] = useState<ChatSticker[]>([]);
  const [extraStickerCategories, setExtraStickerCategories] = useState<string[]>(() =>
    readStoredValue(CHAT_STICKER_CATEGORIES_KEY, [] as string[], (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string'))
  );
  const [stickerCategory, setStickerCategory] = useState(DEFAULT_STICKER_CATEGORY);
  const [stickerManageOpen, setStickerManageOpen] = useState(false);
  const [stickerImportText, setStickerImportText] = useState('');
  const [stickerNewCategory, setStickerNewCategory] = useState('');
  const [stickerNotice, setStickerNotice] = useState('');
  const stickerUploadRef = useRef<HTMLInputElement>(null);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [reactionMenuId, setReactionMenuId] = useState('');
  const [voicePlaybackMessageId, setVoicePlaybackMessageId] = useState('');
  const [voiceLoadingMessageId, setVoiceLoadingMessageId] = useState('');
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceStopRef = useRef<(() => void) | null>(null);
  const voiceCacheRef = useRef(new Map<string, string>());
  const callVoiceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const callVoiceSessionRef = useRef(0);
  const callVoicePlayedRef = useRef(new Set<string>());
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);
  const HISTORY_PAGE_SIZE = 15;
  const [visibleMessageCount, setVisibleMessageCount] = useState(HISTORY_PAGE_SIZE);
  const [composerPage, setComposerPage] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardTargetIds, setForwardTargetIds] = useState<string[]>([]);
  const [patDialog, setPatDialog] = useState<{ targetId: string; suffix: string } | null>(null);
  const messagePressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressMessageClickRef = useRef(false);
  const lastAvatarTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const avatarTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveNameDraft, setArchiveNameDraft] = useState('');
  const [renamingArchive, setRenamingArchive] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setVisibleMessageCount(HISTORY_PAGE_SIZE);
    setSelectMode(false);
    setSelectedIds([]);
  }, [activeChatId, isVisible]);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const composerTouchStartX = useRef(0);
  const activeMessageCount = chats.find((chat) => chat.id === activeChatId)?.messages.length ?? 0;
  useEffect(() => {
    if (!activeChatId) return;
    const scrollToBottom = () => {
      const element = chatScrollRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    };
    scrollToBottom();
    // 图片/卡片等内容渲染后高度会变化，稍后再补一次。
    const timer = window.setTimeout(scrollToBottom, 120);
    return () => window.clearTimeout(timer);
  }, [activeChatId, activeMessageCount]);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [activeThought, setActiveThought] = useState<{ name: string; thought: string } | null>(null);
  const [forumCardPreview, setForumCardPreview] = useState<ChatMessage | null>(null);
  const [activePaymentId, setActivePaymentId] = useState('');

  useEffect(() => {
    const forumQueue = readStoredValue('yyphone:forum-forwards', [] as PendingShare[], isPendingShareQueue);
    const pomodoroQueue = readStoredValue('yyphone:pomodoro-shares', [] as PendingShare[], isPendingShareQueue);
    if (forumQueue.length === 0 && pomodoroQueue.length === 0) return;

    const nextChats = readStoredValue(CHATS_STORAGE_KEY, [] as ChatConversation[], isChatList);
    let didChangeChats = false;
    const consumeQueue = (queue: PendingShare[]) => {
      const remaining: PendingShare[] = [];
      queue.forEach((entry) => {
        if (!contacts.some((contact) => contact.id === entry.targetCharId)) {
          remaining.push(entry);
          return;
        }
        let chat = nextChats.find((item) =>
          item.type === 'direct' &&
          item.participantIds.length === 1 &&
          item.participantIds[0] === entry.targetCharId
        );
        if (!chat) {
          const timestamp = entry.message.createdAt;
          chat = {
            id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'direct',
            participantIds: [entry.targetCharId],
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
            attachedHistoryContactId: entry.targetCharId,
            attachedHistoryCount: 10,
            currentChatHistoryCount: 200,
            attachedHistoryCounts: {},
            replyMessageMin: 1,
            replyMessageMax: 6,
            includeLatestThought: false,
          };
          nextChats.unshift(chat);
        }
        if (!chat.messages.some((message) => message.id === entry.message.id)) {
          chat.messages.push(entry.message);
          chat.updatedAt = entry.message.createdAt;
          didChangeChats = true;
        }
      });
      return remaining;
    };

    const remainingForumQueue = consumeQueue(forumQueue);
    const remainingPomodoroQueue = consumeQueue(pomodoroQueue);
    if (didChangeChats) {
      writeStoredValue(CHATS_STORAGE_KEY, nextChats);
      setChats(nextChats);
    }
    if (remainingForumQueue.length !== forumQueue.length) {
      writeStoredValue('yyphone:forum-forwards', remainingForumQueue);
    }
    if (remainingPomodoroQueue.length !== pomodoroQueue.length) {
      writeStoredValue('yyphone:pomodoro-shares', remainingPomodoroQueue);
    }
  }, [activeChatId, isVisible]);

  useEffect(() => {
    try {
      writeCharacterNpcs(characterNpcs, contacts);
      const contactsWithNpcLinks = contacts.map((contact) => ({
        ...contact,
        linkedNpcIds: characterNpcs
          .filter((npc) => npc.linkedCharIds.includes(contact.id))
          .map((npc) => npc.id),
      }));
      if (JSON.stringify(contactsWithNpcLinks) !== JSON.stringify(contacts)) {
        writeStoredValue(CONTACTS_STORAGE_KEY, contactsWithNpcLinks);
        setContacts(contactsWithNpcLinks);
      }
    } catch (error) {
      console.error('Could not synchronize shared NPC storage.', error);
      setContactError('NPC 数据同步失败，请检查浏览器本地存储空间。');
    }
  }, [characterNpcs, contacts]);

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.dataset.yyphoneChatAppearance = 'true';
    try {
      styleElement.textContent = [
        '.yy-chat-surface .yy-chat-message-bubble:not(.is-special) { background-color: var(--yy-character-bubble-color); -webkit-backdrop-filter: blur(10px) saturate(1.3); backdrop-filter: blur(10px) saturate(1.3); border: 1px solid rgba(255,255,255,0.55); box-shadow: 0 2px 10px rgba(120,140,170,0.12); }',
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

  const savePersonaCollection = (updatedCollection: PersonaCollection) => {
    try {
      saveSetting(SETTINGS_KEYS.personas, updatedCollection);
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
      saveSetting(SETTINGS_KEYS.chatAppearance, nextAppearance);
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
      userBubbleOpacity: chatAppearance.userBubbleOpacity,
      characterBubbleOpacity: chatAppearance.characterBubbleOpacity,
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
      userBubbleOpacity: preset.userBubbleOpacity ?? DEFAULT_CHAT_APPEARANCE.userBubbleOpacity,
      characterBubbleOpacity: preset.characterBubbleOpacity ?? DEFAULT_CHAT_APPEARANCE.characterBubbleOpacity,
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
      const contactIds = new Set(nextContacts.map((contact) => contact.id));
      const nextNpcs = characterNpcs
        .map((npc) => ({
          ...npc,
          linkedCharIds: npc.linkedCharIds.filter((id) => contactIds.has(id)),
        }))
        .filter((npc) => npc.linkedCharIds.length > 0);
      const contactsWithNpcLinks = nextContacts.map((contact) => ({
        ...contact,
        linkedNpcIds: nextNpcs
          .filter((npc) => npc.linkedCharIds.includes(contact.id))
          .map((npc) => npc.id),
      }));
      writeCharacterNpcs(nextNpcs, contactsWithNpcLinks);
      setCharacterNpcs(nextNpcs);
      writeStoredValue(CONTACTS_STORAGE_KEY, contactsWithNpcLinks);
      setContacts(contactsWithNpcLinks);
      setContactError('');
      return true;
    } catch (error) {
      console.error('Could not save WeChat contacts.', error);
      setContactError('联系人保存失败，请检查浏览器本地存储空间后重试。');
      return false;
    }
  };

  const openContactEditor = (contact?: ContactPersona) => {
    setCharacterExportOpen(false);
    setContactWorldBooks(readContactWorldBooks());
    const draftId = contact?.id ?? `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setIsNewContactDraft(!contact);
    setContactDraft(contact ? { ...contact, worldBooks: [...contact.worldBooks] } : {
      id: draftId,
      avatarUrl: '',
      name: '',
      persona: '',
      worldBooks: [],
      group: '',
      starred: false,
      voiceEnabled: false,
      voiceId: '',
      voiceLanguage: '中文',
    });
    setNpcDraft({ id: '', name: '', avatarUrl: '', persona: '' });
    setSelectedSharedNpcIds([]);
    setNpcSectionOpen(false);
    setContactError('');
    setIsContactEditorOpen(true);
    setContactsMenuOpen(false);
  };

  const closeContactEditor = () => {
    if (isNewContactDraft) {
      const hasTemporaryLinks = characterNpcs.some((npc) => npc.linkedCharIds.includes(contactDraft.id));
      if (hasTemporaryLinks) {
        const updatedNpcs = characterNpcs
          .map((npc) => ({
            ...npc,
            linkedCharIds: npc.linkedCharIds.filter((id) => id !== contactDraft.id),
          }))
          .filter((npc) => npc.linkedCharIds.length > 0);
        persistCharacterNpcs(updatedNpcs);
      }
    }
    setIsContactEditorOpen(false);
    setIsNewContactDraft(false);
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

  const handleNpcAvatarUpload = async (file?: File) => {
    if (!file) return;
    setIsProcessingAvatar(true);
    setContactError('');
    try {
      const avatarUrl = await compressImageFile(file);
      setNpcDraft((draft) => ({ ...draft, avatarUrl }));
    } catch (error) {
      setContactError(error instanceof Error ? error.message : 'NPC 头像处理失败。');
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  const handleSaveContact = () => {
    if (!contactDraft.name.trim()) {
      setContactError('请填写角色姓名。');
      return;
    }
    let forumHandle: string;
    try {
      forumHandle = normalizeForumHandle(contactDraft.forumHandle ?? '');
    } catch (error) {
      setContactError(error instanceof Error ? error.message : '论坛 ID 无效。');
      return;
    }
    const contact: ContactPersona = {
      ...contactDraft,
      id: contactDraft.id || `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: contactDraft.name.trim(),
      forumNickname: contactDraft.forumNickname?.trim() ?? '',
      forumHandle,
      bio: contactDraft.bio?.trim() ?? '',
      persona: contactDraft.persona.trim(),
      group: contactDraft.group.trim() || '未分组',
    };
    const nextContacts = isNewContactDraft
      ? [...contacts, contact]
      : contacts.map((existing) => existing.id === contact.id ? contact : existing);
    if (persistContacts(nextContacts)) {
      setIsNewContactDraft(false);
      setIsContactEditorOpen(false);
      setContactError('');
    }
  };

  const persistCharacterNpcs = (nextNpcs: CharacterNpc[]) => {
    try {
      const knownContacts = [
        ...contacts.filter((contact) => contact.id !== contactDraft.id),
        ...(contactDraft.id && contactDraft.name.trim()
          ? [{ id: contactDraft.id, name: contactDraft.name.trim() }]
          : []),
      ];
      writeCharacterNpcs(nextNpcs, knownContacts);
      setCharacterNpcs(nextNpcs);
      const linkedContacts = contacts.map((contact) => ({
        ...contact,
        linkedNpcIds: nextNpcs
          .filter((npc) => npc.linkedCharIds.includes(contact.id))
          .map((npc) => npc.id),
      }));
      writeStoredValue(CONTACTS_STORAGE_KEY, linkedContacts);
      setContacts(linkedContacts);
      return true;
    } catch (error) {
      console.error('Could not save shared character NPCs.', error);
      setContactError('NPC 数据保存失败，请检查浏览器本地存储空间后重试。');
      return false;
    }
  };

  const saveNpcToCurrentCharacter = () => {
    if (!npcDraft.name.trim()) {
      setContactError('请填写 NPC 名称。');
      return;
    }
    const targetCharId = contactDraft.id;
    const existingNpc = npcDraft.id
      ? characterNpcs.find((npc) => npc.id === npcDraft.id)
      : undefined;
    const npc: CharacterNpc = {
      id: npcDraft.id || `npc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: npcDraft.name.trim(),
      avatarUrl: npcDraft.avatarUrl.trim(),
      persona: npcDraft.persona.trim(),
      linkedCharIds: [...new Set([...(existingNpc?.linkedCharIds ?? []), targetCharId])],
    };
    const nextNpcs = existingNpc
      ? characterNpcs.map((item) => item.id === npc.id ? npc : item)
      : [...characterNpcs, npc];
    if (persistCharacterNpcs(nextNpcs)) {
      setNpcDraft({ id: '', name: '', avatarUrl: '', persona: '' });
      setContactError('');
    }
  };

  const editNpc = (npc: CharacterNpc) => {
    setNpcDraft({ id: npc.id, name: npc.name, avatarUrl: npc.avatarUrl, persona: npc.persona });
  };

  const unbindNpcFromCurrentCharacter = (npc: CharacterNpc) => {
    const linkedCharIds = npc.linkedCharIds.filter((id) => id !== contactDraft.id);
    const nextNpcs = linkedCharIds.length
      ? characterNpcs.map((item) => item.id === npc.id ? { ...item, linkedCharIds } : item)
      : characterNpcs.filter((item) => item.id !== npc.id);
    persistCharacterNpcs(nextNpcs);
  };

  const deleteNpc = (npcId: string) => {
    if (!window.confirm('彻底删除这个 NPC？所有角色的依附关系都会解除。')) return;
    persistCharacterNpcs(characterNpcs.filter((npc) => npc.id !== npcId));
    setNpcDraft({ id: '', name: '', avatarUrl: '', persona: '' });
  };

  const toggleSharedNpc = (npcId: string) => {
    setSelectedSharedNpcIds((ids) =>
      ids.includes(npcId) ? ids.filter((id) => id !== npcId) : [...ids, npcId]
    );
  };

  const bindSelectedNpcs = () => {
    if (selectedSharedNpcIds.length === 0) return;
    const nextNpcs = characterNpcs.map((npc) =>
      selectedSharedNpcIds.includes(npc.id)
        ? { ...npc, linkedCharIds: [...new Set([...npc.linkedCharIds, contactDraft.id])] }
        : npc
    );
    if (persistCharacterNpcs(nextNpcs)) setSelectedSharedNpcIds([]);
  };

  const handleImportContacts = async (file?: File) => {
    if (!file) return;
    setImportError('');
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const bundledBooks = parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
        'worldBooks' in parsed ? parsePortableWorldBooks(parsed.worldBooks) : undefined;
      const importedBooks = bundledBooks ? remapImportedWorldBooks(bundledBooks) : undefined;
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
          forumNickname: typeof record.forumNickname === 'string' ? record.forumNickname.trim() : '',
          forumHandle: normalizeForumHandle(typeof record.forumHandle === 'string' ? record.forumHandle : ''),
          ...(Array.isArray(record.stickerCategories) && record.stickerCategories.every((item) => typeof item === 'string')
            ? { stickerCategories: record.stickerCategories } : {}),
          voiceEnabled: record.voiceEnabled === true,
          voiceId: typeof record.voiceId === 'string' ? record.voiceId : '',
          voiceLanguage: typeof record.voiceLanguage === 'string' ? record.voiceLanguage : '中文',
          persona:
            typeof record.persona === 'string'
              ? record.persona
              : typeof record.description === 'string'
                ? record.description
                : '',
          worldBooks: importedBooks ? importedBooks.links(links) : links,
          bio: typeof record.bio === 'string' ? record.bio : '',
          group: typeof record.group === 'string' && record.group.trim() ? record.group.trim() : '未分组',
          starred: record.starred === true,
        };
      });
      if (importedContacts.length === 0) throw new Error('没有可导入的角色。');
      const previousBooks = readStorageString('yyphone:world-books');
      if (importedBooks) {
        const existingBooks = parsePortableWorldBooks(JSON.parse(previousBooks ?? '[]'));
        writeStoredValue('yyphone:world-books', [...existingBooks, ...importedBooks.books]);
      }
      if (persistContacts([...contacts, ...importedContacts])) {
        setImportError('');
        setContactsMenuOpen(false);
      } else if (importedBooks) {
        writeStorageString('yyphone:world-books', previousBooks ?? '[]');
      }
    } catch (error) {
      console.error('Could not import WeChat contacts.', error);
      setImportError(error instanceof Error ? error.message : '导入角色失败。');
    }
  };

  const exportCharacter = () => {
    try {
      if (!contactDraft.name.trim()) throw new Error('请先填写角色姓名。');
      const books = parsePortableWorldBooks(JSON.parse(readStorageString('yyphone:world-books') ?? '[]'));
      const payload = buildCharacterExport(contactDraft, exportWorldBookIds, books);
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${contactDraft.name.trim().replace(/[<>:"/\\|?*]/g, '_')}-character.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setCharacterExportOpen(false);
    } catch (error) {
      console.error('Could not export character.', error);
      setContactError(error instanceof Error ? error.message : '角色导出失败，请重试。');
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

  const clearContactPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  };

  const deleteContact = (contactId: string) => {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact || !window.confirm(`删除角色「${contact.name}」？`)) return;
    if (persistContacts(contacts.filter((item) => item.id !== contactId))) closeContactEditor();
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
    getNpcByParticipantId(characterNpcs, contactId)?.name ??
    contacts.find((contact) => contact.id === contactId)?.name ??
    (contactId.startsWith('npc:') ? '已删除的 NPC' : '已删除的角色');

  const participantAvatar = (participantId: string) =>
    getNpcByParticipantId(characterNpcs, participantId)?.avatarUrl ??
    contacts.find((contact) => contact.id === participantId)?.avatarUrl ??
    '';

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
      return chat.avatars[chat.participantIds[0]] || participantAvatar(chat.participantIds[0] ?? '');
    }
    return chat.avatars.group ?? '';
  };

  const getChatParticipantName = (chat: ChatConversation, participantId: string) => {
    const nickname = chat.groupNicknames?.[participantId]?.trim();
    if (nickname) return nickname;
    const npc = getNpcByParticipantId(characterNpcs, participantId);
    return participantId === 'user'
      ? personaDraft.name.trim() || '我'
      : nickname || (npc ? `${npc.name}（NPC）` : contactName(participantId));
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
      setChatError(chatCreateMode === 'direct' ? '请选择一位角色。' : '请选择至少两位角色或 NPC。');
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
      currentChatHistoryCount: 200,
      attachedHistoryCounts: {},
      replyMessageMin: chatCreateMode === 'direct'
        ? 1
        : selectedParticipantIds.length + (chatCreateMode === 'group' ? 1 : 0),
      replyMessageMax: chatCreateMode === 'direct'
        ? 6
        : (selectedParticipantIds.length + (chatCreateMode === 'group' ? 1 : 0)) * 2,
      includeLatestThought: false,
    };
    if (persistChats([newChat, ...chats])) {
      setActiveChatId(newChat.id);
      setChatCreateMode(null);
      setSelectedParticipantIds([]);
      setChatError('');
    }
  };

  const updateChat = (chatId: string, update: (chat: ChatConversation) => ChatConversation) => {
    const latestChats = readStoredValue(CHATS_STORAGE_KEY, chats, isChatList);
    const nextChats = latestChats.map((chat) => (chat.id === chatId
      ? update({ ...chat, messages: preserveRoundThoughts(chat.messages) }) : chat));
    return persistChats(nextChats);
  };

  const settlePayment = (action: 'received' | 'returned') => {
    try {
      const latest = readStoredValue(CHATS_STORAGE_KEY, chats, isChatList);
      const chat = latest.find((item) => item.id === activeChatId);
      const payment = chat?.messages.find((item) => item.id === activePaymentId);
      if (!chat || !payment) throw new Error('找不到这笔款项，请重新打开聊天。');
      const before = readAlipayData();
      const next = settleIncomingChatPayment(before, payment, action);
      writeAlipayData(next);
      const now = new Date().toISOString();
      if (!updateChat(chat.id, (current) => ({
        ...current,
        updatedAt: now,
        messages: current.messages.map((item) => item.id === payment.id ? { ...item, paymentStatus: action } : item),
      }))) {
        writeAlipayData(before);
        throw new Error('收款状态保存失败，余额已还原，请重试。');
      }
      setActivePaymentId('');
    } catch (error) {
      console.error('Could not settle chat payment.', error);
      setChatError(error instanceof Error ? error.message : '收款处理失败。');
    }
  };

  const getChatArchives = (chat: ChatConversation): { archives: ChatArchive[]; activeId: string } => {
    if (chat.archives?.length && chat.activeArchiveId) {
      return { archives: chat.archives, activeId: chat.activeArchiveId };
    }
    return {
      archives: [{ id: 'archive-default', name: '存档 1', messages: [], updatedAt: chat.updatedAt }],
      activeId: 'archive-default',
    };
  };

  // 当前存档的消息始终存放在 chat.messages，切换时再回写到对应存档槽位。
  const switchChatArchive = (chat: ChatConversation, targetId: string, createName?: string) => {
    prepareMemoryArchiveSwitch();
    const { archives, activeId } = getChatArchives(chat);
    const now = new Date().toISOString();
    let nextArchives = archives.map((item) => (item.id === activeId ? { ...item, messages: chat.messages, updatedAt: now } : item));
    let nextMessages: ChatMessage[];
    let nextActiveId = targetId;
    if (createName !== undefined) {
      nextActiveId = `archive-${Date.now()}`;
      nextArchives = [...nextArchives, { id: nextActiveId, name: createName.trim() || `存档 ${nextArchives.length + 1}`, messages: [], updatedAt: now }];
      nextMessages = [];
    } else {
      const target = nextArchives.find((item) => item.id === targetId);
      if (!target) return;
      nextMessages = target.messages;
    }
    const saved = updateChat(chat.id, (item) => ({
      ...item,
      archives: nextArchives,
      activeArchiveId: nextActiveId,
      messages: nextMessages,
      updatedAt: now,
    }));
    if (saved) {
      if (chat.type === 'direct' && chat.participantIds.length === 1) invalidateMemoryArchive(chat.participantIds[0]);
      if (chat.type !== 'direct') invalidateGroupJournal(chat.id);
      setVisibleMessageCount(HISTORY_PAGE_SIZE);
      setSelectedMessageId('');
      setArchiveNameDraft('');
    }
  };

  const renameChatArchive = (chat: ChatConversation, archiveId: string, name: string) => {
    const { archives, activeId } = getChatArchives(chat);
    const trimmed = name.trim();
    if (!trimmed) return;
    updateChat(chat.id, (item) => ({
      ...item,
      archives: archives.map((a) => (a.id === archiveId ? { ...a, name: trimmed } : a)),
      activeArchiveId: activeId,
    }));
    setRenamingArchive(null);
  };

  const deleteChatArchive = (chat: ChatConversation, archiveId: string) => {
    const { archives, activeId } = getChatArchives(chat);
    if (archiveId === activeId || archives.length <= 1) return;
    if (!window.confirm('删除这个存档？其中的聊天记录、角色长期记忆、流水账和成长笔记将一并删除，无法恢复。')) return;
    prepareMemoryArchiveSwitch();
    const saved = updateChat(chat.id, (item) => ({
      ...item,
      archives: archives.filter((a) => a.id !== archiveId),
      activeArchiveId: activeId,
    }));
    if (saved && chat.type === 'direct' && chat.participantIds.length === 1) deleteMemoryArchive(chat.participantIds[0], archiveId);
    if (saved && chat.type !== 'direct') deleteGroupJournal(chat.id, archiveId);
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
    if (!window.confirm(`删除与「${getChatTitle(chat)}」的对话？全部聊天存档，以及角色私聊对应的记忆、流水账和成长笔记也会删除。`)) return;
    prepareMemoryArchiveSwitch();
    if (persistChats(chats.filter((item) => item.id !== chat.id))) {
      if (chat.type === 'direct' && chat.participantIds.length === 1) deleteCharacterMemoryArchives(chat.participantIds[0]);
      if (chat.type !== 'direct') deleteGroupJournal(chat.id);
      setActiveChatMenuId('');
    }
  };

  const openChatSettings = (chat: ChatConversation) => {
    const range = getReplyMessageRange(chat);
    setChatSettingsDraft({
      ...chat,
      avatars: { ...chat.avatars },
      currentChatHistoryCount: chat.currentChatHistoryCount ?? 200,
      attachedHistoryCounts: { ...(chat.attachedHistoryCounts ?? {}) },
      replyMessageMin: range.min,
      replyMessageMax: range.max,
      includeLatestThought: chat.includeLatestThought ?? false,
      timeAwarenessEnabled: chat.timeAwarenessEnabled ?? true,
      timeZone: chat.timeZone ?? '',
      imageGenerationEnabled: chat.imageGenerationEnabled ?? false,
      imageGenerationPrompt: chat.imageGenerationPrompt ?? '',
      blockedDelayMinutes: chat.blockedDelayMinutes ?? 60,
      blockedTiming: chat.blockedTiming ?? 'after',
      blockedActivity: chat.blockedActivity ?? 'both',
    });
    setChatSettingsOpen(true);
  };

  const saveChatSettings = () => {
    if (!chatSettingsDraft) return;
    if (chatSettingsDraft.proactiveEnabled &&
      (!Number.isInteger(chatSettingsDraft.proactiveIntervalMinutes) ||
        (chatSettingsDraft.proactiveIntervalMinutes ?? 0) < 1 ||
        (chatSettingsDraft.proactiveIntervalMinutes ?? 0) > 1440)) {
      setChatError('主动消息间隔请输入 1 到 1440 分钟之间的整数。');
      return;
    }
    if (chatSettingsDraft.type === 'direct' &&
      (!Number.isInteger(chatSettingsDraft.blockedDelayMinutes) ||
        (chatSettingsDraft.blockedDelayMinutes ?? 0) < 1 ||
        (chatSettingsDraft.blockedDelayMinutes ?? 0) > 10080)) {
      setChatError('拉黑后联系间隔请输入 1 到 10080 分钟之间的整数。');
      return;
    }
    if (chatSettingsDraft.type !== 'direct' && chatSettingsDraft.participantIds.length < 2) {
      setChatError('群聊至少需要两位角色或 NPC。');
      return;
    }
    if (chatSettingsDraft.timeZone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: chatSettingsDraft.timeZone });
      } catch {
        setChatError('时区无效，请从列表中重新选择。');
        return;
      }
    }
    const attachedHistoryChatIds = getAttachedHistoryChatIds(chatSettingsDraft);
    const messageRange = getReplyMessageRange(chatSettingsDraft);
    if (!Number.isInteger(chatSettingsDraft.currentChatHistoryCount) ||
      (chatSettingsDraft.currentChatHistoryCount ?? 0) < 1 ||
      (chatSettingsDraft.currentChatHistoryCount ?? 0) > 5000
    ) {
      setChatError('本对话聊天记录挂载条数请输入 1 到 5000 之间的整数。');
      return;
    }
    if (messageRange.min < 1 || messageRange.max < messageRange.min || messageRange.max > 100) {
      setChatError('角色消息数范围请设置为 1 到 100，且最小条数不能大于最大条数。');
      return;
    }
    if (attachedHistoryChatIds.some((id) => {
      const count = getAttachedHistoryCount(chatSettingsDraft, id);
      return !Number.isInteger(count) || count < 1 || count > 1000;
    })) {
      setChatError('其他聊天记录的挂载条数请输入 1 到 1000 之间的整数。');
      return;
    }
    const savedDraft = {
      ...chatSettingsDraft,
      attachedHistoryChatIds,
      attachedHistoryCounts: Object.fromEntries(
        attachedHistoryChatIds.map((id) => [id, getAttachedHistoryCount(chatSettingsDraft, id)])
      ),
      attachHistory: chatSettingsDraft.attachHistory && attachedHistoryChatIds.length > 0,
    };
    if (updateChat(savedDraft.id, (current) => {
      const blockedChanged = current.blocked !== savedDraft.blocked;
      const timingChanged = current.blockedDelayMinutes !== savedDraft.blockedDelayMinutes ||
        current.blockedTiming !== savedDraft.blockedTiming;
      const delay = savedDraft.blockedDelayMinutes ?? 60;
      const timing = savedDraft.blockedTiming ?? 'after';
      const delayMs = delay * 60_000;
      const blockedNextAt = !savedDraft.blocked
        ? undefined
        : blockedChanged || timingChanged
          ? new Date(Date.now() + (timing === 'within' ? Math.max(60_000, Math.floor(Math.random() * delayMs)) : delayMs)).toISOString()
          : current.blockedNextAt;
      return {
        ...savedDraft,
        blockedSince: savedDraft.blocked
          ? blockedChanged ? new Date().toISOString() : current.blockedSince
          : current.blockedSince,
        blockedNextAt,
        blockedActivityCount: blockedChanged && savedDraft.blocked ? 0 : current.blockedActivityCount,
        blockedBacklogGeneratedAt: blockedChanged && !savedDraft.blocked ? undefined : current.blockedBacklogGeneratedAt,
        messages: current.messages,
        archives: current.archives,
        activeArchiveId: current.activeArchiveId,
        updatedAt: current.updatedAt,
        lastProactiveAt: current.proactiveEnabled === savedDraft.proactiveEnabled &&
          current.proactiveIntervalMinutes === savedDraft.proactiveIntervalMinutes
          ? current.lastProactiveAt : new Date().toISOString(),
      };
    })) {
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
      ...(replyingTo ? { replyTo: makeReplyRef(chat, replyingTo) } : {}),
    };
    if (
      updateChat(chat.id, (current) => ({
        ...current,
        messages: [...current.messages, message],
        updatedAt: message.createdAt,
      }))
    ) {
      setChatMessageDraft('');
      setReplyingTo(null);
    }
  };

  const makeReplyRef = (chat: ChatConversation, target: ChatMessage) => ({
    id: target.id,
    senderName: target.senderId === 'user' ? (personaDraft.name.trim() || '我') : getChatParticipantName(chat, target.senderId),
    text: describeMessageBrief(target).slice(0, 60),
  });

  // 同一人对同一条消息只保留一个表情，再点同一个表情则取消（参考 iMessage）
  const toggleReaction = (messageId: string, emoji: string) => {
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat) return;
    updateChat(chat.id, (current) => ({
      ...current,
      messages: current.messages.map((item) => {
        if (item.id !== messageId) return item;
        const others = (item.reactions ?? []).filter((reaction) => reaction.by !== 'user');
        const mine = (item.reactions ?? []).find((reaction) => reaction.by === 'user');
        return { ...item, reactions: mine?.emoji === emoji ? others : [...others, { by: 'user', emoji }] };
      }),
    }));
    setReactionMenuId('');
  };

  const sendPat = (targetId: string, suffix = '') => {
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat || chat.type === 'observer' || chat.blocked) return;
    const targetName = targetId === 'user' ? '自己' : `“${getChatParticipantName(chat, targetId)}”`;
    const message: ChatMessage = {
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: 'user',
      kind: 'pat',
      text: `我拍了拍${targetName}${suffix.trim()}`,
      createdAt: new Date().toISOString(),
    };
    updateChat(chat.id, (current) => ({
      ...current,
      messages: [...current.messages, message],
      updatedAt: message.createdAt,
    }));
  };

  // 双击头像拍一拍；单击角色头像仍查看心声（延迟判断以区分单双击）。
  const handleAvatarTap = (targetId: string, onSingleTap?: () => void) => {
    const now = Date.now();
    const last = lastAvatarTapRef.current;
    if (avatarTapTimerRef.current) clearTimeout(avatarTapTimerRef.current);
    if (last.id === targetId && now - last.time < 320) {
      lastAvatarTapRef.current = { id: '', time: 0 };
      if (activeChat?.type !== 'observer') setPatDialog({ targetId, suffix: '' });
      return;
    }
    lastAvatarTapRef.current = { id: targetId, time: now };
    if (onSingleTap) avatarTapTimerRef.current = setTimeout(onSingleTap, 330);
  };

  const describeMessageBrief = (message: ChatMessage) => {
    switch (message.kind) {
      case 'image': return '[图片]';
      case 'sticker': return `[表情]${message.text}`;
      case 'voice': return `[语音]${message.text}`;
      case 'red-packet': return `[红包]¥${message.amount ?? ''}`;
      case 'transfer': return `[转账]¥${message.amount ?? ''}`;
      case 'location': return `[位置]${message.text}`;
      case 'video-call': return `[通话]${message.text}`;
      case 'order': return `[订单]${message.title ?? message.text}`;
      case 'couple-invite': return '[情侣空间邀请]';
      case 'phone-share': return '[手机内容转发]';
      case 'context-note': return `[记忆]${message.title ?? ''}`;
      case 'link': case 'forum-forward': case 'pomodoro-share': return `[链接]${message.title ?? message.text}`;
      default: return message.text;
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
    setForwardOpen(false);
    setForwardTargetIds([]);
  };

  const toggleSelectedMessage = (messageId: string) =>
    setSelectedIds((ids) => (ids.includes(messageId) ? ids.filter((id) => id !== messageId) : [...ids, messageId]));

  const openMessageMenu = (messageId: string) => {
    suppressMessageClickRef.current = true;
    setReactionMenuId(messageId);
    setSelectedMessageId('');
  };

  const copyChatMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setReactionMenuId('');
    } catch (error) {
      console.error('Could not copy chat message.', error);
      setChatError('复制失败，请检查浏览器剪贴板权限。');
    }
  };

  const getVoiceSpeaker = (message: ChatMessage) => {
    if (message.senderId === 'user' || message.senderId === 'narrator') return undefined;
    const speaker = contacts.find((item) => item.id === message.senderId);
    return speaker?.voiceEnabled && speaker.voiceId?.trim() ? speaker : undefined;
  };

  const stopCharacterVoice = () => {
    voiceStopRef.current?.();
    voiceStopRef.current = null;
  };

  // Resolves when playback ends, is stopped, or fails, so call lines can be queued one after another.
  const playCharacterVoice = async (message: ChatMessage, speaker: ContactPersona) => {
    // Video-call lines start with bracketed action descriptions that should not be spoken.
    const speech = message.text.replace(/[（(][^（）()]*[）)]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!speech) return;
    stopCharacterVoice();
    let cancelled = false;
    let finish: () => void = () => undefined;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    voiceStopRef.current = () => {
      cancelled = true;
      voiceAudioRef.current?.pause();
      voiceAudioRef.current = null;
      setVoicePlaybackMessageId('');
      setVoiceLoadingMessageId('');
      finish();
    };
    const stopSelf = voiceStopRef.current;
    setChatError('');
    try {
      let objectUrl = voiceCacheRef.current.get(message.id);
      if (!objectUrl) {
        setVoiceLoadingMessageId(message.id);
        const audioBlob = await synthesizeVoice(speech, speaker.voiceId ?? '', speaker.voiceLanguage?.trim() || '中文');
        objectUrl = URL.createObjectURL(audioBlob);
        voiceCacheRef.current.set(message.id, objectUrl);
      }
      if (cancelled) return;
      setVoiceLoadingMessageId('');
      const audio = new Audio(objectUrl);
      voiceAudioRef.current = audio;
      audio.onended = () => {
        if (voiceStopRef.current === stopSelf) voiceStopRef.current = null;
        if (voiceAudioRef.current === audio) voiceAudioRef.current = null;
        setVoicePlaybackMessageId('');
        finish();
      };
      setVoicePlaybackMessageId(message.id);
      await audio.play();
    } catch (error) {
      if (!cancelled) {
        console.error('Could not play character voice.', error);
        setChatError(error instanceof Error ? error.message : '语音播放失败，请检查语音模型配置和网络。');
        stopSelf();
      }
    }
    return done;
  };

  const toggleCharacterVoice = (message: ChatMessage) => {
    const speaker = getVoiceSpeaker(message);
    if (!speaker) return false;
    if (voicePlaybackMessageId === message.id || voiceLoadingMessageId === message.id) {
      stopCharacterVoice();
    } else {
      void playCharacterVoice(message, speaker);
    }
    return true;
  };

  const messagePress = (messageId: string) => ({
    onTouchStart: () => {
      if (messagePressTimerRef.current) clearTimeout(messagePressTimerRef.current);
      suppressMessageClickRef.current = false;
      messagePressTimerRef.current = setTimeout(() => openMessageMenu(messageId), 550);
    },
    onTouchEnd: () => { if (messagePressTimerRef.current) clearTimeout(messagePressTimerRef.current); },
    onTouchMove: () => { if (messagePressTimerRef.current) clearTimeout(messagePressTimerRef.current); },
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault();
      openMessageMenu(messageId);
    },
  });

  const handleMessageTap = (messageId: string) => {
    if (suppressMessageClickRef.current) {
      suppressMessageClickRef.current = false;
      return;
    }
    if (selectMode) {
      toggleSelectedMessage(messageId);
      return;
    }
    setSelectedMessageId(selectedMessageId === messageId ? '' : messageId);
  };

  useEffect(() => () => {
    voiceStopRef.current?.();
    callVoiceSessionRef.current += 1;
    voiceCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    voiceCacheRef.current.clear();
  }, []);

  const deleteSelectedMessages = () => {
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat || selectedIds.length === 0) return;
    if (!window.confirm(`删除选中的 ${selectedIds.length} 条消息？`)) return;
    if (updateChat(chat.id, (current) => ({
      ...current,
      messages: current.messages.filter((item) => !selectedIds.includes(item.id)),
    }))) exitSelectMode();
  };

  const forwardSelectedMessages = () => {
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat || selectedIds.length === 0 || forwardTargetIds.length === 0) return;
    const picked = chat.messages.filter((item) => selectedIds.includes(item.id));
    const now = new Date().toISOString();
    const newId = () => `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const speakerName = (message: ChatMessage) =>
      message.senderId === 'user' ? (personaDraft.name.trim() || '我') : getChatParticipantName(chat, message.senderId);
    const buildForward = (): ChatMessage => {
      if (picked.length === 1 && picked[0].senderId !== 'narrator') {
        const { thought: _thought, replyBatchId: _batch, ...rest } = picked[0];
        return { ...rest, id: newId(), senderId: 'user', createdAt: now };
      }
      return {
        id: newId(),
        senderId: 'user',
        kind: 'link',
        text: '聊天记录',
        title: `${getChatTitle(chat)}的聊天记录`,
        content: picked.map((item) => `${speakerName(item)}：${describeMessageBrief(item)}`).join('\n'),
        source: '转发的聊天记录',
        createdAt: now,
      };
    };
    let allSaved = true;
    forwardTargetIds.forEach((targetId) => {
      const message = buildForward();
      if (!updateChat(targetId, (current) => ({
        ...current,
        messages: [...current.messages, message],
        updatedAt: now,
      }))) allSaved = false;
    });
    if (allSaved) exitSelectMode();
  };

  const deleteChatMessage = (messageId: string) => {
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat || !window.confirm('删除这条消息？')) return;
    if (updateChat(chat.id, (current) => ({
      ...current,
      messages: current.messages.filter((item) => item.id !== messageId),
    }))) setSelectedMessageId('');
  };

  const saveEditedMessage = () => {
    const chat = chats.find((item) => item.id === activeChatId);
    const text = editingMessage?.text.trim();
    if (!chat || !editingMessage || !text) return;
    if (updateChat(chat.id, (current) => ({
      ...current,
      messages: current.messages.map((item) => (item.id === editingMessage.id ? { ...item, text } : item)),
    }))) {
      setEditingMessage(null);
      setSelectedMessageId('');
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
      saveSetting(SETTINGS_KEYS.chatContextPresets, nextPresets);
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
      saveSetting(SETTINGS_KEYS.chatContextPresets, nextPresets);
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
      paymentSelection: 'balance',
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
      const imageUrl = await compressChatPhoto(file);
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
    if (
      (attachmentMode === 'transfer' || attachmentMode === 'red-packet') &&
      (!activeChat || activeChat.type === 'observer' || activeChat.blocked)
    ) {
      setChatError('当前会话不可发送红包或转账。');
      return;
    }
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
      let intimatePayerId: string | undefined;
      {
        const source = attachmentDraft.paymentSelection === 'balance'
          ? { type: 'balance' as const }
          : {
              type: 'intimate' as const,
              charId: attachmentDraft.paymentSelection.slice('intimate:'.length),
            };
        try {
          const payment = chargeAlipay(
            Number(attachmentDraft.amount),
            `微信${attachmentMode === 'red-packet' ? '红包' : `转账${attachmentDraft.recipientId ? `给${contactName(attachmentDraft.recipientId)}` : ''}`}`,
            source,
            { notifyIntimatePayer: false, recordLedger: false }
          );
          intimatePayerId = payment.payer?.charId;
        } catch (error) {
          setChatError(error instanceof Error ? error.message : '支付宝扣款失败。');
          return;
        }
      }
      saved = saveAttachmentMessage(
        attachmentMode,
        attachmentDraft.text.trim() || (attachmentMode === 'red-packet' ? '恭喜发财，大吉大利' : '转账'),
        {
          amount: attachmentDraft.amount.trim(),
          ...(attachmentMode === 'red-packet' && activeChat?.type === 'group'
            ? { quantity: Number(attachmentDraft.quantity) }
            : {}),
          ...(attachmentMode === 'transfer'
            ? {
                recipientId: attachmentDraft.recipientId || activeChat?.participantIds[0],
                ...(intimatePayerId ? { payerId: intimatePayerId } : {}),
              }
            : {}),
        }
      );
      if (saved && intimatePayerId) {
        try {
          sendIntimatePayInteraction(
            intimatePayerId,
            `微信${attachmentMode === 'red-packet' ? '红包' : `转账${attachmentDraft.recipientId ? `给${contactName(attachmentDraft.recipientId)}` : ''}`}`,
            Number(attachmentDraft.amount)
          );
          setChats(readStoredValue(CHATS_STORAGE_KEY, [] as ChatConversation[], isChatList));
        } catch (error) {
          setChatError(error instanceof Error ? `支付和转账已完成，但亲密付互动消息发送失败：${error.message}` : '支付已完成，但互动消息发送失败。');
        }
      }
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
      setAttachmentDraft({ imageUrl: '', text: '', title: '', source: '', content: '', amount: '', quantity: '1', recipientId: '', paymentSelection: 'balance' });
      setChatError('');
    }
  };

  const handleRegenerate = () => {
    setComposerOpen(false);
    void generateAiReply(true);
  };

  const startCall = (mode: 'voice' | 'video') => {
    setIncomingCallMessageId('');
    setActiveCallMode(mode);
    setCallStartedAt(new Date().toISOString());
    setCallConnectedAt(null);
    setCallChoiceOpen(false);
    setComposerOpen(false);
    setChatError('');
  };

  const endCall = () => {
    const mode = activeCallMode;
    // 接通过的通话在聊天里留一条通话记录（和微信一样）；还没接通就挂断则记为已取消
    if (mode && incomingCallMessageId) {
      const total = callConnectedAt ? Math.max(1, Math.round((Date.now() - callConnectedAt) / 1000)) : 0;
      const duration = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      updateChat(activeChatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((message) => message.id === incomingCallMessageId
          ? { ...message, callStatus: callConnectedAt ? 'ended' : 'declined', text: callConnectedAt ? `视频通话 · 通话时长 ${duration}` : '视频通话 · 已拒绝' }
          : message),
      }));
    } else if (mode) {
      const label = mode === 'video' ? '视频通话' : '语音通话';
      if (callConnectedAt) {
        const total = Math.max(1, Math.round((Date.now() - callConnectedAt) / 1000));
        const clock = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        saveAttachmentMessage('video-call', `${label} · 通话时长 ${clock}`);
      } else {
        saveAttachmentMessage('video-call', `${label} · 已取消`);
      }
    }
    setActiveCallMode(null);
    setIncomingCallMessageId('');
    setCallConnectedAt(null);
    setChatError('');
    callVoiceSessionRef.current += 1;
    callVoiceQueueRef.current = Promise.resolve();
    stopCharacterVoice();
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
    const nextStickers = [...stickers, { ...sticker, description: sticker.description.trim(), category: stickerCategory }];
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

  const allStickers = [...BUILTIN_STICKERS, ...stickers];

  const stickerCategories = Array.from(new Set([
    DEFAULT_STICKER_CATEGORY,
    ...extraStickerCategories,
    ...allStickers.map((item) => item.category || DEFAULT_STICKER_CATEGORY),
  ]));
  const stickersInCategory = allStickers.filter((item) => (item.category || DEFAULT_STICKER_CATEGORY) === stickerCategory);

  const persistStickers = (next: ChatSticker[]) => {
    try {
      writeStoredValue(CHAT_STICKERS_STORAGE_KEY, next);
      setStickers(next);
      return true;
    } catch (error) {
      console.error('Could not save chat stickers.', error);
      setChatError('表情包保存失败，本地存储空间可能不足。');
      return false;
    }
  };

  const importStickerLines = () => {
    const added: ChatSticker[] = [];
    let skipped = 0;
    stickerImportText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      const match = line.match(/^(.+?)\s*[:：]\s*((?:https?:\/\/|data:)\S+)$/);
      if (!match) { skipped += 1; return; }
      const name = match[1].trim();
      const url = match[2].trim();
      const exists = [...stickers, ...added].some((item) =>
        item.imageUrl === url && item.description === name && (item.category || DEFAULT_STICKER_CATEGORY) === stickerCategory);
      if (exists) { skipped += 1; return; }
      added.push({
        id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        imageUrl: url,
        description: name,
        category: stickerCategory,
      });
    });
    if (added.length && persistStickers([...stickers, ...added])) setStickerImportText('');
    setStickerNotice(`导入 ${added.length} 个${skipped ? `，跳过 ${skipped} 行（格式不对或重复）` : ''}`);
  };

  const exportStickerCategory = async () => {
    const text = stickersInCategory
      .filter((item) => !item.imageUrl.startsWith('blob:'))
      .map((item) => `${item.description}: ${item.imageUrl}`)
      .join('\n');
    setStickerImportText(text);
    try {
      await navigator.clipboard.writeText(text);
      setStickerNotice(`已导出「${stickerCategory}」${stickersInCategory.length} 个并复制到剪贴板`);
    } catch {
      setStickerNotice('已导出到下方文本框，请手动复制');
    }
  };

  const addStickerCategory = () => {
    const name = stickerNewCategory.trim().slice(0, 12);
    if (!name || stickerCategories.includes(name)) return;
    const next = [...extraStickerCategories, name];
    writeStoredValue(CHAT_STICKER_CATEGORIES_KEY, next);
    setExtraStickerCategories(next);
    setStickerCategory(name);
    setStickerNewCategory('');
  };

  const deleteStickerCategory = () => {
    if (stickerCategory === DEFAULT_STICKER_CATEGORY) return;
    if (!window.confirm(`删除分类「${stickerCategory}」及其中 ${stickersInCategory.length} 个表情包？`)) return;
    const next = extraStickerCategories.filter((name) => name !== stickerCategory);
    writeStoredValue(CHAT_STICKER_CATEGORIES_KEY, next);
    setExtraStickerCategories(next);
    persistStickers(stickers.filter((item) => (item.category || DEFAULT_STICKER_CATEGORY) !== stickerCategory));
    setStickerCategory(DEFAULT_STICKER_CATEGORY);
  };

  const generateAiReply = async (regenerate = false, targetChatId = activeChatId, proactive = false, previewOnly = false) => {
    const latestChats = readStoredValue(CHATS_STORAGE_KEY, chats, isChatList);
    const chat = latestChats.find((item) => item.id === targetChatId);
    if (!chat || (!previewOnly && chat.blocked) || generationRunning.current || tokenPreviewBusy) return;
    const latestContacts = readStoredValue(CONTACTS_STORAGE_KEY, contacts, isContactList);

    const apiPresets = readSetting(SETTINGS_KEYS.apiPresets, [] as ApiPreset[], isApiPresetList);
    const activePresetId = readSetting(
      SETTINGS_KEYS.activeApiPreset,
      apiPresets[0]?.id ?? '',
      (value): value is string => typeof value === 'string'
    );
    const apiPreset =
      apiPresets.find((preset) => preset.id === activePresetId) ??
      apiPresets.find((preset) => preset.endpoint.trim() && preset.apiKey.trim());
    if (!previewOnly && (!apiPreset?.endpoint.trim() || !apiPreset.apiKey.trim())) {
      setChatError('请先在设置页保存包含端点和 API Key 的 API 配置预设。');
      return;
    }

    const chatContacts = chat.participantIds
      .map((participantId) => latestContacts.find((item) => item.id === participantId))
      .filter((contact): contact is ContactPersona => !!contact);
    const chatNpcs = chat.participantIds
      .map((participantId) => getNpcByParticipantId(characterNpcs, participantId))
      .filter((npc): npc is CharacterNpc => !!npc);
    const chatMembers: Array<ContactPersona | (CharacterNpc & { group: string; starred: boolean; worldBooks: ContactWorldBookLink[] })> = [
      ...chatContacts,
      ...chatNpcs.map((npc) => ({ ...npc, id: npcParticipantId(npc.id), group: '关联 NPC', starred: false, worldBooks: [] })),
    ];
    const contact = chatMembers[0];
    if (!contact) {
      if (previewOnly) setTokenPreviewError('此对话关联的角色或 NPC 已不存在，请检查通讯录与 NPC 设置。');
      else setChatError('此对话关联的角色或 NPC 已不存在，请检查通讯录与 NPC 设置。');
      return;
    }

    generationRunning.current = true;
    if (previewOnly) {
      setTokenPreviewBusy(true);
      setTokenPreviewError('');
    } else {
      setIsGeneratingReply(true);
      setChatError('');
    }
    const previousReply = chat.messages.at(-1);
    const canReplace = !!previousReply && previousReply.senderId !== 'user' &&
      (previousReply.senderId !== 'narrator' || !!previousReply.replyBatchId);
    const replacedReplyBatchId = regenerate && canReplace ? previousReply?.replyBatchId : undefined;
    const replacedMessageId = regenerate && canReplace ? previousReply?.id : undefined;
    if (regenerate && previousReply && canReplace) {
      setHiddenMessageIds(
        replacedReplyBatchId
          ? chat.messages.filter((item) => item.replyBatchId === replacedReplyBatchId).map((item) => item.id)
          : [previousReply.id]
      );
    }
    try {
      const currentInput = proactive ? '' : [...chat.messages].reverse().find((message) => message.senderId === 'user')?.text ?? '';
      const replyRange = getReplyMessageRange(chat);
      const targetReplyCount = previewOnly ? replyRange.max : replyRange.min + Math.floor(
        Math.random() * (replyRange.max - replyRange.min + 1)
      );
      const momentsInjection: MomentsInjection = buildMomentsInjection(
        chat.participantIds,
        chat.type === 'observer',
        (id) => contacts.find((item) => item.id === id)?.name
      );
      const coupleCharId = chat.type === 'direct' && chat.participantIds.length === 1 && !chat.participantIds[0].startsWith('npc:')
        ? chat.participantIds[0]
        : '';
      const allowCharInvite = !!coupleCharId &&
        !regenerate &&
        chat.messages.filter((item) => item.senderId !== 'narrator').length >= 20 &&
        readPendingHighPriorityEvents([coupleCharId], 'couple').length === 0 &&
        !chat.messages.some(
          (item) => item.kind === 'couple-invite' && Date.now() - (Date.parse(item.createdAt) || 0) < 3 * 24 * 3600 * 1000
        );
      const coupleInjection: CoupleInjection = buildCoupleSpaceInjection(
        chat.participantIds,
        chat.type,
        (id) => contacts.find((item) => item.id === id)?.name,
        allowCharInvite
      );
      const plantInjection: PlantInjection = buildPlantInjection(
        chat.participantIds,
        chat.type,
        (id) => contacts.find((item) => item.id === id)?.name
      );
      const memoryQuery = chat.messages
        .filter((item) => item.senderId !== 'narrator' && item.kind !== 'pat' && item.text)
        .slice(-3)
        .map((item) => item.text)
        .join('\n')
        .slice(-400);
      const memoryInjection = await buildMemoryInjection(
        chat.participantIds.filter((id) => !id.startsWith('npc:')),
        chat.type,
        memoryQuery,
        (id) => contacts.find((item) => item.id === id)?.name,
        { localOnly: previewOnly }
      );
      const couplePendingCharId =
        chat.type === 'direct' && chat.participantIds.length === 1 &&
        readCoupleSpaces()[chat.participantIds[0]]?.bindStatus === 'pending_char'
          ? chat.participantIds[0]
          : '';
      const promptMessages = buildPrompt({
        chatId: chat.id,
        currentInput,
        historyLimit: chat.currentChatHistoryCount ?? 200,
        callMode: callConnectedAt ? activeCallMode ?? undefined : undefined,
        regenerate,
        structuredHistory: true,
        momentsInjection,
        coupleInjection,
        plantInjection,
        memoryInjection,
        timeAwarenessEnabled: chat.timeAwarenessEnabled !== false,
        timeZone: chat.timeZone || undefined,
        imageGenerationEnabled: chat.imageGenerationEnabled === true,
        imageGenerationPrompt: chat.imageGenerationPrompt,
      });
      const allowedStickers = allStickers.filter((sticker) =>
        chatMembers.some((member) => permittedSticker('stickerCategories' in member ? member.stickerCategories : undefined, sticker))
      );
      const socialContext: SocialContext = { chat, actors: chatContacts, regenerate, now: new Date() };
      const socialInstructions = buildSocialInstructions(socialContext);
      const allowIncomingCall = runtimeSettings.allowIncomingCalls && chat.type === 'direct' && !activeCallMode && !regenerate;
      const pendingIntimateRequest = chat.messages.find((item) => item.kind === 'intimate-pay' &&
        item.senderId === 'user' && item.intimateStatus === 'pending');
      const stickerPromptList = Array.from(new Set(allowedStickers.map((item) => item.category || DEFAULT_STICKER_CATEGORY)))
        .map((category) => `${category}：${allowedStickers
          .filter((item) => (item.category || DEFAULT_STICKER_CATEGORY) === category)
          .slice(0, 60)
          .map((item) => `[${item.id}|${item.description}]`)
          .join('')}`)
        .join('；');
      const responseInstructions = [
        socialInstructions,
        ...(chat.type === 'group' && chat.allowGroupPrivate !== false && !regenerate ? [
          `避免重复私发。各主要角色最近已发给玩家的私信（仅供决定是否还需私发，绝不在群里复述）：${JSON.stringify(chatContacts.map((actor) => ({
            charId: actor.id,
            recentSent: latestChats.find((item) => item.type === 'direct' && item.participantIds.length === 1 && item.participantIds[0] === actor.id)
              ?.messages.filter((message) => message.senderId === actor.id && message.kind !== 'context-note').slice(-3)
              .map((message) => ({ text: message.text, at: message.createdAt })) ?? [],
          })))}`,
        ] : []),
        '红包和转账发出后处于待领取/待收款状态，只有玩家确认才存入虚拟余额，玩家可在收款前退回转账。不要声称已经自动到账。',
        ...(chat.type === 'direct' && !contact.id.startsWith('npc:') && !regenerate && !activeCallMode ? [
          `【亲密付】玩家不能自行开卡。你可以结合人设、关系与经济情况主动赠予亲密付，返回可选字段 "intimatePayAction":{"type":"grant","monthlyLimit":正数,"note":"给玩家的留言"${pendingIntimateRequest ? `,"requestId":"${pendingIntimateRequest.id}"` : ''}}。额度由你决定，不必照搬申请额度，最大 1000000 元。${pendingIntimateRequest ? `玩家有待处理申请，申请 ID：${pendingIntimateRequest.id}，希望额度 ¥${pendingIntimateRequest.amount}。请本轮明确同意或拒绝；拒绝返回 "intimatePayAction":{"type":"decline","requestId":"${pendingIntimateRequest.id}"}。` : '没有申请时也可自然地主动赠予；不赠予则省略该字段。'}reply 中自然说明你的决定，不要只口头同意而不返回动作字段。`,
        ] : ['本轮禁止 intimatePayAction。']),
        `表情包分类权限（必须遵守，每位角色只能从获准分类选择）：${chatMembers.map((member) =>
          `${member.id}：${'stickerCategories' in member && member.stickerCategories !== undefined ? member.stickerCategories.join('、') || '禁止使用表情包' : '全部分类'}`
        ).join('；')}。${allowedStickers.length === 0 ? '本轮禁止返回 sticker。' : ''}`,
        allowIncomingCall
          ? '允许在合适时机主动发起一次视频来电：返回一条 {"kind":"video-call","text":"视频来电"}，用户必须自行接通。不要描述为已接听或正在通话。'
          : '本轮禁止返回 video-call，不得主动拨打电话。',
        `以${chat.type === 'direct' ? `${contact.name}的` : '其中一位角色或 NPC 群成员的'}身份自然回复。只返回 JSON 对象，至少包含 reply、thought、speakerId 字段。thought 是该角色此刻的内心独白：必须用第一人称（“我”），完全符合人设，写出没能说出口的真心话、阴暗面、隐秘的在意、不安或脆弱，细腻、真实、有情绪层次；不得是对剧情的第三人称概括，不要复述 reply 里已经说出口的话，不要写成给玩家的发言，约 40-120 字。reply 必须是恰好 ${targetReplyCount} 条独立消息组成的数组；普通消息可写字符串，也可写对象 {"kind":"消息类型","text":"消息/语音转写/图片描述","title":"可选标题","source":"可选来源","content":"可选摘要","amount":"可选金额","quantity":可选红包个数,"stickerId":"可选表情包ID"}。支持类型：text、image（文字描述图片）、voice（语音转写）、sticker、video-call、location、red-packet、transfer、link、pat。pat 表示角色拍了拍玩家（类似微信拍一拍，text 可留空或写简短后缀如“的脑袋”），仅在情境自然时偶尔使用。${chat.narratorEnabled || chat.type === 'observer' ? '本对话已开启旁白：可在 reply 中穿插 {"kind":"narration","text":"旁白内容"} 项，旁白用第三人称简短描述角色此刻的动作、表情、神态、衣着或周围氛围，必须控制在 50 字以内（越短越好），不要包含角色台词，也不要替玩家行动；旁白同样计入 reply 条数，通常每轮最多 1 条，且不要全是旁白。' : ''}链接请提供 title/source/content；红包和转账必须给正数 amount，收款对象只能是玩家 user，群聊红包可提供 quantity。不要编造图片 URL；image 使用文字图卡。【表情包】玩家导入了一批表情包，你可以像真人聊天一样，根据人设、性格和当下情绪，在合适的时候主动发表情包（比如开心、撒娇、无语、委屈、吐槽时），一般可单独作为一条 {"kind":"sticker","stickerId":"表情包ID"}，也可在文字消息后附带一条；偏活泼的人设可以更常用，内敛冷淡的人设就少用，不要每轮都发，也不要连发多个。表情包不只是表达情绪，也可以用来糊弄回复、反讽、玩梗、做社交缓冲（不知道说什么、尴尬、不想认真回答时）；但不要过度解读表情包的含义，也不要给它强加深意。根据当前对话氛围和人设选择性地发，同一个表情包不要反复发（回看历史，近期发过的就换一个或不发）。只能从下列表情包里选（按分类列出，格式 分类：[ID|名称]，请根据名称含义挑选贴切的）：${stickerPromptList}。${allStickers.length === 0 ? '（目前没有表情包，不要发 sticker。）' : ''}请仅在剧情自然、确有必要时使用附件，普通文字聊天优先，不要为了凑数强行发送附件。${regenerate ? '本次是重生成，不得再次发红包、转账或礼物，以免重复入账。' : '角色发给玩家的红包和转账需玩家手动领取或确认收款后才加入支付宝个人余额，不会扣玩家的钱；待收转账可退回。可选 gift 字段仅允许 {"existingProductId":"现有商品ID"} 或 {"title":"新商品名","desc":"描述","price":数字,"category":"shopping或eleme","emoji":"emoji"}，只在剧情自然时由主要角色提供；NPC不使用 gift 字段。'}${chat.type === 'group' && chat.allowAgentGroupRename ? '可选 groupTitle 和 groupNicknames 字段，只在情节自然需要时修改群名或昵称。' : ''}群聊的 speakerId 必须从以下成员 ID 中选择：${chatMembers.map((member) => `${member.id}（${member.name}）`).join(', ')}。${chat.type === 'group' && chat.allowAgentGroupRename ? 'groupNicknames 的键只能使用上方成员 ID。' : ''}${chat.type === 'observer' ? '这是旁观群聊，user不在群里；不得生成发给玩家的红包、转账或礼物；根据角色之间的对话和旁白情境继续由群成员发言。' : ''}`,
        ...(activeCallMode === 'video' && callConnectedAt
          ? [`当前为视频通话${callConnectedAt ? `（已通话 ${Math.floor((Date.now() - callConnectedAt) / 60000)} 分钟）` : ''}，请在角色的每次回复最前方先写一段用小括号包裹的可视动作描写，再接角色说的话；通话中说话要口语化、简短，不要发图片、表情包、红包、转账、链接等附件。`]
          : []),
        ...(activeCallMode === 'voice' && callConnectedAt
          ? [`当前正在语音通话中${callConnectedAt ? `（已通话 ${Math.floor((Date.now() - callConnectedAt) / 60000)} 分钟）` : ''}：你们是在“说话”，请用口语化的短句直接说，像真的在讲话，可以有语气词、停顿、笑声；不要发图片、表情包、红包、转账、链接、位置等附件，也不要括号动作描写；每次回复保持简短。`]
          : []),
        ...(momentsInjection.marks.length > 0
          ? ['上文【朋友圈动态】区分了首次看到的动态与已读动态的新评论。请遵循每条已读标记；仅有新评论时，不得声称刚看到原动态。可以在 reply 中自然提及更新；也可以额外返回可选字段 momentActions（最多 3 项）：[{"postId":"朋友圈ID","charId":"主要角色ID","type":"like 或 comment","content":"评论内容（type 为 comment 时必填，不超过 40 字）","replyToName":"可选，被回复者姓名"}]。postId 和 charId 必须来自上文，没有想互动时不要返回该字段。']
          : []),
        ...(couplePendingCharId
          ? ['玩家向你发来了情侣空间邀请（见上文）。请根据人设与你们的关系自行决定：同意则额外返回字段 "coupleSpaceAction":"accept"，婉拒则返回 "coupleSpaceAction":"decline"；并在 reply 中自然地表态。不要返回其他值。']
          : []),
        ...(allowCharInvite
          ? ['如果你决定主动邀请玩家开通情侣空间（见上文【情侣空间】说明），请额外返回 "coupleSpaceAction":"invite"；否则不要返回该字段。']
          : []),
      ].join('\n');
      if (proactive) promptMessages.push({
        role: 'user',
        content: `【定时主动联系】这不是玩家新发来的消息。请根据人设、${chat.timeAwarenessEnabled === false ? '已有聊天' : '当前时间与已有聊天'}主动联系玩家，聊一个自然的新话题或关心近况。不要假装玩家刚说过话，不要机械重复上一轮回复，不要提定时器或后台任务。`,
      });
      const requestMessages = withChatResponseFormat(promptMessages, responseInstructions);
      const estimatedInput = estimatePromptTokens(requestMessages);
      if (previewOnly) {
        setTokenPreview({ chatId: chat.id, input: estimatedInput });
        return;
      }
      if (!apiPreset) throw new Error('找不到 API 配置，请重新保存。');
      writeStoredValue(`yyphone:chat-token-usage:${chat.id}`, {
        input: estimatedInput,
        at: new Date().toISOString(),
        model: apiPreset.model || 'gpt-4o-mini',
      });
      const model = apiPreset.model?.trim() || 'gpt-4o-mini';
      const result = await requestChatReply(requestMessages, apiPreset, (usage) => {
        writeStoredValue(`yyphone:chat-token-usage:${chat.id}`, {
          ...usage,
          at: new Date().toISOString(),
          model,
        });
      }, {
        defaultSpeakerId: contact.id,
        namesById: Object.fromEntries(chatMembers.map((member) => [
          member.id, [member.name, chat.groupNicknames?.[member.id] ?? ''],
        ])),
      });
      let reply = '';
      let replyParts: GeneratedAiMessage[] = [];
      let thought = '';
      let aiReaction: { emoji: string; target: string } | null = null;
      let speakerId = contact.id;
      let generatedGroupTitle: string | undefined;
      let generatedGroupNicknames: Record<string, string> | undefined;
      let generatedGift: Record<string, unknown> | undefined;
      let intimateAction: { type: 'grant' | 'decline'; monthlyLimit?: number; note: string; requestId?: string } | undefined;
      const momentActions: MomentChatAction[] = [];
      let coupleDecision: 'accept' | 'decline' | 'invite' | null = null;
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const record = result as Record<string, unknown>;
        if (record.intimatePayAction !== undefined) {
          const action = record.intimatePayAction;
          if (chat.type !== 'direct' || contact.id.startsWith('npc:') || regenerate || activeCallMode ||
            !action || typeof action !== 'object' || Array.isArray(action)) {
            throw new Error('本轮不允许亲密付操作，已取消回复。');
          }
          const raw = action as Record<string, unknown>;
          if ((raw.type !== 'grant' && raw.type !== 'decline') ||
            (pendingIntimateRequest ? raw.requestId !== pendingIntimateRequest.id : raw.requestId !== undefined || raw.type === 'decline')) {
            throw new Error('角色返回的亲密付申请处理格式不正确。');
          }
          const limit = Number(raw.monthlyLimit);
          if (raw.type === 'grant' && (!Number.isFinite(limit) || limit < 0.01 || limit > 1_000_000)) {
            throw new Error('角色返回的亲密付额度无效。');
          }
          intimateAction = {
            type: raw.type,
            ...(raw.type === 'grant' ? { monthlyLimit: limit } : {}),
            note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 160) : '',
            ...(pendingIntimateRequest ? { requestId: pendingIntimateRequest.id } : {}),
          };
        }
        if (typeof record.speakerId === 'string' && chatMembers.some((item) => item.id === record.speakerId)) {
          speakerId = record.speakerId;
        }
        if (typeof record.reply === 'string') {
          reply = record.reply.trim();
          replyParts = reply ? [{ text: reply }] : [];
        } else if (Array.isArray(record.reply)) {
          const allowedKinds = [
            'text', 'image', 'voice', 'sticker', 'video-call', 'location',
            'red-packet', 'transfer', 'link', 'pat', 'narration',
          ] as const;
          replyParts = record.reply.slice(0, targetReplyCount).map((rawPart): GeneratedAiMessage => {
            if (typeof rawPart === 'string') {
              const text = rawPart.trim();
              if (!text) throw new Error('AI 返回了空消息，请检查模型配置后重试。');
              return { text };
            }
            if (!rawPart || typeof rawPart !== 'object' || Array.isArray(rawPart)) {
              throw new Error('AI 返回的消息格式无效。');
            }
            const part = rawPart as Record<string, unknown>;
            const kind = typeof part.kind === 'string' && allowedKinds.includes(part.kind as typeof allowedKinds[number])
              ? part.kind as GeneratedAiMessage['kind']
              : undefined;
            if (part.kind !== undefined && !kind) throw new Error(`AI 返回了不支持的消息类型：${String(part.kind)}`);
            if (activeCallMode && kind && kind !== 'text' && kind !== 'narration') {
              throw new Error('通话中只能生成文字消息，AI 返回了附件，已取消本次回复。');
            }
            if (kind === 'video-call' && !allowIncomingCall) throw new Error('当前设置不允许角色主动来电，已取消本次回复。');
            const title = typeof part.title === 'string' ? part.title.trim().slice(0, 120) : undefined;
            const source = typeof part.source === 'string' ? part.source.trim().slice(0, 120) : undefined;
            const content = typeof part.content === 'string' ? part.content.trim().slice(0, 1000) : undefined;
            let text = typeof part.text === 'string'
              ? part.text.trim().slice(0, 1000)
              : kind === 'link' ? title ?? '' : content ?? '';
            const message: GeneratedAiMessage = { text, ...(kind ? { kind } : {}) };
            if (title) message.title = title;
            if (typeof part.quote === 'string' && part.quote.trim()) message.quoteText = part.quote.trim().slice(0, 80);
            if (source) message.source = source;
            if (content) message.content = content;
            if (kind === 'sticker') {
              const member = chatMembers.find((item) => item.id === speakerId);
              const categories = member && 'stickerCategories' in member ? member.stickerCategories : undefined;
              const speakerStickers = allowedStickers.filter((item) => permittedSticker(categories, item));
              const sticker = speakerStickers.find((item) => item.id === part.stickerId)
                ?? speakerStickers.find((item) => item.description === (part.stickerId ?? part.text));
              if (!sticker) throw new Error('AI 选择了不存在或未分配给该角色的表情包，已取消本次回复。');
              message.imageUrl = sticker.imageUrl;
              message.text = text || sticker.description;
            }
            if (kind === 'narration') {
              if (!message.text) throw new Error('AI 返回了空旁白，请重试。');
              message.text = message.text.slice(0, 120);
            }
            if (kind === 'link' && !message.title) {
              throw new Error('AI 分享链接缺少标题，请重试。');
            }
            if (kind === 'red-packet' || kind === 'transfer') {
              const amount = Number(part.amount);
              if (!Number.isFinite(amount) || amount < 0.01 || amount > 1_000_000) {
                throw new Error('AI 返回的红包或转账金额无效（需至少 0.01 且不超过 1,000,000 元）。');
              }
              if (regenerate || chat.type === 'observer') {
                throw new Error('重生成或旁观群聊不能再次产生红包/转账。');
              }
              message.amount = amount.toFixed(2);
              message.recipientId = 'user';
              if (kind === 'red-packet' && part.quantity !== undefined) {
                const quantity = Number(part.quantity);
                if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
                  throw new Error('AI 返回的红包数量无效。');
                }
                message.quantity = quantity;
              }
              if (!message.text) message.text = kind === 'red-packet' ? '恭喜发财，大吉大利' : '转账给你';
            }
            if (!message.text && kind !== 'link') {
              throw new Error('AI 返回的消息内容为空。');
            }
            return message;
          }).filter((part) => part.text || part.kind === 'link');
          reply = replyParts.map((part) => part.text).join('\n');
        }
        if (typeof record.thought === 'string') thought = record.thought.trim();
        if (record.reaction && typeof record.reaction === 'object' && !Array.isArray(record.reaction)) {
          const raw = record.reaction as Record<string, unknown>;
          if (typeof raw.emoji === 'string' && (MESSAGE_REACTIONS as readonly string[]).includes(raw.emoji)) {
            aiReaction = { emoji: raw.emoji, target: typeof raw.target === 'string' ? raw.target.trim().slice(0, 80) : '' };
          }
        }
        if (record.musicAction && typeof record.musicAction === 'object' && !Array.isArray(record.musicAction)) {
          const wantedTitle = (record.musicAction as Record<string, unknown>).play;
          const snapshot = readMusicPlaybackSnapshot();
          const trackToPlay = typeof wantedTitle === 'string' ? findMusicTrackByTitle(wantedTitle) : undefined;
          // 仅当“一起听”正开启且所选角色在本聊天中时，才允许切歌。
          if (trackToPlay && snapshot?.isPlaying && snapshot.togetherEnabled && chat.participantIds.includes(snapshot.companionId)) {
            musicPlayer.selectTrack(trackToPlay.id);
          }
        }
        if (Array.isArray(record.momentActions) && momentsInjection.marks.length > 0) {
          record.momentActions.slice(0, 3).forEach((rawAction) => {
            if (!rawAction || typeof rawAction !== 'object' || Array.isArray(rawAction)) return;
            const action = rawAction as Record<string, unknown>;
            const actorId = typeof action.charId === 'string' ? action.charId : speakerId;
            const actor = chatContacts.find((item) => item.id === actorId) ?? chatContacts[0];
            const postId = typeof action.postId === 'string' ? action.postId : '';
            if (!actor || !momentsInjection.marks.some((mark) => mark.postId === postId && mark.charId === actor.id)) return;
            if (action.type === 'like') {
              momentActions.push({ postId, charId: actor.id, charName: actor.name, type: 'like' });
            } else if (action.type === 'comment' && typeof action.content === 'string' && action.content.trim()) {
              momentActions.push({
                postId,
                charId: actor.id,
                charName: actor.name,
                type: 'comment',
                content: action.content.trim().slice(0, 120),
                ...(typeof action.replyToName === 'string' && action.replyToName.trim()
                  ? { replyToName: action.replyToName.trim().slice(0, 40) }
                  : {}),
              });
            }
          });
        }
        if (couplePendingCharId && (record.coupleSpaceAction === 'accept' || record.coupleSpaceAction === 'decline')) {
          coupleDecision = record.coupleSpaceAction;
        }
        if (allowCharInvite && record.coupleSpaceAction === 'invite') {
          coupleDecision = 'invite';
        }
        if (record.gift && typeof record.gift === 'object' && !Array.isArray(record.gift)) {
          generatedGift = record.gift as Record<string, unknown>;
        }
        if (typeof record.speakerId === 'string' && chatMembers.some((item) => item.id === record.speakerId)) {
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
      if (replyParts.length === 0 || replyParts.every((part) => !part.text.trim() && !part.kind)) {
        throw new Error('AI 返回了空消息，请检查模型配置后重试。');
      }
      if (!previewOnly && chat.imageGenerationEnabled) {
        for (const part of replyParts) {
          if (part.kind !== 'image' || !part.text.trim()) continue;
          try {
            part.imageUrl = await generateImage(part.text, {
              ...readImageGenerationSettings(),
              prompt: chat.imageGenerationPrompt,
            }, apiPreset);
          } catch (imageError) {
            console.error('Image generation failed; keeping text image description.', imageError);
            setChatError(`生图失败，已保留文字图片描述：${imageError instanceof Error ? imageError.message : '未知错误'}`);
          }
        }
      }
      const liveChat = readStoredValue(CHATS_STORAGE_KEY, chats, isChatList).find((item) => item.id === chat.id);
      if (!liveChat || liveChat.blocked || liveChat.activeArchiveId !== chat.activeArchiveId ||
        (proactive && (!liveChat.proactiveEnabled || liveChat.updatedAt !== chat.updatedAt))) {
        console.info('Cancelled stale chat generation after chat activity, archive or permissions changed.');
        return;
      }
      const executionSocialContext = { ...socialContext, chat: liveChat };
      const socialActions = parseSocialActions(result, executionSocialContext, speakerId);
      if (socialActions.privateMessage) {
        const direct = readStoredValue(CHATS_STORAGE_KEY, chats, isChatList).find((item) => item.type === 'direct' &&
          item.participantIds.length === 1 && item.participantIds[0] === speakerId);
        if (direct?.blocked) throw new Error('该角色已被拉黑，不能从群聊发送私信。');
      }
      if (replyParts.some((part) => part.kind === 'video-call') && !delivery.current.runtimeSettings.allowIncomingCalls) {
        throw new Error('角色主动来电已关闭，已取消本次回复。');
      }
      if (replyParts.filter((part) => part.kind === 'video-call').length > 1) throw new Error('一轮只能发起一次来电，请重试。');
      if (intimateAction) {
        if (speakerId !== contact.id) throw new Error('只有当前私聊角色本人能处理亲密付。');
        if (intimateAction.requestId && !liveChat.messages.some((item) => item.id === intimateAction?.requestId && item.intimateStatus === 'pending')) {
          throw new Error('该亲密付申请状态已改变，请重新生成。');
        }
        replyParts.push({
          kind: 'intimate-pay',
          text: intimateAction.type === 'grant' ? intimateAction.note || '已为你开通亲密付' : '亲密付申请已婉拒',
          intimateStatus: intimateAction.type === 'grant' ? 'granted' : 'declined',
          ...(intimateAction.monthlyLimit ? { amount: intimateAction.monthlyLimit.toFixed(2) } : {}),
        });
      }
      if (generatedGift && !regenerate && !speakerId.startsWith('npc:')) {
        const marketStorageKey = 'yyphone:taobao-market-products';
        const rawProducts = readStorageString(marketStorageKey);
        const storedProducts: unknown = rawProducts ? JSON.parse(rawProducts) : [];
        if (!Array.isArray(storedProducts)) throw new Error('淘宝商品数据格式无效，无法保存角色送达的商品。');
        const existingProductId = generatedGift.existingProductId;
        let deliveredTitle = '';
        let deliveredCategory: 'shopping' | 'eleme' | undefined;
        let deliveredCard: Record<string, unknown> | undefined;
        if (typeof existingProductId === 'string') {
          const existing = storedProducts.find((item) =>
            !!item &&
            typeof item === 'object' &&
            (item as Record<string, unknown>).id === existingProductId &&
            ((item as Record<string, unknown>).category === 'shopping' ||
              (item as Record<string, unknown>).category === 'eleme')
          ) as Record<string, unknown> | undefined;
          if (existing) {
            deliveredTitle = String(existing.title ?? '商品');
            deliveredCategory = existing.category as 'shopping' | 'eleme';
            deliveredCard = existing;
          }
        } else if (
          typeof generatedGift.title === 'string' &&
          typeof generatedGift.desc === 'string' &&
          typeof generatedGift.price === 'number' &&
          Number.isFinite(generatedGift.price) &&
          generatedGift.price > 0 &&
          (generatedGift.category === 'shopping' || generatedGift.category === 'eleme')
        ) {
          deliveredTitle = generatedGift.title.trim().slice(0, 100);
          deliveredCategory = generatedGift.category;
          const characterName = chatMembers.find((item) => item.id === speakerId)?.name ?? contact.name;
          const newProduct = {
            id: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            category: deliveredCategory,
            title: deliveredTitle,
            desc: generatedGift.desc.trim().slice(0, 500),
            price: generatedGift.price,
            emoji: typeof generatedGift.emoji === 'string' ? generatedGift.emoji : deliveredCategory === 'shopping' ? '🎁' : '🍱',
            store: `${characterName}送你的`,
            badge: '角色赠礼',
            fromCharName: characterName,
            fromCharId: speakerId,
          };
          storedProducts.unshift(newProduct);
          deliveredCard = newProduct;
          writeStorageString(marketStorageKey, JSON.stringify(storedProducts));
        }
        if (deliveredTitle && deliveredCategory) {
          const characterName = chatMembers.find((item) => item.id === speakerId)?.name ?? contact.name;
          replyParts.push({
            text: `${characterName}送你「${deliveredTitle}」`,
            kind: 'order',
            title: deliveredTitle,
            content: typeof deliveredCard?.desc === 'string' ? deliveredCard.desc.slice(0, 80) : '',
            amount: typeof deliveredCard?.price === 'number' ? deliveredCard.price.toFixed(2) : undefined,
            source: deliveredCategory === 'eleme' ? '已送达你的饿了么' : '已送达你的淘宝',
            imageUrl: typeof deliveredCard?.imageUrl === 'string' ? deliveredCard.imageUrl : undefined,
            productEmoji: typeof deliveredCard?.emoji === 'string' ? deliveredCard.emoji : undefined,
            orderCategory: deliveredCategory,
            orderMode: 'gift',
          });
          if (!speakerId.startsWith('npc:')) {
            appendCharacterContextEvent(speakerId, `角色送玩家商品「${deliveredTitle}」，已立即送达。`, 'taobao');
          }
          if (deliveredCategory === 'shopping') {
            try {
              addInventoryItem({
                kind: 'gift',
                title: deliveredTitle,
                desc: typeof deliveredCard?.desc === 'string' ? deliveredCard.desc.slice(0, 200) : '',
                emoji: typeof deliveredCard?.emoji === 'string' ? deliveredCard.emoji : '🎁',
                imageUrl: typeof deliveredCard?.imageUrl === 'string' ? deliveredCard.imageUrl : undefined,
                price: typeof deliveredCard?.price === 'number' ? deliveredCard.price : undefined,
                fromCharId: speakerId.startsWith('npc:') ? undefined : speakerId,
                fromCharName: characterName,
                shop: '淘宝',
              });
            } catch (error) {
              console.warn('Could not record gift in inventory.', error);
            }
          }
        }
      }
      const replyTimestamp = Date.now();
      const replyBatchId = `reply-${replyTimestamp}-${Math.random().toString(36).slice(2, 7)}`;
      const keepNarration = chat.narratorEnabled || chat.type === 'observer';
      const deliverableParts = replyParts.filter((part) => part.kind !== 'narration' || keepNarration);
      const replyMessages: ChatMessage[] = deliverableParts.map((part, index) => {
        const speakerName = getChatParticipantName(chat, speakerId);
        const { kind: partKind, quoteText, ...rest } = part;
        const quoted = quoteText
          ? [...chat.messages].reverse().slice(0, 40).find(
              (item) => item.senderId !== 'narrator' && item.kind !== 'pat' && item.text &&
                (item.text.includes(quoteText) || quoteText.includes(item.text))
            )
          : undefined;
        if (partKind === 'narration') {
          return {
            ...rest,
            id: `message-${replyTimestamp}-${Math.random().toString(36).slice(2, 7)}`,
            replyBatchId,
            senderId: 'narrator',
            thought: '',
            createdAt: new Date(replyTimestamp + index).toISOString(),
          };
        }
        return {
          ...rest,
          kind: partKind,
          ...(partKind === 'red-packet' || partKind === 'transfer' ? { paymentStatus: 'pending' as const } : {}),
          ...(partKind === 'video-call' ? { callStatus: 'ringing' as const } : {}),
          ...(quoted ? { replyTo: makeReplyRef(chat, quoted) } : {}),
          id: `message-${replyTimestamp}-${Math.random().toString(36).slice(2, 7)}`,
          replyBatchId,
          senderId: speakerId,
          text: partKind === 'pat'
            ? `“${speakerName}” 拍了拍你${part.text && part.text.length <= 12 ? ` ${part.text}` : ''}`
            : activeCallMode === 'video' && !/^\s*[（(].*[）)]/.test(part.text)
            ? `（${speakerName}看向镜头，轻轻开口）${part.text}`
            : part.text,
          thought,
          createdAt: new Date(replyTimestamp + index).toISOString(),
        };
      });
      if (replyMessages.length === 0) throw new Error('AI 没有返回可显示的消息，请重试。');
      // 角色只能给玩家的消息贴表情：默认贴最近一条，或按 target 文字匹配
      const reactionTargetId = aiReaction && chat.type !== 'observer'
        ? ([...chat.messages].reverse().slice(0, 20).find(
            (item) => item.senderId === 'user' && item.kind !== 'pat' &&
              (!aiReaction!.target || (item.text && (item.text.includes(aiReaction!.target) || aiReaction!.target.includes(item.text))))
          ) ?? [...chat.messages].reverse().find((item) => item.senderId === 'user' && item.kind !== 'pat'))?.id
        : undefined;
      const financeBeforeGrant = intimateAction?.type === 'grant' ? readAlipayData() : undefined;
      const socialActor = chatContacts.find((actor) => actor.id === speakerId);
      if (socialActor) applySocialWrites(socialActions, executionSocialContext, socialActor);
      if (intimateAction?.type === 'grant' && intimateAction.monthlyLimit) {
        grantIntimatePay(contact, intimateAction.monthlyLimit, intimateAction.note);
      }
      const replySaved = updateChat(chat.id, (current) => ({
        ...current,
        messages: [
          ...current.messages.filter((item) =>
            replacedReplyBatchId
              ? item.replyBatchId !== replacedReplyBatchId
              : item.id !== replacedMessageId
          ).map((item) => {
            if (intimateAction?.requestId === item.id) return {
              ...item,
              intimateStatus: intimateAction.type === 'grant' ? 'granted' as const : 'declined' as const,
            };
            if (!aiReaction || item.id !== reactionTargetId) return item;
            const others = (item.reactions ?? []).filter((reaction) => reaction.by !== speakerId);
            return { ...item, reactions: [...others, { by: speakerId, emoji: aiReaction.emoji }] };
          }),
          replyMessages[0],
        ],
        updatedAt: replyMessages[0].createdAt,
        ...(generatedGroupTitle ? { groupTitle: generatedGroupTitle } : {}),
        ...(generatedGroupNicknames
          ? { groupNicknames: { ...(current.groupNicknames ?? {}), ...generatedGroupNicknames } }
          : {}),
      }));
      if (!replySaved) {
        if (financeBeforeGrant) {
          writeAlipayData(financeBeforeGrant);
          window.dispatchEvent(new Event('yyphone:finance-change'));
        }
        throw new Error('回复保存失败，亲密付未生效，请重试。');
      }
      if (socialActions.privateMessage && socialActor) {
        const currentChats = readStoredValue(CHATS_STORAGE_KEY, chats, isChatList);
        let direct = currentChats.find((item) => item.type === 'direct' &&
          item.participantIds.length === 1 && item.participantIds[0] === speakerId);
        if (direct?.blocked) throw new Error('私聊角色已被拉黑，群聊私信未发送。');
        if (!direct) {
          direct = {
            id: `chat-${crypto.randomUUID()}`, type: 'direct', participantIds: [speakerId],
            noteName: '', context: '', narratorEnabled: false, blocked: false, pinned: false,
            avatars: {}, messages: [], updatedAt: new Date().toISOString(), currentChatHistoryCount: 200,
          };
          currentChats.unshift(direct);
        }
        const privateMessages: ChatMessage[] = socialActions.privateMessage.texts.map((text, index) => ({
          id: `private-${crypto.randomUUID()}`, replyBatchId, senderId: speakerId, kind: 'text',
          text, createdAt: new Date(Date.now() + index).toISOString(),
        }));
        const privateContext = buildGroupPrivateContext(
          chat,
          (id) => latestContacts.find((item) => item.id === id)?.name || getNpcByParticipantId(characterNpcs, id)?.name,
          personaDraft.name.trim() || '玩家',
          socialActions.privateMessage.reason
        );
        const updatedDirect = {
          ...direct,
          messages: [...direct.messages, {
            id: `context-${crypto.randomUUID()}`, senderId: 'narrator', kind: 'context-note' as const,
            title: '群聊触发的私信', source: 'group-private',
            text: privateContext,
            aiContext: privateContext,
            createdAt: new Date().toISOString(),
          }, ...privateMessages],
          updatedAt: privateMessages[privateMessages.length - 1].createdAt,
        };
        if (!persistChats(currentChats.map((item) => item.id === direct.id ? updatedDirect : item))) {
          throw new Error('群聊私信保存失败，请重试。');
        }
        delivery.current.onMessage({
          chatId: direct.id, name: direct.noteName || socialActor.name,
          avatar: direct.avatars[speakerId] || socialActor.avatarUrl,
          text: privateMessages.map((message) => message.text).join(' ').slice(0, 160),
        });
      }
      // 逐条出现：updateChat 每次都读写存储，即使中途离开聊天页也会把剩余消息补完。
      for (const message of replyMessages.slice(1)) {
        const length = (message.text ?? '').length;
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.min(1300, length * 40)));
        updateChat(chat.id, (current) => ({
          ...current,
          messages: [...current.messages, message],
          updatedAt: message.createdAt,
        }));
      }
      // Only now is the reply final, so the delivered moments count as read.
      if (replySaved) applyMomentsAfterChat(momentsInjection, momentActions);
      if (replySaved) {
        const destination = delivery.current;
        if (!destination.isVisible || destination.activeChatId !== chat.id || document.visibilityState !== 'visible') {
          destination.onMessage({
            chatId: chat.id,
            name: chat.noteName || latestContacts.find((item) => item.id === speakerId)?.name || contact.name,
            avatar: chat.avatars[speakerId] || latestContacts.find((item) => item.id === speakerId)?.avatarUrl || '',
            text: replyMessages.filter((item) => item.senderId !== 'narrator').map((item) => item.text).join(' ').slice(0, 160),
          });
        }
        const incoming = replyMessages.find((item) => item.kind === 'video-call');
        if (incoming && destination.runtimeSettings.allowIncomingCalls) {
          setActiveChatId(chat.id);
          setIncomingCallMessageId(incoming.id);
          setActiveCallMode('video');
          setCallStartedAt(new Date().toISOString());
          setCallConnectedAt(null);
          destination.onIncomingCall();
        }
        applyCoupleSeenAfterChat(coupleInjection);
        applyPlantSeenAfterChat(plantInjection);
        markMemoriesRecalled(memoryInjection.ids);
        void maybeAutoExtractMemory(chat.participantIds, chat.type);
        void maybeAutoJournal(chat.participantIds, chat.type).then(() => maybeAutoGrowth(chat.participantIds, chat.type));
        if (chat.type !== 'direct') void maybeAutoGroupJournal(chat.id);
      }
      if (replySaved && coupleCharId && coupleDecision === 'invite') {
        const inviteTime = new Date().toISOString();
        const spaceNow = readCoupleSpaces()[coupleCharId];
        if (!spaceNow || spaceNow.bindStatus === 'unbound') {
          updateCoupleSpace(coupleCharId, (space) => ({
            ...space,
            bindStatus: 'pending_user',
            inviteMessage: `「${contact.name}」向你发来了情侣空间绑定邀请，快去微信里回应吧。`,
          }));
          updateChat(chat.id, (current) => ({
            ...current,
            messages: [
              ...current.messages,
              {
                id: `message-${Date.now()}-invite`,
                senderId: coupleCharId,
                text: '情侣空间邀请',
                kind: 'couple-invite',
                title: `${contact.name}邀请你开通情侣空间`,
                inviteFrom: 'char',
                inviteStatus: 'pending',
                createdAt: inviteTime,
              },
            ],
          }));
        }
      }
      if (replySaved && couplePendingCharId && coupleDecision && coupleDecision !== 'invite') {
        const accepted = coupleDecision === 'accept';
        updateCoupleSpace(couplePendingCharId, (space) =>
          space.bindStatus === 'pending_char'
            ? {
                ...space,
                bindStatus: accepted ? 'bound' : 'unbound',
                ...(accepted ? { startDate: localDateString() } : {}),
              }
            : space
        );
        updateChat(chat.id, (current) => ({
          ...current,
          messages: current.messages.map((item) =>
            item.kind === 'couple-invite' && item.inviteStatus === 'pending'
              ? { ...item, inviteStatus: accepted ? 'accepted' : 'declined' }
              : item
          ),
        }));
      }
    } catch (error) {
      console.error('Could not generate AI chat reply.', error);
      if (previewOnly) setTokenPreviewError(error instanceof Error ? error.message : '完整输入估算失败。');
      else setChatError(error instanceof Error ? error.message : 'AI 回复失败，请检查网络与 API 配置。');
    } finally {
      generationRunning.current = false;
      if (previewOnly) setTokenPreviewBusy(false);
      else {
        setHiddenMessageIds([]);
        setIsGeneratingReply(false);
      }
    }
  };

  useEffect(() => {
    scheduledTick.current = async () => {
      if (generationRunning.current || activeCallMode ||
        (document.visibilityState !== 'visible' && !runtimeSettings.keepAlive)) return;
      const run = async () => {
        const latest = readStoredValue(CHATS_STORAGE_KEY, chats, isChatList);
        const due = latest.filter((chat) => isProactiveDue(chat, Date.now()))
          .sort((a, b) => (Date.parse(a.lastProactiveAt ?? a.updatedAt) || 0) - (Date.parse(b.lastProactiveAt ?? b.updatedAt) || 0))[0];
        if (!due) return;
        if (!updateChat(due.id, (chat) => ({ ...chat, lastProactiveAt: new Date().toISOString() }))) return;
        await generateAiReply(false, due.id, true);
      };
      if (navigator.locks) {
        await navigator.locks.request('yyphone:proactive-chat', { ifAvailable: true }, async (lock) => {
          if (lock) await run();
        });
      } else await run();
    };
  });

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
    deleteGroupJournal(chatSettingsDraft.id);
    setActiveChatId('');
    setChatSettingsOpen(false);
    setChatSettingsDraft(null);
  };

  // During a connected voice/video call, speak each new line from a voice-enabled character in order.
  useEffect(() => {
    if (!activeCallMode || !callConnectedAt) {
      callVoicePlayedRef.current.clear();
      return;
    }
    const chat = chats.find((item) => item.id === activeChatId);
    if (!chat) return;
    const session = callVoiceSessionRef.current;
    chat.messages
      .filter((message) => Date.parse(message.createdAt) >= callConnectedAt &&
        (!message.kind || message.kind === 'text' || message.kind === 'voice') &&
        !callVoicePlayedRef.current.has(message.id) &&
        !!getVoiceSpeaker(message))
      .forEach((message) => {
        callVoicePlayedRef.current.add(message.id);
        const speaker = getVoiceSpeaker(message);
        if (!speaker) return;
        callVoiceQueueRef.current = callVoiceQueueRef.current.then(() =>
          session === callVoiceSessionRef.current ? playCharacterVoice(message, speaker) : undefined
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCallMode, callConnectedAt, chats, activeChatId, contacts]);

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  return (
    <div className="wechat-app relative flex-1 min-h-0 w-full flex flex-col bg-[#F3F7FA] overflow-hidden">
      <AppHeader
        title={
          activeChat
            ? isGeneratingReply ? '对方正在输入...' : getChatTitle(activeChat)
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
          ) : null
        }
      />
      {!activeChat && activeTab === 'chats' && chatCreateMenuOpen && (
        <>
        <div className="absolute inset-0 z-30" onClick={() => setChatCreateMenuOpen(false)} aria-hidden="true" />
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
        </>
      )}
      {activeTab === 'contacts' && contactsMenuOpen && (
        <>
        <div className="absolute inset-0 z-30" onClick={() => setContactsMenuOpen(false)} aria-hidden="true" />
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
        </>
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
      <div className={`flex-1 min-h-0 ${activeChat || activeTab === 'moments' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto no-scrollbar'}`}>
        {/* TAB 1: CHATS */}
        {activeTab === 'chats' && activeChat && (
          <div
            className="yy-chat-surface flex-1 min-h-0 flex flex-col bg-[#F3F6FA]"
            style={{
              '--yy-user-bubble-color': chatAppearance.userBubbleColor === DEFAULT_CHAT_APPEARANCE.userBubbleColor
                ? `var(--yy-default-user-bubble-color, ${hexToRgba(chatAppearance.userBubbleColor, chatAppearance.userBubbleOpacity ?? 0.78)})`
                : hexToRgba(chatAppearance.userBubbleColor, chatAppearance.userBubbleOpacity ?? 0.78),
              '--yy-character-bubble-color': chatAppearance.characterBubbleColor === DEFAULT_CHAT_APPEARANCE.characterBubbleColor
                ? `var(--yy-default-character-bubble-color, ${hexToRgba(chatAppearance.characterBubbleColor, chatAppearance.characterBubbleOpacity ?? 0.78)})`
                : hexToRgba(chatAppearance.characterBubbleColor, chatAppearance.characterBubbleOpacity ?? 0.78),
            } as React.CSSProperties}
          >
            {activeChat.type === 'observer' && (
              <p className="px-4 py-2 text-center text-[10px] text-slate-500 bg-white/50">
                旁观群聊 · 你不在此对话中
              </p>
            )}
            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 space-y-3"
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('.yy-chat-message-bubble') || target.closest('button') || target.closest('[role="button"]')) return;
                setSelectedMessageId('');
                setReactionMenuId('');
                setActiveChatMenuId('');
              }}
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
              {(() => {
                const shownMessages = activeChat.messages.filter((message) => !hiddenMessageIds.includes(message.id));
                return shownMessages.length > visibleMessageCount ? (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleMessageCount((count) => count + HISTORY_PAGE_SIZE)}
                      className="rounded-full bg-white/70 px-3 py-1 text-[10px] text-slate-500 shadow-sm"
                    >
                      查看历史消息
                    </button>
                  </div>
                ) : null;
              })()}
              {activeChat.messages.filter((message) => !hiddenMessageIds.includes(message.id)).slice(-visibleMessageCount).flatMap((message, messageIndex, visibleList) => {
                const previousMessage = visibleList[messageIndex - 1];
                const divider = shouldShowTimestamp(previousMessage?.createdAt, message.createdAt) ? (
                  <div key={`time-${message.id}`} className="py-1 text-center text-[10px] text-slate-400">
                    {formatChatTimestamp(
                      message.createdAt,
                      activeChat.timeAwarenessEnabled === false ? undefined : activeChat.timeZone
                    )}
                  </div>
                ) : null;
                const rendered = (() => {
                const messageActions = selectedMessageId === message.id && (
                  <div className={`mt-1 flex gap-1.5 text-[10px] ${message.senderId === 'user' ? 'justify-end' : ''} ${message.senderId === 'narrator' || message.kind === 'pat' ? 'justify-center' : ''}`}>
                    {message.kind !== 'pat' && !['image', 'sticker', 'red-packet', 'transfer', 'forum-forward', 'pomodoro-share'].includes(message.kind ?? '') && (
                      <button type="button" onClick={() => setEditingMessage({ id: message.id, text: message.text })} className="rounded-full bg-white/80 px-2.5 py-0.5 text-sky-600 shadow-sm">编辑</button>
                    )}
                    <button type="button" onClick={() => deleteChatMessage(message.id)} className="rounded-full bg-white/80 px-2.5 py-0.5 text-rose-500 shadow-sm">删除</button>
                    {message.senderId !== 'user' && message.senderId !== 'narrator' && activeChat.type !== 'observer' && (
                      <button type="button" onClick={() => { sendPat(message.senderId); setSelectedMessageId(''); }} className="rounded-full bg-white/80 px-2.5 py-0.5 text-violet-500 shadow-sm">拍一拍</button>
                    )}
                  </div>
                );
                const richMenu = reactionMenuId === message.id && (
                  <div className={`mb-1 flex flex-col gap-1 ${message.senderId === 'user' ? 'items-end' : 'items-start'}`}>
                    {message.senderId !== 'narrator' && message.kind !== 'pat' && (
                      <div className="flex items-center gap-0.5 rounded-full border border-white/80 bg-white/85 px-1.5 py-1 shadow-[0_6px_18px_rgba(125,150,185,0.22)] backdrop-blur-xl">
                        {MESSAGE_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            aria-label={`贴表情${emoji}`}
                            onClick={() => toggleReaction(message.id, emoji)}
                            className={`h-7 w-7 rounded-full text-base leading-none transition-transform active:scale-90 ${
                              message.reactions?.some((item) => item.by === 'user' && item.emoji === emoji) ? 'bg-sky-100' : ''
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px]">
                      {message.senderId !== 'narrator' && message.kind !== 'pat' && activeChat.type !== 'observer' && (
                        <button
                          type="button"
                          onClick={() => { setReplyingTo(message); setReactionMenuId(''); }}
                          className="rounded-full bg-white/85 px-2.5 py-1 text-slate-500 shadow-sm"
                        >
                          引用
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setReactionMenuId(''); setSelectMode(true); setSelectedIds([message.id]); }}
                        className="rounded-full bg-white/85 px-2.5 py-1 text-slate-500 shadow-sm"
                      >
                        多选
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyChatMessage(message)}
                        className="rounded-full bg-white/85 px-2.5 py-1 text-slate-500 shadow-sm"
                      >
                        复制消息
                      </button>
                    </div>
                  </div>
                );
                const editor = editingMessage?.id === message.id && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={editingMessage.text}
                      onChange={(event) => setEditingMessage({ id: message.id, text: event.target.value })}
                      aria-label="编辑消息"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                    />
                    <button type="button" onClick={saveEditedMessage} className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] text-white">保存</button>
                    <button type="button" onClick={() => setEditingMessage(null)} className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] text-slate-600">取消</button>
                  </div>
                );
                if (message.kind === 'context-note') {
                  return (
                    <div key={message.id} className="py-1.5 text-center">
                      {richMenu}
                      <button
                        type="button"
                        onClick={() => handleMessageTap(message.id)}
                        {...messagePress(message.id)}
                        className="mx-auto block max-w-[88%] rounded-2xl border border-white/80 bg-gradient-to-br from-pink-50/90 to-sky-50/90 px-3.5 py-2 text-center"
                      >
                        <span className="block text-[10px] font-semibold text-[#6F8CA0]">
                          {message.source === 'offline'
                            ? `📖 ${message.title} · 已写入记忆`
                            : message.source === 'pomodoro'
                              ? `⏱️ ${message.title}`
                              : message.source === 'xianyu'
                                ? `🐟 ${message.title}`
                                : `🫧 ${message.title}记忆已同步`}
                        </span>
                        {message.content && (
                          <span className="mt-1 block line-clamp-3 text-[10px] leading-relaxed text-slate-400">{message.content}</span>
                        )}
                      </button>
                      {messageActions}
                    </div>
                  );
                }
                if (message.senderId === 'narrator') {
                  if (!activeChat.narratorEnabled && activeChat.type !== 'observer') return null;
                  return (
                    <div key={message.id} className="py-1 text-center">
                      {richMenu}
                      <button
                        type="button"
                        onClick={() => handleMessageTap(message.id)}
                        {...messagePress(message.id)}
                        className="mx-auto block max-w-[85%] rounded-2xl bg-[#FBE4EC]/90 px-3 py-1 text-center text-[10px] leading-relaxed text-slate-400"
                      >
                        {message.text}
                      </button>
                      {editor}
                      {messageActions}
                    </div>
                  );
                }
                if (message.kind === 'pat') {
                  return (
                    <div key={message.id} className="py-1 text-center">
                      {richMenu}
                      <button
                        type="button"
                        onClick={() => handleMessageTap(message.id)}
                        {...messagePress(message.id)}
                        className="text-[10px] text-slate-400"
                      >
                        {message.text}
                      </button>
                      {messageActions}
                    </div>
                  );
                }
                const isUserMessage = message.senderId === 'user';
                const sender = contacts.find((contact) => contact.id === message.senderId) ??
                  getNpcByParticipantId(characterNpcs, message.senderId);
                const isShareCard = message.kind === 'forum-forward' || message.kind === 'pomodoro-share';
                const isSpecialBubble = isShareCard || ['video-call', 'location', 'red-packet', 'transfer', 'link', 'order', 'couple-invite', 'phone-share', 'intimate-pay'].includes(message.kind ?? '');
                return (
                  <div
                    key={message.id}
                    onClick={selectMode ? (event) => { if (event.target === event.currentTarget) handleMessageTap(message.id); } : undefined}
                    className={`yy-chat-message-row flex items-start gap-2 ${selectMode ? 'relative pl-7' : ''} ${isUserMessage ? 'is-user flex-row-reverse' : 'is-character'}`}
                  >
                    {selectMode && (
                      <span className={`absolute left-0 top-2 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${selectedIds.includes(message.id) ? 'border-transparent bg-gradient-to-br from-pink-300 to-sky-300 text-white' : 'border-slate-300 bg-white/70'}`}>
                        {selectedIds.includes(message.id) ? '✓' : ''}
                      </span>
                    )}
                    {isUserMessage ? (
                      <button
                        type="button"
                        aria-label="双击拍一拍自己"
                        onClick={() => handleAvatarTap('user')}
                        style={{
                          ...avatarFrameWrapStyle(chatAppearance.userAvatarFrame),
                          width: `calc(${32 + Math.max(0, (activeChat.fontSize ?? 12) - 12)}px * var(--font-scale, 1))`,
                          height: `calc(${32 + Math.max(0, (activeChat.fontSize ?? 12) - 12)}px * var(--font-scale, 1))`,
                        }}
                        className="yy-chat-avatar h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-sky-100 text-xs font-bold text-sky-800 flex items-center justify-center"
                      >
                        <span
                          className="flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]"
                          style={chatAppearance.userAvatarFrame?.enabled ? { borderRadius: `calc(0.75rem - ${chatAppearance.userAvatarFrame.width}px)` } : undefined}
                        >
                          {(activeChat.avatars.user || personaDraft.avatarUrl)
                            ? <img src={activeChat.avatars.user || personaDraft.avatarUrl} alt="" className="h-full w-full object-cover" />
                            : personaDraft.name.trim().charAt(0) || '我'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAvatarTap(message.senderId, () => setActiveThought({
                          name: sender?.name ?? '角色',
                          thought: getRoundThought(message, activeChat.messages) || '这轮消息没有记录角色心声。',
                        }))}
                        aria-label={`查看${sender?.name ?? '角色'}的心声`}
                        style={{
                          ...avatarFrameWrapStyle(chatAppearance.characterAvatarFrame),
                          width: `calc(${32 + Math.max(0, (activeChat.fontSize ?? 12) - 12)}px * var(--font-scale, 1))`,
                          height: `calc(${32 + Math.max(0, (activeChat.fontSize ?? 12) - 12)}px * var(--font-scale, 1))`,
                        }}
                        className="yy-chat-avatar h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-sky-100 text-xs font-bold text-sky-800 flex items-center justify-center"
                      >
                        <span
                          className="flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]"
                          style={chatAppearance.characterAvatarFrame?.enabled ? { borderRadius: `calc(0.75rem - ${chatAppearance.characterAvatarFrame.width}px)` } : undefined}
                        >
                          {(activeChat.avatars[message.senderId] || sender?.avatarUrl)
                            ? <img src={activeChat.avatars[message.senderId] || sender?.avatarUrl} alt="" className="h-full w-full object-cover" />
                            : sender?.name.trim().charAt(0) || '?'}
                        </span>
                      </button>
                    )}
                    <div className={`flex max-w-[78%] min-w-0 flex-col ${isUserMessage ? 'items-end' : 'items-start'}`}>
                    {richMenu}
                    <div className="relative max-w-full">
                    <div
                      onClick={() => handleMessageTap(message.id)}
                      {...messagePress(message.id)}
                      style={activeChat.fontSize ? { fontSize: `calc(${activeChat.fontSize}px * var(--font-scale, 1))` } : undefined}
                      className={`yy-chat-message-bubble ${isSpecialBubble ? 'is-special' : ''} ${isUserMessage ? 'is-user text-slate-800' : 'is-character text-slate-700'} rounded-2xl px-3 py-2 text-xs leading-relaxed`}
                    >
                      {message.replyTo && (
                        <div className="mb-1.5 rounded-lg border-l-2 border-sky-200/80 bg-white/55 px-2 py-1 text-[10px] leading-snug text-slate-400">
                          <span className="font-semibold text-slate-500">{message.replyTo.senderName}</span>
                          <p className="line-clamp-2">{message.replyTo.text}</p>
                        </div>
                      )}
                      {message.kind === 'video-call' ? (
                        <div className="flex min-w-40 items-center gap-3 rounded-2xl border border-white/80 bg-gradient-to-br from-sky-50 via-white/90 to-pink-50 px-3 py-3 text-[#4B6F86] shadow-[0_4px_14px_rgba(125,160,200,0.15)]">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100/80">
                            {message.text.startsWith('语音通话') ? <Phone className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                          </span>
                          <span>
                            <span className="block text-xs font-semibold">{message.text}</span>
                            {message.callStatus === 'ringing' && <span className="mt-1 block text-[10px] text-slate-400">等待你接听</span>}
                          </span>
                        </div>
                      ) : message.kind === 'location' ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-white/80 bg-gradient-to-br from-pink-50/90 to-sky-50/80 px-3 py-2 text-[#6B6F86] shadow-[0_4px_14px_rgba(200,150,180,0.15)]"><MapPin className="h-4 w-4 text-pink-400" />{message.text}</div>
                      ) : message.kind === 'red-packet' ? (
                        <button type="button" onClick={(event) => {
                          if (selectMode) return;
                          event.stopPropagation();
                          setActivePaymentId(message.id);
                        }} className={`block min-w-48 overflow-hidden rounded-lg text-left text-white ${message.paymentStatus === 'pending' || isUserMessage ? 'bg-[#f59d3b]' : 'bg-[#efc28f]'}`}>
                          <div className="flex items-center gap-3 px-3 pt-3"><Gift className="h-8 w-8 shrink-0" /><span className="font-semibold">{message.text || '恭喜发财，大吉大利'}</span></div>
                          {message.quantity && <p className="text-[10px] opacity-80">共 {message.quantity} 个</p>}
                          <p className="px-3 pb-3 pt-1 text-[10px]">{isUserMessage ? '已发出' : message.paymentStatus === 'pending' ? '点击领取红包' : '已领取'}</p>
                          <p className="border-t border-white/25 px-3 py-1 text-[9px]">{activeChat.type === 'group' ? '群聊红包' : '微信红包'}</p>
                        </button>
                      ) : message.kind === 'transfer' ? (
                        <button type="button" onClick={(event) => {
                          if (selectMode) return;
                          event.stopPropagation();
                          setActivePaymentId(message.id);
                        }} className={`block min-w-48 overflow-hidden rounded-lg text-left text-white ${message.paymentStatus === 'pending' || isUserMessage ? 'bg-[#f59d3b]' : 'bg-[#efc28f]'}`}>
                          <div className="flex items-center gap-3 px-3 pt-3"><Wallet className="h-8 w-8 shrink-0" /><span className="text-lg font-semibold">¥{message.amount}</span></div>
                          <p className="px-3 pb-3 pt-1 text-[10px]">{isUserMessage ? '转账已发出' : message.paymentStatus === 'pending' ? '待你确认收款' : message.paymentStatus === 'returned' ? '已退回' : '已收款'}</p>
                          <p className="border-t border-white/25 px-3 py-1 text-[9px]">微信转账</p>
                        </button>
                      ) : isShareCard ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (message.kind === 'forum-forward') setForumCardPreview(message);
                          }}
                          disabled={message.kind !== 'forum-forward'}
                          aria-label={message.kind === 'forum-forward' ? `查看论坛分享：${message.title || '帖子'}` : message.title}
                          className="block w-full min-w-48 max-w-64 overflow-hidden rounded-2xl border border-white/80 bg-white/80 text-left shadow-[0_8px_24px_rgba(79,113,145,0.12)] backdrop-blur-xl disabled:cursor-default"
                        >
                          <div className="px-3.5 py-3">
                            <p className="line-clamp-1 text-[12px] font-bold leading-5 text-[#2C4A5C]">
                              {message.title || (message.kind === 'pomodoro-share' ? '🍅 今日专注打卡战报' : '论坛分享')}
                            </p>
                            <p className="mt-1 line-clamp-3 whitespace-pre-line text-[10px] leading-relaxed text-slate-500">
                              {message.content || message.text}
                            </p>
                          </div>
                          <div className="mx-3.5 border-t border-slate-200/70" />
                          <div className="flex items-center gap-1.5 px-3.5 py-2 text-[9px] font-medium text-slate-400">
                            {message.kind === 'forum-forward'
                              ? <MessageSquare className="h-3 w-3 text-sky-500" />
                              : <Timer className="h-3 w-3 text-rose-400" />}
                            <span className="line-clamp-1">{message.source || (message.kind === 'forum-forward' ? '来自 论坛' : '来自 番茄钟 · 自习室')}</span>
                            {message.kind === 'forum-forward' && <span className="ml-auto shrink-0 text-sky-600">查看详情 ›</span>}
                          </div>
                        </button>
                      ) : message.kind === 'order' ? (
                        <div className="w-52 overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-sky-50/90 to-pink-50/90 shadow-[0_6px_18px_rgba(125,160,200,0.15)]">
                          <div className="flex items-center gap-1.5 px-3 pt-2.5 text-[10px] font-semibold text-[#6F8CA0]">
                            <span>{message.orderCategory === 'eleme' ? '🍱 饿了么' : message.orderCategory === 'xianyu' ? '🐟 闲鱼' : '🛍️ 淘宝'}</span>
                            <span className="ml-auto rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] text-pink-400">
                              {message.orderMode === 'gift' ? (message.senderId === 'user' ? '送出的礼物' : '送你的礼物') : '已下单'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 px-3 py-2.5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/80 text-2xl">
                              {message.imageUrl
                                ? <img src={message.imageUrl} alt="" className="h-full w-full object-cover" />
                                : message.productEmoji || '🎁'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-[11px] font-bold leading-snug text-[#2C4A5C]">{message.title}</p>
                              {message.content && <p className="mt-0.5 line-clamp-1 text-[9px] text-slate-400">{message.content}</p>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between border-t border-white/80 px-3 py-1.5 text-[10px]">
                            <span className="truncate text-slate-400">{message.source}</span>
                            {message.amount && <span className="shrink-0 font-bold text-[#E882A6]">¥{message.amount}</span>}
                          </div>
                        </div>
                      ) : message.kind === 'phone-share' ? (
                        <div className="w-52 overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-sky-50/90 to-pink-50/90 shadow-[0_6px_18px_rgba(125,160,200,0.15)]">
                          <div className="px-3 pt-2.5 text-[10px] font-semibold text-[#6F8CA0]">
                            {message.shareMode === 'memory' ? '🫧 TA的记忆' : '📱 我查到的手机内容'}
                          </div>
                          <p className="px-3 pt-1.5 text-[11px] font-bold leading-snug text-[#2C4A5C]">{message.title}</p>
                          {message.content && <p className="line-clamp-3 px-3 py-1.5 text-[10px] leading-snug text-slate-500">{message.content}</p>}
                          <div className="border-t border-white/80 px-3 py-1.5 text-[9px] text-slate-400">{message.source}</div>
                        </div>
                      ) : message.kind === 'intimate-pay' ? (
                        <div className="w-52 overflow-hidden rounded-2xl border border-pink-100 bg-pink-50 text-slate-600">
                          <p className="px-3 pt-3 text-xs font-semibold">亲密付 · {isUserMessage ? '申请' : '角色决定'}</p>
                          {message.amount && <p className="px-3 pt-2 text-lg font-bold text-pink-600">¥{message.amount}<span className="ml-1 text-[10px] font-normal">/ 月</span></p>}
                          <p className="px-3 py-2 text-[11px]">{message.text}</p>
                          <p className="border-t border-pink-100 px-3 py-2 text-[10px] text-slate-400">{message.intimateStatus === 'pending' ? '待角色回应，请生成回复' : message.intimateStatus === 'granted' ? '角色已同意 · 可在支付宝查看' : '角色已婉拒'}</p>
                        </div>
                      ) : message.kind === 'couple-invite' ? (
                        <div className="w-52 overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-pink-50/90 to-sky-50/90 shadow-[0_6px_18px_rgba(125,160,200,0.15)]">
                          <div className="px-3 pt-2.5 text-[10px] font-semibold text-[#6F8CA0]">💞 情侣空间邀请</div>
                          <p className="px-3 py-2 text-[11px] font-bold leading-snug text-[#2C4A5C]">
                            {message.title || '邀请你开通情侣空间'}
                          </p>
                          <div className="border-t border-white/80 px-3 py-2 text-[10px]">
                            {message.inviteStatus === 'pending' && message.inviteFrom === 'char' ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const chatId = activeChat?.id;
                                    const charId = activeChat?.participantIds[0];
                                    if (!chatId || !charId) return;
                                    updateCoupleSpace(charId, (space) => ({
                                      ...space,
                                      bindStatus: 'bound',
                                      startDate: localDateString(),
                                    }));
                                    updateChat(chatId, (current) => ({
                                      ...current,
                                      messages: [
                                        ...current.messages.map((item) =>
                                          item.id === message.id ? { ...item, inviteStatus: 'accepted' as const } : item
                                        ),
                                        {
                                          id: `message-${Date.now()}-couple`,
                                          senderId: 'user',
                                          text: '我同意啦，我们一起开通情侣空间吧 💞',
                                          createdAt: new Date().toISOString(),
                                        },
                                      ],
                                    }));
                                  }}
                                  className="flex-1 rounded-full bg-gradient-to-r from-[#E8A9BE] to-[#9FC4E2] py-1 font-bold text-white"
                                >
                                  同意
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const chatId = activeChat?.id;
                                    const charId = activeChat?.participantIds[0];
                                    if (!chatId || !charId) return;
                                    updateCoupleSpace(charId, (space) => ({ ...space, bindStatus: 'unbound' }));
                                    updateChat(chatId, (current) => ({
                                      ...current,
                                      messages: current.messages.map((item) =>
                                        item.id === message.id ? { ...item, inviteStatus: 'declined' as const } : item
                                      ),
                                    }));
                                  }}
                                  className="rounded-full bg-white/80 px-3 py-1 text-slate-400"
                                >
                                  婉拒
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                {message.inviteStatus === 'accepted' ? '已同意 · 空间已开通' : message.inviteStatus === 'declined' ? '已婉拒' : message.inviteStatus === 'withdrawn' ? '已撤回' : '等待对方回应'}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : message.kind === 'link' ? (
                        <div className="min-w-40 rounded-xl bg-white/80 p-2.5">
                          <div className="flex items-center gap-1.5 font-semibold"><Link className="h-3.5 w-3.5 text-sky-600" />{message.title}</div>
                          {message.content && <p className="mt-1 line-clamp-3 text-[10px] text-slate-500">{message.content}</p>}
                          {message.source && <p className="mt-1 text-[9px] text-slate-400">{message.source}</p>}
                        </div>
                      ) : message.kind === 'sticker' && message.imageUrl ? (
                        <img src={message.imageUrl} alt={message.text} className="h-24 w-24 rounded-xl object-contain" />

                      ) : message.kind === 'voice' ? (
                        (() => {
                          // 微信式语音条：开启语音的角色点一下播放/停止，“转文字”展开转写；其他语音条点一下展开文字
                          const seconds = Math.min(60, Math.max(1, Math.ceil(message.text.length / 3.5)));
                          const open = expandedVoiceIds.includes(message.id);
                          const playable = !!getVoiceSpeaker(message);
                          const playing = voicePlaybackMessageId === message.id;
                          const loading = voiceLoadingMessageId === message.id;
                          const toggleText = () => setExpandedVoiceIds((ids) => (ids.includes(message.id) ? ids.filter((id) => id !== message.id) : [...ids, message.id]));
                          return (
                            <div>
                              <div className={`flex items-center gap-2 ${isUserMessage ? 'flex-row-reverse' : ''}`}>
                                <button
                                  type="button"
                                  aria-label={playable ? (playing || loading ? '停止播放语音' : '播放语音') : (open ? '收起语音文字' : '展开语音文字')}
                                  onClick={(event) => {
                                    if (selectMode) return;
                                    event.stopPropagation();
                                    if (!toggleCharacterVoice(message)) toggleText();
                                  }}
                                  className={`flex items-center gap-2 text-[#6F8CA0] ${isUserMessage ? 'flex-row-reverse' : ''}`}
                                  style={{ minWidth: `${Math.min(150, 48 + seconds * 4)}px` }}
                                >
                                  <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${isUserMessage ? '-scale-x-100' : ''} ${playing ? 'animate-pulse text-teal-600' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M8 9a4.5 4.5 0 0 1 0 6" />
                                    <path d="M12 6.5a8.5 8.5 0 0 1 0 11" />
                                    <path d="M16 4a12.5 12.5 0 0 1 0 16" />
                                  </svg>
                                  <span className="text-[12px]">{loading ? '合成中…' : `${seconds}″`}</span>
                                </button>
                                {playable && (
                                  <button type="button" onClick={(event) => { if (selectMode) return; event.stopPropagation(); toggleText(); }}
                                    className="text-[10px] text-slate-400">
                                    {open ? '收起' : '转文字'}
                                  </button>
                                )}
                              </div>
                              {open && <p className="mt-1.5 border-t border-slate-200/60 pt-1.5 text-[11px] leading-relaxed text-slate-600">{message.text}</p>}
                            </div>
                          );
                        })()
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
                    {message.reactions && message.reactions.length > 0 && (
                      <div className={`absolute -top-3 flex gap-0.5 ${isUserMessage ? '-left-2' : '-right-2'}`}>
                        {message.reactions.map((reaction) => (
                          <span
                            key={`${reaction.by}-${reaction.emoji}`}
                            className="rounded-full border border-white/90 bg-white/90 px-1 py-0.5 text-[11px] leading-none shadow-[0_2px_8px_rgba(125,150,185,0.25)]"
                          >
                            {reaction.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                    </div>
                    {editor}
                    {messageActions}
                    </div>
                  </div>
                );
                })();
                return [divider, rendered];
              })}
            </div>
            {selectMode ? (
              <div className="flex items-center justify-between gap-2 border-t border-white/70 bg-white/80 p-3">
                <button type="button" onClick={exitSelectMode} className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">取消</button>
                <span className="text-[11px] text-slate-500">已选 {selectedIds.length} 条</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={selectedIds.length === 0}
                    onClick={() => { setForwardTargetIds([]); setForwardOpen(true); }}
                    className="rounded-xl bg-gradient-to-r from-[#fbcfe8] to-[#bae6fd] px-3 py-2 text-xs font-bold text-[#2C4A5C] disabled:opacity-40"
                  >
                    转发
                  </button>
                  <button
                    type="button"
                    disabled={selectedIds.length === 0}
                    onClick={deleteSelectedMessages}
                    className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500 disabled:opacity-40"
                  >
                    删除
                  </button>
                </div>
              </div>
            ) : activeChat.blocked ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white/70 p-3">
                <p className="text-xs text-rose-600">此对话已拉黑，无法发送消息。</p>
                <button type="button" onClick={() => openChatSettings(activeChat)}
                  className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700">
                  修改设置 / 解除拉黑
                </button>
              </div>
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
                <button type="submit" aria-label="发送旁白" className="yy-chat-send flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: '#F0E1F0', color: '#88758A' }}>
                  {chatAppearance.sendIconUrl
                    ? <img src={chatAppearance.sendIconUrl} alt="" className="h-5 w-5 object-contain" />
                    : <Send className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  disabled={isGeneratingReply}
                  onClick={() => void generateAiReply()}
                  className="yy-chat-generate h-9 w-9 shrink-0 rounded-xl text-lg leading-none disabled:opacity-50"
                  style={{ backgroundColor: '#EBEBF5', color: '#77778A' }}
                >
                  ♡
                </button>
              </form>
            ) : (
              <>
              {replyingTo && (
                <div className="flex items-center gap-2 border-t border-white/70 bg-white/70 px-3 pt-2 text-[10px] text-slate-400">
                  <span className="h-6 w-0.5 shrink-0 rounded-full bg-sky-200" />
                  <p className="min-w-0 flex-1 truncate">
                    回复 <span className="font-semibold text-slate-500">{makeReplyRef(activeChat, replyingTo).senderName}</span>：{describeMessageBrief(replyingTo)}
                  </p>
                  <button type="button" aria-label="取消引用" onClick={() => setReplyingTo(null)} className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-slate-400">✕</button>
                </div>
              )}
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
                  aria-label="打开表情面板"
                  onClick={() => setEmojiPanelOpen((open) => !open)}
                  className="yy-chat-emoji h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <input
                  value={chatMessageDraft}
                  onChange={(event) => setChatMessageDraft(event.target.value)}
                  placeholder="输入消息"
                  aria-label="输入聊天消息"
                  enterKeyHint="send"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                />
                <button
                  type="button"
                  aria-label="生成角色回复"
                  disabled={isGeneratingReply}
                  onClick={() => void generateAiReply()}
                  className="yy-chat-generate h-9 w-9 shrink-0 rounded-xl text-lg leading-none disabled:opacity-50"
                  style={{ backgroundColor: '#EBEBF5', color: '#77778A' }}
                >
                  ♡
                </button>
                {emojiPanelOpen && (
                  <div className="absolute bottom-full left-2 right-2 z-40 mb-2 rounded-2xl border border-white/80 bg-gradient-to-b from-white/95 to-[#f4f8fc]/95 p-2.5 shadow-xl backdrop-blur">
                    <div className="flex items-center gap-1.5">
                      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                        {stickerCategories.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setStickerCategory(name)}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${stickerCategory === name ? 'bg-gradient-to-r from-pink-100 to-sky-100 font-semibold text-[#6F7F8E]' : 'text-slate-400'}`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => setStickerManageOpen((open) => !open)} className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
                        {stickerManageOpen ? '返回' : '管理'}
                      </button>
                    </div>
                    {!stickerManageOpen ? (
                      <div className="mt-2 grid h-44 grid-cols-4 content-start gap-x-1 gap-y-2 overflow-y-auto">
                        {stickersInCategory.map((sticker) => (
                          <button key={sticker.id} type="button" onClick={() => sendSticker(sticker)} className="rounded-lg p-1 hover:bg-slate-100 active:scale-95">
                            <img src={sticker.imageUrl} alt={sticker.description} className="mx-auto h-14 w-14 object-contain" />
                            <span className="mt-0.5 block truncate text-[9px] text-slate-500">{sticker.description}</span>
                          </button>
                        ))}
                        {stickersInCategory.length === 0 && (
                          <p className="col-span-4 pt-12 text-center text-[11px] text-slate-400">这个分类还没有表情包，点右上「管理」导入吧</p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 h-44 space-y-2 overflow-y-auto text-[10px]">
                        <p className="text-slate-400">当前分类：{stickerCategory}。一行一个，格式「名称: 图片链接」（英文冒号+空格）。</p>
                        <textarea
                          value={stickerImportText}
                          onChange={(event) => setStickerImportText(event.target.value)}
                          placeholder={'开心: https://example.com/a.png\n委屈: https://example.com/b.gif'}
                          aria-label="批量导入表情包"
                          className="h-16 w-full resize-none rounded-lg border border-slate-200 bg-white/80 p-2 outline-none"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={importStickerLines} className="rounded-lg bg-gradient-to-r from-pink-100 to-sky-100 px-3 py-1.5 font-semibold text-[#6F7F8E]">导入到此分类</button>
                          <button type="button" onClick={() => void exportStickerCategory()} className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-500">导出此分类</button>
                          <button type="button" onClick={() => stickerUploadRef.current?.click()} disabled={isProcessingChatImage} className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-500">
                            {isProcessingChatImage ? '压缩中…' : '上传本地图片'}
                          </button>
                        </div>
                        {stickerNotice && <p className="text-pink-400">{stickerNotice}</p>}
                        {stickerDrafts.map((sticker) => (
                          <div key={sticker.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-1.5">
                            <img src={sticker.imageUrl} alt="" className="h-9 w-9 object-contain" />
                            <input
                              value={sticker.description}
                              onChange={(event) => setStickerDrafts((drafts) => drafts.map((item) =>
                                item.id === sticker.id ? { ...item, description: event.target.value } : item
                              ))}
                              placeholder="必填：表情包名称"
                              aria-label="表情包名称"
                              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 outline-none"
                            />
                            <button type="button" onClick={() => saveSticker(sticker)} className="font-semibold text-[#6F7F8E]">保存</button>
                          </div>
                        ))}
                        <div className="flex gap-1.5">
                          <input
                            value={stickerNewCategory}
                            onChange={(event) => setStickerNewCategory(event.target.value)}
                            placeholder="新分类名称"
                            aria-label="新分类名称"
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 outline-none"
                          />
                          <button type="button" onClick={addStickerCategory} className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-500">新建分类</button>
                          {stickerCategory !== DEFAULT_STICKER_CATEGORY && !BUILTIN_STICKERS.some((item) => item.category === stickerCategory) && (
                            <button type="button" onClick={deleteStickerCategory} className="rounded-lg bg-rose-50 px-3 py-1.5 text-rose-400">删除分类</button>
                          )}
                        </div>
                        {stickersInCategory.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {stickersInCategory.map((sticker) => (
                              <span key={sticker.id} className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">
                                {sticker.description}
                                {!sticker.id.startsWith('builtin-') && (
                                <button
                                  type="button"
                                  aria-label={`删除${sticker.description}`}
                                  onClick={() => persistStickers(stickers.filter((item) => item.id !== sticker.id))}
                                  className="text-rose-300"
                                >×</button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {composerOpen && (
                  <div
                    className="absolute bottom-full left-0 right-0 z-30 border-t border-white/70 bg-gradient-to-b from-white/95 to-[#f4f8fc]/95 px-4 pb-2 pt-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]"
                    onTouchStart={(event) => { composerTouchStartX.current = event.touches[0].clientX; }}
                    onTouchEnd={(event) => {
                      const deltaX = event.changedTouches[0].clientX - composerTouchStartX.current;
                      if (Math.abs(deltaX) > 40) setComposerPage(deltaX < 0 ? 1 : 0);
                    }}
                  >
                    <div className="grid min-h-[132px] grid-cols-4 content-start gap-y-4">
                    {([
                      { page: 0, title: '照片', icon: ImagePlus, run: () => openAttachment('photo') },
                      { page: 0, title: '拍摄', icon: Camera, run: () => openAttachment('camera') },
                      { page: 0, title: '视频通话', icon: Video, run: () => {
                        setComposerOpen(false);
                        setCallChoiceOpen(true);
                      } },
                      { page: 0, title: '位置', icon: MapPin, run: () => openAttachment('location') },
                      { page: 0, title: '红包', icon: Gift, run: () => openAttachment('red-packet') },
                      { page: 0, title: '重新生成', icon: RefreshCw, run: handleRegenerate },
                      { page: 0, title: '转账', icon: Wallet, run: () => openAttachment('transfer') },
                      { page: 0, title: '链接', icon: Link, run: () => openAttachment('link') },
                      { page: 1, title: '语音', icon: Mic, run: () => {
                        setComposerOpen(false);
                        setVoiceDraft('');
                        setVoiceModalOpen(true);
                      } },
                      { page: 1, title: '聊天存档', icon: Archive, run: () => {
                        setComposerOpen(false);
                        setArchiveOpen(true);
                      } },
                    ]).filter((item) => item.page === composerPage).map(({ title, icon: Icon, run }) => (
                      <button key={title} type="button" onClick={run} className="flex flex-col items-center gap-1.5 text-[10px] text-slate-600">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-50 to-sky-50 text-[#6F8CA0] shadow-sm">
                          <Icon className="h-5 w-5" />
                        </span>
                        {title}
                      </button>
                    ))}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      {[0, 1].map((page) => (
                        <button
                          key={page}
                          type="button"
                          aria-label={`第${page + 1}页`}
                          onClick={() => setComposerPage(page)}
                          className="flex h-6 w-8 items-center justify-center"
                        >
                          <span className={`h-1.5 rounded-full transition-all ${composerPage === page ? 'w-4 bg-[#9DB8CC]' : 'w-1.5 bg-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </form>
              </>
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
            <section className="space-y-1.5">
              <h3 className="px-1 text-[11px] font-bold text-slate-400">
                新的朋友{blockedInteractions.filter((item) => item.type === 'friend-request' && item.status === 'pending').length > 0
                  ? ` · ${blockedInteractions.filter((item) => item.type === 'friend-request' && item.status === 'pending').length}` : ''}
              </h3>
              <div className="glass-card divide-y divide-slate-100/60 overflow-hidden rounded-2xl">
                {blockedInteractions.filter((item) => item.type === 'friend-request' && item.status === 'pending').map((request) => (
                  <div key={request.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#2C4A5C]">{request.charName}</span>
                      <span className="text-[9px] text-slate-400">{new Date(request.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{request.message}</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button type="button" onClick={() => {
                        try {
                          updateBlockedInteraction(request.id, 'rejected');
                          setBlockedInteractions(readBlockedInteractions());
                        } catch (error) {
                          console.error('Could not reject blocked-contact friend request.', error);
                          showYyError(error instanceof Error ? error.message : '拒绝好友申请失败。');
                        }
                      }} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-600">拒绝</button>
                      <button type="button" onClick={() => {
                        try {
                          updateBlockedInteraction(request.id, 'accepted');
                          setBlockedInteractions(readBlockedInteractions());
                          setChats(readStoredValue(CHATS_STORAGE_KEY, [], isChatList));
                        } catch (error) {
                          console.error('Could not accept blocked-contact friend request.', error);
                          showYyError(error instanceof Error ? error.message : '接受好友申请失败。');
                        }
                      }} className="rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-semibold text-white">接受并解除拉黑</button>
                    </div>
                  </div>
                ))}
                {!blockedInteractions.some((item) => item.type === 'friend-request' && item.status === 'pending') && (
                  <p className="px-3 py-3 text-[10px] text-slate-400">暂无新的好友申请</p>
                )}
              </div>
            </section>
            {Object.keys(contactsByGroup).sort((a, b) => a.localeCompare(b, 'zh-CN')).map((group) => (
              <section key={group} className="space-y-1.5">
                <h3 className="px-1 text-[11px] font-bold text-slate-400">{group}</h3>
                <div className="glass-card rounded-2xl divide-y divide-slate-100/60 overflow-hidden">
                  {contactsByGroup[group].map((contact) => (
                    <div key={contact.id}>
                      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/40">
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
                          {contact.bio?.trim() && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">{contact.bio.trim()}</p>
                          )}
                        </div>
                        {contact.worldBooks.length > 0 && (
                          <span className="shrink-0 text-[9px] text-slate-400">
                            世界书 {contact.worldBooks.length}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={`编辑角色：${contact.name}`}
                          onClick={() => openContactEditor(contact)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/70"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
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
          <MomentsTab
            userName={personaDraft.name}
            userAvatarUrl={personaDraft.avatarUrl ?? ''}
            contacts={contacts}
            npcs={characterNpcs}
          />
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
              {([
                { title: '我的气泡', colorKey: 'userBubbleColor', opacityKey: 'userBubbleOpacity' },
                { title: '对方气泡（角色，群聊共用）', colorKey: 'characterBubbleColor', opacityKey: 'characterBubbleOpacity' },
              ] as const).map(({ title, colorKey, opacityKey }) => (
                <section key={colorKey} className="space-y-2 rounded-xl border border-white/80 bg-white/50 p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-[#2C4A5C]">{title}</h4>
                    <button
                      type="button"
                      onClick={() => updateChatAppearance({ [colorKey]: DEFAULT_CHAT_APPEARANCE[colorKey], [opacityKey]: DEFAULT_CHAT_APPEARANCE[opacityKey] })}
                      className="text-[10px] text-slate-500 underline"
                    >
                      恢复默认
                    </button>
                  </div>
                  <ColorWheel
                    label={title}
                    value={chatAppearance[colorKey]}
                    onChange={(hex) => updateChatAppearance({ [colorKey]: hex })}
                  />
                  <label className="block text-[10px] font-semibold text-slate-500">
                    透明度 {Math.round((chatAppearance[opacityKey] ?? 0.78) * 100)}%
                    <input
                      type="range"
                      min="30"
                      max="100"
                      value={Math.round((chatAppearance[opacityKey] ?? 0.78) * 100)}
                      onChange={(event) => updateChatAppearance({ [opacityKey]: Number(event.target.value) / 100 })}
                      className="mt-1 w-full"
                    />
                  </label>
                  <div className="flex">
                    <div
                      className={`rounded-2xl border border-white/60 px-3 py-2 text-xs text-slate-700 ${colorKey === 'userBubbleColor' ? 'ml-auto' : ''}`}
                      style={{ backgroundColor: hexToRgba(chatAppearance[colorKey], chatAppearance[opacityKey] ?? 0.78), backdropFilter: 'blur(10px)' }}
                    >
                      气泡预览
                    </div>
                  </div>
                </section>
              ))}
              <AvatarFrameEditor
                title="我的头像框"
                description="聊天里我的头像外面的渐变边框。"
                value={chatAppearance.userAvatarFrame}
                onChange={(next) => updateChatAppearance({ userAvatarFrame: next })}
                previewUrl={personaDraft.avatarUrl}
                previewText={personaDraft.name.trim().charAt(0) || '我'}
                radiusClass="rounded-xl"
              />
              <AvatarFrameEditor
                title="对方头像框（角色，群聊共用）"
                description="聊天里角色头像外面的渐变边框。"
                value={chatAppearance.characterAvatarFrame}
                onChange={(next) => updateChatAppearance({ characterAvatarFrame: next })}
                previewText="TA"
                radiusClass="rounded-xl"
              />
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
                    <button
                      type="button"
                      disabled={!chatAppearance[key]}
                      onClick={() => updateChatAppearance({ [key]: '' })}
                      className="w-full rounded-lg bg-rose-50 py-2 text-[10px] font-semibold text-rose-500 disabled:opacity-40"
                    >
                      恢复默认{label}
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
              {chatCreateMode === 'direct' ? '选择一位通讯录角色。' : '可选择通讯录角色与依附于角色的 NPC（至少两位）。'}
            </p>
            <div className="space-y-1 rounded-2xl border border-white/80 bg-white/65 p-2 backdrop-blur-xl">
              <p className="px-2 pt-1 text-[10px] font-bold text-slate-400">通讯录角色</p>
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
                <p className="rounded-xl p-3 text-center text-xs text-slate-500">通讯录暂无角色，请先添加角色。</p>
              )}
            </div>
            {chatCreateMode !== 'direct' && (
              <div className="space-y-1 rounded-2xl border border-pink-100/80 bg-gradient-to-br from-[#9BD2FC]/15 to-[#F7B9D2]/20 p-2 backdrop-blur-xl">
                <p className="px-2 pt-1 text-[10px] font-bold text-slate-500">关联 NPC</p>
                {characterNpcs.map((npc) => (
                  <label key={npc.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/70">
                    <input
                      type="checkbox"
                      checked={selectedParticipantIds.includes(npcParticipantId(npc.id))}
                      onChange={() => {
                        const participantId = npcParticipantId(npc.id);
                        setSelectedParticipantIds((ids) =>
                          ids.includes(participantId)
                            ? ids.filter((id) => id !== participantId)
                            : [...ids, participantId]
                        );
                        setChatError('');
                      }}
                    />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-xs font-bold text-white">
                      {npc.avatarUrl
                        ? <img src={npc.avatarUrl} alt="" className="h-full w-full object-cover" />
                        : npc.name.charAt(0)}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#2C4A5C]">{npc.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {npc.linkedCharIds.map((id) => contacts.find((contact) => contact.id === id)?.name ?? '已删除角色').join('、')}关联
                    </span>
                  </label>
                ))}
                {characterNpcs.length === 0 && (
                  <p className="rounded-xl p-3 text-center text-xs text-slate-400">还没有关联 NPC，可在角色编辑页创建。</p>
                )}
              </div>
            )}
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
            {chatSettingsDraft.type !== 'direct' && (
              <section className="space-y-2 rounded-2xl border border-sky-100 bg-gradient-to-br from-[#9BD2FC]/15 to-[#F7B9D2]/20 p-3">
                <p className="text-[11px] font-semibold text-[#2C4A5C]">群成员（角色与关联 NPC）</p>
                <div className="max-h-44 space-y-1 overflow-y-auto">
                  {contacts.map((contact) => (
                    <label key={contact.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/70">
                      <input
                        type="checkbox"
                        checked={chatSettingsDraft.participantIds.includes(contact.id)}
                        onChange={() => setChatSettingsDraft({
                          ...chatSettingsDraft,
                          participantIds: chatSettingsDraft.participantIds.includes(contact.id)
                            ? chatSettingsDraft.participantIds.filter((id) => id !== contact.id)
                            : [...chatSettingsDraft.participantIds, contact.id],
                        })}
                      />
                      <span className="text-xs text-slate-700">{contact.name}</span>
                    </label>
                  ))}
                  {characterNpcs.map((npc) => {
                    const participantId = npcParticipantId(npc.id);
                    return (
                      <label key={npc.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/70">
                        <input
                          type="checkbox"
                          checked={chatSettingsDraft.participantIds.includes(participantId)}
                          onChange={() => setChatSettingsDraft({
                            ...chatSettingsDraft,
                            participantIds: chatSettingsDraft.participantIds.includes(participantId)
                              ? chatSettingsDraft.participantIds.filter((id) => id !== participantId)
                              : [...chatSettingsDraft.participantIds, participantId],
                          })}
                        />
                        <span className="text-xs text-slate-700">{npc.name}</span>
                        <span className="ml-auto text-[10px] text-slate-400">
                          ({npc.linkedCharIds.map((id) => contacts.find((contact) => contact.id === id)?.name ?? '已删除角色').join('、')}关联)
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}
            {chatSettingsDraft.type === 'direct' && (
              <section className="space-y-2 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
                  <span>允许角色主动发消息</span>
                  <input
                    type="checkbox"
                    checked={chatSettingsDraft.proactiveEnabled ?? false}
                    onChange={(event) => setChatSettingsDraft({
                      ...chatSettingsDraft,
                      proactiveEnabled: event.target.checked,
                      proactiveIntervalMinutes: chatSettingsDraft.proactiveIntervalMinutes ?? 30,
                    })}
                  />
                </label>
                {chatSettingsDraft.proactiveEnabled && (
                  <label className="block text-[11px] text-slate-600">
                    主动消息间隔（分钟）
                    <input type="number" min={1} max={1440} value={chatSettingsDraft.proactiveIntervalMinutes ?? 30}
                      onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, proactiveIntervalMinutes: Number(event.target.value) })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
                  </label>
                )}
                <p className="text-[10px] leading-relaxed text-slate-400">距离本对话最近活动达到间隔后主动联系；逐个调度，不补发离线期间的消息。需保持网页运行，后台可在系统设置尝试开启保活，会额外消耗 API。</p>
              </section>
            )}
            {chatSettingsDraft.type === 'direct' && (
              <section className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-3">
                <h3 className="text-xs font-semibold text-slate-700">拉黑后的联系</h3>
                <label className="block text-[11px] text-slate-600">
                  联系时间
                  <input type="number" min={1} max={10080}
                    value={chatSettingsDraft.blockedDelayMinutes ?? 60}
                    onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, blockedDelayMinutes: Number(event.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
                </label>
                <label className="block text-[11px] text-slate-600">
                  触发方式
                  <select value={chatSettingsDraft.blockedTiming ?? 'after'}
                    onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, blockedTiming: event.target.value as 'after' | 'within' })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                    <option value="after">间隔到达后联系</option>
                    <option value="within">在设定时间内随机联系</option>
                  </select>
                </label>
                <label className="block text-[11px] text-slate-600">
                  联系方式
                  <select value={chatSettingsDraft.blockedActivity ?? 'both'}
                    onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, blockedActivity: event.target.value as 'friend' | 'paper' | 'both' })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                    <option value="both">好友申请与匿名小纸条交替</option>
                    <option value="friend">仅发送好友申请</option>
                    <option value="paper">仅发送匿名小纸条</option>
                  </select>
                </label>
                <p className="text-[10px] leading-relaxed text-slate-500">
                  时间单位为分钟（1–10080）。随机时间模式需要在系统设置开启后台保活；页面关闭或浏览器停止运行时无法保证准时执行。拉黑期间不会发送普通聊天消息。
                </p>
              </section>
            )}
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
            <section className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
              <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>角色感知当前时间</span>
                <input type="checkbox" checked={chatSettingsDraft.timeAwarenessEnabled !== false}
                  onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, timeAwarenessEnabled: event.target.checked })} />
              </label>
              {chatSettingsDraft.timeAwarenessEnabled !== false && (
                <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                  聊天时区
                  <select value={chatSettingsDraft.timeZone ?? ''}
                    onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, timeZone: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                    <option value="">跟随设备时区</option>
                    <option value="Asia/Shanghai">中国标准时间（上海）</option>
                    <option value="Asia/Hong_Kong">香港</option>
                    <option value="Asia/Taipei">台北</option>
                    <option value="Asia/Tokyo">东京</option>
                    <option value="Asia/Seoul">首尔</option>
                    <option value="Asia/Singapore">新加坡</option>
                    <option value="Asia/Bangkok">曼谷</option>
                    <option value="Europe/London">伦敦</option>
                    <option value="Europe/Paris">巴黎</option>
                    <option value="America/Los_Angeles">洛杉矶</option>
                    <option value="America/New_York">纽约</option>
                    <option value="Australia/Sydney">悉尼</option>
                  </select>
                </label>
              )}
              <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span>启用生图（角色发图片时生成真实图片）</span>
                <input type="checkbox" checked={chatSettingsDraft.imageGenerationEnabled ?? false}
                  onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, imageGenerationEnabled: event.target.checked })} />
              </label>
              {chatSettingsDraft.imageGenerationEnabled && (
                <>
                  <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                    生图附加提示词（选填）
                    <textarea value={chatSettingsDraft.imageGenerationPrompt ?? ''}
                      onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, imageGenerationPrompt: event.target.value })}
                      maxLength={2000} rows={3} placeholder="例如：画风、角色外貌；留空则不添加"
                      className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none" />
                  </label>
                  <p className="text-[10px] leading-relaxed text-slate-400">开启后，角色回复图片消息时会把图片描述（加上附加提示词）发给生图服务生成真实图片；失败时保留文字描述。生图服务商、接口、Key 和模型请在系统设置的“生图模型”中配置。</p>
                </>
              )}
            </section>
            {chatSettingsDraft.type !== 'direct' && (
              <GroupJournalPanel key={`${chatSettingsDraft.id}:${chatSettingsDraft.activeArchiveId ?? 'archive-default'}`}
                chatId={chatSettingsDraft.id} />
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
                  fallback: participantAvatar(id),
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
              <p className="text-[11px] font-semibold text-[#2C4A5C]">挂载聊天记录</p>
              <label className="block text-[10px] text-slate-500">
                本对话聊天记录
                <input
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={chatSettingsDraft.currentChatHistoryCount ?? 200}
                  onChange={(event) => setChatSettingsDraft({
                    ...chatSettingsDraft,
                    currentChatHistoryCount: event.target.value === '' ? 0 : Number(event.target.value),
                  })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                />
                <span className="mt-1 block text-[9px] text-slate-400">默认 200 条，最多 5000 条。</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] font-semibold text-[#2C4A5C]">
                <input
                  type="checkbox"
                  checked={chatSettingsDraft.attachHistory ?? false}
                  onChange={(event) => setChatSettingsDraft({
                    ...chatSettingsDraft,
                    attachHistory: event.target.checked,
                  })}
                />
                挂载其他消息的聊天记录
              </label>
              {chatSettingsDraft.attachHistory && (
                <>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                    {chats.filter((conversation) => conversation.id !== chatSettingsDraft.id).map((conversation) => {
                      const selected = getAttachedHistoryChatIds(chatSettingsDraft).includes(conversation.id);
                      return (
                        <div key={conversation.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[10px] text-slate-600 hover:bg-slate-50">
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) => {
                                const selectedIds = getAttachedHistoryChatIds(chatSettingsDraft);
                                const nextIds = event.target.checked
                                  ? [...selectedIds, conversation.id]
                                  : selectedIds.filter((id) => id !== conversation.id);
                                setChatSettingsDraft({
                                  ...chatSettingsDraft,
                                  attachedHistoryChatIds: nextIds,
                                  attachedHistoryCounts: {
                                    ...(chatSettingsDraft.attachedHistoryCounts ?? {}),
                                    ...(event.target.checked && chatSettingsDraft.attachedHistoryCounts?.[conversation.id] === undefined
                                      ? { [conversation.id]: 200 }
                                      : {}),
                                  },
                                });
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate">{getChatTitle(conversation)}</span>
                            <span className="shrink-0 text-slate-400">{conversation.messages.length} 条</span>
                          </label>
                          {selected && (
                            <input
                              aria-label={`${getChatTitle(conversation)}挂载条数`}
                              type="number"
                              min="1"
                              max="1000"
                              step="1"
                              value={getAttachedHistoryCount(chatSettingsDraft, conversation.id)}
                              onChange={(event) => setChatSettingsDraft({
                                ...chatSettingsDraft,
                                attachedHistoryCounts: {
                                  ...(chatSettingsDraft.attachedHistoryCounts ?? {}),
                                  [conversation.id]: event.target.value === '' ? 0 : Number(event.target.value),
                                },
                              })}
                              className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] outline-none"
                            />
                          )}
                        </div>
                      );
                    })}
                    {chats.filter((conversation) => conversation.id !== chatSettingsDraft.id).length === 0 && (
                      <p className="p-2 text-center text-[10px] text-slate-400">消息列表中还没有其他聊天记录</p>
                    )}
                  </div>
                  <p className="text-[9px] leading-relaxed text-slate-400">可多选任意其他单聊、群聊或旁观群聊，并分别设置挂载条数；AI 会读取名称、成员及逐条来源，旁观群聊会注明玩家不在群内。有群流水账时也会补充原文窗口之前的摘要，不写入角色个人记忆，不修改原记录。</p>
                </>
              )}
            </section>
            <section className="space-y-2 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-[#2C4A5C]">聊天字体大小</p>
                <span className="text-[10px] text-slate-500">{chatSettingsDraft.fontSize ?? 12}px</span>
              </div>
              <input
                type="range"
                min="10"
                max="20"
                step="1"
                value={chatSettingsDraft.fontSize ?? 12}
                onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, fontSize: Number(event.target.value) })}
                aria-label="聊天字体大小"
                className="w-full"
              />
              <div className="flex items-center justify-between">
                <p className="text-slate-600" style={{ fontSize: `calc(${chatSettingsDraft.fontSize ?? 12}px * var(--font-scale, 1))` }}>预览：今天天气真好呀</p>
                <button
                  type="button"
                  onClick={() => setChatSettingsDraft({ ...chatSettingsDraft, fontSize: undefined })}
                  className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] text-slate-500"
                >
                  恢复默认
                </button>
              </div>
            </section>
            <section className="space-y-2 rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold text-[#2C4A5C]">角色消息数</p>
              <p className="text-[9px] leading-relaxed text-slate-400">
                每次生成时随机决定连续消息条数。
                {chatSettingsDraft.type === 'direct'
                  ? '单聊默认 1–6 条。'
                  : `群聊默认 ${getDefaultReplyMessageRange(chatSettingsDraft).min}–${getDefaultReplyMessageRange(chatSettingsDraft).max} 条（按群成员数至成员数×2）。`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-slate-500">
                  最少条数
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={chatSettingsDraft.replyMessageMin ?? getReplyMessageRange(chatSettingsDraft).min}
                    onChange={(event) => setChatSettingsDraft({
                      ...chatSettingsDraft,
                      replyMessageMin: event.target.value === '' ? 0 : Number(event.target.value),
                    })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                  />
                </label>
                <label className="text-[10px] text-slate-500">
                  最多条数
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={chatSettingsDraft.replyMessageMax ?? getReplyMessageRange(chatSettingsDraft).max}
                    onChange={(event) => setChatSettingsDraft({
                      ...chatSettingsDraft,
                      replyMessageMax: event.target.value === '' ? 0 : Number(event.target.value),
                    })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                  />
                </label>
              </div>
            </section>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <span>
                <span className="block text-xs font-semibold text-[#2C4A5C]">注入最新一轮的心声</span>
                <span className="mt-0.5 block text-[9px] text-slate-400">开启后，AI 可参考最近一轮角色心声，并提示其只是短暂的内心活动，自然承接但不反复琢磨。</span>
              </span>
              <input
                type="checkbox"
                checked={chatSettingsDraft.includeLatestThought ?? false}
                onChange={(event) => setChatSettingsDraft({
                  ...chatSettingsDraft,
                  includeLatestThought: event.target.checked,
                })}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="text-xs font-semibold text-[#2C4A5C]">旁白</span>
              <input
                type="checkbox"
                checked={chatSettingsDraft.narratorEnabled}
                onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, narratorEnabled: event.target.checked })}
              />
            </label>
            {chatSettingsDraft.type !== 'observer' && (
              <section className="space-y-2 rounded-2xl border border-sky-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-[#2C4A5C]">角色主动行为</p>
                <p className="text-[10px] text-slate-500">仅主要角色可在聊天时基于人设与当下情境自行决定，不要求每轮触发；不设硬性次数与间隔，朋友圈保持低频、不重复。</p>
                {chatSettingsDraft.type === 'group' && (
                  <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
                    群聊触发私聊
                    <input type="checkbox" checked={chatSettingsDraft.allowGroupPrivate !== false}
                      onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, allowGroupPrivate: event.target.checked })} />
                  </label>
                )}
                <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
                  主动发朋友圈
                  <input type="checkbox" checked={chatSettingsDraft.allowAutoMoments !== false}
                    onChange={(event) => setChatSettingsDraft({ ...chatSettingsDraft, allowAutoMoments: event.target.checked })} />
                </label>
                <p className="text-[10px] text-slate-500">情侣空间不再自动写入，请在情侣空间内手动生成或编辑。</p>
              </section>
            )}
            {(() => {
              const messages = chats.find((chat) => chat.id === chatSettingsDraft.id)?.messages ?? chatSettingsDraft.messages;
              const historyCount = Math.min(5000, Math.max(1, Math.trunc(chatSettingsDraft.currentChatHistoryCount || 200)));
              const recent = messages.slice(-historyCount);
              return (
                <section aria-label="对话 Token 估算" className="space-y-1.5 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                  <p className="text-xs font-semibold text-[#2C4A5C]">生成用量估算</p>
                  <button type="button" disabled={tokenPreviewBusy || isGeneratingReply}
                    onClick={() => void generateAiReply(false, chatSettingsDraft.id, false, true)}
                    className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {tokenPreviewBusy ? '正在计算…' : '估算下一次完整输入'}
                  </button>
                  {tokenPreview?.chatId === chatSettingsDraft.id && <p className="text-sm font-bold text-sky-700">下次完整输入约 {tokenPreview.input.toLocaleString()} Tokens</p>}
                  {tokenPreviewError && <p role="alert" className="text-[11px] text-rose-600">{tokenPreviewError}</p>}
                  {(() => {
                    const usage = readStoredValue(`yyphone:chat-token-usage:${chatSettingsDraft.id}`, null,
                      (value): value is { input: number; output?: number; at: string; model: string } =>
                        !!value && typeof value === 'object' && 'input' in value && typeof value.input === 'number' &&
                        'at' in value && typeof value.at === 'string' && 'model' in value && typeof value.model === 'string' &&
                        (!('output' in value) || typeof value.output === 'number'));
                    return usage && <p className="text-[11px] text-slate-600">最近请求（{usage.model}）：输入约 {usage.input.toLocaleString()}{usage.output !== undefined ? ` + 输出约 ${usage.output.toLocaleString()} = 合计约 ${(usage.input + usage.output).toLocaleString()} Tokens` : ' Tokens，尚无输出统计'}</p>;
                  })()}
                  <p className="text-[10px] leading-relaxed text-slate-500">完整输入包含实际提示词中的人设、世界书、长期记忆、日记/成长、挂载聊天、朋友圈/情侣空间等上下文、表情包清单及回复规则。按已保存的聊天设置计算；修改设置后请先保存再重新估算。估算不会请求聊天或向量 API，也不会标记记忆/动态已读；预览记忆采用本地关键词检索，正式生成的向量检索结果可能不同。输出（含心声与 JSON）生成前未知，最近请求显示实际发送/返回文本的估算，模型分词、缓存和计费规则仍以 API 为准。</p>
                  <p className="text-xs font-semibold text-[#2C4A5C]">消息正文参考</p>
                  <p className="text-sm font-bold text-sky-700">约 {estimateConversationTokens(messages).toLocaleString()} Tokens · {messages.length} 条消息</p>
                  <p className="text-[11px] text-slate-600">按当前历史条数设置，最近 {recent.length} 条约 {estimateConversationTokens(recent).toLocaleString()} Tokens</p>
                  <p className="text-[10px] leading-relaxed text-slate-400">以上估算仅统计文本，不含真实图片的视觉 Token；图片费用以所选模型及 API 实际用量为准。消息正文统计不等于一次生成的总输入。</p>
                </section>
              );
            })()}
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
                {chatSettingsDraft.blocked ? '解除拉黑' : '拉黑'}
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
                  <span className="mt-1 block font-normal text-slate-500">这里发送文字图卡；发送真实图片请使用聊天附件中的“拍摄”。真实图片最长边不超过 1280 像素、大小不超过 400KB，需要所选模型及 API 支持图片识别；小字或细节建议裁剪后发送。</span>
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
                {(attachmentMode === 'red-packet' || attachmentMode === 'transfer') && (
                  <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                    扣款方式
                    <select
                      value={attachmentDraft.paymentSelection}
                      onChange={(event) => setAttachmentDraft({
                        ...attachmentDraft,
                        paymentSelection: event.target.value,
                      })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
                    >
                      <option value="balance">支付宝个人余额 · ¥{readAlipayData().balance.toFixed(2)}</option>
                      {readAlipayData().intimateCards.map((card) => (
                        <option
                          key={card.id}
                          value={`intimate:${card.charId}`}
                          disabled={card.monthlyLimit - card.usedAmount < Number(attachmentDraft.amount || 0)}
                        >
                          {contactName(card.charId)} 的亲密付 · 可用 ¥{Math.max(0, card.monthlyLimit - card.usedAmount).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
                <p className="text-[10px] text-slate-400">仅调整本机虚拟钱包或亲密付额度，不会真实支付，也不会写入日常账本。</p>
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
            if (event.target === event.currentTarget) closeContactEditor();
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
                {isNewContactDraft ? '新增角色人设' : '编辑角色人设'}
              </h2>
              <button
                type="button"
                onClick={closeContactEditor}
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
              论坛网名
              <input
                value={contactDraft.forumNickname ?? ''}
                onChange={(event) => setContactDraft((draft) => ({ ...draft, forumNickname: event.target.value }))}
                maxLength={40}
                placeholder="非匿名板块使用，留空则使用角色姓名"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
              />
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              论坛 ID（@xxx）
              <input value={contactDraft.forumHandle ?? ''}
                onChange={(event) => setContactDraft((draft) => ({ ...draft, forumHandle: event.target.value }))}
                maxLength={41} placeholder="例如 @moonlit_cocoa，留空由 AI 按人设生成"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-400" />
              <span className="mt-1 block text-[10px] font-normal text-slate-400">用于非匿名论坛的帖子和评论，不改变角色内部编号。自动生成后会保持一致；手动填写优先。</span>
              {!contactDraft.forumHandle && readGeneratedForumHandles()[contactDraft.id] && (
                <span className="mt-1 block text-[10px] font-normal text-sky-600">当前自动 ID：@{readGeneratedForumHandles()[contactDraft.id]}</span>
              )}
            </label>
            <label className="block text-[11px] font-semibold text-[#2C4A5C]">
              简介
              <span className="ml-1 text-[9px] font-normal text-slate-400">仅展示在通讯录名字下面，AI 不会读取，可留空</span>
              <input
                value={contactDraft.bio ?? ''}
                onChange={(event) =>
                  setContactDraft((draft) => ({ ...draft, bio: event.target.value }))
                }
                maxLength={60}
                placeholder="例如：最爱喝热可可的邻居"
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
            <section className="space-y-2 rounded-2xl border border-teal-100 bg-teal-50/60 p-3">
              <label className="flex items-center justify-between gap-2 text-xs font-semibold text-[#2C4A5C]">
                <span>启用角色语音播放</span>
                <input type="checkbox" checked={contactDraft.voiceEnabled ?? false}
                  onChange={(event) => setContactDraft({ ...contactDraft, voiceEnabled: event.target.checked })} />
              </label>
              {contactDraft.voiceEnabled && (
                <>
                  <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                    语音 ID（音色）
                    <input value={contactDraft.voiceId ?? ''}
                      onChange={(event) => setContactDraft({ ...contactDraft, voiceId: event.target.value })}
                      maxLength={120} placeholder="填写服务商提供的 voice ID"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono outline-none" />
                  </label>
                  <label className="block text-[11px] font-semibold text-[#2C4A5C]">
                    语言
                    <select value={contactDraft.voiceLanguage || '中文'}
                      onChange={(event) => setContactDraft({ ...contactDraft, voiceLanguage: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                      <option>中文</option>
                      <option>粤语</option>
                      <option>英语</option>
                      <option>日语</option>
                      <option>韩语</option>
                      <option>法语</option>
                      <option>德语</option>
                      <option>西班牙语</option>
                    </select>
                  </label>
                  <p className="text-[10px] leading-relaxed text-slate-400">开启后，角色发送的语音消息点击语音条即可播放，语音/视频通话中角色说的话会自动朗读；普通文字消息不会合成语音。需先在系统设置配置语音模型。</p>
                </>
              )}
            </section>
            <section className="space-y-2 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
              <h3 className="text-xs font-semibold text-[#2C4A5C]">角色可用的表情包分类</h3>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={contactDraft.stickerCategories === undefined}
                  onChange={(event) => setContactDraft({ ...contactDraft, stickerCategories: event.target.checked ? undefined : [] })} />
                使用全部分类（含以后新增的分类）
              </label>
              {contactDraft.stickerCategories !== undefined && (
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...stickerCategories, ...contactDraft.stickerCategories])].map((category) => (
                    <label key={category} className="flex items-center gap-1 text-[11px] text-slate-600">
                      <input type="checkbox" checked={contactDraft.stickerCategories?.includes(category) ?? false}
                        onChange={(event) => setContactDraft({
                          ...contactDraft,
                          stickerCategories: event.target.checked
                            ? [...(contactDraft.stickerCategories ?? []), category]
                            : (contactDraft.stickerCategories ?? []).filter((item) => item !== category),
                        })} />
                      {category}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400">取消全部分类后可勾选指定分类；一个也不选则该角色不使用表情包。玩家发送不受限制。</p>
            </section>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-[#2C4A5C]">世界书关联</p>
              {contactWorldBooks.some((book) => book.isGlobal) && (
                <p className="text-[10px] text-slate-400">
                  全局世界书（{contactWorldBooks.filter((book) => book.isGlobal).map((book) => book.name).join('、')}）已默认发送，无需关联。
                </p>
              )}
              {contactWorldBooks.filter((book) => !book.isGlobal).length === 0 ? (
                <p className="text-[10px] text-slate-400">世界书 App 中还没有可关联的世界书。</p>
              ) : (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-2">
                  {contactWorldBooks.filter((book) => !book.isGlobal).map((book) => {
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
            <section className="overflow-hidden rounded-2xl border border-sky-100/90 bg-gradient-to-br from-[#9BD2FC]/20 to-[#F7B9D2]/25 shadow-sm backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setNpcSectionOpen((open) => !open)}
                aria-expanded={npcSectionOpen}
                className="flex w-full items-center justify-between px-3.5 py-3 text-left"
              >
                <span className="text-[11px] font-bold text-[#2C4A5C]">
                  关联 NPC
                  <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[9px] text-sky-700">
                    {characterNpcs.filter((npc) => npc.linkedCharIds.includes(contactDraft.id)).length}
                  </span>
                </span>
                <span className="text-xs text-slate-500">{npcSectionOpen ? '收起 −' : '展开 +'}</span>
              </button>
              {npcSectionOpen && (
                <div className="space-y-3 border-t border-white/80 px-3.5 py-3">
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    NPC 依附于主要角色，可被多个角色共享，不会单独出现在通讯录或私聊列表。
                  </p>
                  <div className="space-y-2">
                    {characterNpcs
                      .filter((npc) => npc.linkedCharIds.includes(contactDraft.id))
                      .map((npc) => (
                        <div key={npc.id} className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/65 p-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-xs font-bold text-white">
                            {npc.avatarUrl ? <img src={npc.avatarUrl} alt="" className="h-full w-full object-cover" /> : npc.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slate-700">{npc.name}</p>
                            <p className="truncate text-[9px] text-slate-400">{npc.persona || '暂无设定'}</p>
                          </div>
                          <button type="button" onClick={() => editNpc(npc)} className="rounded-lg bg-sky-50 px-2 py-1 text-[9px] font-semibold text-sky-700">编辑</button>
                          <button type="button" onClick={() => unbindNpcFromCurrentCharacter(npc)} className="rounded-lg bg-white/80 px-2 py-1 text-[9px] font-semibold text-slate-500">解绑</button>
                          <button type="button" onClick={() => deleteNpc(npc.id)} aria-label={`彻底删除${npc.name}`} className="rounded-lg bg-rose-50 px-2 py-1 text-[9px] font-semibold text-rose-600">删除</button>
                        </div>
                      ))}
                    {characterNpcs.filter((npc) => npc.linkedCharIds.includes(contactDraft.id)).length === 0 && (
                      <p className="rounded-xl bg-white/50 px-3 py-2 text-center text-[10px] text-slate-400">当前角色还没有关联 NPC。</p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-xl border border-white/90 bg-white/60 p-3">
                    <p className="text-[10px] font-bold text-slate-600">{npcDraft.id ? '编辑 NPC 信息' : '新建并绑定 NPC'}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-sm font-bold text-white">
                        {npcDraft.avatarUrl ? <img src={npcDraft.avatarUrl} alt="" className="h-full w-full object-cover" /> : npcDraft.name.charAt(0) || 'NPC'}
                      </div>
                      <input
                        value={npcDraft.avatarUrl}
                        onChange={(event) => setNpcDraft({ ...npcDraft, avatarUrl: event.target.value })}
                        placeholder="NPC 头像链接（可选）"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[10px] outline-none focus:border-sky-300"
                      />
                    </div>
                    <label className="block text-[10px] font-semibold text-slate-500">
                      本地上传头像
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isProcessingAvatar}
                        onChange={(event) => {
                          void handleNpcAvatarUpload(event.target.files?.[0]);
                          event.currentTarget.value = '';
                        }}
                        className="mt-1 block max-w-full text-[9px]"
                      />
                    </label>
                    <input
                      value={npcDraft.name}
                      onChange={(event) => setNpcDraft({ ...npcDraft, name: event.target.value })}
                      maxLength={80}
                      placeholder="NPC 名称"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs outline-none focus:border-sky-300"
                    />
                    <textarea
                      value={npcDraft.persona}
                      onChange={(event) => setNpcDraft({ ...npcDraft, persona: event.target.value })}
                      rows={3}
                      maxLength={5000}
                      placeholder="NPC 设定、性格、与主要角色的关系"
                      className="w-full resize-y rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[11px] leading-relaxed outline-none focus:border-sky-300"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={saveNpcToCurrentCharacter} disabled={isProcessingAvatar} className="flex-1 rounded-xl bg-gradient-to-r from-[#9BD2FC] to-[#F7B9D2] py-2 text-[10px] font-bold text-white disabled:opacity-50">
                        {npcDraft.id ? '保存 NPC 修改并绑定' : '新建并绑定 NPC'}
                      </button>
                      {npcDraft.id && (
                        <button type="button" onClick={() => setNpcDraft({ id: '', name: '', avatarUrl: '', persona: '' })} className="rounded-xl bg-white px-3 py-2 text-[10px] text-slate-500">
                          取消
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-white/90 bg-white/60 p-3">
                    <p className="text-[10px] font-bold text-slate-600">从已有 NPC 中选择（支持多选）</p>
                    <div className="max-h-32 space-y-1 overflow-y-auto">
                      {characterNpcs
                        .filter((npc) => !npc.linkedCharIds.includes(contactDraft.id))
                        .map((npc) => (
                          <label key={npc.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/80">
                            <input type="checkbox" checked={selectedSharedNpcIds.includes(npc.id)} onChange={() => toggleSharedNpc(npc.id)} />
                            <span className="min-w-0 flex-1 truncate text-[10px] text-slate-700">{npc.name}</span>
                            <span className="text-[9px] text-slate-400">
                              {npc.linkedCharIds.map((id) => contacts.find((contact) => contact.id === id)?.name ?? (id === contactDraft.id ? contactDraft.name : '角色')).join('、')}关联
                            </span>
                          </label>
                        ))}
                      {characterNpcs.filter((npc) => !npc.linkedCharIds.includes(contactDraft.id)).length === 0 && (
                        <p className="py-2 text-center text-[10px] text-slate-400">没有其他可共享的 NPC。</p>
                      )}
                    </div>
                    <button type="button" onClick={bindSelectedNpcs} disabled={selectedSharedNpcIds.length === 0} className="w-full rounded-xl border border-sky-100 bg-white/80 py-2 text-[10px] font-bold text-sky-700 disabled:opacity-40">
                      绑定所选 NPC（{selectedSharedNpcIds.length}）
                    </button>
                  </div>
                </div>
              )}
            </section>
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
            <label className="flex items-center justify-between text-xs font-semibold text-amber-700">
              <span><Star className="mr-1 inline h-3.5 w-3.5" />设为星标</span>
              <input type="checkbox" checked={contactDraft.starred} onChange={(event) => setContactDraft((draft) => ({ ...draft, starred: event.target.checked }))} />
            </label>
            {!isNewContactDraft && (
              <section className="space-y-2 rounded-2xl border border-sky-100 bg-slate-50 p-3">
                <button type="button" onClick={() => {
                  setContactWorldBooks(readContactWorldBooks());
                  const availableBooks = readContactWorldBooks();
                  setExportWorldBookIds([...new Set(contactDraft.worldBooks.map((link) => link.bookId))]
                    .filter((id) => availableBooks.some((book) => book.id === id)));
                  setCharacterExportOpen((open) => !open);
                }} className="w-full text-xs font-semibold text-sky-700">
                  <Download className="mr-1 inline h-3.5 w-3.5" />导出角色
                </button>
                {characterExportOpen && (
                  <>
                    <p className="text-[10px] text-slate-500">导出当前人设、头像、简介与偏好，可勾选一起携带的世界书；不含聊天、存档、API 密钥或 NPC。导入时自动重新关联世界书，全局书仅对导入角色生效。</p>
                    {contactWorldBooks.map((book) => (
                      <label key={book.id} className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={exportWorldBookIds.includes(book.id)} onChange={(event) => {
                          setExportWorldBookIds((ids) => event.target.checked ? [...ids, book.id] : ids.filter((id) => id !== book.id));
                        }} />
                        {book.name}{book.isGlobal ? '（全局）' : ''}
                      </label>
                    ))}
                    {!contactWorldBooks.length && <p className="text-[10px] text-slate-400">暂无世界书，可仅导出角色。</p>}
                    <button type="button" onClick={exportCharacter} className="w-full rounded-xl bg-sky-600 py-2 text-xs font-semibold text-white">
                      下载角色 JSON
                    </button>
                  </>
                )}
              </section>
            )}
            {!isNewContactDraft && (
              <button type="button" onClick={() => deleteContact(contactDraft.id)} className="w-full rounded-xl bg-rose-50 py-2 text-xs font-bold text-rose-600">
                删除角色
              </button>
            )}
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
      {activePaymentId && activeChat && (() => {
        const payment = activeChat.messages.find((item) => item.id === activePaymentId);
        if (!payment) return null;
        const incoming = payment.senderId !== 'user' && payment.recipientId === 'user';
        const pending = incoming && payment.paymentStatus === 'pending';
        return (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/40 p-5">
            <section role="dialog" aria-modal="true" aria-label={payment.kind === 'red-packet' ? '领取红包' : '转账详情'} className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-6 text-center">
              <p className="text-sm text-slate-600">{getChatParticipantName(activeChat, payment.senderId)}{payment.kind === 'red-packet' ? '的红包' : '的转账'}</p>
              <p className="text-3xl font-semibold text-slate-800">¥{payment.amount}</p>
              <p className="text-xs text-slate-500">{payment.text}</p>
              {payment.payerId && <p className="text-xs text-slate-500">由 {contactName(payment.payerId)} 的亲密付付款</p>}
              {pending ? (
                <>
                  <button type="button" onClick={() => settlePayment('received')} className="w-full rounded-xl bg-[#07c160] py-3 text-sm font-semibold text-white">{payment.kind === 'red-packet' ? '开红包' : '确认收款'}</button>
                  {payment.kind === 'transfer' && <button type="button" onClick={() => {
                    if (window.confirm('确认退回这笔转账？退回后不可撤销。')) settlePayment('returned');
                  }} className="text-xs text-sky-700">立即退回</button>}
                </>
              ) : <p className="text-sm text-slate-500">{!incoming ? '已发出' : payment.paymentStatus === 'returned' ? '已退回对方，未计入余额' : '已存入支付宝个人余额'}</p>}
              <button type="button" onClick={() => setActivePaymentId('')} className="block w-full text-xs text-slate-400">关闭</button>
              <p className="text-[10px] text-slate-400">本地虚拟资金，不涉及真实支付</p>
            </section>
          </div>
        );
      })()}
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
      {activeCallMode && activeChat && (() => {
        const peerId = activeChat.participantIds[0] ?? '';
        const callLines = activeChat.messages
          .filter((message) => message.createdAt >= callStartedAt && message.senderId !== 'narrator' && message.kind !== 'video-call' && message.kind !== 'pat' && message.text)
          .slice(-8)
          .map((message) => ({
            id: message.id,
            mine: message.senderId === 'user',
            name: message.senderId === 'user' ? getChatParticipantName(activeChat, 'user') : getChatParticipantName(activeChat, message.senderId),
            text: message.text,
          }));
        return (
          <CallScreen
            key={callStartedAt}
            mode={activeCallMode}
            incoming={!!incomingCallMessageId}
            onMissed={() => {
              updateChat(activeChat.id, (chat) => ({
                ...chat,
                messages: chat.messages.map((message) => message.id === incomingCallMessageId
                  ? { ...message, callStatus: 'missed', text: '视频通话 · 未接听' } : message),
              }));
              setActiveCallMode(null);
              setIncomingCallMessageId('');
            }}
            peerName={getChatTitle(activeChat)}
            peerAvatar={activeChat.avatars[peerId] || contacts.find((item) => item.id === peerId)?.avatarUrl || ''}
            myName={getChatParticipantName(activeChat, 'user')}
            myAvatar={activeChat.avatars.user || personaDraft.avatarUrl || ''}
            lines={callLines}
            draft={chatMessageDraft}
            onDraftChange={setChatMessageDraft}
            onSend={sendChatMessage}
            onGenerate={() => void generateAiReply()}
            generating={isGeneratingReply}
            canSend={activeChat.type !== 'observer' && !activeChat.blocked}
            error={chatError}
            onConnected={(at) => {
              setCallConnectedAt(at);
              if (incomingCallMessageId) updateChat(activeChat.id, (chat) => ({
                ...chat,
                messages: chat.messages.map((message) => message.id === incomingCallMessageId
                  ? { ...message, callStatus: 'connected', text: '视频通话 · 已接通' } : message),
              }));
            }}
            onEnd={endCall}
          />
        );
      })()}
      {patDialog && activeChat && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-label="拍一拍" className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-bold text-[#2C4A5C]">
              拍一拍{patDialog.targetId === 'user' ? '自己' : `“${getChatParticipantName(activeChat, patDialog.targetId)}”`}
            </h2>
            <input
              autoFocus
              value={patDialog.suffix}
              onChange={(event) => setPatDialog({ ...patDialog, suffix: event.target.value })}
              maxLength={20}
              placeholder="可选后缀，如：的脑袋"
              aria-label="拍一拍后缀"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setPatDialog(null)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs text-slate-600">取消</button>
              <button
                type="button"
                onClick={() => { sendPat(patDialog.targetId, patDialog.suffix); setPatDialog(null); }}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#fbcfe8] to-[#bae6fd] py-2.5 text-xs font-bold text-[#2C4A5C]"
              >
                拍一拍
              </button>
            </div>
          </section>
        </div>
      )}
      {forwardOpen && activeChat && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-label="转发到" className="flex max-h-[80%] w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-bold text-[#2C4A5C]">转发到（可多选）</h2>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {chats.filter((chat) => chat.id !== activeChat.id && chat.type !== 'observer' && !chat.blocked).map((chat) => {
                const checked = forwardTargetIds.includes(chat.id);
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setForwardTargetIds((ids) => (checked ? ids.filter((id) => id !== chat.id) : [...ids, chat.id]))}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs ${checked ? 'border-sky-200 bg-sky-50' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${checked ? 'border-transparent bg-sky-400 text-white' : 'border-slate-300'}`}>{checked ? '✓' : ''}</span>
                    <span className="truncate">{getChatTitle(chat)}</span>
                  </button>
                );
              })}
              {chats.filter((chat) => chat.id !== activeChat.id && chat.type !== 'observer' && !chat.blocked).length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">没有其他可转发的对话</p>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForwardOpen(false)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs text-slate-600">取消</button>
              <button
                type="button"
                disabled={forwardTargetIds.length === 0}
                onClick={forwardSelectedMessages}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#fbcfe8] to-[#bae6fd] py-2.5 text-xs font-bold text-[#2C4A5C] disabled:opacity-40"
              >
                转发{forwardTargetIds.length > 0 ? `（${forwardTargetIds.length}）` : ''}
              </button>
            </div>
          </section>
        </div>
      )}
      {archiveOpen && activeChat && (() => {
        const { archives, activeId } = getChatArchives(activeChat);
        return (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
            <section role="dialog" aria-modal="true" aria-labelledby="archive-title" className="flex max-h-[80%] w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-5 shadow-2xl">
              <header className="flex items-center justify-between">
                <h2 id="archive-title" className="text-base font-bold text-[#2C4A5C]">聊天存档</h2>
                <button type="button" aria-label="关闭" onClick={() => setArchiveOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </header>
              <p className="text-[11px] text-slate-500">每个存档保存独立聊天记录。角色私聊的长期记忆、流水账、成长笔记和整理进度，以及群聊、旁观聊天的群流水账和整理进度也随档切换；新档从空白开始，删除档会一并删除对应内容。角色人设与玩家通用记忆仍共用，换身份时请自行检查。</p>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {archives.map((archive) => {
                  const isActive = archive.id === activeId;
                  const count = isActive ? activeChat.messages.length : archive.messages.length;
                  return (
                    <div key={archive.id} className={`rounded-2xl border p-2.5 ${isActive ? 'border-sky-200 bg-sky-50/70' : 'border-slate-100 bg-slate-50'}`}>
                      {renamingArchive?.id === archive.id ? (
                        <div className="flex gap-1.5">
                          <input
                            autoFocus
                            value={renamingArchive.name}
                            onChange={(event) => setRenamingArchive({ id: archive.id, name: event.target.value })}
                            aria-label="存档名称"
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
                          />
                          <button type="button" onClick={() => renameChatArchive(activeChat, archive.id, renamingArchive.name)} className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] text-white">保存</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-700">{archive.name}{isActive && <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] text-sky-600">当前</span>}</p>
                            <p className="text-[10px] text-slate-400">{count} 条消息</p>
                          </div>
                          <div className="flex shrink-0 gap-1.5 text-[10px]">
                            {!isActive && <button type="button" onClick={() => switchChatArchive(activeChat, archive.id)} className="rounded-full bg-white px-2.5 py-1 text-sky-600 shadow-sm">切换</button>}
                            <button type="button" onClick={() => setRenamingArchive({ id: archive.id, name: archive.name })} className="rounded-full bg-white px-2.5 py-1 text-slate-500 shadow-sm">改名</button>
                            {!isActive && <button type="button" onClick={() => deleteChatArchive(activeChat, archive.id)} className="rounded-full bg-white px-2.5 py-1 text-rose-500 shadow-sm">删除</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={archiveNameDraft}
                  onChange={(event) => setArchiveNameDraft(event.target.value)}
                  placeholder="新存档名称（可留空）"
                  aria-label="新存档名称"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => switchChatArchive(activeChat, '', archiveNameDraft)}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-[#fbcfe8] to-[#bae6fd] px-3 py-2 text-xs font-bold text-[#2C4A5C]"
                >
                  新建存档
                </button>
              </div>
            </section>
          </div>
        );
      })()}
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
      {forumCardPreview && (
        <div
          className="absolute inset-0 z-[85] flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setForumCardPreview(null);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="forum-card-title" className="flex max-h-[85%] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl backdrop-blur-xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/70 p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-sky-600">{forumCardPreview.forumDetails?.boardName || forumCardPreview.source || '论坛分享'}</p>
                <h2 id="forum-card-title" className="mt-1 text-sm font-bold leading-relaxed text-[#2C4A5C]">
                  {forumCardPreview.forumDetails?.title || forumCardPreview.title || '论坛帖子'}
                </h2>
                <p className="mt-1 text-[10px] text-slate-400">{forumCardPreview.forumDetails?.author || ''}</p>
              </div>
              <button type="button" aria-label="关闭帖子详情" onClick={() => setForumCardPreview(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <article className="whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                {forumCardPreview.forumDetails?.body || forumCardPreview.aiContext || forumCardPreview.text}
              </article>
              {forumCardPreview.forumDetails?.comments?.length ? (
                <section className="space-y-2">
                  <h3 className="text-[11px] font-bold text-[#2C4A5C]">评论 · {forumCardPreview.forumDetails.comments.length}</h3>
                  {forumCardPreview.forumDetails.comments.map((comment, index) => (
                    <article key={`${index}-${comment.authorName}`} className="rounded-xl border border-slate-100 bg-white/80 p-3">
                      <p className="text-[10px] font-semibold text-sky-700">{comment.authorName}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-600">{comment.content}</p>
                    </article>
                  ))}
                </section>
              ) : null}
            </div>
          </section>
        </div>
      )}
      {/* WeChat Bottom Sub-Tab Bar */}
      {!activeChat && <div className="wechat-tab-bar border-t border-slate-100 bg-white px-2 pt-1 pb-1 flex items-center justify-around z-20 shrink-0 mt-auto">
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
      <div aria-hidden="true" className="wechat-bottom-safe shrink-0 bg-white" style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }} />
    </div>
  );
};
