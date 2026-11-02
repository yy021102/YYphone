import { isObject, nonemptyText } from './divination';
import { readStoredValue } from './localStorage';
import { setStorageItemsAtomically } from './dbStorage';

export const SIP_KEY = 'yyphone:little-sip';
export const SIP_CUPS = [
  { id: 'tall', name: '直身玻璃杯', capacity: 500 },
  { id: 'round', name: '圆圆杯', capacity: 400 },
  { id: 'goblet', name: '高脚杯', capacity: 300 },
  { id: 'martini', name: '马天尼杯', capacity: 200 },
  { id: 'rocks', name: '威士忌古典杯', capacity: 300 },
  { id: 'coffee', name: '咖啡杯', capacity: 350 },
] as const;
export type SipCupId = typeof SIP_CUPS[number]['id'];
export type SipGroup = 'tea' | 'coffee' | 'milk' | 'juice' | 'water' | 'spirit' | 'liqueur' | 'modifier' | 'topping' | 'fruit' | 'syrup' | 'garnish';
export interface SipIngredient { id: string; name: string; group: SipGroup; color: string; unit: 'ml' | 'g'; max: number; shape?: 'pearl' | 'cube' | 'fruit' | 'leaf' }
export const SIP_GROUPS: Record<SipGroup, string> = { tea: '茶底', coffee: '咖啡', milk: '奶与奶盖', juice: '果汁', water: '清水与气泡', spirit: '基酒', liqueur: '利口酒', modifier: '修饰酒', topping: '小料', fruit: '鲜果与香草', syrup: '糖浆', garnish: '顶部装饰' };
export const SIP_INGREDIENTS: SipIngredient[] = [
  { id:'jasmine',name:'茉莉绿茶',group:'tea',color:'#b9c982',unit:'ml',max:500 },
  { id:'oolong',name:'清香乌龙',group:'tea',color:'#c6a267',unit:'ml',max:500 },
  { id:'black-tea',name:'醇香红茶',group:'tea',color:'#a06436',unit:'ml',max:500 },
  { id:'matcha',name:'抹茶液',group:'tea',color:'#719551',unit:'ml',max:500 },
  { id:'espresso',name:'浓缩咖啡',group:'coffee',color:'#52352b',unit:'ml',max:150 },
  { id:'cold-brew',name:'冷萃咖啡',group:'coffee',color:'#765039',unit:'ml',max:400 },
  { id:'milk',name:'鲜牛奶',group:'milk',color:'#fff4de',unit:'ml',max:400 },
  { id:'oat',name:'燕麦奶',group:'milk',color:'#e4d7b8',unit:'ml',max:400 },
  { id:'coconut-milk',name:'椰乳',group:'milk',color:'#f5efdf',unit:'ml',max:400 },
  { id:'cream',name:'轻奶盖',group:'milk',color:'#fff8eb',unit:'ml',max:80 },
  { id:'peach',name:'白桃果汁',group:'juice',color:'#edb6aa',unit:'ml',max:400 },
  { id:'grape',name:'葡萄果汁',group:'juice',color:'#a68ab1',unit:'ml',max:400 },
  { id:'mango-juice',name:'芒果果汁',group:'juice',color:'#efbf57',unit:'ml',max:400 },
  { id:'strawberry-juice',name:'草莓果汁',group:'juice',color:'#da8d96',unit:'ml',max:400 },
  { id:'orange-juice',name:'橙汁',group:'juice',color:'#eeb161',unit:'ml',max:400 },
  { id:'lemon-juice',name:'柠檬汁',group:'juice',color:'#e5d784',unit:'ml',max:100 },
  { id:'apple-juice',name:'苹果汁',group:'juice',color:'#e1c47b',unit:'ml',max:400 },
  { id:'pineapple-juice',name:'凤梨汁',group:'juice',color:'#edcf68',unit:'ml',max:400 },
  { id:'water',name:'清水',group:'water',color:'#e4f0e9',unit:'ml',max:500 },
  { id:'soda',name:'气泡水',group:'water',color:'#d2e7e2',unit:'ml',max:500 },
  { id:'gin',name:'金酒',group:'spirit',color:'#dce4df',unit:'ml',max:100 },
  { id:'rum',name:'朗姆酒',group:'spirit',color:'#c5a274',unit:'ml',max:100 },
  { id:'vodka',name:'伏特加',group:'spirit',color:'#e3e9e4',unit:'ml',max:100 },
  { id:'whisky',name:'威士忌',group:'spirit',color:'#b5844a',unit:'ml',max:100 },
  { id:'tequila',name:'龙舌兰',group:'spirit',color:'#e5d1a2',unit:'ml',max:100 },
  { id:'baileys',name:'百利甜',group:'liqueur',color:'#d6b493',unit:'ml',max:100 },
  { id:'cointreau',name:'君度',group:'liqueur',color:'#e9d8b2',unit:'ml',max:100 },
  { id:'absinthe',name:'苦艾酒',group:'modifier',color:'#b4c58a',unit:'ml',max:40 },
  { id:'pearls',name:'黑糖珍珠',group:'topping',color:'#684b3e',unit:'g',max:80,shape:'pearl' },
  { id:'coconut-jelly',name:'清甜椰果',group:'topping',color:'#f1e7cd',unit:'g',max:80,shape:'cube' },
  { id:'pudding',name:'鸡蛋布丁',group:'topping',color:'#e8c66c',unit:'g',max:80,shape:'cube' },
  { id:'red-bean',name:'蜜红豆',group:'topping',color:'#a46861',unit:'g',max:80,shape:'pearl' },
  { id:'rice-mochi',name:'米麻薯',group:'topping',color:'#f1e7db',unit:'g',max:80,shape:'cube' },
  { id:'purple-rice',name:'血糯米',group:'topping',color:'#754b62',unit:'g',max:80,shape:'pearl' },
  { id:'strawberry',name:'草莓果肉',group:'fruit',color:'#d9858e',unit:'g',max:80,shape:'fruit' },
  { id:'mango',name:'芒果果肉',group:'fruit',color:'#efbb4f',unit:'g',max:80,shape:'cube' },
  { id:'lemon',name:'柠檬片',group:'fruit',color:'#e5d474',unit:'g',max:40,shape:'fruit' },
  { id:'mint',name:'薄荷叶',group:'fruit',color:'#8aaa7e',unit:'g',max:10,shape:'leaf' },
  { id:'honey',name:'蜂蜜糖浆',group:'syrup',color:'#cfab62',unit:'ml',max:40 },
  { id:'brown-sugar',name:'黑糖糖浆',group:'syrup',color:'#886047',unit:'ml',max:40 },
  { id:'garnish-lemon',name:'杯口柠檬片',group:'garnish',color:'#e5d474',unit:'g',max:30 },
  { id:'lemon-peel',name:'柠檬皮',group:'garnish',color:'#e4c75a',unit:'g',max:10 },
  { id:'apple-slice',name:'苹果片',group:'garnish',color:'#d99891',unit:'g',max:40 },
  { id:'garnish-strawberry',name:'装饰草莓',group:'garnish',color:'#d9858e',unit:'g',max:40 },
  { id:'ice-cream',name:'冰淇淋雪顶',group:'garnish',color:'#fff0d6',unit:'g',max:60 },
];
export interface SipPart { id: string; amount: number }
export interface SipRecipe {
  id: string; name: string; cupId: SipCupId; parts: SipPart[]; sweetness: number;
  ice: 'none' | 'light' | 'regular'; finish: 'layered' | 'stirred';
  maker: { name: string; actorId?: string; note?: string }; adapted: boolean;
}
export interface SipTasting {
  id: string; createdAt: string; status: 'pending' | 'done' | 'error'; text: string; error?: string;
}
export interface SipServing { actorId: string; actorName: string; servedAt: string; tastings: SipTasting[] }
export interface SipDrink { id: string; createdAt: string; recipe: SipRecipe; servings: SipServing[] }
export interface SipStore { recipes: SipRecipe[]; drinks: SipDrink[] }
export type SipRequest = { kind: 'recipe'; actorId: string; requirements: string; signal: AbortSignal } |
  { kind: 'taste'; actorId: string; drink: SipDrink; signal: AbortSignal };
export const sipIngredient = (id: string): SipIngredient => {
  const found = SIP_INGREDIENTS.find(i => i.id === id);
  if (!found) throw new Error('材料不在一杯之间的材料柜中，请重新选择。');
  return found;
};
export const sipCup = (id: SipCupId) => SIP_CUPS.find(c => c.id === id)!;
export const sipIce = (r: SipRecipe) => r.ice === 'none' ? 0 : sipCup(r.cupId).capacity * (r.ice === 'light' ? .1 : .2);
export const sipVolume = (r: SipRecipe) => r.parts.reduce((sum,p) => sum + p.amount, 0) + sipIce(r);
export const sipPartsAtStage = (r: SipRecipe, stage: number) => r.parts.filter(p=>{
  const item=sipIngredient(p.id);
  return item.group==='garnish'?stage>=4:item.unit==='ml'?stage>=2:stage>=1;
});
export const sipCategory = (r: SipRecipe): string => {
  const groups = r.parts.map(p => sipIngredient(p.id).group);
  return groups.some(g=>g==='spirit'||g==='liqueur'||g==='modifier') ? '酒饮' : groups.includes('coffee') ? '咖啡' : groups.includes('milk') || r.parts.some(p=>p.id==='ice-cream') ? '奶饮' :
    groups.includes('juice') || groups.includes('fruit') ? '果茶 / 果饮' : '清茶 / 清饮';
};
export const freshSipRecipe = (name: string): SipRecipe => ({ id:`recipe-${crypto.randomUUID()}`, name:'', cupId:'tall', parts:[],
  sweetness:50, ice:'light', finish:'layered', maker:{name}, adapted:false });
export const copySipRecipe = (r: SipRecipe): SipRecipe => ({
  id:r.id,name:r.name,cupId:r.cupId,parts:r.parts.map(p=>({id:p.id,amount:p.amount})),sweetness:r.sweetness,ice:r.ice,finish:r.finish,adapted:r.adapted,
  maker:{name:r.maker.name,...(r.maker.actorId?{actorId:r.maker.actorId}:{}),...(r.maker.note?{note:r.maker.note}:{})},
});
export function validateSipRecipe(r: SipRecipe, complete = true): void {
  if (!SIP_CUPS.some(c => c.id === r.cupId) || !nonemptyText(r.id,200) || typeof r.name !== 'string' || r.name.length > 40 ||
      complete && !r.name.trim() || ![0,25,50,75,100].includes(r.sweetness) ||
      !['none','light','regular'].includes(r.ice) || !['layered','stirred'].includes(r.finish) ||
      typeof r.adapted !== 'boolean' || !isObject(r.maker) || !nonemptyText(r.maker.name,100) ||
      r.maker.actorId !== undefined && !nonemptyText(r.maker.actorId,200) ||
      r.maker.note !== undefined && !nonemptyText(r.maker.note,500)) throw new Error('请核对饮品名称、杯型、糖冰与署名。名称最多 40 字。');
  if (!Array.isArray(r.parts) || r.parts.length > 10 || new Set(r.parts.map(p => p.id)).size !== r.parts.length)
    throw new Error('每杯最多选 10 种材料，同种材料请调整用量，不要重复添加。');
  for (const p of r.parts) {
    if (!isObject(p) || typeof p.id !== 'string') throw new Error('材料格式无效。');
    const item = sipIngredient(p.id);
    if (!Number.isInteger(p.amount) || p.amount < 5 || p.amount > item.max || p.amount % 5 !== 0)
      throw new Error(`${item.name}用量需为 5 的倍数，范围 5～${item.max}${item.unit}。`);
  }
  if (sipVolume(r) > sipCup(r.cupId).capacity) throw new Error('这只杯子装不下啦。请减少材料、少放些冰，或换大一点的杯子。');
  if (complete && r.parts.filter(p => sipIngredient(p.id).unit === 'ml' && sipIngredient(p.id).group !== 'syrup').reduce((n,p) => n+p.amount,0) < 40)
    throw new Error('至少加入 40ml 茶、奶、果汁、咖啡、清水或基酒，再完成这杯饮品。');
}
export function isSipRecipe(v: unknown): v is SipRecipe {
  if (!isObject(v) || !Array.isArray(v.parts) || !v.parts.every((p):p is SipPart => isObject(p) && typeof p.id === 'string' && typeof p.amount === 'number') ||
      typeof v.id !== 'string' || typeof v.name !== 'string' || typeof v.sweetness !== 'number' ||
      v.ice !== 'none' && v.ice !== 'light' && v.ice !== 'regular' || v.finish !== 'layered' && v.finish !== 'stirred' ||
      !isObject(v.maker) || !nonemptyText(v.maker.name,100) || typeof v.adapted !== 'boolean' ||
      v.maker.actorId !== undefined && !nonemptyText(v.maker.actorId,200) ||
      v.maker.note !== undefined && !nonemptyText(v.maker.note,500)) return false;
  const cupId=SIP_CUPS.find(c=>c.id===v.cupId)?.id;
  if(!cupId)return false;
  const checked:SipRecipe={id:v.id,name:v.name,cupId,parts:v.parts,sweetness:v.sweetness,ice:v.ice,finish:v.finish,adapted:v.adapted,
    maker:{name:v.maker.name,...(typeof v.maker.actorId==='string'?{actorId:v.maker.actorId}:{}),...(typeof v.maker.note==='string'?{note:v.maker.note}:{})}};
  try { validateSipRecipe(checked); return true; } catch { return false; }
}
export function parseSipRecipe(text: string, actor: {id:string;name:string}): SipRecipe {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('角色没有返回有效的配方 JSON，请手动重试。'); }
  if (!isObject(value) || typeof value.name !== 'string' || !SIP_CUPS.some(c=>c.id===value.cupId) ||
      !Array.isArray(value.parts) || !value.parts.every(p=>isObject(p)&&typeof p.id==='string'&&typeof p.amount==='number') ||
      typeof value.sweetness !== 'number' || !['none','light','regular'].includes(String(value.ice)) ||
      !['layered','stirred'].includes(String(value.finish)) || !nonemptyText(value.note,500)) throw new Error('角色配方缺少有效的材料、糖冰或留言，请手动重试。');
  const candidate = { ...value, id:`recipe-${crypto.randomUUID()}`, maker:{name:actor.name,actorId:actor.id,note:value.note}, adapted:false };
  if (!isSipRecipe(candidate)) throw new Error('角色的配方不符合材料或杯容量规则，未采用；请修改需求后手动重试。');
  return copySipRecipe(candidate);
}
const dateText = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const isTasting = (v: unknown): v is SipTasting => isObject(v) && nonemptyText(v.id,200) && dateText(v.createdAt) &&
  typeof v.text === 'string' && v.text.length <= 5000 && (v.error === undefined || nonemptyText(v.error,1000)) && (v.status === 'pending' ||
  v.status === 'done' && !!v.text.trim() || v.status === 'error' && nonemptyText(v.error,1000));
export function isSipDrink(v: unknown): v is SipDrink {
  return isObject(v) && nonemptyText(v.id,200) && dateText(v.createdAt) && isSipRecipe(v.recipe) && Array.isArray(v.servings) &&
    v.servings.every(s=>isObject(s)&&nonemptyText(s.actorId,200)&&nonemptyText(s.actorName,100)&&dateText(s.servedAt)&&
      Array.isArray(s.tastings)&&s.tastings.every(isTasting)&&new Set(s.tastings.map(t=>t.id)).size===s.tastings.length) &&
    new Set(v.servings.map(s=>s.actorId)).size===v.servings.length;
}
export const isSipStore = (v: unknown): v is SipStore => isObject(v) && Array.isArray(v.recipes) && v.recipes.every(isSipRecipe) &&
  new Set(v.recipes.map(r=>r.id)).size===v.recipes.length && Array.isArray(v.drinks) && v.drinks.every(isSipDrink) &&
  new Set(v.drinks.map(d=>d.id)).size===v.drinks.length;
export function createSipDrink(recipe: SipRecipe): SipDrink {
  validateSipRecipe(recipe);
  return {id:`sip-${crypto.randomUUID()}`,createdAt:new Date().toISOString(),recipe:copySipRecipe(recipe),servings:[]};
}
export const serveSipDrink = (drink: SipDrink, actor: {id:string;name:string}): SipDrink => drink.servings.some(s=>s.actorId===actor.id) ? drink :
  {...drink, servings:[...drink.servings,{actorId:actor.id,actorName:actor.name,servedAt:new Date().toISOString(),tastings:[]}]};
export const loadSip = (): SipStore => readStoredValue(SIP_KEY,{recipes:[],drinks:[]},isSipStore);
let writes = Promise.resolve();
const listeners = new Set<()=>void>();
export function subscribeSip(listener: ()=>void): ()=>void { listeners.add(listener); return ()=>{listeners.delete(listener);}; }
export function updateSip(change: (s:SipStore)=>SipStore, extra?: (s:SipStore)=>Record<string,unknown>): Promise<void> {
  const pending = writes.then(async()=>{
    const next=change(loadSip());
    if(!isSipStore(next)) throw new Error('饮品记录格式无效，未保存。');
    const additional=extra?.(next)??{};
    if(Object.hasOwn(additional,SIP_KEY)) throw new Error('不能覆盖饮品存储事务。');
    await setStorageItemsAtomically({...additional,[SIP_KEY]:next});
    listeners.forEach(l=>l());
  });
  writes=pending.catch(e=>{console.error('Could not persist Little Sip:',e);});
  return pending;
}
export const patchSipDrink = (id:string,change:(d:SipDrink)=>SipDrink): Promise<void> => updateSip(s=>{
  if(!s.drinks.some(d=>d.id===id))throw new Error('这杯饮品已不在制作记录中。');
  return {...s,drinks:s.drinks.map(d=>d.id===id?change(d):d)};
});
export const recoverSip = (s:SipStore): SipStore => ({...s,drinks:s.drinks.map(d=>({...d,servings:d.servings.map(v=>({...v,
  tastings:v.tastings.map(t=>t.status==='pending'?{...t,status:'error',error:'上次试饮已中断，不会自动重试。'}:t)}))}))});
export function sipRecipeText(r:SipRecipe): string {
  const body=r.parts.filter(p=>sipIngredient(p.id).group!=='garnish'),garnishes=r.parts.filter(p=>sipIngredient(p.id).group==='garnish');
  const describe=(parts:SipPart[])=>parts.map(p=>`${sipIngredient(p.id).name} ${p.amount}${sipIngredient(p.id).unit}`).join('、');
  return [`${r.name} · ${sipCategory(r)}`,`${sipCup(r.cupId).name} / ${sipCup(r.cupId).capacity}ml；${describe(body)}`,
    ...(garnishes.length?[`顶部装饰：${describe(garnishes)}`]:[]),
    `糖度${r.sweetness}%（游戏偏好标签，材料本身也可能含糖）；${{none:'不加冰',light:'少冰',regular:'正常冰'}[r.ice]}；${r.finish==='stirred'?'搅拌均匀':'保留分层'}`,
    `署名：${r.maker.name}${r.adapted?' · 经玩家调整':''}${r.maker.note?`；原配方留言：${r.maker.note}`:''}`,
    '这是虚拟调饮游戏。小料和顶部装饰按1g约占1ml、冰按杯容量估量，仅用于防溢出和插画，不是物理模拟、营养或现实饮用安全建议。'].join('\n');
}
export function sipShareText(d:SipDrink,actorId:string): string {
  if(!isSipDrink(d))throw new Error('饮品记录无效，不能送出。');
  const serving=d.servings.find(s=>s.actorId===actorId);
  if(!serving)throw new Error('尚未为这位角色登记送出的饮品。');
  return ['一杯之间 · Little Sip',`给${serving.actorName}的一杯`,sipRecipeText(d.recipe),
    `制作于${new Date(d.createdAt).toLocaleString('zh-CN')}；送出于${new Date(serving.servedAt).toLocaleString('zh-CN')}`,
    ...serving.tastings.filter(t=>t.status==='done').map(t=>`${serving.actorName}的试饮：\n${t.text}`)].join('\n\n');
}
export function sipMixedColor(parts:SipPart[]): string {
  const liquid=parts.filter(p=>sipIngredient(p.id).unit==='ml'), total=liquid.reduce((n,p)=>n+p.amount,0);
  if(!total)return '#e5eee7';
  const channels=[0,2,4].map(offset=>Math.round(liquid.reduce((n,p)=>n+parseInt(sipIngredient(p.id).color.slice(1+offset,3+offset),16)*p.amount,0)/total));
  return `rgb(${channels.join(',')})`;
}
