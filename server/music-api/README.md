# 一起听 · 网易云音乐服务

前端入口在桌面「一起听 → 网易云音乐」。可以扫码登录、分页读取自己的歌单、搜索歌曲，将歌曲加入现有播放列表，与所选角色一起听。本地上传、音频链接继续可用。

## 默认服务与自建切换

前端不再内置第三方公共服务。主页保留「一起听」小组件，点开进入全屏音乐页面；上传本地音频、添加音频链接不需要部署网易云服务。

地址优先级是：玩家在齿轮里保存的自建地址 → 作者构建时的 `VITE_NETEASE_API_URL`。两者都没有时提示填写，不请求任何公共服务。玩家可点「恢复默认服务」清除自己的覆盖地址；保存界面显示的默认地址不会将其固定成个人设置，之后仍跟随作者更新。更换实际服务地址会清除原服务的本机登录，不自动把凭证转发到新服务。

作者以后部署好本目录的服务，在 GitHub Pages 工作流中配置仓库变量 `NETEASE_API_URL`；本地构建或 Cloudflare Pages 的构建环境中配置 `VITE_NETEASE_API_URL`，再重新构建即可。Cloudflare 直接上传 `dist` 时需要在上传前的本地构建中设置该变量。玩家仍可以填写自己的地址。

本目录是独立服务，不参与小手机前端的依赖安装，不会改变 GitHub Pages 的部署流程。基于第三方开源项目 [NeteaseCloudMusicApi Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)（MIT），固定依赖版本 4.41.1。它不是网易云官方开放平台。

## 本机启动

需要 Node.js 22 或更新版本。在本目录打开 PowerShell：

```powershell
npm ci --omit=dev --ignore-scripts
Copy-Item .env.example .env
npm start
```

前端运行 `npm run dev` 时，音乐服务地址填 `http://localhost:3001`，点击「保存并测试」，然后扫码。手机访问电脑时，需在 `.env` 将 HOST 改成 `0.0.0.0`，ALLOWED_ORIGINS 加入手机访问网页的实际来源，地址中的 localhost 换成电脑局域网 IP；HTTPS 网页需要 HTTPS 音乐服务。

## 供 GitHub Pages / 手机长期使用

GitHub Pages / Cloudflare Pages 继续托管小手机前端；本目录的 Node 音乐服务单独部署。已准备 Render 的部署配置，也保留 Vercel 的函数入口。

### 当前方案：Render Free

当前已部署的音乐服务：`https://yyphone-music.onrender.com`；健康检查：`https://yyphone-music.onrender.com/health`。GitHub 仓库的 `NETEASE_API_URL` 构建变量已配置为该地址。本机 `.env.local` 同样配置了 `VITE_NETEASE_API_URL`，本地重新构建及后续 GitHub Pages 构建会自动带入；播放器中的个人自建地址仍优先使用。

仓库根目录 `render.yaml` 已配置一个 **Free** 音乐服务，使用现有 Dockerfile、Node 22、新加坡区域及 `/health` 健康检查。不会创建数据库或付费磁盘，也不随小手机的普通提交自动重建音乐服务。

1. 将配置推送到自己的 GitHub 仓库后，用 GitHub 登录 [Render](https://dashboard.render.com/)。
2. 使用 [Deploy to Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fyy021102%2FYYphone) 或 **New → Blueprint**，选择本仓库。部署前核对只有一个 `yyphone-music` 服务，套餐为 **Free**。
3. 已允许小手机当前的两个来源：`https://yyphone.pages.dev` 和 `https://yy021102.github.io`。如使用其他域名，在音乐服务的 Environment 修改 `ALLOWED_ORIGINS`，多个来源用英文逗号隔开，不带网页路径。
4. 服务显示 Live 后，复制其 HTTPS 地址，打开 `/health` 应返回 `service: yyphone-music`。再填进小手机「一起听 → 网易云音乐 → 音乐服务设置」保存测试，实际扫码验证。
5. 确认登录、歌单、播放可用后，按上方的 `VITE_NETEASE_API_URL` / `NETEASE_API_URL` 配置前端默认地址。

如果手动创建 Web Service：Root Directory 填 `server/music-api`，Language 选 Docker，Dockerfile Path 填 `./Dockerfile`，套餐选 Free，环境变量同上，不要运行小手机的前端构建命令。

免费实例 15 分钟无人访问会休眠，下一次启动约需一分钟（[Render 说明](https://render.com/docs/free)）。首次连接若超时，可以先打开音乐服务的 `/health` 等到返回结果，再回小手机重试。扫码和播放是否可用，仍需在该部署的网络环境下实测。

### 省事方式：Vercel

Vercel 可直接连接 GitHub 仓库，并只部署其中一个目录（[官方说明](https://vercel.com/docs/monorepos)）。其 [Hobby 免费方案](https://vercel.com/docs/plans/hobby)面向个人、非商业项目，有使用额度限制。先用它试跑，不必先开通付费方案。

1. 先将本次改动提交、推送到你自己的 GitHub 仓库。
2. 登录 [Vercel](https://vercel.com/new)，用 GitHub 登录，导入这个小手机仓库。
3. **Root Directory（根目录）选 `server/music-api`**，不要选整个小手机；Framework Preset 选 **Other**。安装、输出目录等已在本目录 `vercel.json` 配好，不需要运行前端构建，也不要把 `npm start` 填成构建命令。
4. 在 Environment Variables 添加 `ALLOWED_ORIGINS`，值为你的小手机网页来源。例如网页是 `https://alice.github.io/YYppphh/`，这里填 `https://alice.github.io`。自定义域名填其实际来源；多个来源用英文逗号分开。不需要填写网易云账号、密码、Cookie 或聊天 API Key。
5. 点 **Deploy**。部署完成后，从 Domains 复制稳定的生产地址，例如 `https://你的音乐项目.vercel.app`，不要用每次变化的预览地址。打开这个地址的 `/health`，应看到 `"service":"yyphone-music"`。
6. 回到小手机「一起听 → 网易云音乐 → 音乐服务设置」，填这个地址，保存并测试，然后扫码。先确认自己能登录与播放，再做下一步。
7. 如果想让玩家免填：在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 新建变量 **`NETEASE_API_URL`**，值为上述生产地址；再在 Actions 中重新运行 Deploy to GitHub Pages 工作流。后续构建的网页就会自带这个地址。

Vercel 项目的**生产地址**需要允许小手机直接访问。如果 `/health` 显示 Vercel 登录页，请在该项目 Settings → Deployment Protection 检查生产部署的访问保护；只调整这个专门的音乐接口项目，不必调整其他项目。网页「测试连接」若提示跨域，检查 ALLOWED_ORIGINS，并在修改环境变量后重新部署。

这里已完成本机真实匿名二维码验证、函数适配和浏览器模拟验证；在你自己的 Vercel 账号上线后，仍需实际扫码确认该部署的网络和网易云风控情况。若 Vercel 域名在你的网络打不开，可绑定你已有的可访问域名，或换托管平台；不要为了本功能先付费买域名。播放器不会绕过网易云账号权限。

### 已有服务器时

也可将本目录作为独立 Node 项目部署到自己管理的服务器或支持 Node / Docker 的托管平台。构建命令 `npm ci --omit=dev --ignore-scripts`，启动命令 `npm start`；托管平台需要环境变量 HOST=`0.0.0.0`、PORT（按平台要求）、ALLOWED_ORIGINS=`https://你的用户名.github.io`。平台提供 HTTPS 域名，或用反向代理提供 HTTPS。

也可以在本目录构建镜像：

```powershell
docker build -t yyphone-music .
docker run --rm -p 127.0.0.1:3001:3001 -e ALLOWED_ORIGINS=https://你的用户名.github.io yyphone-music
```

上述 Docker 端口仅绑定本机，供同一台服务器的 HTTPS 反向代理访问。部署完成后访问 `/health` 可检查服务是否启动，前端「保存并测试」则会检查实际的二维码接口。

音乐服务地址可以让玩家自行填写。若作者希望默认内置地址，在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加仓库变量 `NETEASE_API_URL`，内容为服务的 HTTPS 地址。现有 Pages 构建流程已接好这个变量，下一次构建后玩家可直接扫码。未配置时不影响原有网页部署。本地构建可设置 `VITE_NETEASE_API_URL`。这个地址是公开配置，不要放账号登录凭证。作者运行的服务能接收玩家登录状态，请提前说明并限制访问来源；规模扩大时应在反向代理配置并发、限流。

## 登录与播放

- 登录凭证通过 POST 发送；本服务不保存账号、不转发 Set-Cookie、不缓存个人歌单，不提供修改账号或歌单的接口。不要在反向代理开启请求体日志。
- 前端登录状态放在当前标签页 sessionStorage，刷新页面可继续使用，关闭会话后需要重新扫码。它不在整机备份、角色提示词或播放列表里。「退出网易云」清除本机登录状态，不撤销其他网易云设备的登录。
- 只请求正常账号的标准音质播放接口，不启用解灰、第三方换源或权限绕过。歌曲不可用或只提供试听时会提示，不能保证所有歌曲都能播放。音乐地址临时获取，不保存过期播放地址。
- 可以改接兼容 NeteaseCloudMusicApi、支持 POST JSON 和跨域的自建服务。不要填写音乐官网地址、聊天 API 地址或未经信任的公共代理。
- 若网页提示连接失败：确认服务启动、HTTPS 可访问，以及 ALLOWED_ORIGINS 与浏览器实际来源一致（不包含仓库路径）。扫码过期可刷新；登录过期可退出后重新扫码。
- 扫码、歌单与搜索不调用聊天模型；服务器和平台的费用按实际部署方案计算。

## 验证

```powershell
npm test
# 可选：实际请求匿名二维码，不登录账号、不输出二维码或登录凭证。
npm run smoke
```

在小手机仓库根目录运行 `npx tsx --test src/utils/neteaseMusic.test.ts` 可验证前端接口、凭证隔离、歌曲地址失效与切歌竞态。
