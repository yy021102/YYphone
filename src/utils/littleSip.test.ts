import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import SipGlass from '../components/SipGlass';
import {SIP_CUPS,SIP_INGREDIENTS,SIP_KEY,copySipRecipe,createSipDrink,freshSipRecipe,isSipDrink,isSipRecipe,loadSip,parseSipRecipe,
  patchSipDrink,recoverSip,serveSipDrink,sipCategory,sipIce,sipMixedColor,sipPartsAtStage,sipShareText,sipVolume,subscribeSip,updateSip,validateSipRecipe,type SipRecipe} from './littleSip';
import {removeStorageItem,setStorageItemsAtomically} from './dbStorage';
const recipe=():SipRecipe=>({...freshSipRecipe('测试玩家'),name:'晚风桃桃',parts:[{id:'jasmine',amount:150},{id:'milk',amount:150},{id:'pearls',amount:30}]});
const actor={id:'fixture-actor',name:'测试调饮师'};
test('ingredient cabinet is unique, food-only catalogued and measured in bounded five-unit steps',()=>{
  assert.equal(new Set(SIP_INGREDIENTS.map(i=>i.id)).size,SIP_INGREDIENTS.length);
  assert.equal(SIP_CUPS.length,6);
  for(const i of SIP_INGREDIENTS){assert.match(i.color,/^#[0-9a-f]{6}$/i);assert.ok(i.max>=10&&i.max%5===0);assert.ok(['ml','g'].includes(i.unit));}
  const r=recipe();assert.ok(isSipRecipe(r));assert.equal(sipCategory(r),'奶饮');
  assert.equal(sipCategory({...r,parts:[{id:'gin',amount:40},{id:'soda',amount:100}]}),'酒饮');
  assert.equal(sipCategory({...r,parts:[{id:'cold-brew',amount:100}]}),'咖啡');
  assert.equal(sipCategory({...r,parts:[{id:'peach',amount:100}]}),'果茶 / 果饮');
});
test('capacity includes solids and cup-dependent ice with an exact full/overflow boundary',()=>{
  const r=recipe();assert.equal(sipIce(r),50);assert.equal(sipVolume(r),380);
  const full={...r,parts:[{id:'jasmine',amount:270},{id:'milk',amount:150},{id:'pearls',amount:30}]};
  assert.equal(sipVolume(full),500);validateSipRecipe(full);
  assert.throws(()=>validateSipRecipe({...full,parts:[...full.parts.slice(0,2),{id:'pearls',amount:35}]}),/装不下/);
  assert.throws(()=>validateSipRecipe({...full,cupId:'goblet'}),/装不下/);
  assert.equal(sipIce({...r,cupId:'goblet',ice:'regular'}),60);
  assert.equal(sipIce({...r,ice:'none'}),0);
});
test('incomplete drafts are allowed but finished cups reject missing liquid, names, duplicates and invalid measures',()=>{
  validateSipRecipe(freshSipRecipe('玩家'),false);
  assert.throws(()=>createSipDrink(freshSipRecipe('玩家')),/名称/);
  const r=recipe();
  for(const parts of [[{id:'pearls',amount:40}],[{id:'jasmine',amount:35}],[{id:'jasmine',amount:40},{id:'jasmine',amount:40}],[{id:'unknown',amount:100}],[{id:'milk',amount:151}],[{id:'milk',amount:405}]]){
    assert.throws(()=>validateSipRecipe({...r,parts}));
    assert.ok(!isSipRecipe({...r,parts}));
  }
  assert.ok(!isSipRecipe({...r,parts:[null]}));
  assert.ok(!isSipRecipe({...r,sweetness:60}));
});
test('character recipes use only the cabinet and assign trusted authorship without saving or executing extra fields',()=>{
  const proposal={name:'给你的一杯',cupId:'tall',parts:[{id:'oolong',amount:200},{id:'peach',amount:100}],sweetness:25,ice:'light',finish:'layered',note:'想让你喝到一点轻轻的桃香。',maker:{name:'冒充玩家'},transfer:{amount:100}};
  const parsed=parseSipRecipe(JSON.stringify(proposal),actor);
  assert.equal(parsed.maker.name,actor.name);assert.equal(parsed.maker.actorId,actor.id);assert.equal(parsed.adapted,false);
  assert.ok(!Object.hasOwn(parsed,'transfer'));assert.ok(!Object.hasOwn(parsed,'note'));
  assert.throws(()=>parseSipRecipe('not json',actor),/JSON/);
  assert.throws(()=>parseSipRecipe(JSON.stringify({...proposal,parts:[{id:'unknown',amount:100}]}),actor),/未采用/);
  assert.throws(()=>parseSipRecipe(JSON.stringify({...proposal,parts:[{id:'oolong',amount:500}]}),actor),/未采用/);
});
test('finished cups and separate remakes retain independent recipe snapshots and tasting provenance',()=>{
  const r=recipe(),first=createSipDrink(r),second=createSipDrink(r);
  assert.notEqual(first.id,second.id);r.parts[0].amount=10;r.name='改掉的名字';r.maker.name='改掉的署名';
  assert.equal(first.recipe.parts[0].amount,150);assert.equal(first.recipe.name,'晚风桃桃');
  const delivered=serveSipDrink(first,actor),again=serveSipDrink(delivered,actor);
  assert.equal(first.servings.length,0);assert.equal(again.servings.length,1);assert.equal(again.servings[0].servedAt,delivered.servings[0].servedAt);
  assert.throws(()=>sipShareText(first,actor.id),/尚未/);
  delivered.servings[0].tastings=[{id:'done',createdAt:first.createdAt,status:'done',text:'喜欢这份香气'}, {id:'pending',createdAt:first.createdAt,status:'pending',text:'不可分享的半句'}];
  const text=sipShareText(delivered,actor.id);assert.match(text,/测试调饮师/);assert.match(text,/喜欢这份香气/);assert.ok(!text.includes('不可分享的半句'));
  assert.match(text,/150ml/);assert.match(text,/30g/);
  const recovered=recoverSip({recipes:[],drinks:[delivered]});
  assert.equal(recovered.drinks[0].servings[0].tastings[1].status,'error');assert.equal(delivered.servings[0].tastings[1].status,'pending');
  assert.ok(isSipDrink(recovered.drinks[0]));
});
test('color blending is volume weighted, deterministic and ignores solids',()=>{
  const parts=[{id:'milk',amount:100},{id:'black-tea',amount:100}];
  assert.equal(sipMixedColor(parts),'rgb(208,172,138)');
  assert.equal(sipMixedColor([...parts,{id:'pearls',amount:50}]),sipMixedColor(parts));
  assert.equal(sipMixedColor([]),'#e5eee7');
  const original=recipe(),copy=copySipRecipe(original);copy.parts[0].amount=10;assert.equal(original.parts[0].amount,150);
});
test('recipe guards reject invalid cup, finish, sugar and provenance without trusting coercible values',()=>{
  const r=recipe();
  for(const patch of [{cupId:'unknown'},{ice:null},{finish:'shaken'},{sweetness:NaN},{name:' '},{name:'x'.repeat(41)},{maker:{name:''}},{maker:{name:'玩家',actorId:123}},{maker:{name:'玩家',note:{text:'invalid'}}}]){
    assert.equal(isSipRecipe({...r,...patch}),false);
  }
  const parts=SIP_INGREDIENTS.slice(0,10).map(i=>({id:i.id,amount:5}));
  validateSipRecipe({...r,parts});
  assert.throws(()=>validateSipRecipe({...r,parts:[...parts,{id:'peach',amount:5}]}),/最多选 10 种/);
  assert.throws(()=>validateSipRecipe({...r,parts:[{id:'honey',amount:40}]}),/至少加入 40ml/);
});
test('each recipient has independent feedback and sharing never exposes another recipient or failed attempts',()=>{
  const original=serveSipDrink(createSipDrink(recipe()),actor);
  original.servings[0].tastings=[{id:'a',createdAt:original.createdAt,status:'done',text:'甲的独有反馈'}];
  const shared=serveSipDrink(original,{id:'other',name:'另一位'});
  shared.servings[1].tastings=[{id:'b',createdAt:original.createdAt,status:'error',text:'半句',error:'错误原因'}];
  const second=sipShareText(shared,'other');
  assert.ok(!second.includes('甲的独有反馈'));assert.ok(!second.includes('错误原因'));assert.ok(!second.includes('半句'));
  assert.match(sipShareText(shared,actor.id),/甲的独有反馈/);
  assert.equal(isSipDrink({...shared,servings:[...shared.servings,shared.servings[0]]}),false);
  assert.equal(isSipDrink({...shared,servings:[{...shared.servings[0],tastings:[{...shared.servings[0].tastings[0],error:42}]}]}),false);
});
test('expanded cups enforce their own exact capacity including ice and top decorations',()=>{
  assert.deepEqual(SIP_CUPS.slice(3).map(c=>[c.id,c.capacity]),[['martini',200],['rocks',300],['coffee',350]]);
  for(const cup of SIP_CUPS){
    const r:SipRecipe={...recipe(),cupId:cup.id,parts:[],ice:'light'};
    r.parts=[{id:'water',amount:cup.capacity-sipIce(r)-10},{id:'garnish-lemon',amount:10}];
    validateSipRecipe(r);assert.equal(sipVolume(r),cup.capacity);
    assert.throws(()=>validateSipRecipe({...r,parts:[r.parts[0],{id:'garnish-lemon',amount:15}]}),/装不下/);
    assert.ok(isSipRecipe(r));
    const proposed=parseSipRecipe(JSON.stringify({...r,note:'为你试试这个杯型。'}),actor);
    assert.equal(proposed.cupId,cup.id);assert.deepEqual(proposed.parts,r.parts);
  }
});
test('liqueurs and modifiers are always alcoholic, including milk-coloured Baileys',()=>{
  for(const id of ['tequila','baileys','cointreau','absinthe']){
    const r={...recipe(),parts:[{id,amount:40},{id:'milk',amount:50}]};
    validateSipRecipe(r);assert.equal(sipCategory(r),'酒饮');
    assert.match(sipShareText(serveSipDrink(createSipDrink(r),actor),actor.id),/酒饮/);
  }
  for(const id of ['apple-juice','pineapple-juice'])assert.equal(sipCategory({...recipe(),parts:[{id,amount:100}]}),'果茶 / 果饮');
});
test('bottom fillings and top garnishes stay separate through stages, mixing and immutable snapshots',()=>{
  const r:SipRecipe={...recipe(),parts:[{id:'lemon',amount:10},{id:'rice-mochi',amount:10},{id:'purple-rice',amount:10},{id:'milk',amount:100},
    {id:'garnish-lemon',amount:10},{id:'lemon-peel',amount:5},{id:'apple-slice',amount:10},{id:'garnish-strawberry',amount:10},{id:'ice-cream',amount:30}]};
  validateSipRecipe(r);
  assert.equal(sipPartsAtStage(r,0).length,0);
  assert.equal(sipPartsAtStage(r,1).length,3);
  assert.equal(sipPartsAtStage(r,2).length,4);
  assert.equal(sipPartsAtStage(r,3).length,4);
  assert.equal(sipPartsAtStage(r,4).length,9);
  assert.deepEqual(sipPartsAtStage(r,4),sipPartsAtStage(r,5));
  assert.equal(sipMixedColor(r.parts),'rgb(255,244,222)');
  const made=createSipDrink(r),shared=serveSipDrink(made,actor);
  r.parts.pop();
  assert.equal(made.recipe.parts.length,9);assert.ok(isSipDrink(JSON.parse(JSON.stringify(made))));
  const text=sipShareText(shared,actor.id);assert.match(text,/顶部装饰：杯口柠檬片 10g、柠檬皮 5g、苹果片 10g、装饰草莓 10g、冰淇淋雪顶 30g/);
  assert.match(text,/米麻薯 10g、血糯米 10g/);
});
test('all six original SVG cup shapes render cleanly and decorations remain above the glass when stirred',()=>{
  const paths=new Set<string>();
  for(const cup of SIP_CUPS){
    const r:SipRecipe={...recipe(),cupId:cup.id,parts:[{id:'milk',amount:100},{id:'rice-mochi',amount:10},{id:'garnish-lemon',amount:10},{id:'ice-cream',amount:30}],finish:'stirred'};
    for(let stage=0;stage<=5;stage++){
      const svg=renderToStaticMarkup(createElement(SipGlass,{recipe:r,stage}));
      assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('undefined'));assert.ok(svg.includes(cup.name));
      assert.equal(svg.includes('data-sip-garnish="ice-cream"'),stage>=4);
      assert.equal(svg.includes('data-sip-garnish="garnish-lemon"'),stage>=4);
      assert.equal(svg.includes('sip-is-stirred'),stage===5);
      if(stage===5){paths.add(svg.match(/<clipPath[^>]*><path d="([^"]+)"/)![1]);assert.ok(svg.indexOf('data-sip-garnish')>svg.lastIndexOf('clip-path='));}
    }
  }
  assert.equal(paths.size,6);
});
test('menu, serving and chat-card transactions are durable, serialized and recover cleanly after failure',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),values=new Map<string,string>();
  let deny=false,notifications=0;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{
    get length(){return values.size;},key:(i:number)=>[...values.keys()][i]??null,getItem:(k:string)=>values.get(k)??null,
    setItem:(k:string,v:string)=>{if(deny)throw new Error('fixture write denied');values.set(k,v);},removeItem:(k:string)=>values.delete(k),
  }}});
  const unsub=subscribeSip(()=>notifications++);
  try{
    await setStorageItemsAtomically({[SIP_KEY]:{recipes:[],drinks:[]}});
    const r=recipe(),drink=createSipDrink(r);
    await Promise.all([updateSip(s=>({...s,recipes:[r,...s.recipes]})),updateSip(s=>({...s,drinks:[drink,...s.drinks]}))]);
    assert.equal(notifications,2);assert.equal(loadSip().recipes.length,1);assert.equal(loadSip().drinks.length,1);
    deny=true;
    await assert.rejects(updateSip(s=>({...s,drinks:s.drinks.map(d=>serveSipDrink(d,actor))}),()=>({'fixture-chat':{card:'drink'}})),/denied/);
    assert.equal(loadSip().drinks[0].servings.length,0);assert.equal(values.has('fixture-chat'),false);
    deny=false;
    await updateSip(s=>({...s,drinks:s.drinks.map(d=>serveSipDrink(d,actor))}),()=>({'fixture-chat':{card:'drink'}}));
    assert.equal(loadSip().drinks[0].servings.length,1);assert.ok(values.has('fixture-chat'));
    await updateSip(s=>({...s,recipes:[]}));
    assert.equal(loadSip().drinks[0].recipe.name,r.name);
    await assert.rejects(patchSipDrink('missing',d=>d),/不在/);
    await assert.rejects(updateSip(s=>s,()=>({[SIP_KEY]:{}})),/不能覆盖/);
    assert.equal(loadSip().drinks.length,1);
  }finally{unsub();deny=false;await removeStorageItem(SIP_KEY);await removeStorageItem('fixture-chat');if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
