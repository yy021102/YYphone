import accessWorker from './worker.mjs';
import { gate } from './gate.mjs';

// A separate deployment exposes only author tools, never the phone or user login.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/login-preview') {
      const html = gate.replace('id="discordLogin" hidden', 'id="discordLogin"')
        .replace('<main>', '<main><p style="margin-top:0;background:#fff0cc;color:#694600;padding:12px;border-radius:10px"><strong>验证页面预览</strong><br>可切换登录／注册，暂不进行真实授权或注册。</p>')
        .replace('</html>', `<script>document.querySelector('form').addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();document.querySelector('#error').textContent='这是页面预览，暂不提交账号信息。';},true);document.querySelector('#discordLogin a').onclick=event=>{event.preventDefault();document.querySelector('#error').textContent='正式上线后，这里会跳转到 Discord 官方授权页，核验指定服务器的成员身份。';};</script></html>`);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'" } });
    }
    if (url.pathname === '/') return Response.redirect(new URL('/admin', url), 302);
    if (url.pathname !== '/admin' && url.pathname !== '/admin/' && !url.pathname.startsWith('/api/admin/')) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const response = await accessWorker.fetch(request, env);
    if ((url.pathname === '/admin' || url.pathname === '/admin/') && env.ACCESS_READY !== 'true') {
      const html = (await response.text()).replace('<main>', '<main><p style="background:#fff0cc;color:#694600;padding:16px;border-radius:12px"><strong>正式发码后台 · 小手机激活入口尚未上线</strong><br>这里生成的码会保存到正式数据库，请先妥善保存，等门禁上线后再分发。</p>');
      return new Response(html, { status: response.status, headers: response.headers });
    }
    return response;
  }
};
