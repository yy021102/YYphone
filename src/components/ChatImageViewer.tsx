import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';

export function ChatImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div ref={dialog} role="dialog" aria-modal="true" aria-label="查看聊天图片" className="absolute inset-0 z-[85] flex flex-col bg-[#11151c] text-white" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') {
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      const first = buttons?.[0], last = buttons?.[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]"><span className="text-xs text-white/70">图片</span><button ref={close} type="button" aria-label="关闭图片预览" onClick={onClose} className="rounded-full bg-white/10 p-2"><X size={20} /></button></header>
    <div ref={viewport} className="min-h-0 flex-1 overflow-auto" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      {error ? <p role="alert" className="p-8 text-center text-sm text-white/70">图片暂时无法加载</p> : <div className="flex items-center justify-center" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}><img src={src} alt="聊天图片大图" draggable={false} onError={() => setError(true)} className="h-full w-full object-contain" /></div>}
    </div>
    <footer className="flex shrink-0 items-center justify-center gap-5 px-4 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
      <button type="button" aria-label="缩小图片" disabled={zoom <= 1 || error} onClick={() => setZoom(n => Math.max(1, n - 0.5))} className="rounded-full bg-white/10 p-2 disabled:opacity-30"><Minus size={18} /></button>
      <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="放大图片" disabled={zoom >= 4 || error} onClick={() => setZoom(n => Math.min(4, n + 0.5))} className="rounded-full bg-white/10 p-2 disabled:opacity-30"><Plus size={18} /></button>
      <button type="button" aria-label="还原图片大小" onClick={() => { setZoom(1); viewport.current?.scrollTo(0, 0); }} className="rounded-full bg-white/10 p-2"><RotateCcw size={18} /></button>
    </footer>
  </div>;
}
