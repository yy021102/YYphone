import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { activeMemoryArchive } from './memoryArchives';
import { readMemories } from './memoryData';
import { applyInspectionAction, finishPhoneInspection, restorePhoneInspectionHistory, readPhoneInspections, readInspectionActions, inspectionTargets, readInspectionContacts, readInspectionPage, reactToInspection, preparePhoneInspection, type InspectionSession } from './phoneInspection';
import { readDirectMessages } from './journalData';
import { readMoments, subscribeMoments } from './momentsData';
import { buildPrompt } from './buildPrompt';
const values = new Map<string,string>();
Object.defineProperty(globalThis,'window',{configurable:true,value:{setTimeout,clearTimeout,localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k),clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,get length(){return values.size;}}}});
beforeEach(async()=>{await clearDbStorage();writeStoredValue('pocketos:wechat-contacts',[{id:'a',name:'林渡',persona:'ORIGINAL_PERSONA',worldBooks:[{bookId:'book',entryId:'one'}]},{id:'b',name:'时予',persona:'OTHER_PRIVATE_PERSONA'}]);
  writeStoredValue('yyphone:world-books',[{id:'book',name:'世界',entries:[{id:'one',title:'绑定条目',depth:'front',content:'BOUND_BOOK'}]}]);
  writeStoredValue('yyphone:api-presets',[{id:'api',name:'api',endpoint:'https://test.invalid/v1',apiKey:'SECRET_API_KEY',model:'test'}]);
  writeStoredValue('yyphone:wechat-chats',[{id:'chat-a',type:'direct',participantIds:['a'],activeArchiveId:'one',noteName:'给林渡的特别备注',messages:[{id:'a1',senderId:'user',text:'你好',createdAt:'2026-10-26'}]},{id:'chat-b',type:'direct',participantIds:['b'],context:'NEVER_INCLUDE_SYSTEM_CONTEXT',activeArchiveId:'two',archives:[{id:'hidden',messages:[{senderId:'b',text:'NEVER_INCLUDE_ARCHIVED_CHAT'}]}],messages:[{id:'b1',senderId:'b',text:'OLD_EVENT_A',createdAt:'2024-01-01'},{id:'b2',senderId:'user',text:'下午去看电影',createdAt:'2024-01-01'},{id:'thought',senderId:'b',kind:'thought',text:'NEVER_INCLUDE_THOUGHT'},{id:'bg',senderId:'narrator',kind:'context-note',text:'NEVER_INCLUDE_BACKGROUND'}]}]);
  writeStoredValue('yyphone:wechat-moments',[{id:'post',authorId:'user',authorName:'玩家',authorType:'user',authorAvatar:'',content:'MOMENT_CONTENT',createdAt:'2026-10-20',comments:[],likes:[],seenByCharIds:[],seenCommentIdsByChar:{}}]);
});afterEach(()=>mock.restoreAll());
const session=():InspectionSession=>({id:'session-test',charId:'a',chatId:'chat-a',archiveKey:activeMemoryArchive('a'),createdAt:'2026-10-26T12:00:00Z',steps:[]});
test('preparation buffers the complete route and speech without changing remarks, sending messages or writing memories',async()=>{
  const before=readStorageString('yyphone:wechat-chats'); let calls=0;
  mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{calls++; const body=JSON.parse(String(init?.body));const task=JSON.parse(body.messages.at(-1).content); const result=task.currentPageId==='home'?{comments:['先看看备注'],nextId:'remark',end:false}:task.currentPageId==='remark'?{comments:['换一个名字','就叫这个吧'],nextId:'moments',action:{type:'rename-self',text:'新的名字'},end:false}:{comments:['手机还你'],end:true};return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});});
  const s=session(); const plan=await preparePhoneInspection(s,'玩家',new AbortController().signal);
  assert.equal(calls,3);assert.deepEqual(plan.map(step=>step.page.id),['home','remark','moments']);assert.equal(plan[1].comments.length,2);assert.equal(plan[1].action?.type,'rename-self');assert.equal(plan.at(-1)?.end,true);
  assert.equal(readStorageString('yyphone:wechat-chats'),before);assert.equal(readInspectionActions(s.id).length,0);assert.equal(readPhoneInspections().length,0);assert.equal(readMemories().length,0);assert.equal(s.steps.length,0);
});
test('phone pages display actual current chat, personal note and moments without thoughts, hidden archives or configurations',()=>{
  assert(inspectionTargets('a').some(t=>t.id==='chat:chat-b'));
  assert.match(JSON.stringify(readInspectionPage('remark','a','玩家')),/特别备注/);assert.match(JSON.stringify(readInspectionPage('moments','a','玩家')),/MOMENT_CONTENT/);
  const page=readInspectionPage('chat:chat-b','a','玩家');assert.equal(page.lines.length,2);assert.equal(page.lines[0].from,'时予');assert.equal(page.lines[1].from,'玩家');assert.equal(page.lines[0].time,'2024-01-01');
  assert(!JSON.stringify(page).includes('NEVER_INCLUDE'));assert(!JSON.stringify(page).includes('OTHER_PRIVATE_PERSONA'));assert.throws(()=>readInspectionPage('chat:deleted','a','玩家'));
});
test('each opened conversation exposes only its latest 15 visible messages',()=>{
  const chats=JSON.parse(readStorageString('yyphone:wechat-chats')!);
  chats[1].messages=Array.from({length:35},(_,i)=>({senderId:i%2?'user':'b',text:`visible-${i}`,createdAt:'2026-10-26'}));
  chats[1].messages.push({senderId:'b',kind:'thought',text:'NEVER_INCLUDE_THOUGHT'},{senderId:'b',hidden:true,text:'NEVER_INCLUDE_HIDDEN'});
  writeStoredValue('yyphone:wechat-chats',chats);
  const page=readInspectionPage('chat:chat-b','a','玩家');
  assert.equal(page.lines.length,15);assert.equal(page.lines[0].text,'visible-20');assert.equal(page.lines.at(-1)?.text,'visible-34');
});

test('reactions receive actor settings and only opened phone content, and reject invented next targets',async()=>{
  let body='';mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{body=String(init?.body);return Response.json({choices:[{message:{content:JSON.stringify({comments:['你们还一起看了电影啊'],nextId:'invented',end:false})}}]});});
  const s=session();const page=readInspectionPage('remark','a','玩家');s.steps=[{page,comments:[]}];
  const result=await reactToInspection(s,page,'玩家',new AbortController().signal);
  assert.match(body,/ORIGINAL_PERSONA/);assert.match(body,/BOUND_BOOK/);assert(!body.includes('OLD_EVENT_A'));assert(!body.includes('NEVER_INCLUDE'));assert(!body.includes('OTHER_PRIVATE_PERSONA'));assert(!body.includes('SECRET_API_KEY'));assert.notEqual(result.nextId,'invented');
});
test('WeChat list entries navigate to their real chat or contact without exposing private character settings',()=>{
  const home=readInspectionPage('home','a','玩家');
  const row=home.lines.find(l=>l.targetId==='chat:chat-b');assert(row);assert.equal(row.from,'时予');assert.equal(row.text,'下午去看电影');
  const directory=readInspectionContacts('a');assert.equal(directory.find(c=>c.id==='a')?.targetId,'remark');assert.equal(directory.find(c=>c.id==='b')?.chatId,'chat:chat-b');
  const page=readInspectionPage(directory.find(c=>c.id==='b')!.targetId,'a','玩家');assert.equal(page.kind,'contact');assert.equal(page.lines[0].text,'时予');
  assert(!JSON.stringify([directory,page,home]).includes('PRIVATE_PERSONA'));assert(!JSON.stringify(home).includes('NEVER_INCLUDE'));assert.throws(()=>readInspectionPage('contact:deleted','a','玩家'));
});
test('finishing inserts one attributed historical note without adding long-term memories or changing other chats',async()=>{
  const before=readStorageString('yyphone:wechat-chats');const s=session();s.steps=[{page:{...readInspectionPage('chat:chat-b','a','玩家'),lines:[...readInspectionPage('chat:chat-b','a','玩家').lines,{from:'玩家',text:'图片',own:true,image:'data:image/png;base64,AAA'}]},comments:['你们聊得挺开心']}];
  await finishPhoneInspection(s,'林渡','玩家');await finishPhoneInspection(s,'林渡','玩家');
  assert.equal(readMemories().length,0);
  const chats=JSON.parse(readStorageString('yyphone:wechat-chats')!),original=JSON.parse(before!);const notes=chats[0].messages.filter((m:any)=>m.source==='phone-inspection');
  assert.equal(notes.length,1);assert.match(notes[0].text,/其他联系人说过的话不属于林渡/);assert.match(notes[0].text,/2024-01-01/);assert.equal(notes[0].senderId,'narrator');assert.equal(notes[0].createdAt,readPhoneInspections()[0].finishedAt);
  assert.deepEqual(chats[0].messages[0],original[0].messages[0]);assert.deepEqual(chats[1],original[1]);
  assert.equal(readPhoneInspections().length,1);assert(!JSON.stringify(readPhoneInspections()).includes('base64'));
  assert(!readDirectMessages('a',{fullText:true}).some(m=>m.id===notes[0].id));
});

test('inspection notes are repeated only within the selected chronological chat window, not injected forever',async()=>{
  const chats=JSON.parse(readStorageString('yyphone:wechat-chats')!);chats[0].context='';chats[1].noteName='';writeStoredValue('yyphone:wechat-chats',chats);
  await finishPhoneInspection(session(),'林渡','玩家');
  const prompt=()=>JSON.stringify(buildPrompt({chatId:'chat-a',historyLimit:2,timeAwarenessEnabled:false}));
  assert.match(prompt(),/角色查 user 手机/);assert.match(prompt(),/角色查 user 手机/);
  const updated=JSON.parse(readStorageString('yyphone:wechat-chats')!);updated[0].messages.push(...Array.from({length:4},(_,i)=>({id:`after-${i}`,senderId:i%2?'a':'user',text:`后来的日常${i}`,createdAt:new Date(Date.now()+i+1000).toISOString()})));writeStoredValue('yyphone:wechat-chats',updated);
  assert(!prompt().includes('角色查 user 手机'));assert.equal(updated[0].messages.filter((m:any)=>m.source==='phone-inspection').length,1);assert.equal(readMemories().length,0);
});

test('concurrent finishes retain both chronological records and migrating the old temporary version preserves its original time',async()=>{
  await Promise.all([finishPhoneInspection(session(),'林渡','玩家'),finishPhoneInspection({...session(),id:'concurrent-session'},'林渡','玩家')]);
  let chats=JSON.parse(readStorageString('yyphone:wechat-chats')!);assert.equal(chats[0].messages.filter((m:any)=>m.source==='phone-inspection').length,2);
  const legacy={...session(),id:'legacy-temp',finishedAt:'2026-10-26T13:00:00Z',pendingContext:'TEMPORARY_PAST_EVENT'};writeStoredValue('yyphone:phone-inspections',[...readPhoneInspections(),legacy]);
  await restorePhoneInspectionHistory('chat-b');chats=JSON.parse(readStorageString('yyphone:wechat-chats')!);assert(!JSON.stringify(chats).includes('TEMPORARY_PAST_EVENT'));
  await restorePhoneInspectionHistory('chat-a');await restorePhoneInspectionHistory('chat-a');chats=JSON.parse(readStorageString('yyphone:wechat-chats')!);
  const notes=chats[0].messages.filter((m:any)=>m.id==='inspection-note:legacy-temp');assert.equal(notes.length,1);assert.equal(notes[0].createdAt,legacy.finishedAt);assert.equal(notes[0].text,legacy.pendingContext);assert.equal(readMemories().length,0);
});

test('legacy automatically stored inspection memories move losslessly into history without removing unrelated memories',async()=>{
  const s={...session(),id:'old-memory',finishedAt:'2026-10-26T14:00:00Z'};writeStoredValue('yyphone:phone-inspections',[s]);
  const old={id:`inspection:${s.id}`,charId:'a',archiveKey:s.archiveKey,content:'OLD_INSPECTION_MEMORY_CONTENT',category:'event',importance:4,pinned:false,createdAt:s.finishedAt,updatedAt:s.finishedAt,recallCount:0,source:'manual'};
  const unrelated={...old,id:'independent-memory',content:'KEEP_THIS_PERSONAL_MEMORY'};writeStoredValue('yyphone:memory-items',[old,unrelated]);
  await restorePhoneInspectionHistory('chat-a');await restorePhoneInspectionHistory('chat-a');
  const chat=JSON.parse(readStorageString('yyphone:wechat-chats')!)[0];const notes=chat.messages.filter((m:any)=>m.id===`inspection-note:${s.id}`);assert.equal(notes.length,1);assert.equal(notes[0].text,old.content);assert.equal(notes[0].createdAt,s.finishedAt);
  assert.deepEqual(readMemories().map(m=>m.id),[unrelated.id]);assert(!readDirectMessages('a',{fullText:true}).some(m=>m.id===notes[0].id));
});
test('a changed archive prevents the inspection from writing into a different character timeline',async()=>{
  const s=session();const chats=JSON.parse(readStorageString('yyphone:wechat-chats')!);chats[0].activeArchiveId='different';writeStoredValue('yyphone:wechat-chats',chats);
  await assert.rejects(finishPhoneInspection(s,'林渡','玩家'),/存档已切换/);assert.equal(readMemories().length,0);assert.equal(readPhoneInspections().length,0);
});
test('hidden conversations are excluded from lists, contacts, AI candidates, prior pages and write targets',async()=>{
  const s=session();s.options={hiddenChatIds:['chat-b'],allowMessages:true};
  const hidden=readInspectionPage('chat:chat-b','a','玩家');s.steps=[{page:hidden,comments:['NEVER_INCLUDE_PRIOR_COMMENT']}];
  assert(!readInspectionPage('home','a','玩家',s.options).lines.some(l=>l.targetId==='chat:chat-b'));
  assert(!inspectionTargets('a',s.options).some(t=>t.id==='chat:chat-b'));assert(!readInspectionContacts('a',s.options).some(c=>c.id==='b'));
  assert.throws(()=>readInspectionPage('chat:chat-b','a','玩家',s.options));assert.throws(()=>readInspectionPage('contact:b','a','玩家',s.options));
  let body='';mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{body=String(init?.body);return Response.json({choices:[{message:{content:JSON.stringify({comments:['看看朋友圈吧'],nextId:'chat:chat-b',action:{type:'send-message',chatId:'chat-b',text:'偷发'},end:false})}}]});});
  const result=await reactToInspection(s,readInspectionPage('home','a','玩家',s.options),'玩家',new AbortController().signal);
  assert(!body.includes('OLD_EVENT_A'));assert(!body.includes('NEVER_INCLUDE_PRIOR_COMMENT'));assert(!body.includes('chat-b'));assert.equal(result.action,undefined);assert.notEqual(result.nextId,'chat:chat-b');
  await assert.rejects(applyInspectionAction(s,hidden,{type:'send-message',chatId:'chat-b',text:'偷发'},{userName:'玩家'}));
  const memory=await finishPhoneInspection(s,'林渡','玩家');assert(!memory.includes('OLD_EVENT_A'));assert(!JSON.stringify(readPhoneInspections()).includes('OLD_EVENT_A'));
});
test('hiding the actor conversation also removes its remark and private chat context',async()=>{
  const s=session();s.options={hiddenChatIds:['chat-a'],allowMessages:false};
  assert(!inspectionTargets('a',s.options).some(t=>t.id==='remark'));assert.throws(()=>readInspectionPage('remark','a','玩家',s.options));
  let body='';mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{body=String(init?.body);return Response.json({choices:[{message:{content:JSON.stringify({comments:['看看动态'],end:true})}}]});});
  await reactToInspection(s,readInspectionPage('home','a','玩家',s.options),'玩家',new AbortController().signal);
  assert(!body.includes('给林渡的特别备注'));assert(!body.includes('你好'));assert(body.includes('ORIGINAL_PERSONA'));
});
test('renaming changes only the inspecting character chat and persists one receipt across retries',async()=>{
  const s=session(),page=readInspectionPage('remark','a','玩家'),before=JSON.parse(readStorageString('yyphone:wechat-chats')!);
  const action={type:'rename-self' as const,text:'我家的林渡'};
  await Promise.all([applyInspectionAction(s,page,action,{userName:'玩家'}),applyInspectionAction(s,page,action,{userName:'玩家'})]);
  const after=JSON.parse(readStorageString('yyphone:wechat-chats')!);assert.equal(after[0].noteName,action.text);assert.deepEqual(after[0].messages,before[0].messages);assert.deepEqual(after[1],before[1]);assert.equal(readInspectionActions(s.id).length,1);
  assert.match(await finishPhoneInspection(s,'林渡','玩家'),/实际完成的操作：把自己的备注改为“我家的林渡”/);
  await assert.rejects(applyInspectionAction(s,page,action,{userName:'玩家'}),/已经结束/);
});
test('代发 requires opt-in and an opened eligible chat, writes a normal message with attribution, and preserves the archive',async()=>{
  const s=session(),page=readInspectionPage('chat:chat-b','a','玩家'),action={type:'send-message' as const,chatId:'chat-b',text:'我是林渡，借手机跟你打个招呼'};
  await assert.rejects(applyInspectionAction(s,page,action,{userName:'玩家'}));
  s.options={hiddenChatIds:[],allowMessages:true};
  await assert.rejects(applyInspectionAction(s,readInspectionPage('home','a','玩家'),action,{userName:'玩家'}));
  await assert.rejects(applyInspectionAction(s,readInspectionPage('chat:chat-a','a','玩家'),{...action,chatId:'chat-a'},{userName:'玩家'}));
  const before=JSON.parse(readStorageString('yyphone:wechat-chats')!);await applyInspectionAction(s,page,action,{userName:'玩家'});await applyInspectionAction(s,page,action,{userName:'玩家'});
  const after=JSON.parse(readStorageString('yyphone:wechat-chats')!);assert.deepEqual(after[0],before[0]);assert.deepEqual(after[1].archives,before[1].archives);assert.equal(after[1].activeArchiveId,'two');assert.equal(after[1].messages.length,before[1].messages.length+1);assert.equal(after[1].messages.at(-1).senderId,'user');assert.equal(after[1].messages.at(-1).text,action.text);assert.match(after[1].messages.at(-1).aiContext,/实际发言者是林渡/);
  assert.equal(readInspectionActions(s.id).length,1);
  writeStoredValue('yyphone:wechat-chats',after.map((c:any)=>({...c,noteName:c.noteName||'',context:c.context||'',messages:c.messages.filter((m:any)=>typeof m.createdAt==='string')})));
  const prompt=JSON.stringify(buildPrompt({chatId:'chat-b'}));assert.match(prompt,/实际发言者是林渡/);
});
test('posting creates a real user moment once, notifies the feed, and records only committed changes',async()=>{
  const s=session(),page=readInspectionPage('moments','a','玩家');let notifications=0;const unsubscribe=subscribeMoments(()=>notifications++);
  try {const action={type:'post-moment' as const,text:'今天这部手机暂时归我保管。——林渡'};
    await applyInspectionAction(s,page,action,{userName:'玩家',userAvatarUrl:'https://example.invalid/avatar.png'});await applyInspectionAction(s,page,action,{userName:'玩家'});
    const posts=readMoments();assert.equal(posts.length,2);assert.equal(posts[0].authorId,'user');assert.equal(posts[0].authorName,'玩家');assert.equal(posts[0].content,action.text);assert.equal(posts[0].authorAvatar,'https://example.invalid/avatar.png');assert.equal(notifications,1);assert.equal(readInspectionActions(s.id).length,1);
    assert.match(await finishPhoneInspection(s,'林渡','玩家'),/替玩家发朋友圈/);
  } finally {unsubscribe();}
});
test('cancelled requests, switched archives, blocked chats and cross-page actions cannot write',async()=>{
  const s=session();s.options={hiddenChatIds:[],allowMessages:true};const page=readInspectionPage('chat:chat-b','a','玩家'),action={type:'send-message' as const,chatId:'chat-b',text:'你好'};
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(applyInspectionAction(s,page,action,{userName:'玩家',signal:cancelled.signal}));
  const chats=JSON.parse(readStorageString('yyphone:wechat-chats')!);chats[1].activeArchiveId='changed';writeStoredValue('yyphone:wechat-chats',chats);await assert.rejects(applyInspectionAction(s,page,action,{userName:'玩家'}),/存档已变化/);
  chats[1].activeArchiveId='two';chats[1].blocked=true;writeStoredValue('yyphone:wechat-chats',chats);await assert.rejects(applyInspectionAction(s,page,action,{userName:'玩家'}));
  await assert.rejects(applyInspectionAction(s,page,{type:'rename-self',text:'不能改别人'},{userName:'玩家'}));await assert.rejects(applyInspectionAction(s,page,{type:'post-moment',text:'不能在聊天里发动态'},{userName:'玩家'}));
  chats[0].activeArchiveId='changed';writeStoredValue('yyphone:wechat-chats',chats);await assert.rejects(applyInspectionAction(s,readInspectionPage('moments','a','玩家'),{type:'post-moment',text:'取消'},{userName:'玩家'}),/存档已切换/);
  assert.equal(readInspectionActions(s.id).length,0);assert.equal(readMoments().length,1);
});
