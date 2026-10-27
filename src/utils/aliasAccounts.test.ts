import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { SETTINGS_KEYS } from './settings';
import { activeMemoryArchive, invalidateMemoryArchive } from './memoryArchives';
import { buildPrompt } from './buildPrompt';
import { deleteWeChatContact } from './deleteWeChatContact';
import { ALIAS_ACCOUNTS_KEY, ALIAS_MEMORY_RULES, acknowledgeAliasFollowup, aliasPeer, aliasRoundThought, buildAliasMemoryContext, currentAliasUser, deleteAliasMessage, deleteUserAlias, editAliasMessage, emptyAliasState, pendingAliasFollowup, readAliasState, respondAliasRequest, revealUserAlias, saveUserAlias, sendAliasMessage, setAliasSwitcherHidden, updateAliasThread, visibleAliasThreads, writeAliasState } from './aliasAccounts';
import { applyWithAlias, buildAliasPrompt, generateAliasReply, generateCharacterAliasRequest, processCharacterAliases, validatedAliasIdentityEvidence } from './aliasAi';
import { extractMemoryCandidates, requestMemoryAiText } from './memoryAi';
import { readDirectMessages } from './journalData';

const values = new Map<string, string>(), events = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout, dispatchEvent: events.dispatchEvent.bind(events), localStorage: {
  getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => values.set(k,v), removeItem: (k: string) => values.delete(k), clear: () => values.clear(), key: (i: number) => [...values.keys()][i] ?? null, get length() { return values.size; },
} } });
const json = (content: any) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(Array.isArray(content?.reply) && !Object.hasOwn(content, 'thought') ? { ...content, thought: '我想先听听这个人要说什么，不急着下结论。' } : content) } }] }), { headers: { 'Content-Type': 'application/json' } });
const read = (key: string) => JSON.parse(readStorageString(key) || 'null');
beforeEach(async () => {
  await clearDbStorage();
  await setStorageItemsAtomically({
    [SETTINGS_KEYS.apiPresets]: [{ id: 'api', name: 'API', endpoint: 'https://ai.invalid/v1', apiKey: 'secret', model: 'test' }], [SETTINGS_KEYS.activeApiPreset]: 'api',
    [SETTINGS_KEYS.personas]: { activeProfileId: 'owner-private-id', profiles: [{ id: 'owner-private-id', name: '身份预设', nickname: '小雨', realName: '林小雨', wechatId: 'rain_main', avatarUrl: '', description: 'OWNER_ONLY_PRIVATE_PERSONA', intro: 'OWNER_ONLY_PRIVATE_PERSONA' }] },
    'pocketos:wechat-contacts': [{ id: 'character-private-id', name: '林渡', avatarUrl: '', persona: '谨慎又嘴硬 习惯先问来意', worldBooks: [{ bookId: 'bound' }] }, { id: 'other-char', name: '时予', persona: '爽朗', worldBooks: [] }],
    'yyphone:world-books': [{ id: 'bound', name: '角色世界', entries: [{ id: 'b', title: '背景', content: 'BOUND_WORLD_DETAIL', depth: 'front' }] }, { id: 'global', name: '全局', isGlobal: true, entries: [{ id: 'g', title: '规则', content: 'GLOBAL_WORLD_DETAIL', depth: 'front' }] }, { id: 'unrelated', name: '无关', entries: [{ id: 'u', title: '无关', content: 'UNRELATED_WORLD_SECRET', depth: 'front' }] }],
    'yyphone:wechat-chats': [{ id: 'main-chat', type: 'direct', participantIds: ['character-private-id'], activeArchiveId: 'one', noteName: '', context: '', blocked: true, avatars: {}, updatedAt: new Date().toISOString(), messages: [{ id: 'main-msg', senderId: 'user', text: '我们今天吵架了 我想先静一静', createdAt: new Date().toISOString() }] }],
    [ALIAS_ACCOUNTS_KEY]: emptyAliasState(),
  });
});
afterEach(() => mock.restoreAll());
const profile = () => saveUserAlias({ name: '晚风', handle: 'night_wind', avatarUrl: '', bio: '只是路过 看看风景' });
const accept = async () => {
  const p = profile(); mock.method(globalThis,'fetch',async () => json({ accept: true, reply: '你好 哪位' }));
  const id = await applyWithAlias(p.id, 'character-private-id', '想认识一下你'); return { p, id };
};

test('user alias applications use public identity and character life context without leaking ownership or restoring the blocked main chat', async () => {
  const p = profile(); let body = '';
  mock.method(globalThis,'fetch',async (_url: unknown, init?: RequestInit) => { body = String(init?.body); return json({ accept: true, reply: '有什么事吗' }); });
  const id = await applyWithAlias(p.id,'character-private-id','认识一下');
  const t = readAliasState().threads.find(t => t.id === id)!;
  assert.equal(t.status,'accepted'); assert.equal(t.identity,'unknown'); assert.equal(read('yyphone:wechat-chats')[0].blocked,true);
  assert.match(body,/晚风/); assert.match(body,/BOUND_WORLD_DETAIL/); assert.match(body,/GLOBAL_WORLD_DETAIL/); assert.match(body,/今天吵架了/);
  for (const secret of [p.id, 'owner-private-id', 'character-private-id', 'OWNER_ONLY_PRIVATE_PERSONA', 'UNRELATED_WORLD_SECRET']) assert(!body.includes(secret),secret);
  assert.equal(await applyWithAlias(p.id,'character-private-id','又申请'),id); assert.equal(readAliasState().threads.length,1);
});

test('characters may reject an unfamiliar account; a failed API request leaves a retryable application rather than granting friendship', async () => {
  const p = profile(); mock.method(globalThis,'fetch',async () => json({ accept: false, reply: '抱歉 我不加陌生人' }));
  const id = await applyWithAlias(p.id,'character-private-id','你好'); assert.equal(readAliasState().threads[0].status,'rejected');
  await assert.rejects(generateAliasReply(id),/当前不能/); assert.throws(() => sendAliasMessage(id,'你好'),/好友验证/);
  mock.restoreAll(); mock.method(globalThis,'fetch',async () => new Response('',{status:500}));
  await assert.rejects(applyWithAlias(p.id,'character-private-id','请问可以加吗'));
  assert.equal(readAliasState().threads.length,1); assert.equal(readAliasState().threads[0].status,'pending');
  mock.restoreAll(); mock.method(globalThis,'fetch',async () => json({ accept: true, reply: '说说来意' }));
  await applyWithAlias(p.id,'character-private-id','请问可以加吗'); assert.equal(readAliasState().threads[0].status,'accepted');
});

test('suspicion does not reveal a user alias; disclosure changes attribution prospectively while conversations retain their original messages', async () => {
  const chats = read('yyphone:wechat-chats'); chats[0].messages.push({ id:'private-event', senderId:'user', text:'记得青杉码头给卖花奶奶撑的那把红伞吗', createdAt:new Date().toISOString() }); writeStoredValue('yyphone:wechat-chats',chats);
  const {id} = await accept(); sendAliasMessage(id,'青杉码头给卖花奶奶撑的那把红伞 你还留着吗');
  const message = readAliasState().threads[0].messages.at(-1)!;
  mock.restoreAll(); mock.method(globalThis,'fetch',async () => json({ reply: ['你怎么知道这件事','你到底是谁'], identityEvidence: [{ messageId:message.id,quote:'青杉码头给卖花奶奶撑的那把红伞',referenceQuote:'青杉码头给卖花奶奶撑的那把红伞',kind:'shared-memory' }], revealSelf: true }));
  await generateAliasReply(id); let t = readAliasState().threads[0]; assert.equal(t.identity,'suspected');
  const before = buildAliasMemoryContext(['character-private-id']); assert.match(before,/没有确证/); assert(!before.includes('已明确坦白'));
  const primary = buildPrompt({ chatId: 'main-chat',timeAwarenessEnabled:false }).map(m => m.content).join('\n'); assert.match(primary,/陌生账号不能归到主号玩家身上/);
  const earlier = t.messages.slice(); revealUserAlias(id); t = readAliasState().threads[0]; assert.equal(t.identity,'revealed'); assert.deepEqual(t.messages.slice(0,earlier.length),earlier); assert.match(t.messages.at(-1)!.text,/我是小雨/);
  assert.match(buildAliasMemoryContext(['character-private-id']),/已明确坦白自己是小雨的小号/);
  assert.match(buildAliasPrompt(t),/不能改写当时的认知/);
});

test('character alias requests expose only the invented profile, require acceptance, and can reveal their own identity naturally', async () => {
  mock.method(globalThis,'fetch',async () => json({ decision:'request', profile:{ name:'路过的旅人',handle:'passer_by',bio:'偶尔看看天气' },message:'你好 方便聊聊吗' }));
  const id = await generateCharacterAliasRequest('character-private-id'); let state=readAliasState(),t=state.threads[0];
  assert.equal(t.status,'pending'); assert.equal(aliasPeer(t,state)?.name,'路过的旅人'); assert(!JSON.stringify(aliasPeer(t,state)).includes('林渡'));
  assert.throws(() => sendAliasMessage(id,'你好'),/好友验证/); respondAliasRequest(id,true); assert.throws(() => respondAliasRequest(id,true),/处理过/);
  sendAliasMessage(id,'你是谁'); mock.restoreAll(); mock.method(globalThis,'fetch',async () => json({ reply:['是我 林渡','我只是想再跟你说句话'],revealSelf:true }));
  await generateAliasReply(id); t=readAliasState().threads[0]; assert.equal(t.identity,'revealed'); assert.match(t.messages.at(-1)!.text,/林渡/); assert.equal(read('yyphone:wechat-chats')[0].blocked,true);
  assert.match(buildAliasMemoryContext(['character-private-id']),/自己使用账号/);
});

test('archive and user persona isolation apply both to alias windows and the main-chat memory projection', async () => {
  const {id}=await accept(); sendAliasMessage(id,'ARCHIVE_ONE_ONLY'); assert.equal(visibleAliasThreads().length,1);
  const chats=read('yyphone:wechat-chats'); chats[0].activeArchiveId='two'; writeStoredValue('yyphone:wechat-chats',chats);
  assert.equal(visibleAliasThreads().length,0); assert.equal(buildAliasMemoryContext(['character-private-id']),''); assert.throws(() => sendAliasMessage(id,'串档'),/存档已经变化/);
  chats[0].activeArchiveId='one';writeStoredValue('yyphone:wechat-chats',chats); assert.equal(visibleAliasThreads().length,1);
  const personas=read(SETTINGS_KEYS.personas); personas.profiles.push({id:'other-player',nickname:'另一个人'});personas.activeProfileId='other-player';writeStoredValue(SETTINGS_KEYS.personas,personas);
  assert.equal(currentAliasUser().name,'另一个人');assert.equal(visibleAliasThreads().length,0);assert.equal(buildAliasMemoryContext(['character-private-id']),'');
});

test('blocking or deleting an alias during generation cannot write a stale response or affect the main friendship', async () => {
  const {id,p}=await accept();sendAliasMessage(id,'hello'); let finish!:()=>void;
  mock.restoreAll();mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{finish=()=>resolve(json({reply:['LATE_REPLY']}));}));
  const pending=generateAliasReply(id); updateAliasThread(id,t=>({...t,blocked:true}));finish();await assert.rejects(pending,/已经变化/);
  assert(!readAliasState().threads[0].messages.some(m=>m.text==='LATE_REPLY'));assert.equal(read('yyphone:wechat-chats')[0].blocked,true);
  updateAliasThread(id,t=>({...t,blocked:false})); const pending2=generateAliasReply(id);deleteUserAlias(p.id);finish();await assert.rejects(pending2,/已经变化/);assert.equal(readAliasState().threads.length,0);
});

test('switching archives away and back still invalidates an in-flight reply', async () => {
  const {id}=await accept();let finish!:()=>void;
  mock.restoreAll();mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{finish=()=>resolve(json({reply:['旧请求']}));}));
  const pending=generateAliasReply(id);invalidateMemoryArchive('character-private-id');finish();await assert.rejects(pending,/存档/);assert.equal(readAliasState().threads[0].messages.length,0);
});

test('deleting a character atomically removes its aliases and requests, preserving user accounts and unrelated characters', async () => {
  const {p,id}=await accept();sendAliasMessage(id,'hello');await deleteWeChatContact('character-private-id');
  assert.equal(readAliasState().threads.length,0);assert(readAliasState().profiles.some(a=>a.id===p.id));assert.equal(read('pocketos:wechat-contacts')[0].id,'other-char');
  assert.equal(activeMemoryArchive('other-char'),JSON.stringify(['other-char','archive-default']));
});

test('automatic contact is opt-in, globally throttled and never creates repeated pending invitations', async () => {
  let calls=0;mock.method(globalThis,'fetch',async()=>{calls++;return json({decision:'request',profile:{name:'陌生旅人',handle:'visitor_01',bio:''},message:'想聊聊天'});});
  await processCharacterAliases();assert.equal(calls,0);
  writeAliasState({...readAliasState(),autoEnabled:true});await processCharacterAliases();assert.equal(calls,1);assert.equal(readAliasState().threads.length,1);
  await processCharacterAliases();await generateCharacterAliasRequest('character-private-id');assert.equal(calls,1);
  respondAliasRequest(readAliasState().threads[0].id,false);await processCharacterAliases();assert.equal(calls,1);
});

test('account validation and persistence protect existing aliases from collisions and malformed edits',()=>{
  const p=profile();assert.equal(readAliasState().profiles[0].id,p.id);
  assert.throws(()=>saveUserAlias({name:'另一个',handle:'NIGHT_WIND',avatarUrl:'',bio:''}),/已经被使用/);
  assert.throws(()=>saveUserAlias({name:'',handle:'xx',avatarUrl:'',bio:''}),/请填写昵称/);
  saveUserAlias({name:'新昵称',handle:'new_name',avatarUrl:'',bio:'新的公开介绍'},p.id);assert.equal(readAliasState().profiles.length,1);assert.equal(readAliasState().profiles[0].name,'新昵称');
});

test('explicit self-disclosure in text reveals identity, while a question or an introduction as a friend does not',async()=>{
  const {id}=await accept();sendAliasMessage(id,'你觉得我是小雨吗');assert.equal(readAliasState().threads[0].identity,'unknown');
  sendAliasMessage(id,'我是小雨的朋友');assert.equal(readAliasState().threads[0].identity,'unknown');
  sendAliasMessage(id,'其实 我是小雨 这是我的小号');assert.equal(readAliasState().threads[0].identity,'revealed');
});

test('deleting a character while its alias is being invented cannot resurrect profiles, requests or scheduling state',async()=>{
  let finish!:()=>void;
  mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{finish=()=>resolve(json({decision:'request',profile:{name:'一个路人',handle:'visitor_02',bio:''},message:'你好'}));}));
  const pending=generateCharacterAliasRequest('character-private-id');await deleteWeChatContact('character-private-id');finish();await assert.rejects(pending,/变化|存档/);
  assert.equal(readAliasState().threads.length,0);assert.equal(readAliasState().profiles.length,0);assert.equal(Object.keys(readAliasState().checks).length,0);
});

test('hiding and reopening the account switcher persists without deleting accounts, friendship or messages',async()=>{
  const {id,p}=await accept();sendAliasMessage(id,'你好');const thread=readAliasState().threads[0];
  setAliasSwitcherHidden(true);assert.equal(readAliasState().switcherHidden,true);assert.deepEqual(readAliasState().threads[0],thread);assert.equal(readAliasState().profiles[0].id,p.id);
  updateAliasThread(id,t=>({...t,blocked:true}));assert.equal(readAliasState().switcherHidden,true);
  setAliasSwitcherHidden(false);assert.equal(readAliasState().switcherHidden,false);assert.equal(readAliasState().threads[0].messages.length,1);
});

test('ordinary words, fabricated quotes and another speaker cannot justify an identity hunch',async()=>{
  const {id}=await accept();sendAliasMessage(id,'你好 今天心情怎么样');const t=readAliasState().threads[0],message=t.messages[0];
  const evidence=(quote:string,referenceQuote=quote,messageId=message.id)=>[{messageId,quote,referenceQuote,kind:'shared-memory'}];
  assert.deepEqual(validatedAliasIdentityEvidence(t,evidence('你好')),[]);
  assert.deepEqual(validatedAliasIdentityEvidence(t,evidence('我知道你们那晚一起看了北极光')),[]);
  assert.deepEqual(validatedAliasIdentityEvidence(t,evidence(message.text,'主号里根本没说过的话')),[]);
  let calls=0;mock.restoreAll();mock.method(globalThis,'fetch',async()=>{calls++;return json({reply:['你好 有什么事吗'],suspectsIdentity:true});});
  await generateAliasReply(id);assert.equal(calls,1);assert.equal(readAliasState().threads[0].identity,'unknown');
});

test('a distinctive established phrase can justify suspicion while one ordinary matching greeting cannot',async()=>{
  const chats=read('yyphone:wechat-chats');for(let i=0;i<3;i++)chats[0].messages.push({id:`phrase-${i}`,senderId:'user',text:'好啦 小蘑菇要收伞啦',createdAt:new Date().toISOString()});writeStoredValue('yyphone:wechat-chats',chats);
  const {id}=await accept();sendAliasMessage(id,'小蘑菇要收伞啦');const t=readAliasState().threads[0];
  const candidate={messageId:t.messages[0].id,quote:'小蘑菇要收伞啦',referenceQuote:'小蘑菇要收伞啦',kind:'signature-phrase'};
  assert.equal(validatedAliasIdentityEvidence(t,[candidate]).length,1);
  assert.deepEqual(validatedAliasIdentityEvidence(t,[{...candidate,messageId:'fabricated-id'}]),[]);
});

test('unsupported identity guesses are corrected once, and repeated unsupported guesses never enter stored chat',async()=>{
  const {id}=await accept();sendAliasMessage(id,'你好');let calls=0;
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>json({reply:++calls===1?['你就是小雨吧']:['你好 找我有什么事吗'],identityEvidence:[]}));
  await generateAliasReply(id);assert.equal(calls,2);assert.equal(readAliasState().threads[0].identity,'unknown');assert(!readAliasState().threads[0].messages.some(m=>m.text.includes('你就是小雨')));
  const before=readAliasState().threads[0].messages;calls=0;mock.restoreAll();mock.method(globalThis,'fetch',async()=>{calls++;return json({reply:['小雨 别装了'],identityEvidence:[]});});
  await assert.rejects(generateAliasReply(id),/缺少明确的身份线索/);assert.equal(calls,2);assert.deepEqual(readAliasState().threads[0].messages,before);
});

test('account attribution and identity at the time survive later disclosure, including character-owned disguises',async()=>{
  const {id}=await accept();sendAliasMessage(id,'我喜欢听雨声');revealUserAlias(id);const t=readAliasState().threads[0];
  assert.equal(t.messages[0].identityAtTime,'unknown');assert.equal(t.messages[1].identityAtTime,'revealed');
  let context=buildAliasMemoryContext(['character-private-id']);assert.match(context,/账号「晚风」：我喜欢听雨声/);assert.match(context,/当时身份未确认/);assert.match(context,/此时身份已公开/);
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>json({decision:'request',profile:{name:'岸边',handle:'river_01',bio:''},message:'想认识一下'}));
  const charId=await generateCharacterAliasRequest('character-private-id');respondAliasRequest(charId,true);sendAliasMessage(charId,'今天过得怎么样');
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>json({reply:['还好 只是有点想聊天'],revealSelf:false}));await generateAliasReply(charId);
  context=buildAliasMemoryContext(['character-private-id']);assert.match(context,/来源：角色小号「岸边」↔ 玩家主号「小雨」/);assert.match(context,/角色小号「岸边」：还好/);assert(!readDirectMessages('character-private-id',{fullText:true}).some(m=>m.text.includes('还好 只是有点想聊天')));
});

test('a real stranger application may be remembered on the main account without fabricating a subsequent conversation',async()=>{
  await accept();const context=buildAliasMemoryContext(['character-private-id']);assert.match(context,/想认识一下你/);assert.match(context,/陌生账号「晚风」/);assert.match(context,/好友验证：已通过/);
  assert(!context.includes('已明确坦白'));assert(!/\[\d{4}-[^\n]+账号「晚风」：/.test(context));
});

test('memory extraction and all memory API tasks retain account provenance rules while main transcripts exclude alias raw messages',async()=>{
  const {id}=await accept();sendAliasMessage(id,'ALIAS_ONLY_PRIVATE_FACT');let body='';
  mock.restoreAll();mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{body=String(init?.body);return json({memories:[]});});
  const result=await extractMemoryCandidates('character-private-id');assert.equal(result.messageCount,1);assert(body.includes(ALIAS_MEMORY_RULES));assert(!body.includes('ALIAS_ONLY_PRIVATE_FACT'));
  await requestMemoryAiText('合并阶段回顾','主号转述一个陌生人的话',{json:true});assert(body.includes(ALIAS_MEMORY_RULES));
});

test('an unblocked character can automatically create a probing alias and retain its private motive without leaking it in the public profile',async()=>{
  const chats=read('yyphone:wechat-chats');chats[0].blocked=false;chats[0].messages[0].text='今天聊得很开心 明天再见';writeStoredValue('yyphone:wechat-chats',chats);
  const mainBefore=readStorageString('yyphone:wechat-chats');const motive='想知道小雨面对陌生人的时候是不是也这么爱开玩笑';let calls=0;
  writeAliasState({...readAliasState(),autoEnabled:true});
  mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{
    calls++;const body=String(init?.body);assert(body.includes('主号没有被拉黑'));assert(body.includes('主号正常联系、没有吵架时'));assert(body.includes('换个身份试探对方'));
    return json({decision:'request',motive,profile:{name:'借一阵风',handle:'borrow_wind',bio:'喜欢听歌'},message:'想聊聊你分享的那首歌'});
  });
  await processCharacterAliases();assert.equal(calls,1);
  const state=readAliasState(),thread=state.threads[0];assert.equal(thread.status,'pending');assert.equal(thread.contactMotive,motive);assert.equal(thread.identity,'unknown');
  assert(!JSON.stringify(aliasPeer(thread,state)).includes(motive));assert(!thread.requestText.includes(motive));
  assert(buildAliasPrompt(thread).includes(motive));assert.equal(readStorageString('yyphone:wechat-chats'),mainBefore);
  await processCharacterAliases();assert.equal(calls,1);
});

test('a normally connected character may choose not to open a probing alias without generating a forced invitation',async()=>{
  const chats=read('yyphone:wechat-chats');chats[0].blocked=false;writeStoredValue('yyphone:wechat-chats',chats);
  writeAliasState({...readAliasState(),autoEnabled:true});let calls=0;
  mock.method(globalThis,'fetch',async()=>{calls++;return json({decision:'wait'});});
  await processCharacterAliases();assert.equal(calls,1);assert.equal(readAliasState().threads.length,0);assert.equal(readAliasState().profiles.length,0);
  await processCharacterAliases();assert.equal(calls,1);assert.equal(read('yyphone:wechat-chats')[0].blocked,false);
});

test('fresh stranger interactions encourage a main-account aside once, while newer activity and failed generations remain pending',async()=>{
  const {id}=await accept();sendAliasMessage(id,'我看到你拍的那张海边照片了');
  const snapshot=pendingAliasFollowup('character-private-id');assert.equal(snapshot.items.length,1);assert.match(snapshot.text,/不必等玩家问到小号/);assert.match(snapshot.text,/真实身份未确认/);assert.match(snapshot.text,/海边照片/);assert(!snapshot.text.includes('OWNER_ONLY_PRIVATE_PERSONA'));
  assert.equal(pendingAliasFollowup('other-char').text,'');assert.equal(readAliasState().threads[0].identity,'unknown');
  acknowledgeAliasFollowup(snapshot,undefined);assert.equal(pendingAliasFollowup('character-private-id').items.length,1);
  acknowledgeAliasFollowup(snapshot,[id]);assert.equal(pendingAliasFollowup('character-private-id').text,'');
  sendAliasMessage(id,'想问问在哪拍的');const newer=pendingAliasFollowup('character-private-id');
  acknowledgeAliasFollowup(snapshot,[id]);assert.deepEqual(pendingAliasFollowup('character-private-id').items,newer.items);
  acknowledgeAliasFollowup(newer,[id]);assert.equal(pendingAliasFollowup('character-private-id').text,'');
  const message=readAliasState().threads[0].messages.at(-1)!;editAliasMessage(id,message.id,'想问一下拍摄地点');assert.equal(pendingAliasFollowup('character-private-id').text,'');deleteAliasMessage(id,message.id);assert.equal(pendingAliasFollowup('character-private-id').text,'');
});

test('text pictures retain their kind and source, and message edits/deletion invalidate identity evidence without touching main history',async()=>{
  const {id}=await accept();const before=readStorageString('yyphone:wechat-chats');
  sendAliasMessage(id,'一张窗边的雨景照片','image');let thread=readAliasState().threads[0],message=thread.messages[0];assert.equal(message.kind,'image');assert.match(buildAliasPrompt(thread),/图片内容：一张窗边/);
  updateAliasThread(id,t=>({...t,identity:'suspected',identityEvidence:[{messageId:message.id,quote:'雨景照片',referenceQuote:'雨景照片',kind:'shared-memory'}]}));
  editAliasMessage(id,message.id,'一张海边的落日照片');thread=readAliasState().threads[0];assert.equal(thread.messages[0].kind,'image');assert.equal(thread.identity,'unknown');assert.equal(thread.identityEvidence?.length,0);assert(thread.messages[0].editedAt);
  assert(!buildAliasMemoryContext(['character-private-id']).includes('窗边的雨景'));assert.match(buildAliasMemoryContext(['character-private-id']),/图片内容：一张海边/);
  deleteAliasMessage(id,message.id);assert.equal(readAliasState().threads[0].messages.length,0);assert.equal(readStorageString('yyphone:wechat-chats'),before);assert.throws(()=>editAliasMessage(id,message.id,'已不存在'),/不存在/);
});

test('alias replies save separate thoughts for every bubble and support character text pictures',async()=>{
  const {id}=await accept();sendAliasMessage(id,'给我看看你窗外');const mainBefore=readStorageString('yyphone:wechat-chats');let body='';
  mock.restoreAll();mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{body=String(init?.body);return json({reply:['刚拍的',{kind:'image',text:'雨滴贴着窗，街灯是一团暖黄色的光'}],thought:'我竟然认真找了个角度，明明还不知道对方是谁。'});});
  await generateAliasReply(id);const messages=readAliasState().threads[0].messages;assert.equal(messages.at(-1)?.kind,'image');assert.equal(messages.at(-2)?.kind,'text');assert.equal(messages.at(-1)?.replyBatchId,messages.at(-2)?.replyBatchId);assert.match(aliasRoundThought(messages.at(-1)!,messages),/还不知道对方是谁/);assert.match(body,/独立 thought/);
  assert(!buildAliasMemoryContext(['character-private-id']).includes('认真找了个角度'));assert.equal(readStorageString('yyphone:wechat-chats'),mainBefore);
  editAliasMessage(id,messages.at(-2)!.id,'就这一张');deleteAliasMessage(id,messages.at(-2)!.id);assert.match(aliasRoundThought(readAliasState().threads[0].messages.at(-1)!,readAliasState().threads[0].messages),/认真找了个角度/);
});

test('missing alias thoughts are corrected once and repeated invalid formats commit neither messages nor deletion',async()=>{
  const {id}=await accept();sendAliasMessage(id,'你好');let calls=0;
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>json({reply:['在呢'],thought:++calls===1?'':'我在等对方说明来意'}));
  await generateAliasReply(id);assert.equal(calls,2);assert.equal(readAliasState().threads[0].messages.at(-1)?.thought,'我在等对方说明来意');
  const before=readAliasState().threads[0];calls=0;mock.restoreAll();mock.method(globalThis,'fetch',async()=>{calls++;return json({reply:[],deleteContact:true,thought:''});});
  await assert.rejects(generateAliasReply(id),/心声/);assert.equal(calls,2);assert.deepEqual(readAliasState().threads[0],before);
});

test('a character may remove the added alias while keeping main friendship and history, and a new verification is required to reconnect',async()=>{
  const {id}=await accept();sendAliasMessage(id,'我想继续打扰你');const before=readStorageString('yyphone:wechat-chats');
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>json({reply:['先到这里吧'],thought:'我不想再继续这段来往，这样的距离让我不舒服。',deleteContact:true}));
  await generateAliasReply(id);let thread=readAliasState().threads[0];assert(thread.removedByCharacterAt);assert.equal(thread.status,'accepted');assert.equal(thread.messages.length,3);assert.match(thread.messages.at(-1)!.text,/移出通讯录/);assert.equal(readStorageString('yyphone:wechat-chats'),before);
  assert.throws(()=>sendAliasMessage(id,'还能发吗'),/好友验证/);await assert.rejects(generateAliasReply(id),/当前不能/);assert.match(pendingAliasFollowup(thread.charId).text,/已将此账号移出通讯录/);
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>json({accept:true,reply:'这次有事就说吧'}));
  await applyWithAlias(thread.userAccountId,thread.charId,'可以再加回来吗');thread=readAliasState().threads[0];assert.equal(thread.removedByCharacterAt,undefined);assert.equal(thread.messages.length,3);sendAliasMessage(id,'谢谢');assert.equal(readAliasState().threads[0].messages.length,4);
});

test('account changes or edits during generation cancel replies, thoughts, images and friend removal together',async()=>{
  const {id}=await accept();sendAliasMessage(id,'你好');const message=readAliasState().threads[0].messages[0];let finish!:()=>void;
  mock.restoreAll();mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{finish=()=>resolve(json({reply:[{kind:'image',text:'LATE_PICTURE'}],thought:'LATE_THOUGHT',deleteContact:true}));}));
  const pending=generateAliasReply(id);editAliasMessage(id,message.id,'改过的消息');finish();await assert.rejects(pending,/已经变化/);
  assert.equal(readAliasState().threads[0].removedByCharacterAt,undefined);assert.equal(readAliasState().threads[0].messages.length,1);assert(!JSON.stringify(readAliasState()).includes('LATE_'));
});

test('reapplying after removal preserves a previously disclosed identity rather than treating a known account as a stranger',async()=>{
  const {id}=await accept();revealUserAlias(id);
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>json({reply:[],thought:'我现在还不想和她从这个账号聊天。',deleteContact:true}));await generateAliasReply(id);
  const thread=readAliasState().threads[0];let body='';mock.restoreAll();mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{body=String(init?.body);return json({accept:true,reply:'加回来了'});});
  await applyWithAlias(thread.userAccountId,thread.charId,'可以重新加回来吗');assert.match(body,/此前已经明确公开了身份/);assert.equal(readAliasState().threads[0].identity,'revealed');assert.equal(readAliasState().threads[0].removedByCharacterAt,undefined);
});
