import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { DOCK_APPS, INITIAL_USER_PROFILE, MAIN_GRID_APPS } from '../data/mockData';
import { HomeScreen } from '../components/HomeScreen';
import { normalizeWallpaper } from '../apps/ThemeCustomizerApp';
import { clearDbStorage } from './dbStorage';
import { DEFAULT_FONT_SETTINGS, normalizeFontUrl, readFontSettings } from './fontSettings';
import { DEFAULT_CHAT_RUNTIME, getRoundThought, isKeepAlivePlaying, isProactiveDue, permittedSticker, preserveRoundThoughts, proactiveInterval, readChatRuntimeSettings, startKeepAlive, stopKeepAlive } from './chatRuntime';
import { CALENDAR_APPEARANCE_KEY, MUSIC_APPEARANCE_KEY, captureHomeAppearance, isHomeAppearance } from './homeAppearance';
import { addMemoryCandidates, buildMemoryInjection, DEFAULT_MEMORY_SETTINGS, exportMemories, importMemories, readEmbeddings, readMemories, readMemorySettings, writeEmbeddings, writeMemories, writeMemorySettings } from './memoryData';
import { extractMemoryCandidates, requestMemoryAiText } from './memoryAi';
import { withWorldBooksForContacts } from './worldBookPrompt';
import { getChatRelationContexts } from './chatContext';
import { withForumBreakLimit } from './forumPrompt';
import { normalizeCallReplyParts } from './callReply';
import { createJournalEntry, generateGrowthNote, regenerateJournal, runJournal, updateJournalEntryContent } from './journalAi';
import { buildGrowthInjection, buildJournalInjection, deleteJournalEntry, readGrowthNotes, readJournalEntries, readJournalSettings, writeGrowthNotes, writeJournalEntries, writeJournalSettings } from './journalData';
import { activeMemoryArchive, deleteCharacterMemoryArchives, deleteMemoryArchive, guardMemoryArchive, invalidateMemoryArchive, memoryArchiveLabel, prepareMemoryArchiveSwitch } from './memoryArchives';
import { applyMomentsAfterChat, buildMomentsInjection, getInteractionCandidates, MomentActor, MomentPost, MOMENTS_STORAGE_KEY, readMoments } from './momentsData';
import { readSetting, saveSetting, SETTINGS_KEYS } from './settings';
import { emptyAlipayData, grantIntimatePay, readAlipayContacts, readAlipayData, requestIntimatePay, settleIncomingChatPayment, updateAlipayBalance, writeAlipayData, WECHAT_CHATS_STORAGE_KEY } from './alipayData';
import { parseAiJson, parseChatResponse, parseForumPost } from './aiResponse';
import { readStoredValue, readStorageString } from './localStorage';
import { estimateConversationTokens, estimatePromptTokens, estimateTextTokens } from './chatTokens';
import { normalizeForumHandle, readGeneratedForumHandles, resolveForumHandle } from './forumIdentity';
import { BUILTIN_STICKERS, CHAT_STICKERS_STORAGE_KEY, readAvailableChatStickers } from './chatStickers';
import { LITTLE_P_MESSAGES_KEY, LITTLE_P_VISIBLE_KEY, littlePHistory, littlePSystemPrompt, parseLittlePReply, readLittlePMessages, writeLittlePMessages, type LittlePMessage } from './littleP';
import { requestConfiguredAiText } from './aiApi';
import { buildPrompt, type OpenAiMessage } from './buildPrompt';
import { WEATHER_CACHE_KEY, writeWeatherSettings } from './weatherData';
import { getUserRealName } from './userPersona';
import { toGeminiContents, toOpenAiMessages } from './chatVision';
import { requestChatReply, validateChatSpeakerPrefix, withChatResponseFormat } from './chatReply';
import { buildGroupPrivateContext, describeChatSource } from './chatHistory';
import {
  buildGroupJournalInjection, deleteGroupJournal, deleteGroupJournalEntry, editGroupJournalEntry,
  GROUP_JOURNAL_KEY, invalidateGroupJournal, maybeAutoGroupJournal, readGroupJournal,
  runGroupJournal, setGroupJournalSettings, regenerateGroupJournal,
} from './groupJournal';
import { GroupJournalPanel } from '../components/GroupJournalPanel';
import { buildOfflineSummarySegments, generateOfflineText } from './offlineAi';
import { createDefaultPresets } from './offlineData';
import { compressChatPhoto, compressImageFile } from './imageFile';
import { createEmptyCoupleSpace, localDateString, readCharacterBrief, readCoupleSpaces, writeCoupleSpaces } from './coupleSpaceData';
import { readDirectMessages } from './journalData';
import { generatePhoneScope } from './phoneAi';
import { applyPhoneGeneratedPatch, collectPastDiaries } from './phoneDiaryArchive';
import { readRecentMoneyEvents } from './phoneData';
import { buildCharacterExport, parsePortableWorldBooks, remapImportedWorldBooks } from './characterExport';
import { applySocialWrites, buildSocialInstructions, parseSocialActions, type SocialContext } from './chatSocial';
import { coupleRecordDate, editCoupleRecord, isRecordDate } from './coupleRecords';
import { DEFAULT_LOCK_APPEARANCE, isLockScreenAppearance } from './lockAppearance';
import { LockScreen } from '../components/LockScreen';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { answerPaper, buildPaperMemoryInjection, discardPaper, openDailyPaper, paperCandidates, PAPER_NOTES_KEY, parsePaperNotesState, readPaperNotes, retainPaperNotes, setPaperFavorite, loadPaperNotes, type PaperContent, type PaperNote } from './paperNotes';
import { generateDailyPaper, generatePaperReply } from './paperNotesAi';
import { generateCoupleBatch } from './coupleSpaceAi';
import { generateFocusRank } from './pomodoroAi';
import { buildCalendarContext, emptyCalendarData, toDateKey, writeCalendarData } from './calendarData';
import { replaceJournalRange, selectJournalRange } from './journalRange';
import { processBlockedContactSchedules } from './blockedContact';
import { addInventoryItem, INVENTORY_KEY, readInventory } from './inventoryData';
import { splitJournalMessages } from './journalPolicy';
import { incomingCallsAllowed } from './chatRuntime';
import { compressJournal } from './journalAi';

const stored = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => { stored.set(key, value); },
  removeItem: (key: string) => { stored.delete(key); },
  clear: () => stored.clear(),
  key: (index: number) => [...stored.keys()][index] ?? null,
  get length() { return stored.size; },
};
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, setTimeout, clearTimeout } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });

beforeEach(async () => { await clearDbStorage(); });
afterEach(() => { mock.restoreAll(); });

test('regeneration excludes the whole replaced image batch and its hidden thought before assembling any chat context', () => {
  saveSetting('pocketos:wechat-contacts', [{ id: 'regen-char', name: '林渡', persona: '', worldBooks: [] }]);
  const base = { type: 'direct', participantIds: ['regen-char'], noteName: '', context: '', avatars: {}, includeLatestThought: true };
  const messages = [
    { id: 'keep', senderId: 'regen-char', text: 'KEEP_OLDER_TURN', thought: 'KEEP_OLDER_THOUGHT', replyBatchId: 'older', createdAt: '2026-10-27T10:00:00Z' },
    { id: 'user-photo', senderId: 'user', text: '重新拍吧', kind: 'image', imageUrl: 'data:image/jpeg;base64,AQID', createdAt: '2026-10-27T10:01:00Z' },
    { id: 'discard-photo', senderId: 'regen-char', text: 'DISCARDED_IMAGE_SCENE', kind: 'image', imageUrl: 'https://example.test/discard.png', thought: 'DISCARDED_IMAGE_THOUGHT', replyBatchId: 'last-batch', createdAt: '2026-10-27T10:02:00Z' },
    { id: 'discard-narration', senderId: 'narrator', text: 'DISCARDED_NARRATION', replyBatchId: 'last-batch', createdAt: '2026-10-27T10:02:01Z' },
    { id: 'discard-text', senderId: 'regen-char', text: 'DISCARDED_LAST_MESSAGE', thought: 'DISCARDED_LAST_THOUGHT', replyBatchId: 'last-batch', createdAt: '2026-10-27T10:02:02Z' },
  ];
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [
    { ...base, id: 'regen-chat', attachHistory: true, attachedHistoryChatIds: ['mounted-chat'], messages },
    { ...base, id: 'mounted-chat', messages: [{ id: 'mounted', senderId: 'regen-char', text: 'KEEP_MOUNTED_TURN', replyBatchId: 'last-batch', createdAt: '2026-10-27T09:00:00Z' }] },
  ]);
  const before = readStorageString(WECHAT_CHATS_STORAGE_KEY);
  assert.match(JSON.stringify(buildPrompt({ chatId: 'regen-chat' })), /DISCARDED_IMAGE_SCENE/);
  const prompt = buildPrompt({ chatId: 'regen-chat', regenerate: true });
  const body = JSON.stringify(prompt); assert.doesNotMatch(body, /DISCARDED_/);
  assert.match(body, /KEEP_OLDER_TURN/); assert.match(body, /KEEP_OLDER_THOUGHT/); assert.match(body, /KEEP_MOUNTED_TURN/);
  assert.deepEqual(prompt.at(-1)?.images, ['data:image/jpeg;base64,AQID']);
  assert.equal(readStorageString(WECHAT_CHATS_STORAGE_KEY), before, 'failed generations can still restore the untouched original turn');
});

test('offline prose omits separate thoughts and strips reasoning tags while preserving narrative and choices', async () => {
  testApi(); let body = '';
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    body = String(init?.body);
    return Response.json({ choices: [{ message: { content: '<think>不展示的思考</think><thought>不展示的心声</thought>他把伞往你这边偏了一点。\n\n“走吧。”\n【行动建议】\n1. 跟上他的脚步\n2. 问他冷不冷\n3. 把伞接过来' } }] });
  });
  const story = { id: 'offline-no-thought', title: '雨', characterIds: [], personaId: '', worldBookIds: [], presetId: '', wechatContextCount: 0, autoChoices: true, contextMessages: 20, ended: false, messages: [], createdAt: '', updatedAt: '' };
  const result = await generateOfflineText(story, createDefaultPresets()[0], [], 'opening', '', true);
  assert.match(body, /线下不生成角色心声或独立内心独白/);
  assert.match(result.text, /把伞往你这边偏/); assert.doesNotMatch(result.text, /不展示|<think|<thought/);
  assert.deepEqual(result.choices, ['跟上他的脚步', '问他冷不冷', '把伞接过来']);
});

test('saved player photo adds subject instructions only for enabled image generation and never enters text chat payloads', () => {
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  const profiles = [{ id: 'photo-persona', name: '照片预设', nickname: '小月', realName: '林月', identity: '', personality: '', background: '', speakingStyle: '', faceReferenceImage: photo, faceReferenceEnabled: true }];
  saveSetting(SETTINGS_KEYS.personas, { activeProfileId: profiles[0].id, profiles });
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ id: 'photo-chat', type: 'direct', participantIds: ['photo-char'], noteName: '', context: '', messages: [{ id: 'photo-message', senderId: 'user', text: '一起拍张照吧', createdAt: '2026-10-26T10:00:00Z' }] }]);
  saveSetting('pocketos:wechat-contacts', [{ id: 'photo-char', name: '朋友', persona: '', worldBooks: [] }]);
  const options = { chatId: 'photo-chat', timeAwarenessEnabled: false };
  const imagePrompt = JSON.stringify(buildPrompt({ ...options, imageGenerationEnabled: true }));
  assert.match(imagePrompt, /imageSubject/);
  assert.match(imagePrompt, /玩家已保存自己的生图脸部参考照片/);
  assert(!imagePrompt.includes(photo));
  assert(!imagePrompt.includes('iVBORw0KGgo='));
  assert(!JSON.stringify(buildPrompt(options)).includes('imageSubject'));
  saveSetting(SETTINGS_KEYS.personas, { activeProfileId: profiles[0].id, profiles: [{ ...profiles[0], faceReferenceEnabled: false }] });
  assert(!JSON.stringify(buildPrompt({ ...options, imageGenerationEnabled: true })).includes('imageSubject'));
  saveSetting(SETTINGS_KEYS.personas, { activeProfileId: 'no-photo', profiles: [...profiles, { ...profiles[0], id: 'no-photo', faceReferenceImage: '' }] });
  assert(!JSON.stringify(buildPrompt({ ...options, imageGenerationEnabled: true })).includes('imageSubject'));
});

test('WeChat persona keeps nickname, real name and preset label separate in chat prompts', () => {
  const storageKeys = [SETTINGS_KEYS.personas, WECHAT_CHATS_STORAGE_KEY, 'pocketos:wechat-contacts'];
  const previous = storageKeys.map((key) => localStorage.getItem(key));
  saveSetting(SETTINGS_KEYS.personas, {
    activeProfileId: 'nickname-test',
    profiles: [{
      id: 'nickname-test', name: '夜行预设', nickname: '小夜', realName: '林月',
      identity: '', personality: '', background: '', speakingStyle: '',
    }],
  });
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'nickname-chat', type: 'direct', participantIds: ['nickname-character'],
    noteName: '', context: '',
    messages: [{ id: 'nickname-message', senderId: 'user', text: '你好', createdAt: '2026-10-18T10:00:00Z' }],
  }]);
  saveSetting('pocketos:wechat-contacts', [{ id: 'nickname-character', name: '朋友', persona: '', worldBooks: [] }]);

  const prompt = buildPrompt({ chatId: 'nickname-chat' }).map((item) => item.content).join('\n');
  assert.match(prompt, /微信网名：小夜/);
  assert.match(prompt, /真名：林月/);
  assert.doesNotMatch(prompt, /夜行预设/);
  assert.match(prompt, /聊天成员：小夜/);
  assert.equal(prompt.endsWith('你好'), true);
  assert.equal(getUserRealName({ id: 'old', name: '旧姓名', identity: '', personality: '', background: '', speakingStyle: '' }), '旧姓名');
  storageKeys.forEach((key, index) => {
    if (previous[index] === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous[index]);
  });
});

test('within-window blocked contact schedules wait until keepalive is enabled', async () => {
  const dueAt = '2020-01-01T00:00:00.000Z';
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'blocked-chat', type: 'direct', participantIds: ['blocked-char'], blocked: true,
    blockedSince: '2019-12-31T00:00:00.000Z', blockedNextAt: dueAt,
    blockedTiming: 'within', messages: [], updatedAt: dueAt,
  }]);
  saveSetting(SETTINGS_KEYS.chatRuntime, { ...DEFAULT_CHAT_RUNTIME, keepAlive: false });

  await processBlockedContactSchedules();

  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY) ?? '[]') as Array<{ blockedNextAt: string }>;
  assert.equal(chats[0].blockedNextAt, dueAt);
});

const archiveFixture = (archiveId = 'old') => {
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'archive-chat', type: 'direct', participantIds: ['archive-char'], activeArchiveId: archiveId,
    archives: [{ id: 'old', name: '旧身份' }, { id: 'new', name: '新身份' }],
    messages: Array.from({ length: 25 }, (_, i) => ({
      id: `m-${i}`, senderId: i % 2 ? 'archive-char' : 'user', text: `身份信息${i}`,
      createdAt: `2026-10-17T10:00:${String(i).padStart(2, '0')}.000Z`,
    })),
  }]);
};

const archiveMemory = (id: string, charId = 'archive-char') => ({
  id, charId, content: `记忆${id}`, category: 'core' as const, importance: 5, pinned: true,
  createdAt: '2026-01-01', updatedAt: '2026-01-01', recallCount: 0, source: 'manual' as const,
});

const socialFixture = (now = new Date(2026, 9, 19, 1, 20)): SocialContext => ({
  chat: {
    id: 'social-chat', type: 'direct', participantIds: ['social-char'],
    messages: [{ id: 'awake', senderId: 'user', text: '我们还没睡呢 今天还没有结束 现在准备睡觉啦',
      createdAt: new Date(now.getTime() - 60_000).toISOString() }],
  },
  actors: [{ id: 'social-char', name: '角色', avatarUrl: 'avatar.png' }],
  regenerate: false, now,
});

const paperFixture = () => {
  const contact = (id: string) => ({ id, name: id === 'paper-a' ? '纸条角色甲' : '纸条角色乙', persona: '不善表达但关心玩家', worldBooks: [] });
  const chat = (id: string) => ({
    id: `chat-${id}`, type: 'direct', participantIds: [id], activeArchiveId: 'paper-archive',
    noteName: '', context: '', blocked: false,
    messages: [{ id: 'hello', senderId: 'user', text: '今天一起去看了海，回来有点累', createdAt: '2026-10-18T12:00:00Z' }],
  });
  saveSetting('pocketos:wechat-contacts', ['paper-a', 'paper-b', 'blocked', 'empty', 'group', 'observer', 'npc:test'].map(contact));
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [
    chat('paper-a'), chat('paper-b'), { ...chat('blocked'), blocked: true },
    { ...chat('empty'), messages: [] }, { ...chat('group'), type: 'group' },
    { ...chat('observer'), type: 'observer' }, chat('npc:test'), chat('deleted-contact'),
  ]);
};
const paperDate = () => new Date(2026, 9, 18, 20);
const questionPaper = async (): Promise<PaperContent> => ({ kind: 'question', content: '今天看海时，你最喜欢哪个瞬间？' });

const testApi = () => saveSetting(SETTINGS_KEYS.apiPresets, [{
  id: 'features', name: '测试', endpoint: 'https://features.invalid/v1', apiKey: 'test',
}]);
const aiResponse = (content: unknown) => new Response(JSON.stringify({
  choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
}));

test('paper retention keeps exactly 100 newest nonfavorites plus unlimited favorites and persists migration', async () => {
  const papers: PaperNote[] = Array.from({ length: 108 }, (_, index) => ({
    id: `paper-${index}`, charId: 'a', chatId: 'a', archiveKey: 'a', kind: 'thought',
    date: localDateString(new Date(2026, 0, index + 1)), content: `纸条${index}`,
    ...(index < 3 ? { favorite: true } : {}),
  }));
  const retained = retainPaperNotes([...papers].reverse());
  assert.equal(retained.length, 103);
  assert.equal(retained.filter((paper) => !paper.favorite).length, 100);
  assert.ok(papers.slice(0, 3).every((paper) => retained.some((item) => item.id === paper.id)));
  assert.ok(!retained.some((paper) => paper.id === 'paper-3'));
  assert.ok(retained.some((paper) => paper.id === 'paper-8'));
  saveSetting(PAPER_NOTES_KEY, { version: 1, days: {}, notes: papers, memories: papers });
  await loadPaperNotes();
  const saved = JSON.parse(readStorageString(PAPER_NOTES_KEY)!);
  assert.equal(saved.notes.length, 103);
  assert.equal(saved.memories.length, 108);
  await setPaperFavorite('paper-0', false);
  assert.equal(readPaperNotes().notes.length, 102);
  assert.ok(!readPaperNotes().notes.some((paper) => paper.id === 'paper-0'));
  await setPaperFavorite('paper-107', true);
  assert.equal(readPaperNotes().notes.find((paper) => paper.id === 'paper-107')?.favorite, true);
  await assert.rejects(setPaperFavorite('missing', true), /不存在/);
  assert.throws(() => parsePaperNotesState({ version: 1, days: {}, notes: [{ ...papers[0], favorite: 'yes' }], memories: [] }), /格式无效/);
});

test('receiving the next paper evicts the oldest nonfavorite but preserves favorites and receipt history', async () => {
  paperFixture();
  const today = paperDate();
  const papers: PaperNote[] = Array.from({ length: 101 }, (_, index) => ({
    id: `old-${index}`, charId: 'paper-a', chatId: 'chat-paper-a', archiveKey: activeMemoryArchive('paper-a'),
    kind: 'thought', content: '旧纸条', date: localDateString(new Date(2026, 0, index + 1)),
    favorite: index === 0,
  }));
  saveSetting(PAPER_NOTES_KEY, { version: 1, days: {}, notes: papers, memories: papers });
  const received = await openDailyPaper(questionPaper, { now: () => today });
  assert.ok(received);
  const state = readPaperNotes();
  assert.equal(state.notes.length, 101);
  assert.ok(state.notes.some((paper) => paper.id === 'old-0'));
  assert.ok(!state.notes.some((paper) => paper.id === 'old-1'));
  await setPaperFavorite(received.id, true);
  assert.equal((await openDailyPaper(questionPaper, { now: () => today }))?.favorite, true);
});

test('phone generates all eight scopes with one request and includes world, player and chat settings', async () => {
  paperFixture(); testApi();
  const contacts = JSON.parse(readStorageString('pocketos:wechat-contacts')!);
  contacts[0].worldBooks = [{ bookId: 'phone-world' }];
  saveSetting('pocketos:wechat-contacts', contacts);
  saveSetting('yyphone:world-books', [
    { id: 'phone-world', name: '关联书', entries: [{ id: 'e', title: '规则', content: '角色住在浮空城', depth: 'back' }] },
    { id: 'global-world', name: '全局书', isGlobal: true, entries: [{ id: 'g', title: '全局', content: '城市没有地铁', depth: 'front' }] },
    { id: 'other-world', name: '其他角色私有', entries: [{ id: 'o', title: '秘密', content: '不应出现的世界书秘密', depth: 'front' }] },
  ]);
  saveSetting(SETTINGS_KEYS.personas, { activeProfileId: 'u', profiles: [{
    id: 'u', name: '小雨', identity: '钟表修理师', personality: '安静', background: '玩家背景标记', speakingStyle: '简短',
  }] });
  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
  chats[0].context = '补充设定：两人正在旅行';
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  const generated = {
    wechat: { userRemark: '小雨', threads: [{ name: '朋友', messages: [{ from: 'char', text: '旅行中', time: '10:00' }] }] },
    album: { photos: [{ sceneDesc: '车窗', isPrivate: false }] },
    browser: { items: [{ query: '旅行攻略' }] }, notes: { notes: [{ content: '记得带伞' }] },
    icity: { diaries: [{ content: '今天和小雨去看海' }] },
    shopping: { items: [1, 2, 3].map(i => ({ name: `旅行用品${i}`, category: '旅行', price: 20 + i, variant: '便携款', note: '下次出门可以用' })) },
    agent: { doubaoTurns: [{ role: 'char', content: '明天天气？' }], claudeTurns: [{ role: 'ai', content: '说说你的心事' }] },
    wallet: { balance: 800, records: [{ title: '车票', amount: -20 }] },
    health: { sleepHours: 7, sleepNote: '睡得很好', steps: 1000, screenTimeMinutes: 30 },
    douban: { items: [
      { type: '书籍', title: '海边的钟表', creator: '作者甲', rating: 4.5, review: '读到钟表匠时想起了今天的海风。', date: '2026年10月21日' },
      { type: '纪录片', title: '潮汐之间', creator: '导演乙', rating: 4, review: '潮声拍得很安静。', date: '2026年10月20日' },
      { type: '游戏', title: '远岸信号', creator: '工作室丙', rating: 3.5, review: '解谜不错，结尾稍急。', date: '2026年10月19日' },
    ] },
  };
  let calls = 0; let body = '';
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    calls += 1; body = String(init?.body);
    return aiResponse(generated);
  });
  const prev = { charId: 'paper-a', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [],
    browserHistory: [], notes: [], icityDiaries: [],
    agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] } };
  const result = await generatePhoneScope('all', { charId: 'paper-a', charName: '纸条角色甲', userName: '小雨', npcs: [] }, prev);
  assert.equal(calls, 1);
  for (const text of ['角色住在浮空城', '城市没有地铁', '钟表修理师', '玩家背景标记', '两人正在旅行', '今天一起去看了海']) assert.ok(body.includes(text), text);
  assert.doesNotMatch(body, /不应出现的世界书秘密/);
  for (const key of ['npcThreads', 'photos', 'browserHistory', 'notes', 'icityDiaries', 'agentSession', 'wallet', 'health', 'ratings', 'shoppingCart']) assert.ok(key in result, key);
  assert.equal(result.ratings?.length, 3);
  assert.match(body, /至少 3 条/);
  assert.match(body, /评分必须与短评的态度和结论严格一致/);
  assert.match(body, /失望作品或烂片/);
  const snapshot = JSON.stringify(prev);
  Reflect.deleteProperty(generated, 'notes');
  await assert.rejects(generatePhoneScope('all', { charId: 'paper-a', charName: '甲', userName: '玩家', npcs: [] }, prev), /遗漏/);
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(prev), snapshot);
});

test('phone shopping uses character memories and accepts only three to five distinct pending products without financial writes', async () => {
  paperFixture(); testApi();
  writeMemories([{ id: 'cart-memory', charId: 'paper-a', content: 'SHOPPING_MEMORY：旅行时相机包坏了', category: 'core', pinned: true, importance: 5, createdAt: '', updatedAt: '', recallCount: 0, source: 'manual' }]);
  const prev = { charId: 'paper-a', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [], browserHistory: [], notes: [], icityDiaries: [], agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] } };
  let body = '', calls = 0;
  let items = Array.from({ length: 3 }, (_, i) => ({ name: `相机配件${i}`, price: 39.9 + i, category: '摄影', variant: '黑色', note: '下次看海带上' }));
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => { body = String(init?.body); calls++; return aiResponse({ items }); });
  readAlipayData();
  const chatsBefore = readStorageString(WECHAT_CHATS_STORAGE_KEY), moneyBefore = readStorageString('yyphone:alipay-data');
  const ctx = { charId: 'paper-a', charName: '纸条角色甲', userName: '玩家', npcs: [] };
  const result = await generatePhoneScope('shopping', ctx, prev);
  assert.equal(calls, 1); assert.equal(result.shoppingCart?.length, 3); assert.match(body, /SHOPPING_MEMORY/); assert.match(body, /今天一起去看了海/); assert.match(body, /不能把加购写成已购买/);
  items = Array.from({ length: 5 }, (_, i) => ({ ...items[0], name: `用品${i}` }));
  assert.equal((await generatePhoneScope('shopping', ctx, prev)).shoppingCart?.length, 5);
  items = items.slice(0, 2); await assert.rejects(generatePhoneScope('shopping', ctx, prev), /3～5/);
  items = Array.from({ length: 3 }, () => ({ ...items[0] })); await assert.rejects(generatePhoneScope('shopping', ctx, prev), /重复/);
  assert.equal(readStorageString(WECHAT_CHATS_STORAGE_KEY), chatsBefore); assert.equal(readStorageString('yyphone:alipay-data'), moneyBefore);
});

test('icity generates one complete diary with private memory and rejects multiple entries or truncated oversized content', async () => {
  paperFixture(); testApi();
  writeMemories([{ id: 'diary-memory', charId: 'paper-a', content: 'DIARY_PRIVATE_MEMORY：把那张船票收进书里', category: 'core', pinned: true, importance: 5, createdAt: '', updatedAt: '', recallCount: 0, source: 'manual' }]);
  const prev = { charId: 'paper-a', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [], browserHistory: [], notes: [], icityDiaries: [], agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] } };
  let body = ''; let diaries = [{ content: '一段完整的自述。'.repeat(200) + '故事自然结束。', dateStr: '10月26日', timeStr: '20:00', weather: '未记录', mood: '平静' }];
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => { body = String(init?.body); return aiResponse({ diaries }); });
  const ctx = { charId: 'paper-a', charName: '纸条角色甲', userName: '玩家', npcs: [] };
  const result = await generatePhoneScope('icity', ctx, prev);
  assert.equal(result.icityDiaries?.length, 1); assert.equal(result.icityDiaries?.[0].content, diaries[0].content);
  for (const text of ['DIARY_PRIVATE_MEMORY', '今天一起去看了海', '不善表达但关心玩家', '本次只生成一篇', '重点剖析内心世界', '不把约定写成已发生']) assert.ok(body.includes(text), text);
  diaries = [diaries[0], diaries[0]]; await assert.rejects(generatePhoneScope('icity', ctx, prev), /一篇完整日记/);
  diaries = [{ ...diaries[0], content: '长'.repeat(4001) }]; await assert.rejects(generatePhoneScope('icity', ctx, prev), /一篇完整日记/);
  assert.equal(prev.icityDiaries.length, 0);
});

test('external link cards retain URL and caption in AI input and distinguish metadata from full text', () => {
  paperFixture();
  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
  chats[0].messages.push({ id: 'external-share', senderId: 'user', kind: 'link', text: '这篇一起看 https://www.zhihu.com/question/123', externalUrl: 'https://www.zhihu.com/question/123', title: '网页真实标题', content: '网页真实简介', source: '知乎', createdAt: '2026-10-26T12:00:00Z' });
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  const latest = buildPrompt({ chatId: chats[0].id }).at(-1)?.content ?? '';
  for (const value of ['https://www.zhihu.com/question/123', '这篇一起看', '网页真实标题', '网页真实简介', '未读取全文']) assert.ok(latest.includes(value), value);
});

test('phone diaries archive before replacement, deduplicate manual saves and preserve past diaries on unrelated updates', () => {
  const old = { id: 'old', dateStr: '10月26日', timeStr: '20:00', weather: '晴', mood: '平静', content: '旧日记完整正文' };
  const next = { ...old, id: 'new', content: '新日记完整正文' };
  const current = { charId: 'paper-a', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [], browserHistory: [], notes: [], icityDiaries: [old], agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] } };
  const updated = applyPhoneGeneratedPatch(current, { icityDiaries: [next] });
  assert.deepEqual(updated.diaryArchive, [old]); assert.deepEqual(updated.icityDiaries, [next]); assert.deepEqual(current.icityDiaries, [old]);
  const saved = collectPastDiaries(updated.diaryArchive, [next, { ...next, id: 'different-id-same-diary' }]);
  assert.equal(saved.length, 2);
  const manual = { ...updated, diaryArchive: saved };
  assert.equal(applyPhoneGeneratedPatch(manual, { icityDiaries: [old] }).diaryArchive?.length, 2);
  assert.deepEqual(applyPhoneGeneratedPatch(manual, { notes: [] }).diaryArchive, saved);
  assert.deepEqual(collectPastDiaries(saved.filter(d => d.id !== old.id), []), [next]);
  assert.deepEqual(applyPhoneGeneratedPatch({ ...current, diaryArchive: [], deletedDiaryIds: [old.id] }, { icityDiaries: [next] }).diaryArchive, [], 'deleted entries must not reappear during automatic archiving');
});

test('check phone caps the merged current and mounted history at the newest 150 regardless of configured counts', async () => {
  paperFixture(); testApi();
  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
  const local = Array.from({ length: 400 }, (_, i) => ({ id: `window-local-${i}`, senderId: i % 2 ? 'paper-a' : 'user', text: `LOCAL_WINDOW_${i}_END`, createdAt: new Date(Date.UTC(2026, 9, 20, 0, i)).toISOString() }));
  const mounted = Array.from({ length: 400 }, (_, i) => ({ id: `window-mount-${i}`, senderId: 'paper-b', text: `MOUNT_WINDOW_${i}_END`, createdAt: new Date(Date.UTC(2026, 9, 20, 0, i, 1)).toISOString() }));
  chats[0] = { ...chats[0], currentChatHistoryCount: 400, attachHistory: true, attachedHistoryChatIds: [chats[1].id], attachedHistoryCounts: { [chats[1].id]: 400 }, messages: local };
  chats[1] = { ...chats[1], messages: mounted }; saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  const before = readStorageString(WECHAT_CHATS_STORAGE_KEY); let body = '';
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => { body = String(init?.body); return aiResponse({ notes: [{ content: '最近的事情' }] }); });
  await generatePhoneScope('notes', { charId: 'paper-a', charName: '甲', userName: '玩家', npcs: [] }, { charId: 'paper-a', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [], browserHistory: [], notes: [], icityDiaries: [], agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] } });
  assert.equal((body.match(/(?:LOCAL|MOUNT)_WINDOW_\d+_END/g) ?? []).length, 150);
  assert.match(body, /LOCAL_WINDOW_325_END/); assert.match(body, /MOUNT_WINDOW_399_END/); assert.doesNotMatch(body, /LOCAL_WINDOW_324_END|MOUNT_WINDOW_324_END/);
  assert.equal(readStorageString(WECHAT_CHATS_STORAGE_KEY), before);
});

test('couple one-request generation fills every section and validates missing responses without partial writes', async () => {
  paperFixture(); testApi();
  const today = localDateString();
  const space = { ...createEmptyCoupleSpace('paper-a'), bindStatus: 'bound' as const,
    moods: { [today]: { dateStr: today, userMoodId: 'calm_1', userNote: '玩家心情' } },
    diaries: [{ id: 'user-diary', author: 'user' as const, authorName: '玩家', dateStr: today, title: '海', content: '今天看海' }],
    qaList: [{ id: 'old-q', dateStr: '2020-01-01', askedBy: 'user' as const, question: '最喜欢的事？', userAnswer: '看海' }],
  };
  writeCoupleSpaces({ 'paper-a': space });
  const response = {
    moods: [{ date: today, moodId: 'calm_1', note: '心情安静' }],
    diary: { title: '看海以后', content: '海风很舒服' }, replies: [{ id: 'user-diary', reply: '我也记得' }],
    answers: [{ id: 'old-q', answer: '和你一起看海' }], qa: { question: '下次去哪？', answer: '我想去山里' }, note: '记得休息',
  };
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls += 1; return aiResponse(response); });
  const next = await generateCoupleBatch('paper-a', '玩家', space, [{ id: 'calm_1', label: '平静', kaomoji: '-' }]);
  assert.equal(calls, 1);
  assert.equal(next.moods[today].charMoodId, 'calm_1');
  assert.equal(next.moods[today].userNote, '玩家心情');
  assert.equal(next.diaries[0].author, 'char');
  assert.equal(next.diaries.find((entry) => entry.id === 'user-diary')?.replyComment, '我也记得');
  assert.equal(next.qaList.find((entry) => entry.id === 'old-q')?.charAnswer, '和你一起看海');
  assert.equal(next.qaList[0].askedBy, 'char');
  assert.equal(next.stickyNotes[0].content, '记得休息');
  assert.deepEqual(readCoupleSpaces()['paper-a'], space);
  response.replies = [];
  await assert.rejects(generateCoupleBatch('paper-a', '玩家', space, [{ id: 'calm_1', label: '平静', kaomoji: '-' }]), /全部待写/);
  assert.equal(calls, 2);
  assert.deepEqual(readCoupleSpaces()['paper-a'], space);
});

test('character focus ranking uses AI independent minutes with persona and calendar, rejects invalid totals', async () => {
  paperFixture(); testApi();
  const now = new Date(2026, 9, 21, 12, 0);
  writeCalendarData({ ...emptyCalendarData(), schedules: [
    { id: 's', charId: 'paper-a', date: toDateKey(now), text: '09:00 专注整理研究材料' },
  ] });
  let body = ''; let minutes = 180; let calls = 0;
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    calls += 1; body = String(init?.body);
    return aiResponse({ characters: [{ id: 'paper-a', todayMinutes: minutes, statusText: '整理研究材料' }] });
  });
  const result = await generateFocusRank([{ id: 'paper-a', name: '甲' }], now);
  assert.equal(result[0].todayMinutes, 180);
  assert.equal(result[0].dateStr, toDateKey(now));
  assert.equal(calls, 1);
  assert.match(body, /不善表达但关心玩家/);
  assert.match(body, /09:00 专注整理研究材料/);
  assert.match(body, /不是陪玩家/);
  minutes = 721;
  await assert.rejects(generateFocusRank([{ id: 'paper-a', name: '甲' }], now), /专注时间/);
  const source = readFileSync(resolve('src', 'apps', 'PomodoroApp.tsx'), 'utf8');
  const ranking = source.slice(source.indexOf('const combinedRankings'), source.indexOf('// ==================== 12.'));
  assert.doesNotMatch(ranking, /companionCharName|陪读/);
  assert.match(ranking, /item.dateStr === todayDateStr/);
});

test('weather prompt injection requires this direct conversation to opt in and never shares coordinates', () => {
  paperFixture();
  writeWeatherSettings({ enabled: true, location: { name: '天气测试城市', region: '地区', latitude: 30.27, longitude: 120.15, source: 'city' } });
  saveSetting(WEATHER_CACHE_KEY, { key: '30.27,120.15', fetchedAt: Date.now(), timezone: 'Asia/Shanghai', current: { temperature: 23, feels: 24, humidity: 65, wind: 7, code: 2, time: '2026-10-26T12:00' }, days: [] });
  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
  const prompt = () => JSON.stringify(buildPrompt({ chatId: chats[0].id, currentInput: '天气怎么样' }));
  assert.doesNotMatch(prompt(), /天气测试城市/);
  chats[0].weatherAwarenessEnabled = true; saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  assert.match(prompt(), /天气测试城市/); assert.doesNotMatch(prompt(), /30\.27|120\.15/);
  chats[0].type = 'group'; saveSetting(WECHAT_CHATS_STORAGE_KEY, chats); assert.doesNotMatch(prompt(), /天气测试城市/);
});

test('calendar changes affect the next injected character schedule without modifying conversation history', () => {
  paperFixture();
  const now = new Date(2026, 9, 21, 12);
  const before = readStorageString(WECHAT_CHATS_STORAGE_KEY);
  const schedule = { id: 's', charId: 'paper-a', date: toDateKey(now), text: '14:00 旧行程' };
  const data = { ...emptyCalendarData(), schedules: [schedule] };
  writeCalendarData(data);
  const context = () => buildCalendarContext(['paper-a'], () => '甲', false, now) ?? '';
  assert.match(context(), /旧行程/);
  writeCalendarData({ ...data, schedules: [{ ...schedule, text: '15:00 修改后行程' }] });
  assert.match(context(), /修改后行程/);
  assert.doesNotMatch(context(), /旧行程/);
  writeCalendarData({ ...data, schedules: [] });
  assert.equal(context(), '');
  assert.equal(readStorageString(WECHAT_CHATS_STORAGE_KEY), before);
});

test('journal range selection is inclusive and replacement invalidates ancestors while restoring unaffected children', () => {
  assert.deepEqual(selectJournalRange(['a', 'b', 'c'], { start: 2, end: 3 }), ['b', 'c']);
  assert.deepEqual(selectJournalRange(['a']), ['a']);
  for (const range of [{ start: 0, end: 2 }, { start: 2, end: 1 }, { start: 1, end: 4 }, { start: 1.5, end: 2 }]) {
    assert.throws(() => selectJournalRange(['a', 'b', 'c'], range), /有效聊天范围/);
  }
  assert.throws(() => selectJournalRange([]), /有效聊天范围/);
  const entries = [
    { id: 'a', from: '01', to: '10', mergedInto: 'parent' },
    { id: 'b', from: '11', to: '20', mergedInto: 'parent' },
    { id: 'parent', from: '01', to: '20', mergedInto: 'grandparent' },
    { id: 'c', from: '21', to: '30', mergedInto: 'grandparent' },
    { id: 'grandparent', from: '01', to: '30' },
    { id: 'outside', from: '31', to: '40' },
  ];
  const next = replaceJournalRange(entries, '11', '20', [{ id: 'new', from: '11', to: '20' }]);
  assert.deepEqual(next.map((entry) => entry.id), ['a', 'c', 'outside', 'new']);
  assert.equal(next[0].mergedInto, undefined);
  assert.equal(next[1].mergedInto, undefined);
});

test('inventory excludes sent purchases, foreign recipients and food in backfill and existing linked records', () => {
  const order = (id: string, senderId: string, orderMode: string, extra = {}) => ({
    id, senderId, kind: 'order', orderCategory: 'shopping', orderMode,
    title: id, text: id, createdAt: '2026-10-25T10:00:00Z', ...extra,
  });
  const messages = [order('self', 'user', 'self'), order('received', 'char', 'gift'),
    order('sent', 'user', 'gift'), order('foreign', 'char', 'gift', { recipientId: 'other' }),
    order('food', 'char', 'gift', { orderCategory: 'eleme' })];
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ id: 'box', type: 'direct', participantIds: ['char'], messages }]);
  assert.deepEqual(readInventory().map(item => item.title).sort(), ['received', 'self']);
  assert.equal(addInventoryItem({ kind: 'purchase', title: '送给角色', desc: '', emoji: '', recipientId: 'char' }), false);
  assert.equal(readInventory().length, 2);
  const legacy = { id: 'inv-msg-sent', kind: 'purchase', title: '旧版送出', desc: '', emoji: '', acquiredAt: '2026-10-25' };
  saveSetting(INVENTORY_KEY, { backfilled: true, items: [legacy, { ...legacy, id: 'unlinked', title: '来源已删除的自购物品' }] });
  assert.deepEqual(readInventory().map(item => item.title), ['来源已删除的自购物品']);
  assert.equal(JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!)[0].messages.length, 5);
});

test('journal splitting follows configured count and retains the full long selected range', () => {
  const messages = Array.from({ length: 305 }, (_, id) => ({ id, text: '一条消息' }));
  const chunks = splitJournalMessages(messages, 30, item => item.text.length);
  assert.equal(chunks.length, 11);
  assert.deepEqual(chunks.flat(), messages);
  const long = splitJournalMessages([{ text: '甲'.repeat(7000) }, { text: '乙'.repeat(7000) }], 100, item => item.text.length);
  assert.equal(long.length, 2);
});

test('personal automatic journals follow journalEvery while regeneration saves one entry', async () => {
  archiveFixture(); testApi();
  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
  chats[0].messages = Array.from({ length: 95 }, (_, index) => ({ id: `cfg-${index}`, senderId: index % 2 ? 'archive-char' : 'user', text: `事件${index}`,
    createdAt: new Date(Date.UTC(2026, 9, 25, 10, 0, index)).toISOString() }));
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  writeJournalSettings({ ...readJournalSettings(), journalEvery: 40 });
  mock.method(globalThis, 'fetch', async () => aiResponse('关键事件提要'));
  const entry = await createJournalEntry('archive-char', { minMessages: 40 });
  assert.equal(entry?.messageCount, 40);
  assert.equal(await regenerateJournal('archive-char'), 1);
  assert.deepEqual(readJournalEntries().map(item => item.messageCount), [95]);
});

test('group regeneration covers messages after 250 and follows its independent batch setting', async () => {
  const chat = groupJournalFixture(305, 'group', 'full-range');
  setGroupJournalSettings(chat.id, { every: 40 });
  mock.method(globalThis, 'fetch', async () => aiResponse('群内关键结论'));
  assert.equal(await regenerateGroupJournal(chat.id), 1);
  const entries = readGroupJournal(chat.id).entries;
  assert.equal(entries.reduce((sum, entry) => sum + entry.messageCount, 0), 305);
  assert.equal(entries.at(-1)?.toMessageId, chat.messages.at(-1)?.id);
});

test('custom journal prompts apply to creation, regeneration, merging and group summaries and can restore defaults', async () => {
  archiveFixture(); testApi();
  const prompt = '用第一人称，按日期列出事件和待办，保留彼此的承诺。';
  writeJournalSettings({ ...readJournalSettings(), journalPrompt: prompt });
  const requests: string[] = [];
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => { requests.push(String(init?.body)); return aiResponse('一篇简短日记'); });
  await createJournalEntry('archive-char');
  await regenerateJournal('archive-char');
  writeJournalEntries(Array.from({ length: 9 }, (_, index) => ({ id: `merge-custom-${index}`, charId: 'archive-char', level: 1 as const,
    from: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(), to: new Date(Date.UTC(2026, 9, 1, 0, index, 30)).toISOString(),
    content: '重要事件', messageCount: 30, source: 'manual' as const, createdAt: '2026-10-25T10:00:00Z' })));
  await compressJournal('archive-char');
  const group = groupJournalFixture(20, 'group', 'custom-prompt-group');
  await regenerateGroupJournal(group.id);
  assert.equal(requests.length, 4);
  for (const request of requests) {
    assert.match(request, new RegExp(prompt));
    assert.match(request, /覆盖前文关于人称/);
    assert.doesNotMatch(request, /按时间顺序用第三人称和记录中的姓名写事件提要/);
  }
  writeJournalSettings({ ...readJournalSettings(), journalPrompt: '' });
  archiveFixture();
  await regenerateJournal('archive-char');
  assert.match(requests.at(-1)!, /按时间顺序用第三人称和记录中的姓名写事件提要/);
});

test('incoming calls obey each private chat, retain legacy preferences and remain blocked in groups or blocked chats', () => {
  const legacyOn = { allowIncomingCalls: true }, legacyOff = { allowIncomingCalls: false };
  assert.equal(incomingCallsAllowed({ type: 'direct', allowIncomingCalls: true }, legacyOff), true);
  assert.equal(incomingCallsAllowed({ type: 'direct', allowIncomingCalls: false }, legacyOn), false);
  assert.equal(incomingCallsAllowed({ type: 'direct' }, legacyOn), true);
  assert.equal(incomingCallsAllowed({ type: 'direct' }, legacyOff), false);
  assert.equal(incomingCallsAllowed({ type: 'group', allowIncomingCalls: true }, legacyOn), false);
  assert.equal(incomingCallsAllowed({ type: 'direct', blocked: true, allowIncomingCalls: true }, legacyOn), false);
});

test('journal length repair is bounded and cannot advance cursor on repeated overlength', async () => {
  archiveFixture(); testApi();
  writeJournalSettings({ ...readJournalSettings(), journalMaxChars: 200 });
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return aiResponse(calls === 1 ? '长'.repeat(201) : '保留关键人物、事件和约定。'); });
  assert.ok(await createJournalEntry('archive-char'));
  assert.equal(calls, 2);
  const previous = readJournalEntries();
  const cursor = readJournalSettings().journalCursors['archive-char'];
  calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return aiResponse('仍然过长'.repeat(100)); });
  await assert.rejects(regenerateJournal('archive-char'), /200 字上限/);
  assert.equal(calls, 2);
  assert.deepEqual(readJournalEntries(), previous);
  assert.equal(readJournalSettings().journalCursors['archive-char'], cursor);
});

test('personal journal can regenerate after deletion and exact ranges ignore prior cursor and remain editable', async () => {
  archiveFixture(); testApi();
  let body = ''; let calls = 0;
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    body = String(init?.body); calls += 1; return aiResponse('重新整理的流水账');
  });
  const old = await createJournalEntry('archive-char');
  assert.ok(old);
  const cursor = readJournalSettings().journalCursors['archive-char'];
  deleteJournalEntry(old.id);
  assert.equal(await createJournalEntry('archive-char'), null);
  assert.equal(await regenerateJournal('archive-char', { start: 3, end: 4 }), 1);
  assert.match(body, /身份信息2/); assert.match(body, /身份信息3/);
  assert.doesNotMatch(body, /身份信息1[^0-9]|身份信息4/);
  assert.equal(readJournalSettings().journalCursors['archive-char'], cursor);
  const entry = readJournalEntries()[0];
  assert.equal(entry.messageCount, 2);
  updateJournalEntryContent(entry.id, '编辑后');
  assert.equal(readJournalEntries()[0].content, '编辑后');
  assert.equal(await regenerateJournal('archive-char'), 1);
  assert.equal(readJournalEntries().length, 1);
  assert.equal(readJournalEntries()[0].messageCount, 25);
  assert.equal(calls, 3);
});

test('personal journal regeneration rejects changed archives and sources without overwriting existing entries', async () => {
  archiveFixture(); testApi();
  mock.method(globalThis, 'fetch', async () => aiResponse('原流水账'));
  await regenerateJournal('archive-char');
  const original = readJournalEntries();
  let changeArchive = false;
  mock.method(globalThis, 'fetch', async () => {
    if (changeArchive) archiveFixture('new');
    else {
      const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
      chats[0].messages[0].text = '已修改';
      saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
    }
    return aiResponse('不应写入');
  });
  await assert.rejects(regenerateJournal('archive-char'), /已变化/);
  assert.deepEqual(readJournalEntries(), original);
  changeArchive = true;
  await assert.rejects(regenerateJournal('archive-char'), /存档/);
  archiveFixture();
  assert.deepEqual(readJournalEntries(), original);
});

test('group and observer journals regenerate chosen messages after deletion without exposing forum bodies', async () => {
  for (const type of ['group', 'observer'] as const) {
    const chat = groupJournalFixture(30, type, `range-${type}`);
    let body = '';
    mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
      body = String(init?.body); return aiResponse('新群流水账');
    });
    await runGroupJournal(chat.id);
    const old = readGroupJournal(chat.id).entries[0];
    deleteGroupJournalEntry(chat.id, old.id);
    assert.equal(readGroupJournal(chat.id).pending, 0);
    assert.equal(await regenerateGroupJournal(chat.id, { start: 3, end: 4 }), 1);
    assert.equal(readGroupJournal(chat.id).entries[0].messageCount, 2);
    assert.match(body, /讨论周末计划2/); assert.match(body, /讨论周末计划3/);
    assert.doesNotMatch(body, /讨论周末计划1[^0-9]|讨论周末计划4/);
    assert.match(body, /旅行计划群/);
    assert.equal(readGroupJournal(chat.id).pending, 0);
    editGroupJournalEntry(chat.id, readGroupJournal(chat.id).entries[0].id, '编辑后的群记忆');
    assert.equal(readGroupJournal(chat.id).entries[0].content, '编辑后的群记忆');
    assert.equal(await regenerateGroupJournal(chat.id), 1);
    assert.equal(readGroupJournal(chat.id).entries.length, 1);
    assert.equal(readGroupJournal(chat.id).entries[0].messageCount, 30);
  }
});

test('multi-chunk journal regeneration saves nothing on a later request failure and guards concurrent tasks', async () => {
  const chat = groupJournalFixture(251, 'group', 'range-atomic');
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    await assert.rejects(regenerateGroupJournal(chat.id), /正在整理/);
    await assert.rejects(runGroupJournal(chat.id), /正在整理/);
    if (calls === 2) throw new Error('模拟后续请求失败');
    return aiResponse('第一段新流水账');
  });
  await assert.rejects(regenerateGroupJournal(chat.id), /模拟后续请求失败/);
  assert.equal(calls, 2);
  assert.equal(readGroupJournal(chat.id).entries.length, 0);
  assert.equal(readGroupJournal(chat.id).cursor, undefined);
});

test('range regeneration preserves distinct message ranges sharing identical timestamps and normal summaries do not duplicate them', async () => {
  const chat = groupJournalFixture(30);
  chat.messages.forEach((message) => { message.createdAt = chat.messages[0].createdAt; });
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat]);
  mock.method(globalThis, 'fetch', async () => aiResponse('群内讨论摘要'));
  await regenerateGroupJournal(chat.id, { start: 1, end: 3 });
  await regenerateGroupJournal(chat.id, { start: 4, end: 6 });
  assert.equal(readGroupJournal(chat.id).entries.length, 2);
  assert.equal(readGroupJournal(chat.id).entries[0].fromMessageId, chat.messages[0].id);
  await runGroupJournal(chat.id);
  assert.equal(readGroupJournal(chat.id).entries.length, 3);

  archiveFixture(); testApi();
  await regenerateJournal('archive-char', { start: 3, end: 4 });
  assert.equal(readJournalEntries().length, 1);
  await runJournal('archive-char');
  assert.equal(readJournalEntries().length, 1);
  assert.equal(readJournalEntries()[0].messageCount, 25);
  assert.throws(() => updateJournalEntryContent(readJournalEntries()[0].id, ' '), /不能为空/);
});

test('configured text requests attach actual image bytes only when supplied', async () => {
  testApi();
  const image = 'data:image/png;base64,AAAA';
  let payload: any;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body));
    return aiResponse('看到了图片');
  });
  await requestConfiguredAiText('system', '看一下', { imageUrls: [image] });
  assert.deepEqual(payload.messages.at(-1).content, [{ type: 'text', text: '看一下' }, { type: 'image_url', image_url: { url: image } }]);
  await requestConfiguredAiText('system', '普通文字');
  assert.equal(payload.messages.at(-1).content, '普通文字');
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '看到了图片' }] } }] }), { status: 200 });
  });
  await requestConfiguredAiText('system', '看一下', { imageUrls: [image], api: { endpoint: 'https://generativelanguage.googleapis.com', apiKey: 'test', model: 'gemini-test' } });
  assert.deepEqual(payload.contents.at(-1).parts[1], { inlineData: { mimeType: 'image/png', data: 'AAAA' } });
});

test('manual and range journals save one entry across internal batches', async () => {
  archiveFixture(); testApi();
  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
  chats[0].messages = Array.from({ length: 501 }, (_, index) => ({
    id: `single-${index}`, senderId: 'user', text: `消息${index}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  const inputs: string[] = [];
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    inputs.push(String(init?.body));
    return aiResponse(`合并后的摘要${inputs.length}`);
  });
  assert.equal((await runJournal('archive-char')).created, 1);
  assert.equal(readJournalEntries().length, 1);
  assert.equal(readJournalEntries()[0].messageCount, 501);
  assert.match(inputs[1], /合并后的摘要1/);
  assert.match(inputs.at(-1)!, /消息500/);
  assert.equal(await regenerateJournal('archive-char'), 1);
  assert.equal(readJournalEntries().length, 1);
  assert.equal(readJournalEntries()[0].messageCount, 501);

  const chat = groupJournalFixture(501, 'group', 'single-group');
  assert.equal((await runGroupJournal(chat.id)).created, 1);
  assert.equal(readGroupJournal(chat.id).entries.length, 1);
  assert.equal(readGroupJournal(chat.id).entries[0].messageCount, 501);
  assert.equal(await regenerateGroupJournal(chat.id), 1);
  assert.equal(readGroupJournal(chat.id).entries.length, 1);
  assert.equal(readGroupJournal(chat.id).entries[0].messageCount, 501);
});

test('personal regeneration is atomic across chunks and serializes normal manual and auto work', async () => {
  archiveFixture(); testApi();
  const chats = JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!);
  chats[0].messages = Array.from({ length: 251 }, (_, index) => ({
    id: `atomic-${index}`, senderId: 'user', text: `消息${index}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    await assert.rejects(regenerateJournal('archive-char'), /正在整理/);
    await assert.rejects(runJournal('archive-char'), /正在整理/);
    if (calls === 2) throw new Error('第二段失败');
    return aiResponse('第一段结果');
  });
  await assert.rejects(regenerateJournal('archive-char'), /第二段失败/);
  assert.equal(readJournalEntries().length, 0);
  assert.equal(readJournalSettings().journalCursors['archive-char'], undefined);
});

test('group range regeneration guards source changes and continues filtering private forum cards', async () => {
  const chat = groupJournalFixture(10);
  const messages = chat.messages as Array<Record<string, unknown>>;
  messages[2] = { ...messages[2], kind: 'forum-forward', title: '秘密帖子', text: '论坛正文秘密',
    aiContext: '作者身份秘密', forumForwardTargetId: 'other-char' };
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat]);
  let body = ''; let mutate = false;
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    body = String(init?.body);
    if (mutate) {
      chat.messages[0].text = '修改过的原文';
      saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat]);
    }
    return aiResponse('不含秘密的群摘要');
  });
  await regenerateGroupJournal(chat.id);
  assert.doesNotMatch(body, /论坛正文秘密|作者身份秘密|秘密帖子/);
  const original = readGroupJournal(chat.id);
  mutate = true;
  await assert.rejects(regenerateGroupJournal(chat.id), /已变化/);
  assert.deepEqual(readGroupJournal(chat.id), original);
});

test('phone background settings work before the first chat and Gemini all-generation still makes one request', async () => {
  testApi();
  saveSetting('pocketos:wechat-contacts', [{ id: 'new-char', name: '新角色', persona: '新角色设定', worldBooks: [] }]);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, []);
  let calls = 0; let body = '';
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    calls += 1; body = String(init?.body); return aiResponse({ notes: [{ content: '新记录' }] });
  });
  const previous = { charId: 'new-char', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [],
    browserHistory: [], notes: [], icityDiaries: [],
    agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] } };
  await generatePhoneScope('notes', { charId: 'new-char', charName: '新角色', userName: '玩家', npcs: [] }, previous);
  assert.equal(calls, 1);
  assert.match(body, /新角色设定/);
  assert.deepEqual(JSON.parse(readStorageString(WECHAT_CHATS_STORAGE_KEY)!), []);
  saveSetting(SETTINGS_KEYS.apiPresets, [{ id: 'gemini', name: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com', apiKey: 'test' }]);
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    calls += 1; body = String(init?.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }));
  });
  await assert.rejects(generatePhoneScope('all', { charId: 'new-char', charName: '新角色', userName: '玩家', npcs: [] }, previous), /遗漏/);
  assert.equal(calls, 2);
  assert.match(body, /systemInstruction/);
  assert.match(body, /一次生成以下所有模块/);
});

test('beauty export includes only applied appearance, not saved presets or unsaved drafts', async () => {
  const source = readFileSync(resolve('src', 'apps', 'ThemeCustomizerApp.tsx'), 'utf8');
  const handler = source.split('  const handleExport = () => {')[1]?.split('\n  };')[0];
  assert.ok(handler);
  const currentSettings = {
    themeId: 'ocean-dawn', wallpaperId: 'dreamy-sky',
    homeStyle: 'moonlit' as const,
    wallpapers: { lockScreen: 'applied-lock.png', homeScreen: 'applied-home.png' },
    appIcons: { wechat: 'applied-icon.png' },
    homeAppearance: captureHomeAppearance(INITIAL_USER_PROFILE),
    lockScreenAppearance: { textColor: '#123456', subtitle: '当前锁屏文字' },
  };
  for (const presets of [[], [{ id: 'private-preset', name: '不应导出', settings: { ...currentSettings, appIcons: { wechat: 'private-icon.png' } } }]]) {
    let exported: Blob | undefined;
    let clicked = false;
    let revoked = '';
    let status = '';
    let error = 'previous error';
    const anchor = { href: '', download: '', click: () => { clicked = true; } };
    runInNewContext(`(() => {${handler.replace(': BeautyPreset[]', '')}\n})();`, {
      currentSettings, presets, normalizeWallpaper,
      draftSettings: { ...currentSettings, wallpapers: { homeScreen: 'unsaved.png', lockScreen: '' } },
      Blob, JSON,
      URL: {
        createObjectURL: (blob: Blob) => { exported = blob; return 'blob:beauty-test'; },
        revokeObjectURL: (url: string) => { revoked = url; },
      },
      document: { createElement: () => anchor },
      setStatus: (value: string) => { status = value; },
      setError: (value: string) => { error = value; },
    });
    assert.ok(exported);
    const payload = JSON.parse(await exported.text());
    assert.deepEqual(payload, {
      format: 'yyphone-beauty', version: 1,
      presets: [{ id: 'current-design', name: '当前搭配', settings: JSON.parse(JSON.stringify(currentSettings)) }],
    });
    assert.equal(exported.type, 'application/json');
    assert.equal(anchor.download, 'yyphone-beauty.json');
    assert.equal(clicked, true);
    assert.equal(revoked, 'blob:beauty-test');
    assert.match(status, /当前已应用/);
    assert.equal(error, '');
  }
  const retired = { ...currentSettings, wallpaperId: 'deep-sea-frost' };
  const migrated = normalizeWallpaper(retired);
  assert.notEqual(migrated.wallpaperId, 'deep-sea-frost');
  assert.deepEqual(migrated.wallpapers, currentSettings.wallpapers);
  assert.deepEqual(migrated.appIcons, currentSettings.appIcons);
  assert.deepEqual(migrated.homeAppearance, currentSettings.homeAppearance);
  assert.deepEqual(migrated.lockScreenAppearance, currentSettings.lockScreenAppearance);
  assert.equal(retired.wallpaperId, 'deep-sea-frost', 'migration must not mutate the applied settings');
});

test('home profile edit sits beside paper notes and custom grid and dock icons replace the whole tile', () => {
  const render = (custom: boolean) => renderToStaticMarkup(createElement(HomeScreen, {
    userProfile: INITIAL_USER_PROFILE,
    apps: [{ ...MAIN_GRID_APPS[0], badge: 3 }],
    dockApps: [DOCK_APPS[0]],
    onOpenApp: () => {},
    onSaveUserProfile: () => true,
    appIcons: custom ? { [MAIN_GRID_APPS[0].id]: 'grid-icon.png', [DOCK_APPS[0].id]: 'dock-icon.png' } : {},
  }));
  const html = render(true);
  assert.equal((html.match(/aria-label="编辑资料"/g) ?? []).length, 1);
  assert.match(html, /title="编辑资料" class="[^"]*from-\[#DCEEFF\][^"]*to-white/);
  assert.match(html, /title="编辑资料"[^]*?<\/button><button[^]*?aria-label="小纸条"/);
  assert.match(html, /<img src="grid-icon.png" alt="" class="absolute inset-0 h-full w-full object-cover"/);
  assert.match(html, /<img src="dock-icon.png" alt="" class="absolute inset-0 h-full w-full object-cover"/);
  assert.ok(html.includes('>3</span>'), 'app badges remain outside the image tile');
  for (const color of [MAIN_GRID_APPS[0].color, DOCK_APPS[0].color]) {
    assert.ok(!html.includes(color), 'custom tiles must not retain the default gradient overlay');
    assert.ok(render(false).includes(color), 'system tiles keep their original background');
  }
});

const groupJournalFixture = (count = 30, type: 'group' | 'observer' = 'group', id = 'journal-group') => {
  const chat = {
    id, type, participantIds: ['journal-a', 'journal-b'], groupTitle: '旅行计划群',
    groupNicknames: { 'journal-b': '小乙' }, noteName: '', context: '', activeArchiveId: 'old',
    currentChatHistoryCount: 5,
    messages: Array.from({ length: count }, (_, index) => ({
      id: `${id}-m-${index}`, senderId: index % 2 ? 'journal-b' : 'journal-a',
      text: `讨论周末计划${index}`, createdAt: new Date(Date.UTC(2026, 9, 18, 10, 0, index)).toISOString(),
    })),
  };
  saveSetting('pocketos:wechat-contacts', [
    { id: 'journal-a', name: '角色甲', persona: '甲设定', worldBooks: [] },
    { id: 'journal-b', name: '角色乙', persona: '乙设定', worldBooks: [] },
  ]);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat]);
  writeMemorySettings({
    ...DEFAULT_MEMORY_SETTINGS, useSecondaryApi: true,
    secondaryApi: { endpoint: 'https://group-journal.invalid/v1', apiKey: 'test', model: 'mock' },
  });
  return chat;
};

test('group journals default off, summarize named speakers and remain separate from character memories', async () => {
  const chat = groupJournalFixture();
  let calls = 0;
  const requests: string[] = [];
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    calls += 1;
    requests.push(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: '甲与乙在旅行计划群商量周末出行，乙负责查路线。' } }] }));
  });
  assert.equal(readGroupJournal(chat.id).auto, false);
  assert.equal(readGroupJournal(chat.id).every, 100);
  await maybeAutoGroupJournal(chat.id);
  assert.equal(calls, 0);
  assert.deepEqual(await runGroupJournal(chat.id), { created: 1, merged: 0 });
  assert.equal(readGroupJournal(chat.id).pending, 0);
  assert.equal(readGroupJournal(chat.id).entries[0].messageCount, 30);
  assert.match(requests[0], /第三人称/);
  assert.match(requests[0], /名称：旅行计划群/);
  assert.match(requests[0], /角色乙（ID：journal-b；群昵称：小乙）/);
  assert.equal(readMemories().length, 0);
  assert.equal(readJournalEntries().length, 0);
  assert.deepEqual(await runGroupJournal(chat.id), { created: 0, merged: 0 });
  assert.equal(calls, 1);
  assert.equal(buildGroupJournalInjection(chat.id, chat.messages[5].createdAt), '');
  assert.match(buildGroupJournalInjection(chat.id, '2026-10-19'), /乙负责查路线/);
  const html = renderToStaticMarkup(createElement(GroupJournalPanel, { chatId: chat.id }));
  assert.match(html, /本群流水账/);
  assert.match(html, /默认关闭/);
  assert.match(html, /乙负责查路线/);
  assert.match(html, /整理流水账/);
});

test('observer journals preserve absent players and mounted summaries only supplement older raw history', async () => {
  const chat = groupJournalFixture(15, 'observer');
  let request = '';
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    request = String(init?.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '甲乙商定周日去公园，玩家不在群内。' } }] }));
  });
  await runGroupJournal(chat.id);
  assert.match(request, /旁观群聊/);
  assert.match(request, /玩家不在这个群里/);
  const later = { id: 'later', senderId: 'journal-a', text: '我们按计划出发', createdAt: '2026-10-19T10:00:00Z' };
  chat.messages = [later];
  const direct = {
    ...chat, id: 'mounted-direct', type: 'direct', participantIds: ['journal-a'],
    attachHistory: true, attachedHistoryChatIds: [chat.id], attachedHistoryCounts: { [chat.id]: 1 },
    messages: [{ ...later, id: 'user-turn', senderId: 'user', text: '周末有什么安排' }],
  };
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat, direct]);
  assert.match(buildPrompt({ chatId: chat.id }).map((item) => item.content).join('\n'), /当前群聊的旧流水账/);
  const prompt = buildPrompt({ chatId: direct.id }).map((item) => item.content).join('\n');
  assert.match(prompt, /挂载群聊的旧流水账（仅背景）/);
  assert.match(prompt, /甲乙商定周日去公园/);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat, { ...direct, attachHistory: false }]);
  assert.doesNotMatch(buildPrompt({ chatId: direct.id }).map((item) => item.content).join('\n'), /甲乙商定周日去公园/);
  assert.equal(readMemories().length, 0);
});

test('group journals isolate groups and archives, reject stale tasks and clear only targeted scope', async () => {
  const chat = groupJournalFixture();
  const other = { ...chat, id: 'journal-other', groupTitle: '另一个群' };
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat, other]);
  let switchDuringRequest = false;
  mock.method(globalThis, 'fetch', async () => {
    if (switchDuringRequest) {
      saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, activeArchiveId: 'new' }, other]);
      invalidateGroupJournal(chat.id);
      saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat, other]);
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: '旧档群内商量出行。' } }] }));
  });
  await runGroupJournal(chat.id);
  assert.equal(readGroupJournal(other.id).entries.length, 0);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, activeArchiveId: 'new' }, other]);
  assert.equal(readGroupJournal(chat.id).entries.length, 0);
  assert.equal(readGroupJournal(chat.id).pending, 30);
  await runGroupJournal(chat.id);
  deleteGroupJournal(chat.id, 'old');
  assert.equal(readGroupJournal(chat.id).entries.length, 1);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat, other]);
  assert.equal(readGroupJournal(chat.id).entries.length, 0);
  switchDuringRequest = true;
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
  await assert.rejects(runGroupJournal(chat.id), /切换、修改或删除/);
  assert.equal(readGroupJournal(chat.id).entries.length, 0);
  switchDuringRequest = false;
  await runGroupJournal(other.id);
  deleteGroupJournal(chat.id);
  assert.equal(readGroupJournal(other.id).entries.length, 1);
  assert.equal(readGroupJournal(chat.id).auto, false);
});

test('group automatic thresholds include 400 messages, same-time cursors and independent settings', async () => {
  const chat = groupJournalFixture(400, 'group', 'journal-auto-400');
  chat.messages = chat.messages.map((message) => ({ ...message, createdAt: '2026-10-18T10:00:00Z' }));
  const other = { ...chat, id: 'journal-auto-off' };
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, messages: chat.messages.slice(0, 399) }, other]);
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: '群内确认计划。' } }] }));
  });
  setGroupJournalSettings(chat.id, { auto: true, every: 400 });
  await maybeAutoGroupJournal(other.id);
  assert.equal(calls, 0);
  await maybeAutoGroupJournal(chat.id);
  assert.equal(calls, 0, '399 messages must not trigger a 400-message threshold');
  assert.equal(readGroupJournal(chat.id).pending, 399);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat, other]);
  await maybeAutoGroupJournal(chat.id);
  const first = readGroupJournal(chat.id);
  assert.equal(first.pending, 0);
  assert.equal(first.entries.length, 1, 'internal request batches must produce one saved summary');
  assert.equal(first.entries[0].messageCount, 400);
  assert.equal(first.entries[0].fromMessageId, chat.messages[0].id);
  assert.equal(first.entries[0].toMessageId, chat.messages[399].id);
  assert.ok(calls >= 1);
  const callsAfterFirst = calls;
  assert.deepEqual(await runGroupJournal(chat.id), { created: 0, merged: 0 });
  await maybeAutoGroupJournal(chat.id);
  assert.equal(calls, callsAfterFirst, 'already summarized messages must not be sent again');
  const additional = chat.messages.map((message, index) => ({ ...message, id: `same-time-next-${index}` }));
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, messages: [...chat.messages, ...additional.slice(0, 399)] }, other]);
  await maybeAutoGroupJournal(chat.id);
  assert.equal(calls, callsAfterFirst);
  assert.equal(readGroupJournal(chat.id).pending, 399, 'same timestamps must not hide new message IDs');
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, messages: [...chat.messages, ...additional] }, other]);
  await maybeAutoGroupJournal(chat.id);
  const second = readGroupJournal(chat.id);
  assert.equal(second.pending, 0);
  assert.equal(second.entries.length, 2);
  assert.equal(second.entries.reduce((sum, entry) => sum + entry.messageCount, 0), 800);
  assert.ok(second.entries.some(entry => entry.fromMessageId === additional[0].id && entry.toMessageId === additional[399].id));
  assert.equal(readGroupJournal(other.id).entries.length, 0);
  assert.equal(readGroupJournal(other.id).every, 100);
  assert.throws(() => setGroupJournalSettings(chat.id, { every: 0 }), /30 到 400/);
  assert.throws(() => setGroupJournalSettings(chat.id, { every: 401 }), /30 到 400/);
});

test('group journal compression keeps sources, bounds injection, and deleting a parent restores children', async () => {
  const chat = groupJournalFixture(0);
  const entries = Array.from({ length: 9 }, (_, index) => ({
    id: `seed-${index}`, level: 1, from: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    to: `2026-01-${String(index + 1).padStart(2, '0')}T01:00:00Z`, messageCount: 100,
    content: `第${index}次讨论。`, source: `群名：旧群名${index}，成员：甲乙`, createdAt: '2026-01-01',
  }));
  saveSetting(GROUP_JOURNAL_KEY, {
    version: 1, groups: { [chat.id]: { auto: false, every: 100, archives: { old: { entries, lastError: '' } } } },
  });
  let request = '';
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    request = String(init?.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '甲乙多次讨论后约定周日出行。' } }] }));
  });
  assert.deepEqual(await runGroupJournal(chat.id, { compressOnly: true }), { created: 0, merged: 1 });
  const result = readGroupJournal(chat.id);
  const parent = result.entries.find((entry) => entry.level === 2);
  assert.ok(parent);
  assert.equal(parent.messageCount, 500);
  assert.match(parent.source, /旧群名0/);
  assert.match(parent.source, /旧群名4/);
  assert.match(request, /第三人称/);
  assert.equal(result.entries.filter((entry) => entry.mergedInto === parent.id).length, 5);
  editGroupJournalEntry(chat.id, parent.id, '人工纠正的出行约定');
  assert.match(buildGroupJournalInjection(chat.id), /人工纠正的出行约定/);
  assert.throws(() => editGroupJournalEntry(chat.id, parent.id, ' '), /不能为空/);
  deleteGroupJournalEntry(chat.id, parent.id);
  assert.equal(readGroupJournal(chat.id).entries.filter((entry) => !entry.mergedInto).length, 9);
  assert.ok(buildGroupJournalInjection(chat.id).length < 8500);
});

test('group journal failures retain progress, serialize generation and detect edited source messages', async () => {
  const chat = groupJournalFixture();
  let mode = 'offline';
  mock.method(console, 'error', () => {});
  mock.method(console, 'warn', () => {});
  mock.method(globalThis, 'fetch', async () => {
    if (mode === 'offline') throw new Error('network offline');
    if (mode === 'edit') {
      saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, messages: chat.messages.slice(1) }]);
    }
    if (mode === 'concurrent') {
      await assert.rejects(runGroupJournal(chat.id), /正在整理/);
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: '群内计划摘要' } }] }));
  });
  await assert.rejects(runGroupJournal(chat.id), /network offline/);
  assert.equal(readGroupJournal(chat.id).pending, 30);
  assert.match(readGroupJournal(chat.id).lastError, /network offline/);
  mode = 'edit';
  await assert.rejects(runGroupJournal(chat.id), /已修改或删除/);
  assert.equal(readGroupJournal(chat.id).entries.length, 0);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat]);
  mode = 'concurrent';
  await runGroupJournal(chat.id);
  assert.equal(readGroupJournal(chat.id).entries.length, 1);
  assert.equal(readGroupJournal(chat.id).lastError, '');
});

test('invalid group journal storage is reported rather than overwritten', () => {
  const chat = groupJournalFixture();
  saveSetting(GROUP_JOURNAL_KEY, { version: 99, doNotLose: 'existing data' });
  assert.throws(() => readGroupJournal(chat.id), /数据格式无效/);
  assert.throws(() => setGroupJournalSettings(chat.id, { auto: true }), /数据格式无效/);
  assert.deepEqual(readStoredValue<unknown>(GROUP_JOURNAL_KEY, null, (_value): _value is unknown => true),
    { version: 99, doNotLose: 'existing data' });
});

test('group journals compress stages and long recaps and bound injected summary payloads', async () => {
  const chat = groupJournalFixture(0);
  mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: '甲乙最终确定计划与分工。' } }] })));
  for (const level of [2, 3] as const) {
    const entries = Array.from({ length: 7 }, (_, index) => ({
      id: `level-${level}-${index}`, level, from: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
      to: `2026-01-${String(index + 1).padStart(2, '0')}T01:00:00Z`, messageCount: 500,
      content: '旧事'.repeat(1500), source: '群名：旅行计划群；成员：甲乙', createdAt: '2026-01-01',
    }));
    saveSetting(GROUP_JOURNAL_KEY, {
      version: 1, groups: { [chat.id]: { auto: false, every: 100, archives: { old: { entries, lastError: '' } } } },
    });
    const injection = buildGroupJournalInjection(chat.id);
    assert.ok(injection.includes('旧事'));
    assert.ok(injection.length < 8500, `${injection.length} characters must remain bounded`);
    assert.deepEqual(await runGroupJournal(chat.id, { compressOnly: true }), { created: 0, merged: 1 });
    const active = readGroupJournal(chat.id).entries.filter((entry) => !entry.mergedInto);
    const recap = active.find((entry) => entry.content === '甲乙最终确定计划与分工。');
    assert.ok(recap);
    assert.equal(recap.level, 3);
    assert.equal(recap.messageCount, 2000);
    assert.equal(active.length, 4);
  }
});

test('group journals do not expose forum forwards restricted to their original direct recipient', async () => {
  const chat = groupJournalFixture(10);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    ...chat, messages: chat.messages.map((message, index) => index ? message : {
      ...message, kind: 'forum-forward', text: '仅限私聊的帖子正文', title: '仅限私聊的作者',
      aiContext: '私密转发详情不得泄露', forumForwardTargetId: 'journal-a',
    }),
  }]);
  let request = '';
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    request = String(init?.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '群内讨论了出游。' } }] }));
  });
  await runGroupJournal(chat.id);
  assert.doesNotMatch(request, /仅限私聊的帖子正文|仅限私聊的作者|私密转发详情不得泄露/);
  assert.match(request, /论坛转发内容不向本群开放/);
});

test('paper candidates only include real unblocked direct contacts with message history', () => {
  paperFixture();
  assert.deepEqual(paperCandidates().map((item) => item.charId), ['paper-a', 'paper-b']);
});

test('daily paper generation is serialized, persists the random author on failure and never redraws after deletion', async () => {
  paperFixture();
  await assert.rejects(openDailyPaper(async (selected) => {
    assert.equal(selected.charId, 'paper-b');
    throw new Error('mock offline');
  }, { now: paperDate, random: () => 0.99 }), /mock offline/);
  assert.equal(readPaperNotes().notes.length, 0);
  assert.equal(readPaperNotes().days['2026-10-18'].charId, 'paper-b');
  let calls = 0;
  const generate = async () => { calls += 1; return questionPaper(); };
  const [first, second] = await Promise.all([
    openDailyPaper(generate, { now: paperDate, random: () => 0 }),
    openDailyPaper(generate, { now: paperDate, random: () => 0 }),
  ]);
  assert.equal(calls, 1);
  assert.equal(first?.id, second?.id);
  assert.equal(first?.charId, 'paper-b');
  assert.equal(readPaperNotes().notes.length, 1);
  await discardPaper(first!.id);
  assert.equal(readPaperNotes().notes.length, 0);
  assert.equal(readPaperNotes().memories.length, 1);
  assert.equal(await openDailyPaper(generate, { now: paperDate }), undefined);
  assert.equal(calls, 1);
  const tomorrow = await openDailyPaper(generate, { now: () => new Date(2026, 9, 19, 0, 1) });
  assert.equal(tomorrow?.date, '2026-10-19');
  assert.equal(calls, 2);
});

test('only question papers accept one same-day answer and retries retain the original answer', async () => {
  paperFixture();
  const first = await openDailyPaper(questionPaper, { now: paperDate, random: () => 0 });
  assert.ok(first);
  await assert.rejects(answerPaper(first.id, '是海边的风。', async () => { throw new Error('mock reply failure'); }, paperDate), /mock reply failure/);
  assert.equal(readPaperNotes().notes[0].answer, '是海边的风。');
  assert.equal(readPaperNotes().memories[0].answer, '是海边的风。');
  const replied = await answerPaper(first.id, '不能替换已经传回的回答', async (paper) => {
    assert.equal(paper.answer, '是海边的风。');
    return '那阵风，我也记得。';
  }, paperDate);
  assert.equal(replied.reply, '那阵风，我也记得。');
  await assert.rejects(answerPaper(first.id, '再问一次', async () => '不应请求', paperDate), /不能再传递/);
  assert.equal(readPaperNotes().memories[0].reply, replied.reply);
  assert.equal(readStoredValue(WECHAT_CHATS_STORAGE_KEY, [], Array.isArray)[0].messages.length, 1);
});

test('thought and unsaid papers cannot be passed and old questions expire without API calls', async () => {
  for (const kind of ['thought', 'unsaid', 'question'] as const) {
    paperFixture();
    saveSetting(PAPER_NOTES_KEY, parsePaperNotesState(undefined));
    const first = await openDailyPaper(async () => ({ kind, content: '留给你的心里话' }), { now: paperDate });
    assert.ok(first);
    let calls = 0;
    await assert.rejects(answerPaper(first.id, '回答', async () => { calls += 1; return '不应请求'; },
      () => new Date(2026, 9, 19, 0, 1)), kind === 'question' ? /只能在收到当天/ : /只有提问/);
    assert.equal(calls, 0);
    await assert.rejects(answerPaper(first.id, '', async () => '不应请求', paperDate), kind === 'question' ? /请输入回答/ : /只有提问/);
  }
});

test('paper generation rejects no candidates, invalid content, midnight rollover and archive switches without consuming the day', async () => {
  await assert.rejects(openDailyPaper(questionPaper, { now: paperDate }), /先去微信/);
  paperFixture();
  await assert.rejects(openDailyPaper(async () => ({ kind: 'thought', content: '' }), { now: paperDate }), /格式无效/);
  assert.equal(readPaperNotes().days['2026-10-18'].noteId, undefined);
  let now = paperDate();
  await assert.rejects(openDailyPaper(async () => {
    now = new Date(2026, 9, 19, 0, 0);
    return questionPaper();
  }, { now: () => now }), /已过零点/);
  assert.equal(readPaperNotes().notes.length, 0);
  await assert.rejects(openDailyPaper(async (selected) => {
    const chats = readStoredValue(WECHAT_CHATS_STORAGE_KEY, [], Array.isArray);
    saveSetting(WECHAT_CHATS_STORAGE_KEY, chats.map((chat) => chat.id === selected.chatId ? { ...chat, activeArchiveId: 'new-paper-archive' } : chat));
    return questionPaper();
  }, { now: paperDate }), /存档/);
  assert.equal(readPaperNotes().notes.length, 0);
});

test('paper memories are private, persist after discarding, follow archives and clear on archive deletion', async () => {
  paperFixture();
  const first = await openDailyPaper(questionPaper, { now: paperDate, random: () => 0 });
  assert.ok(first);
  const prompt = buildPrompt({ chatId: 'chat-paper-a' });
  assert.match(prompt.map((item) => item.content).join('\n'), /今天看海时，你最喜欢哪个瞬间/);
  assert.match(buildPaperMemoryInjection(['paper-a'], 'direct'), /通常不要在聊天里提起/);
  assert.equal(buildPaperMemoryInjection(['paper-b'], 'direct'), '');
  assert.equal(buildPaperMemoryInjection(['paper-a'], 'group'), '');
  assert.equal(buildPaperMemoryInjection(['paper-a'], 'observer'), '');
  await discardPaper(first.id);
  assert.match(buildPaperMemoryInjection(['paper-a'], 'direct'), /今天看海时/);
  const chats = readStoredValue(WECHAT_CHATS_STORAGE_KEY, [], Array.isArray);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats.map((chat) => ({ ...chat, activeArchiveId: 'new-archive' })));
  assert.equal(buildPaperMemoryInjection(['paper-a'], 'direct'), '');
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  deleteMemoryArchive('paper-a', 'paper-archive');
  assert.equal(buildPaperMemoryInjection(['paper-a'], 'direct'), '');
  assert.equal(readPaperNotes().memories.length, 0);
});

test('paper data corruption is explicit and never overwritten by opening a paper', async () => {
  assert.throws(() => parsePaperNotesState({ version: 2 }), /格式无效/);
  saveSetting(PAPER_NOTES_KEY, { bad: 'keep this data' });
  await assert.rejects(openDailyPaper(questionPaper, { now: paperDate }), /格式无效/);
  assert.deepEqual(readStoredValue(PAPER_NOTES_KEY, {}, (value): value is object => !!value), { bad: 'keep this data' });
});

test('actual paper AI receives persona, selected world books, active memories and configured recent context without modifying chat', async () => {
  Object.assign(window, { setTimeout, clearTimeout });
  paperFixture();
  saveSetting(SETTINGS_KEYS.apiPresets, [{ id: 'paper-test', name: '测试', endpoint: 'https://paper-test.example/v1', apiKey: 'test' }]);
  saveSetting(SETTINGS_KEYS.activeApiPreset, 'paper-test');
  saveSetting('pocketos:wechat-contacts', [{ id: 'paper-a', name: '纸条角色甲', persona: '不善表达但关心玩家', worldBooks: [{ bookId: 'paper-book' }] }]);
  saveSetting('yyphone:world-books', [{ id: 'paper-book', name: '纸条背景', entries: [{ id: 'entry', title: '偏好', content: '海边长大的背景设定', depth: 'front' }] }]);
  writeMemories([{ ...archiveMemory('paper-memory', 'paper-a'), content: '玩家喜欢把贝壳带回家', category: 'core' }]);
  const requests: string[] = [];
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    requests.push(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(requests.length === 1 ?
      { kind: 'question', content: '那枚贝壳，你放在哪里了？' } : { reply: '那就让它替你留住海风。' }) } }] }), { status: 200 });
  });
  const first = await openDailyPaper(generateDailyPaper, { now: paperDate, random: () => 0 });
  assert.ok(first);
  const response = await answerPaper(first.id, '放在床边啦', generatePaperReply, paperDate);
  assert.equal(response.reply, '那就让它替你留住海风。');
  for (const request of requests) {
    assert.match(request, /不善表达但关心玩家/);
    assert.match(request, /海边长大的背景设定/);
    assert.match(request, /玩家喜欢把贝壳带回家/);
    assert.match(request, /今天一起去看了海/);
    assert.match(request, /必须匿名/);
    const payload = JSON.parse(request);
    const system = payload.messages.find((message: { role: string }) => message.role === 'system').content;
    assert.match(system, /你清楚玩家看不见作者是谁/);
    assert.match(system, /试探只是可选的小彩蛋/);
    assert.match(system, /不要所有角色都吃醋或盘问/);
    assert.match(system, /不得凭空断言玩家另有恋人/);
    assert.match(system, /纸条表面不必具体/);
    assert.match(system, /程度由人设决定/);
  }
  assert.match(requests[1], /最后一次回复/);
  assert.match(requests[1], /不因被猜中或被问身份就自报姓名/);
  assert.match(requests[1], /根据玩家实际回答和人设/);
  assert.match(requests[1], /放在床边啦/);
  assert.equal(readStoredValue(WECHAT_CHATS_STORAGE_KEY, [], Array.isArray)[0].messages.length, 1);
});

test('direct balance edits persist exact amounts without changing other financial records', () => {
  const originalWindow = window;
  const events: string[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true, value: { localStorage, dispatchEvent: (event: Event) => { events.push(event.type); return true; } },
  });
  try {
    const finance = { ...emptyAlipayData(), balance: 100, yuebao: 500, chatSettlements: { received: 'received' as const } };
    writeAlipayData(finance);
    assert.equal(updateAlipayBalance(' 1234.56 '), 1234.56);
    assert.deepEqual(readAlipayData(), { ...finance, balance: 1234.56 });
    assert.deepEqual(events, ['yyphone:finance-change']);
    for (const value of ['', '-1', '1.234', 'abc', 'NaN', 'Infinity', '1e3', '9007199254740992']) {
      assert.throws(() => updateAlipayBalance(value), /金额/);
      assert.equal(readAlipayData().balance, 1234.56);
    }
    assert.equal(updateAlipayBalance('0'), 0);
    assert.equal(readAlipayData().balance, 0);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
});

test('moving either side of a mood record preserves the other side and refuses occupied targets', () => {
  const space = {
    ...createEmptyCoupleSpace('edit-char'),
    moods: {
      '2026-10-18': { dateStr: '2026-10-18', userMoodId: 'happy_1', userNote: '我的记录', charMoodId: 'sad_1', charNote: '角色记录', seenByChar: true },
      '2026-10-17': { dateStr: '2026-10-17', userMoodId: 'calm_1', userNote: '保留目标另一方', seenByChar: true },
    },
  };
  const moved = editCoupleRecord(space, {
    kind: 'mood', originalDate: '2026-10-18', date: '2026-10-17', author: 'char', moodId: 'happy_2', note: '改正角色心情',
  });
  assert.equal(moved.moods['2026-10-18'].charMoodId, undefined);
  assert.equal(moved.moods['2026-10-18'].userNote, '我的记录');
  assert.equal(moved.moods['2026-10-17'].userNote, '保留目标另一方');
  assert.equal(moved.moods['2026-10-17'].charNote, '改正角色心情');
  assert.equal(moved.moods['2026-10-17'].seenByChar, true);
  assert.equal(space.moods['2026-10-18'].charNote, '角色记录');
  assert.throws(() => editCoupleRecord(moved, {
    kind: 'mood', originalDate: '2026-10-18', date: '2026-10-17', author: 'user', moodId: 'happy_1', note: '不能覆盖',
  }), /目标日期已有/);
  const userMoved = editCoupleRecord(moved, {
    kind: 'mood', originalDate: '2026-10-18', date: '2026-10-16', author: 'user', moodId: 'calm_2', note: '新的日期',
  });
  assert.equal(userMoved.moods['2026-10-18'], undefined);
  assert.equal(userMoved.moods['2026-10-16'].seenByChar, false);
  assert.equal(userMoved.moods['2026-10-16'].dateStr, '2026-10-16');
});

test('couple note dates retain calendar dates and interpret legacy timestamps in local time', () => {
  assert.equal(coupleRecordDate('2026-10-18'), '2026-10-18');
  const local = new Date(2026, 9, 18, 0, 15);
  assert.equal(coupleRecordDate(local.toISOString()), '2026-10-18');
  assert.equal(coupleRecordDate('刚刚'), undefined);
  assert.equal(coupleRecordDate('2026-10-18Tinvalid'), undefined);
});

test('all couple record editors save content and dates without changing authors or unrelated data', () => {
  const space = {
    ...createEmptyCoupleSpace('edit-char'),
    diaries: [
      { id: 'char-diary', author: 'char' as const, authorName: '角色', dateStr: '2026-10-19', title: '原标题', content: '原文', seenByChar: true },
      { id: 'user-diary', author: 'user' as const, authorName: '我', dateStr: '2026-10-19', title: '我的标题', content: '我的正文', seenByChar: true },
    ],
    qaList: [{ id: 'qa', dateStr: '2026-10-19', question: '原问题', askedBy: 'user' as const, userAnswer: '我的回答', charAnswer: '角色回答', seenByChar: true }],
    stickyNotes: [
      { id: 'char-note', author: 'char' as const, authorName: '角色', createdAt: '刚刚', content: '原便签', colorBg: '#DCEEFF' },
      { id: 'user-note', author: 'user' as const, authorName: '我', createdAt: '2026-10-19', content: '我的便签', colorBg: '#DCEEFF', seenByChar: true },
    ],
    anniversaries: [{ id: 'anni', title: '纪念日', targetDate: '2026-10-19', type: 'countdown' as const }],
  };
  for (const diary of space.diaries) {
    const edited = editCoupleRecord(space, {
      kind: 'diary', id: diary.id, date: '2026-10-18', title: '新标题', content: '修正正文', replyComment: '修正批注', authorName: diary.authorName,
    });
    assert.equal(edited.diaries.find((entry) => entry.id === diary.id)?.dateStr, '2026-10-18');
    assert.equal(edited.diaries.find((entry) => entry.id === diary.id)?.replyComment, '修正批注');
    assert.equal(edited.diaries.find((entry) => entry.id === diary.id)?.author, diary.author);
  }
  const qa = editCoupleRecord(space, { kind: 'qa', id: 'qa', date: '2026-10-18', question: '新问题', userAnswer: '新 user 答案', charAnswer: '新角色答案' });
  assert.equal(qa.qaList[0].charAnswer, '新角色答案');
  assert.equal(qa.qaList[0].userAnswer, '新 user 答案');
  assert.equal(qa.qaList[0].dateStr, '2026-10-18');
  assert.equal(qa.qaList[0].seenByChar, false);
  for (const note of space.stickyNotes) {
    const edited = editCoupleRecord(space, { kind: 'note', id: note.id, date: '2026-10-18', content: '新便签', colorBg: '#123456', authorName: note.authorName });
    const actual = edited.stickyNotes.find((entry) => entry.id === note.id)!;
    assert.equal(actual.author, note.author);
    assert.equal(actual.createdAt, '2026-10-18');
    assert.equal(actual.colorBg, '#123456');
  }
  const anniversary = editCoupleRecord(space, { kind: 'anniversary', id: 'anni', date: '2026-10-18', title: '改正纪念日', type: 'elapsed' });
  assert.equal(anniversary.anniversaries[0].targetDate, '2026-10-18');
  assert.equal(anniversary.anniversaries[0].type, 'elapsed');
  assert.equal(space.qaList[0].question, '原问题');
  assert.equal(space.stickyNotes[0].createdAt, '刚刚');
});

test('couple editing rejects invalid dates, missing records and empty required content', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '', 'yesterday']) assert.equal(isRecordDate(date), false);
  assert.equal(isRecordDate('2028-02-29'), true);
  const space = {
    ...createEmptyCoupleSpace('edit-char'),
    diaries: [{ id: 'd', author: 'char' as const, authorName: '角色', dateStr: '2026-10-18', title: '标题', content: '正文' }],
  };
  assert.throws(() => editCoupleRecord(space, { kind: 'diary', id: 'd', date: '', title: '', content: '正文', authorName: '', replyComment: '' }), /有效的记录日期/);
  assert.throws(() => editCoupleRecord(space, { kind: 'diary', id: 'missing', date: '2026-10-18', title: '', content: '正文', authorName: '', replyComment: '' }), /不存在/);
  assert.throws(() => editCoupleRecord(space, { kind: 'diary', id: 'd', date: '2026-10-18', title: '', content: ' ', authorName: '', replyComment: '' }), /不能为空/);
});

test('lock appearance persists with beauty settings and renders custom colors, multiline or empty subtitles', () => {
  assert.equal(isLockScreenAppearance(DEFAULT_LOCK_APPEARANCE), true);
  assert.equal(isLockScreenAppearance({ textColor: '#fefefe', subtitle: '' }), true);
  assert.equal(isLockScreenAppearance({ textColor: 'url(bad)', subtitle: 'text' }), false);
  assert.equal(isLockScreenAppearance({ textColor: '#123456', subtitle: 'x'.repeat(201) }), false);
  const appearance = { textColor: '#ffcc88', subtitle: '晚风与你\n明天见 <3' };
  saveSetting(SETTINGS_KEYS.beauty, { themeId: 'ocean-dawn', wallpaperId: 'dreamy-sky', wallpapers: { lockScreen: '', homeScreen: '' }, appIcons: {}, lockScreenAppearance: appearance });
  const beauty = readSetting(SETTINGS_KEYS.beauty, { lockScreenAppearance: DEFAULT_LOCK_APPEARANCE }, (value): value is { lockScreenAppearance: typeof appearance } =>
    !!value && typeof value === 'object' && 'lockScreenAppearance' in value && isLockScreenAppearance(value.lockScreenAppearance));
  assert.deepEqual(beauty.lockScreenAppearance, appearance);
  const props = { onUnlock() {}, timeString: '21:08', dateString: '10月18日 星期日', wallpaperStyle: '#000' };
  const html = renderToStaticMarkup(createElement(LockScreen, { ...props, appearance: beauty.lockScreenAppearance }));
  assert.match(html, /color:#ffcc88/);
  assert.match(html, /晚风与你\n明天见 &lt;3/);
  assert.doesNotMatch(html, /丙午年/);
  const defaultMarkup = renderToStaticMarkup(createElement(LockScreen, props));
  assert.match(defaultMarkup, /天天开心/);
  const blank = renderToStaticMarkup(createElement(LockScreen, { ...props, appearance: { ...appearance, subtitle: '' } }));
  assert.doesNotMatch(blank, /晚风与你|丙午年|天天开心/);
});

test('character export includes only selected books and remaps books and entries without global side effects', () => {
  const books = parsePortableWorldBooks([
    { id: 'b1', name: '关联书', entries: [{ id: 'e1', title: '条目', content: '正文', depth: 'back' }] },
    { id: 'b2', name: '全局书', isGlobal: true, entries: [{ id: 'e2', title: '全局条目', content: '全局正文', depth: 'front' }] },
    { id: 'b3', name: '未选书', entries: [] },
  ]);
  const contact = {
    id: 'original', name: '角色', persona: '人设', avatarUrl: 'data:image/png;base64,AQID',
    bio: '介绍', forumHandle: 'handle', stickerCategories: ['收藏'],
    group: '朋友', starred: false, messages: ['不应导出的聊天记录'],
    worldBooks: [{ bookId: 'b1', entryId: 'e1' }, { bookId: 'b3' }], linkedNpcIds: ['private-npc'],
  };
  const bundle = JSON.parse(JSON.stringify(buildCharacterExport(contact, ['b1', 'b2'], books)));
  assert.equal(bundle.format, 'yyphone-contacts');
  assert.equal(bundle.version, 1);
  assert.equal(bundle.contacts[0].persona, '人设');
  assert.equal(bundle.contacts[0].bio, '介绍');
  assert.equal(bundle.contacts[0].avatarUrl, contact.avatarUrl);
  assert.equal(bundle.contacts[0].linkedNpcIds, undefined);
  assert.equal(bundle.contacts[0].messages, undefined);
  assert.deepEqual(bundle.worldBooks.map((book: { id: string }) => book.id), ['b1', 'b2']);
  assert.deepEqual(bundle.contacts[0].worldBooks, [{ bookId: 'b1', entryId: 'e1' }]);
  const mapped = remapImportedWorldBooks(parsePortableWorldBooks(bundle.worldBooks));
  const links = mapped.links(bundle.contacts[0].worldBooks);
  assert.notEqual(mapped.books[0].id, 'b1');
  assert.equal(mapped.books[0].entries[0].depth, 'back');
  assert.deepEqual(links[0], { bookId: mapped.books[0].id, entryId: mapped.books[0].entries[0].id });
  assert.deepEqual(links[1], { bookId: mapped.books[1].id });
  assert.equal(mapped.books[1].isGlobal, false);
  const bare = buildCharacterExport(contact, [], books);
  assert.deepEqual(bare.contacts[0].worldBooks, []);
  assert.deepEqual(bare.worldBooks, []);
  assert.throws(() => buildCharacterExport(contact, ['missing'], books), /不存在/);
  assert.throws(() => mapped.links([{ bookId: 'missing' }]), /缺失/);
  assert.throws(() => mapped.links([{ bookId: 'b1', entryId: 'missing' }]), /缺失/);
  assert.throws(() => parsePortableWorldBooks([{ id: 'bad', name: 'bad', entries: [{ id: 'e', title: '', content: '', depth: 'bad' }] }]), /条目/);
});

test('chat social actions default on but honor per-chat switches, regeneration and observer boundaries', () => {
  const ctx = socialFixture();
  ctx.chat.type = 'group';
  ctx.chat.participantIds.push('npc:test');
  const record = { privateMessage: { texts: ['刚才在群里没方便问 你还好吗'], reason: '群里提到玩家不舒服，私下关心' }, momentPost: { content: '今晚的云很轻' } };
  assert.match(buildSocialInstructions(ctx), /群聊触发私聊/);
  const parsed = parseSocialActions(record, ctx, 'social-char');
  assert.equal(parsed.privateMessage?.texts.length, 1);
  assert.equal(parsed.moment?.content, '今晚的云很轻');
  assert.throws(() => parseSocialActions(record, { ...ctx, regenerate: true }, 'social-char'), /不允许/);
  assert.throws(() => parseSocialActions(record, { ...ctx, chat: { ...ctx.chat, type: 'observer' } }, 'social-char'), /不允许/);
  assert.throws(() => parseSocialActions(record, ctx, 'npc:test'), /不允许/);
  assert.throws(() => parseSocialActions(record, { ...ctx, chat: { ...ctx.chat, participantIds: [] } }, 'social-char'), /不允许/);
  assert.throws(() => parseSocialActions(record, { ...ctx, chat: { ...ctx.chat, allowGroupPrivate: false } }, 'social-char'), /权限/);
  assert.throws(() => parseSocialActions({ momentPost: record.momentPost }, { ...ctx, chat: { ...ctx.chat, allowAutoMoments: false } }, 'social-char'), /权限/);
  assert.throws(() => parseSocialActions({ privateMessage: { texts: [], reason: 'test' } }, ctx, 'social-char'), /格式/);
  assert.deepEqual(parseSocialActions({}, ctx, 'npc:test'), {});
  applySocialWrites({ moment: parsed.moment }, ctx, ctx.actors[0]);
  assert.equal(readMoments()[0].authorId, 'social-char');
  assert.equal(readMoments()[0].content, '今晚的云很轻');
  assert.throws(() => parseSocialActions({ momentPost: record.momentPost }, ctx, 'social-char'), /重复/);
  // No hard cooldown: different, contextually justified posts are not rejected by a timer.
  assert.ok(parseSocialActions({ momentPost: { content: '另一个确实值得记录的瞬间' } }, ctx, 'social-char').moment);
});

test('automatic couple writes are forbidden even for previously enabled bound chats', () => {
  const ctx = socialFixture();
  const space = {
    ...createEmptyCoupleSpace('social-char'), bindStatus: 'bound' as const,
    moods: { '2026-10-18': { dateStr: '2026-10-18', userMoodId: 'happy_2', userNote: '用户心情', seenByChar: false } },
    qaList: [{ id: 'q1', dateStr: '2026-10-18', question: '今天最开心的事？', askedBy: 'user' as const, userAnswer: '聊天', seenByChar: false }],
  };
  writeCoupleSpaces({ 'social-char': space });
  const prompt = buildSocialInstructions(ctx);
  assert.match(prompt, /禁止 coupleWrite/);
  assert.doesNotMatch(prompt, /可选 coupleWrite|主动情侣空间/);
  const record = {
    coupleWrite: {
      day: 'previous', overnightEvidence: '我们还没睡呢 今天还没有结束',
      mood: { moodId: 'calm_1', note: '今天有你在 真好' },
      diary: { title: '睡前', content: '我想记下今天和你聊的这些小事。' },
      note: '明天记得吃早饭',
      answers: [{ questionId: 'q1', content: '陪你聊天' }],
    },
  };
  for (const enabled of [true, false, undefined]) {
    assert.throws(() => parseSocialActions(record, { ...ctx, chat: { ...ctx.chat, allowAutoCouple: enabled } }, 'social-char'), /已关闭/);
  }
  assert.throws(() => applySocialWrites({ couple: { day: 'today', note: '不应写入' } }, ctx, ctx.actors[0]), /已关闭/);
  assert.deepEqual(readCoupleSpaces()['social-char'], space);
});

test('latest thought injection adds flexible continuity guidance only when enabled and available', () => {
  const chat = {
    id: 'thought-chat', type: 'direct', participantIds: ['thought-char'], noteName: '', context: '',
    messages: [{ id: 'thought-message', senderId: 'thought-char', text: '你好', thought: '隐藏心声测试', createdAt: '' }],
  };
  for (const enabled of [false, true]) {
    saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, includeLatestThought: enabled }]);
    const prompt = buildPrompt({ chatId: chat.id }).map((message) => message.content).join('\n');
    assert.equal(prompt.includes('隐藏心声测试'), enabled);
    assert.equal(prompt.includes('刚刚的心声只是发出消息时的内心活动'), enabled);
  }
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...chat, includeLatestThought: true, messages: [] }]);
  assert.equal(buildPrompt({ chatId: chat.id }).some((message) => message.content.includes('刚刚的心声')), false);
});

test('messaging prompts distinguish asynchronous messages from explicitly connected calls', () => {
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'call-context', type: 'direct', participantIds: [], noteName: '', context: '',
    messages: [{ id: 'old-call', senderId: 'user', kind: 'video-call', text: '视频通话 · 已结束', createdAt: '' }],
  }]);
  const normal = buildPrompt({ chatId: 'call-context' })[0].content;
  assert.match(normal, /微信里异步发消息/);
  assert.match(normal, /语音消息只是发出的录音/);
  for (const callMode of ['voice', 'video'] as const) {
    const prompt = buildPrompt({ chatId: 'call-context', callMode })[0].content;
    assert.match(prompt, new RegExp(`已接通的${callMode === 'voice' ? '语音' : '视频'}通话`));
    assert.match(prompt, /一整段连贯的角色台词/);
    assert.doesNotMatch(prompt, /微信里异步发消息/);
  }
});

test('call replies combine into one synthesized utterance and keep video narration separate', () => {
  const parts = [
    { text: '等一下', kind: 'text' },
    { text: '我刚把灯打开了', kind: 'text' },
    { text: '她抬手理了理头发', kind: 'narration' },
    { text: '你好', kind: 'voice' },
  ];
  assert.deepEqual(normalizeCallReplyParts(parts, 'voice'), [
    { text: '等一下 我刚把灯打开了 你好。', kind: 'text' },
  ]);
  assert.deepEqual(normalizeCallReplyParts(parts, 'video'), [
    { text: '等一下 我刚把灯打开了 你好。', kind: 'text' },
    { text: '她抬手理了理头发', kind: 'narration' },
  ]);
  assert.deepEqual(normalizeCallReplyParts([{ text: '旁白', kind: 'narration' }], 'voice'), []);
  for (const text of ['你好。', '真的吗？', '太好了！', 'Hello.', 'Really?', 'Great!', '嗯…']) {
    assert.deepEqual(normalizeCallReplyParts([{ text: ` ${text} ` }], 'voice'), [{ text, kind: 'text' }], 'existing sentence punctuation must not be duplicated');
  }
  assert.deepEqual(normalizeCallReplyParts([{ text: ' ' }, { text: '旁白', kind: 'narration' }], 'video'), []);
});

test('shared history readers retain configured counts while check-phone generation uses 150 full messages', async () => {
  const tail = '完整长消息末尾';
  const messages = Array.from({ length: 260 }, (_, i) => ({
    id: `phone-${i}`, senderId: i % 2 ? 'phone-char' : 'user',
    text: `消息${i}：${'正文'.repeat(200)}${tail}`,
    createdAt: new Date(Date.UTC(2026, 9, 18, 0, i)).toISOString(),
    ...(i === 220 ? { kind: 'transfer', amount: '123', paymentStatus: 'pending' } : {}),
  }));
  saveSetting('pocketos:wechat-contacts', [{ id: 'phone-char', name: '角色', persona: '测试', worldBooks: [] }]);
  for (const count of [undefined, 40, 240, 500, 0]) {
    saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
      id: 'phone-chat', type: 'direct', participantIds: ['phone-char'], noteName: '', context: '',
      currentChatHistoryCount: count, messages,
    }]);
    const expected = Math.min(count && count > 0 ? count : 200, messages.length);
    const history = readDirectMessages('phone-char', { configuredHistory: true, fullText: true });
    assert.equal(history.length, expected);
    assert.ok(history.every((message) => message.text.endsWith(tail)));
    const brief = readCharacterBrief('phone-char', { configuredHistory: true });
    assert.equal(brief.recentChat.split('\n').length, expected);
    assert.match(brief.recentChat, /完整长消息末尾/);
    assert.equal(readCharacterBrief('phone-char').recentChat.split('\n').length, 5);
    assert.doesNotMatch(readCharacterBrief('phone-char').recentChat, /完整长消息末尾/);
  }
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'phone-chat', type: 'direct', participantIds: ['phone-char'], currentChatHistoryCount: 20, messages,
  }]);
  assert.doesNotMatch(readRecentMoneyEvents('phone-char'), /123/);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'phone-chat', type: 'direct', participantIds: ['phone-char'], noteName: '', context: '', currentChatHistoryCount: 200, messages,
  }]);
  assert.match(readRecentMoneyEvents('phone-char'), /123/);
  saveSetting(SETTINGS_KEYS.apiPresets, [{ id: 'phone-test', name: '测试', endpoint: 'https://phone-test.example/v1', apiKey: 'test' }]);
  let body = '';
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    body = String(init?.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"notes":[{"title":"测试","content":"测试备忘录"}]}' } }] }));
  });
  await generatePhoneScope('notes', { charId: 'phone-char', charName: '角色', userName: '玩家', npcs: [] }, {
    charId: 'phone-char', wallpaperUrl: '', userRemark: '', npcThreads: [], photos: [], browserHistory: [],
    notes: [], icityDiaries: [],
    agentSession: { doubaoTopic: '', doubaoTurns: [], claudeTopic: '', claudeTurns: [] },
  });
  const sent = JSON.parse(body).messages.map((message: { content: string }) => message.content).join('\n');
  assert.match(sent, /消息110：/);
  assert.doesNotMatch(sent, /消息109：/);
  assert.match(sent, /完整长消息末尾/);
});

test('phone chat display keeps only five latest real messages independently of AI history count', () => {
  const source = readFileSync(resolve('src', 'apps', 'PhoneExplorerApp.tsx'), 'utf8');
  const reader = source.slice(source.indexOf('const readRealUserMessagesForChar ='), source.indexOf('const readLinkedNpcsForChar ='));
  // Strip the local TypeScript signature so the actual UI reader runs in the VM.
  const executable = reader.replace(
    /\(\s*charId: string,\s*charName: string,\s*userName: string\s*\): PhoneWeChatMsg\[\]/,
    '(charId, charName, userName)'
  ).replace(/ as const/g, '');
  for (const count of [1, 200]) {
    saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
      id: 'display-chat', type: 'direct', participantIds: ['display-char'], currentChatHistoryCount: count,
      messages: Array.from({ length: 21 }, (_, i) => ({
        id: `display-${i}`, senderId: i === 20 ? 'narrator' : i % 2 ? 'display-char' : 'user',
        kind: i === 20 ? 'context-note' : 'text', text: `显示消息${i}`,
        createdAt: new Date(Date.UTC(2026, 9, 18, 0, i)).toISOString(),
      })),
    }]);
    const result = runInNewContext(`${executable}\nreadRealUserMessagesForChar('display-char', '角色', '玩家')`, { readDirectMessages });
    assert.equal(result.length, 5);
    assert.equal(result[0].text, '显示消息15');
    assert.equal(result[4].text, '显示消息19');
    assert.equal(readDirectMessages('display-char', { configuredHistory: true }).length, Math.min(count, 21));
  }
  const wechat = readFileSync(resolve('src', 'apps', 'WeChatApp.tsx'), 'utf8');
  assert.match(wechat, /const HISTORY_PAGE_SIZE = 15/);
  assert.match(wechat, /setVisibleMessageCount\(\(count\) => count \+ HISTORY_PAGE_SIZE\)/);
  assert.match(wechat, /slice\(-visibleMessageCount\)/);
  assert.doesNotMatch(source, /查看历史消息/);
});

test('real photos survive prompt history, current input, regeneration and mounted chats', () => {
  const imageUrl = 'data:image/jpeg;base64,AQID';
  const photo = (id: string, text = '拍摄的照片') => ({
    id, senderId: 'user', text, kind: 'image', imageUrl, createdAt: '2026-10-18T10:00:00Z',
  });
  const chat = {
    id: 'vision-chat', type: 'direct', participantIds: ['vision-char'], noteName: '', context: '',
    messages: [photo('old-photo'), { id: 'answer', senderId: 'vision-char', text: '回复', createdAt: '2026-10-18T10:01:00Z' }, photo('new-photo')],
  };
  saveSetting('pocketos:wechat-contacts', [{ id: 'vision-char', name: '角色', persona: '测试', worldBooks: [] }]);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [chat]);
  for (const regenerate of [false, true]) {
    const prompt = buildPrompt({ chatId: chat.id, regenerate });
    assert.equal(prompt.filter((message) => message.images?.[0] === imageUrl).length, 2);
    assert.deepEqual(prompt.at(-1)?.images, [imageUrl]);
    assert.match(prompt.at(-1)?.content ?? '', /真实图片/);
    const openAi = toOpenAiMessages(prompt);
    assert.deepEqual(openAi.at(-1)?.content, [
      { type: 'text', text: '[真实图片：拍摄的照片]' },
      { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
    ]);
    assert.deepEqual(toGeminiContents(prompt).at(-1)?.parts, [
      { text: '[真实图片：拍摄的照片]' },
      { inlineData: { mimeType: 'image/jpeg', data: 'AQID' } },
    ]);
  }
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [
    { ...chat, attachHistory: true, attachedHistoryChatIds: ['mounted'], messages: [photo('empty-caption', '')] },
    { ...chat, id: 'mounted', messages: [photo('mounted-photo')] },
  ]);
  const prompt = buildPrompt({ chatId: chat.id });
  assert.equal(prompt.filter((message) => message.images?.length).length, 2);
  assert.deepEqual(prompt.at(-1)?.images, [imageUrl]);
});

test('text-only image cards and plain messages stay text-only on both APIs', () => {
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'text-image', type: 'direct', participantIds: [], noteName: '', context: '',
    messages: [{ id: 'card', senderId: 'user', kind: 'image', text: '一只猫', createdAt: '' }],
  }]);
  const prompt = buildPrompt({ chatId: 'text-image' });
  assert.equal(prompt.some((message) => message.images?.length), false);
  assert.equal(prompt.at(-1)?.content, '[图片描述：一只猫]');
  const plain: OpenAiMessage[] = [{ role: 'system', content: 'rules' }, { role: 'user', content: 'hello' }];
  assert.deepEqual(toOpenAiMessages(plain), plain);
  assert.deepEqual(toGeminiContents(plain), [{ role: 'user', parts: [{ text: 'hello' }] }]);
  assert.equal(estimatePromptTokens([{ role: 'user', content: 'hello', images: ['data:image/jpeg;base64,AQID'] }]),
    estimatePromptTokens([{ role: 'user', content: 'hello' }]));
});

test('Gemini preserves supported image MIME types and reports invalid image data explicitly', () => {
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
    const contents = toGeminiContents([{ role: 'user', content: '', images: [`data:${mimeType};base64,AQID`] }]);
    assert.deepEqual(contents[0].parts[1], { inlineData: { mimeType, data: 'AQID' } });
  }
  for (const url of ['https://example.com/image.jpg', 'blob:local', 'data:image/svg+xml;base64,AQID']) {
    assert.throws(() => toGeminiContents([{ role: 'user', content: '', images: [url] }]), /重新上传本地图片/);
  }
});

test('real chat photos retain 1280px detail within 400KB while other images keep 300px defaults', async () => {
  const qualities: number[] = [];
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ clearRect() {}, drawImage() {} }),
    toDataURL: (type: string, quality: number) => {
      qualities.push(quality);
      return `data:${type};base64,${'A'.repeat(canvas.width > 300 ? Math.ceil(quality * 900000) : 1000)}`;
    },
  };
  const replacements = {
    FileReader: class {
      result = 'data:image/png;base64,AQID';
      onload?: () => void;
      readAsDataURL() { this.onload?.(); }
    },
    Image: class {
      width = 4000;
      height = 3000;
      onload?: () => void;
      set src(_value: string) { this.onload?.(); }
    },
    document: { createElement: () => canvas },
  };
  const descriptors = Object.keys(replacements).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  try {
    for (const [key, value] of Object.entries(replacements)) {
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    const photo = await compressChatPhoto(new File(['photo'], 'photo.png', { type: 'image/png' }));
    assert.equal(canvas.width, 1280);
    assert.equal(canvas.height, 960);
    assert.match(photo, /^data:image\/jpeg;base64,/);
    assert.ok(Buffer.from(photo.split(',')[1], 'base64').length <= 400 * 1024);
    assert.ok(Buffer.from(photo.split(',')[1], 'base64').length > 300 * 1024);
    assert.equal(qualities.length, 2);
    assert.ok(qualities[1] < qualities[0]);
    await compressImageFile(new File(['avatar'], 'avatar.png', { type: 'image/png' }));
    assert.equal(canvas.width, 300);
    assert.equal(canvas.height, 225);
    await assert.rejects(compressChatPhoto(new File(['text'], 'text.txt', { type: 'text/plain' })), /请选择图片文件/);
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('legacy memory, journals, growth and cursors migrate to current archive and restore together', () => {
  archiveFixture();
  saveSetting('yyphone:memory-items', [archiveMemory('old'), archiveMemory('shared', 'shared'), archiveMemory('other', 'other')]);
  saveSetting('yyphone:memory-journal', [{ id: 'journal-old', charId: 'archive-char', content: '旧身份日记', level: 1, from: '2026-01-01', to: '2026-01-02', messageCount: 10, createdAt: '', source: 'manual' }]);
  saveSetting('yyphone:memory-growth', [{ id: 'growth-old', charId: 'archive-char', relationship: '旧身份关系', changes: '变化', habits: '', createdAt: '', basedOnUntil: '', status: 'active' }]);
  saveSetting('yyphone:memory-settings', { ...DEFAULT_MEMORY_SETTINGS, cursors: { 'archive-char': 'old-memory-cursor' } });
  saveSetting('yyphone:memory-journal-settings', { journalCursors: { 'archive-char': 'old-journal-cursor' } });
  prepareMemoryArchiveSwitch();
  assert.equal(memoryArchiveLabel('archive-char'), '旧身份');
  assert.ok(readMemories().find((m) => m.id === 'old')?.archiveKey);
  archiveFixture('new');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared', 'other']);
  assert.deepEqual(readJournalEntries(), []);
  assert.deepEqual(readGrowthNotes(), []);
  assert.equal(readMemorySettings().cursors['archive-char'], undefined);
  assert.equal(readJournalSettings().journalCursors['archive-char'], undefined);
  writeMemories([...readMemories(), archiveMemory('new')]);
  writeMemorySettings({ ...readMemorySettings(), cursors: { 'archive-char': 'new-memory-cursor' } });
  writeJournalSettings({ ...readJournalSettings(), journalCursors: { 'archive-char': 'new-journal-cursor' } });
  archiveFixture('old');
  assert.deepEqual(readMemories().filter((m) => m.charId === 'archive-char').map((m) => m.id), ['old']);
  assert.equal(readJournalEntries()[0].content, '旧身份日记');
  assert.equal(readGrowthNotes()[0].relationship, '旧身份关系');
  assert.equal(readMemorySettings().cursors['archive-char'], 'old-memory-cursor');
  assert.equal(readJournalSettings().journalCursors['archive-char'], 'old-journal-cursor');
  archiveFixture('new');
  assert.equal(readMemorySettings().cursors['archive-char'], 'new-memory-cursor');
  assert.equal(readJournalSettings().journalCursors['archive-char'], 'new-journal-cursor');
});

test('archive isolation applies to prompt memory, journal and growth injection and dedupe', async () => {
  Object.assign(window, { setTimeout, clearTimeout });
  archiveFixture();
  writeMemories([archiveMemory('old')]);
  writeJournalEntries([{ id: 'journal-old', charId: 'archive-char', content: '独属于旧档的经历', level: 1, from: '2026-01-01', to: '2026-01-02', messageCount: 10, createdAt: '', source: 'manual' }]);
  writeGrowthNotes([{ id: 'growth-old', charId: 'archive-char', relationship: '旧档恋人', changes: '', habits: '', createdAt: '', basedOnUntil: '', status: 'active' }]);
  assert.match((await buildMemoryInjection(['archive-char'], 'direct', '', () => '')).text, /记忆old/);
  assert.match(buildJournalInjection(['archive-char'], 'direct', ''), /独属于旧档的经历/);
  assert.match(buildGrowthInjection(['archive-char'], 'direct'), /旧档恋人/);
  archiveFixture('new');
  assert.equal((await buildMemoryInjection(['archive-char'], 'direct', '', () => '')).text, '');
  assert.equal(buildJournalInjection(['archive-char'], 'direct', ''), '');
  assert.equal(buildGrowthInjection(['archive-char'], 'direct'), '');
  const result = await addMemoryCandidates('archive-char', [{ content: '记忆old', category: 'core', importance: 5, pinned: true }], 'chat', DEFAULT_MEMORY_SETTINGS);
  assert.equal(result.added, 1);
  assert.equal(result.merged, 0);
  archiveFixture('old');
  assert.equal(readMemories()[0].id, 'old');
});

test('deleting an archive removes its memory, journals, growth, cursors and embeddings only', () => {
  archiveFixture();
  writeMemories([archiveMemory('old'), archiveMemory('shared', 'shared')]);
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, cursors: { 'archive-char': 'old-cursor' } });
  writeJournalEntries([{ id: 'j', charId: 'archive-char', content: '旧日记', level: 1, from: '', to: '', messageCount: 10, createdAt: '', source: 'manual' }]);
  writeGrowthNotes([{ id: 'g', charId: 'archive-char', relationship: '旧关系', changes: '', habits: '', createdAt: '', basedOnUntil: '', status: 'active' }]);
  archiveFixture('new');
  writeMemories([...readMemories(), archiveMemory('new')]);
  writeMemorySettings({ ...readMemorySettings(), cursors: { 'archive-char': 'new-cursor' } });
  writeEmbeddings({ old: { m: 'm', v: [1] }, new: { m: 'm', v: [2] }, shared: { m: 'm', v: [3] } });
  deleteMemoryArchive('archive-char', 'old');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared', 'new']);
  assert.equal(readMemorySettings().cursors['archive-char'], 'new-cursor');
  assert.deepEqual(Object.keys(readEmbeddings()).sort(), ['new', 'shared']);
  archiveFixture('old');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared']);
  assert.deepEqual(readJournalEntries(), []);
  assert.deepEqual(readGrowthNotes(), []);
  assert.equal(readMemorySettings().cursors['archive-char'], undefined);
  deleteCharacterMemoryArchives('archive-char');
  archiveFixture('new');
  assert.deepEqual(readMemories().map((m) => m.id), ['shared']);
  assert.equal(readMemorySettings().cursors['archive-char'], undefined);
});

test('memory exports target current archive and imports explicitly belong to destination archive', () => {
  archiveFixture();
  writeMemories([archiveMemory('old')]);
  const exported = exportMemories('archive-char');
  archiveFixture('new');
  assert.equal(exportMemories('archive-char').memories.length, 0);
  const result = importMemories(exported, 'archive-char', ['archive-char']);
  assert.equal(result.items.length, 1);
  assert.equal(readMemories()[0].archiveKey, activeMemoryArchive('archive-char'));
  archiveFixture('old');
  assert.equal(readMemories()[0].id, 'old');
});

test('archive guards reject stale writes even after switching back to the same archive', () => {
  archiveFixture();
  writeMemories([archiveMemory('old')]);
  const old = readMemories();
  const guard = guardMemoryArchive('archive-char');
  archiveFixture('new');
  assert.throws(() => writeMemories(old), /存档已变化/);
  assert.throws(guard, /存档已切换/);
  archiveFixture('old');
  invalidateMemoryArchive('archive-char');
  assert.throws(guard, /存档已切换/);
  assert.equal(readMemories()[0].content, '记忆old');
});

test('in-flight memory extraction, journal and growth generation cannot write to another archive', async () => {
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, useSecondaryApi: true, secondaryApi: { endpoint: 'https://memory.invalid/v1', apiKey: 'test', model: 'mock' } });
  let changeArchive = false;
  mock.method(globalThis, 'fetch', async () => {
    if (changeArchive) archiveFixture('new');
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"memories":[],"relationship":"旧关系","changes":"旧变化"}' } }] }));
  });
  for (const generate of [extractMemoryCandidates, createJournalEntry, generateGrowthNote]) {
    archiveFixture();
    changeArchive = true;
    await assert.rejects(generate('archive-char'), /存档已切换/);
    assert.deepEqual(readMemories(), []);
    assert.deepEqual(readJournalEntries(), []);
    assert.deepEqual(readGrowthNotes(), []);
    assert.equal(readJournalSettings().journalCursors['archive-char'], undefined);
  }
});

test('in-flight candidate embedding cannot restore deleted memories into a different archive', async () => {
  archiveFixture();
  mock.method(globalThis, 'fetch', async () => {
    archiveFixture('new');
    return new Response(JSON.stringify({ data: [{ embedding: [1, 0], index: 0 }] }));
  });
  await assert.rejects(addMemoryCandidates('archive-char', [{ content: '旧身份记忆', category: 'core', importance: 5, pinned: true }], 'chat', {
    ...DEFAULT_MEMORY_SETTINGS, embedding: { endpoint: 'https://embedding.invalid', apiKey: 'test', model: 'mock' },
  }), /存档已切换/);
  assert.deepEqual(readMemories(), []);
  assert.deepEqual(readEmbeddings(), {});
});

test('full input estimator includes every assembled message role and system context', () => {
  const messages = [
    { role: 'system' as const, content: '人设 世界书 记忆 挂载聊天 回复格式'.repeat(30) },
    { role: 'assistant' as const, content: '上一轮内容' },
    { role: 'system' as const, content: '表情包目录 调用规则'.repeat(20) },
    { role: 'user' as const, content: '下一次输入' },
  ];
  assert.equal(estimatePromptTokens(messages), 3 + messages.reduce((sum, message) => sum + 4 + estimateTextTokens(message.content), 0));
  for (let index = 0; index < messages.length; index += 1) {
    assert.ok(estimatePromptTokens(messages) > estimatePromptTokens(messages.filter((_, i) => i !== index)));
  }
});

test('memory preview includes core and related memories without embedding requests or recall writes', async () => {
  Object.assign(window, { setTimeout, clearTimeout });
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, embedding: { endpoint: 'https://embedding.invalid/v1', apiKey: 'test', model: 'model' } });
  const memories = [
    { id: 'core', charId: 'char', content: '核心人设', category: 'core' as const, pinned: true, importance: 5, createdAt: '2026-01-01', updatedAt: '2026-01-01', recallCount: 0, source: 'manual' as const },
    { id: 'related', charId: 'char', content: '一起看星星', category: 'event' as const, pinned: false, importance: 4, createdAt: '2026-01-01', updatedAt: '2026-01-01', recallCount: 0, source: 'manual' as const },
  ];
  writeMemories(memories);
  const before = readMemories();
  const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('Preview must not use network'); });
  const injection = await buildMemoryInjection(['char'], 'direct', '一起看星星', () => '角色', { localOnly: true });
  assert.deepEqual(injection.ids, ['core', 'related']);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(readMemories(), before);
});

test('Little P persists its own history, limits context to 100 and keeps visibility independent', () => {
  const messages: LittlePMessage[] = Array.from({ length: 125 }, (_, i) => ({ id: `${i}`, role: i % 2 ? 'assistant' : 'user', text: `消息${i}` }));
  messages[124].sticker = BUILTIN_STICKERS[0];
  writeLittlePMessages(messages);
  const history = littlePHistory(readLittlePMessages());
  assert.equal(readLittlePMessages().length, 125);
  assert.equal(history.length, 100);
  assert.equal(history[0].content, '消息25');
  assert.ok(history[99].content.includes(BUILTIN_STICKERS[0].description));
  saveSetting(LITTLE_P_VISIBLE_KEY, false);
  assert.equal(readLittlePMessages().length, 125);
  assert.deepEqual(readStoredValue(WECHAT_CHATS_STORAGE_KEY, [], Array.isArray), []);
  writeLittlePMessages([]);
  assert.deepEqual(readLittlePMessages(), []);
  assert.equal(readSetting(LITTLE_P_VISIBLE_KEY, true, (value): value is boolean => typeof value === 'boolean'), false);
  assert.deepEqual(readStoredValue(LITTLE_P_MESSAGES_KEY, [], Array.isArray), []);
});

test('Little P only accepts text and catalogue stickers, never action or payment messages', () => {
  const replies = parseLittlePReply('```json\n{"reply":[{"text":"嗨，来陪你啦！"},{"stickerId":"builtin-1"}]}\n```', BUILTIN_STICKERS);
  assert.equal(replies[0].text, '嗨，来陪你啦！');
  assert.equal(replies[1].sticker?.id, 'builtin-1');
  for (const invalid of [
    '{"reply":[]}', '{"reply":[{"stickerId":"unknown"}]}',
    '{"reply":[{"kind":"transfer","text":"转账","amount":100}]}',
    '{"reply":[{"text":"已操作","action":"clear"}]}',
    '{"reply":[{"text":"你好"}],"intimatePayAction":{"type":"grant"}}',
    '{"reply":[{"stickerId":"builtin-1"},{"stickerId":"builtin-2"}]}',
    JSON.stringify({ reply: ['{"reply":["不应直接显示元数据"]}'] }),
  ]) assert.throws(() => parseLittlePReply(invalid, BUILTIN_STICKERS), /小P|AI/);
  assert.match(littlePSystemPrompt(BUILTIN_STICKERS), /没有工具和代操作能力/);
  assert.match(littlePSystemPrompt(BUILTIN_STICKERS), /最近 100 条/);
});

test('Little P reuses built-in and imported stickers', () => {
  saveSetting(CHAT_STICKERS_STORAGE_KEY, [{ id: 'custom-1', imageUrl: 'https://example.com/sticker.png', description: '自定义' }]);
  const available = readAvailableChatStickers();
  assert.equal(available.length, BUILTIN_STICKERS.length + 1);
  assert.equal(available.at(-1)?.id, 'custom-1');
});

test('shared AI helper supports isolated Little P history on OpenAI and Gemini without changing default worldbook behavior', async () => {
  saveSetting('yyphone:world-books', [{ id: 'private-world', name: 'private', isGlobal: true, entries: [{ id: 'e', title: 'private', content: 'PRIVATE_WORLDBOOK_SENTINEL', depth: 'front' }] }]);
  const bodies: Record<string, unknown>[] = [];
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":["你好"]}' } }], candidates: [{ content: { parts: [{ text: '{"reply":["你好"]}' }] } }] }));
  });
  const history = [{ role: 'user' as const, content: '旧消息' }, { role: 'assistant' as const, content: '上次回答' }];
  for (const endpoint of ['https://test.invalid/v1', 'https://generativelanguage.googleapis.com']) {
    await requestConfiguredAiText('ONLY_LITTLE_P', '这次输入', { api: { endpoint, apiKey: 'test', model: 'mock' }, history, includeGlobalWorldBooks: false });
  }
  assert.deepEqual(bodies[0].messages, [{ role: 'system', content: 'ONLY_LITTLE_P' }, ...history, { role: 'user', content: '这次输入' }]);
  assert.deepEqual(bodies[1].contents, [
    { role: 'user', parts: [{ text: '旧消息' }] }, { role: 'model', parts: [{ text: '上次回答' }] }, { role: 'user', parts: [{ text: '这次输入' }] },
  ]);
  assert.equal(JSON.stringify(bodies).includes('PRIVATE_WORLDBOOK_SENTINEL'), false);
  await requestConfiguredAiText('DEFAULT', '默认请求', { api: { endpoint: 'https://test.invalid/v1', apiKey: 'test' } });
  assert.ok(JSON.stringify(bodies[2]).includes('PRIVATE_WORLDBOOK_SENTINEL'));
});

test('API configuration expansion defaults open and persists both collapse and expansion', () => {
  const read = () => readSetting(SETTINGS_KEYS.apiConfigExpanded, true, (value): value is boolean => typeof value === 'boolean');
  assert.equal(read(), true);
  saveSetting(SETTINGS_KEYS.apiConfigExpanded, false);
  assert.equal(read(), false);
  saveSetting(SETTINGS_KEYS.apiConfigExpanded, true);
  assert.equal(read(), true);
});

test('conversation token estimates cover Chinese, English, quotes and attachment text but not thoughts or image URLs', () => {
  assert.equal(estimateTextTokens(''), 0);
  assert.equal(estimateTextTokens('abcdefgh'), 2);
  assert.equal(estimateTextTokens('你好世界'), 6);
  assert.equal(estimateTextTokens('🙂'), 3);
  assert.equal(estimateConversationTokens([]), 0);
  const message = { id: 'tokens-1', senderId: 'char', text: '你好世界', createdAt: '' };
  assert.equal(estimateConversationTokens([message]), 10);
  assert.equal(estimateConversationTokens([{ ...message, thought: '很长的心声'.repeat(100) }]), 10);
  assert.ok(estimateConversationTokens([{ ...message, replyTo: { id: 'quote', senderName: '玩家', text: '引用测试' } }]) > 10);
  assert.ok(estimateConversationTokens([{ ...message, kind: 'forum-forward', title: '帖子标题', content: '论坛正文'.repeat(20) }]) > 10);
  const image = { ...message, kind: 'image', text: '', imageUrl: 'https://example.com/huge-image.jpg' };
  const largeImage = { ...image, imageUrl: 'data:image/png;base64,' + 'A'.repeat(10000) };
  assert.equal(estimateConversationTokens([image]), estimateConversationTokens([largeImage]));
  assert.equal(estimateConversationTokens([message, message]), 20);
});

test('manual forum handles normalize @ and override cached generated identities', () => {
  assert.equal(normalizeForumHandle(' @moonlit_cocoa '), 'moonlit_cocoa');
  assert.equal(normalizeForumHandle('月下可可'), '月下可可');
  assert.equal(normalizeForumHandle(''), '');
  for (const invalid of ['@', '@@name', 'with space', 'a', 'a'.repeat(41), 'bad/id']) {
    assert.throws(() => normalizeForumHandle(invalid), /论坛 ID/);
  }
  const contact = { id: 'forum-character' };
  assert.equal(resolveForumHandle(contact, 'cocoa_after_dark'), 'cocoa_after_dark');
  assert.equal(resolveForumHandle({ ...contact, forumHandle: '@star_collector' }, 'ignored'), 'star_collector');
  assert.equal(readGeneratedForumHandles()[contact.id], 'cocoa_after_dark');
});

test('generated forum handles persist consistently across posts and comments without changing internal IDs', () => {
  const contact = { id: 'forum-char-unique' };
  const post = parseForumPost('{"content":"角色发帖","authorHandle":"夜航的纸飞机","comments":[]}');
  assert.equal(resolveForumHandle(contact, post.authorHandle), '夜航的纸飞机');
  assert.equal(resolveForumHandle(contact, 'another_new_id'), '夜航的纸飞机');
  assert.equal(resolveForumHandle(contact, undefined), '夜航的纸飞机');
  assert.equal(contact.id, 'forum-char-unique');
  assert.throws(() => resolveForumHandle({ id: 'unset-char' }, undefined), /未生成有效/);
  assert.throws(() => resolveForumHandle({ id: 'internal-char' }, 'internal-char'), /未生成有效/);
  saveSetting('pocketos:wechat-contacts', [{ ...contact, name: '角色', forumHandle: 'custom_handle' }]);
  assert.equal(readAlipayContacts()[0].forumHandle, 'custom_handle');
});

test('AI JSON accepts fences and explanatory wrappers without exposing metadata as text', () => {
  const reply = { reply: ['第一句', { kind: 'text', text: '第二句，有括号 } 和引号 "' }], thought: '心声' };
  for (const output of [JSON.stringify(reply), `\`\`\`json\n${JSON.stringify(reply)}\n\`\`\``, `<think>推理</think>以下是结果：\n${JSON.stringify(reply)}\n结束`]) {
    assert.deepEqual(parseChatResponse(output), reply);
  }
  assert.deepEqual(parseChatResponse(JSON.stringify({ reply: JSON.stringify(['第一句', '第二句']) })).reply, ['第一句', '第二句']);
  assert.throws(() => parseChatResponse('{"reply":["未完成"'), /JSON/);
  assert.throws(() => parseChatResponse('普通文本而非约定的对象'), /JSON/);
  assert.throws(() => parseChatResponse('{"thought":"只有心声"}'), /reply/);
  assert.throws(() => parseChatResponse(JSON.stringify({ reply: ['{"thought":"泄漏元数据","reply":["第一句"]}'] })), /元数据/);
  assert.throws(() => parseChatResponse(JSON.stringify({ reply: ['你好，以下是内容：{"reply":["第一句"],"thought":"元数据"}'] })), /元数据/);
  assert.deepEqual(parseAiJson('{"reply":["<think>正文中的标记</think>"]}'), { reply: ['<think>正文中的标记</think>'] });
  assert.throws(() => parseAiJson('说明 {"reply": [坏数据]}'), /JSON/);
});

test('chat format validation rejects malformed fields but preserves existing attachment shapes', () => {
  for (const reply of [[null], [42], [' '], [{}], [{ text: 42 }], [{ kind: 'text', text: '' }]]) {
    assert.throws(() => parseChatResponse(JSON.stringify({ reply })), /消息|正文/);
  }
  assert.throws(() => parseChatResponse('{"reply":["你好"],"thought":[]}'), /thought/);
  assert.throws(() => parseChatResponse('{"reply":["你好"],"speakerId":{}}'), /speakerId/);
  const reply = [
    { kind: 'sticker', stickerId: 'builtin-1' },
    { kind: 'pat' },
    { kind: 'red-packet', amount: '1.00' },
    { kind: 'transfer', amount: '2.00' },
    { kind: 'link', title: '链接标题' },
    { kind: 'image', text: '一张文字图卡' },
    { kind: 'voice', text: '一段语音' },
  ];
  assert.deepEqual(parseChatResponse(JSON.stringify({ reply })).reply, reply);
});

test('live chat history uses JSON without changing stored messages, paper tasks or image payloads', async () => {
  paperFixture();
  await openDailyPaper(questionPaper, { now: paperDate, random: () => 0 });
  const chats = readStoredValue(WECHAT_CHATS_STORAGE_KEY, [], Array.isArray);
  chats[0].messages.push({ id: 'old-reply', senderId: 'paper-a', text: '我也想再去看海', createdAt: '2026-10-18T12:01:00Z' });
  saveSetting(WECHAT_CHATS_STORAGE_KEY, chats);
  const before = localStorage.getItem(WECHAT_CHATS_STORAGE_KEY);
  const structured = buildPrompt({ chatId: 'chat-paper-a', structuredHistory: true });
  const previous = structured.find((message) => message.role === 'assistant');
  assert.deepEqual(JSON.parse(previous?.content ?? ''), {
    speakerId: 'paper-a', reply: ['我也想再去看海'],
  });
  const plain = buildPrompt({ chatId: 'chat-paper-a' });
  assert.equal(plain.find((message) => message.role === 'assistant')?.content, '纸条角色甲：我也想再去看海');
  assert.match(structured.map((message) => message.content).join('\n'), /不是输出示例/);
  assert.equal(localStorage.getItem(WECHAT_CHATS_STORAGE_KEY), before);
});

test('speaker-prefix validation detects self labels without rewriting quoted dialogue or attachments', () => {
  const speakers = {
    defaultSpeakerId: 'a',
    namesById: { a: ['角色甲', '小甲'], b: ['角色乙'], 'npc:friend': ['朋友'] },
  };
  for (const text of ['角色甲：你好', '角色甲:你好', '【角色甲：你好】', '[小甲: 你好]',
    '  小甲 ：你好', '角色甲（ID：a）：你好', 'a：你好']) {
    for (const part of [text, { kind: 'text', text }, { kind: 'voice', text }, { content: text }]) {
      assert.throws(() => validateChatSpeakerPrefix({ reply: [part] }, speakers), /署名/);
    }
  }
  assert.throws(() => validateChatSpeakerPrefix({ speakerId: 'b', reply: ['角色乙：你好'] }, speakers), /署名/);
  assert.throws(() => validateChatSpeakerPrefix({ speakerId: 'npc:friend', reply: ['朋友：你好'] }, speakers), /署名/);
  for (const part of ['我叫角色甲', '你刚刚说“角色甲：你好”', '“角色甲：你好”', '角色乙：他说周末有空',
    '角色甲今天有空', { kind: 'narration', text: '角色甲：他停了一会' },
    { kind: 'image', text: '角色甲：照片中的标牌' }, { kind: 'link', title: '角色甲：访谈' }]) {
    const result = { speakerId: 'a', reply: [part], thought: '心声', reaction: { emoji: '🥰' } };
    assert.equal(validateChatSpeakerPrefix(result, speakers), result);
  }
});

test('self-signed chat replies use the existing single correction and never leak if correction fails', async () => {
  mock.method(console, 'warn', () => {});
  const speakers = { defaultSpeakerId: 'a', namesById: { a: ['角色甲'] } };
  const valid = { speakerId: 'a', reply: ['你好'], thought: '我有点想你', reaction: { emoji: '🥰' } };
  for (const fails of [false, true]) {
    let calls = 0;
    let correctionRequest = '';
    mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
      calls += 1;
      correctionRequest = String(init?.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(
        calls === 1 || fails ? { ...valid, reply: ['【角色甲：你好】'] } : valid
      ) } }] }));
    });
    const request = requestChatReply([{ role: 'user', content: '你好' }],
      { endpoint: 'https://chat-test.example/v1', apiKey: 'test' }, () => {}, speakers);
    if (fails) await assert.rejects(request, /自动纠正一次后仍无效/);
    else assert.deepEqual(await request, valid);
    assert.equal(calls, 2);
    assert.match(correctionRequest, /发言者署名/);
  }
});

test('chat source descriptors distinguish group membership, real identities, NPC nicknames and observers', () => {
  const names: Record<string, string> = { a: '角色甲', b: '角色乙', 'npc:friend': '朋友' };
  const group = {
    id: 'group-source', type: 'group' as const, groupTitle: '周末出游群', participantIds: ['a', 'b', 'npc:friend'],
    groupNicknames: { a: '群昵称甲', 'npc:friend': '朋友昵称', user: '玩家群昵称' },
  };
  const descriptor = describeChatSource(group, (id) => names[id], '小雨');
  assert.equal(descriptor.label, '群聊「周末出游群」');
  for (const member of ['小雨（ID：user；群昵称：玩家群昵称）', '角色甲（ID：a；群昵称：群昵称甲）',
    '角色乙（ID：b）', '朋友（ID：npc:friend；群昵称：朋友昵称）']) {
    assert.ok(descriptor.text.includes(member), member);
  }
  const observer = describeChatSource({ ...group, type: 'observer', participantIds: ['user', 'a', 'b'] }, (id) => names[id], '小雨');
  assert.equal(observer.label, '旁观群聊「周末出游群」');
  assert.match(observer.text, /玩家不在这个群里/);
  assert.doesNotMatch(observer.text, /ID：user/);
  assert.equal(describeChatSource({ ...group, groupTitle: '', noteName: '群备注' }, (id) => names[id]).title, '群备注');
  assert.equal(describeChatSource({ ...group, groupTitle: '', participantIds: ['a', 'missing'] }, (id) => names[id]).title, '角色甲、missing');
});

test('interleaved mounted group and observer messages retain sources even for notes, narration and photos', () => {
  saveSetting('pocketos:wechat-contacts', [
    { id: 'a', name: '角色甲', persona: '甲设定', worldBooks: [] },
    { id: 'b', name: '角色乙', persona: '乙设定', worldBooks: [] },
  ]);
  const msg = (id: string, senderId: string, text: string, second: number) => ({
    id, senderId, text, createdAt: `2026-10-18T10:00:${String(second).padStart(2, '0')}Z`,
  });
  const group = {
    id: 'mounted-group', type: 'group', groupTitle: '同名群', participantIds: ['a', 'b'],
    groupNicknames: { b: '小乙' }, noteName: '', context: '',
    messages: [
      msg('g1', 'b', '我周末去爬山', 1),
      { ...msg('note', 'narrator', '群里的经历记录', 4), kind: 'context-note', source: 'offline' },
      { ...msg('photo', 'user', '合照', 6), kind: 'image', imageUrl: 'data:image/png;base64,AQID' },
    ],
  };
  const observer = {
    ...group, id: 'mounted-observer', type: 'observer',
    messages: [msg('o1', 'a', '我和乙已经约好了', 2), msg('narration', 'narrator', '乙点点头', 5)],
  };
  const direct = {
    id: 'source-direct', type: 'direct', participantIds: ['a'], noteName: '', context: '',
    attachHistory: true, attachedHistoryChatIds: [group.id, observer.id],
    messages: [msg('d1', 'a', '私聊旧消息', 3), msg('d2', 'user', '刚才在说什么', 7)],
  };
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [direct, group, observer]);
  const before = localStorage.getItem(WECHAT_CHATS_STORAGE_KEY);
  for (const structuredHistory of [false, true]) {
    const prompt = buildPrompt({ chatId: direct.id, structuredHistory });
    const header = prompt.filter((item) => item.role === 'system').map((item) => item.content).join('\n');
    assert.match(header, /聊天类型：群聊；名称：同名群；聊天ID：mounted-group/);
    assert.match(header, /聊天类型：旁观群聊；名称：同名群；聊天ID：mounted-observer/);
    assert.match(header, /角色乙（ID：b；群昵称：小乙）/);
    assert.match(header, /玩家不在这个群里/);
    const history = prompt.map((item) => ({
      ...item, text: structuredHistory && item.role === 'assistant' ? JSON.parse(item.content).reply[0] : item.content,
    }));
    if (structuredHistory) {
      for (const message of prompt.filter((item) => item.role === 'assistant')) {
        const parsed = JSON.parse(message.content);
        assert.doesNotMatch(parsed.reply[0], /【挂载|【当前|^小乙（ID|^角色甲（ID/);
      }
      const mountedReply = prompt.filter((item) => item.role === 'assistant').map((item) => JSON.parse(item.content));
      assert.ok(mountedReply.some((item) => item.speakerId === 'b' &&
        item.historySource === '【挂载群聊「同名群」·记录1】' && item.reply[0] === '我周末去爬山'));
      assert.ok(mountedReply.some((item) => item.speakerId === 'a' &&
        item.historySource === '【挂载旁观群聊「同名群」·记录2】' && item.reply[0] === '我和乙已经约好了'));
    } else {
      assert.ok(history.some((item) => item.text === '【挂载群聊「同名群」·记录1】小乙（ID：b）：我周末去爬山'));
      assert.ok(history.some((item) => item.text === '【挂载旁观群聊「同名群」·记录2】角色甲（ID：a）：我和乙已经约好了'));
    }
    assert.ok(history.some((item) => item.role === 'system' && item.text.startsWith('【挂载群聊「同名群」·记录1】') && item.text.includes('群里的经历记录')));
    assert.ok(history.some((item) => item.role === 'system' && item.text === '【挂载旁观群聊「同名群」·记录2】旁白：（旁白：乙点点头）'));
    const photo = prompt.find((item) => item.images?.length);
    assert.match(photo?.content ?? '', /【挂载群聊「同名群」·记录1】/);
    assert.deepEqual(photo?.images, ['data:image/png;base64,AQID']);
    assert.equal(prompt.at(-1)?.content, '刚才在说什么');
  }
  assert.equal(localStorage.getItem(WECHAT_CHATS_STORAGE_KEY), before);
});

test('current group and observer contexts include sources without automatically mounting other conversations', () => {
  saveSetting('pocketos:wechat-contacts', [
    { id: 'a', name: '角色甲', persona: '甲设定', worldBooks: [] },
    { id: 'b', name: '角色乙', persona: '乙设定', worldBooks: [] },
  ]);
  for (const type of ['group', 'observer'] as const) {
    const chat = {
      id: 'current-source', type, participantIds: ['a', 'b'], groupTitle: '读书群', noteName: '', context: '',
      messages: [{ id: 'a1', senderId: 'b', text: '我读完了', createdAt: '2026-10-18T10:00:01Z' },
        ...(type === 'group' ? [{ id: 'u1', senderId: 'user', text: '好看吗', createdAt: '2026-10-18T10:00:02Z' }] : [])],
    };
    saveSetting(WECHAT_CHATS_STORAGE_KEY, [
      chat, { ...chat, id: 'not-mounted', messages: [{ id: 'secret', senderId: 'a', text: '不应自动挂载的内容', createdAt: '2026-10-18T10:00:00Z' }] },
    ]);
    const prompt = buildPrompt({ chatId: chat.id });
    const text = prompt.map((item) => item.content).join('\n');
    assert.match(text, /【当前聊天来源】/);
    assert.ok(text.includes(`聊天类型：${type === 'group' ? '群聊' : '旁观群聊'}；名称：读书群`));
    assert.ok(text.includes('角色乙（ID：b）'));
    assert.match(prompt.at(-1)?.content ?? '', /【当前.*读书群/);
    assert.doesNotMatch(text, /不应自动挂载的内容/);
  }
});

test('group private provenance is durable in prompts and summaries, including legacy note titles', async () => {
  const background = buildGroupPrivateContext({
    id: 'source-group', type: 'group', groupTitle: '旅行群', participantIds: ['a', 'b'],
  }, (id) => id === 'a' ? '角色甲' : '角色乙', '小雨', '问问玩家是不是累了');
  assert.match(background, /名称：旅行群；聊天ID：source-group/);
  assert.match(background, /小雨（ID：user）.*角色甲（ID：a）.*角色乙（ID：b）/);
  saveSetting('pocketos:wechat-contacts', [{ id: 'a', name: '角色甲', persona: '甲设定', worldBooks: [] }]);
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'private-source', type: 'direct', participantIds: ['a'], noteName: '', context: '',
    messages: [
      { id: 'new-note', senderId: 'narrator', kind: 'context-note', source: 'group-private', title: '群聊触发的私信',
        text: background, aiContext: background, createdAt: '2026-10-18T10:00:00Z' },
      { id: 'old-note', senderId: 'narrator', kind: 'context-note', source: 'group-private', title: '群聊触发的私信',
        text: '你因群聊「旧群名」的情境私下联系玩家：旧动机', aiContext: '这是转私聊的背景：旧动机', createdAt: '2026-10-18T10:00:01Z' },
    ],
  }]);
  const prompt = buildPrompt({ chatId: 'private-source' }).map((item) => item.content).join('\n');
  assert.match(prompt, /名称：旅行群；聊天ID：source-group/);
  assert.match(prompt, /角色乙（ID：b）/);
  assert.match(prompt, /旧群名/);
  const summaries = readDirectMessages('a');
  assert.match(summaries[0].text, /群聊转私信背景/);
  assert.match(summaries[0].text, /名称：旅行群/);
  assert.match(summaries[1].text, /旧群名/);
  assert.doesNotMatch(summaries.map((item) => item.text).join('\n'), /闲鱼对话/);
  assert.equal(readMemories().length, 0);
  assert.equal(readJournalEntries().length, 0);
  writeMemorySettings({
    ...DEFAULT_MEMORY_SETTINGS, useSecondaryApi: true,
    secondaryApi: { endpoint: 'https://memory-test.invalid/v1', apiKey: 'test', model: 'mock' },
  });
  const requests: string[] = [];
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    requests.push(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: {
      content: requests.length === 1 ? '{"memories":[]}' : '我因旅行群里的情境转到私聊关心玩家。',
    } }] }));
  });
  await extractMemoryCandidates('a');
  await createJournalEntry('a', { minMessages: 1 });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.match(request, /来源群名及相关成员/);
    assert.match(request, /名称：旅行群/);
    assert.match(request, /角色乙（ID：b）/);
    assert.match(request, /旧群名/);
  }
  assert.match(requests[1], /第三人称和真实姓名/);
  assert.match(requests[1], /关键事件、关系变化/);
  assert.match(requests[1], /2026年10月/);
});

test('offline summary segments retain every full dated event without truncating the story', () => {
  const story = {
    id: 'summary-story',
    title: '完整故事',
    characterIds: ['summary-char'],
    personaId: 'player',
    worldBookIds: [],
    presetId: '',
    wechatContextCount: 0,
    autoChoices: false,
    contextMessages: 10,
    ended: false,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    messages: [
      {
        id: 'first', role: 'user' as const, versions: ['第一件事有明确细节。'], versionIndex: 0,
        createdAt: '2026-10-21T01:02:00.000Z',
      },
      {
        id: 'long', role: 'ai' as const, versions: [`第二件事${'细节'.repeat(5000)}`], versionIndex: 0,
        createdAt: '2026-10-21T02:03:00.000Z',
      },
      {
        id: 'last', role: 'user' as const, versions: ['最后一件事也必须保留。'], versionIndex: 0,
        createdAt: '2026-10-22T03:04:00.000Z',
      },
    ],
  };
  const segments = buildOfflineSummarySegments(story, '玩家甲', ['角色乙']);
  assert.ok(segments.length > 1);
  const allText = segments.map((segment) => segment.text).join('\n');
  assert.match(allText, /2026年10月21日 \d{2}:\d{2}/);
  assert.match(allText, /2026年10月22日 \d{2}:\d{2}/);
  assert.match(allText, /第一件事有明确细节/);
  assert.match(allText, /最后一件事也必须保留/);
  assert.equal((allText.match(/第二件事/g) ?? []).length, 1);
  assert.ok(allText.includes(`第二件事${'细节'.repeat(5000)}`));
  assert.doesNotMatch(allText, /中间部分省略/);
});

test('format protocol remains last for photos, regeneration, observer chats and proactive contact', () => {
  for (const task of ['普通聊天', '重生成：不能转账', '旁观群聊：user不在群里', '定时主动联系']) {
    const source: OpenAiMessage[] = [
      { role: 'system', content: '纸条记忆与世界书' },
      { role: 'assistant', content: '{"speakerId":"c","reply":["旧消息"]}' },
      { role: 'user', content: task, images: ['data:image/png;base64,AQID'] },
    ];
    const prepared = withChatResponseFormat(source, '保留旁白、语音、表情包和可选动作；本轮恰好3条');
    assert.equal(source.at(-1)?.content, task);
    assert.match(prepared.at(-2)?.content ?? '', /本轮恰好3条/);
    assert.match(prepared.at(-2)?.content ?? '', /保留旁白、语音、表情包和可选动作/);
    assert.match(prepared.at(-1)?.content ?? '', /只返回一个 JSON 对象/);
    assert.match(prepared.at(-1)?.content ?? '', new RegExp(task));
    assert.deepEqual(prepared.at(-1)?.images, source.at(-1)?.images);
    assert.deepEqual(toOpenAiMessages(prepared).at(-1)?.content[1], {
      type: 'image_url', image_url: { url: 'data:image/png;base64,AQID', detail: 'high' },
    });
    assert.deepEqual(toGeminiContents(prepared).at(-1)?.parts[1], {
      inlineData: { mimeType: 'image/png', data: 'AQID' },
    });
  }
  assert.throws(() => withChatResponseFormat([], '规则'), /用户输入/);
});

test('both chat APIs correct format once, preserve photos and optional actions, and count both requests', async () => {
  mock.method(console, 'warn', () => {});
  const messages = withChatResponseFormat([
    { role: 'system', content: '纸条只是记忆，重生成不得转账' },
    { role: 'user', content: '看这张照片', images: ['data:image/jpeg;base64,AQID'] },
  ], '本轮一条消息，保留全部可选字段');
  const valid = { reply: ['照片拍得不错'], thought: '我记得那天', speakerId: 'paper-a',
    reaction: { emoji: '🥰' }, coupleSpaceAction: 'accept' };
  for (const endpoint of ['https://chat-test.example/v1', 'https://generativelanguage.googleapis.com']) {
    const requests: Array<{
      generationConfig?: { responseMimeType: string };
      contents?: Array<{ role: string }>;
      response_format?: { type: string };
      messages?: Array<{ role: string }>;
    }> = [];
    const usage: Array<{ input: number; output: number }> = [];
    mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      const text = requests.length === 1 ? '{"kind":"question","content":"错误地写成了纸条"}' : JSON.stringify(valid);
      return new Response(JSON.stringify(endpoint.includes('googleapis') ?
        { candidates: [{ content: { parts: [{ text }] } }] } :
        { choices: [{ message: { content: text } }] }), { status: 200 });
    });
    assert.deepEqual(await requestChatReply(messages, { endpoint, apiKey: 'test' }, (value) => usage.push(value)), valid);
    assert.equal(requests.length, 2);
    assert.equal(usage.length, 2);
    assert.equal(usage[0].input, estimatePromptTokens(messages));
    assert.equal(usage[0].output, estimateTextTokens('{"kind":"question","content":"错误地写成了纸条"}'));
    assert.ok(usage[1].input > usage[0].input * 2);
    assert.equal(usage[1].output, usage[0].output + estimateTextTokens(JSON.stringify(valid)));
    const correction = JSON.stringify(requests[1]);
    assert.match(correction, /仅纠正上一份回复的格式/);
    assert.match(correction, /尚未展示，也未执行任何动作/);
    assert.match(correction, /AQID/);
    assert.match(correction, /重生成不得转账/);
    if (endpoint.includes('googleapis')) {
      assert.equal(requests[1].generationConfig?.responseMimeType, 'application/json');
      assert.equal(requests[1].contents?.at(-1)?.role, 'user');
    } else {
      assert.equal(requests[1].response_format?.type, 'json_object');
      assert.equal(requests[1].messages?.at(-1)?.role, 'user');
    }
  }
});

test('valid chat output makes one request and never retries HTTP or network failures', async () => {
  const messages: OpenAiMessage[] = [{ role: 'user', content: '你好' }];
  const api = { endpoint: 'https://chat-test.example/v1', apiKey: 'test' };
  let calls = 0;
  let result: Response | Error = new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":["你好"]}' } }] }));
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    if (result instanceof Error) throw result;
    return result;
  });
  assert.deepEqual(await requestChatReply(messages, api, () => {}), { reply: ['你好'] });
  assert.equal(calls, 1);
  result = new Response('unavailable', { status: 503 });
  await assert.rejects(requestChatReply(messages, api, () => {}), /503/);
  assert.equal(calls, 2);
  result = new Error('network offline');
  await assert.rejects(requestChatReply(messages, api, () => {}), /network offline/);
  assert.equal(calls, 3);
});

test('format correction is bounded, never substitutes plain text, and exposes correction request failures', async () => {
  mock.method(console, 'warn', () => {});
  const messages: OpenAiMessage[] = [{ role: 'user', content: '你好' }];
  const api = { endpoint: 'https://chat-test.example/v1', apiKey: 'test' };
  for (const second of ['仍然是纯文本', '{"reply":[{}]}', '{"reply":["你好"],"thought":[]}', 'http-error']) {
    let calls = 0;
    mock.method(globalThis, 'fetch', async () => {
      calls += 1;
      if (calls === 2 && second === 'http-error') return new Response('bad gateway', { status: 502 });
      return new Response(JSON.stringify({ choices: [{ message: { content: calls === 1 ? '' : second } }] }));
    });
    await assert.rejects(requestChatReply(messages, api, () => {}),
      second === 'http-error' ? /502/ : /自动纠正一次后仍无效，未写入聊天或执行动作/);
    assert.equal(calls, 2);
  }
});

test('custom-board post output accepts an optional title and wrapped post but validates content', () => {
  const comment = { speakerType: 'passerby', speakerId: 'passerby', content: '评论内容' };
  assert.deepEqual(parseForumPost(`结果：\n\`\`\`json\n${JSON.stringify({ post: { content: '自建板块正文', comments: [comment] } })}\n\`\`\``), {
    title: '', content: '自建板块正文', comments: [comment],
  });
  assert.deepEqual(parseForumPost('{"content":"不含评论的正文"}'), { title: '', content: '不含评论的正文', comments: [] });
  assert.throws(() => parseForumPost('{"content":{},"comments":[]}'), /帖子/);
});

test('incoming money only credits on acceptance and cannot be settled twice or from legacy cards', () => {
  const before = { ...emptyAlipayData(), balance: 20 };
  const payment = { id: 'payment-1', kind: 'transfer', senderId: 'char', recipientId: 'user', amount: '88.88', paymentStatus: 'pending' as const };
  const received = settleIncomingChatPayment(before, payment, 'received');
  assert.equal(before.balance, 20);
  assert.equal(received.balance, 108.88);
  assert.equal(received.chatSettlements?.[payment.id], 'received');
  assert.throws(() => settleIncomingChatPayment(received, payment, 'received'), /已处理/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, paymentStatus: undefined }, 'received'), /历史/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, senderId: 'user' }, 'received'), /不可领取/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, amount: 'NaN' }, 'received'), /金额/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, amount: '0.001' }, 'received'), /金额/);
  const redPacket = settleIncomingChatPayment(before, { ...payment, kind: 'red-packet' }, 'received');
  assert.equal(redPacket.balance, 108.88);
});

test('returning a pending transfer changes status without adding or subtracting player funds', () => {
  const before = { ...emptyAlipayData(), balance: 33 };
  const payment = { id: 'payment-return', kind: 'transfer', senderId: 'char', recipientId: 'user', amount: '10', paymentStatus: 'pending' as const };
  const returned = settleIncomingChatPayment(before, payment, 'returned');
  assert.equal(returned.balance, 33);
  assert.equal(returned.chatSettlements?.[payment.id], 'returned');
  assert.throws(() => settleIncomingChatPayment(returned, payment, 'received'), /已处理/);
  assert.throws(() => settleIncomingChatPayment(before, { ...payment, kind: 'red-packet' }, 'returned'), /只有/);
});

test('intimate-pay requests create a pending user message rather than directly granting a card', () => {
  const contact = { id: 'request-char', name: '申请测试角色' };
  requestIntimatePay(contact, 2000, '希望买日用品');
  assert.equal(readAlipayData().intimateCards.length, 0);
  const chats = readStoredValue(WECHAT_CHATS_STORAGE_KEY, [] as Array<{ messages: Array<{ senderId: string; intimateStatus: string; amount: string }> }>, (value): value is Array<{ messages: Array<{ senderId: string; intimateStatus: string; amount: string }> }> => Array.isArray(value));
  assert.equal(chats[0].messages[0].senderId, 'user');
  assert.equal(chats[0].messages[0].intimateStatus, 'pending');
  assert.equal(chats[0].messages[0].amount, '2000.00');
  assert.throws(() => requestIntimatePay(contact, 2000, ''), /待回应/);
  assert.throws(() => requestIntimatePay(contact, -1, ''), /额度/);
});

test('character grants and limit changes preserve existing usage and unrelated finances', () => {
  const oldWindow = window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, dispatchEvent: () => true } });
  try {
    const contact = { id: 'grant-char', name: '赠予测试角色' };
    writeAlipayData({ ...emptyAlipayData(), balance: 50, chatSettlements: { earlier: 'received' } });
    grantIntimatePay(contact, 3000, '拿去用吧');
    assert.equal(readAlipayData().intimateCards[0].monthlyLimit, 3000);
    assert.equal(readAlipayData().balance, 50);
    const current = readAlipayData();
    current.intimateCards[0].usedAmount = 100;
    writeAlipayData(current);
    grantIntimatePay(contact, 5000, '额度调整');
    assert.equal(readAlipayData().intimateCards[0].usedAmount, 100);
    assert.equal(readAlipayData().intimateCards.length, 1);
    assert.equal(readAlipayData().chatSettlements?.earlier, 'received');
    assert.throws(() => grantIntimatePay(contact, Infinity, ''), /额度/);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: oldWindow });
  }
});

const post = (patch: Partial<MomentPost> = {}): MomentPost => ({
  id: 'post-1',
  authorId: 'user',
  authorName: '玩家',
  authorAvatar: '',
  authorType: 'user',
  content: '今天去看海了',
  createdAt: '2026-10-17T10:00:00.000Z',
  likes: [],
  comments: [],
  seenByCharIds: [],
  seenCommentIdsByChar: {},
  ...patch,
});
const comment = (id: string, authorId = 'other') => ({
  id, authorId, authorName: authorId, content: '海边天气真好',
  createdAt: '2026-10-17T11:00:00.000Z',
});
const inject = () => buildMomentsInjection(['char-1'], false, () => '测试角色');

test('a read moment only delivers new comments and does not rediscover the body', () => {
  saveSetting(MOMENTS_STORAGE_KEY, [post()]);
  const first = inject();
  assert.equal(first.marks[0].markBody, true);
  applyMomentsAfterChat(first, []);
  assert.equal(inject().text, '');
  saveSetting(MOMENTS_STORAGE_KEY, [post({ seenByCharIds: ['char-1'], comments: [comment('new')] })]);
  const update = inject();
  assert.equal(update.marks[0].markBody, false);
  assert.match(update.text, /你已看过原动态，本次仅评论更新/);
  assert.match(update.text, /不得说/);
  applyMomentsAfterChat(update, []);
  assert.equal(inject().text, '');
});

test('existing character comments and likes imply the original moment was read', () => {
  for (const interaction of [
    { comments: [comment('own', 'char-1'), comment('new')] },
    { likes: [{ id: 'char-1', name: '测试角色' }], comments: [comment('new')] },
  ]) {
    saveSetting(MOMENTS_STORAGE_KEY, [post(interaction)]);
    assert.equal(inject().marks[0].markBody, false);
  }
});

test('editing a moment still allows rereading its changed body', () => {
  saveSetting(MOMENTS_STORAGE_KEY, [post({
    updatedAt: '2026-10-17T12:00:00.000Z',
    comments: [comment('old', 'char-1')],
    likes: [{ id: 'char-1', name: '测试角色' }],
  })]);
  assert.equal(inject().marks[0].markBody, true);
});

test('only delivered comments become read, and observer chats get no moments', () => {
  saveSetting(MOMENTS_STORAGE_KEY, [post({
    seenByCharIds: ['char-1'],
    comments: Array.from({ length: 12 }, (_, i) => comment(`comment-${i}`)),
  })]);
  const first = inject();
  assert.equal(first.marks[0].commentIds.length, 10);
  applyMomentsAfterChat(first, []);
  assert.deepEqual(inject().marks[0].commentIds, ['comment-0', 'comment-1']);
  assert.equal(buildMomentsInjection(['char-1'], true, () => '').text, '');
});

test('blocked characters cannot read or interact with player moments, including an in-flight reply', () => {
  const previousChats = localStorage.getItem(WECHAT_CHATS_STORAGE_KEY);
  const actors: MomentActor[] = [
    { id: 'blocked-char', name: '被拉黑角色', avatarUrl: '', persona: '', type: 'char', linkedCharIds: ['blocked-char'] },
    { id: 'active-char', name: '正常角色', avatarUrl: '', persona: '', type: 'char', linkedCharIds: ['active-char'] },
    { id: 'linked-npc', name: '关联 NPC', avatarUrl: '', persona: '', type: 'npc', linkedCharIds: ['blocked-char'] },
  ];
  const direct = { id: 'blocked-moment-chat', type: 'direct', blocked: false, participantIds: ['blocked-char'], messages: [] };
  try {
    saveSetting(WECHAT_CHATS_STORAGE_KEY, [direct]);
    saveSetting(MOMENTS_STORAGE_KEY, [post()]);
    const pending = buildMomentsInjection(['blocked-char'], false, () => '被拉黑角色');
    assert.equal(pending.marks.length, 1);

    saveSetting(WECHAT_CHATS_STORAGE_KEY, [{ ...direct, blocked: true }]);
    assert.deepEqual(getInteractionCandidates(post(), actors).map((actor) => actor.id), ['active-char']);
    assert.equal(buildMomentsInjection(['blocked-char', 'active-char'], false, (id) => id).marks.some((mark) => mark.charId === 'blocked-char'), false);
    applyMomentsAfterChat(pending, [{ postId: 'post-1', charId: 'blocked-char', charName: '被拉黑角色', type: 'like' }]);
    assert.deepEqual(readMoments()[0].likes, []);
    assert.deepEqual(readMoments()[0].seenByCharIds, []);

    saveSetting(WECHAT_CHATS_STORAGE_KEY, [direct]);
    assert.equal(buildMomentsInjection(['blocked-char'], false, () => '被拉黑角色').marks.length, 1);
    assert.equal(getInteractionCandidates(post(), actors).length, 3);
  } finally {
    if (previousChats === null) localStorage.removeItem(WECHAT_CHATS_STORAGE_KEY);
    else localStorage.setItem(WECHAT_CHATS_STORAGE_KEY, previousChats);
  }
});

test('complete home appearance snapshots round-trip without profile identity fields', () => {
  const calendar = { background: 'calendar-image', disc: '', note: '日历便签' };
  const music = { background: 'music-image', disc: 'disc-image', note: '' };
  saveSetting(CALENDAR_APPEARANCE_KEY, calendar);
  saveSetting(MUSIC_APPEARANCE_KEY, music);
  const appearance = captureHomeAppearance({
    ...INITIAL_USER_PROFILE,
    avatarUrl: 'avatar-image',
    coverImageUrl: 'cover-image',
  });
  const imported: unknown = JSON.parse(JSON.stringify(appearance));
  assert.equal(isHomeAppearance(imported), true);
  assert.deepEqual(appearance.calendar, calendar);
  assert.deepEqual(appearance.music, music);
  assert.equal(appearance.profile.coverImageUrl, 'cover-image');
  assert.equal('name' in appearance.profile, false);
  assert.equal(isHomeAppearance({ ...appearance, music: { background: 1 } }), false);
  assert.equal(isHomeAppearance({ ...appearance, profile: { ...appearance.profile, avatarFrame: { enabled: true } } }), false);
});

test('forum contact data retains the bound avatar and editable nickname', () => {
  saveSetting('pocketos:wechat-contacts', [{
    id: 'char-1', name: '角色真名', avatarUrl: 'avatar-image', forumNickname: '月亮不加班',
  }]);
  assert.deepEqual(readAlipayContacts()[0], {
    id: 'char-1', name: '角色真名', avatarUrl: 'avatar-image', forumNickname: '月亮不加班',
  });
});

test('global font settings persist size and family with unchanged defaults', () => {
  assert.deepEqual(readFontSettings(), DEFAULT_FONT_SETTINGS);
  saveSetting(SETTINGS_KEYS.font, { scale: 1.3, family: 'serif' });
  assert.deepEqual(readFontSettings(), { scale: 1.3, family: 'serif' });
});

test('memory API is independent of the main API and covers journal generation', async () => {
  const urls: string[] = [];
  let content = '记忆整理结果';
  mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  writeMemorySettings({
    ...DEFAULT_MEMORY_SETTINGS,
    useSecondaryApi: true,
    secondaryApi: { endpoint: 'https://memory.example/v1', apiKey: 'test-memory-key', model: 'test-model' },
  });
  assert.equal(readMemorySettings().useSecondaryApi, true);
  assert.equal(await requestMemoryAiText('test system', 'test user'), '记忆整理结果');
  saveSetting('yyphone:wechat-chats', [{
    id: 'memory-api-chat', type: 'direct', participantIds: ['char-1'],
    messages: Array.from({ length: 10 }, (_, i) => ({
      id: `m-${i}`, senderId: 'user', text: '记住我喜欢看海',
      createdAt: `2026-10-17T10:00:${String(i).padStart(2, '0')}.000Z`,
    })),
  }]);
  content = JSON.stringify({ memories: [{ content: '玩家喜欢看海', category: 'fact', importance: 3, pinned: false }] });
  assert.equal((await extractMemoryCandidates('char-1')).candidates[0].content, '玩家喜欢看海');
  content = '记忆整理结果';
  assert.ok(await createJournalEntry('char-1'));
  assert.deepEqual(urls, [
    'https://memory.example/v1/chat/completions',
    'https://memory.example/v1/chat/completions',
    'https://memory.example/v1/chat/completions',
  ]);
});

test('forum and memory generation use applicable world books and memory candidates stay under 500 characters', async () => {
  testApi();
  saveSetting('pocketos:wechat-contacts', [{
    id: 'memory-world-char',
    name: '世界书角色',
    persona: '角色人设标记',
    worldBooks: [{ bookId: 'character-book' }],
  }]);
  saveSetting('yyphone:world-books', [
    { id: 'global-book', name: '全局设定', isGlobal: true, entries: [
      { id: 'global-entry', title: '全局条目', content: '全局世界书标记', depth: 'front' },
    ] },
    { id: 'character-book', name: '角色设定', entries: [
      { id: 'character-entry', title: '角色条目', content: '角色世界书标记', depth: 'middle' },
    ] },
    { id: 'unrelated-book', name: '无关设定', entries: [
      { id: 'unrelated-entry', title: '无关条目', content: '不应注入的私有世界书', depth: 'back' },
    ] },
  ]);
  saveSetting(SETTINGS_KEYS.personas, {
    activeProfileId: 'active-player',
    profiles: [{
      id: 'active-player', name: '玩家人设', identity: '玩家身份标记',
      personality: '玩家性格标记', background: '玩家背景标记', speakingStyle: '玩家说话风格标记',
    }],
  });
  saveSetting(WECHAT_CHATS_STORAGE_KEY, [{
    id: 'memory-world-chat', type: 'direct', participantIds: ['memory-world-char'],
    context: '双方关系补充标记：已经交往半年',
    messages: [{ id: 'memory-world-message', senderId: 'user', text: '记住我们一起看海', createdAt: '2026-10-17T10:00:00.000Z' }],
  }, {
    id: 'unrelated-context-chat', type: 'direct', participantIds: ['other-char'],
    context: '不应混入的其他角色关系补充',
    messages: [],
  }]);

  const forumPrompt = withWorldBooksForContacts('论坛生成提示', ['memory-world-char']);
  assert.match(forumPrompt, /全局世界书标记/);
  assert.match(forumPrompt, /角色世界书标记/);
  assert.doesNotMatch(forumPrompt, /不应注入的私有世界书/);
  const forumSelectedPrompt = withWorldBooksForContacts('论坛生成提示', ['memory-world-char'], ['character-book']);
  assert.doesNotMatch(forumSelectedPrompt, /全局世界书标记/);
  assert.match(forumSelectedPrompt, /角色世界书标记/);
  assert.doesNotMatch(forumSelectedPrompt, /不应注入的私有世界书/);
  const forumRelationContexts = getChatRelationContexts(['memory-world-char']);
  assert.match(forumRelationContexts.join('\n'), /双方关系补充标记：已经交往半年/);
  assert.doesNotMatch(forumRelationContexts.join('\n'), /不应混入的其他角色关系补充/);

  let requestBody = '';
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    requestBody = String(init?.body);
    return aiResponse({ memories: Array.from({ length: 8 }, (_, index) => ({
      content: `${index}${'记'.repeat(100)}`, category: 'fact', importance: 3, pinned: false,
    })) });
  });
  const result = await extractMemoryCandidates('memory-world-char');
  for (const marker of [
    '角色人设标记', '玩家身份标记', '玩家性格标记', '玩家背景标记',
    '玩家说话风格标记', '全局世界书标记', '角色世界书标记', '双方关系补充标记：已经交往半年',
  ]) assert.ok(requestBody.includes(marker), marker);
  assert.doesNotMatch(requestBody, /不应注入的私有世界书|不应混入的其他角色关系补充/);
  assert.ok(result.candidates.reduce((sum, candidate) => sum + Array.from(candidate.content).length, 0) <= 500);

  writeMemorySettings({
    ...readMemorySettings(),
    worldBookIdsByCharacter: { 'memory-world-char': ['character-book'] },
  });
  await extractMemoryCandidates('memory-world-char');
  assert.match(requestBody, /角色世界书标记/);
  assert.doesNotMatch(requestBody, /全局世界书标记|不应注入的私有世界书/);
});

test('forum break-limit prompt is prepended only when configured', () => {
  const prompt = withForumBreakLimit('论坛系统提示', '论坛专属补充词');
  assert.ok(prompt.startsWith('【论坛破限词】\n论坛专属补充词\n\n'));
  assert.equal(withForumBreakLimit('论坛系统提示', '  '), '论坛系统提示');
});

test('memory secondary API also supports Gemini without a configured main API', async () => {
  let requestedUrl = '';
  mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini 记忆' }] } }] }));
  });
  writeMemorySettings({
    ...DEFAULT_MEMORY_SETTINGS,
    useSecondaryApi: true,
    secondaryApi: {
      endpoint: 'https://generativelanguage.googleapis.com',
      apiKey: 'test-gemini-key',
      model: 'gemini-test',
    },
  });
  assert.equal(await requestMemoryAiText('system', 'user'), 'Gemini 记忆');
  assert.match(requestedUrl, /\/v1beta\/models\/gemini-test:generateContent\?key=test-gemini-key$/);
});

test('memory follows the main API when disabled and never silently falls back when enabled', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: '主 API' } }] }));
  });
  saveSetting(SETTINGS_KEYS.apiPresets, [{
    id: 'main', name: 'main', endpoint: 'https://main.example/v1', apiKey: 'test-main-key',
  }]);
  assert.equal(await requestMemoryAiText('system', 'user'), '主 API');
  writeMemorySettings({ ...DEFAULT_MEMORY_SETTINGS, useSecondaryApi: true });
  await assert.rejects(requestMemoryAiText('system', 'user'), /接口地址和密钥/);
  assert.equal(calls, 1);
});

test('all optional chat runtime features default to disabled and persist independently', () => {
  assert.deepEqual(readChatRuntimeSettings(), DEFAULT_CHAT_RUNTIME);
  saveSetting(SETTINGS_KEYS.chatRuntime, { ...DEFAULT_CHAT_RUNTIME, banners: true });
  assert.deepEqual(readChatRuntimeSettings(), { ...DEFAULT_CHAT_RUNTIME, banners: true });
});

test('proactive scheduling respects per-chat intervals, activity, blocking and opt-in', () => {
  const now = Date.parse('2026-10-18T00:00:00Z');
  const chat = {
    id: 'chat', type: 'direct', blocked: false, participantIds: ['char'],
    proactiveEnabled: true, proactiveIntervalMinutes: 5,
    updatedAt: new Date(now - 300_000).toISOString(),
  };
  assert.equal(isProactiveDue(chat, now - 1), false);
  assert.equal(isProactiveDue(chat, now), true);
  assert.equal(isProactiveDue({ ...chat, lastProactiveAt: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(isProactiveDue({ ...chat, updatedAt: new Date(now - 1000).toISOString() }, now), false);
  assert.equal(isProactiveDue({ ...chat, proactiveEnabled: false }, now), false);
  assert.equal(isProactiveDue({ ...chat, blocked: true }, now), false);
  assert.equal(isProactiveDue({ ...chat, type: 'group' }, now), false);
  assert.equal(isProactiveDue({ ...chat, updatedAt: 'invalid' }, now), false);
  assert.equal(proactiveInterval(undefined), 30);
  assert.equal(proactiveInterval(0), 1);
  assert.equal(proactiveInterval(2000), 1440);
});

test('round thoughts remain on every message after deleting the former final message or pat', () => {
  const messages = [
    { id: 'a', senderId: 'char', replyBatchId: 'round-1', thought: '' },
    { id: 'b', senderId: 'char', replyBatchId: 'round-1', thought: '' },
    { id: 'c', senderId: 'char', replyBatchId: 'round-1', thought: '这一轮的心声', kind: 'pat' },
    { id: 'd', senderId: 'other', replyBatchId: 'round-1', thought: '' },
    { id: 'e', senderId: 'char', replyBatchId: 'round-2', thought: '另一轮的心声' },
  ];
  assert.equal(getRoundThought(messages[0], messages), '这一轮的心声');
  const retained = preserveRoundThoughts(messages).filter((message) => message.id !== 'c');
  assert.equal(retained[0].thought, '这一轮的心声');
  assert.equal(retained[1].thought, '这一轮的心声');
  assert.equal(retained[2].thought, '');
  assert.equal(retained[3].thought, '另一轮的心声');
  assert.equal(messages[0].thought, '');
});

test('sticker permissions distinguish all, selected categories and none', () => {
  assert.equal(permittedSticker(undefined, { category: '萌' }), true);
  assert.equal(permittedSticker([], { category: '萌' }), false);
  assert.equal(permittedSticker(['萌'], { category: '萌' }), true);
  assert.equal(permittedSticker(['萌'], { category: '抽象' }), false);
  assert.equal(permittedSticker(['默认'], {}), true);
});

test('font URLs are normalized, persisted, and reject unsafe or non-URL values', () => {
  assert.equal(normalizeFontUrl('  https://example.com/font.woff2  '), 'https://example.com/font.woff2');
  assert.equal(normalizeFontUrl(' '), '');
  assert.throws(() => normalizeFontUrl('javascript:alert(1)'), /HTTP/);
  assert.throws(() => normalizeFontUrl('not a url'));
  const settings = { ...DEFAULT_FONT_SETTINGS, url: 'https://example.com/font.woff2' };
  saveSetting(SETTINGS_KEYS.font, settings);
  assert.deepEqual(readFontSettings(), settings);
});

test('keepalive creates one looping silent WAV and releases it on stop', async () => {
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const created: Array<{ loop: boolean; src: string; paused: boolean }> = [];
  class TestAudio {
    loop = false;
    preload = '';
    paused = true;
    ended = false;
    constructor(public src: string) { created.push(this); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  }
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: TestAudio });
  let audioBlob: Blob | undefined;
  mock.method(URL, 'createObjectURL', (blob: Blob) => { audioBlob = blob; return 'blob:test-audio'; });
  let revoked = '';
  mock.method(URL, 'revokeObjectURL', (url: string) => { revoked = url; });
  try {
    await startKeepAlive();
    await startKeepAlive();
    assert.equal(created.length, 1);
    assert.equal(created[0].loop, true);
    assert.equal(isKeepAlivePlaying(), true);
    assert.ok(audioBlob);
    const bytes = new Uint8Array(await audioBlob.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
    assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
    assert.equal(bytes.slice(44).every((value) => value === 0), true);
    stopKeepAlive();
    assert.equal(isKeepAlivePlaying(), false);
    assert.equal(created[0].src, '');
    assert.equal(revoked, 'blob:test-audio');
  } finally {
    stopKeepAlive();
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio);
    else Reflect.deleteProperty(globalThis, 'Audio');
  }
});

test('notification clicks focus an existing phone or open its scoped chat URL', async () => {
  const script = readFileSync(resolve(import.meta.dirname, '..', '..', 'public', 'notification-events.js'), 'utf8');
  for (const existing of [true, false]) {
    let handler: ((event: unknown) => void) | undefined;
    let pending: Promise<void> | undefined;
    let focused = false;
    let closed = false;
    let opened = '';
    let message: unknown;
    const client = {
      url: 'https://phone.example/YYppphh/',
      focus: async () => { focused = true; },
      postMessage: (value: unknown) => { message = value; },
    };
    runInNewContext(script, {
      URL,
      self: {
        registration: { scope: 'https://phone.example/YYppphh/' },
        addEventListener: (name: string, callback: (event: unknown) => void) => {
          assert.equal(name, 'notificationclick');
          handler = callback;
        },
        clients: {
          matchAll: async () => existing ? [client] : [],
          openWindow: async (url: string) => { opened = url; },
        },
      },
    });
    assert.ok(handler);
    handler({
      notification: { data: { chatId: 'chat-1' }, close: () => { closed = true; } },
      waitUntil: (promise: Promise<void>) => { pending = promise; },
    });
    await pending;
    assert.equal(closed, true);
    if (existing) {
      assert.equal(focused, true);
      assert.equal(JSON.stringify(message), JSON.stringify({ type: 'yyphone:open-chat', chatId: 'chat-1' }));
    } else {
      assert.equal(opened, 'https://phone.example/YYppphh/?chat=chat-1');
    }
  }
});
