import assert from 'node:assert/strict';
import { beforeEach, afterEach, mock, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { buildPrompt, toMessageContent, type PromptChatMessage, type PromptConversation } from './buildPrompt';
import { requestChatReply } from './chatReply';
import { requestConfiguredAiText } from './aiApi';
import { parseChatResponse } from './aiResponse';
import { describeForSummary, readDirectMessages } from './journalData';
import { changeChatArchive } from './chatArchives';
import { regenerationMessages } from './chatRegeneration';
import { buildSocialInstructions, parseSocialActions, type SocialContext } from './chatSocial';
import { normalizeCallReplyParts } from './callReply';
import {
  CHAT_LANGUAGES, CHINESE_OUTPUT_RULES, chatLanguageInstructions, effectiveChatLanguage,
  isChatLanguage, isChatTranslation, messageTranslation, validateChatLanguage,
  type ChatLanguageSettings,
} from './chatLanguage';

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null,
  get length() { return values.size; },
};
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, setTimeout, clearTimeout, dispatchEvent: () => true } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
const key = 'yyphone:wechat-chats';
const api = { endpoint: 'https://language.invalid/v1', apiKey: 'fixture' };
const translation = { language: 'en' as const, text: '我会陪你练习', sourceText: 'I will practice with you' };
const message: PromptChatMessage = {
  id: 'foreign', senderId: 'a', text: translation.sourceText, kind: 'text',
  chatTranslation: translation, thought: '我想让她安心开口', createdAt: '2026-11-02T10:00:00Z',
};
interface LanguageConversation extends PromptConversation, ChatLanguageSettings {
  avatars: Record<string, string>;
  updatedAt: string;
}
const chat = (): LanguageConversation => ({
  id: 'a-chat', type: 'direct', participantIds: ['a'], noteName: '', context: '',
  foreignLanguageEnabled: true, chatLanguage: 'en' as const, avatars: {}, updatedAt: message.createdAt, messages: [message],
});
const readChats = () => JSON.parse(readStorageString(key) || '[]') as ReturnType<typeof chat>[];
const respond = (data: unknown, google = false) => {
  const content = JSON.stringify(data);
  return Response.json(google ? { candidates: [{ content: { parts: [{ text: content }] } }] } : { choices: [{ message: { content } }] });
};
beforeEach(async () => {
  await clearDbStorage();
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: 'Alex', persona: '英国人，只说英语', worldBooks: [] }]);
  writeStoredValue(key, [chat(), { ...chat(), id: 'b-chat', foreignLanguageEnabled: false, messages: [] }]);
});
afterEach(() => mock.restoreAll());

test('translation renders as an ordinary themed character bubble without visible helper text or independent appearance overrides', () => {
  const source = readFileSync(resolve('src', 'apps', 'WeChatApp.tsx'), 'utf8');
  const translationBubble = source.slice(source.indexOf('{translation && translationOpen &&'), source.indexOf('{message.replyTo &&'));
  assert.match(translationBubble, /yy-chat-message-bubble yy-chat-translation is-plain is-character/);
  assert.match(translationBubble, /fontSize: `calc\(\$\{activeChat.fontSize\}px/);
  assert.match(translationBubble, /\{translation.text\}/);
  assert.doesNotMatch(translationBubble, /轻点|点击收起|<p|translation-toggle/);
  const css = readFileSync(resolve('src', 'index.css'), 'utf8');
  assert.doesNotMatch(css, /\.yy-chat-translation(?:-text|-toggle)?\s*\{/);
});

test('editing and deleting share the long-press menu; single taps never expose message actions or a pat button', () => {
  const source = readFileSync(resolve('src', 'apps', 'WeChatApp.tsx'), 'utf8');
  const menu = source.slice(source.indexOf('const richMenu ='), source.indexOf('const editor ='));
  for (const label of ['引用', '复制消息', '收藏', '编辑', '删除']) assert.match(menu, new RegExp(`>\\s*${label}\\s*</button>`));
  assert.doesNotMatch(menu, /sendPat|拍一拍/);
  assert.doesNotMatch(source, /selectedMessageId|messageActions/);
  const press = source.slice(source.indexOf('const messagePress ='), source.indexOf('const handleMessageTap ='));
  assert.match(press, /onClickCapture/);
  assert.match(press, /event.preventDefault\(\)/);
  assert.match(press, /event.stopPropagation\(\)/);
  assert.match(press, /openMessageMenu\(messageId\)/);
});

test('old conversations and disabled switches default to Chinese; language is per conversation', () => {
  assert.equal(effectiveChatLanguage({}), undefined);
  assert.equal(effectiveChatLanguage({ chatLanguage: 'en' }), undefined);
  assert.equal(effectiveChatLanguage({ foreignLanguageEnabled: false, chatLanguage: 'ja' }), undefined);
  assert.equal(effectiveChatLanguage({ foreignLanguageEnabled: true, chatLanguage: 'yue' }), 'yue');
  assert.equal(effectiveChatLanguage({ foreignLanguageEnabled: true, chatLanguage: 'zh-TW' }), 'zh-TW');
  assert.equal(effectiveChatLanguage(readChats()[1]), undefined);
  assert.equal(new Set(CHAT_LANGUAGES.map(item => item.id)).size, CHAT_LANGUAGES.length);
  for (const language of CHAT_LANGUAGES) assert(isChatLanguage(language.id));
  assert(!isChatLanguage('Chinese'));
  assert(!isChatTranslation({ ...translation, language: 'invalid' }));
  assert(!isChatTranslation({ ...translation, text: '' }));
  assert(!isChatTranslation({ ...translation, sourceText: null }));
});

test('explicit language rules limit foreign text to live chat, not thoughts or metadata', () => {
  assert.equal(chatLanguageInstructions(), CHINESE_OUTPUT_RULES);
  assert.match(chatLanguageInstructions('en'), /英语/);
  assert.match(chatLanguageInstructions('yue'), /不要把普通话仅转成繁体/);
  assert.match(chatLanguageInstructions('zh-TW'), /繁体中文/);
  for (const word of ['心声', '旁白', '记忆', '游戏', '人设', '简体中文']) assert(CHINESE_OUTPUT_RULES.includes(word));
  assert.match(chatLanguageInstructions('ja'), /朋友圈.*简体中文/);
});

test('translations survive parsing and voice normalization without entering the spoken text', () => {
  const raw = { reply: [{ type: 'audio', transcript: 'Good morning', translation: '早上好' }], thought: '我想和她打招呼' };
  const result = parseChatResponse(JSON.stringify(raw), { normalizeVoice: true });
  validateChatLanguage(result, 'en', true);
  assert.deepEqual(result.reply, [{ ...raw.reply[0], kind: 'voice', text: 'Good morning' }]);
  assert.throws(() => parseChatResponse('{"reply":[{"text":"Hi","translation":123}]}'), /translation/);
  assert.throws(() => parseChatResponse('{"reply":[{"text":"Hi","translation":""}]}'), /translation/);
});

test('missing, mispaired or non-Chinese translations and foreign thoughts fail explicitly', () => {
  for (const reply of [
    ['Hello there'],
    [{ kind: 'text', text: 'Hello there' }],
    [{ kind: 'voice', text: 'Hello there', translation: 'Good day' }],
    [{ kind: 'quote', text: 'Hello', quote: '你好' }],
    [{ kind: ' TEXT ', text: 'Hello' }],
    [{ kind: 'text', text: 'Hi '.repeat(400), translation: '你好' }],
  ]) assert.throws(() => validateChatLanguage({ reply }, 'en'), /译文|1000/);
  assert.throws(() => validateChatLanguage({ thought: 'I miss you', reply: ['❤️'] }, 'en', true), /心声不是中文/);
  assert.throws(() => validateChatLanguage({ reply: [{ speakerId: 'b', text: 'Hi', translation: '你好', thought: 'I am happy' }] }, 'en', true), /心声不是中文/);
  const valid = { thought: '我很高兴', reply: [
    { kind: 'text', text: 'Hi', translation: '你好' }, { kind: 'narration', text: '他笑了一下' },
    { kind: 'sticker', stickerId: 'one' }, '❤️', '？',
  ] };
  assert.equal(validateChatLanguage(valid, 'en', true), valid);
  assert.doesNotThrow(() => validateChatLanguage({ reply: ['普通任务无需译文'] }));
});

test('a same-response translation can be expanded after disabling mode, and stale edited text cannot reuse it', () => {
  assert.deepEqual(messageTranslation(message), translation);
  assert.deepEqual(messageTranslation({ ...message, kind: 'voice' }), translation);
  assert.equal(messageTranslation({ ...message, text: 'Edited original' }), undefined);
  assert.equal(messageTranslation({ ...message, kind: 'link' }), undefined);
  const disabled = { ...chat(), foreignLanguageEnabled: false };
  assert.equal(effectiveChatLanguage(disabled), undefined);
  assert.deepEqual(messageTranslation(disabled.messages[0]), translation);
});

test('memory and journal inputs use original speech without reinjecting display translations', () => {
  assert.equal(describeForSummary({ ...message }), translation.sourceText);
  assert.equal(readDirectMessages('a')[0].text, translation.sourceText);
  assert.equal(describeForSummary({ ...message, text: 'An edited message' }), 'An edited message');
  assert.equal(readChats()[0].messages[0].text, translation.sourceText);
  assert.equal(toMessageContent(message), translation.sourceText);
});

test('both background and structured chat prompts default to Chinese despite foreign persona or chat settings', () => {
  for (const structuredHistory of [false, true]) {
    const prompt = buildPrompt({ chatId: 'a-chat', structuredHistory, currentInput: '继续' });
    assert(prompt.some(turn => turn.role === 'system' && turn.content.includes(CHINESE_OUTPUT_RULES)));
    assert(!prompt.some(turn => turn.content.includes('【仅本轮微信正文语言】')));
    const saved = prompt.find(turn => turn.role === 'assistant')!;
    if (structuredHistory) assert.deepEqual(JSON.parse(saved.content).reply[0], { kind: 'text', text: translation.sourceText });
    else assert.match(saved.content, /I will practice with you/);
    assert(!prompt.some(turn => turn.content.includes(translation.text)));
  }
});

test('foreign structured history retains original quotes and reactions without display translation', () => {
  const all = readChats();
  all[0].messages[0] = { ...message, replyTo: { id: 'user-before', senderName: '玩家', text: '陪我练习吧' }, reactions: [{ by: 'user', emoji: '❤️' }] };
  writeStoredValue(key, all);
  const saved = buildPrompt({ chatId: 'a-chat', structuredHistory: true, currentInput: '继续' }).find(turn => turn.role === 'assistant')!;
  const part = JSON.parse(saved.content).reply[0];
  assert.equal(part.quote, '陪我练习吧');
  assert.equal(part.quoteSender, '玩家');
  assert.deepEqual(part.reactions, [{ by: 'user', emoji: '❤️' }]);
  assert.equal(part.translation, undefined);
});

test('voice and mounted histories keep original language without returning display translations to AI', () => {
  const all = readChats();
  all[0].messages = [{ ...message, kind: 'voice' }];
  all[1] = { ...all[1], attachHistory: true, attachedHistoryChatIds: ['a-chat'] };
  writeStoredValue(key, all);
  for (const structuredHistory of [false, true]) {
    const direct = buildPrompt({ chatId: 'a-chat', structuredHistory, currentInput: '继续' });
    const mounted = buildPrompt({ chatId: 'b-chat', structuredHistory, currentInput: '继续' });
    for (const prompt of [direct, mounted]) {
      const text = prompt.map(item => item.content).join('\n');
      assert(text.includes(translation.sourceText));
      assert(!text.includes(translation.text));
    }
  }
  assert.equal(readChats()[0].messages[0].chatTranslation?.text, translation.text, 'display translation remains saved');
});

test('OpenAI and Gemini foreign call voice aliases retain translations and pass standard correction retry', async () => {
  mock.method(console, 'warn', () => {});
  for (const google of [false, true]) for (const mode of ['voice', 'video'] as const) {
    let calls = 0;
    mock.method(globalThis, 'fetch', async (_: unknown, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      const instructions = google ? body.systemInstruction.parts[0].text : body.messages.filter((m: { role: string }) => m.role === 'system').map((m: { content: string }) => m.content).join('\n');
      assert.match(instructions, /语音通话和视频通话台词同样沿用所选语言/);
      assert.match(instructions, /已接通的/);
      const reply = [{ type: 'audio', transcript: 'Can you hear me?', ...(calls > 1 ? { translation: '能听见我吗？' } : {}) },
        ...(mode === 'video' ? [{ kind: 'narration', text: '他看向屏幕，轻轻挥手。' }] : [])];
      return respond({ reply, speakerId: 'a' }, google);
    });
    const result = await requestChatReply(buildPrompt({ chatId: 'a-chat', callMode: mode, currentInput: '你好' }),
      { ...api, ...(google ? { endpoint: 'https://generativelanguage.googleapis.com' } : {}) }, () => {}, undefined,
      { normalizeVoice: true, chatLanguage: 'en', chineseThoughts: true });
    assert.equal(calls, 2);
    assert(Array.isArray(result.reply));
    const paired = result.reply.map(part => ({
      text: part.text, kind: part.kind,
      ...(part.translation ? { chatTranslation: { language: 'en' as const, text: part.translation, sourceText: part.text } } : {}),
    }));
    const lines = normalizeCallReplyParts(paired, mode, 'en');
    assert.equal(lines[0].text, 'Can you hear me?');
    assert.equal(messageTranslation(lines[0])?.text, '能听见我吗？');
    assert.equal(lines.length, mode === 'video' ? 2 : 1);
  }
});

test('archive branch, switching and JSON export/import retain exact paired translations independently', async () => {
  const branchId = await changeChatArchive('a-chat', { mode: 'branch', name: '语言练习' });
  let current = readChats()[0];
  assert.equal(current.activeArchiveId, branchId);
  assert.deepEqual(current.messages[0].chatTranslation, translation);
  assert.equal(current.chatLanguage, 'en');
  current.messages[0].text = 'Changed in branch';
  writeStoredValue(key, readChats().map(item => item.id === current.id ? current : item));
  await changeChatArchive('a-chat', { mode: 'switch', targetId: 'archive-default' }, branchId);
  current = readChats()[0];
  assert.equal(current.messages[0].text, translation.sourceText);
  assert.deepEqual(messageTranslation(JSON.parse(JSON.stringify(current.messages[0]))), translation);
});

test('regeneration removes foreign messages and their translations together, not unrelated turns', () => {
  const previous = { ...message, id: 'previous', replyBatchId: 'old' };
  const next = { ...message, id: 'next', replyBatchId: 'latest' };
  assert.deepEqual(regenerationMessages([previous, next]), [previous]);
});

test('OpenAI and Gemini reply validation correct missing translations once in the same live chat protocol', async () => {
  mock.method(console, 'warn', () => {});
  for (const google of [false, true]) {
    let calls = 0;
    mock.method(globalThis, 'fetch', async (_: unknown, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      const instructions = google ? body.systemInstruction.parts[0].text : body.messages.filter((m: { role: string }) => m.role === 'system').map((m: { content: string }) => m.content).join('\n');
      assert.match(instructions, /仅本轮微信正文语言.*英语/);
      if (calls === 2) assert.match(String(init?.body), /缺少逐条/);
      return respond({ reply: [{ text: 'Hello', ...(calls === 2 ? { translation: '你好' } : {}) }], thought: '我很期待' }, google);
    });
    const result = await requestChatReply([{ role: 'user', content: '你好' }],
      { ...api, ...(google ? { endpoint: 'https://generativelanguage.googleapis.com' } : {}) }, () => {}, undefined,
      { requireThought: true, chineseThoughts: true, chatLanguage: 'en' });
    assert.equal(calls, 2);
    assert.deepEqual(result.reply, [{ text: 'Hello', translation: '你好', thought: '我很期待' }]);
  }
});

test('a twice-invalid translation is never silently replaced or accepted', async () => {
  mock.method(console, 'warn', () => {});
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls++; return respond({ reply: ['Hello'] }); });
  await assert.rejects(requestChatReply([{ role: 'user', content: '你好' }], api, () => {}, undefined, { chatLanguage: 'en' }), /纠正一次后仍无效/);
  assert.equal(calls, 2);
});

test('background games, memories and generic requests explicitly stay Chinese on OpenAI and Gemini', async () => {
  for (const google of [false, true]) {
    const preset = { ...api, ...(google ? { endpoint: 'https://generativelanguage.googleapis.com' } : {}) };
    mock.method(globalThis, 'fetch', async (_: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const system = google ? body.systemInstruction.parts[0].text : body.messages.filter((m: { role: string }) => m.role === 'system').map((m: { content: string }) => m.content).join('\n');
      assert(system.includes(CHINESE_OUTPUT_RULES));
      assert(!system.includes('【仅本轮微信正文语言】'));
      return respond({ reply: ['中文任务结果'] }, google);
    });
    await requestChatReply(buildPrompt({ chatId: 'a-chat', currentInput: '一起玩相性问答' }), preset, () => {});
    await requestConfiguredAiText('整理记忆', 'Alex: I will practice with you', { api: preset, json: true, includeGlobalWorldBooks: false });
  }
});

const socialContext = (): SocialContext => ({
  chat: { id: 'group', type: 'group', participantIds: ['a', 'b'], messages: [] },
  actors: [{ id: 'a', name: 'Alex', avatarUrl: '' }, { id: 'b', name: '小林', avatarUrl: '' }],
  regenerate: false, now: new Date(), privateChatLanguages: { a: 'en' },
});
test('group-triggered private messages obey target settings instead of inheriting group language', () => {
  const context = socialContext();
  const instructions = buildSocialInstructions(context);
  assert.match(instructions, /a：英语；b：简体中文/);
  assert.throws(() => parseSocialActions({ privateMessage: { texts: ['Hello'], reason: '私下安慰' } }, context, 'a'), /译文/);
  assert.throws(() => parseSocialActions({ privateMessage: { texts: [{ kind: 'image', text: 'Hello' }], reason: '私下安慰' } }, context, 'a'), /译文/);
  const action = parseSocialActions({
    privateMessage: { texts: [{ text: 'Hello', translation: '你好' }], reason: '私下安慰' },
  }, context, 'a').privateMessage;
  assert.deepEqual(action, { texts: ['Hello'], reason: '私下安慰', translations: [{ language: 'en', text: '你好', sourceText: 'Hello' }] });
  assert.deepEqual(parseSocialActions({ privateMessage: { texts: ['你好'], reason: '私下安慰' } }, context, 'b').privateMessage,
    { texts: ['你好'], reason: '私下安慰' });
});
