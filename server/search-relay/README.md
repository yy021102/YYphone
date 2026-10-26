# MCP 与搜索连接中转

GitHub Pages 只能托管静态页面。一些 MCP / REST 服务不接受浏览器跨域请求，需要在服务端转发。本目录是可单独部署的 Cloudflare Worker，不改变小手机的部署方式，也不会随前端构建自动上线。

## 部署

1. 在本目录运行 `npx wrangler secret put RELAY_TOKEN`，设置一段随机的中转口令。
2. 运行 `npx wrangler deploy`，获得 Worker 的 HTTPS 地址。
3. 在 Worker 的设置中，可将 `ALLOWED_ORIGINS` 配为小手机的来源，例如 `https://你的用户名.github.io`（不包含仓库路径），多个来源用英文逗号隔开。
4. 小手机「设置 → MCP 与搜索工具 → 连接中转」填入 Worker 地址和同一中转口令，打开开关。
5. 添加「Tavily（MCP）」，在服务的 Bearer Token 中填写 **Tavily 自己的 Key**，点击「连接并获取工具」。在「测试查询」里还能测试实际调用。

Worker 中转口令和搜索服务 Key 是两份不同的配置。

默认允许 Tavily MCP、Tavily REST、Exa 和博查的官方域名。自定义服务时，在 Worker 变量 `ALLOWED_HOSTS` 中补充域名，例如 `mcp.example.com,search.example.com`；只填域名，不带路径。不转发 Cookie、浏览器身份头或跳转地址。服务返回重定向时，应把设置中的地址改为最终入口。

中转会接收服务密钥，因此只填写自己控制或信任的中转地址。密钥不写入仓库、日志或决策模型。未配置中转时继续直接连接，内置免 Key 工具不经过此中转。

## 验证

```powershell
npx tsx --test server/search-relay/worker.test.ts src/utils/mcpTools.test.ts
```

前端连接成功和外部账号有可用额度是不同的检查。401 表示认证失败；429 可能是限流或额度不足；网页提示跨域时，可检查中转是否启用。仅取得工具列表不能证明每个工具都能实际调用。
