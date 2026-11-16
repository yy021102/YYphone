import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canOpenChristmas, christmasReleased, readChristmasDebugAccess, unlockChristmasDebug } from './christmasAccess';
import { canChooseChristmasTheme } from './christmas';
const session = new Map<string,string>();let eventCount=0;
Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:{getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,v)},dispatchEvent:()=>{eventCount++;return true}}});
test('the early entry stays locked; the formal event opens on local Christmas Eve',()=>{
 assert.equal(christmasReleased(new Date(2026,11,23,23,59)),false);
 assert.equal(christmasReleased(new Date(2026,11,24)),true);
 assert.equal(canOpenChristmas(new Date(2026,10,16)),false);
 assert.equal(readChristmasDebugAccess(),false);
});
test('wrong passwords do not grant access; correct password enables session-only early theme testing',async()=>{
 assert.equal(await unlockChristmasDebug('wrong'),false);assert.equal(readChristmasDebugAccess(),false);assert.equal(session.size,0);
 assert.equal(await unlockChristmasDebug('1102'),true);assert(readChristmasDebugAccess());assert(canOpenChristmas(new Date(2026,10,16)));assert(canChooseChristmasTheme());
 assert.equal(eventCount,1);assert.equal(session.size,1);assert(![...session.values()].includes('1102'));
});
