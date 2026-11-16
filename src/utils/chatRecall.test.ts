import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { writeStoredValue } from './localStorage';
import { canRecallMessage, recallContext, recallMessage, recallTimeline, parseRecallActions, characterRecallInstructions, validChatRecall, type RecallMessage } from './chatRecall';
import { buildPrompt } from './buildPrompt';
import { readDirectMessages } from './journalData';
import { generatePhoneScope } from './phoneAi';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
beforeEach(async () => { values.clear(); await clearDbStorage(); });
afterEach(() => mock.restoreAll());
const user: RecallMessage = { id: 'user-message', senderId: 'user', kind: 'text', text: 'WITHDRAWN_PRIVATE_SENTINEL', createdAt: '2026-11-12T12:00:00Z' };
const char: RecallMessage = { id: 'char-message', senderId: 'a', kind: 'text', text: 'CHAR_PRIVATE_SENTINEL', createdAt: '2026-11-12T12:01:00Z' };
function seed(messages: RecallMessage[], type = 'direct') {
  writeStoredValue('pocketos:wechat-contacts', [{ id: 'a', name: '甲', persona: '自然', worldBooks: [] }, { id: 'b', name: '乙', persona: '', worldBooks: [] }]);
  writeStoredValue('yyphone:wechat-chats', [{ id: 'chat', type, participantIds: type === 'direct' ? ['a'] : ['a', 'b'], noteName: '', context: '', blocked: false, avatars: {}, messages }]);
}
test('withdrawal makes one persisted seen decision per member, retains a private snapshot and clears public payloads', () => {
  const message = { ...user, imageUrl: 'data:image/png;base64,SECRET', thought: 'PRIVATE_THOUGHT', replyTo: { id: 'q', text: 'QUOTE' } };
  let rolls = 0;
  const recalled = recallMessage(message, ['a', 'b'], [], () => ++rolls === 1 ? .1 : .9);
  assert.equal(rolls, 2); assert.equal(recalled.kind, 'recalled'); assert.equal(recalled.text, '');
  assert.deepEqual(recalled.recall?.seenBy, ['user', 'a']);
  assert.equal(recalled.recall?.original.text, user.text); assert.ok(validChatRecall(recalled.recall));
  assert.equal(recalled.imageUrl, undefined); assert.equal(recalled.thought, undefined); assert.equal(recalled.replyTo, undefined);
  const saved = JSON.parse(JSON.stringify(recalled));
  assert.match(recallContext(saved, ['a']), /WITHDRAWN_PRIVATE_SENTINEL/);
  assert.doesNotMatch(recallContext(saved, ['b']), /WITHDRAWN_PRIVATE_SENTINEL|SECRET|PRIVATE_THOUGHT/);
  assert.doesNotMatch(recallContext(saved, ['a', 'b']), /base64/);
  assert.match(recallContext(saved, ['a', 'b']), /这些角色没有看到：b/);
});
test('already delivered messages and actual subsequent replies are seen; authors always know their own withdrawal', () => {
  assert.ok(recallMessage({ ...user, aiSeenBy: ['a'] }, ['a'], [], () => .99).recall?.seenBy.includes('a'));
  assert.ok(recallMessage(user, ['a'], [char], () => .99).recall?.seenBy.includes('a'));
  const own = recallMessage(char, ['a'], [], () => .99);
  assert.match(recallContext(own, ['a']), /CHAR_PRIVATE_SENTINEL/);
});
test('unseen withdrawn input and quoted original are absent from real chat prompts and memory extraction', () => {
  const quoted = { ...user, id: 'quote', text: '稍后聊', replyTo: { id: user.id, text: user.text, senderName: '玩家' } };
  const messages = recallTimeline([user, quoted], new Set([user.id]), ['a'], () => .99);
  assert.equal((messages[1] as typeof quoted).replyTo.text, '[原消息已撤回]');
  seed(messages);
  assert.doesNotMatch(JSON.stringify(buildPrompt({ chatId: 'chat', timeAwarenessEnabled: false })), /WITHDRAWN_PRIVATE_SENTINEL/);
  assert.doesNotMatch(JSON.stringify(readDirectMessages('a')), /WITHDRAWN_PRIVATE_SENTINEL/);
  seed([recallMessage(user, ['a'], [], () => .99)]);
  const last = buildPrompt({ chatId: 'chat', currentInput: '', timeAwarenessEnabled: false }).at(-1)!.content;
  assert.match(last, /撤回了一条消息/); assert.doesNotMatch(last, /WITHDRAWN_PRIVATE_SENTINEL/);
  seed([recallMessage(user, ['a'], [], () => .1)]);
  assert.match(JSON.stringify(buildPrompt({ chatId: 'chat', currentInput: '' })), /WITHDRAWN_PRIVATE_SENTINEL/);
  assert.match(JSON.stringify(readDirectMessages('a')), /WITHDRAWN_PRIVATE_SENTINEL/);
});
test('character actions honor the switch, authorship and a bounded list; finance or state-changing cards cannot be recalled', () => {
  for (const kind of ['transfer', 'red-packet', 'couple-invite', 'order', 'context-note', 'intimate-pay']) assert.equal(canRecallMessage({ ...user, kind }), false);
  assert.deepEqual(parseRecallActions([{ messageId: char.id, speakerId: 'a' }], [char], true, ['a']), [char.id]);
  assert.deepEqual(parseRecallActions([], [char], false, ['a']), []);
  assert.throws(() => parseRecallActions([{ messageId: char.id, speakerId: 'a' }], [char], false, ['a']));
  assert.throws(() => parseRecallActions([{ messageId: user.id, speakerId: 'a' }], [user], true, ['a']));
  assert.throws(() => parseRecallActions([{ messageId: char.id, speakerId: 'b' }], [char], true, ['a', 'b']));
  const recalled = recallMessage(char, ['a']);
  assert.throws(() => parseRecallActions([{ messageId: char.id, speakerId: 'a' }], [recalled], true, ['a']));
  assert.match(characterRecallInstructions([char], true, ['a']), /recall:true/);
  assert.doesNotMatch(characterRecallInstructions([char], false, ['a']), /CHAR_PRIVATE_SENTINEL/);
});

test('proactive contact never promotes an empty recalled message to current input, but preserves seen history and its recall time', () => {
  const recalled = recallMessage(user, ['a'], [], () => .1);
  recalled.recall!.at = '2026-11-12T12:03:00Z';
  seed([recalled, char]);
  const prompt = buildPrompt({ chatId: 'chat', currentInput: '', proactive: true, timeAwarenessEnabled: true });
  assert.equal(prompt.filter(p => p.tokenCategory === 'currentInput').length, 1);
  assert.doesNotMatch(prompt.at(-1)!.content, /WITHDRAWN_PRIVATE_SENTINEL|可知原内容/);
  assert.match(prompt.at(-1)!.content, /本轮玩家没有发来新消息/);
  assert.match(prompt.at(-1)!.content, /这同样约束 thought/);
  const recallHistory = prompt.filter(p => p.tokenCategory === 'history' && p.content.includes('WITHDRAWN_PRIVATE_SENTINEL'));
  assert.equal(recallHistory.length, 1); assert.match(recallHistory[0].content, /撤回发生时间/);
  assert.match(JSON.stringify(prompt), /上次聊天间隔/);
  seed([recallMessage(user, ['a'], [], () => .99)]);
  assert.doesNotMatch(JSON.stringify(buildPrompt({ chatId: 'chat', currentInput: '', proactive: true })), /WITHDRAWN_PRIVATE_SENTINEL/);
});

test('unseen recall is only a notice; seen recall contains the text without instructions to question the user', () => {
  const unseen = recallMessage(user, ['a'], [], () => .99);
  assert.equal(recallContext(unseen, ['a']), '[玩家撤回了一条消息]');
  const seen = recallMessage(user, ['a'], [], () => .1);
  assert.equal(recallContext(seen, ['a']), '[玩家撤回了一条消息] 你看到了，内容为："WITHDRAWN_PRIVATE_SENTINEL"');
  assert.doesNotMatch(recallContext(seen, ['a']), /可以自然询问|追问|每轮|不能猜中/);
});

test('diary history-only context retains recalled messages once in history without replaying a current input', () => {
  const seen = recallMessage(user, ['a'], [], () => .1);
  seen.recall!.at = '2026-11-12T12:03:00Z'; seed([seen, char]);
  const prompt = buildPrompt({chatId:'chat', historyOnly:true});
  assert.equal(prompt.filter(p=>p.tokenCategory==='currentInput').length,0);
  const recalls = prompt.filter(p=>p.content.includes('WITHDRAWN_PRIVATE_SENTINEL'));
  assert.equal(recalls.length,1);assert.equal(recalls[0].tokenCategory,'history');assert.match(recalls[0].content,/撤回发生时间/);
  seed([recallMessage(user,['a'],[],()=>.99),char]);
  const hidden = buildPrompt({chatId:'chat', historyOnly:true});assert.doesNotMatch(JSON.stringify(hidden),/WITHDRAWN_PRIVATE_SENTINEL/);
});

test('actual icity requests keep recalls in dated background, never in the current user task', async () => {
  writeStoredValue('yyphone:api-presets', [{ id:'test',name:'test',endpoint:'https://test.invalid/v1',apiKey:'test',model:'test' }]);
  const requests: Array<{messages:Array<{role:string;content:string}>}> = [];
  mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({choices:[{message:{content:JSON.stringify({diaries:[{dateStr:'11月17日',timeStr:'19:00',weather:'未记录',mood:'平静',content:'今天把手边的事情做完，才想起昨晚的聊天。'}]})}}]});
  });
  for (const seen of [true,false]) {
    const recalled=recallMessage(user,['a'],[],()=>seen ? .1 : .99);recalled.recall!.at='2026-11-12T12:03:00Z';seed([recalled,char]);
    await generatePhoneScope('icity',{charId:'a',charName:'甲',userName:'玩家',npcs:[]},{charId:'a',wallpaperUrl:'',userRemark:'',npcThreads:[],photos:[],browserHistory:[],notes:[],icityDiaries:[],agentSession:{doubaoTopic:'',doubaoTurns:[],claudeTopic:'',claudeTurns:[]}});
    const messages=requests.at(-1)!.messages;
    assert(messages.every(m=>m.role!=='user'||!m.content.includes('WITHDRAWN_PRIVATE_SENTINEL')));
    const background=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
    assert.equal(background.split('WITHDRAWN_PRIVATE_SENTINEL').length-1,seen?1:0);
    assert.match(background,/撤回发生时间/);
  }
  assert.equal(requests.length,2);
});

test('proactive time gap ignores recent system notes; disabling time awareness omits the gap and recall timestamps', () => {
  const now = Date.now();
  seed([{ ...char, createdAt: new Date(now - 2*3600000).toISOString() },
    { ...char, id: 'note', senderId: 'narrator', kind: 'context-note', text: '系统背景', createdAt: new Date(now).toISOString() }]);
  const prompt = buildPrompt({ chatId: 'chat', proactive: true });
  assert.match(prompt.find(p => p.content.includes('【上次聊天间隔】'))!.content, /距现在2 小时/);
  const recalled = recallMessage(user, ['a'], [], () => .1); seed([recalled]);
  const withoutTime = buildPrompt({ chatId: 'chat', proactive: true, timeAwarenessEnabled: false });
  assert.doesNotMatch(JSON.stringify(withoutTime), /【当前时间】|【上次聊天间隔】|【撤回发生时间】/);
  assert.match(withoutTime.at(-1)!.content, /本对话关闭了时间感知/);
  assert.match(withoutTime.at(-1)!.content, /没有可见的玩家日程就承认不知道/);
});

test('proactive contact inherits role schedules and only authorized user calendar entries', () => {
  seed([char]); const now = new Date(), date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const calendar = { entries: [{id:'plan',kind:'schedule',date,title:'USER_CALENDAR_SENTINEL'}], visibleCharacterIds:['a'], scheduleCharacterIds:['a'], schedules:[{id:'a-plan',charId:'a',date,text:'OWN_SCHEDULE_SENTINEL'},{id:'b-plan',charId:'b',date,text:'OTHER_SCHEDULE_SECRET'}] };
  writeStoredValue('yyphone:calendar-data',calendar);
  const prompt = JSON.stringify(buildPrompt({chatId:'chat',proactive:true}));
  assert.match(prompt,/USER_CALENDAR_SENTINEL/);assert.match(prompt,/OWN_SCHEDULE_SENTINEL/);assert.doesNotMatch(prompt,/OTHER_SCHEDULE_SECRET/);
  writeStoredValue('yyphone:calendar-data',{...calendar,visibleCharacterIds:[]});
  const privateCalendar = JSON.stringify(buildPrompt({chatId:'chat',proactive:true}));
  assert.doesNotMatch(privateCalendar,/USER_CALENDAR_SENTINEL/);assert.match(privateCalendar,/OWN_SCHEDULE_SENTINEL/);
});
