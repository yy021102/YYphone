import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

type Status = 'checking' | 'granted' | 'not-granted' | 'unsupported' | 'error';
const labels: Record<Status, string> = {
  checking: '正在检查…', granted: '已获得持久化保护', 'not-granted': '浏览器尚未授予持久化保护',
  unsupported: '当前浏览器不支持此功能', error: '暂时无法读取保护状态',
};

export function PersistentStorageSettings() {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const version = useRef(0);
  const requesting = useRef(false);
  useEffect(() => {
    const check = async () => {
      if (requesting.current) return;
      const current = ++version.current;
      if (!navigator.storage?.persisted || !navigator.storage?.persist) { setStatus('unsupported'); return; }
      try {
        const granted = await navigator.storage.persisted();
        if (version.current === current) setStatus(granted ? 'granted' : 'not-granted');
      } catch { if (version.current === current) setStatus('error'); }
    };
    void check(); window.addEventListener('focus', check);
    return () => { version.current++; window.removeEventListener('focus', check); };
  }, []);
  const request = async () => {
    if (requesting.current || !navigator.storage?.persist) return;
    requesting.current = true;
    const current = ++version.current;
    setBusy(true); setNotice('');
    try {
      const granted = await navigator.storage.persist();
      if (current === version.current) {
        setStatus(granted ? 'granted' : 'not-granted');
        setNotice(granted ? '浏览器已授予保护。' : '浏览器此次未授予保护，现有数据不受影响。');
      }
    } catch { if (current === version.current) setNotice('申请未完成，请稍后再试。'); }
    finally { requesting.current = false; if (current === version.current) setBusy(false); }
  };
  return <section className="settings-card space-y-3" aria-label="持久化存储">
    <h3 className="settings-card-heading"><span className="settings-icon" data-tone="blue"><ShieldCheck size={17} strokeWidth={1.7}/></span>持久化存储</h3>
    <p className="text-xs text-slate-600" role="status">{labels[status]}</p>
    <p className="text-[11px] leading-relaxed text-slate-500">获得授权后，可防止浏览器因存储空间紧张而自动清理本站数据。是否授权由浏览器决定。</p>
    {status !== 'granted' && status !== 'unsupported' && <button type="button" disabled={busy || status === 'checking'} onClick={() => void request()}
      className="w-full rounded-xl bg-white/80 py-2 text-xs font-bold text-[#2C4A5C] disabled:opacity-50">{busy ? '正在申请…' : '申请持久化保护'}</button>}
    {notice && <p className="text-[11px] text-sky-700" role="status">{notice}</p>}
    <p className="text-[11px] leading-relaxed text-slate-500">这不是云备份；手动清除网站数据、卸载或更换设备仍可能丢失数据，请继续定期备份。</p>
  </section>;
}
