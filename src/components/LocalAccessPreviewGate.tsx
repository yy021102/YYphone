import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gate } from '../../server/access/gate.mjs';

// Render the same page the Cloudflare gate serves, with local-only controls.
// This module is selected only by import.meta.env.DEV, never as authorization.
const previewHtml = gate
  .replace('id="discordLogin" hidden', 'id="discordLogin"')
  .replace('<body>', '<body><button id="previewPhone" type="button" aria-label="进入小手机本地预览" style="position:fixed;right:14px;top:12px;border:0;background:transparent;color:#9aa8ba;font-size:11px;padding:7px;z-index:2">预览</button>')
  .replace('</html>', `<script>
    document.querySelector('form').addEventListener('submit',event=>{
      event.preventDefault();event.stopImmediatePropagation();
      document.querySelector('#error').textContent='这里是本地页面预览，暂不提交账号信息。可点右上角“预览”继续查看小手机。';
    },true);
    document.querySelector('#discordLogin a').onclick=event=>{
      event.preventDefault();
      document.querySelector('#error').textContent='Discord 真实授权将在正式站启用；本地预览不会读取你的 Discord 账号。';
    };
    document.querySelector('#previewPhone').onclick=()=>parent.postMessage({type:'yyphone-local-preview-open'},'*');
  </script></html>`);

export function LocalAccessPreviewGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source === frame.current?.contentWindow && event.data?.type === 'yyphone-local-preview-open') setOpen(true);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  if (open) return <>{children}<button type="button" onClick={() => setOpen(false)} style={{ position: 'fixed', right: 12, top: 12, zIndex: 2147483647, border: '1px solid #ddd5e5', borderRadius: 20, padding: '8px 14px', background: '#fff', color: '#79628f', fontSize: 12 }}>返回验证页 · 本地预览</button></>;
  return <iframe ref={frame} title="小手机注册登录验证" srcDoc={previewHtml} style={{ position: 'fixed', inset: 0, width: '100%', height: '100dvh', border: 0, background: '#f3f0f7', zIndex: 2147483646 }} />;
}
