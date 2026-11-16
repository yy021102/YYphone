import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronRight, Download, Smartphone } from 'lucide-react';
import { DEFAULT_LAUNCHER_ICON, LAUNCHER_ICON_CATEGORIES, LAUNCHER_ICONS, launcherIconPaths, readLauncherIcon, saveLauncherIcon, type LauncherIconId } from '../utils/launcherIcons';
import './launcherIconSettings.css';

export function LauncherIconSettings() {
  const [selected,setSelected]=useState(readLauncherIcon),[error,setError]=useState('');
  const [open,setOpen]=useState(false),[category,setCategory]=useState('全部');
  const [container,setContainer]=useState<HTMLElement|null>(null);
  const entry=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null),back=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;back.current?.focus({preventScroll:true});return()=>entry.current?.focus({preventScroll:true});},[open,container]);
  const choose=(id:LauncherIconId)=>{try{saveLauncherIcon(id);setSelected(id);setError('');}catch{setError('图标选择未能保存，请重试。');}};
  const paths=launcherIconPaths(selected),current=LAUNCHER_ICONS.find(icon=>icon.id===selected)!;
  return <>
    <button type="button" ref={entry} className="glass-card launcher-gallery-entry" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setSelected(readLauncherIcon());setError('');setContainer(entry.current?.closest<HTMLElement>('[data-phone-canvas]')??document.body);setOpen(true);}}><span className="launcher-entry-symbol"><Smartphone size={18}/></span><strong>小手机图标</strong><img src={paths.image} alt=""/><small>{current.name}</small><ChevronRight size={15}/></button>
    {open&&container&&createPortal(<section ref={dialog} className="launcher-gallery" role="dialog" aria-modal="true" aria-label="小手机图标" onKeyDown={e=>{
      if(e.key==='Escape'){e.stopPropagation();setOpen(false);}
      if(e.key==='Tab'){const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary')??[]).filter(n=>n.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    }}>
      <header><button type="button" ref={back} data-swipe-back aria-label="返回美化" onClick={()=>setOpen(false)}><ArrowLeft size={21}/></button><h2>小手机图标</h2><span/></header>
      <nav className="launcher-category-tabs" aria-label="图标分类">{['全部',...LAUNCHER_ICON_CATEGORIES].map(name=><button key={name} type="button" aria-pressed={category===name} onClick={()=>setCategory(name)}>{name}</button>)}</nav>
      <div className="launcher-gallery-scroll">{LAUNCHER_ICON_CATEGORIES.filter(name=>category==='全部'||category===name).map(name=><section className="launcher-icon-group" key={name} aria-label={`${name}图标`}><h3>{name}</h3><div className={`launcher-icon-grid${name==='游戏机'?' is-machines':''}`}>{LAUNCHER_ICONS.filter(icon=>icon.category===name).map(icon=><button key={icon.id} type="button" aria-label={`选择${icon.name}桌面图标`} aria-pressed={selected===icon.id} onClick={()=>choose(icon.id)}><span className="launcher-icon-preview"><img src={launcherIconPaths(icon.id).image} alt={icon.name} loading="lazy"/>{selected===icon.id&&<i><Check size={13}/></i>}</span><span>{icon.name}{icon.id===DEFAULT_LAUNCHER_ICON&&<small>默认</small>}</span></button>)}</div></section>)}</div>
      <footer><div><img src={paths.image} alt=""/><span><small>当前图标</small><strong>{current.name}</strong></span><a href={paths.image} download={`歪歪机-${current.name}.png`}><Download size={14}/>保存图标</a></div><details><summary>桌面图标没有更新？</summary><p>如果浏览器不支持直接更换图标，请先导出整机备份，再在浏览器打开歪歪机网页，选择图标后添加到手机桌面，最后按需导入备份。备份完成前请保留旧入口。</p></details>{error&&<p role="alert">{error}</p>}</footer>
    </section>,container)}
  </>;
}
