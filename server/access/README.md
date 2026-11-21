# 小手机 Cloudflare 门禁

Workers 同域托管小手机与登录页面，D1 保存账号、激活码摘要、设备与会话。所有静态资源均先验证登录。每个激活码只能创建一个账号，每账号最多绑定两个浏览器设备。激活码吊销后，已有会话立即失效。密码采用随机盐 PBKDF2-SHA256（100000 次）；会话与设备凭证为独立随机 256 位 HttpOnly / Secure Cookie，数据库只保存摘要。登录会话七天到期，设备 Cookie 保留一年。退出不会释放设备名额。

这是浏览器设备凭证，不是硬件序列号：清理 Cookie、隐私模式、换浏览器算新设备；复制完整浏览器凭证仍可能冒用。网页内容一旦交付给已授权用户，就无法阻止对方保存或修改前端。此方案用于控制原站访问和提高转售成本，不能承诺杜绝盗版。不要提供用户自行无限解绑；换机由作者审核后重置。

## 部署

### 现有 yyphone.pages.dev 原站（推荐）

无需迁移域名，使用 Pages Advanced Mode 承载同一后端。根目录 `wrangler.jsonc` 是 Pages 发布配置（Pages 不接受自定义配置文件路径）。数据库已创建，后续发布前执行可重复运行的 schema 初始化以补齐新表，然后构建并发布：

```powershell
npx wrangler d1 execute yyphone-access --remote --file server/access/schema.sql
npx wrangler pages secret put ADMIN_TOKEN --project-name yyphone
node server/access/build-pages.mjs
npx wrangler pages deploy --project-name yyphone --branch main
```

发布前确认原项目的生产分支是 main。`build-pages.mjs` 会把门禁打包为 Pages `_worker.js` 并让所有路由经过验证。旧 `/sw.js` 会被替换为清理离线缓存并注销自身的脚本，保留 IndexedDB 和本地存档；已有安装用户可能需要联网关闭后重新打开一次，等待浏览器检查更新。仍可访问的旧部署预览链接和 GitHub Pages 需单独处理，不能仅凭替换生产入口断言所有旧副本均已受保护。

Pages Advanced Mode 文档：https://developers.cloudflare.com/pages/functions/advanced-mode/

### 单独 Workers 域名（备选）

在仓库根目录执行（需你自己的 Cloudflare 账号）：

```powershell
npx wrangler login
npx wrangler d1 create yyphone-access
```

把输出的 database_id 填入 `server/access/wrangler.jsonc`，然后：

```powershell
npx wrangler d1 execute yyphone-access --remote --file server/access/schema.sql --config server/access/wrangler.jsonc
npx wrangler secret put ADMIN_TOKEN --config server/access/wrangler.jsonc
node server/access/build.mjs
npx wrangler deploy --config server/access/wrangler.jsonc
```

ADMIN_TOKEN 请用密码管理器生成至少32字节的随机秘密，只保存在你手里，绝不能放入前端 VITE 环境变量。使用 HTTPS 生产域名。激活码与管理员请求不要写进日志。初次构建依赖现有 npm 安装；Wrangler 由 npx 调用。

门禁构建会禁用 Service Worker 离线缓存，避免缓存的小手机绕过后续授权检查。普通 `npm run build` 仍为原来的无门禁构建，禁止把它当作受保护版本部署。原 GitHub Pages 或其他公开副本必须关闭，否则别人仍能直接访问旧站。项目仓库如果公开，别人仍可自行构建源码。

## 发码与管理

Discord 登录配置在根目录 `wrangler.jsonc`：目标服务器 `1379304008157499423`、Client ID `1573730575842279564`、回调 `https://yyphone.pages.dev/api/auth/discord/callback`。Client Secret 仅存 Cloudflare 项目 yyphone 的 `DISCORD_CLIENT_SECRET` Secret。替换应用凭证可使用 `configure-discord.ps1 -ClientId ...`，在隐藏输入中粘贴密钥。

Discord 登录使用官方 OAuth2 授权码流程和 `identify guilds.members.read` 权限，不需要机器人或读取聊天内容。随机 state 通过十分钟、绑定浏览器的 HttpOnly Cookie 和数据库一次性记录防伪造及重放。账号按 Discord 固定用户 ID 创建，昵称变化不会重建账号，不会自动与QQ用户合并。服务器成员免激活码，仍限制两个浏览器设备，作者可封禁或解绑。尚未完成服务器入群筛选的用户需先完成筛选。

Discord 授权凭证仅加密保存服务端，最多15分钟复查一次成员资格；检测到退服或被移除时撤销该账号的会话。缓存过期后 Discord 接口故障会拒绝访问，稍后可重试。会话不超过七天及 Discord access token 有效期，过期后需重新授权；不保存 refresh token。内部成员授权记录不会计入发码、余量和核销统计，已注册总量包含两种登录方式。Discord 应用密钥和用户令牌均不会发给浏览器。

用户页面预览位于独立后台 `/login-preview`，只能演示外观；正式验证在主站根路径，不使用管理后台域名作为 OAuth 回调。OAuth 文档：https://docs.discord.com/developers/topics/oauth2

用户注册与登录使用QQ号作为本站账号（5–12位数字、不以0开头），并设置独立本站密码。这里不是QQ授权登录，也不校验QQ号归属；页面明确提示不要输入QQ密码。普通主站只有发布门禁构建后才会显示新的QQ登录页。

后台首页提供总激活码、未激活余量、已核销量、已注册量，以及吊销码和封禁用户数量。未激活余量只包含未使用且未吊销的码；已核销指码已用于注册，封禁或解绑后不回收激活码。一码对应一个账号，所以已核销与已注册通常相同。

用户管理支持按全部或部分QQ号查询，筛选正常、封禁或激活码已吊销的用户，每页25人。用户卡片可查看并复制其激活码，看到发放批次、注册和最近登录时间及设备数量。详情里可查看设备的系统／浏览器提示、绑定时间，解绑其中一台或全部设备。浏览器信息仅为辅助识别，不能当作硬件证明。封禁立即撤销已有会话，解封后必须重新登录；解封不会恢复已吊销的激活码。

批量码及新的单独发码均可在后台还原查看；最初版本没有加密留存的历史单码不可还原，页面会明确标注。历史用户缺失注册时间时显示“暂无记录”，不会把发码日期冒充注册日期。用户密码及其摘要不会返回给管理页。

独立管理后台：`https://yyphone-admin.pages.dev/admin`，可直接在手机浏览器打开，输入管理密钥即可使用。与小手机共用正式 D1，管理后台单独发布不会替换小手机原站。后台只暴露作者管理页和受验证的管理接口，不提供用户注册接口。支持按负责人备注创建1–100个激活码（默认50），整批复制、TXT 下载、历史批次重导出，以及查看已注册、已吊销、未使用且有效的数量。每批每个码都独立且仅能注册一次，不是50个人共用一个码。批次生成使用请求编号去重，网络失败重试不会再次生成同一批。

后台重新发布：

```powershell
node server/access/build-admin.mjs
Push-Location server/access/admin-site
npx wrangler pages deploy --project-name yyphone-admin --branch main
Pop-Location
```

后台和小手机两个项目必须使用相同 ADMIN_TOKEN（用于重新导出加密码）和 D1 绑定。小手机门禁正式上线后，将 `server/access/admin-site/wrangler.jsonc` 中 ACCESS_READY 改成 `true` 并重新发布后台，即可去掉暂未上线的提示。

本机 Windows 已加密保存管理密钥，可以运行以下命令打开管理页并把密钥放入剪贴板，再粘贴验证；无须把密钥显示在终端或发给分发管理员：

```powershell
powershell -ExecutionPolicy Bypass -File server/access/manage.ps1
```

该本机密钥文件位于被 Git 忽略的 `.private/admin-token.xml`，通过 Windows 当前用户凭证加密，仅同一 Windows 用户可读取。换电脑前请另行安全备份管理密钥。网页只在当前页面内存中保留密钥，刷新后需重新输入。管理密钥只给作者，分发管理员只接收对应的一批激活码。

为了支持历史批次重新复制，批量激活码通过 AES-GCM 加密存储，密钥从 ADMIN_TOKEN 派生，数据库不会直接保存明文码。变更 ADMIN_TOKEN 前需先导出所有批次或迁移加密数据，否则无法重新导出旧批次；已发出的码仍可激活。旧单码接口仍只返回一次明文码。

“未使用”不能证明未私发，重导出的批次不要再交给另一名管理员。群里公开整批码时先注册者占用，建议负责人逐个私发。批次列表最多显示最近100批。

以下是可选的单码命令接口：

PowerShell 示例，设置你的实际 HTTPS 地址，执行时从密码管理器输入管理密钥：

```powershell
$phoneBase = 'https://你的域名'
$phoneSecret = Read-Host 'ADMIN_TOKEN' -MaskInput
$phoneHeaders = @{ Authorization = "Bearer $phoneSecret"; Origin = $phoneBase }
Invoke-RestMethod "$phoneBase/api/admin/codes" -Method Post -Headers $phoneHeaders -ContentType 'application/json' -Body '{}'
```

返回的 `code` 就是发给买家的激活码。新生成的单码会加密留存，注册后可在用户管理页查看对应码。买家访问网站，点“首次使用？用QQ号注册并激活”，填写QQ号、本站密码、激活码。第二设备用同一QQ号和本站密码登录即可，不需要再消耗激活码。

人工审核换机后（会清除该账号全部设备并使已有会话失效）：

```powershell
Invoke-RestMethod "$phoneBase/api/admin/reset-devices" -Method Post -Headers $phoneHeaders -ContentType 'application/json' -Body '{"username":"买家账号"}'
```

吊销激活码及其账号的访问权限：

```powershell
Invoke-RestMethod "$phoneBase/api/admin/revoke-code" -Method Post -Headers $phoneHeaders -ContentType 'application/json' -Body '{"code":"需要吊销的激活码"}'
```

当前没有自助密码找回。需要恢复密码时应先核验买家身份，再增加受控重置流程，不应索取旧密码。每 IP 每15分钟最多15次注册/登录尝试；大量共享出口用户可能共用额度。规模扩大时再增加 Cloudflare 限流或 Turnstile。定期清理 D1 的过期 attempts 和 sessions，并按需备份数据库。

## 验证

```powershell
node --test server/access/worker.test.mjs
```

测试使用 Node 24 内置 SQLite 验证真实约束、单次激活、两设备上限、同设备登录、换机重置、撤销、会话失效及限流；上线后还需用两个真实浏览器测试 Cookie 和第三设备拒绝。Cloudflare Worker 的静态资源配置参考：https://developers.cloudflare.com/workers/static-assets/binding/
