import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, KeyRound } from 'lucide-react';
import { accessPhraseHash, DEFAULT_FIRST_USE_PASSWORD_HASH, hasFirstUseAccess, normalizeAccessHash, rememberFirstUseAccess } from '../utils/firstUseAccess';

export function FirstUseGate({ children, passwordHash = import.meta.env?.VITE_FIRST_USE_PASSWORD_HASH || DEFAULT_FIRST_USE_PASSWORD_HASH,
  scope = import.meta.env?.BASE_URL ?? '/' }: { children: ReactNode; passwordHash?: string; scope?: string }) {
  const hash = normalizeAccessHash(passwordHash);
  const [state, setState] = useState<'checking' | 'locked' | 'open'>(passwordHash ? 'checking' : 'open');
  const [phrase, setPhrase] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    if (!passwordHash) { setState('open'); return; }
    if (!hash) { setError('入口口令配置有误，请联系作者。'); setState('locked'); return; }
    setState('checking');
    void hasFirstUseAccess(hash, scope).then(allowed => { if (alive) setState(allowed ? 'open' : 'locked'); });
    return () => { alive = false; };
  }, [hash, scope, passwordHash]);
  if (state === 'open') return children;
  // Resolve the saved authorization before showing any verification UI.
  // Returning visitors only see the phone's quiet background during this read.
  if (state === 'checking') return <main className="first-use-gate" aria-busy="true" aria-label="正在打开歪歪机"/>;
  const unlock = async () => {
    if (busy || !hash) return;
    setBusy(true); setError('');
    try {
      if (await accessPhraseHash(phrase) !== hash) { setError('口令不对，再试一次吧。'); return; }
      await rememberFirstUseAccess(hash, scope); setPhrase(''); setState('open');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '暂时无法验证，请稍后重试。'); }
    finally { setBusy(false); }
  };
  return <main className="first-use-gate"><div className="first-use-orb first-use-orb-blue"/><div className="first-use-orb first-use-orb-pink"/>
    <section className="first-use-card" aria-label="歪歪机首次使用验证"><div className="first-use-key"><KeyRound size={24} strokeWidth={1.4}/></div>
      <p className="first-use-eyebrow">A LITTLE WORLD OF YOUR OWN</p><h1>欢迎来到歪歪机</h1>
      <p>第一次见面，请输入使用口令。</p>
        <form onSubmit={e => { e.preventDefault(); void unlock(); }}><label htmlFor="yyphone-entry-phrase">使用口令</label>
          <input id="yyphone-entry-phrase" type="password" autoComplete="off" autoFocus required value={phrase} disabled={busy} onChange={e => { setPhrase(e.target.value); setError(''); }}/>
          {error && <p className="first-use-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !phrase || !hash}>{busy ? '正在验证…' : '进入歪歪机'}<ArrowRight size={16}/></button>
        </form><small>验证一次，这个浏览器以后就记得你了。</small>
    </section><span className="first-use-footer">愿你在这里，天天开心。</span>
  </main>;
}
