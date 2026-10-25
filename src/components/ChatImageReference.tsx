import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { compressChatPhoto } from '../utils/imageFile';
import type { ImageGenerationProvider } from '../utils/imageGeneration';

export function ChatImageReference({ value, similarity, provider, onChange, onSimilarityChange, onBusyChange }: {
  value?: string; similarity?: number; provider: ImageGenerationProvider;
  onChange: (image: string) => void; onSimilarityChange: (similarity: number) => void; onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const processing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; onBusyChange(false); };
  }, [onBusyChange]);
  const upload = async (file?: File) => {
    if (!file || processing.current) return;
    processing.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      const image = await compressChatPhoto(file);
      if (active.current) onChange(image);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : '参考图读取失败，请重新选择。');
    } finally {
      processing.current = false;
      if (active.current) { setBusy(false); onBusyChange(false); }
    }
  };
  return <div className="space-y-2 rounded-xl border border-sky-100 bg-white/70 p-3">
    <p className="text-[11px] font-semibold text-[#2C4A5C]">生图参考图（选填）</p>
    <input ref={input} type="file" accept="image/*" aria-label="上传生图参考图" className="hidden" disabled={busy || provider === 'imagen'}
      onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} />
    {value && <img src={value} alt="当前对话的生图参考图" className="max-h-48 w-full rounded-xl bg-white object-contain" />}
    <div className="flex gap-2">
      <button type="button" disabled={busy || provider === 'imagen'} onClick={() => input.current?.click()}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 disabled:opacity-50"><ImagePlus size={14} />{busy ? '正在处理参考图…' : value ? '更换参考图' : '添加参考图'}</button>
      {value && <button type="button" disabled={busy} aria-label="移除生图参考图" onClick={() => { onChange(''); setError(''); }} className="rounded-xl bg-rose-50 px-3 text-rose-600 disabled:opacity-50"><Trash2 size={14} /></button>}
    </div>
    {value && <label className="block text-[11px] font-semibold text-[#2C4A5C]">
      <span className="flex justify-between"><span>参考图相似度</span><span>{Math.round((similarity ?? 0.7) * 100)}%</span></span>
      <input type="range" aria-label="参考图相似度" min="0" max="100" step="5" value={Math.round((similarity ?? 0.7) * 100)} onChange={(event) => onSimilarityChange(Number(event.target.value) / 100)} className="mt-2 w-full accent-sky-400" />
      <span className="flex justify-between text-[10px] font-normal text-slate-400"><span>自由发挥</span><span>贴近参考</span></span>
    </label>}
    <p className="text-[10px] leading-relaxed text-slate-400">仅用于当前对话，保存设置后生效。参考图会压缩保存在本机，生图时发送给你配置的服务。</p>
    <p className="text-[10px] leading-relaxed text-slate-400">{provider === 'novelai' ? '相似度越高，重绘强度越低，越贴近原图。' : provider === 'imagen' ? '当前 Imagen 文生图接口不支持参考图，请先在设置中切换生图服务商。' : provider === 'openai' ? '需要支持图片编辑的模型与接口。相似度通过参考提示词及模型支持的保真档位控制，不代表精确匹配比例。' : 'Gemini 通过图片与参考提示词控制贴近程度，相似度不代表精确匹配比例。'}</p>
    {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
  </div>;
}
