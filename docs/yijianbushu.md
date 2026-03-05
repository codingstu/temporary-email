
## 一键部署指南

#### 1. Fork 本仓库到你的 GitHub 账号

#### 2. 在 Cloudflare Workers 中通过 Git 集成部署
推荐选择亚洲地区（当然不选择亚洲也没关系）

`不要修改数据库名称和R2名称 可能导致无法查询`

#### 3. 点击创建部署，然后耐心等待克隆部署

#### 4. 点击继续处理项目，绑定必须的环境变量

#### 5. 添加完成后点击部署即可

`注：TEMP_MAIL_DB、MAIL_EML、MAIL_DOMAIN 这三个变量是必须的，其他变量例如管理员名称、发邮件密钥可自行决定是否添加`

#### 5.1 防止“部署后变量丢失”（强烈建议）

1. `wrangler.toml` 不要添加 `[vars]`（会覆盖 Dashboard Variables/Secrets）
2. 不要频繁改 Worker 名称 `name`，否则会发布到新脚本，表现为“原变量消失”
3. 每次发布后，立刻在 Worker → Settings → Variables and Secrets 检查以下绑定是否存在：
   - `TEMP_MAIL_DB`（D1）
   - `MAIL_EML`（R2）
   - `MAIL_DOMAIN`（域名）
   - `JWT_TOKEN`（密钥）

4. 部署完成后访问 `/api/runtime-config-health`：
   - 返回 `200` 且 `success=true`：配置完整
   - 返回 `503`：按 `missing` 字段逐项补齐（不是代码问题，是当前 Worker 运行时缺少绑定/变量）

最后就可以打开对应的 Worker 链接登录了。

#### 6. 默认管理员账号为 admin

#### 7. 记得将域名邮箱的 catch-all 绑定到 Worker 上（不绑定无法接收到邮件）

进入 Cloudflare 控制台 → 域名 → 电子邮件 → 电子邮件路由 → Catch-all → 绑定到对应 Worker。

#### 8. 推荐启用 GitHub Actions 持久注入（彻底规避变量漂移）

仓库内置工作流：`.github/workflows/deploy-worker.yml`

1. 在 GitHub 仓库 Secrets 中添加：
   - 必填：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`ADMIN_PASSWORD`、`JWT_TOKEN`、`MAIL_DOMAIN`
   - 可选：`RESEND_API_KEY`、`GUEST_PASSWORD`、`REPO_URL`、`SITE_NAME`、`FOOTER_TEXT`、`FORWARD_RULES`
   - 可选：`WORKER_HEALTH_URL`（用于自动调用 `/api/runtime-config-health`）
2. 推送到 `main` 自动执行：先注入 secrets，再 `wrangler deploy`
3. 工作流结束后查看健康检查输出，确保 `success=true`

#### 9. 上线后必做一次真实收件验证（E2E）

1. 发一封测试邮件到你的临时邮箱（例如 `netflix@readygo.cc.cd`）
2. 在 Worker 日志里执行 `wrangler tail <worker_name> --format pretty` 确认有触发日志
3. 用 D1 查询确认入库（`messages.received_at` 有最新记录）
