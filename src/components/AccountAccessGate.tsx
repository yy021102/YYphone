import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gate } from '../../server/access/gate.mjs';
import { accessRequest, forgetAccountSession, readAccountAccess } from '../utils/accountAccess';

const html = gate.replace('id="discordLogin" hidden', 'id="discordLogin"').replace('</html>', `<script>
document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const button=document.getElementById('submit');if(button.disabled)return;button.disabled=true;document.getElementById('error').textContent='';parent.postMessage({type:'yyphone-account-submit',register,data:Object.fromEntries(new FormData(event.target))},'*')},true);
document.querySelector('#discordLogin a').onclick=event=>{event.preventDefault();parent.postMessage({type:'yyphone-account-discord'},'*')};
</script></html>`);
const discordErrors: Record<string, string> = {
  not_member: '你尚未加入指定服务器，或尚未完成服务器的入群验证。',
  banned: '此账号已被封禁，请联系作者。', device_limit: '已绑定两个设备，请联系作者解绑旧设备。',
  cancelled: '已取消 Discord 授权，可重新尝试。', state: '登录验证已过期，请重新登录。'
};
export function AccountAccessGate({ children }: { children: ReactNode }) {
  const base = (import.meta.env.VITE_ACCESS_API_URL || 'https://yyphone.pages.dev').replace(/\/$/, '');
  const [open, setOpen] = useState(false), [checking, setChecking] = useState(true), [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null), busy = useRef(false);
  const showError = (text: string) => { setError(text); const doc = frame.current?.contentDocument; if (doc?.getElementById('error')) doc.getElementById('error')!.textContent = text; const button = doc?.getElementById('submit') as HTMLButtonElement | null; if (button) button.disabled = false; };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const url = new URL(location.href), grant = url.hash.match(/^#yyphone_access=([a-f0-9]{64})$/)?.[1];
        if (grant) {
          history.replaceState(null, '', url.pathname + url.search);
          const exchanged = await accessRequest(base, 'exchange', { grant });
          if (exchanged.return_url && new URL(exchanged.return_url).origin === location.origin) history.replaceState(null, '', exchanged.return_url);
        }
        const discordError = url.searchParams.get('discord_error');
        if (discordError) { url.searchParams.delete('discord_error');history.replaceState(null, '', url.pathname + url.search);if (active) setError(discordErrors[discordError] || 'Discord 登录未完成，请重新尝试。'); }
        const record = await readAccountAccess();
        if (record.token) { await accessRequest(base, 'me'); if (active) setOpen(true); }
      } catch (cause) {
        await forgetAccountSession().catch(() => {});
        if (active && (cause as { status?: number }).status !== 401) setError(cause instanceof Error ? cause.message : '无法连接验证服务。');
      } finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [base]);
  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || busy.current) return;
      if (!['yyphone-account-submit', 'yyphone-account-discord'].includes(event.data?.type)) return;
      busy.current = true;showError('');
      try {
        if (event.data.type === 'yyphone-account-discord') {
          const result = await accessRequest(base, 'discord/start', { return_url: location.href });
          if (new URL(result.url).origin !== new URL(base).origin) throw Error('登录地址不正确。');
          if (result.method === 'POST') {
            const form = document.createElement('form');form.method = 'POST';form.action = result.url;
            const ticket = document.createElement('input');ticket.type = 'hidden';ticket.name = 'ticket';ticket.value = result.fields.ticket;form.append(ticket);
            document.body.append(form);form.submit();
          } else location.assign(result.url);
        } else { await accessRequest(base, event.data.register ? 'register' : 'login', event.data.data);await accessRequest(base, 'me');setOpen(true); }
      } catch (cause) { showError(cause instanceof Error ? cause.message : '连接失败，请稍后重试。'); }
      finally { busy.current = false; }
    };
    window.addEventListener('message', receive);return () => window.removeEventListener('message', receive);
  }, [base]);
  useEffect(() => {
    if (!open) return;
    const recheck = () => { if (document.visibilityState !== 'visible') return;void accessRequest(base, 'me').catch(async cause => { if (cause.status === 401 || cause.status === 403) { await forgetAccountSession();setOpen(false);setError('登录已失效，请重新验证。'); } }); };
    const timer = window.setInterval(recheck, 5 * 60000);window.addEventListener('focus', recheck);
    return () => { clearInterval(timer);window.removeEventListener('focus', recheck); };
  }, [open, base]);
  if (checking) return <div style={{ position: 'fixed', inset: 0, background: '#eef2fa' }} aria-label="正在检查登录状态" />;
  if (open) return children;
  return <iframe ref={frame} title="小手机注册登录验证" srcDoc={html} onLoad={() => showError(error)} style={{ position: 'fixed', inset: 0, width: '100%', height: '100dvh', border: 0, background: '#eef2fa', zIndex: 2147483646 }} />;
}
