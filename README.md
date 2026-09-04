# CT-AGENT · 教育心理学教学分支 V1

课程 `0833032` · 32 学时 · 2 学分 · 面向语言专业学习者。

本分支基于下方 CT-AGENT V1.4，保留 Next.js / Supabase / OpenAI 技术栈，将中心体验改为教学脚手架。原主分支与原站点不受本分支修改影响。

## 本版交付与边界

- 15 单元课程地图；单元 6「认知学习」与 9「自我调节学习」有完整任务。其余 13 单元不是已上线任务。
- 学生：初始解释 → 分层提示与修订 → 独立迁移 → 反思记录。正式任务保存到账号，可继续、回看与导出。
- 教师：审核案例、四阶段问题、三层提示、概念卡和标准；发布不可变版本快照；邀请码入课；查看过程与反馈。
- 研究：默认关闭，版本化告知与学生独立选择；仅研究者可读取授权子集，导出时重新检查同意状态。
- `/preview` 是**无持久化、无 AI 调用的交互样板**，并非真实教学数据。正式学习没有内存/浏览器存储替代数据库的回退。
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

`npm test` 包含课程学时、状态机、幂等提交、提示边界、越权防护、任务快照、研究授权/退出和并发版本冲突。集成测试使用数据库客户端替身，**不等于真实 Supabase、邮件或模型服务联调**。

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
