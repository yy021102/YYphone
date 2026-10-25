import { useEffect, useRef, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { getActiveApiPreset } from '../utils/aiApi';
import { generateImage, type ImageGenerationSettings } from '../utils/imageGeneration';
import { synthesizeVoice, type VoiceModelSettings } from '../utils/voiceModel';

function useMediaTest<T>(settings: unknown, extra?: unknown) {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    active.current?.abort(); active.current = null;
    setBusy(false); setResult(null); setError('');
    return () => { active.current?.abort(); active.current = null; };
  }, [settings, extra]);
  const run = async (request: (signal: AbortSignal) => Promise<T>) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setResult(null); setError('');
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const value = await request(controller.signal);
      if (active.current === controller) setResult(value);
    } catch (cause) {
      if (active.current === controller) setError(controller.signal.aborted ? '测试超时，请检查网络或接口后重试。' : cause instanceof Error ? cause.message : '连接测试失败，请重试。');
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  };
  return { run, busy, result, error };
}

export function VoiceConnectionTest({ settings }: { settings: VoiceModelSettings }) {
  const provider = settings.provider ?? 'openai';
  const defaultVoice = provider === 'openai' ? 'alloy' : provider === 'minimax' ? 'male-qn-qingse' : '';
  const [voiceId, setVoiceId] = useState(defaultVoice);
  const [audioUrl, setAudioUrl] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const test = useMediaTest<Blob>(settings, voiceId);
  useEffect(() => { setVoiceId(defaultVoice); }, [defaultVoice]);
  useEffect(() => {
    setPlaybackError('');
    if (!test.result) { setAudioUrl(''); return; }
    const url = URL.createObjectURL(test.result);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [test.result]);
  return <div className="space-y-2 rounded-xl border border-white/80 bg-white/50 p-3">
    <label className="block text-[11px] font-semibold text-[#2C4A5C]">测试音色 ID
      <input value={voiceId} onChange={(event) => setVoiceId(event.target.value)} placeholder="填写可用的音色 ID"
        className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2 text-xs font-mono" />
    </label>
    <p className="text-[10px] leading-relaxed text-slate-400">使用当前填写的配置和语速，生成“你好，天天开心”供试听；无需先保存，可能消耗语音额度。测试音色不修改角色音色。</p>
    <button type="button" disabled={test.busy || !voiceId.trim()} onClick={() => void test.run((signal) => synthesizeVoice('你好，天天开心。', voiceId, '中文', { settings, signal }))}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white bg-white/80 py-2 text-xs font-semibold text-[#526b82] disabled:opacity-50">
      {test.busy ? <RefreshCw size={14} className="animate-spin" /> : <Radio size={14} />}{test.busy ? '正在测试语音连接…' : '测试语音连接'}
    </button>
    {test.busy && <p role="status" className="text-[11px] text-slate-500">正在生成测试语音…</p>}
    {test.error && <p role="alert" className="break-words text-[11px] text-rose-600">{test.error}</p>}
    {audioUrl && <><p role="status" className="text-[11px] text-emerald-700">连接成功，已返回测试音频。</p><audio aria-label="语音连接测试试听" controls src={audioUrl} className="w-full max-w-full" onError={() => setPlaybackError('已返回数据，但浏览器无法播放；请确认接口返回了有效音频。')} /></>}
    {playbackError && <p role="alert" className="text-[11px] text-rose-600">{playbackError}</p>}
  </div>;
}

export function ImageConnectionTest({ settings }: { settings: ImageGenerationSettings }) {
  const test = useMediaTest<string>(settings);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => { setPreviewError(''); }, [test.result]);
  return <div className="space-y-2 rounded-xl border border-white/80 bg-white/50 p-3">
    <p className="text-[10px] leading-relaxed text-slate-400">用当前填写的配置和所选尺寸生成一张“小花”测试图；无需先保存，可能消耗生图额度。</p>
    <button type="button" disabled={test.busy} onClick={() => void test.run((signal) => {
      let fallback;
      try { fallback = getActiveApiPreset(); } catch { /* A separate image API needs no chat API. */ }
      return generateImage('A single small pastel flower on a plain white background.', settings, fallback, signal);
    })} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white bg-white/80 py-2 text-xs font-semibold text-[#526b82] disabled:opacity-50">
      <RefreshCw size={14} className={test.busy ? 'animate-spin' : ''} />{test.busy ? '正在测试生图连接…' : '测试生图连接'}
    </button>
    {test.busy && <p role="status" className="text-[11px] text-slate-500">正在生成测试图片…</p>}
    {test.error && <p role="alert" className="break-words text-[11px] text-rose-600">{test.error}</p>}
    {test.result && <><p role="status" className="text-[11px] text-emerald-700">连接成功，已返回测试图片。</p><img alt="生图连接测试结果" src={test.result} className="max-h-48 w-full rounded-xl bg-white object-contain" onError={() => setPreviewError('接口已返回图片地址，但预览加载失败，请检查图片地址是否可访问。')} /></>}
    {previewError && <p role="alert" className="text-[11px] text-rose-600">{previewError}</p>}
  </div>;
}
