# CT-AGENT · 教育心理学五次教学干预 V1.1

课程 `0833032` · 32 学时 · 2 学分 · 面向语言专业学习者。

本分支基于下方 CT-AGENT V1.4，保留 Next.js / Supabase 技术栈，使用统一模型接口直接调用 **DeepSeek 官方 API**。OpenAI 仅作为管理员显式选择的备用；不经 Fireworks，不自动切换。原主分支与原站点不受本分支修改影响。

## 本版交付与边界

- 首页以五次教学干预为中心；干预 1 对应 Week 7 / 课程单元 6，干预 2 对应 Week 10 / 课程单元 10，两份任务已按教师讲义改编。后三次待选讲义，不制造占位任务。15 单元大纲作为折叠背景保留。
- 干预 1 分析注意、认知负荷、意义编码和提取练习；干预 2 保留初始判断、证据评价、方案生成、选择修订与迁移。任务均须经教师审核发布。
- 学生：初始解释 → 分层提示与修订 → 独立迁移 → 反思记录。正式任务保存到账号，可继续、回看与导出。
- 教师：审核案例、四阶段问题、三层提示、概念卡和标准；发布不可变版本快照；邀请码入课；查看过程与反馈。
- 研究：默认关闭，版本化告知与学生独立选择；仅研究者可读取授权子集，导出时重新检查同意状态。
- `/preview` 是**无持久化、无 AI 调用的交互样板**，并非真实教学数据。正式学习没有内存/浏览器存储替代数据库的回退。
- 新会话保存干预编号、真实教学周、课程单元、任务和课程版本、供应商及请求模型。对话另存返回模型、提示词版本、用量与耗时；AI 失败事件不计为成功对话。旧版记录不自动纳入新干预。
- `/api/chat`、`/api/events`、`/api/templates`、`/api/analytics` 在本分支返回 410，防止绕过新课程的入课、阶段与授权约束。原代码可从主分支取得。

平时 / 期中 / 期末的 20% / 30% / 50% 仅说明大纲安排；系统不自动评分，不以对话次数计算成绩或认知水平。原创样板均标注为待教师审核材料，不伪装成教材原文。

## 开发与验证

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

`npm test` 包含课程学时、五次干预映射、状态机、幂等提交、提示边界、越权防护、任务快照、研究授权/退出、并发版本冲突及 DeepSeek 请求契约。集成测试使用数据库和 HTTP 替身，**不等于真实 Supabase、邮件或模型服务联调**。

## EdgeOne Pages 独立迁移测试

测试分支：`codex/education-edgeone-test`，基于 `feature/educational-psychology-v1`。只新增部署配置与验收工具，不替换现有 Sites 版本，不改正式域名、不迁移数据库、不创建或重置师生账号。

在腾讯云 EdgeOne Pages 创建**新的测试项目**，从 GitHub 导入本仓库，生产分支仅选 `codex/education-edgeone-test`，不要修改原项目的生产分支。选择 Next.js 全栈框架、免费套餐及“全球可用区（不含中国大陆）”；不是静态文件上传，也不要运行 `build:sites`。`edgeone.json` 固定安装命令 `npm ci`、构建命令 `npm run build:edgeone`、输出目录 `.next`、Node 22.11.0，境外函数使用新加坡并设置 60 秒上限，给 30 秒模型请求及其数据库读写留出时间。现有 `standalone` 配置保留，不额外租服务器。

首次可不配置任何密钥，先验证首页、讲义预览和未登录拒绝访问。真实账号联调时，在**新测试项目**的环境变量设置中配置下列名称，值从本地私密配置安全填写；不能放进 `edgeone.json`、Git、聊天、前端代码或构建命令：

| 配置 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 现有教育心理学课程库的公开 Auth 配置 |
| `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` | 同一课程库的服务端配置；管理员密钥绝不公开 |
| `EDU_AI_PROVIDER=deepseek`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL=deepseek-flash` | 沿用官方 DeepSeek，不自动回退 |
| `EDU_CLASSROOM_ENABLED=false` | 测试部署不擅自开启正式课堂 |
| `EDU_AI_MAX_CONCURRENT=20`、`EDU_AI_DAILY_REQUEST_LIMIT=1000` | 沿用共享并发与请求保护 |

如继续使用现有课程库，课程记录与账号权限是共享的，**测试站不是数据沙箱**。教师在测试站发布任务、重置访问码、修改设置会影响同一课程；研究管理读取也会留下审计记录。首轮仅做匿名只读检查；需要真实保存和对话时，只使用明确标记的受控 QA 身份，不批量修改或删除正式记录。不要运行数据库初始化 SQL、人员发放脚本或自动覆盖现有教师配置。`OPENAI_API_KEY` 不需要复制。

验收命令（无账号凭证、无数据库写入、无模型费用）：

```bash
npm test
npm run typecheck
npm run build:edgeone
npm run test:deployment -- --target http://127.0.0.1:3014
npm run test:deployment -- --target https://你的测试域名 --require-configured
```

验收检查 HTML 页面、静态资源、运行时配置、未登录的数据保护、登录格式校验和跨站登录拒绝；不输出配置公钥、响应正文或访问令牌。`--require-configured` 要求 Auth、数据库及模型配置齐备，但**有配置不代表外部服务已经联通**。检查脚本不跟随跳转，不接受带路径、凭证或预览令牌的目标 URL。

平台默认域名在大陆有访问限制（预览链接有效期 3 小时），不能直接当作课堂永久地址。待首次部署验证通过，再申请绑定现有域名下的独立测试子域名，例如 `test.edupsyclass.click`，不要切换根域名。境外节点不要求 ICP 备案；如改用大陆节点，须满足平台的备案要求。DNS、域名绑定和服务端密钥配置在执行前单独确认。`X-Robots-Tag` 仅防搜索收录，不代替账号保护；`/api/*` 禁止共享缓存。

完整联调还必须从大陆普通移动/联通/电信网络验证登录、过期会话刷新、角色权限、合成学习记录保存与回读及 DeepSeek 响应。浏览器目前会直接访问 Supabase Auth，所以仅首页可访问不能认定迁移成功。新站邮箱回调如需使用，也要在 Supabase 中单独确认允许的重定向地址。现有课堂、研究状态与研究同意规则不随部署改变；本地构建、匿名检查都不等于 100 人容量验收。

官方资料：[Next.js 支持](https://pages.edgeone.ai/zh/document/framework-nextjs)、[部署配置](https://pages.edgeone.ai/zh/document/edgeone-json)、[域名规则](https://pages.edgeone.ai/zh/document/domain-overview)。具体额度及构建器支持以测试项目控制台为准。

## DeepSeek 官方接入

将下列配置放入未提交的 `.env.local`；部署时使用 Sites 的服务端环境变量/密钥设置，不将真实 Key 发进聊天或提交 Git：

```dotenv
EDU_AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_server_only_key
DEEPSEEK_MODEL=deepseek-flash
```

调用地址固定为 `https://api.deepseek.com/chat/completions`；默认为非思考模式，仅记录可见回复，不记录模型内部推理。根据 [DeepSeek 官方模型文档](https://api-docs.deepseek.com/quick_start/pricing/)（核对于 2026-10-08），`deepseek-flash` 当前对应 V4.1 Flash；这是可更新的供应商别名，不承诺固定权重。

显式备用配置：`EDU_AI_PROVIDER=openai`、`OPENAI_API_KEY`、`EDU_OPENAI_MODEL`。已开始会话仍使用开始时保存的供应商/模型，不自动混用；研究对照条件须另行设计。缺少当前供应商 Key 时只保留教师提示，不伪造 AI 回复。

完整部署和课堂启用步骤见 [教育心理学部署说明](docs/education-v1.md)。当前代码默认 `EDU_CLASSROOM_ENABLED=false`；正式学生加入前必须完成该清单。不要直接将这个分支连接到原 CT-AGENT 的生产数据库。

---

## 原项目说明（V1.4，供架构沿革参考）

CT-AGENT is a V1.4 prototype for GenAI-supported critical-thinking instruction.

## What is new in V1.4

- Email sign-up/sign-in with Supabase Auth
- Email verification callback flow
- Forgot-password and reset-password flow
- Role-based access gates (`student`, `instructor`, `researcher`)
- Role-based routing after login
- Real authenticated user IDs in logs (not mock IDs)

## Core experiences

- Student Coach: Socratic dialogue with active scaffold injection
- Instructor Copilot: generate/publish HOT scaffolds by course/week/assignment
- Research Analytics: role-restricted analytics with week-level breakdown

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- OpenAI SDK
- Supabase (Auth + Postgres persistence)

## Local run

1. Install

```bash
npm install
```

2. Configure env

```bash
copy .env.example .env
```

3. Fill required env vars

```bash
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5-nano

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

4. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup

Run schema migration in Supabase SQL Editor:

- `supabase/schema.sql`

This creates:

- `events`
- `course_templates`
- `profiles`

## Vercel deployment

1. Push repository to GitHub
2. Import project in Vercel
3. Add the same env vars listed above
4. Redeploy after env changes

## Auth routes

- `/auth` sign-in/sign-up/forgot-password
- `/auth/callback` email verification callback
- `/auth/reset-password` set new password

Role landing pages:

- `student` -> `/student`
- `instructor` -> `/instructor`
- `researcher` -> `/research`

## Logging model

`events` include structured fields such as:

- `courseId`
- `weekNumber`
- `assignmentId`
- `sessionId`
- `turnIndex`
- `templateVersion` in payload
- authenticated Supabase `user_id`

## Notes

- V1.4 is suitable for pilot and controlled research deployments.
- Production hardening (consent workflow, stricter policy controls, observability, audit exports) should be added for large-scale rollout.
