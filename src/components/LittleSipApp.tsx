import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookHeart, Check, Coffee, CupSoda, GlassWater, History, Leaf, Loader2, Martini, Minus, Plus, Send, Sparkles, Trash2, Wine, X } from 'lucide-react';
import SipGlass from './SipGlass';
import { SIP_CUPS, SIP_GROUPS, SIP_INGREDIENTS, copySipRecipe, createSipDrink, freshSipRecipe, loadSip, parseSipRecipe,
  patchSipDrink, recoverSip, sipCategory, sipCup, sipIce, sipIngredient, sipPartsAtStage, sipRecipeText, subscribeSip, updateSip, validateSipRecipe,
  type SipDrink, type SipGroup, type SipRecipe, type SipRequest } from '../utils/littleSip';
import './littleSip.css';

type Props = { userName:string; people:{id:string;name:string}[]; onRequest:(r:SipRequest)=>Promise<string>; onServe:(drinkId:string,actorId:string)=>Promise<void> };
const steps=['选杯','小料','饮料','糖冰','装饰','命名'];
const stepGroup=(step:number):SipGroup=>step===1?'topping':step===4?'garnish':'tea';
const message=(e:unknown)=>e instanceof Error?e.message:'这次操作没有完成，请手动重试。';
const groupIcon=(group:SipGroup)=>group==='spirit'||group==='liqueur'||group==='modifier'?Wine:group==='coffee'?Coffee:group==='tea'||group==='fruit'||group==='garnish'?Leaf:group==='milk'?GlassWater:CupSoda;
export default function LittleSipApp({userName,people,onRequest,onServe}:Props) {
  const [store,setStore]=useState(loadSip),[view,setView]=useState<'make'|'menu'|'drink'|'history'>('make');
  const [draft,setDraft]=useState(()=>freshSipRecipe(userName)),[step,setStep]=useState(0),[group,setGroup]=useState<SipGroup>('topping');
  const [drinkId,setDrinkId]=useState(''),[actorId,setActorId]=useState(people[0]?.id??''),[requirements,setRequirements]=useState('');
  const [proposal,setProposal]=useState<SipRecipe|null>(null),[filter,setFilter]=useState('全部'),[pouring,setPouring]=useState('');
  const [busy,setBusy]=useState(false),[working,setWorking]=useState(false),[consent,setConsent]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[deleting,setDeleting]=useState<{kind:'recipe'|'drink';id:string}|null>(null);
  const mounted=useRef(true),operation=useRef(false),root=useRef<HTMLDivElement>(null);
  const request=useRef<{controller:AbortController;drinkId?:string;actorId:string;attemptId:string}|null>(null);
  const report=(e:unknown)=>{if(mounted.current)setError(message(e));else console.error('Little Sip operation failed after unmount:',e);};
  const cancel=()=>{
    const active=request.current;if(!active)return;
    request.current=null;active.controller.abort();if(mounted.current){setBusy(false);setNotice('已取消，不会自动重试。');}
    if(active.drinkId)void patchSipDrink(active.drinkId,d=>({...d,servings:d.servings.map(s=>s.actorId===active.actorId?{...s,tastings:s.tastings.map(t=>
      t.id===active.attemptId&&t.status==='pending'?{...t,status:'error',error:'试饮已取消，不会自动重试。'}:t)}:s)})).catch(report);
  };
  useEffect(()=>{
    mounted.current=true;const unsubscribe=subscribeSip(()=>setStore(loadSip()));
    if(loadSip().drinks.some(d=>d.servings.some(s=>s.tastings.some(t=>t.status==='pending'))))void updateSip(recoverSip).catch(report);
    return()=>{mounted.current=false;unsubscribe();cancel();};
  },[]);
  useEffect(()=>{let node=root.current?.parentElement??null;while(node&&!/(auto|scroll)/.test(getComputedStyle(node).overflowY))node=node.parentElement;node?.scrollTo({top:0});},[view,step,drinkId]);
  useEffect(()=>{if(error||notice)root.current?.querySelector('[role="alert"],[role="status"]')?.scrollIntoView({block:'center'});},[error,notice]);
  useEffect(()=>{if(!pouring)return;const timer=window.setTimeout(()=>setPouring(''),900);return()=>window.clearTimeout(timer);},[pouring]);
  const disabled=working||busy;
  const go=(next:typeof view)=>{cancel();setError('');setNotice('');setDeleting(null);setConsent(false);setView(next);};
  const run=async(action:()=>Promise<void>)=>{
    if(operation.current)return;operation.current=true;setWorking(true);setError('');setNotice('');
    try{await action();}catch(e){report(e);}finally{operation.current=false;if(mounted.current)setWorking(false);}
  };
  const change=(next:SipRecipe,ingredient='')=>{
    try{
      const altered=next.name!==draft.name||next.cupId!==draft.cupId||next.sweetness!==draft.sweetness||next.ice!==draft.ice||
        next.finish!==draft.finish||JSON.stringify(next.parts)!==JSON.stringify(draft.parts);
      const edited={...next,id:altered&&store.recipes.some(r=>r.id===draft.id)?`recipe-${crypto.randomUUID()}`:next.id,
        adapted:next.adapted||altered&&!!next.maker.actorId};
      validateSipRecipe(edited,false);setDraft(edited);setError('');setNotice('');if(ingredient)setPouring(ingredient);
    }catch(e){report(e);}
  };
  const start=(recipe?:SipRecipe,edit=false)=>{
    setDraft(recipe?{...copySipRecipe(recipe),id:edit?`recipe-${crypto.randomUUID()}`:recipe.id}:freshSipRecipe(userName));
    setProposal(null);setStep(0);setPouring('');go('make');
  };
  const next=()=>{try{if(step>=2)validateSipRecipe({...draft,name:draft.name||'尚未命名'});setStep(Math.min(steps.length-1,step+1));setGroup(stepGroup(step+1));setError('');}catch(e){report(e);}};
  const complete=()=>void run(async()=>{
    const drink=createSipDrink({...draft,name:draft.name.trim()});await updateSip(s=>({...s,drinks:[drink,...s.drinks]}));
    if(mounted.current){setDrinkId(drink.id);go('drink');}
  });
  const requestAI=async(kind:'recipe'|'taste',drink?:SipDrink)=>{
    if(request.current||operation.current)return;
    const actor=people.find(p=>p.id===actorId);
    if(!actor){setError('请选择仍在通讯录中的角色。');return;}
    if(kind==='taste'&&!drink?.servings.some(s=>s.actorId===actor.id)){setError('先把这杯送给 TA，再邀请试饮。');return;}
    const active={controller:new AbortController(),drinkId:kind==='taste'?drink?.id:undefined,actorId:actor.id,attemptId:`taste-${crypto.randomUUID()}`};
    request.current=active;setBusy(true);setError('');setNotice('');
    try{
      if(kind==='taste'&&drink)await patchSipDrink(drink.id,d=>({...d,servings:d.servings.map(s=>s.actorId===actor.id?{...s,tastings:[...s.tastings,
        {id:active.attemptId,createdAt:new Date().toISOString(),status:'pending',text:''}]}:s)}));
      active.controller.signal.throwIfAborted();
      let result:string;
      if(kind==='recipe')result=await onRequest({kind,actorId:actor.id,requirements,signal:active.controller.signal});
      else if(drink)result=await onRequest({kind,actorId:actor.id,drink,signal:active.controller.signal});
      else throw new Error('这杯饮品已不存在，请从制作足迹重新选择。');
      active.controller.signal.throwIfAborted();
      if(kind==='recipe')setProposal(parseSipRecipe(result,actor));
      else if(drink){
        const text=result.trim();if(!text||text.length>5000)throw new Error('角色的试饮反馈为空或过长，请手动重试。');
        await patchSipDrink(drink.id,d=>({...d,servings:d.servings.map(s=>s.actorId===actor.id?{...s,tastings:s.tastings.map(t=>
          t.id===active.attemptId&&!active.controller.signal.aborted?{...t,status:'done',text}:t)}:s)}));
      }
    }catch(e){
      if(!active.controller.signal.aborted){
        report(e);
        if(active.drinkId)try{await patchSipDrink(active.drinkId,d=>({...d,servings:d.servings.map(s=>s.actorId===actor.id?{...s,tastings:s.tastings.map(t=>
          t.id===active.attemptId?{...t,status:'error',error:message(e).slice(0,1000)}:t)}:s)}));}catch(persistenceError){report(persistenceError);}
      }
    }finally{if(request.current===active){request.current=null;if(mounted.current)setBusy(false);}}
  };
  const drink=store.drinks.find(d=>d.id===drinkId),saved=!!drink&&store.recipes.some(r=>r.id===drink.recipe.id);
  const selectedGroups:readonly SipGroup[]=step===1?['topping','fruit']:step===4?['garnish']:['tea','coffee','milk','juice','water','spirit','liqueur','modifier','syrup'];
  const selectedParts=draft.parts.filter(p=>selectedGroups.includes(sipIngredient(p.id).group));
  const previewVolume=sipPartsAtStage(draft,step).reduce((n,p)=>n+p.amount,0)+(step>=3?sipIce(draft):0);
  const picker=<label className="sip-role-select">选择角色<select value={actorId} disabled={disabled} onChange={e=>{setActorId(e.target.value);setConsent(false);}}><option value="">请选择角色</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
  return <div className="sip-app" ref={root}>
    <nav className="sip-nav"><span>LITTLE SIP <i>一杯之间</i></span><div>{(['make','menu','history'] as const).map((v,i)=><button type="button" key={v} disabled={working} aria-label={['调一杯','查看饮品单','查看制作足迹'][i]} aria-pressed={view===v} onClick={()=>go(v)}>{i===0?<CupSoda size={17}/>:i===1?<BookHeart size={17}/>:<History size={17}/>}</button>)}</div></nav>
    <main className="sip-content">
      {error&&<p className="sip-alert" role="alert">{error}</p>}{notice&&<p className="sip-notice" role="status">{notice}</p>}
      {view==='make'&&<>
        {step===0&&<header className="sip-heading"><span className="sip-kicker">A LITTLE CUP OF HAPPINESS</span><h2>把喜欢的，<em>都装进这一杯。</em></h2><p>今天你是调饮师。也可以把吧台交给 TA。</p></header>}
        <ol className="sip-steps" aria-label="调饮步骤">{steps.map((s,i)=><li key={s} aria-current={i===step?'step':undefined}><span>{i<step?<Check size={11}/>:i+1}</span><small>{s}</small></li>)}</ol>
        <div className="sip-preview"><SipGlass recipe={draft} stage={step} pouring={pouring}/><div className="sip-volume"><span>{previewVolume} / {sipCup(draft.cupId).capacity} <small>ml 估量</small></span><i><b style={{width:`${previewVolume/sipCup(draft.cupId).capacity*100}%`}}/></i></div></div>
        <section className="sip-paper sip-workbench"><span className="sip-kicker">STEP {String(step+1).padStart(2,'0')}</span><h3>{['先挑一只喜欢的杯子','铺一点小惊喜在杯底','喜欢的风味，慢慢倒入','一点清凉，一点甜','在杯口，放一点漂亮心情','最后，给它一个名字'][step]}</h3>
          {step===0&&<div className="sip-cup-options">{SIP_CUPS.map(c=><button type="button" key={c.id} disabled={disabled} aria-pressed={draft.cupId===c.id} onClick={()=>change({...draft,cupId:c.id})}>{c.id==='martini'?<Martini size={26} strokeWidth={1.2}/>:c.id==='goblet'?<Wine size={26} strokeWidth={1.2}/>:c.id==='coffee'?<Coffee size={26} strokeWidth={1.2}/>:<GlassWater size={26} strokeWidth={1.2}/>}<strong>{c.name}</strong><small>{c.capacity}ml</small></button>)}</div>}
          {(step===1||step===2||step===4)&&<>
            <div className="sip-tabs" aria-label="材料分类">{selectedGroups.map(g=><button type="button" key={g} aria-pressed={group===g} disabled={disabled} onClick={()=>setGroup(g)}>{SIP_GROUPS[g]}</button>)}</div>
            <div className="sip-ingredients">{SIP_INGREDIENTS.filter(i=>i.group===group&&selectedGroups.some(g=>g===i.group)).map(item=>{
              const Icon=groupIcon(item.group),included=draft.parts.some(p=>p.id===item.id);
              return <button type="button" key={item.id} disabled={disabled||included} aria-label={`添加${item.name}`} onClick={()=>change({...draft,parts:[...draft.parts,{id:item.id,amount:item.id==='ice-cream'?30:item.unit==='g'?10:30}]},item.unit==='ml'?item.id:'')}>
                <span style={{background:item.color}}><Icon size={20} strokeWidth={1.3}/></span><strong>{item.name}</strong><small>{included?'已在杯中':item.group==='garnish'?'装饰在杯口':item.unit==='g'?'放一点小料':'倒入 30ml'}</small><Plus size={13}/></button>;
            })}</div>
            <div className="sip-parts">{selectedParts.map(p=>{const item=sipIngredient(p.id);return <div className="sip-part" key={p.id}><div><strong>{item.name}</strong><span>{p.amount}{item.unit}</span><button type="button" aria-label={`移除${item.name}`} disabled={disabled} onClick={()=>change({...draft,parts:draft.parts.filter(q=>q.id!==p.id)})}><X size={14}/></button></div><div className="sip-amount"><button type="button" aria-label={`${item.name}减少5${item.unit}`} disabled={disabled||p.amount<=5} onClick={()=>change({...draft,parts:draft.parts.map(q=>q.id===p.id?{...q,amount:q.amount-5}:q)})}><Minus size={13}/></button><input type="range" min="5" max={item.max} step="5" aria-label={`${item.name}用量`} value={p.amount} disabled={disabled} onChange={e=>change({...draft,parts:draft.parts.map(q=>q.id===p.id?{...q,amount:Number(e.target.value)}:q)},item.unit==='ml'?item.id:'')}/><button type="button" aria-label={`${item.name}增加5${item.unit}`} disabled={disabled||p.amount>=item.max} onClick={()=>change({...draft,parts:draft.parts.map(q=>q.id===p.id?{...q,amount:q.amount+5}:q)},item.unit==='ml'?item.id:'')}><Plus size={13}/></button></div></div>;})}</div>
            {(step===4||!selectedParts.length)&&<p className="sip-help">{step===1?'小料可以跳过，也可以放上珍珠、椰果或鲜果。':step===4?'这一步可以跳过。装饰会留在杯口，搅拌也不会沉底；杯内柠檬片和杯口柠檬片可以分别添加。为统一估量，装饰同样按 1g 约占 1ml 计入杯容量。':'至少加入 40ml 饮料；用量可以自由调整，但别让杯子满出来。'}</p>}
          </>}
          {step===3&&<><span className="sip-field-title">想要几分甜？</span><div className="sip-choice-row">{[0,25,50,75,100].map(n=><button type="button" key={n} disabled={disabled} aria-pressed={draft.sweetness===n} onClick={()=>change({...draft,sweetness:n})}>{n===0?'不额外加糖':`${n}%`}</button>)}</div><span className="sip-field-title">清凉的程度</span><div className="sip-choice-row">{(['none','light','regular'] as const).map((ice,i)=><button type="button" key={ice} disabled={disabled} aria-pressed={draft.ice===ice} onClick={()=>change({...draft,ice})}>{['不加冰','少冰','正常冰'][i]}</button>)}</div><p className="sip-help">糖度是偏好标签，不代表实际含糖量；果汁、糖浆和小料本身也可能含糖。冰块也占杯容量，装不下时会提醒你。</p></>}
          {step===5&&<><div className="sip-choice-row">{(['layered','stirred'] as const).map((finish,i)=><button type="button" key={finish} disabled={disabled} aria-pressed={draft.finish===finish} onClick={()=>change({...draft,finish})}>{['保留漂亮分层','轻轻搅拌均匀'][i]}</button>)}</div><label>给这杯取个名字<input maxLength={40} value={draft.name} disabled={disabled} onChange={e=>change({...draft,name:e.target.value})} placeholder="例如：晚风里的一颗桃"/></label><p className="sip-help">{sipCategory(draft)} · {draft.maker.actorId?`${draft.maker.name}的配方${draft.adapted?'，经你调整':''}`:`${draft.maker.name}亲手调配`}</p></>}
          <div className="sip-actions">{step>0&&<button type="button" className="sip-secondary" disabled={disabled} onClick={()=>{setStep(step-1);setGroup(stepGroup(step-1));setError('');}}><ArrowLeft size={14}/>上一步</button>}<button type="button" className="sip-primary" disabled={disabled} onClick={step===5?complete:next}>{working?<Loader2 size={15} className="sip-spin"/>:step===5?<Check size={15}/>:<ArrowRight size={15}/>} {step===5?'做好这一杯':'下一步'}</button></div>
        </section>
        {step===0&&<section className="sip-paper sip-character"><span className="sip-kicker">LET THEM MAKE YOU A DRINK</span><h3>今天，想喝 TA 调的那一杯</h3>{picker}<label>想对调饮师说<textarea rows={2} maxLength={500} disabled={disabled} value={requirements} onChange={e=>setRequirements(e.target.value)} placeholder="例如：想要淡淡桃香、不要奶，也不要酒。"/></label><p className="sip-help">手动请求 1 次 AI，使用角色 / 玩家 / 世界书、相关聊天与本地记忆。角色会从材料柜里配一杯；先预览、再由你采用，不自动保存。</p><button type="button" className="sip-secondary" disabled={disabled||!actorId} onClick={()=>void requestAI('recipe')}><Sparkles size={15}/>让 TA 调一杯 · 1 次 AI</button>
          {proposal&&<article className="sip-proposal"><strong>{proposal.name}</strong><p>{proposal.maker.note}</p><pre>{sipRecipeText(proposal)}</pre><div className="sip-actions"><button type="button" className="sip-primary" disabled={disabled} onClick={()=>{setDraft(copySipRecipe(proposal));setProposal(null);setStep(0);setNotice('草稿已采用，尚未保存。可以逐步核对、修改后完成。');}}>采用这份草稿</button><button type="button" className="sip-secondary" disabled={disabled} onClick={()=>setProposal(null)}>不采用</button></div></article>}
        </section>}
      </>}
      {view==='drink'&&drink&&<>
        <header className="sip-heading"><span className="sip-kicker">MADE WITH A LITTLE LOVE</span><h2>{drink.recipe.name}</h2><p>{sipCategory(drink.recipe)} · {drink.recipe.maker.name}{drink.recipe.adapted?'的配方，经你调整':'的手作'}</p></header>
        <SipGlass recipe={drink.recipe}/>
        <section className="sip-paper"><h3>这一杯的专属配方</h3><pre className="sip-formula">{sipRecipeText(drink.recipe)}</pre><button type="button" className="sip-primary" disabled={disabled||saved} onClick={()=>void run(async()=>{await updateSip(s=>({...s,recipes:[copySipRecipe(drink.recipe),...s.recipes]}));if(mounted.current)setNotice('已收进饮品单，可以随时照方再做。');})}><BookHeart size={15}/>{saved?'已收进饮品单':'收进饮品单'}</button><div className="sip-actions"><button type="button" className="sip-secondary" disabled={disabled} onClick={()=>start(drink.recipe)}>照配方再做</button><button type="button" className="sip-secondary" disabled={disabled} onClick={()=>start(drink.recipe,true)}>修改后另存</button></div></section>
        <section className="sip-paper"><span className="sip-kicker">A CUP, JUST FOR YOU</span><h3>做给 TA 喝</h3>{picker}<label className="sip-checkbox"><input type="checkbox" checked={consent} disabled={disabled} onChange={e=>setConsent(e.target.checked)}/><span>将完整配方、署名留言和这位角色已完成的试饮反馈送进聊天</span></label>
          <button type="button" className="sip-primary" disabled={disabled||!actorId||!consent} onClick={()=>void run(async()=>{await onServe(drink.id,actorId);if(mounted.current)setNotice('这一杯已送进聊天。再次送出同一杯会更新原卡片，不会自动调用 AI。');})}><Send size={15}/>送给 TA · 不调用 AI</button>
          <p className="sip-help">先送出，再单独邀请 TA 试饮。反馈保存在这杯的制作记录中；再次送出可更新聊天卡片。角色可以喜欢，也可以诚实地提出调整建议。</p>
          <button type="button" className="sip-secondary" disabled={disabled||!drink.servings.some(s=>s.actorId===actorId)} onClick={()=>void requestAI('taste',drink)}><Sparkles size={15}/>邀请试饮 · 1 次 AI</button>
        </section>
        {drink.servings.map(s=><section className="sip-paper sip-tastings" key={s.actorId}><h3>{s.actorName}的这一口</h3><small>{new Date(s.servedAt).toLocaleString('zh-CN')}</small>{!s.tastings.length&&<p className="sip-help">已经送到，还没有邀请试饮。</p>}{s.tastings.map(t=><article key={t.id}><small>{new Date(t.createdAt).toLocaleString('zh-CN')}</small>{t.status==='done'?<p>{t.text}</p>:t.status==='pending'?<p role="status">TA 正在尝这一杯，离开会取消请求。</p>:<p className="sip-taste-error">{t.error}</p>}</article>)}</section>)}
      </>}
      {(view==='menu'||view==='history')&&<>
        <header className="sip-heading"><span className="sip-kicker">{view==='menu'?'YOUR LITTLE DRINK BOOK':'SMALL MOMENTS, KEPT'}</span><h2>{view==='menu'?'把喜欢，收进饮品单。':'每一杯，都有小故事。'}</h2><p>{view==='menu'?'配方单独收存。修改后另存，不覆盖旧配方或旧饮品。':'做好的每一杯与试饮反馈都在这里；不必先收进饮品单。'}</p></header>
        {view==='menu'&&<div className="sip-tabs">{['全部','奶饮','果茶 / 果饮','清茶 / 清饮','咖啡','酒饮'].map(f=><button type="button" key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div>}
        {view==='menu'?<>
          {!store.recipes.filter(r=>filter==='全部'||sipCategory(r)===filter).length&&<p className="sip-empty">这一页还空着，调好一杯后，把配方收进来吧。</p>}
          {store.recipes.filter(r=>filter==='全部'||sipCategory(r)===filter).map(r=><article className="sip-paper sip-menu-card" key={r.id}><div className="sip-card-heading"><CupSoda size={22}/><span><strong>{r.name}</strong><small>{sipCategory(r)} · {r.maker.name}{r.adapted?' · 经你调整':''}</small></span><button type="button" disabled={disabled} aria-label={`删除配方 ${r.name}`} onClick={()=>setDeleting({kind:'recipe',id:r.id})}><Trash2 size={15}/></button></div><details><summary>查看完整配方</summary><pre>{sipRecipeText(r)}</pre></details><div className="sip-actions"><button type="button" className="sip-primary" disabled={disabled} onClick={()=>start(r)}>照方调一杯</button><button type="button" className="sip-secondary" disabled={disabled} onClick={()=>start(r,true)}>修改后另存</button></div></article>)}
        </>:<>
          {!store.drinks.length&&<p className="sip-empty">还没有制作记录。先调一杯小小的快乐吧。</p>}
          {store.drinks.map(d=><article className="sip-history-card" key={d.id}><button type="button" disabled={disabled} onClick={()=>{setDrinkId(d.id);go('drink');}}><CupSoda size={21}/><span><strong>{d.recipe.name}</strong><small>{new Date(d.createdAt).toLocaleString('zh-CN')} · 送出 {d.servings.length} 位</small></span><ArrowRight size={15}/></button><button type="button" disabled={disabled} aria-label={`删除制作记录 ${d.recipe.name}`} onClick={()=>setDeleting({kind:'drink',id:d.id})}><Trash2 size={15}/></button></article>)}
        </>}
        {deleting&&<section className="sip-paper" role="alert"><p>{deleting.kind==='recipe'?'删除这个配方？已做好的饮品和试饮记录不受影响。':'删除这杯的制作记录和试饮？饮品单不受影响，已送出的聊天卡片也不会撤回。'}</p><div className="sip-actions"><button type="button" className="sip-secondary" disabled={disabled} onClick={()=>void run(async()=>{const target=deleting;await updateSip(s=>target.kind==='recipe'?{...s,recipes:s.recipes.filter(r=>r.id!==target.id)}:{...s,drinks:s.drinks.filter(d=>d.id!==target.id)});if(mounted.current){setDeleting(null);setNotice('已经删除，其他记录保持不变。');}})}>确认删除</button><button type="button" className="sip-secondary" disabled={disabled} onClick={()=>setDeleting(null)}>保留</button></div></section>}
        <button type="button" className="sip-secondary" disabled={disabled} onClick={()=>start()}><Plus size={15}/>新调一杯</button>
      </>}
      {busy&&<button type="button" className="sip-cancel" onClick={cancel}><Loader2 size={14} className="sip-spin"/>正在等 TA 回应 · 点击取消</button>}
      <footer className="sip-footer">原创虚拟调饮 · 不售卖真实饮品<br/>体积、颜色与动效为游戏估量，不是物理或食品安全模拟。含酒配方明确归入酒饮，不提供营养、过敏或现实饮用安全保证。</footer>
    </main>
  </div>;
}
