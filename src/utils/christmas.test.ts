import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { clearDbStorage } from './dbStorage';
import { writeStoredValue } from './localStorage';
import { CHRISTMAS_KEY, christmasDue, prepareChristmasGift, readChristmasYears, readChristmasUnlocked, saveChristmasWish, unlockChristmasTheme, updateChristmasYear } from './christmas';
import { isPersonaRecordKey } from './personaStorage';
const values = new Map<string,string>();
Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:()=>true,localStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k),clear:()=>values.clear(),key:(i:number)=>[...values.keys()][i]??null,get length(){return values.size}}}});
beforeEach(async()=>{await clearDbStorage();writeStoredValue('pocketos:wechat-contacts',[{id:'a',name:'林渡',persona:'安静、独立思考',avatarUrl:'PHOTO_NOT_CONTEXT',worldBooks:[]}]);writeStoredValue('yyphone:api-presets',[{id:'api',name:'test',endpoint:'https://test.invalid/v1',apiKey:'test',model:'test'}]);});
afterEach(()=>mock.restoreAll());
test('local midnight separates wishing from gifts, with year-specific seen records and late pickup',()=>{
 assert.equal(christmasDue({},new Date(2026,11,23)),null);
 assert.deepEqual(christmasDue({},new Date(2026,11,24,23,59)),{year:2026,phase:'wish'});
 assert.equal(christmasDue({'2026':{eveSeen:true}},new Date(2026,11,24)),null);
 assert.deepEqual(christmasDue({'2026':{eveSeen:true}},new Date(2026,11,25,0,0)),{year:2026,phase:'gifts'});
 assert.equal(christmasDue({'2026':{giftSeen:true}},new Date(2026,11,25)),null);
 assert.deepEqual(christmasDue({'2026':{wish:{text:'愿望',characterId:'a'}}},new Date(2027,0,3)),{year:2026,phase:'gifts'});
 assert.deepEqual(christmasDue({'2026':{giftSeen:true}},new Date(2027,11,24)),{year:2027,phase:'wish'});
});
test('wishes validate character and cannot be rewritten after Christmas midnight',async()=>{
 await saveChristmasWish(2026,{text:'多一点自由',characterId:'a'},new Date(2026,11,24));
 await assert.rejects(saveChristmasWish(2026,{text:'new',characterId:'a'},new Date(2026,11,25)));
 await assert.rejects(saveChristmasWish(2026,{text:'wrong',characterId:'missing'},new Date(2026,11,24)));
 assert.equal(readChristmasYears()[2026].wish?.text,'多一点自由');
});
test('serialized year patches preserve wishes, gifts and seen flags; reward is shared, wishes are persona scoped',async()=>{
 await Promise.all([updateChristmasYear(2026,{eveSeen:true}),updateChristmasYear(2026,{wish:{text:'愿望',characterId:'a'}})]);
 assert(readChristmasYears()[2026].eveSeen);assert(readChristmasYears()[2026].wish);
 await unlockChristmasTheme();await unlockChristmasTheme();assert(readChristmasUnlocked());
 assert(isPersonaRecordKey(CHRISTMAS_KEY));assert(!isPersonaRecordKey('yyphone:christmas-reward'));
});
const answer=()=>Response.json({choices:[{message:{content:JSON.stringify({name:'一盏阅读灯',description:'一盏暖色的小灯，留给你的冬夜。',blessing:'愿你在自己的时间里，做想做的事。不是每一个愿望都需要今天兑现，空下来的时间，也不必马上被填满。圣诞快乐。'})}}]});
test('gift request uses the selected wish, stores complete results, and reopens without another API call',async()=>{
 await updateChristmasYear(2026,{wish:{text:'多一点自由',characterId:'a'}});let calls=0;
 mock.method(globalThis,'fetch',async(_url:unknown,init:RequestInit)=>{calls++;assert(String(init.body).includes('多一点自由'));assert(!String(init.body).includes('PHOTO_NOT_CONTEXT'));return answer()});
 const gift=await prepareChristmasGift(2026,new AbortController().signal);assert.equal(gift.characterName,'林渡');assert.equal(readChristmasYears()[2026].gift?.name,'一盏阅读灯');
 await prepareChristmasGift(2026,new AbortController().signal);assert.equal(calls,1);
});
test('failed or aborted generation leaves the wish available and never records an incomplete gift',async()=>{
 await updateChristmasYear(2026,{wish:{text:'愿望',characterId:'a'}});
 mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{content:'{}'}}]}));
 await assert.rejects(prepareChristmasGift(2026,new AbortController().signal));assert(!readChristmasYears()[2026].gift);
 const controller=new AbortController();controller.abort();await assert.rejects(prepareChristmasGift(2026,controller.signal));assert(readChristmasYears()[2026].wish);
});
test('a changed wish during generation rejects the stale gift and preserves the new wish',async()=>{
 await updateChristmasYear(2026,{wish:{text:'原来的愿望',characterId:'a'}});
 mock.method(globalThis,'fetch',async()=>{await updateChristmasYear(2026,{wish:{text:'修改后的愿望',characterId:'a'}});return answer()});
 await assert.rejects(prepareChristmasGift(2026,new AbortController().signal));
 assert.equal(readChristmasYears()[2026].wish?.text,'修改后的愿望');assert(!readChristmasYears()[2026].gift);
});
