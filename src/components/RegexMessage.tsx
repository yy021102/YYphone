import { useEffect, useRef, useState } from 'react';
import { CHAT_REGEX_EVENT, readChatRegex, type ChatRegexSettings } from '../utils/chatRegex';
import { runChatRegex } from '../utils/chatRegexRunner';

export function useChatRegex() {
  const [settings, setSettings] = useState(readChatRegex);
  useEffect(() => { const refresh = () => setSettings(readChatRegex()); window.addEventListener(CHAT_REGEX_EVENT, refresh); return () => window.removeEventListener(CHAT_REGEX_EVENT, refresh); }, []);
  return settings;
}

export function regexHtmlDocument(html: string, dark: boolean): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,link,meta,base,form,input,textarea,select,button').forEach(node => node.remove());
  doc.querySelectorAll('*').forEach(node => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ['href', 'xlink:href', 'srcdoc', 'srcset', 'action', 'formaction'].includes(name) || name === 'src' && (node.tagName !== 'IMG' || !/^(https:\/\/|data:image\/(?:png|jpeg|gif|webp|avif);base64,)/i.test(attr.value))) node.removeAttribute(attr.name);
    }
  });
  const styles = Array.from(doc.head.querySelectorAll('style')).map(node => node.outerHTML).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><style>html{background:transparent;color:${dark ? '#e8e8e8' : '#333'};color-scheme:${dark ? 'dark' : 'light'}}body{margin:0;display:flow-root;font:14px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}*{box-sizing:border-box;max-width:100%}img{height:auto}pre{white-space:pre-wrap}</style>${styles}</head><body>${doc.body.innerHTML}</body></html>`;
}

export function RegexMessage({ text, sender, settings, dark = false, onError }: { text: string; sender: 'character' | 'user'; settings: ChatRegexSettings; dark?: boolean; onError?: (message: string) => void }) {
  const [result, setResult] = useState<{ source: string; settings: ChatRegexSettings; html: string; name: string } | null>(null);
  const [height, setHeight] = useState(80);
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    let alive = true;
    void runChatRegex(text, sender, settings).then(value => {
      if (alive) { setResult(value ? { source: text, settings, html: regexHtmlDocument(value.html, dark), name: value.ruleName } : null); onError?.(''); }
    }).catch(error => { if (alive) { setResult(null); onError?.(error instanceof Error ? error.message : '正则执行失败。'); } });
    return () => { alive = false; };
  }, [text, sender, settings, dark, onError]);
  useEffect(() => () => observer.current?.disconnect(), []);
  if (!result || result.source !== text || result.settings !== settings) return <>{text}</>;
  return <span className="yy-regex-message" style={{ display: 'block', width: 'min(270px, 100%)', maxWidth: '100%' }}>
    <iframe title={`正则美化：${result.name}`} sandbox="allow-same-origin" referrerPolicy="no-referrer" tabIndex={-1} srcDoc={result.html}
      style={{ display: 'block', border: 0, width: '100%', height, background: 'transparent', pointerEvents: 'none' }}
      onLoad={event => {
        observer.current?.disconnect(); const doc = event.currentTarget.contentDocument;
        if (!doc) return;
        const resize = () => setHeight(Math.max(24, Math.min(2400, Math.ceil(doc.body.getBoundingClientRect().height))));
        resize(); observer.current = new ResizeObserver(resize); observer.current.observe(doc.body);
      }} />
  </span>;
}
