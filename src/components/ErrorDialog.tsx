import React, { useEffect, useState } from 'react';
import { requestConfiguredAiText } from '../utils/aiApi';

const ERROR_EVENT = 'yyphone:error';

interface YyErrorDetail {
  title?: string;
  message: string;
  time: string;
}

// 任何地方都可以调用，弹出可爱的报错窗，方便玩家复制报错内容去求助。
export const showYyError = (message: string, title?: string) => {
  window.dispatchEvent(new CustomEvent<YyErrorDetail>(ERROR_EVENT, {
    detail: { title, message, time: new Date().toLocaleString() },
  }));
};

/** 状态里的报错文字一出现就弹出可爱报错窗（页面内原有的红字仍保留）。 */
export const useErrorDialog = (error: string | null | undefined, title?: string) => {
  useEffect(() => {
    if (error) showYyError(error, title);
  }, [error, title]);
};

const ASK_AI_SYSTEM = [
  '你是「歪歪机 YYphone」的贴心小助手。歪歪机是一款手机模拟 PWA，里面有微信、淘宝/饿了么/闲鱼、论坛、番茄钟、支付宝、记忆、线下模式、查手机、情侣空间、设置等 App；AI 相关功能依赖用户在「设置」里保存的 API 预设（端点、密钥、模型），记忆的向量化另有单独的接口配置。',
  '用户遇到了下面的报错。请用简短、口语化、友好的中文回答：1）一句话说明大概是什么问题；2）最可能的原因（按可能性排序，最多 3 条）；3）用户可以自己尝试的具体步骤（最多 4 步，涉及设置时说明去哪里）。',
  '不确定就直说不确定，不要编造；如果看起来是程序 bug，建议用户点「复制报错」发给开发者。控制在 250 字以内，不要用 markdown 标题。',
].join('\n');

export const ErrorDialogHost: React.FC = () => {
  const [error, setError] = useState<YyErrorDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    const handler = (event: Event) => {
      setError((event as CustomEvent<YyErrorDetail>).detail);
      setCopied(false);
      setAnswer('');
      setAsking(false);
    };
    window.addEventListener(ERROR_EVENT, handler);
    return () => window.removeEventListener(ERROR_EVENT, handler);
  }, []);

  if (!error) return null;

  const fullText = `【歪歪机报错】${error.title ? `${error.title}\n` : '\n'}${error.message}\n时间：${error.time}\n环境：${navigator.userAgent}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      const area = document.createElement('textarea');
      area.value = fullText;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
  };

  const askAi = async () => {
    if (asking) return;
    setAsking(true);
    setAnswer('');
    try {
      setAnswer(await requestConfiguredAiText(ASK_AI_SYSTEM, fullText, { temperature: 0.3, maxTokens: 800 }));
    } catch (askError) {
      setAnswer(`没能问到 AI：${askError instanceof Error ? askError.message : String(askError)}\n\n如果这个报错本身就和 API 有关，请先去「设置」检查 API 预设；也可以点「复制报错」发给开发者。`);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[90] flex items-center justify-center bg-slate-900/20 p-5 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-label="报错提示"
        className="flex max-h-full w-full max-w-xs select-text flex-col rounded-[28px] border border-white/90 bg-gradient-to-br from-pink-50/95 via-white/95 to-sky-50/95 p-5 text-center shadow-[0_18px_50px_rgba(130,150,190,0.35)]"
      >
        <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/80 text-3xl shadow-sm">🥺</div>
        <h3 className="mt-2.5 shrink-0 text-sm font-bold text-[#7A8B9A]">{error.title || '呜…歪歪机出错了'}</h3>
        <p className="mt-1 shrink-0 text-[11px] text-slate-400">别担心，可以复制下面的内容发给开发者，或者点「问AI」让它帮你看看</p>
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          <div className="max-h-32 overflow-y-auto rounded-2xl border border-white bg-white/70 p-3 text-left text-[11px] leading-relaxed text-slate-500 break-words whitespace-pre-wrap">
            {error.message}
            <p className="mt-2 text-[10px] text-slate-300">{error.time}</p>
          </div>
          {(asking || answer) && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-left text-[11px] leading-relaxed text-[#5B7485] break-words whitespace-pre-wrap">
              <p className="mb-1 text-[10px] font-bold text-sky-400">🤖 AI 的看法</p>
              {asking ? '正在想…' : answer}
            </div>
          )}
        </div>
        <div className="mt-4 grid shrink-0 grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-2xl bg-gradient-to-r from-[#F5C6D6] to-[#BFD9F0] py-2 text-xs font-bold text-[#6F7F8E] active:scale-95"
          >
            {copied ? '已复制 ✓' : '复制报错'}
          </button>
          <button
            type="button"
            disabled={asking}
            onClick={() => void askAi()}
            className="rounded-2xl border border-sky-100 bg-sky-50 py-2 text-xs font-bold text-[#5B7485] active:scale-95 disabled:opacity-50"
          >
            {asking ? '思考中' : '问AI'}
          </button>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded-2xl border border-white bg-white/80 py-2 text-xs text-slate-400 active:scale-95"
          >
            知道啦
          </button>
        </div>
      </div>
    </div>
  );
};
