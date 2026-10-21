import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Menu,
  MessageSquare,
  Share2,
  Heart,
  Trash2,
  Pencil,
  Upload,
  Download,
  X,
  Send,
  User,
  EyeOff,
  Shuffle,
  CornerDownRight,
  RefreshCw,
  Palette,
  Save,
  BookOpen,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { showYyError } from '../components/ErrorDialog';
import { readAlipayContacts, AlipayContact } from '../utils/alipayData';
import { requestConfiguredAiText } from '../utils/aiApi';
import { parseAiJson, parseForumPost } from '../utils/aiResponse';
import { normalizeForumHandle, readGeneratedForumHandles, resolveForumHandle } from '../utils/forumIdentity';
import { readStorageString, readStoredValue, writeStoredValue } from '../utils/localStorage';
import { compressImage } from '../utils/imageFile';
import {
  getAutomaticWorldBookIdsForContacts,
  readWorldBookOptions,
  withWorldBooksForContacts,
} from '../utils/worldBookPrompt';
import { withForumBreakLimit } from '../utils/forumPrompt';
import { getChatRelationContexts } from '../utils/chatContext';

interface ForumAppProps {
  onBack: () => void;
}

// 角色自带的专属 NPC 结构（为微信角色的多 NPC 设定预留标准结构）
export interface CharacterNpc {
  id: string;
  charId: string; // 所属角色 ID
  charName: string; // 所属角色真名
  name: string; // NPC 名字
  relation?: string; // 与角色的关系（如：损友、下属、同事）
}

// 论坛板块结构
export interface ForumBoard {
  id: string;
  name: string;
  prompt: string;
  isAnonymous: boolean;
  styleType: 'weibo' | 'tieba' | '4ch' | 'custom';
}

// 评论结构（含身份真实标记，供转发时 AI 识别）
export interface ForumComment {
  id: string;
  noId: number;
  authorName: string; // 论坛显示的昵称
  authorId: string;
  authorAvatar?: string;
  isPlayer?: boolean; // 是否为玩家本人
  isPlayerAlt?: boolean;
  isChar?: boolean; // 是否为通讯录角色
  charId?: string;
  realCharName?: string; // 角色的真实姓名（供转发时标注给 AI）
  isNpc?: boolean; // 是否为角色自带 NPC
  npcId?: string;
  realNpcName?: string; // NPC 真实名称（供转发时标注给 AI）
  isOP?: boolean;
  replyToNo?: number;
  replyToName?: string;
  content: string;
  time: string;
}

// 帖子评论区参与规则（焊死在每条帖子身上，后续点“再生成6条”依然严格遵循此规则）
export interface CommentParticipantConfig {
  includePasserby: boolean; // 路人网友
  includeRandomChar: boolean; // 随机角色
  includeCustomChar: boolean; // 指定角色
  customCharIds: string[]; // 选中的具体角色 ID 列表
  includeCharNpc: boolean; // 角色自带 NPC
  npcRule: 'random' | 'custom'; // 随机抽 NPC 还是指定具体 NPC
  customNpcIds: string[]; // 选中的具体 NPC ID 列表
}

// 帖子结构
export interface ForumPost {
  id: string;
  boardId: string;
  noId: number;
  authorName: string;
  authorId: string;
  authorAvatar?: string;
  isPlayer?: boolean;
  isPlayerAlt?: boolean;
  isChar?: boolean;
  charId?: string;
  realCharName?: string;
  isNpc?: boolean;
  npcId?: string;
  realNpcName?: string;
  title?: string;
  content: string;
  imageUrl?: string;
  time: string;
  likes: number;
  likedByMe?: boolean;
  participantConfig: CommentParticipantConfig;
  comments: ForumComment[];
}

// 玩家在非匿名板块的个人资料
export interface PlayerForumProfile {
  nickname: string;
  handleId: string;
  avatarUrl: string;
  bio: string;
}

interface PlayerForumAccount extends PlayerForumProfile {
  id: string;
}

// 论坛专属美化预设结构
export interface ForumThemePreset {
  id: string;
  name: string;
  bgGradient: string;
  wallpaperUrl: string;
  primaryGradient: string;
  cardBg: string;
  textColor: string;
  cardRadius: string;
  customCss: string;
}

const DEFAULT_FORUM_PRESET: ForumThemePreset = {
  id: 'default',
  name: '默认预设',
  bgGradient: 'linear-gradient(180deg, #F0F7FF 0%, #F7F4FC 50%, #FFF2F7 100%)',
  wallpaperUrl: '',
  primaryGradient: 'linear-gradient(90deg, #8EC5FC 0%, #F5B8D1 100%)',
  cardBg: 'rgba(255, 255, 255, 0.72)',
  textColor: '#3A5064',
  cardRadius: '24px',
  customCss: '/* 可在此自定义论坛附加样式 */',
};

const DEFAULT_BOARDS: ForumBoard[] = [
  {
    id: 'weibo',
    name: '微博',
    prompt: '分享生活日常、情感碎碎念、同城热搜八卦、粉圈超话互动，语气鲜活接地气。',
    isAnonymous: false,
    styleType: 'weibo',
  },
  {
    id: 'tieba',
    name: '贴吧',
    prompt: '经典贴吧老哥与吧友氛围，擅长神回复、求助吐槽、情感树洞、盖楼吃瓜，称呼楼主为LZ。',
    isAnonymous: false,
    styleType: 'tieba',
  },
  {
    id: '4ch',
    name: '4ch',
    prompt: '模仿 4chan 匿名版（中文化）格式与氛围，全员无名氏(Anonymous)，常用 > 绿字引用吐槽、怪谈或犀利锐评。',
    isAnonymous: true,
    styleType: '4ch',
  },
];

const randomHashId = () => Math.random().toString(36).slice(2, 9).toUpperCase();
const randomNo = () => Math.floor(800000 + Math.random() * 190000);

const FORUM_STORAGE_KEYS = {
  boards: 'yyphone:forum-boards',
  posts: 'yyphone:forum-posts',
  playerProfiles: 'yyphone:forum-player-profiles',
  playerAccounts: 'yyphone:forum-player-accounts',
  activePlayerAccounts: 'yyphone:forum-active-player-accounts',
  themePresets: 'yyphone:forum-theme-presets',
  activePresetId: 'yyphone:forum-active-preset-id',
  currentTheme: 'yyphone:forum-current-theme',
  worldBookIds: 'yyphone:forum-world-book-ids',
  breakLimitWords: 'yyphone:forum-break-limit-words',
  chats: 'yyphone:wechat-chats',
  forwards: 'yyphone:forum-forwards',
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isForumBoard = (value: unknown): value is ForumBoard =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.prompt === 'string' &&
  typeof value.isAnonymous === 'boolean' &&
  ['weibo', 'tieba', '4ch', 'custom'].includes(String(value.styleType));

const isCommentParticipantConfig = (value: unknown): value is CommentParticipantConfig =>
  isRecord(value) &&
  typeof value.includePasserby === 'boolean' &&
  typeof value.includeRandomChar === 'boolean' &&
  typeof value.includeCustomChar === 'boolean' &&
  Array.isArray(value.customCharIds) &&
  value.customCharIds.every((id) => typeof id === 'string') &&
  typeof value.includeCharNpc === 'boolean' &&
  (value.npcRule === 'random' || value.npcRule === 'custom') &&
  Array.isArray(value.customNpcIds) &&
  value.customNpcIds.every((id) => typeof id === 'string');

const isForumComment = (value: unknown): value is ForumComment =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.noId === 'number' &&
  typeof value.authorName === 'string' &&
  typeof value.authorId === 'string' &&
  (value.isPlayerAlt === undefined || typeof value.isPlayerAlt === 'boolean') &&
  typeof value.content === 'string' &&
  typeof value.time === 'string';

const isForumPost = (value: unknown): value is ForumPost =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.boardId === 'string' &&
  typeof value.noId === 'number' &&
  typeof value.authorName === 'string' &&
  typeof value.authorId === 'string' &&
  (value.isPlayerAlt === undefined || typeof value.isPlayerAlt === 'boolean') &&
  typeof value.content === 'string' &&
  typeof value.time === 'string' &&
  typeof value.likes === 'number' &&
  isCommentParticipantConfig(value.participantConfig) &&
  Array.isArray(value.comments) &&
  value.comments.every(isForumComment);

const isPlayerForumProfile = (value: unknown): value is PlayerForumProfile =>
  isRecord(value) &&
  typeof value.nickname === 'string' &&
  typeof value.handleId === 'string' &&
  typeof value.avatarUrl === 'string' &&
  typeof value.bio === 'string';

const isPlayerForumProfiles = (value: unknown): value is Record<string, PlayerForumProfile> =>
  isRecord(value) && Object.values(value).every(isPlayerForumProfile);

const isPlayerForumAccount = (value: unknown): value is PlayerForumAccount =>
  isRecord(value) && typeof value.id === 'string' && isPlayerForumProfile(value);

const isPlayerForumAccounts = (value: unknown): value is Record<string, PlayerForumAccount[]> =>
  isRecord(value) && Object.values(value).every((accounts) =>
    Array.isArray(accounts) && accounts.every(isPlayerForumAccount));

const isActivePlayerAccounts = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((id) => typeof id === 'string');

const isForumThemePreset = (value: unknown): value is ForumThemePreset =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.bgGradient === 'string' &&
  typeof value.wallpaperUrl === 'string' &&
  typeof value.primaryGradient === 'string' &&
  typeof value.cardBg === 'string' &&
  typeof value.textColor === 'string' &&
  typeof value.cardRadius === 'string' &&
  typeof value.customCss === 'string';

const isForumThemePresetList = (value: unknown): value is ForumThemePreset[] =>
  Array.isArray(value) && value.every(isForumThemePreset);

interface ForumCommenter {
  type: 'passerby' | 'char' | 'npc';
  id: string;
  name: string;
  charId?: string;
  charName?: string;
  persona?: string;
  forumHandle?: string;
}

const getCharacterPersona = (charId: string) => {
  const storedContacts = readStoredValue<unknown[]>(
    'pocketos:wechat-contacts',
    [],
    (value): value is unknown[] => Array.isArray(value)
  );
  const storedContact = storedContacts.find(
    (candidate) => isRecord(candidate) && candidate.id === charId
  );
  return isRecord(storedContact) && typeof storedContact.persona === 'string'
    ? storedContact.persona
    : '';
};

const selectAllowedCommenters = (
  config: CommentParticipantConfig,
  contacts: AlipayContact[],
  npcs: CharacterNpc[]
): ForumCommenter[] => {
  const commenters: ForumCommenter[] = [];
  if (config.includePasserby) {
    commenters.push({ type: 'passerby', id: 'passerby', name: '普通路人网友' });
  }
  if (config.includeRandomChar && contacts.length > 0) {
    const character = contacts[Math.floor(Math.random() * contacts.length)];
    commenters.push({
      type: 'char',
      id: character.id,
      name: character.name,
      persona: getCharacterPersona(character.id),
      forumHandle: character.forumHandle || readGeneratedForumHandles()[character.id],
    });
  }
  if (config.includeCustomChar) {
    config.customCharIds.forEach((charId) => {
      const character = contacts.find((item) => item.id === charId);
      if (character && !commenters.some((item) => item.type === 'char' && item.id === charId)) {
        commenters.push({
          type: 'char',
          id: character.id,
          name: character.name,
          persona: getCharacterPersona(character.id),
          forumHandle: character.forumHandle || readGeneratedForumHandles()[character.id],
        });
      }
    });
  }
  if (config.includeCharNpc) {
    const eligibleNpcs = config.npcRule === 'custom'
      ? npcs.filter((npc) => config.customNpcIds.includes(npc.id))
      : npcs.length > 0
        ? [npcs[Math.floor(Math.random() * npcs.length)]]
        : [];
    eligibleNpcs.forEach((npc) => {
      if (!commenters.some((item) => item.type === 'npc' && item.id === npc.id)) {
        commenters.push({
          type: 'npc',
          id: npc.id,
          name: npc.name,
          charId: npc.charId,
          charName: npc.charName,
          persona: getCharacterPersona(npc.charId),
        });
      }
    });
  }
  return commenters;
};

// Read NPCs defined for actual contacts. Never fabricate placeholder NPCs.
const loadCharacterNpcs = (contacts: AlipayContact[]): CharacterNpc[] => {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const normalizeNpc = (value: unknown, ownerId?: string): CharacterNpc[] => {
    if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) return [];
    const npcName = value.name.trim();
    const linkedCharIds = Array.isArray(value.linkedCharIds)
      ? value.linkedCharIds.filter((id): id is string => typeof id === 'string')
      : [];
    const legacyCharId = typeof value.charId === 'string'
      ? value.charId
      : typeof value.ownerId === 'string'
        ? value.ownerId
        : ownerId;
    if (legacyCharId && !linkedCharIds.includes(legacyCharId)) linkedCharIds.push(legacyCharId);
    return [...new Set(linkedCharIds)].flatMap((charId) => {
      const owner = byId.get(charId);
      if (!owner) return [];
      return [{
        id: linkedCharIds.length > 1
          ? `${typeof value.id === 'string' ? value.id : `npc-${charId}-${npcName}`}::${charId}`
          : typeof value.id === 'string'
            ? value.id
            : `npc-${charId}-${npcName}`,
        charId: owner.id,
        charName: owner.name,
        name: npcName,
        ...(typeof value.relation === 'string' ? { relation: value.relation } : {}),
      }];
    });
  };

  const result: CharacterNpc[] = [];
  const appendList = (items: unknown, ownerId?: string) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      normalizeNpc(item, ownerId).forEach((npc) => {
        const roleScopedId = `${npc.id}:${npc.charId}`;
        if (!result.some((existing) => `${existing.id}:${existing.charId}` === roleScopedId)) result.push(npc);
      });
    });
  };

  try {
    const raw = readStorageString('yyphone:character-npcs');
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        appendList(parsed);
      } else if (isRecord(parsed)) {
        contacts.forEach((contact) => appendList(parsed[contact.id], contact.id));
      }
    }
    const storedContacts = readStoredValue<unknown[]>(
      'pocketos:wechat-contacts',
      [],
      (value): value is unknown[] => Array.isArray(value)
    );
    storedContacts.forEach((contact) => {
      if (isRecord(contact) && typeof contact.id === 'string') {
        appendList(contact.npcs ?? contact.npcList, contact.id);
      }
    });
  } catch (error) {
    console.error('Could not load character NPC data for the forum.', error);
  }
  return result;
};

export const ForumApp: React.FC<ForumAppProps> = ({ onBack }) => {
  // ==================== 1. 通讯录角色、多 NPC 列表与板块状态 ====================
  const [contacts] = useState<AlipayContact[]>(() => readAlipayContacts());
  const [allNpcs] = useState<CharacterNpc[]>(() => loadCharacterNpcs(readAlipayContacts()));
  const [boards, setBoards] = useState<ForumBoard[]>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.boards, DEFAULT_BOARDS, (value): value is ForumBoard[] =>
      Array.isArray(value) && value.length > 0 && value.every(isForumBoard)
    )
  );
  const [activeBoardId, setActiveBoardId] = useState<string>('weibo');

  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0];

  // ==================== 2. 论坛专属美化预设状态 ====================
  const [themePresets, setThemePresets] = useState<ForumThemePreset[]>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.themePresets, [DEFAULT_FORUM_PRESET], isForumThemePresetList)
  );
  const [activePresetId, setActivePresetId] = useState<string>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.activePresetId, 'default', (value): value is string =>
      typeof value === 'string'
    )
  );
  const [currentTheme, setCurrentTheme] = useState<ForumThemePreset>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.currentTheme, DEFAULT_FORUM_PRESET, isForumThemePreset)
  );
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [menuTab, setMenuTab] = useState<'theme' | 'data' | 'worldBooks' | 'breakLimit'>('theme');
  const [worldBookOptions] = useState(() => readWorldBookOptions());
  const [selectedForumWorldBookIds, setSelectedForumWorldBookIds] = useState<string[] | null>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.worldBookIds, null, (value): value is string[] | null =>
      value === null || (Array.isArray(value) && value.every((id) => typeof id === 'string'))
    )
  );
  const [forumBreakLimitWords, setForumBreakLimitWords] = useState(() =>
    readStoredValue(FORUM_STORAGE_KEYS.breakLimitWords, '', (value): value is string =>
      typeof value === 'string'
    )
  );

  // ==================== 3. 玩家非匿名板块资料设定 ====================
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, PlayerForumProfile>>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.playerProfiles, {
    weibo: {
      nickname: '今天也在摸鱼',
      handleId: 'moyu_diary_99',
      avatarUrl: '',
      bio: '快乐冲浪人 · 随手记录日常',
    },
    tieba: {
      nickname: '纯路人吧友',
      handleId: 'tieba_user_77',
      avatarUrl: '',
      bio: '混迹各大吧的吃瓜群众',
    },
    }, isPlayerForumProfiles)
  );

  const [playerAccounts, setPlayerAccounts] = useState<Record<string, PlayerForumAccount[]>>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.playerAccounts, {}, isPlayerForumAccounts)
  );
  const [activePlayerAccounts, setActivePlayerAccounts] = useState<Record<string, string>>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.activePlayerAccounts, {}, isActivePlayerAccounts)
  );
  const activePlayerAccount = activeBoard?.isAnonymous ? undefined : (playerAccounts[activeBoardId] ?? [])
    .find((account) => account.id === activePlayerAccounts[activeBoardId]);
  const currentProfile: PlayerForumProfile = (activePlayerAccount ?? playerProfiles[activeBoardId]) || {
    nickname: '小手机玩家',
    handleId: 'player_001',
    avatarUrl: '',
    bio: '这个人很神秘，什么都没写~',
  };
  const currentProfileIsAlt = !!activePlayerAccount;

  // ==================== 4. 帖子列表状态 ====================
  const [posts, setPosts] = useState<ForumPost[]>(() =>
    readStoredValue(FORUM_STORAGE_KEYS.posts, [], (value): value is ForumPost[] =>
      Array.isArray(value) && value.every(isForumPost)
    )
  );
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // ==================== 5. 弹窗与多选状态 ====================
  const [showTopMenu, setShowTopMenu] = useState(false);

  // 板块新增/编辑弹窗
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState<ForumBoard | null>(null);
  const [boardNameInput, setBoardNameInput] = useState('');
  const [boardPromptInput, setBoardPromptInput] = useState('');
  const [boardAnonInput, setBoardAnonInput] = useState(false);

  // 发帖 / 生成新帖弹窗
  const [showPostModal, setShowPostModal] = useState(false);
  const [postMode, setPostMode] = useState<'self' | 'stranger' | 'char'>('self');
  const [selectedCharForPost, setSelectedCharForPost] = useState<string>('random');
  const [charPostIdentity, setCharPostIdentity] = useState<'char_self' | 'char_npc'>('char_self');
  const [selectedNpcForPost, setSelectedNpcForPost] = useState<string>('random'); // 'random' 或 具体 npc.id
  const [postTitleInput, setPostTitleInput] = useState('');
  const [postContentInput, setPostContentInput] = useState('');

  // 评论区可见与参与人员（多选组合 + 具体 NPC 选择）
  const [incPasserby, setIncPasserby] = useState<boolean>(true);
  const [incRandomChar, setIncRandomChar] = useState<boolean>(false);
  const [incCustomChar, setIncCustomChar] = useState<boolean>(false);
  const [customVisibleCharIds, setCustomVisibleCharIds] = useState<string[]>([]);
  const [incCharNpc, setIncCharNpc] = useState<boolean>(false);
  const [commentNpcRule, setCommentNpcRule] = useState<'random' | 'custom'>('random');
  const [customVisibleNpcIds, setCustomVisibleNpcIds] = useState<string[]>([]);

  const [isGeneratingPost, setIsGeneratingPost] = useState(false);

  // 玩家资料编辑弹窗
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [tempProfile, setTempProfile] = useState<PlayerForumProfile>(currentProfile);
  const [editingAltAccountId, setEditingAltAccountId] = useState<string | null>(null);

  // 转发帖子给微信角色弹窗
  const [forwardingPost, setForwardingPost] = useState<ForumPost | null>(null);
  const [forwardTargetCharId, setForwardTargetCharId] = useState<string>(contacts[0]?.id || '');
  const [noticeBanner, setNoticeBanner] = useState('');

  // 评论回复与再生成状态
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTarget, setReplyTarget] = useState<{
    postId: string;
    noId: number;
    authorName: string;
  } | null>(null);
  const [generatingCommentPostId, setGeneratingCommentPostId] = useState<string | null>(null);

  const [deletingPost, setDeletingPost] = useState<ForumPost | null>(null);

  const boardPressTimer = useRef<number | null>(null);
  const postPressTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      writeStoredValue(FORUM_STORAGE_KEYS.boards, boards);
      writeStoredValue(FORUM_STORAGE_KEYS.posts, posts);
      writeStoredValue(FORUM_STORAGE_KEYS.playerProfiles, playerProfiles);
      writeStoredValue(FORUM_STORAGE_KEYS.playerAccounts, playerAccounts);
      writeStoredValue(FORUM_STORAGE_KEYS.activePlayerAccounts, activePlayerAccounts);
      writeStoredValue(FORUM_STORAGE_KEYS.themePresets, themePresets);
      writeStoredValue(FORUM_STORAGE_KEYS.activePresetId, activePresetId);
      writeStoredValue(FORUM_STORAGE_KEYS.currentTheme, currentTheme);
      writeStoredValue(FORUM_STORAGE_KEYS.worldBookIds, selectedForumWorldBookIds);
      writeStoredValue(FORUM_STORAGE_KEYS.breakLimitWords, forumBreakLimitWords);
    } catch (error) {
      console.error('Could not persist forum data.', error);
      setNoticeBanner('论坛数据保存失败，请检查浏览器本地存储空间。');
    }
  }, [boards, posts, playerProfiles, playerAccounts, activePlayerAccounts, themePresets, activePresetId, currentTheme, selectedForumWorldBookIds, forumBreakLimitWords]);

  // 当前选中的发帖角色名下的 NPC 列表
  const npcsForSelectedPostChar =
    selectedCharForPost === 'random'
      ? allNpcs
      : allNpcs.filter((n) => n.charId === selectedCharForPost);

  // ==================== 6. 工具与美化预设逻辑 ====================
  const handleSelectPlayerAccount = (accountId: string) => {
    setActivePlayerAccounts((previous) => ({ ...previous, [activeBoardId]: accountId }));
  };

  const handleCreateAltAccount = () => {
    const account: PlayerForumAccount = {
      id: `alt-${Date.now()}-${randomHashId().toLowerCase()}`,
      nickname: `${currentProfile.nickname}的小号`,
      handleId: `alt_${randomHashId().toLowerCase()}`,
      avatarUrl: '',
      bio: '',
    };
    setPlayerAccounts((previous) => ({
      ...previous,
      [activeBoardId]: [...(previous[activeBoardId] ?? []), account],
    }));
    setActivePlayerAccounts((previous) => ({ ...previous, [activeBoardId]: account.id }));
    setEditingAltAccountId(account.id);
    setTempProfile(account);
    setShowProfileModal(true);
  };

  const handleSavePlayerProfile = () => {
    const nickname = tempProfile.nickname.trim();
    let handleId: string;
    try {
      handleId = normalizeForumHandle(tempProfile.handleId);
    } catch (error) {
      setNoticeBanner(error instanceof Error ? error.message : '论坛 ID 格式无效。');
      return;
    }
    if (!nickname || !handleId) {
      setNoticeBanner('论坛昵称和账号 ID 不能为空。');
      return;
    }
    const savedProfile = { ...tempProfile, nickname, handleId, bio: tempProfile.bio.trim() };
    if (editingAltAccountId) {
      setPlayerAccounts((previous) => ({
        ...previous,
        [activeBoardId]: (previous[activeBoardId] ?? []).map((account) =>
          account.id === editingAltAccountId ? { ...savedProfile, id: editingAltAccountId } : account),
      }));
    } else {
      setPlayerProfiles((previous) => ({ ...previous, [activeBoardId]: savedProfile }));
    }
    setShowProfileModal(false);
  };

  const handleLocalImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onSuccess(await compressImage(file));
    } catch (error) {
      console.error('Could not compress forum image.', error);
      showYyError(error instanceof Error ? error.message : '图片压缩失败，请重新选择。', '图片处理失败');
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setActivePresetId(presetId);
    const found = themePresets.find((p) => p.id === presetId);
    if (found) setCurrentTheme({ ...found });
  };

  const handleSaveAsNewPreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const newId = `preset-${Date.now()}`;
    const newPreset: ForumThemePreset = { ...currentTheme, id: newId, name };
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
    setCurrentTheme(nextList.find((p) => p.id === 'default') || DEFAULT_FORUM_PRESET);
  };

  // ==================== 7. 板块管理 ====================
  const openCreateBoard = () => {
    setEditingBoard(null);
    setBoardNameInput('');
    setBoardPromptInput('');
    setBoardAnonInput(false);
    setShowBoardModal(true);
  };

  const openEditBoard = (board: ForumBoard) => {
    setEditingBoard(board);
    setBoardNameInput(board.name);
    setBoardPromptInput(board.prompt);
    setBoardAnonInput(board.isAnonymous);
    setShowBoardModal(true);
  };

  const handleSaveBoard = () => {
    const name = boardNameInput.trim();
    if (!name) return;
    if (editingBoard) {
      setBoards((prev) =>
        prev.map((b) =>
          b.id === editingBoard.id
            ? { ...b, name, prompt: boardPromptInput.trim(), isAnonymous: boardAnonInput }
            : b
        )
      );
    } else {
      const newId = `board-${Date.now()}`;
      const newBoard: ForumBoard = {
        id: newId,
        name,
        prompt: boardPromptInput.trim() || '自由讨论社区',
        isAnonymous: boardAnonInput,
        styleType: boardAnonInput ? '4ch' : 'custom',
      };
      setBoards((prev) => [...prev, newBoard]);
      setActiveBoardId(newId);
    }
    setShowBoardModal(false);
  };

  const handleDeleteBoard = (boardId: string) => {
    if (boards.length <= 1) {
      showYyError('至少需要保留一个论坛板块哦~', '小提示');
      return;
    }
    const nextBoards = boards.filter((b) => b.id !== boardId);
    setBoards(nextBoards);
    setPosts((prev) => prev.filter((p) => p.boardId !== boardId));
    if (activeBoardId === boardId) setActiveBoardId(nextBoards[0].id);
    setShowBoardModal(false);
  };

  // ==================== 8. AI 生成帖子与初始评论 ====================
  const mapAiComments = (
    rawComments: unknown,
    allowedCommenters: ForumCommenter[],
    isAnon: boolean,
    baseNoId: number,
    opNoId: number,
    expectedCount: number,
    minimumCount = expectedCount
  ): ForumComment[] => {
    if (!Array.isArray(rawComments) || rawComments.length < minimumCount || rawComments.length > expectedCount) {
      throw new Error(`AI 返回的评论数量不正确（需要 ${minimumCount === expectedCount ? expectedCount : `${minimumCount} 到 ${expectedCount}`} 条）。`);
    }
    return rawComments.map((raw, index) => {
      if (
        !isRecord(raw) ||
        typeof raw.content !== 'string' ||
        !raw.content.trim() ||
        typeof raw.speakerType !== 'string' ||
        typeof raw.speakerId !== 'string'
      ) {
        throw new Error('AI 返回的评论格式不正确，请重试。');
      }
      const speaker = allowedCommenters.find(
        (candidate) => candidate.type === raw.speakerType && candidate.id === raw.speakerId
      );
      if (!speaker) throw new Error('AI 使用了未在参与设置中允许的评论身份，请重试。');
      const character = speaker.type === 'char' ? contacts.find((contact) => contact.id === speaker.id) : undefined;
      const anonymous = isAnon;
      return {
        id: `comment-${Date.now()}-${index}`,
        noId: baseNoId + index,
        authorName: anonymous ? '无名氏' : speaker.type === 'passerby'
          ? (typeof raw.authorName === 'string' && raw.authorName.trim()
            ? raw.authorName.trim()
            : `冲浪网友_${Math.floor(100 + Math.random() * 899)}`)
          : speaker.type === 'char'
            ? contacts.find((contact) => contact.id === speaker.id)?.forumNickname?.trim() || speaker.name
            : speaker.name,
        authorAvatar: !anonymous && speaker.type === 'char'
          ? contacts.find((contact) => contact.id === speaker.id)?.avatarUrl
          : undefined,
        authorId: anonymous
          ? randomHashId()
          : character
            ? resolveForumHandle(character, raw.authorHandle)
            : speaker.type === 'passerby'
            ? `netizen_${randomHashId().toLowerCase()}`
            : `${speaker.type}_${speaker.id}`,
        ...(speaker.type === 'char' ? {
          isChar: true,
          charId: speaker.id,
          realCharName: speaker.name,
        } : {}),
        ...(speaker.type === 'npc' ? {
          isNpc: true,
          npcId: speaker.id,
          realNpcName: speaker.name,
          charId: speaker.charId,
          realCharName: speaker.charName,
        } : {}),
        content: raw.content.trim(),
        time: '刚刚',
      };
    });
  };

  const handlePublishOrGeneratePost = async () => {
    if (!activeBoard || isGeneratingPost) return;
    setIsGeneratingPost(true);
    setNoticeBanner('');
    const isAnon = activeBoard.isAnonymous;
    const participantConfig: CommentParticipantConfig = {
      includePasserby: incPasserby,
      includeRandomChar: incRandomChar,
      includeCustomChar: incCustomChar,
      customCharIds: [...customVisibleCharIds],
      includeCharNpc: incCharNpc,
      npcRule: commentNpcRule,
      customNpcIds: [...customVisibleNpcIds],
    };
    const allowedCommenters = selectAllowedCommenters(participantConfig, contacts, allNpcs);
    let authorName = isAnon ? '无名氏' : currentProfile.nickname;
    let authorId = isAnon ? randomHashId() : currentProfile.handleId;
    let isPlayer = false;
    let isPlayerAlt = false;
    let isChar = false;
    let charId: string | undefined;
    let realCharName: string | undefined;
    let isNpc = false;
    let npcId: string | undefined;
    let realNpcName: string | undefined;

    if (postMode === 'self') {
      isPlayer = true;
      isPlayerAlt = currentProfileIsAlt;
    } else if (postMode === 'stranger') {
      authorName = isAnon ? '无名氏' : `热心网友_${Math.floor(100 + Math.random() * 900)}`;
      authorId = isAnon ? randomHashId() : `stranger_${randomHashId().toLowerCase()}`;
    } else {
      const selectedChar = selectedCharForPost === 'random'
        ? contacts[Math.floor(Math.random() * contacts.length)]
        : contacts.find((contact) => contact.id === selectedCharForPost);
      if (!selectedChar) {
        setNoticeBanner('请先创建通讯录角色，再选择角色发帖。');
        setIsGeneratingPost(false);
        return;
      }
      charId = selectedChar.id;
      realCharName = selectedChar.name;
      if (charPostIdentity === 'char_npc') {
        const eligible = allNpcs.filter((npc) => npc.charId === selectedChar.id);
        const selectedNpc = selectedNpcForPost === 'random'
          ? eligible[Math.floor(Math.random() * eligible.length)]
          : eligible.find((npc) => npc.id === selectedNpcForPost);
        if (!selectedNpc) {
          setNoticeBanner(`「${selectedChar.name}」还没有可用于发帖的关联 NPC。`);
          setIsGeneratingPost(false);
          return;
        }
        isNpc = true;
        npcId = selectedNpc.id;
        realNpcName = selectedNpc.name;
        authorName = isAnon ? '无名氏' : selectedNpc.name;
        authorId = isAnon ? randomHashId() : `npc_${selectedNpc.id}`;
      } else {
        isChar = true;
        authorName = isAnon ? '无名氏' : selectedChar.forumNickname?.trim() || selectedChar.name;
        authorId = isAnon ? randomHashId() : `official_${selectedChar.id}`;
      }
    }

    const authorDescription = isPlayer && isPlayerAlt
      ? `一位普通论坛网友，论坛昵称为「${currentProfile.nickname}」，与玩家及通讯录角色没有已知关联。`
      : isPlayer
      ? `玩家本人，论坛昵称为「${currentProfile.nickname}」。`
      : isNpc
        ? `角色关联 NPC「${realNpcName}」，所属角色为「${realCharName}」。`
        : isChar
          ? `通讯录角色「${realCharName}」本人。`
          : '普通路人网友。';
    const characterPersona = charId ? getCharacterPersona(charId) : '';
    const initialCommentCount = allowedCommenters.length > 0 ? 5 : 0;
    const systemPrompt = [
      '你是一个中文社交平台内容生成器。只返回合法 JSON，不要使用 Markdown。',
      '根据板块氛围创作自然、具体、有差异的帖子和评论。严格使用提供的参与者名单；不得创造角色、NPC或假装其身份。',
      '评论 JSON 格式为 { "speakerType": "passerby|char|npc", "speakerId": "名单中的 id", "authorName": "路人昵称（仅路人）", "authorHandle":"角色论坛ID（角色评论必填）", "content": "评论正文" }。',
      '非匿名板块：角色 authorHandle 优先使用提供的 forumHandle；未提供则按角色人设、兴趣或生活习惯生成有辨识度的网名式 ID，2–40 个字母、数字、汉字、下划线、短横线或英文句点，不加 @，不要使用内部角色编号或 official_/char_ 等模板编号。同一角色保持一致。若发帖人是角色本人，也在顶层 authorHandle 返回其 ID。',
      '帖子的发帖人由应用固定，不要在帖子内容中添加身份元数据。板块氛围只决定正文风格，不能改变输出 JSON 结构。',
    ].join('\n');
    const userPrompt = JSON.stringify({
      board: { name: activeBoard.name, style: activeBoard.styleType, prompt: activeBoard.prompt },
      anonymousBoard: isAnon,
      author: authorDescription,
      characterPersona,
      authorForumHandle: charId && isChar
        ? contacts.find((contact) => contact.id === charId)?.forumHandle || readGeneratedForumHandles()[charId]
        : undefined,
      requestedTitle: postTitleInput.trim(),
      userTopicOrDraft: postContentInput.trim(),
      allowedCommenters,
      commentCount: initialCommentCount ? `1 到 ${initialCommentCount} 条；同一身份可以重复评论` : 0,
      outputExample: {
        ...(isChar && !isAnon ? { authorHandle: '根据人设生成的角色论坛ID' } : {}),
        title: '帖子标题（可为空）',
        content: '帖子正文',
        comments: allowedCommenters.length ? [{
          speakerType: allowedCommenters[0].type,
          speakerId: allowedCommenters[0].id,
          authorName: '路人昵称（非路人忽略）',
          authorHandle: '角色评论需填写，路人忽略',
          content: '评论正文',
        }] : [],
      },
    });

    try {
      const worldBookContactIds = [...new Set([
        ...(charId ? [charId] : []),
        ...allowedCommenters.flatMap((commenter) =>
          commenter.type === 'char' ? [commenter.id] : commenter.charId ? [commenter.charId] : []
        ),
      ])];
      const relationContexts = getChatRelationContexts(worldBookContactIds);
      const generated = parseForumPost(await requestConfiguredAiText(
        withForumBreakLimit([
          relationContexts.length
            ? `参与角色的对话关系补充（用于理解关系和背景）：\n${relationContexts.join('\n\n')}`
            : '',
          withWorldBooksForContacts(
            systemPrompt,
            worldBookContactIds,
            selectedForumWorldBookIds ?? undefined
          ),
        ].filter(Boolean).join('\n\n'), forumBreakLimitWords),
        userPrompt,
        { json: true, includeGlobalWorldBooks: false }
      ));
      if (isChar && !isAnon) {
        const author = contacts.find((contact) => contact.id === charId);
        if (!author) throw new Error('发帖角色已不存在，请重新选择。');
        authorId = resolveForumHandle(author, generated.authorHandle);
      }
      const opNo = randomNo();
      const comments = mapAiComments(
        generated.comments,
        allowedCommenters,
        isAnon,
        opNo + 1,
        opNo,
        initialCommentCount,
        initialCommentCount ? 1 : 0
      );
      const newPost: ForumPost = {
        id: `post-${Date.now()}`,
        boardId: activeBoard.id,
        noId: opNo,
        authorName,
        authorId,
        authorAvatar: isAnon ? undefined : isPlayer
          ? currentProfile.avatarUrl
          : isChar ? contacts.find((contact) => contact.id === charId)?.avatarUrl : undefined,
        isPlayer: isPlayer && !isPlayerAlt,
        isPlayerAlt,
        isChar,
        charId,
        realCharName,
        isNpc,
        npcId,
        realNpcName,
        title: (isPlayer && postTitleInput.trim() ? postTitleInput.trim() : generated.title.trim()) || undefined,
        content: isPlayer && postContentInput.trim() ? postContentInput.trim() : generated.content.trim(),
        time: '刚刚',
        likes: Math.floor(Math.random() * 20),
        participantConfig,
        comments,
      };
      setPosts((previous) => [newPost, ...previous]);
      setExpandedPostId(newPost.id);
      setShowPostModal(false);
      setPostTitleInput('');
      setPostContentInput('');
    } catch (error) {
      console.error('Could not generate forum post.', error);
      setNoticeBanner(error instanceof Error ? error.message : '生成帖子失败，请检查 API 配置后重试。');
    } finally {
      setIsGeneratingPost(false);
    }
  };

  // ==================== 9. 评论区玩家回复 & 再生成 6 条新评论（严格遵循原帖配置） ====================
  const handleSendPlayerComment = (post: ForumPost) => {
    const raw = (commentInputs[post.id] || '').trim();
    if (!raw) return;
    const isAnon = activeBoard.isAnonymous;
    const nextNo = post.noId + post.comments.length + 1;

    const replyPrefix =
      replyTarget && replyTarget.postId === post.id
        ? isAnon
          ? `>>No.${replyTarget.noId}\n`
          : `回复 @${replyTarget.authorName}：`
        : '';

    const newComment: ForumComment = {
      id: `c-me-${Date.now()}`,
      noId: nextNo,
      authorName: isAnon ? '无名氏' : currentProfile.nickname,
      authorId: isAnon ? randomHashId() : currentProfile.handleId,
      authorAvatar: !isAnon ? currentProfile.avatarUrl : undefined,
      isPlayer: !currentProfileIsAlt,
      isPlayerAlt: currentProfileIsAlt,
      isOP: Boolean(post.isPlayer || post.isPlayerAlt),
      replyToNo: replyTarget?.postId === post.id ? replyTarget.noId : undefined,
      replyToName: replyTarget?.postId === post.id ? replyTarget.authorName : undefined,
      content: `${replyPrefix}${raw}`,
      time: '刚刚',
    };

    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, comments: [...p.comments, newComment] } : p))
    );
    setCommentInputs((prev) => ({ ...prev, [post.id]: '' }));
    setReplyTarget(null);
  };

  // 点击“再生成 6 条新评论”：直接读取 post.participantConfig，100% 遵循此帖最初的角色/NPC/路人设定
  const handleGenerateMoreComments = async (post: ForumPost) => {
    if (generatingCommentPostId) return;
    const board = boards.find((item) => item.id === post.boardId);
    if (!board) {
      setNoticeBanner('找不到该帖所属的论坛板块。');
      return;
    }
    const allowedCommenters = selectAllowedCommenters(post.participantConfig, contacts, allNpcs);
    if (allowedCommenters.length === 0) {
      setNoticeBanner('该帖未设置任何可参与评论的身份，无法生成新评论。');
      return;
    }
    setGeneratingCommentPostId(post.id);
    setNoticeBanner('');
    try {
      const commenterContactIds = [...new Set(allowedCommenters.flatMap((commenter) =>
        commenter.type === 'char' ? [commenter.id] : commenter.charId ? [commenter.charId] : []
      ))];
      const commenterRelationContexts = getChatRelationContexts(commenterContactIds);
      const generated = parseAiJson(await requestConfiguredAiText(
        withForumBreakLimit([
          commenterRelationContexts.length
            ? `评论角色的对话关系补充（用于理解角色关系和背景）：\n${commenterRelationContexts.join('\n\n')}`
            : '',
          withWorldBooksForContacts(
            '你是中文社交平台评论续写器。只返回合法 JSON，不要使用 Markdown。严格只使用提供的评论者名单，不得创作未授权角色或 NPC。非匿名板块的角色评论必须附 authorHandle：优先用名单中的 forumHandle，若未提供，按人设生成特别的网名式 ID，2–40 个字母、数字、汉字、下划线、短横线或英文句点，不加 @，不用角色内部编号。同一角色保持一致。',
            commenterContactIds,
            selectedForumWorldBookIds ?? undefined
          ),
        ].filter(Boolean).join('\n\n'), forumBreakLimitWords),
        JSON.stringify({
          board: { name: board.name, prompt: board.prompt, anonymous: board.isAnonymous },
          post: { title: post.title ?? '', content: post.content },
          recentComments: post.comments.slice(-20).map((comment) => ({
            author: comment.authorName,
            content: comment.content,
            player: Boolean(comment.isPlayer),
            character: comment.isChar ? comment.realCharName : undefined,
            npc: comment.isNpc ? comment.realNpcName : undefined,
          })),
          allowedCommenters,
          requiredCount: 6,
          outputShape: {
            comments: 'array of exactly 6 items; each item has speakerType, speakerId, authorName (passerby only), authorHandle (char only), content',
          },
        }),
        { json: true, includeGlobalWorldBooks: false }
      )) as unknown;
      if (!isRecord(generated) || !Array.isArray(generated.comments)) {
        throw new Error('AI 返回的评论数据格式不正确，请重试。');
      }
      const moreComments = mapAiComments(
        generated.comments,
        allowedCommenters,
        board.isAnonymous,
        post.noId + post.comments.length + 1,
        post.noId,
        6
      );
      setPosts((previous) =>
        previous.map((item) =>
          item.id === post.id ? { ...item, comments: [...item.comments, ...moreComments] } : item
        )
      );
    } catch (error) {
      console.error('Could not generate forum comments.', error);
      setNoticeBanner(error instanceof Error ? error.message : '生成评论失败，请检查 API 配置后重试。');
    } finally {
      setGeneratingCommentPostId(null);
    }
  };

  // ==================== 10. 转发帖子给角色（含身份标注与优先级：玩家本人 > 其他角色/NPC > 路人网友） ====================
  const formatAuthorIdentityForAi = (item: {
    authorName: string;
    isPlayer?: boolean;
    isPlayerAlt?: boolean;
    isChar?: boolean;
    realCharName?: string;
    isNpc?: boolean;
    realNpcName?: string;
  }) => {
    if (item.isPlayer) {
      return `【玩家本人(User) · 论坛显示名：${item.authorName}】`;
    }
    if (item.isPlayerAlt) {
      return `【普通论坛网友 · 论坛显示名：${item.authorName}】`;
    }
    if (item.isNpc) {
      return `【重要角色关联NPC：${item.realNpcName || item.authorName}${item.realCharName ? `（关联角色：${item.realCharName}）` : ''} · 论坛显示名：${item.authorName}】`;
    }
    if (item.isChar) {
      return `【重要角色：${item.realCharName || item.authorName} · 论坛显示名：${item.authorName}】`;
    }
    return `【普通路人网友：${item.authorName}】`;
  };

  const handleConfirmForwardToChar = () => {
    if (!forwardingPost) return;
    const targetChar = contacts.find((c) => c.id === forwardTargetCharId);
    const postBoard = boards.find((board) => board.id === forwardingPost.boardId);
    if (!targetChar) {
      setNoticeBanner('请选择有效的通讯录角色后再转发。');
      return;
    }

    const postAuthorTag = formatAuthorIdentityForAi(forwardingPost);
    const formattedComments = forwardingPost.comments.map((c) => ({
      authorDisplay: c.authorName,
      identityTagForAi: formatAuthorIdentityForAi(c),
      priority: c.isPlayer ? 'highest_user' : c.isChar || c.isNpc ? 'high_character' : 'normal_passerby',
      content: c.content,
    }));

    // 组装给 AI 阅读的结构化摘要（让接收转发的角色一眼认出 User、其他角色真实名字，也能看到逆天路人言论）
    const aiReadableSummary = [
      '[身份识别规则：仅明确标记为玩家本人(User)的发帖人或评论者才是当前玩家；普通论坛网友与玩家没有已知关联，不要猜测或推断其身份。其他角色与NPC的真实姓名仅用于识别，不代表你已认识他们，也不要推断其人设背景；路人内容可见，关注优先级通常较低，但离谱或有趣时可以吐槽。]',
      `[玩家向你转发了一条来自「${postBoard?.name ?? activeBoard.name}」的论坛帖子]`,
      `发帖人：${postAuthorTag}`,
      forwardingPost.title ? `标题：${forwardingPost.title}` : '',
      `正文内容：${forwardingPost.content}`,
      `--- 评论区内容（共 ${formattedComments.length} 条，请优先留意【玩家本人】与【重要角色/NPC】的发言，若不认识某位角色可主动询问玩家；若某位【普通路人网友】发表了逆天或有意思的言论也可吐槽或询问玩家） ---`,
      ...formattedComments.map((c, i) => `${i + 1}L ${c.identityTagForAi}：${c.content}`),
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const now = new Date().toISOString();
      const message = {
        id: `forum-forward-${Date.now()}-${randomHashId()}`,
        senderId: 'user',
        text: aiReadableSummary,
        kind: 'forum-forward',
        forumForwardTargetId: forwardTargetCharId,
        title: `${postAuthorTag} · ${forwardingPost.title || '论坛帖子'}`,
        content: `${forwardingPost.content.slice(0, 180)}${forwardingPost.content.length > 180 ? '…' : ''} · ${formattedComments.length} 条评论`,
        source: `来自 论坛 · ${postBoard?.name ?? activeBoard.name}`,
        aiContext: aiReadableSummary,
        forumDetails: {
          boardName: postBoard?.name ?? activeBoard.name,
          author: postAuthorTag,
          title: forwardingPost.title,
          body: forwardingPost.content,
          comments: forwardingPost.comments.map((comment) => ({
            authorName: formatAuthorIdentityForAi(comment),
            content: comment.content,
          })),
        },
        createdAt: now,
      };
      const queue = readStoredValue<unknown[]>(FORUM_STORAGE_KEYS.forwards, [], Array.isArray);
      writeStoredValue(FORUM_STORAGE_KEYS.forwards, [
        ...queue,
        { targetCharId: forwardTargetCharId, message },
      ]);
      setNoticeBanner(
        `已转发给「${targetChar.name}」（已标注你的身份与在场角色真名），进入微信会话后点生成即可看 TA 反应！`
      );
      setForwardingPost(null);
    } catch (error) {
      console.error('Could not forward the forum post to WeChat.', error);
      setNoticeBanner(error instanceof Error ? error.message : '转发失败，微信聊天数据未能保存。');
    }
  };

  const handleExportForum = () => {
    const dataStr = JSON.stringify(
      { boards, posts, playerProfiles, playerAccounts, activePlayerAccounts, themePresets, activePresetId, currentTheme },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forum_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderFormattedContent = (text: string, isAnonBoard: boolean) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('>>No.')) {
        return (
          <p key={i} className="text-[11px] font-mono font-bold text-rose-500">
            {line}
          </p>
        );
      }
      if (isAnonBoard && trimmed.startsWith('>')) {
        return (
          <p key={i} className="text-xs font-medium text-[#5A8F48] leading-relaxed">
            {line}
          </p>
        );
      }
      return (
        <p key={i} className="text-xs leading-relaxed break-words">
          {line}
        </p>
      );
    });
  };

  const bindCharacterProfile = <T extends ForumPost | ForumComment,>(item: T): T => {
    if (activeBoard.isAnonymous || !item.isChar) return item;
    const contact = contacts.find((candidate) => candidate.id === item.charId);
    return contact ? {
      ...item,
      authorName: contact.forumNickname?.trim() || contact.name,
      authorAvatar: contact.avatarUrl,
      authorId: contact.forumHandle || readGeneratedForumHandles()[contact.id] || item.authorId,
    } : item;
  };
  const boardPosts = posts.filter((p) => p.boardId === activeBoard.id).map((post) => ({
    ...bindCharacterProfile(post),
    comments: post.comments.map(bindCharacterProfile),
  }));
  const forumWorldBookIdsForDisplay = selectedForumWorldBookIds ??
    getAutomaticWorldBookIdsForContacts(contacts.map((contact) => contact.id));

  return (
    <div
      className="forum-custom-scope relative flex-1 w-full flex flex-col overflow-hidden select-none"
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

      {/* 顶部栏：“论坛”居中 */}
      <AppHeader
        title="论坛"
        onBack={onBack}
        rightAction={
          <button
            onClick={() => setShowTopMenu(true)}
            className="w-8 h-8 flex items-center justify-center text-sky-600 bg-white/70 hover:bg-white/90 backdrop-blur-md border border-white/90 rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="论坛美化与数据管理"
          >
            <Menu className="w-4 h-4 stroke-[2]" />
          </button>
        }
      />

      {/* 板块横向导航栏（长按板块可编辑或删除） */}
      <div className="px-4 py-2 z-10 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 bg-white/55 backdrop-blur-xl border border-white/85 rounded-2xl shadow-[0_4px_14px_rgba(148,163,184,0.06)]">
          {boards.map((b) => {
            const isActive = b.id === activeBoard.id;
            return (
              <button
                key={b.id}
                onClick={() => setActiveBoardId(b.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openEditBoard(b);
                }}
                onTouchStart={() => {
                  boardPressTimer.current = window.setTimeout(() => openEditBoard(b), 550);
                }}
                onTouchEnd={() => {
                  if (boardPressTimer.current) clearTimeout(boardPressTimer.current);
                }}
                onMouseDown={() => {
                  boardPressTimer.current = window.setTimeout(() => openEditBoard(b), 550);
                }}
                onMouseUp={() => {
                  if (boardPressTimer.current) clearTimeout(boardPressTimer.current);
                }}
                style={isActive ? { background: currentTheme.primaryGradient } : undefined}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                  isActive ? 'text-white shadow-2xs' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="长按可编辑或删除此板块"
              >
                {b.isAnonymous && <EyeOff className="w-3 h-3 opacity-80" />}
                <span>{b.name}</span>
              </button>
            );
          })}

          <button
            onClick={openCreateBoard}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-sky-500 bg-sky-50/80 hover:bg-sky-100/80 border border-sky-100 shrink-0 flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新板块</span>
          </button>
        </div>
      </div>

      {/* 主内容滚动区 */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-1 space-y-3">
        {noticeBanner && (
          <div className={`flex items-center justify-between rounded-2xl bg-white/85 backdrop-blur-md border px-3.5 py-2.5 text-[11px] font-bold shadow-2xs ${
            /失败|无效|无法|找不到|请先/.test(noticeBanner)
              ? 'border-rose-200 text-rose-600'
              : 'border-emerald-200 text-emerald-600'
          }`}>
            <span>{noticeBanner}</span>
            <button onClick={() => setNoticeBanner('')} className="text-slate-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 非匿名板块展示玩家名片；匿名板块展示简洁标识 */}
        {!activeBoard.isAnonymous ? (
          <div
            style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
            className="backdrop-blur-xl border border-white/85 p-3.5 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-white flex items-center justify-center font-extrabold text-xs overflow-hidden border border-white shrink-0">
                  {currentProfile.avatarUrl ? (
                    <img
                      src={currentProfile.avatarUrl}
                      alt={currentProfile.nickname}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold truncate">{currentProfile.nickname}</span>
                    {currentProfileIsAlt && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">小号</span>}
                    <span className="text-[10px] font-mono bg-sky-50 text-sky-500 px-1.5 py-0.5 rounded-full border border-sky-100 shrink-0">
                      @{currentProfile.handleId}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">{currentProfile.bio}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setTempProfile(currentProfile);
                  setEditingAltAccountId(currentProfileIsAlt ? activePlayerAccount?.id ?? null : null);
                  setShowProfileModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/90 border border-white text-[11px] font-bold text-sky-500 cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
              >
                <Pencil className="w-3 h-3" />
                <span>名片</span>
              </button>
            </div>
            <div className="flex gap-2">
              <select
                aria-label="切换此论坛的身份"
                value={currentProfileIsAlt ? activePlayerAccount?.id ?? '' : 'main'}
                onChange={(event) => handleSelectPlayerAccount(event.target.value === 'main' ? '' : event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-white bg-white/85 px-2.5 py-2 text-[10px] font-semibold text-slate-600 outline-none"
              >
                <option value="main">主账号 · {playerProfiles[activeBoardId]?.nickname ?? '默认身份'}</option>
                {(playerAccounts[activeBoardId] ?? []).map((account) => (
                  <option key={account.id} value={account.id}>{account.nickname} · @{account.handleId}</option>
                ))}
              </select>
              <button type="button" onClick={handleCreateAltAccount}
                className="shrink-0 rounded-xl bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-600">
                + 创建小号
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#F4F8F2]/85 backdrop-blur-xl border border-[#D5E6CF] rounded-2xl px-3.5 py-2 flex items-center justify-between text-[11px] text-[#4A6B3B]">
            <div className="flex items-center gap-2 min-w-0">
              <EyeOff className="w-3.5 h-3.5 shrink-0 text-[#5A8F48]" />
              <span className="font-bold truncate">
                {activeBoard.name} · 匿名串模式（全员无名氏，支持 &gt; 绿字引用）
              </span>
            </div>
          </div>
        )}

        {/* 顶部双按钮栏：「生成新帖」与「我要发帖」并排 */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => {
              setPostMode('stranger');
              setPostTitleInput('');
              setPostContentInput('');
              setShowPostModal(true);
            }}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#9BD2FC] to-[#B6C8F8] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs border border-white/60 active:scale-98 transition-transform cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>生成新帖</span>
          </button>

          <button
            onClick={() => {
              setPostMode('self');
              setPostTitleInput('');
              setPostContentInput('');
              setShowPostModal(true);
            }}
            className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#F7B9D2] to-[#F9C6D9] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs border border-white/60 active:scale-98 transition-transform cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>我要发帖</span>
          </button>
        </div>

        {/* 帖子流列表 */}
        {boardPosts.length === 0 ? (
          <div
            style={{ backgroundColor: currentTheme.cardBg, borderRadius: currentTheme.cardRadius }}
            className="backdrop-blur-xl border border-white/85 p-8 text-center space-y-2"
          >
            <p className="text-xs font-bold opacity-80">「{activeBoard.name}」还没有帖子哦~</p>
            <p className="text-[10px] opacity-55">
              点击上方「生成新帖」或「我要发帖」开始热闹起来吧！
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {boardPosts.map((post) => {
              const isAnon = activeBoard.isAnonymous;
              const isExpanded = expandedPostId === post.id;

              return (
                <div
                  key={post.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDeletingPost(post);
                  }}
                  onTouchStart={() => {
                    postPressTimer.current = window.setTimeout(() => setDeletingPost(post), 600);
                  }}
                  onTouchEnd={() => {
                    if (postPressTimer.current) clearTimeout(postPressTimer.current);
                  }}
                  onMouseDown={() => {
                    postPressTimer.current = window.setTimeout(() => setDeletingPost(post), 600);
                  }}
                  onMouseUp={() => {
                    if (postPressTimer.current) clearTimeout(postPressTimer.current);
                  }}
                  style={
                    !isAnon
                      ? {
                          backgroundColor: currentTheme.cardBg,
                          borderRadius: currentTheme.cardRadius,
                        }
                      : { borderRadius: currentTheme.cardRadius }
                  }
                  className={`backdrop-blur-xl border p-4 transition-all space-y-2.5 shadow-[0_6px_18px_-6px_rgba(148,163,184,0.12)] ${
                    isAnon ? 'bg-[#FAFDF9]/85 border-[#DCE8D6]' : 'border-white/90'
                  }`}
                >
                  {/* 帖子头部 */}
                  {isAnon ? (
                    <div className="flex items-center justify-between text-[11px] font-mono border-b border-[#E6EFE2] pb-1.5">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-extrabold text-[#2E6B3E]">{post.authorName}</span>
                        <span className="bg-[#E8F2E4] text-[#4A6B3B] px-1.5 py-0.2 rounded text-[10px]">
                          ID:{post.authorId}
                        </span>
                        <span className="text-slate-400">{post.time}</span>
                        <span className="font-bold text-rose-500">No.{post.noId}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#9BD2FC] to-[#F7B9D2] text-white text-xs font-extrabold flex items-center justify-center overflow-hidden border border-white">
                          {post.authorAvatar ? (
                            <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{post.authorName.slice(0, 1)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold">{post.authorName}</span>
                            {activeBoard.styleType === 'tieba' && (
                              <span className="text-[9px] bg-sky-100 text-sky-600 px-1.5 py-0.2 rounded-md font-bold">
                                楼主
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] opacity-55">
                            @{post.authorId} · {post.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 帖子标题与正文 */}
                  <div className="space-y-1.5">
                    {post.title && (
                      <h4 className={`text-xs font-extrabold ${isAnon ? 'text-[#1E4620]' : ''}`}>
                        {post.title}
                      </h4>
                    )}
                    <div className="space-y-1">
                      {renderFormattedContent(post.content, isAnon)}
                    </div>
                  </div>

                  {/* 底部操作条 */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-[11px] opacity-75">
                    <button
                      onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                      className="flex items-center gap-1 font-bold text-sky-500 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>
                        {isExpanded ? '收起评论' : `评论 (${post.comments.length})`}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setForwardTargetCharId(contacts[0]?.id || '');
                        setForwardingPost(post);
                      }}
                      className="flex items-center gap-1 font-bold hover:text-pink-500 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>转发给角色</span>
                    </button>

                    <button
                      onClick={() =>
                        setPosts((prev) =>
                          prev.map((p) =>
                            p.id === post.id
                              ? {
                                  ...p,
                                  likedByMe: !p.likedByMe,
                                  likes: p.likedByMe ? p.likes - 1 : p.likes + 1,
                                }
                              : p
                          )
                        )
                      }
                      className={`flex items-center gap-1 font-bold cursor-pointer ${
                        post.likedByMe ? 'text-rose-500' : ''
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${post.likedByMe ? 'fill-rose-500' : ''}`} />
                      <span>{post.likes}</span>
                    </button>
                  </div>

                  {/* ==================== 展开的评论区 ==================== */}
                  {isExpanded && (
                    <div
                      className={`mt-2 pt-2.5 border-t space-y-2.5 ${
                        isAnon ? 'border-[#DCE8D6]' : 'border-slate-100'
                      }`}
                    >
                      <div className="space-y-2">
                        {post.comments.map((c, idx) => (
                          <div
                            key={c.id}
                            className={`rounded-2xl p-2.5 text-xs space-y-1 ${
                              isAnon
                                ? 'bg-[#F1F7EE] border border-[#DCE8D6]'
                                : 'bg-white/80 border border-white'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {!isAnon && (
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sky-100 text-sky-700">
                                    {c.authorAvatar
                                      ? <img src={c.authorAvatar} alt="" className="h-full w-full object-cover" />
                                      : c.authorName.slice(0, 1)}
                                  </span>
                                )}
                                <span
                                  className={`font-extrabold ${
                                    isAnon ? 'text-[#2E6B3E]' : 'text-[#2C4A5C]'
                                  }`}
                                >
                                  {c.authorName}
                                </span>
                                {isAnon ? (
                                  <>
                                    <span className="font-mono text-slate-400">
                                      ID:{c.authorId}
                                    </span>
                                    <span className="font-mono font-bold text-rose-500">
                                      No.{c.noId}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400 font-mono">
                                    {activeBoard.styleType === 'tieba'
                                      ? `${idx + 2}楼`
                                      : `@${c.authorId}`}
                                  </span>
                                )}
                                {c.isOP && (
                                  <span className="bg-sky-100 text-sky-600 px-1.5 py-0.2 rounded font-bold">
                                    楼主
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() =>
                                  setReplyTarget({
                                    postId: post.id,
                                    noId: c.noId,
                                    authorName: c.authorName,
                                  })
                                }
                                className="text-sky-500 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                              >
                                <CornerDownRight className="w-3 h-3" />
                                <span>回复</span>
                              </button>
                            </div>

                            <div className="text-slate-700">
                              {renderFormattedContent(c.content, isAnon)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 玩家回复输入框 */}
                      <div className="space-y-1.5 pt-1">
                        {replyTarget && replyTarget.postId === post.id && (
                          <div className="flex items-center justify-between text-[10px] bg-sky-50 text-sky-600 px-2.5 py-1 rounded-xl">
                            <span>
                              正在回复{' '}
                              {isAnon ? `>>No.${replyTarget.noId}` : `@${replyTarget.authorName}`}
                            </span>
                            <button
                              onClick={() => setReplyTarget(null)}
                              className="font-bold cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(e) =>
                              setCommentInputs((prev) => ({
                                ...prev,
                                [post.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === 'Enter' && handleSendPlayerComment(post)
                            }
                            placeholder={
                              isAnon
                                ? '以无名氏身份跟串（可用 > 写绿字）...'
                                : `以 ${currentProfile.nickname} 身份写评论...`
                            }
                            className="flex-1 px-3 py-2 rounded-2xl bg-white border border-slate-200 text-xs text-slate-700 outline-none focus:border-sky-400"
                          />
                          <button
                            onClick={() => handleSendPlayerComment(post)}
                            style={{ background: currentTheme.primaryGradient }}
                            className="p-2 rounded-2xl text-white cursor-pointer active:scale-95"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 再生成 6 条新评论（严格遵循该帖最初保存的 participantConfig） */}
                      <button
                        onClick={() => handleGenerateMoreComments(post)}
                        disabled={generatingCommentPostId === post.id}
                        className="w-full py-2 rounded-2xl bg-sky-50/90 hover:bg-sky-100/80 border border-sky-200/70 text-sky-600 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            generatingCommentPostId === post.id ? 'animate-spin' : ''
                          }`}
                        />
                        <span>
                          {generatingCommentPostId === post.id
                            ? '正在生成 6 条新评论...'
                            : '✨ 再生成 6 条新评论'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== 弹窗 1：发帖 / 生成新帖弹窗（支持选具体 NPC 发帖 & 选具体 NPC 评论） ==================== */}
      {showPostModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 max-h-[92%] overflow-y-auto text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">
                在「{activeBoard.name}」发帖 / 生成
              </h3>
              <button
                onClick={() => setShowPostModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 发帖人模式切换 */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
              {[
                { key: 'self', label: '我自己发' },
                { key: 'stranger', label: '路人发帖' },
                { key: 'char', label: '角色/NPC发帖' },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPostMode(m.key as typeof postMode)}
                  className={`py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                    postMode === m.key
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* 如果选了“角色/NPC发帖”：选角色 + 选是角色本人还是具体哪一个 NPC 发帖 */}
            {postMode === 'char' && (
              <div className="space-y-2.5 bg-pink-50/50 p-3 rounded-2xl border border-pink-100">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">发帖人身份：</span>
                  <div className="flex gap-1 bg-white p-0.5 rounded-xl border border-pink-100">
                    <button
                      type="button"
                      onClick={() => setCharPostIdentity('char_self')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                        charPostIdentity === 'char_self'
                          ? 'bg-pink-400 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      角色本人
                    </button>
                    <button
                      type="button"
                      onClick={() => setCharPostIdentity('char_npc')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                        charPostIdentity === 'char_npc'
                          ? 'bg-indigo-400 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      TA的关联NPC
                    </button>
                  </div>
                </div>

                {/* 选择所属角色 */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCharForPost('random');
                      setSelectedNpcForPost('random');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer ${
                      selectedCharForPost === 'random'
                        ? 'bg-pink-400 text-white border-transparent'
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
                      onClick={() => {
                        setSelectedCharForPost(c.id);
                        setSelectedNpcForPost('random');
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border cursor-pointer ${
                        selectedCharForPost === c.id
                          ? 'bg-sky-400 text-white border-transparent'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* 如果选了“TA的关联NPC”，展开该角色名下的多个具体 NPC 供单选或随机 */}
                {charPostIdentity === 'char_npc' && (
                  <div className="pt-1.5 border-t border-pink-100 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold block">
                      选择具体哪位关联 NPC 发帖：
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedNpcForPost('random')}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          selectedNpcForPost === 'random'
                            ? 'bg-indigo-400 text-white border-transparent'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        🎲 随机NPC
                      </button>
                      {npcsForSelectedPostChar.map((npc) => (
                        <button
                          key={npc.id}
                          type="button"
                          onClick={() => setSelectedNpcForPost(npc.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                            selectedNpcForPost === npc.id
                              ? 'bg-indigo-400 text-white border-transparent'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          {npc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 标题与内容/提示词输入 */}
            {(activeBoard.styleType === 'tieba' || activeBoard.isAnonymous) && (
              <input
                type="text"
                placeholder={
                  postMode === 'self' ? '帖子标题（选填）' : '指定主题关键词（留空则自由发挥）'
                }
                value={postTitleInput}
                onChange={(e) => setPostTitleInput(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs font-bold"
              />
            )}

            <textarea
              rows={3}
              placeholder={
                postMode === 'self'
                  ? activeBoard.isAnonymous
                    ? '写下你的匿名串内容（行首加 > 可变成绿字引用）...'
                    : '分享你的新鲜事...'
                  : '写一点提示词（留空则随意发挥，自动生成帖子+评论区）...'
              }
              value={postContentInput}
              onChange={(e) => setPostContentInput(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs"
            />

            {/* 多选评论区参与者（后续点“再生成6条评论”将永久遵循此处勾选的设置） */}
            <div className="space-y-2 bg-sky-50/60 p-3 rounded-2xl border border-sky-100">
              <span className="text-[11px] font-bold text-slate-700 block">
                评论区谁会来评论？（可多选，后续生成新评论依然遵循此设置）
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setIncPasserby(!incPasserby)}
                  className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border cursor-pointer text-left flex items-center justify-between ${
                    incPasserby
                      ? 'bg-sky-400 text-white border-transparent'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <span>🌿 路人网友</span>
                  <span>{incPasserby ? '✓' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIncRandomChar(!incRandomChar)}
                  className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border cursor-pointer text-left flex items-center justify-between ${
                    incRandomChar
                      ? 'bg-pink-400 text-white border-transparent'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <span>🎲 随机角色</span>
                  <span>{incRandomChar ? '✓' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIncCustomChar(!incCustomChar)}
                  className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border cursor-pointer text-left flex items-center justify-between ${
                    incCustomChar
                      ? 'bg-pink-400 text-white border-transparent'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <span>🎯 指定角色</span>
                  <span>{incCustomChar ? '✓' : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIncCharNpc(!incCharNpc)}
                  className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border cursor-pointer text-left flex items-center justify-between ${
                    incCharNpc
                      ? 'bg-indigo-400 text-white border-transparent'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <span>👥 角色自带NPC</span>
                  <span>{incCharNpc ? '✓' : ''}</span>
                </button>
              </div>

              {/* 展开指定角色多选 */}
              {incCustomChar && (
                <div className="pt-1.5 border-t border-sky-100 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold block">
                    勾选可评论的角色：
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {contacts.map((c) => {
                      const checked = customVisibleCharIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setCustomVisibleCharIds((prev) =>
                              checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                            checked
                              ? 'bg-pink-400 text-white border-transparent'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          {checked ? '✓ ' : ''}{c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 展开具体 NPC 选择（支持随机 NPC 或多选指定某几个 NPC） */}
              {incCharNpc && (
                <div className="pt-1.5 border-t border-sky-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold">
                      选择哪些角色 NPC 参与评论：
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setCommentNpcRule('random')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                          commentNpcRule === 'random'
                            ? 'bg-indigo-400 text-white'
                            : 'bg-white text-slate-500'
                        }`}
                      >
                        随机NPC
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommentNpcRule('custom')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                          commentNpcRule === 'custom'
                            ? 'bg-indigo-400 text-white'
                            : 'bg-white text-slate-500'
                        }`}
                      >
                        指定NPC
                      </button>
                    </div>
                  </div>

                  {commentNpcRule === 'custom' && (
                    <div className="flex flex-wrap gap-1.5">
                      {allNpcs.map((npc) => {
                        const checked = customVisibleNpcIds.includes(npc.id);
                        return (
                          <button
                            key={npc.id}
                            type="button"
                            onClick={() =>
                              setCustomVisibleNpcIds((prev) =>
                                checked
                                  ? prev.filter((id) => id !== npc.id)
                                  : [...prev, npc.id]
                              )
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                              checked
                                ? 'bg-indigo-400 text-white border-transparent'
                                : 'bg-white text-slate-500 border-slate-200'
                            }`}
                          >
                            {checked ? '✓ ' : ''}{npc.name} ({npc.charName})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handlePublishOrGeneratePost}
              disabled={isGeneratingPost}
              style={{ background: currentTheme.primaryGradient }}
              className="w-full py-2.5 rounded-2xl text-white text-xs font-bold shadow-2xs cursor-pointer"
            >
              {isGeneratingPost
                ? '正在生成帖子与评论区...'
                : postMode === 'self'
                ? '立即发布'
                : '立即生成'}
            </button>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 2：新建 / 长按编辑或删除板块弹窗 ==================== */}
      {showBoardModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">
                {editingBoard ? `编辑「${editingBoard.name}」板块` : '创建新论坛板块'}
              </h3>
              <button
                onClick={() => setShowBoardModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">板块名称</label>
              <input
                type="text"
                placeholder="例如：豆瓣小组、校园表白墙、怪谈版"
                value={boardNameInput}
                onChange={(e) => setBoardNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">板块氛围与提示词</label>
              <textarea
                rows={3}
                placeholder="例如：大家喜欢在这里匿名吐槽奇葩室友、分享校园恋爱八卦..."
                value={boardPromptInput}
                onChange={(e) => setBoardPromptInput(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs"
              />
            </div>

            <div className="flex items-center justify-between bg-sky-50/60 p-3 rounded-2xl border border-sky-100">
              <div>
                <span className="text-xs font-bold block">是否为匿名论坛？</span>
                <span className="text-[10px] text-slate-400">
                  开启后采用 4ch 匿名串格式，隐藏玩家资料
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBoardAnonInput(!boardAnonInput)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer ${
                  boardAnonInput ? 'bg-[#5A8F48] text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {boardAnonInput ? '✓ 匿名论坛' : '实名/昵称论坛'}
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              {editingBoard && (
                <button
                  type="button"
                  onClick={() => handleDeleteBoard(editingBoard.id)}
                  className="px-3 py-2.5 rounded-2xl bg-rose-50 text-rose-500 text-xs font-bold cursor-pointer"
                >
                  删除板块
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveBoard}
                style={{ background: currentTheme.primaryGradient }}
                className="flex-1 py-2.5 rounded-2xl text-white text-xs font-bold cursor-pointer"
              >
                保存板块
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 3：非匿名论坛玩家个人资料设定 ==================== */}
      {showProfileModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3 text-slate-700">
            <h3 className="text-sm font-extrabold">
              {editingAltAccountId ? '设置论坛小号' : `我在「${activeBoard.name}」的个人资料`}
            </h3>
            {editingAltAccountId && (
              <p className="text-[10px] leading-relaxed text-slate-500">
                小号仅用于当前论坛板块。发帖和评论会以普通网友身份呈现，不会向角色标记为玩家本人。
              </p>
            )}
            <input
              type="text"
              placeholder="论坛昵称"
              value={tempProfile.nickname}
              onChange={(e) => setTempProfile({ ...tempProfile, nickname: e.target.value })}
              className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold"
            />
            <input
              type="text"
              placeholder="账号 ID"
              value={tempProfile.handleId}
              onChange={(e) => setTempProfile({ ...tempProfile, handleId: e.target.value })}
              className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-mono"
            />
            <input
              type="text"
              placeholder="个人简介 / 签名"
              value={tempProfile.bio}
              onChange={(e) => setTempProfile({ ...tempProfile, bio: e.target.value })}
              className="w-full px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs"
            />
            <div className="space-y-1.5 bg-sky-50/50 p-3 rounded-2xl border border-sky-100">
              <span className="text-[11px] font-bold block">头像 (URL 或本地上传)</span>
              <input
                type="text"
                placeholder="粘贴头像 URL..."
                value={tempProfile.avatarUrl}
                onChange={(e) => setTempProfile({ ...tempProfile, avatarUrl: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[11px]"
              />
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-sky-100 text-sky-500 text-[11px] font-bold cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>本地上传头像</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleLocalImageUpload(e, (b64) =>
                      setTempProfile({ ...tempProfile, avatarUrl: b64 })
                    )
                  }
                />
              </label>
            </div>
            <button
              onClick={handleSavePlayerProfile}
              style={{ background: currentTheme.primaryGradient }}
              className="w-full py-2.5 rounded-2xl text-white text-xs font-bold cursor-pointer"
            >
              保存资料
            </button>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 4：转发帖子给角色 ==================== */}
      {forwardingPost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 text-slate-700">
            <h3 className="text-sm font-extrabold">转发帖子给微信角色</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              转发后，角色将看到该帖的<strong>发帖人、正文内容及全部评论区</strong>，并能认出里面的<strong>你（User）和其他角色/NPC 的真实名字</strong>（不会立即自动回复，由你在微信点击生成时再回复）。
            </p>
            <select
              value={forwardTargetCharId}
              onChange={(e) => setForwardTargetCharId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold outline-none"
            >
              {contacts.length === 0 ? (
                <option value="">暂无通讯录角色</option>
              ) : (
                contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    转发给：{c.name}
                  </option>
                ))
              )}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setForwardingPost(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmForwardToChar}
                style={{ background: currentTheme.primaryGradient }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                确认转发
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 5：长按删除帖子确认框 ==================== */}
      {deletingPost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 text-center text-slate-700">
            <p className="text-sm font-extrabold">删除这条帖子？</p>
            <p className="text-xs text-slate-400 line-clamp-2">{deletingPost.content}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingPost(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-500 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setPosts((prev) => prev.filter((p) => p.id !== deletingPost.id));
                  setDeletingPost(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-500 text-xs font-bold text-white cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 弹窗 6：右上角菜单（论坛美化预设 + 壁纸 + 数据导入导出） ==================== */}
      {showTopMenu && (
        <div className="absolute inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-5 shadow-xl space-y-3.5 max-h-[92%] overflow-y-auto text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">论坛 · 美化与数据中心</h3>
              <button
                onClick={() => setShowTopMenu(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setMenuTab('theme')}
                className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  menuTab === 'theme' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>论坛美化与预设</span>
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
              <button
                onClick={() => setMenuTab('worldBooks')}
                className={`py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  menuTab === 'worldBooks' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>世界书</span>
              </button>
              <button
                onClick={() => setMenuTab('breakLimit')}
                className={`py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  menuTab === 'breakLimit' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                <span>破限词</span>
              </button>
            </div>

            {menuTab === 'breakLimit' && (
              <div className="space-y-2.5 text-xs">
                <label className="block space-y-1.5">
                  <span className="font-bold text-slate-700">论坛破限词</span>
                  <textarea
                    aria-label="论坛破限词"
                    value={forumBreakLimitWords}
                    onChange={(event) => setForumBreakLimitWords(event.target.value)}
                    rows={7}
                    maxLength={10000}
                    placeholder="填写只供论坛生成使用的补充词，可留空。内容会置于论坛提示词最前面。"
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-[11px] leading-relaxed outline-none focus:border-indigo-300"
                  />
                </label>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  仅在论坛生成帖子和评论时注入，不会提供给聊天、记忆整理或其他应用。
                </p>
              </div>
            )}

            {menuTab === 'worldBooks' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2 rounded-2xl bg-indigo-50/70 p-3">
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    {selectedForumWorldBookIds === null
                      ? '自动模式：生成时使用全局世界书和本次参与角色已绑定的世界书。'
                      : '自选模式：论坛生成只使用下方勾选的世界书。'}
                  </p>
                  {selectedForumWorldBookIds !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedForumWorldBookIds(null)}
                      className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-indigo-500"
                    >
                      恢复自动
                    </button>
                  )}
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-white/80 p-2">
                  {worldBookOptions.length === 0 && (
                    <p className="p-2 text-[10px] text-slate-400">尚未创建世界书。</p>
                  )}
                  {worldBookOptions.map((book) => {
                    return (
                      <label key={book.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={forumWorldBookIdsForDisplay.includes(book.id)}
                          onChange={(event) => {
                            const next = [...forumWorldBookIdsForDisplay.filter((id) => id !== book.id)];
                            if (event.target.checked) next.push(book.id);
                            setSelectedForumWorldBookIds(next);
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{book.name}</span>
                        {book.isGlobal && <span className="text-[9px] text-sky-500">全局</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

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
                      placeholder="输入新预设名称（如：黑银、夜间模式）"
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

                <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">论坛专属背景壁纸</span>
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
                  <span className="font-bold block">配色与样式参数（可参照原值修改）</span>

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
                      高亮/按钮色 (原值: linear-gradient(90deg, #8EC5FC 0%, #F5B8D1 100%))
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
                  onClick={handleExportForum}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>导出论坛</span>
                </button>
                <label className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-100 text-xs font-bold text-slate-600 cursor-pointer">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>导入论坛</span>
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
                          if (!isRecord(data)) throw new Error('导入数据必须是一个对象。');
                          if (Array.isArray(data.boards) && data.boards.length > 0 && data.boards.every(isForumBoard)) {
                            setBoards(data.boards);
                          }
                          if (Array.isArray(data.posts) && data.posts.every(isForumPost)) setPosts(data.posts);
                          if (isPlayerForumProfiles(data.playerProfiles)) setPlayerProfiles(data.playerProfiles);
                          if (isPlayerForumAccounts(data.playerAccounts)) setPlayerAccounts(data.playerAccounts);
                          if (isActivePlayerAccounts(data.activePlayerAccounts)) setActivePlayerAccounts(data.activePlayerAccounts);
                          if (isForumThemePresetList(data.themePresets)) {
                            const presets = data.themePresets.some((preset) => preset.id === 'default')
                              ? data.themePresets
                              : [DEFAULT_FORUM_PRESET, ...data.themePresets];
                            setThemePresets(presets);
                          }
                          if (typeof data.activePresetId === 'string') setActivePresetId(data.activePresetId);
                          if (isForumThemePreset(data.currentTheme)) setCurrentTheme(data.currentTheme);
                          setShowTopMenu(false);
                        } catch {
                          showYyError('导入格式有误', '导入失败');
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                </label>
                <button
                  onClick={() => {
                    if (window.confirm('确定要清空所有帖子记录吗？')) {
                      setPosts([]);
                      setShowTopMenu(false);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-rose-50 text-xs font-bold text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>清空帖子</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};