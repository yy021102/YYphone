import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage, setStorageItemsAtomically } from './dbStorage';
import { readStorageString, writeStoredValue } from './localStorage';
import { createEmptyCoupleSpace } from './coupleSpaceData';
import { COUPLE_PRODUCTS, COUPLE_REWARDS_KEY, acknowledgeCoupleBell, acknowledgeCouponRequests, assertCouponAvailable, buyCoupleCoupon, coupleBalance, coupleBlockProtection, coupleRewardContext, couponStock, readCoupleWallet, rewardDay, settleCouplePoints, settleWallet, unseenCoupleBell, useCoupleCoupon, fulfillCoupleLetter, fulfillCoupleGift, findCouponUse } from './coupleRewards';
import { generateCoupleLetter } from './coupleLetters';
import { readInventory } from './inventoryData';
import { describeForSummary } from './journalData';
import { generateCoupleRewardAction, processCouplePeaceBells } from './coupleRewardsAi';
import { buildPrompt, toMessageContent } from './buildPrompt';
import type { CharacterCoupleSpace } from '../apps/CoupleSpaceApp';
import { couponUseInstructions } from './coupleRewards';

const values = new Map<string,string>();
Object.defineProperty(globalThis,'window',{configurable:true,value:{ setTimeout, clearTimeout, dispatchEvent: () => true, localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k),clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,get length(){return values.size;}} }});
const read = (key: string) => JSON.parse(readStorageString(key) ?? 'null');
const chat = () => read('yyphone:wechat-chats')[0];
const empty = () => ({ awards: [], purchases: [], uses: [] });
function fullSpace(days = 15): CharacterCoupleSpace {
  const s = { ...createEmptyCoupleSpace('a'), bindStatus: 'bound' as const };
  for(let i=0;i<days;i++) {
    const now=new Date();now.setDate(now.getDate()-i);const d=rewardDay(now);
    s.moods[d]={ dateStr:d,userMoodId:'happy_1',charMoodId:'calm_1' };
    s.diaries.push({id:`du${i}`,author:'user',authorName:'我',dateStr:d,title:'小事',content:'一起看花'}, {id:`dc${i}`,author:'char',authorName:'林渡',dateStr:d,title:'小事',content:'一起等到花开'});
    s.qaList.push({id:`q${i}`,dateStr:d,question:'喜欢什么',askedBy:'user',userAnswer:'小花',charAnswer:'和你看花'});
  }
  return s;
}
async function fund(days=15) { await setStorageItemsAtomically({'yyphone:couple-spaces':{a:fullSpace(days)}});await settleCouplePoints(); }
const answer = (value: unknown) => Response.json({choices:[{message:{content:JSON.stringify(value)}}]});
beforeEach(async()=>{
  await settleCouplePoints(); await clearDbStorage();
  await setStorageItemsAtomically({
    'pocketos:wechat-contacts':[{id:'a',name:'林渡',persona:'ORIGINAL_PERSONA',worldBooks:[{bookId:'book',entryId:'entry'}]},{id:'b',name:'时予',persona:'NEVER_OTHER_PERSONA'}],
    'yyphone:world-books':[{id:'book',name:'世界',entries:[{id:'entry',title:'条目',content:'BOUND_BOOK',depth:'front'}]}],
    'yyphone:api-presets':[{id:'qa',name:'qa',endpoint:'https://rewards.invalid/v1',apiKey:'test-key',model:'qa'}],
    'yyphone:couple-spaces':{a:{...createEmptyCoupleSpace('a'),bindStatus:'bound'}},
    'yyphone:wechat-chats':[{id:'chat-a',type:'direct',participantIds:['a'],activeArchiveId:'one',noteName:'林渡',context:'',blocked:false,avatars:{},updatedAt:new Date().toISOString(),messages:[
      {id:'m1',senderId:'user',text:'今天想要一封信',createdAt:new Date().toISOString()},
      {id:'hidden',senderId:'a',hidden:true,text:'NEVER_HIDDEN',createdAt:new Date().toISOString()}, {id:'thought',senderId:'a',kind:'thought',text:'NEVER_THOUGHT',createdAt:new Date().toISOString()},
    ]},{id:'chat-b',type:'direct',participantIds:['b'],messages:[{id:'b1',senderId:'b',text:'NEVER_OTHER_CHAT'}]}],
    'yyphone:memory-items':[{id:'mem',charId:'a',archiveKey:'["a","one"]',content:'OWN_MEMORY',category:'core',pinned:true,importance:5,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),recallCount:0}],
    'yyphone:blocked-contacts':[],
  });
});afterEach(()=>mock.restoreAll());

test('the same date awards one point to each person per joint activity, with at most three points',()=>{
  const space=fullSpace(1), d=rewardDay();
  space.qaList.push({...space.qaList[0],id:'q-duplicate'});
  const w=settleWallet(empty(),space);assert.equal(w.awards.length,3);assert.equal(coupleBalance(w,'user'),3);assert.equal(coupleBalance(w,'char'),3);
  assert.equal(settleWallet(w,space),w);
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);space.moods[rewardDay(tomorrow)]={dateStr:rewardDay(tomorrow),userMoodId:'happy_1',charMoodId:'happy_1'};
  assert.equal(settleWallet(w,space).awards.length,3);
  assert(w.awards.every(a=>a.day===d));assert(COUPLE_PRODUCTS.every(p=>p.price>=3));
});
test('partial activities, mismatched diary dates, different questions and unbound spaces earn nothing',()=>{
  const s=fullSpace(1),yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  delete s.moods[rewardDay()].charMoodId;s.diaries[1].dateStr=rewardDay(yesterday);
  s.qaList=[{...s.qaList[0],charAnswer:''},{...s.qaList[0],id:'other',userAnswer:''}];
  assert.equal(settleWallet(empty(),s).awards.length,0);
  assert.equal(settleWallet(empty(),{...fullSpace(1),bindStatus:'unbound'}).awards.length,0);
});
test('backfill settles once and deleting or restoring the original records does not re-award points',async()=>{
  await fund(2);assert.equal(readCoupleWallet('a').awards.length,6);
  await setStorageItemsAtomically({'yyphone:couple-spaces':{a:{...createEmptyCoupleSpace('a'),bindStatus:'bound'}}});await settleCouplePoints();
  await fund(2);await settleCouplePoints();assert.equal(readCoupleWallet('a').awards.length,6);
  assert.equal(readCoupleWallet('b').awards.length,0);
});
test('balances and inventory are separate, a duplicate purchase receipt is idempotent and insufficient points do not mutate data',async()=>{
  await fund(1);await buyCoupleCoupon('a','user','kiss','buy1');await buyCoupleCoupon('a','user','kiss','buy1');
  let w=readCoupleWallet('a');assert.equal(coupleBalance(w,'user'),0);assert.equal(coupleBalance(w,'char'),3);assert.equal(couponStock(w,'user','kiss'),1);assert.equal(couponStock(w,'char','kiss'),0);
  const before=readStorageString(COUPLE_REWARDS_KEY);await assert.rejects(buyCoupleCoupon('a','user','sleep','buy2'),/积分还不够/);assert.equal(readStorageString(COUPLE_REWARDS_KEY),before);
});
test('failed point settlement leaves the cached ledger unchanged and can be retried once storage recovers',async()=>{
  await setStorageItemsAtomically({[COUPLE_REWARDS_KEY]:{a:empty()},'yyphone:couple-spaces':{a:fullSpace(1)}});
  mock.method(window.localStorage,'setItem',(key:string,value:string)=>{if(key===COUPLE_REWARDS_KEY)throw new Error('quota');values.set(key,value);});
  await assert.rejects(settleCouplePoints(),/quota/);assert.equal(readCoupleWallet('a').awards.length,0);
  mock.restoreAll();await settleCouplePoints();assert.equal(readCoupleWallet('a').awards.length,3);
});
test('concurrent purchases and uses cannot overdraw points, duplicate a request or use the other person’s stock',async()=>{
  await fund(1);
  const results=await Promise.allSettled([buyCoupleCoupon('a','user','kiss','b1'),buyCoupleCoupon('a','user','kiss','b2')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(useCoupleCoupon('a','char','kiss','steal'),/库存不足/);
  await Promise.all([useCoupleCoupon('a','user','kiss','u1'),useCoupleCoupon('a','user','kiss','u1')]);
  assert.equal(couponStock(readCoupleWallet('a'),'user','kiss'),0);assert.equal(chat().messages.filter((m:any)=>m.kind==='couple-coupon').length,1);
  await assert.rejects(useCoupleCoupon('a','user','kiss','u2'),/库存不足/);
});
test('using a coupon atomically deducts stock and posts its real effect card, then clears the request only after a successful reply',async()=>{
  await fund();await buyCoupleCoupon('a','user','letter','buy');await useCoupleCoupon('a','user','letter','use');
  const card=chat().messages.at(-1);assert.equal(card.kind,'couple-coupon');assert.equal(card.senderId,'user');assert.equal(card.title,'一封情书券');assert.match(toMessageContent(card),/已真实使用/);assert.equal(chat().coupleCouponRevision,'use');
  const ctx=coupleRewardContext('a','one');assert.deepEqual(ctx.pendingIds,['use']);assert.match(ctx.text,/独立信封/);
  const prompt=buildPrompt({chatId:'chat-a'});
  assert.match(JSON.stringify(prompt),/一封情书券/);assert.match(prompt.at(-1)!.content,/已真实使用/);
  assert.equal(coupleRewardContext('a','other').pendingIds.length,0);
  await acknowledgeCouponRequests('a',ctx.pendingIds);assert.equal(coupleRewardContext('a','one').pendingIds.length,1);
  await fulfillCoupleLetter('a','use','char',{title:'给你',body:'那些一起看过的小花，我都好好记着。'});assert.equal(coupleRewardContext('a','one').pendingIds.length,0);
});
test('a storage failure never consumes a coupon without delivering its card',async()=>{
  await fund();await buyCoupleCoupon('a','user','kiss','b');const walletBefore=readStorageString(COUPLE_REWARDS_KEY),chatBefore=readStorageString('yyphone:wechat-chats');
  mock.method(window.localStorage,'setItem',(key:string,value:string)=>{if(key==='yyphone:wechat-chats')throw new Error('quota');values.set(key,value);});
  await assert.rejects(useCoupleCoupon('a','user','kiss','u'),/quota/);
  assert.equal(readStorageString(COUPLE_REWARDS_KEY),walletBefore);assert.equal(readStorageString('yyphone:wechat-chats'),chatBefore);
});
test('the character bell restores friendship, settles old contact requests, notifies once and protects only its use date',async()=>{
  await fund();await buyCoupleCoupon('a','char','peace-bell','b');
  const all=read('yyphone:wechat-chats');all[0]={...all[0],blocked:true,blockedSince:'2026-10-01T00:00:00Z',blockedNextAt:'2026-12-01T00:00:00Z'};
  await setStorageItemsAtomically({'yyphone:wechat-chats':all,'yyphone:blocked-contacts':[{id:'f',chatId:'chat-a',type:'friend-request',status:'pending'},{id:'p',chatId:'chat-a',type:'paper',status:'pending'}]});
  await useCoupleCoupon('a','char','peace-bell','bell',{expectedBlockedSince:'2026-10-01T00:00:00Z'});
  assert.equal(chat().blocked,false);assert.equal(chat().blockedNextAt,undefined);assert(chat().blockedBacklogGeneratedAt);
  assert.equal(couponStock(readCoupleWallet('a'),'char','peace-bell'),0);assert(coupleBlockProtection('a'));assert.equal(unseenCoupleBell()?.charId,'a');
  assert.deepEqual(read('yyphone:blocked-contacts').map((i:any)=>i.status),['accepted','drawer']);
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);assert.equal(coupleBlockProtection('a',tomorrow),false);
  await acknowledgeCoupleBell('a','bell');assert.equal(unseenCoupleBell(),undefined);
});
test('bell and emperor day effects cannot be stacked, and expire without extending through unanswered requests',async()=>{
  await fund(25);await buyCoupleCoupon('a','user','emperor','e1');await buyCoupleCoupon('a','user','emperor','e2');
  await useCoupleCoupon('a','user','emperor','u1');await assert.rejects(useCoupleCoupon('a','user','emperor','u2'),/小皇帝/);assert.equal(couponStock(readCoupleWallet('a'),'user','emperor'),1);
  assert.match(coupleRewardContext('a','one').text,/今日生效/);
  const wallets=read(COUPLE_REWARDS_KEY),old=new Date();old.setDate(old.getDate()-1);wallets.a.uses[0].at=old.toISOString();
  await setStorageItemsAtomically({[COUPLE_REWARDS_KEY]:wallets});assert(!coupleRewardContext('a','one').text.includes('今日生效'));assert.equal(coupleRewardContext('a','one').pendingIds.length,0);
  await buyCoupleCoupon('a','user','peace-bell','bell1');await buyCoupleCoupon('a','user','peace-bell','bell2');await useCoupleCoupon('a','user','peace-bell','bu1');
  assert.throws(()=>assertCouponAvailable('a','user','peace-bell'),/已经摇过/);assert.equal(couponStock(readCoupleWallet('a'),'user','peace-bell'),1);
});
test('archive changes, missing stock, blocked ordinary use and unbound spaces cannot consume a coupon',async()=>{
  await fund();await buyCoupleCoupon('a','user','kiss','b');
  await assert.rejects(useCoupleCoupon('a','user','kiss','u',{expectedArchiveId:'other'}),/状态已变化/);
  const all=read('yyphone:wechat-chats');all[0].blocked=true;await setStorageItemsAtomically({'yyphone:wechat-chats':all});
  await assert.rejects(useCoupleCoupon('a','user','kiss','u'),/黑名单/);assert.equal(couponStock(readCoupleWallet('a'),'user','kiss'),1);
  await setStorageItemsAtomically({'yyphone:couple-spaces':{a:createEmptyCoupleSpace('a')}});await assert.rejects(buyCoupleCoupon('a','user','kiss','b2'),/先开通/);
});
test('character decision uses persona, bound worldbook, actual recent chat and memories, and charges only its own points',async()=>{
  await fund();let calls=0;
  mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{calls++;const body=String(init?.body);assert.match(body,/ORIGINAL_PERSONA/);assert.match(body,/BOUND_BOOK/);assert.match(body,/OWN_MEMORY/);assert.match(body,/今天想要一封信/);assert(!body.includes('NEVER_'));return answer({action:'buy',productId:'letter',reason:'想收下你写给我的那封信'});});
  await generateCoupleRewardAction('a');const w=readCoupleWallet('a');assert.equal(calls,1);assert.equal(coupleBalance(w,'char'),35);assert.equal(coupleBalance(w,'user'),45);assert.equal(couponStock(w,'char','letter'),1);assert.equal(w.uses.length,0);
});
test('character may save points, uses only held stock, and invalid or stale AI choices leave the wallet unchanged',async()=>{
  await fund();await buyCoupleCoupon('a','char','kiss','b');
  mock.method(globalThis,'fetch',async()=>answer({action:'save',reason:'再攒一攒'}));const before=readStorageString(COUPLE_REWARDS_KEY);await generateCoupleRewardAction('a');assert.equal(readStorageString(COUPLE_REWARDS_KEY),before);
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>answer({action:'use',productId:'letter',reason:'我要用'}));await assert.rejects(generateCoupleRewardAction('a'),/可使用/);assert.equal(readStorageString(COUPLE_REWARDS_KEY),before);
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>{const all=read('yyphone:wechat-chats');all[0].activeArchiveId='other';writeStoredValue('yyphone:wechat-chats',all);return answer({action:'buy',productId:'kiss',reason:'想要这个'});});
  await assert.rejects(generateCoupleRewardAction('a'),/状态已变化/);assert.equal(readStorageString(COUPLE_REWARDS_KEY),before);
});
test('background bell decision runs even before the next friend request, uses a real bell and respects later ticks',async()=>{
  await fund();await buyCoupleCoupon('a','char','peace-bell','b');const all=read('yyphone:wechat-chats');all[0]={...all[0],blocked:true,blockedSince:`${Date.now()}`,blockedNextAt:'2099-01-01T00:00:00Z'};await setStorageItemsAtomically({'yyphone:wechat-chats':all});
  let calls=0;mock.method(globalThis,'fetch',async()=>{calls++;return answer({action:'use',productId:'peace-bell',reason:'叮，我们先不吵了，好不好'});});
  await processCouplePeaceBells();await processCouplePeaceBells();assert.equal(calls,1);assert.equal(chat().blocked,false);assert.equal(readCoupleWallet('a').uses.length,1);
});
test('cancelling a character decision before its response prevents a purchase or inventory use',async()=>{
  await fund();const controller=new AbortController(),before=readStorageString(COUPLE_REWARDS_KEY);
  mock.method(globalThis,'fetch',async()=>{controller.abort();return answer({action:'buy',productId:'kiss',reason:'想要'});});
  await assert.rejects(generateCoupleRewardAction('a',{signal:controller.signal}),{name:'AbortError'});assert.equal(readStorageString(COUPLE_REWARDS_KEY),before);
});

const loveLetter='今天又想起你说窗边的小花开了。那时我回得很快，后来却把这句话想了很久。原来等一朵花开，会让平常的一天有了可以期待的事情；而你愿意把这个消息告诉我，也让我觉得，自己被放进了你的生活里。\n\n我不总是很会表达，有时候想关心你，话到了嘴边却只剩下几句笨拙的问候。但你的疲惫、你忽然高兴起来的语气，我都有认真听。想把这些小事好好收着，也想在你需要的时候，比昨天更懂你一点。以后的日子不必每一天都有惊喜，只要你还愿意说，我就想继续听。';
async function used(product:'letter'|'gift',owner:'char'|'user'='char',id='request') {await fund();await buyCoupleCoupon('a',owner,product,`buy:${id}`);await useCoupleCoupon('a',owner,product,id);}
async function catalog(balance=100) {await setStorageItemsAtomically({'yyphone:taobao-market-products':[{id:'p1',category:'shopping',title:'窗边的小花灯',desc:'一盏温柔的灯',price:25.5,emoji:'💡'}], 'yyphone:alipay-data':{balance,yuebao:0,intimateCards:[],monthlyBudgets:{},ledgerList:[],allowedViewers:[],lastInterestDate:rewardDay()}});}
test('a low-balance character may keep affordable points and say why without spending', async () => {
  await fund(1); const before = readStorageString(COUPLE_REWARDS_KEY); let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++; assert.match(String(init?.body), /积分少或想攒更贵的券/);
    return answer({ action: 'save', reason: '先留着，我想攒到能听你哄我睡觉的时候。' });
  });
  const result = await generateCoupleRewardAction('a');
  assert.equal(result.action, 'save'); assert.match(result.reason, /先留着/); assert.equal(calls, 1);
  assert.equal(readStorageString(COUPLE_REWARDS_KEY), before); assert.equal(coupleBalance(readCoupleWallet('a'), 'char'), 3);
});

test('even when no coupon is affordable the character generates its own saving explanation', async () => {
  await fund(0); const before = readStorageString(COUPLE_REWARDS_KEY); let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++; assert.match(String(init?.body), /本轮只能返回 save/);
    return answer({ action: 'save', reason: '今天先放进口袋里，慢慢来。' });
  });
  const result = await generateCoupleRewardAction('a'); assert.equal(calls, 1); assert.equal(result.reason, '今天先放进口袋里，慢慢来。');
  assert.equal(readStorageString(COUPLE_REWARDS_KEY), before);
});

test('every coupon names its receiver and performer, including character sleep requests and day effects', async () => {
  for (const product of COUPLE_PRODUCTS) {
    assert.match(couponUseInstructions(product.id, 'char'), /受益者：角色（你）；履约者：玩家/);
    assert.match(couponUseInstructions(product.id, 'user'), /受益者：玩家；履约者：角色（你）/);
  }
  await fund(); await buyCoupleCoupon('a', 'char', 'sleep', 'buy-sleep');
  assert.match(coupleRewardContext('a', 'one').text, /玩家哄角色（你）睡觉/);
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.match(String(init?.body), /玩家哄角色（你）睡觉/);
    return answer({ action: 'use', productId: 'sleep', reason: '今晚你哄我睡，好不好？' });
  });
  await generateCoupleRewardAction('a'); assert.match(chat().messages.at(-1).aiContext, /玩家哄角色（你）睡觉/);
  assert.match(toMessageContent(chat().messages.at(-1)), /履约者：玩家/);
  assert.match(toMessageContent({ id: 'legacy-sleep', senderId: 'a', kind: 'couple-coupon', title: '哄睡券', text: '对方使用了哄睡券', createdAt: '' }), /玩家哄角色（你）睡觉/);
  await buyCoupleCoupon('a', 'char', 'emperor', 'buy-emperor'); await useCoupleCoupon('a', 'char', 'emperor', 'use-emperor');
  assert.match(coupleRewardContext('a', 'one').text, /今天由玩家哄着、照顾和迁就角色（你）/);
});

test('a character letter request accepts a handwritten reply once and preserves both the envelope body and completed request',async()=>{
  await used('letter');await assert.rejects(fulfillCoupleLetter('a','request','char',{title:'错了',body:loveLetter}),/另一方/);
  const ids=await Promise.all([fulfillCoupleLetter('a','request','user',{title:'给你',body:loveLetter}),fulfillCoupleLetter('a','request','user',{title:'重复',body:'不能重复'})]);
  assert.equal(ids[0],ids[1]);const letters=chat().messages.filter((m:any)=>m.kind==='couple-letter');assert.equal(letters.length,1);assert.equal(letters[0].content,loveLetter);assert.equal(letters[0].senderId,'user');
  assert.match(toMessageContent(letters[0]),/已寄达的情书/);assert.match(describeForSummary(letters[0]),/窗边的小花/);assert(findCouponUse('a','request')?.fulfilledAt);assert.equal(couponStock(readCoupleWallet('a'),'char','letter'),0);
  assert.equal(chat().messages.find((m:any)=>m.id==='coupon:request').couponFulfillmentId,letters[0].id);
});
test('a player letter request generates one intimate letter with actual history and memory, sharing concurrent requests',async()=>{
  await used('letter','user');let calls=0;
  mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{calls++;assert.match(String(init?.body),/OWN_MEMORY/);assert.match(String(init?.body),/ORIGINAL_PERSONA/);assert.match(String(init?.body),/BOUND_BOOK/);return answer({title:'把日常慢慢写给你',body:loveLetter});});
  await Promise.all([generateCoupleLetter('a','request'),generateCoupleLetter('a','request')]);await generateCoupleLetter('a','request');assert.equal(calls,1);
  assert.equal(chat().messages.filter((m:any)=>m.kind==='couple-letter').length,1);assert.equal(chat().messages.at(-1).senderId,'a');assert(findCouponUse('a','request')?.fulfilledAt);
});
test('failed or incomplete letters stay pending for retry without charging another coupon',async()=>{
  await used('letter','user');mock.method(globalThis,'fetch',async()=>answer({title:'不完整',body:'太短了'}));await assert.rejects(generateCoupleLetter('a','request'),/篇幅/);
  assert(!findCouponUse('a','request')?.fulfilledAt);assert.equal(readCoupleWallet('a').uses.length,1);assert.equal(chat().messages.filter((m:any)=>m.kind==='couple-letter').length,0);
  mock.restoreAll();mock.method(globalThis,'fetch',async()=>answer({title:'给你',body:loveLetter}));await generateCoupleLetter('a','request');assert(findCouponUse('a','request')?.fulfilledAt);
});
test('a changed archive prevents a late letter from being sent to a different timeline',async()=>{
  await used('letter','user');mock.method(globalThis,'fetch',async()=>{const all=read('yyphone:wechat-chats');all[0].activeArchiveId='other';writeStoredValue('yyphone:wechat-chats',all);return answer({title:'给你',body:loveLetter});});
  await assert.rejects(generateCoupleLetter('a','request'),/存档/);assert(!findCouponUse('a','request')?.fulfilledAt);
});
test('a gift purchase pays once, delivers to the requesting character, completes the voucher and excludes sent gifts from player inventory',async()=>{
  await used('gift');await catalog();const request={charId:'a',useId:'request'};
  await Promise.all([fulfillCoupleGift(request,'p1'),fulfillCoupleGift(request,'p1')]);assert.equal(read('yyphone:alipay-data').balance,74.5);
  const orders=chat().messages.filter((m:any)=>m.kind==='order');assert.equal(orders.length,1);assert.equal(orders[0].recipientId,'a');assert.equal(orders[0].senderId,'user');assert(findCouponUse('a','request')?.fulfilledAt);
  assert.equal(read('yyphone:inventory'),null);assert(read('yyphone:memory-items').some((m:any)=>m.gift?.sourceKey===orders[0].id));
});
test('a gift claimed by the player is delivered by the character without charging the player and is put into their box',async()=>{
  await used('gift','user');await catalog(0);await fulfillCoupleGift({charId:'a',useId:'request'},'p1');
  assert.equal(read('yyphone:alipay-data').balance,0);assert.equal(chat().messages.at(-1).senderId,'a');assert.equal(chat().messages.at(-1).recipientId,'user');assert.equal(read('yyphone:inventory').items.length,1);
  assert.equal(read('yyphone:inventory').items[0].fromCharId,'a');assert(findCouponUse('a','request')?.fulfilledAt);assert.equal(readInventory().length,1);assert.equal(readInventory().length,1);
});
test('insufficient funds, stale prices and stale archives never complete the gift voucher or charge money',async()=>{
  await used('gift');await catalog(10);await assert.rejects(fulfillCoupleGift({charId:'a',useId:'request'},'p1'),/余额不足/);assert(!findCouponUse('a','request')?.fulfilledAt);assert.equal(read('yyphone:alipay-data').balance,10);
  await catalog();await assert.rejects(fulfillCoupleGift({charId:'a',useId:'request'},'p1',{type:'balance'},20),/价格已变化/);assert.equal(read('yyphone:alipay-data').balance,100);
  const all=read('yyphone:wechat-chats');all[0].activeArchiveId='other';await setStorageItemsAtomically({'yyphone:wechat-chats':all});await assert.rejects(fulfillCoupleGift({charId:'a',useId:'request'},'p1'),/存档/);assert(!findCouponUse('a','request')?.fulfilledAt);
});
test('a checkout storage failure rolls back payment, delivery, memory and voucher completion together',async()=>{
  await used('gift');await catalog();const keys=['yyphone:alipay-data','yyphone:wechat-chats','yyphone:memory-items',COUPLE_REWARDS_KEY],before=keys.map(readStorageString);
  mock.method(window.localStorage,'setItem',(key:string,value:string)=>{if(key==='yyphone:memory-items')throw new Error('quota');values.set(key,value);});
  await assert.rejects(fulfillCoupleGift({charId:'a',useId:'request'},'p1'),/quota/);assert.deepEqual(keys.map(readStorageString),before);
});
