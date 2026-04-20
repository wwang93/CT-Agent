# CT-AGENT (V1.4)

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
