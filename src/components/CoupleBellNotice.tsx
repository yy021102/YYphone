import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { acknowledgeCoupleBell, COUPLE_REWARDS_EVENT, unseenCoupleBell } from '../utils/coupleRewards';
import { readOfflineContacts } from '../utils/offlineData';

export function CoupleBellNotice({ enabled }: { enabled: boolean }) {
  const [notice, setNotice] = useState(unseenCoupleBell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { const refresh = () => setNotice(unseenCoupleBell()); refresh(); window.addEventListener(COUPLE_REWARDS_EVENT, refresh); return () => window.removeEventListener(COUPLE_REWARDS_EVENT, refresh); }, []);
  useEffect(() => { if (notice && enabled) button.current?.focus(); }, [notice, enabled]);
  if (!enabled || !notice) return null;
  const name = readOfflineContacts().find(c => c.id === notice.charId)?.name ?? '对方';
  return <div className="couple-bell-notice" role="dialog" aria-modal="true" aria-labelledby="couple-bell-title" onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); button.current?.focus(); } e.stopPropagation(); }}><section>
    <div className="bell-emblem"><Bell size={29} strokeWidth={1.35} /></div><h2 id="couple-bell-title">对方使用和好摇铃</h2>
    <p>{name}{notice.use.note ? `：${notice.use.note}` : '轻轻摇了摇铃，想和你好好说话。'}</p>
    <small>摇铃已恢复好友关系，使用当天不能再次拉黑。</small>
    {error && <p role="alert">{error}</p>}
    <button ref={button} type="button" disabled={busy} onClick={async () => { if (busy) return; setBusy(true); try { await acknowledgeCoupleBell(notice.charId, notice.use.id); } catch(e) { setError(e instanceof Error ? e.message : '暂时未能关闭，请重试'); } finally { setBusy(false); } }}>知道了</button>
  </section></div>;
}
