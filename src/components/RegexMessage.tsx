import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { CHAT_REGEX_EVENT, readChatRegex, type ChatRegexSettings } from '../utils/chatRegex';
import { runChatRegex } from '../utils/chatRegexRunner';

export function useChatRegex() {
  const [settings, setSettings] = useState(readChatRegex);
  useEffect(() => { const refresh = () => setSettings(readChatRegex()); window.addEventListener(CHAT_REGEX_EVENT, refresh); return () => window.removeEventListener(CHAT_REGEX_EVENT, refresh); }, []);
  return settings;
}

export function regexHtmlDocument(html: string, dark: boolean, interactive = false, token = crypto.randomUUID()): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('iframe,object,embed,link,meta,base').forEach(node => node.remove());
  if (!interactive) doc.querySelectorAll('script').forEach(node => node.remove());
  doc.querySelectorAll('*').forEach(node => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') && !interactive || ['xlink:href', 'srcdoc', 'srcset', 'action', 'formaction'].includes(name) || name === 'href' && !attr.value.startsWith('#') || name === 'src' && (node.tagName !== 'IMG' || !/^(https:\/\/|data:image\/(?:png|jpeg|gif|webp|avif);base64,)/i.test(attr.value))) node.removeAttribute(attr.name);
    }
  });
  const styles = Array.from(doc.head.querySelectorAll('style,script')).map(node => node.outerHTML).join('');
  const nonce = crypto.randomUUID();
  const bridge = `(()=>{let last=0,queued=false;const token=${JSON.stringify(token)};const resize=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;const height=Math.ceil(document.body.getBoundingClientRect().height);if(height!==last){last=height;parent.postMessage({type:'yy-regex-height',token,height},'*')}})};new ResizeObserver(resize).observe(document.body);new MutationObserver(resize).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});addEventListener('load',resize);addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='yy-regex-measure'&&e.data.token===token){last=-1;resize()}});document.addEventListener('submit',e=>e.preventDefault(),true);document.addEventListener('toggle',resize,true);document.addEventListener('click',e=>{const a=e.target.closest?.('a');if(a&&!a.getAttribute('href')?.startsWith('#'))e.preventDefault();resize()},true);resize()})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${interactive ? "'unsafe-inline'" : `'nonce-${nonce}'`}; connect-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><style>html{background:transparent;color:${dark ? '#e8e8e8' : '#333'};color-scheme:${dark ? 'dark' : 'light'}}body{margin:0;display:flow-root;font:14px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}*{box-sizing:border-box;max-width:100%}img{height:auto}pre{white-space:pre-wrap}</style>${styles}</head><body>${doc.body.innerHTML}<script nonce="${nonce}">${bridge}</script></body></html>`;
}

export function RegexMessage({ text, sender, settings, dark = false, disabled = false, onError, onActions }: { text: string; sender: 'character' | 'user'; settings: ChatRegexSettings; dark?: boolean; disabled?: boolean; onError?: (message: string) => void; onActions?: () => void }) {
  const [result, setResult] = useState<{ source: string; settings: ChatRegexSettings; html: string; name: string; token: string } | null>(null);
  const [height, setHeight] = useState(80);
  const [showSource, setShowSource] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let alive = true;
    void runChatRegex(text, sender, settings).then(value => {
      if (alive) { const token = crypto.randomUUID(); setResult(value ? { source: text, settings, html: regexHtmlDocument(value.html, dark, value.interactive, token), name: value.ruleName, token } : null); onError?.(''); }
    }).catch(error => { if (alive) { setResult(null); onError?.(error instanceof Error ? error.message : '正则执行失败。'); } });
    return () => { alive = false; };
  }, [text, sender, settings, dark, onError]);
  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (!result || event.source !== frame.current?.contentWindow || event.data?.type !== 'yy-regex-height' || event.data.token !== result.token || typeof event.data.height !== 'number' || !Number.isFinite(event.data.height)) return;
      setHeight(Math.max(24, Math.min(2400, event.data.height)));
    };
    window.addEventListener('message', resize);
    if (result) frame.current?.contentWindow?.postMessage({ type: 'yy-regex-measure', token: result.token }, '*');
    return () => window.removeEventListener('message', resize);
  }, [result]);
  if (!result || result.source !== text || result.settings !== settings) return <>{text}</>;
  return <span className="yy-regex-message" style={{ display: 'block', width: 'min(300px, 100%)', maxWidth: '100%' }}>
    <iframe ref={frame} title={`正则美化：${result.name}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={result.html} tabIndex={disabled ? -1 : undefined}
      onLoad={() => frame.current?.contentWindow?.postMessage({ type: 'yy-regex-measure', token: result.token }, '*')}
      style={{ display: 'block', border: 0, width: '100%', height, background: 'transparent', pointerEvents: disabled ? 'none' : undefined }} />
    {!disabled && <span className="flex items-center justify-end gap-3 pt-1 text-[10px] text-slate-400" onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
      <button type="button" aria-label={showSource ? '收起卡片原文' : '查看卡片原文'} onClick={() => setShowSource(value => !value)} className="px-1 py-0.5"><Pencil size={12} /></button>
      {onActions && <button type="button" aria-label="卡片消息操作" onClick={onActions} className="px-1 py-0.5">···</button>}
    </span>}
    {showSource && !disabled && <span className="mt-1 block max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-100/70 p-2 text-xs text-slate-500" onClick={event => event.stopPropagation()}>{text}</span>}
  </span>;
}
