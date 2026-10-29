import { useEffect, useRef, useState } from 'react';
import { Radio, RefreshCw } from 'lucide-react';
import { requestConfiguredAiText, type ApiConnection } from '../utils/aiApi';

export function ChatApiConnectionTest({ connection }: { connection: ApiConnection }) {
  const identity = JSON.stringify(connection);
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [result, setResult] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    request.current?.abort(); request.current = null;
    setBusy(false); setResult(''); setError('');
    return () => { request.current?.abort(); request.current = null; };
  }, [identity]);
  const test = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setResult(''); setError('');
    const started = performance.now(), timer = setTimeout(() => controller.abort(), 60000);
    try {
      await requestConfiguredAiText('这是 API 连接测试，只回复 OK。', '请确认连接。', {
        api: connection, includeGlobalWorldBooks: false, signal: controller.signal,
      });
      if (request.current === controller) setResult(`连接成功 · ${((performance.now() - started) / 1000).toFixed(1)} 秒`);
    } catch (cause) {
      if (request.current === controller) {
        const message = controller.signal.aborted ? '测试超时，请检查网络或接口后重试。'
          : cause instanceof TypeError ? '无法连接，请检查接口地址、网络和服务的跨域设置。'
          : cause instanceof Error ? cause.message : '连接测试失败，请重试。';
        const key = connection.apiKey.trim();
        setError(key ? message.replaceAll(key, '***') : message);
      }
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={() => void test()} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white bg-white/80 py-2 text-xs font-semibold text-[#526b82] disabled:opacity-50">
      {busy ? <RefreshCw size={14} className="animate-spin"/> : <Radio size={14}/>} {busy ? '正在测试连接…' : '测试 API 连接'}
    </button>
    <p className="text-[10px] leading-relaxed text-slate-400">用当前填写的模型发送简短测试消息，无需先保存。</p>
    {result && <p role="status" className="text-[11px] text-emerald-700">{result}</p>}
    {error && <p role="alert" className="break-words text-[11px] text-rose-600">{error}</p>}
  </div>;
}
