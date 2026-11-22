import { gateStyle } from './gate-style.mjs';
import { discordLoginMarkup, discordErrorScript } from './discord-ui.mjs';
import { launcherHead, launcherScript } from './launcher-metadata.mjs';

export const gate = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>YYphone·歪歪机</title>${launcherHead}<style>${gateStyle}</style>
<body><main>
<header class="brand"><div class="emblem"><svg width="28" height="30" viewBox="0 0 28 32" fill="none" aria-hidden="true"><rect x="6" y="2" width="16" height="28" rx="5" stroke="currentColor" stroke-width="1.4"/><path d="M11 5h6M12 26h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="m10 15 3 3 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><p class="eyebrow">A LITTLE WORLD OF YOUR OWN</p><h1>欢迎来到歪歪机</h1><p id="intro">把日常装进口袋，把喜欢留在身边。</p></header>
<div class="modes" role="tablist" aria-label="账号登录或注册"><button type="button" id="loginMode" role="tab" aria-selected="true">登录</button><button type="button" id="switch" role="tab" aria-selected="false">注册激活</button></div>
<form>
<label>QQ号（登录账号）<input name="username" autocomplete="username" inputmode="numeric" placeholder="输入你的QQ号" required pattern="[1-9][0-9]{4,11}" maxlength="12"></label>
<label>本站密码<div class="password-wrap"><input name="password" type="password" placeholder="输入本站密码（至少8个字符）" autocomplete="current-password" required minlength="8" maxlength="128"><button class="eye" id="showPassword" type="button" aria-label="显示密码" aria-pressed="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg></button></div></label>
<label id="codeLabel" hidden>作者发放的激活码<input name="code" autocomplete="off" placeholder="粘贴你收到的激活码" maxlength="64"></label>
<button class="primary" id="submit"><span>进入</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</form><p id="error" role="alert"></p>
${discordLoginMarkup}
</main>
<script>
let register=false;
const form=document.querySelector('form'),error=document.querySelector('#error'),submit=document.querySelector('#submit');
function setMode(value){register=value;document.querySelector('#codeLabel').hidden=!register;form.elements.code.required=register;form.elements.password.autocomplete=register?'new-password':'current-password';submit.querySelector('span').textContent=register?'激活':'进入';document.querySelector('#loginMode').setAttribute('aria-selected',String(!register));document.querySelector('#switch').setAttribute('aria-selected',String(register));document.querySelector('#intro').textContent=register?'用一枚激活码，开启属于你的小世界。':'把日常装进口袋，把喜欢留在身边。';error.textContent=''}
document.querySelector('#switch').onclick=()=>setMode(true);document.querySelector('#loginMode').onclick=()=>setMode(false);
document.querySelector('#showPassword').onclick=()=>{const visible=form.elements.password.type==='password';form.elements.password.type=visible?'text':'password';document.querySelector('#showPassword').setAttribute('aria-pressed',String(visible));document.querySelector('#showPassword').setAttribute('aria-label',visible?'隐藏密码':'显示密码')};
form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;error.textContent='';try{const response=await fetch('/api/auth/'+(register?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const data=await response.json();if(!response.ok)throw Error(data.error);location.replace('/')}catch(errorValue){error.textContent=errorValue.message||'连接失败，请稍后再试'}finally{submit.disabled=false}};
</script>${discordErrorScript}${launcherScript}</body></html>`;
