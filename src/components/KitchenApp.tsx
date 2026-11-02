import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookHeart, Check, ChefHat, CookingPot, Heart, Loader2, Plus, Send, Sparkles, Trash2, Upload, UtensilsCrossed, X } from 'lucide-react';
import { compressImage } from '../utils/imageFile';
import {
  copyKitchenRecipe, createKitchenMeal, emptyKitchen, freshKitchenRecipe, KITCHEN_GROUPS, KITCHEN_METHODS,
  KITCHEN_PLATES, KITCHEN_TYPES, kitchenAmount, kitchenIngredient, kitchenIngredients, kitchenRecipeText, kitchenType,
  loadKitchen, parseKitchenRecipe, patchKitchenMeal, recoverKitchen, saveKitchenMeal, subscribeKitchen, updateKitchen, validateKitchenRecipe,
  type KitchenCategory, type KitchenGroup, type KitchenMeal, type KitchenRecipe, type KitchenRequest, type KitchenStore,
} from '../utils/kitchen';
import type { ActivityChatScope } from '../utils/activityChat';
import type { KitchenRecordRequest, KitchenResponse } from '../utils/kitchenContext';
import { KitchenArt, KitchenIngredientArt } from './KitchenArt';
import './kitchen.css';

interface Props {
  userName: string; people: { id: string; name: string }[];
  onRequest: (request: KitchenRequest) => Promise<KitchenResponse>;
  onRecord: (request: KitchenRecordRequest) => Promise<KitchenMeal>;
  onServe: (mealId: string, actorId: string) => Promise<void>;
}
type View = 'make' | 'recipes' | 'table' | 'meal';
interface Draft { recipe: KitchenRecipe; scope?: ActivityChatScope }
const errorText = (error: unknown) => error instanceof Error ? error.message : '这次操作没有完成，请手动重试。';
const steps = ['挑选料理', '搭配食材', '做法与调味', '摆盘与命名'];
function readKitchen(): { value: KitchenStore | null; error: string } {
  try { return { value: loadKitchen(), error: '' }; }
  catch (error) { console.error('Could not load kitchen:', error); return { value: null, error: errorText(error) }; }
}
export default function KitchenApp({ userName, people, onRequest, onRecord, onServe }: Props) {
  const [storage, setStorage] = useState(readKitchen), [view, setView] = useState<View>('make');
  const [category, setCategory] = useState<KitchenCategory>('dish'), [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<KitchenCategory, Draft>>(() => ({
    dish: { recipe: freshKitchenRecipe(userName) }, dessert: { recipe: freshKitchenRecipe(userName, 'cake') },
  }));
  const [group, setGroup] = useState<KitchenGroup>('vegetable'), [mealId, setMealId] = useState('');
  const [actorId, setActorId] = useState(people[0]?.id ?? ''), [requirements, setRequirements] = useState('');
  const [proposal, setProposal] = useState<{ recipe: KitchenRecipe; scope: ActivityChatScope } | null>(null);
  const [syncCreation, setSyncCreation] = useState(false), [syncTaste, setSyncTaste] = useState(false), [serveConsent, setServeConsent] = useState(false);
  const [busy, setBusy] = useState(false), [working, setWorking] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<{ kind: 'recipe' | 'meal'; id: string } | null>(null);
  const root = useRef<HTMLElement>(null), mounted = useRef(true), operation = useRef(false);
  const request = useRef<{ controller: AbortController; mealId?: string; actorId: string; tastingId: string } | null>(null);
  const report = (cause: unknown) => { if (mounted.current) setError(errorText(cause)); else console.error('Kitchen operation failed after unmount:', cause); };
  const cancel = () => {
    const active = request.current;
    if (!active) return;
    request.current = null; active.controller.abort();
    if (mounted.current) { setBusy(false); setNotice('已取消，不会自动重试。'); }
    if (active.mealId) void patchKitchenMeal(active.mealId, meal => ({ ...meal, servings: meal.servings.map(s => s.actorId === active.actorId
      ? { ...s, tastings: s.tastings.map(t => t.id === active.tastingId && t.status === 'pending'
        ? { ...t, status: 'error', error: '本次品尝已取消，不会自动重试。' } : t) } : s) })).catch(report);
  };
  useEffect(() => {
    mounted.current = true;
    const refresh = () => setStorage(readKitchen());
    const unsubscribe = subscribeKitchen(refresh);
    const current = readKitchen();
    if (current.value?.meals.some(m => m.servings.some(s => s.tastings.some(t => t.status === 'pending'))))
      void updateKitchen(recoverKitchen).catch(report);
    return () => { mounted.current = false; unsubscribe(); cancel(); };
  }, []);
  useEffect(() => {
    let node = root.current?.parentElement ?? null;
    while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node = node.parentElement;
    node?.scrollTo({ top: 0 });
  }, [view, step, category, mealId]);
  useEffect(() => {
    const target = deleting ? '.kitchen-confirm' : error ? '[role="alert"]' : notice ? '[role="status"]' : '';
    if (target) root.current?.querySelector(target)?.scrollIntoView({ block: 'nearest' });
  }, [error, notice, deleting]);
  const disabled = busy || working;
  const draft = drafts[category].recipe, scope = drafts[category].scope;
  const type = kitchenType(draft.typeId), ingredients = kitchenIngredients(draft.typeId);
  const groups = Object.keys(KITCHEN_GROUPS).filter((key): key is KitchenGroup => ingredients.some(i => i.group === key));
  const shownGroup = groups.includes(group) ? group : groups[0];
  const store = storage.value ?? emptyKitchen();
  const meal = store.meals.find(item => item.id === mealId);
  const actor = people.find(person => person.id === actorId);
  const serving = meal?.servings.find(item => item.actorId === actorId);
  const go = (next: View) => { cancel(); setView(next); setError(''); setNotice(''); setDeleting(null); setSyncTaste(false); setSyncCreation(false); setServeConsent(false); };
  const change = (next: KitchenRecipe) => {
    if (JSON.stringify(next) === JSON.stringify(draft)) return;
    const changed = { ...next, adapted: next.adapted || !!next.maker.actorId };
    try { validateKitchenRecipe(changed, false); setDrafts(current => ({ ...current, [category]: { ...current[category], recipe: changed } })); setError(''); }
    catch (cause) { report(cause); }
  };
  const run = async (action: () => Promise<void>) => {
    if (operation.current || request.current) return;
    operation.current = true; setWorking(true); setError(''); setNotice('');
    try { await action(); } catch (cause) { report(cause); }
    finally { operation.current = false; if (mounted.current) setWorking(false); }
  };
  const showMeal = (id: string) => { setMealId(id); go('meal'); };
  const restart = (recipe?: KitchenRecipe) => {
    const next = recipe ? { ...copyKitchenRecipe(recipe), id: `recipe-${crypto.randomUUID()}`, maker: { name: userName },
      adapted: false, origin: `参考${recipe.maker.name}的「${recipe.name}」配方`.slice(0, 200) } : freshKitchenRecipe(userName, category === 'dish' ? 'rice' : 'cake');
    const target = kitchenType(next.typeId).category;
    setDrafts(current => ({ ...current, [target]: { recipe: next } }));
    setCategory(target); setStep(0); setProposal(null); go('make');
  };
  const complete = () => void run(async () => {
    validateKitchenRecipe(draft);
    let made: KitchenMeal;
    if (scope) made = await onRecord({ kind: 'recipe', recipe: draft, scope, syncToChat: syncCreation });
    else {
      made = createKitchenMeal(draft);
      await updateKitchen(state => {
        const next = saveKitchenMeal(state, made);
        made = next.meals.find(item => item.recipe.id === draft.id) ?? made;
        return next;
      });
    }
    if (!mounted.current) return;
    setDrafts(current => ({ ...current, [category]: { recipe: freshKitchenRecipe(userName, draft.typeId) } }));
    setStep(0);
    showMeal(made.id); setNotice('料理已上桌，配方也已收入料理本。');
  });
  const requestAI = async (kind: 'recipe' | 'taste') => {
    if (request.current || operation.current) return;
    if (!actor) { setError('请先选择仍在微信通讯录中的角色。'); return; }
    if (kind === 'taste' && (!meal || !serving)) { setError('先送出料理卡片，再邀请 TA 品尝。'); return; }
    const active = { controller: new AbortController(), mealId: kind === 'taste' ? meal?.id : undefined, actorId: actor.id, tastingId: `taste-${crypto.randomUUID()}` };
    request.current = active; setBusy(true); setError(''); setNotice('');
    if (kind === 'recipe') setProposal(null);
    try {
      if (kind === 'taste' && meal) await patchKitchenMeal(meal.id, item => ({ ...item, servings: item.servings.map(s => s.actorId === actor.id
        ? { ...s, tastings: [...s.tastings, { id: active.tastingId, createdAt: new Date().toISOString(), status: 'pending', text: '' }] } : s) }));
      active.controller.signal.throwIfAborted();
      const input: KitchenRequest = kind === 'recipe' ? { kind, actorId: actor.id, category, requirements, signal: active.controller.signal }
        : meal ? { kind, actorId: actor.id, meal, signal: active.controller.signal } : (() => { throw new Error('这份料理已不存在。'); })();
      const result = await onRequest(input);
      active.controller.signal.throwIfAborted();
      if (kind === 'recipe') { setProposal({ recipe: parseKitchenRecipe(result.text, actor, category), scope: result.scope }); setSyncCreation(false); }
      else if (meal) {
        const text = result.text.trim();
        if (!text || text.length > 5000) throw new Error('角色的品尝反馈为空或过长，请手动重试。');
        await onRecord({ kind: 'taste', mealId: meal.id, tastingId: active.tastingId, text, scope: result.scope, syncToChat: syncTaste, signal: active.controller.signal });
        if (mounted.current) setNotice(syncTaste ? '品尝已保存，也同步到了角色当前存档的私聊。' : '品尝已保存，只留在这张餐桌。');
      }
    } catch (cause) {
      if (active.mealId && !active.controller.signal.aborted) {
        try { await patchKitchenMeal(active.mealId, item => ({ ...item, servings: item.servings.map(s => s.actorId === active.actorId
          ? { ...s, tastings: s.tastings.map(t => t.id === active.tastingId && t.status === 'pending'
            ? { ...t, status: 'error', error: errorText(cause).slice(0, 1000) } : t) } : s) })); }
        catch (saveError) { console.error('Could not mark kitchen tasting as failed:', saveError); report(saveError); }
      }
      if (!active.controller.signal.aborted) report(cause);
    } finally { if (request.current === active) { request.current = null; if (mounted.current) setBusy(false); } }
  };
  const picker = <label>这次和谁一起<select aria-label="选择厨房角色" value={actorId} disabled={disabled} onChange={event => { setActorId(event.target.value); setServeConsent(false); setSyncTaste(false); setSyncCreation(false); setProposal(null); }}>
    <option value="">选择一位角色</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
  </select>{!people.length && <small>先在微信添加角色，就能请 TA 下厨或一起品尝。</small>}</label>;
  if (!storage.value) return <section className="kitchen-app" ref={root}><div role="alert" className="kitchen-error">{storage.error}</div><button type="button" className="kitchen-secondary" onClick={() => setStorage(readKitchen())}>重新读取厨房记录</button></section>;
  return <section className="kitchen-app" data-category={category} ref={root} aria-label="私人小厨房">
    <header className="kitchen-hero"><span className="kitchen-eyebrow">A LITTLE KITCHEN, A LOT OF LOVE</span><div><h2>把喜欢，做成一餐。</h2><ChefHat size={35} strokeWidth={1}/></div><p>不赶时间，不数食材。只留一点好好吃饭的心情。</p></header>
    <nav className="kitchen-nav" aria-label="厨房导航">{([
      ['make', '厨房', CookingPot], ['recipes', '料理本', BookHeart], ['table', '餐桌', UtensilsCrossed],
    ] as const).map(([id, name, Icon]) => <button type="button" key={id} disabled={working} aria-pressed={view === id || id === 'table' && view === 'meal'} onClick={() => go(id)}><Icon size={16}/>{name}</button>)}</nav>
    {(view !== 'meal') && <div className="kitchen-category" aria-label="料理分类">{(['dish', 'dessert'] as const).map(id => <button type="button" key={id} disabled={disabled} aria-pressed={category === id} onClick={() => {
      if (category === id) return;
      setCategory(id); setStep(0); setGroup(id === 'dish' ? 'vegetable' : 'fruit'); setProposal(null); setError(''); setNotice(''); setSyncCreation(false);
    }}>{id === 'dish' ? '今日菜品' : '甜品时间'}<small>{id === 'dish' ? 'SOMETHING WARM' : 'SOMETHING SWEET'}</small></button>)}</div>}
    {error && <div role="alert" className="kitchen-error">{error}<button type="button" aria-label="关闭厨房提示" onClick={() => setError('')}><X size={15}/></button></div>}
    {notice && <p role="status" className="kitchen-notice">{notice}</p>}
    {busy && <div className="kitchen-pending" role="status"><Loader2 size={16} className="kitchen-spin"/>TA 正在认真准备……<button type="button" onClick={cancel}>取消请求</button></div>}
    {deleting && <section className="kitchen-confirm" aria-label="确认删除"><strong>要收起这份{deleting.kind === 'recipe' ? '配方' : '成品与用餐回忆'}吗？</strong><p>{deleting.kind === 'recipe' ? '不会删除已经上桌的料理和品尝记录。' : '会删除这份成品及其品尝记录；料理本和已发送的聊天卡片不会被删除。'}</p><div className="kitchen-actions">
      <button type="button" className="kitchen-danger" disabled={disabled} onClick={() => void run(async () => {
        await updateKitchen(state => deleting.kind === 'recipe' ? { ...state, recipes: state.recipes.filter(r => r.id !== deleting.id) }
          : { ...state, meals: state.meals.filter(m => m.id !== deleting.id) });
        setDeleting(null); if (deleting.kind === 'meal') go('table'); setNotice('已删除，其他记录没有改变。');
      })}>确认删除</button><button type="button" className="kitchen-secondary" disabled={disabled} onClick={() => setDeleting(null)}>保留它</button></div></section>}
    {view === 'make' && <>
      <div className="kitchen-preview"><span className="kitchen-preview-note">FOR SOMEONE SPECIAL</span><KitchenArt recipe={draft}/><span className="kitchen-preview-name">{draft.name || type.name}</span><small>{type.subtitle}</small></div>
      <ol className="kitchen-steps" aria-label="制作步骤">{steps.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check size={12}/> : index + 1}</span><small>{label}</small></li>)}</ol>
      <section className="kitchen-paper kitchen-workbench"><span className="kitchen-eyebrow">STEP {String(step + 1).padStart(2, '0')}</span><h3>{['今天想做点什么？', '把喜欢的食材放进来', '用你喜欢的方式完成', '摆好盘，写下一点心意'][step]}</h3>
        {step === 0 && <div className="kitchen-types">{KITCHEN_TYPES.filter(t => t.category === category).map(t => <button type="button" key={t.id} disabled={disabled} aria-pressed={draft.typeId === t.id} onClick={() => {
          if (t.id === draft.typeId) return;
          const available = kitchenIngredients(t.id);
          const retained = draft.parts.filter(p => available.some(i => i.id === p.id));
          change({ ...draft, typeId: t.id, method: t.methods[0], parts: [...t.base.filter(id => !retained.some(p => p.id === id)).map(id => ({ id, amount: 2 })), ...retained] });
        }}><KitchenArt compact recipe={freshPreview(draft, t.id)}/><strong>{t.name}</strong><small>{t.subtitle}</small></button>)}</div>}
        {step === 1 && <>
          <div className="kitchen-groups" aria-label="食材分类">{groups.map(id => <button type="button" key={id} disabled={disabled} aria-pressed={shownGroup === id} onClick={() => setGroup(id)}>{KITCHEN_GROUPS[id]}</button>)}</div>
          <div className="kitchen-ingredients">{ingredients.filter(i => i.group === shownGroup).map(ingredient => {
            const included = draft.parts.find(p => p.id === ingredient.id), full = included?.amount === 3;
            return <button type="button" key={ingredient.id} aria-label={`添加${ingredient.name}`} disabled={disabled || full || !included && draft.parts.length >= 16} onClick={() => change({ ...draft,
              parts: included ? draft.parts.map(p => p.id === ingredient.id ? { ...p, amount: p.amount + 1 } : p) : [...draft.parts, { id: ingredient.id, amount: 1 }] })}>
              <span><KitchenIngredientArt ingredient={ingredient}/></span><strong>{ingredient.name}</strong><small>{full ? '已经放得满满的' : included ? '再放一点进去' : '放一点进去'}</small>{full ? <Check size={12}/> : <Plus size={12}/>}</button>;
          })}</div>
          <div className="kitchen-parts"><span className="kitchen-field-title">这份料理里 · {draft.parts.length}/16</span>{draft.parts.map(part => <div key={part.id} className="kitchen-part"><span>{kitchenIngredient(part.id).name}</span><div>{[1, 2, 3].map(amount =>
            <button type="button" key={amount} aria-label={`${kitchenIngredient(part.id).name}用量${kitchenAmount(amount)}`} disabled={disabled} aria-pressed={part.amount === amount} onClick={() => change({ ...draft, parts: draft.parts.map(p => p.id === part.id ? { ...p, amount } : p) })}>{kitchenAmount(amount)}</button>)}</div><button type="button" aria-label={`移除${kitchenIngredient(part.id).name}`} disabled={disabled} onClick={() => change({ ...draft, parts: draft.parts.filter(p => p.id !== part.id) })}><X size={14}/></button></div>)}</div>
          <p className="kitchen-help">基础食材已替你放好。食材可以连续点按，从少许加到多一点，盘中会分散铺开；也可以在下面调整用量。最多搭配 16 种，不需要购买，也不会消耗库存。</p>
        </>}
        {step === 2 && <><span className="kitchen-field-title">制作方式</span><div className="kitchen-choices">{type.methods.map(method => <button type="button" key={method} disabled={disabled} aria-pressed={draft.method === method} onClick={() => change({ ...draft, method })}>{KITCHEN_METHODS[method]}</button>)}</div>
          <span className="kitchen-field-title">{category === 'dish' ? '想吃几分辣？' : '想要几分甜？'}</span><div className="kitchen-choices">{(category === 'dish' ? [0, 1, 2, 3] : [0, 25, 50, 75, 100]).map(value =>
            <button type="button" key={value} disabled={disabled} aria-pressed={(category === 'dish' ? draft.heat : draft.sweetness) === value} onClick={() => change({ ...draft, ...(category === 'dish' ? { heat: value } : { sweetness: value }) })}>{category === 'dish' ? ['不辣', '微辣', '中辣', '很辣'][value] : value === 0 ? '不额外加糖' : `${value}%`}</button>)}</div><p className="kitchen-help">用量、甜辣是游戏里的风味偏好，不用等待现实烹饪计时。</p></>}
        {step === 3 && <>
          <span className="kitchen-field-title">挑一套餐具</span><div className="kitchen-choices">{(['porcelain', 'sage', 'rose', 'bear'] as const).map(plate => <button type="button" key={plate} disabled={disabled} aria-pressed={draft.plate === plate} onClick={() => change({ ...draft, plate })}>{KITCHEN_PLATES[plate]}</button>)}</div>
          <label>料理名字<input aria-label="料理名字" value={draft.name} maxLength={40} disabled={disabled} placeholder="例如：偷偷偏心你的小蛋糕" onChange={event => change({ ...draft, name: event.target.value })}/></label>
          {!draft.maker.actorId && <label>留一句话<textarea rows={2} maxLength={500} value={draft.maker.note ?? ''} disabled={disabled} placeholder="趁热吃，今天辛苦啦。" onChange={event => change({ ...draft, maker: { ...draft.maker, note: event.target.value || undefined } })}/></label>}
          <label className="kitchen-upload"><Upload size={15}/>上传成品封面（可选）<input aria-label="上传料理成品封面" type="file" accept="image/*" disabled={disabled} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (file) void run(async () => { const cover = await compressImage(file, { maxDimension: 1000, maxBytes: 300 * 1024, preserveTransparency: true }); if (mounted.current) change({ ...draft, cover }); });
          }}/></label>{draft.cover && <button type="button" className="kitchen-text-button" disabled={disabled} onClick={() => change({ ...draft, cover: undefined })}>改用内置料理插画</button>}
          <p className="kitchen-help">完成后，成品和配方会一起保存。{draft.maker.actorId ? `配方来自${draft.maker.name}${draft.adapted ? '，经你调整' : ''}。` : `由${draft.maker.name}亲手制作。`}</p>
          {scope && <label className="kitchen-checkbox"><input type="checkbox" checked={syncCreation} disabled={disabled} onChange={event => setSyncCreation(event.target.checked)}/><span>将这次制作记录同步到{draft.maker.name}当前存档的私聊</span></label>}
        </>}
        <div className="kitchen-actions">{step > 0 && <button type="button" className="kitchen-secondary" disabled={disabled} onClick={() => { setStep(step - 1); setError(''); }}><ArrowLeft size={14}/>上一步</button>}
          <button type="button" className="kitchen-primary" disabled={disabled} onClick={step === 3 ? complete : () => {
            try { if (step === 1) validateKitchenRecipe({ ...draft, name: draft.name || '尚未命名' }); setStep(step + 1); setError(''); } catch (cause) { report(cause); }
          }}>{working ? <Loader2 className="kitchen-spin" size={15}/> : step === 3 ? <Check size={15}/> : <ArrowRight size={15}/>} {step === 3 ? '做好了，端上桌' : '下一步'}</button></div>
      </section>
      {step === 0 && <section className="kitchen-paper kitchen-character"><span className="kitchen-eyebrow">LET ME COOK FOR YOU</span><h3>今天，想吃 TA 做的。</h3>{picker}<label>想对 TA 说<textarea aria-label="下厨需求" rows={3} maxLength={500} disabled={disabled} value={requirements} onChange={event => setRequirements(event.target.value)} placeholder={category === 'dish' ? '今天有点累，想吃一份热乎乎、不辣的晚饭。' : '想要草莓味的小甜品，装饰交给你决定。'}/></label>
        <p className="kitchen-help">使用角色人设、玩家设定、世界书、相关聊天与本地记忆。一次请求 1 次 AI；先预览，确认就直接上桌，不必重做一遍。</p>
        <button type="button" className="kitchen-secondary" disabled={disabled || !actor} onClick={() => void requestAI('recipe')}><Sparkles size={15}/>请 TA 做份{category === 'dish' ? '菜品' : '甜品'} · 1 次 AI</button>
        {proposal && <article className="kitchen-proposal"><KitchenArt recipe={proposal.recipe}/><strong>{proposal.recipe.name}</strong><p>{proposal.recipe.maker.note}</p><pre>{kitchenRecipeText(proposal.recipe)}</pre>
          <label className="kitchen-checkbox"><input type="checkbox" checked={syncCreation} disabled={disabled} onChange={event => setSyncCreation(event.target.checked)}/><span>确认后，把制作经历同步到{proposal.recipe.maker.name}当前存档的私聊</span></label>
          <p className="kitchen-help">不勾选就只留在厨房；不额外调用 AI，也不直接写入长期记忆。</p>
          <div className="kitchen-actions"><button type="button" className="kitchen-primary" disabled={disabled} onClick={() => void run(async () => {
            const made = await onRecord({ kind: 'recipe', recipe: proposal.recipe, scope: proposal.scope, syncToChat: syncCreation });
            if (mounted.current) { setProposal(null); showMeal(made.id); setNotice('已收下 TA 的料理，成品与配方都保存好了。'); }
          })}><Heart size={14}/>确认收下并上桌</button><button type="button" className="kitchen-secondary" disabled={disabled} onClick={() => {
            setDrafts(current => ({ ...current, [category]: { recipe: copyKitchenRecipe(proposal.recipe), scope: proposal.scope } }));
            setProposal(null); setStep(1); setSyncCreation(false);
          }}>先调整配方</button><button type="button" className="kitchen-text-button" disabled={disabled} onClick={() => setProposal(null)}>不收下</button></div>
        </article>}
      </section>}
    </>}
    {(view === 'recipes' || view === 'table') && <section className="kitchen-collection"><header><span className="kitchen-eyebrow">{view === 'recipes' ? 'RECIPES WITH LITTLE STORIES' : 'A TABLE FULL OF MEMORIES'}</span><h3>{view === 'recipes' ? '把喜欢的味道，留一份。' : '每一餐，都值得记得。'}</h3></header>
      {view === 'recipes' ? store.recipes.filter(r => kitchenType(r.typeId).category === category).map(recipe => <article className="kitchen-list-card" key={recipe.id}><KitchenArt compact recipe={recipe}/><div><strong>{recipe.name}</strong><small>{kitchenType(recipe.typeId).name} · {recipe.maker.name}{recipe.adapted ? ' / 经你调整' : ''}</small><div className="kitchen-actions"><button type="button" disabled={disabled} onClick={() => restart(recipe)}>照着做 / 调整</button><button type="button" aria-label={`删除配方：${recipe.name}`} disabled={disabled} onClick={() => setDeleting({ kind: 'recipe', id: recipe.id })}><Trash2 size={13}/></button></div></div></article>)
        : store.meals.filter(m => kitchenType(m.recipe.typeId).category === category).map(item => <button type="button" key={item.id} className="kitchen-list-card kitchen-meal-link" disabled={disabled} onClick={() => showMeal(item.id)}><KitchenArt compact recipe={item.recipe}/><span><strong>{item.recipe.name}</strong><small>{item.recipe.maker.name} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</small><small>{item.servings.length ? `与 ${item.servings.map(s => s.actorName).join('、')} 分享过` : '一份还没送出的心意'}</small></span><ArrowRight size={15}/></button>)}
      {!(view === 'recipes' ? store.recipes.some(r => kitchenType(r.typeId).category === category) : store.meals.some(m => kitchenType(m.recipe.typeId).category === category)) && <div className="kitchen-empty"><ChefHat size={37} strokeWidth={1}/><strong>这里还留着一个位置。</strong><p>亲手做一份，或请喜欢的角色做给你。</p><button type="button" className="kitchen-primary" onClick={() => go('make')}>去厨房看看</button></div>}
    </section>}
    {view === 'meal' && (meal ? <>
      <button type="button" className="kitchen-text-button" disabled={disabled} onClick={() => go('table')}><ArrowLeft size={14}/>回到餐桌</button>
      <article className="kitchen-finished"><span className="kitchen-eyebrow">MADE WITH A LITTLE LOVE</span><KitchenArt recipe={meal.recipe}/><h3>{meal.recipe.name}</h3><span className="kitchen-signature">{meal.recipe.maker.name}{meal.recipe.adapted ? '的配方 · 经你调整' : '亲手做的'}</span><pre>{kitchenRecipeText(meal.recipe)}</pre><small>{new Date(meal.createdAt).toLocaleString('zh-CN')}</small></article>
      <section className="kitchen-paper kitchen-share"><span className="kitchen-eyebrow">SAVE YOU A SEAT</span><h3>给你留了一个位置。</h3>{picker}
        <label className="kitchen-checkbox"><input type="checkbox" disabled={disabled || !actor} checked={serveConsent} onChange={event => setServeConsent(event.target.checked)}/><span>把这份料理卡片发送到{actor?.name ?? 'TA'}的私聊（不调用 AI）</span></label>
        <button type="button" className="kitchen-primary" disabled={disabled || !actor || !serveConsent} onClick={() => void run(async () => { await onServe(meal.id, actorId); if (mounted.current) { setServeConsent(false); setNotice('料理卡片已送出，不会自动请求 AI 回复。'); } })}><Send size={14}/>{serving ? '再次发送料理卡' : '把这一份送给 TA'}</button>
        <label className="kitchen-checkbox"><input type="checkbox" checked={syncTaste} disabled={disabled || !serving} onChange={event => setSyncTaste(event.target.checked)}/><span>将本次品尝反馈同步到 TA 当前存档的私聊</span></label>
        <button type="button" className="kitchen-secondary" disabled={disabled || !actor || !serving} onClick={() => void requestAI('taste')}><Sparkles size={15}/>{serving?.tastings.length ? '再一起尝一口' : '请 TA 尝一口'} · 1 次 AI</button>
        <p className="kitchen-help">先送出卡片，再邀请品尝；TA 可以喜欢，也可以诚实地说不合口味。默认只保存在餐桌，勾选才同步，不直接写入长期记忆。</p>
      </section>
      <section className="kitchen-memories"><h3>这一餐的小回忆</h3>{meal.servings.length ? meal.servings.map(s => <article key={s.actorId}><header><Heart size={13}/><strong>{s.actorName}</strong><small>{new Date(s.servedAt).toLocaleString('zh-CN')} 收到料理</small></header>
        {!s.tastings.length && <p>料理已经送到了，还没有留下品尝留言。</p>}{s.tastings.map(t => <div className="kitchen-tasting" key={t.id}><small>{new Date(t.createdAt).toLocaleString('zh-CN')}</small><p>{t.status === 'done' ? t.text : t.status === 'pending' ? '正在等待这一次的品尝反馈……' : t.error}</p></div>)}</article>) : <p className="kitchen-help">还没有送给谁，但亲手做好的这一刻已经留下了。</p>}</section>
      <div className="kitchen-actions kitchen-bottom-actions"><button type="button" className="kitchen-secondary" disabled={disabled} onClick={() => restart(meal.recipe)}>再做一份 / 调整配方</button><button type="button" className="kitchen-text-button" disabled={disabled} onClick={() => setDeleting({ kind: 'meal', id: meal.id })}><Trash2 size={14}/>删除这份成品</button></div>
    </> : <div role="alert" className="kitchen-error">这份料理已不存在，请回到餐桌重新选择。<button type="button" onClick={() => go('table')}>回到餐桌</button></div>)}
    <details className="kitchen-guide"><summary>小厨房使用说明</summary><p>本次打开厨房期间，切换菜品和甜品会保留各自的未完成搭配。自己制作、查看、送卡片不调用 AI；请角色下厨或品尝各手动请求一次。没有库存、体力和经营任务。</p><p>完成的配方和成品分别保存；重新制作会另存一份，不覆盖原记录。删除配方不删除成品，删除成品不撤回已发送的聊天卡片。记录保存在本机，清除应用数据前请做好整机备份。</p><p>角色制作与品尝可选择同步到当前玩家、角色、存档的私聊，进入后续聊天上下文；不会直接写入长期记忆。这里是虚拟料理与互动，不提供现实烹饪时间或饮食安全判断。</p></details>
  </section>;
}
function freshPreview(recipe: KitchenRecipe, typeId: KitchenRecipe['typeId']): KitchenRecipe {
  const type = kitchenType(typeId);
  return { ...recipe, name: '', cover: undefined, typeId, method: type.methods[0], parts: type.base.map(id => ({ id, amount: 2 })) };
}
